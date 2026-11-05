/** Player stat computation: (base + level + flat gear) x (1 + sum of % bonuses), then caps. */
import { BAL, DATA, STAT_IDS, SLOTS, type Mod, type StatId } from '../../data';
import type { GameState } from '../state';
import type { Item, Stats } from '../types';
import { codexBonusMods } from './codex';
import { enchantMods } from './enchants';
import { perkStatMults } from './perks';
import { upgradeEffects } from './upgrades';

export function zeroStats(): Stats {
  return Object.fromEntries(STAT_IDS.map((s) => [s, 0])) as Stats;
}

/** Flat stats that grow with the raccoon's best world (percent-style stats do not). */
const TIERED: ReadonlySet<StatId> = new Set<StatId>(['HP', 'ATK', 'DEF', 'REGEN']);

/** The world multiplier for world tier `tier`: worlds.itemGrowth^(tier - 1). */
export function tierMult(tier: number): number {
  return Math.pow(BAL.worlds.itemGrowth, Math.max(0, tier - 1));
}

/**
 * How much stronger worn gear is for this raccoon. An item's own stats only depend on how rare it is
 * (so a rarer item always has more power); the raccoon's level grows every worn item's own stats,
 * and the best world beaten grows their flat HP, ATK, DEF and regen.
 */
export interface GearScale {
  level: number;
  tier: number;
}

export function gearScale(state: Partial<Pick<GameState, 'player' | 'stage'>>): GearScale {
  const level = state.player?.level ?? 1;
  // Only worlds actually beaten count (the bonus for a world arrives once it is cleared).
  const world = Math.max(1, Math.min(DATA.worlds.length, state.stage?.highestCleared ?? 0));
  return { level: 1 + BAL.items.levelScalePerLevel * (level - 1), tier: tierMult(world) };
}

/** One number for the gear scale, for power scores: what an item's power is worth on this raccoon. */
export function gearPowerMult(state: Partial<Pick<GameState, 'player' | 'stage'>>): number {
  const g = gearScale(state);
  return g.level * g.tier;
}

const UNSCALED: GearScale = { level: 1, tier: 1 };

/**
 * Every stat modifier an item grants (main stats, substats, unique bonus, Mint perk, enchantments).
 * With a gear scale, its own stats grow with the raccoon's level and flat HP / ATK / DEF / regen with its world.
 */
export function itemMods(item: Item, scale: GearScale = UNSCALED): Mod[] {
  const own: Mod[] = [...item.main, ...item.subs.map((s) => ({ stat: s.stat, mode: s.mode, value: s.value })), ...item.bonus];
  const mods = scale.level === 1 ? own : own.map((m) => ({ ...m, value: m.value * scale.level }));
  if (item.mintPerkId) {
    const perk = DATA.mintPerksById.get(item.mintPerkId);
    if (perk) mods.push(...perk.mods);
  }
  mods.push(...enchantMods(item.enchants ?? []));
  if (scale.tier === 1) return mods;
  return mods.map((m) => (m.mode === 'flat' && TIERED.has(m.stat) ? { ...m, value: m.value * scale.tier } : m));
}

export interface StatBreakdown {
  flat: Stats;
  pct: Stats;
}

type StatState = Pick<GameState, 'player' | 'equipped' | 'codex'> & Partial<Pick<GameState, 'upgrades' | 'rebirths' | 'stage' | 'perks'>>;

export function statSources(state: StatState): StatBreakdown {
  const flat = zeroStats();
  const pct = zeroStats();
  const lvl = state.player.level - 1;
  for (const s of STAT_IDS) flat[s] = BAL.player.base[s] + BAL.player.perLevel[s] * lvl;
  const apply = (m: Mod) => {
    if (m.mode === 'flat') flat[m.stat] += m.value;
    else pct[m.stat] += m.value;
  };
  const scale = gearScale(state);
  for (const slot of SLOTS) {
    const it = state.equipped[slot];
    if (it) itemMods(it, scale).forEach(apply);
  }
  codexBonusMods(state.codex.entries.length).forEach(apply);
  const up = upgradeEffects({ upgrades: state.upgrades ?? {} });
  pct.ATK += up.atkPct;
  pct.HP += up.hpPct;
  flat.BAG_FIND += up.bagFind;
  flat.CRIT += up.critChance;
  flat.CRIT_DMG += up.critDmg;
  flat.LIFESTEAL += up.lifesteal;
  flat.BOSS_DMG += up.bossDmg;
  const reb = (state.rebirths ?? 0) * BAL.rebirth.statPctPer;
  pct.ATK += reb;
  pct.HP += reb;
  return { flat, pct };
}

export function computeStats(state: StatState): Stats {
  const { flat, pct } = statSources(state);
  const out = zeroStats();
  for (const s of STAT_IDS) out[s] = flat[s] * (1 + pct[s] / 100);
  // This run's Alley perks multiply on top (Glass Cannon, the Energy Drink, Holy Crust).
  const perk = perkStatMults(state);
  out.ATK *= perk.atk;
  out.HP *= perk.hp;
  out.ATK_SPD *= perk.atkSpd;
  const caps = BAL.player.caps;
  out.CRIT = Math.min(out.CRIT, caps.CRIT);
  out.DODGE = Math.min(out.DODGE, caps.DODGE);
  out.ATK_SPD = Math.min(out.ATK_SPD, caps.ATK_SPD);
  return out;
}

/** Weighted stat score of a list of modifiers (weights in balance.json), unrounded. */
export function modsScore(mods: Mod[]): number {
  let p = 0;
  for (const m of mods) p += (m.mode === 'flat' ? BAL.power.flat[m.stat] : BAL.power.pct[m.stat]) * m.value;
  return p;
}

/** Weighted power score of a list of modifiers (weights in balance.json). */
export function modsPower(mods: Mod[]): number {
  return Math.round(modsScore(mods));
}

/** An item's power as worn by this raccoon (its rarity power times the gear scale); what item tiles show. */
export function wornPower(state: Partial<Pick<GameState, 'player' | 'stage'>>, item: Pick<Item, 'power'>): number {
  return Math.round(item.power * gearPowerMult(state));
}

export function totalGearPower(state: Pick<GameState, 'equipped'> & Partial<Pick<GameState, 'player' | 'stage'>>): number {
  let p = 0;
  for (const slot of SLOTS) {
    const it = state.equipped[slot];
    if (it) p += wornPower(state, it);
  }
  return p;
}

/** Overall progress score used to decide when a farming raccoon should try to push again. */
export function playerPower(state: Pick<GameState, 'equipped' | 'player'> & Partial<Pick<GameState, 'stage'>>): number {
  return totalGearPower(state) + state.player.level * BAL.power.perPlayerLevel;
}

export const STAT_ORDER: StatId[] = [...STAT_IDS];
