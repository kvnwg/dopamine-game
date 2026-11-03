/**
 * What a battle backdrop provides. The battle view is VIEW art pixels (1080 x 820 screen pixels at
 * 12 per art pixel); every set is four horizontally tiling layers, back to front.
 */
import type { PixelBuf } from './buf';

/** The battle view in art pixels (1080 x 820 screen pixels at P = 10). */
export const VIEW = { w: 108, h: 82 } as const;
/**
 * The view row fighters stand on: the bottom edge of this row is the ground line (680 screen px).
 * It leaves the bottom 14 rows for HP bars, the wave track and the foreground.
 */
export const FEET_ROW = 67;

export interface LayerSpot {
  /** Top edge in view rows. */
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
}
