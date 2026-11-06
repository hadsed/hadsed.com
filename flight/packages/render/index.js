// Renderer: reads jet states and draws them. Never changes game state.
//
// const r = createRenderer({ canvas, manifest });
// await r.setWorld(manifest.worlds[0]);
// r.draw({ self, remotes, time, dt });   // self: jet view; remotes: [{ id, view, callsign }]
import * as THREE from 'three';
import { jetGeometry, loadHeightmap } from '../assets/index.js';
import { createContrails } from './contrails.js';

const MAX_GHOSTS = 64;

export function createRenderer({ canvas, manifest, labels }) {
  const pal = manifest.palette;
  const sky = new THREE.Color(pal.sky), gold = new THREE.Color(pal.gold);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(sky);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 2, 2.0e6);
  scene.add(new THREE.HemisphereLight(0x8a9bbd, 0x1c2433, 1.2));
  const sun = new THREE.DirectionalLight(0xfff2d6, 2.4);
  sun.position.set(0.4, 1, 0.3);
  scene.add(sun);

  // ---- terrain: one grid that follows the camera, heights from the world's map ----
  const terrainU = {
    uHeight: { value: null }, uWidth: { value: 250000 }, uMaxH: { value: 4300 }, uExag: { value: 1.5 },
    uShift: { value: new THREE.Vector2() }, uCam: { value: new THREE.Vector3() },
    uSky: { value: sky }, uInk: { value: new THREE.Color(pal.ink) }, uGold: { value: gold }, uNavy: { value: new THREE.Color(pal.navy) },
  };
  const terrain = new THREE.Mesh(
    new THREE.PlaneGeometry(700000, 700000, 400, 400).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: terrainU,
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        uniform sampler2D uHeight; uniform float uWidth, uExag; uniform vec2 uShift;
        varying vec3 vWorld;
        void main() {
          vec3 p = position + vec3(uShift.x, 0.0, uShift.y);
          float h = texture2D(uHeight, p.xz / uWidth + 0.5).r;
          p.y = max(h, 0.0) * uExag;
          vWorld = p;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uSky, uInk, uGold, uNavy, uCam; uniform float uMaxH, uExag;
        varying vec3 vWorld;
        float line(float v, float period) {
          float x = v / period;
          float w = fwidth(x);
          return 1.0 - smoothstep(0.0, w * 1.4, abs(fract(x - 0.5) - 0.5));
        }
        void main() {
          #include <logdepthbuf_fragment>
          float h = vWorld.y / (uMaxH * uExag);
          float grid = max(line(vWorld.x, 2500.0), line(vWorld.z, 2500.0));
          float contour = line(vWorld.y, 450.0);
          vec3 c = mix(uNavy * 0.55, uNavy * 1.15, h);
          c = mix(c, uInk, grid * 0.8);
          c = mix(c, uGold, contour * (0.25 + 0.6 * h));
          float d = length(vWorld - uCam);
          float fog = 1.0 - exp(-d / 160000.0);
          gl_FragColor = vec4(mix(c, uSky, fog * fog), 1.0);
        }`,
    }),
  );
  terrain.frustumCulled = false;
  terrain.visible = false;
  scene.add(terrain);

  // ---- jets ----
  const geo = jetGeometry(manifest.jet);
  // Every jet looks the same, yours and everyone else's. A packed jet brings its paint
  // (geo.userData.map: markings, insignia, panel lines); the procedural one is plain gold.
  const paint = geo.userData.map || null;
  const skin = paint
    ? new THREE.MeshStandardMaterial({ color: 0xffffff, map: paint, emissive: gold, emissiveIntensity: 0.06, roughness: 0.5, metalness: 0.3 })
    : new THREE.MeshStandardMaterial({ color: gold, emissive: gold, emissiveIntensity: 0.12, roughness: 0.4, metalness: 0.55 });
  const me = new THREE.Mesh(geo, skin);
  scene.add(me);

  const ghostMat = skin;
  const ghosts = new THREE.InstancedMesh(geo, ghostMat, MAX_GHOSTS);
  ghosts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ghosts.frustumCulled = false;
  scene.add(ghosts);

  // Far away a jet is a few pixels; draw every remote as a gold point too.
  const dotPos = new Float32Array(MAX_GHOSTS * 3);
  const dotsGeo = new THREE.BufferGeometry();
  dotsGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3).setUsage(THREE.DynamicDrawUsage));
  const dots = new THREE.Points(dotsGeo, new THREE.PointsMaterial({ color: gold, size: 3.5, sizeAttenuation: false, transparent: true, opacity: 0.9 }));
  dots.frustumCulled = false;
  scene.add(dots);

  const trails = createContrails({ scene, gold, sky, max: MAX_GHOSTS + 1 });

  // ---- camera ----
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camUp = new THREE.Vector3(0, 1, 0);
  let camReady = false;
  const tmpQ = new THREE.Quaternion(), wag = new THREE.Quaternion(), m4 = new THREE.Matrix4();
  const v = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1), fwd = new THREE.Vector3(), up = new THREE.Vector3();

  function viewQuat(jet, time, out) {
    out.set(jet.q[0], jet.q[1], jet.q[2], jet.q[3]);
    if (jet.flags & 1) out.multiply(wag.setFromAxisAngle(v.set(0, 0, 1), Math.sin(time * 11) * 0.45));
    return out;
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 70 : 55;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  return {
    renderer, scene, camera,
    async setWorld(world) {
      const t = await loadHeightmap(world, manifest.base);
      terrainU.uHeight.value = t.tex;
      terrainU.uWidth.value = t.width;
      terrainU.uMaxH.value = t.maxM;
      terrainU.uExag.value = t.exaggeration;
      terrain.visible = true;
    },
    draw({ self, remotes, time, dt }) {
      // Your jet
      viewQuat(self, time, tmpQ);
      me.position.set(self.pos[0], self.pos[1], self.pos[2]);
      me.quaternion.copy(tmpQ);

      // Chase camera: behind and above, smoothed, horizon tilts with the bank.
      fwd.set(0, 0, -1).applyQuaternion(tmpQ);
      up.set(0, 1, 0).applyQuaternion(tmpQ);
      v.copy(me.position).addScaledVector(fwd, -52).addScaledVector(up, 10);
      const k = camReady ? 1 - Math.exp(-dt * 6) : 1;
      camPos.lerp(v, k);
      camLook.lerp(v.copy(me.position).addScaledVector(fwd, 120), camReady ? 1 - Math.exp(-dt * 10) : 1);
      camUp.lerp(up, camReady ? 1 - Math.exp(-dt * 3) : 1).normalize();
      camReady = true;
      camera.position.copy(camPos);
      camera.up.copy(camUp);
      camera.lookAt(camLook);

      // Ground follows the camera in whole grid cells so lines don't swim.
      const snap = 2500;
      terrainU.uShift.value.set(Math.round(camPos.x / snap) * snap, Math.round(camPos.z / snap) * snap);
      terrainU.uCam.value.copy(camPos);

      // Ghosts
      let n = 0;
      trails.begin(time);
      trails.feed('self', self, tmpQ);
      for (const r of remotes) {
        if (!r.view || !r.visible || n >= MAX_GHOSTS) continue;
        viewQuat(r.view, time, tmpQ);
        v.set(r.view.pos[0], r.view.pos[1], r.view.pos[2]);
        m4.compose(v, tmpQ, s1);
        ghosts.setMatrixAt(n, m4);
        dotPos[n * 3] = v.x; dotPos[n * 3 + 1] = v.y; dotPos[n * 3 + 2] = v.z;
        trails.feed(r.id, r.view, tmpQ);
        n++;
      }
      trails.end();
      ghosts.count = n;
      ghosts.instanceMatrix.needsUpdate = true;
      dotsGeo.setDrawRange(0, n);
      dotsGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
      labels?.(camera, remotes);
    },
  };
}
