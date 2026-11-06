// Decoder for the packed jet format written by scripts/pack-jet.mjs.
//
// Layout: "HJT1" | u32 header length | header JSON | scrambled body.
// The body is deflate-raw(meshopt vertex stream + meshopt index stream), XORed
// with a keystream. The scramble is not cryptography; it keeps the licensed
// model from being a standalone, ready-to-use file (no GLB, no textures, no node
// tree, nothing a 3D tool opens), which is what the model's license asks for.
// No three.js here so the packer can share it under Node.
import { MeshoptDecoder } from '../../vendor/meshopt_decoder.js';

export const MAGIC = 'HJT1';
const KEY = 0x5bd1d5a3;

export function scramble(bytes, seed) {
  let x = (seed ^ KEY) >>> 0 || 1;
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 4) {
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    for (let k = 0; k < 4 && i + k < bytes.length; k++) out[i + k] = bytes[i + k] ^ ((x >>> (k * 8)) & 0xff);
  }
  return out;
}

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// -> { position: Float32Array, normal: Float32Array, index: Uint32Array, credit }
export async function decodeJet(buffer) {
  const bytes = new Uint8Array(buffer);
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== MAGIC) throw new Error('not a packed jet');
  const hlen = new DataView(buffer).getUint32(4, true);
  const h = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + hlen)));
  const body = await inflate(scramble(bytes.subarray(8 + hlen), h.seed));

  await MeshoptDecoder.ready;
  const vb = new Uint8Array(h.vertexCount * 12);
  MeshoptDecoder.decodeVertexBuffer(vb, h.vertexCount, 12, body.subarray(0, h.vertexBytes));
  const index = new Uint32Array(h.indexCount);
  MeshoptDecoder.decodeIndexBuffer(new Uint8Array(index.buffer), h.indexCount, 4, body.subarray(h.vertexBytes, h.vertexBytes + h.indexBytes));

  const dv = new DataView(vb.buffer);
  const position = new Float32Array(h.vertexCount * 3), normal = new Float32Array(h.vertexCount * 3);
  for (let i = 0; i < h.vertexCount; i++) {
    let nx = dv.getInt8(i * 12 + 8) / 127, ny = dv.getInt8(i * 12 + 9) / 127, nz = dv.getInt8(i * 12 + 10) / 127;
    const l = Math.hypot(nx, ny, nz) || 1;
    for (let k = 0; k < 3; k++) {
      const t = (dv.getInt16(i * 12 + k * 2, true) + 32768) / 65535;
      position[i * 3 + k] = h.min[k] + t * (h.max[k] - h.min[k]);
    }
    normal[i * 3] = nx / l; normal[i * 3 + 1] = ny / l; normal[i * 3 + 2] = nz / l;
  }
  return { position, normal, index, credit: h.credit };
}
