// Main menu prototype for the flight game: Play -> map select -> the game; Settings; Credits.
// Served at /lab/menu/ on branch previews only. Picking a map opens /lab/menu/play/?world=<id>,
// which is the game itself (see play.js) with these settings applied.
import { load, save } from './settings.js';

// The five terrain regions the room server already knows (flight/server/worker.js WORLDS).
// Heights from the heightmaps (notes/storyboards/terrain/regions.json); bounds are each heightmap's
// 4 x 4 web-mercator tile block, in degrees.
const MAPS = [
  { id: 'sierra', bounds: { w: -120.2344, e: -117.4219, n: 38.2727, s: 36.0313 }, name: 'Sierra Nevada', where: 'California', size: 249, peak: 4310 },
  { id: 'alps', bounds: { w: 6.3281, e: 9.1406, n: 47.0402, s: 45.089 }, name: 'Alps', where: 'Valais, Switzerland', size: 217, peak: 4676 },
  { id: 'himalaya', bounds: { w: 85.7812, e: 88.5938, n: 28.9216, s: 26.4312 }, name: 'Himalaya', where: 'Everest, Nepal', size: 277, peak: 8461 },
  { id: 'grandcanyon', bounds: { w: -113.9062, e: -111.0938, n: 37.1603, s: 34.8859 }, name: 'Grand Canyon', where: 'Arizona', size: 253, peak: 3609 },
  { id: 'denali', bounds: { w: -153.2812, e: -147.6562, n: 64.1681, s: 61.6064 }, name: 'Alaska Range', where: 'Denali, Alaska', size: 284, peak: 5798 },
];
const FT = 3.281;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ---- screens: one at a time, each with its own hash so the browser's back button works ----
const SCREENS = ['main', 'maps', 'settings', 'credits'];
function show(id) {
  if (!SCREENS.includes(id)) id = 'main';
  for (const s of $$('.screen')) s.toggleAttribute('data-on', s.id === id);
  document.body.classList.toggle('deep', id !== 'main');
  document.body.classList.toggle('globe', id === 'maps');
  if (id === 'maps') openGlobe(); else globe?.stop();
  sel = -1;
  if (id === 'maps') cards.get(picked)?.focus({ preventScroll: true });
  else focusables()[0]?.focus({ preventScroll: true });
}
const current = () => $('.screen[data-on]').id;
const go = (id) => { location.hash = id === 'main' ? '' : id; };
addEventListener('hashchange', () => show(location.hash.slice(1)));
for (const b of $$('[data-go]')) b.addEventListener('click', () => go(b.dataset.go));
for (const b of $$('[data-back]')) b.addEventListener('click', () => history.length > 1 && location.hash ? history.back() : go('main'));

// ---- maps: a globe above, a carousel of cards along the bottom ----
// Hover (or focus, or tap on touch) a card and the globe spins to that map and halos it;
// click it, or tap it again, to fly there. Tapping a gold square on the globe picks it too.
const list = $('#mapList');
const cards = new Map();
let globe = null, picked = MAPS[0].id;
for (const m of MAPS) {
  const b = document.createElement('button');
  b.className = 'map';
  b.dataset.id = m.id;
  b.innerHTML = `<img src="maps/${m.id}.jpg" alt=""><span class="txt"><b>${m.name}</b>`
    + `<span class="meta">${m.where}</span><span class="meta">${m.size} km across · peak ${Math.round(m.peak * FT).toLocaleString()} ft</span>`
    + `<span class="go">fly here ›</span></span>`;
  b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') choose(m.id); });
  b.addEventListener('focus', () => choose(m.id, { scroll: true }));
  // On touch the first tap only picks (its focus already spins the globe); a tap on the card
  // that was already picked flies. Keyboard Enter (detail 0) always flies.
  let wasPicked = false;
  b.addEventListener('pointerdown', () => { wasPicked = picked === m.id; });
  b.addEventListener('click', (e) => {
    if (e.detail && matchMedia('(hover: none)').matches && !wasPicked) choose(m.id, { scroll: true });
    else play(m.id);
  });
  cards.set(m.id, b);
  list.append(b);
}
function choose(id, { scroll = false } = {}) {
  picked = id;
  for (const [k, c] of cards) c.classList.toggle('sel', k === id);
  if (scroll) cards.get(id).scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  globe?.focus(id);
}
const nudge = (step) => {
  const i = MAPS.findIndex((m) => m.id === picked);
  const next = MAPS[(i + step + MAPS.length) % MAPS.length].id;
  cards.get(next).focus({ preventScroll: true });
};
$('#prev').addEventListener('click', () => nudge(-1));
$('#next').addEventListener('click', () => nudge(1));
async function openGlobe() {
  if (!globe) {
    const { createGlobe } = await import('./globe.js');
    globe = createGlobe({ canvas: $('#globe'), maps: MAPS, onPick: (id) => cards.get(id).focus({ preventScroll: true }) });
  }
  globe.start();
  choose(picked, { scroll: true });
}
function play(world) {
  const q = new URLSearchParams({ world });
  location.href = `play/?${q}`;
}

// ---- settings ----
const s = load();
const inv = $('#invertY');
inv.checked = s.invertY;
inv.addEventListener('change', () => { s.invertY = inv.checked; save(s); });
const seg = $$('#look button');
const paintLook = () => seg.forEach((b) => b.classList.toggle('on', b.dataset.v === s.look));
seg.forEach((b) => b.addEventListener('click', () => { s.look = b.dataset.v; save(s); paintLook(); }));
paintLook();

// ---- keyboard: arrows move, Enter picks, Esc goes back ----
let sel = -1;
const focusables = () => $$('.screen[data-on] .menu button, .screen[data-on] .map, .screen[data-on] .row input, .screen[data-on] .seg button, .screen[data-on] .back');
addEventListener('keydown', (e) => {
  const items = focusables();
  if (e.key === 'Escape' || e.key === 'Backspace') {
    if (current() !== 'main') { e.preventDefault(); go('main'); }
    return;
  }
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
  if (!step || !items.length) return;
  e.preventDefault();
  if (current() === 'maps') { nudge(step); return; }
  const at = items.indexOf(document.activeElement);
  sel = (at < 0 ? (step > 0 ? 0 : items.length - 1) : (at + step + items.length) % items.length);
  items[sel].focus();
});

show(location.hash.slice(1));
