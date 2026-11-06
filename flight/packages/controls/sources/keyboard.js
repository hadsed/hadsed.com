import { ramp } from '../util.js';

// keyboard({ axes: { roll: ['KeyA', 'KeyD'] }, actions: { waggle: ['Space'] } })
// Each axis lists [negative key(s), positive key(s)]; a string or an array of codes.
export function keyboard({ axes = {}, actions = {}, target = globalThis, attack = 3, release = 5 } = {}) {
  const down = new Set();
  const value = Object.fromEntries(Object.keys(axes).map((n) => [n, 0]));
  const list = (k) => (Array.isArray(k) ? k : [k]);
  const any = (keys) => list(keys).some((k) => down.has(k));
  const bound = new Set(Object.values(axes).flat(2).concat(Object.values(actions).flat()));

  const onDown = (e) => {
    if (e.target?.closest?.('input, textarea, [contenteditable]')) return;
    if (bound.has(e.code)) e.preventDefault();
    down.add(e.code);
  };
  const onUp = (e) => down.delete(e.code);
  const onBlur = () => down.clear();

  return {
    id: 'keyboard',
    attach() {
      target.addEventListener?.('keydown', onDown);
      target.addEventListener?.('keyup', onUp);
      target.addEventListener?.('blur', onBlur);
    },
    detach() {
      target.removeEventListener?.('keydown', onDown);
      target.removeEventListener?.('keyup', onUp);
      target.removeEventListener?.('blur', onBlur);
      down.clear();
    },
    poll(sink, dt) {
      for (const [name, [neg, pos]] of Object.entries(axes)) {
        const goal = (any(pos) ? 1 : 0) - (any(neg) ? 1 : 0);
        value[name] = ramp(value[name], goal, dt, attack, release);
        sink.axis(name, value[name]);
      }
      for (const [name, keys] of Object.entries(actions)) sink.action(name, any(keys));
    },
    // For tests and synthetic input.
    press(code) { down.add(code); },
    release(code) { down.delete(code); },
  };
}
