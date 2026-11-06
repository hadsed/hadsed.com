// The shared world look: sky, real terrain, cloud deck and the monotone pass.
// The SR-71 backdrop (notes/storyboards/sr71-backdrop.mjs) and the flight lab both draw with this, so
// the backdrop and the game are the same place in the same light.
//
//   const world = createWorld();
//   scene.add(world.sky, world.terrain, world.clouds);
//   world.setHeight(await loadTerrarium(url), region);    // or a float texture (encoded: false)
//   world.setLook({ ...WORLD_DEFAULTS, ... });              // any subset of the keys below
//   world.frame(camera, origin);                            // every frame, before drawing
//   const post = createPost(renderer); post.render((target) => { ...draw scenes... });
//
// Units are world meters. Render space = world space minus `origin` (the flight lab passes 0; the
// backdrop passes the jet's world position so the jet sits at the render origin and stays precise).
// The ground bends down with the Earth's curvature relative to the camera.
//
// Two ways to finish a frame:
// - post pass (createPost): scenes render linear color into a float target, alpha marks lines that may
//   turn gold, then one full-screen pass tones it (monotone ramp, mono mix, vignette, gamma, grain).
// - direct (mono 0 with skipWhenOff, or uDirect = 1): every world shader tones itself and writes
//   display color, so a renderer can draw straight to the screen with no extra pass.
// The sky is always toned to the palette, so it reads the same in the backdrop and in the game.
import * as THREE from 'three';

export const EARTH_R = 6371000;

// The backdrop look Had landed on (2026-11-05/06): Sierra, 85k ft, grid 250 m, contours 175 m.
// 2026-11-06: navy monotone stays dominant, natural ground color bleeds through it (chroma). Chroma 0 +
// color 0 is the original navy terrain grid; mono 0 is full natural color.
export const WORLD_DEFAULTS = {
  shadow: '#07090e', mid: '#1c2433', light: '#c8cdd5', highlight: '#e4c56f',
  midPoint: 0.56, hlStart: 0.61, hlAmount: 0.85, mono: 1, chroma: 0.7, exposure: 1.12, contrast: 1.13, grain: 0, vignette: 1.2,
  region: 'sierra', altitudeFt: 85000, exag: 1, offsetX: 79, offsetZ: -69.1, sunAz: 41, sunEl: 18, haze: 130, clouds: 0.54, fov: 23,
  grid: 0.66, gridSize: 250, contour: 0.46, contourStep: 175, shade: 0.39, lineBright: 0.73, lineGold: 0,
  tint: 0, tintContrast: 1, tintPivot: 0.5, slope: 0,
  color: 1, texture: 1,
};

const col = (hex) => { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };  // linear

export const NOISE = /* glsl */`
float whash(vec2 p){ p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(whash(i), whash(i + vec2(1, 0)), u.x), mix(whash(i + vec2(0, 1)), whash(i + vec2(1, 1)), u.x), u.y);
}
const mat2 ROT = mat2(0.8, -0.6, 0.6, 0.8);
float fbm(vec2 p, int oct){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 8; i++){ if (i >= oct) break; s += a * vnoise(p); p = ROT * p * 2.03 + 17.1; a *= 0.5; }
  return s;
}`;

// The palette ramp, shared by the post pass and by the shaders when they finish themselves (direct).
const TONE = /* glsl */`
uniform vec3 uShadow, uMid, uLight, uHigh;
uniform float uMidPoint, uHlStart, uHlAmount, uMono, uExposure, uContrast, uDirect, uChroma;
// natural color, on the same brightness curve the ramp uses (so mono 0 and 1 match in brightness)
vec3 natural(vec3 c){ return pow(clamp(c / (1.0 + c) * 1.55, 0.0, 1.0), vec3(0.85 * 2.2)); }
vec3 naturalInv(vec3 y){ vec3 t = pow(clamp(y, 0.0, 0.999), vec3(1.0 / (0.85 * 2.2))) / 1.55; return t / (1.0 - t); }
vec3 ramp(vec3 c, float gold){
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  l = l / (1.0 + l);                       // soft rolloff on the sun and horizon limb
  l = pow(clamp(l * 1.55, 0.0, 1.0), 0.85);
  l = clamp((l - 0.5) * uContrast + 0.5, 0.0, 1.0);
  vec3 r = l < uMidPoint ? mix(uShadow, uMid, l / uMidPoint) : mix(uMid, uLight, (l - uMidPoint) / (1.0 - uMidPoint));
  float hl = smoothstep(uHlStart, min(uHlStart + 0.18, 1.0), l) * uHlAmount;   // gold on the brightest values
  return mix(r, uHigh, max(hl, clamp(gold, 0.0, 1.0)));
}
// The navy ramp sets brightness; chroma adds the scene's own hue on top (its color minus its grey),
// so forests read green and snow white while the monotone stays dominant.
vec3 display(vec3 c, float gold){
  c *= uExposure;
  vec3 nat = natural(c);
  vec3 m = mix(nat, ramp(c, gold), uMono);
  vec3 hue = nat - vec3(dot(nat, vec3(0.2126, 0.7152, 0.0722)));
  return max(m + hue * uChroma * uMono, 0.0);
}
// surfaces: linear color + gold mask for the post pass, or finished display color when direct
vec4 finish(vec3 c, float gold){ return uDirect > 0.5 ? vec4(pow(display(c, gold), vec3(1.0 / 2.2)), 1.0) : vec4(c, gold); }
// the sky: always on the palette. For the post pass it writes a color the pass maps back to the
// toned sky at any mono amount (exact at 0 and 1).
vec4 finishSky(vec3 c){
  vec3 toned = ramp(c * uExposure, 0.0);
  if (uDirect > 0.5) return vec4(pow(toned, vec3(1.0 / 2.2)), 1.0);
  vec3 grey = vec3(dot(c, vec3(0.2126, 0.7152, 0.0722)));
  return vec4(mix(naturalInv(toned) / uExposure, grey, uMono), 0.0);
}`;

const LINES = /* glsl */`
// anti-aliased lines that fade out before they get denser than a couple of pixels
float lines2(vec2 c){ vec2 fw = fwidth(c); vec2 g = abs(fract(c - 0.5) - 0.5) / max(fw, 1e-6);
  return (1.0 - min(min(g.x, g.y), 1.0)) * (1.0 - smoothstep(0.12, 0.45, max(fw.x, fw.y))); }
float lines1(float c){ float fw = fwidth(c); float g = abs(fract(c - 0.5) - 0.5) / max(fw, 1e-6);
  return (1.0 - min(g, 1.0)) * (1.0 - smoothstep(0.12, 0.45, fw)); }`;

// One grid, dense under the camera (~350 m apart at n 512) and stretching out toward the horizon,
// so a single draw covers 1,500 km.
export function terrainGeometry(n = 512, R = 750000, a = 0.12) {
  const pos = new Float32Array(n * n * 3), idx = new Uint32Array((n - 1) * (n - 1) * 6);
  const warp = (u) => R * u * (a + (1 - a) * u * u);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = (j * n + i) * 3;
    pos[k] = warp((i / (n - 1)) * 2 - 1); pos[k + 2] = warp((j / (n - 1)) * 2 - 1);
  }
  let t = 0;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const v = j * n + i;
    idx.set([v, v + n, v + 1, v + 1, v + n, v + n + 1], t); t += 6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 1.5);
  return g;
}

// A terrarium heightmap (height = R*256 + G + B/256 - 32768) as a texture the terrain decodes on the
// GPU: exact bytes, no filtering, no CPU pass. Keep heightmaps as their own cacheable files.
const terrariumCache = new Map();
export function loadTerrarium(url) {
  const key = String(url);
  if (!terrariumCache.has(key)) {
    terrariumCache.set(key, (async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      const bmp = await createImageBitmap(await r.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none', imageOrientation: 'none' });
      const tex = new THREE.Texture(bmp);
      tex.colorSpace = THREE.NoColorSpace; tex.flipY = false;
      tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
      tex.userData.encoded = true;
      return tex;
    })());
  }
  return terrariumCache.get(key);
}

export function createWorld({ segments = 512 } = {}) {
  const sunDir = new THREE.Vector3(0, 1, 0);
  const U = {
    uCam: { value: new THREE.Vector3() }, uEarthR: { value: EARTH_R }, uOrigin: { value: new THREE.Vector3() },
    uSun: { value: sunDir }, uHaze: { value: new THREE.Vector3(0.50, 0.56, 0.66) }, uHazeDist: { value: 130000 },
    uCover: { value: 0.5 }, uDip: { value: 0 }, uSkyK: { value: 9 },
    uShadow: { value: col(WORLD_DEFAULTS.shadow) }, uMid: { value: col(WORLD_DEFAULTS.mid) },
    uLight: { value: col(WORLD_DEFAULTS.light) }, uHigh: { value: col(WORLD_DEFAULTS.highlight) },
    uMidPoint: { value: 0.56 }, uHlStart: { value: 0.61 }, uHlAmount: { value: 0.85 },
    uMono: { value: 1 }, uExposure: { value: 1.12 }, uContrast: { value: 1.13 }, uDirect: { value: 0 }, uChroma: { value: 0.6 },
  };

  // ---- sky: thin bright air at the horizon, near-space navy overhead, a sun and the limb ----
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1.5e6, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: U,
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vDir;
        void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uSun, uHaze; uniform float uDip, uSkyK; varying vec3 vDir;
        ${TONE}
        void main(){
          #include <logdepthbuf_fragment>
          vec3 d = normalize(vDir);
          float el = asin(clamp(d.y, -1.0, 1.0)) + uDip;       // angle above the true horizon
          vec3 zenith = vec3(0.010, 0.020, 0.055);             // near-space dark blue
          // high up most of the air is below you: a thin bright band at the horizon, navy by ~20 degrees up.
          // Lower down (uSkyK smaller) the bright band widens.
          vec3 c = mix(uHaze, zenith, 1.0 - exp(-max(el, 0.0) * uSkyK));
          c += vec3(0.30) * exp(-abs(el) * 70.0);              // bright limb on the horizon
          float sun = max(dot(d, uSun), 0.0);
          c += vec3(0.35) * pow(sun, 12.0) + vec3(3.0) * pow(sun, 2500.0);
          c = mix(c, uHaze * 0.9, smoothstep(0.0, -0.03, el));
          gl_FragColor = finishSky(c);
        }`,
    }),
  );
  sky.renderOrder = -1; sky.frustumCulled = false;

  // ---- terrain: real elevation, natural color, hillshade, snow, rock, grid and contours ----
  const TU = {
    uHeight: { value: null }, uSize: { value: 1024 }, uWidth: { value: 250000 }, uTexel: { value: 1 / 1024 }, uEncoded: { value: 1 },
    uShift: { value: new THREE.Vector2() }, uExag: { value: 1 }, uMaxH: { value: 4000 }, uSnowM: { value: 3500 }, uArid: { value: 0 },
    uGrid: { value: 1 }, uGridSize: { value: 250 }, uContour: { value: 0 }, uContourStep: { value: 175 },
    uShade: { value: 0.35 }, uLineBright: { value: 0.6 }, uLineGold: { value: 0 },
    uTint: { value: 0 }, uTintContrast: { value: 1 }, uTintPivot: { value: 0.5 }, uSlope: { value: 0 },
    uColor: { value: 1 }, uTexture: { value: 1 },
  };
  const terrain = new THREE.Mesh(
    terrainGeometry(segments),
    new THREE.ShaderMaterial({
      uniforms: { ...U, ...TU },
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        uniform vec3 uCam, uOrigin; uniform float uEarthR, uWidth, uTexel, uExag, uEncoded; uniform vec2 uShift;
        uniform sampler2D uHeight; uniform int uSize;
        varying vec2 vXZ; varying float vDist, vH; varying vec3 vN;
        // exact texels, mirrored past the edges, decoded, then interpolated
        float texH(ivec2 p){
          int n = uSize; p = ivec2(mod(vec2(p), float(2 * n)));
          if (p.x >= n) p.x = 2 * n - 1 - p.x;
          if (p.y >= n) p.y = 2 * n - 1 - p.y;
          vec4 t = texelFetch(uHeight, p, 0);
          if (uEncoded < 0.5) return t.r;
          vec3 c = floor(t.rgb * 255.0 + 0.5);
          return c.r * 256.0 + c.g + c.b / 256.0 - 32768.0;
        }
        float hAt(vec2 uv){
          vec2 x = uv * float(uSize) - 0.5; vec2 i = floor(x), f = x - i; ivec2 b = ivec2(i);
          return mix(mix(texH(b), texH(b + ivec2(1, 0)), f.x), mix(texH(b + ivec2(0, 1)), texH(b + ivec2(1, 1)), f.x), f.y);
        }
        void main(){
          vec2 xz = position.xz + uShift;                  // render space
          vec2 wxz = xz + uOrigin.xz;                      // world space
          vec2 uv = wxz / uWidth + 0.5;
          float h = hAt(uv);
          float d = uTexel, m = uWidth * uTexel;
          float hx = hAt(uv + vec2(d, 0)) - hAt(uv - vec2(d, 0));
          float hz = hAt(uv + vec2(0, d)) - hAt(uv - vec2(0, d));
          vN = normalize(vec3(-hx * uExag, 2.0 * m, -hz * uExag));
          vec3 w = vec3(xz.x, h * uExag - uOrigin.y, xz.y);
          vec2 rel = xz - uCam.xz;
          w.y -= dot(rel, rel) / (2.0 * uEarthR);
          vXZ = wxz; vH = h; vDist = distance(w, uCam);
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uSun, uHaze; uniform float uHazeDist, uMaxH, uGrid, uGridSize, uContour, uContourStep, uShade, uLineBright, uLineGold;
        uniform float uTint, uTintContrast, uTintPivot, uSlope, uColor, uTexture, uSnowM, uArid;
        varying vec2 vXZ; varying float vDist, vH; varying vec3 vN;
        ${NOISE}
        ${TONE}
        ${LINES}
        // What the ground is made of, lit by the sun: valley floor, forest, alpine, rock on steep faces,
        // snow above the snowline, water at sea level. Texture at two scales fades out with distance.
        vec3 ground(vec3 n, float lit){
          float steep = 1.0 - n.y;
          vec2 q = vXZ / 900.0;
          float fine = mix(0.5, fbm(q, 4), 1.0 - smoothstep(0.25, 0.9, max(fwidth(q.x), fwidth(q.y))));
          float broad = fbm(vXZ / 12000.0 + 3.7, 4);
          float hs = vH / max(uSnowM, 1.0);              // 1 at the snowline
          float jitter = (broad - 0.5) * 0.35 + (fine - 0.5) * 0.12;
          vec3 valley = mix(vec3(0.13, 0.12, 0.075), vec3(0.24, 0.18, 0.11), uArid);
          vec3 forest = mix(vec3(0.045, 0.075, 0.040), vec3(0.14, 0.12, 0.08), uArid);
          vec3 alpine = vec3(0.17, 0.16, 0.13);
          vec3 rock = mix(vec3(0.22, 0.21, 0.20), vec3(0.36, 0.18, 0.095), uArid);
          // canyon strata: bands of color with height
          rock *= mix(1.0, 0.85 + 0.3 * sin(vH / 55.0 + broad * 6.0), uArid);
          vec3 c = mix(valley, forest, smoothstep(0.18, 0.4, hs + jitter) * (1.0 - uArid * 0.7));
          c = mix(c, alpine, smoothstep(0.78, 0.95, hs + jitter));
          c = mix(c, rock, smoothstep(0.32, 0.6, steep + (fine - 0.5) * 0.25));
          float snow = smoothstep(-0.03, 0.03, hs + jitter * 0.8 - 1.0) * (1.0 - smoothstep(0.35, 0.6, steep + (fine - 0.5) * 0.3));
          c = mix(c, vec3(0.34, 0.36, 0.40), snow);
          c = mix(c, vec3(0.012, 0.025, 0.045), smoothstep(3.0, 0.5, vH));   // sea and lakes at sea level
          c *= mix(1.0, (0.72 + 0.56 * fine) * (0.82 + 0.36 * broad), uTexture);
          vec3 skyFill = vec3(0.30, 0.36, 0.48);
          return c * (skyFill * (0.35 + 0.35 * n.y) + vec3(1.0, 0.95, 0.86) * 2.2 * lit);
        }
        void main(){
          #include <logdepthbuf_fragment>
          vec3 n = normalize(vN);
          float grid = max(lines2(vXZ / uGridSize) * 0.55, lines2(vXZ / (uGridSize * 5.0)));
          float contour = max(lines1(vH / uContourStep) * 0.55, lines1(vH / (uContourStep * 5.0)));
          float ink = clamp(grid * uGrid + contour * uContour, 0.0, 1.0);
          float lit = clamp(dot(n, uSun), 0.0, 1.0);
          float rise = clamp(vH / uMaxH, 0.0, 1.0);
          // the drafted look: dark sheet, optional relief and height tint
          vec3 shaded = vec3(0.10, 0.11, 0.12) * (0.25 + 1.6 * lit) * (0.7 + 0.6 * rise);
          vec3 c = mix(vec3(0.028, 0.032, 0.04) * (0.8 + 0.5 * rise), shaded, uShade);
          float rampT = clamp(0.5 + (rise - uTintPivot) * uTintContrast, 0.0, 1.0);   // after kaolti/monolith-terrain (MIT)
          vec3 hyp = vec3(mix(0.03, 0.42, rampT)) * mix(1.0, 0.45 + 0.9 * lit, uShade);
          c = mix(c, hyp, uTint);
          // the real ground
          if (uColor > 0.0) c = mix(c, ground(n, lit), uColor);
          c *= 1.0 - uSlope * smoothstep(0.25, 0.8, 1.0 - n.y);   // steep faces darken, like hachures
          // lines are ink of a set brightness: low values give dark ink, high values glow
          c = mix(c, vec3(uLineBright) * (0.75 + 0.5 * rise), ink * (1.0 - 0.45 * uColor * (1.0 - uMono)));
          float fog = 1.0 - exp(-vDist / uHazeDist);
          vec3 haze = mix(uHaze, vec3(dot(uHaze, vec3(0.2126, 0.7152, 0.0722))), uMono);
          c = mix(c, haze * mix(1.0, 0.8, uColor), fog * fog * 0.9 + fog * 0.1);
          gl_FragColor = finish(c, ink * uLineGold * (1.0 - fog));   // gold mask: lines the tone may turn gold
        }`,
    }),
  );
  terrain.frustumCulled = false;
  terrain.visible = false;

  // ---- cloud deck: scattered cumulus at cloudM, parallax against the ground ----
  const clouds = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2e6, 1.2e6, 240, 240).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: U,
      // alpha-neutral for the post pass: clouds dim the gold mask under them and never add to it
      blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        uniform vec3 uCam, uOrigin; uniform float uEarthR;
        varying vec2 vXZ; varying float vDist;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          vec2 rel = w.xz - uCam.xz;
          w.y -= dot(rel, rel) / (2.0 * uEarthR);
          vXZ = w.xz + uOrigin.xz; vDist = distance(w.xyz, uCam);
          gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uHaze; uniform float uHazeDist, uCover; varying vec2 vXZ; varying float vDist;
        ${NOISE}
        ${TONE}
        void main(){
          #include <logdepthbuf_fragment>
          vec2 q = vXZ / 4500.0;
          float field = fbm(q * 0.18 + 4.0, 4);
          float puff = fbm(q + vec2(fbm(q * 0.5, 3)) * 1.5, 6);
          float a = smoothstep(0.86 - uCover * 0.4, 1.0 - uCover * 0.35, puff + (field - 0.5) * 0.7);
          float fog = 1.0 - exp(-vDist / (uHazeDist * 1.1));
          vec3 c = mix(vec3(0.80, 0.82, 0.85) * (0.7 + 0.4 * puff), mix(uHaze, vec3(dot(uHaze, vec3(0.2126, 0.7152, 0.0722))), uMono), fog);
          gl_FragColor = vec4(finish(c, 0.0).rgb, a * 0.9 * (1.0 - fog * 0.6) * step(0.001, uCover));
        }`,
    }),
  );
  clouds.frustumCulled = false;
  let cloudM = 7000;

  const look = { ...WORLD_DEFAULTS };
  const TERRAIN_KEYS = ['grid', 'gridSize', 'contour', 'contourStep', 'shade', 'lineBright', 'lineGold', 'tint', 'tintContrast', 'tintPivot', 'slope', 'color', 'texture'];
  const TONE_KEYS = ['midPoint', 'hlStart', 'hlAmount', 'mono', 'chroma', 'exposure', 'contrast'];
  const uName = (k) => 'u' + k[0].toUpperCase() + k.slice(1);

  return {
    uniforms: U, terrainUniforms: TU, sky, terrain, clouds, sunDir, look,
    /** Any subset of WORLD_DEFAULTS' look keys: palette, tone, sun, haze, clouds, ground style. */
    setLook(o) {
      Object.assign(look, o);
      for (const k of ['shadow', 'mid', 'light']) U[uName(k)].value.copy(col(look[k]));
      U.uHigh.value.copy(col(look.highlight));
      for (const k of TONE_KEYS) U[uName(k)].value = +look[k];
      for (const k of TERRAIN_KEYS) TU[uName(k)].value = +look[k];
      TU.uExag.value = +look.exag;
      const az = THREE.MathUtils.degToRad(look.sunAz), el = THREE.MathUtils.degToRad(look.sunEl);
      sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
      U.uHazeDist.value = look.haze * 1000;
      U.uCover.value = +look.clouds;
      if (look.cloudM) cloudM = +look.cloudM;
    },
    /** tex: from loadTerrarium, or a float texture with .r = meters (encoded false). */
    setHeight(tex, { size, metersPerPixel, maxM, snowM, arid = 0, encoded = tex.userData?.encoded ?? true }) {
      TU.uHeight.value = tex;
      TU.uSize.value = size; TU.uTexel.value = 1 / size;
      TU.uWidth.value = metersPerPixel * size;
      TU.uMaxH.value = maxM;
      TU.uSnowM.value = snowM || maxM * 0.8;
      TU.uArid.value = arid;
      TU.uEncoded.value = encoded ? 1 : 0;
      terrain.visible = true;
    },
    /**
     * Call each frame with the camera that draws the world. origin: world position of render (0,0,0).
     * shift: optional render-space xz to move the terrain grid under a moving camera (snap it to whole
     * grid cells so heights don't shimmer).
     */
    frame(camera, origin = null, shift = null) {
      if (origin) U.uOrigin.value.copy(origin); else U.uOrigin.value.set(0, 0, 0);
      U.uCam.value.copy(camera.position);
      sky.position.copy(camera.position);
      if (shift) TU.uShift.value.copy(shift); else TU.uShift.value.set(0, 0);
      const alt = Math.max(camera.position.y + U.uOrigin.value.y, 1);
      U.uDip.value = Math.acos(EARTH_R / (EARTH_R + alt));
      U.uSkyK.value = 2.5 + 6.5 * Math.min(alt / 26000, 1);
      clouds.position.y = cloudM - U.uOrigin.value.y;
      clouds.position.x = camera.position.x; clouds.position.z = camera.position.z;
      clouds.visible = alt > cloudM + 1000 && look.clouds > 0;
    },
  };
}

/**
 * The monotone pass. render(draw) calls draw(target) to draw the scenes (clearing included), into a
 * float target that it then tones to the screen. With skipWhenOff and mono 0 it skips the pass: the
 * world shaders finish themselves and draw() renders straight to the screen.
 */
export function createPost(renderer, world, { samples = 4, skipWhenOff = true } = {}) {
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
  const U = world.uniforms;
  const PU = { tColor: { value: rt.texture }, uGrain: { value: 0 }, uVignette: { value: 1.2 }, uRes: { value: new THREE.Vector2(1, 1) } };
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false, uniforms: { ...U, ...PU },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tColor; uniform float uGrain, uVignette; uniform vec2 uRes;
        varying vec2 vUv;
        ${TONE}
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          vec4 src = texture2D(tColor, vUv);
          vec3 m = display(src.rgb, src.a);
          vec2 v = vUv - 0.5; m *= 1.0 - uVignette * dot(v, v) * 1.6;
          m = pow(max(m, 0.0), vec3(1.0 / 2.2));
          m += (h(vUv * uRes) - 0.5) * uGrain;     // fine grain; also kills gradient banding
          gl_FragColor = vec4(m, 1.0);
        }`,
    }),
  );
  quad.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    target: rt, uniforms: PU, scene, camera: cam,
    get direct() { return skipWhenOff && U.uMono.value <= 0; },
    setSize(w, h, pr) { rt.setSize(Math.floor(w * pr), Math.floor(h * pr)); PU.uRes.value.set(w * pr, h * pr); },
    setLook(o) { if ('grain' in o) PU.uGrain.value = +o.grain; if ('vignette' in o) PU.uVignette.value = +o.vignette; },
    render(draw) {
      if (this.direct) {
        U.uDirect.value = 1;
        renderer.setRenderTarget(null);
        draw(null);
        return;
      }
      U.uDirect.value = 0;
      renderer.setRenderTarget(rt);
      draw(rt);
      renderer.setRenderTarget(null);
      renderer.render(scene, cam);
    },
  };
}
