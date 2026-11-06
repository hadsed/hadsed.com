// gamepad({ axes: { roll: 0, pitch: 1 }, buttons: { waggle: 0 }, invert: { pitch: false } })
// Standard-mapping axis and button indices.
export function gamepad({ axes = {}, buttons = {}, invert = {}, deadzone = 0.12, index = null } = {}) {
  const pads = () => (globalThis.navigator?.getGamepads?.() || []).filter(Boolean);
  const dz = (v) => (Math.abs(v) < deadzone ? 0 : Math.sign(v) * (Math.abs(v) - deadzone) / (1 - deadzone));
  return {
    id: 'gamepad',
    poll(sink) {
      const list = pads();
      const pad = index === null ? list[0] : list.find((p) => p.index === index);
      if (!pad) return;
      for (const [name, i] of Object.entries(axes)) sink.axis(name, dz(pad.axes[i] || 0) * (invert[name] ? -1 : 1));
      for (const [name, i] of Object.entries(buttons)) sink.action(name, !!pad.buttons[i]?.pressed);
    },
  };
}
