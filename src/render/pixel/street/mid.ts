/**
 * The street's mid layer (view rows 20 to 59): three houses set back behind their front yards, with
 * wide side yards between them for trees, a bird bath and the alley where the green dumpster lives.
 *
 * The lawn's far edge is view row 50 (the far layer's tree line shows above it) and the lawn runs on
 * under the ground layer's lawn edge (row 58). The houses' walls meet the lawn at row 52 (their ink
 * line), so each front yard is five rows deep: a walk or stepping stones from the door, a mailbox at
 * the front, shrubs and a flower bed along the foundation. Light comes from the top left: shadows fall
 * on the grass to the right.
 *
 * Houses are sketched on a grid of palette keys (roof shingles, siding and brick are laid in code,
 * windows and doors stamped from small authored rows), so the grid doubles as Rows: windowsOf finds
 * the windows (glass c / C, muntins w, curtains M / P, frames x) and they light up at dusk and night.
 * Each house recolors the keys with its own paint (window frames 'x' are painted white, like the
 * trim). Porch lights by the doors are lamps. Colors are hue-shifted: shadows lean blue-violet,
 * lights lean warm.
 */
import { blank, hash01, mix, setPx, type PixelBuf, type Rows } from '../buf';
import type { LightSpot } from '../sceneryTypes';
import { TILE_W, despeckle, dot, ink, inked, plant, windowsOf, wrap } from './common';

/** Where the mid layer sits in the view: top row and height (view rows 20 to 59). */
export const MID_SPOT = { y: 20, h: 40 } as const;

/** A view row as a mid-layer row. */
const vy = (row: number): number => row - MID_SPOT.y;
/** The lawn's far edge, behind and between the houses. */
const LAWN_TOP = vy(50);
/** The houses' base line: the ink row where their walls meet the lawn. */
const BASE = vy(52);
/** The front of the yards (mailboxes stand here; the ground layer's lawn edge is the next row). */
const FRONT = vy(57);

// ------------------------------------------------------------------ colors

/** Grass: the same mixes as the ground layer's lawn edge, so the two lawns meet without a seam. */
const GRASS = {
  deep: mix('g', 'u', 0.3),
  shade: mix('G', 'U', 0.28),
  base: mix('G', 'l', 0.45),
  lit: mix('l', 'L', 0.2),
  tip: mix('L', 'Y', 0.3),
};
const LAWN = {
  ...GRASS,
  /** The lighter mowing stripe. */
  stripe: mix(GRASS.base, GRASS.lit, 0.4),
  /** Strokes of texture, a step either side of the base. */
  dim: mix(GRASS.base, GRASS.shade, 0.4),
  bright: mix(GRASS.base, GRASS.lit, 0.75),
  /** The backyards, a little hazier with distance, and their lit far edge. */
  far: mix(mix(GRASS.base, GRASS.lit, 0.4), '#c8f0ff', 0.1),
  farDim: mix(mix(GRASS.base, GRASS.shade, 0.15), '#c8f0ff', 0.1),
  farRim: mix(GRASS.lit, '#c8f0ff', 0.2),
  /** Cast shadows on the grass: the soft edge and the core. */
  cast: mix(GRASS.shade, GRASS.base, 0.4),
  core: mix(GRASS.shade, GRASS.deep, 0.25),
};

/** Paving: walks, stepping stones and the driveway (light stone, shade leaning violet). */
const STONE = { lit: '#e6dfd6', mid: '#c9bfc4', dark: '#a097ac', joint: '#b3a9ba' };

/** Paint shared by every house: white trim, window glass, curtains, metal, stone, the porch lamp. */
const SHARED: Record<string, string> = {
  W: '#fbf7ee', '5': '#d3cbdb',
  x: '#f7f2e8', w: '#ede7dd',
  c: '#3e6799', C: '#a2d2ed',
  M: '#f6e8cc', P: '#d9bd98',
  A: '#eeecf4', a: '#aaa7be', b: '#625d7c',
  T: '#e2dbd6', S: '#b9b0c0', s: '#958ca8',
  Y: '#fff2c4',
};

/** Tree and shrub greens, deep (blue-green) to sunlit (yellow-green). */
const LEAF = ['#22443f', '#2c6146', '#3d8448', '#5fa74b', '#98cc56'] as const;
const BOX_LEAF = ['#1f3f3c', '#285a44', '#357a45', '#52994a', '#86bf52'] as const;
const BLOSSOM = ['#7a3d68', '#b4557f', '#e08aa3', '#f7b9c6', '#fff0ee'] as const;
const SPRUCE = ['#1c3a3c', '#24524c', '#2f6c52', '#4a8a5a', '#7aae62'] as const;
const BARK = { dark: '#46333b', mid: '#6b4a40', lit: '#93694d' };
/** Sunlight comes from the top left and a little in front. */
const LIGHT = (() => {
  const v = [-0.5, -0.72, 0.5];
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n] as const;
})();

// ------------------------------------------------------------------ sketching houses

/** A grid of palette keys to draw a house on. It becomes Rows, so windowsOf can find its windows. */
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
  rows(): Rows {
    return this.cells.map((r) => r.join(''));
  }
}

/**
 * Roof keys: V lit, U mid, u shade, v deep. Shingles lie in courses two rows tall: a row of tabs
 * split by staggered keyways, then the shadow line under their butts. A few tabs are weathered
 * lighter, and the top course catches more light than the ones below it.
 */
function shingle(x: number, row: number, seed: number): string {
  if (row % 2 === 0) return 'u';
  const course = (row - 1) / 2;
  const off = course % 2 === 0 ? 0 : 2;
  if ((x + off) % 4 === 0) return 'u';
  const lit = hash01(Math.floor((x + off) / 4) * 31 + course * 7 + seed) < (course === 0 ? 0.45 : 0.18);
  return lit ? 'V' : 'U';
}

/** A hip roof from the front: a trapezoid from the ridge row down to the eave row (1:1 hips). */
function hipRoof(s: Sketch, x0: number, x1: number, top: number, eave: number, seed: number): void {
  for (let y = top; y <= eave; y++) {
    const l = x0 + (eave - y);
    const r = x1 - (eave - y);
    for (let x = l; x <= r; x++) {
      let c = y === top ? 'V' : shingle(x, y - top, seed);
      if (x === l) c = 'V';
      if (x === r) c = 'v';
      s.set(x, y, c);
    }
  }
}

/**
 * A front gable from the peak (columns cx and cx + 1 on row `top`) down `rows` rows, stepping out
 * `run` pixels per row. The roof is a band `band` pixels thick: a white barge board on the outside
 * (in shade on the right), then shingle courses. Inside the bands the gable wall is left as it was,
 * and its first pixel under each band gets the soffit's shadow (key 1).
 */
function gable(s: Sketch, cx: number, top: number, rows: number, run: number, band: number): void {
  for (let i = 0; i < rows; i++) {
    const y = top + i;
    const l = cx - i * run;
    const r = cx + 1 + i * run;
    for (let x = l; x <= r; x++) {
      const left = x <= cx;
      const k = left ? x - l : r - x;
      if (k >= band) {
        if (k === band && i > 0) s.set(x, y, '1');
        continue;
      }
      let c: string;
      if (k === 0) c = left ? 'W' : '5';
      else if (i % 2 === 1) c = left ? 'U' : 'u';
      else c = left ? (k === 1 ? 'V' : 'U') : k === 1 ? 'U' : 'u';
      if (k === band - 1 && i % 2 === 0) c = left ? 'u' : 'v';
      s.set(x, y, c);
    }
  }
}

/** Clapboard siding: boards two rows tall, a shade line under each (keys 3 face, 2 line). */
function siding(s: Sketch, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) s.set(x, y, y % 2 === 0 ? '2' : '3');
}

/** Brick: courses two rows tall (bricks with staggered joints, then a mortar line), some bricks darker. */
function brick(s: Sketch, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y++) {
    const row = y - y0;
    for (let x = x0; x <= x1; x++) {
      if (row % 2 === 1) {
        s.set(x, y, '2');
        continue;
      }
      const off = (row / 2) % 2 === 0 ? 0 : 2;
      const dark = hash01(Math.floor((x + off) / 4) * 13 + row * 5) < 0.22;
      s.set(x, y, (x + off) % 4 === 0 ? '2' : dark ? '1' : '3');
    }
  }
}

/** Windows: frame x (painted white), glass c / C, muntins w, curtains M / P. */
const SASH: Rows = ['xxxxx', 'xCCcx', 'xCccx', 'xwwwx', 'xcccx', 'xcccx', 'xxxxx'];
const SASH_CURTAINS: Rows = ['xxxxx', 'xCCcx', 'xCccx', 'xwwwx', 'xMcPx', 'xMcPx', 'xxxxx'];
const SASH_SHADE: Rows = ['xxxxx', 'xMMMx', 'xPPPx', 'xwwwx', 'xCccx', 'xcccx', 'xxxxx'];
const SMALL_WINDOW: Rows = ['xxxx', 'xCcx', 'xwwx', 'xccx', 'xxxx'];
const ARCH_WINDOW: Rows = ['.xx.', 'xCcx', 'xCcx', 'xwwx', 'xccx', 'xxxx'];
const PICTURE_WINDOW: Rows = [
  'xxxxxxxxxxx',
  'xMCwCCcwcPx',
  'xMcwCccwcPx',
  'xMcwcccwcPx',
  'xMcwcccwcPx',
  'xxxxxxxxxxx',
];

/** A paneled door, 4 x 8: lit left stile, two inset panels, a brass knob (R mid, r shade, e lit, y brass). */
const DOOR: Rows = ['eRRR', 'errR', 'errR', 'eRRR', 'eRRy', 'errR', 'errR', 'eRRR'];

/** A wall lantern: cap, glass (the porch light), base. */
const SCONCE: Rows = ['b', 'Y', 'b'];

/** A window with 1 px shutters (key G) and a sill under it. */
function shuttered(s: Sketch, rows: Rows, x: number, y: number): void {
  s.stamp(rows, x, y);
  for (let yy = y; yy < y + rows.length; yy++) {
    s.set(x - 1, yy, 'G');
    s.set(x + rows[0].length, yy, 'G');
  }
  s.rect(x - 1, y + rows.length, rows[0].length + 2, 1, 'W');
}

interface House {
  name: string;
  rows: Rows;
  /** The house's paint: palette key to color. */
  colors: Record<string, string>;
  /** Porch-light glass pixels, in the art's own pixels. */
  lamps: ReadonlyArray<readonly [number, number]>;
  /** The front walk leaves the stoop between these columns (art pixels). */
  walk: readonly [number, number];
  /** The garage door's columns, if the house has one: the driveway starts there. */
  drive?: readonly [number, number];
}

/** House A: two stories, sky-blue clapboard, a slate hip roof, navy shutters, a red door, a brick chimney. */
function twoStory(): House {
  const s = new Sketch(34, 29);
  // the chimney stands behind the ridge: a stone cap over brick
  s.rect(22, 0, 6, 1, 'S');
  s.set(22, 0, 'T');
  s.set(23, 0, 'T');
  for (let y = 1; y <= 4; y++) {
    for (let x = 23; x <= 26; x++) s.set(x, y, x === 23 ? 't' : x === 26 ? 'n' : y === 2 ? 'n' : 'N');
  }
  hipRoof(s, 0, 33, 3, 7, 1);
  s.rect(0, 8, 34, 1, 'A');
  s.set(33, 8, 'a');
  // walls: eave shadow, siding, corner boards, a belt between the floors, a stone foundation
  siding(s, 3, 9, 30, 26);
  s.rect(2, 9, 30, 1, '1');
  for (let y = 9; y <= 26; y++) {
    s.set(2, y, 'W');
    s.set(31, y, '5');
  }
  s.rect(2, 18, 30, 1, 'W');
  s.rect(2, 27, 30, 1, 'T');
  for (let x = 2; x <= 31; x++) s.set(x, 28, x % 5 === 0 ? 's' : 'S');
  // upstairs: two shuttered windows and a small one over the door
  shuttered(s, SASH_SHADE, 6, 10);
  shuttered(s, SASH, 23, 10);
  s.stamp(SMALL_WINDOW, 15, 11);
  // downstairs
  shuttered(s, SASH_CURTAINS, 6, 19);
  shuttered(s, SASH, 23, 19);
  // the door: a little pediment over its trim, the lantern beside it, a stoop of two steps
  s.rect(15, 16, 4, 1, 'V');
  s.rect(13, 17, 8, 1, 'U');
  s.set(13, 17, 'V');
  s.set(20, 17, 'u');
  s.rect(14, 18, 6, 9, 'W');
  s.stamp(DOOR, 15, 19);
  s.stamp(SCONCE, 20, 20);
  s.rect(13, 27, 8, 1, 'T');
  s.rect(12, 28, 10, 1, 'S');
  // the downspout at the right corner, out of the gutter and off onto the lawn
  for (let y = 9; y <= 27; y++) s.set(32, y, 'a');
  s.set(32, 28, 'a');
  s.set(33, 28, 'a');
  return {
    name: 'two_story',
    rows: s.rows(),
    colors: {
      ...SHARED,
      '3': '#90b3d9', '2': '#7b98c8', '1': '#606fa7',
      V: '#827e9e', U: '#605b7e', u: '#4b4666', v: '#3b3652',
      e: '#ea725b', R: '#c64042', r: '#902d41', y: '#e3b04a',
      G: '#3d5291',
      t: '#d27c59', N: '#aa5440', n: '#7d3d43',
    },
    lamps: [[20, 21]],
    walk: [13, 20],
  };
}

/** House B: a front-gabled cottage, butter-yellow siding, a terracotta roof, an arched attic window. */
function cottage(): House {
  const s = new Sketch(30, 25);
  // gable wall (board and batten) and the ground floor wall behind everything
  for (let y = 2; y <= 13; y++) for (let x = 2; x <= 27; x++) s.set(x, y, x % 3 === 0 ? '2' : '3');
  for (let y = 0; y <= 13; y++) for (let x = 0; x < 30; x++) if (x < 14 - y + 1 || x > 15 + y - 1) s.set(x, y, '.');
  // the chimney rises from the right slope, behind the barge board
  for (let y = 3; y <= 10; y++) for (let x = 21; x <= 23; x++) s.set(x, y, x === 21 ? 't' : x === 23 ? 'n' : y % 2 === 0 ? 'n' : 'N');
  s.rect(20, 2, 5, 1, 'S');
  s.set(20, 2, 'T');
  gable(s, 14, 0, 15, 1, 4);
  s.stamp(ARCH_WINDOW, 13, 6);
  // the gable's base trim, the ground floor siding, corner boards, foundation
  s.rect(2, 14, 26, 1, 'W');
  siding(s, 3, 15, 26, 23);
  s.rect(3, 15, 24, 1, '1');
  for (let y = 15; y <= 23; y++) {
    s.set(2, y, 'W');
    s.set(27, y, '5');
  }
  for (let x = 2; x <= 27; x++) s.set(x, 24, x % 5 === 1 ? 's' : 'S');
  // the downspout off the right eave
  for (let y = 15; y <= 23; y++) s.set(28, y, 'a');
  s.set(28, 24, 'a');
  s.set(29, 24, 'a');
  // the door in its trim, the lantern, a step
  s.rect(4, 15, 6, 9, 'W');
  s.stamp(DOOR, 5, 16);
  s.stamp(SCONCE, 10, 17);
  s.rect(3, 24, 8, 1, 'T');
  // the picture window, its sill and a flower box
  s.stamp(PICTURE_WINDOW, 14, 16);
  s.rect(13, 22, 13, 1, 'W');
  for (let x = 14; x <= 24; x++) s.set(x, 23, x === 14 ? 't' : x === 24 ? 'n' : 'N');
  const blooms = 'LqqlLyylqqL';
  for (let x = 14; x <= 24; x++) s.set(x, 22, blooms[x - 14]);
  return {
    name: 'cottage',
    rows: s.rows(),
    colors: {
      ...SHARED,
      '3': '#f3d27e', '2': '#d9ae6b', '1': '#b38b74',
      V: '#ef8f69', U: '#cd5d4a', u: '#a3443f', v: '#7b3443',
      e: '#5fc3b2', R: '#30978a', r: '#206c6c', y: '#e3b04a',
      t: '#d27c59', N: '#aa5440', n: '#7d3d43',
      q: '#ea5570', l: '#4c984a', L: '#88c55a',
    },
    lamps: [[10, 18]],
    walk: [3, 10],
  };
}

/** House C: a brick ranch with an attached garage (front gable, paneled door), a big picture window. */
function ranch(): House {
  const s = new Sketch(48, 18);
  // main roof (hip) and gutter
  hipRoof(s, 0, 31, 3, 6, 5);
  s.rect(0, 7, 31, 1, 'A');
  // walls: brick, corner boards, eave shadow, foundation
  brick(s, 2, 8, 29, 16);
  s.rect(2, 8, 28, 1, '1');
  for (let x = 2; x <= 29; x++) s.set(x, 17, x % 5 === 3 ? 's' : 'S');
  // picture window, door with its lantern, a small window
  s.stamp(PICTURE_WINDOW, 4, 10);
  s.rect(3, 16, 13, 1, 'W');
  s.rect(17, 8, 6, 9, 'W');
  s.stamp(DOOR, 18, 9);
  s.stamp(SCONCE, 23, 10);
  s.rect(16, 17, 8, 1, 'T');
  s.stamp(SASH, 24, 9);
  s.rect(23, 16, 7, 1, 'W');
  // the garage: siding in a front gable (a louvered vent), then its paneled door
  for (let y = 1; y <= 7; y++) for (let x = 30; x <= 47; x++) s.set(x, y, y % 2 === 0 ? 'o' : 'O');
  for (let y = 1; y <= 5; y++) for (let x = 30; x <= 47; x++) if (x < 38 - (y - 1) * 2 || x > 39 + (y - 1) * 2) s.set(x, y, '.');
  s.rect(37, 4, 4, 2, 'b');
  s.rect(37, 4, 4, 1, 'a');
  gable(s, 38, 1, 5, 2, 4);
  s.rect(30, 6, 18, 1, 'A');
  s.set(47, 6, 'a');
  for (let y = 7; y <= 17; y++) {
    s.set(31, y, 'W');
    s.set(46, y, '5');
  }
  s.rect(32, 7, 14, 1, '1');
  // three raised panels across, lit on top; the top row has glass framed in trim (never lit at night)
  for (let y = 8; y <= 17; y++) {
    for (let x = 32; x <= 45; x++) {
      const r = y - 8;
      const col = (x - 32) % 5;
      let c: string;
      if (r === 0) c = '5';
      else if (r === 1) c = col === 1 ? 'C' : col === 2 ? 'c' : 'W';
      else if (r % 3 === 2) c = '5';
      else if (col === 4) c = '5';
      else c = r % 3 === 0 ? 'W' : '4';
      s.set(x, y, c);
    }
  }
  // the downspout at the house's left corner
  for (let y = 8; y <= 16; y++) s.set(1, y, 'a');
  s.set(1, 17, 'a');
  s.set(0, 17, 'a');
  return {
    name: 'ranch',
    rows: s.rows(),
    colors: {
      ...SHARED,
      '4': '#e7dfd4', '3': '#c4664c', '2': '#9a5046', '1': '#a95646',
      O: '#f2e9da', o: '#d8ccc2',
      V: '#a8785c', U: '#835540', u: '#643e38', v: '#4b2e36',
      e: '#5ba774', R: '#367e56', r: '#255b46', y: '#e3b04a',
    },
    lamps: [[23, 11]],
    walk: [16, 23],
    drive: [32, 45],
  };
}

const HOUSE_A = twoStory();
const HOUSE_B = cottage();
const HOUSE_C = ranch();

/** The street's houses and where they stand (left edge before inking). */
const HOUSES: ReadonlyArray<readonly [House, number]> = [
  [HOUSE_A, 12],
  [HOUSE_B, 90],
  [HOUSE_C, 154],
];

// ------------------------------------------------------------------ trees and shrubs

type Blob = readonly [cx: number, cy: number, r: number];

/**
 * A leafy crown. Round clumps (listed back to front) make the silhouette. Light from the top left
 * shades it on three scales: the whole crown as one ball, each clump (a clump in front also shades the
 * ones behind it), and leaf clusters (cells of a staggered, jittered grid), each lit on its top left and
 * shaded on its bottom right. Clusters on the rim poke out, so edges and tone changes read as bunches
 * of leaves; the underside is darker still. Five tones, `bias` shifting them lighter or darker.
 */
function crown(w: number, h: number, blobs: readonly Blob[], tones: readonly string[], seed: number, cell = 3.2, bias = 0): PixelBuf {
  const b = blank(w, h);
  const [lx, ly, lz] = LIGHT;
  // the whole crown as one ball: its bounds
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
        // a cluster whose heart is in the crown pokes out past the rim
        const ci = front(ccx, ccy);
        if (ci < 0 || best > (cell * 0.7) ** 2) continue;
        i = ci;
      }
      const lit = (u0: number, v0: number): number => {
        const u = Math.max(-1, Math.min(1, u0));
        const v = Math.max(-1, Math.min(1, v0));
        return u * lx + v * ly + Math.sqrt(Math.max(0, 1 - u * u - v * v)) * lz;
      };
      const [bx, by, r] = blobs[i];
      let d = 0.55 * lit((px - gcx) / grx, (py - gcy) / gry) + 0.45 * lit((px - bx) / r, (py - by) / r);
      d -= ((px - ccx) / cell) * 0.3 + ((py - ccy) / cell) * 0.5;
      if (front(px - 2.2, py - 2.6) > i) d -= 0.4;
      // the underside, in the crown's own shade
      d -= Math.max(0, (py - gcy) / gry - 0.55) * 0.9;
      d += bias;
      const t = d < -0.3 ? 0 : d < 0.06 ? 1 : d < 0.36 ? 2 : d < 0.58 ? 3 : 4;
      setPx(b, x, y, tones[t]);
    }
  }
  despeckle(b);
  return b;
}

/**
 * A tree: a crown over a trunk (bark lit on its left, a darker knot every few rows, a root flare), the
 * trunk forking into two limbs under the leaves, all inked. `trunkX` is the trunk's left column.
 */
function tree(crownBuf: PixelBuf, trunkX: number, trunkH: number): PixelBuf {
  const w = crownBuf.w;
  const top = crownBuf.h;
  const b = blank(w, top + trunkH);
  const bottom = b.h - 1;
  for (let y = top - 3; y <= bottom; y++) {
    setPx(b, trunkX, y, BARK.lit);
    setPx(b, trunkX + 1, y, (bottom - y) % 4 === 2 ? BARK.dark : BARK.mid);
    setPx(b, trunkX + 2, y, BARK.dark);
  }
  setPx(b, trunkX - 1, bottom, BARK.mid);
  setPx(b, trunkX + 3, bottom, BARK.dark);
  for (let y = 0; y < top; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (crownBuf.px[i + 3]) b.px.set(crownBuf.px.subarray(i, i + 4), i);
    }
  }
  // the fork: two limbs out of the trunk's top, over the crown's lowest leaves
  setPx(b, trunkX - 1, top - 1, BARK.mid);
  setPx(b, trunkX + 3, top - 1, BARK.dark);
  setPx(b, trunkX - 2, top - 2, BARK.dark);
  setPx(b, trunkX + 4, top - 2, BARK.dark);
  return ink(b);
}

/** The big street tree: a round maple, its crown in five lobes. */
const MAPLE = tree(
  crown(27, 21, [[6, 13, 5.5], [21, 13, 5.5], [9, 7, 5.5], [18, 6.5, 5.5], [13.5, 5, 5], [13.5, 13.5, 6.5], [13.5, 10, 6]], LEAF, 3, 3),
  12, 8,
);

/** A flowering cherry: a wide, flat-topped crown of pink blossom in puffs. */
const CHERRY = tree(
  crown(25, 16, [[5, 9, 4], [20, 9, 4], [9, 5.5, 4.5], [16, 5, 4.5], [12.5, 3.5, 4], [12.5, 9, 5], [4, 11.5, 3], [21, 11.5, 3]], BLOSSOM, 5, 2.6, -0.1),
  11, 8,
);

/**
 * A spruce: tiers of drooping boughs, each wider than the one above, on a short trunk. Each tier is
 * lit on its left and shaded on its right, its top in the shade of the tier above, and its bough tips
 * (the outer ends of its lowest row, hanging a row lower) catch the light.
 */
function spruce(w: number, tiers: ReadonlyArray<readonly [top: number, rows: number, from: number, to: number]>, trunk: number): PixelBuf {
  const last = tiers[tiers.length - 1];
  const h = last[0] + last[1] + 1 + trunk;
  const b = blank(w, h);
  const cx = (w - 1) / 2;
  for (let t = tiers.length - 1; t >= 0; t--) {
    const [top, rows, from, to] = tiers[t];
    for (let r = 0; r <= rows; r++) {
      const y = top + r;
      const hw = r === rows ? to - 1.5 : from + ((to - from) * r) / (rows - 1);
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
        const u = (x - cx) / Math.max(1, hw);
        if (r === rows && Math.abs(u) < 0.55) continue;
        let d = -u * 0.6 + 0.15 - (r / rows) * 0.25;
        if (r < 2 && t > 0) d -= 0.45 * (1 - Math.abs(u));
        if (r >= rows - 1 && Math.abs(u) > 0.55) d += 0.4;
        const k = d < -0.4 ? 0 : d < -0.08 ? 1 : d < 0.22 ? 2 : d < 0.48 ? 3 : 4;
        setPx(b, x, y, SPRUCE[k]);
      }
    }
  }
  for (let y = h - trunk; y < h; y++) {
    setPx(b, Math.floor(cx), y, BARK.mid);
    setPx(b, Math.floor(cx) + 1, y, BARK.dark);
  }
  despeckle(b);
  return ink(b);
}

const SPRUCE_TREE = spruce(17, [[0, 5, 0.5, 2.5], [3, 5, 1.2, 4], [7, 6, 1.8, 5.5], [12, 6, 2.5, 7], [17, 6, 3, 8]], 2);

/** A shrub: a small crown with flower heads (light, mid, dark) on its sunny side. */
function shrub(w: number, h: number, blobs: readonly Blob[], seed: number, tones: readonly string[], flowers?: readonly string[]): PixelBuf {
  const c = crown(w, h, blobs, tones, seed, 2.6);
  if (flowers) {
    const heads: ReadonlyArray<readonly [number, number]> = [[0.22, 0.25], [0.55, 0.12], [0.8, 0.35], [0.4, 0.55], [0.12, 0.6]];
    for (const [fx, fy] of heads) {
      const x = Math.round(fx * (w - 2));
      const y = Math.round(fy * (h - 2));
      const at = (xx: number, yy: number) => c.px[(yy * w + xx) * 4 + 3] > 0;
      if (!at(x, y) || !at(x + 1, y) || !at(x, y + 1) || !at(x + 1, y + 1)) continue;
      setPx(c, x, y, flowers[0]);
      setPx(c, x + 1, y, flowers[1]);
      setPx(c, x, y + 1, flowers[1]);
      setPx(c, x + 1, y + 1, flowers[2]);
    }
  }
  return ink(c);
}

const BOX_SHRUB = shrub(9, 5, [[2.5, 3, 2.6], [6.5, 3, 2.6], [4.5, 2.3, 2.6]], 21, BOX_LEAF);
const ROUND_SHRUB = shrub(7, 6, [[3.5, 3.5, 3.2]], 22, BOX_LEAF);
const HYDRANGEA = shrub(10, 6, [[3, 3.5, 3], [7, 3.5, 3], [5, 2.6, 3]], 23, LEAF, ['#d8e4ff', '#98a9ee', '#6c78cc']);
const ROSE_BUSH = shrub(9, 5, [[3, 3, 2.8], [6, 3, 2.8], [4.5, 2.2, 2.6]], 24, LEAF, ['#ffc0c4', '#ea5570', '#a83455']);

// ------------------------------------------------------------------ props

/** A mailbox on a post, its flag up. */
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

/** A garden gnome: pointy red hat, rosy nose, white beard, blue coat. */
const GNOME: Rows = [
  '..e..',
  '..eR.',
  '.eRR.',
  '.eRRr',
  '.sPs.',
  'WWWWW',
  'UWWWu',
  'UUWUu',
  '.n.n.',
];

/** A stone bird bath, water in the bowl. */
const BIRD_BATH: Rows = [
  '5555555',
  '4CwCcc3',
  '.44433.',
  '..443..',
  '..443..',
  '..443..',
  '.44433.',
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

/** A metal trash can with its lid on. */
const CAN: Rows = [
  '..44..',
  '5wwww4',
  '.3332.',
  '.5w43.',
  '.4443.',
  '.5w43.',
  '.4433.',
];

/** A full trash bag, tied at the top. */
const BAG: Rows = [
  '..2...',
  '.212..',
  '.2321.',
  '233321',
  '233221',
  '.2221.',
];

/** A cardboard box, flaps folded in, a strip of tape. */
const BOX: Rows = [
  'TTTTTTt',
  'tTTyTNN',
  'ttNyNNn',
  'ttNNNNn',
  'tNNNNNn',
];

/**
 * A flower bed: clumps of flowers (each a lit cross around a darker heart) on stems over a row of
 * leaves, in a strip of mulch. `kinds` are [petal, heart] colors, used in turn.
 */
function flowerBed(w: number, kinds: ReadonlyArray<readonly [string, string]>): PixelBuf {
  const b = blank(w, 6);
  for (let x = 0; x < w; x++) {
    setPx(b, x, 5, x % 6 === 2 ? '#4f3436' : '#6e4a40');
    setPx(b, x, 4, x % 4 === 1 ? LEAF[3] : LEAF[2]);
  }
  for (let i = 0, x = 0; x + 2 < w; i++, x += 4) {
    const [petal, heart] = kinds[i % kinds.length];
    const y = i % 2;
    setPx(b, x + 1, y, petal);
    setPx(b, x, y + 1, petal);
    setPx(b, x + 1, y + 1, heart);
    setPx(b, x + 2, y + 1, petal);
    setPx(b, x + 1, y + 2, petal);
    for (let yy = y + 3; yy < 4; yy++) setPx(b, x + 1, yy, LEAF[2]);
    setPx(b, x + 2, 3, LEAF[3]);
  }
  return ink(b);
}

/** A short board fence behind the dumpster: boards with pointed tops, two rails, capped posts. */
function boardFence(n: number): PixelBuf {
  const w = n * 3 + 2;
  const h = 9;
  const b = blank(w, h);
  const plank = [mix('t', 'T', 0.3), 't', 'N'];
  for (let i = 0; i < n; i++) {
    const x0 = 1 + i * 3;
    for (let y = 2; y < h; y++) for (let k = 0; k < 3; k++) setPx(b, x0 + k, y, plank[k]);
    setPx(b, x0 + 1, 1, plank[1]);
  }
  for (const ry of [3, 7]) for (let x = 1; x < w - 1; x++) setPx(b, x, ry, 'n');
  for (const px of [0, Math.floor(w / 2), w - 1]) {
    for (let y = 0; y < h; y++) setPx(b, px, y, y === 0 ? 'T' : 'N');
  }
  return ink(b);
}

// ------------------------------------------------------------------ the lawn

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

/**
 * The lawn: the backyards (hazier, their far edge lit), then the front yards, all textured with short
 * horizontal strokes a step lighter or darker. Each lot in `lots` (x ranges) is mowed in soft slanted
 * stripes; a few tufts stand nearer the street.
 */
function lawn(b: PixelBuf, lots: ReadonlyArray<readonly [number, number]>): void {
  const mowed = (x: number): number => {
    for (const [x0, x1] of lots) if (wrap(x - x0) <= x1 - x0) return wrap(x - x0);
    return -1;
  };
  for (let y = LAWN_TOP; y < b.h; y++) {
    const runs = runIds(40 + y, 2, 5);
    for (let x = 0; x < TILE_W; x++) {
      const r = hash01(runs[x] * 7 + y * 131);
      let c: string;
      if (y === LAWN_TOP) c = r < 0.3 ? LAWN.far : LAWN.farRim;
      else if (y < BASE) c = r < 0.18 ? LAWN.farDim : LAWN.far;
      else {
        const m = mowed(x);
        const stripe = m >= 0 && Math.floor((m + Math.floor((y - BASE) / 2)) / 5) % 2 === 1;
        c = r < 0.12 ? LAWN.dim : r > 0.9 ? LAWN.bright : stripe ? LAWN.stripe : LAWN.base;
      }
      setPx(b, x, y, c);
    }
  }
  for (let x = 3; x < TILE_W; x += 11) {
    const tx = x + Math.floor(hash01(x * 3) * 6);
    const ty = FRONT - Math.floor(hash01(x * 5 + 1) * 3);
    dot(b, tx, ty, LAWN.shade);
    dot(b, tx + 1, ty, LAWN.shade);
    dot(b, tx + 1, ty - 1, LAWN.tip);
  }
}

/** A soft shadow on the grass: an ellipse with a darker core. */
function lawnShadow(b: PixelBuf, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    if (y <= LAWN_TOP || y >= b.h) continue;
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const e = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (e <= 1) dot(b, x, y, e < 0.4 ? LAWN.core : LAWN.cast);
    }
  }
}

/** A house's shadow on the grass to its right: a band along the ground, fading out to the right. */
function houseShadow(b: PixelBuf, x: number, len: number): void {
  for (let i = 0; i < len; i++) {
    for (let y = BASE - 2; y <= BASE; y++) {
      if (y === BASE - 2 && i > len - 4) continue;
      dot(b, x + i, y, i < len / 2 ? LAWN.core : LAWN.cast);
    }
  }
}

/** A paved walk from a stoop to the front of the yard, widening a little toward the street. */
function walkway(b: PixelBuf, x0: number, x1: number): void {
  for (let y = BASE; y < b.h; y++) {
    const grow = Math.floor((y - BASE) / 3);
    const l = x0 - grow;
    const r = x1 + grow;
    for (let x = l; x <= r; x++) {
      let c = STONE.lit;
      if (x === l || x === r) c = STONE.dark;
      else if ((y - BASE) % 2 === 1) c = STONE.joint;
      else if ((x + (y - BASE) * 2) % 4 === 0) c = STONE.mid;
      dot(b, x, y, c);
    }
  }
}

/** Stepping stones: flat ovals, larger toward the street, zigzagging a little, each with its shadow. */
function steppingStones(b: PixelBuf, x: number): void {
  const stones: ReadonlyArray<readonly [number, number, number]> = [[x, BASE + 1, 3], [x + 2, BASE + 3, 4], [x, BASE + 5, 5]];
  for (const [sx, sy, w] of stones) {
    for (let i = 0; i < w; i++) {
      dot(b, sx + i, sy, i === 0 || i === w - 1 ? STONE.mid : STONE.lit);
      dot(b, sx + i, sy + 1, i === 0 ? STONE.mid : STONE.dark);
      if (i > 0) dot(b, sx + i, sy + 2, LAWN.core);
    }
    dot(b, sx + w, sy + 1, LAWN.core);
  }
}

/** A concrete driveway from the garage to the street, with an expansion joint. */
function driveway(b: PixelBuf, x0: number, x1: number): void {
  for (let y = BASE; y < b.h; y++) {
    const grow = Math.floor((y - BASE) / 2);
    const l = x0 - grow;
    const r = x1 + grow;
    for (let x = l; x <= r; x++) {
      let c = STONE.mid;
      if (x === l || x === r) c = STONE.dark;
      else if (y === BASE + 3) c = STONE.joint;
      else if (x - l < 3) c = STONE.lit;
      dot(b, x, y, c);
    }
  }
}

// ------------------------------------------------------------------ lights and the layer

const PORCH_LIGHT = { radius: 5, power: 0.9, color: '#FFD08A' } as const;

/** The houses' windows and porch lights, in mid-layer pixels (houses are inked: art sits 1 px in). */
export function midLights(): LightSpot[] {
  return HOUSES.flatMap(([h, hx]) => {
    const top = BASE - h.rows.length;
    const windows = windowsOf(h.rows).map((w): LightSpot => ({ ...w, x: wrap(hx + 1 + w.x), y: top + w.y, kind: 'window' }));
    const lamps = h.lamps.map(([lx, ly]): LightSpot => ({ x: wrap(hx + 1 + lx), y: top + ly, w: 1, h: 1, kind: 'lamp', ...PORCH_LIGHT }));
    return [...windows, ...lamps];
  });
}

/** Side-yard trees: [sprite, left edge, base row]. */
const TREES: ReadonlyArray<readonly [PixelBuf, number, number]> = [
  [MAPLE, 51, BASE + 4],
  [CHERRY, 128, BASE + 3],
];

export function midLayer(): PixelBuf {
  const b = blank(TILE_W, MID_SPOT.h);
  const houses = HOUSES.map(([h, x]) => [inked(h.rows, h.colors), x, h] as const);
  const [[, ax], [, bx], [, cx]] = houses;
  lawn(b, houses.map(([s, x]) => [x, x + s.w - 1] as const));

  // shadows on the grass: a soft contact line along each house, and to the right of things
  for (const [s, x] of houses) {
    for (let i = 2; i < s.w - 2; i++) dot(b, x + i, BASE + 1, LAWN.cast);
    houseShadow(b, x + s.w - 1, 8);
  }
  for (const [t, x, base] of TREES) lawnShadow(b, x + t.w / 2 + 6, base - 0.5, t.w * 0.38, 1.7);
  lawnShadow(b, 226, BASE + 2, 9, 1.4);

  // paths: walks and stones from the doors, the driveway
  for (const [, x, h] of houses) {
    if (h.name === 'cottage') steppingStones(b, x + 1 + h.walk[0] + 2);
    else walkway(b, x + 1 + h.walk[0] + 1, x + 1 + h.walk[1] - 1);
    if (h.drive) driveway(b, x + 1 + h.drive[0], x + 1 + h.drive[1]);
  }

  // the spruce and the fence at the back of the alley, then the houses and the trees
  plant(b, SPRUCE_TREE, 213, BASE - 1);
  plant(b, boardFence(8), 205, BASE + 1);
  for (const [s, x] of houses) plant(b, s, x, BASE);
  for (const [t, x, base] of TREES) plant(b, t, x, base);

  // foundation plantings and the cottage's flower bed
  plant(b, HYDRANGEA, ax + 2, BASE + 1);
  plant(b, BOX_SHRUB, ax + 26, BASE + 1);
  plant(b, ROSE_BUSH, bx - 7, BASE + 1);
  plant(b, ROUND_SHRUB, cx - 3, BASE + 1);
  plant(b, flowerBed(11, [['#b88af0', '#6a48b8'], ['#fff8ec', '#f2c23c'], ['#f08ab8', '#b8407a']]), cx + 5, BASE + 3);

  // the alley: a can by the garage, the dumpster, a box and two bags
  plant(b, inked(CAN), 205, BASE + 3);
  plant(b, inked(DUMPSTER), 211, BASE + 3);
  plant(b, inked(BAG, { '1': '#2b4639', '2': '#3c634e', '3': '#588866' }), 231, BASE + 3, true);
  plant(b, inked(BOX), 224, BASE + 3);
  plant(b, inked(BAG, { '1': '#34344a', '2': '#4b4b66', '3': '#6c6c8c' }), 230, BASE + 4);

  // the front of the yards: mailboxes by the walks, a gnome, a bird bath under the maple
  plant(b, inked(MAILBOX), ax + 22, FRONT);
  plant(b, inked(MAILBOX, { '5': '#4c4a62', W: '#6e6c88', '4': '#3c3a50', '3': '#2e2c40', R: 'R', e: 'e' }), cx + 23, FRONT);
  plant(b, inked(GNOME, { s: 's', P: 'P' }), bx + 29, BASE + 3);
  plant(b, inked(BIRD_BATH, { '5': STONE.lit, '4': STONE.mid, '3': STONE.dark, C: '#a2d2ed', c: '#5c93c8' }), 74, BASE + 4);
  return b;
}

/** Authored sprites, for the preview sheet. */
export const MID_SPRITES: Array<[string, Rows]> = [
  ...[HOUSE_A, HOUSE_B, HOUSE_C].map((h): [string, Rows] => [h.name, h.rows]),
  ['sash', SASH], ['sash_curtains', SASH_CURTAINS], ['sash_shade', SASH_SHADE], ['small_window', SMALL_WINDOW],
  ['arch_window', ARCH_WINDOW], ['picture_window', PICTURE_WINDOW], ['door', DOOR], ['sconce', SCONCE],
  ['mailbox', MAILBOX], ['gnome', GNOME], ['bird_bath', BIRD_BATH],
  ['dumpster', DUMPSTER], ['can', CAN], ['bag', BAG], ['box', BOX],
];
export const __TEMP = { crown, tree, shrub, LEAF, BLOSSOM, BOX_LEAF }; // TEMP scratch export
