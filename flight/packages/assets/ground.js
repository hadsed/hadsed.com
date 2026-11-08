// Ground height under any point, matching the terrain the renderer draws.
//
// The terrain mesh puts a vertex on every heightmap texel center (world.frame snaps its
// core grid there) and splits each cell into two triangles along the same diagonal as
// terrainGeometry's index buffer, so heights here are interpolated the same way: a jet
// that skims a ridge sits on the ridge it sees, not a smoothed copy of it. Past the
// edges the heightmap mirrors, like the texture.
//
// const ground = createGround({ heights, size, metersPerPixel, exag });
// ground.height(x, z)        // meters, world frame (+Y up)
// ground.normal(x, z, out)   // unit vector, out = [x, y, z]
// ground.exag = 2.5;         // keep in step with the drawn terrain
export function createGround({ heights, size, metersPerPixel, exag = 1 }) {
  const n = size, m = metersPerPixel, half = n / 2 - 0.5;
  const at = (i, j) => {
    i = ((i % (2 * n)) + 2 * n) % (2 * n); j = ((j % (2 * n)) + 2 * n) % (2 * n);
    if (i >= n) i = 2 * n - 1 - i;
    if (j >= n) j = 2 * n - 1 - j;
    return heights[j * n + i];
  };
  // Raw (unexaggerated) height and slope per texel at (x, z).
  const out3 = [0, 0, 0];
  function cell(x, z) {
    const tx = x / m + half, tz = z / m + half;
    const i = Math.floor(tx), j = Math.floor(tz), fx = tx - i, fz = tz - j;
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1);
    if (fx + fz <= 1) {
      out3[0] = a + (b - a) * fx + (c - a) * fz; out3[1] = b - a; out3[2] = c - a;
    } else {
      const d = at(i + 1, j + 1);
      out3[0] = d + (c - d) * (1 - fx) + (b - d) * (1 - fz); out3[1] = d - c; out3[2] = d - b;
    }
    return out3;
  }
  const api = {
    exag,
    height(x, z) { return cell(x, z)[0] * api.exag; },
    normal(x, z, out = [0, 0, 0]) {
      const s = cell(x, z), gx = -s[1] * api.exag / m, gz = -s[2] * api.exag / m, l = Math.hypot(gx, 1, gz);
      out[0] = gx / l; out[1] = 1 / l; out[2] = gz / l;
      return out;
    },
  };
  return api;
}
