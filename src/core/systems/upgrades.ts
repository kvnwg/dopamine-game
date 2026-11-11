/**
 * The upgrade map, bought with gold (Roblox style): a honeycomb of hexes growing out of Luck I.
 * Each upgrade line is a chain of tiers (Luck I, Luck II, ...), one hex each, bought in order;
 * a line's first tier opens once the tier it hangs off is owned. Gold "special" lines are a single
 * big hex. Costs grow exponentially per tier; every rebirth wipes the map and makes it cheaper.
 * `upgrades[id]` is the number of tiers owned in line `id`.
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

/** True once the tier this line hangs off is owned (the root line is always open). */
export function upgradeUnlocked(state: Pick<GameState, 'upgrades'>, def: UpgradeDef): boolean {
  return !def.requires || upgradeLevel(state, def.requires.id) >= def.requires.level;
}

/** Cost of the next tier when `level` tiers are owned: base x growth^level, discounted by rebirths. */
export function upgradeCostAt(def: UpgradeDef, level: number, rebirths = 0): number {
  const discount = Math.pow(1 - BAL.rebirth.upgradeDiscountPer, rebirths);
  return Math.max(1, Math.round(def.cost.base * tierGrowth(def.cost.growth, level) * discount));
}

/**
 * How much tier `level + 1` costs over tier 1. A line on the standard curve (growth 100) climbs by the
 * economy's tierGrowth steps (x10 to start, x300 at the top), so its first tiers come quickly and its
 * last are as rare as ever; any other line multiplies by its own growth each tier.
 */
function tierGrowth(growth: number, level: number): number {
  const steps = BAL.economy.tierGrowth;
  if (growth !== 100 || !steps) return Math.pow(growth, level);
  let m = 1;
  for (let k = 0; k < level; k++) m *= steps[Math.min(k, steps.length - 1)];
  return m;
}

/** The price of the next tier of `def` for this player. */
export function upgradePrice(state: Pick<GameState, 'upgrades' | 'rebirths'>, def: UpgradeDef): number {
  return upgradeCostAt(def, upgradeLevel(state, def.id), state.rebirths);
}

export type UpgradeEffects = Record<UpgradeEffect, number>;

const EFFECTS: UpgradeEffect[] = [
  'luck', 'goldPct', 'rollSpeed', 'capacity', 'luckyEvery', 'enchantChance', 'atkPct', 'hpPct', 'bagFind',
  'turboPower', 'luckyMult', 'goldenSpin', 'enchantTier', 'pity', 'scrapPct', 'xpPct', 'potionTime', 'offlinePct',
  'lifesteal', 'critChance', 'critDmg', 'bossDmg', 'reels',
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

/**
 * The cheapest tier open to buy (unlocked, not maxed), affordable or not, with its price: what the
 * Roll tab offers a new player before the Upgrades screen opens (ui FirstBuy). Null once all are owned.
 */
export function cheapestUpgrade(state: Pick<GameState, 'upgrades' | 'rebirths'>): { def: UpgradeDef; price: number } | null {
  let best: { def: UpgradeDef; price: number } | null = null;
  for (const def of BAL.upgrades) {
    if (!upgradeUnlocked(state, def) || upgradeLevel(state, def.id) >= def.max) continue;
    const price = upgradePrice(state, def);
    if (!best || price < best.price) best = { def, price };
  }
  return best;
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

export type UpgradeNodeState = 'owned' | 'open' | 'locked';

/** One hex on the map: owned, open (the next tier, ready to buy), or locked (further out). */
export function upgradeNodeState(state: Pick<GameState, 'upgrades'>, id: string, tier: number): UpgradeNodeState {
  const def = upgradeDef(id);
  if (!def) return 'locked';
  const level = upgradeLevel(state, id);
  if (level >= tier) return 'owned';
  return level === tier - 1 && upgradeUnlocked(state, def) ? 'open' : 'locked';
}

/** Parents before children, so a pass in this order can check each line's requirement. */
const ORDER: UpgradeDef[] = (() => {
  const depth = (def: UpgradeDef): number => (def.requires ? 1 + depth(upgradeDef(def.requires.id)!) : 0);
  return [...BAL.upgrades].sort((a, b) => depth(a) - depth(b));
})();

/** Drops unknown lines, clamps tiers to each line's max, and clears lines whose parent tier isn't owned. */
export function sanitizeUpgrades(d: Pick<GameState, 'upgrades'>): void {
  const out: Record<string, number> = {};
  for (const def of ORDER) {
    const level = Math.min(def.max, Math.max(0, Math.floor(d.upgrades[def.id] ?? 0)));
    if (level > 0 && (!def.requires || (out[def.requires.id] ?? 0) >= def.requires.level)) out[def.id] = level;
  }
  d.upgrades = out;
}
