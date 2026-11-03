/**
 * Item generation, power, recycling, and display names.
 *
 * Power is rarity: an item's power comes only from its "1 in X" odds (enchantments included), so a
 * rarer item always has more power and sorting by power is sorting by rarity. Its stats are sized to
 * that power. The raccoon's level and best world then grow every worn item alike (gearScale in stats.ts).
 */
import { BAL, DATA, RARITIES, type BaseItem, type Mod, type Rarity, type Slot } from '../../data';
import type { Rng } from '../rng';
import type { Item, ItemEnchant, Substat } from '../types';
import { enchantMods, enchantPowerMult } from './enchants';
import { itemOddsOneIn } from './luck';
import { rarityAtLeast, round2 } from '../util';
import { modsScore } from './stats';

/** Main stat value before the item is sized to its power: slotBase x rarity multiplier (it sets the mix). */
export function mainStatValue(slotBase: number, rarity: Rarity): number {
  return slotBase * BAL.rarities[rarity].mult;
}

export function rollSubstats(count: number, themeId: string, rng: Rng): Substat[] {
  const theme = DATA.themes.find((t) => t.id === themeId) ?? DATA.themes[0];
  const pool: Array<[string, number]> = DATA.affixes
    .map((a) => [a.id, theme.substatWeights[a.id] ?? 1] as [string, number])
    .filter(([, w]) => w > 0);
  const out: Substat[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const id = rng.weighted(pool);
    pool.splice(pool.findIndex(([k]) => k === id), 1); // no duplicate substats
    const a = DATA.affixesById.get(id)!;
    out.push({ affixId: a.id, stat: a.stat, mode: a.mode, value: round2(rng.float(a.min, a.max)) });
  }
  return out;
}

/** Power for "1 in X" odds: base x X^exponent. Strictly rises with rarity. */
export function powerForOdds(oneIn: number): number {
  const p = BAL.items.power;
  return Math.max(1, Math.round(p.base * Math.pow(Math.max(1, oneIn), p.oddsExponent)));
}

/** An item's power: from its odds alone (rarity and enchantments). */
export function computeItemPower(item: Pick<Item, 'rarity' | 'enchants'>): number {
  return powerForOdds(itemOddsOneIn(item));
}

/**
 * Sets an item's power from its odds and sizes its stats to match: main stats, substats and unique
 * bonuses scale together so that their weighted score, plus the enchantments' and Mint perk's own
 * modifiers, times the enchantment power bonus, comes to the item's power.
 */
export function fitToPower<T extends Omit<Item, 'power'>>(item: T): T & { power: number } {
  const power = computeItemPower(item);
  const own: Mod[] = [...item.main, ...item.subs.map((s) => ({ stat: s.stat, mode: s.mode, value: s.value })), ...item.bonus];
  const extra: Mod[] = [...enchantMods(item.enchants ?? [])];
  if (item.mintPerkId) {
    const perk = DATA.mintPerksById.get(item.mintPerkId);
    if (perk) extra.push(...perk.mods);
  }
  const ownScore = modsScore(own);
  const want = power / (1 + enchantPowerMult(item.enchants)) - modsScore(extra);
  const k = ownScore > 0 ? Math.max(0.05, want / ownScore) : 1;
  return {
    ...item,
    main: item.main.map((m) => ({ ...m, value: round2(m.value * k) })),
    subs: item.subs.map((s) => ({ ...s, value: round2(s.value * k) })),
    bonus: item.bonus.map((m) => ({ ...m, value: round2(m.value * k) })),
    power,
  };
}

export function createItem(
  base: BaseItem, rarity: Rarity, level: number, themeId: string, rng: Rng, uid: number, enchants: ItemEnchant[] = [], tier = 1,
): Item {
  const main: Mod[] = BAL.items.slots[base.slot].main.map((m) => ({
    stat: m.stat,
    mode: 'flat' as const,
    value: round2(mainStatValue(m.base, rarity)),
  }));
  const subs = rollSubstats(BAL.rarities[rarity].substats, themeId, rng);
  const mintPerkId = rarity === 'mint' ? rng.pick(DATA.mintPerks).id : null;
  // `level` and `tier` record where the item was found (they set its scrap value); its stats come from its power.
  return fitToPower({ uid, baseId: base.id, slot: base.slot, rarity, level, main, subs, bonus: base.bonus ?? [], mintPerkId, enchants, locked: false, tier });
}

/** Picks the base item for a slot from the active theme. Legendary+ can roll one of the theme's unique Legendaries. */
export function pickBaseItem(slot: Slot, themeId: string, rarity: Rarity, rng: Rng): BaseItem {
  const inTheme = DATA.items.filter((i) => i.theme === themeId && i.slot === slot);
  const regular = inTheme.filter((i) => !i.unique);
  const uniques = inTheme.filter((i) => i.unique);
  if (uniques.length > 0 && rarityAtLeast(rarity, 'legendary') && rng.chance(BAL.dumpster.uniqueLegendaryChance)) {
    return rng.pick(uniques);
  }
  return rng.pick(regular.length > 0 ? regular : inTheme);
}

/** Recycle rewards x (1 + 0.05 x itemLevel); the coins also scale with the item's world, like kill gold. */
export function recycleRewards(item: Pick<Item, 'rarity' | 'level'> & Partial<Pick<Item, 'tier'>>): { xp: number; coins: number } {
  const r = BAL.rarities[item.rarity];
  const mult = 1 + BAL.recycle.perItemLevel * item.level;
  const t = Math.max(0, (item.tier ?? 1) - 1);
  return { xp: Math.round(r.recycleXp * mult), coins: Math.round(r.recycleCoins * mult * Math.pow(BAL.worlds.goldGrowth, t)) };
}

export function itemName(item: Pick<Item, 'baseId' | 'rarity'>): string {
  const base = DATA.itemsById.get(item.baseId);
  if (!base) return item.baseId;
  return rarityAtLeast(item.rarity, 'legendary') ? base.legendaryName : base.name;
}

export function itemFlavor(item: Pick<Item, 'baseId'>): string {
  return DATA.itemsById.get(item.baseId)?.flavor ?? '';
}

export function nextRarity(r: Rarity): Rarity {
  const i = RARITIES.indexOf(r);
  return RARITIES[Math.min(i + 1, RARITIES.length - 1)];
}
