/**
 * World 1 battle scenery, "Sunny Suburbs", as pixel art (style rules: docs/PIXEL_ART.md). It is drawn
 * at the battle's pixel size (12 screen px per art pixel), the same size as the raccoon's pixels.
 *
 * Four horizontally tiling parallax layers, each TILE_W art pixels wide; SUBURBS bundles them as a
 * ScenerySet, with the windows and lamps that light up at dusk and night (each world's sky, clouds and
 * lighting are painted by atmosphere.ts). Rows below are rows of the 90 x 68 battle view (sceneryTypes.ts):
 *  - far (17 to 46): hazy rolling hills, a distant tree line, a few far roofs and a water tower.
 *    Colors are pushed toward the sky (aerial perspective) and nothing is inked, so it reads as distance.
 *  - mid (18 to 49): the street. Three houses, two trees, picket and plank fences, hedges, a mailbox,
 *    a fire hydrant, two metal cans and the green dumpster, all inked in `k`, standing on the lawn
 *    that starts at row 46.
 *  - ground (30 to 67): two street lamps behind the curb (rows 30 to 47 hold only them), then the lawn
 *    edge, curb, the sidewalk the fighters stand on (their feet on row 58, FEET_ROW, mid-slab) and a
 *    strip of verge.
 *  - fg (58 to 67): a few grass tufts and flowers along the bottom, in front of the fighters.
 * At this size the houses, trees and props are authored pixel by pixel as rows; hills, the far tree
 * line, fences and the sidewalk are drawn in code. Every layer wraps seamlessly: sprites go down through
 * wrapX and contours are periodic. Light comes from the top left. Other worlds grade these colors later,
 * so they stay natural.
 */
import {
  blank, blit, checkRows, clone, fill, fromRows, hash01, mix, outline, setPx, stamp,
  type PixelBuf, type Rows, type SheetEntry,
} from './buf';
import { PAL } from './palette';
import type { LightSpot, ScenerySet } from './sceneryTypes';

export const TILE_W = 171;

/** Rows of the ground layer above the lawn edge: room for the street lamps standing behind the curb. */
const LIFT = 18;

/** Where each layer's top edge sits in the 90 x 68 battle view, and its height. */
export const LAYERS = {
  far: { y: 17, h: 30 },
  mid: { y: 18, h: 32 },
  ground: { y: 48 - LIFT, h: 20 + LIFT },
  fg: { y: 58, h: 10 },
} as const;

/** center x, center y, radius (x), and an optional y radius for tall crowns */
type Clump = readonly [number, number, number, number?];

const TAU = Math.PI * 2;
/** Mid-layer row where the lawn starts (view row 46); every street object's base line sits on it. */
const GROUND = 28;

// ------------------------------------------------------------------ helpers

const wrap = (x: number): number => ((x % TILE_W) + TILE_W) % TILE_W;

/** setPx on a tiling layer: x wraps across the seam. */
function dot(b: PixelBuf, x: number, y: number, c: string): void {
  setPx(b, wrap(x), y, c);
}

/**
 * A contour that repeats exactly every TILE_W (base + sines with whole cycles per tile), as one row
 * per column. Steps one pixel wide are evened out, so rims never get lone spikes or notches.
 */
function contour(base: number, terms: ReadonlyArray<readonly [number, number, number]>): number[] {
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
function put(layer: PixelBuf, s: PixelBuf, x: number, y: number, flip = false): void {
  blit(layer, s, x, y, { wrapX: true, flipX: flip });
}

/** Pastes a sprite so its bottom row lands on row `base`. */
function plant(layer: PixelBuf, s: PixelBuf, x: number, base = GROUND, flip = false): void {
  put(layer, s, x, base - s.h + 1, flip);
}

const ink = (b: PixelBuf): PixelBuf => outline(b, PAL.k);
const inked = (rows: Rows, recolor?: Partial<Record<string, string>>): PixelBuf => ink(fromRows(rows, recolor));

/**
 * Round leafy clumps (the far tree line), drawn back to front. Each clump gets a shaded crescent on
 * its bottom right and a lit cap on its top left, so overlapping clumps read as separate crowns.
 */
function foliage(plot: (x: number, y: number, c: string) => void, clumps: readonly Clump[], tones: readonly [string, string, string]): void {
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

function rgbAt(b: PixelBuf, x: number, y: number): number {
  x = ((x % b.w) + b.w) % b.w;
  if (y < 0 || y >= b.h) return -1;
  const i = (y * b.w + x) * 4;
  return b.px[i + 3] ? (b.px[i] << 16) | (b.px[i + 1] << 8) | b.px[i + 2] : -1;
}

/**
 * Recolors pixels that match none of their 4 neighbours (stray pixels) to their most common
 * neighbour. The buffer is treated as a horizontal tile (x wraps).
 */
function despeckle(b: PixelBuf): void {
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
  '..eR..',
  '.eeRr.',
  'eeeRrr',
  '.WxW5.',
  '.WWW5.',
];

const FAR_HOUSE_HIP: Rows = [
  '.ccUUu.',
  'cUUUUUu',
  '.WxWx5.',
  '.WWWW5.',
];

const WATER_TOWER: Rows = [
  '..55..',
  '.55554',
  '5w5544',
  '5w5544',
  '444333',
  '.2..2.',
  '.2222.',
  '.2..2.',
  '2....2',
];

/** Far-layer row of the meadow's edge: the tree line and far houses stand on it. */
const FIELD = 22;

/** The far houses: [rows, x, keys hazed when stamped]. Their 'x' pixels are windows (lit at night). */
const FAR_HOUSES: ReadonlyArray<readonly [Rows, number, string]> = [
  [FAR_HOUSE_GABLE, 15, 'eRrWx5'],
  [FAR_HOUSE_HIP, 48, 'cUuWx5'],
  [FAR_HOUSE_GABLE, 85, 'eRrWx5'],
  [FAR_HOUSE_HIP, 143, 'cUuWx5'],
];

/** The far houses' one-pixel windows. */
function farLights(): LightSpot[] {
  const out: LightSpot[] = [];
  for (const [rows, hx] of FAR_HOUSES) {
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        if (row[rx] === 'x') out.push({ x: wrap(hx + rx), y: FIELD - rows.length + 1 + ry, w: 1, h: 1, kind: 'window' });
      }
    });
  }
  return out;
}

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
    tree: hz('G', 0.44),
    treeRim: hz('l', 0.42),
    treeDark: hz('g', 0.52),
  };
  const back = contour(8, [[2.3, 2, 0.8], [1.3, 3, 2.6]]);
  const hill = contour(14, [[1.3, 3, 1.9], [0.8, 5, 4.4]]);
  const field = FIELD;

  // back hills with a lit rim
  for (let x = 0; x < TILE_W; x++) {
    for (let y = back[x]; y < H; y++) setPx(b, x, y, F.back);
    setPx(b, x, back[x], F.backRim);
  }
  // a water tower on the back hills
  stamp(b, WATER_TOWER, 117, back[119] - 6, { wrapX: true, recolor: hazeMap('w5432', 0.5) });

  // nearer hills
  for (let x = 0; x < TILE_W; x++) {
    for (let y = hill[x]; y < H; y++) setPx(b, x, y, F.hill);
    setPx(b, x, hill[x], F.hillRim);
  }

  // tree line: clusters of round crowns of mixed sizes along the meadow edge, the odd tall poplar
  const crowns: Clump[] = [];
  let x = 0;
  for (let i = 0; x < TILE_W - 3; i++) {
    const size = hash01(i * 7 + 11);
    const lift = Math.floor(hash01(i * 7 + 12) * 2);
    if (size > 0.88) {
      crowns.push([x + 1.6, field - 3.6 - lift, 1.6, 4.2]);
      x += 3;
      continue;
    }
    const r = size < 0.22 ? 3.6 : size < 0.62 ? 3 : 2.4;
    crowns.push([x + r, field + 1 - r - lift, r]);
    x += Math.round(r * 1.3) + (hash01(i * 7 + 14) < 0.14 ? 5 : 0);
  }
  // drawn on their own tile first so overlap slivers can be cleaned (wrapping at the seam)
  const line = blank(TILE_W, H);
  fill(line, 0, field - 1, TILE_W, 2, F.treeDark);
  foliage((px, py, c) => dot(line, px, py, c), crowns, [F.treeDark, F.tree, F.treeRim]);
  despeckle(line);
  blit(b, line, 0, 0);

  // a few far houses tucked into the tree line
  FAR_HOUSES.forEach(([rows, hx, keys], i) => {
    const recolor = hazeMap(keys, 0.42);
    if (i === 2) Object.assign(recolor, { e: hz('t', 0.42), R: hz('N', 0.42), r: hz('n', 0.42) });
    stamp(b, rows, hx, FIELD - rows.length + 1, { wrapX: true, recolor });
  });

  // the meadow in front
  for (let xx = 0; xx < TILE_W; xx++) {
    for (let y = field + 1; y < H; y++) setPx(b, xx, y, F.field);
    setPx(b, xx, field + 1, F.fieldRim);
  }
  return b;
}

// ------------------------------------------------------------------ mid layer: houses

/** House A: a front-gable cottage, cream walls, red roof (its eave shadow in tan), a round attic window. */
const GABLE_HOUSE: Rows = [
  '..........eR..........',
  '.........eRrR.5555....',
  '........eRrrrR.Nn.....',
  '.......eRrWTrrRNn.....',
  '......eRrWWWTrrRn.....',
  '.....eRrWWxxWTrrR.....',
  '....eRrWWxccxWTrrR....',
  '...eRrWWWxCCxWWTrrR...',
  '..eRrWWWWWxxWWWWTrrR..',
  '.eRrWWWWWWWWWWWWWTrrR.',
  'eRrTWWWWWWWWWWWWWWTrrR',
  '..TTWWWWWWWWWWWWWWTT..',
  '..WxxxxxWWWWWWxxxxxW..',
  '..WxcwcxWxxxxWxcwcxW..',
  '..WxwwwxWxuuxWxwwwxW..',
  '..WxCwCxWxUUxWxCwCxW..',
  '..WxxxxxWxUyxWxxxxxW..',
  '..WWWWWWWxUUxWWWWWWW..',
  '..WWWWWWWxUUxWWWWWWW..',
  '..444444555555444444..',
];

/** House B: a wide yellow bungalow, blue hip roof, a picture window and blue shutters, a red door. */
const BUNGALOW: Rows = [
  '....5555..................',
  '.....Nn...................',
  '.....Nn...................',
  '....cccccccccccccccccc....',
  '...cUUUUUUUUUUUUUUUUUUu...',
  '..cUUUUUUUUUUUUUUUUUUUUu..',
  '.cUUUUUUUUUUUUUUUUUUUUUUu.',
  'Uuuuuuuuuuuuuuuuuuuuuuuuuu',
  '.yyyyyyyyyyyyyyyyyyyyyyyy.',
  '.YUxxxxxxxUYxxxxYUxxxxxUY.',
  '.YUxccwccxUYxrrxYUxcwcxUY.',
  '.YUxCCwCCxUYxRRxYUxwwwxUY.',
  '.YUxCCwCCxUYxRyxYUxCwCxUY.',
  '.YUxxxxxxxUYxRRxYUxxxxxUY.',
  '.YYYYYYYYYYYxRRxYYYYYYYYY.',
  '.444444444455555544444444.',
];

/** House C: two stories and a front porch, light blue walls, brown roof and shutters, orange door. */
const TWO_STORY: Rows = [
  '...............5555....',
  '................Nn.....',
  '................Nn.....',
  '....ttttttttttttttt....',
  '...tNNNNNNNNNNNNNNNn...',
  '..tNNNNNNNNNNNNNNNNNn..',
  '.tNNNNNNNNNNNNNNNNNNNn.',
  'Nnnnnnnnnnnnnnnnnnnnnnn',
  '..ccccccccccccccccccc..',
  '..CNxxxxxNCCCNxxxxxNC..',
  '..CNxcwcxNCCCNxcwcxNC..',
  '..CNxwwwxNCCCNxwwwxNC..',
  '..CNxCwCxNCCCNxCwCxNC..',
  '..CNxxxxxNCCCNxxxxxNC..',
  '..CCCCCCCCCCCCCCCCCCC..',
  '.ttttttttttttttttttttt.',
  '.nnnnnnnnnnnnnnnnnnnnn.',
  '..wcxxxxxccwccxxxxccw..',
  '..wCxcwcxCCwCCxooxCCw..',
  '..wCxwwwxCCwCCxOOxCCw..',
  '..wCxCwCxCCwCCxOyxCCw..',
  '..wCxxxxxCCwCCxOOxCCw..',
  '..4444444444444444444..',
];

// ------------------------------------------------------------------ mid layer: plants

/** The big street tree: four bunches of leaves, each lit on its top left, on a short trunk. */
const BIG_TREE: Rows = [
  '.....llll.......',
  '....lLLlllG.....',
  '...llLllGGGg....',
  '...lllGGGGGgl...',
  '..llGGGGGgllll..',
  '.lllllGGgllGGGg.',
  '.llGGGgllllGGGgg',
  '.lGGGglllllGGggg',
  '.lGGgllGGGGgggg.',
  '.ggglGGGGGgggg..',
  '..gglGGGGGgg....',
  '....gGGGgggg....',
  '.....gggggg.....',
  '......gbbg......',
  '.......Nn.......',
  '.......Nn.......',
  '.......Nn.......',
  '.......Nn.......',
  '.......Nn.......',
  '.......Nn.......',
  '......tNNn......',
];

const SMALL_TREE: Rows = [
  '....lll......',
  '...lLLlG.....',
  '..llLllGg....',
  '..llGGGGgll..',
  '.lllGGGllllg.',
  '.llGGllllGGgg',
  '.lGGlllllGGgg',
  '.GGllGGGGggg.',
  '.ggllGGGgggg.',
  '...lGGGggg...',
  '....gbbgg....',
  '.....Nn......',
  '.....Nn......',
  '.....Nn......',
  '.....Nn......',
  '.....Nn......',
  '....tNNn.....',
];

/** Clipped hedges: a row of leafy bumps on top of a flat front face. */
const HEDGE: Rows = [
  '.ll.ll.ll.',
  'lLllLllLlG',
  'lGGGGGGGGG',
  'lGGGGGGGGG',
  'gggggggggg',
];

const HEDGE_SMALL: Rows = [
  '.ll.ll.',
  'lLllLlG',
  'lGGGGGG',
  'ggggggg',
];

const SHRUB: Rows = [
  '.lll.',
  'lLlGG',
  'GGGGg',
];

// ------------------------------------------------------------------ mid layer: props

/** White picket fence: 3 px pointed pickets with 1 px gaps, a rail behind and a shadow line along the base. */
function picketFence(n: number): PixelBuf {
  const w = n * 4 - 1;
  const h = 6;
  const b = blank(w, h);
  fill(b, 0, 2, w, 1, '4');
  fill(b, 0, h - 1, w, 1, '4');
  for (let i = 0; i < n; i++) {
    const x = i * 4;
    setPx(b, x + 1, 0, 'w');
    for (let y = 1; y < h; y++) {
      setPx(b, x, y, 'w');
      setPx(b, x + 1, y, 'w');
      setPx(b, x + 2, y, '5');
    }
  }
  return ink(b);
}

/** Wooden plank fence with dog-eared tops, the alley backdrop. */
function plankFence(n: number): PixelBuf {
  const pw = 3;
  const h = 9;
  const w = n * (pw + 1) - 1;
  const b = blank(w, h);
  for (const ry of [2, 6]) fill(b, 0, ry, w, 1, 'n');
  fill(b, 0, h - 1, w, 1, 'n');
  for (let i = 0; i < n; i++) {
    const x = i * (pw + 1);
    const top = hash01(i + 40) < 0.3 ? 1 : 0;
    for (let y = top; y < h; y++) {
      for (let j = 0; j < pw; j++) {
        if (y === top && j !== 1) continue;
        setPx(b, x + j, y, j === 0 ? 'T' : j === pw - 1 ? 'N' : 't');
      }
    }
  }
  return ink(b);
}

const MAILBOX: Rows = [
  '....RR',
  '.555.R',
  '5w554R',
  '44443.',
  '..N...',
  '..N...',
  '..N...',
];

const HYDRANT: Rows = [
  '..eR..',
  '.ewRr.',
  '.eRRr.',
  'eRRRrr',
  '.eRRr.',
  '.eRRr.',
  '.rrrr.',
];

const CAN: Rows = [
  '..44..',
  '5wwww4',
  '.3332.',
  '.5w43.',
  '.4443.',
  '.5w43.',
  '.4433.',
];

/** The green dumpster (the game's icon): two dark lids, a slanted body, a paw sticker, casters. */
const DUMPSTER: Rows = [
  '.3333331333333.',
  '233222212332222',
  '111111111111111',
  '.ggggggggggggg.',
  '.lGgGGwGwGGgGg.',
  '.lGgGwGGGwGgGg.',
  '.lGgGGwwwGGgGg.',
  '..lgGGwwwGGgg..',
  '..ggggggggggg..',
  '..1xxxxxxxxx1..',
  '..1.........1..',
];

/** A grass shadow on the lawn under an object, pushed to the right (light from the top left). */
function lawnShadow(b: PixelBuf, x: number, w: number): void {
  for (let i = 0; i < w; i++) dot(b, x + 1 + i, GROUND + 1, 'G');
}

/** The street's houses and where they stand (left edge before inking). */
const HOUSES: ReadonlyArray<readonly [Rows, number]> = [
  [GABLE_HOUSE, 9],
  [BUNGALOW, 60],
  [TWO_STORY, 128],
];

/**
 * Windows in house art: groups of glass ('c', 'C') and muntin ('w') pixels closed in by frame ('x')
 * on every side. Returns their rects in the art's own pixels, with a mask ('g' glass, 'f' muntin).
 */
export function windowsOf(rows: Rows): Array<{ x: number; y: number; w: number; h: number; mask: string[] }> {
  const H = rows.length;
  const W = rows[0].length;
  const pane = (x: number, y: number) => y >= 0 && y < H && x >= 0 && x < W && 'cCw'.includes(rows[y][x]);
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
      if (!closed) continue;
      const x0 = Math.min(...cells.map((c) => c[0]));
      const y0 = Math.min(...cells.map((c) => c[1]));
      const x1 = Math.max(...cells.map((c) => c[0]));
      const y1 = Math.max(...cells.map((c) => c[1]));
      const inside = new Set(cells.map(([cx, cy]) => cy * W + cx));
      const mask: string[] = [];
      for (let yy = y0; yy <= y1; yy++) {
        let m = '';
        for (let xx = x0; xx <= x1; xx++) m += !inside.has(yy * W + xx) ? '.' : rows[yy][xx] === 'w' ? 'f' : 'g';
        mask.push(m);
      }
      out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, mask });
    }
  }
  return out;
}

/** The houses' windows in mid-layer pixels (houses are inked, so the art sits 1 px in from the left). */
function midLights(): LightSpot[] {
  return HOUSES.flatMap(([rows, hx]) =>
    windowsOf(rows).map((w): LightSpot => ({ ...w, x: wrap(hx + 1 + w.x), y: GROUND - rows.length + w.y, kind: 'window' })),
  );
}

export function midLayer(): PixelBuf {
  const H = LAYERS.mid.h;
  const b = blank(TILE_W, H);
  fill(b, 0, GROUND, TILE_W, H - GROUND, 'l');

  const [gable, bung, two] = HOUSES.map(([rows]) => inked(rows));
  const plank = plankFence(8);
  const pickets = picketFence(6);
  const can = inked(CAN);
  const shrub = inked(SHRUB);

  // shadows first so everything stands on them
  lawnShadow(b, 9, gable.w);
  lawnShadow(b, 33, pickets.w);
  lawnShadow(b, 60, bung.w);
  lawnShadow(b, 96, plank.w);
  lawnShadow(b, 128, two.w);

  // back row
  plant(b, inked(BIG_TREE), 33);
  plant(b, inked(SMALL_TREE), 163);
  plant(b, plank, 96);
  // houses
  plant(b, gable, HOUSES[0][1]);
  plant(b, bung, HOUSES[1][1]);
  plant(b, two, HOUSES[2][1]);
  // front props
  plant(b, pickets, 33);
  plant(b, inked(MAILBOX), 51);
  plant(b, inked(HEDGE), 87);
  plant(b, inked(DUMPSTER), 98);
  plant(b, can, 115);
  plant(b, can, 121, GROUND, true);
  plant(b, picketFence(4), 154);
  plant(b, inked(HYDRANT), 158);
  plant(b, shrub, 10);
  plant(b, shrub, 25);
  plant(b, inked(HEDGE_SMALL), 0);
  return b;
}

// ------------------------------------------------------------------ ground layer

const CRACKS: readonly Rows[] = [
  ['44..', '.444'],
  ['.44', '44.'],
];

const PEBBLE: Rows = ['43'];

/**
 * Ground-layer rows of the sidewalk (WALK0 to WALK1 - 1, view rows 53 to 63). The fighters stand on
 * row 10 (view row 58, FEET_ROW), with five rows of slab above their feet and five below.
 */
const WALK0 = 5;
const WALK1 = 16;
/** Width of one sidewalk slab; TILE_W is a whole number of slabs. */
const SLAB_W = 19;

/** A street lamp: a lantern (its glass lit at dusk and night) on a post, standing behind the curb. */
const LAMP: Rows = [
  '..1..',
  '.121.',
  '12221',
  '.CwC.',
  '.CCC.',
  '.CCC.',
  '.121.',
  '..2..',
  '..2..',
  '..2..',
  '..2..',
  '..2..',
  '..2..',
  '..2..',
  '..2..',
  '.121.',
  '12221',
];

/** Lamp positions (left edge before inking), two per tile. */
const LAMPS = [38, 124] as const;

/** Lamp glass and the pool of light each throws on the sidewalk, in ground-layer pixels. */
function groundLights(): LightSpot[] {
  const top = LIFT + 2 - (LAMP.length + 2);
  return LAMPS.map((lx): LightSpot => ({
    x: wrap(lx + 2),
    y: top + 4,
    w: 3,
    h: 3,
    kind: 'lamp',
    pool: { x: lx + 3.5, y: LIFT + WALK0 + 3.5, rx: 11, ry: 3.2 },
  }));
}

export function groundLayer(): PixelBuf {
  const b = blank(TILE_W, LAYERS.ground.h);
  blit(b, street(), 0, LIFT);
  const lamp = inked(LAMP);
  // lamps stand on the lawn strip behind the curb (street row 1)
  for (const lx of LAMPS) plant(b, lamp, lx, LIFT + 1);
  return b;
}

/** The lawn edge, curb, sidewalk and verge (20 rows; the ground layer's bottom part). */
function street(): PixelBuf {
  const H = 20;
  const b = blank(TILE_W, H);
  // lawn edge, curb (lit top, face, shadow line), sidewalk, its front edge, the verge
  fill(b, 0, 0, TILE_W, 1, 'l');
  fill(b, 0, 1, TILE_W, 1, 'G');
  fill(b, 0, 2, TILE_W, 1, 'w');
  fill(b, 0, 3, TILE_W, 1, '4');
  fill(b, 0, 4, TILE_W, 1, '3');
  fill(b, 0, WALK0, TILE_W, WALK1 - WALK0, '5');
  fill(b, 0, WALK1, TILE_W, 1, '4');
  fill(b, 0, WALK1 + 1, TILE_W, 1, '3');
  fill(b, 0, WALK1 + 2, TILE_W, 1, 'G');
  fill(b, 0, WALK1 + 3, TILE_W, H - WALK1 - 3, 'l');
  // slab joints: slanted grooves with a lit lip, one every SLAB_W (9 slabs per tile)
  for (let x0 = 6; x0 < TILE_W; x0 += SLAB_W) {
    for (let y = WALK0; y < WALK1; y++) {
      const x = x0 - Math.floor((y - WALK0) / 4);
      dot(b, x, y, '4');
      dot(b, x + 1, y, 'w');
    }
  }
  // a couple of hairline cracks, and pebbles on most other slabs, all clear of the joints
  stamp(b, CRACKS[0], 31, WALK0 + 4, { wrapX: true });
  stamp(b, CRACKS[1], 128, WALK0 + 6, { wrapX: true });
  for (let k = 0; k < TILE_W / SLAB_W; k++) {
    if (k === 1 || k === 6 || hash01(k + 300) < 0.25) continue;
    const px = 6 + k * SLAB_W + 4 + Math.floor(hash01(k + 350) * 9);
    const py = WALK0 + 1 + Math.floor(hash01(k + 400) * (WALK1 - WALK0 - 3));
    stamp(b, PEBBLE, px, py, { wrapX: true });
  }
  return b;
}

// ------------------------------------------------------------------ foreground

/** Grass clumps: blade tips lit on their left flank, darkening toward the roots on the bottom row. */
const TUFTS: readonly Rows[] = [
  [
    '...L..',
    '.L.l.L',
    '.lllGl',
    'gggggg',
  ],
  [
    '..L.',
    'L.lG',
    'llGG',
    'gggg',
  ],
  [
    '...L...',
    '.L.lG.L',
    '.llGGll',
    'lGGGGGG',
    'ggggggg',
  ],
];

/** A little flower: white petals, gold heart (recolor w / y for other kinds). */
const FLOWER: Rows = [
  '.w.',
  'wyw',
  '.w.',
  '.G.',
];

export function fgLayer(): PixelBuf {
  const H = LAYERS.fg.h;
  const b = blank(TILE_W, H);
  const tufts = TUFTS.map((t) => inked(t));
  const flowers = [inked(FLOWER), inked(FLOWER, { w: 'P', y: 'y' }), inked(FLOWER, { w: 'y', y: 'O' })];
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

// ------------------------------------------------------------------ the set

export const SUBURBS: ScenerySet = {
  tileW: TILE_W,
  layers: LAYERS,
  scroll0: { far: 21, mid: 33, ground: 32, fg: 58 },
  sky: true,
  graded: true,
  far: farLayer,
  mid: midLayer,
  ground: groundLayer,
  fg: fgLayer,
  lights: () => ({ far: farLights(), mid: midLights(), ground: groundLights() }),
};

// ------------------------------------------------------------------ preview sheet

const SKY_TOP = '#2FB8F0';
const SKY_LOW = '#C8F0FF';

function skyBands(w: number, h: number): PixelBuf {
  const b = blank(w, h);
  const bands: ReadonlyArray<readonly [number, number]> = [[0, 0], [10, 0.2], [18, 0.4], [25, 0.6], [31, 0.8], [36, 1]];
  bands.forEach(([y0, t], i) => {
    const y1 = i + 1 < bands.length ? bands[i + 1][0] : h;
    fill(b, 0, y0, w, y1 - y0, mix(SKY_TOP, SKY_LOW, t));
  });
  return b;
}

export function sheet(): SheetEntry[] {
  const authored: Array<[string, Rows]> = [
    ['far_house_gable', FAR_HOUSE_GABLE], ['far_house_hip', FAR_HOUSE_HIP], ['water_tower', WATER_TOWER],
    ['gable_house', GABLE_HOUSE], ['bungalow', BUNGALOW], ['two_story', TWO_STORY],
    ['big_tree', BIG_TREE], ['small_tree', SMALL_TREE], ['hedge', HEDGE], ['hedge_small', HEDGE_SMALL],
    ['shrub', SHRUB], ['mailbox', MAILBOX], ['hydrant', HYDRANT], ['can', CAN], ['dumpster', DUMPSTER],
    ['flower', FLOWER], ['pebble', PEBBLE],
    ...CRACKS.map((r, i): [string, Rows] => [`crack${i}`, r]),
    ...TUFTS.map((r, i): [string, Rows] => [`tuft${i}`, r]),
    ['lamp', LAMP],
  ];
  for (const [name, r] of authored) checkRows(name, r);

  const far = farLayer();
  const mid = midLayer();
  const ground = groundLayer();
  const fg = fgLayer();
  const comp = skyBands(TILE_W, 68);
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
  ];
}
