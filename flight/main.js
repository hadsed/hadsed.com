// The only file that knows about every part. It wires controls -> sim -> net
// -> render and runs the loop. Everything interesting lives in packages/.
import { createControls, keyboard, pointerStick, gamepad, tilt } from './packages/controls/index.js';
import { createJet, step, cloneJet, copyJet, lerpJet, STEP } from './packages/sim/index.js';
import { connect } from './packages/net/client.js';
import { createRemotes } from './packages/net/interp.js';
import { FLAG } from './packages/net/protocol.js';
import { loadManifest } from './packages/assets/index.js';
import { createRenderer } from './packages/render/index.js';
import { escort } from './packages/bots/pilot.js';
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const base = new URL('./', import.meta.url);
const params = new URLSearchParams(location.search);

const manifest = await loadManifest(base);
// Licensed jet models carry their credit and reuse terms; the license asks us to show them.
const credit = manifest.jet.geometry?.userData.credit;
if (credit) document.getElementById('credit').textContent = credit;
const world = manifest.worlds.find((w) => w.id === params.get('world')) || manifest.worlds[0];

// ---- controls (the SDK knows nothing about jets; we name the axes here) ----
const canvas = $('view');
// Phones and tablets can steer by tilting; off until the TILT button is tapped.
const tilter = tilt({ x: 'roll', y: 'pitch', range: 25 });
// Drag like you are pulling the jet by its tail: down climbs, left banks right.
const stick = pointerStick({ element: canvas, x: 'roll', y: 'pitch', invertX: true, radius: Math.min(innerWidth, innerHeight) * 0.18 });
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
    tilter,
  ],
});
window.__flight = { controls };   // hook for voice/gesture experiments in the console

// iPad trackpads and Mac touchpads: a two-finger scroll or pinch would scroll
// or zoom the page under the game. Safari ignores user-scalable=no, so cancel
// the gestures themselves.
const swallow = (e) => e.preventDefault();
addEventListener('wheel', swallow, { passive: false });
for (const g of ['gesturestart', 'gesturechange', 'gestureend']) addEventListener(g, swallow, { passive: false });
addEventListener('touchmove', swallow, { passive: false });

// ---- sim ----
let jet = createJet({ heading: Math.PI * 0.25 });
const prev = cloneJet(jet), view = cloneJet(jet);
let waggleLeft = 0;

// ---- net ----
const remotes = createRemotes();
const roster = new Map();
let welcomed = false;
const config = await fetch(new URL('config.json', base)).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
const serverUrl = params.get('server') ?? config.server ?? null;
const net = connect({
  url: serverUrl,
  world: world.id,
  onSnapshot: (snap, t) => remotes.push(t, snap.entries, snap.time),
  onMessage: (m) => {
    if (m.t === 'welcome') {
      // First welcome places the jet. After a reconnect, keep flying where you
      // were; the server takes the first position it hears from a new seat.
      if (!welcomed) {
        jet = createJet({ x: m.spawn.x, y: m.spawn.y, z: m.spawn.z, heading: m.spawn.heading });
        copyJet(prev, jet);
        welcomed = true;
      }
      remotes.clear(); roster.clear();
      $('callsign').textContent = m.callsign;
      $('you').hidden = false;
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
    s.className = follow && r.id === follow.id ? 'on' : '';
    n++;
  }
  for (let i = n; i < spans.length; i++) spans[i].style.display = 'none';
}

let renderer;
try {
  renderer = createRenderer({ canvas, manifest, labels });
} catch (err) {
  // No WebGL (old device, blocked GPU, lockdown mode): say so instead of a black screen.
  net.close();
  $('status').textContent = 'this browser cannot draw 3D';
  $('status').hidden = false;
  $('help').textContent = 'try another browser, or turn on hardware acceleration';
  $('help').style.opacity = 1;
  $('help').hidden = false;
  throw err;
}
Object.assign(window.__flight, { net, remotes, renderer, input: controls.read(0) });   // read() reuses one frame object
Object.defineProperty(window.__flight, 'jet', { get: () => jet });
renderer.setWorld(world);

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
    step(jet, followAxes(input.axes), STEP);
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


// ---- tilt toggle (touch devices with motion sensors) ----
const tiltBtn = $('tilt');
if (tilter.supported && matchMedia('(pointer: coarse)').matches) {
  tiltBtn.hidden = false;
  tiltBtn.addEventListener('click', async () => {
    if (tilter.enabled) { tilter.disable(); tiltBtn.textContent = 'tilt'; tiltBtn.classList.remove('on'); return; }
    if (await tilter.enable()) { tiltBtn.textContent = 'tilt on'; tiltBtn.classList.add('on'); }
    else tiltBtn.textContent = 'tilt blocked';
  });
}
Object.assign(window.__flight, { tilt: tilter });

// ---- follow: tap or click another jet and the autopilot flies you onto its wing ----
// It is the same escort autopilot the bots use. Any stick, key or pad input
// hands control back; so does tapping empty sky, or the other jet leaving.
let follow = null;   // { id, side }
const followIntent = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
let press = null;
canvas.addEventListener('pointerdown', (e) => { press = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', (e) => {
  if (!press) return;
  const tap = Math.hypot(e.clientX - press.x, e.clientY - press.y) < 8 && performance.now() - press.t < 350;
  press = null;
  if (!tap) return;
  const id = pickJet(e.clientX, e.clientY);
  if (id !== null) startFollow(id); else stopFollow();
});

function pickJet(x, y) {
  const cam = renderer.camera;
  let best = null, bestD = 56;   // px; generous so thumbs can hit a jet a few pixels wide
  for (const r of remoteList) {
    if (!r.view || !r.visible) continue;
    proj.set(r.view.pos[0], r.view.pos[1], r.view.pos[2]).project(cam);
    if (proj.z > 1) continue;
    const sx = (proj.x * 0.5 + 0.5) * innerWidth, sy = (-proj.y * 0.5 + 0.5) * innerHeight;
    const d = Math.min(Math.hypot(sx - x, sy - y), Math.hypot(sx - x, sy - 18 - y));   // the jet or its label
    if (d < bestD) { bestD = d; best = r.id; }
  }
  return best;
}

function startFollow(id) {
  follow = { id, side: Math.random() < 0.5 ? -1 : 1 };
  window.__flight.follow = follow;
}

function stopFollow() {
  follow = null;
  window.__flight.follow = null;
  $('following').hidden = true;
}

function followAxes(axes) {
  if (!follow) return axes;
  if (Math.abs(axes.pitch) > 0.15 || Math.abs(axes.roll) > 0.15 || Math.abs(axes.yaw) > 0.15 || Math.abs(axes.throttle) > 0.15) { stopFollow(); return axes; }
  const r = remotes.remotes.get(follow.id);
  if (!r?.view || !r.visible) { stopFollow(); return axes; }
  const d = escort(followIntent, jet, r.view, follow.side);
  const el = $('following');
  el.hidden = false;
  el.textContent = `following ${r.callsign || ''}${d > 1500 ? ` · ${d < 10000 ? Math.round(d) + ' m' : (d / 1000).toFixed(0) + ' km'}` : ''}`;
  return followIntent;
}
Object.assign(window.__flight, { startFollow, stopFollow });
