# Flight assets

`jet.<hash>.bin` is helijah's Lockheed SR-71 Blackbird
(https://sketchfab.com/3d-models/1850c7bb7ac54902bd9868381ff8b652, Sketchfab
Standard license). That license allows use inside a project but not making the
model available as a standalone file, so the GLB is never committed or served.
It is baked into the scrambled packed format by `scripts/pack-jet.mjs` and
decoded in the browser by `packages/assets/jet-pack.js`.

Rebuild from the original GLB (kept out of the repo):

```
node scripts/pack-jet.mjs lockheed_sr-71_blackbird.glb --nose -x --up +y \
  --drop "^Object_([2-9]|1[0-9]|2[0-8]|34)$" --drop-below -1.52 --length 32.7 \
  --credit "SR-71 model © helijah (sketchfab.com/helijah), Sketchfab Standard license. Extraction or reuse of the model is not permitted." \
  --out flight/assets
```

Then point `manifest.json` `jet.src` at the new hashed file. `Object_2`–`Object_28`
are the cockpit interior and instruments, `Object_34` is the drag chute, and
`--drop-below` removes the landing gear and open gear doors, which share meshes
with the hull.
