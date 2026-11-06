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
