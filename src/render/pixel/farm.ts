/**
 * World 5's battle backdrop, "Funky Farmland": a harvest farm in golden late-afternoon light (style
 * rules: docs/PIXEL_ART.md). Four horizontally tiling layers, TILE_W art pixels wide, on the battle
 * grid (sceneryTypes.ts: VIEW, the fighters' feet on FEET_ROW). Rows below are view rows.
 *  - far (28 to 53): the countryside in depth bands that get hazier with distance, nothing inked:
 *    a pale violet range, then rolling hills of patchwork fields (golden wheat, stubble with round
 *    bales, plowed rows, an orchard, pasture) between hedgerows, a windmill, a far farmstead whose
 *    windows light up, a pond and loose groups of autumn trees and golden poplars.
 *  - mid (6 to 59): the farmyard, inked like the animals: the big red barn (gambrel roof, cupola and
 *    rooster weathervane, open hay loft, X-braced doors, a gooseneck lamp) with the silo behind it,
 *    a pumpkin patch with a scarecrow and his crow, a big sugar maple with round bales under it, and a
 *    windpump over a water trough, with post-and-rail fences and plenty of open grass between.
 *  - ground (54 to 81): the dirt farm road the fighters stand on (62 to 72, feet on 67) with its ruts,
 *    a tall-grass verge on the far side (wildflowers, a mailbox) and on the near side grass running
 *    into the edge of a wheat field. The rows under the feet (68 to 70, the HP bars) stay plain.
 *  - fg (72 to 81): a few tall grass tufts, wildflowers and wheat stalks along the bottom.
 * The set keeps its own colors (not graded); each world's sky, haze, rim light and ambient go on
 * top. Light comes from the top left; ramps are hue-shifted (warm lights, cool violet shadows).
 */
import { blank, blit, clone, fromRows, hash01, mix, outline, setPx, type PixelBuf, type Rows, type SheetEntry } from './buf';
import { FEET_ROW, VIEW, type LightSpot, type ScenerySet } from './sceneryTypes';
import { despeckle, foliage, plant, put, windowsOf } from './street/common';

// ------------------------------------------------------------------ layout

/** Width of every layer, in art pixels; each layer repeats seamlessly. */
const TILE_W = 240;

/** Where each layer sits in the view: top row and height. */
const FAR_SPOT = { y: 28, h: 26 } as const;
const MID_SPOT = { y: 6, h: 54 } as const;
const GROUND_SPOT = { y: 54, h: VIEW.h - 54 } as const;
const FG_SPOT = { y: 72, h: VIEW.h - 72 } as const;

// ------------------------------------------------------------------ helpers

const wrap = (x: number): number => ((x % TILE_W) + TILE_W) % TILE_W;

/** setPx on a tiling layer: x wraps across the seam. */
function dot(b: PixelBuf, x: number, y: number, c: string): void {
  setPx(b, wrap(x), y, c);
}

/** Deterministic noise for a tile cell (x wraps). */
const h2 = (x: number, y: number, seed: number): number => hash01(wrap(x) * 131 + y * 7907 + seed * 104729);

/** Distance between two columns across the seam. */
function dist(a: number, b: number): number {
  const d = Math.abs(wrap(a) - wrap(b));
  return Math.min(d, TILE_W - d);
}

/** The farm's line color: a warm dark brown, like the animals' outlines. */
const INK = '#2c1b1e';
const ink = (b: PixelBuf): PixelBuf => outline(b, INK);
const inked = (rows: Rows, colors: Readonly<Record<string, string>>): PixelBuf => ink(fromRows(rows, colors));

/**
 * Splits the tile into runs of `min` to `max` columns, repeating seamlessly: each column's run index.
 * Texture is laid in runs so it reads as strokes, never single pixels.
 */
function runIds(seed: number, min: number, max: number): number[] {
  const ids: number[] = [];
  for (let k = 0, x = 0; x < TILE_W; k++) {
    let len = min + Math.floor(hash01(seed * 997 + k) * (max - min + 1));
    if (TILE_W - x - len < min) len = TILE_W - x;
    for (let i = 0; i < len; i++) ids.push(k);
    x += len;
  }
  return ids;
}

/** A grid of palette keys to draw on; it becomes Rows (so windowsOf can find windows in it). */
class Sketch {
  private readonly cells: string[][];
  constructor(readonly w: number, readonly h: number) {
    this.cells = Array.from({ length: h }, () => new Array<string>(w).fill('.'));
  }
  at(x: number, y: number): string {
    return this.cells[y]?.[x] ?? '.';
  }
  set(x: number, y: number, c: string): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y][x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: string): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }
  stamp(rows: Rows, x: number, y: number): void {
    rows.forEach((row, yy) => {
      for (let xx = 0; xx < row.length; xx++) if (row[xx] !== '.') this.set(x + xx, y + yy, row[xx]);
    });
  }
  /** A straight line (Bresenham). */
  line(x0: number, y0: number, x1: number, y1: number, c: string): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  rows(): Rows {
    return this.cells.map((r) => r.join(''));
  }
}

/** Sunlight comes from the top left and a little in front. */
const LIGHT = (() => {
  const v = [-0.5, -0.72, 0.5];
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n] as const;
})();

/** How lit a point on a unit sphere (u, v in -1..1, screen axes) is: -1 to 1. */
function sphereLight(u0: number, v0: number): number {
  const u = Math.max(-1, Math.min(1, u0));
  const v = Math.max(-1, Math.min(1, v0));
  return u * LIGHT[0] + v * LIGHT[1] + Math.sqrt(Math.max(0, 1 - u * u - v * v)) * LIGHT[2];
}

// ================================================================== far

const fy = (row: number): number => row - FAR_SPOT.y;

/** Tones of one material: [shade, mid, lit]. */
type Tones = readonly [string, string, string];

const COOL = '#4a478f';
const WARM = '#ffe3a6';
/** The haze far things fade into: a dusty rose-lilac between the sky's violet and its gold. */
const HAZE_C = '#dcc3cc';
const hz = (c: string, t: number): string => mix(c, HAZE_C, t);

/** A natural color hue-shifted and hazed: shadows toward blue-violet, lights toward warm gold. */
function tones(c: string, haze: number, shift = 0.22): Tones {
  return [hz(mix(c, COOL, shift), haze), hz(c, haze), hz(mix(c, WARM, shift), haze)];
}

/** Own haze per depth band (the world hazes the whole layer further toward its sky). */
const HAZE = { range: 0.52, ridge: 0.4, back: 0.27, near: 0.16, trees: 0.12 } as const;

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
  for (let x = 0; x < TILE_W; x++) {
    const l = ys[wrap(x - 1)];
    const r = ys[wrap(x + 1)];
    if (l === r && ys[x] !== l) ys[x] = l;
  }
  return ys;
}

/** How a column of a skyline faces the light: + lit (rises to the right), - shaded (falls to the right). */
function facing(crest: readonly number[], x: number): number {
  return (crest[wrap(x - 3)] - crest[wrap(x + 3)]) / 6;
}

/** Light on a hill pixel `d` rows under its crest: 1 lit, 0 mid, -1 shade; edges broken into short runs. */
function lightAt(crest: readonly number[], x: number, d: number, seed: number, reach: number): number {
  const v = facing(crest, x) * Math.exp(-d / reach);
  const j = (h2(Math.floor((x + (d % 3)) / 3), d, seed) - 0.5) * 0.06;
  return v + j > 0.13 ? 1 : v + j < -0.11 ? -1 : 0;
}

/** The far range, palest, then the distant ridge. */
const RANGE = skyline(fy(41), [
  [14, 30, 7],
  [70, 20, 4],
  [124, 34, 9],
  [186, 24, 5],
  [226, 16, 3],
]);
const RIDGE = skyline(fy(43), [
  [40, 26, 5],
  [98, 22, 3],
  [158, 30, 6],
  [210, 18, 3],
]);
/** Back hills: patchwork fields, the windmill on the hill around MILL_X. */
const MILL_X = 70;
const BACK = skyline(fy(46), [
  [6, 22, 3.5],
  [MILL_X, 24, 6.5],
  [122, 22, 3],
  [176, 26, 5],
  [222, 16, 2.5],
]);
/** Near hills: fields, the orchard and the farmstead on the hill around FARM_X. */
const FARM_X = 160;
const NEAR = skyline(fy(49), [
  [30, 30, 4],
  [102, 18, 1.5],
  [FARM_X, 30, 5.5],
  [214, 18, 2],
]);
/** The meadow under the tree line (the farmyard covers it from view row 49). */
const MEADOW = fy(49);

let farBuilt: PixelBuf | null = null;

function buildFar(): PixelBuf {
  if (farBuilt) return farBuilt;
  const b = blank(TILE_W, FAR_SPOT.h);
  drawPlain(b, RANGE, HAZE.range, '#8d86c8', 5, false);
  drawPlain(b, RIDGE, HAZE.ridge, '#7c8cb4', 5, true);
  drawFields(b, BACK, fy(51), BACK_FIELDS);
  drawMill(b);
  drawFields(b, NEAR, fy(54), NEAR_FIELDS);
  drawPond(b);
  drawFarmstead(b);
  drawFarTrees(b);
  drawMeadow(b);
  farBuilt = b;
  return b;
}

function farLayer(): PixelBuf {
  return clone(buildFar());
}

/** A plain distant band: flanks lit and shaded, a warm rim on sunlit crests, mist pooling at its foot. */
function drawPlain(b: PixelBuf, crest: readonly number[], haze: number, base: string, reach: number, mist: boolean): void {
  const [shade, mid, lit] = tones(base, haze, 0.18);
  const rim = hz(mix(base, WARM, 0.45), haze);
  const fog = hz(base, haze + 0.16);
  for (let x = 0; x < TILE_W; x++) {
    for (let y = crest[x]; y < b.h; y++) {
      const d = y - crest[x];
      const l = lightAt(crest, x, d, 1 + reach, reach);
      let c = l > 0 ? lit : l < 0 ? shade : mid;
      if (d === 0) c = l < 0 ? mid : rim;
      if (mist && y >= fy(42) + (h2(Math.floor(x / 4), 0, 2) < 0.5 ? 0 : 1)) c = fog;
      dot(b, x, y, c);
    }
  }
}

// ------------------------------------------------------------------ fields

/** A field: its tones and its kind (plain, plowed or sown in rows, round bales on stubble, an orchard). */
interface Crop {
  tones: Tones;
  kind?: 'rows' | 'bales' | 'orchard';
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
  /** Little trees in the hedgerows (autumn colors). */
  hedgeTrees: readonly Tones[];
  reach: number;
  seed: number;
}

const B = HAZE.back;
const pastureB = tones('#7f9c4c', B);
const paleB = tones('#a9b25a', B);
const wheatB = tones('#d8b452', B);
const stubbleB = tones('#ccae68', B);
const soilB = tones('#a9744e', B, 0.25);
const darkB = tones('#5f8546', B);
const BACK_FIELDS: Fields = {
  rows: [0.38, 0.72],
  cols: [12, 34, 58, 84, 104, 132, 150, 182, 200, 226],
  lean: 0.7,
  crops: [
    [{ tones: pastureB }, { tones: wheatB }, { tones: darkB }],
    [{ tones: stubbleB }, { tones: pastureB }],
    [{ tones: paleB }, { tones: soilB, kind: 'rows' }, { tones: pastureB }],
    [{ tones: wheatB }, { tones: darkB }],
    [{ tones: darkB }, { tones: paleB }, { tones: wheatB }],
    [{ tones: pastureB }, { tones: stubbleB }],
    [{ tones: soilB, kind: 'rows' }, { tones: pastureB }],
    [{ tones: paleB }, { tones: wheatB }, { tones: darkB }],
    [{ tones: wheatB }, { tones: pastureB }],
    [{ tones: pastureB }, { tones: paleB }],
  ],
  rim: hz(mix('#d7d47a', WARM, 0.4), B),
  hedge: tones('#4d6a3e', B, 0.3),
  hedgeTrees: [tones('#5e7e3e', B, 0.3), tones('#c97f34', B, 0.3), tones('#b89a3c', B, 0.3)],
  reach: 4,
  seed: 10,
};

const N = HAZE.near;
const pastureN = tones('#7a9846', N);
const paleN = tones('#a7ad55', N);
const wheatN = tones('#dcb24c', N);
const stubbleN = tones('#d1b06a', N);
const soilN = tones('#a46d48', N, 0.25);
const orchardN = tones('#88a04c', N);
const NEAR_FIELDS: Fields = {
  rows: [0.45],
  cols: [4, 46, 72, 92, 120, 146, 176, 200],
  lean: 1,
  crops: [
    [{ tones: pastureN }, { tones: paleN }],
    [{ tones: wheatN, kind: 'rows' }, { tones: pastureN }],
    [{ tones: paleN }, { tones: stubbleN, kind: 'bales' }],
    [{ tones: pastureN }],
    [{ tones: soilN, kind: 'rows' }, { tones: paleN }],
    [{ tones: pastureN }, { tones: orchardN, kind: 'orchard' }],
    [{ tones: stubbleN, kind: 'bales' }, { tones: pastureN }],
    [{ tones: paleN }, { tones: wheatN, kind: 'rows' }],
  ],
  rim: hz(mix('#d7d47a', WARM, 0.4), N),
  hedge: tones('#4a663a', N, 0.3),
  hedgeTrees: [tones('#577a3a', N, 0.3), tones('#d0823a', N, 0.3), tones('#c3a03e', N, 0.3), tones('#a9503a', N, 0.3)],
  reach: 4,
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
      // rows follow the field's top edge: a lit ridge and a shaded furrow, row by row
      if (crop.kind === 'rows' && y > top) c = crop.tones[(y - top) % 2 === 1 ? Math.max(0, l) : Math.min(2, l + 1)];
      if (d === 0) c = l < 0 ? crop.tones[1] : f.rim;
      dot(t, x, y, c);
    }
  }
  despeckle(t);
  // hedgerows along the field edges
  const [, hm] = f.hedge;
  for (let x = 0; x < TILE_W; x++) {
    for (let k = 0; k < f.rows.length; k++) {
      const y = line(x, k);
      if (y > crest[x] + 1) dot(t, x, y, hm);
    }
  }
  for (const cx of f.cols) {
    for (let d = 2; d < b.h; d++) {
      const x = Math.round(cx + d * f.lean);
      if (crest[wrap(x)] + d >= bottom) break;
      dot(t, x, crest[wrap(x)] + d, hm);
    }
  }
  blit(b, t, 0, 0);
  // little trees along the hedgerows: a lit crown on a shaded side, in autumn colors
  const tree = (x: number, y: number, tt: Tones) => {
    if (y - 1 <= crest[wrap(x)] || y - 1 <= crest[wrap(x + 1)]) return;
    dot(b, x, y - 1, tt[2]);
    dot(b, x + 1, y - 1, tt[1]);
    dot(b, x, y, tt[1]);
    dot(b, x + 1, y, tt[0]);
  };
  for (let k = 0; k < f.rows.length; k++) {
    for (let x = 0; x < TILE_W; x++) {
      if (h2(x, k, f.seed + 2) < 0.86 || h2(x - 1, k, f.seed + 2) >= 0.86 || h2(x - 2, k, f.seed + 2) >= 0.86) continue;
      tree(x, line(x, k), f.hedgeTrees[Math.floor(h2(x, k, f.seed + 3) * f.hedgeTrees.length)]);
    }
  }
  // orchards: rows of little round trees; stubble: round bales, lit on the left, a shadow on the right
  for (let x = 0; x < TILE_W; x++) {
    for (let y = 0; y < b.h; y++) {
      if (y <= crest[x] + 2) continue;
      const { crop, top } = cropAt(x, y);
      if (crop.kind === 'orchard') {
        if (y - top < 2 || (y - top) % 3 !== 2 || wrap(x + (y - top)) % 4 !== 0) continue;
        tree(x, y, f.hedgeTrees[(Math.floor(x / 4) + y) % 2]);
      } else if (crop.kind === 'bales') {
        if (y - top < 2 || (y - top) % 3 !== 1 || wrap(x + (y - top) * 3) % 7 !== 0 || h2(x, y, f.seed + 4) < 0.35) continue;
        dot(b, x, y, hz('#f2d48a', HAZE.near));
        dot(b, x + 1, y, hz('#b68646', HAZE.near));
        dot(b, x + 2, y, crop.tones[0]);
      }
    }
  }
}

// ------------------------------------------------------------------ far buildings

/**
 * A tower windmill, authored in keys and recolored (no ink: it is far away): sails S (canvas) on
 * their spars s, cap R lit / r shade, tower W lit / 5 shade, window and door x.
 */
const MILL: Rows = [
  'S.........s',
  '.S.......s.',
  '..S.....s..',
  '...S.R.s...',
  '....RRr....',
  '...sWW5S...',
  '..s.WW5.S..',
  '.s..Wx5..S.',
  's..WWW55..S',
  '...WWW55...',
  '..WWxW555..',
  '..WWWW555..',
  '..WWxx555..',
];

function drawMill(b: PixelBuf): void {
  const haze = HAZE.back;
  const map = {
    S: hz('#f4ead8', haze), s: hz('#8a7a7a', haze),
    R: hz('#b9574a', haze), r: hz('#7e3b45', haze),
    W: hz('#f0e4d2', haze), '5': hz('#b9aab8', haze), x: hz('#4b3c4c', haze),
  };
  const base = BACK[MILL_X] + 1;
  put(b, fromRows(MILL, map), MILL_X - 5, base - MILL.length + 1);
}

/** The far farmstead: a farmhouse (windows x light up at night), a red barn and its silo, by trees. */
const HOUSE: Rows = [
  '......b....',
  '..eeeRbRr..',
  '.eeeeRRRrr.',
  'eeeeeRRRRrr',
  '.WxWxW5x55.',
  '.WWWWW5555.',
  '.WxWdW5x55.',
];
const FAR_BARN: Rows = [
  '..eRRr..',
  '.eeRRrr.',
  'eeeRRrrr',
  '.RRWWrr.',
  '.RWddWr.',
  '.RWddWr.',
];
const FAR_SILO: Rows = [
  '.43.',
  '4433',
  'WW55',
  'WW55',
  'WW55',
  'WW55',
  'WW55',
  'WW55',
];

/** The farmstead's buildings: [rows, x offset from FARM_X, how far below the crest its base sits]. */
const FARMSTEAD: ReadonlyArray<readonly [Rows, number, number, Record<string, string>]> = (() => {
  const haze = HAZE.near;
  const house = {
    e: hz('#d8705a', haze), R: hz('#b04a44', haze), r: hz('#7c3444', haze), b: hz('#6b4a4a', haze),
    W: hz('#f3e8d6', haze), '5': hz('#c2b4c4', haze), x: hz('#4a4058', haze), d: hz('#6e4a3e', haze),
  };
  const barn = {
    e: hz('#cf5a46', haze), R: hz('#a83c3c', haze), r: hz('#7a2c3e', haze),
    W: hz('#f3e8d6', haze), d: hz('#5a2e36', haze),
  };
  const silo = { '4': hz('#c4ccd8', haze), '3': hz('#8e96ae', haze), W: hz('#e9e0d4', haze), '5': hz('#ada0b2', haze) };
  return [
    [FAR_SILO, 10, 1, silo],
    [FAR_BARN, 4, 2, barn],
    [HOUSE, -9, 1, house],
  ];
})();

function farmBase(dx: number, sink: number): number {
  return NEAR[wrap(FARM_X + dx + 3)] + sink;
}

function drawFarmstead(b: PixelBuf): void {
  for (const [rows, dx, sink, map] of FARMSTEAD) {
    const base = farmBase(dx, sink);
    put(b, fromRows(rows, map), FARM_X + dx, base - rows.length + 1);
  }
  const t = tones('#5c7c3a', HAZE.near, 0.3);
  const gold = tones('#d09040', HAZE.near, 0.3);
  const plot = (x: number, y: number, c: string) => dot(b, x, y, c);
  foliage(plot, [[FARM_X - 13.5, farmBase(-13, 1) - 2.5, 3]], t);
  foliage(plot, [[FARM_X + 17.5, farmBase(17, 1) - 2, 2.5]], gold);
}

/** Window pixels ('x' in the farmhouse's upper rows) still in sight, in far-layer pixels. */
function farLights(): LightSpot[] {
  const out: LightSpot[] = [];
  const [rows, dx, sink] = FARMSTEAD[2];
  const top = farmBase(dx, sink) - rows.length + 1;
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      if (row[rx] === 'x') out.push({ x: wrap(FARM_X + dx + rx), y: top + ry, w: 1, h: 1, kind: 'window' });
    }
  });
  return out;
}

/** A pond in the hollow, holding the sky: gold on top, violet under, a lit ripple. */
const POND_X = 96;
function drawPond(b: PixelBuf): void {
  const y0 = fy(47);
  const shape: ReadonlyArray<readonly [number, number]> = [[3, 13], [0, 17], [2, 14]];
  shape.forEach(([x0, w], i) => {
    for (let k = 0; k < w; k++) {
      const x = POND_X + x0 + k;
      let c = i === 0 ? hz('#f6d79a', 0.2) : i === 1 ? hz('#e2b08e', 0.2) : hz('#9c8cb8', 0.2);
      if (i === 1 && k >= 5 && k < 10) c = hz('#fff0c2', 0.15);
      if (i === 2 && k >= 7 && k < 9) c = hz('#e8c49a', 0.2);
      dot(b, x, y0 + i, c);
    }
  });
  // the near bank: a lip of grass
  for (let k = 0; k < 14; k++) dot(b, POND_X + 2 + k, y0 + 3, NEAR_FIELDS.hedge[1]);
}

// ------------------------------------------------------------------ far trees

/** Poplars, golden in autumn, lit on the left. */
const POPLAR: Rows = [
  '.l.',
  'lG.',
  'lGg',
  'lGg',
  'lGg',
  'lGg',
  'lGg',
  '.G.',
];
const PINE: Rows = [
  '..l..',
  '.lGg.',
  '.lGg.',
  'llGgg',
  '.lGg.',
  'llGgg',
  'lGGgg',
];

function drawFarTrees(b: PixelBuf): void {
  const haze = HAZE.trees;
  const green = tones('#557a38', haze, 0.3);
  const olive = tones('#8a8f3a', haze, 0.3);
  const orange = tones('#cd7a34', haze, 0.3);
  const rust = tones('#a94a36', haze, 0.3);
  const gold = tones('#d4a43e', haze, 0.3);
  const pines = tones('#3e6040', haze * 0.8, 0.3);
  const line = blank(TILE_W, b.h);
  const plot = (x: number, y: number, c: string) => dot(line, x, y, c);
  const stamp = (rows: Rows, x: number, t: Tones, lift: number) =>
    put(line, fromRows(rows, { l: t[2], G: t[1], g: t[0] }), x, MEADOW - rows.length + 1 - lift);
  // groups of trees with open fields between: [x, kinds] (r round, R big round, p poplar, P pine)
  const groups: ReadonlyArray<readonly [number, string]> = [
    [0, 'Rr'],
    [20, 'pp'],
    [46, 'rP'],
    [118, 'Rrp'],
    [138, 'p'],
    [184, 'rRr'],
    [212, 'pp'],
  ];
  const rounds = [green, orange, olive, rust, gold];
  for (const [gx, kinds] of groups) {
    let x = gx;
    for (let i = 0; i < kinds.length; i++) {
      const k = kinds[i];
      const lift = Math.floor(h2(gx, i, 40) * 2);
      if (k === 'p') {
        stamp(POPLAR, x, gold, lift);
        x += 3;
      } else if (k === 'P') {
        stamp(PINE, x, pines, lift);
        x += 5;
      } else {
        const r = k === 'R' ? 3.4 : 2.6;
        foliage(plot, [[x + r, MEADOW + 0.5 - r - lift, r]], rounds[Math.floor(h2(gx, i, 41) * rounds.length)]);
        x += Math.round(r * 1.7);
      }
    }
  }
  despeckle(line);
  blit(b, line, 0, 0);
}

/** Filler under the tree line (the farmyard covers it). */
function drawMeadow(b: PixelBuf): void {
  const [, mid, lit] = tones('#86983f', HAZE.near);
  for (let x = 0; x < TILE_W; x++) {
    for (let y = MEADOW; y < b.h; y++) dot(b, x, y, y === MEADOW ? lit : mid);
  }
}

// ================================================================== mid

/** A view row as a mid-layer row. */
const my = (row: number): number => row - MID_SPOT.y;
/** The farmyard's far edge (the far fields show above it). */
const YARD = my(49);
/** Where buildings meet the ground: their bottom ink row. */
const BASE = my(54);

/** Farmyard grass, gone golden: deep and shade lean blue-green, lit and tips lean warm. */
const GRASS = {
  deep: '#3f5236',
  shade: '#596c3c',
  base: '#7b8c44',
  lit: '#9fa64e',
  tip: '#c9be68',
  far: '#8c9a50',
  farDim: '#7d8d4a',
  farRim: '#b2b062',
  cast: '#66773f',
  core: '#526338',
};
const DIRT = { deep: '#6a4a40', shade: '#8f664c', base: '#ae8258', lit: '#c99f6c', pale: '#dcb985' };

// ------------------------------------------------------------------ the barn

const BARN_PAINT: Record<string, string> = {
  // boards: lit edge, face, shadow line, deep shadow under the eaves
  e: '#d4573f', R: '#b53b39', r: '#8c2d3a', b: '#6b2539',
  // door boards
  y: '#c0453c', O: '#9e3239', o: '#7b2737',
  // white trim
  W: '#f5e9d5', '5': '#cbbccb', '4': '#a698ad',
  // the roof's edge: weathered slate
  V: '#7f7a98', U: '#605b7b', u: '#4a4563', '1': '#38324e',
  // fieldstone foundation
  A: '#d2c6c1', '3': '#a3979f', '2': '#786d84',
  // hay in the loft
  T: '#f3d57e', t: '#d9a74b', N: '#a6743c',
  // the dark loft, iron, the lamp
  k: '#3d2229', S: '#3e3443', g: '#3c5a48', G: '#5e8064', L: '#ffe6a6',
  // windows: white frames, glass, muntins
  x: '#f5e9d5', c: '#55709a', C: '#b6d1e6', w: '#e9dccb',
};

/** Barn windows: frame x (white), glass c / C, muntins w. */
const BARN_WINDOW: Rows = [
  'xxxxxxx',
  'xCCwCcx',
  'xCcwccx',
  'xwwwwwx',
  'xccwccx',
  'xxxxxxx',
];

/** Rows of the barn sketch. */
const B_VANE = 5;
const B_PEAK = 11;
const B_KNEE = B_PEAK + 6;
const B_EAVE = B_KNEE + 7;
const B_WALL = B_EAVE + 1;
const B_DOOR = B_WALL + 4;
const B_FOUND = B_DOOR + 12;
const B_H = B_FOUND + 2;
const B_W = 42;

/** The gambrel's half-width at a row (offsets from the two center columns, 1 = the peak). */
function gambrel(r: number): number {
  if (r < B_PEAK) return 0;
  if (r <= B_KNEE) return 1 + 2 * (r - B_PEAK);
  if (r < B_EAVE) return 13 + (r - B_KNEE);
  if (r === B_EAVE) return 21;
  return 19;
}

/**
 * The red barn, gable end on: a gambrel roof (its edge in slate over white trim), a cupola on the
 * ridge, the open hay loft with its pulley beam, X-braced doors on a track, a gooseneck lamp over
 * them, two windows and a fieldstone foundation. Board-and-batten walls: battens lit on the left.
 */
function barnSketch(): { rows: Rows; lamp: readonly [number, number] } {
  const s = new Sketch(B_W, B_H);
  const off = (x: number): number => (x <= 20 ? 21 - x : x - 20);
  const board = (x: number, r: number): string => {
    const i = (x + 1) % 3;
    if (i === 0) return 'e';
    if (i === 2) return 'r';
    // a few boards weathered paler or darker
    const k = Math.floor((x + 1) / 3);
    const w = hash01(k * 17 + 5);
    if (w < 0.12 && r % 7 < 5) return 'e';
    return 'R';
  };
  // gable, roof edge and trim
  for (let r = B_PEAK; r <= B_EAVE; r++) {
    for (let x = 0; x < B_W; x++) {
      const o = off(x);
      if (o > gambrel(r)) continue;
      const left = x <= 20;
      if (o > gambrel(r - 2)) {
        const outer = o === gambrel(r) || r === B_PEAK;
        s.set(x, r, outer ? (left ? 'V' : 'u') : (r - B_PEAK) % 2 === 0 ? (left ? 'U' : '1') : left ? 'V' : 'u');
      } else if (o > gambrel(r - 3)) {
        s.set(x, r, left ? 'W' : '5');
      } else {
        s.set(x, r, o > gambrel(r - 4) ? 'b' : board(x, r));
      }
    }
  }
  // walls under the eaves: eave shadow, corner boards
  for (let r = B_WALL; r < B_FOUND; r++) for (let x = 2; x <= 39; x++) s.set(x, r, r === B_WALL ? 'b' : board(x, r));
  for (let r = B_WALL; r < B_FOUND; r++) {
    s.set(2, r, 'W');
    s.set(39, r, '5');
  }
  // the cupola on the ridge: a little hip roof, trim, a louvered vent
  s.rect(20, B_VANE, 2, 1, 'V');
  s.set(21, B_VANE, 'u');
  s.rect(19, B_VANE + 1, 4, 1, 'U');
  s.set(19, B_VANE + 1, 'V');
  s.set(22, B_VANE + 1, 'u');
  s.rect(18, B_VANE + 2, 6, 1, 'U');
  s.set(18, B_VANE + 2, 'V');
  s.set(23, B_VANE + 2, '1');
  s.rect(18, B_VANE + 3, 6, 1, 'W');
  s.set(23, B_VANE + 3, '5');
  for (let r = B_VANE + 4; r <= B_PEAK; r++) {
    s.set(19, r, 'e');
    s.set(20, r, (r - B_VANE) % 2 === 0 ? 'S' : 'k');
    s.set(21, r, (r - B_VANE) % 2 === 0 ? 'S' : 'k');
    s.set(22, r, 'r');
  }
  // the hay loft: an open door in a white frame, hay heaped inside, straws over the sill
  const lx = 17;
  const ly = B_PEAK + 3;
  for (let r = ly; r <= ly + 6; r++) {
    for (let x = lx; x <= lx + 7; x++) {
      const edge = r === ly || r === ly + 6 || x === lx || x === lx + 7;
      s.set(x, r, edge ? (x === lx + 7 || r === ly + 6 ? '5' : 'W') : 'k');
    }
  }
  const hay = ['..TTt.', '.TTtTN', 'TtTtNN'];
  hay.forEach((row, i) => {
    for (let k = 0; k < row.length; k++) if (row[k] !== '.') s.set(lx + 1 + k, ly + 3 + i, row[k]);
  });
  s.set(lx + 2, ly + 7, 'T');
  s.set(lx + 5, ly + 7, 't');
  s.set(lx + 5, ly + 8, 't');
  // the pulley beam under the peak
  s.set(20, B_PEAK + 1, 'S');
  s.set(21, B_PEAK + 1, 'S');
  s.set(21, B_PEAK + 2, 'S');
  // the gooseneck lamp over the doors: an arm, an enamel shade, the bulb
  s.set(21, B_WALL + 0, 'S');
  s.set(21, B_WALL + 1, 'S');
  s.rect(19, B_WALL + 2, 4, 1, 'g');
  s.set(19, B_WALL + 2, 'G');
  s.rect(20, B_WALL + 3, 2, 1, 'L');
  const lamp = [20, B_WALL + 3] as const;
  // the door track and the two X-braced leaves
  s.rect(11, B_DOOR - 1, 20, 1, 'S');
  for (const x0 of [13, 21]) {
    for (let r = B_DOOR; r < B_FOUND; r++) {
      for (let x = x0; x < x0 + 8; x++) {
        const fr = x === x0 || x === x0 + 7 || r === B_DOOR || r === B_FOUND - 1;
        let c = fr ? (x === x0 + 7 || r === B_FOUND - 1 ? '5' : 'W') : x % 2 === 0 ? 'O' : (x + 1) % 4 === 0 ? 'o' : 'y';
        if (!fr && (x - x0) % 2 === 1) c = 'O';
        s.set(x, r, c);
      }
    }
    s.line(x0 + 1, B_DOOR + 1, x0 + 6, B_FOUND - 2, 'W');
    s.line(x0 + 6, B_DOOR + 1, x0 + 1, B_FOUND - 2, 'W');
    // the track's rollers
    s.set(x0 + 1, B_DOOR - 1, 'A');
    s.set(x0 + 6, B_DOOR - 1, 'A');
  }
  // windows with sills
  for (const wx of [4, 31]) {
    s.stamp(BARN_WINDOW, wx, B_DOOR + 1);
    s.rect(wx - 1, B_DOOR + 1 + BARN_WINDOW.length, BARN_WINDOW[0].length + 2, 1, 'W');
    s.set(wx + BARN_WINDOW[0].length, B_DOOR + 1 + BARN_WINDOW.length, '5');
  }
  // fieldstone foundation: courses of stones with mortar, lit on top
  for (let r = B_FOUND; r < B_H; r++) {
    for (let x = 1; x <= 40; x++) {
      if (x >= 13 && x <= 28) {
        s.set(x, r, r === B_FOUND ? 'S' : '2');
        continue;
      }
      const off2 = r === B_FOUND ? 0 : 2;
      const joint = (x + off2) % 4 === 0;
      s.set(x, r, joint ? '2' : r === B_FOUND ? 'A' : '3');
    }
  }
  return { rows: s.rows(), lamp };
}

const BARN = barnSketch();

/** The weathervane (a rooster on an arrow), drawn over the inked barn in iron. */
const VANE: Rows = [
  '.k...kk',
  'kkk.kk.',
  '.kkkkk.',
  '...k...',
  'k.kkkkk',
  '...k...',
];

function barnBuf(): PixelBuf {
  const b = inked(BARN.rows, BARN_PAINT);
  const vane = fromRows(VANE, { k: '#3b3140' });
  blit(b, vane, 1 + 20 - 3, 0);
  return b;
}

// ------------------------------------------------------------------ the silo

/**
 * A concrete stave silo: a cylinder lit from the top left (a highlight band left of center, shade
 * to the right), iron hoops every few rows, a ladder, and a galvanized dome with a vent cap.
 */
function siloBuf(h: number): PixelBuf {
  const W = 13;
  const b = blank(W, h);
  const wall = ['#6f6785', '#9b90a4', '#c4b7b6', '#e4d8c8', '#f6ecdc'];
  const dome = ['#5c6286', '#7f88a6', '#a7b2c6', '#cfd8e2', '#f2f6f8'];
  const tone = (ramp: readonly string[], u: number, v: number, bias: number) => {
    const d = sphereLight(u, v) + bias;
    return ramp[d < -0.15 ? 0 : d < 0.18 ? 1 : d < 0.46 ? 2 : d < 0.7 ? 3 : 4];
  };
  const DOME = 6;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - W / 2) / (W / 2);
      if (y < DOME) {
        // a squat dome: half an ellipse
        const v = (y + 0.5 - DOME) / DOME;
        if (u * u + v * v > 1) continue;
        setPx(b, x, y, tone(dome, u, v, 0.05));
        continue;
      }
      let c = tone(wall, u, 0, 0);
      // hoops every 4 rows: a dark band with a lit glint on the left
      if ((y - DOME) % 4 === 3) c = u < -0.35 ? wall[3] : u < 0.3 ? wall[1] : wall[0];
      if (y === DOME) c = u < 0.2 ? dome[2] : dome[0];
      setPx(b, x, y, c);
    }
  }
  // the vent cap on the dome
  setPx(b, 6, 0, dome[3]);
  // a ladder up the right of center
  for (let y = DOME + 2; y < h - 2; y++) {
    setPx(b, 8, y, '#5a4f63');
    setPx(b, 10, y, '#4a405a');
    if (y % 2 === 0) setPx(b, 9, y, '#6a5f70');
  }
  const out = ink(b);
  // the vent's little top over the ink line
  setPx(out, 7, 0, INK);
  return out;
}

// ------------------------------------------------------------------ the scarecrow

/**
 * The scarecrow: straw hat with a blue band, a burlap head with button eyes and a stitched grin,
 * a plaid shirt on the crossbar with straw at the cuffs, patched overalls on the pole. A crow sits
 * on his right arm.
 */
const SCARECROW: Rows = [
  '......TTt..........',
  '.....TTTtt.........',
  '.....uuuuu.........',
  '...TTTTTtttN.......',
  '....SSSSSn.....vv..',
  '....WxsxSn....OvVv.',
  '....WsssSn.....vvv.',
  '....WxxxSn.....v.v.',
  '...Y.WsSn.Y........',
  'YyeeRReRrRRerRrRryY',
  '.yRrRRrRRrRRrRRrRy.',
  '....eRRrRRr........',
  '....cUUyUUu........',
  '....cUUUUUu........',
  '....cUPPUUu........',
  '....cUu.cUu........',
  '....cUunuUu........',
  '....YyyNYyY........',
  '.......Nn..........',
  '.......Nn..........',
  '.......Nn..........',
  '.......Nn..........',
  '.......Nn..........',
];

const SCARECROW_PAINT: Record<string, string> = {
  T: '#f2d27c', t: '#d4a44c', N: '#9c6c3e', n: '#6c4a3e',
  u: '#3e5f9a',
  W: '#e8d2a8', s: '#cfae7e', S: '#a8845e', x: '#3b2a2e',
  Y: '#f6dc8a', y: '#d2a650',
  e: '#e8794a', R: '#c4473c', r: '#7e2c3c',
  c: '#7c9fd0', U: '#4f72ae', P: '#d9a77a',
  v: '#3a3346', V: '#5c5470', O: '#e6a03c',
};

// ------------------------------------------------------------------ pumpkins

const PUMPKIN = ['#7e3224', '#b8501f', '#e57b25', '#fba443', '#ffd27e'] as const;

/**
 * A pumpkin, squat and ribbed: lobes lit on their left, grooves between them, the whole lit from the
 * top left, a green stem on top (2 rows above the body).
 */
function pumpkin(w: number, h: number, seed: number): PixelBuf {
  const b = blank(w, h + 2);
  const lobes = Math.max(2, Math.round(w / 2.6));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5 - w / 2) / (w / 2);
      const v = (y + 0.5 - h / 2) / (h / 2);
      if (Math.abs(u) ** 2.4 + Math.abs(v) ** 2 > 1) continue;
      const t = (((u + 1) / 2) * lobes) % 1;
      let d = sphereLight(u, v) * 0.8 + (0.5 - t) * 0.45;
      const groove = t < 1 / (w / lobes) && x > 0 && Math.floor(((u + 1) / 2) * lobes) > 0;
      if (groove) d -= 0.45;
      const k = d < -0.25 ? 0 : d < 0.12 ? 1 : d < 0.42 ? 2 : d < 0.68 ? 3 : 4;
      setPx(b, x, y + 2, PUMPKIN[k]);
    }
  }
  const sx = Math.floor(w / 2) - (seed % 2);
  setPx(b, sx, 1, '#6d7c34');
  setPx(b, sx, 0, '#8e9a42');
  if (w >= 6) setPx(b, sx + 1, 0, '#5a6630');
  return ink(b);
}

// ------------------------------------------------------------------ trees

type Blob = readonly [cx: number, cy: number, r: number];

/**
 * A leafy crown. Round clumps (listed back to front) make the silhouette. Light from the top left
 * shades it on three scales: the whole crown as one ball, each clump, and leaf clusters (cells of a
 * staggered, jittered grid) lit on their top left, so edges and tone changes read as bunches of
 * leaves; the underside is darker still. Five tones, `bias` shifting them lighter or darker.
 */
function crown(w: number, h: number, blobs: readonly Blob[], tones5: readonly string[], seed: number, cell = 3.2, bias = 0): PixelBuf {
  const b = blank(w, h);
  const gx0 = Math.min(...blobs.map(([cx, , r]) => cx - r));
  const gx1 = Math.max(...blobs.map(([cx, , r]) => cx + r));
  const gy0 = Math.min(...blobs.map(([, cy, r]) => cy - r));
  const gy1 = Math.max(...blobs.map(([, cy, r]) => cy + r));
  const gcx = (gx0 + gx1) / 2;
  const gcy = (gy0 + gy1) / 2;
  const grx = (gx1 - gx0) / 2 + 0.5;
  const gry = (gy1 - gy0) / 2 + 0.5;
  const centers: Array<readonly [number, number]> = [];
  const rowH = cell * 0.82;
  for (let j = -1; j <= Math.ceil(h / rowH) + 1; j++) {
    for (let i = -1; i <= Math.ceil(w / cell) + 1; i++) {
      const k = (j + 7) * 101 + (i + 7) * 7 + seed * 1013;
      centers.push([(i + (j % 2 ? 0.5 : 0)) * cell + (hash01(k) - 0.5) * cell * 0.45, j * rowH + (hash01(k + 1) - 0.5) * rowH * 0.45]);
    }
  }
  const front = (x: number, y: number): number => {
    let k = -1;
    blobs.forEach(([cx, cy, r], i) => {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) k = i;
    });
    return k;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let near = 0;
      let best = Infinity;
      centers.forEach(([cx, cy], k) => {
        const d = (px - cx) ** 2 + (py - cy) ** 2;
        if (d < best) {
          best = d;
          near = k;
        }
      });
      const [ccx, ccy] = centers[near];
      let i = front(px, py);
      if (i < 0) {
        const ci = front(ccx, ccy);
        if (ci < 0 || best > (cell * 0.7) ** 2) continue;
        i = ci;
      }
      const [bx, by, r] = blobs[i];
      let d = 0.55 * sphereLight((px - gcx) / grx, (py - gcy) / gry) + 0.45 * sphereLight((px - bx) / r, (py - by) / r);
      d -= ((px - ccx) / cell) * 0.3 + ((py - ccy) / cell) * 0.5;
      if (front(px - 2.2, py - 2.6) > i) d -= 0.4;
      d -= Math.max(0, (py - gcy) / gry - 0.55) * 0.9;
      d += bias;
      const t = d < -0.3 ? 0 : d < 0.06 ? 1 : d < 0.36 ? 2 : d < 0.58 ? 3 : 4;
      setPx(b, x, y, tones5[t]);
    }
  }
  despeckle(b);
  return b;
}

const BARK = { dark: '#4a3340', mid: '#6e4a44', lit: '#9a6c50' };

/** A tree: a crown over a trunk forking into two limbs under the leaves, a root flare, all inked. */
function tree(crownBuf: PixelBuf, trunkX: number, trunkH: number): PixelBuf {
  const w = crownBuf.w;
  const top = crownBuf.h;
  const b = blank(w, top + trunkH);
  const bottom = b.h - 1;
  for (let y = top - 4; y <= bottom; y++) {
    setPx(b, trunkX, y, BARK.lit);
    setPx(b, trunkX + 1, y, (bottom - y) % 4 === 2 ? BARK.dark : BARK.mid);
    setPx(b, trunkX + 2, y, BARK.dark);
  }
  setPx(b, trunkX - 1, bottom, BARK.mid);
  setPx(b, trunkX + 3, bottom, BARK.dark);
  blit(b, crownBuf, 0, 0);
  setPx(b, trunkX - 1, top - 1, BARK.mid);
  setPx(b, trunkX + 3, top - 1, BARK.dark);
  setPx(b, trunkX - 2, top - 2, BARK.dark);
  setPx(b, trunkX + 4, top - 2, BARK.dark);
  return ink(b);
}

/** Sugar maple leaves in October: burgundy shade, rust, orange, gold, pale gold. */
const MAPLE_LEAF = ['#7a2c38', '#b2442f', '#dc7230', '#f2a43e', '#ffd47a'] as const;

const MAPLE = (): PixelBuf =>
  tree(
    crown(31, 24, [[6, 15, 5.5], [24, 15, 5.5], [9, 8, 6], [21, 7.5, 6], [15.5, 5.5, 5.5], [15.5, 15, 7], [15.5, 11, 6.5]], MAPLE_LEAF, 7, 3.1),
    14,
    9,
  );

// ------------------------------------------------------------------ hay

const HAY = ['#7e5634', '#a8763e', '#d4a64e', '#efcd78', '#fff0b4'] as const;

/**
 * A round bale lying on its side, its rolled end facing us (a spiral of hay, lit top left) and the
 * curve of its side running off to the right in shade.
 */
function roundBale(r: number, side: number): PixelBuf {
  const d = Math.ceil(r * 2);
  const b = blank(d + side, d);
  const c = r;
  for (let y = 0; y < d; y++) {
    // the side: horizontal straw, lit along the top, shaded underneath
    for (let x = Math.floor(c); x < d + side; x++) {
      const v = (y + 0.5 - c) / r;
      if (Math.abs(v) > 0.97) continue;
      const k = v < -0.55 ? 2 : v < 0.2 ? 1 : 0;
      setPx(b, x, y, HAY[k + ((x + y) % 5 === 0 ? 1 : 0)]);
    }
    for (let x = 0; x < d; x++) {
      const u = (x + 0.5 - c) / r;
      const v = (y + 0.5 - c) / r;
      const rr = Math.hypot(u, v);
      if (rr > 1) continue;
      const ang = Math.atan2(v, u);
      const ring = Math.floor(rr * r * 1.1 + ang / Math.PI + 4) % 2;
      let lv = sphereLight(u * 0.6, v * 0.6) * 0.7 + 0.25;
      if (ring === 1) lv -= 0.28;
      if (rr > 0.82) lv -= 0.12;
      setPx(b, x, y, HAY[lv < 0.05 ? 1 : lv < 0.38 ? 2 : lv < 0.62 ? 3 : 4]);
    }
  }
  return ink(b);
}

/** Square bales stacked in a pyramid: 3, 2, 1, each with two twine bands. */
function baleStack(): PixelBuf {
  const BW = 7;
  const BH = 4;
  const b = blank(BW * 3, BH * 3);
  const bale = (x0: number, y0: number) => {
    for (let y = 0; y < BH; y++) {
      for (let x = 0; x < BW; x++) {
        let c: string = y === 0 ? HAY[3] : y === BH - 1 ? HAY[1] : HAY[2];
        if (x === BW - 1) c = HAY[1];
        if (x === 0 && y > 0) c = HAY[3];
        if ((x === 2 || x === 4) && y > 0) c = y === BH - 1 ? HAY[0] : HAY[1];
        if (y === 1 && (x + y0) % 3 === 0 && x > 0 && x < BW - 1 && x !== 2 && x !== 4) c = HAY[4];
        setPx(b, x0 + x, y0 + y, c);
      }
    }
  };
  bale(0, BH * 2);
  bale(BW, BH * 2);
  bale(BW * 2, BH * 2);
  bale(Math.floor(BW / 2), BH);
  bale(Math.floor(BW / 2) + BW, BH);
  bale(BW, 0);
  return ink(b);
}

// ------------------------------------------------------------------ fences, windpump, trough

const WOOD = { lit: '#c8a27a', mid: '#9a7458', shade: '#6e5048', dark: '#4e3842' };

/**
 * A post-and-rail fence, `n` bays of 8 columns: posts two pixels wide (lit left), two rails each a
 * lit top over a shaded underside; inked.
 */
function fence(n: number): PixelBuf {
  const w = n * 8 + 2;
  const h = 8;
  const b = blank(w, h);
  for (const ry of [1, 4]) {
    for (let x = 0; x < w; x++) {
      setPx(b, x, ry, WOOD.lit);
      setPx(b, x, ry + 1, WOOD.shade);
    }
  }
  for (let i = 0; i <= n; i++) {
    const x = i * 8;
    for (let y = 0; y < h; y++) {
      setPx(b, x, y, y === 0 ? WOOD.lit : WOOD.mid);
      setPx(b, x + 1, y, y === 0 ? WOOD.mid : WOOD.shade);
    }
  }
  return ink(b);
}

/**
 * A windpump: a lattice tower of galvanized iron (two legs converging, girts and cross braces), its
 * wheel of blades facing us, a red tail vane on its boom, the pump rod down the middle.
 */
function windpump(): PixelBuf {
  const W = 21;
  const H = 40;
  const s = new Sketch(W, H);
  const cx = 8;
  const top = 12;
  const base = H - 1;
  // legs: from 5 either side of center at the base to 1 at the top
  const legX = (y: number, side: number) => cx + side * (1 + Math.round(((y - top) / (base - top)) * 5));
  for (let y = top; y <= base; y++) {
    s.set(legX(y, -1), y, '4');
    s.set(legX(y, 1), y, '2');
  }
  // girts and cross braces, every 7 rows
  for (let y0 = top + 3; y0 + 7 <= base; y0 += 7) {
    const y1 = y0 + 7;
    for (let x = legX(y0, -1); x <= legX(y0, 1); x++) s.set(x, y0, '3');
    s.line(legX(y0, -1), y0, legX(y1, 1), y1, '2');
    s.line(legX(y0, 1), y0, legX(y1, -1), y1, '2');
  }
  for (let x = legX(base, -1); x <= legX(base, 1); x++) if (x % 2 === 0) s.set(x, base, '3');
  // the pump rod
  for (let y = top; y <= base; y++) if (s.at(cx, y) === '.') s.set(cx, y, '1');
  // the platform under the head
  s.rect(cx - 3, top, 7, 1, '3');
  s.set(cx - 3, top, '4');
  // the tail vane on its boom, off to the right
  s.rect(cx + 2, top - 6, 7, 1, '2');
  for (let y = top - 10; y <= top - 4; y++) {
    const w = 4 - Math.floor(Math.abs(y - (top - 7)) / 2);
    for (let x = 0; x < w; x++) s.set(cx + 9 + x, y, x === 0 ? 'e' : y < top - 7 ? 'R' : 'r');
  }
  // the wheel: blades in a ring around the hub, every other one catching the light
  const wy = top - 6;
  for (let y = wy - 7; y <= wy + 7; y++) {
    for (let x = cx - 7; x <= cx + 7; x++) {
      const u = x - cx;
      const v = y - wy;
      const r = Math.hypot(u, v);
      if (r > 7.2 || r < 1.5) continue;
      const a = Math.atan2(v, u);
      const blade = Math.floor(((a + Math.PI) / (2 * Math.PI)) * 18) % 2;
      if (r > 6.3) s.set(x, y, '2');
      else s.set(x, y, blade ? (u + v < 0 ? 'W' : '4') : u + v < 0 ? '3' : '2');
    }
  }
  s.rect(cx - 1, wy - 1, 3, 3, '1');
  s.set(cx - 1, wy - 1, '3');
  const b = fromRows(s.rows(), {
    W: '#eef0f4', '4': '#b9b6c8', '3': '#8a87a0', '2': '#5e5a76', '1': '#423e58',
    e: '#e2694e', R: '#c4473f', r: '#8e2f3c',
  });
  return ink(b);
}

/** A wooden water trough holding the sky. */
const TROUGH: Rows = [
  'TttttttttttN',
  'tCCcCCCcCcCN',
  'tNNNNNNNNNNn',
  'tNtNNNNNNtNn',
  '.n........n.',
];
const TROUGH_PAINT = { T: WOOD.lit, t: WOOD.mid, N: WOOD.shade, n: WOOD.dark, C: '#f0d6a8', c: '#9c90c0' };

// ------------------------------------------------------------------ the yard

/**
 * The farmyard: the far edge lit, hazier grass behind the buildings, then grass with soft slanted
 * mowing stripes, textured with short strokes a step lighter or darker.
 */
function yard(b: PixelBuf): void {
  for (let y = YARD; y < b.h; y++) {
    const runs = runIds(40 + y, 2, 5);
    for (let x = 0; x < TILE_W; x++) {
      const r = hash01(runs[x] * 7 + y * 131);
      let c: string;
      if (y === YARD) c = r < 0.3 ? GRASS.far : GRASS.farRim;
      else if (y < BASE - 1) c = r < 0.2 ? GRASS.farDim : GRASS.far;
      else c = r < 0.14 ? GRASS.shade : r > 0.9 ? GRASS.lit : GRASS.base;
      dot(b, x, y, c);
    }
  }
}

/** A soft shadow on the grass: an ellipse with a darker core. */
function grassShadow(b: PixelBuf, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    if (y <= YARD || y >= b.h) continue;
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const e = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (e <= 1) dot(b, x, y, e < 0.4 ? GRASS.core : GRASS.cast);
    }
  }
}

/** Bare earth: a worn patch in front of the barn doors, widening toward the road. */
function dirtPatch(b: PixelBuf, x0: number, x1: number, y0: number): void {
  for (let y = y0; y < b.h; y++) {
    const grow = Math.floor((y - y0) / 2);
    for (let x = x0 - grow; x <= x1 + grow; x++) {
      const edge = x === x0 - grow || x === x1 + grow;
      const r = h2(Math.floor(x / 3), y, 77);
      dot(b, x, y, edge ? GRASS.shade : r < 0.2 ? DIRT.shade : r > 0.85 ? DIRT.lit : DIRT.base);
    }
  }
}

/** Where things stand in the mid tile (left edges before inking). */
const SILO_X = 2;
const BARN_X = 10;
const PATCH_X = 92;
const MAPLE_X = 142;
const PUMP_X = 202;

function midLayer(): PixelBuf {
  const b = blank(TILE_W, MID_SPOT.h);
  yard(b);

  const barn = barnBuf();
  const silo = siloBuf(48);
  const maple = MAPLE();
  const pump = windpump();

  // shadows on the grass, to the right of things (light from the top left)
  grassShadow(b, BARN_X + barn.w + 3, BASE - 0.5, 9, 1.6);
  grassShadow(b, MAPLE_X + 22, BASE + 2, 12, 1.8);

  // the worn earth in front of the barn doors
  dirtPatch(b, BARN_X + 14, BARN_X + 29, BASE);

  // fences along the back of the yard
  plant(b, fence(4), 64, YARD + 3);
  plant(b, fence(7), 120, YARD + 3);
  plant(b, fence(3), 184, YARD + 3);

  // the silo behind the barn, then the barn
  plant(b, silo, SILO_X, BASE - 1);
  plant(b, barn, BARN_X, BASE);
  plant(b, baleStack(), BARN_X + barn.w - 2, BASE + 1);

  // the pumpkin patch: soil rows, vines, pumpkins of all sizes; the scarecrow over it
  for (let y = BASE - 2; y <= BASE + 2; y++) {
    for (let x = PATCH_X - 2 + (BASE + 2 - y); x < PATCH_X + 36 - (BASE + 2 - y); x++) {
      dot(b, x, y, (y + Math.floor(x / 5)) % 2 === 0 ? DIRT.shade : DIRT.deep);
    }
  }
  plant(b, inked(SCARECROW, SCARECROW_PAINT), PATCH_X + 9, BASE + 1);
  const pumpkins: ReadonlyArray<readonly [number, number, number, number]> = [
    [PATCH_X, BASE + 1, 6, 4],
    [PATCH_X + 7, BASE + 3, 8, 5],
    [PATCH_X + 22, BASE + 2, 5, 4],
    [PATCH_X + 27, BASE + 3, 7, 5],
    [PATCH_X + 17, BASE + 3, 4, 3],
  ];
  pumpkins.forEach(([x, base, w, h], i) => plant(b, pumpkin(w, h, i), x, base));

  // the maple with round bales in its shade
  plant(b, maple, MAPLE_X, BASE + 1);
  plant(b, roundBale(3.5, 3), MAPLE_X + 30, BASE + 2);
  plant(b, roundBale(3.5, 3), MAPLE_X + 40, BASE + 3);

  // the windpump and its trough
  plant(b, pump, PUMP_X, BASE);
  plant(b, inked(TROUGH, TROUGH_PAINT), PUMP_X + 13, BASE + 2);
  return b;
}

/** The barn's windows and lamp, in mid-layer pixels (the barn is inked: its art sits 1 px in). */
function midLights(): LightSpot[] {
  const top = BASE - (BARN.rows.length + 2) + 1;
  const windows = windowsOf(BARN.rows).map((w): LightSpot => ({ ...w, x: wrap(BARN_X + 1 + w.x), y: top + 1 + w.y, kind: 'window' }));
  const [lx, ly] = BARN.lamp;
  const lamp: LightSpot = {
    x: wrap(BARN_X + 1 + lx),
    y: top + 1 + ly,
    w: 2,
    h: 1,
    kind: 'lamp',
    color: '#FFD08A',
    radius: 7,
    power: 1,
    pool: { x: BARN_X + 1 + lx + 1, y: BASE + 1.5, rx: 9, ry: 2 },
  };
  return [...windows, lamp];
}

// ================================================================== ground

/** A view row as a ground-layer row. */
const gy = (row: number): number => row - GROUND_SPOT.y;
/** The far verge's solid top (blades reach above it), the road, the calm rows under the feet. */
const VERGE = 57;
const ROAD0 = 62;
const ROAD1 = 72;
const CALM0 = FEET_ROW + 1;
const CALM1 = 70;
/** The near verge and the wheat field's edge. */
const NEAR0 = 73;
const FIELD = 77;
const BOTTOM = VIEW.h - 1;

const ROAD = { deep: '#6e4c44', rut: '#8a6250', shade: '#a27a58', base: '#bf9566', lit: '#d4ad7a', pale: '#e4c592', pebble: '#ead7b4', pebbleDark: '#8e7a80' };
const VG = { deep: '#3c4c34', shade: '#56693a', base: '#778a42', lit: '#9ca54c', tip: '#c8bf66' };
const WHEAT = ['#8c5f34', '#b8843c', '#dcae4e', '#f2d27a', '#fff0b0'] as const;

const calm = (row: number): boolean => row >= CALM0 - 1 && row <= CALM1;

function groundLayer(): PixelBuf {
  const b = blank(TILE_W, GROUND_SPOT.h);
  farVerge(b);
  road(b);
  nearVerge(b);
  despeckle(b);
  roadDetails(b);
  vergeDetails(b);
  mailbox(b);
  return b;
}

/** The far verge: tall grass in clumps, its blades breaking up over the farmyard. */
function farVerge(b: PixelBuf): void {
  const runs = runIds(61, 2, 4);
  for (let x = 0; x < TILE_W; x++) {
    const top = VERGE - Math.floor(hash01(runs[x] * 3 + 610) * 3);
    for (let row = top; row < ROAD0; row++) {
      let c = row <= top + 1 ? VG.lit : row >= ROAD0 - 1 ? VG.shade : VG.base;
      if (row === top && hash01(runs[x] * 5 + 611) < 0.4) c = VG.tip;
      dot(b, x, gy(row), c);
    }
  }
  // blades poking up over the top
  for (let x = 0; x < TILE_W; x++) {
    if (h2(x, 1, 62) < 0.16 && h2(x - 1, 1, 62) >= 0.16) {
      const top = VERGE - 3 - Math.floor(h2(x, 2, 62) * 2);
      for (let row = top; row < VERGE; row++) dot(b, x, gy(row), row === top ? VG.tip : VG.lit);
    }
  }
}

/** The road: packed dirt, a rut each side of a calm crown, the edges falling off to the verges. */
function road(b: PixelBuf): void {
  const runs = runIds(71, 2, 6);
  for (let row = ROAD0; row <= ROAD1; row++) {
    for (let x = 0; x < TILE_W; x++) {
      const r = hash01(runs[(x + row * 3) % TILE_W] * 7 + row * 131);
      let c = ROAD.base;
      if (row === ROAD0) c = ROAD.shade;
      else if (row === ROAD0 + 1 || row === ROAD0 + 2) c = row === ROAD0 + 1 ? ROAD.rut : ROAD.lit;
      else if (row === ROAD1 - 1) c = ROAD.rut;
      else if (row === ROAD1) c = ROAD.lit;
      else if (!calm(row) && r < 0.12) c = ROAD.shade;
      else if (!calm(row) && r > 0.9) c = ROAD.lit;
      else if (calm(row)) c = row === CALM0 - 1 ? ROAD.base : ROAD.base;
      dot(b, x, gy(row), c);
    }
  }
}

/** The near verge: grass, then the wheat field's edge down to the bottom of the view. */
function nearVerge(b: PixelBuf): void {
  const runs = runIds(81, 1, 3);
  for (let x = 0; x < TILE_W; x++) {
    const edge = FIELD + Math.floor(hash01(runs[x] + 8100) * 2);
    for (let row = NEAR0; row <= BOTTOM; row++) {
      let c: string;
      if (row < edge) c = row === NEAR0 ? VG.shade : row === NEAR0 + 1 ? VG.lit : VG.base;
      else {
        const k = (x + Math.floor(row / 2)) % 3;
        c = row === edge ? WHEAT[3] : k === 0 ? WHEAT[1] : k === 1 ? WHEAT[2] : WHEAT[3];
        if (row >= BOTTOM - 1) c = k === 0 ? WHEAT[0] : WHEAT[1];
      }
      dot(b, x, gy(row), c);
    }
  }
}

function roadDetails(b: PixelBuf): void {
  // pebbles: a lit top over a dark bottom, clear of the rows under the feet
  for (let row = ROAD0 + 2; row < ROAD1 - 1; row++) {
    if (calm(row)) continue;
    for (let x = 0; x < TILE_W; x++) {
      if (h2(x, row, 90) < 0.985) continue;
      dot(b, x, gy(row), ROAD.pebble);
      dot(b, x + 1, gy(row), ROAD.pale);
      dot(b, x, gy(row + 1), ROAD.pebbleDark);
      dot(b, x + 1, gy(row + 1), ROAD.shade);
    }
  }
  // fallen leaves blown onto the road
  const leaves: ReadonlyArray<readonly [number, number, string, string]> = [
    [22, 64, '#e8853a', '#b04a2e'],
    [97, 71, '#f2b84a', '#c47a30'],
    [161, 65, '#d8603a', '#963a34'],
    [207, 71, '#f0a040', '#b45a2e'],
  ];
  for (const [x, row, lit, dark] of leaves) {
    dot(b, x, gy(row), lit);
    dot(b, x + 1, gy(row), dark);
  }
}

function vergeDetails(b: PixelBuf): void {
  // wildflowers in the far verge: goldenrod plumes, chicory, asters
  const flowers: ReadonlyArray<readonly [number, number, string, string]> = [
    [14, 58, '#f6d24a', '#d09a2a'],
    [41, 59, '#9cb8f0', '#6a7fd0'],
    [76, 58, '#f6d24a', '#d09a2a'],
    [118, 59, '#f4eef4', '#c8b8d8'],
    [149, 58, '#c89ae8', '#9468c8'],
    [188, 59, '#f6d24a', '#d09a2a'],
    [226, 58, '#9cb8f0', '#6a7fd0'],
  ];
  for (const [x, row, lit, dark] of flowers) {
    dot(b, x, gy(row), lit);
    dot(b, x + 1, gy(row), dark);
    dot(b, x, gy(row - 1), lit);
    dot(b, x, gy(row + 1), VG.shade);
  }
  // blades over the road's far edge and up from the near edge
  for (let x = 0; x < TILE_W; x++) {
    if (h2(x, 3, 63) < 0.14 && h2(x - 1, 3, 63) >= 0.14) dot(b, x, gy(ROAD0), VG.shade);
    if (h2(x, 4, 64) < 0.18 && h2(x - 1, 4, 64) >= 0.18) {
      dot(b, x, gy(ROAD1), VG.lit);
      dot(b, x, gy(ROAD1 - 1), VG.tip);
    }
  }
}

/** A farm mailbox on a weathered post, its red flag up. */
const MAILBOX: Rows = [
  '.....RR',
  '.5555Re',
  '5WW55R.',
  '5W554R.',
  '444433.',
  '..tN...',
  '..tN...',
  '..tN...',
  '..tN...',
  '..tN...',
  '.ttNn..',
];
const MAILBOX_X = 4;

function mailbox(b: PixelBuf): void {
  const box = inked(MAILBOX, {
    '5': '#9fa0b8', W: '#d8dae6', '4': '#787a94', '3': '#5c5e78',
    R: '#c8423c', e: '#ea6a4e', t: WOOD.lit, N: WOOD.mid, n: WOOD.shade,
  });
  plant(b, box, MAILBOX_X, gy(VERGE + 2));
}

// ================================================================== fg

/** Tall grass tufts: blade tips lit, darkening toward the roots. */
const TUFTS: readonly Rows[] = [
  ['...L...', '.L.lG.L', '.lGlGGl', 'lGGGGGg', 'gggGggg'],
  ['..L.', 'L.lG', 'lGGg', 'gggg'],
  ['.L...L..', '.lL.lG.L', 'llGllGGl', 'GGGGGGgg', 'gggggggg'],
];

/** A wheat stalk: the ear (grains lit on the left), a long stem. */
const WHEAT_STALK: Rows = ['.Y.', 'YyO', 'YyO', '.yO', '..y', '..y', '..o', '..o', '..o'];

/** Wildflowers: petals and a heart on a stem (recolor w / y for other kinds). */
const FLOWER: Rows = ['.w.', 'wyw', '.w.', '.G.', '.G.'];

function fgLayer(): PixelBuf {
  const H = FG_SPOT.h;
  const b = blank(TILE_W, H);
  const greens = { L: VG.tip, l: VG.lit, G: VG.base, g: VG.shade };
  const tufts = TUFTS.map((t) => inked(t, greens));
  const stalk = inked(WHEAT_STALK, { Y: WHEAT[4], y: WHEAT[3], O: WHEAT[2], o: WHEAT[1] });
  const flowers = [
    inked(FLOWER, { w: '#f6f0f2', y: '#f2c23c', G: VG.shade }),
    inked(FLOWER, { w: '#9cb8f0', y: '#f4eef4', G: VG.shade }),
    inked(FLOWER, { w: '#f6d24a', y: '#d0782a', G: VG.shade }),
  ];
  // [x, what]: tufts (0 to 2), wheat (3), flowers (4 to 6); sparse
  const items: ReadonlyArray<readonly [number, number]> = [
    [6, 2], [16, 3],
    [62, 4], [66, 1],
    [104, 3], [107, 3], [112, 0],
    [158, 5],
    [180, 2], [190, 6],
    [222, 3], [226, 1],
  ];
  for (const [x, what] of items) {
    const s = what < 3 ? tufts[what] : what === 3 ? stalk : flowers[what - 4];
    put(b, s, x, H - s.h + 1, what < 3 && h2(x, 0, 9) < 0.5);
  }
  return b;
}

// ================================================================== the set

export const FARM: ScenerySet = {
  tileW: TILE_W,
  layers: { far: FAR_SPOT, mid: MID_SPOT, ground: GROUND_SPOT, fg: FG_SPOT },
  scroll0: { far: 0, mid: 6, ground: 0, fg: 0 },
  sky: true,
  graded: false,
  far: farLayer,
  mid: midLayer,
  ground: groundLayer,
  fg: fgLayer,
  lights: () => ({ far: farLights(), mid: midLights() }),
};

/** The four layers at full width, for tools/pixelSheet.ts. */
export function sheet(): SheetEntry[] {
  return [
    { name: 'far', buf: FARM.far() },
    { name: 'mid', buf: FARM.mid() },
    { name: 'ground', buf: FARM.ground() },
    { name: 'fg', buf: FARM.fg() },
  ];
}
