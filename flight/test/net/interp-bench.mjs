// Offline, deterministic: how smooth do remote jets look on each network
// profile? A remote jet flies a straight line, the "server" snapshots it at
// 10 Hz, the network delays snapshots (in order, like TCP), and a 60 Hz client
// draws it through createRemotes. No sockets, no timers, runs in milliseconds.
//
//   node flight/test/net/interp-bench.mjs
//
// Exported for test/flight-net.test.mjs, which asserts on the numbers.

import { createRemotes } from '../../packages/net/interp.js';
import { createJet } from '../../packages/sim/index.js';
import { PROFILES } from './shaper.mjs';
import { createSmoothness } from './smoothness.mjs';

export function benchInterp(profile, { seconds = 60, seed = 7, snapHz = 10, fps = 60, speed = 900, options } = {}) {
  const p = typeof profile === 'string' ? PROFILES[profile] : profile;
  let s = seed;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const remotes = createRemotes(options);
  const smooth = createSmoothness();
  const serverStart = 5_000_000;          // server clock is unrelated to the client's

  // Arrival times of each snapshot (ordered, like a TCP stream).
  const arrivals = [];
  let lastArrive = 0;
  for (let t = 0; t <= seconds * 1000; t += 1000 / snapHz) {
    let a = t + p.latency + (rng() * 2 - 1) * p.jitter;
    if (p.loss && rng() < p.loss) a += p.stall[0] + rng() * (p.stall[1] - p.stall[0]);
    a = Math.max(a, lastArrive);
    lastArrive = a;
    const jet = createJet({ z: -speed * t / 1000, heading: 0, speed });
    arrivals.push({ at: a, serverTime: serverStart + t, jet });
  }

  let k = 0;
  const warmup = 2000;
  let prevNow = null;
  for (let now = 0; now <= seconds * 1000; now += 1000 / fps) {
    while (k < arrivals.length && arrivals[k].at <= now) {
      const a = arrivals[k++];
      remotes.push(a.at, [{ id: 1, jet: a.jet }], a.serverTime);
    }
    remotes.sample(now);
    const r = remotes.remotes.get(1);
    if (!r?.view || now < warmup) { smooth.reset(); prevNow = now; continue; }
    smooth.sample(r.view.pos, speed, now - prevNow);
    prevNow = now;
  }
  return smooth.stats;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = Object.keys(PROFILES).map((name) => {
    const r = benchInterp(name);
    return { profile: name, hitchPct: r.hitchPct.toFixed(1), freezePct: r.freezePct.toFixed(1), jumpPct: r.jumpPct.toFixed(1), errP95: r.errP95.toFixed(2) };
  });
  console.table(rows);
}
