// Network robustness for the flight lab: interpolation under bad links, the
// client's dead-socket watchdog, and the network shaper itself. All offline
// and deterministic except the shaper test, which uses loopback sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { benchInterp } from '../flight/test/net/interp-bench.mjs';
import { createShaper } from '../flight/test/net/shaper.mjs';
import { connect } from '../flight/packages/net/client.js';
import { createRemotes } from '../flight/packages/net/interp.js';
import { createJet } from '../flight/packages/sim/index.js';

// Before server-time interpolation these were 4% (4g), 22% (3g), 47% (hotel).
for (const [profile, maxHitch] of [['wifi', 0.5], ['4g', 0.5], ['3g', 2], ['edge', 5], ['hotel', 8]]) {
  test(`interp: remote jets stay smooth on ${profile} (hitches under ${maxHitch}% of frames)`, () => {
    const r = benchInterp(profile);
    assert.ok(r.frames > 3000);
    assert.ok(r.hitchPct < maxHitch, `hitch ${r.hitchPct.toFixed(1)}%`);
  });
}

test('interp: a jet with late states is drawn further back without dragging others', () => {
  const R = createRemotes();
  for (let i = 0; i < 60; i++) {
    const st = 1000 + i * 100;
    R.push(st + 50, [{ id: 1, jet: createJet({ z: -i * 90 }), age: 0 }, { id: 2, jet: createJet({ z: -i * 90 }), age: 300 }], st);
  }
  R.sample(7000);
  const a = R.remotes.get(1).cur, b = R.remotes.get(2).cur;
  assert.ok(a < 200, `fresh jet delay ${a}`);
  assert.ok(b > a + 250, `late jet delay ${b}`);
});

test('interp: survives the u32 server clock wrapping', () => {
  const R = createRemotes();
  const base = 2 ** 32 - 500;
  for (let i = 0; i < 20; i++) R.push(i * 100, [{ id: 1, jet: createJet({ z: -i * 90 }) }], (base + i * 100) >>> 0);
  assert.equal(R.remotes.get(1).buf.length, 20, 'no state dropped as "old" after the wrap');
});

// A fake WebSocket: says welcome, then optionally goes silent forever without
// closing, which is what a phone switching from wifi to cell looks like.
function fakeSockets({ silentAfterWelcome }) {
  const made = [];
  class FakeWS {
    constructor(url) {
      this.url = url; this.readyState = 0; made.push(this);
      setTimeout(() => {
        this.readyState = 1; this.onopen?.();
        this.onmessage?.({ data: JSON.stringify({ t: 'welcome', id: made.length, callsign: 'TEST 1', spawn: { x: 0, y: 20000, z: 0, heading: 0 } }) });
        if (!silentAfterWelcome(made.length)) this.timer = setInterval(() => this.onmessage?.({ data: new ArrayBuffer(7) }), 100);
      }, 5);
    }
    send() {}
    close() { clearInterval(this.timer); this.readyState = 3; }
  }
  return { FakeWS, made };
}

test('client: a socket that goes silent is replaced within a few seconds', async () => {
  const { FakeWS, made } = fakeSockets({ silentAfterWelcome: (n) => n === 1 });
  const statuses = [];
  const c = connect({ url: 'ws://x', WebSocketImpl: FakeWS, staleMs: 600, onStatus: (s) => statuses.push(s) });
  await new Promise((r) => setTimeout(r, 2000));
  c.close();
  for (const s of made) s.close();
  assert.ok(made.length >= 2, 'dialed again');
  assert.equal(c.state.stale, 1, 'one stale socket detected');
  assert.equal(c.state.status, 'online', 'back online on the new socket');
  assert.deepEqual(statuses.slice(0, 3), ['online', 'reconnecting', 'online']);
});

test('client: a healthy socket is left alone', async () => {
  const { FakeWS, made } = fakeSockets({ silentAfterWelcome: () => false });
  const c = connect({ url: 'ws://x', WebSocketImpl: FakeWS, staleMs: 600 });
  await new Promise((r) => setTimeout(r, 1500));
  c.close();
  for (const s of made) s.close();
  assert.equal(made.length, 1);
  assert.equal(c.state.reconnects, 0);
});

test('shaper: adds latency, and a blackhole holds bytes until it lifts', async () => {
  const echo = net.createServer((s) => s.pipe(s));
  await new Promise((r) => echo.listen(0, '127.0.0.1', r));
  const shaper = await createShaper({ upstream: `ws://127.0.0.1:${echo.address().port}`, profile: { latency: 60 } });
  const sock = net.connect(shaper.port, '127.0.0.1');
  await new Promise((r) => sock.once('connect', r));
  const rtt = async () => { const t = Date.now(); sock.write('x'); await new Promise((r) => sock.once('data', r)); return Date.now() - t; };
  const first = await rtt();
  assert.ok(first >= 110 && first < 400, `rtt ${first} ms (want ~120)`);
  shaper.blackhole(500);
  const held = await rtt();
  assert.ok(held >= 450, `blackholed rtt ${held} ms`);
  sock.destroy();
  await shaper.close();
  echo.close();
});

test('worker: asks for ArrayBuffer frames (as Blobs, every position report was dropped)', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../flight/server/worker.js', import.meta.url), 'utf8');
  assert.match(src, /server\.binaryType\s*=\s*'arraybuffer'[\s\S]*server\.accept\(\)/);
});

test('room: snapshot ages for bots look like ages for people', async () => {
  const { createRoom } = await import('../flight/server/room.js');
  const { decodeSnapshot, encodeState } = await import('../flight/packages/net/protocol.js');
  let t = 1000;
  const got = [];
  const room = createRoom({ now: () => t });
  const seat = room.join({ send: (d) => typeof d !== 'string' && got.push(decodeSnapshot(d)), ip: 'a' });
  const other = room.join({ send: () => {}, ip: 'b' });
  const jet = createJet({ x: 1000, y: 20000, z: 0 });
  for (let i = 0; i < 50; i++) {
    t += 37; room.receive(other.id, encodeState(jet, t - 40));   // people report off the tick's beat
    t += 63; room.tick(0.1);
  }
  const ages = (human) => got.slice(10).flatMap((s) => s.entries.filter((e) => (e.id === other.id) === human).map((e) => e.age));
  const people = ages(true), bots = ages(false);
  assert.ok(bots.length && people.length);
  assert.ok(Math.min(...bots) > 0, 'bots never report a tell-tale zero age');
  assert.ok(Math.max(...bots) < 200 && Math.max(...people) < 200);
  void seat;
});

test('lab page: import map comes before any module preload (Firefox ignores a late one)', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../flight/index.html', import.meta.url), 'utf8');
  const map = html.indexOf('type="importmap"');
  const firstModule = Math.min(...['rel="modulepreload"', 'type="module"'].map((k) => html.indexOf(k)).filter((i) => i >= 0));
  assert.ok(map >= 0 && map < firstModule);
});

test('lab page: callsign labels never swallow a press on the sky', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../flight/index.html', import.meta.url), 'utf8');
  assert.match(html, /#labels[^{]*\{[^}]*pointer-events:\s*none/);
});

test('room: a watcher sees the sky, keeps bots flying, and is in nobody\'s snapshot or roster', async () => {
  const { createRoom } = await import('../flight/server/room.js');
  const { decodeSnapshot, encodeState } = await import('../flight/packages/net/protocol.js');
  let t = 1000;
  const room = createRoom({ now: () => t, rng: () => 0.5 });
  const wSnaps = [], wText = [];
  const w = room.watch({ send: (d) => (typeof d === 'string' ? wText.push(JSON.parse(d)) : wSnaps.push(decodeSnapshot(d))), ip: 'a' });
  assert.equal(room.humans, 0);
  assert.ok(room.present > 0, 'a watcher counts as presence');
  assert.ok(room.size >= 3, 'the backdrop gets bots even when nobody flies');
  assert.equal(wText[0].t, 'watching');
  const pText = [], pSnaps = [];
  const p = room.join({ send: (d) => (typeof d === 'string' ? pText.push(JSON.parse(d)) : pSnaps.push(decodeSnapshot(d))), ip: 'b' });
  for (let i = 0; i < 5; i++) { t += 100; room.receive(w.id, encodeState(createJet({ x: 5000, y: 20000 }), t)); room.tick(0.1); }
  assert.ok(wSnaps.length === 5 && wSnaps.at(-1).entries.some((e) => e.id === p.id), 'watcher sees the pilot');
  const ids = new Set(pSnaps.flatMap((s) => s.entries.map((e) => e.id)));
  assert.equal(ids.size, room.size - 1, 'pilot sees every jet but its own, and no watcher');
  assert.ok(!pText.some((m) => m.t === 'roster' && (m.add || []).some(([id]) => typeof id === 'string')));
  assert.ok(wText.some((m) => m.t === 'roster' && m.add?.some(([id]) => id === p.id)), 'watcher gets roster updates');
  // Pressing Fly: same socket becomes a seat, placed where the watcher was looking from.
  const before = room.size;
  const seat = room.upgrade(w.id);
  assert.ok(seat && typeof seat.id === 'number');
  assert.equal(room.watching, 0);
  assert.equal(room.size, before + 1, 'no extra bots for an upgrade');
  assert.equal(room.ents.get(seat.id).jet.pos[0], 5000);
  assert.ok(wText.some((m) => m.t === 'welcome' && m.id === seat.id));
});

test('room: watchers share the per-IP cap, and leaving the last one clears the bots', async () => {
  const { createRoom } = await import('../flight/server/room.js');
  const room = createRoom({ perIp: 2 });
  const a = room.watch({ send: () => {}, ip: 'x' });
  assert.ok(room.join({ send: () => {}, ip: 'x' }));
  assert.equal(room.watch({ send: () => {}, ip: 'x' }), null);
  const solo = createRoom();
  const w = solo.watch({ send: () => {}, ip: 'y' });
  assert.ok(solo.size > 0);
  solo.leave(w.id);
  assert.equal(solo.size, 0);
  void a;
});

test('client: a watcher dials with watch=1, and join() asks for a seat on the same socket', async () => {
  const { connect } = await import('../flight/packages/net/client.js');
  const socks = [];
  class FakeWS {
    constructor(url) { this.url = url; this.readyState = 1; this.sent = []; socks.push(this); }
    send(d) { this.sent.push(d); }
    close() {}
  }
  const net = connect({ url: 'wss://x', watch: true, WebSocketImpl: FakeWS });
  assert.match(socks[0].url, /watch=1/);
  socks[0].onmessage({ data: JSON.stringify({ t: 'watching' }) });
  assert.equal(net.state.status, 'watching');
  net.send(createJet());
  assert.equal(socks[0].sent.length, 1, 'watchers report a camera position');
  net.join();
  assert.equal(JSON.parse(socks[0].sent[1]).t, 'join');
  socks[0].onmessage({ data: JSON.stringify({ t: 'welcome', id: 7, callsign: 'KITE 10', spawn: {} }) });
  assert.equal(net.state.status, 'online');
  net.close();
});

test('room: back to the site, a seat becomes a watcher again and leaves the roster', async () => {
  const { createRoom } = await import('../flight/server/room.js');
  const room = createRoom();
  const other = [];
  room.join({ send: (d) => typeof d === 'string' && other.push(JSON.parse(d)), ip: 'b' });
  const sent = [];
  const seat = room.join({ send: (d) => typeof d === 'string' && sent.push(JSON.parse(d)), ip: 'a' });
  const before = room.size;
  const w = room.downgrade(seat.id);
  assert.ok(w && typeof w.id === 'string');
  assert.equal(room.size, before - 1);
  assert.equal(room.watching, 1);
  assert.ok(other.some((m) => m.t === 'roster' && m.remove?.includes(seat.id)));
  assert.ok(sent.some((m) => m.t === 'watching'));
});

test('client: against a server that cannot watch, a watcher hangs up instead of taking a seat', async () => {
  const { connect } = await import('../flight/packages/net/client.js');
  const socks = [];
  class FakeWS { constructor(url) { this.url = url; this.readyState = 1; this.sent = []; socks.push(this); } send(d) { this.sent.push(d); } close() { this.closed = true; } }
  const net = connect({ url: 'wss://x', watch: true, WebSocketImpl: FakeWS });
  socks[0].onmessage({ data: JSON.stringify({ t: 'welcome', id: 3, callsign: 'KITE 10', spawn: {} }) });
  assert.ok(socks[0].closed);
  assert.equal(net.state.status, 'solo');
  await new Promise((r) => setTimeout(r, 1200));
  assert.equal(socks.length, 1, 'no redial while watching');
  net.join();
  assert.equal(socks.length, 2);
  assert.doesNotMatch(socks[1].url, /watch=1/);
  net.close();
});
