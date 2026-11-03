/**
 * World 5's battle backdrop, "Funky Farmland": a harvest farm in golden late-afternoon light (style
 * rules: docs/PIXEL_ART.md). Four horizontally tiling layers, TILE_W art pixels wide, on the battle
 * grid (sceneryTypes.ts: VIEW, the fighters' feet on FEET_ROW). Rows below are view rows.
 *  - far (24 to 53): the countryside in depth bands that get hazier with distance, nothing inked:
 *    a pale violet range, a misty ridge, then rolling hills of patchwork fields (golden wheat,
 *    stubble with round bales, plowed rows, an orchard, pasture) between hedgerows, a windmill, a far
 *    farmstead whose windows light up, a pond holding the sky, and loose groups of autumn trees.
 *  - mid (2 to 59): the farmyard, inked like the animals: the big red barn (gambrel roof, cupola and
 *    rooster weathervane, open hay loft, X-braced doors, a gooseneck lamp) with the silo behind it,
 *    a pumpkin patch with a scarecrow and his crow, a sugar maple with round bales by a post-and-rail
 *    fence, and a windpump over a water trough, with plenty of open grass between. The opening shot
 *    puts the barn behind the hero and keeps the yard behind the enemies open, under the sun.
 *  - ground (52 to 81): the dirt farm road the fighters stand on (62 to 72, feet on 67) with its ruts,
 *    a verge of tall autumn grass and wildflowers on the far side (a mailbox), and on the near side
 *    grass running into the edge of a wheat field. Rows 67 to 70 (feet and HP bars) stay calm:
 *    plain dirt with only faint long strokes.
 *  - fg (73 to 81): a few grass tufts, wildflowers and wheat ears along the bottom.
 * The set keeps its own colors (not graded); each world's sky, haze, rim light and ambient go on
 * top. Light comes from the top left; ramps are hue-shifted (warm lights, cool violet shadows).
 */
import { blank, blit, clone, fromRows, hash01, mix, outline, setPx, type PixelBuf, type Rows, type SheetEntry } from './buf';
import { FEET_ROW, VIEW, type LightSpot, type ScenerySet } from './sceneryTypes';
import { despeckle, foliage, plant, put, windowsOf } from './street/common';

// ------------------------------------------------------------------ layout

/** Width of every layer, in art pixels; each layer repeats seamlessly. */
const TILE_W = 260;

/** Where each layer sits in the view: top row and height. */
const FAR_SPOT = { y: 24, h: 30 } as const;
const MID_SPOT = { y: 2, h: 58 } as const;
const GROUND_SPOT = { y: 52, h: VIEW.h - 52 } as const;
const FG_SPOT = { y: 73, h: VIEW.h - 73 } as const;

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
const HAZE = { range: 0.46, ridge: 0.34, back: 0.16, near: 0.08, trees: 0.06 } as const;

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

/** The far range, palest (low around the sun, x 80 to 110 in the opening shot), then the misty ridge. */
const RANGE = skyline(fy(39), [
  [16, 30, 7],
  [58, 18, 4],
  [136, 34, 8],
  [196, 26, 5],
  [240, 18, 3],
]);
const RIDGE = skyline(fy(41), [
  [36, 26, 4],
  [104, 22, 2],
  [168, 30, 5],
  [226, 20, 3],
]);
/** Back hills: patchwork fields, the windmill on the hill around MILL_X. */
const MILL_X = 66;
const BACK = skyline(fy(45), [
  [8, 24, 4],
  [MILL_X, 26, 8.5],
  [130, 26, 4],
  [186, 30, 6.5],
  [236, 18, 3],
]);
/** Near hills: fields, the orchard and the farmstead on the hill around FARM_X. */
const FARM_X = 168;
const NEAR = skyline(fy(48), [
  [28, 32, 3.5],
  [104, 20, 1],
  [FARM_X, 30, 5],
  [226, 22, 2],
]);
/** The meadow under the tree line (the farmyard covers it from view row 50). */
const MEADOW = fy(50);

let farBuilt: PixelBuf | null = null;

function buildFar(): PixelBuf {
  if (farBuilt) return farBuilt;
  const b = blank(TILE_W, FAR_SPOT.h);
  drawPlain(b, RANGE, HAZE.range, '#8f88c8', 5, false);
  drawPlain(b, RIDGE, HAZE.ridge, '#7b8bb2', 5, true);
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
  const fog = hz(mix(base, WARM, 0.12), haze + 0.18);
  for (let x = 0; x < TILE_W; x++) {
    for (let y = crest[x]; y < b.h; y++) {
      const d = y - crest[x];
      const l = lightAt(crest, x, d, 1 + reach, reach);
      let c = l > 0 ? lit : l < 0 ? shade : mid;
      if (d === 0) c = l < 0 ? mid : rim;
      if (mist && y >= fy(41) + (h2(Math.floor(x / 4), 0, 2) < 0.5 ? 0 : 1)) c = fog;
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
  bale: Tones;
  reach: number;
  seed: number;
}

function cropSet(haze: number) {
  return {
    pasture: tones('#76994a', haze),
    pale: tones('#a8b45c', haze),
    wheat: tones('#e0b44c', haze),
    stubble: tones('#d2b26e', haze),
    soil: tones('#a0684a', haze, 0.25),
    dark: tones('#5a8046', haze),
    rust: tones('#c47a3e', haze),
    orchard: tones('#86a04c', haze),
  };
}

const CB = cropSet(HAZE.back);
const BACK_FIELDS: Fields = {
  rows: [0.36, 0.7],
  cols: [12, 36, 58, 86, 108, 134, 154, 186, 206, 232],
  lean: 0.7,
  crops: [
    [{ tones: CB.pasture }, { tones: CB.wheat }, { tones: CB.dark }],
    [{ tones: CB.stubble, kind: 'bales' }, { tones: CB.pasture }],
    [{ tones: CB.pale }, { tones: CB.soil, kind: 'rows' }, { tones: CB.pasture }],
    [{ tones: CB.wheat, kind: 'rows' }, { tones: CB.dark }],
    [{ tones: CB.dark }, { tones: CB.rust }, { tones: CB.wheat }],
    [{ tones: CB.pasture }, { tones: CB.stubble }],
    [{ tones: CB.soil, kind: 'rows' }, { tones: CB.pasture }],
    [{ tones: CB.pale }, { tones: CB.wheat, kind: 'rows' }, { tones: CB.dark }],
    [{ tones: CB.wheat }, { tones: CB.pasture }],
    [{ tones: CB.pasture }, { tones: CB.rust }],
  ],
  rim: hz(mix('#d7d47a', WARM, 0.4), HAZE.back),
  hedge: tones('#4a6a3c', HAZE.back, 0.3),
  hedgeTrees: [tones('#5a7c3c', HAZE.back, 0.3), tones('#d0803a', HAZE.back, 0.3), tones('#c2a03e', HAZE.back, 0.3)],
  bale: tones('#e2b85c', HAZE.back, 0.3),
  reach: 4,
  seed: 10,
};

const CN = cropSet(HAZE.near);
const NEAR_FIELDS: Fields = {
  rows: [0.45],
  cols: [4, 46, 74, 96, 122, 150, 186, 210],
  lean: 1,
  crops: [
    [{ tones: CN.pasture }, { tones: CN.pale }],
    [{ tones: CN.wheat, kind: 'rows' }, { tones: CN.pasture }],
    [{ tones: CN.pale }, { tones: CN.stubble, kind: 'bales' }],
    [{ tones: CN.pasture }],
    [{ tones: CN.soil, kind: 'rows' }, { tones: CN.pale }],
    [{ tones: CN.pasture }, { tones: CN.orchard, kind: 'orchard' }],
    [{ tones: CN.stubble, kind: 'bales' }, { tones: CN.pasture }],
    [{ tones: CN.pale }, { tones: CN.wheat, kind: 'rows' }],
  ],
  rim: hz(mix('#d7d47a', WARM, 0.4), HAZE.near),
  hedge: tones('#466238', HAZE.near, 0.3),
  hedgeTrees: [tones('#54783a', HAZE.near, 0.3), tones('#d4823a', HAZE.near, 0.3), tones('#c9a23e', HAZE.near, 0.3), tones('#ac4e38', HAZE.near, 0.3)],
  bale: tones('#e8bc5c', HAZE.near, 0.3),
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
      if (h2(x, k, f.seed + 2) < 0.87 || h2(x - 1, k, f.seed + 2) >= 0.87 || h2(x - 2, k, f.seed + 2) >= 0.87) continue;
      tree(x, line(x, k), f.hedgeTrees[Math.floor(h2(x, k, f.seed + 3) * f.hedgeTrees.length)]);
    }
  }
  // orchards: rows of little round trees; stubble: round bales, lit on the left, a shadow on the right
  for (let x = 0; x < TILE_W; x++) {
    for (let y = 0; y < b.h; y++) {
      if (y <= crest[x] + 1) continue;
      const { crop, top } = cropAt(x, y);
      if (crop.kind === 'orchard') {
        if (y - top < 2 || (y - top) % 3 !== 2 || wrap(x + (y - top)) % 4 !== 0) continue;
        tree(x, y, f.hedgeTrees[(Math.floor(x / 4) + y) % 2]);
      } else if (crop.kind === 'bales') {
        if (y - top < 1 || (y - top) % 3 !== 1 || wrap(x + (y - top) * 3) % 6 !== 0 || h2(x, y, f.seed + 4) < 0.3) continue;
        dot(b, x, y, f.bale[2]);
        dot(b, x + 1, y, f.bale[1]);
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
  's.........s',
  'Ss.......sS',
  '.Ss.....sS.',
  '..Ss.R.sS..',
  '....RRr....',
  '...sWW5s...',
  '..sS.W5.Ss.',
  '.sS.WW55.Ss',
  'sS..WW55..S',
  '...WWW55...',
  '...WxW55...',
  '..WWWW555..',
  '..WWxx555..',
];

function drawMill(b: PixelBuf): void {
  const haze = HAZE.back;
  const map = {
    S: hz('#efe0c8', haze), s: hz('#6e5a62', haze),
    R: hz('#b04e46', haze), r: hz('#723744', haze),
    W: hz('#efe2cc', haze), '5': hz('#a8949f', haze), x: hz('#45384a', haze),
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
  '.WxWnW5x55.',
];
const FAR_BARN: Rows = [
  '..eRRr..',
  '.eeRRrr.',
  'eeeRRrrr',
  '.RRWWrr.',
  '.RWnnWr.',
  '.RWnnWr.',
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

/** The farmstead's buildings: [rows, x offset from FARM_X, how far below the crest its base sits, colors]. */
const FARMSTEAD: ReadonlyArray<readonly [Rows, number, number, Record<string, string>]> = (() => {
  const haze = HAZE.near + 0.04;
  const house = {
    e: hz('#d8705a', haze), R: hz('#b04a44', haze), r: hz('#7c3444', haze), b: hz('#6b4a4a', haze),
    W: hz('#f3e8d6', haze), '5': hz('#c2b4c4', haze), x: hz('#4a4058', haze), n: hz('#6e4a3e', haze),
  };
  const barn = {
    e: hz('#cf5a46', haze), R: hz('#a83c3c', haze), r: hz('#7a2c3e', haze),
    W: hz('#f3e8d6', haze), n: hz('#5a2e36', haze),
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

/** The farmhouse's window pixels, in far-layer pixels; a share light up at dusk and night. */
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

/** A pond in the hollow below the sun, holding the sky: gold on top, a bright glint, violet under. */
const POND_X = 92;
function drawPond(b: PixelBuf): void {
  const y0 = fy(47);
  const rows: ReadonlyArray<readonly [number, number, string]> = [
    [4, 13, hz('#f4d39a', 0.1)],
    [1, 19, hz('#e6b48e', 0.1)],
    [3, 15, hz('#a592bc', 0.1)],
  ];
  rows.forEach(([x0, w, c], i) => {
    for (let k = 0; k < w; k++) {
      let cc = c;
      if (i === 1 && k >= 8 && k < 13) cc = hz('#fff1c4', 0.05);
      if (i === 0 && k >= 6 && k < 9) cc = hz('#fff1c4', 0.08);
      if (i === 2 && k >= 9 && k < 11) cc = hz('#e8c49a', 0.1);
      dot(b, POND_X + x0 + k, y0 + i, cc);
    }
  });
  // reeds at the ends
  const reed = NEAR_FIELDS.hedge;
  dot(b, POND_X + 1, y0, reed[1]);
  dot(b, POND_X + 1, y0 - 1, reed[2]);
  dot(b, POND_X + 19, y0 + 1, reed[0]);
  dot(b, POND_X + 19, y0, reed[1]);
}

// ------------------------------------------------------------------ far trees

/** Poplars, golden in autumn, lit on the left. */
const POPLAR: Rows = [
  '.l.',
  '.lG',
  'lGg',
  'lGg',
  'lGg',
  'lGg',
  '.Gg',
  '.g.',
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
  const orange = tones('#d27a34', haze, 0.3);
  const rust = tones('#ac4a36', haze, 0.3);
  const gold = tones('#c49a44', haze + 0.04, 0.3);
  const pines = tones('#3e6040', haze * 0.8, 0.3);
  const line = blank(TILE_W, b.h);
  const plot = (x: number, y: number, c: string) => dot(line, x, y, c);
  const stamp = (rows: Rows, x: number, t: Tones, lift: number) =>
    put(line, fromRows(rows, { l: t[2], G: t[1], g: t[0] }), x, MEADOW - rows.length + 1 - lift);
  // groups of trees with open fields between: [x, kinds] (r round, R big round, p poplar, P pine)
  const groups: ReadonlyArray<readonly [number, string]> = [
    [0, 'Rr'],
    [24, 'p'],
    [48, 'rP'],
    [103, 'Pr'],
    [128, 'r'],
    [146, 'p'],
    [200, 'rR'],
    [232, 'pp'],
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
const YARD = my(50);
/** Where buildings meet the ground: their bottom ink row. */
const BASE = my(54);

/** Farmyard grass, gone golden: deep and shade lean blue-green, lit and tips lean warm. */
const GRASS = {
  shade: '#596c3c',
  base: '#7b8c44',
  lit: '#9fa64e',
  far: '#8b9a50',
  farDim: '#7e8e4a',
  farRim: '#b6b366',
  cast: '#67783f',
  core: '#536438',
};
const DIRT = { deep: '#6a4a40', shade: '#8f664c', base: '#ae8258', lit: '#c99f6c' };

// ------------------------------------------------------------------ the barn

const BARN_PAINT: Record<string, string> = {
  // boards: lit edge, face, shadow line, deep shadow under the eaves
  e: '#d4573f', R: '#b53b39', r: '#8c2d3a', b: '#6b2539',
  // door boards
  y: '#a8363a', O: '#943039', o: '#74263a',
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

/** Rows of the barn sketch: the weathervane's space, the cupola, the gambrel, walls, doors, footing. */
const B_VANE = 9;
const B_PEAK = B_VANE + 8;
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
    // a few boards weathered paler
    const k = Math.floor((x + 1) / 3);
    if (hash01(k * 17 + 5) < 0.12 && r % 7 < 5) return 'e';
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
  // the cupola on the ridge: a little hip roof over trim, a louvered vent in red walls
  const c0 = B_VANE;
  s.rect(20, c0, 2, 1, 'V');
  s.set(21, c0, 'u');
  s.rect(19, c0 + 1, 4, 1, 'U');
  s.set(19, c0 + 1, 'V');
  s.set(22, c0 + 1, 'u');
  s.rect(18, c0 + 2, 6, 1, 'U');
  s.set(18, c0 + 2, 'V');
  s.set(19, c0 + 2, 'V');
  s.set(22, c0 + 2, 'u');
  s.set(23, c0 + 2, '1');
  s.rect(17, c0 + 3, 8, 1, 'u');
  s.set(17, c0 + 3, 'U');
  s.rect(18, c0 + 4, 6, 1, 'W');
  s.set(23, c0 + 4, '5');
  for (let r = c0 + 5; r < B_PEAK + 1; r++) {
    s.set(18, r, 'e');
    s.set(23, r, 'r');
    for (let x = 19; x <= 22; x++) s.set(x, r, (r - c0) % 2 === 0 ? (x < 21 ? 'W' : '5') : 'k');
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
  s.set(21, B_EAVE, 'S');
  s.set(21, B_WALL, 'S');
  s.rect(19, B_WALL + 1, 4, 1, 'g');
  s.set(19, B_WALL + 1, 'G');
  s.rect(20, B_WALL + 2, 2, 1, 'L');
  const lamp = [20, B_WALL + 2] as const;
  // the door track and the two X-braced leaves: white frames and braces on dark red boards
  s.rect(11, B_DOOR - 1, 20, 1, 'S');
  for (const x0 of [13, 21]) {
    for (let r = B_DOOR; r < B_FOUND; r++) {
      for (let x = x0; x < x0 + 8; x++) {
        const fr = x === x0 || x === x0 + 7 || r === B_DOOR || r === B_FOUND - 1;
        const c = fr ? (x === x0 + 7 || r === B_FOUND - 1 ? '5' : 'W') : (x - x0) % 2 === 1 ? 'y' : 'O';
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
  // fieldstone foundation: courses of stones with mortar, lit on top; a sill under the doors
  for (let r = B_FOUND; r < B_H; r++) {
    for (let x = 1; x <= 40; x++) {
      if (x >= 13 && x <= 28) {
        s.set(x, r, r === B_FOUND ? 'S' : '2');
        continue;
      }
      const joint = (x + (r === B_FOUND ? 0 : 2)) % 4 === 0;
      s.set(x, r, joint ? '2' : r === B_FOUND ? 'A' : '3');
    }
  }
  return { rows: s.rows(), lamp };
}

const BARN = barnSketch();

/** The weathervane: a rooster over the compass arrow, on a rod (drawn over the inked barn, in iron). */
const VANE: Rows = [
  '...x......',
  '..xxx...x.',
  '.xxxx..xx.',
  '...xxxxxx.',
  '...xxxxx..',
  '....xxx...',
  '.x...x....',
  'xxxxxxxxxx',
  '.x...x...x',
  '.....x....',
];

function barnBuf(): PixelBuf {
  const b = inked(BARN.rows, BARN_PAINT);
  // the rod stands on the cupola's peak (sketch column 20, plus the ink margin)
  blit(b, fromRows(VANE, { x: '#3b3140' }), 1 + 20 - 5, 0);
  return b;
}

// ------------------------------------------------------------------ the silo

/**
 * A concrete stave silo: a cylinder lit from the top left (a highlight band left of center, shade
 * to the right), hoops every few rows, a ladder, and a galvanized dome with a vent cap; inked.
 */
function siloBuf(h: number): PixelBuf {
  const W = 13;
  const b = blank(W + 2, h);
  const wall = ['#675c7d', '#887d9a', '#ae9fa9', '#d2c1b5', '#ebdccb'];
  const metal = ['#525a80', '#7680a2', '#a0acc3', '#cad5df', '#f1f5f7'];
  const COLS = [3, 4, 4, 3, 3, 3, 3, 2, 2, 2, 1, 1, 0];
  const DOME = 7;
  for (let y = 1; y < DOME; y++) {
    for (let x = 0; x < W + 2; x++) {
      const u = (x + 0.5 - (W + 2) / 2) / ((W + 2) / 2);
      const v = (y + 0.5 - DOME) / (DOME - 1);
      if (u * u + v * v > 1.02) continue;
      const d = sphereLight(u, v);
      let k = d > 0.85 ? 4 : d > 0.62 ? 3 : d > 0.32 ? 2 : d > 0 ? 1 : 0;
      if (y === DOME - 1) k = Math.max(0, k - 1);
      setPx(b, x, y, metal[k]);
    }
  }
  setPx(b, 6, 0, metal[3]);
  setPx(b, 7, 0, metal[2]);
  setPx(b, 8, 0, metal[1]);
  for (let y = DOME; y < h; y++) {
    for (let x = 0; x < W; x++) {
      let k = COLS[x];
      if (y === DOME) k = Math.max(0, k - 2);
      else if ((y - DOME) % 5 === 4) k = Math.max(0, k - 1);
      if (y >= h - 2) k = Math.max(0, k - 1);
      setPx(b, x + 1, y, wall[k]);
    }
    if (y > DOME + 1 && y < h - 2) {
      setPx(b, 9, y, wall[Math.max(0, COLS[8] - 2)]);
      setPx(b, 11, y, wall[0]);
      if ((y - DOME) % 3 === 0) setPx(b, 10, y, wall[Math.max(0, COLS[9] - 1)]);
    }
  }
  return ink(b);
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
  '....WxssxS....OvVv.',
  '....WsssSn.....vvv.',
  '....WxSSxn.....v.v.',
  '...Y.WxxSnY........',
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
const LEAF = ['#3f6638', '#5d8a3e', '#86ad4a', '#b8c862'] as const;

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

/** A big pumpkin leaf (lit on its top left), inked. */
const PUMPKIN_LEAF: Rows = [
  '.lL..',
  'lLlG.',
  'lGGgg',
  '.Ggg.',
];
const LEAF_PAINT = { L: LEAF[3], l: LEAF[2], G: LEAF[1], g: LEAF[0] };

/**
 * The pumpkin patch: hilled soil, vines and big leaves, pumpkins of all sizes, the scarecrow keeping
 * watch over it. `x` is its left edge; it is about 40 columns wide.
 */
function pumpkinPatch(b: PixelBuf, x: number): void {
  for (let y = BASE - 1; y <= BASE + 3; y++) {
    const inset = Math.max(0, BASE - y + 1) * 2;
    for (let xx = x + inset; xx < x + 40 - inset; xx++) {
      const hill = (xx - x + Math.floor((y - BASE) / 2) * 3) % 8;
      dot(b, xx, y, y === BASE - 1 || hill === 0 ? DIRT.deep : hill < 3 ? DIRT.base : DIRT.shade);
    }
  }
  // vines along the rows
  for (let xx = x + 2; xx < x + 38; xx++) if (h2(xx, 0, 51) < 0.55) dot(b, xx, BASE + (xx % 5 < 2 ? 0 : 1), LEAF[0]);
  const leaf = inked(PUMPKIN_LEAF, LEAF_PAINT);
  for (const [lx, base, flip] of [[x + 3, BASE, false], [x + 14, BASE - 1, true], [x + 25, BASE, false], [x + 33, BASE - 1, true]] as const) {
    plant(b, leaf, lx, base, flip);
  }
  plant(b, inked(SCARECROW, SCARECROW_PAINT), x + 18, BASE + 1);
  const pumpkins: ReadonlyArray<readonly [number, number, number, number]> = [
    [x + 1, BASE + 1, 6, 4],
    [x + 8, BASE + 3, 8, 5],
    [x + 18, BASE + 2, 4, 3],
    [x + 25, BASE + 3, 7, 5],
    [x + 33, BASE + 2, 5, 4],
  ];
  pumpkins.forEach(([px, base, w, h], i) => plant(b, pumpkin(w, h, i), px, base));
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

const maple = (): PixelBuf =>
  tree(
    crown(31, 24, [[6, 15, 5.5], [24, 15, 5.5], [9, 8, 6], [21, 7.5, 6], [15.5, 5.5, 5.5], [15.5, 15, 7], [15.5, 11, 6.5]], MAPLE_LEAF, 7, 3.1),
    14,
    9,
  );

// ------------------------------------------------------------------ hay

const HAY = ['#7a5232', '#a5733c', '#cf9f4a', '#ebc671', '#fbe7a6'] as const;

/**
 * A round bale lying on its side: its rolled end facing us (rings, lit on the upper left) and the
 * curve of its side running back to the right, lit along the top, with streaks of straw.
 */
function roundBale(r: number, side: number): PixelBuf {
  const d = Math.round(r * 2);
  const b = blank(d + side, d);
  const c = d / 2;
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d + side; x++) {
      const v = (y + 0.5 - c) / r;
      const inBack = ((x + 0.5 - c - side) / r) ** 2 + v * v <= 1;
      const inMid = x + 0.5 >= c && x + 0.5 <= c + side && Math.abs(v) <= 1;
      if (!inBack && !inMid) continue;
      let k = v < -0.55 ? 3 : v < 0 ? 2 : v < 0.5 ? 1 : 0;
      if (hash01(Math.floor((x + y * 2) / 3) * 7 + y * 13) < 0.22 && k > 0) k -= 1;
      setPx(b, x, y, HAY[k]);
    }
  }
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      const u = (x + 0.5 - c) / r;
      const v = (y + 0.5 - c) / r;
      const rr = Math.hypot(u, v) * r;
      if (rr > r) continue;
      const litSide = u + v < 0.15;
      let k = litSide ? 4 : 3;
      if (rr > r - 1) k = litSide ? 3 : 2;
      if (Math.abs(rr - r * 0.55) < 0.5) k = litSide ? 2 : 1;
      if (rr < 0.9) k = 1;
      setPx(b, x, y, HAY[k]);
    }
  }
  return ink(b);
}

// ------------------------------------------------------------------ fences, windpump, trough

const WOOD = { hi: '#dcbf96', lit: '#c09c76', mid: '#987862', shade: '#705858', dark: '#523f4a' };

/**
 * A post-and-rail fence of weathered wood, `n` bays: posts two pixels wide (lit left, a lit cap),
 * two rails each a lit top over a shaded underside, outlined in dark wood (lighter than ink, so the
 * fence stays in the background).
 */
function fence(n: number): PixelBuf {
  const bay = 9;
  const w = n * bay + 2;
  const h = 8;
  const b = blank(w, h);
  for (const ry of [1, 4]) {
    for (let x = 0; x < w; x++) {
      setPx(b, x, ry, WOOD.lit);
      setPx(b, x, ry + 1, WOOD.mid);
    }
  }
  for (let i = 0; i <= n; i++) {
    const x = i * bay;
    for (let y = 0; y < h; y++) {
      setPx(b, x, y, y === 0 ? WOOD.hi : WOOD.lit);
      setPx(b, x + 1, y, y === 0 ? WOOD.lit : WOOD.shade);
    }
  }
  return outline(b, WOOD.dark);
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
  const legX = (y: number, side: number) => cx + side * (1 + Math.round(((y - top) / (base - top)) * 5));
  for (let y = top; y <= base; y++) {
    s.set(legX(y, -1), y, '4');
    s.set(legX(y, 1), y, '2');
  }
  for (let y0 = top + 3; y0 + 7 <= base; y0 += 7) {
    const y1 = y0 + 7;
    for (let x = legX(y0, -1); x <= legX(y0, 1); x++) s.set(x, y0, '3');
    s.line(legX(y0, -1), y0, legX(y1, 1), y1, '2');
    s.line(legX(y0, 1), y0, legX(y1, -1), y1, '2');
  }
  for (let x = legX(base, -1); x <= legX(base, 1); x++) if (x % 2 === 0) s.set(x, base, '3');
  for (let y = top; y <= base; y++) if (s.at(cx, y) === '.') s.set(cx, y, '1');
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
const TROUGH_PAINT = { T: WOOD.hi, t: WOOD.lit, N: WOOD.mid, n: WOOD.shade, C: '#f0d6a8', c: '#9c90c0' };

// ------------------------------------------------------------------ the yard

/**
 * The farmyard: the far edge lit, hazier grass behind the buildings, then grass textured with short
 * strokes a step lighter or darker.
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
const SILO_X = 4;
const BARN_X = 12;
const PATCH_X = 100;
const MAPLE_X = 160;
const PUMP_X = 222;

function midLayer(): PixelBuf {
  const b = blank(TILE_W, MID_SPOT.h);
  yard(b);

  const barn = barnBuf();
  const tree1 = maple();
  const pump = windpump();

  // shadows on the grass, to the right of things (light from the top left)
  grassShadow(b, BARN_X + barn.w + 2, BASE - 0.5, 8, 1.4);
  grassShadow(b, MAPLE_X + 22, BASE + 2, 12, 1.8);
  grassShadow(b, PUMP_X + 16, BASE + 1, 7, 1.2);

  // the worn earth in front of the barn doors
  dirtPatch(b, BARN_X + 14, BARN_X + 29, BASE);

  // fences along the back of the yard
  plant(b, fence(7), 148, YARD + 4);

  // the silo behind the barn, then the barn
  plant(b, siloBuf(48), SILO_X, BASE - 1);
  plant(b, barn, BARN_X, BASE);

  // the pumpkin patch and its scarecrow
  pumpkinPatch(b, PATCH_X);

  // the maple with round bales in its shade, its fallen leaves on the grass
  for (let i = 0; i < 9; i++) {
    const lx = MAPLE_X + 4 + Math.floor(h2(i, 1, 81) * 36);
    const ly = BASE - 1 + Math.floor(h2(i, 2, 81) * 5);
    const k = 2 + Math.floor(h2(i, 3, 81) * 3);
    dot(b, lx, ly, MAPLE_LEAF[k]);
    dot(b, lx + 1, ly, MAPLE_LEAF[k - 1]);
  }
  plant(b, tree1, MAPLE_X, BASE + 1);
  plant(b, roundBale(5, 4), MAPLE_X + 27, BASE + 2);
  plant(b, roundBale(4, 3), MAPLE_X + 37, BASE + 3);

  // the windpump and its trough
  plant(b, pump, PUMP_X, BASE);
  plant(b, inked(TROUGH, TROUGH_PAINT), PUMP_X + 12, BASE + 2);
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
/**
 * The far verge's base row (its clumps peak up to 4 rows above it, a few seed heads up to row 52),
 * the road, and the calm rows under the feet and the HP bars.
 */
const VERGE = 59;
const ROAD0 = 62;
const ROAD1 = 72;
const CALM0 = FEET_ROW;
const CALM1 = 70;
/** The near verge and the wheat field's edge. */
const NEAR0 = 73;
const FIELD = 76;
const BOTTOM = VIEW.h - 1;

const ROAD = { deep: '#6c4a44', rut: '#8a6250', shade: '#a27a58', soft: '#b68d62', base: '#bd9466', lit: '#d2ab78', pale: '#e2c391', pebble: '#ecdcbc', pebbleDark: '#8a7680' };
/** Verge grass, green and gone to straw. */
const VG = { deep: '#3c4c34', shade: '#56693a', base: '#778a42', lit: '#9ca54c', tip: '#c8bf66' };
const DRY = { shade: '#97743e', base: '#c09a4e', lit: '#dcbc68', tip: '#f0da92' };
const WHEAT = ['#8a5c34', '#b6823c', '#d9ab4c', '#f0cf78', '#fff0b0'] as const;

const calm = (row: number): boolean => row >= CALM0 && row <= CALM1;

function groundLayer(): PixelBuf {
  const b = blank(TILE_W, GROUND_SPOT.h);
  farVerge(b);
  road(b);
  nearVerge(b);
  roadDetails(b);
  vergeFlowers(b);
  mailbox(b);
  return b;
}

/**
 * The far verge: clumps of tall grass, some still green and some gone to straw, peaked in the middle
 * and spiky along the top (blades of uneven heights, tips lit), darker toward the roots; a shadow
 * where it meets the road, and a few taller stalks with seed heads.
 */
function farVerge(b: PixelBuf): void {
  const clumps = runIds(61, 4, 8);
  const start: number[] = [];
  for (let x = 0, s0 = 0; x < TILE_W; x++) {
    if (x === 0 || clumps[x] !== clumps[x - 1]) s0 = x;
    start.push(s0);
  }
  for (let x = 0; x < TILE_W; x++) {
    const id = clumps[x];
    let len = 0;
    while (clumps[wrap(start[x] + len)] === id && len < 12) len++;
    const t = (x - start[x] + 0.5) / len;
    const dry = hash01(id * 3 + 600) < 0.4;
    const k = dry ? DRY : VG;
    const peak = 2 + Math.floor(hash01(id * 3 + 601) * 3);
    const blade = (x + id) % 2 === 0 ? 0 : 1;
    const top = VERGE - Math.max(0, Math.round(peak * (1 - Math.abs(2 * t - 1) ** 1.6)) - blade);
    for (let row = top; row < ROAD0; row++) {
      let c = row === top ? k.tip : row === top + 1 ? k.lit : row >= ROAD0 - 1 ? VG.deep : row >= ROAD0 - 2 ? k.shade : k.base;
      // blade strokes: every other column a step darker below the tips
      if (row > top + 1 && row < ROAD0 - 2 && blade === 1 && row % 3 !== 0) c = k.shade;
      dot(b, x, gy(row), c);
    }
  }
  // a few taller stalks: a bare stem with a seed head (foxtail) or a plume
  for (let x = 0; x < TILE_W; x++) {
    if (h2(x, 1, 62) >= 0.09 || h2(x - 1, 1, 62) < 0.09 || h2(x - 2, 1, 62) < 0.09) continue;
    const dry = h2(x, 3, 62) < 0.6;
    const k = dry ? DRY : VG;
    const top = VERGE - 5 - Math.floor(h2(x, 2, 62) * 3);
    for (let row = top + 2; row < ROAD0 - 1; row++) dot(b, x, gy(row), row < VERGE - 2 ? k.shade : VG.shade);
    dot(b, x, gy(top), k.tip);
    dot(b, x, gy(top + 1), k.lit);
    dot(b, x + 1, gy(top + 1), k.base);
  }
}

/** The road: packed dirt, a rut each side of a calm crown, a lip of light on the near edge. */
function road(b: PixelBuf): void {
  const runs = runIds(71, 3, 7);
  // under the feet and the HP bars only long, faint strokes, a hair darker than the dirt
  const calmRuns = runIds(73, 6, 12);
  // soft patches of drier (lighter) and packed (darker) dirt, wider than tall
  const patch = (x: number, row: number): number => {
    const cx = Math.floor(x / 9);
    const u = (x % 9) / 9;
    const a = h2(cx * 9, row >> 1, 72);
    const bb = h2(cx * 9 + 9, row >> 1, 72);
    return a + (bb - a) * u;
  };
  for (let row = ROAD0; row <= ROAD1; row++) {
    for (let x = 0; x < TILE_W; x++) {
      const r = hash01(runs[wrap(x + row * 5)] * 7 + row * 131);
      let c = ROAD.base;
      if (row === ROAD0) c = ROAD.deep;
      else if (row === ROAD0 + 1) c = r < 0.3 ? ROAD.shade : ROAD.base;
      else if (row === ROAD0 + 2) c = r < 0.2 ? ROAD.deep : ROAD.rut;
      else if (row === ROAD0 + 3) c = r < 0.25 ? ROAD.pale : ROAD.lit;
      else if (row === ROAD1 - 1) c = r < 0.2 ? ROAD.deep : ROAD.rut;
      else if (row === ROAD1) c = ROAD.lit;
      else if (!calm(row)) {
        const p = patch(x, row);
        c = p > 0.72 ? ROAD.lit : p < 0.22 ? ROAD.shade : r < 0.1 ? ROAD.shade : ROAD.base;
      } else if (hash01(calmRuns[wrap(x + row * 7)] * 3 + row * 17) < 0.12) c = ROAD.soft;
      dot(b, x, gy(row), c);
    }
  }
  // blades hanging over the road's far edge
  for (let x = 0; x < TILE_W; x++) if (h2(x, 3, 63) < 0.16 && h2(x - 1, 3, 63) >= 0.16) dot(b, x, gy(ROAD0), VG.shade);
}

/**
 * The near verge: a strip of grass, then the edge of a wheat field: a ragged row of ears along the
 * top (grains lit on the left, an awn here and there) over a golden mass of stalks streaked darker,
 * in shade toward the bottom of the view.
 */
function nearVerge(b: PixelBuf): void {
  for (let x = 0; x < TILE_W; x++) {
    for (let row = NEAR0; row <= BOTTOM; row++) {
      const c = row === NEAR0 ? VG.shade : row === NEAR0 + 1 ? VG.lit : row === NEAR0 + 2 && (x + Math.floor(x / 4)) % 3 === 0 ? VG.shade : VG.base;
      dot(b, x, gy(row), c);
    }
  }
  // grass blades up over the road's near lip
  for (let x = 0; x < TILE_W; x++) {
    if (h2(x, 4, 64) < 0.16 && h2(x - 1, 4, 64) >= 0.16) {
      dot(b, x, gy(ROAD1), VG.lit);
      dot(b, x, gy(ROAD1 - 1), VG.tip);
    }
  }
  // the ears: two columns each (lit left, a grain notch on the right), tops at uneven heights,
  // over the stalks: a mass of darker gold streaked in short strokes, in shade toward the bottom
  for (let x = 0; x < TILE_W; x++) {
    const e = Math.floor(x / 3);
    const i = x % 3;
    const top = FIELD - 1 + Math.floor(h2(e, 5, 65) * 3);
    for (let row = top; row <= BOTTOM; row++) {
      const k = row - top;
      let c: string;
      if (i < 2 && k < 4) c = k === 3 ? WHEAT[1] : i === 0 ? (k === 0 ? WHEAT[4] : WHEAT[3]) : k === 1 ? WHEAT[2] : WHEAT[3];
      else if (i === 2 && k < 2) continue;
      else {
        c = h2(x, Math.floor((row + x) / 3), 66) < 0.3 ? WHEAT[2] : WHEAT[1];
        if (row >= BOTTOM - 2) c = h2(x, row, 67) < 0.3 ? WHEAT[1] : WHEAT[0];
      }
      dot(b, x, gy(row), c);
    }
    if (i === 0 && h2(e, 7, 65) < 0.3) dot(b, x, gy(top - 1), WHEAT[4]);
  }
}

/** A puddle in the far rut, holding the sky: gold over violet, a glint. */
const PUDDLE_X = 196;

/** Road details: the puddle, pebbles (clusters on the shoulders, a few strays), fallen leaves. */
function roadDetails(b: PixelBuf): void {
  for (let i = -1; i <= 9; i++) {
    const edge = i === -1 || i === 9;
    dot(b, PUDDLE_X + i, gy(ROAD0 + 2), edge ? ROAD.deep : i === 3 || i === 4 ? '#fff0c8' : i < 5 ? '#f0cf9c' : '#c9a6b4');
    if (i >= 1 && i <= 7) dot(b, PUDDLE_X + i, gy(ROAD0 + 3), i === 1 || i === 7 ? ROAD.shade : '#9f8cb4');
  }
  // pebble clusters on the shoulders
  const clusters: ReadonlyArray<readonly [number, number]> = [[38, ROAD0 + 1], [118, ROAD0 + 1], [176, ROAD1 - 1], [242, ROAD0 + 1]];
  for (const [cx, row] of clusters) {
    dot(b, cx, gy(row), ROAD.pebble);
    dot(b, cx + 1, gy(row), ROAD.pale);
    dot(b, cx + 1, gy(row + 1), ROAD.pebbleDark);
    dot(b, cx + 3, gy(row + 1), ROAD.pebble);
    dot(b, cx + 4, gy(row + 1), ROAD.pebbleDark);
  }
  // pebbles: a lit top over a dark bottom, clear of the rows under the feet
  for (let row = ROAD0 + 1; row < ROAD1 - 1; row++) {
    if (calm(row) || row === ROAD0 + 2) continue;
    for (let x = 0; x < TILE_W; x++) {
      if (h2(x, row, 90) < 0.986) continue;
      dot(b, x, gy(row), ROAD.pebble);
      dot(b, x + 1, gy(row), ROAD.pale);
      dot(b, x + 2, gy(row), ROAD.shade);
    }
  }
  // fallen leaves blown onto the road
  const leaves: ReadonlyArray<readonly [number, number, string, string]> = [
    [22, 64, '#e8853a', '#b04a2e'],
    [97, 71, '#f2b84a', '#c47a30'],
    [161, 65, '#d8603a', '#963a34'],
    [221, 71, '#f0a040', '#b45a2e'],
  ];
  for (const [x, row, lit, dark] of leaves) {
    dot(b, x, gy(row), lit);
    dot(b, x + 1, gy(row), dark);
  }
}

/** Wildflowers standing in the far verge: goldenrod plumes, chicory, asters, Queen Anne's lace. */
function vergeFlowers(b: PixelBuf): void {
  const flowers: ReadonlyArray<readonly [number, number, string, string]> = [
    [16, 55, '#f6d24a', '#d09a2a'],
    [44, 56, '#9cb8f0', '#6a7fd0'],
    [78, 55, '#f6d24a', '#d09a2a'],
    [122, 56, '#f8f2f4', '#c8b8d8'],
    [154, 55, '#c89ae8', '#9468c8'],
    [196, 56, '#f6d24a', '#d09a2a'],
    [236, 55, '#9cb8f0', '#6a7fd0'],
  ];
  for (const [x, row, lit, dark] of flowers) {
    dot(b, x, gy(row), lit);
    dot(b, x + 1, gy(row), dark);
    dot(b, x, gy(row - 1), lit);
    for (let r = row + 1; r < VERGE + 1; r++) dot(b, x, gy(r), VG.shade);
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
  '.ttNn..',
];
const MAILBOX_X = 142;

function mailbox(b: PixelBuf): void {
  const box = inked(MAILBOX, {
    '5': '#9fa0b8', W: '#d8dae6', '4': '#787a94', '3': '#5c5e78',
    R: '#c8423c', e: '#ea6a4e', t: WOOD.lit, N: WOOD.mid, n: WOOD.shade,
  });
  plant(b, box, MAILBOX_X, gy(VERGE + 3));
}

// ================================================================== fg

/** Tall grass tufts: blade tips lit, darkening toward the roots. */
const TUFTS: readonly Rows[] = [
  ['...L...', '.L.lG.L', '.lGlGGl', 'lGGGGGg', 'gggGggg'],
  ['..L.', 'L.lG', 'lGGg', 'gggg'],
  ['.L...L..', '.lL.lG.L', 'llGllGGl', 'GGGGGGgg', 'gggggggg'],
];

/** Wildflowers: petals and a heart on a stem (recolor w / y for other kinds). */
const FLOWER: Rows = ['.w.', 'wyw', '.w.', '.G.', '.G.'];

/** Wheat ears on bare stalks, near the camera (not inked: thin stalks would drown in ink). */
const WHEAT_EARS: Rows = [
  '.Y...',
  'YO..Y',
  'yO.YO',
  'YO.yO',
  'yo.YO',
  '.o.yo',
  '.o..o',
  '.o..o',
  '..o.o',
];

function fgLayer(): PixelBuf {
  const H = FG_SPOT.h;
  const b = blank(TILE_W, H);
  const greens = { L: VG.tip, l: VG.lit, G: VG.base, g: VG.shade };
  const tufts = TUFTS.map((t) => inked(t, greens));
  const ears = fromRows(WHEAT_EARS, { Y: WHEAT[4], y: WHEAT[3], O: WHEAT[2], o: WHEAT[1] });
  const flowers = [
    inked(FLOWER, { w: '#f6f0f2', y: '#f2c23c', G: VG.shade }),
    inked(FLOWER, { w: '#9cb8f0', y: '#f4eef4', G: VG.shade }),
    inked(FLOWER, { w: '#f6d24a', y: '#d0782a', G: VG.shade }),
  ];
  // [x, what]: tufts (0 to 2), wheat (3), flowers (4 to 6); sparse
  const items: ReadonlyArray<readonly [number, number]> = [
    [6, 2], [17, 3],
    [64, 4], [68, 1],
    [110, 3], [116, 0],
    [164, 5],
    [190, 2], [200, 6],
    [236, 3], [242, 1],
  ];
  for (const [x, what] of items) {
    const s = what < 3 ? tufts[what] : what === 3 ? ears : flowers[what - 4];
    put(b, s, x, H - s.h + 1, what < 3 && h2(x, 0, 9) < 0.5);
  }
  return b;
}

// ================================================================== the set

export const FARM: ScenerySet = {
  tileW: TILE_W,
  layers: { far: FAR_SPOT, mid: MID_SPOT, ground: GROUND_SPOT, fg: FG_SPOT },
  scroll0: { far: 0, mid: 4, ground: 0, fg: 0 },
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
