// The map picker's globe: NASA Blue Marble Earth you can drag and zoom, each map's terrain laid
// on it inside a gold border, and that border glowing for the one in focus. focus(id) flies there.
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

  // Everything the first frame needs; loaded resolves once the Earth and the maps are in.
  const manager = new THREE.LoadingManager();
  const loaded = new Promise((done) => { manager.onLoad = done; manager.onError = done; });
  const tex = new THREE.TextureLoader(manager).load('/lab/menu/earth.jpg');
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  // Close in, the Earth around the map dims, so the map's own terrain carries the view (the
  // 4k Earth is soft at that range).
  const earthMat = new THREE.MeshLambertMaterial({ map: tex });
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), earthMat));

  // Thin atmosphere at the limb, the color of the game's horizon.
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(1.035, 96, 48), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 n; varying vec3 v; void main(){ vec4 p = modelViewMatrix * vec4(position,1.); n = normalize(normalMatrix*normal); v = normalize(-p.xyz); gl_Position = projectionMatrix*p; }',
    fragmentShader: 'varying vec3 n; varying vec3 v; void main(){ float f = pow(clamp(1. + dot(n, v) * 1.0, 0., 1.), 4.); gl_FragColor = vec4(vec3(0.45,0.62,0.95) * f * 1.4, f); }',
  })));

  // Each map: its terrain on a patch of sphere, inside a gold border that is the map's own edge.
  // In focus, that border glows: the halo is the border, its glow sized to the map.
  const loader = new THREE.TextureLoader(manager);
  const regions = new Map();
  const borderMat = () => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uOn: { value: 0 }, uT: { value: 0 }, uColor: { value: GOLD } },
    vertexShader: 'attribute float across; varying float a; void main(){ a = across; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    // a: 0 on the map's edge, +1 at the glow's outer reach, -1 at its inner reach. The edge stays
    // at least a pixel wide however far out you are; the glow breathes slowly when in focus.
    fragmentShader: `uniform float uOn, uT; uniform vec3 uColor; varying float a;
      void main(){
        float d = abs(a);
        float core = 1. - smoothstep(0., max(.05, fwidth(a) * 1.3), d);
        float glow = exp(-d * (a > 0. ? 3. : 5.)) * uOn * (.8 + .2 * sin(uT * 2.2));
        gl_FragColor = vec4(uColor, min(1., core * (.65 + .35 * uOn) + glow * .75)); }`,
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

    // Border ribbon: three rectangles sampled point for point (inner, edge, outer), joined as a
    // strip, so the corners miter. The glow reaches out 22% of the map's short side, in 8%.
    const midLat = (b.n + b.s) / 2, k = 1 / Math.cos(midLat * DEG);
    const reach = 0.22 * Math.min(b.n - b.s, (b.e - b.w) / k);
    const rect = (o) => {
      const w = b.w - o * k, e = b.e + o * k, n = b.n + o, so = b.s - o, pts = [], N = 24;
      for (let i = 0; i < N; i++) pts.push([n, w + (e - w) * i / N]);
      for (let i = 0; i < N; i++) pts.push([n - (n - so) * i / N, e]);
      for (let i = 0; i < N; i++) pts.push([so, e - (e - w) * i / N]);
      for (let i = 0; i < N; i++) pts.push([so + (n - so) * i / N, w]);
      return pts;
    };
    const rings = [[rect(-reach * 0.35), -1], [rect(0), 0], [rect(reach), 1]];
    const P = rings[0][0].length, pos = [], across = [], idx = [];
    for (const [pts, av] of rings) for (const [lat, lon] of pts) { pos.push(...ll(lat, lon, 1.0015).toArray()); across.push(av); }
    for (let r = 0; r < 2; r++) for (let i = 0; i < P; i++) {
      const j = (i + 1) % P, a0 = r * P + i, a1 = r * P + j, b0 = (r + 1) * P + i, b1 = (r + 1) * P + j;
      idx.push(a0, b0, a1, a1, b0, b1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('across', new THREE.Float32BufferAttribute(across, 1));
    geo.setIndex(idx);
    const border = new THREE.Mesh(geo, borderMat());
    border.renderOrder = 2;
    g.add(border);
    earth.add(g);
    const center = ll(midLat, (b.e + b.w) / 2);
    regions.set(m.id, { center, border, patch, size: Math.max(lonL * Math.cos(midLat * DEG), latL) });
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
  // Focus zooms right into the map: close enough that it fills about 40% of the screen's height.
  // On a long move the camera rises with the distance still to turn, so it flies out and back in.
  let auto = null;   // the camera distance focus is steering for; null once you zoom by hand
  let rate = 4;      // how quickly the view eases toward its goal, per second; slower on the intro
  function focus(id) {
    const r = regions.get(id);
    if (!r) return;
    focused = id;
    rate = 4;
    const a = faceAngles(r.center);
    goal.yaw = view.yaw + wrap(a.yaw - view.yaw);   // the short way round
    goal.pitch = a.pitch;
    auto = 1 + r.size / (0.4 * 2 * Math.tan(camera.fov * DEG / 2));
  }

  // The way in from the menu: start just above a map, looking straight down at it (where the
  // backdrop jet was), and pull slowly back out to the whole Earth. The map stays lit.
  function intro(id) {
    const r = regions.get(id);
    if (!r) return;
    focused = id; auto = null; rate = 0.9;
    const a = faceAngles(r.center);
    view.yaw = goal.yaw = a.yaw; view.pitch = goal.pitch = a.pitch;
    view.dist = 1.02; goal.dist = fit;
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
      auto = null; rate = 4;
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
    auto = null; rate = 4;
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
    const ease = 1 - Math.exp(-dt * rate);
    if (!pointers.size) {
      view.yaw += (goal.yaw - view.yaw) * ease;
      view.pitch += (goal.pitch - view.pitch) * ease;
      // A slow drift while nothing is in focus.
      if (!focused) { goal.yaw += dt * 0.03; }
    }
    if (auto != null) {
      const left = Math.hypot(goal.yaw - view.yaw, goal.pitch - view.pitch);
      goal.dist = auto + (fit - auto) * THREE.MathUtils.smoothstep(left, 0.05, 1.2);
    }
    view.dist += (goal.dist - view.dist) * ease;
    earthMat.color.setScalar(THREE.MathUtils.lerp(0.45, 1, THREE.MathUtils.smoothstep(view.dist, 1.15, 1.8)));
    earth.rotation.set(view.pitch, view.yaw, 0, 'XYZ');
    camera.position.set(0, 0, view.dist);
    camera.lookAt(0, 0, 0);
    // Close in, the camera's near plane follows so the ground never clips.
    camera.near = Math.max(0.002, (view.dist - 1) * 0.3); camera.updateProjectionMatrix();
    for (const [id, r] of regions) {
      const u = r.border.material.uniforms;
      u.uOn.value += ((id === focused ? 1 : 0) - u.uOn.value) * (1 - Math.exp(-dt * 6));
      u.uT.value = t / 1000;
    }
    renderer.render(scene, camera);
  }
  addEventListener('resize', resize);

  return {
    focus,
    intro,
    loaded,
    clear() { focused = null; auto = null; },
    start() { if (running) return; running = true; resize(); goal.dist = auto ?? fit; last = performance.now(); requestAnimationFrame(frame); },
    stop() { running = false; },
  };
}
