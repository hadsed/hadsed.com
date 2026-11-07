import * as THREE from 'three';

// Speed cues around your own jet, drawn in its frame so they stay with you
// through turns. Three styles while Had picks one (?speed=dust|vapor|lens):
//
//   dust   sparse motes of ice and dust in the air: tiny, uneven in brightness,
//          smeared only as far as they move in one frame (a camera shutter's
//          blur). Barely there at cruise, thicker on the burner.
//   vapor  wingtip vapor on the burner: thin, ragged white wisps peeling off
//          each wingtip and thinning out behind.
//   lens   no particles: the burner's wider lens plus a soft darkening at the
//          screen edges (the vignette itself is a page overlay; see main.js).
//
// const wind = createWind({ scene, geo, style });
// wind.update(dt, jetPos, jetQ, speed, boost01, show01);

const LINE_VS = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aA;
  varying float vA;
  void main() {
    vA = aA;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }`;

const LINE_FS = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform float uAlpha;
  varying float vA;
  void main() {
    #include <logdepthbuf_fragment>
    float a = vA * uAlpha;
    gl_FragColor = vec4(vec3(0.82, 0.86, 0.92) * a, a);
  }`;

const PUFF_VS = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  uniform float uProj;
  attribute float aA, aSize, aSeed;
  varying float vA, vSeed;
  void main() {
    vA = aA; vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
    gl_PointSize = aA <= 0.0 ? 0.0 : clamp(aSize * uProj / -mv.z, 0.0, 90.0);
  }`;

const PUFF_FS = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform float uAlpha;
  varying float vA, vSeed;
  void main() {
    #include <logdepthbuf_fragment>
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    // Ragged, not round: a soft blob broken up by a cheap angular noise.
    float ang = atan(p.y, p.x);
    float edge = 0.75 + 0.25 * sin(ang * 3.0 + vSeed * 20.0) * sin(ang * 5.0 - vSeed * 13.0);
    float a = (1.0 - smoothstep(0.0, edge, length(p))) * vA * uAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vec3(0.93, 0.95, 1.0), a);
  }`;

export const SPEED_STYLES = ['dust', 'vapor', 'lens'];

export function createWind({ scene, geo, style = 'dust' }) {
  let level = 0;
  const ease = (boost, dt) => { level += (boost - level) * (1 - Math.exp(-dt * (boost > level ? 3 : 1.5))); return level; };
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  scene.add(group);
  const place = (pos, q) => { group.position.copy(pos); group.quaternion.copy(q); group.updateMatrix(); };

  if (style === 'dust') {
    const count = 110, ahead = 380, behind = 90, rMin = 9, rMax = 150;
    const pos = new Float32Array(count * 6), alpha = new Float32Array(count * 2), motes = [];
    const reseed = (i, z) => {
      const ang = Math.random() * Math.PI * 2, r = rMin + (rMax - rMin) * Math.random() ** 0.7;
      motes[i] = { x: Math.cos(ang) * r, y: Math.sin(ang) * r * 0.8 + 8, z, b: Math.random() ** 2.5 };   // mostly faint, a few bright
    };
    for (let i = 0; i < count; i++) reseed(i, -ahead + Math.random() * (ahead + behind));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aA', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const uAlpha = { value: 0 };
    const lines = new THREE.LineSegments(g, new THREE.ShaderMaterial({
      vertexShader: LINE_VS, fragmentShader: LINE_FS, uniforms: { uAlpha },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    lines.frustumCulled = false;
    group.add(lines);
    return {
      update(dt, jetPos, jetQ, speed, boost, show = 1) {
        const lv = ease(boost, dt);
        uAlpha.value = (0.12 + 0.6 * lv) * show;
        group.visible = uAlpha.value > 0.005;
        if (!group.visible) return;
        place(jetPos, jetQ);
        // Not true airspeed (Mach 3 would just blink). Each mote is smeared by
        // exactly how far it moved this frame, nothing more.
        const flow = speed * (0.22 + 0.2 * lv), smear = Math.max(0.4, flow * Math.min(dt, 1 / 30));
        const live = Math.round(count * (0.35 + 0.65 * lv));   // sparser at cruise
        for (let i = 0; i < count; i++) {
          const m = motes[i];
          m.z += flow * dt;
          if (m.z > behind) reseed(i, -ahead);
          const o = i * 6, fade = i < live ? Math.min(1, (m.z + ahead) / 80) * Math.min(1, (behind - m.z) / 30) : 0;
          pos[o] = m.x; pos[o + 1] = m.y; pos[o + 2] = m.z;
          pos[o + 3] = m.x; pos[o + 4] = m.y; pos[o + 5] = m.z - smear;
          alpha[i * 2] = alpha[i * 2 + 1] = fade * (0.25 + 0.75 * m.b);
        }
        g.attributes.position.needsUpdate = g.attributes.aA.needsUpdate = true;
      },
    };
  }

  if (style === 'vapor') {
    // Wingtips from the airframe's own bounds.
    geo.computeBoundingBox();
    const bb = geo.boundingBox, half = (bb.max.x - bb.min.x) / 2, len = bb.max.z - bb.min.z;
    const tips = [[-half * 0.96, bb.min.y + (bb.max.y - bb.min.y) * 0.3, bb.max.z - len * 0.12], [half * 0.96, bb.min.y + (bb.max.y - bb.min.y) * 0.3, bb.max.z - len * 0.12]];
    const N = 600, pos = new Float32Array(N * 3), alpha = new Float32Array(N), size = new Float32Array(N), seed = new Float32Array(N);
    const puffs = Array.from({ length: N }, () => ({ age: 9, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0 }));
    let head = 0, acc = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aA', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1).setUsage(THREE.DynamicDrawUsage));
    const uAlpha = { value: 0 }, uProj = { value: 600 };
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({
      vertexShader: PUFF_VS, fragmentShader: PUFF_FS, uniforms: { uAlpha, uProj },
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    }));
    pts.frustumCulled = false;
    group.add(pts);
    return {
      setProjection(heightPx, fovDeg) { uProj.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2)); },
      update(dt, jetPos, jetQ, speed, boost, show = 1) {
        const lv = ease(boost, dt);
        uAlpha.value = show;
        place(jetPos, jetQ);
        // Shed puffs while the burner is lit: a wisp's density follows the burner.
        acc += dt * 320 * lv;
        while (acc >= 1) {
          acc -= 1;
          for (const t of tips) {
            const p = puffs[head]; seed[head] = Math.random(); head = (head + 1) % N;
            p.age = 0; p.life = 0.25 + Math.random() * 0.3;
            p.x = t[0] + (Math.random() - 0.5) * 0.4; p.y = t[1] + (Math.random() - 0.5) * 0.4; p.z = t[2];
            p.vx = Math.sign(t[0]) * (1 + Math.random() * 3); p.vy = (Math.random() - 0.3) * 3;   // curl out and up a little
            p.b = 0.5 + 0.5 * Math.random();
          }
        }
        // The wisp hangs off the wingtip and stretches back toward the camera
        // (slower than true airspeed, so it stays in the shot instead of flicking past).
        const flow = speed * 0.03;
        for (let i = 0; i < N; i++) {
          const p = puffs[i];
          if (p.age >= p.life) { alpha[i] = 0; continue; }
          p.age += dt;
          const k = p.age / p.life;
          pos[i * 3] = p.x + p.vx * p.age; pos[i * 3 + 1] = p.y + p.vy * p.age; pos[i * 3 + 2] = p.z + flow * p.age;
          size[i] = 0.4 + 2.2 * k;                          // spreads as it thins
          alpha[i] = 0.45 * p.b * (1 - k) * Math.min(1, p.age * 30);
        }
        const a = g.attributes;
        a.position.needsUpdate = a.aA.needsUpdate = a.aSize.needsUpdate = a.aSeed.needsUpdate = true;
      },
    };
  }

  // lens: nothing in the scene; the overlay and the lens do the work.
  return { update(dt, jetPos, jetQ, speed, boost) { ease(boost, dt); }, get level() { return level; } };
}
