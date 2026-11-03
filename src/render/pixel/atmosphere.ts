/**
 * Atmosphere for the battle backdrops, painted on the art pixel grid (one buffer pixel is one battle
 * pixel, 12 screen pixels), the way a pixel artist paints light:
 *  - skies in color bands whose edges break up into short runs, mixed in OKLab so sunset ramps
 *    (blue, violet, rose, orange, gold) stay clean instead of going gray;
 *  - a sun, moon or planet inside a halo of stepped rings (an overlay drawn over the clouds, so they
 *    catch its glow), and stars;
 *  - clouds built from ellipses, each shaded with a lit cap toward the light and a shaded crescent
 *    away from it (puffy heaps by day, thin streaks lit from below at sunset);
 *  - scenery lighting: an ambient multiply (dusk, night), aerial haze, rim light on the skyline,
 *    lit windows and lamps, and their glow in stepped rings (additive on the art, semi-transparent
 *    beyond it so it lights whatever is behind);
 *  - a vignette in stepped rings.
 *
 * Pure and deterministic (no DOM): the battle scene, the Worlds tab thumbnails and
 * tools/worldPreview.ts all paint from here. Each art pixel has one color and one alpha.
 */
import type { Atmo } from '../../data';
import { blank, clone, rgb, type PixelBuf } from './buf';
import { VIEW, type LayerName, type LightSpot } from './sceneryTypes';

export type RGB = readonly [number, number, number];

// ------------------------------------------------------------------ color

const toLin = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const toByte = (v: number): number => {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
};

function toLab([r8, g8, b8]: RGB): [number, number, number] {
  const r = toLin(r8);
  const g = toLin(g8);
  const b = toLin(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromLab([L, A, B]: readonly [number, number, number]): RGB {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    toByte(Math.max(0, 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    toByte(Math.max(0, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    toByte(Math.max(0, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  ];
}

const mixCache = new Map<string, RGB>();

/** Mixes two colors in OKLab (t = 0 gives a, 1 gives b). */
export function mixLab(a: RGB, b: RGB, t: number): RGB {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const key = `${a[0]},${a[1]},${a[2]}|${b[0]},${b[1]},${b[2]}|${t.toFixed(3)}`;
  let c = mixCache.get(key);
  if (!c) {
    const p = toLab(a);
    const q = toLab(b);
    c = fromLab([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
    if (mixCache.size > 200_000) mixCache.clear();
    mixCache.set(key, c);
  }
  return c;
}

const hexRgb = (hex: string): RGB => rgb(hex);
const WHITE: RGB = [255, 255, 255];

export function luma([r, g, b]: RGB): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// ------------------------------------------------------------------ pixels and noise

function setRGB(b: PixelBuf, x: number, y: number, c: RGB, a = 255): void {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
  const i = (y * b.w + x) * 4;
  b.px[i] = c[0];
  b.px[i + 1] = c[1];
  b.px[i + 2] = c[2];
  b.px[i + 3] = a;
}

function getRGB(b: PixelBuf, x: number, y: number): RGB {
  const i = (y * b.w + x) * 4;
  return [b.px[i], b.px[i + 1], b.px[i + 2]];
}

/** Deterministic 0..1 noise for a grid cell. */
export function hash3(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul((y | 0) + 0x5bd1e995, 0x165667b1) ^ Math.imul((seed | 0) + 1, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Jitter for band and ring edges, -0.5..0.5, constant along short horizontal runs (2 to 4 pixels)
 * so broken edges read as dabs of color rather than single-pixel noise.
 */
function runJitter(x: number, y: number, seed: number): number {
  const shift = Math.floor(hash3(y, 7, seed) * 4);
  const run = 2 + Math.floor(hash3(y, 11, seed) * 3);
  return hash3(Math.floor((x + shift) / run), y, seed + 3) - 0.5;
}

/**
 * Alpha "over" compositing of `src` onto `dst` at (x, y); `wrapX` repeats across `dst`'s width (for
 * tiling layers). Used for previews and thumbnails; the battle composites on the GPU.
 */
export function over(dst: PixelBuf, src: PixelBuf, x: number, y: number, wrapX = false): void {
  for (let sy = 0; sy < src.h; sy++) {
    const dy = y + sy;
    if (dy < 0 || dy >= dst.h) continue;
    for (let sx = 0; sx < src.w; sx++) {
      const si = (sy * src.w + sx) * 4;
      const a = src.px[si + 3];
      if (a === 0) continue;
      let dx = x + sx;
      if (wrapX) dx = ((dx % dst.w) + dst.w) % dst.w;
      if (dx < 0 || dx >= dst.w) continue;
      const di = (dy * dst.w + dx) * 4;
      const k = a / 255;
      const da = dst.px[di + 3] / 255;
      const oa = k + da * (1 - k);
      for (let c = 0; c < 3; c++) {
        dst.px[di + c] = oa > 0 ? (src.px[si + c] * k + dst.px[di + c] * da * (1 - k)) / oa : 0;
      }
      dst.px[di + 3] = Math.round(oa * 255);
    }
  }
}

// ------------------------------------------------------------------ sky

/** Rows per sky band (bands get ~3.5 rows each down to the horizon). */
const BAND_ROWS = 3.5;

function bandCount(atmo: Atmo): number {
  return Math.max(5, Math.round(atmo.horizon / BAND_ROWS));
}

/** The sky color a fraction `t` (0 = top, 1 = horizon) of the way down its stops. */
function gradientAt(atmo: Atmo, t: number): RGB {
  const stops = atmo.sky.map(hexRgb);
  const f = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const k = Math.min(stops.length - 2, Math.floor(f));
  return mixLab(stops[k], stops[k + 1], f - k);
}

/** The flat color of sky band `i`. */
function bandColor(atmo: Atmo, i: number): RGB {
  const n = bandCount(atmo);
  return gradientAt(atmo, n === 1 ? 1 : i / (n - 1));
}

/** The (unbroken) sky color at view row `y`. */
export function skyAt(atmo: Atmo, y: number): RGB {
  const n = bandCount(atmo);
  const i = Math.max(0, Math.min(n - 1, Math.floor((y / atmo.horizon) * n)));
  return bandColor(atmo, i);
}

/** Which band a sky pixel falls in: rows down to the horizon, edges wavy and broken into runs. */
function bandAt(atmo: Atmo, x: number, y: number, seed: number): number {
  const n = bandCount(atmo);
  const wave = 0.9 * Math.sin(x * 0.16 + y * 0.53 + seed) + 0.5 * Math.sin(x * 0.37 - y * 0.29 + seed * 2.1);
  const u = ((y + 0.5 + wave * 0.55 + runJitter(x, y, seed) * 0.85) / atmo.horizon) * n;
  return Math.max(0, Math.min(n - 1, Math.floor(u)));
}

/** Stepped halo strength (0 = none) at a pixel: four rings, wider and fainter outward. */
const HALO_STEPS = [0, 0.16, 0.3, 0.46, 0.64] as const;

function haloLevel(atmo: Atmo, x: number, y: number, seed: number): number {
  const b = atmo.body;
  if (!b || b.haloR <= 0) return 0;
  const d = Math.hypot(x + 0.5 - b.x, y + 0.5 - b.y);
  if (d >= b.haloR + 1) return 0;
  const v = Math.max(0, 1 - d / b.haloR) ** 1.35;
  const steps = HALO_STEPS.length - 1;
  return Math.max(0, Math.min(steps, Math.floor(v * steps + 0.25 + runJitter(x, y, seed + 17) * 0.55)));
}

/**
 * The sky of a world: color bands and stars, `w` x `h` art pixels. The sun or moon and its halo
 * are a separate overlay (glowOverlay), drawn over the clouds.
 */
export function paintSky(atmo: Atmo, w: number, h: number, seed: number): PixelBuf {
  const b = blank(w, h);
  const n = bandCount(atmo);
  const bands = Array.from({ length: n }, (_, i) => bandColor(atmo, i));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) setRGB(b, x, y, bands[bandAt(atmo, x, y, seed)]);
  }
  paintStars(b, atmo, seed);
  return b;
}

/** Scattered stars, thinning toward the horizon and hidden in the halo. A few bright ones get a dim cross. */
function paintStars(b: PixelBuf, atmo: Atmo, seed: number): void {
  if (atmo.stars <= 0) return;
  const top = Math.floor(atmo.horizon * 0.82);
  const taken = new Set<number>();
  for (let y = 0; y < top; y++) {
    const fade = (1 - y / top) ** 0.8;
    for (let x = 0; x < b.w; x++) {
      if (hash3(x, y, seed + 101) >= atmo.stars * 0.05 * fade) continue;
      if (haloLevel(atmo, x, y, seed) >= 2 || insideBody(atmo, x, y, 2)) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (taken.has((y + dy) * 1000 + x + dx)) near = true;
      if (near) continue;
      taken.add(y * 1000 + x);
      const base = getRGB(b, x, y);
      const kind = hash3(x, y, seed + 202);
      if (kind > 0.93 && x > 0 && y > 0 && x < b.w - 1) {
        setRGB(b, x, y, WHITE);
        const arm = mixLab(base, WHITE, 0.4);
        setRGB(b, x - 1, y, arm);
        setRGB(b, x + 1, y, arm);
        setRGB(b, x, y - 1, arm);
        setRGB(b, x, y + 1, arm);
      } else {
        setRGB(b, x, y, mixLab(base, kind > 0.7 ? WHITE : mixLab(WHITE, [255, 236, 200], 0.5), kind > 0.7 ? 0.85 : 0.55));
      }
    }
  }
}

function insideBody(atmo: Atmo, x: number, y: number, pad = 0): boolean {
  const b = atmo.body;
  if (!b) return false;
  return Math.hypot(x + 0.5 - b.x, y + 0.5 - b.y) <= b.r + pad;
}

/**
 * The sun, moon or planet and its halo, as an overlay (`buf` with its top-left at view `x`, `y`):
 * the halo rings are semi-transparent (so clouds passing under them light up), the body opaque.
 */
export function glowOverlay(atmo: Atmo, seed: number): { buf: PixelBuf; x: number; y: number } | null {
  const body = atmo.body;
  if (!body) return null;
  const R = Math.ceil(Math.max(body.haloR, body.r * (body.ring ? 2.2 : 1)) + 2);
  const x0 = Math.floor(body.x - R);
  const y0 = Math.floor(body.y - R);
  const b = blank(R * 2 + 1, R * 2 + 1);
  const halo = hexRgb(body.halo);
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const lv = haloLevel(atmo, x + x0, y + y0, seed);
      if (lv > 0) setRGB(b, x, y, halo, Math.round(HALO_STEPS[lv] * 255));
    }
  }
  paintBody(b, atmo, x0, y0, seed);
  return { buf: b, x: x0, y: y0 };
}

function paintBody(b: PixelBuf, atmo: Atmo, x0: number, y0: number, seed: number): void {
  const body = atmo.body!;
  const base = hexRgb(body.color);
  const halo = hexRgb(body.halo);
  const accent = hexRgb(body.accent ?? body.halo);
  const shadow = mixLab(base, hexRgb(atmo.sky[0]), 0.45);
  // A planet's ring: the back half behind the planet, the front half over it.
  const ring = (front: boolean) => {
    if (!body.ring) return;
    const rx = body.r * 2.1;
    const ry = body.r * 0.55;
    for (let k = 0; k < 360; k++) {
      const a = (k / 360) * Math.PI * 2;
      const isFront = Math.sin(a) > 0;
      if (isFront !== front) continue;
      const px = Math.floor(body.x + Math.cos(a) * rx) - x0;
      const py = Math.floor(body.y + Math.sin(a) * ry * 1.0 + Math.cos(a) * 0.9) - y0;
      if (!front && Math.hypot(px + x0 + 0.5 - body.x, py + y0 + 0.5 - body.y) <= body.r) continue;
      setRGB(b, px, py, Math.cos(a) < -0.3 ? accent : mixLab(accent, WHITE, 0.4));
    }
  };
  ring(false);
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const vx = x + x0 + 0.5 - body.x;
      const vy = y + y0 + 0.5 - body.y;
      const d = Math.hypot(vx, vy);
      if (d > body.r) continue;
      let c = base;
      if (body.kind === 'sun') {
        if (d > body.r - 1) c = mixLab(base, halo, 0.35);
      } else {
        // Lit from the top left: a darker limb on the bottom right.
        const lit = (-vx * 0.6 - vy * 0.8) / body.r;
        if (body.kind === 'moon') {
          if (lit < -0.45) c = mixLab(base, accent, 0.75);
          const crater = (cx: number, cy: number, r: number) => Math.hypot(vx - cx * body.r, vy - cy * body.r) <= r;
          if (crater(-0.3, -0.15, 1.1) || crater(0.25, 0.3, 0.9) || crater(0.35, -0.45, 0.7)) c = accent;
        } else {
          const land = hash3(Math.floor((x + x0) / 2), Math.floor((y + y0) / 2), seed + 404) > 0.55;
          if (land) c = accent;
          if (lit < -0.35) c = mixLab(c, shadow, 0.55);
          else if (lit > 0.55) c = mixLab(c, WHITE, 0.25);
        }
      }
      setRGB(b, x, y, c);
    }
  }
  ring(true);
}

/** Positions for twinkling stars (drawn as sprites over the sky): upper sky, clear of the halo. */
export function twinkleSpots(atmo: Atmo, count: number, seed: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  const top = Math.floor(atmo.horizon * 0.62);
  for (let k = 0; out.length < count && k < count * 30; k++) {
    const x = 1 + Math.floor(hash3(k, 1, seed + 909) * (VIEW.w - 2));
    const y = 1 + Math.floor(hash3(k, 2, seed + 909) * Math.max(1, top - 1));
    if (haloLevel(atmo, x, y, seed) >= 1 || insideBody(atmo, x, y, 3)) continue;
    if (out.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < 6)) continue;
    out.push({ x, y });
  }
  return out;
}

// ------------------------------------------------------------------ clouds

/** Cloud strips tile horizontally every CLOUD_W art pixels. */
export const CLOUD_W = 180;

export interface CloudStrip {
  buf: PixelBuf;
  /** View row of the strip's top edge. */
  y: number;
  /** Drift in art pixels per second (the back strip is slower). */
  speed: number;
}

interface Lobe {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** A heap's flat bottom row: nothing below it. */
  base?: number;
}

/** Unit vector (screen axes, y down) pointing from a cloud band toward the light. */
function lightDir(atmo: Atmo, bandY: number): [number, number] {
  const b = atmo.body;
  if (!b) return [-0.45, -0.9];
  let dx = (b.x - VIEW.w / 2) / VIEW.w;
  let dy = (b.y - bandY) / 12 - 0.5;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  return [dx, dy];
}

/** A world's two cloud strips, back (smaller, hazier, slower) then front; empty without clouds. */
export function paintClouds(atmo: Atmo, seed: number): CloudStrip[] {
  const cl = atmo.clouds;
  if (!cl || cl.cover <= 0) return [];
  const strips: CloudStrip[] = [];
  for (const back of [true, false]) {
    const h = cl.style === 'puffy' ? (back ? 12 : 16) : back ? 10 : 12;
    const y = cl.y + (back ? 0 : cl.style === 'puffy' ? 5 : 7);
    const lobes = cl.style === 'puffy' ? puffy(cl.cover, back, h, seed) : streaks(cl.cover, back, h, seed);
    const buf = shadeLobes(lobes, h, atmo, y, back, seed);
    strips.push({ buf, y, speed: back ? 0.45 : 0.9 });
  }
  return strips;
}

/** Cumulus heaps: a big lobe with smaller ones around it, flat along the bottom. */
function puffy(cover: number, back: boolean, h: number, seed: number): Lobe[][] {
  const count = Math.max(1, Math.round((back ? 2.5 : 1.5) + cover * (back ? 4 : 3)));
  const scale = back ? 0.62 : 1;
  const heaps: Lobe[][] = [];
  for (let i = 0; i < count; i++) {
    const r = (k: number) => hash3(i, k, seed + (back ? 31 : 37));
    const cx = ((i + 0.5 + (r(1) - 0.5) * 0.5) / count) * CLOUD_W;
    const width = (15 + r(2) * 16) * scale;
    const base = h - 2 - Math.floor(r(3) * (h * 0.3));
    const tall = width * (0.38 + r(4) * 0.12);
    const heap: Lobe[] = [{ cx, cy: base - tall * 0.42, rx: width * 0.3, ry: tall * 0.55, base }];
    const sides = 2 + Math.floor(r(5) * 3);
    for (let k = 0; k < sides; k++) {
      const side = k % 2 === 0 ? -1 : 1;
      const spread = 0.18 + hash3(i, 20 + k, seed) * 0.22;
      const rr = width * (0.15 + hash3(i, 30 + k, seed) * 0.09);
      heap.push({ cx: cx + side * width * spread * (1 + Math.floor(k / 2) * 0.7), cy: base - rr * 0.75, rx: rr * 1.15, ry: rr, base });
    }
    heaps.push(heap);
  }
  return heaps;
}

/** Sunset stratus: long thin streaks in loose rows. */
function streaks(cover: number, back: boolean, h: number, seed: number): Lobe[][] {
  const count = Math.round((back ? 6 : 4) + cover * (back ? 10 : 8));
  const out: Lobe[][] = [];
  for (let i = 0; i < count; i++) {
    const r = (k: number) => hash3(i, k, seed + (back ? 41 : 47));
    const rx = (back ? 6 : 9) + r(1) * (back ? 12 : 18);
    const ry = (back ? 1.1 : 1.4) + r(2) * (back ? 0.9 : 1.4);
    const cx = r(3) * CLOUD_W;
    const cy = 2 + r(4) * (h - 4);
    const streak: Lobe[] = [{ cx, cy, rx, ry }];
    // A smaller puff riding on top of some streaks.
    if (r(5) > 0.45) streak.push({ cx: cx + (r(6) - 0.5) * rx, cy: cy - ry * 0.7, rx: rx * 0.45, ry: ry * 0.9 });
    out.push(streak);
  }
  return out;
}

/**
 * Rasterizes cloud lobes into a tiling strip, shaded on the outline of the whole cloud (not lobe by
 * lobe, so lobes merge into one body): a rim on the edge facing the light, a lit band behind it, a
 * shaded band along the far side (and a heap's flat base), the body in between.
 */
function shadeLobes(groups: Lobe[][], h: number, atmo: Atmo, stripY: number, back: boolean, seed: number): PixelBuf {
  const cl = atmo.clouds!;
  const [lx, ly] = lightDir(atmo, stripY + h / 2);
  const W = CLOUD_W;
  const mask = new Uint8Array(W * h);
  const baseRow = new Int16Array(W * h).fill(-1);
  for (const group of groups) {
    for (const lobe of group) {
      const x0 = Math.floor(lobe.cx - lobe.rx - 1);
      const x1 = Math.ceil(lobe.cx + lobe.rx + 1);
      for (let y = Math.max(0, Math.floor(lobe.cy - lobe.ry - 1)); y < Math.min(h, Math.ceil(lobe.cy + lobe.ry + 1)); y++) {
        if (lobe.base !== undefined && y > lobe.base) continue;
        for (let xx = x0; xx <= x1; xx++) {
          const u = (xx + 0.5 - lobe.cx) / lobe.rx;
          const v = (y + 0.5 - lobe.cy) / lobe.ry;
          if (u * u + v * v > 1) continue;
          const i = y * W + (((xx % W) + W) % W);
          mask[i] = 1;
          if (lobe.base !== undefined) baseRow[i] = lobe.base;
        }
      }
    }
  }
  const inside = (x: number, y: number) => y >= 0 && y < h && mask[y * W + (((x % W) + W) % W)] === 1;
  // The light direction snapped to the pixel grid.
  const sx = Math.abs(lx) > 0.38 ? Math.sign(lx) : 0;
  const sy = Math.abs(ly) > 0.38 ? Math.sign(ly) : -1;
  const light = hexRgb(cl.light);
  const shade = hexRgb(cl.shade);
  const tones: RGB[] = [shade, mixLab(shade, light, 0.5), light, hexRgb(cl.rim)];
  const buf = blank(W, h);
  for (let y = 0; y < h; y++) {
    const sky = skyAt(atmo, stripY + y);
    for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      let t = 1;
      if (!inside(x + sx, y + sy)) t = 3;
      else if (!inside(x + sx * 2, y + sy * 2) || (sy !== 0 && !inside(x, y + sy * 2))) t = 2;
      else if (!inside(x - sx, y - sy) || !inside(x - sx * 2, y - sy * 2)) t = 0;
      const base = baseRow[y * W + x];
      if (base >= 0 && y >= base - (back ? 0 : 1) && sy < 0) t = Math.min(t, 0);
      // Clouds take a little of the sky behind them; far ones more.
      setRGB(buf, x, y, mixLab(tones[t], sky, back ? 0.28 : 0.1));
    }
  }
  void seed;
  return buf;
}

// ------------------------------------------------------------------ scenery light

export interface LightOptions {
  atmo: Atmo;
  layer: LayerName;
  lights: readonly LightSpot[];
  seed: number;
  /** The layer's top row in the view (its haze defaults to the sky color a little below that). */
  top: number;
}

/** Glow rings: thresholds on summed light, and how strongly each ring adds (art) or shows (open air). */
const GLOW_AT = [0.1, 0.26, 0.5] as const;
const GLOW_ADD = [0, 0.1, 0.2, 0.32] as const;
const GLOW_ALPHA = [0, 0.13, 0.24, 0.36] as const;

/** Light spots that are on in this world. Windows are lit by chance (a share of them), keyed by position. */
export function litSpots(atmo: Atmo, lights: readonly LightSpot[], seed: number): LightSpot[] {
  return lights.filter((s) => {
    if (s.kind === 'window') return atmo.windows > 0 && hash3(s.x, s.y, seed + 77) < atmo.windows;
    if (s.kind === 'lamp') return atmo.lamps;
    return true;
  });
}

function spotColor(atmo: Atmo, s: LightSpot): RGB {
  if (s.color) return hexRgb(s.color);
  return hexRgb(atmo.light);
}

/**
 * A scenery layer lit for a world: ambient multiply, haze (far and mid), rim light along the
 * skyline, lit windows and lamps, and their glow. `src` is the layer as drawn (and graded).
 */
export function lightLayer(src: PixelBuf, o: LightOptions): PixelBuf {
  const { atmo, layer } = o;
  const out = clone(src);
  const W = out.w;
  const H = out.h;
  const amb = atmo.ambient ? hexRgb(atmo.ambient) : null;
  const hazeC = atmo.haze.color ? hexRgb(atmo.haze.color) : skyAt(atmo, Math.min(atmo.horizon - 1, o.top + 8));
  const hazeT = layer === 'far' ? atmo.haze.far : layer === 'mid' ? atmo.haze.mid : 0;
  const memo = new Map<number, RGB>();
  const grade = (c: RGB): RGB => {
    const key = (c[0] << 16) | (c[1] << 8) | c[2];
    let g = memo.get(key);
    if (!g) {
      g = c;
      if (amb) g = [(g[0] * amb[0]) / 255, (g[1] * amb[1]) / 255, (g[2] * amb[2]) / 255].map(Math.round) as unknown as RGB;
      if (hazeT > 0) g = mixLab(g, hazeC, hazeT);
      memo.set(key, g);
    }
    return g;
  };
  const opaque = (x: number, y: number) => y >= 0 && y < H && src.px[(y * W + (((x % W) + W) % W)) * 4 + 3] > 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!opaque(x, y)) continue;
      setRGB(out, x, y, grade(getRGB(src, x, y)));
    }
  }

  // Rim light on the skyline (far and mid): top edges, and edges facing the sun.
  if (atmo.rim && (layer === 'far' || layer === 'mid')) {
    const rimC = hexRgb(atmo.rim.color);
    const side = atmo.body ? Math.sign(atmo.body.x - VIEW.w / 2) : 0;
    const lit = clone(out);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!opaque(x, y)) continue;
        const top = !opaque(x, y - 1);
        const facing = side !== 0 && !opaque(x + side, y);
        if (!top && !facing) continue;
        const k = atmo.rim.amount * (top ? 1 : 0.6);
        setRGB(lit, x, y, mixLab(getRGB(out, x, y), rimC, k));
      }
    }
    out.px.set(lit.px);
  }

  // Windows and lamps light up (torches and fountains are bright in the art already: they only glow).
  const on = litSpots(atmo, o.lights, o.seed);
  const night = !!amb;
  for (const s of o.lights) {
    if (s.kind !== 'window' && s.kind !== 'lamp') continue;
    const isOn = on.includes(s);
    if (!isOn && !(night && s.kind === 'window')) continue;
    const L = spotColor(atmo, s);
    for (let yy = 0; yy < s.h; yy++) {
      for (let xx = 0; xx < s.w; xx++) {
        const m = s.mask ? s.mask[yy]?.[xx] ?? '.' : 'g';
        if (m === '.') continue;
        const x = (((s.x + xx) % W) + W) % W;
        const y = s.y + yy;
        if (y < 0 || y >= H || !opaque(x, y)) continue;
        if (!isOn) {
          // A dark window at night reflects a little sky.
          if (m === 'g') setRGB(out, x, y, mixLab(getRGB(out, x, y), [12, 12, 36], 0.4));
          continue;
        }
        if (m === 'f') setRGB(out, x, y, mixLab(L, [80, 36, 16], 0.6));
        // Curtains glow through: their own color, warmed and lit from behind.
        else if (m === 'u') setRGB(out, x, y, mixLab(getRGB(out, x, y), mixLab(L, [190, 70, 50], 0.35), 0.6));
        else if (s.kind === 'window') setRGB(out, x, y, yy === 0 ? mixLab(L, WHITE, 0.4) : yy === s.h - 1 && s.h > 2 ? mixLab(L, [255, 120, 48], 0.25) : L);
        else setRGB(out, x, y, mixLab(L, WHITE, xx === Math.floor(s.w / 2) && yy === Math.floor(s.h / 2) ? 0.7 : 0.35));
      }
    }
  }

  // Glow: summed light from every lit spot, in stepped rings.
  if (on.length) {
    const sum = new Float32Array(W * H);
    const col = new Float32Array(W * H * 3);
    const add = (x: number, y: number, v: number, c: RGB) => {
      if (y < 0 || y >= H || v <= 0) return;
      const i = y * W + (((x % W) + W) % W);
      sum[i] += v;
      col[i * 3] += c[0] * v;
      col[i * 3 + 1] += c[1] * v;
      col[i * 3 + 2] += c[2] * v;
    };
    for (const s of on) {
      const c = spotColor(atmo, s);
      const big = Math.max(s.w, s.h);
      const R = s.radius ?? (s.kind === 'window' ? (layer === 'far' ? 2.6 : 3.4 + big * 0.9) : s.kind === 'lamp' ? 9 : 8);
      const power = s.power ?? (s.kind === 'window' ? (layer === 'far' ? 0.55 : 0.8) : 1.25);
      for (let y = Math.floor(s.y - R - 1); y <= Math.ceil(s.y + s.h + R); y++) {
        for (let x = Math.floor(s.x - R - 1); x <= Math.ceil(s.x + s.w + R); x++) {
          const dx = Math.max(s.x - (x + 0.5), 0, x + 0.5 - (s.x + s.w));
          const dy = Math.max(s.y - (y + 0.5), 0, y + 0.5 - (s.y + s.h));
          const d = Math.hypot(dx, dy);
          if (d >= R) continue;
          add(x, y, power * (1 - d / R) ** 2, c);
        }
      }
      if (s.pool) {
        const p = s.pool;
        for (let y = Math.floor(p.y - p.ry - 1); y <= Math.ceil(p.y + p.ry + 1); y++) {
          for (let x = Math.floor(p.x - p.rx - 1); x <= Math.ceil(p.x + p.rx + 1); x++) {
            const e = Math.hypot((x + 0.5 - p.x) / p.rx, (y + 0.5 - p.y) / p.ry);
            if (e < 1) add(x, y, 0.62 * (1 - e) ** 0.9, c);
          }
        }
      }
    }
    const lit = on.filter((s) => s.kind === 'window' || s.kind === 'lamp');
    const inSpot = (x: number, y: number) => lit.some((s) => y >= s.y && y < s.y + s.h && ((x - s.x) % W + W) % W < s.w);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const v = sum[i];
        if (v <= 0.02) continue;
        const j = runJitter(x, y, o.seed + 61) * 0.06;
        const lv = v + j > GLOW_AT[2] ? 3 : v + j > GLOW_AT[1] ? 2 : v + j > GLOW_AT[0] ? 1 : 0;
        if (!lv) continue;
        const gc: RGB = [col[i * 3] / v, col[i * 3 + 1] / v, col[i * 3 + 2] / v];
        if (opaque(x, y)) {
          if (inSpot(x, y)) continue;
          setRGB(out, x, y, litBy(getRGB(out, x, y), gc, GLOW_ADD[lv]));
        } else {
          setRGB(out, x, y, mixLab(gc, WHITE, 0.12), Math.round(GLOW_ALPHA[lv] * 255));
        }
      }
    }
  }
  return out;
}

/**
 * A surface lit by a colored light of strength `k`: dark surfaces brighten (light added, less on
 * bright ones so pale paving doesn't blow out to white) and every surface takes the light's tint.
 */
function litBy(c: RGB, g: RGB, k: number): RGB {
  const a = k * Math.max(0.15, 1.15 - luma(c));
  const added: RGB = [Math.min(255, c[0] + g[0] * a), Math.min(255, c[1] + g[1] * a), Math.min(255, c[2] + g[2] * a)];
  const tint: RGB = [Math.min(255, (c[0] * g[0] * 1.3) / 255), Math.min(255, (c[1] * g[1] * 1.3) / 255), Math.min(255, (c[2] * g[2] * 1.3) / 255)];
  return mixLab(added.map(Math.round) as unknown as RGB, tint.map(Math.round) as unknown as RGB, Math.min(1, k * 1.6));
}

// ------------------------------------------------------------------ vignette

/** Darkened corners in three stepped rings (semi-transparent ink). */
export function paintVignette(w: number, h: number, strength: number, seed = 0): PixelBuf {
  const b = blank(w, h);
  if (strength <= 0) return b;
  const ink: RGB = [10, 6, 20];
  const alphas = [0, 0.22, 0.42, 0.62].map((a) => a * strength);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5 - w / 2) / (w / 2);
      const v = (y + 0.5 - h / 2) / (h / 2);
      const e = Math.hypot(u * 0.92, v * 1.05) + runJitter(x, y, seed + 5) * 0.05;
      const lv = e > 1.22 ? 3 : e > 1.08 ? 2 : e > 0.94 ? 1 : 0;
      if (lv) setRGB(b, x, y, ink, Math.round(alphas[lv] * 255));
    }
  }
  return b;
}
