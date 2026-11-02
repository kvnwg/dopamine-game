/**
 * Cel-shaded placeholder art for Dumpster Legend: clean vector cartoon, flat fills with one hard
 * shadow tone and a small soft highlight, uniform dark outlines. Pure Canvas 2D, deterministic.
 *
 * Hero layering (back to front): backpack, body, sneakers, jacket, bling, shield, gloves, ring,
 * mask, hat, weapon (rotated about its grip at RACCOON_FRAME.hand), front paw (centered on hand).
 */
export type { Pt } from './core';
export type { Rarity, Slot } from './palette';
export type { EnemyShape } from './enemies';

export { OUTLINE, CEL_PALETTE } from './palette';
export { RACCOON_FRAME, raccoonBody, raccoonPaw } from './raccoon';
export { weaponSprite, gearOverlay, gearIcon, emptySlotIcon } from './gear';
export { enemySprite } from './enemies';
export { sky, cloudSprite, farLayer, midLayer, groundLayer, fgLayer } from './scenery';
export { slashArc, impactStar, puff, sparkle, coinSprite, bagSprite, confetti, dumpsterBody, dumpsterLid } from './fx';
