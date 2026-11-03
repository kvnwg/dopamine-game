/**
 * Renders every animation of every AnimSheet a module exports, one row per animation, so pack
 * sprites can be checked in Node (no browser needed).
 *
 *   npx tsx tools/animSheet.ts packs/fantasy /tmp/fantasy.png --scale 6
 *
 * The module path is relative to src/render/pixel. A dot marks each sheet's anchor.
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { frameBuf, type AnimSheet } from '../src/render/pixel/indexed';

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
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array()),
  ]);
}

async function main() {
  const [mod, out, ...rest] = process.argv.slice(2);
  if (!mod || !out) throw new Error('usage: tsx tools/animSheet.ts <module under src/render/pixel> <out.png> [--scale n]');
  const scale = rest[0] === '--scale' ? Number(rest[1]) : 6;
  const m = (await import(pathToFileURL(resolve('src/render/pixel', `${mod}.ts`)).href)) as Record<string, unknown>;
  const sheets = Object.entries(m).filter(([, v]) => !!v && typeof v === 'object' && 'frames' in (v as object) && 'anims' in (v as object)) as Array<
    [string, AnimSheet]
  >;
  const rows: Array<{ s: AnimSheet; frames: readonly number[] }> = [];
  for (const [, s] of sheets) for (const a of Object.values(s.anims)) rows.push({ s, frames: a.frames });
  const gap = 2;
  const W = Math.max(...rows.map((r) => r.frames.length * (r.s.w + gap))) + gap;
  const H = rows.reduce((h, r) => h + r.s.h + gap, gap);
  const px = new Uint8Array(W * scale * H * scale * 4);
  const put = (x: number, y: number, c: [number, number, number]) => {
    for (let yy = 0; yy < scale; yy++)
      for (let xx = 0; xx < scale; xx++) {
        const i = ((y * scale + yy) * W * scale + x * scale + xx) * 4;
        px[i] = c[0];
        px[i + 1] = c[1];
        px[i + 2] = c[2];
        px[i + 3] = 255;
      }
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, (x + y) % 2 ? [96, 104, 128] : [104, 112, 136]);
  let y0 = gap;
  for (const r of rows) {
    r.frames.forEach((f, k) => {
      const b = frameBuf(r.s, f);
      const x0 = gap + k * (r.s.w + gap);
      for (let y = 0; y < b.h; y++)
        for (let x = 0; x < b.w; x++) {
          const i = (y * b.w + x) * 4;
          if (b.px[i + 3]) put(x0 + x, y0 + y, [b.px[i], b.px[i + 1], b.px[i + 2]]);
        }
      put(x0 + r.s.anchor.x, y0 + r.s.anchor.y + 1, [255, 60, 200]);
    });
    y0 += r.s.h + gap;
  }
  writeFileSync(out, encodePng(W * scale, H * scale, px));
  console.log(`${sheets.map(([n]) => n).join(', ')} -> ${out}`);
}

void main();
