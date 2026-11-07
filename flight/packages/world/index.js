// The shared world look: sky, real terrain, cloud deck and the monotone pass.
// The SR-71 backdrop (notes/storyboards/sr71-backdrop.mjs) and the flight lab both draw with this, so
// the backdrop and the game are the same place in the same light.
//
//   const world = createWorld();
//   scene.add(world.sky, world.terrain, world.clouds);
//   world.setHeight(await loadTerrarium(url), region);    // or a float texture (encoded: false)
//   world.setLook({ ...WORLD_DEFAULTS, ... });              // any subset of the keys below
//   world.frame(camera, origin);                            // every frame, before drawing
//   const post = createPost(renderer); post.render((target) => { ...draw scenes... });
//
// Units are world meters. Render space = world space minus `origin` (the flight lab passes 0; the
// backdrop passes the jet's world position so the jet sits at the render origin and stays precise).
// The ground bends down with the Earth's curvature relative to the camera.
//
// Two ways to finish a frame:
// - post pass (createPost): scenes render linear color into a float target, alpha marks lines that may
//   turn gold, then one full-screen pass tones it (monotone ramp, mono mix, vignette, gamma, grain).
// - direct (mono 0 with skipWhenOff, or uDirect = 1): every world shader tones itself and writes
//   display color, so a renderer can draw straight to the screen with no extra pass.
// The sky is always toned to the palette, so it reads the same in the backdrop and in the game.
import * as THREE from 'three';

export const EARTH_R = 6371000;

// The backdrop look Had landed on (2026-11-05/06): Sierra, 85k ft, grid 250 m, contours 175 m.
// 2026-11-06: navy monotone stays dominant, natural ground color bleeds through it (chroma). Chroma 0 +
// color 0 is the original navy terrain grid; mono 0 is full natural color.
export const WORLD_DEFAULTS = {
  shadow: '#07090e', mid: '#1c2433', light: '#c8cdd5', highlight: '#e4c56f',
  midPoint: 0.56, hlStart: 0.62, hlAmount: 0.68, mono: 1, chroma: 0.7, exposure: 1.12, contrast: 1.13, grain: 0, vignette: 1.2,
  region: 'sierra', altitudeFt: 85000, exag: 1, offsetX: 79, offsetZ: -69.1, sunAz: 41, sunEl: 18, haze: 130, clouds: 0.54, fov: 23,
  grid: 0.66, gridSize: 250, contour: 0.46, contourStep: 175, shade: 0.39, lineBright: 0.73, lineGold: 0,
  tint: 0, tintContrast: 1, tintPivot: 0.5, slope: 0,
  color: 1, texture: 1,
  // Stars over the dark upper sky (2026-11-07: Had's pick, the quiet set). stars 0 turns them off.
  // 2026-11-07 Had's tuning; starFall/starGlow: fewer stars toward the horizon, a few bright ones still in the glow.
  stars: 1.17, starDensity: 0.22, starBright: 1.11, starSize: 0.6, starScale: 1.26, starSeed: 0, starFade: 12, starFall: 2.5, starGlow: 0.5,
  starColor: '#f2eee6', starVar: 0.3, starDark: 0.395,
};
// Sky candidates (lab): 0 the current sky, 1 banded (painted bands matched to photos from altitude, keyed
// to the sun's height), 3 physical single scattering. Both 1 and 3 also light and haze the ground to match.
Object.assign(WORLD_DEFAULTS, {
  skyMode: 0, skySoft: 0.12, skyTrue: 1,
  physExp: 0.4, physMie: 1, physOzone: 0.4, physSun: 20, physG: 0.76, physMulti: 1, physGlow: 2,
});
const SKY_NUM = ['skyMode', 'skySoft', 'skyTrue', 'physExp', 'physMie', 'physOzone', 'physSun', 'physG', 'physMulti', 'physGlow'];

// The banded sky's keyframes, by the sun's height above the visible horizon (degrees; from 85,000 ft the
// visible horizon is 5.2 degrees down). Colors are what photos from 60,000 to 100,000 ft show (sRGB), see
// notes/storyboards: Z overhead, L the deep blue strip low down, B the bright band on the horizon, H the
// haze over the far ground; the s versions are toward the sun, R the thin warm sliver right on the
// horizon under it. Heights (degrees): Lh of the blue strip, Bh of the band, Rh of the sliver.
export const SKY_BANDS = [
  [-16, { Z: '#000000', L: '#011228', B: '#183a58', H: '#020509', Zs: '#000000', Ls: '#011228', Bs: '#183a58', R: '#000000', Hs: '#020509', sun: '#000000', glow: 0, Lh: 3, Bh: 0.6, Rh: 0.2, W: 2 }],
  [-8, { Z: '#000000', L: '#011634', B: '#1c4262', H: '#03080e', Zs: '#000105', Ls: '#021c40', Bs: '#28537a', R: '#3a1206', Hs: '#060c14', sun: '#000000', glow: 0, Lh: 3.5, Bh: 0.6, Rh: 0.3, W: 2 }],
  [-2.5, { Z: '#000106', L: '#021a36', B: '#2f5f84', H: '#08121c', Zs: '#000a1c', Ls: '#02508e', Bs: '#a8c4cc', R: '#c2481a', Hs: '#1e2a36', sun: '#000000', glow: 0, Lh: 4, Bh: 0.7, Rh: 0.3, W: 2 }],
  [0.3, { Z: '#000814', L: '#06386a', B: '#5a90b8', H: '#0e2236', Zs: '#003858', Ls: '#12a0e0', Bs: '#f4f0d8', R: '#ff7a2a', Hs: '#1c3a58', sun: '#ffc87a', glow: 0.8, Lh: 7, Bh: 0.9, Rh: 0.25, W: 2 }],
  [4, { Z: '#000205', L: '#0a4a8c', B: '#a0c8e0', H: '#7896ae', Zs: '#000a18', Ls: '#0a64a8', Bs: '#e8eee4', R: '#6a3a1c', Hs: '#a2b0b8', sun: '#fff0d8', glow: 0.15, Lh: 5, Bh: 0.8, Rh: 0.2, W: 2.5 }],
  [12, { Z: '#000002', L: '#0b4f9a', B: '#b8d8ec', H: '#a0bfd4', Zs: '#000002', Ls: '#0b4f9a', Bs: '#b8d8ec', R: '#000000', Hs: '#a0bfd4', sun: '#ffffff', glow: 0, Lh: 5, Bh: 0.9, Rh: 0.2, W: 3 }],
];
const BAND_COLS = ['Z', 'L', 'B', 'H', 'Zs', 'Ls', 'Bs', 'R', 'Hs', 'sun'];
const BAND_NUMS = ['glow', 'Lh', 'Bh', 'Rh', 'W'];
const STAR_KEYS = ['stars', 'starDensity', 'starBright', 'starSize', 'starScale', 'starSeed', 'starFade', 'starFall', 'starGlow', 'starVar', 'starDark'];

const col = (hex) => { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };  // linear

export const NOISE = /* glsl */`
float whash(vec2 p){ p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(whash(i), whash(i + vec2(1, 0)), u.x), mix(whash(i + vec2(0, 1)), whash(i + vec2(1, 1)), u.x), u.y);
}
const mat2 ROT = mat2(0.8, -0.6, 0.6, 0.8);
float fbm(vec2 p, int oct){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 8; i++){ if (i >= oct) break; s += a * vnoise(p); p = ROT * p * 2.03 + 17.1; a *= 0.5; }
  return s;
}`;

// The palette ramp, shared by the post pass and by the shaders when they finish themselves (direct).
const TONE = /* glsl */`
uniform vec3 uShadow, uMid, uLight, uHigh;
uniform float uMidPoint, uHlStart, uHlAmount, uMono, uExposure, uContrast, uDirect, uChroma;
// natural color, on the same brightness curve the ramp uses (so mono 0 and 1 match in brightness)
vec3 natural(vec3 c){ return pow(clamp(c / (1.0 + c) * 1.55, 0.0, 1.0), vec3(0.85 * 2.2)); }
vec3 naturalInv(vec3 y){ vec3 t = pow(clamp(y, 0.0, 0.999), vec3(1.0 / (0.85 * 2.2))) / 1.55; return t / (1.0 - t); }
vec3 ramp(vec3 c, float gold){
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  l = l / (1.0 + l);                       // soft rolloff on the sun and horizon limb
  l = pow(clamp(l * 1.55, 0.0, 1.0), 0.85);
  l = clamp((l - 0.5) * uContrast + 0.5, 0.0, 1.0);
  vec3 r = l < uMidPoint ? mix(uShadow, uMid, l / uMidPoint) : mix(uMid, uLight, (l - uMidPoint) / (1.0 - uMidPoint));
  float hl = smoothstep(uHlStart, min(uHlStart + 0.18, 1.0), l) * uHlAmount;   // gold on the brightest values
  return mix(r, uHigh, max(hl, clamp(gold, 0.0, 1.0)));
}
// The navy ramp sets brightness; chroma adds the scene's own hue on top (its color minus its grey),
// so forests read green and snow white while the monotone stays dominant.
vec3 display(vec3 c, float gold){
  c *= uExposure;
  vec3 nat = natural(c);
  if (uMono <= 0.0) return nat;            // uniform branch: the game's natural color skips the ramp
  vec3 m = mix(nat, ramp(c, gold), uMono);
  vec3 hue = nat - vec3(dot(nat, vec3(0.2126, 0.7152, 0.0722)));
  return max(m + hue * uChroma * uMono, 0.0);
}
// surfaces: linear color + gold mask for the post pass, or finished display color when direct
vec4 finish(vec3 c, float gold){ return uDirect > 0.5 ? vec4(pow(display(c, gold), vec3(1.0 / 2.2)), 1.0) : vec4(c, gold); }
// the sky: always on the palette. For the post pass it writes a color the pass maps back to the
// toned sky at any mono amount (exact at 0 and 1).
vec4 finishSky(vec3 c){
  vec3 toned = ramp(c * uExposure, 0.0);
  if (uDirect > 0.5) return vec4(pow(toned, vec3(1.0 / 2.2)), 1.0);
  vec3 grey = vec3(dot(c, vec3(0.2126, 0.7152, 0.0722)));
  return vec4(mix(naturalInv(toned) / uExposure, grey, uMono), 0.0);
}`;

// Stars, worked out per pixel from the view direction d (el: radians above the visible horizon; base:
// the sky color behind). Each star is a point on a few hashed 3D grids, drawn as a soft dot about a pixel
// and a half across whatever the lens, so stars stay crisp at any field of view and don't shimmer as the
// camera drifts. They live in the dark: they fade out toward the bright band at the horizon.
export const STARS = /* glsl */`
uniform float uStars, uStarDensity, uStarBright, uStarSize, uStarScale, uStarSeed, uStarFade, uStarFall, uStarGlow, uStarVar, uStarDark;
uniform vec3 uStarColor;
vec3 shash3(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
// w: how many of the usual stars survive here (0 to 1), thinning toward the horizon. The brightest
// few (by uStarGlow) survive regardless, so some still shine through the horizon glow.
float starLayer(vec3 d, float n, float keep, float pix, float w, out vec3 tint){
  n *= uStarScale; keep *= uStarDensity;
  vec3 g = d * n, id = floor(g), r = shash3(id + uStarSeed * 13.7);
  tint = vec3(0.0);
  // a grid finer than a few pixels would read as noise: fade the layer out as its cells shrink on screen
  float fit = 1.0 - smoothstep(0.12, 0.3, pix * n);
  float bright = smoothstep(0.55, 0.85, r.y) * uStarGlow;
  float here = max(w, bright);
  if (r.x > keep * here || fit <= 0.0) return 0.0;
  vec3 s = normalize(id + 0.2 + 0.6 * shash3(id + 17.0 + uStarSeed * 13.7));
  float a = length(d - s);                              // radians, near enough at these sizes
  float sig = pix * 0.75 * uStarSize;
  float b = pow(r.y, 5.0) * 1.6 + 0.08;                 // most faint, a few bright
  tint = uStarColor * mix(vec3(1.0), mix(vec3(0.70, 0.80, 1.0), vec3(1.0, 0.82, 0.62), r.z), uStarVar);
  return uStarBright * b * fit * max(sqrt(w), bright) * exp(-a * a / (2.0 * sig * sig));
}
vec3 starSky(vec3 d, float el, vec3 base){
  float pix = max(length(fwidth(d)), 2e-5);
  float dark = 1.0 - smoothstep(uStarDark * 0.12, uStarDark, dot(base, vec3(0.2126, 0.7152, 0.0722)));
  // the count thins as a power of the height above the horizon: higher starFall, steeper drop
  float fade = radians(max(uStarFade, 0.05));
  float w = pow(clamp(el / fade, 0.0, 1.0), max(uStarFall, 0.1)) * dark;
  if (el < -0.002 || (w <= 0.0 && uStarGlow <= 0.0)) return vec3(0.0);
  vec3 e = vec3(0.0), t; float s;
  s = starLayer(d, 70.0, 0.55, pix, w, t);  e += t * s * 3.2;
  s = starLayer(d, 160.0, 0.6, pix, w, t);  e += t * s * 1.6;
  s = starLayer(d, 330.0, 0.5, pix, w, t);  e += t * s * 0.8;
  return e * uStars;
}`;

// Physical sky for the sky-view table: single scattering through a real atmosphere (Rayleigh, Mie, ozone),
// ray marched from the camera's altitude (after Nishita 1993; ozone as in Hillaire 2020), plus a cheap
// multiple-scattering term so the sky past the terminator still glows at twilight.
const PHYS = /* glsl */`
uniform vec3 uSun; uniform float uDip, uAlt, uPhysMie, uPhysOzone, uPhysSun, uPhysG, uPhysMulti;
vec2 raySphere(vec3 o, vec3 d, float r){ float b = dot(o, d), c = dot(o, o) - r * r, h = b * b - c; if (h < 0.0) return vec2(-1.0); h = sqrt(h); return vec2(-b - h, -b + h); }
vec3 dens(float h){ return vec3(exp(-h / 8000.0), exp(-h / 1200.0), max(0.0, 1.0 - abs(h - 25000.0) / 15000.0)); }
vec3 skyPhysical(vec3 d){
  const float RE = 6360e3, RA = 6460e3;
  const vec3 BR = vec3(5.802e-6, 13.558e-6, 33.1e-6), BO = vec3(0.650e-6, 1.881e-6, 0.085e-6);
  float BM = 3.996e-6 * uPhysMie;
  vec3 o = vec3(0.0, RE + clamp(uAlt, 10.0, 90e3), 0.0);
  vec2 ta = raySphere(o, d, RA), tg = raySphere(o, d, RE);
  float tmax = ta.y; if (tg.x > 0.0) tmax = tg.x;
  if (tmax <= 0.0) return vec3(0.0);
  const int N = 40, M = 8;
  float dt = tmax / float(N), mu = dot(d, uSun);
  float pr = 3.0 / (16.0 * 3.14159) * (1.0 + mu * mu);
  float g = uPhysG, pm = 3.0 / (8.0 * 3.14159) * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  vec3 sumR = vec3(0.0), sumM = vec3(0.0), ms = vec3(0.0), od = vec3(0.0);
  for (int i = 0; i < N; i++) {
    vec3 p = o + d * (dt * (float(i) + 0.5));
    vec3 h3 = dens(length(p) - RE) * dt;
    od += h3;
    vec3 view = exp(-(BR * od.x + 1.1 * BM * od.y + BO * uPhysOzone * od.z));
    // multiple scattering, roughly: light already scattered around the sky, strongest where the sun is
    // just up or just down at this point, isotropic
    float sunUp = dot(normalize(p), uSun);
    // (a little stronger around the terminator, where photos at altitude show a blue twilight above the band)
    ms += view * (BR * h3.x + BM * h3.y) * smoothstep(-0.25, 0.25, sunUp) * (1.0 + 1.5 * (1.0 - smoothstep(0.0, 0.25, sunUp))) * vec3(0.9, 0.8, 1.0);
    if (raySphere(p, uSun, RE).x > 0.0) continue;   // in the earth's shadow
    float ls = raySphere(p, uSun, RA).y / float(M);
    vec3 odl = vec3(0.0);
    for (int j = 0; j < M; j++) odl += dens(length(p + uSun * (ls * (float(j) + 0.5))) - RE) * ls;
    vec3 att = view * exp(-(BR * odl.x + 1.1 * BM * odl.y + BO * uPhysOzone * odl.z));
    sumR += att * h3.x; sumM += att * h3.y;
  }
  return uPhysSun * (sumR * BR * pr + sumM * BM * pm + ms * uPhysMulti * 0.08);
}`;

// Three wavelengths of Rayleigh light shown as RGB come out violet; photos from altitude are cyan-blue.
// A fixed camera-like grade matches them: less red and a little more green where the light is blue,
// warm light (the sunset band, the sun) left alone.
const GRADE = /* glsl */`
vec3 physGrade(vec3 c){
  float k = clamp(2.0 * (c.b - c.r) / max(c.b, 1e-6), 0.0, 1.0);
  return c * mix(vec3(1.0), vec3(0.45, 1.3, 1.0), k);
}`;

// The sky's own color for a view direction (linear, before the tone): navy overhead, a thin bright band
// at the horizon, a glow around the sun.
const SKY = /* glsl */`
uniform vec3 uSun, uHaze; uniform float uDip, uSkyK;
${TONE}
vec3 skyBase(vec3 d){
  float el = asin(clamp(d.y, -1.0, 1.0)) + uDip;       // angle above the true horizon
  vec3 zenith = vec3(0.010, 0.020, 0.055);   // near-space dark blue
  // high up most of the air is below you: a thin bright band at the horizon, navy by ~20 degrees up.
  // Lower down (uSkyK smaller) the bright band widens.
  vec3 c = mix(uHaze, zenith, 1.0 - exp(-max(el, 0.0) * uSkyK));
  c += vec3(0.30) * exp(-abs(el) * 70.0);   // bright limb on the horizon
  c += vec3(0.35) * pow(max(dot(d, uSun), 0.0), 12.0); // glow around the sun
  return mix(c, uHaze * 0.9, smoothstep(0.0, -0.03, el));
}
#ifndef WORLD_LITE
// ---- candidate skies for the lab (uSkyMode 1 and 3), compared against the one above (0) ----
uniform float uSkyMode, uSkySoft, uSkyTrue;
uniform float uPhysExp;
// the tone ramp with its corner at the mid point rounded off (width uSkySoft): the navy end of both
vec3 rampSoft(vec3 c){
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  l = l / (1.0 + l);
  l = pow(clamp(l * 1.55, 0.0, 1.0), 0.85);
  l = clamp((l - 0.5) * uContrast + 0.5, 0.0, 1.0);
  vec3 lo = mix(uShadow, uMid, clamp(l / uMidPoint, 0.0, 1.0));
  vec3 hi = mix(uMid, uLight, clamp((l - uMidPoint) / (1.0 - uMidPoint), 0.0, 1.0));
  float k = smoothstep(uMidPoint - uSkySoft, uMidPoint + uSkySoft, l);
  vec3 r = mix(lo, hi, k);
  float hl = smoothstep(uHlStart - uSkySoft, min(uHlStart + 0.18 + uSkySoft, 1.0), l) * uHlAmount;
  return mix(r, uHigh, hl);
}
// 1. banded: overhead, a deep blue strip, a bright band on the horizon and haze below it, painted as
// smooth exponential bands (display colors, keyframed on the CPU by the sun's height). Toward the sun the
// bands take their own colors, with a thin warm sliver right on the horizon at sunset.
uniform vec3 uBZ, uBL, uBB, uBH, uBZs, uBLs, uBBs, uBR, uBHs, uBSun;
uniform float uBGlow, uBLh, uBBh, uBRh, uBW;
float sunSide(vec3 d){
  vec2 sh = normalize(uSun.xz + 1e-6);
  return pow(0.5 + 0.5 * dot(normalize(d.xz + 1e-6), sh), uBW);
}
vec3 skyBanded(vec3 d, float el){
  float e = max(el, 0.0), w = sunSide(d);
  float l = exp(-e / uBLh), b = exp(-e / uBBh);
  vec3 away = mix(mix(uBZ, uBL, l), uBB, b);
  vec3 toward = mix(mix(uBZs, uBLs, l), uBBs, b) + uBR * exp(-e / uBRh);
  vec3 c = mix(away, toward, w);
  // the glow around a low sun hugs the horizon: wider sideways than up
  vec3 q = normalize(vec3(d.x, d.y * 3.0, d.z)), s = normalize(vec3(uSun.x, uSun.y * 3.0, uSun.z));
  float mu = max(dot(q, s), 0.0);
  c += uBSun * uBGlow * (0.12 * pow(mu, 30.0) + 0.5 * pow(mu, 300.0));
  return mix(c, mix(uBH, uBHs, w), smoothstep(0.0, -0.004, el));   // below the horizon: haze over the ground
}
// 3. physical: looked up in the sky-view table (see PHYS), so per pixel it costs one texture read.
// The table spans azimuth from the sun (0 to 180 degrees, mirrored) and elevation, squeezed toward the
// visible horizon (at -uDip) where the colors change fastest (after Hillaire 2020).
uniform sampler2D uSkyLut;
vec3 skyPhysLut(vec3 d){
  float el = asin(clamp(d.y, -1.0, 1.0));
  vec2 sh = normalize(uSun.xz + 1e-6);
  float lon = acos(clamp(dot(normalize(d.xz + 1e-6), sh), -1.0, 1.0));
  float l = el >= -uDip ? sqrt((el + uDip) / (1.5708 + uDip)) : -sqrt((-uDip - el) / (1.5708 - uDip));
  return texture2D(uSkyLut, vec2(lon / 3.14159, 0.5 + 0.5 * l)).rgb;
}
// the chosen sky, toned for display (display-linear), and its linear color for the stars' darkness test
// Natural tone that keeps the hue: roll off brightness, not each channel, so a bright orange glow
// stays orange instead of clipping to a flat pale disc. Only the very core goes toward white.
vec3 naturalHue(vec3 c){
  float l = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-6);
  float t = clamp(l / (1.0 + l) * 1.55, 0.0, 1.0);
  vec3 col = c * (t / l);
  col /= max(max(max(col.r, col.g), col.b), 1.0);
  col = mix(col, vec3(1.0), smoothstep(0.8, 1.0, t) * 0.5);
  return pow(col, vec3(0.85 * 2.2));
}
vec3 physTone(vec3 c){ return mix(rampSoft(c), naturalHue(c), uSkyTrue); }
uniform vec3 uSunT, uSunG, uNightL, uNightB; uniform float uPhysGlow;
${GRADE}
vec3 sunTone(){ return physTone(uSunT * 30.0 * uPhysExp * uExposure); }   // the disk, colored by the air it crosses
vec3 skyToned(vec3 d, out vec3 base){
  float el = asin(clamp(d.y, -1.0, 1.0)) + uDip;
  if (uSkyMode < 2.5) {
    vec3 t = skyBanded(d, el); base = naturalInv(t) / uExposure;
    return mix(rampSoft(naturalInv(t)), t, uSkyTrue);
  }
  base = physGrade(skyPhysLut(d)) * uPhysExp;
  // the night limb (airglow and starlight in the long path along the horizon), which single scattering
  // of sunlight can't give: faded in once the sun is well down
  float e = max(el, 0.0);
  base += uNightL * exp(-e / 0.05) + uNightB * exp(-e / 0.011);
  // Glow around the sun: haze lit by the sun's reddened light. From 85,000 ft there is little haze in the
  // line of sight, so this is a deliberate touch, spread a little wider sideways than up and down.
  vec3 q = normalize(vec3(d.x, d.y * 2.5, d.z)), s = normalize(vec3(uSun.x, uSun.y * 2.5, uSun.z));
  float mu = max(dot(q, s), 0.0);
  base += uSunG * uPhysGlow * (0.25 * pow(mu, 12.0) + 0.8 * pow(mu, 120.0)) * uPhysExp;
  return physTone(base * uExposure);
}
#endif`;


// The haze color over the ground and clouds for a view direction: the current sky's constant, the banded
// sky's haze (away from and toward the sun), or the physical sky just under the visible horizon.
const FOG = /* glsl */`
uniform float uFogSky, uDip, uBW, uPhysExp; uniform vec3 uFogA, uFogS; uniform sampler2D uSkyLut;
${GRADE}
vec3 fogColor(vec3 d, vec3 sun, vec3 haze){
  if (uFogSky < 0.5) return haze;
  vec2 sh = normalize(sun.xz + 1e-6), dh = normalize(d.xz + 1e-6);
  if (uFogSky < 1.5) return mix(uFogA, uFogS, pow(0.5 + 0.5 * dot(dh, sh), uBW));
  #ifdef WORLD_LITE
  return haze;
  #else
  float lon = acos(clamp(dot(dh, sh), -1.0, 1.0));
  // the air between you and the ground, as the physical sky sees it looking that way (at least a third
  // of a degree under the visible horizon, where the table's below-horizon rows start)
  float el = min(asin(clamp(d.y, -1.0, 1.0)), -uDip - 0.006);
  float l = -sqrt((-uDip - el) / (1.5708 - uDip));
  return physGrade(texture2D(uSkyLut, vec2(lon / 3.14159, 0.5 + 0.5 * l)).rgb) * uPhysExp;
  #endif
}`;

const LINES = /* glsl */`
// anti-aliased lines that fade out before they get denser than a couple of pixels
float lines2(vec2 c){ vec2 fw = fwidth(c); vec2 g = abs(fract(c - 0.5) - 0.5) / max(fw, 1e-6);
  return (1.0 - min(min(g.x, g.y), 1.0)) * (1.0 - smoothstep(0.12, 0.45, max(fw.x, fw.y))); }
float lines1(float c){ float fw = fwidth(c); float g = abs(fract(c - 0.5) - 0.5) / max(fw, 1e-6);
  return (1.0 - min(g, 1.0)) * (1.0 - smoothstep(0.12, 0.45, fw)); }`;

// One grid, dense under the camera and stretching out toward the horizon, so a single draw covers
// 1,500 km. The middle (`flat` of each half) is a uniform grid of `cell` meters; past it the spacing
// grows smoothly (cubic) out to R. A moving camera shifts the core in whole cells (frame(shift)), so
// every core vertex lands exactly where a neighbor was and the ground under you never changes; with a
// filtered heightmap the cell is one texel and the sparser vertices past the core slide smoothly.
export function terrainGeometry(segments = 512, R = 750000, cell = 352, flat = 0.375) {
  const n = segments + (segments % 2 ? 0 : 1);   // odd: a vertex sits under the camera
  const h = (n - 1) / 2, K = Math.round(h * flat);
  const c = (R - cell * h) / Math.pow(h - K, 3);
  const at = (j) => { const a = Math.abs(j), x = a <= K ? cell * a : cell * a + c * Math.pow(a - K, 3); return Math.sign(j) * x; };
  const pos = new Float32Array(n * n * 3), idx = new Uint32Array((n - 1) * (n - 1) * 6), space = new Float32Array(n * n);
  const step = (j) => { const a = Math.abs(j); return at(a + 1) - at(a); };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = (j * n + i) * 3;
    pos[k] = at(i - h); pos[k + 2] = at(j - h);
    space[j * n + i] = Math.max(step(i - h), step(j - h));   // local vertex spacing (m), for the height filter
  }
  let t = 0;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const v = j * n + i;
    idx.set([v, v + n, v + 1, v + 1, v + n, v + n + 1], t); t += 6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSpace', new THREE.BufferAttribute(space, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 1.5);
  g.userData.cell = cell;
  return g;
}

// A terrarium heightmap (height = R*256 + G + B/256 - 32768) as a texture the terrain decodes on the
// GPU: exact bytes, no filtering, no CPU pass. Keep heightmaps as their own cacheable files.
const terrariumCache = new Map();
export function loadTerrarium(url) {
  const key = String(url);
  if (!terrariumCache.has(key)) {
    terrariumCache.set(key, (async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      const bmp = await createImageBitmap(await r.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none', imageOrientation: 'none' });
      const tex = new THREE.Texture(bmp);
      tex.colorSpace = THREE.NoColorSpace; tex.flipY = false;
      tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
      tex.userData.encoded = true;
      return tex;
    })());
  }
  return terrariumCache.get(key);
}

// A sphere with rings bunched toward the horizon (elevation ~ t^2), so per-vertex shading keeps
// the thin limb crisp.
function skyGeometry(r, cols = 96, rows = 96) {
  const pos = [], idx = [];
  for (let j = 0; j <= rows; j++) {
    const t = (j / rows) * 2 - 1, el = Math.sign(t) * t * t * Math.PI / 2;
    for (let i = 0; i <= cols; i++) {
      const az = (i / cols) * Math.PI * 2;
      pos.push(r * Math.cos(el) * Math.sin(az), r * Math.sin(el), r * Math.cos(el) * Math.cos(az));
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + cols + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

// Box-filtered mip levels for a half-float height texture (RedFormat), built once on the CPU, so the
// terrain can read heights smoothed to each vertex's spacing. Returns the last mip level.
function buildHeightMips(tex) {
  if (tex.userData.heightMips != null) return tex.userData.heightMips;
  const { fromHalfFloat, toHalfFloat } = THREE.DataUtils;
  let w = tex.image.width, h = tex.image.height, src = tex.image.data;
  let f = new Float32Array(w * h);
  for (let i = 0; i < f.length; i++) f[i] = fromHalfFloat(src[i]);
  const mips = [{ data: src, width: w, height: h }];
  while (w > 1 || h > 1) {
    const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1), g = new Float32Array(nw * nh), half = new Uint16Array(nw * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const x0 = Math.min(2 * x, w - 1), x1 = Math.min(2 * x + 1, w - 1), y0 = Math.min(2 * y, h - 1), y1 = Math.min(2 * y + 1, h - 1);
      const v = (f[y0 * w + x0] + f[y0 * w + x1] + f[y1 * w + x0] + f[y1 * w + x1]) * 0.25;
      g[y * nw + x] = v; half[y * nw + x] = toHalfFloat(v);
    }
    mips.push({ data: half, width: nw, height: nh });
    f = g; w = nw; h = nh;
  }
  tex.mipmaps = mips;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  tex.userData.heightMips = mips.length - 1;
  return mips.length - 1;
}

// lite: a CPU rasterizer (SwiftShader, llvmpipe) runs every branch of a shader whatever the uniforms say,
// so the stars and per-pixel relief are compiled out there.
export function createWorld({ segments = 512, cell = 352, flat = 0.375, lite = false } = {}) {
  const defines = lite ? { WORLD_LITE: '' } : {};
  const sunDir = new THREE.Vector3(0, 1, 0);
  const U = {
    uCam: { value: new THREE.Vector3() }, uEarthR: { value: EARTH_R }, uOrigin: { value: new THREE.Vector3() },
    uSun: { value: sunDir }, uHaze: { value: new THREE.Vector3(0.50, 0.56, 0.66) }, uHazeDist: { value: 130000 },
    uCover: { value: 0.5 }, uDip: { value: 0 }, uSkyK: { value: 9 },
    uShadow: { value: col(WORLD_DEFAULTS.shadow) }, uMid: { value: col(WORLD_DEFAULTS.mid) },
    uLight: { value: col(WORLD_DEFAULTS.light) }, uHigh: { value: col(WORLD_DEFAULTS.highlight) },
    uMidPoint: { value: 0.56 }, uHlStart: { value: 0.61 }, uHlAmount: { value: 0.85 },
    uMono: { value: 1 }, uExposure: { value: 1.12 }, uContrast: { value: 1.13 }, uDirect: { value: 0 }, uChroma: { value: 0.6 },
    ...Object.fromEntries(STAR_KEYS.map((k) => ['u' + k[0].toUpperCase() + k.slice(1), { value: +WORLD_DEFAULTS[k] }])),
    uStarColor: { value: col(WORLD_DEFAULTS.starColor) },
    uSkyLut: { value: null }, uAlt: { value: 0 }, uSunT: { value: new THREE.Vector3(1, 1, 1) }, uSunG: { value: new THREE.Vector3(1, 1, 1) },
    ...Object.fromEntries(SKY_NUM.map((k) => ['u' + k[0].toUpperCase() + k.slice(1), { value: +WORLD_DEFAULTS[k] }])),
    ...Object.fromEntries(BAND_COLS.map((k) => ['uB' + k[0].toUpperCase() + k.slice(1), { value: new THREE.Vector3() }])),
    ...Object.fromEntries(BAND_NUMS.map((k) => ['uB' + k[0].toUpperCase() + k.slice(1), { value: 1 }])),
    // light and haze for the ground and clouds: constants for the current sky, set from the sky in modes 1 and 3
    uKey: { value: new THREE.Vector3(1.0, 0.95, 0.86) }, uFill: { value: new THREE.Vector3(0.30, 0.36, 0.48) }, uCloudLit: { value: new THREE.Vector3(1, 1, 1) },
    uNightL: { value: new THREE.Vector3() }, uNightB: { value: new THREE.Vector3() },
    uFogSky: { value: 0 }, uFogA: { value: new THREE.Vector3() }, uFogS: { value: new THREE.Vector3() },
  };

  // ---- sky: thin bright air at the horizon, near-space navy overhead, a sun and the limb ----
  // A sphere whose rings crowd in at the horizon (where the limb is a fraction of a degree thick).
  // Drawn first, behind everything, with no depth test, depth write or log-depth.
  const sky = new THREE.Mesh(
    skyGeometry(1.5e6),
    new THREE.ShaderMaterial({ defines,
      side: THREE.DoubleSide, depthWrite: false, depthTest: false, uniforms: U,
      vertexShader: /* glsl */`
        varying vec3 vDir; varying vec4 vSky; varying vec3 vBase;
        ${SKY}
        void main(){
          vec3 d = normalize(position); vDir = d;
          #ifdef WORLD_LITE
          vBase = skyBase(d);
          vSky = finishSky(vBase);
          #endif
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vDir; varying vec4 vSky; varying vec3 vBase;
        ${NOISE}
        ${SKY}
        #ifndef WORLD_LITE
        ${STARS}
        #endif
        void main(){
          vec3 d = normalize(vDir);
          // Per pixel on a GPU: the gradient is steep at the horizon and the tone ramp bends it, so
          // shading per vertex and blending between rings showed as stripes. A CPU rasterizer keeps
          // the per-vertex sky.
          #ifdef WORLD_LITE
          vec3 base = vBase; vec4 skyOut = vSky;
          #else
          vec3 base; vec4 skyOut; bool toned = uSkyMode > 0.5;
          if (toned) skyOut = vec4(skyToned(d, base), -1.0);   // alpha -1: already toned, the post pass keeps it
          else { base = skyBase(d); skyOut = finishSky(base); }
          #endif
          float disk = pow(max(dot(d, uSun), 0.0), 2500.0);
          #ifndef WORLD_LITE
          disk *= smoothstep(-0.002, 0.002, asin(clamp(d.y, -1.0, 1.0)) + uDip);   // set behind the earth
          vec3 sunCol = uHigh;
          if (toned) {   // a real-sized disk (a little over the true 0.27° radius), so the glow around it reads
            sunCol = uSkyMode > 2.5 ? sunTone() : mix(rampSoft(naturalInv(min(uBSun, 0.999))), uBSun, uSkyTrue);
            disk = smoothstep(cos(0.0085), cos(0.0065), dot(d, uSun)) * smoothstep(-0.002, 0.002, asin(clamp(d.y, -1.0, 1.0)) + uDip);
          }
          #else
          vec3 sunCol = uHigh;
          #endif
          // Stars: light of their own, added on top of the toned sky.
          vec3 e = vec3(0.0);
          #ifndef WORLD_LITE
          if (uStars > 0.0) e = starSky(d, asin(clamp(d.y, -1.0, 1.0)) + uDip, base);
          #endif
          if (uDirect > 0.5) {
            vec3 sky = skyOut.rgb;
            #ifndef WORLD_LITE
            if (toned) sky = pow(max(sky, 0.0), vec3(1.0 / 2.2));
            if (uStars > 0.0) sky = pow(pow(sky, vec3(2.2)) + max(display(base + e, 0.0) - display(base, 0.0), 0.0), vec3(1.0 / 2.2));
            // an 8-bit screen can't hold a slow dark gradient: half a step of noise hides the bands
            sky += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
            #endif
            // the disk is far past white: in the post pass the tone turns it to highlight; direct, draw that
            gl_FragColor = vec4(mix(sky, pow(sunCol, vec3(1.0 / 2.2)), min(disk * 3.0, 1.0)), 1.0);
          } else {
            #ifndef WORLD_LITE
            if (toned) {
              vec3 t = skyOut.rgb;
              if (uStars > 0.0) t += max(display(base + e, 0.0) - display(base, 0.0), 0.0);
              gl_FragColor = vec4(mix(t, sunCol, min(disk * 3.0, 1.0)), -1.0);
              return;
            }
            #endif
            gl_FragColor = vec4(skyOut.rgb + e / uExposure + vec3(3.0) * disk, skyOut.a);
          }
        }`,
    }),
  );
  sky.renderOrder = -1; sky.frustumCulled = false;

  // The physical sky's table: 256 x 128, rendered only when the sun, altitude or atmosphere change, so the
  // ray march (40 x 8 steps) runs for 33k texels now and then instead of every pixel every frame.
  const lutRT = new THREE.WebGLRenderTarget(256, 128, { type: THREE.HalfFloatType, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter });
  U.uSkyLut.value = lutRT.texture;
  const lutScene = new THREE.Scene(), lutCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const lutQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, uniforms: U,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      ${PHYS}
      void main(){
        float lon = vUv.x * 3.14159, l = vUv.y * 2.0 - 1.0;
        float el = l >= 0.0 ? -uDip + l * l * (1.5708 + uDip) : -uDip - l * l * (1.5708 - uDip);
        vec2 sh = normalize(uSun.xz + 1e-6), side = vec2(-sh.y, sh.x);
        vec2 h = (cos(lon) * sh + sin(lon) * side) * cos(el);
        gl_FragColor = vec4(skyPhysical(normalize(vec3(h.x, sin(el), h.y))), 1.0);
      }`,
  }));
  lutQuad.frustumCulled = false; lutScene.add(lutQuad);
  let lutKey = '';
  // What the sun's light keeps after crossing the air to the camera: the same atmosphere as the shader,
  // marched once on the CPU. It reddens the disk as the sun gets low.
  function sunTransmittance(alt, out, s) {
    const RE = 6360e3, RA = 6460e3, N = 64, oy = RE + Math.min(Math.max(alt, 10), 90e3);
    const b = oy * s.y, cE = oy * oy - RE * RE, hE = b * b - cE;
    if (hE >= 0 && -b - Math.sqrt(hE) > 0) return out.set(0, 0, 0);   // behind the earth
    const len = -b + Math.sqrt(b * b - (oy * oy - RA * RA)), dt = len / N;
    let r = 0, m = 0, oz = 0;
    for (let i = 0; i < N; i++) {
      const t = dt * (i + 0.5), x = s.x * t, y = oy + s.y * t, z = s.z * t, h = Math.hypot(x, y, z) - RE;
      r += Math.exp(-h / 8000) * dt; m += Math.exp(-h / 1200) * dt; oz += Math.max(0, 1 - Math.abs(h - 25000) / 15000) * dt;
    }
    const BM = 3.996e-6 * U.uPhysMie.value * 1.1, O = U.uPhysOzone.value;
    return out.set(Math.exp(-(5.802e-6 * r + BM * m + 0.650e-6 * O * oz)), Math.exp(-(13.558e-6 * r + BM * m + 1.881e-6 * O * oz)), Math.exp(-(33.1e-6 * r + BM * m + 0.085e-6 * O * oz)));
  }
  function updateSkyLut(renderer, alt) {
    const k = [sunDir.x, sunDir.y, sunDir.z, Math.round(alt / 50), U.uPhysMie.value, U.uPhysOzone.value, U.uPhysSun.value, U.uPhysG.value, U.uPhysMulti.value].map((v) => +(+v).toFixed(4)).join();
    if (k === lutKey) return;
    lutKey = k;
    U.uAlt.value = alt;
    sunTransmittance(alt, U.uSunT.value, sunDir);
    // the glow keeps the color of the last light at the visible horizon and fades over a few degrees after
    const oy = 6360e3 + Math.min(Math.max(alt, 10), 90e3), dip = Math.acos(6360e3 / oy);
    const el = Math.asin(sunDir.y), past = Math.max(0, -dip + 0.004 - el);
    const g = new THREE.Vector3().copy(sunDir); g.y = 0; g.normalize().multiplyScalar(Math.cos(-dip + 0.004)); g.y = Math.sin(-dip + 0.004);
    sunTransmittance(alt, U.uSunG.value, past > 0 ? g : sunDir);
    // and only near the horizon: a high sun at altitude sits in a near-black sky (U-2 and balloon photos)
    const above = el + dip, high = Math.min(Math.max((above - 0.05) / 0.12, 0), 1);
    U.uSunG.value.multiplyScalar(Math.max(0, 1 - past / 0.06) * (1 - high * high * (3 - 2 * high)));
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(lutRT); renderer.render(lutScene, lutCam); renderer.setRenderTarget(prev);
  }

  // ---- terrain: real elevation, natural color, hillshade, snow, rock, grid and contours ----
  const TU = {
    uHeight: { value: null }, uSize: { value: 1024 }, uWidth: { value: 250000 }, uTexel: { value: 1 / 1024 }, uEncoded: { value: 1 },
    uShift: { value: new THREE.Vector2() }, uExag: { value: 1 }, uMaxH: { value: 4000 }, uSnowM: { value: 3500 }, uArid: { value: 0 },
    uGrid: { value: 1 }, uGridSize: { value: 250 }, uContour: { value: 0 }, uContourStep: { value: 175 },
    uShade: { value: 0.35 }, uLineBright: { value: 0.6 }, uLineGold: { value: 0 },
    uTint: { value: 0 }, uTintContrast: { value: 1 }, uTintPivot: { value: 0.5 }, uSlope: { value: 0 },
    uColor: { value: 1 }, uTexture: { value: 1 },
    uFiltered: { value: 0 }, uMaxLod: { value: 0 }, uPixelRelief: { value: 1 },
    uSlide: { value: new THREE.Vector2() }, uCell: { value: cell }, uLodBias: { value: 0.5 },
  };
  const terrain = new THREE.Mesh(
    terrainGeometry(segments, 750000, cell, flat),
    new THREE.ShaderMaterial({ defines,
      uniforms: { ...U, ...TU },
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        uniform vec3 uCam, uOrigin; uniform float uEarthR, uWidth, uTexel, uExag, uEncoded, uFiltered, uMaxLod, uCell, uLodBias; uniform vec2 uShift, uSlide;
        uniform sampler2D uHeight; uniform int uSize;
        attribute float aSpace;
        varying vec2 vXZ; varying float vDist, vH; varying vec3 vN, vView;
        // exact texels, mirrored past the edges, decoded, then interpolated
        float texH(ivec2 p){
          int n = uSize; p = ivec2(mod(vec2(p), float(2 * n)));
          if (p.x >= n) p.x = 2 * n - 1 - p.x;
          if (p.y >= n) p.y = 2 * n - 1 - p.y;
          vec4 t = texelFetch(uHeight, p, 0);
          if (uEncoded < 0.5) return t.r;
          vec3 c = floor(t.rgb * 255.0 + 0.5);
          return c.r * 256.0 + c.g + c.b / 256.0 - 32768.0;
        }
        // height and its slope (per texel) from one bilinear cell: four fetches per vertex
        vec3 hAt(vec2 uv){
          vec2 x = uv * float(uSize) - 0.5; vec2 i = floor(x), f = x - i; ivec2 b = ivec2(i);
          float a = texH(b), bx = texH(b + ivec2(1, 0)), bz = texH(b + ivec2(0, 1)), c = texH(b + ivec2(1, 1));
          return vec3(mix(mix(a, bx, f.x), mix(bz, c, f.x), f.y), mix(bx - a, c - bz, f.y), mix(bz - a, c - bx, f.x));
        }
        void main(){
          float h;
          #ifdef HEIGHT_FILTERED
            // Two kinds of vertex. The uniform core moves in whole heightmap texels (uShift), so each of
            // its vertices sits on a texel center and reads the exact height there: the ground near you
            // never changes shape. Past the core the grid also slides the leftover fraction (uSlide), so
            // it moves continuously, and each vertex reads the heightmap pre-filtered to its own spacing
            // (mip level): sparse vertices sliding over smoothed heights don't snap or swim.
            float m = uWidth * uTexel, sp = max(aSpace, m);
            float slide = smoothstep(uCell * 1.01, uCell * 2.5, aSpace);
            vec2 xz = position.xz + uShift + slide * uSlide;   // render space
            vec2 wxz = xz + uOrigin.xz;                         // world space
            vec2 uv = wxz / uWidth + 0.5;
            float lod = clamp(log2(sp / m) + uLodBias * slide, 0.0, uMaxLod);
            vec2 du = vec2(sp / uWidth, 0.0);
            h = textureLod(uHeight, uv, lod).r;
            float hx = textureLod(uHeight, uv + du.xy, lod).r - h;
            float hz = textureLod(uHeight, uv + du.yx, lod).r - h;
            vN = normalize(vec3(-hx * uExag, sp, -hz * uExag));
          #else
            vec2 xz = position.xz + uShift;
            vec2 wxz = xz + uOrigin.xz;
            vec2 uv = wxz / uWidth + 0.5;
            vec3 hg = hAt(uv);
            float m = uWidth * uTexel;
            h = hg.x;
            vN = normalize(vec3(-hg.y * uExag, m, -hg.z * uExag));
          #endif
          vec3 w = vec3(xz.x, h * uExag - uOrigin.y, xz.y);
          vec2 rel = xz - uCam.xz;
          w.y -= dot(rel, rel) / (2.0 * uEarthR);
          vXZ = wxz; vH = h; vDist = distance(w, uCam); vView = w - uCam;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uSun, uHaze; uniform float uHazeDist, uMaxH, uGrid, uGridSize, uContour, uContourStep, uShade, uLineBright, uLineGold;
        uniform float uTint, uTintContrast, uTintPivot, uSlope, uColor, uTexture, uSnowM, uArid;
        uniform vec3 uCam, uOrigin, uKey, uFill;
        varying vec2 vXZ; varying float vDist, vH; varying vec3 vN, vView;
        uniform sampler2D uHeight; uniform float uWidth, uTexel, uFiltered, uMaxLod, uExag, uPixelRelief;
        float H;   // height here: per vertex, or per pixel from the filtered heightmap
        ${NOISE}
        ${TONE}
        ${LINES}
        ${FOG}
        // What the ground is made of, lit by the sun: valley floor, forest, alpine, rock on steep faces,
        // snow above the snowline, water at sea level. Texture at two scales fades out with distance.
        vec3 ground(vec3 n, float lit){
          float steep = 1.0 - n.y;
          vec2 q = vXZ / 900.0;
          float fade = 1.0 - smoothstep(0.25, 0.9, max(fwidth(q.x), fwidth(q.y)));
          float fine = mix(0.5, fbm(q, 4), fade);
          float broad = fbm(vXZ / 12000.0 + 3.7, 4);
          float hs = H / max(uSnowM, 1.0);              // 1 at the snowline
          float jitter = (broad - 0.5) * 0.35 + (fine - 0.5) * 0.12;
          vec3 valley = mix(vec3(0.13, 0.12, 0.075), vec3(0.24, 0.18, 0.11), uArid);
          vec3 forest = mix(vec3(0.045, 0.075, 0.040), vec3(0.14, 0.12, 0.08), uArid);
          vec3 alpine = vec3(0.17, 0.16, 0.13);
          vec3 rock = mix(vec3(0.22, 0.21, 0.20), vec3(0.36, 0.18, 0.095), uArid);
          // canyon strata: bands of color with height
          rock *= mix(1.0, 0.85 + 0.3 * sin(H / 55.0 + broad * 6.0), uArid);
          vec3 c = mix(valley, forest, smoothstep(0.18, 0.4, hs + jitter) * (1.0 - uArid * 0.7));
          c = mix(c, alpine, smoothstep(0.78, 0.95, hs + jitter));
          c = mix(c, rock, smoothstep(0.32, 0.6, steep + (fine - 0.5) * 0.25));
          float snow = smoothstep(-0.03, 0.03, hs + jitter * 0.8 - 1.0) * (1.0 - smoothstep(0.35, 0.6, steep + (fine - 0.5) * 0.3));
          c = mix(c, vec3(0.34, 0.36, 0.40), snow);
          c = mix(c, vec3(0.012, 0.025, 0.045), smoothstep(3.0, 0.5, H));   // sea and lakes at sea level
          c *= mix(1.0, (0.72 + 0.56 * fine) * (0.82 + 0.36 * broad), uTexture);
          return c * (uFill * (0.35 + 0.35 * n.y) + uKey * 2.2 * lit);
        }
        void main(){
          #include <logdepthbuf_fragment>
          vec3 n = normalize(vN);
          H = vH;
          #if defined(HEIGHT_FILTERED) && !defined(WORLD_LITE)
          if (uPixelRelief > 0.5) {
            // Relief per pixel, anchored to the world: height and slope read from the heightmap at this
            // pixel's footprint, so ridges and snowlines stay sharp and still however coarse the mesh is.
            float m = uWidth * uTexel, fp = max(length(fwidth(vXZ)), m);
            float lod = clamp(log2(fp / m), 0.0, uMaxLod);
            vec2 uv = vXZ / uWidth + 0.5, du = vec2(fp / uWidth, 0.0);
            H = textureLod(uHeight, uv, lod).r;
            float hx = textureLod(uHeight, uv + du.xy, lod).r - H;   // forward differences: three reads a pixel
            float hz = textureLod(uHeight, uv + du.yx, lod).r - H;
            n = normalize(vec3(-hx * uExag, fp, -hz * uExag));
          }
          #endif
          float grid = max(lines2(vXZ / uGridSize) * 0.55, lines2(vXZ / (uGridSize * 5.0)));
          float contour = max(lines1(H / uContourStep) * 0.55, lines1(H / (uContourStep * 5.0)));
          float ink = clamp(grid * uGrid + contour * uContour, 0.0, 1.0);
          float lit = clamp(dot(n, uSun), 0.0, 1.0);
          float rise = clamp(H / uMaxH, 0.0, 1.0);
          // the drafted look: dark sheet, optional relief and height tint
          vec3 shaded = vec3(0.10, 0.11, 0.12) * (0.25 + 1.6 * lit) * (0.7 + 0.6 * rise);
          vec3 c = mix(vec3(0.028, 0.032, 0.04) * (0.8 + 0.5 * rise), shaded, uShade);
          float rampT = clamp(0.5 + (rise - uTintPivot) * uTintContrast, 0.0, 1.0);   // after kaolti/monolith-terrain (MIT)
          vec3 hyp = vec3(mix(0.03, 0.42, rampT)) * mix(1.0, 0.45 + 0.9 * lit, uShade);
          c = mix(c, hyp, uTint);
          // the real ground
          if (uColor > 0.0) c = mix(c, ground(n, lit), uColor);
          c *= 1.0 - uSlope * smoothstep(0.25, 0.8, 1.0 - n.y);   // steep faces darken, like hachures
          // lines are ink of a set brightness: low values give dark ink, high values glow
          c = mix(c, vec3(uLineBright) * (0.75 + 0.5 * rise), ink * (1.0 - 0.45 * uColor * (1.0 - uMono)));
          float fog = 1.0 - exp(-vDist / uHazeDist);
          vec3 hz = fogColor(normalize(vView), uSun, uHaze * mix(1.0, 0.8, uColor));
          vec3 haze = mix(hz, vec3(dot(hz, vec3(0.2126, 0.7152, 0.0722))), uMono);
          c = mix(c, haze, fog * fog * 0.9 + fog * 0.1);
          gl_FragColor = finish(c, ink * uLineGold * (1.0 - fog));   // gold mask: lines the tone may turn gold
        }`,
    }),
  );
  terrain.frustumCulled = false;
  terrain.visible = false;

  // ---- cloud deck: scattered cumulus at cloudM, parallax against the ground ----
  const clouds = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2e6, 1.2e6, 120, 120).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({ defines,
      transparent: true, depthWrite: false, uniforms: U,
      // alpha-neutral for the post pass: clouds dim the gold mask under them and never add to it
      blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        uniform vec3 uCam, uOrigin; uniform float uEarthR;
        varying vec2 vXZ; varying float vDist; varying vec3 vView;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          vec2 rel = w.xz - uCam.xz;
          w.y -= dot(rel, rel) / (2.0 * uEarthR);
          vXZ = w.xz + uOrigin.xz; vDist = distance(w.xyz, uCam); vView = w.xyz - uCam;
          gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uHaze, uSun, uCloudLit; uniform float uHazeDist, uCover; varying vec2 vXZ; varying float vDist; varying vec3 vView;
        ${NOISE}
        ${TONE}
        ${FOG}
        void main(){
          #include <logdepthbuf_fragment>
          vec2 q = vXZ / 4500.0;
          float field = fbm(q * 0.18 + 4.0, 4);
          float puff = fbm(q + vec2(fbm(q * 0.5, 3)) * 1.5, 6);
          float a = smoothstep(0.86 - uCover * 0.4, 1.0 - uCover * 0.35, puff + (field - 0.5) * 0.7);
          float fog = 1.0 - exp(-vDist / (uHazeDist * 1.1));
          vec3 top = vec3(0.80, 0.82, 0.85) * (0.7 + 0.4 * puff) * uCloudLit;
          vec3 hz = fogColor(normalize(vView), uSun, uHaze);
          vec3 haze = mix(hz, vec3(dot(hz, vec3(0.2126, 0.7152, 0.0722))), uMono);
          vec3 c = mix(top, haze, fog);
          gl_FragColor = vec4(finish(c, 0.0).rgb, a * 0.9 * (1.0 - fog * 0.6) * step(0.001, uCover));
        }`,
    }),
  );
  clouds.frustumCulled = false;
  let cloudM = 7000;

  // Light for the ground and clouds in sky modes 1 and 3: the sun's color after the air it crosses down to
  // the ground, gone once it sets for the ground (the ground sees the sun set before you do, from altitude),
  // and the sky's fill fading through twilight to nearly nothing on a moonless night. Mode 1 also sets its
  // bands from the keyframes.
  const tmpT = new THREE.Vector3(), tmpD = new THREE.Vector3(), cA = new THREE.Vector3(), cB = new THREE.Vector3();
  const KEY0 = new THREE.Vector3(1.0, 0.95, 0.86), FILL0 = new THREE.Vector3(0.30, 0.36, 0.48);
  const BANDS = SKY_BANDS.map(([a, k]) => [a, Object.fromEntries(Object.entries(k).map(([n, v]) => [n, typeof v === 'string' ? col(v) : v]))]);
  const ninv = (y) => { const t = Math.pow(Math.min(Math.max(y, 0), 0.999), 1 / (0.85 * 2.2)) / 1.55; return t / (1 - t); };
  let lightKey = '';
  function skyLight(mode, alt) {
    const dip = Math.acos(EARTH_R / (EARTH_R + alt));
    const k = [mode, sunDir.x, sunDir.y, sunDir.z, Math.round(alt / 100), U.uExposure.value, U.uPhysMie.value, U.uPhysOzone.value].map((v) => +(+v).toFixed(4)).join();
    if (k === lightKey) return;
    lightKey = k;
    U.uFogSky.value = mode === 1 ? 1 : mode === 3 ? 2 : 0;
    if (mode !== 1 && mode !== 3) {
      U.uKey.value.copy(KEY0); U.uFill.value.copy(FILL0); U.uCloudLit.value.set(1, 1, 1);
      return;
    }
    const el = Math.asin(sunDir.y), deg = THREE.MathUtils.radToDeg;
    // the key: sunlight at 2 km, reddened by the air on the way, cut as the sun sets for the ground
    tmpD.copy(sunDir); if (tmpD.y < 0.01) { tmpD.y = 0.01; tmpD.normalize(); }
    sunTransmittance(2000, tmpT, tmpD);
    tmpT.divideScalar(Math.max(tmpT.x, tmpT.y, tmpT.z, 1e-6));
    const up = THREE.MathUtils.smoothstep(deg(el), -0.6, 2.5);
    U.uKey.value.set(1.0, 0.95, 0.86).multiply(tmpT).multiplyScalar(up);
    const fill = 0.012 + 0.988 * THREE.MathUtils.smoothstep(deg(el), -9, 6);
    // twilight fill is the blue of the sky overhead
    U.uFill.value.copy(FILL0).lerp(cA.set(0.12, 0.24, 0.62), 1 - THREE.MathUtils.smoothstep(deg(el), -3, 8)).multiplyScalar(fill);
    U.uCloudLit.value.copy(U.uKey.value).multiplyScalar(0.8).addScaledVector(FILL0, fill * 0.6);
    const e = U.uExposure.value;
    const lin = (hex, out) => { const c = col(hex); return out.set(ninv(c.x), ninv(c.y), ninv(c.z)).divideScalar(e); };
    if (mode === 3) {
      // the eye (and a camera) adapt: through sunset the exposure opens up several stops, so the twilight
      // sky reads bright blue as in photos, not near black
      U.uPhysExp.value = +look.physExp * (1 + 1.5 * (1 - THREE.MathUtils.smoothstep(deg(el + dip), -2, 8)));
      const night = 1 - THREE.MathUtils.smoothstep(deg(el + dip), -10, -4);
      lin('#011228', U.uNightL.value).multiplyScalar(night);
      lin('#183a58', U.uNightB.value).multiplyScalar(night);
      return;
    }
    // keyframes by the sun's height above the visible horizon
    const a = deg(el + dip);
    let i = 0; while (i < BANDS.length - 2 && a > BANDS[i + 1][0]) i++;
    const [a0, k0] = BANDS[i], [a1, k1] = BANDS[i + 1];
    const t = THREE.MathUtils.smoothstep(a, a0, a1);
    for (const n of BAND_COLS) U['uB' + n[0].toUpperCase() + n.slice(1)].value.lerpVectors(k0[n], k1[n], t);
    for (const n of BAND_NUMS) {
      let v = k0[n] + (k1[n] - k0[n]) * t;
      if (n.endsWith('h')) v = THREE.MathUtils.degToRad(v);
      U['uB' + n[0].toUpperCase() + n.slice(1)].value = v;
    }
    // the ground's haze in scene light, from the band colors
    cA.copy(U.uBH.value); cB.copy(U.uBHs.value);
    U.uFogA.value.set(ninv(cA.x), ninv(cA.y), ninv(cA.z)).divideScalar(e);
    U.uFogS.value.set(ninv(cB.x), ninv(cB.y), ninv(cB.z)).divideScalar(e);
  }

  const look = { ...WORLD_DEFAULTS };
  const TERRAIN_KEYS = ['grid', 'gridSize', 'contour', 'contourStep', 'shade', 'lineBright', 'lineGold', 'tint', 'tintContrast', 'tintPivot', 'slope', 'color', 'texture'];
  const TONE_KEYS = ['midPoint', 'hlStart', 'hlAmount', 'mono', 'chroma', 'exposure', 'contrast'];
  const uName = (k) => 'u' + k[0].toUpperCase() + k.slice(1);

  return {
    uniforms: U, terrainUniforms: TU, sky, terrain, clouds, sunDir, look,
    /** Grid spacing under the camera (m). A filtered heightmap sets it to one texel. */
    get cellSize() { return TU.uCell.value; },
    /** Any subset of WORLD_DEFAULTS' look keys: palette, tone, sun, haze, clouds, ground style. */
    setLook(o) {
      Object.assign(look, o);
      lightKey = '';
      for (const k of ['shadow', 'mid', 'light']) U[uName(k)].value.copy(col(look[k]));
      U.uHigh.value.copy(col(look.highlight));
      for (const k of TONE_KEYS) U[uName(k)].value = +look[k];
      for (const k of TERRAIN_KEYS) TU[uName(k)].value = +look[k];
      TU.uExag.value = +look.exag;
      const az = THREE.MathUtils.degToRad(look.sunAz), el = THREE.MathUtils.degToRad(look.sunEl);
      sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
      for (const k of STAR_KEYS) U[uName(k)].value = +(look[k] ?? 0);
      if (look.starColor) U.uStarColor.value.copy(col(look.starColor));
      for (const k of SKY_NUM) if (look[k] != null) U[uName(k)].value = +look[k];
      U.uHazeDist.value = look.haze * 1000;
      U.uCover.value = +look.clouds;
      if (look.cloudM) cloudM = +look.cloudM;
    },
    /** tex: from loadTerrarium, or a float texture with .r = meters (encoded false). */
    setHeight(tex, { size, metersPerPixel, maxM, snowM, arid = 0, encoded = tex.userData?.encoded ?? true }) {
      TU.uHeight.value = tex;
      TU.uSize.value = size; TU.uTexel.value = 1 / size;
      TU.uWidth.value = metersPerPixel * size;
      TU.uMaxH.value = maxM;
      TU.uSnowM.value = snowM || maxM * 0.8;
      TU.uArid.value = arid;
      TU.uEncoded.value = encoded ? 1 : 0;
      const filtered = !encoded && tex.image?.data && tex.type === THREE.HalfFloatType && tex.format === THREE.RedFormat;
      if (filtered) TU.uMaxLod.value = buildHeightMips(tex);
      // A filtered heightmap: the core grid is one texel apart, so moving it whole texels lands each
      // vertex on a texel center.
      const want = filtered ? metersPerPixel : cell;
      if (Math.abs(want - TU.uCell.value) > 1e-6) {
        terrain.geometry.dispose();
        terrain.geometry = terrainGeometry(segments, 750000, want, flat);
        TU.uCell.value = want;
      }
      TU.uFiltered.value = filtered ? 1 : 0;
      // which height path the terrain compiles: a shader on a CPU rasterizer pays for every branch
      const m = terrain.material, had = 'HEIGHT_FILTERED' in m.defines;
      if (filtered !== had) {
        m.defines = { ...m.defines };
        if (filtered) m.defines.HEIGHT_FILTERED = ''; else delete m.defines.HEIGHT_FILTERED;
        m.needsUpdate = true;
      }
      terrain.visible = true;
    },
    /**
     * Call each frame with the camera that draws the world. origin: world position of render (0,0,0).
     * shift: optional render-space xz to center the terrain grid on (the camera's, as it moves). The
     * grid's core moves in whole cells so the ground under the camera stays put; with a filtered
     * heightmap the rest of the grid slides the remainder smoothly.
     */
    frame(camera, origin = null, shift = null, renderer = null) {
      if (origin) U.uOrigin.value.copy(origin); else U.uOrigin.value.set(0, 0, 0);
      U.uCam.value.copy(camera.position);
      sky.position.copy(camera.position);
      const S = TU.uShift.value, slide = TU.uSlide.value, c = TU.uCell.value;
      if (!shift) { S.set(0, 0); slide.set(0, 0); }
      else if (TU.uFiltered.value) {
        // texel centers sit at world (k + 1/2) * c; core vertices at multiples of c from S
        const o = U.uOrigin.value;
        const snap = (v, oo) => (Math.round((v + oo) / c - 0.5) + 0.5) * c - oo;
        S.set(snap(shift.x, o.x), snap(shift.y, o.z));
        slide.set(shift.x - S.x, shift.y - S.y);
      } else {
        S.set(Math.round(shift.x / c) * c, Math.round(shift.y / c) * c);
        slide.set(0, 0);
      }
      const alt = Math.max(camera.position.y + U.uOrigin.value.y, 1);
      U.uDip.value = Math.acos(EARTH_R / (EARTH_R + alt));
      U.uSkyK.value = 2.5 + 6.5 * Math.min(alt / 26000, 1);
      const mode = lite ? 0 : U.uSkyMode.value;
      if (renderer && mode === 3) updateSkyLut(renderer, alt);
      skyLight(mode, alt);
      clouds.position.y = cloudM - U.uOrigin.value.y;
      clouds.position.x = camera.position.x; clouds.position.z = camera.position.z;
      clouds.visible = alt > cloudM + 1000 && look.clouds > 0;
    },
  };
}

/**
 * The monotone pass. render(draw) calls draw(target) to draw the scenes (clearing included), into a
 * float target that it then tones to the screen. With skipWhenOff and mono 0 it skips the pass: the
 * world shaders finish themselves and draw() renders straight to the screen.
 */
export function createPost(renderer, world, { samples = 4, skipWhenOff = true } = {}) {
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
  const U = world.uniforms;
  const PU = { tColor: { value: rt.texture }, uGrain: { value: 0 }, uVignette: { value: 1.2 }, uRes: { value: new THREE.Vector2(1, 1) } };
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false, uniforms: { ...U, ...PU },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tColor; uniform float uGrain, uVignette; uniform vec2 uRes;
        varying vec2 vUv;
        ${TONE}
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          vec4 src = texture2D(tColor, vUv);
          vec3 m = src.a < -0.5 ? src.rgb : display(src.rgb, max(src.a, 0.0));   // alpha -1: a sky that toned itself
          vec2 v = vUv - 0.5; m *= 1.0 - uVignette * dot(v, v) * 1.6;
          m = pow(max(m, 0.0), vec3(1.0 / 2.2));
          m += (h(vUv * uRes) - 0.5) * (uGrain + 1.0 / 255.0);   // grain, and always half a step of dither so dark gradients don't band
          gl_FragColor = vec4(m, 1.0);
        }`,
    }),
  );
  quad.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    target: rt, uniforms: PU, scene, camera: cam,
    get direct() { return skipWhenOff && U.uMono.value <= 0; },
    setSize(w, h, pr) { rt.setSize(Math.floor(w * pr), Math.floor(h * pr)); PU.uRes.value.set(w * pr, h * pr); },
    setLook(o) { if ('grain' in o) PU.uGrain.value = +o.grain; if ('vignette' in o) PU.uVignette.value = +o.vignette; },
    render(draw) {
      if (this.direct) {
        U.uDirect.value = 1;
        renderer.setRenderTarget(null);
        draw(null);
        return;
      }
      U.uDirect.value = 0;
      renderer.setRenderTarget(rt);
      draw(rt);
      renderer.setRenderTarget(null);
      renderer.render(scene, cam);
    },
  };
}
