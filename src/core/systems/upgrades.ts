/** The gold-bought upgrade grid (luck, gold gain, roll speed, bag space, ...). Resets on rebirth. */
import { BAL } from '../../data';
import type { GameState } from '../state';
import type { CoreEvent } from '../types';

export type UpgradeDef = (typeof BAL.upgrades)[number];

export function upgradeDef(id: string): UpgradeDef | undefined {
  return BAL.upgrades.find((u) => u.id === id);
}

export function upgradeLevel(state: Pick<GameState, 'upgrades'>, id: string): number {
  return state.upgrades[id] ?? 0;
}

/** Cost of buying the next level when at `level`: base x growth^level. */
export function upgradeCostAt(def: UpgradeDef, level: number): number {
  return Math.round(def.cost.base * Math.pow(def.cost.growth, level));
}

export interface UpgradeEffects {
  luck: number;
  goldPct: number;
  rollSpeed: number;
  capacity: number;
  luckyEvery: number;
  enchantChance: number;
  atkPct: number;
  hpPct: number;
  bagFind: number;
}

export function upgradeEffects(state: Pick<GameState, 'upgrades'>): UpgradeEffects {
  const out: UpgradeEffects = { luck: 0, goldPct: 0, rollSpeed: 0, capacity: 0, luckyEvery: 0, enchantChance: 0, atkPct: 0, hpPct: 0, bagFind: 0 };
  for (const def of BAL.upgrades) out[def.effect] += def.perLevel * upgradeLevel(state, def.id);
  return out;
}

export function buyUpgrade(d: GameState, id: string, ev: CoreEvent[]): boolean {
  const def = upgradeDef(id);
  if (!def) return false;
  const level = upgradeLevel(d, id);
  if (level >= def.max) return false;
  const cost = upgradeCostAt(def, level);
  if (d.currencies.coins < cost) return false;
  d.currencies.coins -= cost;
  d.upgrades[id] = level + 1;
  ev.push({ type: 'upgradeBought', id, level: level + 1 });
  return true;
}
