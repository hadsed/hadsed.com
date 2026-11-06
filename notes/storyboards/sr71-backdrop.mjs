// SR-71 backdrop lab: a still aircraft at cruise altitude with the ground far below.
// Drag to look around it. The scene renders in color, then a final pass collapses it to a
// navy monotone with a gold highlight (both adjustable), so it can sit quietly behind the site.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const EARTH_R = 6371000;
const STORE = 'sr71-backdrop-v1';

// ---------- settings ----------
const PRESETS = {
  site: { shadow: '#07090e', mid: '#1c2433', light: '#c8cdd5', highlight: '#e4c56f' },
  slate: { shadow: '#050608', mid: '#2a313c', light: '#d6dbe2', highlight: '#f2f4f7' },
  ash: { shadow: '#060606', mid: '#2f2f30', light: '#dcdad6', highlight: '#ffffff' },
  dusk: { shadow: '#06050d', mid: '#262447', light: '#c6c3dc', highlight: '#e9a77a' },
};
const DEFAULTS = {
  preset: 'site', ...PRESETS.site,
  midPoint: 0.42, hlStart: 0.74, hlAmount: 0.85, mono: 1, exposure: 1.0, contrast: 1.0, grain: 0.018, vignette: 0.45,
  altitude: 24000, sunAz: 215, sunEl: 18, haze: 210, clouds: 0.35, relief: 1, fov: 34,
  drift: true, driftSpeed: 0.2,
  site: false, sitePath: '/', siteOpacity: 1, siteBg: 0.35, siteClick: false,
};
const load = () => {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch {}
  let fromHash = {};
  try { if (location.hash.length > 1) fromHash = JSON.parse(decodeURIComponent(location.hash.slice(1))); } catch {}
  return { ...DEFAULTS, ...saved, ...fromHash };
};
const S = load();
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch {} };

// ---------- renderer ----------
const canvas = document.getElementById('backdrop');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
const coarse = matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
renderer.autoClear = false;

const sunDir = new THREE.Vector3();
const shared = {
  uCam: { value: new THREE.Vector3() },
  uEarthR: { value: EARTH_R },
  uSun: { value: sunDir },
  uHaze: { value: new THREE.Vector3(0.50, 0.56, 0.66) },
  uHazeDist: { value: 210000 },
  uRelief: { value: 1 },
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
// lands where it would from altitude (about 5 degrees below level at 24 km).
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
        vec3 c = mix(uHaze, zenith, pow(smoothstep(0.0, 0.7, el), 0.55));
        c += vec3(0.32) * exp(-abs(el) * 40.0);              // bright limb on the horizon
        float sun = max(dot(d, uSun), 0.0);
        c += vec3(0.35) * pow(sun, 12.0) + vec3(3.0) * pow(sun, 2500.0);
        c = mix(c, uHaze * 0.9, smoothstep(0.0, -0.03, el));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }),
);
farScene.add(sky);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1.6e6, 1.6e6, 480, 480),
  new THREE.ShaderMaterial({
    uniforms: shared, vertexShader: CURVED_VERT,
    fragmentShader: /* glsl */`
      uniform vec3 uCam, uSun, uHaze; uniform float uHazeDist, uRelief; varying vec2 vXZ; varying float vDist;
      ${NOISE}
      // Height 0..1: broad landmasses, domain-warped so valleys wander, ridged ranges on high ground.
      float height(vec2 p){
        vec2 q = p / 42000.0;
        vec2 w = vec2(fbm(q + vec2(3.1, 7.7), 4), fbm(q + vec2(9.2, 1.4), 4));
        float base = fbm(q + 1.6 * w, 6);
        float mtn = ridged(q * 2.6 + w, 6);
        return base * 0.65 + mtn * 0.45 * smoothstep(0.40, 0.58, base);
      }
      void main(){
        vec2 p = vXZ;
        float h = height(p);
        float e = 700.0;
        float relief = uRelief * 9000.0 / (1.0 + vDist / 90000.0);  // flatten far relief so the horizon doesn't shimmer
        float dx = height(p + vec2(e, 0)) - height(p - vec2(e, 0));
        float dz = height(p + vec2(0, e)) - height(p - vec2(0, e));
        vec3 n = normalize(vec3(-dx * relief, 2.0 * e, -dz * relief));
        float lit = clamp(dot(n, uSun), 0.0, 1.0);
        float water = smoothstep(0.255, 0.24, h);
        vec3 land = mix(vec3(0.09, 0.10, 0.10), vec3(0.30, 0.29, 0.27), smoothstep(0.25, 0.62, h));
        land *= 0.3 + 1.2 * lit;
        land *= 0.85 + 0.3 * fbm(p / 2200.0, 4) * (1.0 - smoothstep(30000.0, 120000.0, vDist));
        vec3 view = normalize(uCam - vec3(p.x, uCam.y - vDist * 0.5, p.y));
        vec3 sea = vec3(0.04, 0.05, 0.07) + vec3(0.35) * pow(max(dot(reflect(-uSun, vec3(0, 1, 0)), view), 0.0), 60.0);
        vec3 c = mix(land, sea, water);
        float fog = 1.0 - exp(-vDist / uHazeDist);
        c = mix(c, uHaze, fog * fog * 0.9 + fog * 0.1);
        gl_FragColor = vec4(c, 1.0);
      }`,
  }),
);
ground.rotation.x = -Math.PI / 2;
farScene.add(ground);

// Scattered cumulus about 7 km up: parallax against the ground as the view moves.
const clouds = new THREE.Mesh(
  new THREE.PlaneGeometry(1.2e6, 1.2e6, 240, 240),
  new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: shared, vertexShader: CURVED_VERT,
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
        vec3 c = texture2D(tColor, vUv).rgb * uExposure;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        l = l / (1.0 + l);                       // soft rolloff on the sun and horizon limb
        l = pow(clamp(l * 1.55, 0.0, 1.0), 0.85);
        l = clamp((l - 0.5) * uContrast + 0.5, 0.0, 1.0);
        // three-stop ramp: shadow -> mid (site navy) -> light
        vec3 ramp = l < uMidPoint ? mix(uShadow, uMid, l / uMidPoint) : mix(uMid, uLight, (l - uMidPoint) / (1.0 - uMidPoint));
        // gold only on the brightest values: sun, limb, glints
        float hl = smoothstep(uHlStart, min(uHlStart + 0.18, 1.0), l) * uHlAmount;
        ramp = mix(ramp, uHigh, hl);
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
function apply() {
  postU.uShadow.value.copy(col(S.shadow)); postU.uMid.value.copy(col(S.mid));
  postU.uLight.value.copy(col(S.light)); postU.uHigh.value.copy(col(S.highlight));
  for (const k of ['midPoint', 'hlStart', 'hlAmount', 'mono', 'exposure', 'contrast', 'grain', 'vignette']) {
    postU['u' + k[0].toUpperCase() + k.slice(1)].value = +S[k];
  }
  const az = THREE.MathUtils.degToRad(S.sunAz), el = THREE.MathUtils.degToRad(S.sunEl);
  sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
  sunLight.position.copy(sunDir).multiplyScalar(100);
  ground.position.y = -S.altitude;
  clouds.position.y = -S.altitude + 7000;
  clouds.visible = S.altitude > 8000;
  shared.uDip.value = Math.acos(EARTH_R / (EARTH_R + Math.max(S.altitude, 1)));
  shared.uHazeDist.value = S.haze * 1000;
  shared.uCover.value = +S.clouds;
  shared.uRelief.value = +S.relief;
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

function render() {
  farCam.position.copy(camera.position); farCam.quaternion.copy(camera.quaternion);
  shared.uCam.value.copy(camera.position);
  sky.position.copy(camera.position);
  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(farScene, farCam);
  renderer.clearDepth();
  renderer.render(nearScene, camera);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function loop() {
  requestAnimationFrame(loop);
  if (S.drift && !userBusy && !reduceMotion) dirty = true;
  if (controls.update()) dirty = true;
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
  frame.style.pointerEvents = S.siteClick ? 'auto' : 'none';
  if (!S.site) return;
  const want = new URL(S.sitePath || '/', location.href).href;
  if (frame.dataset.src !== want) { frame.dataset.src = want; frame.src = want; }
  styleSite();
}
frame.addEventListener('load', () => {
  styleSite();
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
    ['altitude', 'range', { label: 'Altitude (m)', min: 3000, max: 30000, step: 100 }],
    ['sunAz', 'range', { label: 'Sun direction (°)', min: 0, max: 360, step: 1 }],
    ['sunEl', 'range', { label: 'Sun height (°)', min: -4, max: 70, step: 0.5 }],
    ['haze', 'range', { label: 'Visibility (km)', min: 40, max: 600, step: 5 }],
    ['clouds', 'range', { label: 'Cloud cover', min: 0, max: 1, step: 0.01 }],
    ['relief', 'range', { label: 'Terrain relief', min: 0, max: 3, step: 0.05 }],
    ['fov', 'range', { label: 'Lens (vertical °)', min: 12, max: 70, step: 1 }],
  ]],
  ['Camera', [
    ['drift', 'check', { label: 'Slow drift' }],
    ['driftSpeed', 'range', { label: 'Drift speed', min: 0.02, max: 1.5, step: 0.01 }],
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
    if (type === 'check') input.checked = !!S[key];
    else input.value = S[key];
    if (out) out.textContent = Number(S[key]).toLocaleString(undefined, { maximumFractionDigits: 3 });
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
  if (e.target.closest('input, select')) return;
  if (e.key === 'h') document.getElementById('toggle').click();
  if (e.key === ' ') { S.drift = !S.drift; sync(); apply(); e.preventDefault(); }
});
// a shared link can carry a camera view too
if (S.view) {
  try { camera.position.fromArray(S.view.position); controls.target.fromArray(S.view.target); } catch {}
  delete S.view;
}

apply();
loop();
window.__lab = { S, apply, sync, render, camera, controls };
