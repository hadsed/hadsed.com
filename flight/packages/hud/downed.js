// The card that drops down from the top when you crash: who gets the kill, how you went
// in, and what you did this flight. A countdown bar runs along the bottom to the respawn.
//
// const card = createDowned(el, { onFly });
// card.show({ kicker, title, detail, stats: [[label, value, best?], ...], seconds });
// card.tick(secondsLeft); card.hide();

export function createDowned(el, { onFly } = {}) {
  el.innerHTML = `
    <div class="dn-kicker"></div>
    <div class="dn-title"></div>
    <div class="dn-detail"></div>
    <dl class="dn-stats"></dl>
    <div class="dn-foot"><span class="dn-left"></span><button type="button" class="dn-fly">fly now</button></div>
    <div class="dn-bar"><i></i></div>`;
  const q = (s) => el.querySelector(s);
  const kicker = q('.dn-kicker'), title = q('.dn-title'), detail = q('.dn-detail'), stats = q('.dn-stats'), left = q('.dn-left'), bar = q('.dn-bar i');
  q('.dn-fly').addEventListener('click', (e) => { e.stopPropagation(); onFly?.(); });
  for (const t of ['pointerdown', 'pointerup']) el.addEventListener(t, (e) => e.stopPropagation());
  let total = 1, shown = false;

  return {
    get shown() { return shown; },
    show({ kicker: k, title: t, detail: d, stats: rows, seconds }) {
      kicker.textContent = k; title.textContent = t; detail.textContent = d;
      stats.innerHTML = '';
      for (const [label, value, best] of rows) {
        const dt = document.createElement('dt'); dt.textContent = label;
        const dd = document.createElement('dd'); dd.textContent = value;
        if (best) { const b = document.createElement('span'); b.className = 'dn-best'; b.textContent = 'best'; dd.appendChild(b); }
        const cell = document.createElement('div'); cell.append(dt, dd);
        stats.append(cell);
      }
      total = seconds;
      el.hidden = false;
      shown = true;
      // Next frame, so the drop animates from above instead of appearing in place.
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
    },
    tick(s) {
      left.textContent = `back in the sky in ${Math.max(0, Math.ceil(s))}`;
      bar.style.transform = `scaleX(${Math.max(0, Math.min(1, s / total))})`;
    },
    hide() {
      if (!shown) return;
      shown = false;
      el.classList.remove('on');
      setTimeout(() => { if (!shown) el.hidden = true; }, 450);
    },
  };
}
