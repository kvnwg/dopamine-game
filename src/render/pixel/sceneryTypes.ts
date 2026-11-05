/**
 * What a battle backdrop provides. The battle view is VIEW art pixels (1080 x 960 screen pixels at
 * P = 6 per art pixel); every set is four horizontally tiling layers, back to front.
 *
 * Scene frames. Each scenery set is drawn for its own scene frame (ScenerySet.frame): `h` rows with the
 * fighters' feet on row `feetRow`. The battle lines every set's feet row up with one view row, FEET_ROW
 * (137, the ground line at y 828), so a set's frame top is at view row FEET_ROW - feetRow (frameTop).
 * Layer spots (LayerSpot.y), light spots, prop spots and the rows in a scenery module are rows of the
 * set's own frame: frameTop(set) + row is the view row (worldLook.ts: layerRow).
 *  - SCENE_FRAME (123 rows, feet on row 100) is the frame for sets drawn at the 6 px grid's resolution,
 *    1.5 times the legacy rows: its top is view row 37 and its last row is the view's last row.
 *  - LEGACY_FRAME (82 rows, feet on row 67) is the frame the first sets were drawn for at 9 px, and the
 *    default. Its top is view row 70: the view shows extra sky above it (or a set without a sky draws
 *    its far layer up into those rows), and the battle fills the 8 rows under it (worldLook.ts: a
 *    layer that reaches the frame's bottom is carried down to the view's bottom edge).
 * A world's atmosphere (worlds.json look.atmo) is written in legacy frame rows; worldLook.ts viewAtmo
 * maps it into each set's frame (scaled by frameScale), so the sky lines up with the art.
 */
import type { PixelBuf } from './buf';

/** The battle view in art pixels (1080 x 960 screen pixels at P = 6). */
export const VIEW = { w: 180, h: 160 } as const;

/** A scenery set's scene frame: `h` rows, the fighters' feet on row `feetRow` (the bottom edge of that row is the ground line). */
export interface SceneFrame {
  readonly h: number;
  readonly feetRow: number;
}

/** The frame the first sets were drawn for (at 9 px): 82 rows, feet on row 67. The default. */
export const LEGACY_FRAME: SceneFrame = { h: 82, feetRow: 67 };

/** The frame for sets drawn at the 6 px grid's resolution (1.5 times the legacy rows): 123 rows, feet on row 100. */
export const SCENE_FRAME: SceneFrame = { h: 123, feetRow: 100 };

/**
 * The view row fighters stand on, whatever the set: its bottom edge is the ground line (y 828). Every
 * set's feetRow is placed on it. Under it are the HP bars' rows, the wave track and the foreground.
 */
export const FEET_ROW = 137;

/** A set's scene frame (the legacy frame when it declares none). */
export function sceneFrame(set: { readonly frame?: SceneFrame }): SceneFrame {
  return set.frame ?? LEGACY_FRAME;
}

/** The view row of a set's frame top (37 for SCENE_FRAME, 70 for the legacy frame). */
export function frameTop(set: { readonly frame?: SceneFrame }): number {
  return FEET_ROW - sceneFrame(set).feetRow;
}

/** How many times finer than the legacy frame a set is drawn (1.5 for SCENE_FRAME, 1 for legacy sets). */
export function frameScale(set: { readonly frame?: SceneFrame }): number {
  return sceneFrame(set).h / LEGACY_FRAME.h;
}

/**
 * Legacy names for the 82-row frame, kept for the sets still drawn in it: its height, its feet row and
 * its top in the view. A set in another frame uses sceneFrame(set) and frameTop(set).
 */
export const SCENE_H = LEGACY_FRAME.h;
export const SCENE_FEET_ROW = LEGACY_FRAME.feetRow;
export const SCENE_Y = FEET_ROW - SCENE_FEET_ROW;

/**
 * Art pixels the full-view pictures (sky, layers, vignette, flashes) reach past each edge of the view,
 * so a screen shake (whole art pixels, at most this far) never shows an edge.
 */
export const VIEW_MARGIN = 3;

export interface LayerSpot {
  /** Top edge in the set's frame rows (view row frameTop(set) + y; negative for art that reaches above the frame). */
  y: number;
  /** Height in art pixels (the layer's buffer height). */
  h: number;
}

export type LayerName = 'far' | 'mid' | 'ground' | 'fg';

/**
 * Something in a layer that gives off light at dusk and night (src/render/pixel/atmosphere.ts):
 * its emissive pixels (a rect, in layer pixels) and how its glow spreads.
 */
export interface LightSpot {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Windows are lit by chance (a share per world), lamps when a world turns them on, the rest always. */
  kind: 'window' | 'lamp' | 'torch' | 'fire' | 'water';
  /** Per pixel of the rect: 'g' lit glass, 'f' frame or muntin (dark against the light), 'u' curtain, '.' untouched. */
  mask?: readonly string[];
  /** A pool of light on the ground under it (ellipse center and radii, layer pixels). */
  pool?: { x: number; y: number; rx: number; ry: number };
  /** Light color (default: the world's window light). */
  color?: string;
  /** Glow radius in art pixels and strength (defaults by kind). */
  radius?: number;
  power?: number;
  /** Animated: the battle scene adds a flickering glow on top (torches). */
  flicker?: boolean;
}

export interface ScenerySet {
  /**
   * The scene frame its rows are drawn in (default LEGACY_FRAME). Sets drawn for the 6 px grid declare
   * SCENE_FRAME ({ h: 123, feetRow: 100 }).
   */
  frame?: SceneFrame;
  /** Width of every layer; they repeat horizontally without a seam. */
  tileW: number;
  layers: Readonly<Record<LayerName, LayerSpot>>;
  /** Scroll offset (art pixels) each layer starts at, so the opening shot frames nicely. */
  scroll0: Readonly<Record<LayerName, number>>;
  /** False when the far layer covers the whole background (no sky, no clouds). */
  sky: boolean;
  /** Whether a world's color grading applies (the dungeon keeps its own colors). */
  graded: boolean;
  far(): PixelBuf;
  mid(): PixelBuf;
  ground(): PixelBuf;
  fg(): PixelBuf;
  /** Light spots per layer (in that layer's pixels). */
  lights(): Readonly<Partial<Record<LayerName, readonly LightSpot[]>>>;
  /**
   * Where a world's themed props stand in the mid layer, best spot first: the row their feet stand on
   * and each prop's left edge, all in mid-layer pixels. Without it, props look for plain grass.
   */
  propSpots?: { readonly row: number; readonly x: readonly number[] };
}
