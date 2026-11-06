// Gestures on the website that pan the 3D view behind it, as a yaw/pitch offset (radians).
// Used by the SR-71 backdrop lab; the staging home page and the flight hand-over can share it.
//
//   const g = createSiteGestures(settings, { log });
//   g.wire(iframe.contentWindow);     // once the site page has loaded (same origin)
//   each frame: if (g.step()) redraw; then orbit the camera by g.G.yaw / g.G.pitch around its target.
//
// settings (read live, so a panel can change them): scrollPan, scrollDeg, scrollTilt, scrollMax,
// sidePan, sideSens, bgDrag, overscroll.
// - page position pans the view: a pure function of scrollY, so scrolling back always undoes it
// - a sideways swipe or trackpad pan turns it; mouse drag on empty background orbits
// - overscroll past either end swings it along a rubber band (tanh) that can't jump
const DEG = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function createSiteGestures(S, { log = () => {} } = {}) {
  const G = { yaw: 0, pitch: 0, scrollYaw: 0, scrollPitch: 0, sideYaw: 0, dragPitch: 0, spring: 0, bounce: 0, wheelOver: 0, lastOverscroll: 0 };
  let lastStep = performance.now();
  const OVER_MAX = 20 * Math.PI / 180;
  function step() {
    const now = performance.now(), dt = Math.min((now - lastStep) / 1000, 0.1); lastStep = now;
    // overscroll springs back once the wheel goes quiet (time-based, so it feels the same at any frame rate)
    // Overscroll pan follows a rubber-band curve (tanh), so it starts proportional and can never jump past
    // OVER_MAX. Two sources: the browser's own elastic bounce (Safari, Mac Chrome; smooth and eased by the
    // browser, works for finger and trackpad alike) and, where there is no bounce, wheel input at the ends.
    if (now - G.lastOverscroll > 140) G.wheelOver *= Math.exp(-dt / 0.3);
    if (Math.abs(G.wheelOver) < 0.5) G.wheelOver = 0;
    const px = Math.abs(G.bounce) > Math.abs(G.wheelOver) ? G.bounce : G.wheelOver;
    G.spring = S.overscroll ? OVER_MAX * Math.tanh(px / 450) : 0;
    const yaw = G.scrollYaw + G.sideYaw + G.spring, pitch = G.scrollPitch + G.dragPitch;
    const k = 1 - Math.exp(-dt / 0.18);   // smoothing toward the target offset
    const ny = G.yaw + (yaw - G.yaw) * k, np = G.pitch + (pitch - G.pitch) * k;
    const moving = Math.abs(ny - G.yaw) > 1e-5 || Math.abs(np - G.pitch) > 1e-5;
    G.yaw = ny; G.pitch = np;
    return moving;
  }

  function readScroll(w) {
    if (!w) return;
    // Clamp to the real scroll range: Safari's elastic bounce reports scrollY past either end for a
    // moment, which made the view swing out and snap back.
    const el = w.document.scrollingElement;
    const maxY = Math.max(0, el.scrollHeight - w.innerHeight);
    const screens = clamp(w.scrollY, 0, maxY) / Math.max(w.innerHeight, 1);
    G.bounce = w.scrollY < 0 ? w.scrollY : w.scrollY > maxY ? w.scrollY - maxY : 0;   // elastic overshoot in px
    G.scrollYaw = S.scrollPan ? Math.min(screens * S.scrollDeg, S.scrollMax) * DEG : 0;
    G.scrollPitch = S.scrollPan ? Math.min(screens * S.scrollTilt, 8) * DEG : 0;
  }
  const NOT_BACKGROUND = 'a, button, input, textarea, select, label, p, h1, h2, h3, h4, h5, li, img, svg, figure, pre, code, blockquote, time, .card, [class*="project"]';
  function wire(w) {
    const doc = w?.document;
    if (!doc || doc.__lab) return;
    doc.__lab = true;
    // Keep vertical rubber-banding (it drives the overscroll pan); stop sideways swipes from navigating back.
    for (const el of [doc.documentElement, doc.body]) el.style.overscrollBehaviorX = 'none';
    w.addEventListener('scroll', () => { log(`scroll y ${Math.round(w.scrollY)}`); readScroll(w); }, { passive: true });
    for (const type of ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'gesturestart']) {
      w.addEventListener(type, (e) => log(`${type} ${e.pointerType || ''}`), { passive: true });
    }
    // A trackpad gesture is a burst of wheel events (finger, then momentum) with no gap longer than ~250 ms.
    // Each burst locks to one axis when it starts, so a vertical scroll's sideways noise can't pan, and
    // Wheel bursts that start pinned at an end feed the overscroll pan, capped per event so one big
    // trackpad delta can't jump it (the old bug: ~25 degrees in two events, then a snap back).
    let burst = { last: 0, axis: null, startedAtEnd: false };
    w.addEventListener('wheel', (e) => {
      const now = performance.now();
      const dx = e.deltaX || (e.shiftKey ? e.deltaY : 0), dy = e.shiftKey ? 0 : e.deltaY;
      const el = doc.scrollingElement, maxY = Math.max(0, el.scrollHeight - w.innerHeight);
      const atEnd = w.scrollY >= maxY - 2, atTop = w.scrollY <= 0;
      if (now - burst.last > 250) burst = { last: now, axis: null, startedAtEnd: (atEnd && dy > 0) || (atTop && dy < 0) };
      log(`wheel dx ${e.deltaX.toFixed(1)} dy ${e.deltaY.toFixed(1)} mode ${e.deltaMode} y ${Math.round(w.scrollY)}`);
      burst.last = now;
      if (!burst.axis && Math.hypot(dx, dy) > 2) burst.axis = Math.abs(dx) > Math.abs(dy) * 1.5 ? 'x' : 'y';
      if (burst.axis === 'x') {
        if (S.sidePan) { G.sideYaw += dx * S.sideSens * 0.001; e.preventDefault(); }
        return;
      }
      if (burst.startedAtEnd && ((atEnd && dy > 0) || (atTop && dy < 0))) {
        G.wheelOver = clamp(G.wheelOver + clamp(dy, -40, 40) * 0.5, -1500, 1500);
        G.lastOverscroll = now;
      }
    }, { passive: false });
    // touch: a mostly horizontal swipe pans; vertical swipes scroll the page as usual
    let t0 = null, axis = null;
    w.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY }; axis = null; } }, { passive: true });
    w.addEventListener('touchmove', (e) => {
      if (!S.sidePan || !t0 || e.touches.length !== 1) return;
      const x = e.touches[0].clientX, y = e.touches[0].clientY, dx = x - t0.x, dy = y - t0.y;
      if (!axis && Math.hypot(dx, dy) > 8) axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y';
      if (axis === 'x') { G.sideYaw -= dx * S.sideSens * 0.003; t0 = { x, y }; e.preventDefault(); }
    }, { passive: false });
    w.addEventListener('touchend', () => { t0 = null; }, { passive: true });
    // mouse/pen: drag on empty background orbits in any direction
    let drag = null;
    w.addEventListener('pointerdown', (e) => {
      if (!S.bgDrag || e.pointerType === 'touch' || e.button !== 0 || e.target.closest(NOT_BACKGROUND)) return;
      drag = { x: e.clientX, y: e.clientY }; doc.documentElement.style.cursor = 'grabbing'; e.preventDefault();
    });
    w.addEventListener('pointermove', (e) => {
      if (!drag) {
        if (S.bgDrag && e.pointerType !== 'touch') doc.documentElement.style.cursor = e.target.closest(NOT_BACKGROUND) ? '' : 'grab';
        return;
      }
      G.sideYaw -= (e.clientX - drag.x) * 0.004;
      G.dragPitch = clamp(G.dragPitch + (e.clientY - drag.y) * 0.003, -0.6, 0.6);
      drag = { x: e.clientX, y: e.clientY };
    });
    w.addEventListener('pointerup', () => { drag = null; doc.documentElement.style.cursor = ''; });
    readScroll(w);
  }
  /** Forget swipes and drags (the page-position part stays, it follows scrollY). */
  function reset() { G.sideYaw = 0; G.dragPitch = 0; G.wheelOver = 0; }
  return { G, step, readScroll, wire, reset };
}
