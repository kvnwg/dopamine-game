/**
 * The dungeon world's battle backdrop, composed from 0x72's DungeonTileset II (dungeonTiles.ts, made
 * by tools/packs/dungeon.py). Tiles are drawn 1:1 (never scaled; only cropped and stacked) in the
 * pack's own colors, so the set is not graded.
 *
 * The pack is drawn for a top-down 3/4 view; here it becomes a hall seen from the side:
 *  - far: darkness above the back wall, the wall's stone lip with gargoyle heads and column capitals
 *    rising out of it, and the brick face down to the floor line: banners, holes, an arched door,
 *    two gargoyle fountains (water and lava) pouring into basins on the floor, engaged columns.
 *  - mid: a few props standing against the wall on the floor line (crates, a chest, a skull).
 *  - ground: one row of floor slabs; fighters stand 6 rows into it.
 *  - fg: the near wall's lip along the bottom edge of the view.
 * Every layer is TILE_W wide and wraps: things are placed with wrapX. The opening shot (scroll0)
 * puts a column behind the hero, plain wall where the blows land and the banners and water fountain
 * behind the enemies.
 */
import { blank, blit, crop, downsample2, fromRows, type PixelBuf, type Rows, type SheetEntry } from '../buf';
import { frameBuf, fromIndexed, KEYS } from '../indexed';
import { PROPS } from './props';
import { VIEW, type LightSpot, type ScenerySet } from '../sceneryTypes';
import { DUNGEON_PAL, DUNGEON_TILES } from './dungeonTiles';

/** The pack's grid. */
const T = 16;
/** Width of every layer: 16 pack tiles. */
const TILE_W = 16 * T;
/** View row where the floor starts (the far layer ends here), 7 rows above FEET_ROW (67). */
const FLOOR_Y = 60;
/** The ground layer: floor slabs down to the bottom of the view (a second row peeks in at the bottom). */
const GROUND_H = VIEW.h - FLOOR_Y;
/** View row where the back wall's stone lip starts (it is 4 rows tall); bricks start below it. */
const LIP_Y = 8;
/** First brick row under the lip. Bricks come in 4-row courses lined up with it. */
const WALL_Y = LIP_Y + 4;
/** The mid layer's top row in the view (room for two stacked crates); its bottom row sits on the floor line. */
const MID_Y = 12;
/** The near wall's lip (4 rows) along the bottom of the view. */
const FG_H = 4;

const VOID = '#222222';

// ------------------------------------------------------------------ tiles

function tile(name: string): PixelBuf {
  const rows = DUNGEON_TILES[name];
  if (!rows) throw new Error(`dungeon: no tile "${name}"`);
  return fromIndexed(rows, DUNGEON_PAL);
}

/** Rows [y0, y1) of a tile. */
function rowsOf(name: string, y0: number, y1: number): PixelBuf {
  const t = tile(name);
  return crop(t, 0, y0, t.w, y1 - y0);
}

/** A block of one pack color. */
function solid(w: number, h: number, hex: string): PixelBuf {
  const k = DUNGEON_PAL.indexOf(hex);
  if (k < 0) throw new Error(`dungeon: ${hex} is not in the pack palette`);
  return fromIndexed(Array.from({ length: h }, () => KEYS[k].repeat(w)), DUNGEON_PAL);
}

/** Buffers stacked top to bottom, left aligned. */
function stack(parts: readonly PixelBuf[]): PixelBuf {
  const out = blank(Math.max(...parts.map((p) => p.w)), parts.reduce((h, p) => h + p.h, 0));
  let y = 0;
  for (const p of parts) {
    blit(out, p, 0, y);
    y += p.h;
  }
  return out;
}

const times = (n: number, b: PixelBuf): PixelBuf[] => Array.from({ length: n }, () => b);

/** Pastes onto a tiling layer, wrapping across the seam. */
function put(layer: PixelBuf, src: PixelBuf, x: number, y: number, flip = false): void {
  blit(layer, src, x, y, { wrapX: true, flipX: flip });
}

/** Pastes so the art's bottom row lands on `layer`'s row `base`. */
function stand(layer: PixelBuf, src: PixelBuf, x: number, base: number, flip = false): void {
  put(layer, src, x, base - src.h + 1, flip);
}

// ------------------------------------------------------------------ built pieces

type Liquid = 'blue' | 'red';

/**
 * A gargoyle fountain: its horns above the lip, its face in the wall, a stream falling `courses`
 * brick courses (4 rows each, taken in turn from the tile's three animation frames so the stream
 * flickers like falling water) and the basin it pours into, cropped so the basin rests on the floor
 * line. Height 32 + 4 * courses; the lip is at rows 12..15.
 */
function fountain(liquid: Liquid, head: 2 | 3, courses: number): PixelBuf {
  const mid = (f: number) => `wall_fountain_mid_${liquid}_anim_f${f}`;
  return stack([
    tile(`wall_fountain_top_${head}`),
    rowsOf(mid(0), 0, 8),
    ...Array.from({ length: courses }, (_, i) => rowsOf(mid((i + 2) % 3), 8, 12)),
    rowsOf(mid(0), 12, 16),
    rowsOf(`wall_fountain_basin_${liquid}_anim_f0`, 0, 4),
  ]);
}

/**
 * The pack's column from its capital to its foot, with a longer shaft: `segments` times a ring
 * (3 rows) and `plain` rows of shaft. Height 25 + segments * (3 + plain).
 */
function column(segments: number, plain: number): PixelBuf {
  const seg = stack([rowsOf('column', 18, 21), ...times(plain, rowsOf('column', 21, 22))]);
  return stack([rowsOf('column', 4, 18), ...times(segments, seg), rowsOf('column', 25, 36)]);
}

/** The arched wooden door (40 x 48): the leaf with its threshold, the arch over it and the arch's sides. */
function door(): PixelBuf {
  const b = blank(40, 48);
  blit(b, crop(tile('doors_frame_left'), 12, 0, 4, 32), 0, 16);
  blit(b, crop(tile('doors_frame_right'), 0, 0, 4, 32), 36, 16);
  blit(b, tile('doors_frame_top'), 4, 0);
  blit(b, tile('doors_leaf_closed'), 4, 16);
  return b;
}

/** A sprite in dusty grays (its light and shade kept), for cobwebs. */
function dusty(src: PixelBuf): PixelBuf {
  const out = blank(src.w, src.h);
  for (let i = 0; i < src.px.length; i += 4) {
    if (!src.px[i + 3]) continue;
    const l = 0.3 * src.px[i] + 0.59 * src.px[i + 1] + 0.11 * src.px[i + 2];
    const v = 70 + l * 0.62;
    out.px[i] = v + 6;
    out.px[i + 1] = v + 2;
    out.px[i + 2] = v - 4;
    out.px[i + 3] = 255;
  }
  return out;
}

// ------------------------------------------------------------------ far: the back wall

/** Per 16 px bay: how many rows its bricks are shifted (a multiple of a course) and whether mirrored. */
const BRICKS: readonly (readonly [number, boolean])[] = [
  [0, false], [8, true], [4, false], [12, false], [8, true], [0, true], [12, false], [4, true],
  [0, false], [12, true], [8, false], [4, false], [0, true], [8, false], [4, true], [12, true],
];

/** Tiles laid into the brick face: [tile, bay, top row, mirrored]. */
const INSETS: readonly (readonly [string, number, number, boolean?])[] = [
  ['wall_banner_red', 2, WALL_Y],
  ['wall_banner_red', 4, WALL_Y, true],
  ['wall_hole_2', 5, WALL_Y + 4, true],
  ['wall_hole_1', 6, FLOOR_Y - T],
  ['wall_banner_blue', 7, WALL_Y],
  ['wall_banner_green', 9, WALL_Y],
  ['wall_hole_1', 12, WALL_Y + 8, true],
  ['wall_banner_yellow', 13, WALL_Y],
  ['wall_banner_yellow', 15, WALL_Y, true],
];

/**
 * A wall torch, drawn for the game (the pack has none): an iron cup on a bracket with its flame.
 * In battle a flickering flame and glow are laid over it (see src/render/ambience.ts).
 */
export const TORCH: Rows = [
  '..Y..',
  '.yYy.',
  '.OYO.',
  '.oOo.',
  '21112',
  '.212.',
  '..2..',
  '..1..',
];

/** Torch positions on the back wall (top-left of TORCH, far-layer pixels): clear of banners, holes and the door. */
export const TORCHES: ReadonlyArray<readonly [number, number]> = [
  [20, 28],
  [98, 28],
  [147, 34],
  [200, 44],
];

/** Fountain columns (far-layer x of each gargoyle's 16 px bay). */
const WATER_X = 3 * T;
const LAVA_X = 14 * T;

/** What glows on the back wall: the torches' flames, the lava fountain and (faintly) the water one. */
function farLights(): LightSpot[] {
  const torches = TORCHES.map(([x, y]): LightSpot => ({ x: x + 1, y, w: 3, h: 4, kind: 'torch', color: '#FFA445', radius: 13, power: 1.15, flicker: true }));
  const stream = (x: number, color: string, power: number): LightSpot[] => [
    { x: x + 6, y: WALL_Y + 8, w: 4, h: FLOOR_Y - WALL_Y - 12, kind: 'fire', color, radius: 6, power: power * 0.7 },
    { x: x + 2, y: FLOOR_Y - 4, w: 12, h: 4, kind: 'fire', color, radius: 9, power },
  ];
  return [...torches, ...stream(LAVA_X, '#FF6A2A', 1), ...stream(WATER_X, '#4AB0FF', 0.45)];
}

function farLayer(): PixelBuf {
  const b = blank(TILE_W, FLOOR_Y);
  BRICKS.forEach(([shift, flip], i) => {
    for (let y = FLOOR_Y - T + shift; y > -T; y -= T) put(b, tile('wall_mid'), i * T, y, flip);
  });
  // Darkness above the wall, then the lip along its top.
  put(b, solid(TILE_W, LIP_Y, VOID), 0, 0);
  for (let x = 0; x < TILE_W; x += T) put(b, tile('wall_top_mid'), x, LIP_Y - 12);
  for (const [name, bay, y, flip] of INSETS) put(b, tile(name), bay * T, y, flip);
  // Fountains: the top tile's lip lines up with the wall's, the basin sits on the floor line
  // (the face and basin take 16 of the rows under the lip; the stream falls the other 24).
  const courses = (FLOOR_Y - WALL_Y - 16) / 4;
  put(b, fountain('blue', 2, courses), WATER_X, LIP_Y - 12);
  put(b, fountain('red', 3, courses), LAVA_X, LIP_Y - 12);
  const torch = fromRows(TORCH);
  for (const [x, y] of TORCHES) put(b, torch, x, y);
  stand(b, door(), 10 * T - 4, FLOOR_Y - 1);
  // Engaged columns, 60 rows tall: capital above the lip from row 0, foot on the floor line.
  const col = column(5, 4);
  stand(b, col, 0, FLOOR_Y - 1);
  stand(b, col, 8 * T, FLOOR_Y - 1);
  // Cobwebs (from the icon pack) strung in two corners where a column meets the wall's lip.
  const web = dusty(frameBuf(PROPS.spiderWeb, 0));
  put(b, web, T - 3, WALL_Y - 2);
  put(b, web, 8 * T + T - 3, WALL_Y - 2, true);
  return b;
}

// ------------------------------------------------------------------ mid: props against the wall

function midLayer(): PixelBuf {
  const h = FLOOR_Y - MID_Y;
  const b = blank(TILE_W, h);
  const base = h - 1;
  const crate = rowsOf('crate', 3, 23);
  const chest = rowsOf('chest_full_open_anim_f0', 2, 16);
  const skull = rowsOf('skull', 7, 13);
  // A crate (it frames the left edge of the opening shot).
  stand(b, crate, 0, base);
  // A chest with a skull beside it.
  stand(b, chest, 88, base);
  stand(b, skull, 101, base);
  // A few more skulls (the icon pack's, at a quarter size) left lying about.
  const bone = downsample2(frameBuf(PROPS.skull, 0));
  stand(b, bone, 120, base);
  stand(b, bone, 214, base, true);
  // Crates stacked by the wall.
  stand(b, crate, 176, base);
  stand(b, crate, 176, base - crate.h, true);
  stand(b, crate, 191, base, true);
  return b;
}

// ------------------------------------------------------------------ ground: the floor

/** Floor slab per bay: [floor_N, mirrored]. Mostly whole slabs, a few cracked ones. */
const FLOORS: readonly (readonly [number, boolean])[] = [
  [1, false], [1, true], [2, false], [1, false], [5, true], [1, true], [3, false], [1, false],
  [1, true], [8, false], [1, false], [6, true], [1, true], [4, false], [1, false], [7, true],
];

function groundLayer(): PixelBuf {
  const b = blank(TILE_W, GROUND_H);
  // Two rows of slabs (the second offset by half a slab and cut off by the bottom of the view).
  FLOORS.forEach(([f, flip], i) => put(b, tile(`floor_${f}`), i * T, 0, flip));
  FLOORS.forEach(([, flip], i) => put(b, tile(`floor_${FLOORS[(i + 5) % FLOORS.length][0]}`), i * T + T / 2, T, !flip));
  return b;
}

// ------------------------------------------------------------------ fg: the near wall's lip

function fgLayer(): PixelBuf {
  const b = blank(TILE_W, FG_H);
  for (let x = 0; x < TILE_W; x += T) put(b, rowsOf('wall_top_mid', 16 - FG_H, 16), x, 0, (x / T) % 2 === 1);
  return b;
}

// ------------------------------------------------------------------ the set

export const DUNGEON: ScenerySet = {
  tileW: TILE_W,
  layers: {
    far: { y: 0, h: FLOOR_Y },
    mid: { y: MID_Y, h: FLOOR_Y - MID_Y },
    ground: { y: FLOOR_Y, h: GROUND_H },
    fg: { y: VIEW.h - FG_H, h: FG_H },
  },
  scroll0: { far: 240, mid: 254, ground: 0, fg: 0 },
  sky: false,
  graded: false,
  far: farLayer,
  mid: midLayer,
  ground: groundLayer,
  fg: fgLayer,
  lights: () => ({ far: farLights() }),
};

/** The four layers at full width, for tools/pixelSheet.ts. */
export function sheet(): SheetEntry[] {
  return [
    { name: 'far', buf: DUNGEON.far() },
    { name: 'mid', buf: DUNGEON.mid() },
    { name: 'ground', buf: DUNGEON.ground() },
    { name: 'fg', buf: DUNGEON.fg() },
  ];
}
