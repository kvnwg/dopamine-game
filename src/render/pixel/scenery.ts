/**
 * World 1 battle scenery, "Sunny Suburbs", as pixel art (style rules: docs/PIXEL_ART.md).
 *
 * Four horizontally tiling parallax layers, each TILE_W art pixels wide, plus three clouds:
 *  - far: hazy rolling hills, a distant tree line, a few far roofs and a water tower. Colors are
 *    pushed toward the sky (aerial perspective) and nothing is inked, so it reads as distance.
 *  - mid: the street. Three houses, trees, picket and plank fences, hedges, a mailbox, a fire
 *    hydrant, two metal cans and the green dumpster, all inked in `k`, standing on the lawn.
 *  - ground: lawn edge, curb, the sidewalk the fighters stand on (feet at row 20) and a verge.
 *  - fg: a few grass tufts and flowers along the bottom rows.
 * Every layer wraps seamlessly: sprites go down through wrapX and contours are periodic.
 * Light comes from the top left. Other worlds grade these colors later, so they stay natural.
 */
import {
  alphaAt, blank, blit, checkRows, clearPx, clone, fill, fromRows, hash01, mix, outline, setPx, stamp,
  type PixelBuf, type Rows, type SheetEntry,
} from './buf';
import { PAL } from './palette';

export const TILE_W = 342;

/** Where each layer's top edge sits in the 180 x 137 battle view, and its height. */
export const LAYERS = {
  far: { y: 34, h: 60 },
  mid: { y: 37, h: 64 },
  ground: { y: 97, h: 40 },
  fg: { y: 117, h: 20 },
} as const;

/** dark, mid, light */
type Ramp = readonly [string, string, string];
/** center x, center y, radius (x), and an optional y radius for tall crowns */
type Clump = readonly [number, number, number, number?];
/** dark, mid, light, and an optional sparkle for the lit rim */
type LeafTones = readonly [string, string, string, string | null];

const TAU = Math.PI * 2;
/** Mid-layer row where the lawn starts; every street object's base line sits on it. */
const GROUND = 56;
const LEAVES: LeafTones = ['g', 'G', 'l', null];

// ------------------------------------------------------------------ helpers

const wrap = (x: number): number => ((x % TILE_W) + TILE_W) % TILE_W;

/** setPx on a tiling layer: x wraps across the seam. */
function dot(b: PixelBuf, x: number, y: number, c: string): void {
  setPx(b, wrap(x), y, c);
}

/** A contour that repeats exactly every TILE_W: base + sines with whole cycles per tile. */
function wave(base: number, terms: ReadonlyArray<readonly [number, number, number]>): (x: number) => number {
  return (x) => {
    let y = base;
    for (const [amp, cycles, phase] of terms) y += amp * Math.sin((x / TILE_W) * TAU * cycles + phase);
    return Math.round(y);
  };
}

/** Pastes a sprite onto a tiling layer, wrapping across the seam. */
function put(layer: PixelBuf, s: PixelBuf, x: number, y: number, flip = false): void {
  blit(layer, s, x, y, { wrapX: true, flipX: flip });
}

/** Pastes a sprite so its bottom row lands on row `base`. */
function plant(layer: PixelBuf, s: PixelBuf, x: number, base = GROUND, flip = false): void {
  put(layer, s, x, base - s.h + 1, flip);
}

const ink = (b: PixelBuf): PixelBuf => outline(b, PAL.k);

function rgbAt(b: PixelBuf, x: number, y: number, wrapX = false): number {
  if (wrapX) x = ((x % b.w) + b.w) % b.w;
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return -1;
  const i = (y * b.w + x) * 4;
  return b.px[i + 3] ? (b.px[i] << 16) | (b.px[i + 1] << 8) | b.px[i + 2] : -1;
}

function setRgb(b: PixelBuf, x: number, y: number, rgb: number): void {
  const i = (y * b.w + x) * 4;
  b.px[i] = (rgb >> 16) & 255;
  b.px[i + 1] = (rgb >> 8) & 255;
  b.px[i + 2] = rgb & 255;
  b.px[i + 3] = 255;
}

function mostCommon(list: number[]): number {
  let best = list[0];
  let bestN = 0;
  for (const n of list) {
    const c = list.filter((m) => m === n).length;
    if (c > bestN) {
      best = n;
      bestN = c;
    }
  }
  return best;
}

/**
 * Recolors pixels that match none of their 4 neighbours (stray pixels) to their most common
 * neighbour. `wrapX` treats the buffer as a horizontal tile.
 */
function despeckle(b: PixelBuf, wrapX = false): void {
  const src = clone(b);
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const me = rgbAt(src, x, y);
      if (me < 0) continue;
      const ns = [rgbAt(src, x - 1, y, wrapX), rgbAt(src, x + 1, y, wrapX), rgbAt(src, x, y - 1), rgbAt(src, x, y + 1)].filter((n) => n >= 0);
      if (ns.length >= 2 && !ns.includes(me)) setRgb(b, x, y, mostCommon(ns));
    }
  }
}

/** Smooths a silhouette before inking: drops 1 px spurs and fills 1 px notches. */
function tidy(b: PixelBuf): void {
  for (let pass = 0; pass < 2; pass++) {
    const src = clone(b);
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        const ns = [rgbAt(src, x - 1, y), rgbAt(src, x + 1, y), rgbAt(src, x, y - 1), rgbAt(src, x, y + 1)].filter((n) => n >= 0);
        if (alphaAt(src, x, y)) {
          if (ns.length <= 1) clearPx(b, x, y);
        } else if (ns.length >= 3) setRgb(b, x, y, mostCommon(ns));
      }
    }
  }
}

/**
 * Round leafy clumps, drawn back to front. Each clump gets a shaded crescent on its bottom right
 * and a lit crescent on its top left, so overlapping clumps read as separate bunches of leaves.
 */
function foliage(plot: (x: number, y: number, c: string) => void, clumps: readonly Clump[], tones: LeafTones): void {
  const [dark, mid, light, shine] = tones;
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
        else if ((u - 0.3) ** 2 + (v - 0.4) ** 2 > 1) {
          c = light;
          if (shine && rx > 7 && (u - 0.55) ** 2 + (v - 0.75) ** 2 > 1.3) c = shine;
        }
        plot(x, y, c);
      }
    }
  }
}

// ------------------------------------------------------------------ far layer

const HAZE = '#c8f0ff';
/** Pushes a color toward the pale horizon sky (aerial perspective). */
const hz = (c: string, t: number): string => mix(c, HAZE, t);

/** Recolor map that hazes every listed palette key by `t`. */
function hazeMap(keys: string, t: number): Record<string, string> {
  const m: Record<string, string> = {};
  for (const k of keys) m[k] = hz(k, t);
  return m;
}

// Far sprites are authored in plain palette keys and hazed when stamped (no ink: they are far).
const FAR_HOUSE_GABLE: Rows = [
  '....eR....',
  '...eeRR...',
  '..eeeRRr..',
  '.eeeeRRrr.',
  'eeeeeRRrrr',
  '.WWWWWWW5.',
  '.WxxWWxx5.',
  '.WWWWWWW5.',
  '.WWWWWWW5.',
];

const FAR_HOUSE_HIP: Rows = [
  '...ccUUUUUu...',
  '..ccUUUUUUuu..',
  '.ccUUUUUUUUuu.',
  'ccUUUUUUUUUUuu',
  '.WWWWWWWWWWW5.',
  '.WxxWWWWWxxW5.',
  '.WWWWWWWWWWW5.',
  '.WWWWWWWWWWW5.',
];

const WATER_TOWER: Rows = [
  '....55....',
  '..555544..',
  '.55555444.',
  '55w5555444',
  '5ww5555443',
  '5ww5555443',
  '4444444333',
  '.3..33..3.',
  '.3..33..3.',
  '.33333333.',
  '.3..33..3.',
  '3...33...3',
  '3...33...3',
];

export function farLayer(): PixelBuf {
  const H = LAYERS.far.h;
  const b = blank(TILE_W, H);
  const F = {
    back: hz('G', 0.64),
    backRim: hz('l', 0.56),
    hill: hz('G', 0.54),
    hillRim: hz('l', 0.48),
    field: hz('l', 0.42),
    fieldRim: hz('L', 0.42),
  };
  const trees: LeafTones = [hz('g', 0.52), hz('G', 0.44), hz('l', 0.42), null];
  const back = wave(15, [[4.5, 2, 0.8], [2.5, 3, 2.6], [1.2, 7, 0.4]]);
  const hill = wave(28, [[2.5, 3, 1.9], [1.5, 5, 4.4]]);
  const field = 44;

  // back hills with a lit rim
  for (let x = 0; x < TILE_W; x++) {
    const t = back(x);
    for (let y = t; y < H; y++) setPx(b, x, y, F.back);
    setPx(b, x, t, F.backRim);
  }
  // a water tower on the back hills
  stamp(b, WATER_TOWER, 236, back(240) - 9, { wrapX: true, recolor: hazeMap('w543', 0.5) });

  // nearer hills
  for (let x = 0; x < TILE_W; x++) {
    const t = hill(x);
    for (let y = t; y < H; y++) setPx(b, x, y, F.hill);
    setPx(b, x, t, F.hillRim);
  }

  // tree line: clusters of round crowns of mixed sizes along the meadow edge, the odd tall poplar
  const crowns: Clump[] = [];
  let x = 0;
  for (let i = 0; x < TILE_W - 6; i++) {
    const size = hash01(i * 7 + 11);
    const lift = Math.floor(hash01(i * 7 + 12) * 3);
    if (size > 0.88) {
      crowns.push([x + 2.6, field + 2 - 7.5 - lift, 2.6, 7.5]);
      x += 5;
      continue;
    }
    const r = size < 0.22 ? 5.6 : size < 0.62 ? 4.4 : 3.4;
    crowns.push([x + r, field + 2 - r - lift, r]);
    x += Math.round(r * 1.35) + (hash01(i * 7 + 14) < 0.14 ? 9 : 0);
  }
  // drawn on their own tile first so overlap slivers can be cleaned (wrapping at the seam)
  const line = blank(TILE_W, H);
  fill(line, 0, field - 1, TILE_W, 2, trees[0]);
  foliage((px, py, c) => dot(line, px, py, c), crowns, trees);
  despeckle(line, true);
  blit(b, line, 0, 0);

  // a few far houses tucked into the tree line
  const fh: Array<[Rows, number, string]> = [
    [FAR_HOUSE_GABLE, 30, 'eRrWx5'],
    [FAR_HOUSE_HIP, 96, 'cUuWx5'],
    [FAR_HOUSE_GABLE, 170, 'eRrWx5'],
    [FAR_HOUSE_HIP, 286, 'cUuWx5'],
  ];
  fh.forEach(([rows, hx, keys], i) => {
    const recolor = hazeMap(keys, 0.42);
    if (i === 2) Object.assign(recolor, { e: hz('t', 0.42), R: hz('N', 0.42), r: hz('n', 0.42) });
    stamp(b, rows, hx, field - rows.length + 1, { wrapX: true, recolor });
  });

  // the meadow in front
  for (let xx = 0; xx < TILE_W; xx++) {
    for (let y = field + 1; y < H; y++) setPx(b, xx, y, F.field);
    setPx(b, xx, field + 1, F.fieldRim);
  }
  return b;
}

// ------------------------------------------------------------------ mid layer: houses

const WINDOW: Rows = [
  'xxxxxxx',
  'xccwccx',
  'xCCwCCx',
  'xwwwwwx',
  'xccwccx',
  'xCCwCCx',
  'xCCwCCx',
  'xxxxxxx',
];

const PICTURE_WINDOW: Rows = [
  'xxxxxxxxxxxxx',
  'xcccwcccwcccx',
  'xCCCwCCCwCCCx',
  'xCCCwCCCwCCCx',
  'xCCCwCCCwCCCx',
  'xCCCwCCCwCCCx',
  'xCCCwCCCwCCCx',
  'xxxxxxxxxxxxx',
];

const ROUND_WINDOW: Rows = [
  '.xxxx.',
  'xccccx',
  'xCCCCx',
  'xCCCCx',
  '.xxxx.',
];

/** Door in the blue ramp; recolor u/U/c for other colors. */
const DOOR: Rows = [
  'xxxxxx',
  'xuuuux',
  'xuCCUx',
  'xuCCUx',
  'xuUUUx',
  'xuUUUx',
  'xuUUyx',
  'xuUUUx',
  'xuuuUx',
  'xuUUUx',
];

/** Window shutter in the blue ramp; recolor u/U for other colors. */
const SHUTTER: Rows = ['uU', 'uU', 'uU', 'uU', 'uU', 'uU', 'uU', 'uU'];

function chimney(b: PixelBuf, x: number, y: number, h: number): void {
  // brick stack with a stone cap one pixel wider on each side
  fill(b, x - 1, y, 6, 1, '5');
  fill(b, x - 1, y + 1, 6, 1, '4');
  for (let yy = y + 2; yy < y + h; yy++) {
    setPx(b, x, yy, 't');
    fill(b, x + 1, yy, 2, 1, 'N');
    setPx(b, x + 3, yy, 'n');
  }
}

/** House A: front-gable cottage, cream walls and a red roof. */
function gableHouse(): PixelBuf {
  const wallW = 32;
  const eave = 4;
  const band = 5;
  const wallH = 17;
  const bw = wallW + 2 * eave;
  const roofRows = bw / 2;
  const h = roofRows + wallH;
  const b = blank(bw, h);
  const L = bw / 2 - 1;
  const R = bw / 2;
  const wallX0 = eave;
  const wallX1 = bw - eave - 1;
  chimney(b, 27, 2, 12);
  // facade: the gable triangle and the wall below it
  for (let y = band - 1; y < h; y++) {
    const x0 = y < roofRows ? Math.max(L - y + band, wallX0) : wallX0;
    const x1 = y < roofRows ? Math.min(R + y - band, wallX1) : wallX1;
    for (let x = x0; x <= x1; x++) setPx(b, x, y, 'W');
  }
  // eave shadow under both roof bands (wider on the right, away from the light)
  for (let y = band - 1; y < roofRows + 2; y++) {
    const xl = L - y + band;
    const xr = R + y - band;
    if (xl >= wallX0 && xl <= xr) setPx(b, xl, y, 'T');
    if (xr <= wallX1 && xr >= xl) setPx(b, xr, y, 'T');
    if (xr - 1 <= wallX1 && xr - 1 > xl) setPx(b, xr - 1, y, 'T');
  }
  // roof bands: lit left slope, shaded right slope
  for (let y = 0; y < roofRows; y++) {
    for (let i = 0; i < band; i++) {
      const xl = L - y + i;
      const xr = R + y - i;
      if (xl <= L) setPx(b, xl, y, i === 0 ? 'e' : i === band - 1 ? 'r' : 'R');
      if (xr >= R) setPx(b, xr, y, i === 0 ? 'R' : 'r');
    }
  }
  stamp(b, ROUND_WINDOW, L - 2, 10);
  // wall details
  const wy = roofRows;
  stamp(b, WINDOW, wallX0 + 3, wy + 3);
  stamp(b, WINDOW, wallX1 - 9, wy + 3);
  stamp(b, DOOR, L - 2, wy + 5);
  fill(b, wallX0, h - 1, wallW, 1, '4');
  fill(b, L - 3, h - 2, 8, 1, '5');
  fill(b, L - 3, h - 1, 8, 1, '4');
  return ink(b);
}

interface HipHouse {
  wallW: number;
  wallH: number;
  eave: number;
  roofH: number;
  roof: Ramp;
  wall: Ramp;
  /** chimney x (house coords) and how far it rises above the ridge */
  chimney: readonly [number, number];
  details: (b: PixelBuf, wx: number, wy: number) => void;
}

/** A house with a hip roof seen from the front (a trapezoid with shingle courses). */
function hipHouse(s: HipHouse): PixelBuf {
  const bw = s.wallW + 2 * s.eave;
  const top = s.chimney[1];
  const h = top + s.roofH + s.wallH;
  const b = blank(bw, h);
  chimney(b, s.chimney[0], 0, top + 4);
  const [rd, rm, rl] = s.roof;
  for (let r = 0; r < s.roofH; r++) {
    const y = top + r;
    const inset = s.roofH - 1 - r;
    const x0 = inset;
    const x1 = bw - 1 - inset;
    const course = r > 0 && r < s.roofH - 1 && (s.roofH - 1 - r) % 3 === 0;
    for (let x = x0; x <= x1; x++) {
      let c = rm;
      if (course) c = rd;
      if (r === 0 || x === x0) c = rl;
      else if (x === x1) c = rd;
      if (r === s.roofH - 1) c = x === x0 ? rm : rd;
      setPx(b, x, y, c);
    }
  }
  const wy = top + s.roofH;
  fill(b, s.eave, wy, s.wallW, s.wallH, s.wall[1]);
  fill(b, s.eave, wy, s.wallW, 1, s.wall[0]);
  s.details(b, s.eave, wy);
  return ink(b);
}

/** House B: a wide yellow bungalow with a blue roof and shutters. */
function bungalow(): PixelBuf {
  return hipHouse({
    wallW: 46, wallH: 16, eave: 3, roofH: 10, roof: ['u', 'U', 'c'], wall: ['y', 'Y', 'w'], chimney: [10, 7],
    details: (b, wx, wy) => {
      stamp(b, PICTURE_WINDOW, wx + 4, wy + 4);
      stamp(b, SHUTTER, wx + 2, wy + 4);
      stamp(b, SHUTTER, wx + 17, wy + 4);
      stamp(b, DOOR, wx + 25, wy + 5, { recolor: { u: 'r', U: 'R', c: 'e' } });
      stamp(b, WINDOW, wx + 36, wy + 4);
      stamp(b, SHUTTER, wx + 34, wy + 4);
      stamp(b, SHUTTER, wx + 43, wy + 4);
      fill(b, wx, wy + 15, 46, 1, '4');
      fill(b, wx + 24, wy + 15, 8, 1, '5');
    },
  });
}

/** House C: a two-story house with a front porch, light blue walls and a brown roof. */
function twoStory(): PixelBuf {
  return hipHouse({
    wallW: 38, wallH: 28, eave: 3, roofH: 10, roof: ['n', 'N', 't'], wall: ['c', 'C', 'w'], chimney: [32, 6],
    details: (b, wx, wy) => {
      const brown = { u: 'n', U: 'N' };
      for (const x of [5, 26]) {
        stamp(b, WINDOW, wx + x, wy + 3);
        stamp(b, SHUTTER, wx + x - 2, wy + 3, { recolor: brown });
        stamp(b, SHUTTER, wx + x + 7, wy + 3, { recolor: brown });
      }
      // porch roof, overhanging the facade by 2 px on each side
      fill(b, wx - 2, wy + 13, 42, 1, 't');
      fill(b, wx - 2, wy + 14, 42, 1, 'N');
      fill(b, wx - 2, wy + 15, 42, 1, 'n');
      // porch: shaded ceiling, white posts, window and door, plank floor
      fill(b, wx, wy + 16, 38, 1, 'c');
      stamp(b, WINDOW, wx + 6, wy + 18);
      stamp(b, DOOR, wx + 25, wy + 17, { recolor: { u: 'o', U: 'O', c: 'y' } });
      for (const x of [0, 17, 36]) {
        fill(b, wx + x, wy + 16, 1, 11, 'w');
        fill(b, wx + x + 1, wy + 16, 1, 11, '5');
      }
      fill(b, wx, wy + 27, 38, 1, '4');
    },
  });
}

// ------------------------------------------------------------------ mid layer: props

interface TreeSpec {
  w: number;
  h: number;
  trunkX: number;
  trunkW: number;
  trunkTop: number;
  clumps: readonly Clump[];
}

const TREES: readonly TreeSpec[] = [
  {
    w: 32, h: 42, trunkX: 14, trunkW: 4, trunkTop: 22,
    clumps: [[15, 9, 8.6], [7.5, 15, 6.4], [24.5, 13.5, 6.6], [16, 20, 8]],
  },
  {
    w: 26, h: 34, trunkX: 11, trunkW: 4, trunkTop: 18,
    clumps: [[12.5, 8, 7], [6.5, 13.5, 5.4], [19.5, 12.5, 5.6], [13, 17, 6.4]],
  },
];

function tree(s: TreeSpec): PixelBuf {
  const b = blank(s.w, s.h);
  for (let y = s.trunkTop; y < s.h; y++) {
    const flare = y >= s.h - 2 ? 1 : 0;
    const x0 = s.trunkX - flare;
    const x1 = s.trunkX + s.trunkW - 1 + flare;
    for (let x = x0; x <= x1; x++) setPx(b, x, y, x === x0 ? 't' : x === x1 ? 'n' : 'N');
  }
  const leaf = new Set<number>();
  foliage((x, y, c) => {
    setPx(b, x, y, c);
    leaf.add(y * s.w + x);
  }, s.clumps, ['g', 'G', 'l', 'L']);
  // the canopy's shadow on the trunk: dark from the leaves down to one flat line
  let low = s.trunkTop;
  for (let x = s.trunkX; x < s.trunkX + s.trunkW; x++) {
    let y = s.trunkTop;
    while (leaf.has(y * s.w + x)) y++;
    low = Math.max(low, y);
  }
  for (let x = s.trunkX; x < s.trunkX + s.trunkW; x++) {
    for (let y = s.trunkTop; y <= low; y++) if (!leaf.has(y * s.w + x)) setPx(b, x, y, 'b');
    setPx(b, x, low + 1, 'n');
  }
  tidy(b);
  despeckle(b);
  return ink(b);
}

/** A clipped hedge: a row of leafy bumps on top of a flat front face. */
function hedge(w: number, h: number): PixelBuf {
  const b = blank(w, h);
  const bumps: Clump[] = [];
  const n = Math.max(2, Math.round((w - 4) / 5) + 1);
  for (let i = 0; i < n; i++) bumps.push([3 + (i * (w - 6)) / (n - 1), 3.6, 3.6]);
  foliage((x, y, c) => setPx(b, x, y, c), bumps, LEAVES);
  fill(b, 0, 5, w, h - 6, 'G');
  fill(b, 0, 5, 1, h - 6, 'l');
  fill(b, 0, h - 1, w, 1, 'g');
  tidy(b);
  despeckle(b);
  return ink(b);
}

function shrub(w: number): PixelBuf {
  const b = blank(w, 6);
  foliage((x, y, c) => setPx(b, x, y, c), [[2.8, 3.4, 2.8], [w - 2.8, 3.4, 2.8], [w / 2, 2.9, 3]], LEAVES);
  fill(b, 0, 5, w, 1, 'g');
  tidy(b);
  despeckle(b);
  return ink(b);
}

/** White picket fence: 3 px pickets with 1 px gaps, two rails behind. */
function picketFence(n: number): PixelBuf {
  const w = n * 4 - 1;
  const h = 11;
  const b = blank(w, h);
  for (const ry of [3, 7]) {
    fill(b, 0, ry, w, 1, '5');
    fill(b, 0, ry + 1, w, 1, '4');
  }
  for (let i = 0; i < n; i++) {
    const x = i * 4;
    setPx(b, x + 1, 0, 'w');
    for (let y = 1; y < h; y++) {
      setPx(b, x, y, 'w');
      setPx(b, x + 1, y, y === h - 1 ? '5' : 'w');
      setPx(b, x + 2, y, '5');
    }
  }
  // a shadow line along the base closes the gaps, so the ink underneath stays unbroken
  fill(b, 0, h - 1, w, 1, '4');
  for (let i = 0; i < n; i++) fill(b, i * 4, h - 1, 2, 1, '5');
  return ink(b);
}

/** Wooden plank fence with dog-eared tops, the alley backdrop. */
function plankFence(n: number): PixelBuf {
  const pw = 4;
  const h = 18;
  const w = n * (pw + 1) - 1;
  const b = blank(w, h);
  for (const ry of [4, 13]) fill(b, 0, ry, w, 2, 'n');
  fill(b, 0, h - 1, w, 1, 'n');
  for (let i = 0; i < n; i++) {
    const x = i * (pw + 1);
    const top = hash01(i + 40) < 0.3 ? 1 : 0;
    for (let y = top; y < h; y++) {
      for (let j = 0; j < pw; j++) {
        if (y === top && (j === 0 || j === pw - 1)) continue;
        setPx(b, x + j, y, j === 0 ? 'T' : j === pw - 1 ? 'N' : 't');
      }
    }
  }
  return ink(b);
}

const MAILBOX: Rows = [
  '........RR',
  '........Re',
  '.555555.R.',
  '5wwwww554R',
  '5w5555544R',
  '5555555443',
  '4444444433',
  '....Nn....',
  '....Nn....',
  '....Nn....',
  '....Nn....',
  '....Nn....',
];

const HYDRANT: Rows = [
  '...eRr...',
  '..ewRRr..',
  '..eRRRr..',
  '.eRRRRrr.',
  '..eRRrr..',
  'eeeRRrrrr',
  'RReRRrrrr',
  '..eRRrr..',
  '..eRRrr..',
  '.eRRRRrr.',
  '.rrrrrrr.',
];

const CAN: Rows = [
  '...444...',
  '.5wwww44.',
  '55wwww433',
  '.3333322.',
  '.5w55443.',
  '.5w55443.',
  '.4444433.',
  '.5w55443.',
  '.5w55443.',
  '.4444433.',
  '.5w55443.',
  '.5w55443.',
  '.4444333.',
];

const PAW: Rows = [
  '.w.w.',
  'w...w',
  '.www.',
  '.www.',
];

/** The green dumpster (the game's icon): dark lids, slanted body, recessed ribs, a paw sticker. */
function dumpster(): PixelBuf {
  const w = 30;
  const h = 20;
  const b = blank(w, h);
  // two dark plastic lids: lit back edge, top, front lip overhanging the body
  fill(b, 3, 0, 24, 1, '3');
  fill(b, 2, 1, 26, 1, '2');
  fill(b, 1, 2, 28, 1, '2');
  fill(b, 1, 3, 28, 1, '1');
  for (let y = 0; y < 3; y++) setPx(b, 15, y, '1');
  fill(b, 4, 1, 3, 1, '3');
  fill(b, 17, 1, 3, 1, '3');
  // body: a trapezoid that narrows toward the bottom
  for (let y = 4; y <= 16; y++) {
    const inset = Math.floor((y - 4) / 5);
    const x0 = 2 + inset;
    const x1 = 27 - inset;
    for (let x = x0; x <= x1; x++) {
      let c = 'G';
      if (x === x0) c = 'l';
      else if (x >= x1 - 1) c = 'g';
      if (y === 4) c = x >= x1 - 1 ? 'G' : 'l';
      if (y === 5) c = 'g';
      if (y === 16) c = 'g';
      setPx(b, x, y, c);
    }
  }
  // recessed ribs: shaded left wall, lit right wall
  for (const rx of [6, 21]) {
    for (let y = 7; y <= 14; y++) {
      setPx(b, rx, y, 'g');
      setPx(b, rx + 1, y, 'g');
      setPx(b, rx + 2, y, 'l');
    }
  }
  setPx(b, 3, 6, 'L');
  setPx(b, 3, 7, 'L');
  stamp(b, PAW, 12, 8);
  // deep shadow under the body, then the casters
  fill(b, 5, 17, 20, 2, 'x');
  for (const cx of [4, 22]) {
    fill(b, cx, 17, 4, 1, '1');
    fill(b, cx + 1, 18, 2, 1, '3');
    setPx(b, cx, 18, '1');
    setPx(b, cx + 3, 18, '1');
    fill(b, cx + 1, 19, 2, 1, '1');
  }
  return ink(b);
}

/** A grass shadow on the lawn under an object, pushed to the right (light from the top left). */
function lawnShadow(b: PixelBuf, x: number, w: number): void {
  for (let i = 0; i < w; i++) dot(b, x + 2 + i, GROUND + 1, 'G');
  for (let i = 1; i < w - 2; i++) dot(b, x + 3 + i, GROUND + 2, 'G');
}

export function midLayer(): PixelBuf {
  const H = LAYERS.mid.h;
  const b = blank(TILE_W, H);
  fill(b, 0, GROUND, TILE_W, H - GROUND, 'l');

  const a = gableHouse();
  const bung = bungalow();
  const two = twoStory();
  const big = tree(TREES[0]);
  const small = tree(TREES[1]);
  const plank = plankFence(13);
  const dump = dumpster();
  const can = ink(fromRows(CAN));
  const mail = ink(fromRows(MAILBOX));
  const hydrant = ink(fromRows(HYDRANT));

  // shadows first so everything stands on them
  lawnShadow(b, 20, a.w);
  lawnShadow(b, 64, 30);
  lawnShadow(b, 114, bung.w);
  lawnShadow(b, 186, plank.w);
  lawnShadow(b, 247, two.w);

  // back row
  plant(b, big, 62);
  plant(b, small, 322);
  plant(b, plank, 184);
  // houses
  plant(b, a, 20);
  plant(b, bung, 114);
  plant(b, two, 247);
  // front props
  plant(b, picketFence(12), 62);
  plant(b, mail, 104);
  plant(b, hedge(20, 10), 166);
  plant(b, dump, 189);
  plant(b, can, 225);
  plant(b, can, 236, GROUND, true);
  plant(b, picketFence(10), 299);
  plant(b, hydrant, 313);
  plant(b, shrub(9), 22);
  plant(b, shrub(9), 47);
  plant(b, hedge(14, 8), 2);
  return b;
}

// ------------------------------------------------------------------ ground layer

const CRACKS: readonly Rows[] = [
  ['44.....', '.444...', '...4444', '.....4.'],
  ['...44', '.444.', '44...'],
];

const PEBBLES: readonly Rows[] = [
  ['.44', '433'],
  ['44.', '433'],
];

export function groundLayer(): PixelBuf {
  const H = LAYERS.ground.h;
  const b = blank(TILE_W, H);
  const walk0 = 7;
  const walk1 = 31;
  // lawn edge, curb (lit top, face, shadow line), sidewalk, its front edge, the verge
  fill(b, 0, 0, TILE_W, 2, 'l');
  fill(b, 0, 2, TILE_W, 1, 'G');
  fill(b, 0, 3, TILE_W, 1, 'w');
  fill(b, 0, 4, TILE_W, 1, '5');
  fill(b, 0, 5, TILE_W, 1, '4');
  fill(b, 0, 6, TILE_W, 1, '3');
  fill(b, 0, walk0, TILE_W, walk1 - walk0, '5');
  fill(b, 0, walk1, TILE_W, 1, '4');
  fill(b, 0, walk1 + 1, TILE_W, 1, '3');
  fill(b, 0, walk1 + 2, TILE_W, 1, 'G');
  fill(b, 0, walk1 + 3, TILE_W, H - walk1 - 3, 'l');
  // slab joints: slanted grooves with a lit lip
  for (let x0 = 12; x0 < TILE_W; x0 += 38) {
    for (let y = walk0; y < walk1; y++) {
      const x = x0 - Math.floor((y - walk0) / 4);
      dot(b, x, y, '4');
      dot(b, x + 1, y, 'w');
    }
  }
  // a couple of hairline cracks and a few pebbles
  stamp(b, CRACKS[0], 80, walk0 + 9, { wrapX: true });
  stamp(b, CRACKS[1], 240, walk0 + 15, { wrapX: true });
  for (let i = 0; i < 7; i++) {
    const px = Math.floor(((i + 0.3 + hash01(i + 300) * 0.5) / 7) * TILE_W);
    const py = walk0 + 4 + Math.floor(hash01(i + 400) * (walk1 - walk0 - 8));
    stamp(b, PEBBLES[i % 2], px, py, { wrapX: true });
  }
  return b;
}

// ------------------------------------------------------------------ foreground

/**
 * A solid grass clump whose top is a zigzag of blade tips, given as [x, tip row]. Each blade's
 * left flank catches the light; the clump darkens toward its roots on the bottom row.
 */
function tuft(w: number, h: number, tips: ReadonlyArray<readonly [number, number]>): PixelBuf {
  const b = blank(w, h);
  for (let x = 0; x < w; x++) {
    let top = h;
    let tip = tips[0];
    for (const t of tips) {
      const y = t[1] + Math.abs(x - t[0]) * 2;
      if (y < top) {
        top = y;
        tip = t;
      }
    }
    for (let y = top; y < h; y++) {
      let c = 'G';
      if (y === top && x === tip[0]) c = 'L';
      else if (x <= tip[0] && y < top + 3) c = 'l';
      if (y === h - 1) c = 'g';
      setPx(b, x, y, c);
    }
  }
  return ink(b);
}

/** A little flower: white petals, gold heart (recolor w / y for other kinds). */
const FLOWER: Rows = [
  '.w.',
  'wyw',
  '.w.',
  '.G.',
  '.Gl',
  '.G.',
];

export function fgLayer(): PixelBuf {
  const H = LAYERS.fg.h;
  const b = blank(TILE_W, H);
  const tufts = [
    tuft(11, 7, [[2, 2], [5, 0], [8, 1]]),
    tuft(8, 6, [[2, 1], [5, 0]]),
    tuft(14, 8, [[2, 3], [5, 0], [8, 1], [11, 3]]),
  ];
  const flowers = [
    ink(fromRows(FLOWER)),
    ink(fromRows(FLOWER, { w: 'P', y: 'y' })),
    ink(fromRows(FLOWER, { w: 'y', y: 'O' })),
  ];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const x = Math.floor(((i + hash01(i + 700) * 0.5) / n) * TILE_W);
    const t = tufts[i % tufts.length];
    put(b, t, x, H - t.h + 1, hash01(i + 800) < 0.5);
    if (i % 3 !== 1) {
      const f = flowers[i % flowers.length];
      put(b, f, x + t.w - 1, H - f.h + 2);
    }
  }
  return b;
}

// ------------------------------------------------------------------ clouds

export const CLOUDS: Rows[] = [
  [
    '..........wwww..........',
    '........wwwwwwww........',
    '..wwww.wwwwwwwwww.......',
    '.wwwwwwwwwwwwwwwwCwwww..',
    'wwwwwwwCwwwwwwwwCCwwwwC.',
    'wwwwwwCCwwwwwwwwwwwwwwwC',
    'wwwwwwwwwwwwwwwwwwwwwwwC',
    'CwwwwwwwwwwwwwwwwwwwwwCC',
    'CCCwwwwwwwwwwwwwwwwCCCCC',
    '.CCCCCCCCCCCCCCCCCCCCCC.',
  ],
  [
    '.............wwwww..............',
    '...........wwwwwwwww............',
    '..........wwwwwwwwwww...........',
    '.....wwww.wwwwwwwwwwwCwwwww.....',
    '...wwwwwwwwwwwwwwwwwCCwwwwwww...',
    '..wwwwwwwwCwwwwwwwwwwwwwwwwwwwC.',
    '.wwwwwwwwCCwwwwwwwwwwwwwwwwwwwwC',
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwC',
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwCC',
    'CwwwwwwwwwwwwwwwwwwwwwwwwwwwwCCC',
    'CCCCwwwwwwwwwwwwwwwwwwwwwCCCCCCC',
    '.CCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.',
  ],
  [
    '...............wwwwww...................',
    '.............wwwwwwwwww.................',
    '............wwwwwwwwwwww................',
    '......wwwww.wwwwwwwwwwwwCwwwwwww........',
    '....wwwwwwwwwwwwwwwwwwwCCwwwwwwwww......',
    '...wwwwwwwwCwwwwwwwwwwwwwwwwwwwwwwCwww..',
    '..wwwwwwwwCCwwwwwwwwwwwwwwwwwwwwwCCwwwC.',
    '.wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwC',
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwC',
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwCC',
    'CwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwCCC',
    'CCCCwwwwwwwwwwwwwwwwwwwwwwwwwwwwwCCCCCCC',
    '.CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.',
  ],
];

// ------------------------------------------------------------------ preview sheet

const SKY_TOP = '#2FB8F0';
const SKY_LOW = '#C8F0FF';

function skyBands(w: number, h: number): PixelBuf {
  const b = blank(w, h);
  const bands: ReadonlyArray<readonly [number, number]> = [[0, 0], [20, 0.2], [36, 0.4], [50, 0.6], [62, 0.8], [72, 1]];
  bands.forEach(([y0, t], i) => {
    const y1 = i + 1 < bands.length ? bands[i + 1][0] : h;
    fill(b, 0, y0, w, y1 - y0, mix(SKY_TOP, SKY_LOW, t));
  });
  return b;
}

export function sheet(): SheetEntry[] {
  const authored: Array<[string, Rows]> = [
    ['far_house_gable', FAR_HOUSE_GABLE], ['far_house_hip', FAR_HOUSE_HIP], ['water_tower', WATER_TOWER],
    ['window', WINDOW], ['picture_window', PICTURE_WINDOW], ['round_window', ROUND_WINDOW], ['door', DOOR],
    ['shutter', SHUTTER], ['mailbox', MAILBOX], ['hydrant', HYDRANT], ['can', CAN], ['paw', PAW],
    ['flower', FLOWER],
    ...CRACKS.map((r, i): [string, Rows] => [`crack${i}`, r]),
    ...PEBBLES.map((r, i): [string, Rows] => [`pebble${i}`, r]),
    ...CLOUDS.map((r, i): [string, Rows] => [`cloud${i}`, r]),
  ];
  for (const [name, r] of authored) checkRows(name, r);

  const far = farLayer();
  const mid = midLayer();
  const ground = groundLayer();
  const fg = fgLayer();
  const comp = skyBands(TILE_W, 137);
  const cloudAt: ReadonlyArray<readonly [number, number]> = [[24, 10], [128, 17], [244, 5]];
  CLOUDS.forEach((c, i) => stamp(comp, c, cloudAt[i][0], cloudAt[i][1]));
  blit(comp, far, 0, LAYERS.far.y);
  blit(comp, mid, 0, LAYERS.mid.y);
  blit(comp, ground, 0, LAYERS.ground.y);
  blit(comp, fg, 0, LAYERS.fg.y);
  return [
    { name: 'composite', buf: comp },
    { name: 'far', buf: far },
    { name: 'mid', buf: mid },
    { name: 'ground', buf: ground },
    { name: 'fg', buf: fg },
    ...CLOUDS.map((c, i) => ({ name: `cloud${i}`, buf: fromRows(c) })),
  ];
}
