// Attract mode: the flight app as the site's backdrop, before anyone presses Fly.
//
// Your jet flies itself near the live jets so they show up behind it in the
// backdrop's framing: it picks the nearest jet and keeps it at a fixed spot
// behind-left of itself, measured in its own heading frame, so from the
// backdrop camera (off the right wing, looking back) the other jet stays in
// the background wherever it points. Our own heading only eases toward the
// other jet's, so the backdrop jet banks gently even when a bot turns hard.
// With nobody around it loiters over the backdrop's own patch of the Sierra.
//
// Pure sim-level logic: no DOM, no three.js. main.js owns the switch.
//
// const pilot = createAttractPilot();
// pilot.place(remotes)              // before the backdrop is shown: start next to a jet
// step(jet, pilot.think(jet, remotes, dt), dt)
// pilot.hold(jet, dt)                // after the step: settle into the slot
//
// Nobody else sees the backdrop jet (a watcher has no seat), so it is allowed
// to cheat: hold() pulls it toward its slot directly, at most a few hundred
// m/s, which at 60,000 ft barely moves the ground but keeps the other jet
// framed even while its interpolated position is still settling after load.
import { steerTo } from './packages/sim/assist.js';
import { createJet, forwardOf, clamp } from './packages/sim/index.js';

// The backdrop lab's spot: 79 km east, 69.1 km north of the tile centre, 85,000 ft, nose north.
export const HOME = { x: 79000, y: 25908, z: -69100, heading: 0 };

// Where we sit relative to the jet we keep company with, in its heading frame
// (+right, +ahead, +up, meters). The backdrop camera looks back past our left
// side, so a jet behind-left of us is in the background. Solved against the
// backdrop lens: wide screens put it left of our tail near the horizon,
// portrait phones (narrower view) just above our jet.
export const SLOTS = {
  wide: { right: 270, ahead: 480, up: 90 },
  tall: { right: 400, ahead: 410, up: 14 },
};
const NEAR = 60000;   // only bother with jets this close
const PULL = 1.2;     // seconds to close most of the gap to the slot
const MAX_PULL = 600; // m/s of correction, so a far-off slot is reached by flying, not sliding

const f = [0, 0, 0];

export function createAttractPilot({ home = HOME, rng = Math.random, slot: SLOT = SLOTS.wide } = {}) {
  const intent = { pitch: 0, roll: 0, yaw: 0, throttle: 0, boost: false };
  const me = { lead: null, leadFor: 0, wobble: rng() * 100, slot: SLOT };

  // Where we should be: the lead at SLOT's spot relative to us, in `frame`'s heading.
  function slotOf(lead, frame, out) {
    forwardOf(frame.q, f);
    const n = Math.hypot(f[0], f[2]) || 1, fx = f[0] / n, fz = f[2] / n;
    const S = me.slot;
    out[0] = lead.pos[0] + -fz * S.right + fx * S.ahead;
    out[1] = lead.pos[1] + S.up;
    out[2] = lead.pos[2] + fx * S.right + fz * S.ahead;
    return out;
  }

  function nearest(jet, remotes, within = NEAR) {
    let best = null, bestD = within;
    for (const r of remotes) {
      if (!r.view || !r.visible) continue;
      const d = Math.hypot(r.view.pos[0] - jet.pos[0], r.view.pos[2] - jet.pos[2]);
      if (d < bestD) { bestD = d; best = r; }
    }
    return best;
  }

  const slot = [0, 0, 0];
  let current = null;   // the lead's view this tick, for hold()
  return {
    me,
    // Meters from our slot (Infinity with nobody to keep company with).
    gap(jet) {
      if (!current) return Infinity;
      slotOf(current, jet, slot);
      return Math.hypot(slot[0] - jet.pos[0], slot[1] - jet.pos[1], slot[2] - jet.pos[2]);
    },
    hold(jet, dt) {
      if (!current) return;
      slotOf(current, jet, slot);
      const k = 1 - Math.exp(-dt / PULL);
      let dx = (slot[0] - jet.pos[0]) * k, dy = (slot[1] - jet.pos[1]) * k, dz = (slot[2] - jet.pos[2]) * k;
      const d = Math.hypot(dx, dy, dz), max = MAX_PULL * dt;
      if (d > max) { dx *= max / d; dy *= max / d; dz *= max / d; }
      jet.pos[0] += dx; jet.pos[1] += dy; jet.pos[2] += dz;
    },
    // A fresh jet already in the slot next to the nearest live jet (or home).
    place(remotes) {
      // The live jet nearest the backdrop's own spot, so the ground stays close to the lab's.
      const best = nearest({ pos: [home.x, home.y, home.z] }, remotes, Infinity);
      if (!best) return createJet({ ...home, speed: 700, throttle: 0.7 });
      slotOf(best.view, best.view, slot);
      forwardOf(best.view.q, f);
      me.lead = best.id; me.leadFor = 90;
      return createJet({ x: slot[0], y: slot[1], z: slot[2], heading: Math.atan2(-f[0], -f[2]), speed: best.view.speed, throttle: 0.75 });
    },
    think(jet, remotes, dt) {
      me.wobble += dt;
      me.leadFor -= dt;
      let lead = me.lead !== null ? remotes.find((r) => r.id === me.lead && r.view && r.visible) : null;
      if (!lead || me.leadFor <= 0) {
        const n = nearest(jet, remotes);
        if (n && n !== lead) { lead = n; me.lead = n.id; me.leadFor = 90 + rng() * 120; }
        else if (!n) { lead = null; me.lead = null; }
        else me.leadFor = 60;
      }
      intent.yaw = 0;
      current = lead ? lead.view : null;
      if (lead) {
        const l = lead.view;
        slotOf(l, jet, slot);
        forwardOf(l.q, f);
        // Ease toward the other jet's heading: aim far down its line, gently. hold() does
        // the positioning, so the steering only keeps the two roughly parallel.
        steerTo(intent, jet, slot[0] + f[0] * 20000, slot[1], slot[2] + f[2] * 20000, 0.45);
        const dx = slot[0] - jet.pos[0], dz = slot[2] - jet.pos[2];
        forwardOf(jet.q, f);
        const along = dx * f[0] + dz * f[2];
        const want = l.speed + clamp(along * 0.08, -150, 250);
        intent.throttle = clamp((want - jet.speed) / 40, -1, 1);
        intent.boost = Math.hypot(dx, dz) > 3000 && along > 0;
      } else {
        // Nobody about: loiter over the backdrop's patch, in long lazy curves.
        forwardOf(jet.q, f);
        const away = Math.hypot(home.x - jet.pos[0], home.z - jet.pos[2]);
        if (away > 15000) steerTo(intent, jet, home.x, home.y, home.z, 0.4);
        else steerTo(intent, jet, jet.pos[0] + f[0] * 8000, home.y, jet.pos[2] + f[2] * 8000, 0.4);
        intent.roll = clamp(intent.roll + Math.sin(me.wobble * 0.05) * 0.04, -1, 1);
        intent.throttle = clamp(0.7 - jet.throttle, -1, 1);
        intent.boost = false;
      }
      return intent;
    },
  };
}
