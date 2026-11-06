// Bot swarm: many headless clients flying against a room server, using the
// real client (packages/net/client.js) and the real sim. Measures what a
// player would feel: time to join, snapshot rate and gaps, bandwidth, how
// smooth other jets look, and whether everyone survives drops.
//
//   node flight/test/swarm.mjs --clients 50                     # local wrangler dev
//   node flight/test/swarm.mjs --clients 30 --profile 3g        # through the network shaper
//   node flight/test/swarm.mjs --clients 20 --chaos blackhole@15:8,cut@35 --seconds 50
//   node flight/test/swarm.mjs --url wss://hadsed-flight.<acct>.workers.dev --origin https://hadsed.com --clients 40
//
// Flags: --url --origin --world --clients --ramp (joins/s) --seconds --profile
//        --chaos (blackhole@<s>:<len>, cut@<s>) --json <file> --assert
//
// The server allows 4 sockets per IP per room copy, so from one machine
// against a deployed Worker you get 4 per copy and spill across copies; run
// wrangler dev with --var PER_IP:1000 to test one crowded room locally.

import { connect } from '../packages/net/client.js';
import { createRemotes } from '../packages/net/interp.js';
import { createJet, step, STEP } from '../packages/sim/index.js';
import { createShaper } from './net/shaper.mjs';
import { createSmoothness, pct } from './net/smoothness.mjs';
import { writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? (argv[i + 1]?.startsWith('--') || argv[i + 1] == null ? true : argv[i + 1]) : d; };

export async function swarm({
  url = 'ws://127.0.0.1:8787', origin = 'http://localhost', world = 'sierra',
  clients = 20, ramp = 10, seconds = 30, profile = null, chaos = '', watch = 5, log = console.log,
} = {}) {
  let shaper = null;
  if (profile) { shaper = await createShaper({ upstream: url, profile }); url = shaper.url; }
  const bots = [];
  const t0 = Date.now();

  for (let i = 0; i < clients; i++) {
    const b = { i, startedAt: Date.now(), joinMs: null, gaps: [], lastSnap: null, snaps: 0, bytes: 0, entries: [], statuses: [], fulls: 0 };
    b.jet = createJet();
    b.phase = Math.random() * 10;
    // Watchers draw one other swarm client (a "person") and one server bot.
    if (i < watch) { b.remotes = createRemotes(); b.watch = { person: { smooth: createSmoothness(), id: null }, bot: { smooth: createSmoothness(), id: null } }; }
    b.net = connect({
      url, world,
      socketOptions: { headers: { Origin: origin } },
      onSnapshot: (snap, t) => {
        b.snaps++;
        b.bytes += 7 + snap.entries.length * 25;
        b.entries.push(snap.entries.length);
        if (b.lastSnap !== null) b.gaps.push(t - b.lastSnap);
        b.lastSnap = t;
        b.remotes?.push(t, snap.entries, snap.time);
      },
      onMessage: (m) => {
        if (m.t === 'welcome') {
          if (b.joinMs === null) { b.joinMs = Date.now() - b.startedAt; b.jet = createJet({ x: m.spawn.x, y: m.spawn.y, z: m.spawn.z, heading: m.spawn.heading }); }
          b.lastSnap = null;
          b.remotes?.clear();
          if (b.watch) for (const w of Object.values(b.watch)) { w.id = null; w.smooth.reset(); }
        }
        if (m.t === 'full') b.fulls++;
        if (m.t === 'roster') for (const id of m.remove || []) b.remotes?.remove(id);
      },
      onStatus: (s) => b.statuses.push([Date.now() - t0, s]),
    });
    bots.push(b);
    if (ramp > 0) await sleep(1000 / ramp);
  }
  log(`${clients} clients launched in ${((Date.now() - t0) / 1000).toFixed(1)} s${profile ? ` through "${profile}"` : ''}`);

  // If this process is starved, its own timers slip and every number below
  // gets worse for reasons that have nothing to do with the server.
  const lagSamples = [];
  let lagLast = performance.now();
  const lagTimer = setInterval(() => { const n = performance.now(); lagSamples.push(n - lagLast - 50); lagLast = n; }, 50);

  // Fly: 10 Hz sim chunks and state reports, like a player's tab.
  const fly = setInterval(() => {
    const t = Date.now() / 1000;
    for (const b of bots) {
      const intent = { roll: Math.sin(t * 0.3 + b.phase) * 0.4, pitch: Math.sin(t * 0.17 + b.phase) * 0.2 };
      for (let k = 0; k < 6; k++) step(b.jet, intent, STEP);
      b.net.send(b.jet);
    }
  }, 100);

  // Watch a few remote jets at 60 Hz, the way a screen would draw them.
  let lastFrame = performance.now();
  const frames = setInterval(() => {
    const now = performance.now();
    const dt = now - lastFrame; lastFrame = now;
    const people = new Set(bots.map((b) => b.net.state.id).filter((x) => x != null));
    for (const b of bots) {
      if (!b.remotes) continue;
      b.remotes.sample(now);
      for (const [kind, w] of Object.entries(b.watch)) {
        if (w.id == null || !b.remotes.remotes.has(w.id)) {
          w.id = [...b.remotes.remotes.keys()].find((id) => people.has(id) === (kind === 'person')) ?? null;
          w.smooth.reset();
        }
        const r = w.id != null && b.remotes.remotes.get(w.id);
        if (r?.view && r.buf.length > 1) w.smooth.sample(r.view.pos, r.view.speed, dt);
      }
    }
  }, 1000 / 60);

  // Chaos: blackhole@15:8 holds every byte for 8 s starting at 15 s; cut@35 resets every socket.
  const events = [];
  for (const ev of String(chaos || '').split(',').filter(Boolean)) {
    const [kind, rest] = ev.split('@');
    const [at, len] = rest.split(':').map(Number);
    if (!shaper) throw new Error('--chaos needs --profile (it runs through the shaper)');
    events.push(setTimeout(() => {
      log(`chaos: ${kind} at ${at}s${len ? ` for ${len}s` : ''}`);
      if (kind === 'blackhole') shaper.blackhole(len * 1000);
      if (kind === 'cut') shaper.cut();
    }, at * 1000));
  }

  await sleep(seconds * 1000);
  clearInterval(fly); clearInterval(frames); clearInterval(lagTimer); events.forEach(clearTimeout);

  const elapsed = (Date.now() - t0) / 1000;
  const allGaps = bots.flatMap((b) => b.gaps);
  const joined = bots.filter((b) => b.joinMs !== null);
  const watched = (kind) => bots.filter((b) => b.watch).map((b) => b.watch[kind].smooth.stats).filter((s) => s.frames > 30);
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const result = {
    url: profile ? `${url} (shaped: ${profile})` : url,
    clients, seconds: elapsed,
    joined: joined.length,
    onlineAtEnd: bots.filter((b) => b.net.state.status === 'online').length,
    fullRefusals: bots.reduce((a, b) => a + b.fulls, 0),
    joinMsP50: pct(joined.map((b) => b.joinMs), 0.5),
    joinMsP95: pct(joined.map((b) => b.joinMs), 0.95),
    snapHz: avg(bots.map((b) => b.snaps / elapsed)),
    gapMsP50: pct(allGaps, 0.5), gapMsP99: pct(allGaps, 0.99), gapMsMax: allGaps.length ? Math.max(...allGaps) : NaN,
    jetsSeenAvg: avg(bots.flatMap((b) => b.entries)),
    kbpsDownPerClient: avg(bots.map((b) => (b.bytes * 8) / 1000 / elapsed)),
    reconnects: bots.reduce((a, b) => a + b.net.state.reconnects, 0),
    staleDetected: bots.reduce((a, b) => a + b.net.state.stale, 0),
    // % of 60 Hz frames where another jet visibly stutters (see net/smoothness.mjs)
    hitchPctPeople: avg(watched('person').map((s) => s.hitchPct)),
    hitchPctBots: avg(watched('bot').map((s) => s.hitchPct)),
    freezePctPeople: avg(watched('person').map((s) => s.freezePct)),
    freezePctBots: avg(watched('bot').map((s) => s.freezePct)),
    interpDelayMs: avg(bots.filter((b) => b.remotes).map((b) => b.remotes.delay)),
    swarmLoopLagMsP99: pct(lagSamples, 0.99),   // >30 ms: this machine is the bottleneck, not the server
    joinMsAll: bots.map((b) => b.joinMs),
    stragglers: bots.filter((b) => b.net.state.status !== 'online').map((b) => ({ i: b.i, joinMs: b.joinMs, statuses: b.statuses })),
  };
  for (const b of bots) b.net.close();
  await shaper?.close();
  return result;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await swarm({
    url: arg('url', 'ws://127.0.0.1:8787'), origin: arg('origin', 'http://localhost'), world: arg('world', 'sierra'),
    clients: Number(arg('clients', 20)), ramp: Number(arg('ramp', 10)), seconds: Number(arg('seconds', 30)),
    profile: arg('profile', null), chaos: arg('chaos', ''),
  });
  const fmt = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(1)) : v);
  const { stragglers, joinMsAll, ...table } = r;
  console.table(Object.fromEntries(Object.entries(table).map(([k, v]) => [k, fmt(v)])));
  for (const s of stragglers) console.log(`not online at the end: client ${s.i}`, JSON.stringify(s.statuses));
  if (arg('json')) writeFileSync(arg('json'), JSON.stringify(r, null, 2));
  if (arg('assert')) {
    const fails = [];
    if (r.joined < r.clients) fails.push(`only ${r.joined}/${r.clients} joined`);
    if (r.onlineAtEnd < r.joined) fails.push(`${r.joined - r.onlineAtEnd} clients not online at the end`);
    if (!(r.snapHz > 7)) fails.push(`snapshot rate ${r.snapHz?.toFixed(1)} Hz`);
    const maxHitch = Number(arg('max-hitch', 5));
    for (const k of ['hitchPctPeople', 'hitchPctBots']) if (r[k] > maxHitch) fails.push(`${k} ${r[k].toFixed(1)}% (max ${maxHitch})`);
    if (fails.length) { console.error('FAIL: ' + fails.join('; ')); process.exit(1); }
    console.log('PASS');
  }
  process.exit(0);
}
