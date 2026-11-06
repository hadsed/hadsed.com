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
import { createJet, forwardOf, rightOf, clamp } from './packages/sim/index.js';

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
const NEAR = 8000;    // only keep company with jets this close; chasing a far one means long hard turns
// The backdrop sits behind text people are reading, so it keeps company only with
// jets flying calmly: not boosting, turning under 2.5 deg/s. Anyone busier is left alone.
const CALM_TURN = 2.5 * Math.PI / 180;
const BOOST = 2;
const PULL = 4;       // seconds to close most of the gap to the slot
const MAX_PULL = 200; // m/s of correction, so a far-off slot is reached by flying, not sliding

const f = [0, 0, 0], rt = [0, 0, 0];
const MAX_BANK = 4 * Math.PI / 180;    // a slow lean, never a turn you notice

// Turn toward a compass heading and hold an altitude, gently: bank at most
// MAX_BANK, nose within a degree or two of level.
function ease(intent, jet, heading, alt) {
  forwardOf(jet.q, f); rightOf(jet.q, rt);
  const h = Math.atan2(-f[0], -f[2]);
  const err = Math.atan2(Math.sin(heading - h), Math.cos(heading - h));   // + means turn left
  const bank = Math.asin(clamp(-rt[1], -1, 1));                          // + banked right
  const want = clamp(-err * 0.8, -MAX_BANK, MAX_BANK);
  intent.roll = clamp((want - bank) * 2, -1, 1);
  const nose = Math.asin(clamp(f[1], -1, 1));
  const wantNose = clamp((alt - jet.pos[1]) / 4000, -0.03, 0.03);
  intent.pitch = clamp((wantNose - nose) * 3, -1, 1);
  intent.yaw = 0;
}

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

  // Heading rate per jet, smoothed, to tell a calm jet from a busy one.
  const turn = new Map();   // id -> { h, rate }
  function watchTurns(remotes, dt) {
    for (const r of remotes) {
      if (!r.view || !r.visible) continue;
      forwardOf(r.view.q, f);
      const h = Math.atan2(-f[0], -f[2]);
      const t = turn.get(r.id);
      if (!t) { turn.set(r.id, { h, rate: 0 }); continue; }
      const d = Math.atan2(Math.sin(h - t.h), Math.cos(h - t.h)) / Math.max(dt, 1e-3);
      t.rate += (Math.abs(d) - t.rate) * (1 - Math.exp(-dt / 1.5));
      t.h = h;
    }
  }
  const calm = (r) => !((r.rawFlags ?? r.view.flags) & BOOST) && (turn.get(r.id)?.rate ?? 0) < CALM_TURN;

  function nearest(jet, remotes, within = NEAR) {
    let best = null, bestD = within;
    for (const r of remotes) {
      if (!r.view || !r.visible || !calm(r)) continue;
      const d = Math.hypot(r.view.pos[0] - jet.pos[0], r.view.pos[2] - jet.pos[2]);
      if (d < bestD) { bestD = d; best = r; }
    }
    return best;
  }

  const slot = [0, 0, 0];
  let current = null;   // the lead's view this tick, for hold()
  const api = {
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
      watchTurns(remotes, dt);
      let lead = me.lead !== null ? remotes.find((r) => r.id === me.lead && r.view && r.visible) : null;
      // Its attitude is drawn eased and its boost not at all, so a busy moment is fine;
      // only let it go once it has pulled well away from the slot.
      if (lead && api.gap(jet) > 6000) { lead = null; me.lead = null; me.leadFor = 0; }
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
        // Ease toward the other jet's heading. hold() does the positioning, so the
        // steering only keeps the two roughly parallel, with shallow banks.
        ease(intent, jet, Math.atan2(-f[0], -f[2]), slot[1]);
        const dx = slot[0] - jet.pos[0], dz = slot[2] - jet.pos[2];
        forwardOf(jet.q, f);
        const along = dx * f[0] + dz * f[2];
        const want = l.speed + clamp(along * 0.08, -150, 250);
        intent.throttle = clamp((want - jet.speed) / 40, -1, 1);
        intent.boost = false;   // never in the backdrop
      } else {
        // Nobody about: carry on straight and level. (Heading home from wherever we
        // started meant a long turn at full lean; the sim keeps us inside the world.)
        forwardOf(jet.q, f);
        ease(intent, jet, Math.atan2(-f[0], -f[2]), Math.min(Math.max(jet.pos[1], 18000), 27000));
        intent.throttle = clamp(0.7 - jet.throttle, -1, 1);
        intent.boost = false;
      }
      return intent;
    },
  };
  return api;
}
