import { lerpJet, cloneJet, copyJet, forwardOf } from '../sim/index.js';

// Snapshot interpolation for other people's jets. Each remote keeps a short
// history of real states; we draw it a little in the past, blending the two
// states around that moment. If states stop coming, we coast along the last
// heading for a moment instead of freezing.
//
// Timing comes from the server's clock, not from when packets happen to land:
// arrival times wobble with network jitter, server times are evenly spaced.
// Each entry also carries its age (how old that jet's state was when the
// server sent it), so a state is placed at the moment it was true.
//
// How far in the past to draw is learned, per jet:
//   base delay + our own link's jitter + how late that jet's states usually are.
// A jet flown from hotel wifi gets drawn further back than a bot, and does not
// drag anyone else back with it. Delays change gradually (the render clock
// runs at most `rate` fast or slow), so nothing ever jumps.
export function createRemotes({ delay = 120, maxDelay = 2000, keep = 1500, coast = 400, window = 10000, rate = 0.1 } = {}) {
  const remotes = new Map();   // id -> { callsign, buf: [{ t, jet }], view, ages, cur }
  const fwd = [0, 0, 0];
  const lags = [];             // recent { at, lag } with lag = arrival - server time
  let offset = 0, spread = 0, synced = false, lastNow = null;
  let shift = null;            // the offset actually applied; eases toward `offset` like the delays do
  let wrap = 0, lastRaw = null;   // server time is a u32 of ms; it wraps every ~49 days

  const blank = (callsign = '') => ({ callsign, buf: [], view: null, seen: 0, ages: [], late: 0, cur: null });

  function unwrap(raw) {
    if (lastRaw !== null && raw < lastRaw - 2 ** 31) wrap += 2 ** 32;
    if (lastRaw !== null && raw > lastRaw + 2 ** 31) return raw + wrap - 2 ** 32;   // late packet from before a wrap
    lastRaw = raw;
    return raw + wrap;
  }

  // Our link: the fastest recent snapshot sets the clock offset, the spread
  // above it is the jitter we must absorb.
  function learn(at, serverTime) {
    lags.push({ at, lag: at - serverTime });
    while (lags.length > 1 && lags[0].at < at - window) lags.shift();
    const sorted = lags.map((l) => l.lag).sort((a, b) => a - b);
    offset = sorted[0];
    spread = sorted[Math.floor(sorted.length * 0.95)] - offset;
    synced = true;
  }

  const p95 = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length * 0.95)] || 0; };

  return {
    remotes,
    // Average draw delay across jets, for HUDs and tests.
    get delay() {
      let n = 0, sum = 0;
      for (const r of remotes.values()) if (r.cur != null) { n++; sum += r.cur; }
      return n ? sum / n : delay + spread;
    },
    meta(id, callsign) {
      const r = remotes.get(id);
      if (r) r.callsign = callsign;
      else remotes.set(id, blank(callsign));
    },
    remove(id) { remotes.delete(id); },
    clear() { remotes.clear(); lags.length = 0; synced = false; lastNow = null; shift = null; wrap = 0; lastRaw = null; },
    // t is the client clock when the snapshot arrived (ms). serverTime is the
    // snapshot's own timestamp; without it we fall back to arrival times.
    push(t, entries, serverTime) {
      if (serverTime != null) { serverTime = unwrap(serverTime); learn(t, serverTime); }
      for (const { id, jet, age = 0 } of entries) {
        let r = remotes.get(id);
        if (!r) remotes.set(id, (r = blank()));
        r.seen = t;
        const when = serverTime == null ? t : serverTime - age;   // when this state was true
        if (r.buf.length && when <= r.buf[r.buf.length - 1].t) continue;   // repeat of a state we have
        r.buf.push({ t: when, jet });
        r.ages.push(age);
        if (r.ages.length > 50) r.ages.shift();
        r.late = p95(r.ages);
        while (r.buf.length > 2 && r.buf[1].t < when - keep - maxDelay) r.buf.shift();
      }
    },
    // Fills r.view for every remote at render time `now` (ms). Returns the map.
    sample(now) {
      const step = lastNow === null ? Infinity : Math.max(0, now - lastNow) * rate;
      lastNow = now;
      // The clock offset moves when the fastest recent snapshot changes (a new best
      // arrives, or the old best ages out of the window, or the server re-anchors
      // its clock). Applied raw, that jumps every jet's playhead at once; eased, the
      // render clock just runs a touch fast or slow for a moment.
      if (synced) shift = shift === null ? offset : shift + Math.max(-step, Math.min(step, offset - shift));
      for (const [id, r] of remotes) {
        const b = r.buf;
        if (!b.length) continue;
        if (now - r.seen > keep * 4) { remotes.delete(id); continue; }
        const target = Math.min(maxDelay, delay + spread * 1.1 + r.late);
        r.cur = r.cur == null ? target : r.cur + Math.max(-step, Math.min(step, target - r.cur));
        const at = now - r.cur - (synced ? shift : 0);
        r.view ??= cloneJet(b[0].jet);
        // Hide a jet once we have stopped hearing about it (it left our nearest
        // set) and the short coast is over, instead of leaving it frozen in the sky.
        r.visible = now - r.seen < r.cur + coast + 150;
        let i = b.length - 1;
        while (i > 0 && b[i].t > at) i--;
        const a = b[i], c = b[i + 1];
        if (c && c.t > a.t) {
          lerpJet(r.view, a.jet, c.jet, Math.min(1, Math.max(0, (at - a.t) / (c.t - a.t))));
        } else {
          // Ahead of the newest state: extrapolate briefly along the heading.
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
