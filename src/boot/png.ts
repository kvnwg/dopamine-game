/**
 * PNG encoding for pixel buffers, in Node (the loading screen's art and the apps' splash images are
 * made by tools/bootArt.ts; nothing in the game itself imports this).
 */
import { deflateSync } from 'node:zlib';
import type { PixelBuf } from '../render/pixel/buf';

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

/** An RGBA PNG of the buffer (8 bits per channel, best compression). */
export function encodePng(b: PixelBuf): Buffer {
  const row = b.w * 4 + 1;
  const raw = Buffer.alloc(row * b.h);
  for (let y = 0; y < b.h; y++) {
    raw[y * row] = 0;
    Buffer.from(b.px.buffer, b.px.byteOffset + y * b.w * 4, b.w * 4).copy(raw, y * row + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(b.w, 0);
  ihdr.writeUInt32BE(b.h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array()),
  ]);
}

/** The buffer as a `data:image/png;base64,...` URL. */
export function pngDataUrl(b: PixelBuf): string {
  return `data:image/png;base64,${encodePng(b).toString('base64')}`;
}
