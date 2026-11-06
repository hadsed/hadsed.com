// Device matrix for the flight lab. Real browser engines (Chromium, WebKit,
// Firefox) emulating phones, tablets and desktops, each flown through the
// network shaper against a real room server (wrangler dev).
//
//   cd flight/server && npx wrangler dev --port 8787 &     # room server
//   FLIGHT_LAB=1 npx eleventy                              # builds _site/lab/flight
//   node flight/test/devices.mjs                           # every device x engine installed
//   node flight/test/devices.mjs --only iphone --net 3g    # a subset
//   node flight/test/devices.mjs --engines chromium        # what's installed here
//
// Writes flight/test/out/devices.json, devices.md and a screenshot per run.
// Exit code 1 if any check fails.
//
// What WebKit-on-Linux does NOT tell you about iOS Safari: toolbar show/hide
// resizes, real trackpad gesture routing, GPU memory limits, thermal
// throttling. Those need a real device (yours, or a device cloud).

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createShaper } from './net/shaper.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const ROOT = new URL('../../', import.meta.url).pathname;
const OUT = join(ROOT, 'flight/test/out');
const UPSTREAM = arg('server', 'ws://127.0.0.1:8787');

let pw;
try { pw = await import('playwright'); } catch {
  const { createRequire } = await import('node:module');
  pw = createRequire(join(process.execPath, '../../lib/node_modules/'))('playwright');
}
const { devices } = pw;

// name, engine, playwright device descriptor (or a plain context config), network profile
const MATRIX = [
  { name: 'iphone-15',          engine: 'webkit',   device: 'iPhone 15 Pro',        net: '4g' },
  { name: 'iphone-se',          engine: 'webkit',   device: 'iPhone SE',            net: '3g' },
  { name: 'ipad-pro-landscape', engine: 'webkit',   device: 'iPad Pro 11 landscape', net: 'wifi' },
  { name: 'ipad-mini',          engine: 'webkit',   device: 'iPad Mini',            net: 'hotel' },
  { name: 'pixel-7',            engine: 'chromium', device: 'Pixel 7',              net: '4g' },
  { name: 'galaxy-s9',          engine: 'chromium', device: 'Galaxy S9+',           net: 'edge' },
  { name: 'desktop-chrome',     engine: 'chromium', device: { viewport: { width: 1440, height: 900 } }, net: 'fiber' },
  { name: 'desktop-safari',     engine: 'webkit',   device: { viewport: { width: 1440, height: 900 } }, net: 'farAway' },
  { name: 'desktop-firefox',    engine: 'firefox',  device: { viewport: { width: 1280, height: 800 } }, net: 'wifi' },
  { name: 'laptop-small',       engine: 'chromium', device: { viewport: { width: 1024, height: 640 } }, net: 'hotel' },
];

// ---------- tiny static server for _site ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.svg': 'image/svg+xml' };
async function serveSite(dir) {
  const srv = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    try {
      const file = join(dir, p);
      if (!file.startsWith(dir)) throw new Error('outside');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() };
}

// ---------- in-page probes ----------
// Read the WebGL canvas right after the game has drawn (same frame), downscaled.
const probePixels = () => new Promise((resolve) => requestAnimationFrame(() => {
  const src = document.getElementById('view');
  const c = document.createElement('canvas'); c.width = 48; c.height = 48;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0, 48, 48);
  const d = g.getImageData(0, 0, 48, 48).data;
  const colors = new Set(); let sum = 0, sum2 = 0;
  for (let i = 0; i < d.length; i += 4) { const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; sum += l; sum2 += l * l; colors.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | d[i + 2] >> 4); }
  const n = d.length / 4;
  resolve({ colors: colors.size, std: Math.sqrt(sum2 / n - (sum / n) ** 2), w: src.width, h: src.height, cw: src.clientWidth, ch: src.clientHeight });
}));

const probeHud = () => {
  const vw = innerWidth, vh = innerHeight;
  const boxes = {};
  for (const id of ['tl', 'tr', 'bl', 'help']) {
    const r = document.getElementById(id).getBoundingClientRect();
    boxes[id] = { x: r.left, y: r.top, r: r.right, b: r.bottom, visible: getComputedStyle(document.getElementById(id)).opacity > 0.05 && r.width > 0 };
  }
  const off = Object.entries(boxes).filter(([, b]) => b.visible && (b.x < 0 || b.y < 0 || b.r > vw + 1 || b.b > vh + 1)).map(([k]) => k);
  const ids = Object.keys(boxes).filter((k) => boxes[k].visible);
  const overlaps = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = boxes[ids[i]], b = boxes[ids[j]];
    if (a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b) overlaps.push(`${ids[i]}/${ids[j]}`);
  }
  return { vw, vh, off, overlaps, scrollY: scrollY, scale: visualViewport?.scale ?? 1 };
};

// Watch other jets for `ms` at the screen's frame rate; same metric as net/smoothness.mjs.
const probeSmooth = (ms) => new Promise((resolve) => {
  const last = new Map(); let frames = 0, hitches = 0, prevT = null, fps = 0;
  const t0 = performance.now();
  function f(t) {
    fps++;
    const R = window.__flight.remotes.remotes;
    if (prevT !== null) for (const [id, r] of R) {
      if (!r.view || !r.visible || r.buf.length < 2) continue;
      const p = r.view.pos, l = last.get(id);
      if (l) {
        const d = Math.hypot(p[0] - l[0], p[1] - l[1], p[2] - l[2]), want = r.view.speed * (t - prevT) / 1000;
        if (want > 0) { frames++; if (Math.abs(d - want) / want > 0.5) hitches++; }
      }
      last.set(id, [p[0], p[1], p[2]]);
    }
    prevT = t;
    if (t - t0 < ms) requestAnimationFrame(f);
    else resolve({ frames, hitchPct: frames ? (100 * hitches) / frames : null, fps: (fps * 1000) / (t - t0), remotes: R.size, delay: Math.round(window.__flight.remotes.delay) });
  }
  requestAnimationFrame(f);
});

const flightState = () => ({ status: document.getElementById('status').textContent, net: { ...window.__flight?.net?.state }, alt: window.__flight?.jet?.pos[1], pos: window.__flight?.jet?.pos.slice() });

// ---------- one run ----------
async function run(browser, site, cfg) {
  const result = { name: cfg.name, engine: cfg.engine, net: cfg.net, checks: {}, notes: [] };
  const check = (k, ok, detail) => { result.checks[k] = { ok: !!ok, detail }; };
  const desc = typeof cfg.device === 'string' ? devices[cfg.device] : cfg.device;
  if (!desc) throw new Error(`unknown device ${cfg.device}`);
  const ctxOpts = { ...desc };
  if (cfg.engine === 'firefox') delete ctxOpts.isMobile;
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

  const shaper = await createShaper({ upstream: UPSTREAM, profile: cfg.net });
  try {
    const t0 = Date.now();
    await page.goto(`${site.url}/lab/flight/?server=${encodeURIComponent(shaper.url)}`, { waitUntil: 'load' });
    // Poll on a timer, not on animation frames: a browser that never paints
    // (no WebGL, throttled headless) would otherwise hide why it stalled.
    try {
      await page.waitForFunction(() => window.__flight?.jet, null, { timeout: 20000, polling: 250 });
    } catch {
      const why = await page.evaluate(() => `status "${document.getElementById('status')?.textContent}", help "${document.getElementById('help')?.textContent.trim()}"`).catch(() => 'page unreachable');
      throw new Error(`game never started: ${why}; ${errors.slice(0, 3).join(' | ') || 'no console errors'}`);
    }
    result.loadMs = Date.now() - t0;
    try {
      await page.waitForFunction(() => document.getElementById('status').textContent === 'shared sky', null, { timeout: 20000, polling: 250 });
      result.onlineMs = Date.now() - t0;
      check('joins the shared sky', true, `${result.onlineMs} ms on ${cfg.net}`);
    } catch { check('joins the shared sky', false, (await page.evaluate(flightState)).status); }

    await page.waitForTimeout(1500);
    const px = await page.evaluate(probePixels);
    check('WebGL draws a scene', px.colors > 12 && px.std > 3, `${px.colors} colors, std ${px.std.toFixed(1)}`);
    check('canvas fills the viewport at device pixel ratio', Math.abs(px.cw - desc.viewport.width) <= 1 && Math.abs(px.ch - desc.viewport.height) <= 1 && px.w >= px.cw, `${px.cw}x${px.ch} css, ${px.w}x${px.h} px`);

    const hud = await page.evaluate(probeHud);
    check('HUD on screen, nothing overlapping', !hud.off.length && !hud.overlaps.length, [hud.off.length && `off-screen: ${hud.off}`, hud.overlaps.length && `overlap: ${hud.overlaps}`].filter(Boolean).join('; ') || 'ok');

    // Drag and hold: the stick axis the game reads must follow the finger.
    // (Measured on the input itself; altitude would be muddied by whatever the
    // jet was already doing.)
    const pitch = () => page.evaluate(() => window.__flight.input.axes.pitch);
    const cx = desc.viewport.width / 2, cy = desc.viewport.height / 2, reach = Math.min(desc.viewport.width, desc.viewport.height) * 0.2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy + reach, { steps: 5 });
    await page.waitForTimeout(300);
    const pDown = await pitch();
    await page.mouse.up();
    await page.waitForTimeout(200);
    const pRest = await pitch();
    check('drag to fly (pointer)', pDown > 0.5 && pRest === 0, `pitch ${pDown.toFixed(2)} while dragged down, ${pRest} after release`);

    // Real touch events (Chromium exposes them through CDP).
    if (cfg.engine === 'chromium' && desc.hasTouch) {
      const cdp = await context.newCDPSession(page);
      const tp = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: cx, y }] });
      await tp('touchStart', cy);
      for (let k = 1; k <= 5; k++) await tp('touchMove', cy - (k * reach) / 5);   // drag up: nose down
      await page.waitForTimeout(300);
      const pUp = await pitch();
      await tp('touchEnd');
      await page.waitForTimeout(200);
      const pEnd = await pitch();
      check('drag to fly (touch)', pUp < -0.5 && pEnd === 0, `pitch ${pUp.toFixed(2)} while dragged up, ${pEnd} after lift`);
    }

    // Trackpad scroll and pinch must not move or zoom the page.
    const gest = await page.evaluate(() => {
      const w = new WheelEvent('wheel', { deltaY: 400, cancelable: true, bubbles: true });
      const z = new WheelEvent('wheel', { deltaY: -200, ctrlKey: true, cancelable: true, bubbles: true });
      const g = new Event('gesturestart', { cancelable: true, bubbles: true });
      document.getElementById('view').dispatchEvent(w);
      document.getElementById('view').dispatchEvent(z);
      document.dispatchEvent(g);
      return { wheel: w.defaultPrevented, pinch: z.defaultPrevented, gesture: g.defaultPrevented };
    });
    // Real wheel input too, where Playwright can send it (not mobile WebKit).
    if (!(cfg.engine === 'webkit' && desc.isMobile)) { await page.mouse.move(cx, cy); await page.mouse.wheel(0, 600); }
    const after = await page.evaluate(probeHud);
    check('trackpad scroll and pinch are swallowed', gest.wheel && gest.pinch && gest.gesture && after.scrollY === 0 && after.scale === 1, JSON.stringify({ ...gest, scrollY: after.scrollY, scale: after.scale }));

    // Other jets: how smooth do they look on this link?
    const sm = await page.evaluate(probeSmooth, 6000);
    result.fps = Math.round(sm.fps);
    const maxHitch = { fiber: 3, wifi: 3, '4g': 5, farAway: 5, '3g': 8, edge: 15, hotel: 35 }[cfg.net] ?? 10;
    check('other jets move smoothly', sm.frames > 50 && sm.hitchPct <= maxHitch, sm.frames ? `${sm.hitchPct.toFixed(1)}% hitch frames (max ${maxHitch}), ${sm.remotes} jets, ${sm.delay} ms delay, ${result.fps} fps` : `no frames (${sm.remotes} jets)`);

    // Rotate (phones and tablets): canvas follows, still draws.
    if (desc.isMobile) {
      const { width, height } = desc.viewport;
      await page.setViewportSize({ width: height, height: width });
      await page.waitForTimeout(600);
      const r = await page.evaluate(probePixels);
      const h = await page.evaluate(probeHud);
      check('rotation', Math.abs(r.cw - height) <= 1 && r.colors > 12 && !h.off.length, `${r.cw}x${r.ch}, ${r.colors} colors${h.off.length ? `, off-screen: ${h.off}` : ''}${h.overlaps.length ? `, overlap: ${h.overlaps}` : ''}`);
      await page.setViewportSize({ width, height });
    }

    // GPU reset (iOS does this to background tabs): the scene must come back.
    const lost = await page.evaluate(async () => {
      const gl = document.getElementById('view').getContext('webgl2') || document.getElementById('view').getContext('webgl');
      const ext = gl?.getExtension('WEBGL_lose_context');
      if (!ext) return 'no extension';
      ext.loseContext();
      await new Promise((r) => setTimeout(r, 300));
      ext.restoreContext();
      await new Promise((r) => setTimeout(r, 1500));
      return 'ok';
    });
    if (lost === 'ok') {
      const r = await page.evaluate(probePixels);
      check('recovers from a lost GPU context', r.colors > 12 && r.std > 3, `${r.colors} colors after restore`);
    } else result.notes.push(`context loss: ${lost}`);

    // Dead link: hold every byte for 9 s (a phone moving from wifi to cell).
    const before = await page.evaluate(flightState);
    shaper.blackhole(9000);
    const seen = new Set();
    const tDead = Date.now();
    while (Date.now() - tDead < 22000) {
      const s = await page.evaluate(flightState);
      seen.add(s.status);
      if (Date.now() - tDead > 10000 && s.status === 'shared sky') break;
      await page.waitForTimeout(250);
    }
    const end = await page.evaluate(flightState);
    const moved = Math.hypot(end.pos[0] - before.pos[0], end.pos[2] - before.pos[2]);
    check('notices a dead link and comes back', seen.has('reconnecting') && end.status === 'shared sky', `statuses: ${[...seen].join(' > ')}; back in ${((Date.now() - tDead) / 1000).toFixed(1)} s`);
    check('keeps flying through a reconnect (no teleport)', moved < 1000 * ((Date.now() - tDead) / 1000) + 5000, `${Math.round(moved / 1000)} km travelled`);

    await page.screenshot({ path: join(OUT, `${cfg.name}-${cfg.engine}.png`) });
    check('no errors in the console', !errors.length, errors.slice(0, 3).join(' | ') || 'clean');
  } catch (err) {
    check('run completed', false, String(err.message || err).split('\n')[0]);
    await page.screenshot({ path: join(OUT, `${cfg.name}-${cfg.engine}-error.png`) }).catch(() => {});
  } finally {
    await context.close();
    await shaper.close();
  }
  result.ok = Object.values(result.checks).every((c) => c.ok);
  return result;
}

// ---------- no WebGL at all ----------
async function runNoWebGL(site) {
  const browser = await pw.chromium.launch({ args: ['--disable-3d-apis', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.goto(`${site.url}/lab/flight/`);
  await page.waitForTimeout(2500);
  const status = await page.evaluate(() => document.getElementById('status').textContent);
  await browser.close();
  return { name: 'no-webgl', engine: 'chromium', net: '-', checks: { 'explains instead of a black screen': { ok: /cannot draw 3D/.test(status), detail: `status: "${status}"` } }, ok: /cannot draw 3D/.test(status) };
}

// ---------- main ----------
await mkdir(OUT, { recursive: true });
const siteDir = join(ROOT, '_site');
try { await stat(join(siteDir, 'lab/flight/index.html')); } catch { console.error('build first: FLIGHT_LAB=1 npx eleventy'); process.exit(2); }
try { await fetch(UPSTREAM.replace(/^ws/, 'http') + '/health'); } catch { console.error(`no room server at ${UPSTREAM} (cd flight/server && npx wrangler dev --port 8787)`); process.exit(2); }
const site = await serveSite(siteDir);

const only = arg('only'), netOverride = arg('net');
const engines = (arg('engines', 'chromium,webkit,firefox')).split(',');
const results = [];
const launched = {};
for (const cfg0 of MATRIX) {
  if (only && !cfg0.name.includes(only)) continue;
  const cfg = { ...cfg0, net: netOverride || cfg0.net };
  // WebKit not installed? Run the same device on Chromium so layout still gets checked.
  let engine = cfg.engine;
  if (!engines.includes(engine)) { if (cfg.engine === 'firefox') continue; engine = 'chromium'; }
  if (!(engine in launched)) {
    // Headless Firefox on Linux turns WebGL off unless told to use software GL.
    const opts = engine === 'firefox' ? { firefoxUserPrefs: { 'webgl.force-enabled': true, 'webgl.disabled': false, 'layers.acceleration.force-enabled': true } } : {};
    try { launched[engine] = await pw[engine].launch(opts); }
    catch (e) { launched[engine] = null; console.log(`${engine}: not installed (${String(e.message).split('\n')[0]})`); }
  }
  if (!launched[engine]) continue;
  process.stdout.write(`${cfg.name} on ${engine} via ${cfg.net} ... `);
  const r = await run(launched[engine], site, { ...cfg, engine });
  if (engine !== cfg0.engine) r.notes.push(`meant for ${cfg0.engine}, ran on ${engine}`);
  console.log(r.ok ? 'ok' : 'FAIL');
  for (const [k, c] of Object.entries(r.checks)) if (!c.ok) console.log(`   x ${k}: ${c.detail}`);
  results.push(r);
}
for (const b of Object.values(launched)) await b?.close();
if (!only) { const r = await runNoWebGL(site); results.push(r); console.log(`no-webgl ... ${r.ok ? 'ok' : 'FAIL'}`); }
site.close();

await writeFile(join(OUT, 'devices.json'), JSON.stringify(results, null, 2));
const md = ['| device | engine | network | load | online | fps | result |', '| --- | --- | --- | --- | --- | --- | --- |'];
for (const r of results) md.push(`| ${r.name} | ${r.engine} | ${r.net} | ${r.loadMs ?? '-'} ms | ${r.onlineMs ?? '-'} ms | ${r.fps ?? '-'} | ${r.ok ? 'pass' : 'FAIL: ' + Object.entries(r.checks).filter(([, c]) => !c.ok).map(([k, c]) => `${k} (${c.detail})`).join('; ')} |`);
await writeFile(join(OUT, 'devices.md'), md.join('\n') + '\n');
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed. Report: flight/test/out/devices.md`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
