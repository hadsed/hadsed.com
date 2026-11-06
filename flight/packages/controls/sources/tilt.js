// Tilt steering from the device's motion sensors (phones, tablets).
//
// const t = tilt({ x: 'roll', y: 'pitch', range: 25 });
// await t.enable();   // must run inside a tap on iOS, which asks permission
// t.calibrate();      // "the way I'm holding it now" becomes neutral
//
// Tilting right gives +x. Tilting the top edge toward you gives +y (pull
// back to climb, like a yoke). Angles are measured from where the device was
// when enabled, so any comfortable grip works, in portrait or landscape.
export function tilt({ x, y, range = 25, deadzone = 2, target = globalThis } = {}) {
  let on = false, last = null, zero = null;

  // Map the sensor's device-frame angles to what the person sees on screen.
  const screenAngle = () => (target.screen?.orientation?.angle ?? target.orientation ?? 0) % 360;
  function read(e) {
    const b = e.beta ?? 0, g = e.gamma ?? 0;
    switch ((screenAngle() + 360) % 360) {
      case 90: return { side: b, toward: -g };    // landscape, top of the device to the left
      case 270: return { side: -b, toward: g };   // landscape, top to the right
      case 180: return { side: -g, toward: -b };
      default: return { side: g, toward: b };     // portrait
    }
  }

  const onOrient = (e) => {
    if (e.beta === null && e.gamma === null) return;
    last = read(e);
    if (!zero) zero = { ...last };
  };
  const onRotate = () => { zero = null; };   // new orientation: re-zero on the next reading

  const shape = (deg) => {
    const a = Math.abs(deg);
    if (a < deadzone) return 0;
    return Math.sign(deg) * Math.min(1, (a - deadzone) / (range - deadzone));
  };

  return {
    id: 'tilt',
    get supported() { return typeof target.DeviceOrientationEvent !== 'undefined'; },
    get enabled() { return on; },
    // Resolves true when tilt is live. On iOS this must be called from a tap.
    async enable() {
      if (on) return true;
      const DOE = target.DeviceOrientationEvent;
      if (!DOE) return false;
      if (typeof DOE.requestPermission === 'function') {
        try { if ((await DOE.requestPermission()) !== 'granted') return false; } catch { return false; }
      }
      zero = null;
      target.addEventListener('deviceorientation', onOrient);
      target.screen?.orientation?.addEventListener?.('change', onRotate);
      on = true;
      return true;
    },
    disable() {
      on = false; last = zero = null;
      target.removeEventListener('deviceorientation', onOrient);
      target.screen?.orientation?.removeEventListener?.('change', onRotate);
    },
    calibrate() { zero = last ? { ...last } : null; },
    detach() { this.disable(); },
    poll(sink) {
      if (!on || !last || !zero) return;
      if (x) sink.axis(x, shape(last.side - zero.side));
      if (y) sink.axis(y, shape(last.toward - zero.toward));
    },
    // For tests: feed a reading as if the sensor sent it.
    feed(e) { onOrient(e); },
  };
}
