/**
 * Luck: rarities are "1 in X" chances (RNG-game style). A roll checks tiers from rarest to
 * commonest; each succeeds with probability min(1, luck / X). Luck comes from upgrades, the
 * Dumpster Level, Lucky enchantments, rebirths, luck boosts, and every Nth "lucky roll".
 */
import { BAL, RARITIES, type Rarity } from '../../data';
import type { Rng } from '../rng';
import type { GameState } from '../state';
import { rarityAtLeast } from '../util';
import { combatEffects } from './enchants';
import { upgradeEffects } from './upgrades';

export const RARITY_ODDS: Record<Rarity, number> = { junk: 1, ...BAL.rarityOdds };

export interface LuckBreakdown {
  upgrades: number;
  dumpster: number;
  enchants: number;
  rebirthMult: number;
  boostMult: number;
  boostEndsAt: number | null;
  total: number;
}

export function luckBreakdown(state: GameState, now: number): LuckBreakdown {
  const upgrades = upgradeEffects(state).luck;
  const dumpster = (state.dumpster.level - 1) * BAL.dumpster.luckPerLevel;
  const enchants = combatEffects(state).luck;
  const rebirthMult = 1 + state.rebirths * BAL.rebirth.luckPer;
  const boosting = state.luckBoostEndsAt !== null && now < state.luckBoostEndsAt;
  const boostMult = boosting ? BAL.luck.potion.mult : 1;
  const total = (1 + upgrades + dumpster + enchants) * rebirthMult * boostMult;
  return { upgrades, dumpster, enchants, rebirthMult, boostMult, boostEndsAt: boosting ? state.luckBoostEndsAt : null, total };
}

export function currentLuck(state: GameState, now: number): number {
  return luckBreakdown(state, now).total;
}

/** Every Nth roll is a lucky roll with boosted luck. */
export function luckyEvery(state: GameState): number {
  return Math.max(BAL.roll.luckyRollMinEvery, BAL.roll.luckyRollEvery - upgradeEffects(state).luckyEvery);
}

/** Exact probability of each rarity at a given luck. */
export function rarityChances(luck: number, minRarity: Rarity = 'junk'): Record<Rarity, number> {
  const out = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
  let remaining = 1;
  for (let i = RARITIES.length - 1; i >= 1; i--) {
    const r = RARITIES[i];
    if (!rarityAtLeast(r, minRarity)) break;
    const p = Math.min(1, luck / RARITY_ODDS[r]);
    out[r] = remaining * p;
    remaining *= 1 - p;
  }
  out[minRarity] += remaining;
  return out;
}

/**
 * "1 in X" for an item: the chance, at base luck, of rolling its rarity together with its
 * enchantments (their count and tiers, at the base enchant chance). Shown on every item.
 */
export function itemOddsOneIn(item: { rarity: Rarity; enchants: Array<{ tier: number }> }): number {
  return Math.max(1, Math.round(1 / (rarityChances(1)[item.rarity] * enchantOdds(item.enchants))));
}

/** The chance of rolling exactly these enchantments (their count and tiers) at the base enchant chance. */
function enchantOdds(enchants: Array<{ tier: number }>): number {
  const n = enchants.length;
  if (n === 0) return 1;
  const e = BAL.enchant;
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  let p = e.baseChance * (e.countWeights[Math.min(n, e.countWeights.length) - 1] / sum(e.countWeights));
  for (const en of enchants) p *= e.tierWeights[en.tier - 1] / sum(e.tierWeights);
  return p;
}

/**
 * How rare a roll is for the raccoon that rolled it: "1 in X" for its tier or better at `luck`
 * (enchantments at their base odds, as in itemOddsOneIn). A Legendary is a 1 in 1,000 event at
 * luck 1 but only 1 in 100 at luck 10, so the big reveal follows what is rare for you right now.
 */
export function luckOddsOneIn(item: { rarity: Rarity; enchants: Array<{ tier: number }> }, luck: number): number {
  const c = rarityChances(Math.max(1, luck));
  let p = 0;
  for (const r of RARITIES) if (rarityAtLeast(r, item.rarity)) p += c[r];
  return Math.max(1, Math.round(1 / (p * enchantOdds(item.enchants))));
}

export type RollDrama = 'big' | 'huge' | 'insane';

/**
 * The full-screen reveal, and how big: a find gets it when its rarity is uncommon for your luck (its
 * tier-or-better odds at your luck, enchantments aside, at least 1 in feel.bigRoll.tierOneIn) and its
 * card's "1 in X" (enchantments included) is at least feel.bigRoll.big x your luck (10x and 100x that
 * make it huge and insane). Enchantments can't turn a common find into a reveal, and it comes about as
 * often at any luck (once in roughly 900 to 1,600 rolls).
 */
export function revealDrama(item: { rarity: Rarity; enchants: Array<{ tier: number }> }, luck: number): RollDrama | null {
  const l = Math.max(1, luck);
  if (luckOddsOneIn({ rarity: item.rarity, enchants: [] }, l) < BAL.feel.bigRoll.tierOneIn) return null;
  return rollDrama(itemOddsOneIn(item) / l);
}

/** The least a find needs for the full-screen reveal at this luck: its rarity, and its card's "1 in X". */
export function revealBar(luck: number): { rarity: Rarity; oneIn: number } {
  const l = Math.max(1, luck);
  const rarity = RARITIES.find((r) => luckOddsOneIn({ rarity: r, enchants: [] }, l) >= BAL.feel.bigRoll.tierOneIn) ?? RARITIES[RARITIES.length - 1];
  return { rarity, oneIn: Math.round(BAL.feel.bigRoll.big * l) };
}

/** How big a deal odds of 1 in `luckOdds` (for the raccoon's luck) are (feel.bigRoll); null for everyday ones. */
export function rollDrama(luckOdds: number): RollDrama | null {
  const b = BAL.feel.bigRoll;
  if (luckOdds >= b.insane) return 'insane';
  if (luckOdds >= b.huge) return 'huge';
  if (luckOdds >= b.big) return 'big';
  return null;
}

/** Rolls a rarity: tiers are tried from rarest down; anything below `minRarity` is never rolled. */
export function rollRarity(luck: number, rng: Rng, minRarity: Rarity = 'junk'): Rarity {
  for (let i = RARITIES.length - 1; i >= 1; i--) {
    const r = RARITIES[i];
    if (!rarityAtLeast(r, minRarity)) break;
    if (rng.chance(Math.min(1, luck / RARITY_ODDS[r]))) return r;
  }
  return minRarity;
}
