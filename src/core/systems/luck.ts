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

/** Rolls a rarity: tiers are tried from rarest down; anything below `minRarity` is never rolled. */
export function rollRarity(luck: number, rng: Rng, minRarity: Rarity = 'junk'): Rarity {
  for (let i = RARITIES.length - 1; i >= 1; i--) {
    const r = RARITIES[i];
    if (!rarityAtLeast(r, minRarity)) break;
    if (rng.chance(Math.min(1, luck / RARITY_ODDS[r]))) return r;
  }
  return minRarity;
}
