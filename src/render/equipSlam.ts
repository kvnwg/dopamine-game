/**
 * The equip slam: when the raccoon puts on gear, the item drops out of the sky and slams onto him.
 * The rarer the item, the bigger the moment: more particles, rings, a light pillar, a hit-stop,
 * confetti and its rarity stamped over him. BattleScene draws it; the sound controller plays its
 * sounds on the same schedule (several items at once, as with Equip best, slam one after another).
 */
import type { Slot } from '../data';

export const SLAM = {
  /** Between one item's slam and the next (ms). */
  stagger: 220,
  /** How long an item falls before it hits (ms). */
  drop: 260,
} as const;

/** Where each slot's gear lands on him: art px above his feet. */
export const SLAM_HEIGHT: Readonly<Record<Slot, number>> = {
  hat: 14, mask: 10, jacket: 6, gloves: 5, weapon: 6, shield: 6, sneakers: 1, backpack: 8, bling: 7, ring: 5,
};

/** Tiers (rarity index, 0 = Junk ... 12 = Holy Grail) where each extra shows up. */
export const SLAM_FROM = {
  ring: 2, // Shiny: a shock ring
  sparkle: 3, // Epic: the sparkle effect and a cheer
  pillar: 4, // Legendary: a pillar of light, hit-stop, its rarity stamped
  confetti: 5, // Mythic: confetti and a second ring
  flash: 7, // Limited and up: a white flash over the view
} as const;
