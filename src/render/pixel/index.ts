/**
 * Browser side of the pixel art: pixel buffers become canvases scaled up with nearest-neighbor
 * (crisp square pixels) and cached data URLs for the React UI.
 */
import type { PixelBuf } from './buf';

/** Screen pixels per art pixel in the battle view (and the size of one pixel in the UI). */
export const P = 6;

/** A canvas of `b` with every art pixel drawn as a `scale` x `scale` square. */
export function toCanvas(b: PixelBuf, scale = P): HTMLCanvasElement {
  const small = document.createElement('canvas');
  small.width = Math.max(1, b.w);
  small.height = Math.max(1, b.h);
  if (b.w > 0 && b.h > 0) small.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(b.px), b.w, b.h), 0, 0);
  if (scale === 1) return small;
  const c = document.createElement('canvas');
  c.width = small.width * scale;
  c.height = small.height * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, c.width, c.height);
  return c;
}

const urls = new Map<string, string>();

/** A cached PNG data URL of a buffer (UI icons are pre-scaled so the browser only ever scales down). */
export function pixelUrl(key: string, make: () => PixelBuf, scale = 8): string {
  let u = urls.get(key);
  if (!u) {
    u = toCanvas(make(), scale).toDataURL('image/png');
    urls.set(key, u);
  }
  return u;
}
