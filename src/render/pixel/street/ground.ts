/**
 * The street's ground layer (scene rows 39 to 81) and foreground (rows 73 to 81).
 *
 * Ground, top to bottom: two street lamps (iron lanterns on posts, rows 39 to 58) standing on the
 * lawn edge (row 58), the curb (59 lit top, 60 face, 61 shadow line) with a painted stretch and a
 * storm drain, the sidewalk the fighters stand on (62 to 72, their feet on row 67, SCENE_FEET_ROW, mid-slab)
 * and a grass verge (73 to 81). The rows under the feet (68 to 70, where HP bars sit) stay plain slab.
 * Foreground: a few clumps of grass in shade, flowers and a stone along the bottom, in front of the
 * fighters.
 *
 * Colors are hue-shifted: shadows lean blue-violet, lights lean warm. The grass mixes are shared with
 * the middle layer's lawn, so the two meet without a seam.
 */
import { blank, fromRows, hash01, mix, outline, stamp, type PixelBuf, type Rows } from '../buf';
import type { LightSpot } from '../sceneryTypes';
import { TILE_W, despeckle, dot, plant, put, rgbAt, wrap } from './common';

// ------------------------------------------------------------------ layout (scene rows)

/** Top of the ground layer: the lamps' finials. */
const TOP = 39;
/** The lawn edge (the lamps stand on it); the middle layer's lawn runs on under it. */
const LAWN = 58;
/** The curb: lit top, face, shadow line. */
const CURB = 59;
/** The sidewalk: fighters stand on scene row 67 (SCENE_FEET_ROW), mid-slab, five rows of slab above and below. */
const WALK0 = 62;
const WALK1 = 72;
/** HP bars sit on rows 68 to 70, under the feet: from the feet row down to them, nothing but plain slab. */
const CALM0 = 68;
const CALM1 = 70;
/** The grass verge, down to the bottom of the scene. */
const VERGE = 73;
const BOTTOM = 81;

/** Where the ground and foreground layers sit in the view: top row and height. */
export const GROUND_SPOT = { y: TOP, h: BOTTOM - TOP + 1 } as const;
export const FG_SPOT = { y: VERGE, h: BOTTOM - VERGE + 1 } as const;

/** A scene row as a ground-layer row. */
const gy = (row: number): number => row - TOP;

const calm = (row: number): boolean => row >= CALM0 - 1 && row <= CALM1;

// ------------------------------------------------------------------ colors

/** Grass and concrete, hue-shifted: shadows lean blue-violet, lights lean warm. */
const K = {
  // (the middle layer's lawn uses these same five)
  grassDeep: mix('g', 'u', 0.3),
  grassShade: mix('G', 'U', 0.28),
  grass: mix('G', 'l', 0.45),
  grassLit: mix('l', 'L', 0.2),
  grassTip: mix('L', 'Y', 0.3),
  clover: mix(mix('G', 'l', 0.45), 'a', 0.3),
  shadow: mix('3', 'V', 0.16),
  groove: mix('4', 'V', 0.12),
  slabDim: mix('5', '4', 0.3),
  speck: mix(mix('5', '4', 0.55), 'V', 0.05),
  slab: mix('5', 'W', 0.25),
  slabLit: mix('5', 'W', 0.65),
  lip: mix('W', 'w', 0.6),
  curbFace: mix(mix('4', '5', 0.5), 'V', 0.04),
  paint: mix('y', 'Y', 0.15),
  paintLit: mix('Y', 'W', 0.3),
  moss: mix('G', 'g', 0.3),
};

/** Deterministic noise for a tile cell (x wraps). */
const h2 = (x: number, y: number, seed: number): number => hash01(wrap(x) * 131 + y * 7907 + seed * 104729);

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

// ------------------------------------------------------------------ lamps

/**
 * A street lamp in dark iron, inked by hand so the post stays slender: a lantern (finial, pyramid cap,
 * four rows of glass, tray) on a post with a cross arm and a collar, on a stepped base. Lit on the
 * left; the glass (C, c, w) lights up at dusk and night.
 */
const LAMP: Rows = [
  '....k....',
  '...k3k...',
  '..k321k..',
  '.k32221k.',
  'k3222111k',
  '.kkwCckk.',
  '..kCCck..',
  '..kCCck..',
  '..kCcck..',
  '..k321k..',
  '...k2k...',
  '.kkk2kkk.',
  '...k2k...',
  '...k2k...',
  '..k321k..',
  '...k2k...',
  '..k321k..',
  '.k32211k.',
  'k3222111k',
  '.kkkkkkk.',
];

/** Lamp positions (the sprite's left edge), two per tile. */
const LAMPS = [44, 158] as const;

/** The lamp glass: the bounding box of its C, c and w pixels. */
const GLASS = (() => {
  let x0 = 99;
  let y0 = 99;
  let x1 = -1;
  let y1 = -1;
  LAMP.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!'Ccw'.includes(row[x])) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  });
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
})();

/** Lamp glass and the pool of light each throws on the sidewalk, in ground-layer pixels. */
export function groundLights(): LightSpot[] {
  const top = gy(LAWN) - LAMP.length + 1;
  const mid = LAMP[0].length / 2;
  return LAMPS.map((lx): LightSpot => ({
    x: wrap(lx + GLASS.x),
    y: top + GLASS.y,
    w: GLASS.w,
    h: GLASS.h,
    kind: 'lamp',
    pool: { x: lx + mid, y: gy(65) + 0.5, rx: 11, ry: 3.2 },
  }));
}

// ------------------------------------------------------------------ ground layer

export function groundLayer(): PixelBuf {
  const b = blank(TILE_W, GROUND_SPOT.h);
  // textures first, cleaned of stray pixels; then lines and details on top
  lawnEdge(b);
  curbStone(b);
  slabs(b);
  verge(b);
  despeckle(b);
  joints(b);
  curbDetails(b);
  sidewalkDetails(b);
  vergeDetails(b);
  lawnDetails(b);
  tidy(b, gy(VERGE), gy(BOTTOM));
  const lamp = fromRows(LAMP);
  for (const lx of LAMPS) {
    // its shadow falls on the grass to the right (light from the top left)
    for (let i = 0; i < 4; i++) dot(b, lx + lamp.w - 1 + i, gy(LAWN), K.grassShade);
    plant(b, lamp, lx, gy(LAWN));
  }
  return b;
}

/** Despeckles rows y0 to y1 of a layer on their own (texture there, line art elsewhere). */
function tidy(b: PixelBuf, y0: number, y1: number): void {
  const part = blank(b.w, y1 - y0 + 1);
  part.px.set(b.px.subarray(y0 * b.w * 4, (y1 + 1) * b.w * 4));
  despeckle(part);
  b.px.set(part.px, y0 * b.w * 4);
}

/** The lawn edge: one row of grass in short runs. */
function lawnEdge(b: PixelBuf): void {
  const runs = runIds(11, 2, 5);
  const y = gy(LAWN);
  for (let x = 0; x < TILE_W; x++) {
    const r = hash01(runs[x] + 1100);
    dot(b, x, y, r < 0.5 ? K.grass : r < 0.8 ? K.grassLit : K.grassShade);
  }
}

/** Blades over the lawn's top, grass hanging over the curb, a few tiny flowers. */
function lawnDetails(b: PixelBuf): void {
  const y = gy(LAWN);
  for (let x = 0; x < TILE_W; x++) {
    if (h2(x, LAWN, 3) < 0.22 && h2(x - 1, LAWN, 3) >= 0.22) dot(b, x, y - 1, h2(x, LAWN, 4) < 0.5 ? K.grassLit : K.grassTip);
  }
  // tufts hanging over the curb's lit top
  for (const x of [5, 61, 103, 146, 207]) {
    dot(b, x, y + 1, K.grassShade);
    dot(b, x + 1, y + 1, K.grassShade);
  }
  // tiny flowers on stems, over the lawn
  const flowers: ReadonlyArray<readonly [number, string]> = [[27, 'W'], [88, 'P'], [131, 'Y'], [189, 'W'], [216, 'm']];
  for (const [x, c] of flowers) {
    dot(b, x, y - 2, c);
    dot(b, x + 1, y - 2, c);
    dot(b, x, y - 1, K.grassShade);
  }
}

/** Curb stones: their joints (x), a stretch of yellow paint and a storm drain inlet. */
const CURB_JOINTS = [3, 39, 78, 117, 151, 225] as const;
const PAINT = { x: 196, w: 24 } as const;
const DRAIN_X = 184;

/** The curb's three rows: a lit top (catching the light in long runs), the face, the shadow line. */
function curbStone(b: PixelBuf): void {
  const top = gy(CURB);
  const lit = runIds(21, 3, 7);
  const worn = runIds(23, 2, 4);
  // runs that catch the light (none across a joint, which would cut them short)
  const cut = new Set(CURB_JOINTS.map((jx) => lit[jx]));
  for (let x = 0; x < TILE_W; x++) {
    dot(b, x, top, hash01(lit[x] + 2100) < 0.25 && !cut.has(lit[x]) ? K.lip : K.slabLit);
    dot(b, x, top + 1, hash01(worn[x] + 2300) < 0.18 ? K.slabDim : K.curbFace);
    dot(b, x, top + 2, K.shadow);
  }
}

/** Joints between curb stones (moss in one), and a painted stretch, its paint worn off in places. */
function curbDetails(b: PixelBuf): void {
  const top = gy(CURB);
  CURB_JOINTS.forEach((jx, i) => {
    dot(b, jx, top, K.groove);
    dot(b, jx, top + 1, i % 3 === 1 ? K.moss : K.shadow);
    dot(b, jx + 1, top + 1, K.slabLit);
  });
  for (let i = 0; i < PAINT.w; i++) {
    const x = PAINT.x + i;
    const worn = i > 0 && i < PAINT.w - 2 && h2(Math.floor(x / 2), 0, 31) < 0.2;
    dot(b, x, top, worn ? K.slabLit : K.paintLit);
    const faded = i > 0 && i < PAINT.w - 3 && h2(Math.floor((x + 1) / 3), 1, 32) < 0.18;
    dot(b, x, top + 1, faded ? K.curbFace : K.paint);
  }
}

/**
 * The storm drain: a dark inlet slot in the curb's shadow and an iron grate on the slab in front of it,
 * its bars lit along the top.
 */
const DRAIN: Rows = [
  'xkkkkkkkkkx',
  '13232323231',
  '1x2x2x2x2x1',
  '.111111111.',
];

/** Slab joints: one every SLAB_W, slanting one pixel left every 4 rows. */
const SLAB_W = 19;
const JOINT0 = 9;
const slant = (row: number): number => Math.floor((row - WALK0) / 4);

/** Which slab a sidewalk pixel is on, and how far into it (0 is the joint). */
function slabAt(x: number, row: number): { k: number; u: number } {
  const v = wrap(x - JOINT0 + slant(row));
  return { k: Math.floor(v / SLAB_W), u: v % SLAB_W };
}

/** Wear patches on the slabs: [slab, x in the slab, scene row, radius x, radius y]. */
const PATCHES: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [0, 9, 64, 4.5, 1.4],
  [1, 12, 71, 4, 1.1],
  [2, 7, 63, 3.5, 1.2],
  [3, 10, 65, 4.5, 1.3],
  [4, 8, 72, 5, 1.2],
  [5, 11, 64, 4, 1.3],
  [6, 8, 71, 4.5, 1.1],
  [7, 10, 63, 3.5, 1.2],
  [8, 12, 65, 4, 1.3],
  [9, 7, 71, 3.5, 1.1],
  [10, 9, 64, 5, 1.4],
  [11, 11, 72, 4, 1.1],
];

/** One newer, paler slab per tile. */
const NEW_SLAB = 7;
const SLAB_NEW = mix(K.slab, K.slabLit, 0.5);

/** The slabs' faces: the curb's shadow softening off the top row, wear patches, a darker front edge. */
function slabs(b: PixelBuf): void {
  for (let row = WALK0; row <= WALK1; row++) {
    for (let x = 0; x < TILE_W; x++) {
      const { k, u } = slabAt(x, row);
      let c = k === NEW_SLAB ? SLAB_NEW : K.slab;
      if (row === WALK0 || row === WALK1) c = K.slabDim;
      else if (!calm(row) && u >= 3 && u <= SLAB_W - 2) {
        for (const [pk, px, py, rx, ry] of PATCHES) {
          if (pk !== k) continue;
          const j = (h2(Math.floor((x + row) / 3), row, 40 + pk) - 0.5) * 0.5;
          if (((u - px) / rx) ** 2 + ((row - py) / ry) ** 2 < 1 + j) c = K.slabDim;
        }
      }
      dot(b, x, gy(row), c);
    }
  }
}

/** The slanted joints: a groove with a lit lip on its right (light from the left). */
function joints(b: PixelBuf): void {
  for (let row = WALK0; row <= WALK1; row++) {
    for (let x = 0; x < TILE_W; x++) {
      const { u } = slabAt(x, row);
      if (u === 0) dot(b, x, gy(row), K.groove);
      else if (u === 1) dot(b, x, gy(row), K.lip);
    }
  }
}

/** Hairline cracks (a weed in some), a gum spot, a fallen leaf: in palette keys, recolored. */
const CRACKS: readonly Rows[] = [
  ['33...', '..3..', '..33.', '....3'],
  ['...l.', '3.lG.', '.33..', '...3.'],
  ['33..', '..33'],
];
const GUM: Rows = ['qq'];
const LEAF: Rows = ['.O', 'Oo'];

const plain = (b: PixelBuf, x: number, row: number): boolean => {
  const c = rgbAt(b, x, gy(row));
  return c === hexInt(K.slab) || c === hexInt(SLAB_NEW);
};
const hexInt = (hex: string): number => parseInt(hex.slice(1), 16);

function sidewalkDetails(b: PixelBuf): void {
  const crackMap = { '3': K.groove, l: K.grassLit, G: K.grassShade };
  // cracks start from a joint, clear of the rows under the feet
  stamp(b, CRACKS[0], 30, gy(63), { wrapX: true, recolor: crackMap });
  stamp(b, CRACKS[1], 144, gy(63), { wrapX: true, recolor: crackMap });
  stamp(b, CRACKS[2], 200, gy(71), { wrapX: true, recolor: crackMap });
  stamp(b, GUM, 118, gy(64), { wrapX: true, recolor: { q: mix('3', 'q', 0.2) } });
  stamp(b, GUM, 170, gy(71), { wrapX: true, recolor: { q: mix('3', 'q', 0.2) } });
  stamp(b, LEAF, 160, gy(64), { wrapX: true });
  stamp(b, LEAF, 12, gy(71), { wrapX: true, recolor: { O: 'y', o: 'O' } });
  // weeds in a few joints, where they meet the curb
  for (const k of [2, 6, 10]) {
    const x = JOINT0 + k * SLAB_W;
    dot(b, x, gy(WALK0), K.grassShade);
    dot(b, x + 1, gy(WALK0), K.grassLit);
  }
  stamp(b, DRAIN, DRAIN_X, gy(CURB + 2), { wrapX: true });
  // aggregate: two-pixel specks, darker and lighter, on plain slab only
  for (let row = WALK0 + 1; row < WALK1; row++) {
    if (calm(row)) continue;
    for (let x = 0; x < TILE_W; x++) {
      const r = h2(x, row, 60);
      if (r > 0.025 && r < 0.985) continue;
      if (![x - 1, x, x + 1, x + 2].every((xx) => plain(b, xx, row))) continue;
      const c = r <= 0.025 ? K.speck : K.slabLit;
      dot(b, x, gy(row), c);
      dot(b, x + 1, gy(row), c);
      x += 2;
    }
  }
}

/** Grass tones, deep to tip. */
const GRASS = [K.grassDeep, K.grassShade, K.grass, K.grassLit, K.grassTip] as const;

/**
 * The grass verge: a dark line under the slabs' edge, then blades. Each column is cut into blades two to
 * four pixels long; a blade's tone follows the light (lit near the top, shade toward the bottom), now
 * and then a step lighter or darker, so the verge reads as blades rather than bands.
 */
function verge(b: PixelBuf): void {
  for (let x = 0; x < TILE_W; x++) {
    dot(b, x, gy(VERGE), K.grassShade);
    let row = VERGE + 1;
    for (let k = 0; row <= BOTTOM; k++) {
      let len = 2 + Math.floor(h2(x, k, 80) * 3);
      if (BOTTOM - (row + len) + 1 === 1) len++;
      const t = (row + len / 2 - VERGE - 1) / (BOTTOM - VERGE);
      let i = t < 0.28 ? 3 : t < 0.55 ? 2 : t < 0.82 ? 1 : 0;
      const r = h2(x, k, 81);
      if (r < 0.22) i = Math.min(4, i + 1);
      else if (r > 0.86) i = Math.max(0, i - 1);
      for (let j = 0; j < len && row + j <= BOTTOM; j++) dot(b, x, gy(row + j), GRASS[i]);
      row += len;
    }
  }
}

/** Blades over the verge (and over the slabs' edge), clover, a few tiny flowers. */
function vergeDetails(b: PixelBuf): void {
  // blades over the slabs' front edge, where the slab above them is plain (and clear of the joints)
  const tip = (xx: number) => h2(xx, VERGE, 7) < 0.2;
  for (let x = 0; x < TILE_W; x++) {
    const { u } = slabAt(x, WALK1);
    if (u < 4 || u > SLAB_W - 4) continue;
    if (tip(x) && !tip(x - 1) && !tip(x - 2) && rgbAt(b, x, gy(WALK1 - 1)) !== hexInt(K.slabDim)) {
      dot(b, x, gy(WALK1), K.grassLit);
      dot(b, x, gy(VERGE), K.grassLit);
    }
  }
  // clover: little mounds of a bluer green
  for (const [x, row] of [[18, 77], [71, 76], [139, 78], [196, 76]] as const) {
    dot(b, x + 1, gy(row - 1), K.clover);
    for (let i = 0; i < 3; i++) dot(b, x + i, gy(row), K.clover);
  }
  // tiny flowers: two-pixel dabs of color
  for (const [x, row, c] of [[36, 75, 'W'], [104, 77, 'Y'], [158, 75, 'M'], [222, 77, 'P']] as const) {
    dot(b, x, gy(row), c);
    dot(b, x + 1, gy(row), c);
  }
}

// ------------------------------------------------------------------ foreground

/** Grass clumps: blade tips lit, darkening toward the roots on the bottom row. */
const TUFTS: readonly Rows[] = [
  [
    '...L...',
    '.L.lG.L',
    '.lGlGGl',
    'lGGGGGg',
    'gggGggg',
  ],
  [
    '..L.',
    'L.lG',
    'lGGg',
    'gggg',
  ],
  [
    '.L...L..',
    '.lL.lG.L',
    'llGllGGl',
    'GGGGGGgg',
    'gggggggg',
  ],
];

/** A little flower: petals, heart, a stem (recolor w / y for other kinds). */
const FLOWER: Rows = [
  '.w.',
  'wyw',
  '.w.',
  '.G.',
];

/** A fuller clump with a daisy rising out of it. */
const DAISY_TUFT: Rows = [
  '......w..',
  '.L...wyw.',
  '.lL.L.wG.',
  'llG.lGlG.',
  'lGGlGGGGl',
  'GgGGgGGgG',
];

/** A dandelion on a tall stem over a rosette of leaves. */
const DANDELION: Rows = [
  '.yY.',
  'yyYy',
  '.yy.',
  '..G.',
  'L.G.',
  'lGGL',
  'GlGl',
];

/** A small stone. */
const STONE: Rows = [
  '.54.',
  '5443',
];

/**
 * The foreground, nearest the camera, is grass in shade: deeper greens than the verge behind it, tips
 * catching the light, outlined in a near-black green rather than ink so the clumps read as a soft dark
 * fringe along the bottom instead of stickers.
 */
export function fgLayer(): PixelBuf {
  const H = FG_SPOT.h;
  const b = blank(TILE_W, H);
  const edge = mix(K.grassDeep, 'k', 0.45);
  const near = (rows: Rows, recolor: Partial<Record<string, string>>) => outline(fromRows(rows, recolor), edge);
  const greens = { L: K.grassTip, l: K.grassLit, G: K.grassShade, g: K.grassDeep };
  const tufts = TUFTS.map((t) => near(t, greens));
  const flowers = [near(FLOWER, { G: K.grassShade }), near(FLOWER, { w: 'P', y: 'y', G: K.grassShade }), near(FLOWER, { w: 'y', y: 'O', G: K.grassShade })];
  const stone = near(STONE, { '5': K.slabLit, '4': K.slabDim, '3': K.groove });
  const daisy = near(DAISY_TUFT, { ...greens, w: 'W' });
  const dandelion = near(DANDELION, greens);
  const sprites = [...tufts, ...flowers, stone, daisy, dandelion];
  // [x, sprite]: tufts (0 to 2), flowers (3 to 5), a stone (6), a daisy tuft (7), a dandelion (8); sparse
  const items: ReadonlyArray<readonly [number, number]> = [
    [4, 7],
    [58, 1],
    [97, 0], [104, 4],
    [150, 6],
    [176, 2], [185, 8],
    [214, 1],
  ];
  for (const [x, what] of items) {
    const s = sprites[what];
    put(b, s, x, H - s.h + 1, what < 3 && h2(x, 0, 9) < 0.5);
  }
  return b;
}

/** Authored sprites, for the preview sheet. */
export const GROUND_SPRITES: Array<[string, Rows]> = [
  ['lamp', LAMP], ['drain', DRAIN], ['flower', FLOWER], ['daisy_tuft', DAISY_TUFT], ['dandelion', DANDELION],
  ['stone', STONE], ['gum', GUM], ['leaf', LEAF],
  ...CRACKS.map((r, i): [string, Rows] => [`crack${i}`, r]),
  ...TUFTS.map((r, i): [string, Rows] => [`tuft${i}`, r]),
];
