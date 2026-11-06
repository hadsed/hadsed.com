import { forwardOf, rightOf, clamp } from '../sim/index.js';
import { steerTo as steer } from '../sim/assist.js';

// A bot pilot produces the same intent a keyboard or gesture would, and the
// server feeds it to the same sim step. That is the whole trick to bots that
// fly like people: they use the same jet.
//
// const pilot = createPilot({ rng });
// const intent = pilot.think(jet, { dt, others });   // others: [{ id, jet, human }]

const f = [0, 0, 0], r = [0, 0, 0];

// Fly to a slot off the leader's wing and hold it: 180 m out, 60 m back, 20 m up.
// Used by bots (escorting people) and by players (click a jet to follow it).
export const SLOT = { out: 50, back: 150, up: 12 };

// dash: the player is holding boost. It burns only while the slot is ahead and
// cuts out as you arrive, so a boost while following rejoins the V instead of
// blowing past the leader.
export function escort(intent, jet, lead, side = 1, dash = false) {
  const lq = lead.q;
  forwardOf(lq, f); rightOf(lq, r);
  const lp = lead.pos;
  // A V-formation slot: 50 m out to one side and 150 m back, a touch high.
  // From the chase cam behind it, the leader sits about 14 degrees off the
  // nose, so it stays on screen even on a phone held upright.
  const sx = lp[0] + r[0] * SLOT.out * side - f[0] * SLOT.back;
  const sy = lp[1] + SLOT.up;
  const sz = lp[2] + r[2] * SLOT.out * side - f[2] * SLOT.back;
  // Aim at a point ahead of the slot so we converge instead of circling it.
  const ahead = 1500;
  steer(intent, jet, sx + f[0] * ahead, sy + f[1] * ahead, sz + f[2] * ahead, 1.2);
  const dx = sx - jet.pos[0], dz = sz - jet.pos[2];
  forwardOf(jet.q, f);
  const along = dx * f[0] + dz * f[2];                  // + means slot is ahead of us
  const wantSpeed = lead.speed + clamp(along * 0.08, -150, 250);
  intent.throttle = clamp((wantSpeed - jet.speed) / 40, -1, 1);
  intent.yaw = 0;
  const d = Math.hypot(dx, sy - jet.pos[1], dz);
  intent.boost = (d > 3000 || (dash && d > 120)) && along > 60;   // dash to catch up; never to fall back
  return d;           // distance to the slot
}

export function createPilot({ rng = Math.random, radius = 90000 } = {}) {
  const intent = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
  const me = {
    mode: 'cruise',
    goal: null,          // [x, y, z] waypoint while cruising
    lead: null,          // id of the jet we escort
    side: rng() < 0.5 ? -1 : 1,
    modeLeft: 0,         // seconds until we reconsider what to do
    wobble: rng() * 100,
    waggleIn: 20 + rng() * 60,
  };

  const pickGoal = () => {
    const a = rng() * Math.PI * 2, d = radius * (0.2 + 0.8 * Math.sqrt(rng()));
    me.goal = [Math.cos(a) * d, 14000 + rng() * 14000, Math.sin(a) * d];
  };

  return {
    me,
    think(jet, { dt = 1 / 60, others = [] } = {}) {
      me.modeLeft -= dt;
      me.wobble += dt;
      intent.yaw = 0;
      intent.boost = false;

      if (me.modeLeft <= 0) {
        // Mostly wander; sometimes go keep a real person company.
        const humans = others.filter((o) => o.human);
        if (humans.length && rng() < 0.45) {
          me.mode = 'escort';
          me.lead = humans[Math.floor(rng() * humans.length)].id;
          me.modeLeft = 40 + rng() * 80;
        } else {
          me.mode = 'cruise';
          pickGoal();
          me.modeLeft = 60 + rng() * 120;
        }
      }

      if (me.mode === 'escort') {
        const lead = others.find((o) => o.id === me.lead);
        if (!lead) { me.modeLeft = 0; return intent; }
        escort(intent, jet, lead.jet, me.side);
      } else {
        if (!me.goal) pickGoal();
        const g = me.goal;
        if (Math.hypot(g[0] - jet.pos[0], g[2] - jet.pos[2]) < 8000) pickGoal();
        steer(intent, jet, g[0], g[1], g[2], 0.7);
        // Lazy hands: a little drift so the line isn't machine-straight.
        intent.roll = clamp(intent.roll + Math.sin(me.wobble * 0.37) * 0.08, -1, 1);
        intent.throttle = clamp((0.8 + 0.1 * Math.sin(me.wobble * 0.05)) - jet.throttle, -1, 1);
      }

      me.waggleIn -= dt;
      jet.flags = intent.boost ? 2 : 0;   // FLAG.BOOST: everyone sees the burner
      if (me.waggleIn < 0) { jet.flags |= 1; if (me.waggleIn < -1.2) me.waggleIn = 40 + rng() * 120; }
      return intent;
    },
  };
}
