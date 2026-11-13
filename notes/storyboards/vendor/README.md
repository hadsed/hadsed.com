# Local 3D renderer

Three.js **0.186.1**, from the official npm registry package:
`https://registry.npmjs.org/three/-/three-0.186.1.tgz`.

Vendored files: `build/three.module.js`, `build/three.core.js`, and
`examples/jsm/controls/OrbitControls.js`. The import map in the directing room
resolves the controls' `three` import locally. No runtime CDN is required.

Copyright and MIT license: [THREE-LICENSE](THREE-LICENSE).

Minified copies (`*.min.js`) were made with esbuild 0.24 (`--minify --format=esm --legal-comments=inline`) for the backdrop lab; `three.module.min.js` imports `./three.core.min.js`.

Tweakpane **4.0.5** (MIT, cocopon), from `https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js`, as `tweakpane.min.js` (license header inline): the backdrop lab's panel.
