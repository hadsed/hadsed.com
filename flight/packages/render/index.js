// Renderer: reads jet states and draws them. Never changes game state.
//
// const r = createRenderer({ canvas, manifest });
// await r.setWorld(manifest.worlds[0]);
// r.draw({ self, remotes, time, dt });   // self: jet view; remotes: [{ id, view, callsign }]
import * as THREE from 'three';
import { jetGeometry, loadHeightmap } from '../assets/index.js';
import { createWorld, WORLD_DEFAULTS } from '../world/index.js';
import { createContrails } from './contrails.js';
import { createCameraRig } from './camera.js';
import { outlineMaterial } from './outline.js';
import { createBoost } from './boost.js';
import { createWind } from './wind.js';
import { FLAG } from '../net/protocol.js';

const MAX_GHOSTS = 64;

export function createRenderer({ canvas, manifest, labels }) {
  const pal = manifest.palette;
  const sky = new THREE.Color(pal.sky), gold = new THREE.Color(pal.gold);

  // On a software rasterizer (SwiftShader, llvmpipe: no usable GPU, or a blocklisted one) every
  // pixel costs CPU. MSAA alone halves the frame rate there and the cloud deck's fbm is the next
  // biggest cost, so drop both. Phones and laptops with a GPU keep the full look.
  const software = isSoftwareGL();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !software, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(sky);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 2, 2.0e6);
  const hemi = new THREE.HemisphereLight(0x8a9bbd, 0x1c2433, 1.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d6, 2.4);
  sun.position.set(0.4, 1, 0.3);
  scene.add(sun);

  // ---- sky, terrain, cloud deck: the same world module as the SR-71 backdrop ----
  // Drawn straight to the screen (no post pass): the world shaders tone themselves, the sky to the
  // palette, the ground in natural color.
  const coarse = matchMedia('(pointer: coarse)').matches;
  // 256 x 256 with a uniform 350 m core: a quarter of the backdrop's vertices (software GL and weak
  // phones are vertex-bound here).
  const world = createWorld({ segments: software ? 256 : 320, cell: 350, flat: 0.375, lite: software });
  // The backdrop's look (navy monotone, ground color showing through). The monotone follows the camera
  // rig: full in the backdrop orbit, fading to natural color as Fly glides into the chase cam.
  world.setLook({ ...WORLD_DEFAULTS });
  world.uniforms.uDirect.value = 1;
  // Per-pixel relief (three height reads a pixel) is free on a GPU but halves the frame rate on a CPU
  // rasterizer; there the per-vertex relief is enough.
  if (software) world.terrainUniforms.uPixelRelief.value = 0;
  scene.add(world.sky, world.terrain);
  if (!software) scene.add(world.clouds);
  sun.position.copy(world.sunDir);
  const shift = new THREE.Vector2();
  const groundO = new THREE.Vector3();

  // ---- jets ----
  const geo = jetGeometry(manifest.jet);
  // Every jet is a black SR-71 with a thin gold outline, so it reads against
  // dark sky and ground; yours gets a finer line than everyone else's. A packed
  // jet brings its paint (geo.userData.map: markings, insignia, panel lines),
  // darkened to the airframe's black.
  const paint = geo.userData.map || null;
  // Matte, light-eating black like the real airframe's paint: no metal, almost no
  // sheen, and the packed paint (markings, panel lines, tiles) shown at full strength.
  const skin = new THREE.MeshStandardMaterial({ color: paint ? 0xffffff : 0x16171b, map: paint, roughness: 0.93, metalness: 0 });
  const me = new THREE.Mesh(geo, skin);
  scene.add(me);
  const myLine = outlineMaterial({ color: gold, px: 1 });
  const meLine = new THREE.Mesh(geo, myLine);
  scene.add(meLine);

  const ghosts = new THREE.InstancedMesh(geo, skin, MAX_GHOSTS);
  ghosts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ghosts.frustumCulled = false;
  scene.add(ghosts);
  const ghostLine = outlineMaterial({ color: gold, px: 1.6 });
  const ghostLines = new THREE.InstancedMesh(geo, ghostLine, MAX_GHOSTS);
  ghostLines.instanceMatrix = ghosts.instanceMatrix;   // same matrices, drawn twice
  ghostLines.frustumCulled = false;
  scene.add(ghostLines);
  const dpr = () => renderer.getPixelRatio();

  // Far away a jet is a few pixels; draw every remote as a gold point too.
  const dotPos = new Float32Array(MAX_GHOSTS * 3);
  const dotsGeo = new THREE.BufferGeometry();
  dotsGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3).setUsage(THREE.DynamicDrawUsage));
  const dots = new THREE.Points(dotsGeo, new THREE.PointsMaterial({ color: gold, size: 3.5, sizeAttenuation: false, transparent: true, opacity: 0.9 }));
  dots.frustumCulled = false;
  scene.add(dots);

  const trails = createContrails({ scene, gold, sky, max: MAX_GHOSTS + 1 });
  const boost = createBoost({ scene, geo, max: MAX_GHOSTS + 1 });
  const wind = createWind({ scene });

  // ---- camera: backdrop orbit and chase cam, one continuous move between them (camera.js) ----
  const rig = createCameraRig(camera);
  const tmpQ = new THREE.Quaternion(), wag = new THREE.Quaternion(), m4 = new THREE.Matrix4();
  const v = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1);
  const focusV = new THREE.Vector3();

  function viewQuat(jet, time, out) {
    out.set(jet.q[0], jet.q[1], jet.q[2], jet.q[3]);
    if (jet.flags & 1) out.multiply(wag.setFromAxisAngle(v.set(0, 0, 1), Math.sin(time * 11) * 0.45));
    return out;
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();   // the rig sets the lens each frame
  }
  resize();
  addEventListener('resize', resize);

  return {
    renderer, scene, camera, rig, world,
    async setWorld(w) {
      const t = await loadHeightmap(w, manifest.base);
      world.setHeight(t.tex, { size: w.size, metersPerPixel: w.metersPerPixel, maxM: w.maxM, snowM: w.snowM, arid: w.arid ?? 0.3, encoded: false });
      world.setLook({ exag: t.exaggeration });
    },
    draw({ self, remotes, time, dt, focus = null }) {   // focus: [x, y, z] to keep in frame, or null
      // Your jet
      viewQuat(self, time, tmpQ);
      me.position.set(self.pos[0], self.pos[1], self.pos[2]);
      me.quaternion.copy(tmpQ);
      meLine.position.copy(me.position); meLine.quaternion.copy(tmpQ);
      myLine.setViewport(canvas.width, canvas.height); ghostLine.setViewport(canvas.width, canvas.height);
      myLine.px.value = 1 * dpr(); ghostLine.px.value = 1.6 * dpr();

      rig.boosting = (self.flags & FLAG.BOOST) !== 0;
      rig.focus = focus ? focusV.set(focus[0], focus[1], focus[2]) : null;
      rig.update(me.position, tmpQ, dt, camera.aspect);
      // Gold outlines are for flying; the calm site backdrop shows plain black jets.
      meLine.visible = ghostLines.visible = rig.blend > 0.5;
      // Air streaming past: only in the chase view, not the calm backdrop.
      wind.update(dt, me.position, tmpQ, self.speed, rig.boosting ? 1 : 0, Math.min(1, Math.max(0, rig.blend * 2 - 1)));
      const camPos = camera.position;

      // The ground grid follows the camera (world.frame): its core moves in whole heightmap texels, so
      // the ground near you holds still, and the rest slides smoothly over pre-filtered heights.
      // (Snapping everything a cell at a time re-meshed the far ground on every snap, a visible jump
      // twice a second at Mach 3; sliding everything made nearby ridges swim.) groundOffset (the site
      // backdrop) slides the whole world under the jets, so the ground can drift slower than they fly.
      const go = this.groundOffset;
      const ox = go ? go[0] : 0, oz = go ? go[2] : 0;
      shift.set(camPos.x, camPos.z);
      groundO.set(ox, 0, oz);
      world.frame(camera, go ? groundO : null, shift, renderer);
      world.uniforms.uMono.value = 1 - Math.min(Math.max(rig.blend, 0), 1);

      // Ghosts
      let n = 0;
      trails.begin(time);
      trails.feed('self', self, tmpQ);
      boost.begin(time, dt, camera, canvas.height);
      boost.feed('self', self, tmpQ, (self.flags & FLAG.BOOST) !== 0, self.throttle ?? 0.6);
      for (const r of remotes) {
        if (!r.view || !r.visible || n >= MAX_GHOSTS) continue;
        viewQuat(r.view, time, tmpQ);
        v.set(r.view.pos[0], r.view.pos[1], r.view.pos[2]);
        m4.compose(v, tmpQ, s1);
        ghosts.setMatrixAt(n, m4);
        dotPos[n * 3] = v.x; dotPos[n * 3 + 1] = v.y; dotPos[n * 3 + 2] = v.z;
        trails.feed(r.id, r.view, tmpQ);
        boost.feed(r.id, r.view, tmpQ, (r.view.flags & FLAG.BOOST) !== 0);
        n++;
      }
      trails.end();
      boost.end();
      ghosts.count = ghostLines.count = n;
      ghosts.instanceMatrix.needsUpdate = true;
      dotsGeo.setDrawRange(0, n);
      dotsGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
      labels?.(camera, remotes);
    },
  };
}

// True when WebGL is drawn by a CPU rasterizer. Asked on a throwaway context, because antialias has
// to be chosen before the real one exists.
export function isSoftwareGL() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch { return false; }
}
