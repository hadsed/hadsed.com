import test from 'node:test';
import assert from 'node:assert/strict';
import { createJet, step, forwardOf, rightOf, cloneJet, LIMITS, STEP } from '../flight/packages/sim/index.js';
import { encodeState, decodeState, encodeSnapshot, decodeSnapshot, ENTRY_BYTES } from '../flight/packages/net/protocol.js';
import { createRemotes } from '../flight/packages/net/interp.js';
import { createControls, scripted, keyboard, tilt } from '../flight/packages/controls/index.js';
import { createPilot, escort } from '../flight/packages/bots/pilot.js';
import { createAssist, headingOf } from '../flight/packages/sim/assist.js';
import { createRoom } from '../flight/server/room.js';

const seeded = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const run = (jet, intent, seconds) => { for (let t = 0; t < seconds; t += STEP) step(jet, intent); return jet; };
const fwd = (j) => forwardOf(j.q, [0, 0, 0]);

test('sim: hands off flies straight and level at speed', () => {
  const j = createJet({ heading: 0 });
  run(j, undefined, 10);
  assert.ok(Math.abs(j.pos[0]) < 1, 'no drift sideways');
  assert.ok(j.pos[2] < -8000, 'moved forward (-z)');
  assert.ok(Math.abs(j.pos[1] - 25900) < 50, 'held altitude');
});

test('sim: rolling right banks right and turns right', () => {
  const j = createJet({ heading: 0 });
  run(j, { roll: 1 }, 0.5);
  assert.ok(rightOf(j.q, [0, 0, 0])[1] < -0.3, 'right wing down');
  run(j, { roll: 0.3 }, 6);
  assert.ok(fwd(j)[0] > 0.2, 'nose swung to +x (right of -z)');
});

test('sim: pitch up climbs, altitude is clamped', () => {
  const j = createJet({ y: 20000 });
  run(j, { pitch: 1 }, 1);
  assert.ok(fwd(j)[1] > 0.3);
  run(j, { pitch: 1 }, 120);
  assert.ok(j.pos[1] <= LIMITS.maxAlt);
});

test('sim: same inputs give the same result (bots and players share it)', () => {
  const a = createJet(), b = createJet();
  const seq = (t) => ({ roll: Math.sin(t), pitch: Math.cos(t * 0.7) * 0.5, throttle: 0.2 });
  for (let i = 0; i < 600; i++) { step(a, seq(i / 60)); step(b, seq(i / 60)); }
  assert.deepEqual(a, b);
});

test('sim: past the edge the jet turns for home', () => {
  const j = createJet({ x: LIMITS.radius + 30000, heading: -Math.PI / 2 });  // flying +x, away
  run(j, undefined, 40);
  assert.ok(fwd(j)[0] < 0, 'now heading back toward the middle');
});

test('protocol: state and snapshot round-trip', () => {
  const j = createJet({ x: 1234.5, y: 22000, z: -98765, heading: 1.1, speed: 912.34 });
  j.flags = 1;
  const back = decodeState(encodeState(j));
  assert.ok(Math.abs(back.pos[2] - j.pos[2]) < 0.01);
  assert.ok(Math.abs(back.speed - j.speed) < 0.02);
  assert.ok(back.q.every((v, i) => Math.abs(v - j.q[i]) < 1e-3));
  assert.equal(decodeState(new ArrayBuffer(3)), null);

  const buf = encodeSnapshot(42, [{ id: 7, jet: j }, { id: 9, jet: createJet() }]);
  assert.equal(buf.byteLength, 7 + 2 * ENTRY_BYTES);
  const s = decodeSnapshot(buf);
  assert.equal(s.time, 42);
  assert.deepEqual(s.entries.map((e) => e.id), [7, 9]);
  assert.equal(s.entries[0].jet.flags, 1);
});

test('interp: draws remotes between snapshots, delayed', () => {
  const r = createRemotes({ delay: 100 });
  const a = createJet({ x: 0 }), b = createJet({ x: 1000 });
  r.push(1000, [{ id: 1, jet: a }]);
  r.push(1100, [{ id: 1, jet: b }]);
  const v = r.sample(1150).get(1).view;
  assert.ok(Math.abs(v.pos[0] - 500) < 1);
});

test('controls: strongest source wins, pressed fires once', () => {
  const s1 = scripted('a'), s2 = scripted('b');
  const c = createControls({ axes: ['roll'], actions: ['waggle'], sources: [s1, s2] });
  s1.set('roll', 0.3); s2.set('roll', -0.8); s1.hold('waggle');
  let f = c.read();
  assert.equal(f.axes.roll, -0.8);
  assert.equal(f.pressed.waggle, true);
  assert.deepEqual([...f.active].sort(), ['a', 'b']);
  f = c.read();
  assert.equal(f.pressed.waggle, false);
  assert.equal(f.actions.waggle, true);
});

test('controls: keyboard ramps like a stick', () => {
  const k = keyboard({ axes: { roll: ['KeyA', 'KeyD'] }, target: {} });
  const c = createControls({ axes: ['roll'], sources: [k] });
  k.press('KeyD');
  const first = c.read(0.1).axes.roll;
  assert.ok(first > 0 && first < 1);
  for (let i = 0; i < 10; i++) c.read(0.1);
  assert.equal(c.read(0.1).axes.roll, 1);
});

test('bots: a cruising pilot reaches its waypoint area', () => {
  const p = createPilot({ rng: seeded(3) });
  const j = createJet({ heading: 2 });
  p.think(j, {});
  const g = p.me.goal.slice();
  const d0 = Math.hypot(g[0] - j.pos[0], g[2] - j.pos[2]);
  for (let i = 0; i < 60 * 30; i++) step(j, p.think(j, { dt: STEP }));
  const d1 = Math.hypot(g[0] - j.pos[0], g[2] - j.pos[2]);
  assert.ok(d1 < d0 || p.me.goal[0] !== g[0], 'closed in on the goal');
});

test('bots: an escort settles near its leader', () => {
  const p = createPilot({ rng: () => 0.1 });  // 0.1 < 0.45 -> escort
  const lead = createJet({ heading: 0, speed: 800, throttle: 0.7 });
  const bot = createJet({ x: 6000, z: 12000, heading: 0 });
  const others = [{ id: 1, jet: lead, human: true }];
  for (let i = 0; i < 60 * 90; i++) {
    step(bot, p.think(bot, { dt: STEP, others }));
    step(lead, undefined);
  }
  const d = Math.hypot(bot.pos[0] - lead.pos[0], bot.pos[2] - lead.pos[2]);
  assert.equal(p.me.mode, 'escort');
  assert.ok(d < 2000, `within 2 km of the leader (was ${Math.round(d)} m)`);
});

function fakeConn() {
  const c = { got: [], closed: false, send: (d) => c.got.push(d), close: () => { c.closed = true; } };
  c.json = () => c.got.filter((d) => typeof d === 'string').map((d) => JSON.parse(d));
  c.snaps = () => c.got.filter((d) => d instanceof ArrayBuffer).map(decodeSnapshot);
  return c;
}

test('room: first visitor gets company, bots look like people', () => {
  let t = 0;
  const room = createRoom({ now: () => t, rng: seeded(5) });
  const a = fakeConn();
  const seat = room.join({ send: a.send, close: a.close, ip: '1.1.1.1' });
  assert.equal(a.json()[0].t, 'welcome');
  assert.ok(room.size >= 4, 'bots already in the sky');
  t += 100; room.tick(0.1);
  const snap = a.snaps().at(-1);
  assert.ok(snap.entries.length >= 3);
  assert.ok(!snap.entries.some((e) => e.id === seat.id), 'you are not in your own snapshot');
  const roster = a.json().find((m) => m.t === 'roster').add;
  assert.ok(roster.every(([, cs]) => /^[A-Z]+ \d\d$/.test(cs)), 'bot callsigns match the human format');
});

test('room: two people see each other; bots leave when everyone does', () => {
  let t = 0;
  const room = createRoom({ now: () => t, rng: seeded(9) });
  const a = fakeConn(), b = fakeConn();
  const sa = room.join({ send: a.send, ip: 'a' });
  const sb = room.join({ send: b.send, ip: 'b' });
  t += 100; room.tick(0.1);
  assert.ok(a.snaps().at(-1).entries.some((e) => e.id === sb.id));
  assert.ok(b.snaps().at(-1).entries.some((e) => e.id === sa.id));
  room.leave(sa.id); room.leave(sb.id);
  assert.equal(room.size, 0);
});

test('room: rejects teleports, caps per IP, people bump bots when full', () => {
  let t = 0;
  const room = createRoom({ now: () => t, rng: seeded(2), capacity: 5, perIp: 2 });
  const a = fakeConn();
  const sa = room.join({ send: a.send, ip: 'x' });
  const jet = cloneJet(room.ents.get(sa.id).jet);
  assert.equal(room.receive(sa.id, encodeState(jet)), true, 'first report places the seat');
  t += 100;
  jet.pos[0] += 90000;
  assert.equal(room.receive(sa.id, encodeState(jet)), false, 'teleport refused');
  jet.pos[0] -= 90000 - 50;
  assert.equal(room.receive(sa.id, encodeState(jet)), true);
  assert.ok(room.join({ send: () => {}, ip: 'x' }));
  assert.equal(room.join({ send: () => {}, ip: 'x' }), null, 'third socket from one IP refused');
  for (let i = 0; i < 3; i++) assert.ok(room.join({ send: () => {}, ip: `p${i}` }), 'person admitted over a bot');
  assert.equal(room.join({ send: () => {}, ip: 'last' }), null, 'full of people');
});

test('room: a reconnecting client keeps its position (first report is trusted, then checked)', () => {
  let t = 0;
  const room = createRoom({ now: () => t, rng: seeded(5) });
  const s = room.join({ send: () => {}, ip: 'r' });
  const jet = cloneJet(room.ents.get(s.id).jet);
  jet.pos[0] += 80000; jet.pos[2] = 500000;   // far from spawn, and outside the world
  assert.equal(room.receive(s.id, encodeState(jet)), true);
  assert.ok(Math.abs(room.ents.get(s.id).jet.pos[2]) <= 120000, 'clamped to the world');
  t += 100;
  jet.pos[0] += 50000;
  assert.equal(room.receive(s.id, encodeState(jet)), false, 'later jumps still refused');
});

test('room: only the nearest jets are sent', () => {
  let t = 0;
  const room = createRoom({ now: () => t, rng: seeded(4), near: 5, botFill: 0 });
  const conns = Array.from({ length: 12 }, () => fakeConn());
  conns.forEach((c, i) => room.join({ send: c.send, ip: `i${i}` }));
  t += 100; room.tick(0.1);
  assert.equal(conns[0].snaps().at(-1).entries.length, 5);
});

test('follow: escort() flies a player from 20 km out onto the leader\'s wing', () => {
  const lead = createJet({ x: 0, z: 0, heading: 0, speed: 850, throttle: 0.75 });
  const me = createJet({ x: 15000, z: 14000, heading: 1.2, speed: 900 });
  const intent = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
  let d = Infinity;
  for (let i = 0; i < 60 * 150; i++) { d = escort(intent, me, lead, 1); step(me, intent); step(lead); }
  assert.ok(d < 600, `holding the slot (off by ${Math.round(d)} m)`);
});

test('controls: tilt is relative to the grip when enabled, right and toward you are +', async () => {
  const listeners = {};
  const target = { DeviceOrientationEvent: function () {}, screen: { orientation: { angle: 0 } },
    addEventListener: (t, f) => { listeners[t] = f; }, removeEventListener: () => {} };
  const t = tilt({ x: 'roll', y: 'pitch', range: 25, target });
  const c = createControls({ axes: ['roll', 'pitch'], sources: [t] });
  assert.equal(await t.enable(), true);
  listeners.deviceorientation({ beta: 40, gamma: 0 });        // comfortable grip = neutral
  assert.deepEqual({ ...c.read().axes }, { roll: 0, pitch: 0 });
  listeners.deviceorientation({ beta: 52, gamma: 30 });       // tilt right, top toward you
  const a = c.read().axes;
  assert.equal(a.roll, 1);
  assert.ok(a.pitch > 0.3 && a.pitch < 0.6);
  t.disable();
  assert.deepEqual({ ...c.read().axes }, { roll: 0, pitch: 0 });
});

test('assist: stick right banks and turns; let go and it levels out where it is', () => {
  const j = createJet({ heading: 0 });
  const a = createAssist();
  const it = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
  let maxBank = 0;
  for (let i = 0; i < 60; i++) { step(j, a.update(it, j, 1, 0)); maxBank = Math.max(maxBank, -rightOf(j.q, [0, 0, 0])[1]); }  // 1 s of full right
  assert.ok(maxBank > 0.3, 'banked right without any roll input from the player');
  const atRelease = headingOf(j.q);
  assert.ok(atRelease < -0.05, 'turned right');
  for (let i = 0; i < 60 * 5; i++) step(j, a.update(it, j, 0, 0));                   // hands off
  assert.ok(Math.abs(headingOf(j.q) - atRelease) < 0.2, 'no runaway turn after letting go');
  assert.ok(Math.abs(rightOf(j.q, [0, 0, 0])[1]) < 0.05, 'wings level again');
  assert.ok(Math.abs(fwd(j)[1]) < 0.05, 'nose level again');
});

test('assist: a correction the other way takes effect at once', () => {
  const j = createJet({ heading: 0 });
  const a = createAssist();
  const it = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
  for (let i = 0; i < 48; i++) step(j, a.update(it, j, 0.6, 0));
  for (let i = 0; i < 30; i++) step(j, a.update(it, j, -0.6, 0));
  assert.ok(rightOf(j.q, [0, 0, 0])[1] > 0.1, 'banked left within half a second');
});
