// A source driven by code: set values and they come out as input.
// This is the template for voice and camera-gesture sources. A gesture
// recognizer (ideally in a Web Worker) calls set('roll', handTilt) as frames
// arrive; a voice source calls set('throttle', 1) or tap('waggle').
export function scripted(id = 'scripted') {
  const axes = new Map();
  const actions = new Map();
  const taps = new Set();
  return {
    id,
    set(name, value) { axes.set(name, value); },
    hold(name, on = true) { actions.set(name, on); },
    tap(name) { taps.add(name); },
    clear() { axes.clear(); actions.clear(); taps.clear(); },
    poll(sink) {
      for (const [n, v] of axes) sink.axis(n, v);
      for (const [n, v] of actions) sink.action(n, v);
      for (const n of taps) sink.action(n, true);
      taps.clear();
    },
  };
}
