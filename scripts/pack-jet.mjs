// Pack a jet model (GLB) into the flight lab's own scrambled .bin format.
//
// Why: licensed models (e.g. Sketchfab Standard) may be used inside a project but
// must not be served as a standalone, extractable file. So the site never ships
// the GLB. This bakes it to one merged, quantized mesh (positions + normals, no
// textures, no node tree), compresses it with meshopt + deflate, scrambles the
// bytes, and writes it under a content-hashed name. The licensor credit rides
// along in the header (license asks us to keep the licensor's name with it).
// flight/packages/assets/jet-pack.js is the matching decoder.
//
//   node scripts/pack-jet.mjs model.glb --list
//   node scripts/pack-jet.mjs model.glb --drop "gear|wheel|chute" --nose -z \
//        --length 32 --triangles 30000 --credit "..." --out flight/assets
//
// --nose  which axis the nose points along in the source (+x -x +y -y +z -z);
//         the output always has the nose down -Z, up +Y, like the sim.
// --up    which axis is up in the source (default +y).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { createHash } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import { writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { scramble, MAGIC } from "../flight/packages/assets/jet-pack.js";

const args = process.argv.slice(2);
const src = args[0];
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : args[i + 1]; };
const flag = (k) => args.includes(`--${k}`);
if (!src) { console.error("usage: pack-jet.mjs model.glb [--list] [--drop re] [--nose -z] [--up +y] [--length 32] [--triangles n] [--credit s] [--out dir] [--name jet]"); process.exit(1); }

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];

if (flag("list")) {
  const walk = (n, d) => {
    const m = n.getMesh();
    const tris = m ? m.listPrimitives().reduce((s, p) => s + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute("POSITION").getCount()) / 3, 0) : 0;
    console.log(`${"  ".repeat(d)}${n.getName() || "(unnamed)"}${m ? `  [mesh ${m.getName() || ""}: ${tris} tris]` : ""}`);
    n.listChildren().forEach((c) => walk(c, d + 1));
  };
  scene.listChildren().forEach((n) => walk(n, 0));
  process.exit(0);
}

const drop = opt("drop") ? new RegExp(opt("drop"), "i") : null;
const dropped = [];
const pos = [], nor = [], idx = [];
let base = 0;

const mul = (a, b) => { // column-major 4x4
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s;
  }
  return o;
};

const visit = (node, parent) => {
  const name = node.getName() || "";
  const meshName = node.getMesh()?.getName() || "";
  if (drop && (drop.test(name) || drop.test(meshName))) { dropped.push(name || meshName); return; }
  const world = mul(parent, node.getMatrix());
  const mesh = node.getMesh();
  if (mesh) for (const prim of mesh.listPrimitives()) {
    if (prim.getMode() !== 4) continue; // triangles only
    const p = prim.getAttribute("POSITION"), n = prim.getAttribute("NORMAL");
    const count = p.getCount(), v = [0, 0, 0], w = [0, 0, 0];
    for (let i = 0; i < count; i++) {
      p.getElement(i, v);
      pos.push(world[0] * v[0] + world[4] * v[1] + world[8] * v[2] + world[12],
               world[1] * v[0] + world[5] * v[1] + world[9] * v[2] + world[13],
               world[2] * v[0] + world[6] * v[1] + world[10] * v[2] + world[14]);
      if (n) {
        n.getElement(i, w); // fine for rotation + uniform scale, which is what DCC exports use
        const x = world[0] * w[0] + world[4] * w[1] + world[8] * w[2];
        const y = world[1] * w[0] + world[5] * w[1] + world[9] * w[2];
        const z = world[2] * w[0] + world[6] * w[1] + world[10] * w[2];
        const l = Math.hypot(x, y, z) || 1; nor.push(x / l, y / l, z / l);
      } else nor.push(NaN, NaN, NaN);
    }
    const ind = prim.getIndices();
    if (ind) for (let i = 0; i < ind.getCount(); i++) idx.push(base + ind.getScalar(i));
    else for (let i = 0; i < count; i++) idx.push(base + i);
    base += count;
  }
  node.listChildren().forEach((c) => visit(c, world));
};
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
scene.listChildren().forEach((n) => visit(n, I));
if (!idx.length) throw new Error("no triangles left");

// ---- reorient: nose -> -Z, up -> +Y ----
const axis = (s) => { const v = [0, 0, 0]; v["xyz".indexOf(s[1])] = s[0] === "-" ? -1 : 1; return v; };
const nose = axis(opt("nose", "-z")), up = axis(opt("up", "+y"));
const right = [up[1] * -nose[2] - up[2] * -nose[1], up[2] * -nose[0] - up[0] * -nose[2], up[0] * -nose[1] - up[1] * -nose[0]]; // up x back
const dot = (a, i, b) => a[i] * b[0] + a[i + 1] * b[1] + a[i + 2] * b[2];
const reorient = (arr) => { for (let i = 0; i < arr.length; i += 3) { const x = dot(arr, i, right), y = dot(arr, i, up), z = -dot(arr, i, nose); arr[i] = x; arr[i + 1] = y; arr[i + 2] = z; } };
reorient(pos); reorient(nor);

// ---- center on the bounding box, scale to the requested length ----
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], pos[i + k]); hi[k] = Math.max(hi[k], pos[i + k]); }
const length = Number(opt("length", 32)), s = length / (hi[2] - lo[2]);
const mid = lo.map((l, k) => (l + hi[k]) / 2);
for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) pos[i + k] = (pos[i + k] - mid[k]) * s;

// ---- weld, simplify ----
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
let P = new Float32Array(pos), N = new Float32Array(nor), X = new Uint32Array(idx);
const target = Number(opt("triangles", 0));
if (target && X.length / 3 > target) {
  [X] = MeshoptSimplifier.simplify(X, P, 3, target * 3, 0.002, ["LockBorder"]);
}
// Drop unused vertices and fill any missing normals from faces.
const remap = new Int32Array(P.length / 3).fill(-1); let vc = 0;
for (const i of X) if (remap[i] < 0) remap[i] = vc++;
const P2 = new Float32Array(vc * 3), N2 = new Float32Array(vc * 3), X2 = new Uint32Array(X.length);
for (let i = 0; i < remap.length; i++) if (remap[i] >= 0) for (let k = 0; k < 3; k++) { P2[remap[i] * 3 + k] = P[i * 3 + k]; N2[remap[i] * 3 + k] = N[i * 3 + k]; }
for (let i = 0; i < X.length; i++) X2[i] = remap[X[i]];
if (N2.some(Number.isNaN)) {
  const acc = new Float32Array(N2.length);
  for (let t = 0; t < X2.length; t += 3) {
    const [a, b, c] = [X2[t] * 3, X2[t + 1] * 3, X2[t + 2] * 3];
    const e1 = [P2[b] - P2[a], P2[b + 1] - P2[a + 1], P2[b + 2] - P2[a + 2]], e2 = [P2[c] - P2[a], P2[c + 1] - P2[a + 1], P2[c + 2] - P2[a + 2]];
    const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) acc[v + k] += f[k];
  }
  for (let i = 0; i < N2.length; i += 3) if (Number.isNaN(N2[i])) { const l = Math.hypot(acc[i], acc[i + 1], acc[i + 2]) || 1; for (let k = 0; k < 3; k++) N2[i + k] = acc[i + k] / l; }
}

// ---- quantize: int16 position (bbox), int8 normal; 12-byte stride ----
const bmin = [Infinity, Infinity, Infinity], bmax = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < P2.length; i += 3) for (let k = 0; k < 3; k++) { bmin[k] = Math.min(bmin[k], P2[i + k]); bmax[k] = Math.max(bmax[k], P2[i + k]); }
const vb = new DataView(new ArrayBuffer(vc * 12));
for (let i = 0; i < vc; i++) {
  for (let k = 0; k < 3; k++) {
    const t = (P2[i * 3 + k] - bmin[k]) / ((bmax[k] - bmin[k]) || 1);
    vb.setInt16(i * 12 + k * 2, Math.round(t * 65535 - 32768), true);
    vb.setInt8(i * 12 + 8 + k, Math.round(Math.max(-1, Math.min(1, N2[i * 3 + k])) * 127));
  }
}
const vEnc = MeshoptEncoder.encodeVertexBuffer(new Uint8Array(vb.buffer), vc, 12);
const iEnc = MeshoptEncoder.encodeIndexBuffer(new Uint8Array(X2.buffer), X2.length, 4);

const header = {
  credit: opt("credit", ""),
  vertexCount: vc, indexCount: X2.length, vertexBytes: vEnc.length, indexBytes: iEnc.length,
  min: bmin, max: bmax,
};
const body = deflateRawSync(Buffer.concat([Buffer.from(vEnc), Buffer.from(iEnc)]), { level: 9 });
const seed = createHash("sha256").update(body).digest().readUInt32LE(0) || 1;
header.seed = seed;
const hjson = Buffer.from(JSON.stringify(header));
const out = Buffer.concat([Buffer.from(MAGIC), u32(hjson.length), hjson, Buffer.from(scramble(new Uint8Array(body), seed))]);
const hash = createHash("sha256").update(out).digest("hex").slice(0, 10);
const dir = opt("out", "."), name = opt("name", "jet");
for (const f of readdirSync(dir)) if (new RegExp(`^${name}\\.[0-9a-f]{10}\\.bin$`).test(f)) unlinkSync(join(dir, f));
const file = `${name}.${hash}.bin`;
writeFileSync(join(dir, file), out);
console.log(JSON.stringify({ file, bytes: out.length, triangles: X2.length / 3, vertices: vc, dropped, size: bmax.map((x, k) => +(x - bmin[k]).toFixed(2)) }, null, 1));

function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; }
