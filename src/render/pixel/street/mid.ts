/**
 * The street's mid layer (scene rows 30 to 89 of the street's 123-row frame): three houses set back
 * behind front yards, with wide side yards between them for trees, a bird bath and the alley where the
 * green dumpster lives.
 *
 * The houses' walls meet the lawn on scene row 78 (their ink line), which is also the lawn's far edge
 * between them, with the far layer's tree line showing above it. The lawn runs on under the ground
 * layer's lawn edge (rows 86 and 87), so each front yard is seven rows deep (79 to 85): a walk or
 * stepping stones from the door, a mailbox at the front, shrubs, a hedge and flower beds along the
 * foundations. Light comes from the top left: shadows fall on the grass to the right.
 *
 * Houses are sketched on a grid of palette keys (shingles, clapboard, board and batten and brick are
 * laid in code, windows and doors stamped from small authored rows), so the grid doubles as Rows:
 * windowsOf finds the windows (glass c / C, muntins w, curtains M / P, frames x) and they light up at
 * dusk and night. Each house recolors the keys with its own paint (window frames 'x' are painted
 * white, like the trim). Porch lights by the doors are lamps. Trees and shrubs are shaded in code from
 * round clumps, in leaf clusters. Colors are hue-shifted: shadows lean blue-violet, lights lean warm.
 */
import { blank, hash01, mix, setPx, type PixelBuf, type Rows } from '../buf';
import type { LightSpot } from '../sceneryTypes';
import { TILE_W, despeckle, dot, ink, inked, plant, runIds, windowsOf, wrap } from './common';

/** Where the mid layer sits in the scene frame: top row and height (scene rows 30 to 89). */
export const MID_SPOT = { y: 30, h: 60 } as const;

/** A scene row as a mid-layer row. */
const vy = (row: number): number => row - MID_SPOT.y;
/**
 * The houses' base line: the ink row where their walls meet the lawn, and the lawn's far edge between
 * them. It is the layer's first fully opaque row.
 */
const BASE = vy(78);
/** The front of the yards (mailboxes stand here; the ground layer's lawn edge starts on the next row). */
const FRONT = vy(85);

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
  /** The lawn's far edge between the houses: lit, a little hazy with distance. */
  far: mix(mix(GRASS.base, GRASS.lit, 0.4), '#c8f0ff', 0.1),
  farRim: mix(GRASS.lit, '#c8f0ff', 0.2),
  /** Cast shadows on the grass: the soft edge and the core. */
  cast: mix(GRASS.shade, GRASS.base, 0.4),
  core: mix(GRASS.shade, GRASS.deep, 0.25),
};

/** Paving: walks and the driveway (pale concrete, shade leaning violet). */
const STONE = { lit: '#e6dfd6', mid: '#c9bfc4', dark: '#a097ac', joint: '#b3a9ba', deep: '#8a819a' };
/** Stepping stones: warmer natural flagstone. */
const FLAG = { lit: '#e4d7bf', mid: '#bdae9a', dark: '#8c8090' };
/** Mulch in the beds. */
const MULCH = { lit: '#8a5c46', mid: '#6e4a40', dark: '#4f3436' };

/** Paint shared by every house: white trim, window glass, curtains, metal, stone, the porch lamp. */
const SHARED: Record<string, string> = {
  W: '#fbf7ee', '5': '#d3cbdb',
  x: '#f7f2e8', w: '#ede7dd',
  c: '#3e6799', C: '#a2d2ed', L: '#cfe9f6',
  M: '#f6e8cc', P: '#d9bd98',
  A: '#eeecf4', a: '#aaa7be', b: '#625d7c',
  T: '#e2dbd6', S: '#b9b0c0', s: '#958ca8',
  Y: '#fff2c4', y: '#e3b04a',
};

/** Tree and shrub greens, deep (blue-green) to sunlit (yellow-green). */
const LEAF = ['#22443f', '#2c6146', '#3d8448', '#5fa74b', '#98cc56'] as const;
const BOX_LEAF = ['#1f3f3c', '#285a44', '#357a45', '#52994a', '#86bf52'] as const;
const BLOSSOM = ['#7a3d68', '#b4557f', '#e08aa3', '#f7b9c6', '#fff0ee'] as const;
const SPRUCE = ['#1c3a3c', '#24524c', '#2f6c52', '#4a8a5a', '#7aae62'] as const;
const BARK = { deep: '#33252f', dark: '#46333b', mid: '#6b4a40', lit: '#93694d' };
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
  get(x: number, y: number): string {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.cells[y][x] : '.';
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
 * Roof keys: V lit, U mid, u shade, v deep. Shingles lie in courses two rows tall: a row of tabs split
 * by staggered keyways (every five pixels), then the shadow line under their butts. A few tabs are
 * weathered lighter or darker, and the top course catches more light than the ones below it.
 */
function shingle(x: number, row: number, seed: number): string {
  if (row % 2 === 0) return 'u';
  const course = (row - 1) / 2;
  const off = (course * 3) % 5;
  if ((x + off) % 5 === 0) return 'u';
  const r = hash01(Math.floor((x + off) / 5) * 31 + course * 7 + seed);
  if (r < (course === 0 ? 0.45 : 0.16)) return 'V';
  return r > 0.93 ? 'v' : 'U';
}

/** A hip roof from the front: a trapezoid from the ridge row down to the eave row (1:1 hips). */
function hipRoof(s: Sketch, x0: number, x1: number, top: number, eave: number, seed: number): void {
  for (let y = top; y <= eave; y++) {
    const l = x0 + (eave - y);
    const r = x1 - (eave - y);
    for (let x = l; x <= r; x++) {
      let c = y === top ? (hash01(x * 3 + seed) < 0.25 ? 'U' : 'V') : shingle(x, y - top, seed);
      // the hips: a lit ridge cap down the left one, the right one in shade
      if (x === l || (x === l + 1 && y > top)) c = x === l ? 'V' : c === 'u' ? 'U' : c;
      if (x === r) c = 'v';
      else if (x === r - 1 && y > top) c = 'u';
      s.set(x, y, c);
    }
  }
}

/**
 * A front gable from the peak (columns cx and cx + 1 on row `top`) down `rows` rows, stepping out
 * `run` pixels per row. The roof is a band `band` pixels thick: a white barge board on the outside (in
 * shade on the right), then shingle courses. Inside the bands the gable wall is left as it was, and
 * its first pixels under each band get the soffit's shadow (key `shadow`, the wall's own shade).
 */
function gable(s: Sketch, cx: number, top: number, rows: number, run: number, band: number, shadow = '1'): void {
  for (let i = 0; i < rows; i++) {
    const y = top + i;
    const l = cx - i * run;
    const r = cx + 1 + i * run;
    for (let x = l; x <= r; x++) {
      const left = x <= cx;
      const k = left ? x - l : r - x;
      if (k >= band) {
        if (k < band + run && i > 0) s.set(x, y, shadow);
        continue;
      }
      let c: string;
      if (k === 0) c = left ? 'W' : '5';
      else if (k === 1) c = left ? 'W' : '5';
      else if (i % 2 === 1) c = left ? 'U' : 'u';
      else c = left ? (k === 2 ? 'V' : 'U') : k === 2 ? 'U' : 'u';
      if (k === band - 1) c = left ? 'u' : 'v';
      s.set(x, y, c);
    }
  }
}

/**
 * Clapboard siding: boards three rows tall, a shade line under each (keys 3 face, 2 line), with the
 * butt joints of the boards staggered along each course.
 */
function siding(s: Sketch, x0: number, y0: number, x1: number, y1: number, seed: number): void {
  for (let y = y0; y <= y1; y++) {
    const r = (y - y0) % 3;
    const course = Math.floor((y - y0) / 3);
    for (let x = x0; x <= x1; x++) {
      let c = r === 0 ? '2' : '3';
      if (r === 2 && hash01(course * 53 + x * 7 + seed) < 0.03) c = '4';
      if (r > 0 && (x - x0 + course * 11) % 23 === 0 && hash01(course * 17 + seed) < 0.8) c = '2';
      s.set(x, y, c);
    }
  }
}

/**
 * Brick: courses three rows tall (two rows of brick with staggered joints, then a mortar line); each
 * brick catches the light on its top row, some are darker, a few paler.
 */
function brick(s: Sketch, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y++) {
    const row = y - y0;
    const course = Math.floor(row / 3);
    const r = row % 3;
    for (let x = x0; x <= x1; x++) {
      if (r === 2) {
        s.set(x, y, '2');
        continue;
      }
      const off = course % 2 === 0 ? 0 : 3;
      if ((x - x0 + off) % 6 === 0) {
        s.set(x, y, '2');
        continue;
      }
      const k = hash01(Math.floor((x - x0 + off) / 6) * 13 + course * 5);
      const c = k < 0.2 ? '1' : k > 0.9 ? '4' : '3';
      s.set(x, y, r === 0 && c === '3' && k > 0.55 ? '4' : c);
    }
  }
}

/** Windows: frame x (painted white), glass c / C (a lit streak), muntins w, curtains M / P. */
const SASH: Rows = [
  'xxxxxxx',
  'xCCwCcx',
  'xCcwccx',
  'xccwccx',
  'xwwwwwx',
  'xCcwCcx',
  'xccwccx',
  'xccwccx',
  'xxxxxxx',
];
/** Curtains tied back in the lower sash, a valance across the top of it. */
const SASH_CURTAINS: Rows = [
  'xxxxxxx',
  'xCCwCcx',
  'xCcwccx',
  'xccwccx',
  'xwwwwwx',
  'xMMMMPx',
  'xMcwcPx',
  'xMcwcPx',
  'xxxxxxx',
];
/** A roller shade pulled halfway down. */
const SASH_SHADE: Rows = [
  'xxxxxxx',
  'xMMMMPx',
  'xMMMMPx',
  'xPPPPPx',
  'xwwwwwx',
  'xCcwCcx',
  'xccwccx',
  'xccwccx',
  'xxxxxxx',
];
const SMALL_WINDOW: Rows = ['xxxxx', 'xCwcx', 'xcwcx', 'xwwwx', 'xcwcx', 'xxxxx'];
/** The cottage's attic window: a round-headed sash with a fan of muntins. */
const ARCH_WINDOW: Rows = [
  '..xxxx..',
  '.xCCwcx.',
  'xCCcwccx',
  'xwwwwwwx',
  'xCccwccx',
  'xcccwccx',
  'xcccwccx',
  'xxxxxxxx',
];
/** A picture window: a wide fixed pane between two narrow sashes, curtains drawn back to the sides. */
const PICTURE_WINDOW: Rows = [
  'xxxxxxxxxxxxxxxxx',
  'xMCwCCCcccccwcCPx',
  'xMcwCCcccccccwcPx',
  'xMcwCcccccccwccPx',
  'xMcwccccccccwccPx',
  'xMcwcccccccccwcPx',
  'xMcwccccccccwccPx',
  'xxxxxxxxxxxxxxxxx',
];

/**
 * A paneled door, 6 wide and `h` tall: a lit left stile, two inset panels (their top edges in shadow,
 * a lit lip on their lower right), the lock rail between them with a brass knob (R mid, r shade, e lit,
 * y brass), the right edge in shade.
 */
function door(h: number): Rows {
  const lock = Math.floor((h - 1) / 2);
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    if (y === 0 || y === h - 1 || y === lock) rows.push('eRRRRr');
    else if (y === lock + 1) rows.push('eRRRyr');
    else if (y === 1 || y === lock + 2) rows.push('eRrrRr');
    else rows.push('eRreRr');
  }
  return rows;
}
const DOOR = door(11);

/** Concrete steps down from a stoop: two treads (lit, a shade at the right end) over their risers. */
const STEPS: Rows = [
  '.TTTTTTTTTTT5.',
  '.SSSSSSSSSSSs.',
  'TTTTTTTTTTTTT5',
  'SSSSSSSSSSSSSs',
];
const STEP_COLORS = { T: '#ebe5df', '5': '#cfc6cf', S: '#b9b0c0', s: '#958ca8' };

/** A wall lantern: its cap, two rows of glass (the porch light), its base. */
const SCONCE: Rows = ['bb', 'YY', 'YA', 'bb'];

/** A window with shutters two pixels wide (louvers in G and g), a head over it and a sill under it. */
function shuttered(s: Sketch, rows: Rows, x: number, y: number): void {
  framed(s, rows, x, y);
  for (let yy = y; yy < y + rows.length; yy++) {
    const louver = (yy - y) % 2 === 1 ? 'g' : 'G';
    s.set(x - 2, yy, 'G');
    s.set(x - 1, yy, louver);
    s.set(x + rows[0].length, yy, 'G');
    s.set(x + rows[0].length + 1, yy, louver);
  }
}

/** A window with a head (trim and its shadow line) and a sill (trim, a shadow under it). */
function framed(s: Sketch, rows: Rows, x: number, y: number): void {
  const w = rows[0].length;
  s.stamp(rows, x, y);
  s.rect(x - 1, y - 1, w + 2, 1, 'W');
  s.set(x + w, y - 1, '5');
  s.rect(x - 1, y + rows.length, w + 2, 1, 'W');
  s.set(x + w, y + rows.length, '5');
  for (let xx = x; xx < x + w + 1; xx++) if ('234'.includes(s.get(xx, y + rows.length + 1))) s.set(xx, y + rows.length + 1, '1');
}

/** A downspout: from the gutter at row y0 down the wall to row y1, an elbow kicking out at the bottom. */
function downspout(s: Sketch, x: number, y0: number, y1: number, dir: 1 | -1): void {
  for (let y = y0; y <= y1; y++) s.set(x, y, y === y0 + 1 ? 'b' : 'a');
  s.set(x + dir, y1, 'a');
  s.set(x + 2 * dir, y1, 'b');
}

interface House {
  name: string;
  rows: Rows;
  /** The house's paint: palette key to color. */
  colors: Record<string, string>;
  /** The porch light's glass (its top left; 2 x 2 pixels), in the art's own pixels. */
  lamp: readonly [number, number];
  /** The front walk leaves the stoop between these columns (art pixels). */
  walk: readonly [number, number];
  /** The garage door's columns, if the house has one: the driveway starts there. */
  drive?: readonly [number, number];
}

/**
 * House A: two stories, sky-blue clapboard, a slate hip roof with a gutter, navy shutters, a red door
 * under a pediment hood, a stoop (its steps come down onto the lawn), a brick chimney.
 */
function twoStory(): House {
  const s = new Sketch(51, 45);
  // the chimney stands behind the ridge: a stone cap over brick
  s.rect(33, 0, 8, 1, 'T');
  s.rect(33, 1, 8, 1, 'S');
  s.set(40, 0, 'S');
  s.set(40, 1, 's');
  for (let y = 2; y <= 7; y++) {
    for (let x = 34; x <= 39; x++) {
      let c = y % 2 === 1 ? 'n' : (x + (y % 4 === 0 ? 1 : 0)) % 3 === 0 ? 'n' : 'N';
      if (x === 34) c = 't';
      if (x === 39) c = 'n';
      s.set(x, y, c);
    }
  }
  hipRoof(s, 0, 50, 5, 12, 1);
  // the gutter along the eave, its end caps
  s.rect(0, 13, 51, 1, 'A');
  s.set(0, 13, 'a');
  s.set(50, 13, 'a');
  // walls: eave shadow, siding, corner boards, a belt between the floors, the water table, stone
  siding(s, 5, 14, 45, 40, 3);
  s.rect(3, 14, 45, 1, '1');
  for (let y = 14; y <= 40; y++) {
    s.set(3, y, 'W');
    s.set(4, y, y === 14 ? '1' : 'W');
    s.set(46, y, '5');
    s.set(47, y, '5');
  }
  s.rect(3, 27, 45, 1, 'W');
  s.set(47, 27, '5');
  for (let x = 5; x <= 45; x++) s.set(x, 28, '1');
  s.rect(3, 41, 45, 1, 'T');
  for (let y = 42; y <= 44; y++) {
    for (let x = 3; x <= 47; x++) {
      const joint = y === 43 ? (x + 3) % 7 === 0 : (x % 7 === 0);
      s.set(x, y, y === 44 ? (joint ? 's' : 'S') : joint ? 's' : y === 42 && x % 7 === 1 ? 'T' : 'S');
    }
  }
  // upstairs: two shuttered windows and a small one over the door
  shuttered(s, SASH_SHADE, 9, 16);
  shuttered(s, SASH, 35, 16);
  framed(s, SMALL_WINDOW, 23, 17);
  // downstairs
  shuttered(s, SASH_CURTAINS, 9, 31);
  shuttered(s, SASH, 35, 31);
  // the door: a pediment hood over its trim, the lantern beside it
  s.rect(24, 26, 4, 1, 'V');
  s.rect(22, 27, 8, 1, 'U');
  s.set(22, 27, 'V');
  s.set(29, 27, 'u');
  s.rect(21, 28, 10, 1, 'W');
  s.set(30, 28, '5');
  s.rect(22, 29, 8, 12, 'W');
  for (let y = 29; y <= 40; y++) s.set(29, y, '5');
  s.stamp(DOOR, 23, 30);
  s.stamp(SCONCE, 30, 31);
  // the stoop in front of the door (its steps come down onto the lawn: STEPS)
  s.rect(20, 41, 11, 1, 'T');
  s.rect(20, 42, 11, 1, 'S');
  s.set(30, 42, 's');
  // the downspout at the right corner, out of the gutter and off onto the lawn
  downspout(s, 48, 13, 44, 1);
  return {
    name: 'two_story',
    rows: s.rows(),
    colors: {
      ...SHARED,
      '4': '#a9c6e4', '3': '#90b3d9', '2': '#7b98c8', '1': '#606fa7',
      V: '#827e9e', U: '#605b7e', u: '#4b4666', v: '#3b3652',
      e: '#ea725b', R: '#c64042', r: '#902d41',
      G: '#3d5291', g: '#2c3a72',
      t: '#d27c59', N: '#aa5440', n: '#7d3d43',
    },
    lamp: [30, 32],
    walk: [19, 31],
  };
}

/**
 * House B: a front-gabled cottage, butter-yellow board and batten in the gable over clapboard, a
 * terracotta roof, an arched attic window, a picture window over a flower box, a teal door.
 */
function cottage(): House {
  const s = new Sketch(46, 38);
  const peak = 22;
  // the gable wall (board and batten) behind everything, cut to the roof's slope
  for (let y = 2; y <= 21; y++) {
    for (let x = 0; x < 46; x++) {
      if (x < peak - y + 1 || x > peak + 1 + y - 1) continue;
      const k = (x + 1) % 5;
      s.set(x, y, k === 0 ? '4' : k === 1 ? '2' : '3');
    }
  }
  // the chimney rises from the right slope, behind the barge board
  for (let y = 4; y <= 15; y++) {
    for (let x = 31; x <= 35; x++) {
      if (x <= peak + y) continue;
      let c = y % 2 === 0 ? 'n' : (x + (y % 4 === 1 ? 1 : 0)) % 3 === 0 ? 'n' : 'N';
      if (x === 31) c = 't';
      if (x === 35) c = 'n';
      s.set(x, y, c);
    }
  }
  s.rect(30, 2, 7, 1, 'T');
  s.rect(30, 3, 7, 1, 'S');
  s.set(36, 2, 'S');
  s.set(36, 3, 's');
  gable(s, peak, 0, 23, 1, 6);
  s.stamp(ARCH_WINDOW, 19, 8);
  s.rect(18, 16, 10, 1, 'W');
  s.set(27, 16, '5');
  // the gable's base trim, the ground floor's siding, corner boards, foundation
  s.rect(2, 22, 42, 1, 'W');
  s.set(43, 22, '5');
  siding(s, 4, 23, 41, 35, 7);
  s.rect(4, 23, 38, 1, '1');
  for (let y = 23; y <= 35; y++) {
    s.set(2, y, 'W');
    s.set(3, y, 'W');
    s.set(42, y, '5');
    s.set(43, y, '5');
  }
  for (let y = 36; y <= 37; y++) {
    for (let x = 2; x <= 43; x++) s.set(x, y, y === 36 ? (x % 6 === 4 ? 's' : x % 6 === 5 ? 'T' : 'S') : (x + 3) % 6 === 4 ? 's' : 'S');
  }
  // the downspout off the right eave
  downspout(s, 44, 23, 37, 1);
  // the door in its trim under a transom light, the lantern, a step
  s.rect(5, 23, 8, 13, 'W');
  for (let y = 23; y <= 35; y++) s.set(12, y, '5');
  s.stamp(['xxxxxx', 'xCcwCx', 'xxxxxx'], 6, 23);
  s.stamp(door(10), 6, 26);
  s.stamp(SCONCE, 13, 27);
  s.rect(4, 36, 10, 1, 'T');
  s.rect(4, 37, 10, 1, 'S');
  s.set(13, 37, 's');
  // the picture window, its sill and a flower box under it
  framed(s, PICTURE_WINDOW, 21, 24);
  for (let x = 21; x <= 37; x++) {
    s.set(x, 34, x === 21 ? 't' : x === 37 ? 'n' : 'N');
    s.set(x, 35, x === 21 ? 't' : x === 37 ? 'n' : x % 4 === 0 ? 'n' : 'N');
  }
  const blooms = '.lq.ql.yY..qL.lq.';
  const leaves = 'lLlGlLlGlLGlLlGlL';
  for (let x = 21; x <= 37; x++) {
    if (blooms[x - 21] !== '.') s.set(x, 32, blooms[x - 21]);
    s.set(x, 33, leaves[x - 21]);
  }
  return {
    name: 'cottage',
    rows: s.rows(),
    colors: {
      ...SHARED,
      '4': '#fbe3a2', '3': '#f3d27e', '2': '#d9ae6b', '1': '#b38b74',
      V: '#ef8f69', U: '#cd5d4a', u: '#a3443f', v: '#7b3443',
      e: '#5fc3b2', R: '#30978a', r: '#206c6c',
      t: '#d27c59', N: '#aa5440', n: '#7d3d43',
      q: '#ea5570', Y: '#fff2c4', l: '#4c984a', L: '#88c55a', G: '#2f6c46',
    },
    lamp: [13, 28],
    walk: [4, 13],
  };
}

/** House C: a brick ranch with an attached garage (front gable, paneled door), a big picture window. */
function ranch(): House {
  const s = new Sketch(73, 27);
  // main roof (hip) and its gutter
  hipRoof(s, 0, 45, 4, 10, 5);
  s.rect(0, 11, 46, 1, 'A');
  s.set(0, 11, 'a');
  // walls: brick, eave shadow, foundation
  brick(s, 3, 12, 45, 25);
  s.rect(3, 12, 43, 1, '1');
  for (let x = 3; x <= 45; x++) s.set(x, 26, x % 7 === 3 ? 's' : 'S');
  // picture window, the door in its trim under a transom with its lantern, a small sash window
  framed(s, PICTURE_WINDOW, 6, 15);
  s.rect(25, 13, 8, 13, 'W');
  for (let y = 13; y <= 25; y++) s.set(32, y, '5');
  s.stamp(['xxxxxx', 'xCcwCx', 'xxxxxx'], 26, 12);
  s.stamp(DOOR, 26, 15);
  s.stamp(SCONCE, 33, 16);
  s.rect(24, 26, 10, 1, 'T');
  framed(s, SASH, 37, 14);
  // the garage: siding in a front gable with a louvered vent, its gutter, then the paneled door
  const gx = 58;
  for (let y = 1; y <= 9; y++) {
    for (let x = 46; x <= 71; x++) {
      if (x < gx - (y - 1) * 2 || x > gx + 1 + (y - 1) * 2) continue;
      s.set(x, y, y % 3 === 1 ? 'o' : 'O');
    }
  }
  gable(s, gx, 1, 7, 2, 6, 'o');
  // the vent: a trim frame round two rows of slats (light, then the dark gap under them)
  s.rect(57, 5, 4, 1, 'W');
  for (const [y, slat] of [[6, 'a'], [7, 'b']] as const) {
    s.set(56, y, 'W');
    s.rect(57, y, 4, 1, slat);
    s.set(61, y, '5');
  }
  s.rect(45, 8, 28, 1, 'A');
  s.set(72, 8, 'a');
  for (let y = 9; y <= 26; y++) {
    s.set(46, y, 'W');
    s.set(47, y, 'W');
    s.set(70, y, '5');
    s.set(71, y, '5');
  }
  for (let x = 48; x <= 69; x++) s.set(x, 9, 's');
  s.rect(48, 10, 22, 1, 'W');
  // four sections across, four panels high, each panel lit on its left and top; a row of glass on top
  // (framed in trim, never lit at night)
  for (let y = 11; y <= 26; y++) {
    for (let x = 48; x <= 69; x++) {
      const r = y - 11;
      const q = x - 48;
      const col = (q - 1) % 5;
      let c: string;
      if (q === 0) c = 'W';
      else if (q === 21) c = '5';
      else if (r === 3 || r === 7 || r === 11 || r === 15) c = '5';
      else if (col === 4) c = '5';
      else if (r < 3) c = col === 0 || r === 0 ? 'W' : r === 1 ? (col === 1 ? 'L' : 'C') : 'c';
      else if (col === 0 || (r - 4) % 4 === 0) c = 'W';
      else c = 'm';
      s.set(x, y, c);
    }
  }
  // the downspout at the house's left corner
  downspout(s, 2, 11, 26, -1);
  return {
    name: 'ranch',
    rows: s.rows(),
    colors: {
      ...SHARED,
      '4': '#d98463', '3': '#c4664c', '2': '#9a5046', '1': '#a95646',
      O: '#f2e9da', o: '#d8ccc2', m: '#e7dfd4',
      V: '#a8785c', U: '#835540', u: '#643e38', v: '#4b2e36',
      e: '#5ba774', R: '#367e56', r: '#255b46',
    },
    lamp: [33, 17],
    walk: [24, 33],
    drive: [48, 69],
  };
}

const HOUSE_A = twoStory();
const HOUSE_B = cottage();
const HOUSE_C = ranch();

/** The street's houses and where they stand (left edge before inking). */
const HOUSES: ReadonlyArray<readonly [House, number]> = [
  [HOUSE_A, 18],
  [HOUSE_B, 135],
  [HOUSE_C, 231],
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
      if (front(px - 3.3, py - 3.9) > i) d -= 0.4;
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
 * A tree: a crown over a trunk (bark lit on its left, darker grooves and a knot, a root flare), the
 * trunk forking into two limbs under the leaves, all inked. `trunkX` is the trunk's left column.
 */
function tree(crownBuf: PixelBuf, trunkX: number, trunkH: number): PixelBuf {
  const w = crownBuf.w;
  const top = crownBuf.h;
  const b = blank(w, top + trunkH);
  const bottom = b.h - 1;
  for (let y = top - 5; y <= bottom; y++) {
    const d = bottom - y;
    setPx(b, trunkX, y, BARK.lit);
    setPx(b, trunkX + 1, y, d % 5 === 3 ? BARK.dark : BARK.mid);
    setPx(b, trunkX + 2, y, d % 4 === 1 || d === 6 || d === 7 ? BARK.dark : BARK.mid);
    setPx(b, trunkX + 3, y, BARK.dark);
  }
  // the root flare
  setPx(b, trunkX - 1, bottom, BARK.mid);
  setPx(b, trunkX - 1, bottom - 1, BARK.lit);
  setPx(b, trunkX + 4, bottom, BARK.dark);
  setPx(b, trunkX + 4, bottom - 1, BARK.deep);
  setPx(b, trunkX - 2, bottom, BARK.lit);
  setPx(b, trunkX + 5, bottom, BARK.deep);
  for (let y = 0; y < top; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (crownBuf.px[i + 3]) b.px.set(crownBuf.px.subarray(i, i + 4), i);
    }
  }
  // the fork: two limbs out of the trunk's top, over the crown's lowest leaves
  setPx(b, trunkX - 1, top - 1, BARK.mid);
  setPx(b, trunkX, top - 1, BARK.lit);
  setPx(b, trunkX + 3, top - 1, BARK.dark);
  setPx(b, trunkX + 4, top - 1, BARK.dark);
  setPx(b, trunkX - 2, top - 2, BARK.mid);
  setPx(b, trunkX - 1, top - 2, BARK.dark);
  setPx(b, trunkX + 5, top - 2, BARK.dark);
  setPx(b, trunkX - 3, top - 3, BARK.dark);
  setPx(b, trunkX + 6, top - 3, BARK.dark);
  return ink(b);
}

/** The big street tree: a round maple, its crown in lobes. */
const MAPLE = tree(
  crown(40, 31, [[9, 19.5, 8.2], [31.5, 19.5, 8.2], [13.5, 10.5, 8.2], [27, 9.8, 8.2], [20.2, 7.5, 7.5], [20.2, 20.2, 9.8], [20.2, 15, 9]], LEAF, 3, 4.4),
  18, 12,
);

/** A flowering cherry: a wide, flat-topped crown of pink blossom in puffs. */
const CHERRY = tree(
  crown(38, 24, [[7.5, 13.5, 6], [30, 13.5, 6], [13.5, 8.2, 6.8], [24, 7.5, 6.8], [18.8, 5.2, 6], [18.8, 13.5, 7.5], [6, 17.2, 4.5], [31.5, 17.2, 4.5]], BLOSSOM, 5, 4.6, -0.05),
  17, 12,
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
      const hw = r === rows ? to - 2 : from + ((to - from) * r) / (rows - 1);
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
        const u = (x - cx) / Math.max(1, hw);
        if (r === rows && Math.abs(u) < 0.55) continue;
        let d = -u * 0.6 + 0.15 - (r / rows) * 0.25;
        if (r < 3 && t > 0) d -= 0.45 * (1 - Math.abs(u));
        if (r >= rows - 1 && Math.abs(u) > 0.55) d += 0.4;
        // needles in short sprays: a darker stroke now and then
        if (hash01(x * 31 + y * 17 + t) < 0.12) d -= 0.25;
        const k = d < -0.4 ? 0 : d < -0.08 ? 1 : d < 0.22 ? 2 : d < 0.48 ? 3 : 4;
        setPx(b, x, y, SPRUCE[k]);
      }
    }
  }
  for (let y = h - trunk; y < h; y++) {
    setPx(b, Math.floor(cx) - 1, y, BARK.lit);
    setPx(b, Math.floor(cx), y, BARK.mid);
    setPx(b, Math.floor(cx) + 1, y, BARK.dark);
  }
  despeckle(b);
  return ink(b);
}

const SPRUCE_TREE = spruce(25, [[0, 7, 0.8, 3.8], [5, 7, 1.8, 6], [11, 9, 2.7, 8.2], [18, 9, 3.8, 10.5], [26, 9, 4.5, 12]], 3);

/** A shrub: a small crown with flower heads (light, mid, dark) on its sunny side. */
function shrub(w: number, h: number, blobs: readonly Blob[], seed: number, tones: readonly string[], flowers?: readonly string[]): PixelBuf {
  const c = crown(w, h, blobs, tones, seed, 3.6);
  if (flowers) {
    const heads: ReadonlyArray<readonly [number, number]> = [[0.2, 0.22], [0.5, 0.1], [0.78, 0.3], [0.38, 0.5], [0.1, 0.58], [0.65, 0.58]];
    for (const [fx, fy] of heads) {
      const x = Math.round(fx * (w - 3));
      const y = Math.round(fy * (h - 3));
      const at = (xx: number, yy: number) => c.px[(yy * w + xx) * 4 + 3] > 0;
      if (!at(x, y) || !at(x + 2, y) || !at(x, y + 2) || !at(x + 2, y + 2)) continue;
      // a round head of three tones: lit top left, shaded bottom right
      setPx(c, x + 1, y, flowers[0]);
      setPx(c, x, y + 1, flowers[0]);
      setPx(c, x + 1, y + 1, flowers[1]);
      setPx(c, x + 2, y + 1, flowers[1]);
      setPx(c, x + 1, y + 2, flowers[2]);
      setPx(c, x + 2, y + 2, flowers[2]);
    }
  }
  return ink(c);
}

const BOX_SHRUB = shrub(13, 8, [[4, 4.5, 3.9], [9, 4.5, 3.9], [6.5, 3.4, 3.9]], 21, BOX_LEAF);
const ROUND_SHRUB = shrub(11, 9, [[5.5, 5, 4.8]], 22, BOX_LEAF);
const HYDRANGEA = shrub(15, 9, [[4.5, 5.2, 4.5], [10.5, 5.2, 4.5], [7.5, 3.9, 4.5]], 23, LEAF, ['#d8e4ff', '#98a9ee', '#6c78cc']);
const ROSE_BUSH = shrub(13, 8, [[4.5, 4.5, 4.2], [9, 4.5, 4.2], [6.8, 3.3, 3.9]], 24, LEAF, ['#ffc0c4', '#ea5570', '#a83455']);

/**
 * A clipped hedge: a long box of leaves, flat on top, lit along its top edge and down its left end,
 * its face in leaf clusters, its foot in shade.
 */
function hedge(w: number, h: number, seed: number): PixelBuf {
  const blobs: Blob[] = [];
  for (let x = 3; x <= w - 3; x += 3) blobs.push([x, h / 2 + 0.5, h / 2 + 0.6]);
  const c = crown(w, h, blobs, BOX_LEAF, seed, 3.4, 0.05);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (!c.px[(y * w + x) * 4 + 3]) continue;
      if (y === 0 || (y === 1 && !c.px[x * 4 + 3])) setPx(c, x, y, hash01(x + seed) < 0.25 ? BOX_LEAF[3] : BOX_LEAF[4]);
      break;
    }
  }
  return ink(c);
}

// ------------------------------------------------------------------ props

/** A mailbox on a post (t lit, N shade, n deep), its door at the front, its flag up. */
const MAILBOX: Rows = [
  '........RR',
  '...5555.Re',
  '.55WW555R.',
  '5WWW5554R.',
  '5W55554RR.',
  '5W55544R..',
  '44444333..',
  '..tNNn....',
  '..tNn.....',
  '..tNn.....',
  '.ttNnn....',
];

/** A garden gnome: a tall pointy red hat, rosy nose, white beard, blue coat, brown boots. */
const GNOME: Rows = [
  '...e....',
  '...eR...',
  '..eRR...',
  '..eRRr..',
  '.eeRRrr.',
  'eeRRRRrr',
  '.ssPss..',
  '.sWPWs..',
  'UWWWWWWu',
  'UUWWWWuu',
  'UUUWWuuu',
  '.UUyyuu.',
  '.UUUuuu.',
  '.nn..nn.',
];

/** A stone bird bath: water in the bowl (a glint on it), a turned pedestal, a stepped base. */
const BIRD_BATH: Rows = [
  '55555555555',
  '5CCwCCcccc4',
  '.44444443..',
  '..4444333..',
  '....433....',
  '....433....',
  '....533....',
  '....433....',
  '...54433...',
  '..5444333..',
  '.544443333.',
];

/** The green dumpster (the game's icon): two dark lids, a slanted body, a paw sticker, casters. */
const DUMPSTER: Rows = [
  '..3333333331333333333..',
  '.33333333331133333333..',
  '2233322222211133332222.',
  '111111111111111111111..',
  '.gggggggggggggggggggg..',
  '.lGGgGGGGGGGGGGGgGGgg..',
  '.lGGgGGGwGGGwGGGgGGgg..',
  '.lGGgGGwGGwGGwGGgGGgg..',
  '.lGGgGGGGwwwGGGGgGGgg..',
  '..lGgGGGwwwwwGGGgGgg...',
  '..lGgGGGwwwwwGGGgGgg...',
  '..lggGGGGwwwGGGGggg....',
  '..ggggggggggggggggg....',
  '..1xxxxxxxxxxxxxxx1....',
  '..1x.............x1....',
  '..11.............11....',
];

/** A metal trash can with its lid on, a handle on the lid, ribs down its body. */
const CAN: Rows = [
  '...44....',
  '..5445...',
  '5wwwwww44',
  '.333332..',
  '.5w4433..',
  '.5w4433..',
  '.33333...',
  '.5w4433..',
  '.5w4433..',
  '.333322..',
];

/** A full trash bag, tied at the top, lit on its upper left. */
const BAG: Rows = [
  '..2.2....',
  '...2.....',
  '..212....',
  '.22321...',
  '.233321..',
  '23333221.',
  '23333221.',
  '23332211.',
  '.2222111.',
];

/** A cardboard box, flaps folded in, a strip of tape down the middle. */
const BOX: Rows = [
  'TTTTTTTTTt',
  'tTTTTyTTNN',
  'ttTTNyNNNn',
  'ttNNNyNNNn',
  'ttNNNNNNNn',
  'tNNNNNNNNn',
  'tNNNNNNNnn',
];

/**
 * A flower bed: clumps of flowers (each a lit cross around a darker heart) on stems over a row of
 * leaves, in a strip of mulch. `kinds` are [petal, heart] colors, used in turn.
 */
function flowerBed(w: number, kinds: ReadonlyArray<readonly [string, string]>): PixelBuf {
  const b = blank(w, 8);
  for (let x = 0; x < w; x++) {
    setPx(b, x, 7, x % 5 === 2 ? MULCH.dark : MULCH.mid);
    setPx(b, x, 6, x % 6 === 1 ? MULCH.lit : x % 4 === 3 ? LEAF[2] : MULCH.mid);
    setPx(b, x, 5, x % 3 === 1 ? LEAF[3] : LEAF[2]);
  }
  for (let i = 0, x = 0; x + 2 < w; i++, x += 4) {
    const [petal, heart] = kinds[i % kinds.length];
    const y = i % 2;
    setPx(b, x + 1, y, petal);
    setPx(b, x, y + 1, petal);
    setPx(b, x + 1, y + 1, heart);
    setPx(b, x + 2, y + 1, petal);
    setPx(b, x + 1, y + 2, petal);
    for (let yy = y + 3; yy < 5; yy++) setPx(b, x + 1, yy, LEAF[2]);
    setPx(b, x + 2, 4, LEAF[3]);
    setPx(b, x, 4, LEAF[1]);
  }
  return ink(b);
}

/** A short board fence behind the dumpster: boards with pointed tops, two rails, capped posts. */
function boardFence(n: number): PixelBuf {
  const w = n * 4 + 2;
  const h = 13;
  const b = blank(w, h);
  const plank = [mix('t', 'T', 0.35), 't', mix('t', 'N', 0.5), 'N'];
  for (let i = 0; i < n; i++) {
    const x0 = 1 + i * 4;
    for (let y = 2; y < h; y++) for (let k = 0; k < 4; k++) setPx(b, x0 + k, y, plank[k]);
    setPx(b, x0 + 1, 1, plank[1]);
    setPx(b, x0 + 2, 1, plank[2]);
    // a knot in some boards
    if (hash01(i * 7 + 3) < 0.3) setPx(b, x0 + 2, 6 + (i % 3), 'n');
  }
  for (const ry of [4, 10]) {
    for (let x = 1; x < w - 1; x++) {
      setPx(b, x, ry, 'n');
      setPx(b, x, ry + 1, mix('n', 'b', 0.4));
    }
  }
  for (const px of [0, Math.floor(w / 2), w - 1]) {
    for (let y = 0; y < h; y++) setPx(b, px, y, y === 0 ? 'T' : y < 2 ? 't' : 'N');
  }
  return ink(b);
}

/**
 * A white picket fence `h` rows tall: `n` pickets two pixels wide (lit on the left) with pointed tops,
 * on two rails that show in the gaps between them, between square posts. Only its outer edge is inked
 * (the points, the posts' tops and outer sides), so the lawn shows through the gaps instead of a grille
 * of ink.
 */
function picketFence(n: number, h: number): PixelBuf {
  const w = n * 3 + 7;
  const b = blank(w, h + 1);
  const [lit, mid, shade, rail] = ['#fbf7ee', '#e3dcea', '#b9b0c8', '#9d93b0'];
  const K = '#1a1326';
  for (const ry of [3, h - 2]) for (let x = 3; x < w - 3; x++) setPx(b, x, ry, rail);
  for (let i = 0; i < n; i++) {
    const x0 = 4 + i * 3;
    setPx(b, x0, 0, K);
    setPx(b, x0 - 1, 1, K);
    setPx(b, x0 + 1, 1, K);
    setPx(b, x0, 1, lit);
    for (let y = 2; y <= h; y++) {
      setPx(b, x0, y, lit);
      setPx(b, x0 + 1, y, y === h ? shade : mid);
    }
  }
  // the posts, inked across the top and down the outer side
  for (const [px, outer] of [[1, 0], [w - 3, w - 1]] as const) {
    for (let y = 0; y <= h; y++) {
      setPx(b, px, y, y === 0 ? K : lit);
      setPx(b, px + 1, y, y === 0 ? K : y === h ? shade : mid);
      setPx(b, outer, y, K);
    }
  }
  return b;
}

// ------------------------------------------------------------------ the lawn

/**
 * The lawn, from the house line (its far edge between the houses, lit and a little hazy) to the
 * bottom, textured with short horizontal strokes a step lighter or darker. Each lot in `lots` (x
 * ranges) is mowed in soft slanted stripes; a few tufts stand nearer the street.
 */
function lawn(b: PixelBuf, lots: ReadonlyArray<readonly [number, number]>): void {
  const mowed = (x: number): number => {
    for (const [x0, x1] of lots) if (wrap(x - x0) <= x1 - x0) return wrap(x - x0);
    return -1;
  };
  for (let y = BASE; y < b.h; y++) {
    const runs = runIds(40 + y, 2, 6);
    for (let x = 0; x < TILE_W; x++) {
      const r = hash01(runs[x] * 7 + y * 131);
      let c: string;
      if (y === BASE) c = r < 0.3 ? LAWN.far : LAWN.farRim;
      else if (y === BASE + 1 && r < 0.35) c = LAWN.far;
      else {
        const m = mowed(x);
        const stripe = m >= 0 && Math.floor((m + Math.floor((y - BASE) / 2)) / 7) % 2 === 1;
        c = r < 0.12 ? LAWN.dim : r > 0.9 ? LAWN.bright : stripe ? LAWN.stripe : LAWN.base;
      }
      setPx(b, x, y, c);
    }
  }
  for (let x = 3; x < TILE_W; x += 13) {
    const tx = x + Math.floor(hash01(x * 3) * 7);
    const ty = FRONT - Math.floor(hash01(x * 5 + 1) * 4);
    dot(b, tx, ty, LAWN.shade);
    dot(b, tx + 1, ty, LAWN.shade);
    dot(b, tx + 2, ty, LAWN.dim);
    dot(b, tx + 1, ty - 1, LAWN.tip);
    if (hash01(x * 9) < 0.5) dot(b, tx + 2, ty - 1, LAWN.lit);
  }
}

/** A soft shadow on the grass: an ellipse with a darker core. */
function lawnShadow(b: PixelBuf, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    if (y <= BASE || y >= b.h) continue;
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const e = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (e <= 1) dot(b, x, y, e < 0.4 ? LAWN.core : LAWN.cast);
    }
  }
}

/** A house's shadow on the grass to its right: a band along the ground, fading out to the right. */
function houseShadow(b: PixelBuf, x: number, len: number): void {
  for (let i = 0; i < len; i++) {
    for (let y = BASE + 1; y <= BASE + 3; y++) {
      if (y === BASE + 3 && i > len - 6) continue;
      if (y === BASE + 2 && i > len - 3) continue;
      dot(b, x + i, y, i < len / 2 ? LAWN.core : LAWN.cast);
    }
  }
}

/** A paved walk from a stoop to the front of the yard, widening a little toward the street, in slabs. */
function walkway(b: PixelBuf, x0: number, x1: number): void {
  for (let y = BASE; y < b.h; y++) {
    const grow = Math.floor((y - BASE) / 3);
    const l = x0 - grow;
    const r = x1 + grow;
    for (let x = l; x <= r; x++) {
      let c = STONE.lit;
      if (x === l) c = STONE.dark;
      else if (x === r) c = STONE.deep;
      else if ((y - BASE) % 3 === 2) c = STONE.joint;
      else if (x === r - 1) c = STONE.mid;
      else if ((x + (y - BASE) * 2) % 5 === 0 && (y - BASE) % 3 === 1) c = STONE.mid;
      dot(b, x, y, c);
    }
  }
}

/** Stepping stones: flat ovals, larger toward the street, zigzagging a little, each with its shadow. */
function steppingStones(b: PixelBuf, x: number): void {
  const stones: ReadonlyArray<readonly [number, number, number]> = [[x + 1, BASE + 1, 4], [x + 4, BASE + 4, 5], [x + 1, BASE + 7, 7]];
  for (const [sx, sy, w] of stones) {
    for (let i = 0; i < w; i++) {
      dot(b, sx + i, sy, i === 0 || i === w - 1 ? FLAG.mid : FLAG.lit);
      dot(b, sx + i, sy + 1, i === 0 ? FLAG.mid : i === w - 1 ? FLAG.dark : i < w / 2 ? FLAG.lit : FLAG.mid);
      dot(b, sx + i, sy + 2, i === 0 || i === w - 1 ? LAWN.core : FLAG.dark);
      if (i > 0) dot(b, sx + i, sy + 3, LAWN.core);
    }
    dot(b, sx + w, sy + 1, LAWN.core);
    dot(b, sx + w, sy + 2, LAWN.core);
  }
}

/** A concrete driveway from the garage to the street, with an expansion joint and an oil stain. */
function driveway(b: PixelBuf, x0: number, x1: number): void {
  for (let y = BASE; y < b.h; y++) {
    const grow = Math.floor((y - BASE) / 2);
    const l = x0 - grow;
    const r = x1 + grow;
    for (let x = l; x <= r; x++) {
      let c = STONE.mid;
      if (x === l) c = STONE.dark;
      else if (x === r) c = STONE.deep;
      else if (y === BASE + 4) c = STONE.joint;
      else if (x - l < 4) c = STONE.lit;
      dot(b, x, y, c);
    }
  }
  const mid = Math.round((x0 + x1) / 2);
  for (const [dx, dy, w] of [[-3, 6, 6], [-4, 7, 8], [-2, 8, 5]] as const) {
    for (let i = 0; i < w; i++) dot(b, mid + dx + i, BASE + dy, STONE.dark);
  }
}

// ------------------------------------------------------------------ lights and the layer

const PORCH_LIGHT = { radius: 7.5, power: 0.9, color: '#FFD08A' } as const;

/** The houses' windows and porch lights, in mid-layer pixels (houses are inked: art sits 1 px in). */
export function midLights(): LightSpot[] {
  return HOUSES.flatMap(([h, hx]) => {
    const top = BASE - h.rows.length;
    const windows = windowsOf(h.rows).map((w): LightSpot => ({ ...w, x: wrap(hx + 1 + w.x), y: top + w.y, kind: 'window' }));
    const [lx, ly] = h.lamp;
    const lamp: LightSpot = { x: wrap(hx + 1 + lx), y: top + ly, w: 2, h: 2, kind: 'lamp', ...PORCH_LIGHT };
    return [...windows, lamp];
  });
}

/**
 * Where a world's themed props (16 px sprites, see placeProps in worldLook.ts) can stand without
 * covering a door, a tree or a window (lit glass is painted over whatever covers it at night): the
 * left edge of each prop's frame, in mid-layer pixels, and the row their feet stand on (scene row 83).
 * In order of preference: the side yard left of the cherry, the garage driveway, the side yard right
 * of the maple (behind the hero in the opening shot), the side yard between the maple and the cottage.
 */
export const MID_PROP_SPOTS = { row: BASE + 5, x: [191, 280, 101, 117] } as const;

/** The alley's dumpster (left edge before inking). */
const DUMPSTER_X = 314;

/** Side-yard trees: [sprite, left edge, base row]. */
const TREES: ReadonlyArray<readonly [PixelBuf, number, number]> = [
  [MAPLE, 75, BASE + 6],
  [CHERRY, 190, BASE + 5],
];

export function midLayer(): PixelBuf {
  const b = blank(TILE_W, MID_SPOT.h);
  const houses = HOUSES.map(([h, x]) => [inked(h.rows, h.colors), x, h] as const);
  const [[, ax], [, bx], [, cx]] = houses;
  lawn(b, houses.map(([s, x]) => [x, x + s.w - 1] as const));

  // shadows on the grass: a soft contact line along each house, and to the right of things
  for (const [s, x] of houses) {
    for (let i = 2; i < s.w - 2; i++) dot(b, x + i, BASE + 1, LAWN.cast);
    houseShadow(b, x + s.w - 1, 12);
  }
  for (const [t, x, base] of TREES) lawnShadow(b, x + t.w / 2 + 8, base - 0.5, t.w * 0.38, 2.4);
  lawnShadow(b, DUMPSTER_X + 22, BASE + 3, 13, 2);

  // paths: walks and stones from the doors, the driveway
  for (const [, x, h] of houses) {
    if (h.name === 'cottage') steppingStones(b, x + 1 + h.walk[0] + 3);
    else walkway(b, x + 1 + h.walk[0] + 2, x + 1 + h.walk[1] - 2);
    if (h.drive) driveway(b, x + 1 + h.drive[0], x + 1 + h.drive[1]);
  }

  // the spruce and the fence at the back of the alley, then the houses and the trees
  plant(b, SPRUCE_TREE, 318, BASE - 1);
  plant(b, boardFence(8), 306, BASE + 1);
  for (const [s, x] of houses) plant(b, s, x, BASE);
  for (const [t, x, base] of TREES) plant(b, t, x, base);

  // foundation plantings, a hedge and the ranch's flower bed (all clear of window glass: lit windows
  // glow over whatever covers their glass)
  plant(b, HYDRANGEA, ax + 2, BASE + 4);
  plant(b, BOX_SHRUB, ax + 38, BASE + 3);
  plant(b, ROSE_BUSH, bx - 10, BASE + 2);
  plant(b, ROUND_SHRUB, cx - 5, BASE + 2);
  plant(b, hedge(17, 6, 31), bx + 30, BASE + 3);
  plant(b, flowerBed(17, [['#b88af0', '#6a48b8'], ['#fff8ec', '#f2c23c'], ['#f08ab8', '#b8407a']]), cx + 7, BASE + 5);

  // house A's steps, down from its stoop onto the walk
  plant(b, inked(STEPS, STEP_COLORS), ax + 19, BASE + 2);

  // the cottage's picket fence along the front of its yard, open at the stepping stones
  plant(b, picketFence(1, 6), bx - 2, FRONT);
  plant(b, picketFence(7, 6), bx + 18, FRONT);

  // the alley: a can by the garage, the dumpster, a box and two bags
  plant(b, inked(CAN), 306, BASE + 4);
  plant(b, inked(DUMPSTER), DUMPSTER_X, BASE + 4);
  plant(b, inked(BAG, { '1': '#2b4639', '2': '#3c634e', '3': '#588866' }), 345, BASE + 4, true);
  plant(b, inked(BOX), 334, BASE + 4);
  plant(b, inked(BAG, { '1': '#34344a', '2': '#4b4b66', '3': '#6c6c8c' }), 343, BASE + 6);

  // the front of the yards: mailboxes by the walks, a gnome, a bird bath under the maple
  plant(b, inked(MAILBOX), ax + 34, FRONT);
  plant(b, inked(MAILBOX, { '5': '#4c4a62', W: '#6e6c88', '4': '#3c3a50', '3': '#2e2c40' }), cx + 35, FRONT);
  plant(b, inked(GNOME), bx + 46, BASE + 5);
  plant(b, inked(BIRD_BATH, { '5': STONE.lit, '4': STONE.mid, '3': STONE.dark, C: '#a2d2ed', c: '#5c93c8', w: '#ffffff' }), 77, BASE + 6);
  return b;
}

/** Authored sprites, for the preview sheet. */
export const MID_SPRITES: Array<[string, Rows]> = [
  ...[HOUSE_A, HOUSE_B, HOUSE_C].map((h): [string, Rows] => [h.name, h.rows]),
  ['sash', SASH], ['sash_curtains', SASH_CURTAINS], ['sash_shade', SASH_SHADE], ['small_window', SMALL_WINDOW],
  ['arch_window', ARCH_WINDOW], ['picture_window', PICTURE_WINDOW], ['door', DOOR], ['door_short', door(10)], ['sconce', SCONCE],
  ['mailbox', MAILBOX], ['gnome', GNOME], ['bird_bath', BIRD_BATH],
  ['dumpster', DUMPSTER], ['can', CAN], ['bag', BAG], ['box', BOX], ['steps', STEPS],
];
