/**
 * The street's ground layer (scene rows 57 to 122) and foreground (rows 109 to 122), in the street's
 * 123-row frame (feet on row 100).
 *
 * Ground, top to bottom: two cast-iron street lamps (rows 57 to 87) standing on the lawn edge (86 and
 * 87), the curb (88 its top, 89 the rounded edge catching the light, 90 and 91 its face, 92 the shadow
 * line) with joints, a worn painted stretch and a storm drain (an inlet in the face, a grate in front),
 * the sidewalk the fighters stand on (93 to 107, feet on row 100, mid-slab), the slabs' front edge
 * (108 lit, 109 their face) and a grass verge (110 to 122). Slab joints slant a pixel every five rows.
 * Rows 97 to 104, around the feet, stay plain slab: no cracks, stains or wear, so the fighters and
 * their shadows read clearly.
 * Foreground: clumps of grass in shade, flowers and pebbles along the bottom, in front of the fighters.
 *
 * Colors are hue-shifted: shadows lean blue-violet, lights lean warm. The grass mixes are shared with
 * the middle layer's lawn, so the two meet without a seam.
 */
import { blank, fromRows, mix, outline, stamp, type PixelBuf, type Rows } from '../buf';
import type { LightSpot } from '../sceneryTypes';
import { TILE_W, despeckle, dot, h2, hexInt, plant, put, rgbAt, runIds, wrap } from './common';

// ------------------------------------------------------------------ layout (scene rows)

/** Top of the ground layer: the lamps' finials. */
const TOP = 57;
/** The lawn edge, two rows (the lamps stand on its second); the middle layer's lawn runs on under it. */
const LAWN = 86;
/** The curb: its top, the rounded edge, two rows of face, the shadow line. */
const CURB = 88;
/** The sidewalk: fighters stand on row 100 (SCENE_FRAME.feetRow), mid-slab, seven rows of slab either side. */
const WALK0 = 93;
const WALK1 = 107;
/** The slabs' front edge catching the light, then their face. */
const LIP = 108;
const FACE = 109;
/** Around the feet: plain slab, nothing but the joints. */
const CALM0 = 97;
const CALM1 = 104;
/** The grass verge, down to the bottom of the frame. */
const VERGE = 110;
const BOTTOM = 122;

/** Where the ground and foreground layers sit in the scene frame: top row and height. */
export const GROUND_SPOT = { y: TOP, h: BOTTOM - TOP + 1 } as const;
export const FG_SPOT = { y: FACE, h: BOTTOM - FACE + 1 } as const;

/** A scene row as a ground-layer row. */
const gy = (row: number): number => row - TOP;

const calm = (row: number): boolean => row >= CALM0 && row <= CALM1;

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
  cloverLit: mix(mix('l', 'L', 0.2), 'a', 0.25),
  shadow: mix('3', 'V', 0.16),
  groove: mix('4', 'V', 0.12),
  slabDim: mix('5', '4', 0.3),
  slabMid: mix(mix('5', 'W', 0.25), mix('5', '4', 0.3), 0.45),
  speck: mix(mix('5', '4', 0.55), 'V', 0.05),
  slab: mix('5', 'W', 0.25),
  slabLit: mix('5', 'W', 0.65),
  lip: mix('W', 'w', 0.6),
  curbFace: mix(mix('4', '5', 0.5), 'V', 0.04),
  curbLow: mix(mix(mix('4', '5', 0.5), 'V', 0.04), mix('3', 'V', 0.16), 0.35),
  paint: mix('y', 'Y', 0.15),
  paintLit: mix('Y', 'W', 0.3),
  paintShade: mix(mix('y', 'Y', 0.15), 'o', 0.3),
  moss: mix('G', 'g', 0.3),
  mossLit: mix('G', 'l', 0.4),
};

/** Grass tones, deep to tip. */
const GRASS = [K.grassDeep, K.grassShade, K.grass, K.grassLit, K.grassTip] as const;

// ------------------------------------------------------------------ lamps

/**
 * A cast-iron street lamp, inked by hand so the post stays slender: a finial, a pyramid cap, a lantern
 * (two panes of glass split by a muntin, a highlight on the left pane), a tapered bottom, then the post
 * with its ladder arm and a collar, on a stepped base. Lit on the left; the glass (w, C, c) lights up
 * at dusk and night, the muntin (x) stays dark against it.
 */
const LAMP: Rows = [
  '......k......',
  '.....k4k.....',
  '.....k2k.....',
  '....k432k....',
  '...k43221k...',
  '..k4322211k..',
  '.k432222111k.',
  'k43322221111k',
  '.kkkkkkkkkkk.',
  '..k3wCxCc1k..',
  '..k3CCxcc1k..',
  '..k3CCxcc1k..',
  '..k3Ccxcc1k..',
  '..k3ccxcc1k..',
  '.kkkkkkkkkkk.',
  '..k4322211k..',
  '...k43211k...',
  '....k321k....',
  '....k321k....',
  '.kkkk321kkkk.',
  '....k321k....',
  '....k321k....',
  '...k43211k...',
  '....k321k....',
  '....k321k....',
  '....k321k....',
  '...k43211k...',
  '...k32211k...',
  '..k4322211k..',
  '.k432222111k.',
  '.kkkkkkkkkkk.',
];

/** Lamp positions (the sprite's left edge), two per tile. */
const LAMPS = [66, 237] as const;

/** The lamp glass: the bounding box of its glass (w, C, c), with its muntin marked 'f'. */
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
  const mask: string[] = [];
  for (let y = y0; y <= y1; y++) {
    let m = '';
    for (let x = x0; x <= x1; x++) m += 'Ccw'.includes(LAMP[y][x]) ? 'g' : LAMP[y][x] === 'x' ? 'f' : '.';
    mask.push(m);
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, mask };
})();

/** The lawn row the lamps stand on. */
const LAMP_BASE = LAWN + 1;

/** Lamp glass and the pool of light each throws on the sidewalk, in ground-layer pixels. */
export function groundLights(): LightSpot[] {
  const top = gy(LAMP_BASE) - LAMP.length + 1;
  const mid = LAMP[0].length / 2;
  return LAMPS.map((lx): LightSpot => ({
    x: wrap(lx + GLASS.x),
    y: top + GLASS.y,
    w: GLASS.w,
    h: GLASS.h,
    mask: GLASS.mask,
    kind: 'lamp',
    pool: { x: lx + mid, y: gy(97) + 0.5, rx: 16.5, ry: 4.8 },
  }));
}

// ------------------------------------------------------------------ ground layer

export function groundLayer(): PixelBuf {
  const b = blank(TILE_W, GROUND_SPOT.h);
  // textures first, cleaned of stray pixels; then lines and details on top
  lawnEdge(b);
  curbStone(b);
  slabs(b);
  frontEdge(b);
  verge(b);
  despeckle(b);
  joints(b);
  curbDetails(b);
  sidewalkDetails(b);
  vergeDetails(b);
  lawnDetails(b);
  const lamp = fromRows(LAMP);
  for (const lx of LAMPS) {
    // its shadow falls on the grass to the right (light from the top left)
    for (let i = 0; i < 6; i++) dot(b, lx + lamp.w - 1 + i, gy(LAMP_BASE), i < 4 ? K.grassDeep : K.grassShade);
    for (let i = 0; i < 3; i++) dot(b, lx + lamp.w - 2 + i, gy(LAMP_BASE - 1), K.grassShade);
    plant(b, lamp, lx, gy(LAMP_BASE));
  }
  return b;
}

/** The lawn edge: two rows of grass in short runs, lighter on top. */
function lawnEdge(b: PixelBuf): void {
  const top = runIds(11, 3, 7);
  const low = runIds(12, 3, 7);
  for (let x = 0; x < TILE_W; x++) {
    const r = h2(top[x], 0, 110);
    dot(b, x, gy(LAWN), r < 0.45 ? K.grass : r < 0.85 ? K.grassLit : K.grassShade);
    const s = h2(low[x], 1, 111);
    dot(b, x, gy(LAWN + 1), s < 0.55 ? K.grass : s < 0.8 ? K.grassShade : K.grassLit);
  }
}

/** Blades over the lawn's top, tufts hanging over the curb, a few tiny flowers on stems. */
function lawnDetails(b: PixelBuf): void {
  const y = gy(LAWN);
  for (let x = 0; x < TILE_W; x++) {
    // single and double blades, never side by side
    if (h2(x, LAWN, 3) < 0.2 && h2(x - 1, LAWN, 3) >= 0.2) {
      const tall = h2(x, LAWN, 5) < 0.35;
      dot(b, x, y - 1, tall ? K.grass : h2(x, LAWN, 4) < 0.5 ? K.grassLit : K.grassTip);
      if (tall) dot(b, x, y - 2, K.grassTip);
    }
  }
  // tufts hanging over the curb's top: a lit blade, a shaded one
  for (const x of [8, 47, 92, 131, 155, 219, 262, 311]) {
    dot(b, x, gy(CURB), K.grass);
    dot(b, x + 1, gy(CURB), K.grassShade);
    dot(b, x + 2, gy(CURB), K.grassShade);
    dot(b, x + 1, gy(CURB) + 1, K.grassShade);
  }
  // tiny flowers on stems over the lawn: a head of two pixels, a lit one on the left
  const flowers: ReadonlyArray<readonly [number, string, string]> = [
    [27, 'W', '5'], [88, 'P', 'e'], [140, 'Y', 'y'], [196, 'W', '5'], [251, 'M', 'm'], [300, 'Y', 'y'], [325, 'P', 'e'],
  ];
  for (const [x, lit, shade] of flowers) {
    dot(b, x, y - 3, lit);
    dot(b, x + 1, y - 3, shade);
    dot(b, x, y - 2, K.grassShade);
    dot(b, x, y - 1, K.grassShade);
    dot(b, x + 1, y - 1, K.grassLit);
  }
}

/** Curb stones: their joints (x), a stretch of yellow paint and the storm drain's inlet. */
const CURB_JOINTS = [5, 59, 117, 176, 227, 338] as const;
const PAINT = { x: 294, w: 36 } as const;
const DRAIN_X = 268;

/** The curb: its top (catching the light in long runs), the rounded edge, the face, the shadow line. */
function curbStone(b: PixelBuf): void {
  const top = gy(CURB);
  const lit = runIds(21, 4, 10);
  const worn = runIds(23, 3, 6);
  // runs that catch the light (none across a joint, which would cut them short)
  const cut = new Set(CURB_JOINTS.map((jx) => lit[jx]));
  for (let x = 0; x < TILE_W; x++) {
    dot(b, x, top, h2(lit[x], 0, 2100) < 0.3 && !cut.has(lit[x]) ? K.lip : K.slabLit);
    dot(b, x, top + 1, K.lip);
    dot(b, x, top + 2, h2(worn[x], 0, 2300) < 0.18 ? K.slabDim : K.curbFace);
    dot(b, x, top + 3, h2(worn[x], 1, 2400) < 0.12 ? K.curbFace : K.curbLow);
    dot(b, x, top + 4, K.shadow);
  }
}

/** Joints between curb stones (moss in some), and a painted stretch, its paint worn off in places. */
function curbDetails(b: PixelBuf): void {
  const top = gy(CURB);
  CURB_JOINTS.forEach((jx, i) => {
    dot(b, jx, top, K.groove);
    dot(b, jx, top + 1, K.groove);
    dot(b, jx, top + 2, K.shadow);
    dot(b, jx, top + 3, K.shadow);
    dot(b, jx + 1, top + 2, K.slabLit);
    dot(b, jx + 1, top + 3, K.slab);
    if (i % 3 === 1) {
      // moss in the joint, spilling a little onto the gutter
      dot(b, jx, top + 3, K.moss);
      dot(b, jx, top + 4, K.moss);
      dot(b, jx + 1, top + 4, K.mossLit);
      dot(b, jx - 1, top + 4, K.moss);
    }
  });
  for (let i = 0; i < PAINT.w; i++) {
    const x = PAINT.x + i;
    const worn = i > 1 && i < PAINT.w - 2 && h2(Math.floor(x / 3), 0, 31) < 0.2;
    dot(b, x, top, worn ? K.slabLit : K.paintLit);
    dot(b, x, top + 1, worn && h2(Math.floor(x / 3), 2, 31) < 0.5 ? K.lip : K.paintLit);
    const faded = i > 1 && i < PAINT.w - 3 && h2(Math.floor((x + 1) / 3), 1, 32) < 0.2;
    dot(b, x, top + 2, faded ? K.curbFace : K.paint);
    dot(b, x, top + 3, faded ? K.curbLow : K.paintShade);
  }
  stamp(b, DRAIN, DRAIN_X, gy(CURB + 2), { wrapX: true, recolor: DRAIN_COLORS });
}

/**
 * The storm drain: a dark inlet in the curb's face (its lintel catching the light), and an iron grate
 * on the gutter in front of it, its bars lit along the top and the slots between them dark.
 */
const DRAIN: Rows = [
  '4kkkkkkkkkkkkkkkkkk4',
  '3kkxxxxxxxxxxxxxxkk3',
  '23333333333333333332',
  '13x3x3x3x3x3x3x3x3x1',
  '12x2x2x2x2x2x2x2x2x1',
  '12x1x1x1x1x1x1x1x1x1',
  '.111111111111111111.',
];
const DRAIN_COLORS = { '4': K.curbFace, '3': mix('4', 'V', 0.1), '2': mix('3', 'V', 0.12), '1': mix('2', 'V', 0.1), x: 'k' };

// ------------------------------------------------------------------ the sidewalk

/** Slab joints: twelve slabs a tile (28 or 29 pixels), slanting a pixel left every five rows. */
const SLABS = 12;
const SLAB_STARTS = Array.from({ length: SLABS }, (_, k) => Math.round((k * TILE_W) / SLABS));
const JOINT0 = 14;
const slant = (row: number): number => Math.floor((row - WALK0) / 5);

/** Which slab a sidewalk pixel is on, how far into it (0 is the joint), and the slab's width. */
function slabAt(x: number, row: number): { k: number; u: number; w: number } {
  const v = wrap(x - JOINT0 + slant(row));
  let k = SLABS - 1;
  while (SLAB_STARTS[k] > v) k--;
  const end = k + 1 < SLABS ? SLAB_STARTS[k + 1] : TILE_W;
  return { k, u: v - SLAB_STARTS[k], w: end - SLAB_STARTS[k] };
}

/** Wear patches on the slabs: [slab, x in the slab, scene row, radius x, radius y]; none around the feet. */
const PATCHES: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [0, 13, 95, 6, 1.6],
  [1, 18, 106, 6, 1.5],
  [2, 10, 94, 5, 1.4],
  [3, 15, 106, 7, 1.4],
  [4, 12, 95, 7.5, 1.6],
  [5, 17, 106, 6, 1.5],
  [6, 12, 94, 6.5, 1.5],
  [7, 15, 106, 5, 1.4],
  [8, 18, 95, 6, 1.6],
  [9, 10, 106, 5, 1.4],
  [10, 13, 95, 7.5, 1.6],
  [11, 16, 106, 6, 1.4],
];

/** One newer, paler slab per tile. */
const NEW_SLAB = 7;
const SLAB_NEW = mix(K.slab, K.slabLit, 0.5);
const SLAB_NEW_DIM = mix(K.slab, K.slabDim, 0.3);

/**
 * The slabs' faces: the curb's shadow softening off the top rows, wear patches in two tones, and a
 * faint mottle of longer strokes a step darker, away from the feet.
 */
function slabs(b: PixelBuf): void {
  const soft = runIds(51, 3, 6);
  for (let row = WALK0; row <= WALK1; row++) {
    const mottle = runIds(60 + row, 3, 8);
    for (let x = 0; x < TILE_W; x++) {
      const { k, u, w } = slabAt(x, row);
      const fresh = k === NEW_SLAB;
      let c = fresh ? SLAB_NEW : K.slab;
      if (row === WALK0 || (row === WALK0 + 1 && h2(soft[x], 0, 52) < 0.45)) c = fresh ? SLAB_NEW_DIM : K.slabDim;
      else if (!calm(row) && u >= 3 && u <= w - 3) {
        for (const [pk, px, py, rx, ry] of PATCHES) {
          if (pk !== k) continue;
          const j = (h2(Math.floor((x + row) / 3), row, 40 + pk) - 0.5) * 0.5;
          const e = ((u - px) / rx) ** 2 + ((row - py) / ry) ** 2;
          if (e < 0.45 + j * 0.5) c = K.slabDim;
          else if (e < 1 + j) c = K.slabMid;
        }
        if (c === K.slab && h2(mottle[x], row, 61) < 0.07) c = K.slabMid;
      }
      dot(b, x, gy(row), c);
    }
  }
}

/** The slabs' front edge: a lit lip, then their face, a step darker. */
function frontEdge(b: PixelBuf): void {
  const worn = runIds(71, 3, 7);
  for (let x = 0; x < TILE_W; x++) {
    dot(b, x, gy(LIP), h2(worn[x], 0, 72) < 0.2 ? K.slab : K.slabLit);
    dot(b, x, gy(FACE), h2(worn[x], 1, 73) < 0.15 ? K.curbLow : K.curbFace);
  }
}

/** The slanted joints: a groove with a lit lip on its right (light from the left), notched into the front edge. */
function joints(b: PixelBuf): void {
  for (let row = WALK0; row <= FACE; row++) {
    for (let x = 0; x < TILE_W; x++) {
      const { u } = slabAt(x, Math.min(row, WALK1));
      if (u === 0) dot(b, x, gy(row), row === FACE ? K.shadow : K.groove);
      else if (u === 1 && row < FACE) dot(b, x, gy(row), row === WALK0 ? K.slab : K.lip);
    }
  }
}

/** Hairline cracks (a weed in some), stains, fallen leaves: in palette keys, recolored. */
const CRACKS: readonly Rows[] = [
  // from a joint, forking
  ['33.....', '.33....', '..3333.', '..x..33', '..3....', '.3.....'],
  // a long one with a weed in it
  ['.....lG..', '33...Gl..', '.333.3...', '....33...', '......33.', '.......x3'],
  // a short one
  ['333..', '...33', '....x'],
  // a corner break
  ['3333', '3...', '3...'],
];
const CRACK_COLORS = { '3': K.groove, x: K.shadow, l: K.grassLit, G: K.grassShade };
const GUM: Rows = ['.qq', 'qqx'];
const STAIN: Rows = ['.ssss..', 'sssssss', '..sss..'];
const LEAF_ROWS: Rows = ['..O', '.Oo', 'Oo.'];
const LEAF_SMALL: Rows = ['.O', 'Oo'];
const BOTTLE_CAP: Rows = ['ee', 'Rr'];

/** Weeds sprouting where a joint meets the curb's shadow: [blade lit, blade shade]. */
const JOINT_WEEDS = [1, 4, 6, 9, 11] as const;

const plain = (b: PixelBuf, x: number, row: number): boolean => {
  const c = rgbAt(b, x, gy(row));
  return c === hexInt(K.slab) || c === hexInt(SLAB_NEW);
};

function sidewalkDetails(b: PixelBuf): void {
  // cracks start from a joint, clear of the rows around the feet
  stamp(b, CRACKS[0], 45, gy(94), { wrapX: true, recolor: CRACK_COLORS });
  stamp(b, CRACKS[1], 213, gy(94), { wrapX: true, recolor: CRACK_COLORS });
  stamp(b, CRACKS[2], 300, gy(105), { wrapX: true, recolor: CRACK_COLORS });
  stamp(b, CRACKS[2], 130, gy(105), { wrapX: true, recolor: CRACK_COLORS, flipX: true });
  stamp(b, CRACKS[3], 157, gy(105), { wrapX: true, recolor: CRACK_COLORS });
  stamp(b, GUM, 176, gy(95), { wrapX: true, recolor: { q: mix('3', 'q', 0.2), x: mix('2', 'q', 0.15) } });
  stamp(b, GUM, 255, gy(106), { wrapX: true, recolor: { q: mix('3', 'q', 0.2), x: mix('2', 'q', 0.15) } });
  stamp(b, STAIN, 90, gy(105), { wrapX: true, recolor: { s: K.slabMid } });
  stamp(b, STAIN, 326, gy(94), { wrapX: true, recolor: { s: K.slabMid } });
  stamp(b, LEAF_ROWS, 240, gy(95), { wrapX: true });
  stamp(b, LEAF_SMALL, 18, gy(106), { wrapX: true, recolor: { O: 'y', o: 'O' } });
  stamp(b, LEAF_SMALL, 108, gy(94), { wrapX: true, recolor: { O: 'O', o: 'o' } });
  stamp(b, BOTTLE_CAP, 196, gy(106), { wrapX: true });
  // weeds in a few joints, where they meet the curb
  for (const k of JOINT_WEEDS) {
    const x = JOINT0 + SLAB_STARTS[k];
    dot(b, x, gy(WALK0), K.grassShade);
    dot(b, x + 1, gy(WALK0), K.grassLit);
    if (k % 2 === 1) dot(b, x + 1, gy(WALK0) - 1, K.grassLit);
  }
  // aggregate: two-pixel specks, darker and lighter, on plain slab only
  for (let row = WALK0 + 2; row < WALK1; row++) {
    if (calm(row)) continue;
    for (let x = 0; x < TILE_W; x++) {
      const r = h2(x, row, 60);
      if (r > 0.02 && r < 0.988) continue;
      if (![x - 1, x, x + 1, x + 2].every((xx) => plain(b, xx, row))) continue;
      const c = r <= 0.02 ? K.speck : K.slabLit;
      dot(b, x, gy(row), c);
      dot(b, x + 1, gy(row), c);
      x += 3;
    }
  }
}

// ------------------------------------------------------------------ the verge

/**
 * The grass verge: blades. Each column is cut into blades two to five pixels long; a blade's tone
 * follows the light (lit near the top, shade toward the bottom), now and then a step lighter or darker,
 * so the verge reads as blades rather than bands. The first row is the slabs' contact shadow.
 */
function verge(b: PixelBuf): void {
  for (let x = 0; x < TILE_W; x++) {
    dot(b, x, gy(VERGE), h2(x, 0, 79) < 0.25 ? K.grassDeep : K.grassShade);
    let row = VERGE + 1;
    for (let k = 0; row <= BOTTOM; k++) {
      let len = 2 + Math.floor(h2(x, k, 80) * 4);
      if (BOTTOM - (row + len) + 1 === 1) len++;
      const t = (row + len / 2 - VERGE - 1) / (BOTTOM - VERGE);
      let i = t < 0.25 ? 3 : t < 0.52 ? 2 : t < 0.8 ? 1 : 0;
      const r = h2(x, k, 81);
      if (r < 0.2) i = Math.min(4, i + 1);
      else if (r > 0.86) i = Math.max(0, i - 1);
      for (let j = 0; j < len && row + j <= BOTTOM; j++) dot(b, x, gy(row + j), GRASS[i]);
      row += len;
    }
  }
}

/** Blades over the slabs' face, clover, tiny flowers, pebbles. */
function vergeDetails(b: PixelBuf): void {
  // blades over the slabs' front edge, where the slab is plain (and clear of the joints)
  const tip = (xx: number) => h2(xx, VERGE, 7) < 0.18;
  for (let x = 0; x < TILE_W; x++) {
    const { u, w } = slabAt(x, WALK1);
    if (u < 4 || u > w - 4) continue;
    if (tip(x) && !tip(x - 1) && !tip(x - 2)) {
      dot(b, x, gy(FACE), K.grassLit);
      dot(b, x, gy(VERGE), K.grassLit);
      if (h2(x, VERGE, 8) < 0.4) dot(b, x, gy(LIP), K.grassTip);
    }
  }
  // clover: little mounds of three-lobed leaves, a bluer green, lit on top
  for (const [x, row] of [[27, 116], [107, 114], [178, 117], [209, 115], [294, 114]] as const) {
    dot(b, x + 1, gy(row - 1), K.cloverLit);
    dot(b, x + 3, gy(row - 1), K.cloverLit);
    for (let i = 0; i < 5; i++) dot(b, x + i, gy(row), i === 0 || i === 4 ? K.clover : i === 2 ? K.cloverLit : K.clover);
    for (let i = 1; i < 4; i++) dot(b, x + i, gy(row + 1), K.grassShade);
  }
  // tiny flowers: a head of two pixels over a stem
  for (const [x, row, lit, shade] of [[54, 113, 'W', '5'], [156, 115, 'Y', 'y'], [237, 113, 'M', 'm'], [333, 115, 'P', 'e'], [123, 118, 'W', '5']] as const) {
    dot(b, x, gy(row), lit);
    dot(b, x + 1, gy(row), shade);
    dot(b, x, gy(row + 1), K.grassShade);
  }
  // pebbles in the grass: lit on the top left, a shadow under them
  for (const [x, row] of [[80, 119], [269, 117]] as const) {
    dot(b, x, gy(row), K.slabLit);
    dot(b, x + 1, gy(row), K.slab);
    dot(b, x, gy(row + 1), K.slabDim);
    dot(b, x + 1, gy(row + 1), K.speck);
    dot(b, x + 2, gy(row + 1), K.grassDeep);
  }
}

// ------------------------------------------------------------------ foreground

/** Grass clumps: blade tips lit, darkening toward the roots on the bottom rows. */
const TUFTS: readonly Rows[] = [
  [
    '....L.....',
    '.L..l..L..',
    '.l.Ll.lG.L',
    '.lGlG.lGlG',
    'llGlGGlGGG',
    'lGGGGGGGGg',
    'GGgGGgGGgg',
    'gggggggggg',
  ],
  [
    '..L...',
    'L.lG..',
    'l.lG.L',
    'lGlGlG',
    'GGGGGg',
    'gggggg',
  ],
  [
    '.L.....L....',
    '.lL..L.lG..L',
    'LlG..lLlG.lG',
    'llG.llGlGGlG',
    'lGGllGGGGGGG',
    'GGGGGGGGgGGg',
    'GgGGgGGggGgg',
    'gggggggggggg',
  ],
];

/** A little flower: four petals round a heart, on a stem with a leaf (recolor w / W / y for other kinds). */
const FLOWER: Rows = [
  '.w.',
  'wyW',
  '.W.',
  '.G.',
  'lG.',
  '.G.',
];

/** A fuller clump with a daisy rising out of it. */
const DAISY_TUFT: Rows = [
  '........w...',
  '.......wyW..',
  '.L......WG..',
  '.lL..L...G..',
  'LlG..lL.lG.L',
  'llG.LlGlGG.l',
  'lGGllGGlGGlG',
  'GGgGGGgGGgGG',
  'gggggggggggg',
];

/** A dandelion on a tall stem over a rosette of toothed leaves. */
const DANDELION: Rows = [
  '..yY..',
  '.yyYy.',
  '.yyyy.',
  '..oy..',
  '...G..',
  '...G..',
  'L..G.L',
  'lL.GLl',
  'lGlGGl',
  'GGGGGg',
];

/** Pebbles: two stones, lit on the top left. */
const PEBBLES: Rows = [
  '.554....',
  '54443.5.',
  '443335443',
  '.3333.33.',
].map((r) => r.padEnd(9, '.'));

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
  const flowers = [
    near(FLOWER, { ...greens, w: 'w', W: 'W', y: 'y' }),
    near(FLOWER, { ...greens, w: 'P', W: 'q', y: 'y' }),
    near(FLOWER, { ...greens, w: 'Y', W: 'y', y: 'O' }),
  ];
  const pebbles = near(PEBBLES, { '5': K.slabLit, '4': K.slab, '3': K.slabDim });
  const daisy = near(DAISY_TUFT, { ...greens, w: 'w', W: 'W', y: 'y' });
  const dandelion = near(DANDELION, { ...greens, y: 'y', Y: 'Y', o: 'O' });
  const sprites = [...tufts, ...flowers, pebbles, daisy, dandelion];
  // [x, sprite]: tufts (0 to 2), flowers (3 to 5), pebbles (6), a daisy tuft (7), a dandelion (8); sparse
  const items: ReadonlyArray<readonly [number, number]> = [
    [5, 7],
    [87, 1],
    [146, 0], [157, 4],
    [225, 6],
    [262, 2], [276, 8],
    [320, 1], [327, 5],
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
  ['pebbles', PEBBLES], ['gum', GUM], ['stain', STAIN], ['leaf', LEAF_ROWS], ['leaf_small', LEAF_SMALL], ['bottle_cap', BOTTLE_CAP],
  ...CRACKS.map((r, i): [string, Rows] => [`crack${i}`, r]),
  ...TUFTS.map((r, i): [string, Rows] => [`tuft${i}`, r]),
];
