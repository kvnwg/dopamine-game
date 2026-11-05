/**
 * The Roll tab's sense of occasion, shared by the reels (Reel.tsx) and the roll sounds
 * (rollController.ts): which spin builds up to its result, how, and how big each result lands.
 *
 * Build-up (a "tease"): the reel with the spin's rarest result (the last to stop when that is Epic or
 * better, reelTiming.ts) slows into a crawl while the machine glows. The glow starts at a lower tier's
 * color and flickers up tier by tier (Shiny blue, Epic purple, Legendary gold...), reaching the real
 * tier as the reel stops, so a glow never shows its ceiling and every glow carries some hope. A result
 * that is rare for the raccoon's luck always builds up (the rarer, the longer the crawl and the harder
 * the machine shakes); an uncommon one sometimes gets a small glow that climbs only to its own tier.
 * A glow never climbs past the real result. Junk never glows.
 */
import { RARITIES, type Rarity } from '../data';
import { luckOddsOneIn, rarityIndex, type Item, type RollDrama } from '../core';
import { hash } from './reelStrip';
import { reelStops, stopOrder, tokenHoldMs, type SpinTiming } from './reelTiming';

/** Each tier's light on the reels (the reel cells' --rc colors, reel.module.css). */
export const TIER_LIGHT: Record<Rarity, string> = {
  junk: '#b4b4b4', decent: '#5ad35f', shiny: '#42a8ff', epic: '#c25af0', legendary: '#ffc21a', mythic: '#ff4fa3', vintage: '#d2884a',
  limited: '#ff3b4e', prototype: '#38e8ff', mint: '#fff4d6', gemMint: '#4dffb4', museum: '#e9ddff', grail: '#fff07a',
  cosmic: '#9c84ff', glitched: '#00ffa3', fourthWall: '#ff6ad5', devsOwn: '#33d1ff', patchNotes: '#ffa726', sourceCode: '#39ff14', concept: '#ffffff',
};

export function tierLight(tier: number): string {
  return TIER_LIGHT[RARITIES[Math.max(0, Math.min(RARITIES.length - 1, tier))]];
}

/** 0: a small glow for an uncommon result; 1, 2, 3: rare, very rare, and rare enough for the full-screen reveal. */
export type TeaseLevel = 0 | 1 | 2 | 3;

export interface Tease {
  reel: number;
  /** When the glow starts and when the reel stops on its result (ms after the spin starts). */
  from: number;
  land: number;
  /** The glow's tiers (rarity indexes), lowest first; the last is the result's own. */
  tiers: number[];
  /** When each tier takes over (ms): the first at `from`, the last at `land`. */
  times: number[];
  level: TeaseLevel;
  /** How much the reel's last approach slows (0 to 1, reelStrip.ts). */
  slow: number;
}

type TeaseSpin = SpinTiming & {
  /** `drama`: the full-screen reveal the core gave the find (luck.ts judgeFinds). */
  reels: ReadonlyArray<{ item: Pick<Item, 'uid' | 'rarity' | 'enchants'>; mults?: readonly number[]; drama?: RollDrama | null }>;
  /** A tutorial spin (the first roll, beginner's luck): its first reel gets the full build-up. */
  scripted?: 'first' | 'beginner' | null;
  /** The spin's build-up the core judged (judgeFinds): 1 rare for you lately, 2 rarer still. */
  tease?: number;
};

const DRAMA_RANK: Record<RollDrama, number> = { big: 1, huge: 2, insane: 3, hyper: 4 };
/**
 * Uncommon results (1 in 6 or rarer at your luck) glow a little this often, and plain ones (1 in 2
 * or rarer) now and then: a low glow that stays low, so a glow's first color never tells.
 */
const HOPE_CHANCE = 0.35;
const LOW_HOPE_CHANCE = 0.06;

/**
 * The spin's build-up, or null for a plain spin. `luck` is the raccoon's luck now (currentLuck). The
 * core decides the levels (luck.ts judgeFinds: rare for the raccoon lately, so they come as often
 * early as late): a find getting the full reveal builds up all the way (a tutorial spin's first reel
 * always does), the spin's `tease` gives the smaller ones, and an uncommon find now and then gets a
 * low glow of hope.
 */
export function teasePlan(spin: TeaseSpin, luck: number): Tease | null {
  const order = stopOrder(spin);
  let reel = order[0];
  for (const i of order) if (rarityIndex(spin.reels[i].item.rarity) >= rarityIndex(spin.reels[reel].item.rarity)) reel = i;
  // The find with the biggest reveal, if any (the last to stop among equals).
  let top = 0;
  for (const i of order) {
    const d = spin.reels[i].drama;
    if (d && DRAMA_RANK[d] >= top) {
      top = DRAMA_RANK[d];
      reel = i;
    }
  }
  if (spin.scripted) reel = 0;
  const item = spin.reels[reel].item;
  const tier = rarityIndex(item.rarity);
  if (tier < 1) return null;
  const odds = luckOddsOneIn(item, Math.max(1, luck));
  const u = hash(item.uid * 31 + 7);
  const u2 = hash(item.uid * 53 + 11);
  let level: TeaseLevel;
  if (spin.reels[reel].drama || spin.scripted) level = 3;
  else if ((spin.tease ?? 0) >= 2) level = 2;
  else if ((spin.tease ?? 0) >= 1) level = 1;
  else if (odds >= 6 && u < HOPE_CHANCE) level = 0;
  else if (odds >= 2 && u < LOW_HOPE_CHANCE) level = 0;
  else return null;
  // Where the glow starts: one or two tiers down (never giving away the ceiling); for the rarest,
  // anywhere from Shiny to Legendary, climbing through every tier in between.
  const start = level === 0 ? tier - (u2 < 0.6 ? 1 : 0) : tier <= 4 ? tier - 1 - Math.floor(u2 * 2) : 2 + Math.floor(u2 * 3);
  const lo = Math.max(1, Math.min(tier, start));
  const tiers: number[] = [];
  for (let k = lo; k <= tier; k++) tiers.push(k);
  const stops = reelStops(spin, reel);
  const land = stops[stops.length - 1].at;
  const begin = stops.length > 1 ? Math.min(land, stops[stops.length - 2].at + tokenHoldMs()) : 0;
  const span = land - begin;
  const dur = Math.min(span * [0.42, 0.62, 0.68, 0.72][level], [750, 1500, 1800, 2100][level]);
  const from = land - dur;
  const n = tiers.length;
  const times = tiers.map((_, k) => (k === 0 ? from : k === n - 1 ? land : from + dur * (0.3 + (0.52 * (k - 1)) / Math.max(1, n - 2))));
  return { reel, from, land, tiers, times, level, slow: [0.35, 0.75, 0.9, 1][level] };
}

/** What the glow shows `ms` into the spin: its tier (null before it starts), how strong (1 to 3), and whether it just stepped up. */
export function glowAt(plan: Tease, ms: number): { tier: number | null; strength: number; step: number } {
  if (ms < plan.from) return { tier: null, strength: 0, step: -1 };
  let step = 0;
  while (step + 1 < plan.times.length && ms >= plan.times[step + 1]) step++;
  const k = Math.min(1, (ms - plan.from) / Math.max(1, plan.land - plan.from));
  const strength = plan.level === 0 ? 1 + Math.floor(k * 1.99) : 1 + Math.floor(k * 2.99);
  return { tier: plan.tiers[step], strength, step };
}

/** How long a tier step flickers between the old and the new color (ms). */
export function flickerMs(plan: Tease): number {
  const gaps = plan.times.slice(1).map((t, k) => t - plan.times[k]);
  return Math.max(70, Math.min(170, Math.min(...gaps, 999) * 0.8));
}

/**
 * How big a result lands, by tier (rarity index): every stop thuds and flashes the payline; Shiny and
 * up throw sparks and swooshes; Epic and up get light rays behind the result; Legendary and up stamp
 * their tier over the reel; Mythic and up rain confetti.
 */
export function landFx(tier: number): { sparks: number; rays: boolean; stamp: boolean; confetti: boolean } {
  return {
    sparks: tier >= 4 ? 10 : tier >= 3 ? 8 : tier >= 2 ? 6 : 0,
    rays: tier >= 3,
    stamp: tier >= 4,
    confetti: tier >= 5,
  };
}
