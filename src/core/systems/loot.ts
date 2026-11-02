/** Item generation, power score, recycling, and display names. */
import { BAL, DATA, RARITIES, type BaseItem, type Mod, type Rarity, type Slot } from '../../data';
import type { Rng } from '../rng';
import type { Item, Substat } from '../types';
import { rarityAtLeast, round2 } from '../util';
import { itemMods, modsPower } from './stats';

/** Main stat value = slotBase x (1 + 0.09 x (itemLevel - 1)) x rarityMultiplier */
export function mainStatValue(slotBase: number, itemLevel: number, rarity: Rarity): number {
  return slotBase * (1 + BAL.items.levelScalePerLevel * (itemLevel - 1)) * BAL.rarities[rarity].mult;
}

export function substatScale(itemLevel: number): number {
  return 1 + BAL.items.substatLevelScale * (itemLevel - 1);
}

export function rollSubstats(count: number, itemLevel: number, themeId: string, rng: Rng): Substat[] {
  const theme = DATA.themes.find((t) => t.id === themeId) ?? DATA.themes[0];
  const pool: Array<[string, number]> = DATA.affixes
    .map((a) => [a.id, theme.substatWeights[a.id] ?? 1] as [string, number])
    .filter(([, w]) => w > 0);
  const out: Substat[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const id = rng.weighted(pool);
    pool.splice(pool.findIndex(([k]) => k === id), 1); // no duplicate substats
    const a = DATA.affixesById.get(id)!;
    out.push({ affixId: a.id, stat: a.stat, mode: a.mode, value: round2(rng.float(a.min, a.max) * substatScale(itemLevel)) });
  }
  return out;
}

export function computeItemPower(item: Omit<Item, 'power'>): number {
  return modsPower(itemMods({ ...item, power: 0 }));
}

export function createItem(base: BaseItem, rarity: Rarity, level: number, themeId: string, rng: Rng, uid: number): Item {
  const main: Mod[] = BAL.items.slots[base.slot].main.map((m) => ({
    stat: m.stat,
    mode: 'flat' as const,
    value: round2(mainStatValue(m.base, level, rarity)),
  }));
  const subs = rollSubstats(BAL.rarities[rarity].substats, level, themeId, rng);
  const mintPerkId = rarity === 'mint' ? rng.pick(DATA.mintPerks).id : null;
  const partial = { uid, baseId: base.id, slot: base.slot, rarity, level, main, subs, bonus: base.bonus ?? [], mintPerkId };
  return { ...partial, power: computeItemPower(partial) };
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

/** Recycle rewards x (1 + 0.05 x itemLevel). */
export function recycleRewards(item: Pick<Item, 'rarity' | 'level'>): { xp: number; coins: number } {
  const r = BAL.rarities[item.rarity];
  const mult = 1 + BAL.recycle.perItemLevel * item.level;
  return { xp: Math.round(r.recycleXp * mult), coins: Math.round(r.recycleCoins * mult) };
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
