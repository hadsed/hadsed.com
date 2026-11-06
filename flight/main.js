// The only file that knows about every part. It wires controls -> sim -> net
// -> render and runs the loop. Everything interesting lives in packages/.
import { createControls, keyboard, pointerStick, gamepad } from './packages/controls/index.js';
import { createJet, step, cloneJet, copyJet, lerpJet, STEP } from './packages/sim/index.js';
import { connect } from './packages/net/client.js';
import { createRemotes } from './packages/net/interp.js';
import { FLAG } from './packages/net/protocol.js';
import { loadManifest } from './packages/assets/index.js';
import { createRenderer } from './packages/render/index.js';
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const base = new URL('./', import.meta.url);
const params = new URLSearchParams(location.search);

const manifest = await loadManifest(base);
const world = manifest.worlds.find((w) => w.id === params.get('world')) || manifest.worlds[0];

// ---- controls (the SDK knows nothing about jets; we name the axes here) ----
const canvas = $('view');
const stick = pointerStick({ element: canvas, x: 'roll', y: 'pitch', radius: Math.min(innerWidth, innerHeight) * 0.18 });
const controls = createControls({
  axes: ['pitch', 'roll', 'yaw', 'throttle'],
  actions: ['waggle'],
  sources: [
    keyboard({
      axes: {
        pitch: [['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']],
        roll: [['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']],
        yaw: ['KeyQ', 'KeyE'],
        throttle: ['KeyF', 'KeyR'],
      },
      actions: { waggle: 'Space' },
    }),
    stick,
    gamepad({ axes: { roll: 0, pitch: 1, yaw: 2 }, buttons: { waggle: 0 } }),
  ],
});
window.__flight = { controls };   // hook for voice/gesture experiments in the console

// ---- sim ----
let jet = createJet({ heading: Math.PI * 0.25 });
const prev = cloneJet(jet), view = cloneJet(jet);
let waggleLeft = 0;

// ---- net ----
const remotes = createRemotes();
const roster = new Map();
const config = await fetch(new URL('config.json', base)).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
const serverUrl = params.get('server') ?? config.server ?? null;
const net = connect({
  url: serverUrl,
  world: world.id,
  onSnapshot: (snap, t) => remotes.push(t, snap.entries),
  onMessage: (m) => {
    if (m.t === 'welcome') {
      jet = createJet({ x: m.spawn.x, y: m.spawn.y, z: m.spawn.z, heading: m.spawn.heading });
      copyJet(prev, jet);
      remotes.clear(); roster.clear();
      $('callsign').textContent = m.callsign;
    }
    if (m.t === 'roster') {
      for (const [id, cs] of m.add || []) { roster.set(id, cs); remotes.meta(id, cs); }
      for (const id of m.remove || []) { roster.delete(id); remotes.remove(id); }
    }
  },
  onStatus: (s) => { $('status').textContent = s === 'online' ? 'shared sky' : s === 'solo' ? 'solo flight' : s; },
});
if (!serverUrl) $('status').textContent = 'solo flight';

// ---- render ----
const labelsEl = $('labels');
const spans = [];
const proj = new THREE.Vector3();
function labels(camera, list) {
  let n = 0;
  const w = innerWidth, h = innerHeight;
  for (const r of list) {
    if (!r.view || !r.visible || n >= 12) continue;
    proj.set(r.view.pos[0], r.view.pos[1], r.view.pos[2]);
    const d = proj.distanceTo(camera.position);
    if (d > 60000) continue;
    proj.project(camera);
    if (proj.z > 1 || Math.abs(proj.x) > 1.1 || Math.abs(proj.y) > 1.1) continue;
    const s = spans[n] || labelsEl.appendChild((spans[n] = document.createElement('span')));
    s.style.display = '';
    s.style.left = `${(proj.x * 0.5 + 0.5) * w}px`;
    s.style.top = `${(-proj.y * 0.5 + 0.5) * h}px`;
    s.textContent = `${r.callsign || ''} ${d < 10000 ? Math.round(d) + ' m' : (d / 1000).toFixed(0) + ' km'}`;
    n++;
  }
  for (let i = n; i < spans.length; i++) spans[i].style.display = 'none';
}

const renderer = createRenderer({ canvas, manifest, labels });
renderer.setWorld(world).then(() => $('world').textContent = world.label);

// ---- loop: fixed 60 Hz sim, render interpolated, send at 10 Hz ----
const remoteList = [];
let acc = 0, last = performance.now(), sendAcc = 0, helpHidden = false;
const stickDot = $('stick'), thr = $('thr').firstChild;

function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, (nowMs - last) / 1000);
  last = nowMs;
  acc += dt;
  while (acc >= STEP) {
    const input = controls.read(STEP);
    if (input.pressed.waggle) waggleLeft = 1.2;
    copyJet(prev, jet);
    step(jet, input.axes, STEP);
    waggleLeft = Math.max(0, waggleLeft - STEP);
    jet.flags = waggleLeft > 0 ? FLAG.WAGGLE : 0;
    if (!helpHidden && input.active.size) { helpHidden = true; setTimeout(() => ($('help').style.opacity = 0.25), 6000); }
    acc -= STEP;
  }
  lerpJet(view, prev, jet, acc / STEP);

  sendAcc += dt;
  if (sendAcc >= 0.1) { sendAcc = 0; net.send(jet); }

  remotes.sample(nowMs);
  remoteList.length = 0;
  for (const [id, r] of remotes.remotes) { r.id = id; remoteList.push(r); }

  renderer.draw({ self: view, remotes: remoteList, time: nowMs / 1000, dt });

  $('alt').textContent = `alt ${Math.round(jet.pos[1] * 3.281).toLocaleString()} ft`;
  $('mach').textContent = `mach ${(jet.speed / 295).toFixed(2)}`;
  thr.style.width = `${Math.round(jet.throttle * 100)}%`;
  const aloft = net.state.status === 'online' ? roster.size + 1 : 1;
  $('aloft').textContent = `${aloft} aloft`;
  const st = stick.state;
  stickDot.style.display = st ? 'block' : 'none';
  if (st) { stickDot.style.left = `${st.cur.x}px`; stickDot.style.top = `${st.cur.y}px`; }
}
requestAnimationFrame(frame);
