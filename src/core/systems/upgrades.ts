/**
 * The upgrade tree, bought with gold (Roblox style): one root (Luck) branching into Spins,
 * Enchants, Money and Combat. A node unlocks when its parent reaches the required level.
 * Costs grow exponentially per level; every rebirth resets the tree and makes it cheaper.
 */
import { BAL } from '../../data';
import type { GameState } from '../state';
import type { CoreEvent } from '../types';

export type UpgradeDef = (typeof BAL.upgrades)[number];
export type UpgradeEffect = UpgradeDef['effect'];

export function upgradeDef(id: string): UpgradeDef | undefined {
  return BAL.upgrades.find((u) => u.id === id);
}

export function upgradeLevel(state: Pick<GameState, 'upgrades'>, id: string): number {
  return state.upgrades[id] ?? 0;
}

/** True once the node's parent has reached the required level (roots are always unlocked). */
export function upgradeUnlocked(state: Pick<GameState, 'upgrades'>, def: UpgradeDef): boolean {
  return !def.requires || upgradeLevel(state, def.requires.id) >= def.requires.level;
}

/** Cost of the next level when at `level`: base x growth^level, discounted by rebirths. */
export function upgradeCostAt(def: UpgradeDef, level: number, rebirths = 0): number {
  const discount = Math.pow(1 - BAL.rebirth.upgradeDiscountPer, rebirths);
  return Math.max(1, Math.round(def.cost.base * Math.pow(def.cost.growth, level) * discount));
}

/** The price of the next level of `def` for this player. */
export function upgradePrice(state: Pick<GameState, 'upgrades' | 'rebirths'>, def: UpgradeDef): number {
  return upgradeCostAt(def, upgradeLevel(state, def.id), state.rebirths);
}

export type UpgradeEffects = Record<UpgradeEffect, number>;

const EFFECTS: UpgradeEffect[] = [
  'luck', 'goldPct', 'rollSpeed', 'capacity', 'luckyEvery', 'enchantChance', 'atkPct', 'hpPct', 'bagFind',
  'turboPower', 'luckyMult', 'goldenSpin', 'enchantTier', 'pity', 'scrapPct', 'xpPct', 'potionTime', 'offlinePct',
  'lifesteal', 'critChance', 'critDmg', 'bossDmg',
];

export function upgradeEffects(state: Pick<GameState, 'upgrades'>): UpgradeEffects {
  const out = Object.fromEntries(EFFECTS.map((e) => [e, 0])) as UpgradeEffects;
  for (const def of BAL.upgrades) out[def.effect] += def.perLevel * upgradeLevel(state, def.id);
  return out;
}

/** Upgrades the player could buy right now (unlocked, not maxed, affordable). */
export function affordableUpgrades(state: Pick<GameState, 'upgrades' | 'rebirths' | 'currencies'>): UpgradeDef[] {
  return BAL.upgrades.filter(
    (def) =>
      upgradeUnlocked(state, def) && upgradeLevel(state, def.id) < def.max && state.currencies.coins >= upgradePrice(state, def),
  );
}

export function buyUpgrade(d: GameState, id: string, ev: CoreEvent[]): boolean {
  const def = upgradeDef(id);
  if (!def || !upgradeUnlocked(d, def)) return false;
  const level = upgradeLevel(d, id);
  if (level >= def.max) return false;
  const cost = upgradePrice(d, def);
  if (d.currencies.coins < cost) return false;
  d.currencies.coins -= cost;
  d.upgrades[id] = level + 1;
  ev.push({ type: 'upgradeBought', id, level: level + 1 });
  return true;
}
