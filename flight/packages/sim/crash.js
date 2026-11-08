// Crashes: how hard a hit was, what it cost, who gets the credit, and what you did
// on the way down. Plain numbers, no DOM or three.js, so tests can drive it.
//
// The "sweet spot" from the crash research (Had, 2026-11-08): War Thunder's rules,
// Nuclear Option's wing damage, MSFS's back-on-track respawn.
//   scrape     shallow hit: bounce off, lose some health
//   hard hit   in between: bounce off, lose a lot, maybe a damaged wing that pulls you over
//   direct     steep hit, or health gone: you're down
// Mid-air: closing speed decides it the same way. Credit for a crash goes to the jet
// you last bumped (within a window), else the nearest jet within a few km (a
// maneuver kill), else nobody: the mountain wins.

const DEG = Math.PI / 180;

// Tunable live (the mechanics jig). on: false keeps the live game's plain bounce.
export const CRASH = {
  on: false,
  scrapeBelow: 10 * DEG,   // impact angle under this is a scrape
  fatalAbove: 20 * DEG,    // over this is a direct hit: down
  scrapeDamage: 20,        // health lost by a scrape at the scrape limit (less when shallower)
  hardDamage: 55,          // health lost by a hard hit
  wingChance: 0.5,         // a hard hit damages a wing this often
  wingPull: 0.18,          // a damaged wing's roll pull (share of full stick)
  smokeBelow: 60,          // health under this trails smoke
  fireBelow: 25,           // and under this, fire
  jetFatal: 250,           // m/s closing speed that downs you in a mid-air
  jetDamage: 30,           // health lost per 100 m/s closing speed below that
  shield: 3,               // s after a respawn with no damage (you still bounce)
  wreckTime: 6,            // s from the crash to the automatic respawn
  creditKm: 3,             // a jet this close when you go down gets the maneuver kill
  creditWindow: 12,        // s a bump keeps its credit
  low: 305,                // m above ground that counts as "low" in the stats (1,000 ft)
};

// angle: radians between your flight path and the surface (0 = parallel, 90° = straight in).
export function classifyGround(angle, shielded = false) {
  if (shielded) return { kind: 'scrape', damage: 0 };
  if (angle >= CRASH.fatalAbove) return { kind: 'direct', damage: Infinity };
  if (angle < CRASH.scrapeBelow) return { kind: 'scrape', damage: CRASH.scrapeDamage * Math.max(0.3, angle / CRASH.scrapeBelow) };
  return { kind: 'hard', damage: CRASH.hardDamage };
}

// closing: m/s along the line between the jets.
export function classifyJets(closing, shielded = false) {
  if (shielded) return { kind: 'scrape', damage: 0 };
  if (closing >= CRASH.jetFatal) return { kind: 'direct', damage: Infinity };
  const damage = CRASH.jetDamage * closing / 100;
  return { kind: damage >= CRASH.hardDamage * 0.8 ? 'hard' : 'scrape', damage };
}

// Who gets the kill when `me` goes down at `pos`. others: [{ id, callsign, pos }].
// bump: { id, callsign, at } or null; now: seconds.
export function creditFor(pos, others, bump, now) {
  if (bump && now - bump.at <= CRASH.creditWindow) {
    const still = others.find((o) => o.id === bump.id);
    return { id: bump.id, callsign: bump.callsign, how: 'collision', dist: still ? dist(pos, still.pos) : null };
  }
  let best = null, bestD = CRASH.creditKm * 1000;
  for (const o of others) {
    const d = dist(pos, o.pos);
    if (d <= bestD) { bestD = d; best = o; }
  }
  return best ? { id: best.id, callsign: best.callsign, how: 'maneuver', dist: bestD } : null;
}

// From another jet's crash: do *I* get the credit? Same rule as creditFor, run on my
// copy of the sky. mine: my position; others: everyone else I can see but the downed jet.
export function iGetCredit(wreck, mine, others, bumpedThemAt, now) {
  if (bumpedThemAt != null && now - bumpedThemAt <= CRASH.creditWindow) return true;
  const d = dist(wreck, mine);
  if (d > CRASH.creditKm * 1000) return false;
  return others.every((o) => dist(wreck, o.pos) >= d);
}

// What you did this life, for the card.
export function createStats() {
  const s = { time: 0, distance: 0, topSpeed: 0, lowest: Infinity, lowTime: 0, scrapes: 0, kills: 0 };
  s.tick = (speed, agl, dt) => {
    s.time += dt;
    s.distance += speed * dt;
    if (speed > s.topSpeed) s.topSpeed = speed;
    if (agl != null) {
      if (agl < s.lowest) s.lowest = Math.max(0, agl);
      if (agl < CRASH.low) s.lowTime += dt;
    }
  };
  return s;
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
