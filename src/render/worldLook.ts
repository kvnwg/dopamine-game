/**
 * Per-world look for the pixel scenery: a sky in flat color bands (stars and a pixel moon at
 * night) plus a hue / saturation / brightness grade applied to the shared scenery layers (dark
 * outline pixels are left alone so line work stays crisp). Used by the battle scene (full-size
 * layers) and the Worlds tab (small preview cards).
 */
import { DATA, type WorldDef } from '../data';
import { blank, blit, clone, fill, fromRows, hash01, mix, rgb, toHex, type PixelBuf } from './pixel/buf';
import { P, toCanvas } from './pixel';
import { LAYERS, fgLayer, farLayer, groundLayer, midLayer } from './pixel/scenery';

export type Look = WorldDef['look'];

export interface BaseLayers {
  far: PixelBuf;
  mid: PixelBuf;
  ground: PixelBuf;
  fg: PixelBuf;
}

let base: BaseLayers | null = null;

/** The ungraded scenery tiles, built once. */
export function baseLayers(): BaseLayers {
  if (!base) base = { far: farLayer(), mid: midLayer(), ground: groundLayer(), fg: fgLayer() };
  return base;
}

/** 3x3 color matrix = brightness x saturation x hue rotation (same math as CSS filters). */
export function colorMatrix(look: Pick<Look, 'hue' | 'sat' | 'bright'>): number[] {
  const a = Math.cos((look.hue * Math.PI) / 180);
  const b = Math.sin((look.hue * Math.PI) / 180);
  const hue = [
    0.213 + a * 0.787 - b * 0.213, 0.715 - a * 0.715 - b * 0.715, 0.072 - a * 0.072 + b * 0.928,
    0.213 - a * 0.213 + b * 0.143, 0.715 + a * 0.285 + b * 0.14, 0.072 - a * 0.072 - b * 0.283,
    0.213 - a * 0.213 - b * 0.787, 0.715 - a * 0.715 + b * 0.715, 0.072 + a * 0.928 + b * 0.072,
  ];
  const s = look.sat;
  const sat = [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ];
  const out = new Array<number>(9).fill(0);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      let v = 0;
      for (let k = 0; k < 3; k++) v += sat[r * 3 + k] * hue[k * 3 + c];
      out[r * 3 + c] = v * look.bright;
    }
  }
  return out;
}

function isIdentity(look: Look): boolean {
  return look.hue === 0 && look.sat === 1 && look.bright === 1;
}

/** A graded copy of `src`. Near-black pixels (the outlines) keep their color. */
export function gradeBuf(src: PixelBuf, look: Look): PixelBuf {
  const out = clone(src);
  if (isIdentity(look)) return out;
  const d = out.px;
  const m = colorMatrix(look);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const k = lum < 0.16 ? 0 : lum > 0.3 ? 1 : (lum - 0.16) / 0.14;
    d[i] = r + (m[0] * r + m[1] * g + m[2] * b - r) * k;
    d[i + 1] = g + (m[3] * r + m[4] * g + m[5] * b - g) * k;
    d[i + 2] = b + (m[6] * r + m[7] * g + m[8] * b - b) * k;
  }
  return out;
}

const MOON = [
  '..kkkk..',
  '.kWWWWk.',
  'kWWW5W.k',
  'kWWWW..k',
  'kWW5W..k',
  'kWWWWW.k',
  '.kWWWWk.',
  '..kkkk..',
];

/** The world's sky in `w` x `h` art pixels: flat bands from top to bottom, with stars and a moon at night. */
export function skyBuf(w: number, h: number, look: Look): PixelBuf {
  const b = blank(w, h);
  const bands = 7;
  const span = Math.ceil((h * 0.75) / bands);
  for (let i = 0; i < bands; i++) {
    const c = mix(look.skyTop, look.skyBottom, i / (bands - 1));
    fill(b, 0, i * span, w, i === bands - 1 ? h - i * span : span, c);
  }
  if (look.night) {
    for (let i = 0; i < 46; i++) {
      const x = Math.floor(hash01(i) * w);
      const y = Math.floor(hash01(i + 500) * h * 0.55);
      const bright = hash01(i + 900) > 0.7;
      fill(b, x, y, 1, 1, bright ? '#ffffff' : mix(look.skyTop, '#ffffff', 0.6));
      if (bright && hash01(i + 1300) > 0.6) {
        const [r, g, bl] = rgb(mix(look.skyTop, '#ffffff', 0.35));
        const dim = toHex(r, g, bl);
        fill(b, x - 1, y, 1, 1, dim);
        fill(b, x + 1, y, 1, 1, dim);
        fill(b, x, y - 1, 1, 1, dim);
        fill(b, x, y + 1, 1, 1, dim);
      }
    }
    blit(b, fromRows(MOON), Math.floor(w * 0.8), Math.floor(h * 0.1));
  }
  return b;
}

/** Layer placement in the 1080 x 820 battle view (multiples of the pixel size, so pixels line up). */
export const LAYER_Y = { far: LAYERS.far.y * P, mid: LAYERS.mid.y * P, ground: LAYERS.ground.y * P, fg: LAYERS.fg.y * P } as const;
export const SCROLL0 = { far: 43 * P, mid: 7 * P, ground: 83 * P, fg: 117 * P } as const;

const thumbs = new Map<number, string>();

/** A preview of a world (sky + graded scenery) as a data URL, cached. Pixel-crisp at 3x. */
export function worldThumbUrl(world: number): string {
  const hit = thumbs.get(world);
  if (hit) return hit;
  const def = DATA.worlds[Math.max(1, Math.min(world, DATA.worlds.length)) - 1];
  const L = baseLayers();
  // The band of the battle view with the houses, trees and road.
  const top = 26;
  const w = 160;
  const h = 96;
  const out = skyBuf(w, h + top, def.look);
  const view = blank(w, h + top);
  const put = (src: PixelBuf, sx: number, y: number) => {
    for (let x = 0; x < w; x += src.w) blit(view, src, x - (sx % src.w), y);
    blit(view, src, w - (sx % src.w), y);
  };
  put(gradeBuf(L.far, def.look), SCROLL0.far / P, LAYERS.far.y);
  put(gradeBuf(L.mid, def.look), SCROLL0.mid / P, LAYERS.mid.y);
  put(gradeBuf(L.ground, def.look), SCROLL0.ground / P, LAYERS.ground.y);
  blit(out, view, 0, 0);
  const cropped = blank(w, h);
  blit(cropped, out, 0, -top);
  const url = toCanvas(cropped, 3).toDataURL('image/png');
  thumbs.set(world, url);
  return url;
}
