// Game mechanics jig: the flight game alone, with a Tweakpane panel over its feel.
// Served at /lab/game/ on branch previews only (never production). The page is the
// flight lab's own index.html with a <base> pointing at /lab/flight/, so this is the
// same game, the same modules and the same staging room server as /lab/flight/.
//
// Every knob edits a plain object the game already reads each tick (sim RATE/LIMITS/FEEL,
// the steering assist, the input sources, follow, camera). Changes apply live and only to
// your own jet: bots and other players fly on the server's numbers.
import { RATE, LIMITS, FEEL } from '../flight/packages/sim/index.js';
import { SLOT, ESCORT } from '../flight/packages/bots/pilot.js';
import { CHASE } from '../flight/packages/render/camera.js';
import { Pane } from './tweakpane.min.js';

// Where the jig starts out different from the live game (Had, 2026-11-07: reticle held to a small radius).
const JIG_DEFAULTS = { 'reticle.radius': 70 };
const STORE = 'game-jig-v1', OPEN = 'game-jig-folders';
const FT = 3.281, DEG = 180 / Math.PI, NM = 1 / 1852;

// Targets that exist only once the game has started.
let F = null;   // window.__flight
const stickSize = { frac: 0.17 };   // drag radius as a share of the screen's short side
const T = {
  rate: () => RATE, limits: () => LIMITS, feel: () => FEEL, slot: () => SLOT, escort: () => ESCORT, chase: () => CHASE,
  stickSize: () => stickSize,
  assist: () => F?.assist.tune, stick: () => F?.stick.tune, keys: () => F?.keys.tune, lens: () => F?.renderer.rig.lens, reticle: () => F?.reticle,
};

// [folder, open, rows]; row = [target, key, label, min, max, step, scale?]. scale converts the
// game's unit into the panel's (meters -> feet, radians -> degrees). Booleans have no range.
const SPEC = [
  ['Speed', true, [
    ['limits', 'minSpeed', 'Throttle idle speed (m/s)', 100, 600, 10],
    ['limits', 'maxSpeed', 'Full throttle speed (m/s)', 400, 2000, 10],
    ['rate', 'throttle', 'Throttle response (/s)', 0.1, 2, 0.05],
    ['feel', 'spool', 'Speed catches up (/s)', 0.05, 2, 0.05],
    ['feel', 'gravity', 'Climb costs / dive gains (m/s²)', 0, 100, 1],
  ]],
  ['Boost', true, [
    ['feel', 'boost', 'Boost top speed (× full)', 1, 3, 0.05],
    ['feel', 'boostSpool', 'Boost spools up (/s)', 0.1, 4, 0.05],
    ['chase', 'boostBack', 'Camera falls back to (m)', 20, 200, 1],
    ['chase', 'boostUp', 'Camera rises to (m)', 0, 60, 1],
    ['chase', 'boostLens', 'Lens opens by (°)', 0, 30, 0.5],
  ]],
  ['Handling', true, [
    ['assist', 'reverseY', 'Reverse up/down (all inputs)'],
    ['rate', 'roll', 'Roll rate (rad/s)', 0.2, 5, 0.05],
    ['rate', 'pitch', 'Pitch rate (rad/s)', 0.2, 3, 0.05],
    ['rate', 'turn', 'Turn from bank (rad/s)', 0.1, 2, 0.05],
    ['rate', 'level', 'Hands off: wings level (/s)', 0, 3, 0.05],
    ['rate', 'nose', 'Hands off: nose level (/s)', 0, 2, 0.05],
  ]],
  ['Steering assist', false, [
    ['assist', 'maxTurn', 'Full stick turn (°)', 10, 90, 1, DEG],
    ['assist', 'maxPitch', 'Full stick climb (°)', 10, 80, 1, DEG],
    ['assist', 'gain', 'Bank eagerness', 0.3, 3, 0.05],
    ['assist', 'turnCurve', 'Turn soft center (1 = linear)', 1, 3, 0.05],
    ['assist', 'pitchCurve', 'Climb soft center (1 = linear)', 1, 3, 0.05],
    ['assist', 'loopIn', 'Loop / dive starts past', 0.5, 1, 0.01],
    ['assist', 'loopOut', 'Loop / dive ends below', 0.3, 1, 0.01],
    ['assist', 'dive', 'Full forward dive (°)', 30, 89, 1, DEG],
    ['reticle', 'radius', 'Reticle radius (px, 0 = free)', 0, 300, 5],
  ]],
  ['Touch and mouse drag', false, [
    ['stickSize', 'frac', 'Drag for full stick (× short side)', 0.05, 0.5, 0.01],
    ['stick', 'deadzone', 'Dead zone', 0, 0.3, 0.01],
    ['stick', 'curve', 'Response curve (1 = linear)', 1, 3, 0.05],
    ['stick', 'invertX', 'Invert left/right'],
    ['stick', 'invertY', 'Invert up/down'],
  ]],
  ['Keyboard', false, [
    ['keys', 'attack', 'Key ramps in (/s)', 0.5, 20, 0.5],
    ['keys', 'release', 'Key ramps out (/s)', 0.5, 20, 0.5],
  ]],
  ['Follow', false, [
    ['slot', 'out', 'Slot out to the side (m)', 0, 300, 5],
    ['slot', 'back', 'Slot behind (m)', 0, 600, 5],
    ['slot', 'up', 'Slot above (m)', -100, 100, 1],
    ['escort', 'ahead', 'Aims past the slot (m)', 200, 5000, 50],
    ['escort', 'gain', 'Bank eagerness', 0.3, 3, 0.05],
    ['escort', 'catchUp', 'Auto boost beyond (m)', 500, 20000, 100],
  ]],
  ['Map limits', false, [
    ['limits', 'minAlt', 'Hard deck (ft)', 10000, 60000, 500, FT],
    ['limits', 'maxAlt', 'Ceiling (ft)', 50000, 130000, 500, FT],
    ['feel', 'band', 'Starts rounding out within (ft)', 0, 30000, 500, FT],
    ['limits', 'radius', 'Map edge (nm)', 10, 200, 1, NM],
    ['rate', 'home', 'Turn home past the edge (rad/s)', 0, 1, 0.01],
  ]],
  ['Chase camera', false, [
    ['chase', 'back', 'Behind (m)', 10, 150, 1],
    ['chase', 'up', 'Above (m)', -10, 60, 1],
    ['chase', 'look', 'Looks ahead (m)', 0, 150, 1],
    ['lens', 'chase', 'Lens, landscape (°)', 25, 100, 1],
    ['lens', 'portraitChase', 'Lens, portrait (°)', 25, 110, 1],
  ]],
];
const ROWS = SPEC.flatMap(([, , rows]) => rows);
const id = (r) => `${r[0]}.${r[1]}`;
// Tweakpane snaps values to the step in floating point (1.6 can come back as 1.5999999999999999).
const same = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b);
const round = (v, step) => (typeof v === 'number' ? +(Math.round(v / step) * step).toFixed(6) : v);

// Panel values (in panel units) from the game, and back.
const read = (r) => { const o = T[r[0]](); if (!o) return undefined; const v = o[r[1]]; return typeof v === 'number' && r[6] ? v * r[6] : v; };
// A value left at the game's own setting writes back the game's exact number, not the panel's rounded one.
const RAW = {}, GAME = {};
function write(r, v) {
  const o = T[r[0]]();
  if (!o) return;
  const k = id(r);
  if (!(k in RAW)) RAW[k] = o[r[1]];
  o[r[1]] = same(v, GAME[k]) ? RAW[k] : typeof v === 'number' && r[6] ? v / r[6] : v;
  if (r[0] === 'stickSize' && F) F.stick.tune.radius = stickSize.frac * Math.min(innerWidth, innerHeight);
}

// ---- settings: what the game ships with, then this browser's tweaks, or a shared link ----
let fromHash = null;
try { if (location.hash.length > 1) fromHash = JSON.parse(decodeURIComponent(location.hash.slice(1))); } catch {}
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch {}
const tweaks = fromHash || saved;   // a shared link wins outright, so it shows exactly what was sent
const S = {}, DEFAULTS = {};
const applyAll = () => { for (const r of ROWS) if (S[id(r)] !== undefined) write(r, S[id(r)]); };

// Module-level numbers first, so the game's very first tick uses them.
const setDefault = (r, v) => { const k = id(r); GAME[k] = round(v, r[5] ?? 1); DEFAULTS[k] = k in JIG_DEFAULTS ? JIG_DEFAULTS[k] : GAME[k]; };
for (const r of ROWS) { const v = read(r); if (v !== undefined) { setDefault(r, v); S[id(r)] = DEFAULTS[id(r)]; } }
Object.assign(S, pick(tweaks));
applyAll();

await import('../flight/main.js');
F = window.__flight;
for (const r of ROWS) if (!(id(r) in DEFAULTS)) { setDefault(r, read(r)); if (!(id(r) in tweaks)) S[id(r)] = DEFAULTS[id(r)]; }
Object.assign(S, pick(tweaks));
applyAll();
addEventListener('resize', () => write(['stickSize', 'frac'], S['stickSize.frac']));

function pick(o) { const out = {}; for (const r of ROWS) if (o && id(r) in o) out[id(r)] = o[id(r)]; return out; }
function changed() { const out = {}; for (const k in S) if (!same(S[k], DEFAULTS[k])) out[k] = S[k]; return out; }
function save() { try { localStorage.setItem(STORE, JSON.stringify(changed())); } catch {} }

// ---- panel ----
const panel = document.createElement('aside');
panel.id = 'jig';
panel.innerHTML = `
  <div class="jig-head"><strong>Game mechanics</strong><button id="jig-toggle" type="button" aria-expanded="true">Hide</button></div>
  <div class="jig-body"><p class="jig-hint">Changes apply live to your jet only; bots and other players fly on the server's numbers. Gold labels differ from the defaults; ↺ resets one, each folder has its own reset. H hides this panel. Settings stay in this browser.</p></div>
  <div class="jig-foot">
    <button id="jig-copy" type="button">Copy link</button>
    <button id="jig-reset" type="button">Reset all</button>
    <span id="jig-status" role="status" aria-live="polite"></span>
  </div>`;
document.body.appendChild(panel);
// The game listens on the whole page: a drag steers, a tap follows, wheel and touchmove
// are swallowed so the page never scrolls. None of that should happen inside the panel.
for (const t of ['pointerdown', 'pointerup', 'pointermove', 'touchmove', 'wheel', 'contextmenu', 'selectstart']) panel.addEventListener(t, (e) => e.stopPropagation());

let openFolders = {};
try { openFolders = JSON.parse(localStorage.getItem(OPEN) || '{}'); } catch {}
const pane = new Pane({ container: panel.querySelector('.jig-body') });
const bindings = [];
let syncing = false;
for (const [title, expanded, rows] of SPEC) {
  const f = pane.addFolder({ title, expanded: openFolders[title] ?? expanded });
  f.on('fold', (e) => { openFolders[title] = e.expanded; try { localStorage.setItem(OPEN, JSON.stringify(openFolders)); } catch {} });
  for (const r of rows) {
    const k = id(r);
    if (S[k] === undefined) continue;
    const opts = { label: r[2] };
    if (typeof S[k] === 'number') Object.assign(opts, { min: r[3], max: r[4], step: r[5] });
    const b = f.addBinding(S, k, opts);
    b.on('change', (e) => { if (syncing) return; write(r, e.value); save(); mark(); });
    bindings.push([k, b]);
    // Per-control reset: a small ↺ beside the label, shown only while the value differs.
    const undo = document.createElement('button');
    undo.type = 'button'; undo.className = 'jig-undo'; undo.textContent = '↺';
    undo.title = `Reset to ${DEFAULTS[k]}`;
    undo.addEventListener('click', (e) => { e.stopPropagation(); reset([r]); });
    b.element.querySelector('.tp-lblv_l')?.appendChild(undo);
  }
  // Per-folder reset.
  const live = rows.filter((r) => S[id(r)] !== undefined);
  f.addButton({ title: `Reset ${title.toLowerCase()}` }).on('click', () => { reset(live); say(`${title} back to defaults`); });
}
function reset(rows) {
  for (const r of rows) { S[id(r)] = DEFAULTS[id(r)]; write(r, S[id(r)]); }
  syncing = true; try { pane.refresh(); } finally { syncing = false; }
  save(); mark();
}
function mark() { for (const [k, b] of bindings) b.element.classList.toggle('jig-changed', !same(S[k], DEFAULTS[k])); }
mark();

const status = panel.querySelector('#jig-status');
const say = (t) => { status.textContent = t; clearTimeout(say.t); say.t = setTimeout(() => (status.textContent = ''), 2500); };
const toggle = panel.querySelector('#jig-toggle');
toggle.addEventListener('click', () => {
  const open = panel.classList.toggle('closed') === false;
  toggle.setAttribute('aria-expanded', String(open)); toggle.textContent = open ? 'Hide' : 'Tune';
});
panel.querySelector('#jig-reset').addEventListener('click', () => {
  reset(ROWS.filter((r) => S[id(r)] !== undefined));
  history.replaceState(null, '', location.pathname + location.search);
  say('Back to the game\'s defaults');
});
panel.querySelector('#jig-copy').addEventListener('click', async () => {
  const diff = changed();
  const link = `${location.origin}${location.pathname}${location.search}${Object.keys(diff).length ? `#${encodeURIComponent(JSON.stringify(diff))}` : ''}`;
  try { await navigator.clipboard.writeText(link); say('Link with these settings copied'); }
  catch { prompt('Copy this link', link); }
});
addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, select, textarea')) return;
  if (e.code === 'KeyH') toggle.click();
});
if (innerWidth < 640) toggle.click();   // phones start with the panel tucked away
Object.assign(F, { jig: { S, DEFAULTS, pane } });
