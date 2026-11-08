// Wire format. Binary for the hot path (positions, many times a second),
// JSON for rare messages (welcome, roster). Shared by browser and server.
//
// client -> server  STATE     u8 type=1, u16 sent ms, jet             (26 bytes)
// server -> client  SNAPSHOT  u8 type=2, u32 time ms, u16 n, n x (u16 id, u16 age ms, jet)
// jet = f32 x, f32 y, f32 z, i16 qx, qy, qz, qw, u16 speed (m/s * 50), u8 flags  (23 bytes)
//
// There is deliberately no field that says whether a jet is a person or a bot.

export const VERSION = 2;
export const MSG = { STATE: 1, SNAPSHOT: 2 };
export const JET_BYTES = 23;
export const SNAP_HEADER = 7;
export const ENTRY_BYTES = 4 + JET_BYTES;

// SMOKE / FIRE: a damaged jet trails them. DOWN: crashed; its position is the wreck until it
// respawns. Clients that don't know these bits just ignore them.
export const FLAG = { WAGGLE: 1, BOOST: 2, SMOKE: 4, FIRE: 8, DOWN: 16 };

function writeJet(dv, o, jet) {
  dv.setFloat32(o, jet.pos[0], true);
  dv.setFloat32(o + 4, jet.pos[1], true);
  dv.setFloat32(o + 8, jet.pos[2], true);
  for (let i = 0; i < 4; i++) dv.setInt16(o + 12 + i * 2, Math.round(clamp1(jet.q[i]) * 32767), true);
  dv.setUint16(o + 20, Math.min(65535, Math.max(0, Math.round(jet.speed * 50))), true);
  dv.setUint8(o + 22, jet.flags & 255);
}

function readJet(dv, o, jet) {
  jet.pos[0] = dv.getFloat32(o, true);
  jet.pos[1] = dv.getFloat32(o + 4, true);
  jet.pos[2] = dv.getFloat32(o + 8, true);
  let l = 0;
  for (let i = 0; i < 4; i++) { jet.q[i] = dv.getInt16(o + 12 + i * 2, true) / 32767; l += jet.q[i] ** 2; }
  l = Math.sqrt(l) || 1;
  for (let i = 0; i < 4; i++) jet.q[i] /= l;
  jet.speed = dv.getUint16(o + 20, true) / 50;
  jet.flags = dv.getUint8(o + 22);
  return jet;
}

const clamp1 = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);
const blankJet = () => ({ pos: [0, 0, 0], q: [0, 0, 0, 1], speed: 0, throttle: 0, flags: 0 });

// `sent` is the client's clock in ms (it wraps every 65 s; only differences
// matter). The server uses it to tell how stale each report is when it lands,
// so a report that sat in a congested link is carried forward the right amount.
export const STATE_BYTES = 3 + JET_BYTES;

export function encodeState(jet, sent = performance.now()) {
  const buf = new ArrayBuffer(STATE_BYTES);
  const dv = new DataView(buf);
  dv.setUint8(0, MSG.STATE);
  dv.setUint16(1, Math.round(sent) & 0xffff, true);
  writeJet(dv, 3, jet);
  return buf;
}

// Returns a jet, or null if the message is malformed.
// The jet gets a `sent` field (u16 ms) alongside the usual ones.
export function decodeState(buf, into = blankJet()) {
  if (!(buf instanceof ArrayBuffer) || buf.byteLength !== STATE_BYTES) return null;
  const dv = new DataView(buf);
  if (dv.getUint8(0) !== MSG.STATE) return null;
  into.sent = dv.getUint16(1, true);
  readJet(dv, 3, into);
  if (![...into.pos, ...into.q, into.speed].every(Number.isFinite)) return null;
  return into;
}

// entries: array of { id, jet, age }. age is how old that jet's state is at
// `time` (ms), so clients can place every jet on the timeline where it really
// was, however unevenly its reports reached the server.
export function encodeSnapshot(time, entries) {
  const buf = new ArrayBuffer(SNAP_HEADER + entries.length * ENTRY_BYTES);
  const dv = new DataView(buf);
  dv.setUint8(0, MSG.SNAPSHOT);
  dv.setUint32(1, time >>> 0, true);
  dv.setUint16(5, entries.length, true);
  let o = SNAP_HEADER;
  for (const { id, jet, age = 0 } of entries) {
    dv.setUint16(o, id, true);
    dv.setUint16(o + 2, Math.min(65535, Math.max(0, Math.round(age))), true);
    writeJet(dv, o + 4, jet);
    o += ENTRY_BYTES;
  }
  return buf;
}

export function decodeSnapshot(buf) {
  const dv = new DataView(buf);
  if (buf.byteLength < SNAP_HEADER || dv.getUint8(0) !== MSG.SNAPSHOT) return null;
  const time = dv.getUint32(1, true);
  const n = dv.getUint16(5, true);
  if (buf.byteLength !== SNAP_HEADER + n * ENTRY_BYTES) return null;
  const entries = new Array(n);
  let o = SNAP_HEADER;
  for (let i = 0; i < n; i++) {
    entries[i] = { id: dv.getUint16(o, true), age: dv.getUint16(o + 2, true), jet: readJet(dv, o + 4, blankJet()) };
    o += ENTRY_BYTES;
  }
  return { time, entries };
}
