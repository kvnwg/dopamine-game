/** Enchantments: roll on items, add power, can bump rarity, and grant stats or combat effects. */
import { BAL, DATA, type Mod } from '../../data';
import type { Rng } from '../rng';
import type { GameState } from '../state';
import type { ItemEnchant } from '../types';
import { SLOTS } from '../../data';

/** Tier weights after `mastery` levels of Enchant Mastery (shifted toward tiers II and III). */
export function enchantTierWeights(mastery = 0): number[] {
  const e = BAL.enchant;
  return e.tierWeights.map((w, i) => Math.max(1, w + e.tierShiftPerLevel[i] * mastery));
}

/** Rolls 0-3 enchantments (distinct) for a new item. */
export function rollEnchants(rng: Rng, chance: number, mastery = 0): ItemEnchant[] {
  if (!rng.chance(chance)) return [];
  const e = BAL.enchant;
  const tierWeights = enchantTierWeights(mastery);
  const count = 1 + Number(rng.weighted(e.countWeights.map((w, i) => [String(i), w] as [string, number])));
  const pool: Array<[string, number]> = DATA.enchants.map((x) => [x.id, x.weight]);
  const out: ItemEnchant[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const id = rng.weighted(pool);
    pool.splice(pool.findIndex(([k]) => k === id), 1);
    const tier = 1 + Number(rng.weighted(tierWeights.map((w, k) => [String(k), w] as [string, number])));
    out.push({ id, tier });
  }
  return out;
}

function value(en: ItemEnchant): number {
  const def = DATA.enchantsById.get(en.id);
  return def ? def.effect.values[en.tier - 1] : 0;
}

/** Extra power multiplier from enchantments (sum of per-tier bonuses). */
export function enchantPowerMult(enchants: ItemEnchant[]): number {
  return enchants.reduce((s, en) => s + BAL.enchant.powerPerTier[en.tier - 1], 0);
}

/** Rarity tiers added by enchantments such as Prismatic. */
export function rarityBump(enchants: ItemEnchant[]): number {
  let n = 0;
  for (const en of enchants) if (DATA.enchantsById.get(en.id)?.effect.type === 'rarityUp') n += value(en);
  return n;
}

/** Stat modifiers granted by enchantments (Swift, Vampiric, Giant, Magnetic). */
export function enchantMods(enchants: ItemEnchant[]): Mod[] {
  const out: Mod[] = [];
  for (const en of enchants) {
    const eff = DATA.enchantsById.get(en.id)?.effect;
    if (eff?.type === 'mod') out.push({ stat: eff.stat, mode: eff.mode, value: eff.values[en.tier - 1] });
  }
  return out;
}

export interface CombatEffects {
  /** Burn damage per second as a fraction of ATK. */
  burn: number;
  /** Chance to chain lightning to the next enemy. */
  chain: number;
  /** Chance to strike twice. */
  echo: number;
  /** Splash damage to the next enemy on kill, as a fraction of ATK. */
  explode: number;
  /** Fraction of damage taken reflected to the attacker. */
  thorns: number;
  /** Additive luck from Lucky. */
  luck: number;
  /** Gold gain % from Golden. */
  goldPct: number;
}

export function combatEffects(state: Pick<GameState, 'equipped'>): CombatEffects {
  const out: CombatEffects = { burn: 0, chain: 0, echo: 0, explode: 0, thorns: 0, luck: 0, goldPct: 0 };
  for (const slot of SLOTS) {
    const it = state.equipped[slot];
    if (!it) continue;
    for (const en of it.enchants) {
      const t = DATA.enchantsById.get(en.id)?.effect.type;
      const v = value(en);
      if (t === 'burn') out.burn += v;
      else if (t === 'chain') out.chain += v;
      else if (t === 'echo') out.echo += v;
      else if (t === 'explode') out.explode += v;
      else if (t === 'thorns') out.thorns += v;
      else if (t === 'luck') out.luck += v;
      else if (t === 'goldPct') out.goldPct += v;
    }
  }
  out.chain = Math.min(out.chain, 0.9);
  out.echo = Math.min(out.echo, 0.75);
  return out;
}
