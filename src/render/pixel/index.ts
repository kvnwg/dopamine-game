/**
 * Browser side of the pixel art: pixel buffers become canvases scaled up with nearest-neighbor
 * (crisp square pixels) and cached data URLs for the React UI.
 */
import type { PixelBuf } from './buf';

/**
 * Screen pixels per art pixel in the battle view. One size for everything in battle (Kevin's raccoon,
 * pack characters, backdrops, effects, text), so all pixels match: the 1080 x 960 view is 180 x 160
 * art pixels (sceneryTypes.ts: VIEW), and every pixel of it sits on one P x P grid (docs/PIXEL_ART.md).
 */
export const P = 6;

/** False after a canvas came back without a context (Safari refuses them past its canvas memory limit). */
let lastDrawn = true;

/**
 * A canvas of `b` with every art pixel drawn as a `scale` x `scale` square. Where the browser won't
 * give a canvas a context it comes back blank (rather than throwing into a render).
 */
export function toCanvas(b: PixelBuf, scale = P): HTMLCanvasElement {
  const small = document.createElement('canvas');
  small.width = Math.max(1, b.w);
  small.height = Math.max(1, b.h);
  const sctx = small.getContext('2d');
  lastDrawn = !!sctx;
  if (sctx && b.w > 0 && b.h > 0) sctx.putImageData(new ImageData(new Uint8ClampedArray(b.px), b.w, b.h), 0, 0);
  if (scale === 1) return small;
  const c = document.createElement('canvas');
  c.width = small.width * scale;
  c.height = small.height * scale;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, c.width, c.height);
  } else lastDrawn = false;
  // Its pixels go now, not at the next collection (Safari counts every live canvas against a limit).
  small.width = 0;
  small.height = 0;
  return c;
}

const urls = new Map<string, string>();

/** A cached PNG data URL of a buffer (UI icons are pre-scaled so the browser only ever scales down). */
export function pixelUrl(key: string, make: () => PixelBuf, scale = 8): string {
  let u = urls.get(key);
  if (!u) {
    const c = toCanvas(make(), scale);
    u = c.toDataURL('image/png');
    // (A blank one, the browser out of canvases, is tried again next time instead of kept.)
    if (lastDrawn) urls.set(key, u);
    c.width = 0;
    c.height = 0;
  }
  return u;
}
