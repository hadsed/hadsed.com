import * as THREE from 'three';

// Crash effects, drawn for every jet from its flags, so everyone sees the same wreck:
//   SMOKE  a grey trail from the engines (a hurt jet)
//   FIRE   flames licking off the engines, on top of the smoke
//   DOWN   the jet has crashed: a fireball and a spray of debris the moment the flag
//          appears, then a burning wreck with a smoke column where it lies
// Two particle pools (additive flame, blended smoke) plus a few instanced debris chunks.
// The debris carries on with the jet's momentum and skips off the ground, like the
// BeamNG crash clips; that is what sells it, not the fireball.
//
// const fx = createWreck({ scene, height: (x, z) => groundY });
// fx.begin(time, dt, camera, heightPx); fx.feed(id, jet, q, flags); fx.end();

const FLAG_SMOKE = 4, FLAG_FIRE = 8, FLAG_DOWN = 16;

const VS = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  uniform float uProj;
  attribute float aSize, aAlpha;
  attribute vec3 aColor;
  varying float vA;
  varying vec3 vC;
  void main() {
    vA = aAlpha; vC = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
    gl_PointSize = aAlpha <= 0.0 ? 0.0 : clamp(aSize * uProj / -mv.z, 0.0, 400.0);
  }`;

const FS_GLOW = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  varying float vA;
  varying vec3 vC;
  void main() {
    #include <logdepthbuf_fragment>
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d2 = dot(p, p);
    float a = (exp(-d2 * 5.0) + exp(-d2 * 18.0)) * 0.5 * vA;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vC * a, a);
  }`;

const FS_SMOKE = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  varying float vA;
  varying vec3 vC;
  void main() {
    #include <logdepthbuf_fragment>
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d2 = dot(p, p);
    // Soft puff, a little lighter at the top as if lit from above.
    float a = smoothstep(1.0, 0.15, d2) * vA;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vC * (0.85 + 0.25 * (1.0 - gl_PointCoord.y)), a);
  }`;

function pool(n, fs, blending, scene, uProj) {
  const pos = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n), color = new Float32Array(n * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aColor', new THREE.BufferAttribute(color, 3).setUsage(THREE.DynamicDrawUsage));
  const points = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: { uProj }, transparent: true, depthWrite: false, blending }));
  points.frustumCulled = false;
  scene.add(points);
  // Per particle: velocity, age, life, size from/to, alpha peak, color from/to, drag, lift.
  const vel = new Float32Array(n * 3), age = new Float32Array(n), life = new Float32Array(n).fill(-1);
  const s0 = new Float32Array(n), s1 = new Float32Array(n), a0 = new Float32Array(n), c0 = new Float32Array(n * 3), c1 = new Float32Array(n * 3), drag = new Float32Array(n), lift = new Float32Array(n);
  let next = 0, live = 0;
  return {
    emit(x, y, z, vx, vy, vz, l, sz0, sz1, a, r0, g0, b0, r1, g1, b1, dr = 1, li = 0) {
      const i = next; next = (next + 1) % n;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
      age[i] = 0; life[i] = l; s0[i] = sz0; s1[i] = sz1; a0[i] = a;
      c0[i * 3] = r0; c0[i * 3 + 1] = g0; c0[i * 3 + 2] = b0; c1[i * 3] = r1; c1[i * 3 + 1] = g1; c1[i * 3 + 2] = b1;
      drag[i] = dr; lift[i] = li;
    },
    update(dt, height) {
      live = 0;
      for (let i = 0; i < n; i++) {
        if (life[i] < 0) { alpha[i] = 0; continue; }
        age[i] += dt;
        const t = age[i] / life[i];
        if (t >= 1) { life[i] = -1; alpha[i] = 0; continue; }
        live++;
        const k = Math.exp(-drag[i] * dt);
        vel[i * 3] *= k; vel[i * 3 + 1] = vel[i * 3 + 1] * k + lift[i] * dt; vel[i * 3 + 2] *= k;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (height) { const h = height(pos[i * 3], pos[i * 3 + 2]); if (h != null && pos[i * 3 + 1] < h + 2) { pos[i * 3 + 1] = h + 2; vel[i * 3 + 1] = Math.abs(vel[i * 3 + 1]) * 0.2; } }
        size[i] = s0[i] + (s1[i] - s0[i]) * Math.sqrt(t);
        // Quick fade in, long fade out.
        alpha[i] = a0[i] * Math.min(1, t * 12) * (1 - t) * (1 - t);
        for (let c = 0; c < 3; c++) color[i * 3 + c] = c0[i * 3 + c] + (c1[i * 3 + c] - c0[i * 3 + c]) * Math.min(1, t * 1.6);
      }
      for (const a of ['position', 'aSize', 'aAlpha', 'aColor']) g.attributes[a].needsUpdate = true;
    },
    get live() { return live; },
    sample(k) { const o = []; for (let i = 0; i < n && o.length < k; i++) if (life[i] >= 0) o.push([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], age[i]]); return o; },
  };
}

const rnd = (s) => (Math.random() * 2 - 1) * s;

export function createWreck({ scene, height }) {
  const uProj = { value: 600 };
  const glow = pool(1600, FS_GLOW, THREE.AdditiveBlending, scene, uProj);
  const smoke = pool(2600, FS_SMOKE, THREE.NormalBlending, scene, uProj);

  // Debris: chunks of black airframe, tumbling.
  const NDEB = 48;
  const deb = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.9, metalness: 0 }), NDEB);
  deb.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  deb.frustumCulled = false;
  deb.count = 0;
  scene.add(deb);
  const D = Array.from({ length: NDEB }, () => ({ life: -1, age: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), s: new THREE.Vector3(), burning: false }));
  let dNext = 0;

  const state = new Map();   // id -> { down, seen, x, y, z } (last position, to fill trails between frames)
  const fwd = new THREE.Vector3(), aft = new THREE.Vector3(), cam = new THREE.Vector3(), m4 = new THREE.Matrix4(), dq = new THREE.Quaternion(), ax = new THREE.Vector3();
  let now = 0, dt = 0;

  function burst(x, y, z, vx, vy, vz) {
    // Fireball: white-hot core going orange then deep red, carried a little way on.
    for (let i = 0; i < 140; i++) {
      const s = 30 + Math.random() * 70;
      glow.emit(x + rnd(8), y + rnd(8), z + rnd(8), vx * 0.12 + rnd(s), vy * 0.05 + Math.random() * s, vz * 0.12 + rnd(s),
        0.5 + Math.random() * 1.2, 10 + Math.random() * 10, 45 + Math.random() * 55, 1.4, 1, 0.9, 0.6, 0.9, 0.25, 0.05, 1.6, 6);
    }
    // Black smoke rolling up out of it.
    for (let i = 0; i < 160; i++) {
      const s = 20 + Math.random() * 45;
      const g = 0.06 + Math.random() * 0.08;
      smoke.emit(x + rnd(12), y + rnd(6), z + rnd(12), vx * 0.08 + rnd(s), Math.random() * s + 10, vz * 0.08 + rnd(s),
        4 + Math.random() * 6, 18 + Math.random() * 15, 90 + Math.random() * 90, 0.75, g, g, g, g * 2.2, g * 2.2, g * 2.4, 0.9, 9);
    }
    // Debris keeps most of the jet's momentum along the ground, kicked up and out.
    for (let i = 0; i < 26; i++) {
      const d = D[dNext]; dNext = (dNext + 1) % NDEB;
      d.life = 5 + Math.random() * 4; d.age = 0; d.burning = Math.random() < 0.45;
      d.p.set(x, y + 3, z);
      d.v.set(vx * (0.25 + Math.random() * 0.45) + rnd(90), Math.abs(vy) * 0.1 + 30 + Math.random() * 110, vz * (0.25 + Math.random() * 0.45) + rnd(90));
      d.q.set(Math.random(), Math.random(), Math.random(), Math.random()).normalize();
      d.w.set(rnd(9), rnd(9), rnd(9));
      const big = Math.random() < 0.2 ? 2.5 : 1;
      d.s.set((0.8 + Math.random() * 2.5) * big, (0.2 + Math.random() * 0.5) * big, (0.8 + Math.random() * 3.5) * big);
    }
  }

  // vx..vz: the jet's velocity. Puffs leave at most of it and fall back, so the trail streams off
  // the engines where the chase cam can see it (at Mach 3, smoke left standing in the air is
  // behind the camera within a frame) and still draws a line across the sky for everyone else.
  function trail(x, y, z, px, py, pz, fire, vx, vy, vz, keep = 0.9, drag = 1.2, alpha = 0.5) {
    // Fill the gap since last frame so a Mach 3 trail doesn't come out dotted.
    const gap = Math.hypot(x - px, y - py, z - pz);
    const n = Math.min(24, Math.max(1, Math.round(gap / 14)));
    for (let i = 0; i < n; i++) {
      // t = 0 is where the engines are now, 1 where they were last frame. Each puff has been out for
      // t of the frame; this frame's update is about to move it a whole frame, so start it back by the rest.
      const t = i / n, back = -(1 - t) * dt;
      const sx = x + (px - x) * t, sy = y + (py - y) * t, sz = z + (pz - z) * t;
      const ox = vx * keep * back, oy = vy * keep * back, oz = vz * keep * back, fx_ = vx * 0.96 * back, fy_ = vy * 0.96 * back, fz_ = vz * 0.96 * back;
      const g = 0.18 + Math.random() * 0.1;
      if (Math.random() < 0.7) smoke.emit(sx + ox + rnd(2), sy + oy + rnd(2), sz + oz + rnd(2), vx * keep + rnd(3), vy * keep + 2 + rnd(2), vz * keep + rnd(3), 2.5 + Math.random() * 2.5, 4, 26 + Math.random() * 16, alpha, g, g, g, g * 1.8, g * 1.8, g * 1.9, drag, 1.5);
      if (fire && Math.random() < 0.7) glow.emit(sx + fx_ + rnd(1.5), sy + fy_ + rnd(1.5), sz + fz_ + rnd(1.5), vx * 0.96 + rnd(4), vy * 0.96 + rnd(4), vz * 0.96 + rnd(4), 0.3 + Math.random() * 0.35, 4, 10, 1.3, 1, 0.75, 0.3, 0.9, 0.2, 0.05, 0.3, 0);
    }
  }

  return {
    smoke, glow,
    burst,
    begin(time, frameDt, camera, heightPx) {
      now = time; dt = frameDt;
      cam.copy(camera.position);
      uProj.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    },
    feed(id, jet, q, flags) {
      const p = jet.pos;
      let s = state.get(id);
      const down = (flags & FLAG_DOWN) !== 0;
      if (!s) state.set(id, (s = { down, seen: now, x: p[0], y: p[1], z: p[2], last: 0 }));
      s.seen = now;
      const near = Math.hypot(p[0] - cam.x, p[1] - cam.y, p[2] - cam.z) < 40000;
      if (down && !s.down && near) {
        fwd.set(0, 0, -1).applyQuaternion(q).multiplyScalar(jet.speed || 0);
        burst(p[0], p[1], p[2], fwd.x, fwd.y, fwd.z);
      }
      s.down = down;
      if (near && down) {
        // The wreck burns: a few flames at the base, a column of smoke leaning off it.
        const n = dt * 26;
        for (let i = 0; i < n || Math.random() < n - i; i++) {
          const g = 0.07 + Math.random() * 0.06;
          smoke.emit(p[0] + rnd(10), p[1] + 4, p[2] + rnd(10), 6 + rnd(4), 18 + Math.random() * 10, 3 + rnd(4), 7 + Math.random() * 5, 20, 110 + Math.random() * 60, 0.6, g, g, g, g * 2.3, g * 2.3, g * 2.4, 0.15, 0.5);
          if (Math.random() < 0.8) glow.emit(p[0] + rnd(12), p[1] + 3, p[2] + rnd(12), rnd(3), 8 + Math.random() * 10, rnd(3), 0.5 + Math.random() * 0.6, 7, 16, 1.1, 1, 0.7, 0.25, 0.9, 0.2, 0.04, 1, 4);
        }
      } else if (near && flags & (FLAG_SMOKE | FLAG_FIRE)) {
        fwd.set(0, 0, -1).applyQuaternion(q);
        aft.set(p[0], p[1], p[2]).addScaledVector(fwd, -18);
        const v = jet.speed || 0;
        // Your own smoke hangs with you a moment longer, so the chase cam sees it pour off the
        // engines; everyone else's is left behind as a line across the sky.
        const mine = id === 'self';
        trail(aft.x, aft.y, aft.z, s.x, s.y, s.z, (flags & FLAG_FIRE) !== 0, fwd.x * v, fwd.y * v, fwd.z * v, mine ? 0.985 : 0.9, mine ? 0.08 : 1.2, mine ? 0.28 : 0.5);
        s.x = aft.x; s.y = aft.y; s.z = aft.z;
        return;
      }
      s.x = p[0]; s.y = p[1]; s.z = p[2];
    },
    end() {
      for (const [id, s] of state) if (now - s.seen > 3) state.delete(id);
      glow.update(dt, height); smoke.update(dt, height);
      let n = 0;
      for (const d of D) {
        if (d.life < 0) continue;
        d.age += dt;
        if (d.age >= d.life) { d.life = -1; continue; }
        const k = Math.exp(-0.9 * dt);
        d.v.x *= k; d.v.z *= k; d.v.y = d.v.y * k - 9.8 * dt;
        d.p.addScaledVector(d.v, dt);
        const h = height?.(d.p.x, d.p.z);
        if (h != null && d.p.y < h + d.s.y) {
          d.p.y = h + d.s.y;
          // Skip off the ground, losing most of the bounce each time.
          if (d.v.y < -4) { d.v.y = -d.v.y * 0.3; d.v.x *= 0.6; d.v.z *= 0.6; d.w.multiplyScalar(0.6); }
          else { d.v.y = 0; d.v.x *= 0.9; d.v.z *= 0.9; d.w.multiplyScalar(0.9); }
        }
        const sp = d.w.length();
        if (sp > 1e-3) d.q.premultiply(dq.setFromAxisAngle(ax.copy(d.w).divideScalar(sp), sp * dt));
        if (d.burning && d.age < d.life * 0.7 && Math.random() < dt * 30) {
          const g = 0.1;
          smoke.emit(d.p.x, d.p.y, d.p.z, rnd(2), 4, rnd(2), 2 + Math.random() * 2, 4, 22, 0.5, g, g, g, g * 2, g * 2, g * 2, 0.5, 3);
          glow.emit(d.p.x, d.p.y, d.p.z, 0, 2, 0, 0.3, 3, 6, 1, 1, 0.7, 0.3, 0.9, 0.2, 0.05, 1, 0);
        }
        m4.compose(d.p, d.q, d.s);
        deb.setMatrixAt(n++, m4);
      }
      deb.count = n;
      deb.instanceMatrix.needsUpdate = true;
    },
  };
}
