# Flight: architecture

A shared sky over real terrain. Visitors fly jets, see each other as ghost
jets with contrails, and can fly together. This folder is the multiplayer
version of the SR-71 lab, built so each part can change without touching the
others.

## Five parts, one direction of dependency

```
controls  ──►  (intents)  ──►  sim  ◄──  bots
                                │
                    net (protocol, interpolation)
                                │
assets  ──►  render  ◄──  main.js (the only file that knows about all of them)
```

| Part | Folder | Knows about | Runs on |
| --- | --- | --- | --- |
| Controls SDK | `packages/controls` | Nothing in this project. No three.js, no flight words. | Browser |
| Flight sim | `packages/sim` | Plain numbers. No DOM, no three.js. | Browser and server |
| Bots | `packages/bots` | The sim's state shape. Outputs the same intent a player does. | Server |
| Net | `packages/net` | The sim's state shape. Binary on the hot path. | Browser and server |
| Assets | `packages/assets` + `assets/manifest.json` | three.js geometry and textures, described by data. | Browser |
| Render | `packages/render` | three.js and assets. Reads state, never changes it. | Browser |
| Room server | `server/` | Sim, net, bots. A Cloudflare Durable Object is a thin shell around `room.js`. | Cloudflare |

`main.js` wires them together. Nothing else imports across parts except
through the arrows above.

## Principles, and where they come from

1. **Ports and adapters for input** (hexagonal architecture). The game asks
   for named axes and actions (`pitch`, `roll`, `throttle`, `waggle`). Sources
   (keyboard, touch, gamepad, and later voice and camera gestures) are adapters
   that fill those names in. The SDK never learns what a jet is, so it can
   drive tldraw, a jet, or anything else. This is also the Command pattern from
   *Game Programming Patterns*: input becomes data before anything acts on it.

2. **Fixed timestep, interpolated rendering** (Glenn Fiedler, *Fix Your
   Timestep*). The sim steps at exactly 60 Hz whatever the frame rate. The
   renderer blends between the last two sim states. Physics stays identical on
   a 120 Hz iPad, a 30 Hz phone, and the server, which is what lets bots run
   the same code as players.

3. **Sim is pure data and functions.** State is plain objects of numbers.
   `step(state, intent, dt)` has no side effects outside the state it owns. It
   can be unit tested, replayed, and run in Node or a Worker.

4. **Snapshot interpolation for remote jets** (Fiedler, *Snapshot
   Interpolation*; Valve, *Source Multiplayer Networking*). The server
   broadcasts snapshots at 10 Hz. Clients draw others about 120 ms in the
   past, blending between real snapshots. Your own jet is simulated locally
   and never waits on the network, so it never lags.

5. **Client authority with server sanity checks.** There is nothing to win
   yet, so clients report their own position. The server clamps speed,
   altitude and jumps, and rate-limits messages. When the core loop gains
   stakes, the same protocol can switch to sending intents instead.

6. **Binary on the hot path, JSON for rare messages.** A jet state is 25 bytes.
   Welcome and roster messages are JSON because they are rare and easy to
   evolve.

7. **Interest management.** Each player gets the nearest 48 jets, not
   everyone. Rooms cap at 200 jets and spill into copies (`sierra-2`, ...),
   with a hard cap on copies as a budget limit. Past the cap, people fly solo.

8. **Data-driven assets.** Worlds, the jet model and palettes are listed in
   `assets/manifest.json`. Swapping the procedural jet for a glTF, or adding a
   world, is a manifest change plus a loader, with no game code edits.

9. **Draw calls stay flat.** All ghost jets are one `InstancedMesh`. All
   contrails are one line geometry updated in place. Far jets are one points
   cloud. 50 jets costs about the same as 5.

10. **Graceful degradation.** No server, a full server, or a dropped socket
    all fall back to solo flight with the same controls and visuals.

## Bots

Bots live inside the room on the server. Each bot is a `pilot` (from
`packages/bots`) producing the same intent a keyboard would, fed to the same
`sim.step`. They get callsigns from the same generator, ids from the same pool,
and the wire format has no bot flag, so a client cannot tell them apart.
Bots spawn only while at least one person is flying (an empty room costs
nothing), keep the sky at about six jets, join on staggered timers, fly
lazy routes, and sometimes fall into formation off a real player's wing.

## Performance budget

- 60 fps on a mid phone: one terrain draw, one jet draw, one instanced draw,
  one line draw, one points draw, plus HUD as plain DOM.
- Network: about 25 bytes per visible jet per snapshot, 10 snapshots a second.
  48 visible jets is 12 KB/s.
- Sim step is allocation-free in the hot path.
- Later: gesture inference runs in a Web Worker inside the controls SDK, so it
  never blocks the frame.

## Not yet

Turnstile join tokens, voice and gesture sources, map-area sharding, the
core loop, glTF jet, other worlds in the feed. Each has a slot above.

## Running it

```
cd flight/server && npm install && npm run dev        # room server on :8787
FLIGHT_LAB=1 npx eleventy --serve                       # site with /lab/flight/
open http://localhost:8080/lab/flight/?server=ws://127.0.0.1:8787
```

Tests: `npm test` (sim, protocol, controls, bots, room).

Deploy: branch pushes deploy the Worker `hadsed-flight` and write its URL into
`lab/flight/config.json`. There is one Worker, so the last branch pushed wins.
Kill switch: set `FLIGHT_ENABLED = "0"` in `server/wrangler.toml` (or in the
Cloudflare dashboard) and every client flies solo.
