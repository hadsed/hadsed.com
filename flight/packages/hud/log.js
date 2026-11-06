// Status log: short lines at the top left telling you what the jet (or the
// world) is doing on its own: autopilot, limits, formation, the connection.
// General on purpose; anything can post to it.
//
// const log = createLog(el);
// log.post('follow', 'following KITE 21');         // shows for a few seconds
// log.hold('edge', 'nearing the edge of the map');  // stays while you keep calling it each frame
// log.drop('edge');                                // or call hold(key, null)
//
// Lines are keyed: posting the same key replaces its line instead of adding one.

export function createLog(el, { max = 4, ttl = 5000, now = () => performance.now() } = {}) {
  const lines = new Map();   // key -> { node, until, held }

  function show(key, text, until, held) {
    let l = lines.get(key);
    if (!l) {
      const node = document.createElement('div');
      node.className = 'logline';
      el.appendChild(node);
      requestAnimationFrame(() => node.classList.add('on'));
      lines.set(key, (l = { node }));
    }
    if (l.node.textContent !== text) l.node.textContent = text;
    l.until = until; l.held = held;
    l.node.classList.toggle('held', held);
    while (lines.size > max) drop(lines.keys().next().value);
  }

  function drop(key) {
    const l = lines.get(key);
    if (!l) return;
    lines.delete(key);
    l.node.classList.remove('on');
    setTimeout(() => l.node.remove(), 600);
  }

  return {
    post(key, text, ms = ttl) { show(key, text, now() + ms, false); },
    // A condition that lasts: keeps its line up while held, then lingers a moment.
    hold(key, text) {
      if (text) show(key, text, now() + 1500, true);
      else { const l = lines.get(key); if (l?.held) l.held = false; }
    },
    drop,
    tick() { const t = now(); for (const [k, l] of lines) if (!l.held && t > l.until) drop(k); },
    get keys() { return [...lines.keys()]; },
  };
}
