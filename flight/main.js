// The only file that knows about every part. It wires controls -> sim -> net
// -> render and runs the loop. Everything interesting lives in packages/.
import { createControls, keyboard, pointerStick, gamepad, tilt, scripted } from './packages/controls/index.js';
import { createAssist } from './packages/sim/assist.js';
import { createJet, step, cloneJet, copyJet, lerpJet, forwardOf, LIMITS, STEP } from './packages/sim/index.js';
import { connect } from './packages/net/client.js';
import { createRemotes } from './packages/net/interp.js';
import { FLAG } from './packages/net/protocol.js';
import { loadManifest } from './packages/assets/index.js';
import { createRenderer } from './packages/render/index.js';
import { CHASE } from './packages/render/camera.js';
import { escort } from './packages/bots/pilot.js';
import { createLog } from './packages/hud/log.js';
import { createDowned } from './packages/hud/downed.js';
import { CRASH, classifyGround, classifyJets, creditFor, iGetCredit, createStats } from './packages/sim/crash.js';
import { createAttractPilot, SLOTS } from './attract.js';
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const base = new URL('./', import.meta.url);
const log = createLog($('log'));
const params = new URLSearchParams(location.search);
// ?attract: the site backdrop. The jet flies itself, the HUD is hidden, and the
// socket only watches (no seat, so the aloft count stays honest) until fly().
let attract = params.has('attract');
// Boost speed cue: dust streaming past plus the lens's darkened edges (Had's
// pick). ?speed=dust | vapor | lens shows one cue alone, for comparison.
const speedStyle = ['dust', 'vapor', 'lens'].includes(params.get('speed')) ? params.get('speed') : 'dust';
const edgeDark = !params.has('speed') || speedStyle === 'lens';
let vignette = 0;
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
const keys = keyboard({
  axes: {
    aimX: [['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']],
    aimY: [['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']],   // like a stick: forward dives, back climbs
    throttle: ['KeyF', 'KeyR'],
  },
  actions: { boost: ['Space', 'ShiftLeft', 'ShiftRight'], waggle: 'KeyE' },
  attack: 5, release: 8,
});
const controls = createControls({
  axes: ['aimX', 'aimY', 'throttle'],
  actions: ['boost', 'waggle'],
  sources: [
    keys,
    stick,
    // Right stick aims, left stick forward/back is throttle, A boosts, B waves.
    gamepad({ axes: { aimX: 2, aimY: 3, throttle: 1 }, invert: { throttle: true }, buttons: { boost: 0, waggle: 1 } }),
    tilter,
    buttons,
  ],
});
const assist = createAssist();
const aimIntent = { pitch: 0, roll: 0, yaw: 0, throttle: 0, boost: false };
window.__flight = { controls, assist, keys, stick };
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
  onStatus: (s) => {
    $('status').textContent = s === 'online' ? 'shared sky' : s === 'solo' ? 'solo flight' : s;
    if (!attract && s === 'reconnecting') log.post('net', 'connection lost: reconnecting', 8000);
    else if (!attract && s === 'online') log.post('net', 'joined the shared sky');
  },
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
    s.className = `${follow && r.id === follow.id ? 'on' : ''}${hoverId === r.id ? ' hover' : ''}`;
    n++;
  }
  for (let i = n; i < spans.length; i++) spans[i].style.display = 'none';
}

let renderer;
try {
  renderer = createRenderer({ canvas, manifest, labels, speedStyle, look: params.get('look') === 'site' ? 'site' : 'real' });
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
let acc = 0, last = performance.now(), sendAcc = 0, helpHidden = false, lastIntent = null;
const stickDot = $('stick'), thr = $('thr').firstChild, reticle = $('reticle');
const aimDir = [0, 0, -1];

function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, (nowMs - last) / 1000);
  last = nowMs;
  acc += dt;
  while (acc >= STEP) {
    const input = controls.read(STEP);
    if (down) { downTick(input); acc -= STEP; continue; }   // crashed: the jet lies where it fell
    if (input.pressed.waggle) waggleLeft = 1.2;
    copyJet(prev, jet);
    const it = attract ? attractPilot.think(jet, remoteList, STEP) : flyIntent(input);
    lastIntent = it;
    step(jet, it, STEP);
    if (attract) attractPilot.hold(jet, STEP); else collide();
    if (down) { acc -= STEP; continue; }
    waggleLeft = Math.max(0, waggleLeft - STEP);
    jet.flags = (waggleLeft > 0 ? FLAG.WAGGLE : 0) | (it.boost ? FLAG.BOOST : 0) | hurtFlags();
    if (!attract) stats.tick(jet.speed, renderer?.ground ? jet.pos[1] - renderer.ground.height(jet.pos[0], jet.pos[2]) : null, STEP);
    if (!attract) rumble(it.boost);
    if (!helpHidden && input.active.size) { helpHidden = true; setTimeout(() => ($('help').style.opacity = 0.25), 6000); }
    acc -= STEP;
  }
  lerpJet(view, prev, jet, acc / STEP);
  slideGround();

  sendAcc += dt;
  // Just before a respawn the jet goes quiet for a moment, so the room server takes the jump
  // back into the sky as flying, not a teleport (it allows more distance the longer the gap).
  if (sendAcc >= (attract ? 1 : 0.1)) { sendAcc = 0; if (!down?.quiet) net.send(jet); }   // watchers only report where they look from

  remotes.sample(nowMs);
  remoteList.length = 0;
  for (const [id, r] of remotes.remotes) { r.id = id; remoteList.push(r); }
  if (attract) calmRemotes(dt); else othersDown();

  if (attract && !window.__flight.ready && readyAt) placeBackdrop(nowMs);
  const lead = follow && !attract ? remotes.remotes.get(follow.id)?.view : null;
  renderer.draw({ self: view, remotes: remoteList, time: nowMs / 1000, dt, focus: lead ? lead.pos : null,
    wreckCam: down ? { pos: down.pos, heading: down.heading, t: clock() - down.at } : null });

  $('alt').textContent = `alt ${Math.round(jet.pos[1] * 3.281).toLocaleString()} ft`;
  $('mach').textContent = `mach ${(jet.speed / 295).toFixed(2)}`;
  thr.style.width = `${Math.round(jet.throttle * 100)}%`;
  const hull = $('hull');
  hull.hidden = !CRASH.on || attract;
  if (CRASH.on) { hull.textContent = `hull ${Math.max(0, Math.round(hp))}%${wing ? ` · ${wing < 0 ? 'left' : 'right'} wing hit` : ''}${clock() < shieldUntil ? ' · shield' : ''}`; hull.classList.toggle('hurt', hp < CRASH.smokeBelow); }
  const others = net.state.status === 'online' ? roster.size : 0;
  // "in flight" drops on narrow phones (index.html), where a long callsign at top left would meet it.
  $('aloft').innerHTML = `${others} other${others === 1 ? '' : 's'}<span class="wide"> in flight</span>`;
  if (!attract) statusLog();
  if (edgeDark) {
    vignette += ((!attract && jet.flags & FLAG.BOOST ? 1 : 0) - vignette) * (1 - Math.exp(-dt * 2.5));
    $('vignette').style.opacity = vignette.toFixed(3);
  }
  const st = stick.state;
  stickDot.style.display = st ? 'block' : 'none';
  if (st) { stickDot.style.left = `${st.cur.x}px`; stickDot.style.top = `${st.cur.y}px`; }

  // Reticle: where the jet is headed. Hidden while the autopilot follows someone.
  assist.direction(aimDir);
  const pin = RETICLE.radius > 0 && placeReticle(RETICLE.radius);
  if (!pin) proj.set(view.pos[0] + aimDir[0] * 20000, view.pos[1] + aimDir[1] * 20000, view.pos[2] + aimDir[2] * 20000).project(renderer.camera);
  const showReticle = !follow && !attract && renderer.rig.blend === 1 && (pin || proj.z < 1);
  reticle.style.display = showReticle ? 'block' : 'none';
  if (showReticle) reticle.style.transform = pin ? `translate(${pin[0]}px, ${pin[1]}px)` : `translate(${(proj.x * 0.5 + 0.5) * innerWidth}px, ${(-proj.y * 0.5 + 0.5) * innerHeight}px)`;
}

// Reticle radius in px (0 = free, drawn where the aim point projects). Set, the reticle stays
// inside a circle of that radius fixed on screen, centered where the nose points in level
// flight. Its distance out is how far the aim is from the nose as a share of a full-stick turn,
// so it reads the same whatever the assist's limits, and hard pulls, banks and loops pin it to
// the rim instead of throwing it off screen (the chase cam lags the nose in a hard pull-up).
const RETICLE = { radius: 0 };
const camQ = new THREE.Quaternion(), aimC = new THREE.Vector3(), noseC = new THREE.Vector3(), pinAt = [0, 0];
function placeReticle(R) {
  const cam = renderer.camera;
  // Level flight: the camera sits CHASE.up above and looks at a point CHASE.look ahead, so the
  // nose's vanishing point is that far above the middle of the screen.
  const tilt = Math.atan2(CHASE.up, CHASE.back + CHASE.look);
  const cx = innerWidth / 2, cy = innerHeight / 2 * (1 - Math.tan(tilt) / Math.tan(cam.fov * Math.PI / 360));
  forwardOf(view.q, _f);
  camQ.copy(cam.quaternion).invert();
  aimC.set(aimDir[0], aimDir[1], aimDir[2]).applyQuaternion(camQ);
  noseC.set(_f[0], _f[1], _f[2]).applyQuaternion(camQ);
  const dx = aimC.x - noseC.x, dy = -(aimC.y - noseC.y), len = Math.hypot(dx, dy);
  const angle = Math.acos(Math.max(-1, Math.min(1, aimC.dot(noseC))));
  // Full back is a loop: the assist hands over raw pitch and its aim sits level, behind the
  // nose, which would drop the reticle while you pull up. Pin it to the top of the rim instead.
  if (assist.loop > 0) { pinAt[0] = cx; pinAt[1] = cy - R; return pinAt; }
  const k = len > 1e-6 ? R * Math.min(1, angle / Math.max(assist.tune.maxTurn, assist.tune.maxPitch)) / len : 0;
  pinAt[0] = cx + dx * k; pinAt[1] = cy + dy * k;
  return pinAt;
}
requestAnimationFrame(frame);

// ---- status log: what the jet is doing on its own, and why ----
const ft = (m) => `${Math.round(m * 3.281 / 100) * 100}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
function statusLog() {
  const r = Math.hypot(jet.pos[0], jet.pos[2]), nose = Math.asin(Math.max(-1, Math.min(1, aimDirOf(jet)[1])));
  log.hold('edge', r > LIMITS.radius ? 'autopilot: turning you back toward the middle of the map'
    : r > LIMITS.radius * 0.88 ? `nearing the edge of the map · ${range(LIMITS.radius - r)} to go` : null);
  const alt = jet.pos[1];
  log.hold('floor', LIMITS.minAlt > 0 && alt < LIMITS.minAlt + 3000 && nose < -0.05 ? `hard deck ${ft(LIMITS.minAlt)} ft: pulling up` : null);
  log.hold('ceiling', alt > LIMITS.maxAlt - 3000 && nose > 0.05 ? `ceiling ${ft(LIMITS.maxAlt)} ft: leveling off` : null);
  log.hold('rejoin', follow && lastIntent?.boost && lastIntent === followIntent ? 'boost: rejoining formation' : null);
  log.hold('loop', assist.loop > 0 && !follow ? 'full back: looping' : assist.loop < 0 && !follow ? 'full forward: diving' : null);
  log.tick();
}
const _f = [0, 0, 0];
function aimDirOf(j) { return forwardOf(j.q, _f); }


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

// Mouse hover: box the name of the jet under the pointer, so you can see it's clickable.
let hoverId = null;
document.body.addEventListener('pointermove', (e) => {
  const id = e.pointerType === 'mouse' && !e.buttons && !document.body.classList.contains('attract') && renderer ? pickJet(e.clientX, e.clientY) : null;
  if (id !== hoverId) { hoverId = id; document.body.style.cursor = id === null ? '' : 'pointer'; }
});
document.body.addEventListener('pointerleave', () => { hoverId = null; document.body.style.cursor = ''; });

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
  log.post('follow', `autopilot: taking you to ${remotes.remotes.get(id)?.callsign || 'their'}'s wing`);
  window.__flight.follow = follow;
}

function stopFollow() {
  if (follow) log.post('follow', 'autopilot off: you have the jet');
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
  // (the leave button, X, or tapping the same jet again). While you steer, you
  // fly; let go and the autopilot takes you back to your slot.
  if (follow) {
    // Boost here is a dash back into the slot (see escort): it cuts out as you
    // arrive, so you settle in beside the leader instead of losing it behind you.
    const it = followAxes(input.actions.boost);
    const steering = Math.abs(a.aimX) > 0.08 || Math.abs(a.aimY) > 0.08;
    if (it && !steering) { assist.reset(jet); return it; }
  }
  assist.update(aimIntent, jet, a.aimX, a.aimY, STEP);
  // A damaged wing drags that side down; the assist fights it, so you feel it tug.
  if (CRASH.on && wing) aimIntent.roll = Math.max(-1, Math.min(1, aimIntent.roll + wing * CRASH.wingPull));
  aimIntent.throttle = a.throttle;
  aimIntent.boost = input.actions.boost;
  return aimIntent;
}

function followAxes(dash = false) {
  const r = remotes.remotes.get(follow.id);
  if (!r?.view || !r.visible) { stopFollow(); return null; }
  const d = escort(followIntent, jet, r.view, follow.side, dash);
  const el = $('following');
  el.hidden = false;
  $('followText').textContent = `following ${r.callsign || ''}${d > 1500 ? ` · ${range(d)}` : ''}`;
  return followIntent;
}
$('unfollow').addEventListener('click', () => stopFollow());
addEventListener('keydown', (e) => { if (e.code === 'KeyX' && follow) stopFollow(); });
Object.assign(window.__flight, { startFollow, stopFollow, reticle: RETICLE });

// ---- bumps: off the ground and off other jets ----
// Off by default: the live game keeps its 9,000 m hard deck, far above the peaks. The mechanics
// jig drops the deck and turns these on so you can fly down among the mountains. A bump reflects
// your heading off the surface (the ground's slope, or the line between two jets) and costs speed
// in proportion to how square the hit was. Only your own jet bounces; other players' jets are
// drawn where their own clients put them.
const COLLIDE = { ground: false, jets: false, keep: 0.6, clearance: 6, radius: 18 };
window.__flight.collide = COLLIDE;
const gN = [0, 0, 0], bA = new THREE.Vector3(), bB = new THREE.Vector3(), bQ = new THREE.Quaternion(), jQ = new THREE.Quaternion();
let bumpLogAt = 0;
function bounce(nx, ny, nz, what, logIt = true) {
  forwardOf(jet.q, _f);
  const d = _f[0] * nx + _f[1] * ny + _f[2] * nz;
  if (d >= 0) return;   // already moving away
  bA.set(_f[0], _f[1], _f[2]);
  bB.set(_f[0] - 2 * d * nx, _f[1] - 2 * d * ny, _f[2] - 2 * d * nz).normalize();
  bQ.setFromUnitVectors(bA, bB);
  jQ.set(jet.q[0], jet.q[1], jet.q[2], jet.q[3]).premultiply(bQ).normalize();
  jet.q[0] = jQ.x; jet.q[1] = jQ.y; jet.q[2] = jQ.z; jet.q[3] = jQ.w;
  jet.speed = Math.max(LIMITS.minSpeed * 0.8, jet.speed * (1 - (1 - COLLIDE.keep) * -d));
  assist.reset(jet);
  const t = performance.now();
  if (logIt && t - bumpLogAt > 1500) { bumpLogAt = t; log.post('bump', what, 2500); }
}
function collide() {
  const g = renderer?.ground;
  renderer.rig.floor = COLLIDE.ground && g ? (x, z) => g.height(x, z) + 3 : null;
  if (COLLIDE.ground && g) {
    const floor = g.height(jet.pos[0], jet.pos[2]) + COLLIDE.clearance;
    if (jet.pos[1] < floor) {
      jet.pos[1] = floor;
      g.normal(jet.pos[0], jet.pos[2], gN);
      if (CRASH.on) {
        forwardOf(jet.q, _f);
        const angle = Math.asin(Math.max(0, Math.min(1, -(_f[0] * gN[0] + _f[1] * gN[1] + _f[2] * gN[2]))));
        if (angle > 0 && hit(classifyGround(angle, clock() < shieldUntil), { cause: 'ground', angle })) return;
      }
      bounce(gN[0], gN[1], gN[2], 'bounced off the ground');
    }
  }
  if (COLLIDE.jets) {
    const R2 = COLLIDE.radius * 2;
    for (const r of remoteList) {
      if (!r.view || !r.visible || r.view.flags & FLAG.DOWN) continue;
      const p = r.view.pos, dx = jet.pos[0] - p[0], dy = jet.pos[1] - p[1], dz = jet.pos[2] - p[2], d = Math.hypot(dx, dy, dz);
      if (d >= R2 || d < 1e-3) continue;
      const nx = dx / d, ny = dy / d, nz = dz / d;
      // Closing speed along the line between the jets: a nudge in formation is a bump,
      // head-on at Mach 3 is not.
      forwardOf(jet.q, _f); forwardOf(r.view.q, _g);
      const closing = -((_f[0] * jet.speed - _g[0] * r.view.speed) * nx + (_f[1] * jet.speed - _g[1] * r.view.speed) * ny + (_f[2] * jet.speed - _g[2] * r.view.speed) * nz);
      const t = clock();
      lastBump = { id: r.id, callsign: r.callsign || 'another jet', at: t };
      bumpedAt.set(r.id, t);
      if (CRASH.on && hit(classifyJets(Math.max(0, closing), t < shieldUntil), { cause: 'jet', closing, with: lastBump })) return;
      jet.pos[0] = p[0] + nx * R2; jet.pos[1] = p[1] + ny * R2; jet.pos[2] = p[2] + nz * R2;
      bounce(nx, ny, nz, `bumped ${r.callsign || 'another jet'}`);
    }
  }
}

// ---- crashes (packages/sim/crash.js): damage, going down, the kill card, back in the sky ----
// Off in the live game (CRASH.on false); the mechanics jig turns it on. Everything here is your
// own jet. Others learn you crashed from the DOWN flag on your jet, and each client works out
// for itself whether it was the one that forced you down (the same rule, on its own copy of the sky).
const _g = [0, 0, 0];
const clock = () => performance.now() / 1000;
let hp = 100, wing = 0, down = null, shieldUntil = 0, lastBump = null;
const bumpedAt = new Map();   // id -> when I last bumped that jet (for credit when they go down)
let stats = createStats();
const session = { lives: 0, kills: 0, best: null };
const card = createDowned($('downed'), { onFly: () => leaveWreck() });
const flash = $('flash');

function hurtFlags() {
  if (!CRASH.on) return 0;
  return (hp < CRASH.smokeBelow ? FLAG.SMOKE : 0) | (hp < CRASH.fireBelow ? FLAG.FIRE : 0);
}

// Apply a hit's verdict. Returns true if you're down (the caller stops bouncing).
function hit(v, info) {
  window.__flight.lastHit = { ...v, ...info, hp };
  if (v.kind !== 'direct' && hp - v.damage > 0) {
    hp -= v.damage;
    if (!v.damage) return false;
    if (v.kind === 'hard' && !wing && Math.random() < CRASH.wingChance) {
      // The wing that hit: the low one, by the bank.
      const r = jet.q, rightY = 2 * (r[0] * r[1] + r[3] * r[2]);   // right wing's world y
      wing = rightY < 0 ? 1 : -1;
    }
    if (v.kind === 'hard') stats.hard = (stats.hard || 0) + 1; else stats.scrapes++;
    const what = info.cause === 'jet' ? `hit ${info.with.callsign}` : v.kind === 'hard' ? 'hard hit' : 'scraped the ground';
    log.post('bump', `${what} · hull ${Math.round(hp)}%${v.kind === 'hard' && wing ? ` · ${wing < 0 ? 'left' : 'right'} wing damaged` : ''}`, 3500);
    bumpLogAt = performance.now();
    if (navigator.vibrate) navigator.vibrate(v.kind === 'hard' ? [90, 40, 60] : 35);
    return false;
  }
  goDown(info, v);
  return true;
}

function goDown(info, v) {
  const t = clock();
  forwardOf(jet.q, _f);
  const others = [];
  for (const r of remoteList) if (r.view && r.visible && !(r.view.flags & FLAG.DOWN)) others.push({ id: r.id, callsign: r.callsign || 'another jet', pos: r.view.pos });
  const credit = info.cause === 'jet' ? { ...info.with, how: 'collision', dist: 0 } : creditFor(jet.pos, others, lastBump, t);
  down = { at: t, pos: [jet.pos[0], jet.pos[1], jet.pos[2]], heading: Math.atan2(-_f[0], -_f[2]), info, credit, speed: jet.speed, outOfHull: v.kind !== 'direct', quiet: false, leaveAt: null };
  jet.flags = FLAG.DOWN | FLAG.FIRE;   // speed stays on the wire a moment: others' debris flies on with it
  hp = 0;
  stopFollow();
  session.lives++;
  flash.style.transition = 'none'; flash.style.opacity = '1';
  requestAnimationFrame(() => { flash.style.transition = 'opacity 1.4s ease-out'; flash.style.opacity = '0'; });
  if (navigator.vibrate) navigator.vibrate([200, 60, 120, 60, 60]);
  window.__flight.down = down;
}

function downTick(input) {
  const e = clock() - down.at;
  if (e > 0.3) jet.speed = 0;
  if (!card.shown && e > 1.1) showCard();
  if (card.shown) card.tick(CRASH.wreckTime - e);
  // Space, Enter (the boost key) or the card's button: back in the sky early.
  if (input.pressed.boost && e > 1.5) leaveWreck();
  if (!down.leaveAt && e >= CRASH.wreckTime - 1) leaveWreck();
  if (down.leaveAt && clock() >= down.leaveAt) respawn();
}
addEventListener('keydown', (e) => { if (down && (e.code === 'Enter' || e.code === 'NumpadEnter') && clock() - down.at > 1.5) leaveWreck(); });

function leaveWreck() {
  if (!down || down.leaveAt) return;
  down.quiet = true;
  down.leaveAt = clock() + 1;
}

const clockFmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function showCard() {
  const { info, credit } = down;
  const mach = (down.speed / 295).toFixed(2);
  let kicker, title, detail;
  if (info.cause === 'jet') {
    kicker = 'mid-air collision';
    title = `${credit.callsign} gets the kill`;
    detail = `${Math.round(info.closing * 1.944).toLocaleString()} kt closing speed · mach ${mach}`;
  } else {
    const how = down.outOfHull ? 'one hit too many' : `hit the ground at ${Math.round(info.angle * 180 / Math.PI)}°`;
    if (credit?.how === 'collision') { kicker = 'forced down'; title = `${credit.callsign} gets the kill`; detail = `${how} after bumping them · mach ${mach}`; }
    else if (credit) { kicker = 'maneuver kill'; title = `${credit.callsign} gets the kill`; detail = `${how} · ${range(credit.dist)} from them · mach ${mach}`; }
    else { kicker = 'crashed'; title = 'the mountain wins'; detail = `${how} · mach ${mach} · nobody within ${CRASH.creditKm} km`; }
  }
  const b = session.best, s = stats;
  const lowest = isFinite(s.lowest) ? s.lowest : null;
  const rows = [
    ['distance flown', `${(s.distance / 1852).toFixed(1)} nm`, b && s.distance > b.distance],
    ['time aloft', clockFmt(s.time), b && s.time > b.time],
    ['top speed', `mach ${(s.topSpeed / 295).toFixed(2)}`, b && s.topSpeed > b.topSpeed],
    ['lowest pass', lowest == null ? '—' : `${Math.round(lowest * 3.281).toLocaleString()} ft`, b && lowest != null && lowest < b.lowest],
    ['under 1,000 ft', `${Math.round(s.lowTime)} s`, b && s.lowTime > b.lowTime],
    ['hits survived', `${s.scrapes + (s.hard || 0)}`, false],
    ['maneuver kills', `${session.kills} this session`, false],
    ['crashes', `${session.lives} this session`, false],
  ];
  session.best = b ? { distance: Math.max(b.distance, s.distance), time: Math.max(b.time, s.time), topSpeed: Math.max(b.topSpeed, s.topSpeed), lowest: Math.min(b.lowest, lowest ?? Infinity), lowTime: Math.max(b.lowTime, s.lowTime) }
    : { distance: s.distance, time: s.time, topSpeed: s.topSpeed, lowest: lowest ?? Infinity, lowTime: s.lowTime };
  card.show({ kicker, title, detail, stats: rows, seconds: CRASH.wreckTime - 1.1 });
}

// Back on track (MSFS's answer): just behind the wreck, on the same heading, level and clear of
// the ground for the next few km, with a few seconds' shield.
function respawn() {
  const g = renderer?.ground, h = down.heading, fx = -Math.sin(h), fz = -Math.cos(h);
  const x = down.pos[0] - fx * 1500, z = down.pos[2] - fz * 1500;
  let top = 0;
  if (g) for (let k = 0; k <= 8; k++) top = Math.max(top, g.height(x + fx * k * 1000, z + fz * k * 1000));
  const y = Math.min(LIMITS.maxAlt - 1000, Math.max(LIMITS.minAlt, top + 900, down.pos[1] + 600));
  jet = createJet({ x, y, z, heading: h, speed: Math.max(LIMITS.minSpeed, 700) });
  copyJet(prev, jet);
  assist.reset(jet);
  renderer.rig.reset();
  hp = 100; wing = 0; lastBump = null;
  shieldUntil = clock() + CRASH.shield;
  stats = createStats();
  card.hide();
  down = null;
  window.__flight.down = null;
  log.post('respawn', `back in the sky${CRASH.shield ? ` · ${CRASH.shield} s shield` : ''}`, 3500);
}

// Someone else went down. If I'm who forced them down (I bumped them lately, or I'm the
// nearest jet within range), I get the maneuver kill.
const seenDown = new Set();
function othersDown() {
  for (const r of remoteList) {
    if (!r.view) continue;
    const isDown = (r.view.flags & FLAG.DOWN) !== 0;
    if (!isDown) { seenDown.delete(r.id); continue; }
    if (seenDown.has(r.id)) continue;
    seenDown.add(r.id);
    if (!CRASH.on || down) continue;
    const others = remoteList.filter((o) => o !== r && o.view && o.visible && !(o.view.flags & FLAG.DOWN)).map((o) => ({ pos: o.view.pos }));
    const t = clock();
    if (!iGetCredit(r.view.pos, jet.pos, others, bumpedAt.get(r.id) ?? null, t)) continue;
    session.kills++;
    const d = Math.hypot(r.view.pos[0] - jet.pos[0], r.view.pos[1] - jet.pos[1], r.view.pos[2] - jet.pos[2]);
    const how = bumpedAt.has(r.id) && t - bumpedAt.get(r.id) <= CRASH.creditWindow ? 'after your bump' : `${range(d)} from you`;
    log.post('kill', `maneuver kill: ${r.callsign || 'a jet'} went down ${how}`, 7000);
    if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
  }
}
// Test hook (the jig's "Crash here" button): go down on the spot, as if you hit the ground nose first.
function crashNow() { if (!down && !attract) goDown({ cause: 'ground', angle: Math.PI / 4 }, { kind: 'direct' }); }
Object.assign(window.__flight, { crash: CRASH, crashNow, session });
Object.defineProperty(window.__flight, 'hp', { get: () => hp, set: (v) => { hp = v; } });

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

// Behind the site the ground drifts by at a small fraction of the real speed (Mach 2.7 at
// 85,000 ft reads as a fast scroll). The world slides along with the jets to make up the
// rest, and lets go as the camera glides into the chase cam, so flying is full speed.
// The offset is only visual: nothing in the sim or on the wire touches the terrain.
const GROUND_SPEED = 0.06;
const groundOffset = [0, 0, 0], lastView = [null, 0, 0];
renderer.groundOffset = groundOffset;
function slideGround() {
  if (lastView[0] !== null) {
    const dx = view.pos[0] - lastView[0], dz = view.pos[2] - lastView[2];
    const k = (1 - GROUND_SPEED) * (1 - renderer.rig.blend);
    if (k > 0 && Math.hypot(dx, dz) < 5000) { groundOffset[0] -= dx * k; groundOffset[2] -= dz * k; }   // not across a respawn
  }
  lastView[0] = view.pos[0]; lastView[2] = view.pos[2];
}
