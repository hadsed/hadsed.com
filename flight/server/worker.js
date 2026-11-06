// Cloudflare Worker + Durable Object shell around room.js.
//
// GET /room/<world>  (WebSocket upgrade)
//   -> the Worker tries room instances <world>-1, <world>-2, ... until one
//      accepts. Each instance is one Durable Object holding one shared sky.
//      Past MAX_INSTANCES the visitor gets a "full" message and flies solo.
// GET /health -> ok

import { DurableObject } from 'cloudflare:workers';
import { createRoom } from './room.js';
import { VERSION } from '../packages/net/protocol.js';

const WORLDS = new Set(['sierra', 'alps', 'himalaya', 'denali', 'grandcanyon']);
const ORIGINS = [/^https:\/\/(www\.)?hadsed\.com$/, /^https:\/\/([a-z0-9-]+\.)?hadsed-com\.pages\.dev$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/health') return new Response('ok');
    const m = url.pathname.match(/^\/room\/([a-z0-9-]+)$/);
    if (!m) return new Response('not found', { status: 404 });
    if (env.FLIGHT_ENABLED === '0') return new Response('paused', { status: 503 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const origin = req.headers.get('Origin') || '';
    if (!ORIGINS.some((re) => re.test(origin))) return new Response('forbidden', { status: 403 });
    if (url.searchParams.get('v') !== String(VERSION)) return new Response('old client', { status: 409 });
    const world = WORLDS.has(m[1]) ? m[1] : 'sierra';

    const max = Number(env.MAX_INSTANCES || 20);
    for (let i = 1; i <= max; i++) {
      const stub = env.ROOMS.get(env.ROOMS.idFromName(`${world}-${i}`));
      const res = await stub.fetch(req);
      if (res.status !== 503) return res;
    }
    // Every copy is full: accept the socket only to say so, then the client flies solo.
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    server.send(JSON.stringify({ t: 'full' }));
    server.close(4001, 'full');
    return new Response(null, { status: 101, webSocket: client });
  },
};

export class FlightRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = createRoom({ capacity: Number(env.ROOM_CAPACITY || 200), perIp: Number(env.PER_IP || 4) });
    this.timer = null;
  }

  async fetch(req) {
    const [client, server] = Object.values(new WebSocketPair());
    // Newer compatibility dates deliver binary frames as Blob; room.js wants ArrayBuffer.
    server.binaryType = 'arraybuffer';
    server.accept();
    const seat = this.room.join({
      send: (d) => { try { server.send(d); } catch {} },
      close: (code, why) => { try { server.close(code, why); } catch {} },
      ip: req.headers.get('CF-Connecting-IP') || '',
    });
    if (!seat) {
      server.close(4001, 'full');
      return new Response('full', { status: 503 });
    }
    server.addEventListener('message', (e) => {
      if (typeof e.data !== 'string') this.room.receive(seat.id, e.data);
    });
    const gone = () => { this.room.leave(seat.id); this.idle(); };
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    this.start();
    return new Response(null, { status: 101, webSocket: client });
  }

  // Tick only while someone is flying; an empty room does no work.
  start() {
    if (this.timer) return;
    let last = Date.now();
    this.timer = setInterval(() => {
      const t = Date.now();
      this.room.tick(Math.min(0.25, (t - last) / 1000));
      last = t;
      this.idle();
    }, 100);
  }

  idle() {
    if (this.room.humans === 0 && this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}
