# Flight lab: testing across devices and networks

Three tools, all free, all run in GitHub Actions on every change to `flight/`
(`.github/workflows/flight-devices.yml`). Results land in the job summary and
the `flight-report` artifact.

| Tool | What it answers |
| --- | --- |
| `devices.mjs` | Does the lab load, draw, take input, survive rotation, GPU resets and dead links on phones, tablets and desktops, in Chromium, WebKit and Firefox? |
| `net/shaper.mjs` | What does a given link feel like? A TCP relay that adds latency, jitter, bandwidth limits, retransmit stalls, blackholes (half-open sockets) and resets. |
| `swarm.mjs` | What does a crowded room feel like? Many headless pilots using the real client and sim, measuring join time, snapshot rate, bandwidth and how smooth other jets look. |

Plus `npm test` covers the pieces offline: `test/flight-net.test.mjs` replays
each network profile through the interpolator (`net/interp-bench.mjs`) and
checks the dead-socket watchdog with a fake WebSocket.

## Running locally (or in a cloud session)

```
cd flight/server && npm ci && npx wrangler dev --port 8787 --var PER_IP:1000 &
FLIGHT_LAB=1 npx eleventy
node flight/test/devices.mjs --engines chromium            # all devices, Chromium only
node flight/test/devices.mjs --only iphone --net edge      # one device, worse network
node flight/test/swarm.mjs --clients 100                   # one crowded room
node flight/test/swarm.mjs --clients 12 --profile 3g --chaos blackhole@15:8,cut@32
node flight/test/net/interp-bench.mjs                      # smoothness per profile, offline
```

Network profiles (`net/shaper.mjs`): `ideal`, `fiber`, `wifi`, `4g`, `3g`,
`edge`, `hotel` (fine on average, 2 s stalls), `farAway` (another continent).

## How to read the smoothness numbers

Every frame, another jet flying at constant speed should move `speed x dt`.
A *hitch* is a frame where it moved more than 50% off that. Under ~1% is
invisible; 5% reads as occasional judder; 20%+ looks broken.

## What this does not cover

WebKit on Linux is the Safari engine, not iOS Safari. These only show up on
real hardware:

- Safari's toolbars collapsing and expanding (viewport height changes mid-flight)
- iPadOS trackpad and Apple Pencil gesture routing
- GPU memory limits and tab kills on older iPhones, thermal throttling
- Real frame rates (CI renders in software, so its fps numbers mean nothing)

For those: Had's own iPad with Safari Web Inspector, and one month of a real
device cloud (BrowserStack Live) before a launch.
