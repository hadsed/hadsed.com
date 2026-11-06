import { forwardOf, rightOf, rotate, clamp } from '../sim/index.js';

// A bot pilot produces the same intent a keyboard or gesture would, and the
// server feeds it to the same sim step. That is the whole trick to bots that
// fly like people: they use the same jet.
//
// const pilot = createPilot({ rng });
// const intent = pilot.think(jet, { dt, others });   // others: [{ id, jet, human }]

const f = [0, 0, 0], r = [0, 0, 0], loc = [0, 0, 0];

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

  function steer(jet, tx, ty, tz, aggressive = 1) {
    // Target direction in the jet's own frame (inverse rotation).
    const q = jet.q;
    const inv = [-q[0], -q[1], -q[2], q[3]];
    rotate(inv, tx - jet.pos[0], ty - jet.pos[1], tz - jet.pos[2], loc);
    forwardOf(q, f); rightOf(q, r);
    const bank = Math.asin(clamp(-r[1], -1, 1));
    const nose = Math.asin(clamp(f[1], -1, 1));
    const ahead = -loc[2], side = loc[0], up = loc[1];
    const heading = Math.atan2(side, ahead);                 // + means target is to the right
    const wantBank = clamp(heading * 1.6 * aggressive, -1.0, 1.0);
    intent.roll = clamp((wantBank - bank) * 2.5, -1, 1);
    const wantNose = clamp(Math.atan2(up, Math.hypot(side, ahead)), -0.35, 0.35);
    intent.pitch = clamp((wantNose - nose) * 3, -1, 1);
  }

  return {
    me,
    think(jet, { dt = 1 / 60, others = [] } = {}) {
      me.modeLeft -= dt;
      me.wobble += dt;
      intent.yaw = 0;

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
        // Hold a slot off the leader's wing: 180 m out, 60 m back, 20 m up.
        const lq = lead.jet.q;
        forwardOf(lq, f); rightOf(lq, r);
        const lp = lead.jet.pos;
        const sx = lp[0] + r[0] * 180 * me.side - f[0] * 60;
        const sy = lp[1] + 20;
        const sz = lp[2] + r[2] * 180 * me.side - f[2] * 60;
        // Aim at a point ahead of the slot so we converge instead of circling it.
        const lead1 = 1500;
        steer(jet, sx + f[0] * lead1, sy + f[1] * lead1, sz + f[2] * lead1, 1.2);
        const dx = sx - jet.pos[0], dz = sz - jet.pos[2];
        forwardOf(jet.q, f);
        const along = dx * f[0] + dz * f[2];                  // + means slot is ahead of us
        const wantSpeed = lead.jet.speed + clamp(along * 0.08, -150, 250);
        intent.throttle = clamp((wantSpeed - jet.speed) / 40, -1, 1);
      } else {
        if (!me.goal) pickGoal();
        const g = me.goal;
        if (Math.hypot(g[0] - jet.pos[0], g[2] - jet.pos[2]) < 8000) pickGoal();
        steer(jet, g[0], g[1], g[2], 0.7);
        // Lazy hands: a little drift so the line isn't machine-straight.
        intent.roll = clamp(intent.roll + Math.sin(me.wobble * 0.37) * 0.08, -1, 1);
        intent.throttle = clamp((0.8 + 0.1 * Math.sin(me.wobble * 0.05)) - jet.throttle, -1, 1);
      }

      me.waggleIn -= dt;
      jet.flags = 0;
      if (me.waggleIn < 0) { jet.flags = 1; if (me.waggleIn < -1.2) me.waggleIn = 40 + rng() * 120; }
      return intent;
    },
  };
}
