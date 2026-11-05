/**
 * Become a Legend: the reset after rebirths (Kevin: "another overall reset that unlocks after rebirth 5
 * that gives [a] currency depending on how far they go on that run"). From Rebirth 5 a run can become
 * a Legend: rebirths and everything they gave start over, for Legend Stars, more the further the run
 * went (rebirths, and new floors of the Endless Dump). Stars buy upgrades that are never wiped, most of
 * them changing how a run plays (a head start, automation, kept reels) and some with no limit. Pure
 * lookups here; the reset itself is in rebirth.ts (doLegend), next to the rebirth it extends.
 */
import { BAL, type LegendPerkDef } from '../../data';
import type { GameState } from '../state';
import type { CoreEvent } from '../types';

const L = () => BAL.legend;

/** Become a Legend is open (Rebirth 5 in this run, or a Legend before). */
export function legendOpen(state: Pick<GameState, 'rebirths' | 'legend'>): boolean {
  return state.rebirths >= L().unlockRebirths || state.legend.count > 0;
}

export interface LegendGain {
  /** From the run's rebirths (they count squared). */
  rebirths: number;
  /** From Endless Dump floors new this Legend run (worth more under Stench). */
  floors: number;
  total: number;
}

/** Stars from `rebirths` rebirths. */
export function starsForRebirths(rebirths: number): number {
  return Math.floor(rebirths * rebirths * L().starsPerRebirthSq);
}

/** The Legend Stars becoming a Legend right now would pay. */
export function legendGain(state: Pick<GameState, 'rebirths' | 'legend'>): LegendGain {
  const rebirths = starsForRebirths(state.rebirths);
  const floors = Math.floor(state.legend.runFloorStars);
  return { rebirths, floors, total: rebirths + floors };
}

/** Can become a Legend now: enough rebirths in this run, a star to gain, not on a heist. */
export function canLegend(state: Pick<GameState, 'rebirths' | 'legend' | 'heist'>): boolean {
  return !state.heist?.run && state.rebirths >= L().unlockRebirths && legendGain(state).total >= 1;
}

export function legendPerk(id: string): LegendPerkDef | undefined {
  return L().perks.find((p) => p.id === id);
}

export function legendLevel(state: Pick<GameState, 'legend'>, id: string): number {
  return state.legend.perks[id] ?? 0;
}

/** The price of a star upgrade's next level, or null when it's maxed. */
export function legendPrice(def: LegendPerkDef, level: number): number | null {
  if (def.max > 0) return level >= def.max ? null : (def.costs?.[level] ?? def.costs?.[def.costs.length - 1] ?? null);
  if (!def.cost) return null;
  return Math.ceil(def.cost.base * Math.pow(def.cost.growth, level));
}

export function canBuyLegend(state: Pick<GameState, 'legend'>, id: string): boolean {
  const def = legendPerk(id);
  if (!def) return false;
  const price = legendPrice(def, legendLevel(state, id));
  return price !== null && state.legend.stars >= price;
}

export function buyLegendPerk(d: GameState, id: string, ev: CoreEvent[]): boolean {
  const def = legendPerk(id);
  if (!def || !canBuyLegend(d, id)) return false;
  const level = legendLevel(d, id);
  const cost = legendPrice(def, level)!;
  d.legend.stars -= cost;
  d.legend.perks[id] = level + 1;
  ev.push({ type: 'legendPerkBought', id, level: level + 1, cost });
  return true;
}

export interface LegendFx {
  startLevels: number;
  startWorlds: number;
  startLoaves: number;
  autoEquip: boolean;
  autoRebirth: boolean;
  keepReels: boolean;
  goldenSpin: number;
  luckPct: number;
  powerPct: number;
  goldPct: number;
}

const NO_FX: LegendFx = {
  startLevels: 0, startWorlds: 0, startLoaves: 0, autoEquip: false, autoRebirth: false, keepReels: false, goldenSpin: 0, luckPct: 0, powerPct: 0, goldPct: 0,
};

/** Everything the star upgrades do, added up (each effect times its level). */
export function legendFx(state: Pick<GameState, 'legend'>): Readonly<LegendFx> {
  const perks = state.legend?.perks;
  if (!perks) return NO_FX;
  let fx: LegendFx | null = null;
  for (const def of L().perks) {
    const n = perks[def.id] ?? 0;
    if (n <= 0) continue;
    fx ??= { ...NO_FX };
    const e = def.effect;
    fx.startLevels += (e.startLevels ?? 0) * n;
    fx.startWorlds += (e.startWorlds ?? 0) * n;
    fx.startLoaves += (e.startLoaves ?? 0) * n;
    fx.autoEquip ||= (e.autoEquip ?? 0) > 0;
    fx.autoRebirth ||= (e.autoRebirth ?? 0) > 0;
    fx.keepReels ||= (e.keepReels ?? 0) > 0;
    fx.goldenSpin += (e.goldenSpin ?? 0) * n;
    fx.luckPct += (e.luckPct ?? 0) * n;
    fx.powerPct += (e.powerPct ?? 0) * n;
    fx.goldPct += (e.goldPct ?? 0) * n;
  }
  return fx ?? NO_FX;
}

/** Equip best runs by itself (Personal Stylist, switched on). */
export function autoEquipOn(state: Pick<GameState, 'legend'>): boolean {
  return legendFx(state).autoEquip && state.legend.autoEquip;
}

/** Rebirth runs by itself (Groundhog Day, switched on). */
export function autoRebirthOn(state: Pick<GameState, 'legend'>): boolean {
  return legendFx(state).autoRebirth && state.legend.autoRebirth;
}

export function setLegendToggle(d: GameState, key: 'autoEquip' | 'autoRebirth', value: boolean): void {
  d.legend[key] = !!value;
}
