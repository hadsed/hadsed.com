// Flight sim: plain numbers in, plain numbers out. No DOM, no three.js.
// Runs identically in the browser (your jet) and on the server (bots).
//
// Frame: meters, +Y up, the jet looks down its local -Z, +X is the right wing.
// Origin is the center of the world's terrain tile.

export const STEP = 1 / 60;

export const LIMITS = {
  minSpeed: 300,        // m/s
  maxSpeed: 1000,       // m/s, about Mach 3.3 at altitude
  minAlt: 9000,         // m, clear of the tallest exaggerated peak
  maxAlt: 30000,        // m
  radius: 120000,       // m from origin before the jet steers itself home
};

const RATE = { roll: 1.6, pitch: 0.7, yaw: 0.25, turn: 0.5, level: 0.8, nose: 0.25, home: 0.2, throttle: 0.5 };

export function createJet({ x = 0, y = 25900, z = 0, heading = 0, speed = 900, throttle = 0.85 } = {}) {
  const q = [0, 0, 0, 1];
  axisAngle(q, 0, 1, 0, heading);
  return { pos: [x, y, z], q, speed, throttle, flags: 0 };
}

export function copyJet(dst, src) {
  dst.pos[0] = src.pos[0]; dst.pos[1] = src.pos[1]; dst.pos[2] = src.pos[2];
  dst.q[0] = src.q[0]; dst.q[1] = src.q[1]; dst.q[2] = src.q[2]; dst.q[3] = src.q[3];
  dst.speed = src.speed; dst.throttle = src.throttle; dst.flags = src.flags;
  return dst;
}

export const cloneJet = (j) => copyJet({ pos: [0, 0, 0], q: [0, 0, 0, 1] }, j);

const NO_INPUT = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
const tq = [0, 0, 0, 1], fwd = [0, 0, 0], right = [0, 0, 0];

// Advance one jet by dt seconds. intent axes are in [-1, 1]:
// pitch +1 nose up, roll +1 roll right, yaw +1 nose right, throttle +1 more power.
export function step(jet, intent = NO_INPUT, dt = STEP) {
  const q = jet.q;
  const pIn = intent.pitch || 0, rIn = intent.roll || 0, yIn = intent.yaw || 0;

  forwardOf(q, fwd);
  rightOf(q, right);
  const bank = Math.asin(clamp(-right[1], -1, 1));   // + when banked right
  const nose = Math.asin(clamp(fwd[1], -1, 1));      // + when nose up

  // Hands off means the jet settles back to level flight, which matters for
  // imprecise inputs like gestures and voice.
  let rollRate = rIn * RATE.roll;
  if (Math.abs(rIn) < 0.1) rollRate -= bank * RATE.level;
  let pitchRate = pIn * RATE.pitch;
  if (Math.abs(pIn) < 0.1) pitchRate -= nose * RATE.nose;

  const alt = jet.pos[1];
  if (alt > LIMITS.maxAlt - 2000 && fwd[1] > 0) pitchRate -= fwd[1] * 2 * ((alt - LIMITS.maxAlt + 2000) / 2000);
  if (alt < LIMITS.minAlt + 2000 && fwd[1] < 0) pitchRate -= fwd[1] * 2 * ((LIMITS.minAlt + 2000 - alt) / 2000);

  // Local rotations: pitch about +X, roll about -Z, yaw about -Y.
  mulAxis(q, 1, 0, 0, pitchRate * dt);
  mulAxis(q, 0, 0, 1, -rollRate * dt);
  mulAxis(q, 0, 1, 0, -yIn * RATE.yaw * dt);

  // Banking turns the jet around the world vertical (coordinated turn).
  let worldYaw = -Math.sin(bank) * RATE.turn;

  // Past the edge of the map, steer gently back toward the middle.
  const hx = jet.pos[0], hz = jet.pos[2];
  const dist = Math.hypot(hx, hz);
  if (dist > LIMITS.radius) {
    // Turning about +Y by a positive angle swings the nose toward (fwd.z, 0, -fwd.x).
    const toward = fwd[2] * -hx - fwd[0] * -hz;
    worldYaw += Math.sign(toward || 1) * RATE.home * Math.min(1, (dist - LIMITS.radius) / 20000);
  }
  preAxis(q, 0, 1, 0, worldYaw * dt);
  normalize(q);

  jet.throttle = clamp(jet.throttle + (intent.throttle || 0) * RATE.throttle * dt, 0, 1);
  const target = LIMITS.minSpeed + jet.throttle * (LIMITS.maxSpeed - LIMITS.minSpeed);
  forwardOf(q, fwd);
  jet.speed += (target - jet.speed) * 0.4 * dt - 25 * fwd[1] * dt;
  jet.speed = clamp(jet.speed, LIMITS.minSpeed * 0.8, LIMITS.maxSpeed * 1.05);

  jet.pos[0] += fwd[0] * jet.speed * dt;
  jet.pos[1] = clamp(jet.pos[1] + fwd[1] * jet.speed * dt, LIMITS.minAlt, LIMITS.maxAlt);
  jet.pos[2] += fwd[2] * jet.speed * dt;
  return jet;
}

// Blend two states for drawing between sim steps or network snapshots.
export function lerpJet(out, a, b, t) {
  for (let i = 0; i < 3; i++) out.pos[i] = a.pos[i] + (b.pos[i] - a.pos[i]) * t;
  slerp(out.q, a.q, b.q, t);
  out.speed = a.speed + (b.speed - a.speed) * t;
  out.throttle = b.throttle; out.flags = b.flags;
  return out;
}

// ---- small quaternion kit, allocation-free ----

export function forwardOf(q, out) { return rotate(q, 0, 0, -1, out); }
export function rightOf(q, out) { return rotate(q, 1, 0, 0, out); }
export function upOf(q, out) { return rotate(q, 0, 1, 0, out); }

export function rotate(q, vx, vy, vz, out) {
  const [x, y, z, w] = q;
  const ix = w * vx + y * vz - z * vy, iy = w * vy + z * vx - x * vz;
  const iz = w * vz + x * vy - y * vx, iw = -x * vx - y * vy - z * vz;
  out[0] = ix * w + iw * -x + iy * -z - iz * -y;
  out[1] = iy * w + iw * -y + iz * -x - ix * -z;
  out[2] = iz * w + iw * -z + ix * -y - iy * -x;
  return out;
}

function axisAngle(out, ax, ay, az, a) {
  const s = Math.sin(a / 2);
  out[0] = ax * s; out[1] = ay * s; out[2] = az * s; out[3] = Math.cos(a / 2);
  return out;
}

function mul(out, a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  out[0] = ax * bw + aw * bx + ay * bz - az * by;
  out[1] = ay * bw + aw * by + az * bx - ax * bz;
  out[2] = az * bw + aw * bz + ax * by - ay * bx;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
  return out;
}

const mulAxis = (q, x, y, z, a) => { if (a) mul(q, q, axisAngle(tq, x, y, z, a)); };
const preAxis = (q, x, y, z, a) => { if (a) mul(q, axisAngle(tq, x, y, z, a), q); };

export function normalize(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l;
  return q;
}

export function slerp(out, a, b, t) {
  let [bx, by, bz, bw] = b;
  let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (cos < 0) { cos = -cos; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let k0 = 1 - t, k1 = t;
  if (cos < 0.9995) {
    const o = Math.acos(cos), s = Math.sin(o);
    k0 = Math.sin(k0 * o) / s; k1 = Math.sin(k1 * o) / s;
  }
  out[0] = a[0] * k0 + bx * k1; out[1] = a[1] * k0 + by * k1;
  out[2] = a[2] * k0 + bz * k1; out[3] = a[3] * k0 + bw * k1;
  return normalize(out);
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
