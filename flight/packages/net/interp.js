import { lerpJet, cloneJet, copyJet, forwardOf } from '../sim/index.js';

// Snapshot interpolation for other people's jets. Each remote keeps a short
// history of real snapshots; we draw them `delay` ms in the past, blending the
// two snapshots around that moment. If packets stop, we coast along the last
// heading for a moment instead of freezing.
export function createRemotes({ delay = 120, keep = 1500, coast = 400 } = {}) {
  const remotes = new Map();   // id -> { callsign, buf: [{ t, jet }], view }
  const fwd = [0, 0, 0];

  return {
    remotes,
    meta(id, callsign) {
      const r = remotes.get(id);
      if (r) r.callsign = callsign;
      else remotes.set(id, { callsign, buf: [], view: null, seen: 0 });
    },
    remove(id) { remotes.delete(id); },
    clear() { remotes.clear(); },
    // t is the client clock when the snapshot arrived (ms).
    push(t, entries) {
      for (const { id, jet } of entries) {
        let r = remotes.get(id);
        if (!r) remotes.set(id, (r = { callsign: '', buf: [], view: null, seen: 0 }));
        r.buf.push({ t, jet });
        r.seen = t;
        while (r.buf.length > 2 && r.buf[1].t < t - keep) r.buf.shift();
      }
    },
    // Fills r.view for every remote at render time `now` (ms). Returns the map.
    sample(now) {
      const at = now - delay;
      for (const [id, r] of remotes) {
        const b = r.buf;
        if (!b.length) continue;
        if (now - r.seen > keep * 4) { remotes.delete(id); continue; }
        r.view ??= cloneJet(b[0].jet);
        r.visible = now - r.seen < 1000;   // dropped out of our nearest set
        let i = b.length - 1;
        while (i > 0 && b[i].t > at) i--;
        const a = b[i], c = b[i + 1];
        if (c && c.t > a.t) {
          lerpJet(r.view, a.jet, c.jet, Math.min(1, Math.max(0, (at - a.t) / (c.t - a.t))));
        } else {
          // Ahead of the newest snapshot: extrapolate briefly along the heading.
          copyJet(r.view, a.jet);
          const ahead = Math.min(coast, Math.max(0, at - a.t)) / 1000;
          forwardOf(a.jet.q, fwd);
          for (let k = 0; k < 3; k++) r.view.pos[k] += fwd[k] * a.jet.speed * ahead;
        }
      }
      return remotes;
    },
  };
}
