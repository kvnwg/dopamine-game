/**
 * Renders a pixel-art module's sprites to a labeled PNG sheet, in Node (no browser needed).
 *
 *   npx tsx tools/pixelSheet.ts items /tmp/items.png
 *   npx tsx tools/pixelSheet.ts scenery /tmp/scenery.png --scale 4
 *
 * The module (src/render/pixel/<name>.ts) must export `sheet(): SheetEntry[]`. Small sprites are
 * drawn twice, on the dark UI navy and on the cream card color, so outlines can be checked on both.
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PixelBuf, SheetEntry } from '../src/render/pixel/buf';

const DARK: [number, number, number] = [38, 42, 64];
const LIGHT: [number, number, number] = [244, 239, 225];
const PAGE: [number, number, number] = [20, 22, 34];

// 3x5 label font.
const GLYPHS: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '0': '010101101101010', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100110101010', '7': '111001010010010', '8': '010101010101010',
  '9': '010101011001110', _: '000000000000111', '-': '000000111000000', ':': '000010000010000', '.': '000000000000010',
};

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

class Page {
  px: Uint8Array;
  constructor(readonly w: number, readonly h: number) {
    this.px = new Uint8Array(w * h * 4);
    this.rect(0, 0, w, h, PAGE);
  }
  set(x: number, y: number, c: readonly number[]) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
    this.px[i + 3] = 255;
  }
  rect(x: number, y: number, w: number, h: number, c: readonly number[]) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }
  sprite(b: PixelBuf, x: number, y: number, s: number) {
    for (let sy = 0; sy < b.h; sy++) {
      for (let sx = 0; sx < b.w; sx++) {
        const i = (sy * b.w + sx) * 4;
        if (b.px[i + 3] === 0) continue;
        this.rect(x + sx * s, y + sy * s, s, s, [b.px[i], b.px[i + 1], b.px[i + 2]]);
      }
    }
  }
  text(str: string, x: number, y: number, s: number, c: readonly number[]) {
    let cx = x;
    for (const ch of str.toUpperCase()) {
      const g = GLYPHS[ch];
      if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') this.rect(cx + (i % 3) * s, y + Math.floor(i / 3) * s, s, s, c);
      cx += 4 * s;
    }
  }
}

async function main() {
  const [name, out, ...rest] = process.argv.slice(2);
  if (!name || !out) {
    console.error('usage: npx tsx tools/pixelSheet.ts <module> <out.png> [--scale N] [--cols N]');
    process.exit(1);
  }
  const opt = (k: string) => {
    const i = rest.indexOf(k);
    return i >= 0 ? Number(rest[i + 1]) : undefined;
  };
  const mod = (await import(pathToFileURL(resolve('src/render/pixel', `${name}.ts`)).href)) as { sheet?: () => SheetEntry[] };
  if (!mod.sheet) throw new Error(`src/render/pixel/${name}.ts has no sheet() export`);
  const entries = mod.sheet();
  const maxW = Math.max(...entries.map((e) => e.buf.w));
  const maxH = Math.max(...entries.map((e) => e.buf.h));
  const big = Math.max(maxW, maxH);
  const scale = opt('--scale') ?? (big <= 20 ? 8 : big <= 40 ? 6 : big <= 70 ? 4 : Math.max(1, Math.floor(1800 / maxW)));
  const both = big <= 40;
  const cellW = maxW * scale * (both ? 2 : 1) + (both ? 12 : 0) + 16;
  const cellH = maxH * scale + 34;
  const cols = opt('--cols') ?? Math.max(1, Math.floor(1900 / cellW));
  const rows = Math.ceil(entries.length / cols);
  const page = new Page(cols * cellW + 16, rows * cellH + 16);
  entries.forEach((e, i) => {
    const x0 = 16 + (i % cols) * cellW;
    const y0 = 16 + Math.floor(i / cols) * cellH;
    const w = maxW * scale;
    const h = maxH * scale;
    const ox = Math.floor((maxW - e.buf.w) / 2) * scale;
    const oy = (maxH - e.buf.h) * scale;
    page.rect(x0, y0, w, h, DARK);
    page.sprite(e.buf, x0 + ox, y0 + oy, scale);
    if (both) {
      page.rect(x0 + w + 12, y0, w, h, LIGHT);
      page.sprite(e.buf, x0 + w + 12 + ox, y0 + oy, scale);
    }
    page.text(e.name.replace(/[^a-z0-9_:\-.]/gi, '_'), x0, y0 + h + 8, 2, [220, 222, 240]);
  });
  writeFileSync(out, encodePng(page.w, page.h, page.px));
  console.log(`${entries.length} sprites, scale ${scale}, ${page.w}x${page.h} -> ${out}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
