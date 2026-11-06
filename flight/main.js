// The only file that knows about every part. It wires controls -> sim -> net
// -> render and runs the loop. Everything interesting lives in packages/.
import { createControls, keyboard, pointerStick, gamepad, tilt, scripted } from './packages/controls/index.js';
import { createAssist } from './packages/sim/assist.js';
import { createJet, step, cloneJet, copyJet, lerpJet, STEP } from './packages/sim/index.js';
import { connect } from './packages/net/client.js';
import { createRemotes } from './packages/net/interp.js';
import { FLAG } from './packages/net/protocol.js';
import { loadManifest } from './packages/assets/index.js';
import { createRenderer } from './packages/render/index.js';
import { escort } from './packages/bots/pilot.js';
import { createAttractPilot, SLOTS } from './attract.js';
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const base = new URL('./', import.meta.url);
const params = new URLSearchParams(location.search);
// ?attract: the site backdrop. The jet flies itself, the HUD is hidden, and the
// socket only watches (no seat, so the aloft count stays honest) until fly().
let attract = params.has('attract');
if (attract) document.body.classList.add('attract');

const manifest = await loadManifest(base);
// Licensed jet models carry their credit and reuse terms; the license asks us to show them.
const credit = manifest.jet.geometry?.userData.credit;
if (credit) document.getElementById('credit').textContent = credit;
const world = manifest.worlds.find((w) => w.id === params.get('world')) || manifest.worlds[0];

// ---- controls (the SDK knows nothing about jets; we name the axes here) ----
const canvas = $('view');
// Sabre-style steering (Halo: Reach): every input moves an aim point, and the
// jet turns toward it, banking on its own. aimX + is right, aimY + is up.
// Phones and tablets can also aim by tilting; off until TILT is tapped.
const tilter = tilt({ x: 'aimX', y: 'aimY', range: 35 });
// Drag toward where you want to go.
// The stick takes a drag that starts anywhere on screen (HUD, labels, sky), except on a button.
const onControl = (e) => !!e.target.closest?.('button, a, input, select');
const stick = pointerStick({ element: document.body, x: 'aimX', y: 'aimY', invertX: true, radius: Math.min(innerWidth, innerHeight) * 0.17, ignore: onControl });
const buttons = scripted('buttons');   // on-screen BOOST
const controls = createControls({
  axes: ['aimX', 'aimY', 'throttle'],
  actions: ['boost', 'waggle'],
  sources: [
    keyboard({
      axes: {
        aimX: [['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']],
        aimY: [['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']],
        throttle: ['KeyF', 'KeyR'],
      },
      actions: { boost: ['Space', 'ShiftLeft', 'ShiftRight'], waggle: 'KeyE' },
      attack: 5, release: 8,
    }),
    stick,
    // Right stick aims, left stick forward/back is throttle, A boosts, B waves.
    gamepad({ axes: { aimX: 2, aimY: 3, throttle: 1 }, invert: { aimY: true, throttle: true }, buttons: { boost: 0, waggle: 1 } }),
    tilter,
    buttons,
  ],
});
const assist = createAssist();
const aimIntent = { pitch: 0, roll: 0, yaw: 0, throttle: 0, boost: false };
window.__flight = { controls, assist };
// A long press on a phone would open the select / save-image menu; flying needs the whole screen.
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('selectstart', (e) => e.preventDefault());   // hook for voice/gesture experiments in the console

// iPad trackpads and Mac touchpads: a two-finger scroll or pinch would scroll
// or zoom the page under the game. Safari ignores user-scalable=no, so cancel
// the gestures themselves.
const swallow = (e) => e.preventDefault();
addEventListener('wheel', swallow, { passive: false });
for (const g of ['gesturestart', 'gesturechange', 'gestureend']) addEventListener(g, swallow, { passive: false });
addEventListener('touchmove', swallow, { passive: false });

// ---- sim ----
const attractPilot = createAttractPilot();
const fitSlot = () => { attractPilot.me.slot = innerWidth < innerHeight ? SLOTS.tall : SLOTS.wide; };
fitSlot(); addEventListener('resize', fitSlot);
let jet = attract ? attractPilot.place([]) : createJet({ heading: Math.PI * 0.25 });
const prev = cloneJet(jet), view = cloneJet(jet);
let waggleLeft = 0;

// ---- net ----
const remotes = createRemotes();
const roster = new Map();
let welcomed = attract;   // a backdrop jet is already in the sky; Fly keeps it there
let upgrading = false, snaps = 0;
const config = await fetch(new URL('config.json', base)).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
const serverUrl = params.get('server') ?? config.server ?? null;
const net = connect({
  url: serverUrl,
  world: world.id,
  watch: attract,
  onSnapshot: (snap, t) => { snaps++; remotes.push(t, snap.entries, snap.time); },
  onMessage: (m) => {
    if (m.t === 'welcome') {
      // First welcome places the jet. After a reconnect, keep flying where you
      // were; the server takes the first position it hears from a new seat.
      if (!welcomed) {
        jet = createJet({ x: m.spawn.x, y: m.spawn.y, z: m.spawn.z, heading: m.spawn.heading });
        copyJet(prev, jet);
        assist.reset(jet);   // aim where the new jet points
        welcomed = true;
      }
      // Watcher -> seat keeps the jets it already sees, so nothing blinks.
      if (!upgrading) { remotes.clear(); roster.clear(); }
      upgrading = false;
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
// Aviation units, like the altimeter: feet up close, nautical miles beyond.
function range(m) {
  const ft = m * 3.281;
  if (ft < 6000) return `${Math.round(ft / 10) * 10} ft`;
  const nm = m / 1852;
  return `${nm < 10 ? nm.toFixed(1) : Math.round(nm)} nm`;
}

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
    s.textContent = `${r.callsign || ''} ${range(d)}`;
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
if (attract) renderer.rig.blend = renderer.rig.target = 0;
// The backdrop shows once it has drawn the ground and, if the sky has company, sits next to it.
let readyAt = 0;
renderer.setWorld(world).then(() => { readyAt = performance.now(); });

// ---- loop: fixed 60 Hz sim, render interpolated, send at 10 Hz ----
const remoteList = [];
let acc = 0, last = performance.now(), sendAcc = 0, helpHidden = false;
const stickDot = $('stick'), thr = $('thr').firstChild, reticle = $('reticle');
const aimDir = [0, 0, -1];

function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, (nowMs - last) / 1000);
  last = nowMs;
  acc += dt;
  while (acc >= STEP) {
    const input = controls.read(STEP);
    if (input.pressed.waggle) waggleLeft = 1.2;
    copyJet(prev, jet);
    const it = attract ? attractPilot.think(jet, remoteList, STEP) : flyIntent(input);
    step(jet, it, STEP);
    if (attract) attractPilot.hold(jet, STEP);
    waggleLeft = Math.max(0, waggleLeft - STEP);
    jet.flags = (waggleLeft > 0 ? FLAG.WAGGLE : 0) | (it.boost ? FLAG.BOOST : 0);
    if (!attract) rumble(it.boost);
    if (!helpHidden && input.active.size) { helpHidden = true; setTimeout(() => ($('help').style.opacity = 0.25), 6000); }
    acc -= STEP;
  }
  lerpJet(view, prev, jet, acc / STEP);

  sendAcc += dt;
  if (sendAcc >= (attract ? 1 : 0.1)) { sendAcc = 0; net.send(jet); }   // watchers only report where they look from

  remotes.sample(nowMs);
  remoteList.length = 0;
  for (const [id, r] of remotes.remotes) { r.id = id; remoteList.push(r); }
  if (attract) calmRemotes(dt);

  if (attract && !window.__flight.ready && readyAt) placeBackdrop(nowMs);
  renderer.draw({ self: view, remotes: remoteList, time: nowMs / 1000, dt });

  $('alt').textContent = `alt ${Math.round(jet.pos[1] * 3.281).toLocaleString()} ft`;
  $('mach').textContent = `mach ${(jet.speed / 295).toFixed(2)}`;
  thr.style.width = `${Math.round(jet.throttle * 100)}%`;
  const others = net.state.status === 'online' ? roster.size : 0;
  $('aloft').textContent = `${others} other${others === 1 ? '' : 's'} in flight`;
  const st = stick.state;
  stickDot.style.display = st ? 'block' : 'none';
  if (st) { stickDot.style.left = `${st.cur.x}px`; stickDot.style.top = `${st.cur.y}px`; }

  // Reticle: where the jet is headed. Hidden while the autopilot follows someone.
  assist.direction(aimDir);
  proj.set(view.pos[0] + aimDir[0] * 20000, view.pos[1] + aimDir[1] * 20000, view.pos[2] + aimDir[2] * 20000).project(renderer.camera);
  const showReticle = !follow && !attract && renderer.rig.blend === 1 && proj.z < 1;
  reticle.style.display = showReticle ? 'block' : 'none';
  if (showReticle) reticle.style.transform = `translate(${(proj.x * 0.5 + 0.5) * innerWidth}px, ${(-proj.y * 0.5 + 0.5) * innerHeight}px)`;
}
requestAnimationFrame(frame);


// ---- BOOST button (touch devices): hold to dash ----
const boostBtn = $('boost');
if (matchMedia('(pointer: coarse)').matches) {
  boostBtn.hidden = false;
  const hold = (on) => (e) => { e.preventDefault(); buttons.hold('boost', on); boostBtn.classList.toggle('on', on); };
  boostBtn.addEventListener('pointerdown', hold(true));
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) boostBtn.addEventListener(t, hold(false));
}

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
// On the body, like the stick: the stick captures the pointer there, so the canvas never sees the release.
document.body.addEventListener('pointerdown', (e) => { press = onControl(e) ? null : { x: e.clientX, y: e.clientY, t: performance.now() }; });
document.body.addEventListener('pointerup', (e) => {
  if (!press) return;
  const tap = Math.hypot(e.clientX - press.x, e.clientY - press.y) < 8 && performance.now() - press.t < 350;
  press = null;
  if (!tap) return;
  const id = pickJet(e.clientX, e.clientY);
  if (id === null) return;   // a tap on empty sky doesn't end follow; too easy to do by accident
  if (follow?.id === id) stopFollow(); else startFollow(id);
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

// Boost rumble on phones that allow it (Android; iOS Safari has no vibration
// API). A hard kick when the burner lights, then a low pulse while it burns.
let rumbling = false, rumbleNext = 0;
function rumble(on) {
  if (!navigator.vibrate) return;
  const t = performance.now();
  if (on && !rumbling) { navigator.vibrate([70, 30, 40]); rumbleNext = t + 400; }
  else if (on && t >= rumbleNext) { navigator.vibrate(18); rumbleNext = t + 260; }
  else if (!on && rumbling) navigator.vibrate(0);
  rumbling = on;
}

// Turn this tick's input into stick commands: follow mode if it's on,
// otherwise the Sabre assist chasing the aim point.
function flyIntent(input) {
  const a = input.axes;
  // Follow stays on through stick, throttle and boost; it ends only on purpose
  // (the leave button, X, or tapping the same jet again). Boost still works.
  if (follow) {
    const it = followAxes();
    if (it) { it.boost = it.boost || input.actions.boost; assist.reset(jet); return it; }
  }
  assist.update(aimIntent, jet, a.aimX, a.aimY, STEP);
  aimIntent.throttle = a.throttle;
  aimIntent.boost = input.actions.boost;
  return aimIntent;
}

function followAxes() {
  const r = remotes.remotes.get(follow.id);
  if (!r?.view || !r.visible) { stopFollow(); return null; }
  const d = escort(followIntent, jet, r.view, follow.side);
  const el = $('following');
  el.hidden = false;
  $('followText').textContent = `following ${r.callsign || ''}${d > 1500 ? ` · ${range(d)}` : ''}`;
  return followIntent;
}
$('unfollow').addEventListener('click', () => stopFollow());
addEventListener('keydown', (e) => { if (e.code === 'KeyX' && follow) stopFollow(); });
Object.assign(window.__flight, { startFollow, stopFollow });

// ---- attract <-> flying (the site backdrop's Fly and Back) ----
// Before the backdrop is shown, drop the jet next to a live one if any are about,
// and hold off "ready" until it sits in its slot (the other jet's interpolated
// position wanders while the page is still busy loading). At most 4 s.
let placed = false;
function placeBackdrop(nowMs) {
  const waited = nowMs - readyAt;
  const seen = remoteList.some((r) => r.view && r.visible);
  if (!placed && seen && remoteList.some((r) => remotes.remotes.get(r.id)?.buf.length >= 6)) {
    placed = true;
    jet = attractPilot.place(remoteList);
    copyJet(prev, jet); lerpJet(view, prev, jet, 0);
    renderer.rig.reset();
  }
  // Done when settled next to someone, or when the sky is known to be empty (or out of reach).
  const done = placed ? attractPilot.gap(jet) < 120 : (!seen && snaps >= 6) || net.state.status === 'solo';
  if (done || waited > 4000) window.__flight.ready = true;
}

function fly() {
  if (!attract) return;
  attract = false;
  document.body.classList.remove('attract');
  assist.reset(jet);   // aim where the nose is, or the reticle swings to an old heading
  jet.throttle = Math.max(jet.throttle, 0.85);   // the autopilot cruises slow; hand over at the normal setting
  if (net.state.watch) { upgrading = true; net.join(); }
  renderer.rig.target = 1;
  canvas.focus?.();
}

function land() {
  if (attract) return;
  attract = true;
  stopFollow();
  document.body.classList.add('attract');
  net.watch();
  calmQ.clear();
  renderer.rig.target = 0;
}
Object.assign(window.__flight, { fly, land, attractPilot });
Object.defineProperty(window.__flight, 'attract', { get: () => attract });

// Behind the site's text the sky stays quiet: other jets' attitude is eased (a hard
// bank reads as a slow lean) and their boost and wave are not drawn. Positions are
// untouched. Off once you fly, when you see everything as it is.
const calmQ = new Map(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
function calmRemotes(dt) {
  const k = 1 - Math.exp(-dt / 1.5);
  for (const r of remoteList) {
    if (!r.view) continue;
    const q = r.view.q;
    let c = calmQ.get(r.id);
    if (!c) { calmQ.set(r.id, (c = [q[0], q[1], q[2], q[3]])); }
    qa.set(c[0], c[1], c[2], c[3]).slerp(qb.set(q[0], q[1], q[2], q[3]), k);
    c[0] = q[0] = qa.x; c[1] = q[1] = qa.y; c[2] = q[2] = qa.z; c[3] = q[3] = qa.w;
    r.rawFlags = r.view.flags; r.view.flags = 0;
  }
  if (calmQ.size > remoteList.length + 16) for (const id of calmQ.keys()) if (!remotes.remotes.has(id)) calmQ.delete(id);
}
