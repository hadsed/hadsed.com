// Assets: everything visual that comes from data. The renderer asks for a jet
// geometry or a world's terrain; how they are made (procedural today, glTF
// tomorrow) stays in here. Add a world by adding it to assets/manifest.json.
import * as THREE from 'three';
import { decodeJet } from './jet-pack.js';

export async function loadManifest(base) {
  const res = await fetch(new URL('assets/manifest.json', base));
  const m = await res.json();
  m.base = base;
  if (m.jet.kind === 'packed') {
    try {
      m.jet.geometry = await packedJetGeometry(new URL(m.jet.src, base));
    } catch (err) {
      console.warn('packed jet failed, using procedural', err);
      m.jet = { kind: 'procedural', model: 'sr71', length: m.jet.length };
    }
  }
  return m;
}

// A licensed model packed by scripts/pack-jet.mjs: already merged, nose down -Z,
// scaled to length. Comes back as one BufferGeometry like the procedural jet.
async function packedJetGeometry(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  const j = await decodeJet(await res.arrayBuffer());
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(j.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(j.normal, 3));
  g.setIndex(new THREE.BufferAttribute(j.index, 1));
  g.computeBoundingSphere();
  g.userData.credit = j.credit;
  return g;
}

// ---- jet ----

// One merged BufferGeometry, so every ghost jet can share it in one
// InstancedMesh draw. Nose points down -Z, matching the sim.
export function jetGeometry(spec = { model: 'sr71' }) {
  if (spec.geometry) return spec.geometry;
  if (spec.kind && spec.kind !== 'procedural') throw new Error(`jet kind ${spec.kind} not supported yet`);
  const parts = [];
  const add = (g, fn = () => {}) => { const o = new THREE.Object3D(); fn(o); o.updateMatrix(); parts.push(g.applyMatrix4(o.matrix)); };

  add(new THREE.SphereGeometry(1, 24, 12), (o) => o.scale.set(1.25, 0.7, 10.5));
  add(new THREE.ConeGeometry(1.23, 7, 18), (o) => { o.rotation.x = -Math.PI / 2; o.position.z = -10; });
  const chine = new THREE.Shape();
  chine.moveTo(0, -14); chine.lineTo(1.9, -6); chine.lineTo(7.3, 7); chine.lineTo(3, 9); chine.lineTo(0, 9);
  chine.lineTo(-3, 9); chine.lineTo(-7.3, 7); chine.lineTo(-1.9, -6); chine.closePath();
  add(new THREE.ExtrudeGeometry(chine, { depth: 0.23, bevelEnabled: false }), (o) => { o.rotation.x = Math.PI / 2; o.position.y = 0.05; });
  add(new THREE.SphereGeometry(1, 14, 8), (o) => { o.scale.set(0.65, 0.65, 2.3); o.position.set(0, 0.65, -5); });
  for (const side of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.97, 1.05, 14, 16), (o) => { o.rotation.x = Math.PI / 2; o.position.set(side * 5, 0, 2.2); });
    add(new THREE.ConeGeometry(0.78, 3.6, 16), (o) => { o.rotation.x = -Math.PI / 2; o.position.set(side * 5, 0, -5.4); });
    const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(-1.2, 3); fs.lineTo(1.7, 3); fs.lineTo(3.1, 0); fs.closePath();
    add(new THREE.ExtrudeGeometry(fs, { depth: 0.18, bevelEnabled: false }), (o) => {
      o.rotation.y = -Math.PI / 2; o.rotation.z = side * -0.22; o.position.set(side * 5, 0.7, 4.7);
    });
  }
  const g = merge(parts);
  g.translate(0, 0, 2);
  g.computeBoundingSphere();
  return g;
}

function merge(geos) {
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of flat) if (!g.attributes.normal) g.computeVertexNormals();
  const count = flat.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of flat) {
    pos.set(g.attributes.position.array, o);
    nor.set(g.attributes.normal.array, o);
    o += g.attributes.position.array.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

// ---- terrain ----

// Terrarium-encoded PNG -> half-float height texture in meters, mirrored past
// the edges so the ground never ends.
export async function loadHeightmap(world, base) {
  const blob = await (await fetch(new URL(world.heightmap, base))).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const px = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  const half = new Uint16Array(bmp.width * bmp.height);
  for (let i = 0; i < half.length; i++) {
    half[i] = THREE.DataUtils.toHalfFloat(px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768);
  }
  const tex = new THREE.DataTexture(half, bmp.width, bmp.height, THREE.RedFormat, THREE.HalfFloatType);
  tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return { tex, width: world.metersPerPixel * world.size, maxM: world.maxM, exaggeration: world.exaggeration || 1 };
}
