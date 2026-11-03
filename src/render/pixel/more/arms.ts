/**
 * More item icons (arms group), drawn to the same rules as src/render/pixel/items.ts (16x16, one ink
 * outline, three tones per material lit from the top left, natural colors; the slot conventions in
 * that file's header). Merged into ITEM_SPRITES there.
 */
import type { Rows } from '../buf';

export const SPRITES: Record<string, Rows> = {};

/** Where the paw holds each of these weapons (see WEAPON_GRIP in items.ts). */
export const GRIPS: Record<string, { x: number; y: number }> = {};

/** Weapons not drawn on the 45 degree diagonal (see WEAPON_ART_TILT in items.ts). */
export const TILTS: Record<string, number> = {};
