/**
 * World 5's battle backdrop, "Funky Farmland": a harvest farm in golden late-afternoon light (style
 * rules: docs/PIXEL_ART.md). It is drawn for the 6 px grid's scene frame (sceneryTypes.ts: SCENE_FRAME,
 * 123 rows, the fighters' feet on row 100): the same farm as the first one at 1.5 times its resolution,
 * so it fills the screen as before with finer pixels and more detail. Four horizontally tiling layers,
 * TILE_W art pixels wide; rows below are frame rows.
 *  - far (32 to 80): the countryside in depth bands that get hazier with distance, nothing inked: a
 *    pale violet range, a misty ridge, then rolling hills of patchwork fields (golden wheat, stubble
 *    with round bales or stooks, plowed furrows, sown rows, an orchard, mown pasture) between
 *    hedgerows, a tower windmill with lattice sails, a far farmstead whose windows light up, a pond
 *    holding the sky, and loose groups of autumn trees.
 *  - mid (2 to 89): the farmyard, inked like the animals: the big red barn (gambrel roof with a slate
 *    edge over white trim, board-and-batten walls, a louvered cupola and a rooster weathervane, the hay
 *    loft open with its doors swung back and hay over the sill, X-braced doors on their track, a
 *    gooseneck lamp, four-pane windows, a fieldstone foundation) with the banded, domed silo behind it;
 *    a pumpkin patch with a scarecrow and his crow, and a wheelbarrow of pumpkins; the chicken coop with
 *    its ramp, nest box and a hen at the door; a sugar maple with round bales by a post-and-rail fence;
 *    and a windpump over its trough, with grass and clover between. The opening shot puts the barn
 *    behind the hero and keeps the yard behind the enemies open, under the sun.
 *  - ground (78 to 122): the dirt farm road the fighters stand on (93 to 108, feet on 100) with its
 *    ruts, a verge of tall autumn grass and wildflowers on the far side (a mailbox), and on the near side
 *    grass running into the edge of a wheat field. Rows 100 to 105 (under the feet) stay calm: plain
 *    dirt with only faint long strokes. Every row from the road down is solid: no sky under the feet.
 *  - fg (109 to 122): grass tufts, wildflowers and wheat stalks along the bottom.
 * The set keeps its own colors (not graded); each world's sky, haze, rim light and ambient go on top.
 * Light comes from the top left; ramps are hue-shifted (warm lights, cool violet shadows).
 */
import { blank, blit, clone, fromRows, hash01, mix, outline, setPx, type PixelBuf, type Rows, type SheetEntry } from './buf';
import { SCENE_FRAME, type LightSpot, type ScenerySet } from './sceneryTypes';
import { despeckle, plant, put, windowsOf } from './street/common';

// ------------------------------------------------------------------ layout

/** Width of every layer, in art pixels (1.5 times the first farm's 260); each layer repeats seamlessly. */
const TILE_W = 390;
/** The frame's rows (SCENE_FRAME): 123, the fighters' feet on row 100. */
const FRAME_H = SCENE_FRAME.h;
const FEET = SCENE_FRAME.feetRow;

/** Where each layer sits in the frame: top row and height. */
const FAR_SPOT = { y: 32, h: 49 } as const;
const MID_SPOT = { y: 2, h: 88 } as const;
const GROUND_SPOT = { y: 78, h: FRAME_H - 78 } as const;
const FG_SPOT = { y: 109, h: FRAME_H - 109 } as const;

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

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** The farm's line color: a warm dark brown, like the animals' outlines. */
const INK = '#2c1b1e';
const ink = (b: PixelBuf): PixelBuf => outline(b, INK);
const inked = (rows: Rows, colors: Readonly<Record<string, string>>): PixelBuf => ink(fromRows(rows, colors));
/** Rows authored without their trailing dots, padded to one width. */
const padded = (w: number, rows: readonly string[]): Rows => rows.map((r) => r.padEnd(w, '.'));

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
  const u = clamp(u0, -1, 1);
  const v = clamp(v0, -1, 1);
  return u * LIGHT[0] + v * LIGHT[1] + Math.sqrt(Math.max(0, 1 - u * u - v * v)) * LIGHT[2];
}

// ================================================================== far

const fy = (row: number): number => row - FAR_SPOT.y;

/** Tones of one material: [shade, mid, lit]. */
type Tones = readonly [string, string, string];
/** Four tones of one material: [deep, shade, mid, lit]. */
type Tones4 = readonly [string, string, string, string];

const COOL = '#4a478f';
const WARM = '#ffe3a6';
/** The haze far things fade into: a dusty rose-lilac between the sky's violet and its gold. */
const HAZE_C = '#dcc3cc';
const hz = (c: string, t: number): string => mix(c, HAZE_C, t);

/** A natural color hue-shifted and hazed: shadows toward blue-violet, lights toward warm gold. */
function tones(c: string, haze: number, shift = 0.22): Tones {
  return [hz(mix(c, COOL, shift), haze), hz(c, haze), hz(mix(c, WARM, shift), haze)];
}

/** Like tones, with a deeper shadow below the shade (furrows, the undersides of trees). */
function tones4(c: string, haze: number, shift = 0.22): Tones4 {
  return [hz(mix(c, COOL, shift * 2.2), haze), hz(mix(c, COOL, shift), haze), hz(c, haze), hz(mix(c, WARM, shift), haze)];
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
  return (crest[wrap(x - 5)] - crest[wrap(x + 5)]) / 10;
}

/** Light on a hill pixel `d` rows under its crest: 1 lit, 0 mid, -1 shade; edges broken into short runs. */
function lightAt(crest: readonly number[], x: number, d: number, seed: number, reach: number): number {
  const v = facing(crest, x) * Math.exp(-d / reach);
  const j = (h2(Math.floor((x + (d % 4)) / 4), d, seed) - 0.5) * 0.06;
  return v + j > 0.13 ? 1 : v + j < -0.11 ? -1 : 0;
}

/** The far range, palest (low around the sun, x 120 to 165 in the opening shot), then the misty ridge. */
const RANGE = skyline(fy(58.5), [
  [24, 45, 10.5],
  [87, 27, 6],
  [204, 51, 12],
  [294, 39, 7.5],
  [360, 27, 4.5],
]);
const RIDGE = skyline(fy(61.5), [
  [54, 39, 6],
  [156, 33, 3],
  [252, 45, 7.5],
  [339, 30, 4.5],
]);
/** Back hills: patchwork fields, the windmill on the hill around MILL_X. */
const MILL_X = 99;
const BACK = skyline(fy(67.5), [
  [12, 36, 6],
  [MILL_X, 39, 12.75],
  [195, 39, 6],
  [279, 45, 9.75],
  [354, 27, 4.5],
]);
/** Near hills: fields, the orchard and the farmstead on the hill around FARM_X. */
const FARM_X = 252;
const NEAR = skyline(fy(72), [
  [42, 48, 5.25],
  [156, 30, 1.5],
  [FARM_X, 45, 7.5],
  [339, 33, 3],
]);
/** The meadow under the tree line (the farmyard covers it from frame row 75). */
const MEADOW = fy(75);

let farBuilt: PixelBuf | null = null;

function buildFar(): PixelBuf {
  if (farBuilt) return farBuilt;
  const b = blank(TILE_W, FAR_SPOT.h);
  drawPlain(b, RANGE, HAZE.range, '#8f88c8', 7, false);
  drawPlain(b, RIDGE, HAZE.ridge, '#7b8bb2', 7, true);
  drawFields(b, BACK, fy(76.5), BACK_FIELDS);
  drawMill(b);
  drawFields(b, NEAR, fy(81), NEAR_FIELDS);
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

/**
 * A plain distant band: flanks lit and shaded, a warm rim on sunlit crests, a few lit strokes on the
 * sunny slopes, mist pooling at its foot in two steps.
 */
function drawPlain(b: PixelBuf, crest: readonly number[], haze: number, base: string, reach: number, mist: boolean): void {
  const [shade, mid, lit] = tones(base, haze, 0.18);
  const rim = hz(mix(base, WARM, 0.45), haze);
  const fog = hz(mix(base, WARM, 0.12), haze + 0.16);
  const fog2 = hz(mix(base, WARM, 0.2), haze + 0.28);
  for (let x = 0; x < TILE_W; x++) {
    for (let y = crest[x]; y < b.h; y++) {
      const d = y - crest[x];
      const l = lightAt(crest, x, d, 1 + reach, reach);
      let c = l > 0 ? lit : l < 0 ? shade : mid;
      if (d === 0) c = l < 0 ? mid : rim;
      // gullies: a few longer shaded strokes down the lit flanks
      else if (l > 0 && d > 2 && h2(Math.floor(x / 3), Math.floor(d / 3), 3 + reach) < 0.12) c = mid;
      if (mist) {
        const j = h2(Math.floor(x / 6), 0, 2) < 0.5 ? 0 : 1;
        if (y >= fy(64) + j) c = fog2;
        else if (y >= fy(61.5) + j) c = fog;
      }
      dot(b, x, y, c);
    }
  }
}

// ------------------------------------------------------------------ fields

/**
 * A field's kind: plain, plowed in furrows (rows), sown in green rows on soil (sown), mown in stripes
 * (mown), stubble with round bales (bales) or with wheat stooks (stooks), an orchard.
 */
type Kind = 'plain' | 'rows' | 'sown' | 'mown' | 'bales' | 'stooks' | 'orchard';

interface Crop {
  t: Tones4;
  kind?: Kind;
  /** The soil between sown rows. */
  soil?: Tones4;
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
  hedge: Tones4;
  /** Hedgerows two pixels deep (the near band) or one. */
  thick: boolean;
  /** Little trees in the hedgerows (autumn colors). */
  hedgeTrees: readonly Tones4[];
  bale: Tones4;
  reach: number;
  seed: number;
}

function cropSet(haze: number) {
  return {
    pasture: tones4('#76994a', haze),
    pale: tones4('#a8b45c', haze),
    wheat: tones4('#e0b44c', haze),
    stubble: tones4('#d2b26e', haze),
    soil: tones4('#a0684a', haze, 0.25),
    dark: tones4('#5a8046', haze),
    rust: tones4('#c47a3e', haze),
    orchard: tones4('#86a04c', haze),
    sprout: tones4('#7fa448', haze),
  };
}

const CB = cropSet(HAZE.back);
const BACK_FIELDS: Fields = {
  rows: [0.36, 0.7],
  cols: [18, 54, 87, 129, 162, 201, 231, 279, 309, 348],
  lean: 0.7,
  crops: [
    [{ t: CB.pasture }, { t: CB.wheat }, { t: CB.dark }],
    [{ t: CB.stubble, kind: 'bales' }, { t: CB.pasture, kind: 'mown' }],
    [{ t: CB.pale }, { t: CB.soil, kind: 'rows' }, { t: CB.pasture }],
    [{ t: CB.wheat, kind: 'rows' }, { t: CB.dark }],
    [{ t: CB.dark }, { t: CB.rust }, { t: CB.wheat }],
    [{ t: CB.pasture, kind: 'mown' }, { t: CB.stubble, kind: 'stooks' }],
    [{ t: CB.soil, kind: 'rows' }, { t: CB.pasture }],
    [{ t: CB.pale }, { t: CB.sprout, kind: 'sown', soil: CB.soil }, { t: CB.dark }],
    [{ t: CB.wheat }, { t: CB.pasture }],
    [{ t: CB.pasture }, { t: CB.rust }],
  ],
  rim: hz(mix('#d7d47a', WARM, 0.4), HAZE.back),
  hedge: tones4('#4a6a3c', HAZE.back, 0.3),
  thick: false,
  hedgeTrees: [tones4('#5a7c3c', HAZE.back, 0.3), tones4('#d0803a', HAZE.back, 0.3), tones4('#c2a03e', HAZE.back, 0.3)],
  bale: tones4('#e2b85c', HAZE.back, 0.3),
  reach: 6,
  seed: 10,
};

const CN = cropSet(HAZE.near);
const NEAR_FIELDS: Fields = {
  rows: [0.45],
  cols: [6, 69, 111, 144, 183, 225, 279, 315],
  lean: 1,
  crops: [
    [{ t: CN.pasture, kind: 'mown' }, { t: CN.pale }],
    [{ t: CN.wheat, kind: 'rows' }, { t: CN.pasture }],
    [{ t: CN.pale }, { t: CN.stubble, kind: 'bales' }],
    [{ t: CN.pasture }],
    [{ t: CN.soil, kind: 'rows' }, { t: CN.sprout, kind: 'sown', soil: CN.soil }],
    [{ t: CN.pasture }, { t: CN.orchard, kind: 'orchard' }],
    [{ t: CN.stubble, kind: 'stooks' }, { t: CN.pasture, kind: 'mown' }],
    [{ t: CN.pale }, { t: CN.wheat, kind: 'rows' }],
  ],
  rim: hz(mix('#d7d47a', WARM, 0.4), HAZE.near),
  hedge: tones4('#466238', HAZE.near, 0.3),
  thick: true,
  hedgeTrees: [tones4('#54783a', HAZE.near, 0.3), tones4('#d4823a', HAZE.near, 0.3), tones4('#c9a23e', HAZE.near, 0.3), tones4('#ac4e38', HAZE.near, 0.3)],
  bale: tones4('#e8bc5c', HAZE.near, 0.3),
  reach: 6,
  seed: 20,
};

/** Tiny far sprites: l lit, m mid, s shade, d deep (the tree's or the ground's). */
const TINY_TREE: Rows = ['.l.', 'lms', 'msd'];
const TINY_POPLAR: Rows = ['l.', 'lm', 'lm', 'ms'];
const STOOK: Rows = ['.l..', 'lms.', 'lmsd'];
const BALE: Rows = ['lm.', 'msd'];

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
      const k = y - top;
      const tone = (i: number) => crop.t[clamp(i, 0, 3)];
      let c = tone(l + 2);
      if (crop.kind === 'rows' && k > 0) {
        // furrows follow the field's top edge: a lit ridge, its face, the shaded furrow
        const p = k % 3;
        c = tone(l + (p === 1 ? 3 : p === 2 ? 2 : 1));
      } else if (crop.kind === 'sown' && k > 0) {
        // green rows on bare soil
        const p = k % 3;
        c = p === 0 ? crop.soil![clamp(l + 1, 0, 3)] : tone(l + (p === 1 ? 3 : 2));
      } else if (crop.kind === 'mown') {
        // mown stripes, leaning with the field
        const s = Math.floor(wrap(Math.round(x - d * f.lean * 2)) / 6) % 2;
        if (s === 1) c = tone(l + 3);
      } else {
        // plain grass or crop: a few short strokes a step lighter or darker
        const r = h2(Math.floor((x + y * 5) / 4), y, f.seed + 5);
        if (r < 0.08) c = tone(l + 1);
        else if (r > 0.95) c = tone(l + 3);
      }
      if (d === 0) c = l < 0 ? tone(2) : f.rim;
      dot(t, x, y, c);
    }
  }
  despeckle(t);
  // hedgerows along the field edges (two pixels deep on the near band: a lit top over its shade)
  const [, hs, hm, hl] = f.hedge;
  for (let x = 0; x < TILE_W; x++) {
    for (let k = 0; k < f.rows.length; k++) {
      const y = line(x, k);
      if (y <= crest[x] + 1) continue;
      if (f.thick) {
        dot(t, x, y - 1, lightAt(crest, x, y - crest[x], f.seed + 1, f.reach) > 0 ? hl : hm);
        dot(t, x, y, hs);
      } else dot(t, x, y, hm);
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
  const sprite = (rows: Rows, x: number, y: number, tt: Tones4, ground?: string) => {
    const map: Record<string, string> = { l: tt[3], m: tt[2], s: tt[1], d: ground ?? tt[0] };
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) if (row[rx] !== '.') dot(b, x + rx, y + ry, map[row[rx]]);
    });
  };
  // little trees along the hedgerows: round ones and poplars, in autumn colors
  for (let k = 0; k < f.rows.length; k++) {
    for (let x = 0; x < TILE_W; x++) {
      if (h2(x, k, f.seed + 2) < 0.9 || h2(x - 1, k, f.seed + 2) >= 0.9 || h2(x - 2, k, f.seed + 2) >= 0.9 || h2(x - 3, k, f.seed + 2) >= 0.9) continue;
      const y = line(x, k) - (f.thick ? 1 : 0);
      const tt = f.hedgeTrees[Math.floor(h2(x, k, f.seed + 3) * f.hedgeTrees.length)];
      const poplar = h2(x, k, f.seed + 6) < 0.3;
      const rows = poplar ? TINY_POPLAR : TINY_TREE;
      const top = y - rows.length + 1;
      if (top - 1 <= crest[wrap(x)] || top - 1 <= crest[wrap(x + 2)]) continue;
      sprite(rows, x, top, tt);
    }
  }
  // orchards: rows of little round trees; stubble: round bales or stooks in rows, each with its shadow
  for (let x = 0; x < TILE_W; x++) {
    for (let y = 0; y < b.h; y++) {
      if (y <= crest[x] + 2) continue;
      const { crop, top } = cropAt(x, y);
      const k = y - top;
      if (crop.kind === 'orchard') {
        if (k < 3 || k % 4 !== 3 || wrap(x + k * 2) % 6 !== 0) continue;
        sprite(TINY_TREE, x - 1, y - 2, f.hedgeTrees[(Math.floor(x / 6) + k) % 2], crop.t[0]);
      } else if (crop.kind === 'bales') {
        if (k < 2 || k % 4 !== 2 || wrap(x + k * 3) % 8 !== 0 || h2(x, y, f.seed + 4) < 0.3) continue;
        sprite(BALE, x, y - 1, f.bale, crop.t[0]);
      } else if (crop.kind === 'stooks') {
        if (k < 3 || k % 5 !== 3 || wrap(x + k * 2) % 7 !== 0 || h2(x, y, f.seed + 7) < 0.2) continue;
        sprite(STOOK, x, y - 2, f.bale, crop.t[0]);
      }
    }
  }
}

// ------------------------------------------------------------------ far buildings

/**
 * The far windmill, a tower mill (no ink: it is far away). Keys: S sail canvas (a red-brown sailcloth
 * that holds its own against the bright sky), s spars and the sails' bars, R / r cap lit / shade,
 * W / 5 tower lit / shade, x windows, door and hub.
 */
function millSketch(): Rows {
  const w = 21;
  const h = 25;
  const hx = 10;
  const hy = 9;
  const s = new Sketch(w, h);
  // the tower tapers up from the hill, lit on its left two thirds
  for (let y = hy + 1; y < h; y++) {
    const half = 2 + Math.round(((y - hy - 1) / (h - hy - 2)) * 2.4);
    for (let x = hx - half; x <= hx + half; x++) s.set(x, y, x - hx < half / 2 ? 'W' : '5');
  }
  s.rect(hx - 1, h - 3, 2, 3, 'x');
  s.rect(hx, hy + 6, 1, 2, 'x');
  // the cap: a little dome behind the hub
  s.rect(hx - 1, hy - 3, 3, 1, 'R');
  s.set(hx + 1, hy - 3, 'r');
  s.rect(hx - 2, hy - 2, 5, 2, 'R');
  s.rect(hx + 1, hy - 2, 2, 2, 'r');
  s.rect(hx - 2, hy, 5, 1, 'r');
  // four sails, turned like a pinwheel: each a spar with a lattice two pixels deep on one side,
  // canvas between dark bars. One sail is drawn and turned a quarter at a time round the hub.
  const turn = (dx: number, dy: number, q: number): [number, number] => {
    for (let k = 0; k < q; k++) [dx, dy] = [dy, -dx];
    return [hx + dx, hy + dy];
  };
  for (let q = 0; q < 4; q++) {
    for (let i = 3; i <= 8; i++) {
      const bar = i === 5 || i === 8;
      for (const [dx, dy] of [[i - 1, -i], [i - 1, -1 - i]] as const) {
        const [x, y] = turn(dx, dy, q);
        s.set(x, y, bar ? 's' : 'S');
      }
    }
    for (let i = 1; i <= 8; i++) {
      const [x, y] = turn(i, -i, q);
      s.set(x, y, 's');
    }
  }
  s.set(hx, hy, 'x');
  return s.rows();
}

const MILL = millSketch();

function drawMill(b: PixelBuf): void {
  const haze = HAZE.back;
  const map = {
    S: hz('#c98a66', haze), s: hz('#5e4650', haze),
    R: hz('#b85048', haze), r: hz('#723744', haze),
    W: hz('#efe2cc', haze), '5': hz('#a8949f', haze), x: hz('#45384a', haze),
  };
  const base = BACK[MILL_X] + 1;
  put(b, fromRows(MILL, map), MILL_X - (MILL[0].length >> 1), base - MILL.length + 1);
}

/** The far farmstead: a farmhouse (windows x light up at night), a red barn and its silo, by trees. */
const HOUSE: Rows = [
  '..........bb....',
  '....eeeeeebbRR..',
  '...eeeeeeeRRRRr.',
  '..eeeeeeeeRRRRrr',
  '.eeeeeeeeeRRRRrr',
  '..nnnnnnnnnnnnn.',
  '..WxxWWxxW5xx55.',
  '..WxxWWxxW5xx55.',
  '..WWWWWWWW55555.',
  '..WxxWnnWW5xx55.',
  '..WxxWnnWW5xx55.',
];
const FAR_BARN: Rows = [
  '....eeRRr...',
  '...eeeRRrr..',
  '..eeeeRRrrr.',
  '.eeeeeRRrrrr',
  '..eRRWWRRrr.',
  '..eRRWWRRrr.',
  '..eRWWWWWrr.',
  '..eRWnnnWrr.',
  '..eRWnnnWrr.',
];
const FAR_SILO: Rows = [
  '..43..',
  '.4433.',
  '444333',
  'WWw555',
  'WWw555',
  'hhhhhh',
  'WWw555',
  'WWw555',
  'hhhhhh',
  'WWw555',
  'WWw555',
  'WWw555',
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
  const silo = {
    '4': hz('#c4ccd8', haze), '3': hz('#8e96ae', haze), W: hz('#e9e0d4', haze), w: hz('#cfc2c0', haze),
    '5': hz('#ada0b2', haze), h: hz('#8a8098', haze),
  };
  return [
    [FAR_SILO, 15, 1, silo],
    [FAR_BARN, 5, 2, barn],
    [HOUSE, -15, 1, house],
  ];
})();

function farmBase(dx: number, sink: number): number {
  return NEAR[wrap(FARM_X + dx + 4)] + sink;
}

function drawFarmstead(b: PixelBuf): void {
  // trees behind and beside the buildings
  const plot = (x: number, y: number, c: string) => dot(b, x, y, c);
  ball(plot, FARM_X - 19.5, farmBase(-19, 1) - 4, 4.6, 4.2, tones4('#5c7c3a', HAZE.near, 0.3));
  ball(plot, FARM_X + 25.5, farmBase(25, 1) - 3.5, 3.8, 3.6, tones4('#d09040', HAZE.near, 0.3));
  for (const [rows, dx, sink, map] of FARMSTEAD) {
    const base = farmBase(dx, sink);
    put(b, fromRows(rows, map), FARM_X + dx, base - rows.length + 1);
  }
}

/** The farmhouse's windows (each a rect of x pixels), in far-layer pixels; a share light up at dusk and night. */
function farLights(): LightSpot[] {
  const out: LightSpot[] = [];
  const [rows, dx, sink] = FARMSTEAD[2];
  const top = farmBase(dx, sink) - rows.length + 1;
  const seen = new Set<string>();
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      if (row[rx] !== 'x' || seen.has(`${rx},${ry}`)) continue;
      let w = 0;
      while (row[rx + w] === 'x') w++;
      let h = 0;
      while (rows[ry + h]?.[rx] === 'x') h++;
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) seen.add(`${rx + xx},${ry + yy}`);
      out.push({ x: wrap(FARM_X + dx + rx), y: top + ry, w, h, kind: 'window' });
    }
  });
  return out;
}

/** A pond in the hollow below the sun, holding the sky: gold on top, the sun's glint, violet under, reeds. */
const POND_X = 138;
function drawPond(b: PixelBuf): void {
  const y0 = fy(70);
  const rows: ReadonlyArray<readonly [number, number, string]> = [
    [7, 18, hz('#f4d39a', 0.1)],
    [2, 27, hz('#ecc293', 0.1)],
    [1, 29, hz('#d9a998', 0.1)],
    [4, 23, hz('#a592bc', 0.1)],
  ];
  const glint = hz('#fff3cc', 0.04);
  rows.forEach(([x0, w, c], i) => {
    for (let k = 0; k < w; k++) {
      let cc = c;
      const gx = x0 + k;
      if (i === 0 && gx >= 13 && gx < 18) cc = glint;
      if (i === 1 && gx >= 11 && gx < 19) cc = glint;
      if (i === 2 && gx >= 13 && gx < 16) cc = hz('#f6dcb0', 0.06);
      if (i === 3 && gx >= 13 && gx < 16) cc = hz('#e0b8a8', 0.1);
      dot(b, POND_X + gx, y0 + i, cc);
    }
  });
  // reeds and cattails at the ends
  const reed = NEAR_FIELDS.hedge;
  const head = hz('#7a4a3a', 0.1);
  for (const [x, top] of [[POND_X + 1, -2], [POND_X + 3, -1], [POND_X + 28, -1], [POND_X + 30, 0]] as const) {
    for (let y = y0 + top; y <= y0 + 2; y++) dot(b, x, y, y === y0 + top ? head : reed[y < y0 + 1 ? 2 : 1]);
  }
}

// ------------------------------------------------------------------ far trees

/** Poplars, golden in autumn, lit on the left. */
const POPLAR: Rows = [
  '.l..',
  '.lG.',
  'llGg',
  'lGGg',
  'lGGg',
  'llGg',
  'lGGg',
  'lGgg',
  '.Ggg',
  '.Gg.',
  '.gd.',
  '..d.',
];
const PINE: Rows = [
  '...l...',
  '..lGg..',
  '..lGg..',
  '.llGgg.',
  '..lGgd.',
  '.llGGgg',
  'llGGggd',
  '.lGGgd.',
  'llGGGgg',
  'lGGGggd',
  '..dgd..',
];

/**
 * A round crown in four tones: a lit cap on its top left, the shade in a crescent on the bottom right
 * with a deeper rim, the mid between.
 */
function ball(plot: (x: number, y: number, c: string) => void, cx: number, cy: number, rx: number, ry: number, t: Tones4): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const u = (x + 0.5 - cx) / rx;
      const v = (y + 0.5 - cy) / ry;
      if (u * u + v * v > 1) continue;
      let c = t[2];
      if ((u + 0.36) ** 2 + (v + 0.46) ** 2 > 1) c = (u + 0.2) ** 2 + (v + 0.25) ** 2 > 1.2 ? t[0] : t[1];
      else if (v < 0.15 && (u - 0.32) ** 2 + (v - 0.42) ** 2 > 1) c = t[3];
      plot(x, y, c);
    }
  }
}

function drawFarTrees(b: PixelBuf): void {
  const haze = HAZE.trees;
  const green = tones4('#557a38', haze, 0.3);
  const olive = tones4('#8a8f3a', haze, 0.3);
  const orange = tones4('#d27a34', haze, 0.3);
  const rust = tones4('#ac4a36', haze, 0.3);
  const gold = tones4('#c49a44', haze + 0.04, 0.3);
  const pines = tones4('#3e6040', haze * 0.8, 0.3);
  const line = blank(TILE_W, b.h);
  const plot = (x: number, y: number, c: string) => dot(line, x, y, c);
  const stamp = (rows: Rows, x: number, t: Tones4, lift: number) =>
    put(line, fromRows(rows, { l: t[3], G: t[2], g: t[1], d: t[0] }), x, MEADOW - rows.length + 1 - lift);
  // groups of trees with open fields between: [x, kinds] (r round, R big round, p poplar, P pine)
  const groups: ReadonlyArray<readonly [number, string]> = [
    [0, 'Rr'],
    [36, 'p'],
    [72, 'rP'],
    [172, 'Pr'],
    [197, 'r'],
    [219, 'p'],
    [300, 'rR'],
    [348, 'pp'],
  ];
  const rounds = [green, orange, olive, rust, gold];
  for (const [gx, kinds] of groups) {
    let x = gx;
    for (let i = 0; i < kinds.length; i++) {
      const k = kinds[i];
      const lift = Math.floor(h2(gx, i, 40) * 3);
      if (k === 'p') {
        stamp(POPLAR, x, gold, lift);
        x += 4;
      } else if (k === 'P') {
        stamp(PINE, x, pines, lift);
        x += 7;
      } else {
        const r = k === 'R' ? 5.1 : 3.9;
        ball(plot, x + r, MEADOW + 0.5 - r - lift, r, r * 0.92, rounds[Math.floor(h2(gx, i, 41) * rounds.length)]);
        x += Math.round(r * 1.7);
      }
    }
  }
  despeckle(line);
  blit(b, line, 0, 0);
}

/** Filler under the tree line (the farmyard covers it). */
function drawMeadow(b: PixelBuf): void {
  const [, , mid, lit] = tones4('#86983f', HAZE.near);
  for (let x = 0; x < TILE_W; x++) {
    for (let y = MEADOW; y < b.h; y++) dot(b, x, y, y === MEADOW ? lit : mid);
  }
}

// ================================================================== mid

/** A frame row as a mid-layer row. */
const my = (row: number): number => row - MID_SPOT.y;
/** The farmyard's far edge (the far fields show above it). */
const YARD = my(75);
/** Where buildings meet the ground: their bottom ink row. */
const BASE = my(81);

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
  // boards: batten lit edge, board face, weathered board, grain, shadow line, deep shadow under trim
  e: '#d4573f', R: '#b53b39', E: '#c4574a', Q: '#a13439', r: '#8c2d3a', b: '#6b2539',
  // door boards
  y: '#a8363a', O: '#943039', o: '#74263a',
  // white trim: lit, shade, deep
  W: '#f5e9d5', '5': '#cbbccb', '4': '#a698ad',
  // the roof's edge: weathered slate
  V: '#8a85a3', U: '#6b6686', u: '#4f4a69', '1': '#3a344f',
  // fieldstone foundation: cool stones, warm stones, mortar; the concrete apron
  A: '#d2c6c1', '3': '#a3979f', '2': '#786d84', F: '#dcb9a0', f: '#b08a7e', h: '#82646a', m: '#544a5e',
  // hay in the loft
  Y: '#fff0b0', T: '#f3d57e', t: '#d9a74b', N: '#a6743c',
  // the dark loft, iron, rope, the lamp
  k: '#3d2229', S: '#3e3443', n: '#c8a06a', g: '#3c5a48', G: '#5e8064', L: '#ffe6a6',
  // windows: white frames, glass, muntins
  x: '#f5e9d5', c: '#55709a', C: '#b6d1e6', w: '#e9dccb',
};

/** Barn windows: frame x (white), glass c / C (the sky in the top left of each pane), muntins w. */
const BARN_WINDOW: Rows = [
  'xxxxxxxxx',
  'xCCCwCCcx',
  'xCCcwCccx',
  'xCccwcccx',
  'xwwwwwwwx',
  'xCCcwCCcx',
  'xCccwcccx',
  'xcccwcccx',
  'xxxxxxxxx',
];

/** Rows of the barn sketch: the weathervane's space, the cupola, the gambrel, walls, doors, footing. */
const B_VANE = 15;
const B_CUP = B_VANE;
const B_PEAK = B_CUP + 12;
const B_KNEE = B_PEAK + 9;
const B_EAVE = B_KNEE + 11;
const B_WALL = B_EAVE + 1;
const B_DOOR = B_WALL + 6;
const B_FOUND = B_DOOR + 18;
const B_H = B_FOUND + 4;
const B_W = 64;

/** The gambrel's half-width at a row (offsets from the two middle columns, 1 = the peak). */
function gambrel(r: number): number {
  if (r < B_PEAK) return 0;
  if (r <= B_KNEE) return 1 + 2 * (r - B_PEAK);
  if (r < B_EAVE) return 19 + (r - B_KNEE);
  if (r === B_EAVE) return 31;
  return 29;
}

/** A column's offset from the barn's two middle columns (1 = the peak's). */
const off = (x: number): number => (x <= 31 ? 32 - x : x - 31);

/** How many rows a gable pixel lies under the roof's edge (0 = on the edge). */
function depthAt(o: number, r: number): number {
  let k = 1;
  while (k < 9 && o <= gambrel(r - k)) k++;
  return k - 1;
}

/**
 * Board-and-batten: a batten lit on its left every 4 columns, the board, the batten's shadow; a few
 * weathered boards paler in long streaks, grain in short darker strokes.
 */
function board(x: number, r: number): string {
  const i = (x + 1) % 4;
  if (i === 0) return 'e';
  if (i === 3) return 'r';
  const k = Math.floor((x + 1) / 4);
  if (hash01(k * 17 + 5) < 0.2 && (r + k * 5) % 13 < 8) return 'E';
  if (i === 1 && hash01(k * 31 + Math.floor((r + k * 3) / 4) * 7) < 0.14) return 'Q';
  return 'R';
}

/** One course of fieldstones from x0 to x1: stones 3 to 6 wide, cool or warm, lit on their top left. */
function stones(s: Sketch, x0: number, x1: number, r: number, seed: number): void {
  let x = x0;
  for (let k = 0; x <= x1; k++) {
    const len = Math.min(x1 - x + 1, 3 + Math.floor(hash01(seed * 89 + k) * 4));
    const warm = hash01(seed * 53 + k * 7) < 0.35;
    const [lit, mid, shade] = warm ? ['F', 'f', 'h'] : ['A', '3', '2'];
    for (let i = 0; i < len; i++) {
      const last = i === len - 1;
      s.set(x + i, r, last ? 'm' : i < 2 ? lit : mid);
      s.set(x + i, r + 1, last ? 'm' : i >= len - 3 ? shade : mid);
    }
    x += len;
  }
}

/**
 * The red barn, gable end on: a gambrel roof (its edge in slate over white trim), a louvered cupola on
 * the ridge, the open hay loft (its doors swung back, hay heaped inside and a few straws over the sill,
 * the hay hook's beam over it), X-braced doors on a track, a gooseneck lamp, two four-pane windows with
 * heads and sills, corner boards and a fieldstone foundation with a concrete apron at the doors.
 */
function barnSketch(): { rows: Rows; lamp: readonly [number, number] } {
  const s = new Sketch(B_W, B_H);
  // gable: the roof's edge (a lit slate edge, its underside), white trim, its shadow, then boards
  for (let r = B_PEAK; r <= B_EAVE; r++) {
    for (let x = 0; x < B_W; x++) {
      const o = off(x);
      if (o > gambrel(r)) continue;
      const left = x <= 31;
      const d = depthAt(o, r);
      let c: string;
      if (d === 0) c = left ? 'V' : 'U';
      else if (d === 1) c = (r - B_PEAK) % 3 === 0 ? (left ? 'V' : 'U') : left ? 'U' : 'u';
      else if (d === 2) c = left ? 'u' : '1';
      else if (d === 3) c = left ? 'W' : '5';
      else if (d === 4) c = left ? 'W' : '4';
      else if (d === 5) c = 'b';
      else c = board(x, r);
      s.set(x, r, c);
    }
  }
  // walls under the eaves: the eave's shadow, boards, corner boards
  for (let r = B_WALL; r < B_FOUND; r++) {
    for (let x = 3; x <= 60; x++) s.set(x, r, r === B_WALL ? 'b' : board(x, r));
    s.set(3, r, 'W');
    s.set(4, r, 'W');
    s.set(59, r, '5');
    s.set(60, r, '4');
  }
  // the cupola on the ridge: a hip roof in slate, trim, louvers between red corner posts, its base
  const c0 = B_CUP;
  [4, 6, 8, 10, 12].forEach((w, i) => {
    const x0 = 32 - w / 2;
    for (let k = 0; k < w; k++) {
      const left = x0 + k <= 31;
      let c = left ? 'U' : 'u';
      if (k === 0 || (i === 0 && left)) c = 'V';
      if (k === w - 1) c = '1';
      if (i === 4) c = left ? 'V' : 'u';
      s.set(x0 + k, c0 + i, c);
    }
  });
  for (let x = 27; x <= 36; x++) s.set(x, c0 + 5, x <= 31 ? 'W' : '5');
  for (let r = c0 + 6; r <= c0 + 10; r++) {
    s.set(28, r, 'e');
    s.set(35, r, 'r');
    for (let x = 29; x <= 34; x++) s.set(x, r, (r - c0) % 2 === 0 ? (x <= 31 ? 'W' : '5') : 'k');
  }
  for (let x = 27; x <= 36; x++) s.set(x, c0 + 11, x <= 31 ? 'W' : '5');
  for (let x = 28; x <= 35; x++) s.set(x, B_PEAK, x === 28 ? 'e' : x === 35 ? 'r' : 'R');
  // the hay hook's beam under the peak, its rope and hook
  s.rect(31, B_PEAK + 3, 2, 2, 'S');
  s.set(32, B_PEAK + 5, 'n');
  s.set(32, B_PEAK + 6, 'S');
  // the hay loft: an opening in a white frame, hay heaped in the dark, a few straws over the sill
  const lx = 27;
  const ly = B_PEAK + 7;
  const lb = B_EAVE - 2;
  for (let r = ly; r <= lb; r++) {
    for (let x = lx; x <= lx + 9; x++) {
      const edge = r === ly || r === lb || x === lx || x === lx + 9;
      s.set(x, r, edge ? (x === lx + 9 || r === lb ? '5' : 'W') : 'k');
    }
  }
  const hay = [
    '...TTt..',
    '..TYTtt.',
    '.TTtTtNt',
    'TYTtTtNN',
    'TTtTtNtN',
    'tTtNtNNN',
  ];
  s.stamp(hay, lx + 1, lb - hay.length);
  s.set(lx + 3, lb + 1, 'T');
  s.set(lx + 3, lb + 2, 't');
  s.set(lx + 6, lb + 1, 't');
  // its two doors swung open flat against the wall: boards in a white frame, a brace across each
  for (const x0 of [lx - 5, lx + 10]) {
    for (let r = ly + 1; r <= lb; r++) {
      for (let x = x0; x < x0 + 5; x++) {
        const edge = r === ly + 1 || r === lb || x === x0 || x === x0 + 4;
        s.set(x, r, edge ? (x === x0 + 4 || r === lb ? '5' : 'W') : (x - x0) % 2 === 1 ? 'y' : 'O');
      }
    }
    s.line(x0 + 1, lb - 1, x0 + 3, ly + 2, 'W');
  }
  // the gooseneck lamp over the doors: an iron arm, an enamel shade, the bulb
  s.set(32, B_EAVE, 'S');
  s.set(32, B_WALL, 'S');
  s.rect(30, B_WALL + 1, 4, 1, 'g');
  s.set(30, B_WALL + 1, 'G');
  s.rect(29, B_WALL + 2, 6, 1, 'g');
  s.set(29, B_WALL + 2, 'G');
  s.rect(31, B_WALL + 3, 2, 1, 'L');
  const lamp = [31, B_WALL + 3] as const;
  // the door track and the two X-braced leaves: white frames and braces on dark red boards
  s.rect(17, B_DOOR - 1, 30, 1, 'S');
  for (const x0 of [20, 32]) {
    for (let r = B_DOOR; r < B_FOUND; r++) {
      for (let x = x0; x < x0 + 12; x++) {
        const fr = x === x0 || x === x0 + 11 || r === B_DOOR || r === B_FOUND - 1;
        const i = (x - x0) % 3;
        const c = fr ? (x === x0 + 11 || r === B_FOUND - 1 ? '5' : 'W') : i === 1 ? 'y' : i === 2 ? 'O' : 'o';
        s.set(x, r, c);
      }
    }
    s.line(x0 + 1, B_DOOR + 1, x0 + 9, B_FOUND - 2, 'W');
    s.line(x0 + 2, B_DOOR + 1, x0 + 10, B_FOUND - 2, '5');
    s.line(x0 + 10, B_DOOR + 1, x0 + 2, B_FOUND - 2, 'W');
    s.line(x0 + 9, B_DOOR + 1, x0 + 1, B_FOUND - 2, 'W');
    // rollers on the track, a handle by the meeting edge
    s.rect(x0 + 2, B_DOOR - 1, 2, 1, 'A');
    s.rect(x0 + 8, B_DOOR - 1, 2, 1, 'A');
  }
  s.rect(29, B_DOOR + 8, 1, 3, 'S');
  s.rect(34, B_DOOR + 8, 1, 3, 'S');
  // windows with a head over them and a sill under them
  for (const wx of [6, 49]) {
    const wy = B_DOOR + 2;
    s.stamp(BARN_WINDOW, wx, wy);
    for (let x = wx - 1; x <= wx + BARN_WINDOW[0].length; x++) {
      const end = x === wx + BARN_WINDOW[0].length;
      s.set(x, wy - 1, end ? '5' : 'W');
      s.set(x, wy + BARN_WINDOW.length, end ? '5' : 'W');
      s.set(x, wy + BARN_WINDOW.length + 1, 'b');
    }
  }
  // fieldstone foundation in two courses; a concrete apron under the doors
  for (let r = B_FOUND; r < B_H; r += 2) {
    stones(s, 2, 18, r, r * 3 + 1);
    stones(s, 45, 61, r, r * 3 + 2);
  }
  for (let x = 19; x <= 44; x++) {
    s.set(x, B_FOUND, 'S');
    s.set(x, B_FOUND + 1, x === 44 ? '3' : 'A');
    s.set(x, B_FOUND + 2, x >= 43 ? '2' : '3');
    s.set(x, B_FOUND + 3, x >= 42 ? '2' : '3');
  }
  return { rows: s.rows(), lamp };
}

const BARN = barnSketch();

/**
 * The weathervane: a rooster (comb, beak, full chest, sickle feathers arching over his back) standing on
 * the arrow, on a rod (drawn over the inked barn, in iron). The rod is column 6; the last row sits on
 * the cupola's roof.
 */
const VANE: Rows = [
  '..x.x......xxx..',
  '..xxx.....xxxxx.',
  '.xxxx....xxx..xx',
  'xxxxx...xxx.xx.x',
  '..xxxx..xx.xx..x',
  '..xxxx.xx.xx..x.',
  '..xxxxxxxxxx....',
  '..xxxxxxxxx.....',
  '...xxxxxxx......',
  '....xxxxx.......',
  '.....x.x........',
  '.x..xxxxx.....xx',
  'xxxxxxxxxxxxxxxx',
  '.x....x.......xx',
  '......x.........',
];

function barnBuf(): PixelBuf {
  const b = inked(BARN.rows, BARN_PAINT);
  blit(b, fromRows(VANE, { x: '#3b3140' }), 1 + 31 - 6, 1 + B_CUP - VANE.length);
  return b;
}

// ------------------------------------------------------------------ the silo

/**
 * A concrete stave silo: a cylinder lit from the top left (a highlight band left of center, shade to
 * the right), steel bands every few rows, rain streaks under the dome, a ladder; a galvanized dome with
 * its seams and a vent cap; inked.
 */
function siloBuf(h: number): PixelBuf {
  const W = 20;
  const b = blank(W + 2, h);
  const wall = ['#5e5476', '#7f7394', '#a395a8', '#c6b6b2', '#e2d2c4', '#f4e8d8'];
  const metal = ['#4c5379', '#6c779b', '#94a0bb', '#bcc8d6', '#e0e8ee', '#ffffff'];
  const COLS = [3, 4, 5, 5, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 0, 0];
  const DOME = 11;
  const TOP = 3;
  // the dome: a half ellipse a pixel wider than the walls each side, seams running up to the vent
  for (let y = TOP; y < DOME; y++) {
    for (let x = 0; x < W + 2; x++) {
      const u = (x + 0.5 - (W + 2) / 2) / ((W + 2) / 2);
      const v = (y + 0.5 - DOME) / (DOME - TOP);
      if (u * u + v * v > 1.0) continue;
      const d = sphereLight(u, v * 0.9);
      let k = d > 0.8 ? 4 : d > 0.6 ? 3 : d > 0.35 ? 2 : d > 0.05 ? 1 : 0;
      const lon = Math.asin(clamp(u / Math.sqrt(Math.max(0.0001, 1 - v * v)), -1, 1));
      const f = (((lon / (Math.PI / 6) + 0.5) % 1) + 1) % 1;
      if (f < 0.16 && Math.abs(u) < 0.95) k = Math.max(0, k - 1);
      if (y === DOME - 1) k = Math.max(0, k - 1);
      if (k === 4 && u < -0.25 && u > -0.55 && v < -0.45 && v > -0.75) k = 5;
      setPx(b, x, y, metal[k]);
    }
  }
  // the vent cap
  setPx(b, 10, 0, metal[3]);
  setPx(b, 11, 0, metal[1]);
  for (let x = 9; x <= 12; x++) setPx(b, x, 1, x === 9 ? metal[4] : x === 12 ? metal[0] : metal[2]);
  setPx(b, 10, 2, metal[2]);
  setPx(b, 11, 2, metal[1]);
  // the walls
  const streaks: ReadonlyArray<readonly [number, number]> = [[5, 7], [9, 11], [14, 5], [16, 9]];
  for (let y = DOME; y < h; y++) {
    for (let x = 0; x < W; x++) {
      let k = COLS[x];
      const yy = y - DOME;
      if (yy === 0) k = Math.max(0, k - 2);
      else if (yy % 7 === 5) k = Math.max(0, k - 2);
      else if (yy % 7 === 6) k = Math.min(5, k + (x < 11 ? 1 : 0));
      else if (streaks.some(([sx, len]) => sx === x && yy > 0 && yy <= len)) k = Math.max(0, k - 1);
      if (y >= h - 3) k = Math.max(0, k - 1);
      setPx(b, x + 1, y, wall[k]);
    }
    // the ladder up the shaded side: two rails, rungs every other row
    if (y > DOME + 1 && y < h - 1) {
      setPx(b, 13, y, wall[0]);
      setPx(b, 15, y, wall[0]);
      if ((y - DOME) % 2 === 0) setPx(b, 14, y, metal[2]);
    }
  }
  return ink(b);
}

// ------------------------------------------------------------------ the scarecrow

/**
 * The scarecrow: a straw hat with a blue band and a drooping brim, a burlap head with button eyes and
 * a stitched grin, a rope at the neck, a plaid shirt on the crossbar with straw out of the cuffs and
 * collar, overalls with a patched knee, straw at the ankles, his pole. A crow sits on his left arm.
 */
const SCARECROW_W = 30;
const SCARECROW: Rows = (() => {
  const top = [
    '.............TTTt',
    '............TTTTtt',
    '...........TTtTTttN',
    '...........TTTTtttN',
    '...........HHHhhhhh',
    '......TTTTTTTTTTTTtttttt',
    '......ttNNNNNNNNNNNNNNNtt',
    '..........sssSSSSSSS..tNt',
    '..........WWsssssssS',
    '..........WswxsswxsS.....vv',
    '..........WsxxssxxsS....vVwO',
    '..........WsssSSsssS...vVvvOO',
    '..........WxssssssxS.vvVVvv',
    '..........WsxxxxxxsS..vvVvv',
    '..........sssxssxsSS.v.vvv',
    '.Y.........ttNNttNn.....v.v.Y',
  ];
  // the shirt on the crossbar: plaid (dark lines every five columns and along the third row), the
  // overalls' straps, straw out of the collar and the cuffs
  const arms: string[] = [];
  for (let r = 0; r < 4; r++) {
    let row = '';
    for (let x = 0; x < SCARECROW_W; x++) {
      let c: string;
      if (x === 0) c = r === 3 ? '.' : r % 2 === 0 ? 'Y' : 'y';
      else if (x === SCARECROW_W - 1) c = r === 3 ? '.' : r % 2 === 0 ? 'y' : 'Y';
      else if (r === 3 && (x === 1 || x === SCARECROW_W - 2)) c = x === 1 ? 'y' : 'Y';
      else if (x === 11 || x === 18) c = r === 0 ? 'c' : r === 3 ? 'o' : 'D';
      else if (r === 0 && (x === 13 || x === 16)) c = x === 13 ? 'Y' : 'y';
      else if (r === 3 && x > 11 && x < 18) c = 'D';
      else {
        const line = x % 5 === 2;
        c = [line ? 'R' : 'e', line ? 'r' : 'R', line ? 'Q' : 'r', line ? 'Q' : 'r'][r];
      }
      row += c;
    }
    arms.push(row);
  }
  const low = [
    '.Y........rcDDDDDDdQ........y',
    '..........rcDDDDDDdQ',
    '..........cDDDDDDDDd',
    '..........cDDDDDDDDd',
    '..........cDDdDDDDDd',
    '..........cDDDDDDDDd',
    '..........cDDDdcDDDd',
    '..........cDDDdcPPpd',
    '..........cDDDdcPPpd',
    '..........cDDDddpppd',
    '..........cDDDdcDDDd',
    '..........YyY.Nn.YyY',
    '...........Y.yNny.Y',
    '..............Nn',
    '..............Nn',
    '..............Nn',
    '..............Nn',
  ];
  return padded(SCARECROW_W, [...top, ...arms, ...low]);
})();

const SCARECROW_PAINT: Record<string, string> = {
  T: '#f2d27c', t: '#d4a44c', N: '#9c6c3e', n: '#6c4a3e',
  H: '#5a82c2', h: '#34528c',
  W: '#ead6ae', s: '#cfae7e', S: '#a8845e', x: '#3b2a2e', w: '#f6eedc',
  Y: '#f8e08e', y: '#d8aa52',
  e: '#e8794a', R: '#c4473c', r: '#8e3038', Q: '#6a2434',
  c: '#7ca2d4', D: '#4f72ae', d: '#34508a', P: '#e2b47e', p: '#b8865c', o: '#f2c23c',
  v: '#2e2a3c', V: '#5c5478', O: '#f0a43a',
};

// ------------------------------------------------------------------ pumpkins

const PUMPKIN = ['#6e2a22', '#a6451f', '#d46622', '#f28c32', '#ffb556', '#ffe0a0'] as const;
const LEAF = ['#3f6638', '#5d8a3e', '#86ad4a', '#b8c862'] as const;
const STEM = ['#4a5428', '#6d7c34', '#98a448'] as const;

/**
 * A pumpkin, squat and ribbed: lobes lit on their left with grooves between, the grooves curving in
 * toward the stem and the base, the whole lit from the top left with one glint; a curved stem.
 */
function pumpkin(w: number, h: number, seed: number): PixelBuf {
  return ink(pumpkinBody(w, h, seed));
}

/** A pumpkin before inking (heaped with others, they are inked together). */
function pumpkinBody(w: number, h: number, seed: number): PixelBuf {
  const top = 3;
  const b = blank(w, h + top);
  const lobes = Math.max(3, Math.round(w / 2.8));
  let glint = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5 - w / 2) / (w / 2);
      const v = (y + 0.5 - h / 2) / (h / 2);
      if (Math.abs(u) ** 2.4 + v * v > 1) continue;
      const span = Math.max(0.08, (1 - v * v) ** (1 / 2.4));
      const lon = clamp(u / span, -1, 1);
      const p = ((lon + 1) / 2) * lobes;
      const t = p % 1;
      let d = sphereLight(u, v) * 0.8 + (0.5 - t) * 0.5;
      if (t < 0.18 && p > 1) d -= 0.5;
      // the stem well darkens the top middle
      if (v < -0.7 && Math.abs(u) < 0.3) d -= 0.3;
      let k = d < -0.3 ? 0 : d < 0.05 ? 1 : d < 0.36 ? 2 : d < 0.62 ? 3 : 4;
      if (k === 4 && !glint && u < -0.2 && v < -0.2) {
        k = 5;
        glint = true;
      }
      setPx(b, x, y + top, PUMPKIN[k]);
    }
  }
  const sx = Math.floor(w / 2) - 1 + (seed % 2);
  setPx(b, sx, top - 1, STEM[1]);
  setPx(b, sx + 1, top - 1, STEM[0]);
  setPx(b, sx, top - 2, STEM[2]);
  setPx(b, sx + 1, top - 2, STEM[1]);
  if (w >= 8) setPx(b, sx + (seed % 3 === 0 ? -1 : 2), top - 3, STEM[1]);
  else setPx(b, sx + 1, top - 3, STEM[2]);
  return b;
}

/** A big pumpkin leaf: five lobes, lit on the top left, its veins lighter. */
const PUMPKIN_LEAF: Rows = [
  '..LL.l.',
  '.LlLLlL',
  'lLlLGlg',
  'GlGlGGg',
  '.GGlgg.',
  '..g.g..',
];
const LEAF_PAINT = { L: LEAF[3], l: LEAF[2], G: LEAF[1], g: LEAF[0] };

/** A wheelbarrow (wheel to the left), its red tray full of small pumpkins (heaped above its rim). */
const BARROW: Rows = [
  '',
  '',
  '',
  '',
  '',
  '.................tt.',
  '................tN..',
  '..eeeeeeeeeeeeettN..',
  '..eRRRRRRRRRRRrN....',
  '...RRRRRRRRRRrr.....',
  '....rRRRRRRRrr......',
  '..33.rrrrrrrr.......',
  '.3443...N...tN......',
  '.34243.N....tN......',
  '.3443..N....tN......',
  '..33...........',
];
const BARROW_PAINT = {
  e: '#e8604a', R: '#c43c3a', r: '#86283a', t: '#c09c76', N: '#7c5a4a',
  '3': '#3e3448', '4': '#6c6480', '2': '#a8a2b8',
};

function wheelbarrow(): PixelBuf {
  const rows = padded(20, BARROW);
  const b = blank(rows[0].length, rows.length);
  // pumpkins heaped in the tray (their shaded edges keep them apart), then the tray in front
  blit(b, pumpkinBody(7, 5, 3), 3, 1);
  blit(b, pumpkinBody(6, 4, 1), 11, 2);
  blit(b, pumpkinBody(6, 5, 2), 7, 0);
  blit(b, fromRows(rows, BARROW_PAINT), 0, 0);
  return ink(b);
}

/**
 * The pumpkin patch: hilled soil, curling vines and big leaves, pumpkins of all sizes, the scarecrow
 * keeping watch over it. `x` is its left edge; it is about 60 columns wide.
 */
function pumpkinPatch(b: PixelBuf, x: number): void {
  const W = 60;
  for (let y = BASE - 2; y <= BASE + 5; y++) {
    const inset = Math.max(0, BASE - y + 2) * 3;
    for (let xx = x + inset; xx < x + W - inset; xx++) {
      const hill = (xx - x + Math.floor((y - BASE) / 2) * 4) % 12;
      dot(b, xx, y, y === BASE - 2 || hill === 0 ? DIRT.deep : hill < 4 ? DIRT.lit : hill < 7 ? DIRT.base : DIRT.shade);
    }
  }
  // vines along the rows, with curling tendrils
  for (let xx = x + 3; xx < x + W - 3; xx++) {
    const yy = BASE + 1 + Math.round(Math.sin((xx - x) * 0.45));
    if (h2(xx, 0, 51) < 0.75) dot(b, xx, yy, LEAF[(xx - x) % 7 === 0 ? 1 : 0]);
    if ((xx - x) % 9 === 4) {
      dot(b, xx, yy - 1, LEAF[1]);
      dot(b, xx + 1, yy - 2, LEAF[1]);
      dot(b, xx + 2, yy - 1, LEAF[0]);
    }
  }
  const leaf = inked(PUMPKIN_LEAF, LEAF_PAINT);
  const leaves = [[x + 3, BASE, false], [x + 20, BASE - 1, true], [x + 37, BASE, false], [x + 50, BASE - 1, true], [x + 28, BASE + 1, false]] as const;
  for (const [lx, base, flip] of leaves) plant(b, leaf, lx, base, flip);
  plant(b, inked(SCARECROW, SCARECROW_PAINT), x + 16, BASE + 2);
  const pumpkins: ReadonlyArray<readonly [number, number, number, number]> = [
    [x + 1, BASE + 2, 9, 6],
    [x + 11, BASE + 5, 12, 8],
    [x + 26, BASE + 3, 6, 5],
    [x + 34, BASE + 5, 11, 8],
    [x + 47, BASE + 3, 8, 6],
    [x + 24, BASE + 6, 7, 5],
  ];
  pumpkins.forEach(([px, base, w, h], i) => plant(b, pumpkin(w, h, i), px, base));
}

// ------------------------------------------------------------------ the chicken coop

/**
 * The chicken coop on its legs: a corrugated tin roof over mint boards with white corner trim, a
 * four-pane window, the pop door with a hen looking out and its cleated ramp down to the yard, a nest
 * box with a lid on the side. Keys: E / e / r / q tin, G / g / j boards, W / 5 trim, k the dark inside,
 * H / J hen, R comb, y beak, N / n wood, x / c / C / w window.
 */
function coopSketch(): Rows {
  const ox = 8;
  const s = new Sketch(ox + 31, 26);
  // the roof: corrugated tin in ribs (lit, face, groove), a lit ridge cap, the drip edge
  for (let r = 0; r <= 5; r++) {
    const x0 = ox + 4 - Math.round((r * 4) / 5);
    const x1 = ox + 22 + Math.round((r * 4) / 5);
    for (let x = x0; x <= x1; x++) {
      const i = (x - ox) % 3;
      let c = i === 0 ? 'E' : i === 1 ? 'e' : 'r';
      if (r === 0) c = 'E';
      if (r === 5) c = x <= ox + 13 ? 'r' : 'q';
      if (x === x0) c = 'E';
      if (x === x1) c = 'q';
      s.set(x, r, c);
    }
  }
  // the walls: boards (lit edge, face, a groove), corner trim, the floor's edge, its shadow
  for (let r = 6; r <= 18; r++) {
    for (let x = ox + 2; x <= ox + 24; x++) {
      const i = (x - ox) % 3;
      let c = r === 6 ? 'j' : i === 0 ? 'G' : i === 1 ? 'g' : 'j';
      if (x === ox + 2) c = 'W';
      if (x === ox + 24) c = '5';
      if (r === 18) c = x === ox + 24 ? '5' : 'W';
      s.set(x, r, c);
    }
  }
  // the window
  s.stamp(['xxxxxx', 'xCCwCx', 'xCcwcx', 'xwwwwx', 'xCcwcx', 'xxxxxx'], ox + 10, 8);
  // the pop door, arched, a hen looking out
  for (let r = 11; r <= 17; r++) for (let x = ox + 4; x <= ox + 8; x++) if (!(r === 11 && (x === ox + 4 || x === ox + 8))) s.set(x, r, 'k');
  s.stamp(['..RR.', '.HHJ.', 'yHkJ.', '.RHJ.', '.HHJJ', 'HHHJJ'], ox + 4, 12);
  // the nest box on the side: a lid of tin, boards, its shadow
  for (let r = 9; r <= 16; r++) {
    for (let x = ox + 25; x <= ox + 30; x++) {
      let c: string;
      if (r === 9) c = x <= ox + 27 ? 'E' : 'e';
      else if (r === 10) c = x === ox + 30 ? 'q' : 'r';
      else c = x === ox + 30 ? 'j' : (x - ox) % 3 === 1 ? 'G' : 'g';
      if (r === 16) c = 'j';
      s.set(x, r, c);
    }
  }
  // legs and the ramp with its cleats
  for (let r = 19; r <= 25; r++) {
    s.set(ox + 3, r, 'N');
    s.set(ox + 4, r, 'n');
    s.set(ox + 22, r, 'N');
    s.set(ox + 23, r, 'n');
    s.set(ox + 13, r, 'n');
  }
  for (let i = 0; i <= 12; i++) {
    const x = ox + 5 - i;
    const r = 19 + Math.floor(i / 2);
    s.set(x, r, 'N');
    s.set(x, r + 1, 'n');
    if (i % 3 === 1) s.set(x, r - 1, 'N');
  }
  return s.rows();
}

const COOP = coopSketch();
const COOP_PAINT: Record<string, string> = {
  E: '#e89a6a', e: '#c86e48', r: '#94443a', q: '#6c3036',
  G: '#a6d6ac', g: '#82b692', j: '#5e8c7a',
  W: '#f5e9d5', '5': '#cbbccb', k: '#3d2229',
  H: '#f6f0e4', J: '#c8bcc4', R: '#e0402e', y: '#f2b036',
  N: '#b08458', n: '#6e4c40',
  x: '#f5e9d5', c: '#55709a', C: '#b6d1e6', w: '#e9dccb',
};

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
      if (front(px - 3.3, py - 3.9) > i) d -= 0.4;
      d -= Math.max(0, (py - gcy) / gry - 0.55) * 0.9;
      d += bias;
      const t = d < -0.3 ? 0 : d < 0.06 ? 1 : d < 0.36 ? 2 : d < 0.58 ? 3 : 4;
      setPx(b, x, y, tones5[t]);
    }
  }
  despeckle(b);
  return b;
}

const BARK = { dark: '#4a3340', mid: '#6e4a44', lit: '#9a6c50', hi: '#b8885e' };

/**
 * A tree: a crown over a trunk four pixels wide (lit to dark, bark in short furrows) that forks into
 * two limbs under the leaves, a root flare, all inked.
 */
function tree(crownBuf: PixelBuf, trunkX: number, trunkH: number): PixelBuf {
  const w = crownBuf.w;
  const top = crownBuf.h;
  const b = blank(w, top + trunkH);
  const bottom = b.h - 1;
  const furrow = (k: number, y: number) => hash01(k * 53 + Math.floor((y + k * 2) / 3) * 11) < 0.3;
  for (let y = top - 6; y <= bottom; y++) {
    setPx(b, trunkX, y, (bottom - y) % 7 === 3 ? BARK.hi : BARK.lit);
    setPx(b, trunkX + 1, y, furrow(1, y) ? BARK.dark : BARK.mid);
    setPx(b, trunkX + 2, y, furrow(2, y) ? BARK.dark : BARK.mid);
    setPx(b, trunkX + 3, y, BARK.dark);
  }
  setPx(b, trunkX - 1, bottom, BARK.lit);
  setPx(b, trunkX - 1, bottom - 1, BARK.lit);
  setPx(b, trunkX - 2, bottom, BARK.mid);
  setPx(b, trunkX + 4, bottom, BARK.dark);
  setPx(b, trunkX + 4, bottom - 1, BARK.dark);
  setPx(b, trunkX + 5, bottom, BARK.dark);
  blit(b, crownBuf, 0, 0);
  for (let i = 1; i <= 3; i++) {
    setPx(b, trunkX - i, top - i, i === 3 ? BARK.mid : BARK.lit);
    setPx(b, trunkX + 3 + i, top - i, BARK.dark);
  }
  return ink(b);
}

/** Sugar maple leaves in October: burgundy shade, rust, orange, gold, pale gold. */
const MAPLE_LEAF = ['#7a2c38', '#b2442f', '#dc7230', '#f2a43e', '#ffd47a'] as const;

const maple = (): PixelBuf =>
  tree(
    crown(
      47,
      36,
      [[9.25, 22.75, 8.25], [36.25, 22.75, 8.25], [13.75, 12.25, 9], [31.75, 11.5, 9], [23.75, 8.5, 8.25], [23.75, 22.75, 10.5], [23.75, 16.75, 9.75]],
      MAPLE_LEAF,
      7,
      4.6,
    ),
    22,
    13,
  );

// ------------------------------------------------------------------ hay

const HAY = ['#7a5232', '#a5733c', '#cf9f4a', '#ebc671', '#fbe7a6'] as const;

/**
 * A round bale lying on its side: its rolled end facing us (a spiral of hay, lit on the upper left)
 * and the curve of its side running back to the right, lit along the top, with streaks of straw.
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
      let k = v < -0.6 ? 3 : v < -0.05 ? 2 : v < 0.5 ? 1 : 0;
      if (hash01(Math.floor((x + y * 3) / 4) * 7 + y * 13) < 0.2 && k > 0) k -= 1;
      setPx(b, x, y, HAY[k]);
    }
  }
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      const u = (x + 0.5 - c) / r;
      const v = (y + 0.5 - c) / r;
      const rr = Math.hypot(u, v) * r;
      if (rr > r) continue;
      const litSide = u + v < 0.2;
      // the roll's spiral: a groove every 2.6 pixels, drifting outward once round; a plain hub
      const turn = (rr - ((Math.atan2(v, u) / (2 * Math.PI) + 1) % 1) * 2.6) / 2.6;
      let k = litSide ? 4 : 3;
      if (rr > 2 && ((turn % 1) + 1) % 1 > 0.66) k -= litSide ? 1 : 2;
      if (rr > r - 1) k = litSide ? 3 : 1;
      if (rr < 1.5) k = 2;
      setPx(b, x, y, HAY[k]);
    }
  }
  return ink(b);
}

// ------------------------------------------------------------------ fences, windpump, trough

const WOOD = { hi: '#dcbf96', lit: '#c09c76', mid: '#987862', shade: '#705858', dark: '#523f4a' };

/**
 * A post-and-rail fence of weathered wood, `n` bays: posts three pixels wide (lit left, a lit cap),
 * two rails each a lit top over a shaded underside with grain, outlined in dark wood (lighter than
 * ink, so the fence stays in the background).
 */
function fence(n: number): PixelBuf {
  const bay = 13;
  const w = n * bay + 3;
  const h = 12;
  const b = blank(w, h);
  for (const ry of [2, 7]) {
    for (let x = 0; x < w; x++) {
      setPx(b, x, ry, WOOD.lit);
      setPx(b, x, ry + 1, hash01(Math.floor(x / 4) * 7 + ry) < 0.3 ? WOOD.shade : WOOD.mid);
    }
  }
  for (let i = 0; i <= n; i++) {
    const x = i * bay;
    for (let y = 0; y < h; y++) {
      setPx(b, x, y, y === 0 ? WOOD.hi : WOOD.lit);
      setPx(b, x + 1, y, y === 0 ? WOOD.lit : y % 5 === 3 ? WOOD.shade : WOOD.mid);
      setPx(b, x + 2, y, WOOD.shade);
    }
  }
  return outline(b, WOOD.dark);
}

/**
 * A windpump: a lattice tower of galvanized iron (two legs converging, girts and cross braces), a
 * little platform under its wheel of blades facing us, a red tail vane on its boom, the pump rod down
 * the middle.
 */
function windpump(): PixelBuf {
  const W = 32;
  const H = 61;
  const s = new Sketch(W, H);
  const cx = 12;
  const top = 18;
  const base = H - 1;
  const legX = (y: number, side: number) => cx + side * (1 + Math.round(((y - top) / (base - top)) * 8));
  for (let y = top; y <= base; y++) {
    s.set(legX(y, -1), y, '4');
    s.set(legX(y, 1), y, '2');
  }
  for (let y0 = top + 4; y0 + 10 <= base; y0 += 10) {
    const y1 = y0 + 10;
    for (let x = legX(y0, -1); x <= legX(y0, 1); x++) s.set(x, y0, '3');
    s.line(legX(y0, -1), y0, legX(y1, 1), y1, '2');
    s.line(legX(y0, 1), y0, legX(y1, -1), y1, '2');
  }
  for (let x = legX(base, -1); x <= legX(base, 1); x++) if (x % 2 === 0) s.set(x, base, '3');
  for (let y = top; y <= base; y++) if (s.at(cx, y) === '.') s.set(cx, y, '1');
  s.rect(cx - 5, top, 11, 1, '3');
  s.set(cx - 5, top, '4');
  s.rect(cx - 5, top + 1, 11, 1, '2');
  // the tail vane on its boom, off to the right
  const wy = top - 9;
  s.rect(cx + 3, wy, 10, 1, '2');
  s.rect(cx + 3, wy - 1, 10, 1, '3');
  for (let y = wy - 6; y <= wy + 5; y++) {
    const w = 6 - Math.floor(Math.abs(y - wy + 0.5) / 2);
    for (let x = 0; x < w; x++) s.set(cx + 13 + x, y, x === 0 ? 'e' : y < wy ? 'R' : 'r');
  }
  // the wheel: blades in a ring round the hub, every other one catching the light
  for (let y = wy - 11; y <= wy + 11; y++) {
    for (let x = cx - 11; x <= cx + 11; x++) {
      const u = x - cx;
      const v = y - wy;
      const r = Math.hypot(u, v);
      if (r > 10.8 || r < 2) continue;
      const a = Math.atan2(v, u);
      const blade = Math.floor(((a + Math.PI) / (2 * Math.PI)) * 18) % 2;
      if (r > 9.8) s.set(x, y, u + v < 0 ? '3' : '2');
      else if (r < 3.4) s.set(x, y, '2');
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

/** A wooden water trough holding the sky, an iron band round it. */
const TROUGH: Rows = [
  'TTTTttttttttttttN',
  'tCCCwwCCCCCcCCCcN',
  'tccCCcccccccccccn',
  'tNNNNNNNNNNNNNNNn',
  '1111111111111111n',
  'tNNNNNNNNNNNNNNNn',
  'tNNNNNNNNNNNNNNNn',
  '.nn..........nn..',
];
const TROUGH_PAINT = {
  T: WOOD.hi, t: WOOD.lit, N: WOOD.mid, n: WOOD.shade,
  C: '#f0d6a8', c: '#9c90c0', w: '#fff4d8', '1': '#5e5a76',
};

// ------------------------------------------------------------------ the yard

/**
 * The farmyard: the far edge lit, hazier grass behind the buildings, then grass textured with short
 * strokes a step lighter or darker, and clover and dandelions in flower here and there.
 */
function yard(b: PixelBuf): void {
  for (let y = YARD; y < b.h; y++) {
    const runs = runIds(40 + y, 3, 7);
    for (let x = 0; x < TILE_W; x++) {
      const r = hash01(runs[x] * 7 + y * 131);
      let c: string;
      if (y === YARD) c = r < 0.3 ? GRASS.far : GRASS.farRim;
      else if (y < BASE - 2) c = r < 0.2 ? GRASS.farDim : GRASS.far;
      else c = r < 0.14 ? GRASS.shade : r > 0.9 ? GRASS.lit : GRASS.base;
      dot(b, x, y, c);
    }
  }
}

/** Little flowers in the grass: [x, row, petal, heart]; each a lit petal over a shaded one, on a stem. */
function yardFlowers(b: PixelBuf, spots: ReadonlyArray<readonly [number, number, string, string]>): void {
  for (const [x, y, petal, heart] of spots) {
    dot(b, x, y, petal);
    dot(b, x + 1, y, heart);
    dot(b, x + 1, y - 1, petal);
    dot(b, x, y + 1, GRASS.shade);
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

/** Bare earth: a worn patch in front of the barn doors, widening toward the road, with wheel ruts. */
function dirtPatch(b: PixelBuf, x0: number, x1: number, y0: number): void {
  for (let y = y0; y < b.h; y++) {
    const grow = Math.floor((y - y0) / 2);
    for (let x = x0 - grow; x <= x1 + grow; x++) {
      const edge = x === x0 - grow || x === x1 + grow;
      const r = h2(Math.floor(x / 4), y, 77);
      let c = edge ? GRASS.shade : r < 0.2 ? DIRT.shade : r > 0.85 ? DIRT.lit : DIRT.base;
      const mid = (x0 + x1) / 2;
      if (!edge && y > y0 && (Math.abs(x - (mid - 6 - grow * 0.5)) < 1 || Math.abs(x - (mid + 6 + grow * 0.5)) < 1)) c = DIRT.shade;
      dot(b, x, y, c);
    }
  }
}

/** Where things stand in the mid tile (left edges before inking). */
const SILO_X = 6;
const BARN_X = 18;
const PATCH_X = 146;
const BARROW_X = 207;
const COOP_X = 226;
const MAPLE_X = 274;
const PUMP_X = 350;

function midLayer(): PixelBuf {
  const b = blank(TILE_W, MID_SPOT.h);
  yard(b);

  const barn = barnBuf();
  const tree1 = maple();
  const pump = windpump();
  const coop = inked(COOP, COOP_PAINT);

  // shadows on the grass, to the right of things (light from the top left)
  grassShadow(b, BARN_X + barn.w + 3, BASE - 0.5, 12, 2);
  grassShadow(b, MAPLE_X + 33, BASE + 3, 18, 2.6);
  grassShadow(b, COOP_X + 30, BASE + 1, 11, 1.8);
  grassShadow(b, PUMP_X + 24, BASE + 1.5, 10, 1.8);

  // the worn earth in front of the barn doors
  dirtPatch(b, BARN_X + 21, BARN_X + 44, BASE);

  // flowers in the grass
  yardFlowers(b, [
    [96, BASE - 1, '#f8f2e8', '#f2c23c'], [104, BASE + 2, '#f6d24a', '#d09a2a'], [121, BASE, '#e8a8d8', '#b46aa8'],
    [133, BASE + 3, '#f8f2e8', '#f2c23c'], [196, BASE + 1, '#f6d24a', '#d09a2a'], [262, BASE + 2, '#f8f2e8', '#f2c23c'],
    [335, BASE, '#e8a8d8', '#b46aa8'], [384, BASE + 2, '#f6d24a', '#d09a2a'],
  ]);

  // the fence along the back of the yard, behind the maple and the bales
  plant(b, fence(7), 262, YARD + 6);

  // the silo behind the barn, then the barn
  plant(b, siloBuf(72), SILO_X, BASE - 1);
  plant(b, barn, BARN_X, BASE);

  // the pumpkin patch and its scarecrow, a wheelbarrow of pumpkins at its end
  pumpkinPatch(b, PATCH_X);
  plant(b, wheelbarrow(), BARROW_X, BASE + 3);

  // the coop
  plant(b, coop, COOP_X, BASE + 1);

  // the maple with bales in its shade, its fallen leaves on the grass
  for (let i = 0; i < 14; i++) {
    const lx = MAPLE_X + 6 + Math.floor(h2(i, 1, 81) * 54);
    const ly = BASE - 1 + Math.floor(h2(i, 2, 81) * 7);
    const k = 2 + Math.floor(h2(i, 3, 81) * 3);
    dot(b, lx, ly, MAPLE_LEAF[k]);
    dot(b, lx + 1, ly, MAPLE_LEAF[k - 1]);
  }
  plant(b, tree1, MAPLE_X, BASE + 1);
  plant(b, roundBale(7.5, 6), MAPLE_X + 40, BASE + 3);
  plant(b, roundBale(6, 5), MAPLE_X + 56, BASE + 5);

  // the windpump and its trough
  plant(b, pump, PUMP_X, BASE);
  plant(b, inked(TROUGH, TROUGH_PAINT), PUMP_X + 17, BASE + 3);
  return b;
}

/** Where an inked sketch planted at (x, base) puts its pixel (sx, sy). */
function sketchAt(rows: Rows, x: number, base: number, sx: number, sy: number): [number, number] {
  const top = base - (rows.length + 2) + 1;
  return [wrap(x + 1 + sx), top + 1 + sy];
}

/** The barn's and the coop's windows and the barn lamp, in mid-layer pixels. */
function midLights(): LightSpot[] {
  const win = (rows: Rows, x: number, base: number): LightSpot[] =>
    windowsOf(rows).map((w): LightSpot => {
      const [lx, ly] = sketchAt(rows, x, base, w.x, w.y);
      return { ...w, x: lx, y: ly, kind: 'window' };
    });
  const [lx, ly] = sketchAt(BARN.rows, BARN_X, BASE, BARN.lamp[0], BARN.lamp[1]);
  const lamp: LightSpot = {
    x: lx,
    y: ly,
    w: 2,
    h: 1,
    kind: 'lamp',
    color: '#FFD08A',
    radius: 10,
    power: 1,
    pool: { x: lx + 1, y: BASE + 2, rx: 13, ry: 3 },
  };
  return [...win(BARN.rows, BARN_X, BASE), ...win(COOP, COOP_X, BASE + 1), lamp];
}

// ================================================================== ground

/** A frame row as a ground-layer row. */
const gy = (row: number): number => row - GROUND_SPOT.y;
/**
 * The far verge's base row (its clumps peak up to 6 rows above it, a few seed heads higher), the
 * road (its far edge, ruts, the calm rows under the feet, its front lip), the near verge and the
 * wheat field's edge.
 */
const VERGE = 89;
const ROAD0 = 93;
const RUT_FAR = 96;
const CALM0 = FEET;
const CALM1 = FEET + 5;
const RUT_NEAR = 106;
const ROAD1 = 108;
const NEAR0 = 109;
const FIELD = 114;
const BOTTOM = FRAME_H - 1;

const ROAD = {
  deep: '#6c4a44', rut: '#8a6250', shade: '#a27a58', soft: '#b68d62', base: '#bd9466', lit: '#d2ab78', pale: '#e2c391',
  pebble: '#ecdcbc', pebbleMid: '#c4ae9a', pebbleDark: '#8a7680',
};
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
 * where it meets the road, and taller stalks with seed heads.
 */
function farVerge(b: PixelBuf): void {
  const clumps = runIds(61, 6, 12);
  const start: number[] = [];
  for (let x = 0, s0 = 0; x < TILE_W; x++) {
    if (x === 0 || clumps[x] !== clumps[x - 1]) s0 = x;
    start.push(s0);
  }
  for (let x = 0; x < TILE_W; x++) {
    const id = clumps[x];
    let len = 0;
    while (clumps[wrap(start[x] + len)] === id && len < 16) len++;
    const t = (x - start[x] + 0.5) / len;
    const dry = hash01(id * 3 + 600) < 0.4;
    const k = dry ? DRY : VG;
    const peak = 3 + Math.floor(hash01(id * 3 + 601) * 4);
    const blade = (x + id) % 3 === 0 ? 1 : (x + id) % 5 === 2 ? 2 : 0;
    const top = VERGE - Math.max(0, Math.round(peak * (1 - Math.abs(2 * t - 1) ** 1.6)) - blade);
    for (let row = top; row < ROAD0; row++) {
      let c = row === top ? k.tip : row === top + 1 ? k.lit : row >= ROAD0 - 1 ? VG.deep : row >= ROAD0 - 3 ? k.shade : k.base;
      // blade strokes: some columns a step darker below the tips
      if (row > top + 1 && row < ROAD0 - 3 && (x + id) % 3 === 1 && row % 4 !== 0) c = k.shade;
      dot(b, x, gy(row), c);
    }
  }
  // taller stalks: a bare stem with a seed head (foxtail) or a plume
  for (let x = 0; x < TILE_W; x++) {
    if (h2(x, 1, 62) >= 0.07 || h2(x - 1, 1, 62) < 0.07 || h2(x - 2, 1, 62) < 0.07) continue;
    const dry = h2(x, 3, 62) < 0.6;
    const k = dry ? DRY : VG;
    const top = VERGE - 7 - Math.floor(h2(x, 2, 62) * 4);
    for (let row = top + 3; row < ROAD0 - 1; row++) dot(b, x, gy(row), row < VERGE - 3 ? k.shade : VG.shade);
    dot(b, x, gy(top), k.tip);
    dot(b, x, gy(top + 1), k.lit);
    dot(b, x + 1, gy(top + 1), k.base);
    dot(b, x, gy(top + 2), k.base);
    dot(b, x + 1, gy(top + 2), k.shade);
  }
}

/** The road: packed dirt, a rut each side of a calm crown, a lip of light on the near edge. */
function road(b: PixelBuf): void {
  const runs = runIds(71, 4, 9);
  // under the feet only long, faint strokes, a hair darker than the dirt
  const calmRuns = runIds(73, 8, 16);
  // soft patches of drier (lighter) and packed (darker) dirt, wider than tall
  const patch = (x: number, row: number): number => {
    const cx = Math.floor(x / 13);
    const u = (x % 13) / 13;
    const a = h2(cx * 13, row >> 1, 72);
    const bb = h2(cx * 13 + 13, row >> 1, 72);
    return a + (bb - a) * u;
  };
  for (let row = ROAD0; row <= ROAD1; row++) {
    for (let x = 0; x < TILE_W; x++) {
      const r = hash01(runs[wrap(x + row * 5)] * 7 + row * 131);
      let c = ROAD.base;
      if (row === ROAD0) c = ROAD.deep;
      else if (row === ROAD0 + 1) c = r < 0.3 ? ROAD.rut : ROAD.shade;
      else if (row === ROAD0 + 2) c = r < 0.3 ? ROAD.shade : ROAD.base;
      else if (row === RUT_FAR) c = r < 0.2 ? ROAD.deep : ROAD.rut;
      else if (row === RUT_FAR + 1) c = r < 0.35 ? ROAD.rut : ROAD.shade;
      else if (row === RUT_FAR + 2) c = r < 0.25 ? ROAD.pale : ROAD.lit;
      else if (row === RUT_NEAR) c = r < 0.2 ? ROAD.deep : ROAD.rut;
      else if (row === RUT_NEAR + 1) c = r < 0.4 ? ROAD.rut : ROAD.shade;
      else if (row === ROAD1) c = r < 0.3 ? ROAD.pale : ROAD.lit;
      else if (!calm(row)) {
        const p = patch(x, row);
        c = p > 0.72 ? ROAD.lit : p < 0.22 ? ROAD.shade : r < 0.1 ? ROAD.soft : ROAD.base;
      } else if (hash01(calmRuns[wrap(x + row * 7)] * 3 + row * 17) < 0.12) c = ROAD.soft;
      dot(b, x, gy(row), c);
    }
  }
  // blades hanging over the road's far edge
  for (let x = 0; x < TILE_W; x++) {
    if (h2(x, 3, 63) < 0.16 && h2(x - 1, 3, 63) >= 0.16) {
      dot(b, x, gy(ROAD0), VG.shade);
      if (h2(x, 4, 63) < 0.5) dot(b, x, gy(ROAD0 + 1), VG.deep);
    }
  }
}

/**
 * The near verge: a strip of grass in the road lip's shadow, then the edge of a wheat field: a ragged
 * row of ears along the top (grains lit on the left, awns here and there) over a golden mass of stalks
 * streaked darker, in shade toward the bottom of the view.
 */
function nearVerge(b: PixelBuf): void {
  // grass: the road lip's shadow, a lit row, then blades in short strokes a step darker or lighter
  const strokes = runIds(69, 2, 5);
  for (let x = 0; x < TILE_W; x++) {
    for (let row = NEAR0; row <= BOTTOM; row++) {
      let c = VG.base;
      if (row === NEAR0) c = VG.shade;
      else if (row === NEAR0 + 1) c = h2(x >> 2, row, 68) < 0.3 ? VG.base : VG.lit;
      else {
        const s = hash01(strokes[wrap(x + row * 3)] * 5 + row * 11);
        if (s < 0.2) c = VG.shade;
        else if (s > 0.9) c = VG.lit;
      }
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
  // the wheat: a ragged row of ears (each two columns, grains lit on the left and notched on the right,
  // one or two columns apart, tops uneven, a few leaning, awns here and there) over the stalks in
  // long strokes, in shade toward the bottom
  const stalk = (x: number, row: number): string => {
    if (row >= BOTTOM - 2) return h2(x, row, 67) < 0.3 ? WHEAT[1] : WHEAT[0];
    const run = Math.floor((row + Math.floor(h2(x, 0, 66) * 4)) / 4);
    return h2(x, run, 66) < 0.35 ? WHEAT[2] : WHEAT[1];
  };
  for (let x = 0; x < TILE_W; x++) for (let row = FIELD + 2; row <= BOTTOM; row++) dot(b, x, gy(row), stalk(x, row));
  // an ear's rows: [left column, right column] as WHEAT tones (-1: none)
  const EAR: ReadonlyArray<readonly [number, number]> = [
    [4, -1],
    [4, 2],
    [3, 3],
    [4, 2],
    [3, 3],
    [2, 1],
  ];
  for (let k = 0, x = 0; x + 3 <= TILE_W; k++) {
    const top = FIELD - 1 + Math.floor(hash01(k * 17 + 3) * 4);
    const lean = hash01(k * 29 + 1) < 0.2 ? 1 : 0;
    EAR.forEach(([a, bb], r) => {
      const dx = r < 2 ? lean : 0;
      dot(b, x + dx, gy(top + r), WHEAT[a]);
      if (bb >= 0) dot(b, x + 1 + dx, gy(top + r), WHEAT[bb]);
    });
    for (let row = top + EAR.length; row < FIELD + 2; row++) {
      dot(b, x, gy(row), stalk(x, row));
      dot(b, x + 1, gy(row), stalk(x + 1, row));
    }
    if (hash01(k * 31 + 5) < 0.3) dot(b, x + lean, gy(top - 1), WHEAT[3]);
    x += 3 + (hash01(k * 13 + 7) < 0.35 ? 1 : 0);
  }
}

/** A puddle in the far rut, holding the sky: gold over violet, a glint. */
const PUDDLE_X = 294;

/** Road details: the puddle, pebbles (clusters on the shoulders, a few strays), fallen leaves, straw. */
function roadDetails(b: PixelBuf): void {
  const puddle: ReadonlyArray<readonly [number, number, number]> = [[RUT_FAR, -1, 15], [RUT_FAR + 1, 1, 11]];
  for (const [row, x0, w] of puddle) {
    for (let i = x0; i < x0 + w; i++) {
      const edge = i === x0 || i === x0 + w - 1;
      let c = row === RUT_FAR ? (i < 7 ? '#f0cf9c' : '#c9a6b4') : '#9f8cb4';
      if (row === RUT_FAR && (i === 4 || i === 5)) c = '#fff0c8';
      if (edge) c = row === RUT_FAR ? ROAD.deep : ROAD.shade;
      dot(b, PUDDLE_X + i, gy(row), c);
    }
  }
  // pebble clusters on the shoulders: a lit top-left stone, a darker one, a small one
  const clusters: ReadonlyArray<readonly [number, number]> = [[57, ROAD0 + 1], [177, ROAD0 + 1], [264, ROAD1 - 1], [363, ROAD0 + 1], [120, ROAD1 - 1]];
  for (const [cx, row] of clusters) {
    dot(b, cx, gy(row), ROAD.pebble);
    dot(b, cx + 1, gy(row), ROAD.pebbleMid);
    dot(b, cx, gy(row + 1), ROAD.pebbleMid);
    dot(b, cx + 1, gy(row + 1), ROAD.pebbleDark);
    dot(b, cx + 3, gy(row + 1), ROAD.pebble);
    dot(b, cx + 4, gy(row + 1), ROAD.pebbleDark);
  }
  // pebbles: a lit top over a dark bottom, clear of the rows under the feet
  for (let row = ROAD0 + 2; row < RUT_NEAR; row++) {
    if (calm(row) || row === RUT_FAR || row === RUT_FAR + 1) continue;
    for (let x = 0; x < TILE_W; x++) {
      if (h2(x, row, 90) < 0.988) continue;
      dot(b, x, gy(row), ROAD.pebble);
      dot(b, x + 1, gy(row), ROAD.pale);
      dot(b, x + 2, gy(row), ROAD.shade);
    }
  }
  // fallen leaves blown onto the road (a lit half, a dark half, a stem) and wisps of straw
  const leaves: ReadonlyArray<readonly [number, number, string, string]> = [
    [33, 95, '#e8853a', '#b04a2e'],
    [145, 107, '#f2b84a', '#c47a30'],
    [241, 98, '#d8603a', '#963a34'],
    [331, 107, '#f0a040', '#b45a2e'],
    [81, 98, '#f2b84a', '#c47a30'],
  ];
  for (const [x, row, lit, dark] of leaves) {
    dot(b, x, gy(row), lit);
    dot(b, x + 1, gy(row), dark);
    dot(b, x + 1, gy(row - 1), lit);
    dot(b, x + 2, gy(row + 1), ROAD.deep);
  }
  for (const [x, row] of [[18, 98], [206, 107], [300, 98]] as const) {
    for (let i = 0; i < 4; i++) dot(b, x + i, gy(row + (i > 1 ? 1 : 0)), i % 2 === 0 ? WHEAT[4] : WHEAT[3]);
  }
}

/** Wildflowers standing in the far verge: goldenrod plumes, chicory, asters, Queen Anne's lace. */
function vergeFlowers(b: PixelBuf): void {
  // [x, row of the bloom's top, kind]
  const flowers: ReadonlyArray<readonly [number, number, number]> = [
    [24, 82, 0], [66, 84, 1], [117, 82, 0], [183, 84, 3], [231, 82, 2], [294, 84, 0], [354, 82, 1], [150, 83, 2],
  ];
  const kinds: ReadonlyArray<readonly [readonly string[], Readonly<Record<string, string>>]> = [
    // goldenrod: a nodding plume
    [['.YY', 'YYy', 'Yy.', '.y.'], { Y: '#f6d24a', y: '#d09a2a' }],
    // chicory: a blue star
    [['.b.', 'bwb', '.B.'], { b: '#9cb8f0', B: '#6a7fd0', w: '#e8eefc' }],
    // asters: a purple daisy, gold heart
    [['.a.', 'ayA', '.A.'], { a: '#c89ae8', A: '#9468c8', y: '#f2c23c' }],
    // Queen Anne's lace: a flat white umbel
    [['wwwW', '.wW.'], { w: '#f8f2f4', W: '#c8b8d8' }],
  ];
  for (const [x, row, kind] of flowers) {
    const [rows, map] = kinds[kind];
    const stemX = x + Math.floor(rows[0].length / 2);
    for (let r = row + rows.length; r < VERGE + 2; r++) dot(b, stemX, gy(r), VG.shade);
    rows.forEach((line, ry) => {
      for (let rx = 0; rx < line.length; rx++) if (line[rx] !== '.') dot(b, x + rx, gy(row + ry), map[line[rx]]);
    });
  }
}

/** A farm mailbox on a weathered post, its red flag up. */
const MAILBOX: Rows = [
  '.........RR.',
  '.........Re.',
  '..55555..R..',
  '.5WWWW55.R..',
  '5WWWWW555R..',
  '5W55555554..',
  '5W55555554..',
  '544444443...',
  '..ttNNNn....',
  '....tNn.....',
  '....tNn.....',
  '....tNn.....',
  '....tNn.....',
  '...ttNNn....',
];
const MAILBOX_X = 213;

function mailbox(b: PixelBuf): void {
  const box = inked(MAILBOX, {
    '5': '#9fa0b8', W: '#d8dae6', '4': '#787a94', '3': '#5c5e78',
    R: '#c8423c', e: '#ea6a4e', t: WOOD.lit, N: WOOD.mid, n: WOOD.shade,
  });
  plant(b, box, MAILBOX_X, gy(VERGE + 4));
}

// ================================================================== fg

/** Tall grass tufts: blades of uneven heights, some leaning, tips lit, darkening toward the roots. */
const TUFTS: readonly Rows[] = [
  [
    '.....L.....',
    '..L..lL....',
    '..lL.lG..L.',
    'L.lG.lG.lG.',
    'lLlG.GG.lGL',
    'lGlGlGGllGg',
    'GGlGGGGlGGg',
    'gGGGgGGGGgg',
    'ggggggggggg',
  ],
  ['...L...', '.L.lL..', '.lLlG.L', 'LlGlGlG', 'lGGGGGg', 'GGGgGGg', 'ggggggg'],
  [
    '..L.......L..',
    '..lL...L..lL.',
    'L.lG..LlG.lG.',
    'lLlG.LlGG.lGL',
    'lGlGLlGGGlGGg',
    'GGGGlGGGGGGgg',
    'gGGGGGgGGGggg',
    'ggggggggggggg',
  ],
];

/** Wildflowers: petals and a heart on a stem with a leaf (recolor w / v / y for other kinds). */
const FLOWER: Rows = ['.w.w.', 'wwyww', '.wyv.', '.vGv.', '..G..', '.lG..', '..G..'];

/** Wheat ears on bare stalks, near the camera (not inked: thin stalks would drown in ink). */
const WHEAT_EARS: Rows = [
  '.Y.....Y..',
  '.Y....YY..',
  'YO....YO..',
  'yO...YOO..',
  'YO...yO...',
  'yo...YO...',
  'Yo...yo...',
  '.o...Yo...',
  '.o....o...',
  '.o....o...',
  '..o...o...',
  '..o....o..',
  '..o....o..',
];

function fgLayer(): PixelBuf {
  const H = FG_SPOT.h;
  const b = blank(TILE_W, H);
  const greens = { L: VG.tip, l: VG.lit, G: VG.base, g: VG.shade };
  const tufts = TUFTS.map((t) => inked(t, greens));
  const ears = fromRows(WHEAT_EARS, { Y: WHEAT[4], y: WHEAT[3], O: WHEAT[2], o: WHEAT[1] });
  const flowers = [
    inked(FLOWER, { w: '#f6f0f2', v: '#c8b8d8', y: '#f2c23c', G: VG.shade, l: VG.lit }),
    inked(FLOWER, { w: '#9cb8f0', v: '#6a7fd0', y: '#f4eef4', G: VG.shade, l: VG.lit }),
    inked(FLOWER, { w: '#f6d24a', v: '#d09a2a', y: '#d0782a', G: VG.shade, l: VG.lit }),
  ];
  // [x, what]: tufts (0 to 2), wheat (3), flowers (4 to 6); sparse
  const items: ReadonlyArray<readonly [number, number]> = [
    [9, 2], [25, 3],
    [62, 1],
    [96, 4], [102, 1],
    [165, 3], [174, 0],
    [213, 6],
    [246, 5], [252, 3],
    [285, 2], [300, 6],
    [354, 3], [364, 1],
  ];
  for (const [x, what] of items) {
    const s = what < 3 ? tufts[what] : what === 3 ? ears : flowers[what - 4];
    put(b, s, x, H - s.h + 1, what < 3 && h2(x, 0, 9) < 0.5);
  }
  return b;
}

// ================================================================== the set

export const FARM: ScenerySet = {
  frame: SCENE_FRAME,
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
