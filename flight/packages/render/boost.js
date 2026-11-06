import * as THREE from 'three';

// Boost exhaust, after the SR-71 at full afterburner: a narrow, faint violet-
// blue pencil from each J58, a white-hot nozzle, and a long row of evenly
// spaced shock diamonds that dim as they go. Our own touch on top: a wake of
// gold sparks that twinkle and fade. Drawn for every jet whose BOOST flag is
// set, so other people see you light it.
//
// const fx = createBoost({ scene, geo, gold, max });
// fx.begin(time, dt, camera, heightPx); fx.feed(id, jet, q, boosting); fx.end();

const PLUME_VS = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aPower;
  attribute float aSeed;
  varying float vT, vPower, vSeed, vFace;
  void main() {
    // Cone from the nozzle (y = 0) back to the tip (y = 1), radius 1 at the nozzle.
    vT = position.y;
    vPower = aPower; vSeed = aSeed;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    vFace = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }`;

const PLUME_FS = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform float uTime;
  varying float vT, vPower, vSeed, vFace;
  void main() {
    #include <logdepthbuf_fragment>
    float t = vT;
    float flick = 0.88 + 0.12 * sin(uTime * 61.0 + vSeed * 17.0) * sin(uTime * 37.0 + vSeed * 5.0);
    // The gas between the diamonds: faint, violet-blue, fading down its length.
    vec3 col = mix(vec3(0.5, 0.65, 1.0), vec3(0.45, 0.35, 1.0), smoothstep(0.0, 0.6, t));
    float a = pow(1.0 - t, 1.2) * pow(vFace, 1.2) * vPower * flick * 1.3;
    gl_FragColor = vec4(col * a, a);
  }`;

// Shock diamonds and the nozzle glow: round, hot cores with a soft halo,
// sized in meters so they shrink with distance like the plume does.
const KNOT_VS = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  uniform float uProj;
  attribute float aSize, aBright;
  varying float vB;
  void main() {
    vB = aBright;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
    gl_PointSize = aBright <= 0.0 ? 0.0 : clamp(aSize * uProj / -mv.z, 0.0, 160.0);
  }`;

const KNOT_FS = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  varying float vB;
  void main() {
    #include <logdepthbuf_fragment>
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d2 = dot(p, p);
    float core = exp(-d2 * 18.0), halo = exp(-d2 * 4.0);
    // White-hot center, warm cream body, a cool blue rim.
    vec3 col = vec3(1.0, 0.97, 0.9) * core * 1.6 + mix(vec3(0.45, 0.6, 1.0), vec3(1.0, 0.88, 0.7), core) * halo * 0.55;
    float a = (core + halo * 0.35) * vB;
    if (a < 0.004) discard;
    gl_FragColor = vec4(col * vB, a);
  }`;

const SPARK_VS = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  uniform float uTime, uScale;
  attribute float aBirth, aLife, aSeed;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vA;
  void main() {
    float age = (uTime - aBirth) / aLife;
    vA = age < 0.0 || age > 1.0 ? 0.0 : (1.0 - age);
    // Twinkle: each spark flashes on its own beat.
    float tw = pow(0.5 + 0.5 * sin(uTime * (18.0 + aSeed * 22.0) + aSeed * 40.0), 3.0);
    vA *= 0.35 + 0.65 * tw;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
    gl_PointSize = vA <= 0.0 ? 0.0 : clamp(uScale * (0.6 + 1.4 * tw) * (1.0 - 0.5 * age) / -mv.z, 1.0, 28.0);
  }`;

const SPARK_FS = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  varying vec3 vColor;
  varying float vA;
  void main() {
    #include <logdepthbuf_fragment>
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    // A four-point glint: a soft dot plus a thin cross.
    float d = length(p);
    float dot_ = exp(-d * d * 6.0);
    float cross_ = exp(-abs(p.x) * 14.0) * exp(-abs(p.y) * 2.5) + exp(-abs(p.y) * 14.0) * exp(-abs(p.x) * 2.5);
    float a = (1.3 * dot_ + 0.8 * cross_) * vA;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * a, a);
  }`;

export function createBoost({ scene, geo, gold, max = 65, sparks = 2400 }) {
  // Engine exits, from the jet's own bounding box: the two nacelles sit
  // about half way out each wing, at the very back of the airframe.
  geo.computeBoundingBox();
  const bb = geo.boundingBox, len = bb.max.z - bb.min.z, half = (bb.max.x - bb.min.x) / 2;
  const nozzle = { x: half * 0.5, y: bb.min.y + (bb.max.y - bb.min.y) * 0.32, z: bb.max.z - len * 0.06, r: len * 0.032, len: len * 1.0 };
  const engines = [new THREE.Vector3(-nozzle.x, nozzle.y, nozzle.z), new THREE.Vector3(nozzle.x, nozzle.y, nozzle.z)];

  // ---- plumes: one instanced cone per engine per jet ----
  const cone = new THREE.CylinderGeometry(0.45, 1, 1, 16, 8, true);
  cone.translate(0, 0.5, 0);   // nozzle at y = 0, tip at y = 1
  const nPlume = max * 2;
  const power = new Float32Array(nPlume), seed = new Float32Array(nPlume);
  for (let i = 0; i < nPlume; i++) seed[i] = Math.random();
  cone.setAttribute('aPower', new THREE.InstancedBufferAttribute(power, 1).setUsage(THREE.DynamicDrawUsage));
  cone.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
  const uTime = { value: 0 };
  const plumes = new THREE.InstancedMesh(cone, new THREE.ShaderMaterial({
    vertexShader: PLUME_VS, fragmentShader: PLUME_FS, uniforms: { uTime },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }), nPlume);
  plumes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  plumes.frustumCulled = false;
  plumes.count = 0;
  scene.add(plumes);

  // ---- shock diamonds: a row of points down each plume, plus the nozzle glow ----
  const KNOTS = 10, perEngine = KNOTS + 1, nKnot = nPlume * perEngine;
  const kPos = new Float32Array(nKnot * 3), kSize = new Float32Array(nKnot), kBright = new Float32Array(nKnot);
  const kg = new THREE.BufferGeometry();
  kg.setAttribute('position', new THREE.BufferAttribute(kPos, 3).setUsage(THREE.DynamicDrawUsage));
  kg.setAttribute('aSize', new THREE.BufferAttribute(kSize, 1).setUsage(THREE.DynamicDrawUsage));
  kg.setAttribute('aBright', new THREE.BufferAttribute(kBright, 1).setUsage(THREE.DynamicDrawUsage));
  const uProj = { value: 600 };
  const knots = new THREE.Points(kg, new THREE.ShaderMaterial({
    vertexShader: KNOT_VS, fragmentShader: KNOT_FS, uniforms: { uProj },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  knots.frustumCulled = false;
  scene.add(knots);
  const aft = new THREE.Vector3();

  // ---- sparks: a ring buffer of points left behind in the world ----
  // Each spark rides with its jet: position = jet now + offset at birth + drift * age.
  // (Integrating world velocities drifts against the sim and lets sparks run ahead.)
  const sPos = new Float32Array(sparks * 3), sOff = new Float32Array(sparks * 3), sVel = new Float32Array(sparks * 3), sOwner = new Uint16Array(sparks);
  const ownerPos = new Float32Array(max * 3), freeSlots = Array.from({ length: max }, (_, i) => max - 1 - i);
  const sBirth = new Float32Array(sparks).fill(-1e9), sLife = new Float32Array(sparks).fill(1), sSeed = new Float32Array(sparks), sCol = new Float32Array(sparks * 3);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage));
  sg.setAttribute('aBirth', new THREE.BufferAttribute(sBirth, 1).setUsage(THREE.DynamicDrawUsage));
  sg.setAttribute('aLife', new THREE.BufferAttribute(sLife, 1).setUsage(THREE.DynamicDrawUsage));
  sg.setAttribute('aSeed', new THREE.BufferAttribute(sSeed, 1).setUsage(THREE.DynamicDrawUsage));
  sg.setAttribute('aColor', new THREE.BufferAttribute(sCol, 3).setUsage(THREE.DynamicDrawUsage));
  const uScale = { value: 3000 };
  const points = new THREE.Points(sg, new THREE.ShaderMaterial({
    vertexShader: SPARK_VS, fragmentShader: SPARK_FS, uniforms: { uTime, uScale },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  points.frustumCulled = false;
  scene.add(points);
  const white = new THREE.Color(0xdfeaff), ice = new THREE.Color(0x7fb2ff);

  const level = new Map();   // id -> { p: 0..1 ramp, seen }
  const m4 = new THREE.Matrix4(), at = new THREE.Vector3(), qq = new THREE.Quaternion(), sc = new THREE.Vector3();
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);   // cone +y -> jet +z (aft)
  const fwd = new THREE.Vector3(), wp = new THREE.Vector3(), cam = new THREE.Vector3();
  let now = 0, dt = 0, n = 0, head = 0, anySpawn = false;

  return {
    nozzle,
    begin(time, frameDt, camera, heightPx) {
      now = time; dt = frameDt; n = 0; anySpawn = false; uTime.value = time;
      cam.copy(camera.position);
      uProj.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    },
    feed(id, jet, q, boosting) {
      let s = level.get(id);
      if (!s) { if (!boosting) return; if (!freeSlots.length) return; level.set(id, (s = { p: 0, seen: now, slot: freeSlots.pop() })); }
      s.seen = now;
      // Light fast, die a little slower.
      s.p += ((boosting ? 1 : 0) - s.p) * (1 - Math.exp(-dt * (boosting ? 9 : 4)));
      if (s.p < 0.02 && !boosting) return;
      at.set(jet.pos[0], jet.pos[1], jet.pos[2]);
      at.toArray(ownerPos, s.slot * 3);
      const far = at.distanceToSquared(cam) > 6000 * 6000;
      if (far || n >= nPlume) return;
      fwd.set(0, 0, -1).applyQuaternion(q);
      const flick = 1 + 0.08 * Math.sin(now * 47 + n);
      for (const e of engines) {
        wp.copy(e).applyQuaternion(q).add(at);
        qq.copy(q).multiply(tilt);
        sc.set(nozzle.r * (0.8 + 0.2 * s.p), nozzle.len * s.p * flick, nozzle.r * (0.8 + 0.2 * s.p));
        m4.compose(wp, qq, sc);
        plumes.setMatrixAt(n, m4);
        power[n] = s.p;
        // Diamonds: evenly spaced about one nozzle width apart, the first one
        // just outside the exit, each a little smaller and dimmer than the last.
        // The row grows out of the nozzle as the burner lights.
        aft.copy(fwd).negate();
        const base = n * perEngine, spacing = nozzle.r * 1.8;
        for (let k = 0; k <= KNOTS; k++) {
          const j = base + k;
          const d = k === 0 ? nozzle.r * 0.2 : nozzle.r * 1.3 + (k - 1) * spacing * (1 + 0.02 * Math.sin(now * 9 + k));
          const lit = Math.min(1, Math.max(0, s.p * (KNOTS + 2) - k));   // light from the nozzle back
          kPos[j * 3] = wp.x + aft.x * d; kPos[j * 3 + 1] = wp.y + aft.y * d; kPos[j * 3 + 2] = wp.z + aft.z * d;
          if (k === 0) { kSize[j] = nozzle.r * 3.4; kBright[j] = 0.9 * s.p; continue; }
          const fall = 1 - (k - 1) / KNOTS;
          kSize[j] = nozzle.r * (3.0 * (0.6 + 0.4 * fall));
          kBright[j] = lit * (0.35 + 0.65 * Math.pow(fall, 0.8)) * (0.85 + 0.15 * Math.sin(now * 53 + k * 2.1 + n));
        }
        n++;
        // Sparks: shed from the nozzle, nearly keeping pace, so they stream
        // back a hundred meters or so and wink out.
        if (!boosting) continue;
        const count = Math.random() < 0.6 * s.p ? 1 : 0;   // a light sprinkle; the diamonds lead
        for (let k = 0; k < count; k++) {
          const i = head; head = (head + 1) % sparks; anySpawn = true;
          const back = Math.random() * nozzle.len * 0.4;
          sOwner[i] = s.slot;
          sOff[i * 3] = wp.x - at.x - fwd.x * back + (Math.random() - 0.5) * nozzle.r * 2;
          sOff[i * 3 + 1] = wp.y - at.y - fwd.y * back + (Math.random() - 0.5) * nozzle.r * 2;
          sOff[i * 3 + 2] = wp.z - at.z - fwd.z * back + (Math.random() - 0.5) * nozzle.r * 2;
          // Drift back slowly from the nozzle, fanning out a little.
          const keep = -(10 + Math.random() * 45), spread = 10;
          sVel[i * 3] = fwd.x * keep + (Math.random() - 0.5) * spread;
          sVel[i * 3 + 1] = fwd.y * keep + (Math.random() - 0.5) * spread;
          sVel[i * 3 + 2] = fwd.z * keep + (Math.random() - 0.5) * spread;
          sBirth[i] = now; sLife[i] = 0.3 + Math.random() * 0.6; sSeed[i] = Math.random();
          const r = Math.random();
          (r < 0.8 ? gold : white).toArray(sCol, i * 3);
        }
      }
    },
    end() {
      for (const [id, s] of level) if (now - s.seen > 2) { freeSlots.push(s.slot); level.delete(id); }
      plumes.count = n;
      kg.setDrawRange(0, n * perEngine);
      kg.attributes.position.needsUpdate = kg.attributes.aSize.needsUpdate = kg.attributes.aBright.needsUpdate = true;
      plumes.instanceMatrix.needsUpdate = true;
      plumes.geometry.attributes.aPower.needsUpdate = true;
      // Move live sparks (a couple thousand at most, cheap on the CPU).
      for (let i = 0; i < sparks; i++) {
        if (now - sBirth[i] > sLife[i]) continue;
        const age = now - sBirth[i], o = sOwner[i] * 3;
        for (let k = 0; k < 3; k++) sPos[i * 3 + k] = ownerPos[o + k] + sOff[i * 3 + k] + sVel[i * 3 + k] * age;
      }
      const a = sg.attributes;
      a.position.needsUpdate = true;
      if (anySpawn) { a.aBirth.needsUpdate = a.aLife.needsUpdate = a.aSeed.needsUpdate = a.aColor.needsUpdate = true; }
    },
  };
}
