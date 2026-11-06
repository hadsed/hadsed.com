// Network shaper: a TCP relay that sits between a client and the room server
// and makes the link behave like a real one. It works for any engine (Chromium,
// WebKit, Firefox, Node bots) because it shapes bytes, not browser APIs.
//
// WebSockets run on TCP, so packets are never "lost" from the app's point of
// view. A lost segment shows up as a stall: everything behind it waits for the
// retransmit (head-of-line blocking). That is what `loss` models here.
//
//   const s = await createShaper({ upstream: 'ws://127.0.0.1:8787', profile: '3g' });
//   s.url              // ws://127.0.0.1:<port>, point the client here
//   s.setProfile('wifi')
//   s.blackhole(15000) // hold every byte silently: a half-open socket (wifi -> cell)
//   s.cut()            // reset every connection: a clean drop
//   await s.close()
//
// CLI: node flight/test/net/shaper.mjs --upstream ws://127.0.0.1:8787 --profile 3g --port 8790

import net from 'node:net';

// One-way numbers (each direction gets these). rtt ~= 2 x latency.
// bandwidth is bytes/second, loss is the chance a chunk triggers a retransmit stall.
export const PROFILES = {
  ideal:   { latency: 0,   jitter: 0,   bandwidth: Infinity, loss: 0,     stall: [0, 0] },
  fiber:   { latency: 8,   jitter: 2,   bandwidth: 12.5e6,   loss: 0,     stall: [0, 0] },
  wifi:    { latency: 15,  jitter: 10,  bandwidth: 3e6,      loss: 0.002, stall: [200, 400] },
  '4g':    { latency: 40,  jitter: 25,  bandwidth: 1.2e6,    loss: 0.005, stall: [200, 500] },
  '3g':    { latency: 150, jitter: 80,  bandwidth: 90e3,     loss: 0.01,  stall: [300, 800] },
  edge:    { latency: 300, jitter: 150, bandwidth: 25e3,     loss: 0.02,  stall: [500, 1500] },
  // Busy hotel / conference wifi: fine on average, ugly bursts.
  hotel:   { latency: 30,  jitter: 120, bandwidth: 250e3,    loss: 0.03,  stall: [400, 2000] },
  // Long-haul from far away (e.g. Sydney to a US-East Durable Object).
  farAway: { latency: 110, jitter: 15,  bandwidth: 2e6,      loss: 0.002, stall: [250, 500] },
};

export async function createShaper({ upstream, profile = 'ideal', port = 0, host = '127.0.0.1', seed } = {}) {
  const up = new URL(upstream.replace(/^ws/, 'http'));
  const upPort = Number(up.port) || (up.protocol === 'https:' ? 443 : 80);
  if (up.protocol === 'https:') throw new Error('shaper relays plain ws:// upstreams; run the room server locally (wrangler dev)');
  let p = resolve(profile);
  let holdUntil = 0;
  const rng = seeded(seed ?? Date.now());
  const conns = new Set();
  const stats = { bytesDown: 0, bytesUp: 0, stalls: 0, connections: 0 };

  // One direction of one connection. Bytes leave in order; each chunk's
  // release time is pushed back by latency, jitter, bandwidth and stalls.
  function pipe(from, to, dir) {
    // One queue per direction, drained by one timer, so bytes can never
    // overtake each other (separate timers with equal deadlines can fire out
    // of order, which corrupts WebSocket framing).
    const queue = [];
    let lastRelease = 0, timer = null;
    const drain = () => {
      timer = null;
      const now = Date.now();
      while (queue.length && queue[0].t <= now && now >= holdUntil) {
        const { chunk } = queue.shift();
        if (!to.destroyed) { to.write(chunk); stats[dir] += chunk.length; }
      }
      if (queue.length) timer = setTimeout(drain, Math.max(1, Math.max(queue[0].t, holdUntil) - now));
    };
    from.on('data', (chunk) => {
      const now = Date.now();
      let t = now + p.latency + (p.jitter ? (rng() * 2 - 1) * p.jitter : 0);
      if (p.loss && rng() < p.loss) { t += p.stall[0] + rng() * (p.stall[1] - p.stall[0]); stats.stalls++; }
      if (Number.isFinite(p.bandwidth)) t = Math.max(t, lastRelease + (chunk.length / p.bandwidth) * 1000);
      t = Math.max(t, lastRelease);   // TCP keeps order
      lastRelease = t;
      queue.push({ t, chunk });
      if (!timer) timer = setTimeout(drain, Math.max(0, Math.max(t, holdUntil) - now));
    });
    from.on('close', () => clearTimeout(timer));
  }

  const server = net.createServer((client) => {
    stats.connections++;
    const server = net.connect(upPort, up.hostname);
    const pair = { client, server };
    conns.add(pair);
    client.setNoDelay(true); server.setNoDelay(true);
    pipe(client, server, 'bytesUp');
    pipe(server, client, 'bytesDown');
    const end = () => { conns.delete(pair); client.destroy(); server.destroy(); };
    client.on('close', end); server.on('close', end);
    client.on('error', end); server.on('error', end);
  });
  await new Promise((r) => server.listen(port, host, r));
  const addr = server.address();

  return {
    url: `ws://${host}:${addr.port}`,
    port: addr.port,
    stats,
    get profile() { return p; },
    setProfile(next) { p = resolve(next); },
    blackhole(ms) { holdUntil = Date.now() + ms; },
    cut() { for (const { client, server } of conns) { client.resetAndDestroy?.() ?? client.destroy(); server.destroy(); } conns.clear(); },
    close() { this.cut(); return new Promise((r) => server.close(r)); },
  };
}

function resolve(profile) {
  if (typeof profile === 'object') return { ...PROFILES.ideal, ...profile };
  const p = PROFILES[profile];
  if (!p) throw new Error(`unknown network profile "${profile}" (have: ${Object.keys(PROFILES).join(', ')})`);
  return p;
}

function seeded(s) {
  s = Math.floor(s) % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
  const s = await createShaper({ upstream: arg('upstream', 'ws://127.0.0.1:8787'), profile: arg('profile', '3g'), port: Number(arg('port', 8790)) });
  console.log(`shaping ${arg('upstream', 'ws://127.0.0.1:8787')} as "${arg('profile', '3g')}" on ${s.url}`);
}
