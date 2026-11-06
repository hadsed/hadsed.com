# Controls SDK

Input as data. The app names the axes and actions it wants; sources (keyboard,
touch stick, gamepad, and later voice and camera gestures) fill them in. No
dependencies, no knowledge of the app.

```js
import { createControls, keyboard, pointerStick, gamepad } from './index.js';

const controls = createControls({
  axes: ['pitch', 'roll', 'yaw', 'throttle'],
  actions: ['waggle'],
  sources: [
    keyboard({ axes: { roll: [['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']] }, actions: { waggle: 'Space' } }),
    pointerStick({ element: canvas, x: 'roll', y: 'pitch' }),
    gamepad({ axes: { roll: 0, pitch: 1 } }),
  ],
});

// once per tick
const { axes, actions, pressed, active } = controls.read(dt);
```

## Writing a source

```js
{
  id: 'gesture',
  attach() {},          // start listening (camera, mic, events)
  detach() {},          // stop and release devices
  poll(sink, dt) {      // called once per read()
    sink.axis('roll', -0.4);      // value in [-1, 1]
    sink.action('waggle', true);  // held this frame
  },
}
```

Rules that keep sources composable:

- Strongest input wins per axis, so several sources can be live together.
- `pressed` is true only on the frame an action goes from up to down.
- `active` lists which sources produced input, so the app can show
  "steering by hand" or fade out keyboard hints.
- Heavy work (pose models, speech) belongs in a Worker; `poll` should only
  read the latest result.

`tilt({ x, y, range })` reads the phone's motion sensors. Call `enable()`
from a tap (iOS asks permission there); the grip at that moment is neutral,
and `calibrate()` re-zeroes it.

`scripted()` is the simplest source and the starting point for voice and
gesture adapters: call `set`, `hold`, or `tap` from anywhere.

This folder is meant to become its own package. Keep it free of imports from
the rest of `flight/`.
