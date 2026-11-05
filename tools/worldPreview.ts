/**
 * Renders worlds' battle backdrops (sky, clouds, sun or moon, lit scenery, vignette) as the battle
 * shows them, to one PNG grid, in Node (no browser needed). For art direction of src/data/worlds.json
 * `look.atmo` and src/render/pixel/atmosphere.ts.
 *
 *   npx tsx tools/worldPreview.ts /tmp/worlds.png
 *   npx tsx tools/worldPreview.ts /tmp/w2.png --worlds 2,6,12 --scale 6 --walk 40
 *
 * --walk shifts the layers as if the raccoon had walked that many art pixels (parallax included).
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { DATA } from '../src/data';
import { composeWorld } from '../src/render/worldLook';

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng(w: number, h: number, rgba: Uint8Array): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array()),
  ]);
}

const args = process.argv.slice(2);
const out = args[0];
if (!out) throw new Error('usage: worldPreview.ts <out.png> [--worlds 1,2] [--scale 4] [--walk 0] [--cols 2]');
const opt = (name: string, dflt: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const worlds = opt('worlds', DATA.worlds.map((_, i) => i + 1).join(',')).split(',').map(Number);
const scale = Number(opt('scale', '4'));
const walk = Number(opt('walk', '0'));
const cols = Math.min(worlds.length, Number(opt('cols', '2')));

const views = worlds.map((w) => composeWorld(w, { walk }));
const vw = views[0].w;
const vh = views[0].h;
const gap = 2;
const rows = Math.ceil(views.length / cols);
const W = (cols * (vw + gap) - gap) * scale;
const H = (rows * (vh + gap) - gap) * scale;
const px = new Uint8Array(W * H * 4);
for (let i = 3; i < px.length; i += 4) px[i] = 255;
views.forEach((v, k) => {
  const ox = (k % cols) * (vw + gap) * scale;
  const oy = Math.floor(k / cols) * (vh + gap) * scale;
  for (let y = 0; y < vh * scale; y++) {
    for (let x = 0; x < vw * scale; x++) {
      const si = (Math.floor(y / scale) * vw + Math.floor(x / scale)) * 4;
      const di = ((oy + y) * W + ox + x) * 4;
      px[di] = v.px[si];
      px[di + 1] = v.px[si + 1];
      px[di + 2] = v.px[si + 2];
    }
  }
});
writeFileSync(out, encodePng(W, H, px));
console.log(`${views.length} worlds, ${vw}x${vh} at ${scale}x -> ${out}`);
