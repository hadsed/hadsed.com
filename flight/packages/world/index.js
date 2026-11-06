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
  // 2026-11-06 night flight (Had's refs: a night sky full of fine stars over a thin orange afterglow at the
  // horizon, dark ground with city lights). Off by default while it's tuned in the lab: NIGHT_LOOK turns it on.
  night: 0, stars: 1, afterglow: 1, milky: 0.45, city: 1, moonAz: 200, moonEl: 32,
};
// The daytime look, for presets: the sun up at 18 degrees, no stars.
export const DAY_LOOK = { night: 0, sunEl: 18, sunAz: 41, exposure: 1.12 };
export const NIGHT_LOOK = { night: 1, sunEl: -5, sunAz: 245, stars: 1, afterglow: 1, milky: 0.45, city: 1, exposure: 2.2 };

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
  if (uMono <= 0.0) return nat;            // uniform branch: the game's natural color skips the ramp
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

// The night sky's own light, worked out per pixel from the view direction d (el: radians above the
// visible horizon; base: the sky color behind). Stars are points on a few hashed 3D grids, drawn as
// a soft dot about a pixel and a half across whatever the lens, so they stay crisp at any field of view
// and don't shimmer as the camera drifts. A faint Milky Way band, and the afterglow: a thin orange
// seam right on the horizon, strongest toward the sun, with a cool grey-blue glow just above it.
export const STARS = /* glsl */`
uniform float uStars, uAfterglow, uMilky;
vec3 shash3(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float starLayer(vec3 d, float n, float keep, float pix, out vec3 tint){
  vec3 g = d * n, id = floor(g), r = shash3(id);
  tint = vec3(0.0);
  // a grid finer than a few pixels would read as noise: fade the layer out as its cells shrink on screen
  float fit = 1.0 - smoothstep(0.12, 0.3, pix * n);
  if (r.x > keep || fit <= 0.0) return 0.0;
  vec3 s = normalize(id + 0.2 + 0.6 * shash3(id + 17.0)) ;
  float a = length(d - s);                              // radians, near enough at these sizes
  float sig = pix * 0.75;
  float b = pow(r.y, 5.0) * 1.6 + 0.08;                 // most faint, a few bright
  tint = mix(vec3(0.70, 0.80, 1.0), vec3(1.0, 0.86, 0.70), r.z);
  return b * fit * exp(-a * a / (2.0 * sig * sig));
}
vec3 nightSky(vec3 d, float el, vec3 base){
  vec3 e = vec3(0.0);
  float pix = max(length(fwidth(d)), 2e-5);
  // stars live in the dark: none in the bright band at the horizon, and they thin out where the sky is lit
  float dark = 1.0 - smoothstep(0.004, 0.03, dot(base, vec3(0.2126, 0.7152, 0.0722)));
  float up = smoothstep(0.012, 0.09, el);
  if (uStars > 0.0 && up > 0.0) {
    // the Milky Way: a soft band on a tilted great circle, more stars inside it
    vec3 ax = normalize(vec3(0.42, 0.55, -0.72));
    float band = exp(-pow(dot(d, ax), 2.0) / 0.035);
    float lane = vnoise(vec2(dot(d, vec3(0.8, 0.1, 0.6)), dot(d, vec3(-0.2, 0.9, 0.3))) * 9.0) * 0.6
               + vnoise(vec2(dot(d, vec3(0.3, -0.7, 0.6)), dot(d, vec3(0.9, 0.2, -0.4))) * 23.0) * 0.4;
    e += vec3(0.020, 0.022, 0.030) * band * smoothstep(0.25, 0.85, lane) * uMilky;
    vec3 t; float s;
    s = starLayer(d, 70.0, 0.55, pix, t);   e += t * s * 3.2;
    s = starLayer(d, 160.0, 0.6 + 0.35 * band * uMilky, pix, t); e += t * s * 1.6;
    s = starLayer(d, 330.0, 0.5 + 0.45 * band * uMilky, pix, t); e += t * s * 0.8;
    e *= uStars * up * dark;
  }
  if (uAfterglow > 0.0) {
    vec2 h = normalize(d.xz + 1e-6), sh = normalize(uSun.xz + 1e-6);
    float toward = smoothstep(-0.6, 1.0, dot(h, sh));
    float x = max(el, 0.0);
    float seam = exp(-x / 0.008) * smoothstep(-0.02, 0.0, el);
    e += vec3(1.0, 0.5, 0.16) * seam * (0.2 + 1.8 * toward) * 0.8 * uAfterglow;
    e += vec3(0.10, 0.12, 0.15) * exp(-x / 0.045) * smoothstep(-0.01, 0.0, el) * (0.5 + 0.8 * toward) * uAfterglow;
  }
  return e;
}`;

const LINES = /* glsl */`
// anti-aliased lines that fade out before they get denser than a couple of pixels
float lines2(vec2 c){ vec2 fw = fwidth(c); vec2 g = abs(fract(c - 0.5) - 0.5) / max(fw, 1e-6);
  return (1.0 - min(min(g.x, g.y), 1.0)) * (1.0 - smoothstep(0.12, 0.45, max(fw.x, fw.y))); }
float lines1(float c){ float fw = fwidth(c); float g = abs(fract(c - 0.5) - 0.5) / max(fw, 1e-6);
  return (1.0 - min(g, 1.0)) * (1.0 - smoothstep(0.12, 0.45, fw)); }`;

// One grid, dense under the camera and stretching out toward the horizon, so a single draw covers
// 1,500 km. The middle (`flat` of each half) is a uniform grid of `cell` meters; past it the spacing
// grows smoothly (cubic) out to R. A moving camera shifts the core in whole cells (frame(shift)), so
// every core vertex lands exactly where a neighbor was and the ground under you never changes; with a
// filtered heightmap the cell is one texel and the sparser vertices past the core slide smoothly.
export function terrainGeometry(segments = 512, R = 750000, cell = 352, flat = 0.375) {
  const n = segments + (segments % 2 ? 0 : 1);   // odd: a vertex sits under the camera
  const h = (n - 1) / 2, K = Math.round(h * flat);
  const c = (R - cell * h) / Math.pow(h - K, 3);
  const at = (j) => { const a = Math.abs(j), x = a <= K ? cell * a : cell * a + c * Math.pow(a - K, 3); return Math.sign(j) * x; };
  const pos = new Float32Array(n * n * 3), idx = new Uint32Array((n - 1) * (n - 1) * 6), space = new Float32Array(n * n);
  const step = (j) => { const a = Math.abs(j); return at(a + 1) - at(a); };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = (j * n + i) * 3;
    pos[k] = at(i - h); pos[k + 2] = at(j - h);
    space[j * n + i] = Math.max(step(i - h), step(j - h));   // local vertex spacing (m), for the height filter
  }
  let t = 0;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const v = j * n + i;
    idx.set([v, v + n, v + 1, v + 1, v + n, v + n + 1], t); t += 6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSpace', new THREE.BufferAttribute(space, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 1.5);
  g.userData.cell = cell;
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

// A sphere with rings bunched toward the horizon (elevation ~ t^2), so per-vertex shading keeps
// the thin limb crisp.
function skyGeometry(r, cols = 96, rows = 96) {
  const pos = [], idx = [];
  for (let j = 0; j <= rows; j++) {
    const t = (j / rows) * 2 - 1, el = Math.sign(t) * t * t * Math.PI / 2;
    for (let i = 0; i <= cols; i++) {
      const az = (i / cols) * Math.PI * 2;
      pos.push(r * Math.cos(el) * Math.sin(az), r * Math.sin(el), r * Math.cos(el) * Math.cos(az));
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + cols + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

// Box-filtered mip levels for a half-float height texture (RedFormat), built once on the CPU, so the
// terrain can read heights smoothed to each vertex's spacing. Returns the last mip level.
function buildHeightMips(tex) {
  if (tex.userData.heightMips != null) return tex.userData.heightMips;
  const { fromHalfFloat, toHalfFloat } = THREE.DataUtils;
  let w = tex.image.width, h = tex.image.height, src = tex.image.data;
  let f = new Float32Array(w * h);
  for (let i = 0; i < f.length; i++) f[i] = fromHalfFloat(src[i]);
  const mips = [{ data: src, width: w, height: h }];
  while (w > 1 || h > 1) {
    const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1), g = new Float32Array(nw * nh), half = new Uint16Array(nw * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const x0 = Math.min(2 * x, w - 1), x1 = Math.min(2 * x + 1, w - 1), y0 = Math.min(2 * y, h - 1), y1 = Math.min(2 * y + 1, h - 1);
      const v = (f[y0 * w + x0] + f[y0 * w + x1] + f[y1 * w + x0] + f[y1 * w + x1]) * 0.25;
      g[y * nw + x] = v; half[y * nw + x] = toHalfFloat(v);
    }
    mips.push({ data: half, width: nw, height: nh });
    f = g; w = nw; h = nh;
  }
  tex.mipmaps = mips;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  tex.userData.heightMips = mips.length - 1;
  return mips.length - 1;
}

// lite: a CPU rasterizer (SwiftShader, llvmpipe) runs every branch of a shader whatever the uniforms say,
// so the night sky, city lights and per-pixel relief are compiled out there.
export function createWorld({ segments = 512, cell = 352, flat = 0.375, lite = false } = {}) {
  const defines = lite ? { WORLD_LITE: '' } : {};
  const sunDir = new THREE.Vector3(0, 1, 0);
  const U = {
    uCam: { value: new THREE.Vector3() }, uEarthR: { value: EARTH_R }, uOrigin: { value: new THREE.Vector3() },
    uSun: { value: sunDir }, uHaze: { value: new THREE.Vector3(0.50, 0.56, 0.66) }, uHazeDist: { value: 130000 },
    uCover: { value: 0.5 }, uDip: { value: 0 }, uSkyK: { value: 9 },
    uShadow: { value: col(WORLD_DEFAULTS.shadow) }, uMid: { value: col(WORLD_DEFAULTS.mid) },
    uLight: { value: col(WORLD_DEFAULTS.light) }, uHigh: { value: col(WORLD_DEFAULTS.highlight) },
    uMidPoint: { value: 0.56 }, uHlStart: { value: 0.61 }, uHlAmount: { value: 0.85 },
    uMono: { value: 1 }, uExposure: { value: 1.12 }, uContrast: { value: 1.13 }, uDirect: { value: 0 }, uChroma: { value: 0.6 },
    uNight: { value: 0 }, uStars: { value: 1 }, uAfterglow: { value: 1 }, uMilky: { value: 0.45 }, uMoon: { value: new THREE.Vector3(0, 1, 0) },
  };

  // ---- sky: thin bright air at the horizon, near-space navy overhead, a sun and the limb ----
  // The sky is smooth, so it is shaded per vertex on a sphere whose rings crowd in at the horizon
  // (where the limb is a fraction of a degree thick); only the sun disk is worked out per pixel.
  // Drawn first, behind everything, with no depth test, depth write or log-depth.
  const sky = new THREE.Mesh(
    skyGeometry(1.5e6),
    new THREE.ShaderMaterial({ defines,
      side: THREE.DoubleSide, depthWrite: false, depthTest: false, uniforms: U,
      vertexShader: /* glsl */`
        uniform vec3 uSun, uHaze; uniform float uDip, uSkyK, uNight;
        varying vec3 vDir; varying vec4 vSky; varying vec3 vBase;
        ${TONE}
        void main(){
          vec3 d = normalize(position); vDir = d;
          float el = asin(clamp(d.y, -1.0, 1.0)) + uDip;       // angle above the true horizon
          vec3 zenith = mix(vec3(0.010, 0.020, 0.055), vec3(0.0025, 0.0035, 0.008), uNight);   // near-space dark blue; at night near black
          vec3 haze = mix(uHaze, vec3(0.020, 0.026, 0.040), uNight);
          // high up most of the air is below you: a thin bright band at the horizon, navy by ~20 degrees up.
          // Lower down (uSkyK smaller) the bright band widens.
          vec3 c = mix(haze, zenith, 1.0 - exp(-max(el, 0.0) * uSkyK));
          c += vec3(0.30) * (1.0 - 0.85 * uNight) * exp(-abs(el) * 70.0);   // bright limb on the horizon
          c += vec3(0.35) * (1.0 - uNight) * pow(max(dot(d, uSun), 0.0), 12.0); // glow around the sun
          c = mix(c, haze * 0.9, smoothstep(0.0, -0.03, el));
          vBase = c;
          vSky = finishSky(c);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uNight, uDip; uniform vec3 uSun;
        varying vec3 vDir; varying vec4 vSky; varying vec3 vBase;
        ${NOISE}
        ${TONE}
        #ifndef WORLD_LITE
        ${STARS}
        #endif
        void main(){
          vec3 d = normalize(vDir);
          float disk = pow(max(dot(d, uSun), 0.0), 2500.0) * (1.0 - uNight);
          // Night: light of its own (stars, the afterglow seam), added on top of the toned sky. Through the
          // monotone it turns to the palette's light and gold; in natural color it keeps its orange.
          vec3 e = vec3(0.0);
          #ifndef WORLD_LITE
          if (uNight > 0.0) e = nightSky(d, asin(clamp(d.y, -1.0, 1.0)) + uDip, vBase) * uNight;
          #endif
          if (uDirect > 0.5) {
            vec3 sky = vSky.rgb;
            #ifndef WORLD_LITE
            if (uNight > 0.0) sky = pow(pow(sky, vec3(2.2)) + max(display(vBase + e, 0.0) - display(vBase, 0.0), 0.0), vec3(1.0 / 2.2));
            #endif
            // the disk is far past white: in the post pass the tone turns it to highlight; direct, draw that
            gl_FragColor = vec4(mix(sky, pow(uHigh, vec3(1.0 / 2.2)), min(disk * 3.0, 1.0)), 1.0);
          } else {
            gl_FragColor = vec4(vSky.rgb + e / uExposure + vec3(3.0) * disk, vSky.a);
          }
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
    uColor: { value: 1 }, uTexture: { value: 1 }, uCity: { value: 1 },
    uFiltered: { value: 0 }, uMaxLod: { value: 0 }, uPixelRelief: { value: 1 },
    uSlide: { value: new THREE.Vector2() }, uCell: { value: cell }, uLodBias: { value: 0.5 },
  };
  const terrain = new THREE.Mesh(
    terrainGeometry(segments, 750000, cell, flat),
    new THREE.ShaderMaterial({ defines,
      uniforms: { ...U, ...TU },
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        uniform vec3 uCam, uOrigin; uniform float uEarthR, uWidth, uTexel, uExag, uEncoded, uFiltered, uMaxLod, uCell, uLodBias; uniform vec2 uShift, uSlide;
        uniform sampler2D uHeight; uniform int uSize;
        attribute float aSpace;
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
        // height and its slope (per texel) from one bilinear cell: four fetches per vertex
        vec3 hAt(vec2 uv){
          vec2 x = uv * float(uSize) - 0.5; vec2 i = floor(x), f = x - i; ivec2 b = ivec2(i);
          float a = texH(b), bx = texH(b + ivec2(1, 0)), bz = texH(b + ivec2(0, 1)), c = texH(b + ivec2(1, 1));
          return vec3(mix(mix(a, bx, f.x), mix(bz, c, f.x), f.y), mix(bx - a, c - bz, f.y), mix(bz - a, c - bx, f.x));
        }
        void main(){
          float h;
          #ifdef HEIGHT_FILTERED
            // Two kinds of vertex. The uniform core moves in whole heightmap texels (uShift), so each of
            // its vertices sits on a texel center and reads the exact height there: the ground near you
            // never changes shape. Past the core the grid also slides the leftover fraction (uSlide), so
            // it moves continuously, and each vertex reads the heightmap pre-filtered to its own spacing
            // (mip level): sparse vertices sliding over smoothed heights don't snap or swim.
            float m = uWidth * uTexel, sp = max(aSpace, m);
            float slide = smoothstep(uCell * 1.01, uCell * 2.5, aSpace);
            vec2 xz = position.xz + uShift + slide * uSlide;   // render space
            vec2 wxz = xz + uOrigin.xz;                         // world space
            vec2 uv = wxz / uWidth + 0.5;
            float lod = clamp(log2(sp / m) + uLodBias * slide, 0.0, uMaxLod);
            vec2 du = vec2(sp / uWidth, 0.0);
            h = textureLod(uHeight, uv, lod).r;
            float hx = textureLod(uHeight, uv + du.xy, lod).r - h;
            float hz = textureLod(uHeight, uv + du.yx, lod).r - h;
            vN = normalize(vec3(-hx * uExag, sp, -hz * uExag));
          #else
            vec2 xz = position.xz + uShift;
            vec2 wxz = xz + uOrigin.xz;
            vec2 uv = wxz / uWidth + 0.5;
            vec3 hg = hAt(uv);
            float m = uWidth * uTexel;
            h = hg.x;
            vN = normalize(vec3(-hg.y * uExag, m, -hg.z * uExag));
          #endif
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
        uniform float uTint, uTintContrast, uTintPivot, uSlope, uColor, uTexture, uSnowM, uArid, uNight, uCity;
        uniform vec3 uMoon, uCam, uOrigin; uniform float uAfterglow;
        varying vec2 vXZ; varying float vDist, vH; varying vec3 vN;
        uniform sampler2D uHeight; uniform float uWidth, uTexel, uFiltered, uMaxLod, uExag, uPixelRelief;
        float H;   // height here: per vertex, or per pixel from the filtered heightmap
        ${NOISE}
        ${TONE}
        ${LINES}
        // What the ground is made of, lit by the sun: valley floor, forest, alpine, rock on steep faces,
        // snow above the snowline, water at sea level. Texture at two scales fades out with distance.
        vec3 ground(vec3 n, float lit){
          float steep = 1.0 - n.y;
          vec2 q = vXZ / 900.0;
          float fade = 1.0 - smoothstep(0.25, 0.9, max(fwidth(q.x), fwidth(q.y)));
          float fine = mix(0.5, fbm(q, 4), fade);
          float broad = fbm(vXZ / 12000.0 + 3.7, 4);
          float hs = H / max(uSnowM, 1.0);              // 1 at the snowline
          float jitter = (broad - 0.5) * 0.35 + (fine - 0.5) * 0.12;
          vec3 valley = mix(vec3(0.13, 0.12, 0.075), vec3(0.24, 0.18, 0.11), uArid);
          vec3 forest = mix(vec3(0.045, 0.075, 0.040), vec3(0.14, 0.12, 0.08), uArid);
          vec3 alpine = vec3(0.17, 0.16, 0.13);
          vec3 rock = mix(vec3(0.22, 0.21, 0.20), vec3(0.36, 0.18, 0.095), uArid);
          // canyon strata: bands of color with height
          rock *= mix(1.0, 0.85 + 0.3 * sin(H / 55.0 + broad * 6.0), uArid);
          vec3 c = mix(valley, forest, smoothstep(0.18, 0.4, hs + jitter) * (1.0 - uArid * 0.7));
          c = mix(c, alpine, smoothstep(0.78, 0.95, hs + jitter));
          c = mix(c, rock, smoothstep(0.32, 0.6, steep + (fine - 0.5) * 0.25));
          float snow = smoothstep(-0.03, 0.03, hs + jitter * 0.8 - 1.0) * (1.0 - smoothstep(0.35, 0.6, steep + (fine - 0.5) * 0.3));
          c = mix(c, vec3(0.34, 0.36, 0.40), snow);
          c = mix(c, vec3(0.012, 0.025, 0.045), smoothstep(3.0, 0.5, H));   // sea and lakes at sea level
          c *= mix(1.0, (0.72 + 0.56 * fine) * (0.82 + 0.36 * broad), uTexture);
          vec3 skyFill = vec3(0.30, 0.36, 0.48) * (1.0 - 0.85 * uNight);
          vec3 key = mix(vec3(1.0, 0.95, 0.86), vec3(0.62, 0.72, 1.0), uNight);   // sun, or a cool moon
          return c * (skyFill * (0.35 + 0.35 * n.y) + key * 2.2 * lit);
        }
        #ifndef WORLD_LITE
        // Night: warm city lights on low, flat ground. Up close each light is a dot about a pixel across;
        // once the dots get smaller than a pixel they fade into the glow they average to, so distant towns
        // read as soft patches and nothing sparkles as the camera drifts.
        vec3 cityLights(vec3 n){
          float low = smoothstep(1600.0, 500.0, H) * smoothstep(2.5, 6.0, H) * smoothstep(0.94, 0.985, n.y);
          if (low <= 0.0) return vec3(0.0);
          float pm = max(length(fwidth(vXZ)), 1.0);                     // meters per pixel here
          float town = fbm(vXZ / 22000.0 + 9.1, 3);
          float urban = smoothstep(0.5, 0.68, town);
          float density = 0.03 + 0.7 * urban;
          const float CELL = 160.0;
          float l = urban * 0.012;
          // two scales: street lights up close, and brighter clusters (town centers, junctions) that
          // still read as points from far away
          for (int k = 0; k < 2; k++) {
            float cell = k == 0 ? CELL : CELL * 6.0, size = k == 0 ? 9.0 : 30.0, gain = k == 0 ? 1.0 : 2.2;
            float dens = k == 0 ? density : 0.02 + 0.55 * urban;
            vec2 id = floor(vXZ / cell) + float(k) * 91.7;
            float r = whash(id), r2 = whash(id + 7.31), r3 = whash(id + 3.17);
            float sig = max(pm * 0.6, size);
            vec2 pt = (floor(vXZ / cell) + 0.15 + 0.7 * vec2(r2, r3)) * cell;
            float dist = length(vXZ - pt);
            float dots = step(r, dens) * exp(-dist * dist / (2.0 * sig * sig)) * (0.35 + 1.3 * r3) * min(1.0, size * size / (sig * sig) * 2.5);
            float avg = dens * 0.95 * 6.2832 * size * size / (cell * cell);   // what the dots average to
            float far = smoothstep(0.7 * cell, 1.6 * cell, pm);
            l += mix(dots, avg * 2.5, far) * gain;
          }
          return vec3(1.0, 0.60, 0.28) * l * low * 3.0;
        }
        #endif
        void main(){
          #include <logdepthbuf_fragment>
          vec3 n = normalize(vN);
          H = vH;
          #if defined(HEIGHT_FILTERED) && !defined(WORLD_LITE)
          if (uPixelRelief > 0.5) {
            // Relief per pixel, anchored to the world: height and slope read from the heightmap at this
            // pixel's footprint, so ridges and snowlines stay sharp and still however coarse the mesh is.
            float m = uWidth * uTexel, fp = max(length(fwidth(vXZ)), m);
            float lod = clamp(log2(fp / m), 0.0, uMaxLod);
            vec2 uv = vXZ / uWidth + 0.5, du = vec2(fp / uWidth, 0.0);
            H = textureLod(uHeight, uv, lod).r;
            float hx = textureLod(uHeight, uv + du.xy, lod).r - H;   // forward differences: three reads a pixel
            float hz = textureLod(uHeight, uv + du.yx, lod).r - H;
            n = normalize(vec3(-hx * uExag, fp, -hz * uExag));
          }
          #endif
          float grid = max(lines2(vXZ / uGridSize) * 0.55, lines2(vXZ / (uGridSize * 5.0)));
          float contour = max(lines1(H / uContourStep) * 0.55, lines1(H / (uContourStep * 5.0)));
          float ink = clamp(grid * uGrid + contour * uContour, 0.0, 1.0);
          float lit = mix(clamp(dot(n, uSun), 0.0, 1.0), clamp(dot(n, uMoon), 0.0, 1.0) * 0.16, uNight);
          float rise = clamp(H / uMaxH, 0.0, 1.0);
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
          c = mix(c, vec3(uLineBright) * (0.75 + 0.5 * rise) * (1.0 - 0.72 * uNight), ink * (1.0 - 0.45 * uColor * (1.0 - uMono)));
          float fog = 1.0 - exp(-vDist / uHazeDist);
          vec3 haze = mix(uHaze, vec3(dot(uHaze, vec3(0.2126, 0.7152, 0.0722))), uMono);
          vec3 nightHaze = vec3(0.020, 0.026, 0.040);
          #ifndef WORLD_LITE
          if (uNight > 0.0) {   // the far ground near the horizon catches the afterglow, warmest toward the sun
            vec2 look = normalize(vXZ - uCam.xz - uOrigin.xz + 1e-3);
            float toward = smoothstep(-0.6, 1.0, dot(look, normalize(uSun.xz + 1e-6)));
            nightHaze += vec3(0.30, 0.11, 0.035) * pow(fog, 40.0) * toward * uAfterglow;
          }
          #endif
          haze = mix(haze, nightHaze, uNight);
          c = mix(c, haze * mix(1.0, 0.8, uColor), fog * fog * 0.9 + fog * 0.1);
          #ifndef WORLD_LITE
          if (uNight > 0.0 && uCity > 0.0) c += cityLights(n) * uCity * uNight * (1.0 - 0.7 * fog);
          #endif
          gl_FragColor = finish(c, ink * uLineGold * (1.0 - fog));   // gold mask: lines the tone may turn gold
        }`,
    }),
  );
  terrain.frustumCulled = false;
  terrain.visible = false;

  // ---- cloud deck: scattered cumulus at cloudM, parallax against the ground ----
  const clouds = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2e6, 1.2e6, 120, 120).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({ defines,
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
        uniform vec3 uHaze; uniform float uHazeDist, uCover, uNight; varying vec2 vXZ; varying float vDist;
        ${NOISE}
        ${TONE}
        void main(){
          #include <logdepthbuf_fragment>
          vec2 q = vXZ / 4500.0;
          float field = fbm(q * 0.18 + 4.0, 4);
          float puff = fbm(q + vec2(fbm(q * 0.5, 3)) * 1.5, 6);
          float a = smoothstep(0.86 - uCover * 0.4, 1.0 - uCover * 0.35, puff + (field - 0.5) * 0.7);
          float fog = 1.0 - exp(-vDist / (uHazeDist * 1.1));
          vec3 top = mix(vec3(0.80, 0.82, 0.85), vec3(0.075, 0.095, 0.14), uNight) * (0.7 + 0.4 * puff);   // sunlit, or moonlit
          vec3 haze = mix(mix(uHaze, vec3(dot(uHaze, vec3(0.2126, 0.7152, 0.0722))), uMono), vec3(0.020, 0.026, 0.040), uNight);
          vec3 c = mix(top, haze, fog);
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
    /** Grid spacing under the camera (m). A filtered heightmap sets it to one texel. */
    get cellSize() { return TU.uCell.value; },
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
      const maz = THREE.MathUtils.degToRad(look.moonAz ?? 200), mel = THREE.MathUtils.degToRad(look.moonEl ?? 32);
      U.uMoon.value.set(Math.sin(maz) * Math.cos(mel), Math.sin(mel), Math.cos(maz) * Math.cos(mel)).normalize();
      for (const k of ['night', 'stars', 'afterglow', 'milky']) U[uName(k)].value = +(look[k] ?? 0);
      TU.uCity.value = +(look.city ?? 0);
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
      const filtered = !encoded && tex.image?.data && tex.type === THREE.HalfFloatType && tex.format === THREE.RedFormat;
      if (filtered) TU.uMaxLod.value = buildHeightMips(tex);
      // A filtered heightmap: the core grid is one texel apart, so moving it whole texels lands each
      // vertex on a texel center.
      const want = filtered ? metersPerPixel : cell;
      if (Math.abs(want - TU.uCell.value) > 1e-6) {
        terrain.geometry.dispose();
        terrain.geometry = terrainGeometry(segments, 750000, want, flat);
        TU.uCell.value = want;
      }
      TU.uFiltered.value = filtered ? 1 : 0;
      // which height path the terrain compiles: a shader on a CPU rasterizer pays for every branch
      const m = terrain.material, had = 'HEIGHT_FILTERED' in m.defines;
      if (filtered !== had) {
        m.defines = { ...m.defines };
        if (filtered) m.defines.HEIGHT_FILTERED = ''; else delete m.defines.HEIGHT_FILTERED;
        m.needsUpdate = true;
      }
      terrain.visible = true;
    },
    /**
     * Call each frame with the camera that draws the world. origin: world position of render (0,0,0).
     * shift: optional render-space xz to center the terrain grid on (the camera's, as it moves). The
     * grid's core moves in whole cells so the ground under the camera stays put; with a filtered
     * heightmap the rest of the grid slides the remainder smoothly.
     */
    frame(camera, origin = null, shift = null) {
      if (origin) U.uOrigin.value.copy(origin); else U.uOrigin.value.set(0, 0, 0);
      U.uCam.value.copy(camera.position);
      sky.position.copy(camera.position);
      const S = TU.uShift.value, slide = TU.uSlide.value, c = TU.uCell.value;
      if (!shift) { S.set(0, 0); slide.set(0, 0); }
      else if (TU.uFiltered.value) {
        // texel centers sit at world (k + 1/2) * c; core vertices at multiples of c from S
        const o = U.uOrigin.value;
        const snap = (v, oo) => (Math.round((v + oo) / c - 0.5) + 0.5) * c - oo;
        S.set(snap(shift.x, o.x), snap(shift.y, o.z));
        slide.set(shift.x - S.x, shift.y - S.y);
      } else {
        S.set(Math.round(shift.x / c) * c, Math.round(shift.y / c) * c);
        slide.set(0, 0);
      }
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
