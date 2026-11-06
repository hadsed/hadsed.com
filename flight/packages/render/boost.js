import * as THREE from 'three';

// Engine exhaust, after the SR-71's J58s. Cruising (dry thrust): a dull warm
// glow in each nozzle and a short, barely there heat plume. Boost (afterburner):
// the plume stretches into a long translucent pencil, pale blue at the exit and
// going amber down its length, with a row of evenly spaced shock diamonds that
// dim as they go. Drawn for every jet; the BOOST flag lights the burner, so
// other people see you light it.
//
// const fx = createBoost({ scene, geo, max });
// fx.begin(time, dt, camera, heightPx); fx.feed(id, jet, q, boosting, idle); fx.end();

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
    float flick = 0.94 + 0.06 * sin(uTime * 61.0 + vSeed * 17.0) * sin(uTime * 37.0 + vSeed * 5.0);
    // Hot gas: a pale, slightly blue core at the exit that cools to a thin amber
    // haze. Kept faint and unsaturated; the diamonds carry the brightness.
    vec3 hot = vec3(0.78, 0.84, 1.0), warm = vec3(1.0, 0.62, 0.32);
    vec3 col = mix(hot, warm, smoothstep(0.05, 0.55, t));
    float a = pow(1.0 - t, 1.6) * pow(vFace, 1.8) * vPower * flick * 0.85;
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
    // Hot white-yellow core with a tight amber halo, like the real diamonds.
    float core = exp(-d2 * 26.0), halo = exp(-d2 * 7.0);
    // Dimmer means cooler: the dry nozzle and the last diamonds go orange.
    float heat = smoothstep(0.15, 0.7, vB);
    vec3 col = mix(vec3(1.0, 0.5, 0.2), vec3(1.0, 0.95, 0.82), heat) * core * 1.3 + mix(vec3(0.9, 0.3, 0.1), vec3(1.0, 0.6, 0.28), heat) * halo * 0.4;
    float a = (core + halo * 0.25) * vB;
    if (a < 0.004) discard;
    gl_FragColor = vec4(col * vB, a);
  }`;

export function createBoost({ scene, geo, max = 65 }) {
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

  const level = new Map();   // id -> { p: burner 0..1, seen }
  const m4 = new THREE.Matrix4(), at = new THREE.Vector3(), qq = new THREE.Quaternion(), sc = new THREE.Vector3();
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);   // cone +y -> jet +z (aft)
  const fwd = new THREE.Vector3(), wp = new THREE.Vector3(), cam = new THREE.Vector3();
  let now = 0, dt = 0, n = 0;

  return {
    nozzle,
    begin(time, frameDt, camera, heightPx) {
      now = time; dt = frameDt; n = 0; uTime.value = time;
      cam.copy(camera.position);
      uProj.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    },
    // idle: dry-thrust glow, 0..1 (your throttle; other jets get a steady cruise value).
    feed(id, jet, q, boosting, idle = 0.6) {
      let s = level.get(id);
      if (!s) level.set(id, (s = { p: boosting ? 1 : 0, seen: now }));
      s.seen = now;
      // The burner lights fast and dies a little slower.
      s.p += ((boosting ? 1 : 0) - s.p) * (1 - Math.exp(-dt * (boosting ? 7 : 3.5)));
      at.set(jet.pos[0], jet.pos[1], jet.pos[2]);
      if (n >= nPlume || at.distanceToSquared(cam) > 6000 * 6000) return;
      const ab = s.p, dry = 0.25 + 0.35 * idle;
      fwd.set(0, 0, -1).applyQuaternion(q);
      aft.copy(fwd).negate();
      const flick = 1 + 0.05 * Math.sin(now * 47 + n);
      for (const e of engines) {
        wp.copy(e).applyQuaternion(q).add(at);
        qq.copy(q).multiply(tilt);
        // Dry: a short stub of heat haze. Burner: the full pencil.
        const L = nozzle.len * (0.14 + 0.86 * ab) * flick, R = nozzle.r * (0.8 + 0.2 * ab);
        sc.set(R, L, R);
        m4.compose(wp, qq, sc);
        plumes.setMatrixAt(n, m4);
        power[n] = 0.75 * dry * (1 - ab) + ab;
        // Diamonds: evenly spaced about one nozzle width apart, the first just
        // outside the exit, each a little smaller and dimmer than the last. The
        // row grows out of the nozzle as the burner lights. k = 0 is the nozzle
        // itself: a dull glow when dry, white-hot on the burner.
        const base = n * perEngine, spacing = nozzle.r * 1.8;
        for (let k = 0; k <= KNOTS; k++) {
          const j = base + k;
          const d = k === 0 ? nozzle.r * 0.15 : nozzle.r * 1.3 + (k - 1) * spacing * (1 + 0.015 * Math.sin(now * 9 + k));
          kPos[j * 3] = wp.x + aft.x * d; kPos[j * 3 + 1] = wp.y + aft.y * d; kPos[j * 3 + 2] = wp.z + aft.z * d;
          if (k === 0) { kSize[j] = nozzle.r * (2.6 + 0.6 * ab); kBright[j] = 1.05 * dry * (1 - ab) + 0.85 * ab; continue; }
          const lit = Math.min(1, Math.max(0, ab * (KNOTS + 2) - k));   // light from the nozzle back
          const fall = 1 - (k - 1) / KNOTS;
          kSize[j] = nozzle.r * 2.2 * (0.6 + 0.4 * fall);
          kBright[j] = lit * (0.25 + 0.75 * Math.pow(fall, 1.2)) * (0.9 + 0.1 * Math.sin(now * 53 + k * 2.1 + n));
        }
        n++;
      }
    },
    end() {
      for (const [id, s] of level) if (now - s.seen > 2) level.delete(id);
      plumes.count = n;
      kg.setDrawRange(0, n * perEngine);
      kg.attributes.position.needsUpdate = kg.attributes.aSize.needsUpdate = kg.attributes.aBright.needsUpdate = true;
      plumes.instanceMatrix.needsUpdate = true;
      plumes.geometry.attributes.aPower.needsUpdate = true;
    },
  };
}
