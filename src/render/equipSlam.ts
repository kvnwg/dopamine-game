/**
 * The equip slam. When the raccoon puts on gear, the item leaps out of wherever it was on screen (its
 * bag tile, the last-roll card, the item popup, or from under your finger), grows big over the battle,
 * hangs there a beat, then dives and slams onto him, and the piece he now wears glimmers so you can see
 * what changed. The rarer the item, the bigger the moment: more particles, rings, a light pillar, a
 * hit-stop, confetti and its rarity stamped over him. Several items at once (Equip best) go one after
 * another.
 *
 * Who does what: EquipFlight (src/ui/components/EquipFlight.tsx) flies the item across the stage (in
 * the DOM, so it can start in the bag), keeps the clock and plays the sounds; BattleScene draws the
 * pillar for the dive, the impact and the glimmer when the flight calls slamBridge, and keeps
 * slamAnchor on the raccoon so the flight knows where to land.
 */
import type { Item } from '../core';
import type { Slot } from '../data';
import { P } from './pixel';

export const SLAM = {
  /** Between one item's flight and the next (ms). */
  stagger: 260,
  /** It pops out of its tile: up a pixel, flashing white. */
  lift: 150,
  /** It grows, in two steps (its Scale2x art, then Scale3x): the same pixels, just more of them. */
  grow: 150,
  /** It flies up over the raccoon. */
  rise: 300,
  /** It hangs there a beat, glowing; rarer gear hangs longer (hangPerTier per rarity tier). */
  hang: 130,
  hangPerTier: 20,
  /** It dives onto him. */
  dive: 170,
} as const;

/** When each part of an item's slam starts (ms after the equip), and when it hits. */
export interface SlamPlan {
  lift: number;
  grow: number;
  rise: number;
  hang: number;
  dive: number;
  impact: number;
}

/**
 * The timeline for the `index`-th item equipped at once, of rarity tier `tier`. With reduced motion
 * there is no flight: it simply lands a moment later.
 */
export function slamPlan(index: number, tier: number, calm = false): SlamPlan {
  const lift = index * (calm ? 120 : SLAM.stagger);
  if (calm) return { lift, grow: lift, rise: lift, hang: lift, dive: lift, impact: lift + 80 };
  const grow = lift + SLAM.lift;
  const rise = grow + SLAM.grow;
  const hang = rise + SLAM.rise;
  const dive = hang + SLAM.hang + SLAM.hangPerTier * tier;
  return { lift, grow, rise, hang, dive, impact: dive + SLAM.dive };
}

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

/**
 * Where the raccoon stands, in stage px (the battle view is the stage's top 960 px, drawn 1:1): the
 * middle of his body and his feet row. BattleScene keeps it current every frame.
 */
export const slamAnchor = { x: 330, feetY: 822 };

/** Where `slot`'s gear lands on him (stage px). */
export function slamPoint(slot: Slot): { x: number; y: number } {
  return { x: slamAnchor.x, y: slamAnchor.feetY - (SLAM_HEIGHT[slot] ?? 8) * P };
}

/** The battle's side of the slam: BattleScene fills these in while it runs. */
export const slamBridge: {
  /** The item starts its dive (`ms` long): rare gear rides down a pillar of light. */
  dive?: (item: Item, tier: number, ms: number) => void;
  /** It hits: the impact, then the worn piece glimmers. */
  impact?: (item: Item, tier: number) => void;
} = {};
