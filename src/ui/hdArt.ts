/**
 * Pixel art for the Watch tab at the game's one pixel size (UNIT stage px per art pixel), plus a
 * Scale2x version of item icons: twice the art resolution with rounded diagonals and no new colors,
 * still drawn at UNIT px per pixel, so a big item keeps the same pixel size as everything else.
 */
import { blank, fromRows, type PixelBuf } from '../render/pixel/buf';
import { toCanvas } from '../render/pixel';
import { ITEM_SPRITES } from '../render/pixel/items';
import { UI_SPRITES, type UiIcon } from '../render/pixel/ui';

/** Stage px per art pixel, everywhere. */
export const UNIT = 9;

/** Scale2x (EPX): each pixel becomes 2 x 2, taking a neighbor's color along clean diagonals. */
export function scale2x(b: PixelBuf): PixelBuf {
  const out = blank(b.w * 2, b.h * 2);
  const at = (x: number, y: number) => {
    const cx = Math.min(b.w - 1, Math.max(0, x));
    const cy = Math.min(b.h - 1, Math.max(0, y));
    const i = (cy * b.w + cx) * 4;
    return ((b.px[i] << 24) | (b.px[i + 1] << 16) | (b.px[i + 2] << 8) | b.px[i + 3]) >>> 0;
  };
  const put = (x: number, y: number, v: number) => {
    const i = (y * out.w + x) * 4;
    out.px[i] = (v >>> 24) & 255;
    out.px[i + 1] = (v >>> 16) & 255;
    out.px[i + 2] = (v >>> 8) & 255;
    out.px[i + 3] = v & 255;
  };
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const p = at(x, y);
      const a = at(x, y - 1);
      const r = at(x + 1, y);
      const l = at(x - 1, y);
      const d = at(x, y + 1);
      put(2 * x, 2 * y, l === a && l !== d && a !== r ? a : p);
      put(2 * x + 1, 2 * y, a === r && a !== l && r !== d ? r : p);
      put(2 * x, 2 * y + 1, d === l && d !== r && l !== a ? l : p);
      put(2 * x + 1, 2 * y + 1, r === d && r !== a && d !== l ? d : p);
    }
  }
  return out;
}

const urls = new Map<string, string>();

function url(key: string, make: () => PixelBuf): string {
  let u = urls.get(key);
  if (!u) {
    u = toCanvas(make(), UNIT).toDataURL('image/png');
    urls.set(key, u);
  }
  return u;
}

/** An item's icon at UNIT px per pixel (16 x 16 art: 144 px), or its Scale2x version (288 px). */
export function itemArt(baseId: string, hd = false): string {
  const rows = ITEM_SPRITES[baseId];
  if (!rows) return '';
  return url(`item:${baseId}:${hd ? 2 : 1}`, () => (hd ? scale2x(fromRows(rows)) : fromRows(rows)));
}

/** A UI icon at UNIT px per pixel, optionally Scale2x'd. */
export function iconArt(name: UiIcon, hd = false): string {
  return url(`ui:${name}:${hd ? 2 : 1}`, () => (hd ? scale2x(fromRows(UI_SPRITES[name])) : fromRows(UI_SPRITES[name])));
}

/** Rendered size in stage px of a 16 x 16 icon. */
export const ICON_PX = 16 * UNIT;
