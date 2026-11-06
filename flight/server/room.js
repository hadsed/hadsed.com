// One shared sky. Pure logic with no Cloudflare APIs, so it runs in tests and
// in a Durable Object alike. The Durable Object (worker.js) only moves bytes.
//
// const room = createRoom();
// const seat = room.join({ send, close, ip });  // null when full
// room.receive(seat.id, arrayBuffer);
// room.tick(0.1);                                // 10 Hz: steps bots, sends snapshots
// room.leave(seat.id);
//
// Watchers (the site backdrop, before anyone presses Fly) see the sky without
// being in it: no jet, no callsign, nothing in any snapshot or roster.
// const w = room.watch({ send, close, ip });      // null when the IP is over its cap
// room.receive(w.id, buf)                          // their camera jet, for "nearest 48" only
// room.upgrade(w.id)                               // pressed Fly: same socket, now a seat
// room.downgrade(seat.id)                          // back to the site: a watcher again

import { createJet, step, LIMITS, STEP, forwardOf, copyJet, cloneJet } from '../packages/sim/index.js';
import { decodeState, encodeSnapshot } from '../packages/net/protocol.js';
import { createPilot } from '../packages/bots/pilot.js';

const WORDS = ['KITE', 'RAVEN', 'NOMAD', 'ECHO', 'DRIFT', 'COMET', 'LARK', 'ATLAS', 'ORBIT', 'SABLE',
  'VESPER', 'HALO', 'RIVET', 'TALON', 'MAVEN', 'QUILL', 'EMBER', 'FABLE', 'GLINT', 'HERON', 'JUNO',
  'KESTREL', 'LUMEN', 'MOTH', 'NOVA', 'OPAL', 'PIKE', 'RUNE', 'SWIFT', 'TEMPO', 'UMBRA', 'WREN'];

export function createRoom({
  now = () => Date.now(),
  rng = Math.random,
  capacity = 200,       // jets (people + bots) before the room reports full
  near = 48,            // jets each person receives
  botFill = 6,          // keep at least this many jets in the sky while anyone flies
  maxBots = 8,
  perIp = 16,           // sockets per IP per room copy; families, offices and carrier NAT share IPs
  idleMs = 120000,
  maxWatchers = 1000,   // backdrop viewers per room copy; they cost one snapshot each per tick
} = {}) {
  const ents = new Map();       // id -> { id, callsign, jet, human, conn, ip, ... }
  const watchers = new Map();   // 'w<n>' -> { conn, ip, pos, lastSeen, tokens }
  let nextId = 1, nextWatch = 1;
  let botTimer = 0;
  // Bots advance in whole sim steps. The leftover fraction carries to the next
  // tick, and snapshots are stamped with the moment the sim has reached, so a late
  // tick never puts 100 ms of flight into a 130 ms gap (a client would draw that
  // as every jet stuttering at once).
  let carry = 0, simAt = null;
  const fwd = [0, 0, 0];

  const humans = () => [...ents.values()].filter((e) => e.human);
  const bots = () => [...ents.values()].filter((e) => !e.human);
  const sockets = (ip) => humans().filter((e) => e.ip === ip).length + [...watchers.values()].filter((w) => w.ip === ip).length;
  // Anyone looking keeps the sky alive: people flying, or the backdrop watching.
  const present = () => humans().length + watchers.size;

  function newId() {
    for (let i = 0; i < 65535; i++) {
      const id = nextId; nextId = nextId >= 65535 ? 1 : nextId + 1;
      if (!ents.has(id)) return id;
    }
    return null;
  }

  function newCallsign() {
    const taken = new Set([...ents.values()].map((e) => e.callsign));
    for (let i = 0; i < 50; i++) {
      const c = `${WORDS[Math.floor(rng() * WORDS.length)]} ${String(10 + Math.floor(rng() * 90))}`;
      if (!taken.has(c)) return c;
    }
    return `JET ${Math.floor(rng() * 9000) + 1000}`;
  }

  // Spawn behind someone already flying so new arrivals find company.
  function spawnPoint(far = false) {
    const pool = [...ents.values()].filter((e) => e.jet);
    if (pool.length && !far) {
      const other = pool[Math.floor(rng() * pool.length)].jet;
      forwardOf(other.q, fwd);
      const back = 12000 + rng() * 15000, off = (rng() - 0.5) * 8000;
      const heading = Math.atan2(-fwd[0], -fwd[2]);
      return {
        x: clampR(other.pos[0] - fwd[0] * back + fwd[2] * off),
        y: Math.min(LIMITS.maxAlt - 1500, Math.max(LIMITS.minAlt + 3000, other.pos[1] + (rng() - 0.5) * 3000)),
        z: clampR(other.pos[2] - fwd[2] * back - fwd[0] * off),
        heading,
      };
    }
    const a = rng() * Math.PI * 2, d = far ? 60000 + rng() * 40000 : rng() * 40000;
    return { x: Math.cos(a) * d, y: 20000 + rng() * 7000, z: Math.sin(a) * d, heading: Math.PI / 2 - a + (rng() - 0.5) };   // facing the middle
  }

  function broadcast(msg, except) {
    const s = JSON.stringify(msg);
    for (const e of ents.values()) if (e.human && e.id !== except) e.conn.send(s);
    for (const w of watchers.values()) w.conn.send(s);
  }

  const rosterOf = (skip) => [...ents.values()].filter((o) => o !== skip).map((o) => [o.id, o.callsign]);

  function addBot(far) {
    if (ents.size >= capacity) return null;
    const id = newId();
    const sp = spawnPoint(far);
    const e = {
      id, callsign: newCallsign(), human: false,
      jet: createJet({ x: sp.x, y: sp.y, z: sp.z, heading: sp.heading, speed: 850, throttle: 0.8 }),
      pilot: createPilot({ rng }),
      lifeLeft: 180 + rng() * 540,
    };
    ents.set(id, e);
    broadcast({ t: 'roster', add: [[id, e.callsign]] });
    return e;
  }

  function drop(id) {
    if (!ents.delete(id)) return;
    broadcast({ t: 'roster', remove: [id] });
  }

  function manageBots(dt) {
    const h = humans().length;
    const b = bots();
    if (!present()) { for (const e of b) ents.delete(e.id); botTimer = 0; return; }
    for (const e of b) { e.lifeLeft -= dt; if (e.lifeLeft <= 0) drop(e.id); }
    const want = Math.max(0, Math.min(maxBots, botFill - h));
    const have = bots().length;
    botTimer -= dt;
    if (botTimer > 0) return;
    if (have < want) addBot(true);
    else if (have > want) drop(bots()[0].id);
    botTimer = 4 + rng() * 11;
  }

  function snapshotFor(me, p = me.jet.pos) {
    const list = [];
    for (const e of ents.values()) {
      if (e === me || !e.jet) continue;
      const dx = e.jet.pos[0] - p[0], dy = e.jet.pos[1] - p[1], dz = e.jet.pos[2] - p[2];
      list.push({ id: e.id, jet: e.human ? e.jet : e.view || e.jet, age: e.ageNow || 0, d: dx * dx + dy * dy + dz * dz });
    }
    if (list.length > near) { list.sort((a, b) => a.d - b.d); list.length = near; }
    return encodeSnapshot(simAt ?? now(), list);
  }

  return {
    ents,
    watchers,
    get humans() { return humans().length; },
    get watching() { return watchers.size; },
    // Whether the room has anyone to tick for (the Durable Object stops its timer at 0).
    get present() { return present(); },
    get size() { return ents.size; },

    join({ send, close = () => {}, ip = '', at = null, warm = false }) {
      if (ents.size >= capacity && !bots().length) return null;
      if (ip && sockets(ip) >= perIp) return null;
      if (ents.size >= capacity) drop(bots()[0].id);   // people outrank bots
      const id = newId();
      if (id === null) return null;
      // The sky should already look alive when the first person arrives.
      if (!warm && !present()) { for (let i = 0; i < 3; i++) addBot(false); botTimer = 3 + rng() * 5; }
      const sp = spawnPoint(false);
      const e = {
        id, callsign: newCallsign(), human: true, conn: { send, close }, ip,
        jet: createJet({ x: sp.x, y: sp.y, z: sp.z, heading: sp.heading }),
        lastAt: now(), lastSeen: now(), tokens: 30,
      };
      // A watcher pressing Fly is already somewhere in the sky: start there.
      if (at) { e.jet.pos[0] = clampR(at[0]); e.jet.pos[1] = at[1]; e.jet.pos[2] = clampR(at[2]); }
      ents.set(id, e);
      send(JSON.stringify({ t: 'welcome', id, callsign: e.callsign, spawn: sp }));
      send(JSON.stringify({ t: 'roster', add: rosterOf(e) }));
      broadcast({ t: 'roster', add: [[id, e.callsign]] }, id);
      return { id, callsign: e.callsign, spawn: sp };
    },

    // Look without flying. Sees the same snapshots a person nearby would.
    watch({ send, close = () => {}, ip = '', at = null }) {
      if (watchers.size >= maxWatchers) return null;
      if (ip && sockets(ip) >= perIp) return null;
      if (!at && !present()) { for (let i = 0; i < 3; i++) addBot(false); botTimer = 3 + rng() * 5; }
      const id = `w${nextWatch++}`;
      watchers.set(id, { id, conn: { send, close }, ip, pos: at ? [...at] : [0, 25900, 0], lastSeen: now(), tokens: 30 });
      send(JSON.stringify({ t: 'watching' }));
      send(JSON.stringify({ t: 'roster', add: rosterOf(null) }));
      return { id };
    },

    // Pressed Fly. Returns the new seat (as join does), or null if the room is full.
    upgrade(wid) {
      const w = watchers.get(wid);
      if (!w) return null;
      watchers.delete(wid);
      const seat = this.join({ send: w.conn.send, close: w.conn.close, ip: w.ip, at: w.pos, warm: true });
      if (!seat) watchers.set(wid, w);
      return seat;
    },

    // Left the sky for the site. Their jet goes; their view of the sky stays.
    downgrade(id) {
      const e = ents.get(id);
      if (!e?.human) return null;
      ents.delete(id);
      const w = this.watch({ send: e.conn.send, close: e.conn.close, ip: e.ip, at: e.jet.pos });
      broadcast({ t: 'roster', remove: [id] });
      return w;
    },

    leave(id) {
      if (watchers.delete(id)) { if (!present()) for (const e of bots()) ents.delete(e.id); return; }
      drop(id);
      if (!present()) for (const e of bots()) ents.delete(e.id);
    },

    // Client reports its own jet. Trusted only within what a jet could do.
    receive(id, buf) {
      const w = watchers.get(id);
      if (w) {
        const t = now();
        w.tokens = Math.min(30, w.tokens + ((t - w.lastSeen) / 1000) * 20);
        w.lastSeen = t;
        if (w.tokens < 1) return false;
        w.tokens -= 1;
        const jet = decodeState(buf);
        if (!jet) return false;
        w.pos[0] = clampR(jet.pos[0]); w.pos[2] = clampR(jet.pos[2]);
        w.pos[1] = Math.min(LIMITS.maxAlt, Math.max(LIMITS.minAlt, jet.pos[1]));
        return true;
      }
      const e = ents.get(id);
      if (!e?.human) return false;
      const t = now();
      e.tokens = Math.min(30, e.tokens + ((t - e.lastSeen) / 1000) * 20);
      e.lastSeen = t;
      if (e.tokens < 1) return false;
      e.tokens -= 1;
      const jet = decodeState(buf);
      if (!jet) return false;
      // The first report from a new seat may be anywhere in the world: a
      // reconnecting client keeps flying where it was, not at our spawn point.
      if (e.placed) {
        const dt = Math.max(0.05, (t - e.lastAt) / 1000);
        const jump = Math.hypot(jet.pos[0] - e.jet.pos[0], jet.pos[1] - e.jet.pos[1], jet.pos[2] - e.jet.pos[2]);
        if (jump > LIMITS.maxSpeed * 1.5 * dt + 3000) return false;
      }
      jet.pos[0] = clampR(jet.pos[0]);
      jet.pos[2] = clampR(jet.pos[2]);
      e.placed = true;
      jet.pos[1] = Math.min(LIMITS.maxAlt, Math.max(LIMITS.minAlt, jet.pos[1]));
      jet.speed = Math.min(LIMITS.maxSpeed * 1.1, Math.max(0, jet.speed));
      // How much later than usual did this report land? Compare its client
      // timestamp with our clock; the fastest recent report sets "usual".
      const raw = (t - jet.sent) & 0xffff;
      e.lagBase ??= raw;
      const lag = ((raw - e.lagBase + 32768) & 0xffff) - 32768;
      (e.lags ||= []).push(lag);
      if (e.lags.length > 50) e.lags.shift();
      e.age = Math.min(500, lag - Math.min(...e.lags));
      e.jet = jet;
      e.lastAt = t;
      return true;
    },

    // Call at the broadcast rate (10 Hz). Bots step at the sim rate in between.
    tick(dt = 0.1) {
      manageBots(dt);
      const others = [...ents.values()].map((e) => ({ id: e.id, jet: e.jet, human: e.human }));
      carry += dt;
      const steps = Math.floor(carry / STEP + 1e-6);
      carry = Math.max(0, carry - steps * STEP);
      for (const e of ents.values()) {
        if (e.human) continue;
        const intent = e.pilot.think(e.jet, { dt, others });
        for (let i = 0; i < steps; i++) step(e.jet, intent, STEP);
      }
      const t = simAt = now() - carry * 1000;
      // Every jet goes out with its age: how long before this snapshot its
      // state was true. People's reports land out of phase with this tick and
      // through links that bunch packets up, so they are 0 to several hundred
      // ms old. Bots are fresh, so they get a made-up age in the same range and
      // are wound back to match; no field on the wire tells the two apart.
      for (const e of ents.values()) {
        if (e.human) { e.ageNow = e.placed ? Math.max(0, Math.min(2000, t - e.lastAt + (e.age || 0))) : 0; continue; }
        e.phase ??= 20 + rng() * 90;
        e.ageNow = Math.round(e.phase + rng() * 25);
        e.view = copyJet(e.view || cloneJet(e.jet), e.jet);
        forwardOf(e.jet.q, fwd);
        for (let k = 0; k < 3; k++) e.view.pos[k] -= fwd[k] * e.jet.speed * (e.ageNow / 1000);
      }
      for (const e of [...ents.values()]) {
        if (!e.human) continue;
        if (now() - e.lastAt > idleMs) { e.conn.close(4000, 'idle'); drop(e.id); continue; }
        e.conn.send(snapshotFor(e));
      }
      for (const w of [...watchers.values()]) {
        if (now() - w.lastSeen > idleMs) { watchers.delete(w.id); w.conn.close(4000, 'idle'); continue; }
        w.conn.send(snapshotFor(null, w.pos));
      }
    },
  };
}

const clampR = (v) => Math.max(-LIMITS.radius, Math.min(LIMITS.radius, v));
