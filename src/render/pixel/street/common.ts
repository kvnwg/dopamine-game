/**
 * Shared pieces of the street scenery (Sunny Suburbs, used by every world but the dungeon and the farm):
 * the tile width and drawing helpers for tiling layers. The layers themselves are in far.ts, mid.ts and
 * ground.ts, each with its place in the street's 123-row scene frame (sceneryTypes.ts: SCENE_FRAME);
 * scenery.ts bundles them as SUBURBS. The farm (farm.ts) borrows despeckle, foliage, plant, put and
 * windowsOf, which work on any buffer width.
 */
import { blit, clone, fromRows, hash01, mix, outline, setPx, type PixelBuf, type Rows } from '../buf';
import { PAL } from '../palette';

/**
 * Width of every street layer, in art pixels: twelve sidewalk slabs of 28 or 29 pixels (1.5 times the
 * 9 px grid's 228). Each layer repeats seamlessly.
 */
export const TILE_W = 342;

/** center x, center y, radius (x), and an optional y radius for tall crowns */
export type Clump = readonly [number, number, number, number?];

export const TAU = Math.PI * 2;

// ------------------------------------------------------------------ helpers

export const wrap = (x: number): number => ((x % TILE_W) + TILE_W) % TILE_W;

/** setPx on a tiling layer: x wraps across the seam. */
export function dot(b: PixelBuf, x: number, y: number, c: string): void {
  setPx(b, wrap(x), y, c);
}

/** Deterministic noise for a tile cell (x wraps, so it repeats with the tile). */
export const h2 = (x: number, y: number, seed: number): number => hash01(wrap(x) * 131 + y * 7907 + seed * 104729);

/** Distance between two columns across the seam. */
export function dist(a: number, b: number): number {
  const d = Math.abs(wrap(a) - wrap(b));
  return Math.min(d, TILE_W - d);
}

/**
 * Splits the tile into runs of `min` to `max` columns, repeating seamlessly: each column's run index.
 * Texture is laid in runs so it reads as strokes, never single pixels.
 */
export function runIds(seed: number, min: number, max: number): number[] {
  const ids: number[] = [];
  for (let k = 0, x = 0; x < TILE_W; k++) {
    let len = min + Math.floor(hash01(seed * 997 + k) * (max - min + 1));
    if (TILE_W - x - len < min) len = TILE_W - x;
    for (let i = 0; i < len; i++) ids.push(k);
    x += len;
  }
  return ids;
}

/**
 * A contour that repeats exactly every TILE_W (base + sines with whole cycles per tile), as one row
 * per column. Steps one pixel wide are evened out, so rims never get lone spikes or notches.
 */
export function contour(base: number, terms: ReadonlyArray<readonly [number, number, number]>): number[] {
  const ys: number[] = [];
  for (let x = 0; x < TILE_W; x++) {
    let y = base;
    for (const [amp, cycles, phase] of terms) y += amp * Math.sin((x / TILE_W) * TAU * cycles + phase);
    ys.push(Math.round(y));
  }
  for (let x = 0; x < TILE_W; x++) {
    const l = ys[wrap(x - 1)];
    const r = ys[wrap(x + 1)];
    if (l === r && ys[x] !== l) ys[x] = l;
  }
  return ys;
}

/** Pastes a sprite onto a tiling layer, wrapping across the seam. */
export function put(layer: PixelBuf, s: PixelBuf, x: number, y: number, flip = false): void {
  blit(layer, s, x, y, { wrapX: true, flipX: flip });
}

/** Pastes a sprite so its bottom row lands on row `base`. */
export function plant(layer: PixelBuf, s: PixelBuf, x: number, base: number, flip = false): void {
  put(layer, s, x, base - s.h + 1, flip);
}

export const ink = (b: PixelBuf): PixelBuf => outline(b, PAL.k);
export const inked = (rows: Rows, recolor?: Partial<Record<string, string>>): PixelBuf => ink(fromRows(rows, recolor));

/**
 * Round leafy clumps (the far tree line), drawn back to front. Each clump gets a shaded crescent on
 * its bottom right and a lit cap on its top left, so overlapping clumps read as separate crowns.
 */
export function foliage(plot: (x: number, y: number, c: string) => void, clumps: readonly Clump[], tones: readonly [string, string, string]): void {
  const [dark, mid, light] = tones;
  for (const [cx, cy, rx, ryIn] of clumps) {
    const ry = ryIn ?? rx;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        // unit-circle coordinates, so tall crowns shade like round ones
        const u = (x + 0.5 - cx) / rx;
        const v = (y + 0.5 - cy) / ry;
        if (u * u + v * v > 1) continue;
        let c = mid;
        if ((u + 0.38) ** 2 + (v + 0.5) ** 2 > 1) c = dark;
        else if (v < 0.1 && (u - 0.3) ** 2 + (v - 0.4) ** 2 > 1) c = light;
        plot(x, y, c);
      }
    }
  }
}

export function rgbAt(b: PixelBuf, x: number, y: number): number {
  x = ((x % b.w) + b.w) % b.w;
  if (y < 0 || y >= b.h) return -1;
  const i = (y * b.w + x) * 4;
  return b.px[i + 3] ? (b.px[i] << 16) | (b.px[i + 1] << 8) | b.px[i + 2] : -1;
}

/** A #hex color as the number rgbAt returns. */
export const hexInt = (hex: string): number => parseInt(hex.slice(1), 16);

/**
 * Recolors pixels that match none of their 4 neighbours (stray pixels) to their most common
 * neighbour. The buffer is treated as a horizontal tile (x wraps).
 */
export function despeckle(b: PixelBuf): void {
  const src = clone(b);
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const me = rgbAt(src, x, y);
      if (me < 0) continue;
      const ns = [rgbAt(src, x - 1, y), rgbAt(src, x + 1, y), rgbAt(src, x, y - 1), rgbAt(src, x, y + 1)].filter((n) => n >= 0);
      if (ns.length < 2 || ns.includes(me)) continue;
      const best = ns.reduce((a, n) => (ns.filter((m) => m === n).length > ns.filter((m) => m === a).length ? n : a));
      const i = (y * b.w + x) * 4;
      b.px[i] = (best >> 16) & 255;
      b.px[i + 1] = (best >> 8) & 255;
      b.px[i + 2] = best & 255;
    }
  }
}

// ------------------------------------------------------------------ haze (aerial perspective, far layer)

export const HAZE = '#c8f0ff';
/** Pushes a color toward the pale horizon sky (aerial perspective). */
export const hz = (c: string, t: number): string => mix(c, HAZE, t);

/** Recolor map that hazes every listed palette key by `t`. */
export function hazeMap(keys: string, t: number): Record<string, string> {
  const m: Record<string, string> = {};
  for (const k of keys) m[k] = hz(k, t);
  return m;
}

// ------------------------------------------------------------------ windows (lit at dusk and night)

/**
 * Windows in house art: groups of glass ('c', 'C'), muntin ('w') and curtain ('M', 'P') pixels closed
 * in by frame ('x') on every side, with some glass. Returns their rects in the art's own pixels, with
 * a mask ('g' glass, 'f' muntin, 'u' curtain): at night lit glass glows, muntins and curtains show
 * against it.
 */
export function windowsOf(rows: Rows): Array<{ x: number; y: number; w: number; h: number; mask: string[] }> {
  const H = rows.length;
  const W = rows[0].length;
  const pane = (x: number, y: number) => y >= 0 && y < H && x >= 0 && x < W && 'cCwMP'.includes(rows[y][x]);
  const seen = new Set<number>();
  const out: Array<{ x: number; y: number; w: number; h: number; mask: string[] }> = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!pane(x, y) || seen.has(y * W + x)) continue;
      const cells: Array<[number, number]> = [];
      const todo: Array<[number, number]> = [[x, y]];
      seen.add(y * W + x);
      let closed = true;
      while (todo.length) {
        const [cx, cy] = todo.pop()!;
        cells.push([cx, cy]);
        for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]] as const) {
          if (pane(nx, ny)) {
            if (!seen.has(ny * W + nx)) {
              seen.add(ny * W + nx);
              todo.push([nx, ny]);
            }
          } else if (rows[ny]?.[nx] !== 'x') closed = false;
        }
      }
      if (!closed || !cells.some(([cx, cy]) => 'cC'.includes(rows[cy][cx]))) continue;
      const x0 = Math.min(...cells.map((c) => c[0]));
      const y0 = Math.min(...cells.map((c) => c[1]));
      const x1 = Math.max(...cells.map((c) => c[0]));
      const y1 = Math.max(...cells.map((c) => c[1]));
      const inside = new Set(cells.map(([cx, cy]) => cy * W + cx));
      const mask: string[] = [];
      for (let yy = y0; yy <= y1; yy++) {
        let m = '';
        for (let xx = x0; xx <= x1; xx++) {
          const ch = rows[yy][xx];
          m += !inside.has(yy * W + xx) ? '.' : ch === 'w' ? 'f' : ch === 'M' || ch === 'P' ? 'u' : 'g';
        }
        mask.push(m);
      }
      out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, mask });
    }
  }
  return out;
}
