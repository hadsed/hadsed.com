// The game, entered from the menu prototype. Like the mechanics jig, the page is the flight lab's
// own index.html with a <base> at /lab/flight/ (built in eleventy.config.js), so it is exactly the
// live game; this only applies the menu's settings and adds a way back to the menu.
import { load } from './settings.js';

const s = load();
// main.js reads its URL once, as it loads, so the look goes in before the import.
const url = new URL(location.href);
if (s.look === 'site') url.searchParams.set('look', 'site'); else url.searchParams.delete('look');
history.replaceState(null, '', url);

await import('../flight/main.js');
const F = window.__flight;
F.assist.tune.reverseY = !!s.invertY;

// Back to the menu: a small button top left, or Esc.
const back = document.createElement('button');
back.id = 'toMenu';
back.type = 'button';
back.textContent = '‹ menu';
back.title = 'Back to the menu (Esc)';
document.body.append(back);
const leave = () => { location.href = '/lab/menu/#maps'; };
back.addEventListener('click', leave);
addEventListener('keydown', (e) => { if (e.code === 'Escape') leave(); });
