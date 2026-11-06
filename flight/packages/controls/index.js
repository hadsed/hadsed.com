// Controls SDK: turns any input device into named axes and actions.
//
// The app declares what it wants ("pitch", "roll", "jump"), sources fill it in.
// Nothing here knows about jets, three.js, or this site, so the same SDK can
// drive a flight game, a canvas app, or anything else.
//
//   const controls = createControls({
//     axes: ['pitch', 'roll'],
//     actions: ['waggle'],
//     sources: [keyboard({ axes: { pitch: ['KeyS', 'KeyW'] }, actions: { waggle: ['Space'] } })],
//   });
//   const frame = controls.read(dt);   // { axes: { pitch, roll }, actions: { waggle }, pressed: { waggle } }
//
// A source is { id, attach(), detach(), poll(sink, dt) }. poll() calls
// sink.axis(name, value) with value in [-1, 1] and sink.action(name, held).
// When several sources drive one axis, the strongest input wins, so a gamepad
// and a camera gesture can be live at the same time without fighting.

export function createControls({ axes = [], actions = [], sources = [] } = {}) {
  const axisNames = [...axes];
  const actionNames = [...actions];
  const frame = {
    axes: Object.fromEntries(axisNames.map((n) => [n, 0])),
    actions: Object.fromEntries(actionNames.map((n) => [n, false])),
    pressed: Object.fromEntries(actionNames.map((n) => [n, false])),
    active: new Set(),   // ids of sources that produced input this frame
  };
  const held = Object.fromEntries(actionNames.map((n) => [n, false]));
  const live = [];
  let currentId = null;

  const sink = {
    axis(name, value) {
      if (!(name in frame.axes) || !Number.isFinite(value)) return;
      const v = Math.max(-1, Math.min(1, value));
      if (Math.abs(v) > Math.abs(frame.axes[name])) frame.axes[name] = v;
      if (v !== 0) frame.active.add(currentId);
    },
    action(name, on) {
      if (!(name in frame.actions)) return;
      if (on) { frame.actions[name] = true; frame.active.add(currentId); }
    },
  };

  const api = {
    axes: axisNames,
    actions: actionNames,
    add(source) {
      live.push(source);
      source.attach?.();
      return () => api.remove(source);
    },
    remove(source) {
      const i = live.indexOf(source);
      if (i >= 0) { live.splice(i, 1); source.detach?.(); }
    },
    sources: () => [...live],
    // Collect one frame of input. Call once per game tick.
    read(dt = 1 / 60) {
      for (const n of axisNames) frame.axes[n] = 0;
      for (const n of actionNames) frame.actions[n] = false;
      frame.active.clear();
      for (const s of live) { currentId = s.id; s.poll(sink, dt); }
      for (const n of actionNames) {
        frame.pressed[n] = frame.actions[n] && !held[n];
        held[n] = frame.actions[n];
      }
      return frame;
    },
    dispose() { for (const s of live.splice(0)) s.detach?.(); },
  };
  for (const s of sources) api.add(s);
  return api;
}

export { ramp } from './util.js';
export { keyboard } from './sources/keyboard.js';
export { pointerStick } from './sources/pointer.js';
export { gamepad } from './sources/gamepad.js';
export { scripted } from './sources/scripted.js';
