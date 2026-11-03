/**
 * What a battle backdrop provides. The battle view is VIEW art pixels (1080 x 963 screen pixels at
 * P = 9 per art pixel); every set is four horizontally tiling layers, back to front.
 *
 * Every scenery set is authored in one scene frame: SCENE_H rows with the fighters' feet on row
 * SCENE_FEET_ROW. The battle places that frame at view row SCENE_Y, so the rows above it are extra sky
 * (sets with a sky) or extra wall (the dungeon draws its far layer up into them). Layer spots
 * (LayerSpot.y) and light spots are in scene rows; add SCENE_Y for view rows.
 */
import type { PixelBuf } from './buf';

/** The battle view in art pixels (1080 x 963 screen pixels at P = 9). */
export const VIEW = { w: 120, h: 107 } as const;
/** Rows in the scene frame every scenery set is drawn for. */
export const SCENE_H = 82;
/** The scene row fighters stand on (the bottom edge of this row is the ground line). */
export const SCENE_FEET_ROW = 67;
/** The view row of the scene frame's top row: the 25 rows above it are new sky (or ceiling). */
export const SCENE_Y = VIEW.h - SCENE_H;
/**
 * The view row fighters stand on: the bottom edge of this row is the ground line (837 screen px).
 * It leaves the bottom 14 rows for HP bars, the wave track and the foreground.
 */
export const FEET_ROW = SCENE_FEET_ROW + SCENE_Y;
/**
 * Art pixels the full-view pictures (sky, layers, vignette, flashes) reach past each edge of the view,
 * so a screen shake (whole art pixels, at most this far) never shows an edge.
 */
export const VIEW_MARGIN = 2;

export interface LayerSpot {
  /** Top edge in scene rows (view row SCENE_Y + y; negative for art that reaches above the scene). */
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
