/** Player stat computation: (base + level + flat gear) x (1 + sum of % bonuses), then caps. */
import { BAL, DATA, STAT_IDS, SLOTS, type Mod, type StatId } from '../../data';
import type { GameState } from '../state';
import type { Item, Stats } from '../types';
import { codexBonusMods } from './codex';

export function zeroStats(): Stats {
  return Object.fromEntries(STAT_IDS.map((s) => [s, 0])) as Stats;
}

/** Every stat modifier an item grants (main stats, substats, unique bonus, Mint perk). */
export function itemMods(item: Item): Mod[] {
  const mods: Mod[] = [...item.main, ...item.subs.map((s) => ({ stat: s.stat, mode: s.mode, value: s.value })), ...item.bonus];
  if (item.mintPerkId) {
    const perk = DATA.mintPerksById.get(item.mintPerkId);
    if (perk) mods.push(...perk.mods);
  }
  return mods;
}

export interface StatBreakdown {
  flat: Stats;
  pct: Stats;
}

export function statSources(state: Pick<GameState, 'player' | 'equipped' | 'codex' | 'neighborhoodsCleared'>): StatBreakdown {
  const flat = zeroStats();
  const pct = zeroStats();
  const lvl = state.player.level - 1;
  for (const s of STAT_IDS) flat[s] = BAL.player.base[s] + BAL.player.perLevel[s] * lvl;
  const apply = (m: Mod) => {
    if (m.mode === 'flat') flat[m.stat] += m.value;
    else pct[m.stat] += m.value;
  };
  for (const slot of SLOTS) {
    const it = state.equipped[slot];
    if (it) itemMods(it).forEach(apply);
  }
  codexBonusMods(state.codex.entries.length).forEach(apply);
  flat.BAG_FIND += state.neighborhoodsCleared.length * BAL.stages.neighborhoodClearBonus.bagFind;
  return { flat, pct };
}

export function computeStats(state: Pick<GameState, 'player' | 'equipped' | 'codex' | 'neighborhoodsCleared'>): Stats {
  const { flat, pct } = statSources(state);
  const out = zeroStats();
  for (const s of STAT_IDS) out[s] = flat[s] * (1 + pct[s] / 100);
  const caps = BAL.player.caps;
  out.CRIT = Math.min(out.CRIT, caps.CRIT);
  out.DODGE = Math.min(out.DODGE, caps.DODGE);
  out.ATK_SPD = Math.min(out.ATK_SPD, caps.ATK_SPD);
  return out;
}

/** Weighted power score of a list of modifiers (weights in balance.json). */
export function modsPower(mods: Mod[]): number {
  let p = 0;
  for (const m of mods) p += (m.mode === 'flat' ? BAL.power.flat[m.stat] : BAL.power.pct[m.stat]) * m.value;
  return Math.round(p);
}

export function totalGearPower(state: Pick<GameState, 'equipped'>): number {
  let p = 0;
  for (const slot of SLOTS) p += state.equipped[slot]?.power ?? 0;
  return p;
}

/** Overall progress score used to decide when a farming raccoon should try to push again. */
export function playerPower(state: Pick<GameState, 'equipped' | 'player'>): number {
  return totalGearPower(state) + state.player.level * BAL.power.perPlayerLevel;
}

export const STAT_ORDER: StatId[] = [...STAT_IDS];
