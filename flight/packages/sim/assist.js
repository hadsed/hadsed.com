// Flight assists: turn "go that way" into stick inputs for the sim.
//
// steerTo() is the autopilot core: given a point in the world, it banks and
// pitches the jet toward it. Bots use it, follow mode uses it, and the
// point-to-steer controls below use it.
//
// createAssist() is a self-centering assist. Stick deflection means "turn
// that way, this hard": the jet banks into the turn on its own, and the
// moment you let go it rolls wings level and holds the heading it has. There
// is no hidden aim point to chase, so a correction always takes effect at once.
import { forwardOf, rightOf, rotate, clamp } from './index.js';

const f = [0, 0, 0], r = [0, 0, 0], loc = [0, 0, 0];

export function steerTo(intent, jet, tx, ty, tz, aggressive = 1, maxNose = 0.35) {
  // Target direction in the jet's own frame (inverse rotation).
  const q = jet.q;
  const inv = [-q[0], -q[1], -q[2], q[3]];
  rotate(inv, tx - jet.pos[0], ty - jet.pos[1], tz - jet.pos[2], loc);
  forwardOf(q, f); rightOf(q, r);
  const bank = Math.asin(clamp(-r[1], -1, 1));
  const nose = Math.asin(clamp(f[1], -1, 1));
  const ahead = -loc[2], side = loc[0];
  const heading = Math.atan2(side, ahead);                 // + means target is to the right
  const wantBank = clamp(heading * 1.6 * aggressive, -1.0, 1.0);
  intent.roll = clamp((wantBank - bank) * 2.5, -1, 1);
  // Climb angle wanted: the target's elevation in the world, not in the jet's
  // frame (banked, a point off to the side reads as "up" and the jet would climb
  // in every hard turn).
  const dx = tx - jet.pos[0], dy = ty - jet.pos[1], dz = tz - jet.pos[2];
  const wantNose = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -maxNose, maxNose);
  intent.pitch = clamp((wantNose - nose) * 3, -1, 1);
  return intent;
}

// Compass heading of a jet: forward = (-sin h, 0, -cos h).
export function headingOf(q) {
  forwardOf(q, f);
  return Math.atan2(-f[0], -f[2]);
}

// const assist = createAssist();
// assist.update(intent, jet, aimX, aimY, dt)   // aimX + right, aimY + up, in [-1, 1]
// assist.direction(out)                         // where the reticle points
export function createAssist({ maxTurn = 0.75, maxPitch = 0.85, gain = 1.1 } = {}) {
  const aim = { yaw: null, pitch: 0 };
  const dir = [0, 0, 0];
  const api = {
    aim,
    reset(jet) { aim.yaw = headingOf(jet.q); aim.pitch = 0; },
    update(intent, jet, ax = 0, ay = 0, dt = 1 / 60) {
      // Turns get a soft center (small drags do little); climbs and dives are
      // nearly linear, so up and down answer as readily as left and right.
      const soft = (v, k) => Math.sign(v) * Math.abs(v) ** k;
      aim.yaw = headingOf(jet.q) - soft(ax, 1.3) * maxTurn;
      aim.pitch = soft(ay, 1.05) * maxPitch;
      const d = api.direction(dir);
      steerTo(intent, jet, jet.pos[0] + d[0] * 8000, jet.pos[1] + d[1] * 8000, jet.pos[2] + d[2] * 8000, gain, maxPitch);
      intent.yaw = 0;
      return intent;
    },
    direction(out = [0, 0, 0]) {
      const cp = Math.cos(aim.pitch);
      out[0] = -Math.sin(aim.yaw ?? 0) * cp;
      out[1] = Math.sin(aim.pitch);
      out[2] = -Math.cos(aim.yaw ?? 0) * cp;
      return out;
    },
  };
  return api;
}
