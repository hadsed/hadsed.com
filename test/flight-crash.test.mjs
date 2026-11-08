import test from 'node:test';
import assert from 'node:assert/strict';
import { CRASH, classifyGround, classifyJets, creditFor, iGetCredit, createStats } from '../flight/packages/sim/crash.js';
import { createJet, forwardOf } from '../flight/packages/sim/index.js';
import { encodeState, decodeState, FLAG } from '../flight/packages/net/protocol.js';

const DEG = Math.PI / 180;

test('crash: shallow is a scrape, in between a hard hit, steep is lethal', () => {
  assert.equal(classifyGround(3 * DEG).kind, 'scrape');
  assert.ok(classifyGround(3 * DEG).damage < classifyGround(9 * DEG).damage, 'a shallower scrape costs less');
  assert.equal(classifyGround(15 * DEG).kind, 'hard');
  assert.equal(classifyGround(15 * DEG).damage, CRASH.hardDamage);
  assert.equal(classifyGround(40 * DEG).kind, 'direct');
  assert.equal(classifyGround(40 * DEG, true).damage, 0, 'the respawn shield takes no damage');
});

test('crash: mid-air by closing speed', () => {
  assert.equal(classifyJets(20).kind, 'scrape');
  assert.equal(classifyJets(CRASH.jetFatal + 1).kind, 'direct');
  assert.ok(classifyJets(150).damage > classifyJets(50).damage);
});

test('crash: credit goes to the last bump, else the nearest jet in range, else nobody', () => {
  const me = [0, 1000, 0];
  const kite = { id: 1, callsign: 'KITE 21', pos: [800, 1000, 0] }, owl = { id: 2, callsign: 'OWL 7', pos: [2000, 1000, 0] }, far = { id: 3, callsign: 'FAR 1', pos: [9000, 1000, 0] };
  assert.equal(creditFor(me, [kite, owl], null, 100).callsign, 'KITE 21');
  assert.equal(creditFor(me, [kite, owl], null, 100).how, 'maneuver');
  assert.equal(creditFor(me, [far], null, 100), null, 'nobody within range: the mountain wins');
  const bump = { id: 2, callsign: 'OWL 7', at: 95 };
  assert.equal(creditFor(me, [kite, owl], bump, 100).callsign, 'OWL 7', 'a recent bump beats being nearest');
  assert.equal(creditFor(me, [kite, owl], bump, 95 + CRASH.creditWindow + 1).callsign, 'KITE 21', 'an old bump has expired');
});

test('crash: each client agrees on who forced the crash', () => {
  const wreck = [0, 1000, 0];
  // I'm 800 m away, another jet is 2 km away: me. Swap us: not me.
  assert.equal(iGetCredit(wreck, [800, 1000, 0], [{ pos: [2000, 1000, 0] }], null, 0), true);
  assert.equal(iGetCredit(wreck, [2000, 1000, 0], [{ pos: [800, 1000, 0] }], null, 0), false);
  assert.equal(iGetCredit(wreck, [9000, 1000, 0], [], null, 0), false, 'out of range');
  assert.equal(iGetCredit(wreck, [9000, 1000, 0], [], 0, 5), true, 'I bumped them just before');
});

test('crash: stats add up a flight', () => {
  const s = createStats();
  for (let i = 0; i < 60; i++) s.tick(900, 200, 1 / 60);
  for (let i = 0; i < 60; i++) s.tick(800, 5000, 1 / 60);
  assert.ok(Math.abs(s.time - 2) < 1e-9);
  assert.ok(Math.abs(s.distance - 1700) < 1e-6);
  assert.equal(s.topSpeed, 900);
  assert.equal(s.lowest, 200);
  assert.ok(Math.abs(s.lowTime - 1) < 1e-9, 'a second under 1,000 ft');
});

test('crash: damage and wreck flags survive the wire', () => {
  const j = createJet();
  j.flags = FLAG.DOWN | FLAG.FIRE | FLAG.BOOST;
  assert.equal(decodeState(encodeState(j, 0)).flags, FLAG.DOWN | FLAG.FIRE | FLAG.BOOST);
});

test('crash: respawn heading convention matches createJet', () => {
  for (const h of [0, 0.7, -2.1, 3]) {
    const f = forwardOf(createJet({ heading: h }).q, [0, 0, 0]);
    const back = Math.atan2(-f[0], -f[2]);
    assert.ok(Math.abs(Math.atan2(Math.sin(back - h), Math.cos(back - h))) < 1e-6);
  }
});
