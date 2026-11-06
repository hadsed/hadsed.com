// A virtual stick: press anywhere on the element and drag. Distance from the
// press point, divided by `radius` pixels, becomes the axis value.
// pointerStick({ element, x: 'roll', y: 'pitch', radius: 80 })
export function pointerStick({ element, x, y, radius = 80, invertY = false, deadzone = 0.06 } = {}) {
  let origin = null, cur = null, pointerId = null;
  const onDown = (e) => {
    if (pointerId !== null || e.button > 0) return;
    pointerId = e.pointerId;
    origin = cur = { x: e.clientX, y: e.clientY };
    try { element.setPointerCapture?.(e.pointerId); } catch { /* synthetic or already gone */ }
  };
  const onMove = (e) => { if (e.pointerId === pointerId) cur = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => { if (e.pointerId === pointerId) { pointerId = null; origin = cur = null; } };
  const shape = (v) => {
    const a = Math.min(1, Math.abs(v));
    return a < deadzone ? 0 : Math.sign(v) * ((a - deadzone) / (1 - deadzone)) ** 1.5;
  };
  return {
    id: 'pointer',
    attach() {
      element.addEventListener('pointerdown', onDown);
      element.addEventListener('pointermove', onMove);
      element.addEventListener('pointerup', onUp);
      element.addEventListener('pointercancel', onUp);
      // iOS can drop the pointerup (system gesture, finger slides off the
      // edge); losing capture is the last word, so the stick never sticks.
      element.addEventListener('lostpointercapture', onUp);
    },
    detach() {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onUp);
      element.removeEventListener('lostpointercapture', onUp);
    },
    poll(sink) {
      if (!origin) return;
      if (x) sink.axis(x, shape((cur.x - origin.x) / radius));
      if (y) sink.axis(y, shape(((cur.y - origin.y) / radius) * (invertY ? -1 : 1)));
    },
    // Where the stick is, for drawing an on-screen indicator.
    get state() { return origin ? { origin, cur, radius } : null; },
  };
}
