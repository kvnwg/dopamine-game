/** Dumpster: slot and item-level rolls, and the timed Dumpster Level upgrade (each level adds luck). */
import { BAL, SLOTS, type Slot } from '../../data';
import type { Rng } from '../rng';
import type { GameState } from '../state';
import type { CoreEvent } from '../types';
import { dayKey, MS_PER_MINUTE } from '../time';
import { clamp } from '../util';

export function rollSlot(rng: Rng): Slot {
  return rng.weighted(SLOTS.map((s) => [s, BAL.dumpster.slotWeights[s]] as [Slot, number]));
}

/** Item level = clamp(playerLevel + randInt(-2, +1), 1, levelCap) */
export function rollItemLevel(playerLevel: number, rng: Rng): number {
  const o = BAL.items.levelOffset;
  return clamp(playerLevel + rng.int(o.min, o.max), 1, BAL.items.levelCap);
}

/** Coins to upgrade from `level` to `level + 1`: 400 x 1.85^(level - 1). */
export function upgradeCost(level: number): number {
  const c = BAL.dumpster.upgradeCost;
  return Math.round(c.base * Math.pow(c.growth, level - 1));
}

/** Seconds to upgrade from `level`: 60 x 1.65^(level - 1), capped at 24 hours. */
export function upgradeSeconds(level: number): number {
  const t = BAL.dumpster.upgradeTime;
  return Math.min(t.capSeconds, Math.round(t.baseSeconds * Math.pow(t.growth, level - 1)));
}

/** 1 Gem per 2 minutes remaining (minimum 1). */
export function gemSpeedupCost(remainingMs: number): number {
  const g = BAL.dumpster.gemSpeedup;
  if (remainingMs <= 0) return 0;
  return Math.max(g.minGems, Math.ceil(remainingMs / MS_PER_MINUTE / g.minutesPerGem));
}

export function adSpeedupsLeft(state: GameState, now: number): number {
  const used = state.dumpster.adSpeedupDay === dayKey(now) ? state.dumpster.adSpeedupsUsed : 0;
  return Math.max(0, BAL.dumpster.adSpeedup.perDay - used);
}

export function startUpgrade(d: GameState, now: number, ev: CoreEvent[]): boolean {
  const dz = d.dumpster;
  if (dz.upgradeEndsAt !== null || dz.level >= BAL.dumpster.maxLevel) return false;
  const cost = upgradeCost(dz.level);
  if (d.currencies.coins < cost) return false;
  d.currencies.coins -= cost;
  dz.upgradeEndsAt = now + upgradeSeconds(dz.level) * 1000;
  ev.push({ type: 'dumpsterUpgradeStarted', level: dz.level + 1, endsAt: dz.upgradeEndsAt });
  return true;
}

export function checkUpgrade(d: GameState, now: number, ev: CoreEvent[]): void {
  const dz = d.dumpster;
  if (dz.upgradeEndsAt !== null && now >= dz.upgradeEndsAt) {
    dz.upgradeEndsAt = null;
    dz.level = Math.min(BAL.dumpster.maxLevel, dz.level + 1);
    ev.push({ type: 'dumpsterUpgraded', level: dz.level });
  }
}

export function speedupWithGems(d: GameState, now: number, ev: CoreEvent[]): boolean {
  const dz = d.dumpster;
  if (dz.upgradeEndsAt === null) return false;
  const cost = gemSpeedupCost(dz.upgradeEndsAt - now);
  if (d.currencies.gems < cost) return false;
  d.currencies.gems -= cost;
  dz.upgradeEndsAt = now;
  checkUpgrade(d, now, ev);
  return true;
}

export function speedupWithAd(d: GameState, now: number, ev: CoreEvent[]): boolean {
  const dz = d.dumpster;
  if (dz.upgradeEndsAt === null || adSpeedupsLeft(d, now) <= 0) return false;
  const today = dayKey(now);
  if (dz.adSpeedupDay !== today) {
    dz.adSpeedupDay = today;
    dz.adSpeedupsUsed = 0;
  }
  dz.adSpeedupsUsed += 1;
  dz.upgradeEndsAt -= BAL.dumpster.adSpeedup.minutes * MS_PER_MINUTE;
  checkUpgrade(d, now, ev);
  return true;
}

