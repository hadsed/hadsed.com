// Main menu prototype for the flight game: Play -> map select -> the game; Settings; Credits.
// Served at /lab/menu/ on branch previews only. Picking a map opens /lab/menu/play/?world=<id>,
// which is the game itself (see play.js) with these settings applied.
import { load, save } from './settings.js';

// The five terrain regions the room server already knows (flight/server/worker.js WORLDS).
// Heights from the heightmaps (notes/storyboards/terrain/regions.json).
const MAPS = [
  { id: 'sierra', name: 'Sierra Nevada', where: 'California', size: 249, peak: 4310 },
  { id: 'alps', name: 'Alps', where: 'Valais, Switzerland', size: 217, peak: 4676 },
  { id: 'himalaya', name: 'Himalaya', where: 'Everest, Nepal', size: 277, peak: 8461 },
  { id: 'grandcanyon', name: 'Grand Canyon', where: 'Arizona', size: 253, peak: 3609 },
  { id: 'denali', name: 'Alaska Range', where: 'Denali, Alaska', size: 284, peak: 5798 },
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
  sel = -1;
  focusables()[0]?.focus({ preventScroll: true });
}
const current = () => $('.screen[data-on]').id;
const go = (id) => { location.hash = id === 'main' ? '' : id; };
addEventListener('hashchange', () => show(location.hash.slice(1)));
for (const b of $$('[data-go]')) b.addEventListener('click', () => go(b.dataset.go));
for (const b of $$('[data-back]')) b.addEventListener('click', () => history.length > 1 && location.hash ? history.back() : go('main'));

// ---- maps ----
const list = $('#mapList');
for (const m of MAPS) {
  const b = document.createElement('button');
  b.className = 'map';
  b.innerHTML = `<img src="maps/${m.id}.jpg" alt="" loading="lazy"><span class="txt"><b>${m.name}</b>`
    + `<span class="meta">${m.where}</span><span class="meta">${m.size} km across · peak ${Math.round(m.peak * FT).toLocaleString()} ft</span></span>`;
  b.addEventListener('click', () => play(m.id));
  list.append(b);
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
  const at = items.indexOf(document.activeElement);
  sel = (at < 0 ? (step > 0 ? 0 : items.length - 1) : (at + step + items.length) % items.length);
  items[sel].focus();
});

show(location.hash.slice(1));
