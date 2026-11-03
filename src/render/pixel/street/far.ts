/**
 * The street's far layer (scene rows 39 to 88 of the street's 123-row frame): the countryside beyond
 * the street, in depth bands that get hazier with distance. Nothing here is inked, so it reads as far
 * away:
 *  - a pale far range peeking over a distant ridge, sunlit flanks warmer, shaded flanks cooler;
 *  - back hills of fields and hedgerows, with a small town on one of them (gabled roofs with
 *    chimneys, a church with a tall spire, a water tower on its legs, a main street) whose windows and
 *    street lights come on at night;
 *  - near hills with a plowed field, a wheat field, an orchard and a farm (a red barn with a gambrel
 *    roof, a silo, a farmhouse);
 *  - a loose tree line of round crowns, pines and poplars, in groups with open fields between.
 * Below row 72 (the meadow) it is only filler: the street's lawn covers it from row 78.
 * Hills are lit from the top left: flanks facing left catch the light, flanks facing right fall into
 * shade, both fading into the hill's body further down.
 */
import { blank, blit, clone, mix, stamp, type PixelBuf, type Rows } from '../buf';
import type { LightSpot } from '../sceneryTypes';
import { TILE_W, despeckle, dist, dot, foliage, h2, hexInt, hz, rgbAt, wrap } from './common';

/** Where the far layer sits in the scene frame: top row and height. */
export const FAR_SPOT = { y: 39, h: 50 } as const;

/** A scene row as a far-layer row. */
const fy = (row: number): number => row - FAR_SPOT.y;

// ------------------------------------------------------------------ colors

/** Tones of one material: [shade, mid, lit]. */
type Tones = readonly [string, string, string];

const COOL = '#3d4a8c';
const WARM = '#fff0a0';

/** A natural color hue-shifted and hazed: shadows toward blue-violet, lights toward warm yellow. */
function tones(c: string, haze: number, shift = 0.22): Tones {
  return [hz(mix(c, COOL, shift), haze), hz(c, haze), hz(mix(c, WARM, shift), haze)];
}

/** Own haze per depth band (each world hazes the whole layer further toward its sky). */
const HAZE = { range: 0.56, ridge: 0.44, back: 0.32, town: 0.3, near: 0.24, trees: 0.14 } as const;

// ------------------------------------------------------------------ hills

/** A rounded hill on a skyline: center x, half-width, height in rows. */
type Hump = readonly [number, number, number];

/** A skyline of rounded humps over a base row (layer rows, one per column, repeating every TILE_W). */
function skyline(base: number, humps: readonly Hump[]): number[] {
  const ys: number[] = [];
  for (let x = 0; x < TILE_W; x++) {
    let y = base;
    for (const [cx, w, h] of humps) {
      const t = dist(x, cx) / w;
      if (t < 1) y -= h * (0.5 + 0.5 * Math.cos(Math.PI * t));
    }
    ys.push(Math.round(y));
  }
  // even out one-pixel steps so rims never get lone spikes or notches
  for (let x = 0; x < TILE_W; x++) {
    const l = ys[wrap(x - 1)];
    const r = ys[wrap(x + 1)];
    if (l === r && ys[x] !== l) ys[x] = l;
  }
  return ys;
}

/** How a column of a skyline faces the light: + lit (rises to the right), - shaded (falls to the right). */
function facing(crest: readonly number[], x: number): number {
  return (crest[wrap(x - 4)] - crest[wrap(x + 4)]) / 8;
}

/** Light on a hill pixel `d` rows under its crest: 1 lit, 0 mid, -1 shade; edges broken into short runs. */
function lightAt(crest: readonly number[], x: number, d: number, seed: number, reach: number): number {
  const v = facing(crest, x) * Math.exp(-d / reach);
  const j = (h2(Math.floor(wrap(x + (d % 3)) / 3), d, seed) - 0.5) * 0.06;
  return v + j > 0.13 ? 1 : v + j < -0.11 ? -1 : 0;
}

/** The far range, palest, peeking over the ridge. */
const RANGE = skyline(fy(54), [
  [57, 39, 12],
  [138, 27, 6],
  [225, 45, 15],
  [306, 27, 7.5],
]);
/** The distant ridge. */
const RIDGE = skyline(fy(59), [
  [12, 45, 12],
  [93, 33, 7.5],
  [174, 51, 12],
  [258, 36, 9],
  [321, 21, 4.5],
]);
/** Back hills: fields and the town (on the hill around TOWN_X). */
const TOWN_X = 150;
const BACK = skyline(fy(65), [
  [3, 39, 5.2],
  [75, 30, 4.5],
  [TOWN_X, 39, 11.2],
  [237, 33, 4.5],
  [300, 27, 6],
]);
/** Near hills: fields, an orchard and the farm (around FARM_X). */
const FARM_X = 267;
const NEAR = skyline(fy(71), [
  [45, 45, 6.8],
  [180, 24, 2.2],
  [FARM_X, 42, 7.5],
]);
/** The meadow's top edge (the street's lawn covers what is under it); the tree line stands on it. */
const MEADOW = fy(72);

/** The layer, built once (farLights reads it too). */
let built: PixelBuf | null = null;
/** While the layer is built: which pixels are drawn details (buildings, trees, hedgerows), not texture. */
let detail = new Uint8Array(0);

export function farLayer(): PixelBuf {
  return clone(build());
}

/** Back to front: the distant bands, back fields, the town, near fields, the farm, the tree line. */
function build(): PixelBuf {
  if (built) return built;
  const b = blank(TILE_W, FAR_SPOT.h);
  detail = new Uint8Array(TILE_W * b.h);
  const distant = blank(TILE_W, b.h);
  drawPlain(distant, RANGE, HAZE.range, 0.62, 7, false);
  drawPlain(distant, RIDGE, HAZE.ridge, 0.42, 7, true);
  despeckle(distant);
  layer(b, distant, false);
  drawFields(b, BACK, fy(76), BACK_FIELDS);
  drawTown(b);
  drawFields(b, NEAR, fy(80), NEAR_FIELDS);
  drawFarm(b);
  drawTrees(b);
  drawMeadow(b);
  tidy(b);
  built = b;
  return b;
}

/** Pastes a band (texture) or a set of details over the layer, keeping track of which is which. */
function layer(b: PixelBuf, src: PixelBuf, isDetail: boolean): void {
  blit(b, src, 0, 0);
  for (let i = 0; i < src.w * src.h; i++) if (src.px[i * 4 + 3]) detail[i] = isDetail ? 1 : 0;
}

/**
 * Where a band was laid over another, a texture pixel can end up matching none of its neighbours:
 * it takes its most common neighbour's color (details are left alone).
 */
function tidy(b: PixelBuf): void {
  const src = clone(b);
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const me = rgbAt(src, x, y);
      if (me < 0 || detail[y * b.w + x]) continue;
      const ns = [rgbAt(src, x - 1, y), rgbAt(src, x + 1, y), rgbAt(src, x, y - 1), rgbAt(src, x, y + 1)].filter((n) => n >= 0);
      if (ns.length < 3 || ns.includes(me)) continue;
      const best = ns.reduce((a, n) => (ns.filter((m) => m === n).length > ns.filter((m) => m === a).length ? n : a));
      dot(b, x, y, '#' + best.toString(16).padStart(6, '0'));
    }
  }
}

/** A plain distant band: flanks lit and shaded, a warm rim on sunlit crests, mist pooling at its foot. */
function drawPlain(b: PixelBuf, crest: readonly number[], haze: number, blue: number, reach: number, mist: boolean): void {
  const base = mix(mix('G', 'U', blue), 'V', blue * 0.2);
  const [shade, mid, lit] = tones(base, haze, 0.16);
  const rim = hz(mix(mix('l', 'U', blue * 0.5), WARM, 0.4), haze);
  const fog = hz(base, haze + 0.14);
  const fog2 = hz(base, haze + 0.22);
  for (let x = 0; x < TILE_W; x++) {
    for (let y = crest[x]; y < b.h; y++) {
      const d = y - crest[x];
      const l = lightAt(crest, x, d, 1 + reach, reach);
      let c = l > 0 ? lit : l < 0 ? shade : mid;
      if (d === 0) c = l < 0 ? mid : rim;
      if (mist) {
        const m = fy(61) + (h2(Math.floor(x / 5), 0, 2) < 0.5 ? 0 : 1);
        if (y >= m + 2 + (h2(Math.floor((x + 2) / 4), 1, 3) < 0.5 ? 0 : 1)) c = fog2;
        else if (y >= m) c = fog;
      }
      dot(b, x, y, c);
    }
  }
}

// ------------------------------------------------------------------ fields

/** A field: its tones and its kind (plain, plowed in rows, or an orchard of little trees). */
interface Crop {
  tones: Tones;
  kind?: 'rows' | 'orchard';
}

/** A band of fields on a hill: boundaries follow the hill and lean with depth, hedgerows between. */
interface Fields {
  /** Hedgerow lines as fractions of the way from the crest down to the band's bottom row. */
  rows: readonly number[];
  /** Field boundaries along the band (x at the crest); they lean with depth. */
  cols: readonly number[];
  lean: number;
  /** One crop per field, by [column][row]; missing ones repeat the column's last. */
  crops: ReadonlyArray<readonly Crop[]>;
  rim: string;
  hedge: Tones;
  reach: number;
  seed: number;
}

const grassB = tones(mix('G', 'l', 0.55), HAZE.back);
const paleB = tones(mix('l', 'L', 0.25), HAZE.back);
const hayB = tones(mix('l', 'y', 0.45), HAZE.back);
const darkB = tones(mix('G', 'l', 0.2), HAZE.back);
const BACK_FIELDS: Fields = {
  rows: [0.36, 0.7],
  cols: [21, 54, 91, 114, 189, 210, 252, 285, 321],
  lean: 0.7,
  crops: [
    [{ tones: grassB }, { tones: hayB }, { tones: darkB }],
    [{ tones: paleB }, { tones: grassB }],
    [{ tones: hayB }, { tones: darkB }, { tones: grassB }],
    [{ tones: grassB }, { tones: paleB }],
    [{ tones: darkB }, { tones: grassB }, { tones: hayB }],
    [{ tones: paleB }, { tones: hayB }],
    [{ tones: grassB }, { tones: darkB }],
    [{ tones: hayB }, { tones: grassB }],
    [{ tones: darkB }, { tones: paleB }],
  ],
  rim: hz(mix('L', WARM, 0.3), HAZE.back),
  hedge: tones(mix('g', 'G', 0.4), HAZE.back, 0.3),
  reach: 6,
  seed: 10,
};

const grassN = tones(mix('G', 'l', 0.5), HAZE.near);
const paleN = tones(mix('l', 'L', 0.2), HAZE.near);
const soilN = tones(mix('N', 't', 0.45), HAZE.near, 0.25);
const wheatN = tones(mix('t', 'y', 0.6), HAZE.near);
const orchardN = tones(mix('l', 'G', 0.25), HAZE.near);
const NEAR_FIELDS: Fields = {
  rows: [0.42],
  cols: [9, 66, 105, 156, 207, 240, 306],
  lean: 1,
  crops: [
    [{ tones: grassN }, { tones: paleN }],
    [{ tones: soilN, kind: 'rows' }, { tones: grassN }],
    [{ tones: paleN }, { tones: wheatN }],
    [{ tones: grassN }, { tones: orchardN, kind: 'orchard' }],
    [{ tones: wheatN, kind: 'rows' }, { tones: grassN }],
    [{ tones: paleN }],
    [{ tones: grassN }, { tones: paleN }],
  ],
  rim: hz(mix('L', WARM, 0.3), HAZE.near),
  hedge: tones(mix('g', 'G', 0.4), HAZE.near, 0.3),
  reach: 6,
  seed: 20,
};

function drawFields(b: PixelBuf, crest: readonly number[], bottom: number, f: Fields): void {
  const t = blank(TILE_W, b.h);
  const line = (x: number, k: number) => Math.round(crest[wrap(x)] + f.rows[k] * (bottom - crest[wrap(x)]));
  const colOf = (x: number, d: number) => {
    const u = wrap(Math.round(x - d * f.lean));
    let i = f.cols.length - 1;
    for (let k = 0; k < f.cols.length; k++) if (u >= f.cols[k]) i = k;
    return i;
  };
  const cropAt = (x: number, y: number) => {
    const d = y - crest[wrap(x)];
    let row = 0;
    for (let k = 0; k < f.rows.length; k++) if (y >= line(x, k)) row = k + 1;
    const col = f.crops[colOf(x, d)];
    const top = row > 0 ? line(x, row - 1) : crest[wrap(x)];
    return { crop: col[Math.min(row, col.length - 1)], top };
  };
  for (let x = 0; x < TILE_W; x++) {
    for (let y = crest[x]; y < b.h; y++) {
      const d = y - crest[x];
      const { crop, top } = cropAt(x, y);
      const l = lightAt(crest, x, d, f.seed + 1, f.reach);
      let c = crop.tones[l + 1];
      // furrows follow the field's top edge: a lit ridge and a shaded furrow, row by row
      if (crop.kind === 'rows' && y > top) c = crop.tones[(y - top) % 2 === 1 ? Math.max(0, l) : Math.min(2, l + 1)];
      if (d === 0) c = l < 0 ? crop.tones[1] : f.rim;
      dot(t, x, y, c);
    }
  }
  despeckle(t);
  layer(b, t, false);
  // hedgerows along the field edges
  const det = blank(TILE_W, b.h);
  const [hd, hm, hl] = f.hedge;
  for (let x = 0; x < TILE_W; x++) {
    for (let k = 0; k < f.rows.length; k++) {
      // a 4-connected line: where it steps down, the step's corner is filled too
      const y = line(x, k);
      const prev = line(x - 1, k);
      for (let yy = Math.min(y, prev); yy <= Math.max(y, prev); yy++) if (yy > crest[x] + 1 && (yy === y || prev !== y)) dot(det, x, yy, hm);
    }
  }
  for (const cx of f.cols) {
    for (let d = 2; d < b.h; d++) {
      const x = Math.round(cx + d * f.lean);
      if (crest[wrap(x)] + d >= bottom) break;
      dot(det, x, crest[wrap(x)] + d, hm);
    }
  }
  // little trees along the hedgerows: a round crown lit on its top left, shaded on its bottom right
  const tree = (x: number, y: number) => {
    if (y - 2 <= crest[wrap(x)] || y - 2 <= crest[wrap(x + 2)]) return;
    dot(det, x, y - 2, hl);
    dot(det, x + 1, y - 2, hm);
    dot(det, x - 1, y - 1, hl);
    dot(det, x, y - 1, hm);
    dot(det, x + 1, y - 1, hm);
    dot(det, x + 2, y - 1, hd);
    dot(det, x, y, hd);
    dot(det, x + 1, y, hd);
  };
  for (let k = 0; k < f.rows.length; k++) {
    for (let x = 0; x < TILE_W; x++) {
      if (h2(x, k, f.seed + 2) < 0.92 || [1, 2, 3, 4, 5].some((i) => h2(x - i, k, f.seed + 2) >= 0.92)) continue;
      tree(x, line(x, k));
    }
  }
  // orchards: rows of little round trees
  for (let x = 0; x < TILE_W; x++) {
    for (let y = 0; y < b.h; y++) {
      if (y <= crest[x] + 3) continue;
      const { crop, top } = cropAt(x, y);
      if (crop.kind !== 'orchard' || y - top < 3 || (y - top) % 4 !== 3 || wrap(x + (y - top)) % 5 !== 0) continue;
      tree(x, y);
    }
  }
  layer(b, det, true);
}

/** Filler under the tree line (the street's lawn covers most of it). */
function drawMeadow(b: PixelBuf): void {
  const [shade, mid, lit] = tones(mix('l', 'G', 0.3), HAZE.near);
  const t = blank(TILE_W, b.h);
  for (let x = 0; x < TILE_W; x++) {
    for (let y = MEADOW; y < b.h; y++) {
      const c = y === MEADOW ? lit : y === MEADOW + 1 && h2(Math.floor(x / 4), 0, 90) < 0.4 ? lit : y > MEADOW + 3 && h2(Math.floor(x / 5), y, 91) < 0.18 ? shade : mid;
      dot(t, x, y, c);
    }
  }
  layer(b, t, false);
}

// ------------------------------------------------------------------ trees

/** Pines, tier on tier, lit on the left: l lit, G mid, g shade. */
const PINE_S: Rows = [
  '...G...',
  '..lGg..',
  '..lGg..',
  '.llGgg.',
  '..lGg..',
  '.llGgg.',
  'lllGggg',
  '..lGg..',
  '.llGggg',
  'llGGGgg',
];

const PINE_L: Rows = [
  '....G....',
  '...lGg...',
  '...lGg...',
  '..llGgg..',
  '...lGg...',
  '..llGgg..',
  '.lllGggg.',
  '..llGgg..',
  '.lllGggg.',
  'llllGgggg',
  '..llGgg..',
  '.lllGgggg',
  'llllGgggg',
  'lllGGGggg',
];

function drawTrees(b: PixelBuf): void {
  const haze = HAZE.trees;
  const round = tones(mix('G', 'g', 0.3), haze, 0.3);
  const olive = tones(mix(mix('G', 'g', 0.15), 'y', 0.16), haze, 0.3);
  const pines = tones(mix('g', 'u', 0.15), haze * 0.8, 0.3);
  const poplar = tones(mix('G', 'l', 0.3), haze, 0.3);
  const line = blank(TILE_W, b.h);
  const plot = (x: number, y: number, c: string) => dot(line, x, y, c);
  const pine = (rows: Rows, x: number) => stamp(line, rows, x, MEADOW - rows.length + 1, { wrapX: true, recolor: { l: pines[2], G: pines[1], g: pines[0] } });
  // groups of trees with open fields between: [x, kinds] (r round, R big round, p small pine, P pine, o poplar)
  const groups: ReadonlyArray<readonly [number, string]> = [
    [0, 'RrP'],
    [50, 'oo'],
    [93, 'pP'],
    [192, 'rRp'],
    [228, 'o'],
    [297, 'PR'],
  ];
  for (const [gx, kinds] of groups) {
    let x = gx;
    for (let i = 0; i < kinds.length; i++) {
      const k = kinds[i];
      const lift = Math.floor(h2(gx, i, 40) * 3);
      if (k === 'p' || k === 'P') {
        const rows = k === 'p' ? PINE_S : PINE_L;
        pine(rows, x);
        x += rows[0].length - 1;
      } else if (k === 'o') {
        foliage(plot, [[x + 2.2, MEADOW - 6 - lift, 2.5, 7.2]], poplar);
        x += 5;
      } else {
        const r = k === 'R' ? 5.2 : 4;
        // a crown of two or three clumps, so it reads as leaves rather than a ball
        foliage(plot, [[x + r, MEADOW + 0.5 - r - lift, r], [x + r * 0.55, MEADOW + 1.5 - r * 0.7 - lift, r * 0.62], [x + r * 1.5, MEADOW + 1.5 - r * 0.65 - lift, r * 0.6]], i % 2 ? olive : round);
        x += Math.round(r * 1.7);
      }
    }
  }
  despeckle(line);
  layer(b, line, true);
}

// ------------------------------------------------------------------ the town and the farm

// Far buildings are authored in plain palette keys and recolored (no ink: they are far away). Roofs use
// e (lit), R (mid), r (shade); walls W (lit) and 5 (shade); x are windows (lit at night), w white trim,
// 2 iron, n doors and chimneys.
const HOUSE_GABLE: Rows = [
  '...e.n.',
  '..eeRn.',
  '.eeeRr.',
  'eeeeRrr',
  '.WxWx5.',
  '.WWWW5.',
  '.WxWn5.',
];

const HOUSE_LONG: Rows = [
  '..eeeeRrn.',
  '.eeeeeRRn.',
  'eeeeeeRRrr',
  '.WxWWxWx55',
  '.WWWWWWW55',
  '.WxWnWWx55',
];

const HOUSE_TALL: Rows = [
  '..eRr..',
  '.eeRrr.',
  'eeeRrrr',
  '.WxWx5.',
  '.WWWW5.',
  '.WxWx5.',
  '.WWWW5.',
  '.WxWn5.',
];

const CHURCH: Rows = [
  '..w..........',
  '.www.........',
  '..R..........',
  '.eRr.........',
  '.eRr.........',
  'eeRrr........',
  '.WW5.........',
  '.Wx5.........',
  '.WW5..eeRRr..',
  '.WW5.eeeRRrr.',
  '.Wx5eeeeRRrrr',
  '.WW5WxWWxWx55',
  '.WW5WWWWWWW55',
  '.Wn5WxWWxWx55',
];

const WATER_TOWER: Rows = [
  '...e....',
  '..eeRr..',
  '.eeeRrr.',
  'WWWWW555',
  'WwWWW555',
  'WwWWW555',
  'WWWWW555',
  '.2.22.2.',
  '.2.22.2.',
  '.222222.',
  '.2.22.2.',
  '2..22..2',
  '2..22..2',
];

const BARN: Rows = [
  '.....eRr.....',
  '...eeeRRrr...',
  '..eeeeRRrrr..',
  '.eeeeeRRrrrr.',
  'eeeeeeRRrrrrr',
  '.WWWwwwwwW55.',
  '.WWWwxwxwW55.',
  '.WWWwwxwwW55.',
  '.WWWwxwxwW55.',
];

const SILO: Rows = [
  '..eRr..',
  '.eeRrr.',
  'wWWWW55',
  'wWWWW55',
  'w5555r5',
  'wWWWW55',
  'wWWWW55',
  'w5555r5',
  'wWWWW55',
  'wWWWW55',
  'wWWWW55',
];

/** Roof colors (lit, mid, shade) for far buildings. */
const ROOFS: ReadonlyArray<readonly [string, string, string]> = [
  ['e', 'R', 'r'],
  ['t', 'N', 'n'],
  ['4', '3', '2'],
  [mix('e', 'O', 0.45), mix('R', 'o', 0.45), mix('r', 'n', 0.45)],
  ['c', 'U', 'u'],
];
/** Wall colors (lit, shade). */
const WALLS: ReadonlyArray<readonly [string, string]> = [
  ['W', 'T'],
  ['w', '5'],
  ['T', 't'],
  ['5', '4'],
  ['R', 'r'],
  ['C', mix('c', 'U', 0.3)],
];

/** The town's buildings, back to front: [rows, x, base (scene row), roof, walls]. */
const TOWN: ReadonlyArray<readonly [Rows, number, number, number, number]> = [
  [WATER_TOWER, 120, 59, 2, 1],
  [HOUSE_GABLE, 133, 56, 0, 0],
  [CHURCH, 143, 56, 2, 1],
  [HOUSE_TALL, 160, 57, 3, 2],
  [HOUSE_LONG, 168, 59, 1, 0],
  [HOUSE_GABLE, 128, 60, 3, 1],
  [HOUSE_LONG, 137, 62, 0, 2],
  [HOUSE_GABLE, 152, 62, 4, 0],
  [HOUSE_TALL, 158, 63, 0, 3],
  [HOUSE_GABLE, 180, 63, 0, 1],
];

/** The color of an unlit far window. */
const windowColor = (haze: number): string => hz(mix('x', 'u', 0.3), haze * 0.75);

function buildingMap(roof: number, walls: number, haze: number): Record<string, string> {
  const [e, R, r] = ROOFS[roof];
  const [wl, ws] = WALLS[walls];
  return {
    e: hz(e, haze), R: hz(R, haze), r: hz(r, haze),
    W: hz(wl, haze), '5': hz(ws, haze), w: hz('w', haze),
    x: windowColor(haze), '2': hz('2', haze), n: hz(mix('n', 'r', 0.3), haze),
  };
}

/** The town's main street (scene row) along the foot of its houses, and its street lights (x). */
const STREET = { row: 64, x0: 118, x1: 189 } as const;
const STREET_LIGHTS = [121, 133, 145, 157, 169, 181] as const;

function drawTown(b: PixelBuf): void {
  const d = blank(TILE_W, b.h);
  for (let x = STREET.x0; x <= STREET.x1; x++) dot(d, x, fy(STREET.row), hz(mix('T', '5', 0.5), HAZE.town));
  for (const [rows, x, base, roof, walls] of TOWN) {
    stamp(d, rows, x, fy(base) - rows.length + 1, { wrapX: true, recolor: buildingMap(roof, walls, HAZE.town) });
  }
  // a few round trees among the houses
  const t = tones(mix('G', 'g', 0.2), HAZE.town, 0.3);
  const plot = (x: number, y: number, c: string) => dot(d, x, y, c);
  foliage(plot, [[127.5, fy(60) - 2, 2.7], [125.5, fy(60) - 0.5, 1.8]], t);
  foliage(plot, [[178, fy(62) - 2.5, 3.2], [180.5, fy(62) - 1, 2]], t);
  foliage(plot, [[149.5, fy(62) - 2, 2.2]], t);
  layer(b, d, true);
}

/** The farm on the near hills: barn, silo and farmhouse, as [rows, x offset, roof, walls]. */
const FARM: ReadonlyArray<readonly [Rows, number, number, number]> = [
  [SILO, 13, 2, 3],
  [BARN, 0, 2, 4],
  [HOUSE_GABLE, -13, 1, 0],
];
const FARM_BASE = 67;

function drawFarm(b: PixelBuf): void {
  const d = blank(TILE_W, b.h);
  for (const [rows, dx, roof, walls] of FARM) {
    stamp(d, rows, FARM_X + dx, fy(FARM_BASE) - rows.length + 1, { wrapX: true, recolor: buildingMap(roof, walls, HAZE.near) });
  }
  const t = tones(mix('G', 'g', 0.15), HAZE.near, 0.3);
  foliage((x, y, c) => dot(d, x, y, c), [[FARM_X - 18.5, fy(FARM_BASE) - 3.5, 4.4], [FARM_X - 21, fy(FARM_BASE) - 1.5, 2.6], [FARM_X + 24.5, fy(FARM_BASE) - 3, 3.6]], t);
  layer(b, d, true);
}

/** Window pixels ('x') of every far building, in far-layer pixels. */
function windowPixels(): Array<{ x: number; y: number; haze: number }> {
  const out: Array<{ x: number; y: number; haze: number }> = [];
  const add = (rows: Rows, x: number, base: number, haze: number) =>
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) if (row[rx] === 'x') out.push({ x: wrap(x + rx), y: fy(base) - rows.length + 1 + ry, haze });
    });
  for (const [rows, x, base] of TOWN) add(rows, x, base, HAZE.town);
  for (const [rows, dx] of FARM) add(rows, FARM_X + dx, FARM_BASE, HAZE.near);
  return out;
}

/**
 * The far windows still in sight (nothing nearer drawn over them), a share of which light up at dusk
 * and night, and the town's street lights (on whenever a world turns its lamps on).
 */
export function farLights(): LightSpot[] {
  const b = build();
  const windows = windowPixels()
    .filter(({ x, y, haze }) => rgbAt(b, x, y) === hexInt(windowColor(haze)))
    .map(({ x, y }): LightSpot => ({ x, y, w: 1, h: 1, kind: 'window' }));
  const lamps = STREET_LIGHTS.map((x): LightSpot => ({ x, y: fy(STREET.row), w: 1, h: 1, kind: 'lamp', radius: 3.3, power: 0.45 }));
  return [...windows, ...lamps];
}

/** Authored sprites, for the preview sheet. */
export const FAR_SPRITES: Array<[string, Rows]> = [
  ['far_house_gable', HOUSE_GABLE], ['far_house_long', HOUSE_LONG], ['far_house_tall', HOUSE_TALL],
  ['far_church', CHURCH], ['water_tower', WATER_TOWER], ['barn', BARN], ['silo', SILO],
  ['pine_small', PINE_S], ['pine', PINE_L],
];
