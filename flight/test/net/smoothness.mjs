// How smooth does a remote jet look? Feed it the drawn position every frame.
// A jet flying at constant speed should move speed * dt each frame. Anything
// else is visible: a "hitch" is a frame off by more than half, a "freeze" is a
// frame that barely moved, a "jump" is a frame that moved more than twice as far.
//
// Same metric in Node (tests, swarm) and in the browser (device runs), so the
// numbers can be compared directly.

export function createSmoothness() {
  let last = null, frames = 0, hitches = 0, freezes = 0, jumps = 0;
  const errs = [];
  return {
    sample(pos, speed, dtMs) {
      if (last && dtMs > 0 && speed > 0) {
        const d = Math.hypot(pos[0] - last[0], pos[1] - last[1], pos[2] - last[2]);
        const want = speed * dtMs / 1000;
        const e = Math.abs(d - want) / want;
        frames++;
        errs.push(e);
        if (e > 0.5) hitches++;
        if (d < want * 0.2) freezes++;
        if (d > want * 2) jumps++;
      }
      last = [pos[0], pos[1], pos[2]];
    },
    reset() { last = null; },
    get stats() { return summarize({ frames, hitches, freezes, jumps, errs }); },
  };
}

export function summarize({ frames, hitches, freezes, jumps, errs }) {
  const s = [...errs].sort((a, b) => a - b);
  const q = (p) => (s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0);
  return {
    frames,
    hitchPct: frames ? (100 * hitches) / frames : 0,
    freezePct: frames ? (100 * freezes) / frames : 0,
    jumpPct: frames ? (100 * jumps) / frames : 0,
    errP50: q(0.5),
    errP95: q(0.95),
  };
}

export const pct = (xs, p) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
