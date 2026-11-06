import * as THREE from 'three';

// Contrails are drawn from each jet's own recent positions, so they cost no
// bandwidth. All trails share one line geometry, updated in place.
export function createContrails({ scene, gold, sky, max = 65, points = 150, every = 0.2 }) {
  const trails = new Map();     // id -> { buf: Float32Array, head, count, last, seen }
  const maxVerts = max * (points - 1) * 2;
  const pos = new Float32Array(maxVerts * 3);
  const col = new Float32Array(maxVerts * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 }));
  lines.frustumCulled = false;
  scene.add(lines);

  const tail = new THREE.Vector3(), at = new THREE.Vector3();
  const c = new THREE.Color();
  let now = 0, v = 0;

  return {
    begin(time) { now = time; v = 0; },
    feed(id, jet, q) {
      let t = trails.get(id);
      if (!t) {
        if (trails.size >= max) return;
        trails.set(id, (t = { buf: new Float32Array(points * 3), head: 0, count: 0, last: -1, seen: now }));
      }
      t.seen = now;
      tail.set(0, 0, 14).applyQuaternion(q).add(at.set(jet.pos[0], jet.pos[1], jet.pos[2]));
      if (now - t.last >= every) {
        t.buf[t.head * 3] = tail.x; t.buf[t.head * 3 + 1] = tail.y; t.buf[t.head * 3 + 2] = tail.z;
        t.head = (t.head + 1) % points;
        t.count = Math.min(points, t.count + 1);
        t.last = now;
      }
      // Newest point is the live tail, then back through history.
      let px = tail.x, py = tail.y, pz = tail.z;
      for (let i = 1; i <= t.count && v < maxVerts; i++) {
        const j = ((t.head - i + points) % points) * 3;
        const x = t.buf[j], y = t.buf[j + 1], z = t.buf[j + 2];
        const age0 = (i - 1) / points, age1 = i / points;
        const o = v * 3;
        pos[o] = px; pos[o + 1] = py; pos[o + 2] = pz; pos[o + 3] = x; pos[o + 4] = y; pos[o + 5] = z;
        c.copy(gold).lerp(sky, Math.min(1, age0 * 1.1)).toArray(col, v * 3);
        c.copy(gold).lerp(sky, Math.min(1, age1 * 1.1)).toArray(col, v * 3 + 3);
        v += 2;
        px = x; py = y; pz = z;
      }
    },
    end() {
      for (const [id, t] of trails) if (now - t.seen > 5) trails.delete(id);
      geo.setDrawRange(0, v);
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}
