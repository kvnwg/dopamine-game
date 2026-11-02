/**
 * Per-world look: a sky gradient plus a hue / saturation / brightness grade applied to the shared
 * cel scenery (dark outline pixels are left alone so line work stays crisp). Used by the battle
 * scene (full-size layers) and the Worlds tab (small preview cards).
 */
import { DATA, type WorldDef } from '../data';
import { farLayer, fgLayer, groundLayer, midLayer } from './cel';

export type Look = WorldDef['look'];

export interface BaseLayers {
  far: HTMLCanvasElement;
  mid: HTMLCanvasElement;
  ground: HTMLCanvasElement;
  fg: HTMLCanvasElement;
}

let base: BaseLayers | null = null;

/** The ungraded scenery tiles, painted once. */
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
export function grade(src: HTMLCanvasElement, look: Look): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0);
  if (isIdentity(look)) return c;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const m = colorMatrix(look);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    // Keep line work dark: fade the grade in above a low luminance.
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const k = lum < 0.16 ? 0 : lum > 0.3 ? 1 : (lum - 0.16) / 0.14;
    const nr = m[0] * r + m[1] * g + m[2] * b;
    const ng = m[3] * r + m[4] * g + m[5] * b;
    const nb = m[6] * r + m[7] * g + m[8] * b;
    d[i] = r + (nr - r) * k;
    d[i + 1] = g + (ng - g) * k;
    d[i + 2] = b + (nb - b) * k;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Deterministic pseudo-random in 0..1 for star placement. */
function hash(i: number): number {
  let h = Math.imul(i + 1, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return ((h >>> 0) % 10000) / 10000;
}

/** The world's sky: a vertical gradient, with stars and a soft moon at night. */
export function skyCanvas(w: number, h: number, look: Look): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, look.skyTop);
  g.addColorStop(0.72, look.skyBottom);
  g.addColorStop(1, look.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (look.night) {
    for (let i = 0; i < 70; i++) {
      const x = hash(i) * w;
      const y = hash(i + 500) * h * 0.6;
      const r = 1 + hash(i + 900) * 2.6 * (w / 1080);
      ctx.globalAlpha = 0.45 + hash(i + 1300) * 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const mx = w * 0.82;
    const my = h * 0.16;
    const mr = w * 0.06;
    const glow = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 3);
    glow.addColorStop(0, 'rgba(255,255,240,0.35)');
    glow.addColorStop(1, 'rgba(255,255,240,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
    ctx.fillStyle = '#fff8e1';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

/** Layer placement in the 1080 x 820 battle view. */
export const LAYER_Y = { far: 202, mid: 224, ground: 580, fg: 700 } as const;
export const SCROLL0 = { far: 260, mid: 40, ground: 500, fg: 700 } as const;

const thumbs = new Map<number, string>();

/** A small preview of a world (sky + graded scenery) as a data URL, cached. */
export function worldThumbUrl(world: number, w = 420, h = 200): string {
  const key = world * 100000 + w * 100 + h;
  const hit = thumbs.get(key);
  if (hit) return hit;
  const def = DATA.worlds[Math.max(1, Math.min(world, DATA.worlds.length)) - 1];
  const L = baseLayers();
  // Show the battle view's band from y=170 to y=730 (the houses, trees and road).
  const y0 = 170;
  const y1 = 730;
  const k = h / (y1 - y0);
  const viewW = w / k;
  const scenery = document.createElement('canvas');
  scenery.width = w;
  scenery.height = h;
  const sctx = scenery.getContext('2d')!;
  sctx.imageSmoothingQuality = 'high';
  const put = (src: HTMLCanvasElement, sx: number, y: number) => {
    sctx.drawImage(src, sx, 0, viewW, src.height, 0, (y - y0) * k, w, src.height * k);
  };
  put(L.far, SCROLL0.far, LAYER_Y.far);
  put(L.mid, SCROLL0.mid, LAYER_Y.mid);
  put(L.ground, SCROLL0.ground, LAYER_Y.ground);
  const graded = grade(scenery, def.look);
  const out = skyCanvas(w, h, def.look);
  out.getContext('2d')!.drawImage(graded, 0, 0);
  const url = out.toDataURL('image/png');
  thumbs.set(key, url);
  return url;
}
