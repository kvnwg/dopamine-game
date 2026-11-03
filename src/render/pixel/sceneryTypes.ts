/**
 * What a battle backdrop provides. The battle view is VIEW art pixels (1080 x 820 screen pixels at
 * 12 per art pixel); every set is four horizontally tiling layers, back to front.
 */
import type { PixelBuf } from './buf';

/** The battle view in art pixels. */
export const VIEW = { w: 90, h: 68 } as const;
/** The view row fighters stand on: the bottom edge of this row is the ground line. */
export const FEET_ROW = 58;

export interface LayerSpot {
  /** Top edge in view rows. */
  y: number;
  /** Height in art pixels (the layer's buffer height). */
  h: number;
}

export type LayerName = 'far' | 'mid' | 'ground' | 'fg';

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
}
