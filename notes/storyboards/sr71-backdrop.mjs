// SR-71 backdrop lab: a still aircraft at cruise altitude with the ground far below.
// Drag to look around it. The scene renders in color, then a final pass collapses it to a
// navy monotone with a gold highlight (both adjustable), so it can sit quietly behind the site.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const EARTH_R = 6371000;
const STORE = 'sr71-backdrop-v3';

// ---------- settings ----------
const PRESETS = {
  site: { shadow: '#07090e', mid: '#1c2433', light: '#c8cdd5', highlight: '#e4c56f' },
  slate: { shadow: '#050608', mid: '#2a313c', light: '#d6dbe2', highlight: '#f2f4f7' },
  ash: { shadow: '#060606', mid: '#2f2f30', light: '#dcdad6', highlight: '#ffffff' },
  dusk: { shadow: '#06050d', mid: '#262447', light: '#c6c3dc', highlight: '#e9a77a' },
};
const STYLES = {
  grid: { grid: 1, contour: 0, shade: 0.35, tint: 0, slope: 0, lineBright: 0.6 },
  gridcontour: { grid: 0.7, contour: 0.8, shade: 0.3, tint: 0, slope: 0, lineBright: 0.6 },
  contour: { grid: 0, contour: 1, shade: 0.3, tint: 0, slope: 0, lineBright: 0.6 },
  shaded: { grid: 0, contour: 0, shade: 1, tint: 0, slope: 0, lineBright: 0.6 },
  shadedgrid: { grid: 0.6, contour: 0, shade: 1, tint: 0, slope: 0, lineBright: 0.6 },
  topo: { grid: 0.45, contour: 1, shade: 0.6, tint: 1, tintContrast: 1.3, tintPivot: 0.45, slope: 0.35, lineBright: 0.015, contourStep: 200 },
  topoglow: { grid: 0.6, contour: 0.9, shade: 0.5, tint: 0.6, tintContrast: 1.2, tintPivot: 0.6, slope: 0.2, lineBright: 0.7 },
};
// Defaults = the look Had landed on 2026-11-05 (iPad), with altitude at the SR-71's ~85k ft ceiling.
const DEFAULTS = {
  preset: 'site', ...PRESETS.site,
  midPoint: 0.56, hlStart: 0.61, hlAmount: 0.85, mono: 1, exposure: 1.12, contrast: 1.13, grain: 0, vignette: 1.2,
  region: 'sierra', altitudeFt: 85000, exag: 1, offsetX: 79, offsetZ: -69.1, sunAz: 41, sunEl: 18, haze: 130, clouds: 0.54, fov: 23,
  style: 'grid', grid: 0.66, gridSize: 250, contour: 0.46, contourStep: 175, shade: 0.39, lineBright: 0.73, lineGold: 0,
  tint: 0, tintContrast: 1, tintPivot: 0.5, slope: 0,
  drift: true, driftSpeed: 0.02,
  scrollPan: true, scrollDeg: 10, scrollTilt: 1.5, scrollMax: 90, sidePan: true, sideSens: 1, bgDrag: true, overscroll: true,
  site: true, sitePath: '/', siteOpacity: 1, siteBg: 0.49, siteClick: false,
};
const CLEAN = new URLSearchParams(location.search).has('clean');
if (CLEAN) document.documentElement.classList.add('clean');
const load = () => {
  let saved = {};
  // ?clean: the lab as a plain backdrop (no panel, no saved tweaks), for the staging home page.
  if (!CLEAN) try { saved = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch {}
  let fromHash = {};
  try { if (location.hash.length > 1) fromHash = JSON.parse(decodeURIComponent(location.hash.slice(1))); } catch {}
  const out = { ...DEFAULTS, ...saved, ...fromHash };
  out.altitudeFt = Math.min(+out.altitudeFt || DEFAULTS.altitudeFt, 85000);   // SR-71 ceiling
  return out;
};
const S = load();
const save = () => { if (CLEAN) return; try { localStorage.setItem(STORE, JSON.stringify(S)); } catch {} };

// ---------- renderer ----------
const canvas = document.getElementById('backdrop');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
const coarse = matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
renderer.autoClear = false;
renderer.setClearColor(0x000000, 0);

const sunDir = new THREE.Vector3();
const shared = {
  uCam: { value: new THREE.Vector3() },
  uEarthR: { value: EARTH_R },
  uSun: { value: sunDir },
  uHaze: { value: new THREE.Vector3(0.50, 0.56, 0.66) },
  uHazeDist: { value: 210000 },
  uCover: { value: 0.5 },
  uDip: { value: 0 },
};

// ---------- far scene: sky, ground, cloud deck ----------
const farScene = new THREE.Scene();
const farCam = new THREE.PerspectiveCamera(34, 1, 50, 3.0e6);

const NOISE = /* glsl */`
float hash(vec2 p){ p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
const mat2 ROT = mat2(0.8, -0.6, 0.6, 0.8);
float fbm(vec2 p, int oct){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 8; i++){ if (i >= oct) break; s += a * vnoise(p); p = ROT * p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
float ridged(vec2 p, int oct){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 8; i++){ if (i >= oct) break; float n = 1.0 - abs(vnoise(p) * 2.0 - 1.0); s += a * n * n; p = ROT * p * 2.11 + 5.3; a *= 0.5; }
  return s;
}`;

// Bends a flat plane down with the Earth's curvature relative to the camera, so the horizon
// lands where it would from altitude (about 4.4 degrees below level at 60k ft, 5.2 at 85k).
const CURVED_VERT = /* glsl */`
uniform vec3 uCam; uniform float uEarthR;
varying vec2 vXZ; varying float vDist;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec2 rel = w.xz - uCam.xz;
  w.y -= dot(rel, rel) / (2.0 * uEarthR);
  vXZ = w.xz; vDist = distance(w.xyz, uCam);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(2.5e6, 48, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: shared,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSun, uHaze; uniform float uDip; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float el = asin(clamp(d.y, -1.0, 1.0)) + uDip;       // angle above the true horizon
        vec3 zenith = vec3(0.010, 0.020, 0.055);             // near-space dark blue
        // at 85k ft most of the air is below you: a thin bright band at the horizon, dark navy by ~20 degrees up
        vec3 c = mix(uHaze, zenith, 1.0 - exp(-max(el, 0.0) * 9.0));
        c += vec3(0.30) * exp(-abs(el) * 70.0);              // bright limb on the horizon
        float sun = max(dot(d, uSun), 0.0);
        c += vec3(0.35) * pow(sun, 12.0) + vec3(3.0) * pow(sun, 2500.0);
        c = mix(c, uHaze * 0.9, smoothstep(0.0, -0.03, el));
        gl_FragColor = vec4(c, 0.0);
      }`,
  }),
);
farScene.add(sky);

// ---------- ground: real elevation drawn as a terrain grid ----------
// Heights come from stitched AWS terrain tiles (terrain/*.png, terrarium encoding), mirrored past the
// region edge so the ground runs to the horizon. The mesh is one grid whose vertices are dense under
// the jet (~280 m apart) and stretch out toward the horizon, so a single draw covers 1,500 km.
function terrainGeometry(n = 640, R = 750000, a = 0.12) {
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
const terrainU = {
  uHeight: { value: null }, uWidth: { value: 250000 }, uTexel: { value: 1 / 1024 }, uOffset: { value: new THREE.Vector2() },
  uExag: { value: 1.5 }, uGroundY: { value: -18000 }, uMaxH: { value: 4000 },
  uGrid: { value: 1 }, uGridSize: { value: 2000 }, uContour: { value: 0 }, uContourStep: { value: 200 },
  uShade: { value: 0.35 }, uLineBright: { value: 0.6 }, uLineGold: { value: 0 },
  uTint: { value: 0 }, uTintContrast: { value: 1 }, uTintPivot: { value: 0.5 }, uSlope: { value: 0 },
};
const ground = new THREE.Mesh(
  terrainGeometry(),
  new THREE.ShaderMaterial({
    uniforms: { ...shared, ...terrainU },
    vertexShader: /* glsl */`
      uniform vec3 uCam; uniform float uEarthR, uWidth, uTexel, uExag, uGroundY; uniform vec2 uOffset; uniform sampler2D uHeight;
      varying vec2 vXZ; varying float vDist, vH; varying vec3 vN;
      float hAt(vec2 uv){ return texture2D(uHeight, uv).r; }
      void main(){
        vec2 xz = position.xz;                          // camera stays within ~1 km of the origin
        vec2 data = xz + uOffset;
        vec2 uv = data / uWidth + 0.5;
        float h = hAt(uv);
        float d = uTexel, m = uWidth * uTexel;
        float hx = hAt(uv + vec2(d, 0)) - hAt(uv - vec2(d, 0));
        float hz = hAt(uv + vec2(0, d)) - hAt(uv - vec2(0, d));
        vN = normalize(vec3(-hx * uExag, 2.0 * m, -hz * uExag));
        vec3 w = vec3(xz.x, uGroundY + h * uExag, xz.y);
        vec2 rel = xz - uCam.xz;
        w.y -= dot(rel, rel) / (2.0 * uEarthR);
        vXZ = data; vH = h; vDist = distance(w, uCam);
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSun, uHaze; uniform float uHazeDist, uMaxH, uGrid, uGridSize, uContour, uContourStep, uShade, uLineBright, uLineGold;
      uniform float uTint, uTintContrast, uTintPivot, uSlope;
      varying vec2 vXZ; varying float vDist, vH; varying vec3 vN;
      // anti-aliased lines that fade out before they get denser than a couple of pixels
      float lines2(vec2 c){ vec2 fw = fwidth(c); vec2 g = abs(fract(c - 0.5) - 0.5) / max(fw, 1e-6);
        return (1.0 - min(min(g.x, g.y), 1.0)) * (1.0 - smoothstep(0.12, 0.45, max(fw.x, fw.y))); }
      float lines1(float c){ float fw = fwidth(c); float g = abs(fract(c - 0.5) - 0.5) / max(fw, 1e-6);
        return (1.0 - min(g, 1.0)) * (1.0 - smoothstep(0.12, 0.45, fw)); }
      void main(){
        vec3 n = normalize(vN);
        float grid = max(lines2(vXZ / uGridSize) * 0.55, lines2(vXZ / (uGridSize * 5.0)));
        float contour = max(lines1(vH / uContourStep) * 0.55, lines1(vH / (uContourStep * 5.0)));
        float ink = clamp(grid * uGrid + contour * uContour, 0.0, 1.0);
        float lit = clamp(dot(n, uSun), 0.0, 1.0);
        float rise = clamp(vH / uMaxH, 0.0, 1.0);
        vec3 shaded = vec3(0.10, 0.11, 0.12) * (0.25 + 1.6 * lit) * (0.7 + 0.6 * rise);
        vec3 c = mix(vec3(0.028, 0.032, 0.04) * (0.8 + 0.5 * rise), shaded, uShade);
        // hypsometric tint, after kaolti/monolith-terrain (MIT): fill brightness follows height, contrast set around a pivot
        float rampT = clamp(0.5 + (rise - uTintPivot) * uTintContrast, 0.0, 1.0);
        vec3 hyp = vec3(mix(0.03, 0.42, rampT)) * mix(1.0, 0.45 + 0.9 * lit, uShade);
        c = mix(c, hyp, uTint);
        c *= 1.0 - uSlope * smoothstep(0.25, 0.8, 1.0 - n.y);   // steep faces darken, like hachures
        // lines are ink of a set brightness: low values give dark ink on a pale sheet, high values glow on dark ground
        c = mix(c, vec3(uLineBright) * (0.75 + 0.5 * rise), ink);
        float fog = 1.0 - exp(-vDist / uHazeDist);
        c = mix(c, uHaze, fog * fog * 0.9 + fog * 0.1);
        gl_FragColor = vec4(c, ink * uLineGold * (1.0 - fog));   // alpha marks lines the final pass may turn gold
      }`,
  }),
);
ground.frustumCulled = false;
ground.visible = false;
farScene.add(ground);

const REGIONS = {};
const regionList = fetch('terrain/regions.json').then((r) => r.json()).then((list) => { for (const r of list) REGIONS[r.id] = r; return list; });
const heightCache = {};
async function loadRegion(id) {
  const list = await regionList;
  const r = REGIONS[id] || list[0];
  if (!heightCache[r.id]) {
    heightCache[r.id] = (async () => {
      const blob = await (await fetch(`terrain/${r.id}.png`)).blob();
      const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
      const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
      const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0);
      const px = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
      const half = new Uint16Array(bmp.width * bmp.height);
      for (let i = 0; i < half.length; i++) {
        half[i] = THREE.DataUtils.toHalfFloat(px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768);
      }
      const tex = new THREE.DataTexture(half, bmp.width, bmp.height, THREE.RedFormat, THREE.HalfFloatType);
      tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
      tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
      return tex;
    })();
  }
  const tex = await heightCache[r.id];
  terrainU.uHeight.value = tex;
  terrainU.uWidth.value = r.metersPerPixel * r.size;
  terrainU.uTexel.value = 1 / r.size;
  terrainU.uMaxH.value = r.maxM;
  ground.visible = true;
  document.getElementById('credit').textContent = `${r.label} · ${r.lat.toFixed(2)}°, ${r.lon.toFixed(2)}° · ${r.widthKm} km of real elevation, mirrored past the edges. Terrain: AWS Terrain Tiles (SRTM, USGS 3DEP, GMTED and others).`;
  dirty = true;
  return r;
}

// Scattered cumulus about 7 km up: parallax against the ground as the view moves.
const clouds = new THREE.Mesh(
  new THREE.PlaneGeometry(1.2e6, 1.2e6, 240, 240),
  new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: shared, vertexShader: CURVED_VERT,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    fragmentShader: /* glsl */`
      uniform vec3 uHaze; uniform float uHazeDist, uCover; varying vec2 vXZ; varying float vDist;
      ${NOISE}
      void main(){
        vec2 q = vXZ / 4500.0;
        float field = fbm(q * 0.18 + 4.0, 4);
        float puff = fbm(q + vec2(fbm(q * 0.5, 3)) * 1.5, 6);
        float a = smoothstep(0.86 - uCover * 0.4, 1.0 - uCover * 0.35, puff + (field - 0.5) * 0.7);
        float fog = 1.0 - exp(-vDist / (uHazeDist * 1.1));
        vec3 c = mix(vec3(0.80, 0.82, 0.85) * (0.7 + 0.4 * puff), uHaze, fog);
        gl_FragColor = vec4(c, a * 0.9 * (1.0 - fog * 0.6) * step(0.001, uCover));
      }`,
  }),
);
clouds.rotation.x = -Math.PI / 2;
farScene.add(clouds);

// ---------- near scene: the aircraft ----------
// Original low-poly proxy (same blocking as the directing room). Local forward is -Z. Not flight-accurate.
const nearScene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 4000);
nearScene.add(new THREE.HemisphereLight(0x9fb0cc, 0x4a505a, 2.0));
const sunLight = new THREE.DirectionalLight(0xffffff, 3.2); nearScene.add(sunLight);
const bounce = new THREE.DirectionalLight(0x8090a8, 0.6); bounce.position.set(0, -100, 0); nearScene.add(bounce);

const plane = new THREE.Group(); nearScene.add(plane);
const skin = new THREE.MeshStandardMaterial({ color: 0x1d2027, roughness: 0.55, metalness: 0.25 });
const glass = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.25, metalness: 0.6 });
const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide });
for (const m of [skin, glass, nozzleMat]) {   // the jet never takes the line highlight
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.a = 0.0;'); };
}
const add = (g, m = skin) => { const o = new THREE.Mesh(g, m); plane.add(o); return o; };
const body = add(new THREE.SphereGeometry(1, 32, 16)); body.scale.set(1.25, 0.7, 10.5);
const nose = add(new THREE.ConeGeometry(1.23, 7, 24)); nose.rotation.x = -Math.PI / 2; nose.position.z = -10;
const chine = new THREE.Shape();
chine.moveTo(0, -14); chine.lineTo(1.9, -6); chine.lineTo(7.3, 7); chine.lineTo(3, 9); chine.lineTo(0, 9);
chine.lineTo(-3, 9); chine.lineTo(-7.3, 7); chine.lineTo(-1.9, -6); chine.closePath();
const wing = add(new THREE.ExtrudeGeometry(chine, { depth: 0.23, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1 }));
wing.rotation.x = Math.PI / 2; wing.position.y = 0.05;
const canopy = add(new THREE.SphereGeometry(1, 20, 12), glass); canopy.scale.set(0.65, 0.65, 2.3); canopy.position.set(0, 0.65, -5);
for (const side of [-1, 1]) {
  const engine = add(new THREE.CylinderGeometry(0.97, 1.05, 14, 24)); engine.rotation.x = Math.PI / 2; engine.position.set(side * 5, 0, 2.2);
  const inlet = add(new THREE.ConeGeometry(0.78, 3.6, 24)); inlet.rotation.x = -Math.PI / 2; inlet.position.set(side * 5, 0, -5.4);
  const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(-1.2, 3); fs.lineTo(1.7, 3); fs.lineTo(3.1, 0); fs.closePath();
  const fin = add(new THREE.ExtrudeGeometry(fs, { depth: 0.18, bevelEnabled: false }));
  fin.rotation.y = -Math.PI / 2; fin.rotation.z = side * -0.22; fin.position.set(side * 5, 0.7, 4.7);
  const nozzle = add(new THREE.CylinderGeometry(0.82, 0.9, 0.9, 24, 1, true), nozzleMat); nozzle.rotation.x = Math.PI / 2; nozzle.position.set(side * 5, 0, 9.6);
}
plane.position.z = 2;

// ---------- monotone composite ----------
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const col = (hex) => { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };  // linear
const postU = {
  tColor: { value: rt.texture },
  uShadow: { value: new THREE.Vector3() }, uMid: { value: new THREE.Vector3() },
  uLight: { value: new THREE.Vector3() }, uHigh: { value: new THREE.Vector3() },
  uMidPoint: { value: 0.42 }, uHlStart: { value: 0.8 }, uHlAmount: { value: 0.85 },
  uMono: { value: 1 }, uExposure: { value: 1 }, uContrast: { value: 1 },
  uGrain: { value: 0.018 }, uVignette: { value: 0.45 }, uRes: { value: new THREE.Vector2(1, 1) },
};
const post = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, uniforms: postU,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tColor; uniform vec3 uShadow, uMid, uLight, uHigh;
      uniform float uMidPoint, uHlStart, uHlAmount, uMono, uExposure, uContrast, uGrain, uVignette; uniform vec2 uRes;
      varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      vec3 toLinear(vec3 c){ return pow(c, vec3(2.2)); }
      void main(){
        vec4 src = texture2D(tColor, vUv);
        vec3 c = src.rgb * uExposure;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        l = l / (1.0 + l);                       // soft rolloff on the sun and horizon limb
        l = pow(clamp(l * 1.55, 0.0, 1.0), 0.85);
        l = clamp((l - 0.5) * uContrast + 0.5, 0.0, 1.0);
        // three-stop ramp: shadow -> mid (site navy) -> light
        vec3 ramp = l < uMidPoint ? mix(uShadow, uMid, l / uMidPoint) : mix(uMid, uLight, (l - uMidPoint) / (1.0 - uMidPoint));
        // gold only on the brightest values: sun, limb, glints
        float hl = smoothstep(uHlStart, min(uHlStart + 0.18, 1.0), l) * uHlAmount;
        ramp = mix(ramp, uHigh, max(hl, clamp(src.a, 0.0, 1.0)));
        // mono = 1 is pure tone mapping; lower lets the original colour back in
        vec3 orig = pow(clamp(c / (1.0 + c) * 1.55, 0.0, 1.0), vec3(2.2 * 0.85 / 2.2));
        vec3 m = mix(orig, ramp, uMono);
        vec2 v = vUv - 0.5; m *= 1.0 - uVignette * dot(v, v) * 1.6;
        m = pow(m, vec3(1.0 / 2.2));
        m += (h(vUv * uRes) - 0.5) * uGrain;     // fine grain; also kills gradient banding
        gl_FragColor = vec4(m, 1.0);
      }`,
  }),
);
const postScene = new THREE.Scene(); postScene.add(post);
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// ---------- camera controls ----------
camera.position.set(52, 14, -48);   // ahead of the right wing looking back along the fuselage
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0, 1);
controls.enableDamping = true; controls.dampingFactor = 0.06;
controls.minDistance = 22; controls.maxDistance = 900;
controls.rotateSpeed = 0.5; controls.zoomSpeed = 0.6;
controls.enablePan = true;
controls.addEventListener('change', () => (dirty = true));
controls.addEventListener('start', () => { userBusy = true; });
controls.addEventListener('end', () => { userBusy = false; });
let userBusy = false;

// ---------- apply settings ----------
let dirty = true;
let loadedRegion = null;
function apply() {
  postU.uShadow.value.copy(col(S.shadow)); postU.uMid.value.copy(col(S.mid));
  postU.uLight.value.copy(col(S.light)); postU.uHigh.value.copy(col(S.highlight));
  for (const k of ['midPoint', 'hlStart', 'hlAmount', 'mono', 'exposure', 'contrast', 'grain', 'vignette']) {
    postU['u' + k[0].toUpperCase() + k.slice(1)].value = +S[k];
  }
  const az = THREE.MathUtils.degToRad(S.sunAz), el = THREE.MathUtils.degToRad(S.sunEl);
  sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
  sunLight.position.copy(sunDir).multiplyScalar(100);
  const altitude = S.altitudeFt * 0.3048;
  terrainU.uGroundY.value = -altitude;
  terrainU.uExag.value = +S.exag;
  for (const k of ['grid', 'gridSize', 'contour', 'contourStep', 'shade', 'lineBright', 'lineGold', 'tint', 'tintContrast', 'tintPivot', 'slope']) {
    terrainU['u' + k[0].toUpperCase() + k.slice(1)].value = +S[k];
  }
  const reg = REGIONS[S.region];
  if (reg) terrainU.uOffset.value.set((S.offsetX ?? reg.peakKm[0]) * 1000, (S.offsetZ ?? reg.peakKm[1]) * 1000);
  if (loadedRegion !== S.region) { loadedRegion = S.region; loadRegion(S.region).then(() => { apply(); sync(); }); }
  clouds.position.y = -altitude + 7000;
  clouds.visible = altitude > 8000;
  shared.uDip.value = Math.acos(EARTH_R / (EARTH_R + Math.max(altitude, 1)));
  shared.uHazeDist.value = S.haze * 1000;
  shared.uCover.value = +S.clouds;
  controls.autoRotate = !!S.drift;
  controls.autoRotateSpeed = +S.driftSpeed;
  resize();
  applySite();
  save();
  dirty = true;
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  const pr = renderer.getPixelRatio();
  rt.setSize(Math.floor(w * pr), Math.floor(h * pr));
  postU.uRes.value.set(w * pr, h * pr);
  const aspect = w / h;
  const fov = aspect < 1 ? S.fov * Math.min(1.8, 1 / aspect) : +S.fov;  // portrait phones: widen so the jet fits
  for (const c of [farCam, camera]) { c.aspect = aspect; c.fov = fov; c.updateProjectionMatrix(); }
  dirty = true;
}
addEventListener('resize', resize);

// ---------- gesture offsets ----------
// The orbit controls own the base view. Gestures on the site add a yaw/pitch offset on top, applied
// to a separate render camera, so scroll-mapped pan is a pure function of page position and always reverses.
const G = { yaw: 0, pitch: 0, scrollYaw: 0, scrollPitch: 0, sideYaw: 0, dragPitch: 0, spring: 0, lastOverscroll: 0 };
const viewCam = camera.clone();
const sph = new THREE.Spherical(), offV = new THREE.Vector3();
const DEG = Math.PI / 180;
let lastStep = performance.now();
function stepGestures() {
  const now = performance.now(), dt = Math.min((now - lastStep) / 1000, 0.1); lastStep = now;
  // overscroll springs back once the wheel goes quiet (time-based, so it feels the same at any frame rate)
  if (now - G.lastOverscroll > 140) G.spring *= Math.exp(-dt / 0.22);
  if (Math.abs(G.spring) < 1e-4) G.spring = 0;
  const yaw = G.scrollYaw + G.sideYaw + G.spring, pitch = G.scrollPitch + G.dragPitch;
  const k = 1 - Math.exp(-dt / 0.18);   // smoothing toward the target offset
  const ny = G.yaw + (yaw - G.yaw) * k, np = G.pitch + (pitch - G.pitch) * k;
  const moving = Math.abs(ny - G.yaw) > 1e-5 || Math.abs(np - G.pitch) > 1e-5;
  G.yaw = ny; G.pitch = np;
  return moving;
}
function render() {
  offV.copy(camera.position).sub(controls.target);
  sph.setFromVector3(offV);
  sph.theta += G.yaw;
  sph.phi = THREE.MathUtils.clamp(sph.phi - G.pitch, 0.05, Math.PI - 0.05);
  viewCam.position.setFromSpherical(sph).add(controls.target);
  viewCam.fov = camera.fov; viewCam.aspect = camera.aspect; viewCam.near = camera.near; viewCam.far = camera.far;
  viewCam.updateProjectionMatrix();
  viewCam.up.set(0, 1, 0); viewCam.lookAt(controls.target);
  farCam.position.copy(viewCam.position); farCam.quaternion.copy(viewCam.quaternion);
  shared.uCam.value.copy(viewCam.position);
  sky.position.copy(viewCam.position);
  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(farScene, farCam);
  renderer.clearDepth();
  renderer.render(nearScene, viewCam);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function loop() {
  requestAnimationFrame(loop);
  if (S.drift && !userBusy && !reduceMotion) dirty = true;
  if (controls.update()) dirty = true;
  if (stepGestures()) dirty = true;
  if (!dirty) return;
  dirty = false;
  render();
}

// ---------- website mockup overlay ----------
const frame = document.getElementById('site');
function styleSite() {
  const doc = frame.contentDocument;
  if (!doc || !doc.head) return;
  let tag = doc.getElementById('backdrop-lab');
  if (!tag) { tag = doc.createElement('style'); tag.id = 'backdrop-lab'; doc.head.appendChild(tag); }
  const [r, g, b] = new THREE.Color(S.mid).convertLinearToSRGB().toArray().map((x) => Math.round(x * 255));
  tag.textContent = `html, body { background: rgba(${r}, ${g}, ${b}, ${S.siteBg}) !important; }`;
}
function applySite() {
  frame.hidden = !S.site;
  frame.style.opacity = S.siteOpacity;
  const gestures = S.scrollPan || S.sidePan || S.bgDrag || S.overscroll;
  frame.style.pointerEvents = S.siteClick || gestures ? 'auto' : 'none';
  if (!S.scrollPan) { G.scrollYaw = 0; G.scrollPitch = 0; } else readScroll();
  if (!S.site) return;
  const want = new URL(S.sitePath || '/', location.href).href;
  if (frame.dataset.src !== want) { frame.dataset.src = want; frame.src = want; }
  styleSite();
}
function readScroll() {
  const w = frame.contentWindow; if (!w) return;
  const screens = w.scrollY / Math.max(w.innerHeight, 1);
  G.scrollYaw = Math.min(screens * S.scrollDeg, S.scrollMax) * DEG;
  G.scrollPitch = Math.min(screens * S.scrollTilt, 8) * DEG;
}
const NOT_BACKGROUND = 'a, button, input, textarea, select, label, p, h1, h2, h3, h4, h5, li, img, svg, figure, pre, code, blockquote, time, .card, [class*="project"]';
function wireGestures() {
  const w = frame.contentWindow, doc = frame.contentDocument;
  if (!doc || doc.__lab) return;
  doc.__lab = true;
  doc.documentElement.style.overscrollBehaviorX = 'none';   // stop sideways swipes from navigating back
  w.addEventListener('scroll', () => { if (S.scrollPan) { readScroll(); } }, { passive: true });
  w.addEventListener('wheel', (e) => {
    const dx = e.deltaX || (e.shiftKey ? e.deltaY : 0);
    if (S.sidePan && Math.abs(dx) > Math.abs(e.deltaY) * 0.5 && dx) {
      G.sideYaw += dx * S.sideSens * 0.001;
      e.preventDefault();
      return;
    }
    if (S.overscroll && e.deltaY) {
      const el = doc.scrollingElement;
      const atEnd = el.scrollTop + w.innerHeight >= el.scrollHeight - 2, atTop = el.scrollTop <= 0;
      if ((atEnd && e.deltaY > 0) || (atTop && e.deltaY < 0)) {
        G.spring = THREE.MathUtils.clamp(G.spring + e.deltaY * 0.0012, -25 * DEG, 25 * DEG);
        G.lastOverscroll = performance.now();
      }
    }
  }, { passive: false });
  // touch: a mostly horizontal swipe pans; vertical swipes scroll the page as usual
  let t0 = null, axis = null;
  w.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY }; axis = null; } }, { passive: true });
  w.addEventListener('touchmove', (e) => {
    if (!S.sidePan || !t0 || e.touches.length !== 1) return;
    const x = e.touches[0].clientX, y = e.touches[0].clientY, dx = x - t0.x, dy = y - t0.y;
    if (!axis && Math.hypot(dx, dy) > 8) axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y';
    if (axis === 'x') { G.sideYaw -= dx * S.sideSens * 0.003; t0 = { x, y }; e.preventDefault(); }
  }, { passive: false });
  w.addEventListener('touchend', () => { t0 = null; }, { passive: true });
  // mouse/pen: drag on empty background orbits in any direction
  let drag = null;
  w.addEventListener('pointerdown', (e) => {
    if (!S.bgDrag || e.pointerType === 'touch' || e.button !== 0 || e.target.closest(NOT_BACKGROUND)) return;
    drag = { x: e.clientX, y: e.clientY }; doc.documentElement.style.cursor = 'grabbing'; e.preventDefault();
  });
  w.addEventListener('pointermove', (e) => {
    if (!drag) {
      if (S.bgDrag && e.pointerType !== 'touch') doc.documentElement.style.cursor = e.target.closest(NOT_BACKGROUND) ? '' : 'grab';
      return;
    }
    G.sideYaw -= (e.clientX - drag.x) * 0.004;
    G.dragPitch = THREE.MathUtils.clamp(G.dragPitch + (e.clientY - drag.y) * 0.003, -0.6, 0.6);
    drag = { x: e.clientX, y: e.clientY };
  });
  w.addEventListener('pointerup', () => { drag = null; doc.documentElement.style.cursor = ''; });
  readScroll();
}
frame.addEventListener('load', () => {
  styleSite();
  try { wireGestures(); } catch (err) { console.warn('gestures', err); }
  // keep the overlay styled when clicking through to other site pages
  try { frame.contentWindow.addEventListener('pageshow', styleSite); } catch {}
});

// ---------- panel ----------
const panel = document.getElementById('panel');
const SPEC = [
  ['Tone', [
    ['preset', 'select', { options: [['site', 'Site navy + gold'], ['slate', 'Slate'], ['ash', 'Ash'], ['dusk', 'Dusk'], ['custom', 'Custom']] }],
    ['shadow', 'color', { label: 'Shadow' }],
    ['mid', 'color', { label: 'Mid (site navy)' }],
    ['light', 'color', { label: 'Light' }],
    ['highlight', 'color', { label: 'Highlight' }],
    ['midPoint', 'range', { label: 'Mid point', min: 0.1, max: 0.9, step: 0.01 }],
    ['hlStart', 'range', { label: 'Highlight starts at', min: 0.4, max: 1, step: 0.01 }],
    ['hlAmount', 'range', { label: 'Highlight strength', min: 0, max: 1, step: 0.01 }],
    ['mono', 'range', { label: 'Monotone', min: 0, max: 1, step: 0.01 }],
    ['exposure', 'range', { label: 'Exposure', min: 0.3, max: 3, step: 0.01 }],
    ['contrast', 'range', { label: 'Contrast', min: 0.5, max: 2, step: 0.01 }],
    ['vignette', 'range', { label: 'Vignette', min: 0, max: 1.2, step: 0.01 }],
    ['grain', 'range', { label: 'Grain', min: 0, max: 0.08, step: 0.001 }],
  ]],
  ['Scene', [
    ['region', 'select', { label: 'Region', options: [['sierra', 'Sierra Nevada'], ['alps', 'Alps, Valais'], ['himalaya', 'Himalaya, Everest'], ['grandcanyon', 'Grand Canyon'], ['denali', 'Alaska Range, Denali']] }],
    ['altitudeFt', 'range', { label: 'Altitude (ft)', min: 20000, max: 85000, step: 500 }],
    ['exag', 'range', { label: 'Vertical exaggeration', min: 1, max: 5, step: 0.05 }],
    ['offsetX', 'range', { label: 'Jet position E–W (km)', min: -140, max: 140, step: 0.5 }],
    ['offsetZ', 'range', { label: 'Jet position N–S (km)', min: -140, max: 140, step: 0.5 }],
    ['sunAz', 'range', { label: 'Sun direction (°)', min: 0, max: 360, step: 1 }],
    ['sunEl', 'range', { label: 'Sun height (°)', min: -4, max: 70, step: 0.5 }],
    ['haze', 'range', { label: 'Visibility (km)', min: 40, max: 600, step: 5 }],
    ['clouds', 'range', { label: 'Cloud cover', min: 0, max: 1, step: 0.01 }],
    ['fov', 'range', { label: 'Lens (vertical °)', min: 12, max: 70, step: 1 }],
  ]],
  ['Ground', [
    ['style', 'select', { label: 'Style', options: [['grid', 'Terrain grid'], ['gridcontour', 'Grid + contours'], ['contour', 'Contours'], ['shaded', 'Shaded relief'], ['shadedgrid', 'Shaded + grid'], ['topo', 'Topo sheet (dark ink)'], ['topoglow', 'Topo, glowing lines']] }],
    ['grid', 'range', { label: 'Grid lines', min: 0, max: 1, step: 0.01 }],
    ['gridSize', 'range', { label: 'Grid spacing (m)', min: 250, max: 10000, step: 250 }],
    ['contour', 'range', { label: 'Contour lines', min: 0, max: 1, step: 0.01 }],
    ['contourStep', 'range', { label: 'Contour interval (m)', min: 25, max: 1000, step: 25 }],
    ['shade', 'range', { label: 'Shaded relief', min: 0, max: 1, step: 0.01 }],
    ['lineBright', 'range', { label: 'Line brightness (0 = dark ink)', min: 0, max: 2, step: 0.005 }],
    ['tint', 'range', { label: 'Height tint', min: 0, max: 1, step: 0.01 }],
    ['tintContrast', 'range', { label: 'Height tint contrast', min: 0.3, max: 3, step: 0.05 }],
    ['tintPivot', 'range', { label: 'Height tint pivot', min: 0, max: 1, step: 0.01 }],
    ['slope', 'range', { label: 'Darken steep slopes', min: 0, max: 1, step: 0.01 }],
    ['lineGold', 'range', { label: 'Lines in highlight color', min: 0, max: 1, step: 0.01 }],
  ]],
  ['Camera', [
    ['drift', 'check', { label: 'Slow drift' }],
    ['driftSpeed', 'range', { label: 'Drift speed', min: 0.02, max: 1.5, step: 0.01 }],
  ]],
  ['Gestures on the site', [
    ['scrollPan', 'check', { label: '1. Page position pans' }],
    ['scrollDeg', 'range', { label: 'Orbit per screen (°)', min: 0, max: 45, step: 0.5 }],
    ['scrollTilt', 'range', { label: 'Tilt per screen (°)', min: 0, max: 5, step: 0.1 }],
    ['scrollMax', 'range', { label: 'Max orbit from scroll (°)', min: 0, max: 360, step: 5 }],
    ['sidePan', 'check', { label: '2. Sideways swipe pans' }],
    ['sideSens', 'range', { label: 'Sideways sensitivity', min: 0.1, max: 4, step: 0.05 }],
    ['bgDrag', 'check', { label: '3. Drag background (mouse)' }],
    ['overscroll', 'check', { label: '4. Overscroll springs' }],
  ]],
  ['Website', [
    ['site', 'check', { label: 'Show site on top' }],
    ['sitePath', 'select', { label: 'Page', options: [['/', 'About'], ['/portfolio/', 'Portfolio'], ['/experience/', 'Experience'], ['/blog/', 'Blog']] }],
    ['siteOpacity', 'range', { label: 'Site opacity', min: 0, max: 1, step: 0.01 }],
    ['siteBg', 'range', { label: 'Site background', min: 0, max: 1, step: 0.01 }],
    ['siteClick', 'check', { label: 'Clicks go to site' }],
  ]],
];
const inputs = {};
function build() {
  const body = panel.querySelector('.panel-body');
  for (const [title, rows] of SPEC) {
    const fs = document.createElement('fieldset');
    fs.innerHTML = `<legend>${title}</legend>`;
    for (const [key, type, o] of rows) {
      const row = document.createElement('label');
      row.className = 'row ' + type;
      const name = document.createElement('span'); name.textContent = o.label || ({ preset: 'Palette' })[key] || key;
      let input;
      if (type === 'select') {
        input = document.createElement('select');
        for (const [v, t] of o.options) input.add(new Option(t, v));
      } else {
        input = document.createElement('input');
        input.type = type === 'check' ? 'checkbox' : type;
        if (type === 'range') Object.assign(input, { min: o.min, max: o.max, step: o.step });
      }
      const out = document.createElement('output');
      row.append(name, input);
      if (type === 'range') row.append(out);
      input.addEventListener('input', () => {
        const v = type === 'check' ? input.checked : type === 'range' ? +input.value : input.value;
        S[key] = v;
        if (key === 'preset' && PRESETS[v]) Object.assign(S, PRESETS[v]);
        if (key === 'style' && STYLES[v]) Object.assign(S, STYLES[v]);
        if (key === 'region') { S.offsetX = null; S.offsetZ = null; }
        if (['shadow', 'mid', 'light', 'highlight'].includes(key)) S.preset = 'custom';
        sync(); apply();
      });
      inputs[key] = { input, out, type };
      fs.append(row);
    }
    body.append(fs);
  }
}
function sync() {
  for (const [key, { input, out, type }] of Object.entries(inputs)) {
    let val = S[key];
    if ((key === 'offsetX' || key === 'offsetZ') && val == null) val = REGIONS[S.region]?.peakKm[key === 'offsetX' ? 0 : 1] ?? 0;
    if (type === 'check') input.checked = !!val;
    else input.value = val;
    if (out) out.textContent = Number(val).toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  const custom = inputs.preset.input.querySelector('option[value="custom"]');
  custom.hidden = S.preset !== 'custom';
}
build(); sync();

const status = document.getElementById('status');
const say = (t) => { status.textContent = t; clearTimeout(say.t); say.t = setTimeout(() => (status.textContent = ''), 2500); };
document.getElementById('toggle').addEventListener('click', () => {
  const open = panel.classList.toggle('closed') === false;
  const t = document.getElementById('toggle');
  t.setAttribute('aria-expanded', String(open)); t.textContent = open ? 'Hide' : 'Show';
});
document.getElementById('reset-view').addEventListener('click', () => {
  G.sideYaw = 0; G.dragPitch = 0; G.spring = 0;
  camera.position.set(52, 14, -48); controls.target.set(0, 0, 1); dirty = true;
});
document.getElementById('reset-all').addEventListener('click', () => { Object.assign(S, DEFAULTS); sync(); apply(); say('Back to defaults'); });
document.getElementById('copy').addEventListener('click', async () => {
  const snapshot = { ...S, view: { position: camera.position.toArray().map((n) => +n.toFixed(2)), target: controls.target.toArray().map((n) => +n.toFixed(2)) } };
  const link = `${location.origin}${location.pathname}#${encodeURIComponent(JSON.stringify(snapshot))}`;
  try { await navigator.clipboard.writeText(link); say('Link with these settings copied'); }
  catch { prompt('Copy this link', link); }
});
document.getElementById('shot').addEventListener('click', () => {
  render();
  canvas.toBlob((blob) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `sr71-backdrop-${Date.now()}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
});
addEventListener('keydown', (e) => {
  if (CLEAN || e.target.closest('input, select')) return;
  if (e.key === 'h') document.getElementById('toggle').click();
  if (e.key === ' ') { S.drift = !S.drift; sync(); apply(); e.preventDefault(); }
});
// a shared link can carry a camera view too
if (S.view) {
  try { camera.position.fromArray(S.view.position); controls.target.fromArray(S.view.target); } catch {}
  delete S.view;
}

apply();
if (innerWidth < 640 && !CLEAN) document.getElementById('toggle').click();  // phones start with the panel tucked away
loop();
window.__lab = { S, apply, sync, render, camera, controls, G };
