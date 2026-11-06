import * as THREE from 'three';

// Air rushing past: thin streaks in a tube around your jet that flow back past
// the camera. Barely there at cruise, they thicken and lengthen on boost, so
// speed reads even with nothing on the ground to measure it against.
// Drawn in the jet's frame, so they stay with you through turns.
//
// const wind = createWind({ scene });
// wind.update(dt, jetPos, jetQ, speed, boost01, show01);

const VS = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aA;
  varying float vA;
  void main() {
    vA = aA;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }`;

const FS = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform float uAlpha;
  varying float vA;
  void main() {
    #include <logdepthbuf_fragment>
    float a = vA * uAlpha;
    gl_FragColor = vec4(vec3(0.92, 0.9, 0.84) * a, a);
  }`;

export function createWind({ scene, count = 140, ahead = 320, behind = 90, rMin = 14, rMax = 70 }) {
  const pos = new Float32Array(count * 6), alpha = new Float32Array(count * 2);
  const seeds = [];
  const reseed = (i, z) => {
    const ang = Math.random() * Math.PI * 2, r = rMin + (rMax - rMin) * Math.sqrt(Math.random());
    // A little more air above and to the sides than below: the camera sits high.
    seeds[i] = { x: Math.cos(ang) * r, y: Math.sin(ang) * r * 0.8 + 10, z, w: 0.4 + 0.6 * Math.random() };
  };
  for (let i = 0; i < count; i++) reseed(i, -ahead + Math.random() * (ahead + behind));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aA', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const uAlpha = { value: 0 };
  const lines = new THREE.LineSegments(geo, new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, uniforms: { uAlpha },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  lines.frustumCulled = false;
  lines.matrixAutoUpdate = false;
  scene.add(lines);
  let level = 0;

  return {
    update(dt, jetPos, jetQ, speed, boost, show = 1) {
      level += (boost - level) * (1 - Math.exp(-dt * (boost > level ? 3 : 1.5)));
      uAlpha.value = (0.1 + 0.55 * level) * show;
      lines.visible = uAlpha.value > 0.005;
      if (!lines.visible) return;
      lines.position.copy(jetPos); lines.quaternion.copy(jetQ); lines.updateMatrix();
      // Not true airspeed (Mach 3 would just blink); fast enough to feel it.
      const flow = speed * (0.18 + 0.22 * level), len = 3 + 38 * level;
      for (let i = 0; i < count; i++) {
        const s = seeds[i];
        s.z += flow * dt * (0.8 + 0.4 * s.w);
        if (s.z > behind) reseed(i, -ahead);
        const o = i * 6, fade = Math.min(1, (s.z + ahead) / 60) * Math.min(1, (behind - s.z) / 30);
        pos[o] = s.x; pos[o + 1] = s.y; pos[o + 2] = s.z;
        pos[o + 3] = s.x; pos[o + 4] = s.y; pos[o + 5] = s.z - len * s.w;
        alpha[i * 2] = fade * s.w; alpha[i * 2 + 1] = 0;
      }
      geo.attributes.position.needsUpdate = geo.attributes.aA.needsUpdate = true;
    },
  };
}
