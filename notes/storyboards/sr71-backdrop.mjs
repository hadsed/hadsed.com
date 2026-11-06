// SR-71 backdrop lab: a still aircraft at cruise altitude with the ground far below.
// Drag to look around it. The scene renders in color, then a final pass collapses it to a
// navy monotone with a gold highlight (both adjustable), so it can sit quietly behind the site.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.min.js';
import { createSiteGestures } from './site-gestures.mjs';
import { createWorld, createPost, loadTerrarium, WORLD_DEFAULTS, DAY_LOOK, NIGHT_LOOK, NIGHT_DEFAULTS } from './world/index.js';
const STORE = 'sr71-backdrop-v7';   // v7: night jigs (stars, horizon, city lights, night colors)

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
  // Had's navy grid (2026-11-06) and the same lines over natural ground
  navygrid: { grid: 0.66, gridSize: 250, contour: 0.46, contourStep: 175, shade: 0.39, lineBright: 0.73, tint: 0, slope: 0, color: 0, texture: 0, mono: 1, chroma: 0 },
  navycolor: { grid: 0.66, gridSize: 250, contour: 0.46, contourStep: 175, shade: 0.39, lineBright: 0.73, tint: 0, slope: 0, color: 1, texture: 1, mono: 1, chroma: 0.7 },
  natural: { grid: 0.66, gridSize: 250, contour: 0.46, contourStep: 175, shade: 0.39, lineBright: 0.73, tint: 0, slope: 0, color: 1, texture: 1, mono: 0, chroma: 0 },
};
// Defaults = the look Had landed on 2026-11-05 (iPad), with altitude at the SR-71's ~85k ft ceiling.
// The look itself (tone, scene, ground) lives in the shared world module, so the flight lab matches.
const TIMES = { night: NIGHT_LOOK, day: DAY_LOOK };
// Starting points for the night jigs. Each is applied on top of the night defaults.
const NIGHT_PRESETS = {
  sparse: { ...NIGHT_DEFAULTS, mono: 1, chroma: 0.7, milky: 0.45, city: 1, afterglow: 1 },
  natural: { ...NIGHT_DEFAULTS, mono: 0.2, chroma: 1, milky: 0.45, city: 1, afterglow: 1, nightGround: '#1d222b' },
  rich: { ...NIGHT_DEFAULTS, starDensity: 0.8, starVar: 0.5, milky: 1, mono: 1, chroma: 0.7, afterglow: 1, city: 1 },
  quiet: { ...NIGHT_DEFAULTS, starDensity: 0.2, starBright: 0.8, milky: 0, seamBright: 0.6, seamAround: 0.5, glowBright: 0.6, city: 0.6, cityDensity: 0.6, cityGlow: 0.5, mono: 1, chroma: 0.5 },
};
const DEFAULTS = {
  preset: 'site', ...WORLD_DEFAULTS, ...NIGHT_LOOK, style: 'navycolor', time: 'night', nightPreset: 'sparse',
  drift: true, driftSpeed: 0.02,
  scrollPan: true, scrollDeg: 10, scrollTilt: 1.5, scrollMax: 90, sidePan: true, sideSens: 1, bgDrag: true, overscroll: true, gestureLog: false,
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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
const coarse = matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
renderer.autoClear = false;
renderer.setClearColor(0x000000, 0);

const world = createWorld({ segments: coarse ? 384 : 512 });   // sky, terrain, cloud deck, monotone pass (shared with the flight lab)
const sunDir = world.sunDir;
const origin = new THREE.Vector3();   // the jet's world position; render space is centered on it

// ---------- far scene: sky, ground, cloud deck ----------
const farScene = new THREE.Scene();
const farCam = new THREE.PerspectiveCamera(34, 1, 50, 3.0e6);
farScene.add(world.sky, world.terrain, world.clouds);

// Real elevation (terrain/*.webp, terrarium encoding), mirrored past the region edge so the ground runs to the horizon.
const REGIONS = {};
const regionList = fetch('terrain/regions.json').then((r) => r.json()).then((list) => { for (const r of list) REGIONS[r.id] = r; return list; });
async function loadRegion(id) {
  const list = await regionList;
  const r = REGIONS[id] || list[0];
  world.setHeight(await loadTerrarium(`terrain/${r.id}.webp`), r);
  reveal();
  document.getElementById('credit').textContent = `${r.label} · ${r.lat.toFixed(2)}°, ${r.lon.toFixed(2)}° · ${r.widthKm} km of real elevation, mirrored past the edges. Terrain: AWS Terrain Tiles (SRTM, USGS 3DEP, GMTED and others).`;
  dirty = true;
  return r;
}

// ---------- near scene: the aircraft ----------
// Original low-poly proxy (same blocking as the directing room). Local forward is -Z. Not flight-accurate.
const nearScene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 4000);
const hemi = new THREE.HemisphereLight(0x9fb0cc, 0x4a505a, 2.0); nearScene.add(hemi);
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

// The real jet (helijah's SR-71, gear and chute removed) from the flight lab's packed asset, when the
// flight lab is deployed next to this one (branch previews). It replaces the proxy at the proxy's own
// size and spot, so camera framing is unchanged. Any failure keeps the proxy.
(async () => {
  try {
    const base = new URL('../flight/', location.href);
    const manifest = await fetch(new URL('assets/manifest.json', base)).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
    if (manifest.jet?.kind !== 'packed') return;
    const [{ decodeJet }, buf] = await Promise.all([
      import(new URL('packages/assets/jet-pack.js', base).href),
      fetch(new URL(manifest.jet.src, base)).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }),
    ]);
    const j = await decodeJet(buf);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(j.position, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(j.normal, 3));
    if (j.uv) g.setAttribute('uv', new THREE.BufferAttribute(j.uv, 2));
    g.setIndex(new THREE.BufferAttribute(j.index, 1));
    g.computeBoundingBox();
    if (j.texture) {   // the paint: USAF markings, panel lines, red danger stripes
      const tex = new THREE.Texture(await createImageBitmap(new Blob([j.texture.bytes], { type: j.texture.type })));
      tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.needsUpdate = true;
      skin.map = tex; skin.color.set(0xffffff); skin.needsUpdate = true;
    }
    plane.updateMatrixWorld(true);
    const proxy = new THREE.Box3().setFromObject(plane);
    const pl = proxy.max.z - proxy.min.z, gl = g.boundingBox.max.z - g.boundingBox.min.z;
    const k = pl / gl;
    const c = new THREE.Vector3(); g.boundingBox.getCenter(c);
    const pc = new THREE.Vector3(); proxy.getCenter(pc);
    for (const o of [...plane.children]) o.visible = false;
    const mesh = new THREE.Mesh(g, skin);
    mesh.scale.setScalar(k);
    mesh.position.set(pc.x - c.x * k, pc.y - c.y * k, pc.z - c.z * k).sub(plane.position);
    plane.add(mesh);
    window.__labJet = { triangles: j.index.length / 3, credit: j.credit };
    dirty = true;
  } catch (err) { console.warn('packed jet unavailable, keeping the proxy', err); }
})();

// ---------- monotone composite ----------
const post = createPost(renderer, world, { skipWhenOff: false });   // keep the pass: the site wants the vignette

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
  world.setLook(S);
  post.setLook(S);
  sunLight.position.copy(sunDir).multiplyScalar(100);
  // at night the jet is a dark shape against the stars: a little moonlight and sky, no sun
  const night = +S.night || 0;
  sunLight.intensity = 3.2 * (1 - night); hemi.intensity = 2.0 * (1 - 0.82 * night); bounce.intensity = 0.6 * (1 - 0.7 * night);
  const altitude = S.altitudeFt * 0.3048;
  const reg = REGIONS[S.region];
  if (reg) origin.set((S.offsetX ?? reg.peakKm[0]) * 1000, altitude, (S.offsetZ ?? reg.peakKm[1]) * 1000);
  if (loadedRegion !== S.region) { loadedRegion = S.region; loadRegion(S.region).then(() => { apply(); sync(); }); }
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
  post.setSize(w, h, pr);
  const aspect = w / h;
  const fov = aspect < 1 ? S.fov * Math.min(1.8, 1 / aspect) : +S.fov;  // portrait phones: widen so the jet fits
  for (const c of [farCam, camera]) { c.aspect = aspect; c.fov = fov; c.updateProjectionMatrix(); }
  dirty = true;
}
addEventListener('resize', resize);

// ---------- gesture offsets ----------
// The orbit controls own the base view. Gestures on the site add a yaw/pitch offset on top, applied
// to a separate render camera, so scroll-mapped pan is a pure function of page position and always reverses.
const viewCam = camera.clone();
const sph = new THREE.Spherical(), offV = new THREE.Vector3();
const DEG = Math.PI / 180;
const gestures = createSiteGestures(S, { log: (line) => log(line) });
const G = gestures.G;

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
  world.frame(farCam, origin);
  post.render(() => {
    renderer.clear();
    renderer.render(farScene, farCam);
    renderer.clearDepth();
    renderer.render(nearScene, viewCam);
  });
}

// Compile every shader before the first visible frame, then fade the scene in under the site.
let revealed = false;
async function reveal() {
  if (revealed) return; revealed = true;
  try { await Promise.all([renderer.compileAsync(farScene, farCam), renderer.compileAsync(nearScene, viewCam), renderer.compileAsync(post.scene, post.camera)]); } catch {}
  render();
  requestAnimationFrame(() => canvas.classList.add('ready'));
}
// If frames run slow (phones, big screens), step the render resolution down. Never steps back up.
const frameTimes = []; let lastFrame = 0;
function adapt(now) {
  if (lastFrame && now - lastFrame < 250) frameTimes.push(now - lastFrame);
  lastFrame = now;
  if (frameTimes.length < 40) return;
  const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length; frameTimes.length = 0;
  const pr = renderer.getPixelRatio();
  if (avg > 34 && pr > 0.75) { renderer.setPixelRatio(Math.max(0.75, pr - 0.25)); resize(); }
}
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function loop() {
  requestAnimationFrame(loop);
  if (S.drift && !userBusy && !reduceMotion) dirty = true;
  if (controls.update()) dirty = true;
  if (gestures.step()) dirty = true;
  if (!dirty) return;
  dirty = false;
  if (!revealed) return;
  render();
  adapt(performance.now());
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
  const gestures = S.scrollPan || S.sidePan || S.bgDrag;
  logBox.hidden = !S.gestureLog;
  frame.style.pointerEvents = S.siteClick || gestures ? 'auto' : 'none';
  readScroll();
  if (!S.site) return;
  const want = new URL(S.sitePath || '/', location.href).href;
  if (frame.dataset.src !== want) { frame.dataset.src = want; frame.src = want; }
  styleSite();
}
// tiny on-screen event log for debugging gestures on devices we can't attach a debugger to
const logBox = document.createElement('pre');
logBox.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:3;margin:0;max-width:60vw;max-height:40vh;overflow:hidden;font:11px/1.3 ui-monospace,monospace;color:#e4c56f;background:rgba(8,10,14,.8);padding:6px 8px;border-radius:6px;pointer-events:none';
logBox.hidden = true; document.body.appendChild(logBox);
const logLines = [];
function log(line) {
  if (!S.gestureLog) return;
  logLines.push(`${(performance.now() / 1000).toFixed(2)} ${line}  yaw ${(G.yaw / DEG).toFixed(1)}°`);
  if (logLines.length > 18) logLines.shift();
  logBox.textContent = logLines.join('\n');
}
const readScroll = () => gestures.readScroll(frame.contentWindow);
frame.addEventListener('load', () => {
  styleSite();
  try { gestures.wire(frame.contentWindow); } catch (err) { console.warn('gestures', err); }
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
    ['chroma', 'range', { label: 'Color through the monotone', min: 0, max: 2, step: 0.01 }],
    ['exposure', 'range', { label: 'Exposure', min: 0.3, max: 3, step: 0.01 }],
    ['contrast', 'range', { label: 'Contrast', min: 0.5, max: 2, step: 0.01 }],
    ['vignette', 'range', { label: 'Vignette', min: 0, max: 1.2, step: 0.01 }],
    ['grain', 'range', { label: 'Grain', min: 0, max: 0.08, step: 0.001 }],
  ]],
  ['Night', [
    ['time', 'select', { label: 'Time of day', options: [['night', 'Night flight'], ['day', 'Day']] }],
    ['night', 'range', { label: 'Night', min: 0, max: 1, step: 0.01 }],
    ['moonAz', 'range', { label: 'Moon direction (°)', min: 0, max: 360, step: 1 }],
    ['moonEl', 'range', { label: 'Moon height (°)', min: 0, max: 80, step: 1 }],
    ['nightPreset', 'select', { label: 'Night starting point', options: [['sparse', 'Sparse white stars'], ['natural', 'Natural color'], ['rich', 'Rich sky, Milky Way'], ['quiet', 'Quiet'], ['custom', 'Custom']] }],
  ]],
  ['Stars', [
    ['stars', 'range', { label: 'Overall', min: 0, max: 3, step: 0.01 }],
    ['milky', 'range', { label: 'Milky Way', min: 0, max: 2, step: 0.01 }],
    ['starDensity', 'range', { label: 'Density', min: 0, max: 2, step: 0.01 }],
    ['starBright', 'range', { label: 'Brightness', min: 0, max: 3, step: 0.01 }],
    ['starSize', 'range', { label: 'Size', min: 0.4, max: 3, step: 0.01 }],
    ['starScale', 'range', { label: 'Pattern scale (finer →)', min: 0.3, max: 2.5, step: 0.01 }],
    ['starSeed', 'range', { label: 'Pattern (reshuffle)', min: 0, max: 50, step: 1 }],
    ['starFade', 'range', { label: 'Fade out near horizon (°)', min: 0.5, max: 30, step: 0.5 }],
    ['starColor', 'color', { label: 'Star color' }],
    ['starVar', 'range', { label: 'Color variety (blue ↔ amber)', min: 0, max: 1, step: 0.01 }],
  ]],
  ['Horizon', [
    ['afterglow', 'range', { label: 'Overall', min: 0, max: 3, step: 0.01 }],
    ['seamColor', 'color', { label: 'Seam color' }],
    ['seamWidth', 'range', { label: 'Seam thickness (°)', min: 0.02, max: 3, step: 0.01 }],
    ['seamBright', 'range', { label: 'Seam brightness', min: 0, max: 4, step: 0.01 }],
    ['seamAround', 'range', { label: 'Toward the sun ↔ all around', min: 0, max: 1, step: 0.01 }],
    ['glowColor', 'color', { label: 'Glow above it' }],
    ['glowHeight', 'range', { label: 'Glow height (°)', min: 0.2, max: 20, step: 0.1 }],
    ['glowBright', 'range', { label: 'Glow brightness', min: 0, max: 4, step: 0.01 }],
    ['groundGlow', 'range', { label: 'Warm haze on far ground', min: 0, max: 3, step: 0.01 }],
  ]],
  ['City lights', [
    ['city', 'range', { label: 'Overall', min: 0, max: 3, step: 0.01 }],
    ['cityColor', 'color', { label: 'Color' }],
    ['cityBright', 'range', { label: 'Brightness', min: 0, max: 4, step: 0.01 }],
    ['cityDensity', 'range', { label: 'Lights per town', min: 0, max: 3, step: 0.01 }],
    ['cityCover', 'range', { label: 'How much land is town', min: 0, max: 1, step: 0.01 }],
    ['cityTown', 'range', { label: 'Town spacing (km)', min: 3, max: 80, step: 0.5 }],
    ['cityDot', 'range', { label: 'Light size (m)', min: 2, max: 40, step: 0.5 }],
    ['cityGlow', 'range', { label: 'Glow of distant towns', min: 0, max: 3, step: 0.01 }],
    ['cityMaxAlt', 'range', { label: 'Highest town (m)', min: 300, max: 4000, step: 50 }],
  ]],
  ['Night colors', [
    ['nightZenith', 'color', { label: 'Sky overhead' }],
    ['nightHorizon', 'color', { label: 'Sky at the horizon' }],
    ['nightGround', 'color', { label: 'Haze over the ground' }],
    ['moonLight', 'range', { label: 'Moonlight on the ground', min: 0, max: 1, step: 0.01 }],
  ]],
  ['Scene', [
    ['region', 'select', { label: 'Region', options: [['sierra', 'Sierra Nevada'], ['alps', 'Alps, Valais'], ['himalaya', 'Himalaya, Everest'], ['grandcanyon', 'Grand Canyon'], ['denali', 'Alaska Range, Denali']] }],
    ['altitudeFt', 'range', { label: 'Altitude (ft)', min: 20000, max: 85000, step: 500 }],
    ['exag', 'range', { label: 'Vertical exaggeration', min: 1, max: 5, step: 0.05 }],
    ['offsetX', 'range', { label: 'Jet position E–W (km)', min: -140, max: 140, step: 0.5 }],
    ['offsetZ', 'range', { label: 'Jet position N–S (km)', min: -140, max: 140, step: 0.5 }],
    ['sunAz', 'range', { label: 'Sun direction (°)', min: 0, max: 360, step: 1 }],
    ['sunEl', 'range', { label: 'Sun height (°)', min: -18, max: 70, step: 0.5 }],
    ['haze', 'range', { label: 'Visibility (km)', min: 40, max: 600, step: 5 }],
    ['clouds', 'range', { label: 'Cloud cover', min: 0, max: 1, step: 0.01 }],
    ['fov', 'range', { label: 'Lens (vertical °)', min: 12, max: 70, step: 1 }],
  ]],
  ['Ground', [
    ['style', 'select', { label: 'Style', options: [['navycolor', 'Navy, with ground color'], ['navygrid', 'Navy grid (monotone)'], ['natural', 'Natural ground + grid'], ['grid', 'Terrain grid'], ['gridcontour', 'Grid + contours'], ['contour', 'Contours'], ['shaded', 'Shaded relief'], ['shadedgrid', 'Shaded + grid'], ['topo', 'Topo sheet (dark ink)'], ['topoglow', 'Topo, glowing lines']] }],
    ['color', 'range', { label: 'Natural color (forest, rock, snow)', min: 0, max: 1, step: 0.01 }],
    ['texture', 'range', { label: 'Ground texture', min: 0, max: 1, step: 0.01 }],
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
    ['overscroll', 'check', { label: '4. Overscroll pans (rubber-band)' }],
    ['gestureLog', 'check', { label: 'Show event log (debug)' }],
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
        if (key === 'time' && TIMES[v]) Object.assign(S, TIMES[v]);
        if (key === 'nightPreset' && NIGHT_PRESETS[v]) Object.assign(S, NIGHT_PRESETS[v]);
        else if (key in NIGHT_DEFAULTS || ['stars', 'milky', 'afterglow', 'city'].includes(key)) S.nightPreset = 'custom';
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
  inputs.nightPreset.input.querySelector('option[value="custom"]').hidden = S.nightPreset !== 'custom';
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
  G.sideYaw = 0; G.dragPitch = 0; G.wheelOver = 0;
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
