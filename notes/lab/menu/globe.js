// The map picker's globe: NASA Blue Marble Earth you can drag and zoom, each map's terrain laid
// on it inside a gold border, and a gold halo on the one in focus. focus(id) spins it there.
import * as THREE from 'three';

const GOLD = new THREE.Color('#e4c56f');
const DEG = Math.PI / 180;

// Lat/lon -> point on the unit sphere, matching THREE.SphereGeometry's equirectangular UVs.
function ll(lat, lon, r = 1) {
  const phi = (90 - lat) * DEG, th = (lon + 180) * DEG;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}

export function createGlobe({ canvas, maps, onPick }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  const earth = new THREE.Group();
  scene.add(earth);

  // A soft headlight, so whatever faces you is lit and the limb falls off a little.
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const head = new THREE.DirectionalLight(0xffffff, 1.4);
  camera.add(head); head.position.set(-0.6, 0.5, 1);
  scene.add(camera);

  const tex = new THREE.TextureLoader().load('/lab/menu/earth.jpg');
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), new THREE.MeshLambertMaterial({ map: tex })));

  // Thin atmosphere at the limb, the color of the game's horizon.
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(1.035, 96, 48), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 n; varying vec3 v; void main(){ vec4 p = modelViewMatrix * vec4(position,1.); n = normalize(normalMatrix*normal); v = normalize(-p.xyz); gl_Position = projectionMatrix*p; }',
    fragmentShader: 'varying vec3 n; varying vec3 v; void main(){ float f = pow(clamp(1. + dot(n, v) * 1.0, 0., 1.), 4.); gl_FragColor = vec4(vec3(0.45,0.62,0.95) * f * 1.4, f); }',
  })));

  // Each map: its terrain on a patch of sphere, a gold border, and a halo for when it's in focus.
  const loader = new THREE.TextureLoader();
  const regions = new Map();
  const haloMat = () => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uOn: { value: 0 }, uT: { value: 0 }, uFar: { value: 1 }, uColor: { value: GOLD } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    // A soft glow around the map (never over it, so its terrain stays readable) and a slowly
    // breathing ring. uFar fades the glow out as you zoom right in.
    fragmentShader: `uniform float uOn, uT, uFar; uniform vec3 uColor; varying vec2 vUv;
      void main(){ float d = length(vUv - .5) * 2.;
        float glow = smoothstep(1., .62, d) * smoothstep(.4, .6, d) * .6 * uFar;
        float ring = smoothstep(.05, 0., abs(d - (.66 + .05 * sin(uT * 2.2)))) * .9;
        gl_FragColor = vec4(uColor, (glow + ring) * uOn); }`,
  });
  for (const m of maps) {
    const b = m.bounds, g = new THREE.Group();
    const lonL = (b.e - b.w) * DEG, latL = (b.n - b.s) * DEG;
    const patchTex = loader.load(`/lab/menu/maps/${m.id}-patch.jpg`);
    patchTex.colorSpace = THREE.SRGBColorSpace;
    patchTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const patch = new THREE.Mesh(
      new THREE.SphereGeometry(1.0006, 32, 32, (b.w + 180) * DEG, lonL, (90 - b.n) * DEG, latL),
      new THREE.MeshLambertMaterial({ map: patchTex, transparent: true, opacity: 0.92 }));
    patch.userData.id = m.id;
    g.add(patch);
    // Border: the four edges, each sampled along the sphere.
    const pts = [], R = 1.0012, n = 24;
    for (let i = 0; i <= n; i++) pts.push(ll(b.n, b.w + (b.e - b.w) * i / n, R));
    for (let i = 1; i <= n; i++) pts.push(ll(b.n - (b.n - b.s) * i / n, b.e, R));
    for (let i = 1; i <= n; i++) pts.push(ll(b.s, b.e - (b.e - b.w) * i / n, R));
    for (let i = 1; i <= n; i++) pts.push(ll(b.s + (b.n - b.s) * i / n, b.w, R));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.85 }));
    g.add(line);
    const center = ll((b.n + b.s) / 2, (b.e + b.w) / 2);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), haloMat());
    halo.position.copy(center).multiplyScalar(1.004);
    halo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), center);
    halo.renderOrder = 2;
    g.add(halo);
    earth.add(g);
    regions.set(m.id, { center, line, halo, patch, size: Math.max(lonL * Math.cos(center.y), latL) });
  }

  // ---- view: yaw/pitch of the earth, camera distance. Targets ease toward. ----
  // fit: the distance at which the whole Earth sits comfortably in the top two thirds (set on resize).
  let fit = 6.5;
  const view = { yaw: 0, pitch: 0.4, dist: fit };
  const goal = { ...view };
  const MIN = 1.06, max = () => fit * 1.5;
  let focused = null;
  // Rotation that brings a point to face the camera, north up.
  function faceAngles(p) {
    const yaw = Math.atan2(-p.x, p.z), r = Math.hypot(p.x, p.z);
    return { yaw, pitch: Math.atan2(p.y, r) };
  }
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  function focus(id, { zoom = 0.85 } = {}) {
    const r = regions.get(id);
    if (!r) return;
    focused = id;
    const a = faceAngles(r.center);
    goal.yaw = view.yaw + wrap(a.yaw - view.yaw);   // the short way round
    goal.pitch = a.pitch;
    if (zoom) goal.dist = Math.min(goal.dist, 1 + (fit - 1) * zoom);   // closes in, never pulls you back out
  }

  // ---- drag to turn, wheel / pinch to zoom, tap a map to pick it ----
  const pointers = new Map();
  let pinch0 = 0, dist0 = 0, moved = 0;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = goal.dist; }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      goal.dist = THREE.MathUtils.clamp(dist0 * pinch0 / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), MIN, max());
      return;
    }
    moved += Math.abs(dx) + Math.abs(dy);
    // Degrees per pixel shrink as you zoom in, so the ground under your finger keeps up.
    const k = (view.dist - 1) / canvas.clientHeight * 1.1;
    goal.yaw += dx * k; goal.pitch = THREE.MathUtils.clamp(goal.pitch + dy * k, -1.45, 1.45);
    view.yaw = goal.yaw; view.pitch = goal.pitch;
  });
  const up = (e) => {
    if (pointers.size === 1 && moved < 6) pick(e);
    pointers.delete(e.pointerId);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', (e) => pointers.delete(e.pointerId));
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    goal.dist = THREE.MathUtils.clamp(1 + (goal.dist - 1) * Math.exp(e.deltaY * 0.0015), MIN, max());
  }, { passive: false });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects([...regions.values()].map((x) => x.patch))[0];
    if (hit) onPick?.(hit.object.userData.id);
  }

  // ---- loop ----
  let running = false, last = 0;
  const lift = 1 / 6;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Earth's diameter: about 60% of the screen's height, or 90% of its width on a tall phone.
    const t = Math.tan(camera.fov * DEG / 2), was = fit;
    fit = Math.max(1 / (0.62 * t), 1 / (0.9 * t * camera.aspect));
    if (!focused) goal.dist = fit; else goal.dist *= fit / was;
    // The cards cover the bottom third, so the globe's center sits in the middle of the top two.
    camera.setViewOffset(w, h, 0, h * lift, w, h);
    camera.updateProjectionMatrix();
  }
  function frame(t) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    const ease = 1 - Math.exp(-dt * 4);
    if (!pointers.size) {
      view.yaw += (goal.yaw - view.yaw) * ease;
      view.pitch += (goal.pitch - view.pitch) * ease;
      // A slow drift while nothing is in focus.
      if (!focused) { goal.yaw += dt * 0.03; }
    }
    view.dist += (goal.dist - view.dist) * ease;
    earth.rotation.set(view.pitch, view.yaw, 0, 'XYZ');
    camera.position.set(0, 0, view.dist);
    camera.lookAt(0, 0, 0);
    // Close in, the camera's near plane follows so the ground never clips.
    camera.near = Math.max(0.002, (view.dist - 1) * 0.3); camera.updateProjectionMatrix();
    for (const [id, r] of regions) {
      const on = id === focused ? 1 : 0;
      const u = r.halo.material.uniforms;
      u.uOn.value += (on - u.uOn.value) * (1 - Math.exp(-dt * 6));
      u.uT.value = t / 1000;
      // Big enough to find from far out, hugging the border close in.
      const s = Math.max(r.size * 2.4, (view.dist - 1) * 0.06);
      r.halo.scale.setScalar(s);
      u.uFar.value = THREE.MathUtils.clamp((view.dist - 1.1) / 0.6, 0, 1);
      r.line.material.opacity = 0.6 + 0.4 * u.uOn.value;
    }
    renderer.render(scene, camera);
  }
  addEventListener('resize', resize);

  return {
    focus,
    clear() { focused = null; },
    start() { if (running) return; running = true; resize(); last = performance.now(); requestAnimationFrame(frame); },
    stop() { running = false; },
  };
}
