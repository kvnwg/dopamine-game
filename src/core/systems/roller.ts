/**
 * The always-on dumpster roller (RNG-game style):
 * - a free roll every `rollInterval` seconds, plus Trash Bags from fights spent as bonus rolls;
 * - every Nth roll is a lucky roll;
 * - new items auto-equip when they beat the equipped item's power, otherwise go to the bag;
 * - the bag has limited space and always keeps the highest-power items (the rest are scrapped).
 */
import { BAL, DATA, RARITIES, type Rarity } from '../../data';
import type { Rng } from '../rng';
import type { GameState } from '../state';
import type { CoreEvent, Item, RollPlacement } from '../types';
import { rarityAtLeast, snap } from '../util';
import { registerCodex } from './codex';
import { rollItemLevel, rollSlot } from './dumpster';
import { rarityBump, rollEnchants } from './enchants';
import { createItem, itemName, pickBaseItem, recycleRewards } from './loot';
import { currentLuck, luckyEvery, RARITY_ODDS, rollRarity } from './luck';
import { addXp } from './progression';
import { rebirthGoldMult } from './rebirth';
import { computeStats } from './stats';
import { upgradeEffects } from './upgrades';
import { combatEffects } from './enchants';
import { itemTierFor } from './worlds';

export function rollInterval(state: GameState): number {
  const r = BAL.roll;
  const levels = upgradeEffects(state).rollSpeed;
  return Math.max(r.minIntervalSeconds, r.baseIntervalSeconds * Math.pow(1 - r.speedPerLevel, levels));
}

export function inventoryCapacity(state: GameState): number {
  return BAL.inventory.baseCapacity + upgradeEffects(state).capacity;
}

export function enchantChance(state: GameState): number {
  return Math.min(1, BAL.enchant.baseChance + upgradeEffects(state).enchantChance);
}

/** Gold multiplier from the Gold upgrade, Golden enchantments, and rebirths. */
export function goldMult(state: GameState): number {
  const pct = upgradeEffects(state).goldPct + combatEffects(state).goldPct;
  return (1 + pct / 100) * rebirthGoldMult(state.rebirths);
}

function bumpRarity(r: Rarity, by: number): Rarity {
  const i = Math.min(RARITIES.length - 1, RARITIES.indexOf(r) + by);
  return RARITIES[i];
}

function lowestUnlockedIndex(bag: Item[]): number {
  let idx = -1;
  for (let i = 0; i < bag.length; i++) {
    if (bag[i].locked) continue;
    if (idx < 0 || bag[i].power < bag[idx].power) idx = i;
  }
  return idx;
}

/** Gold and XP for scrapping an item (enchanted items are worth more; gold multipliers apply). */
export function scrapValue(state: GameState, item: Item): { coins: number; xp: number } {
  const r = recycleRewards(item);
  const enchantBonus = 1 + 0.5 * item.enchants.reduce((s, e) => s + e.tier, 0);
  return {
    coins: Math.round(r.coins * enchantBonus * goldMult(state) * BAL.economy.scrapGoldMult),
    xp: Math.round(r.xp * enchantBonus * BAL.economy.scrapXpMult),
  };
}

export function scrapItem(d: GameState, item: Item, ev: CoreEvent[], auto: boolean): void {
  const { coins, xp } = scrapValue(d, item);
  d.currencies.coins += coins;
  d.lifetime.itemsRecycled += 1;
  ev.push({ type: 'scrap', item: snap(item), xp, coins, auto });
  addXp(d, xp, ev);
}

/** Puts an item in the bag, keeping it sorted by power. When full, the weakest unlocked item is scrapped. */
export function addToBag(d: GameState, item: Item, ev: CoreEvent[]): boolean {
  if (d.inventory.length >= inventoryCapacity(d)) {
    const worst = lowestUnlockedIndex(d.inventory);
    if (worst < 0 || d.inventory[worst].power >= item.power) {
      scrapItem(d, item, ev, true);
      return false;
    }
    const [out] = d.inventory.splice(worst, 1);
    scrapItem(d, snap(out), ev, true);
  }
  let at = d.inventory.findIndex((x) => x.power < item.power);
  if (at < 0) at = d.inventory.length;
  d.inventory.splice(at, 0, item);
  return true;
}

/** Equips an item; whatever it replaces goes to the bag. Max HP gained is added to current HP. */
export function equip(d: GameState, item: Item, ev: CoreEvent[], auto: boolean): void {
  const hpBefore = computeStats(d).HP;
  const replaced = d.equipped[item.slot] ? snap(d.equipped[item.slot]) : null;
  d.equipped[item.slot] = item;
  d.lifetime.itemsEquipped += 1;
  ev.push({ type: 'equip', item: snap(item), replaced, auto });
  const gained = computeStats(d).HP - hpBefore;
  if (gained > 0 && d.battle.phase !== 'dead') d.battle.playerHp += gained;
  if (replaced) addToBag(d, replaced, ev);
}

function decidePlacement(d: GameState, item: Item): RollPlacement {
  const cur = d.equipped[item.slot];
  if (d.autoEquip && (!cur || item.power > cur.power)) return 'equipped';
  if (d.inventory.length < inventoryCapacity(d)) return 'bag';
  const worst = lowestUnlockedIndex(d.inventory);
  return worst >= 0 && item.power > d.inventory[worst].power ? 'bag' : 'scrapped';
}

/** One roll of the dumpster. */
export function performRoll(d: GameState, rng: Rng, now: number, ev: CoreEvent[], source: 'timer' | 'bag'): Item {
  const dz = d.dumpster;
  const theme = dz.theme;
  let lucky = false;
  let luck = currentLuck(d, now);
  let item: Item;
  if (!dz.firstDiveDone) {
    const t = BAL.dumpster.tutorialItem;
    item = createItem(DATA.itemsById.get(t.baseId)!, t.rarity, t.level, theme, rng, d.nextItemUid++);
    dz.firstDiveDone = true;
  } else {
    d.roll.sinceLucky += 1;
    if (d.roll.sinceLucky >= luckyEvery(d)) {
      lucky = true;
      d.roll.sinceLucky = 0;
      luck *= BAL.roll.luckyRollMult;
    }
    let rarity: Rarity;
    const bl = BAL.dumpster.badLuck;
    if (dz.forcedRarity) {
      rarity = dz.forcedRarity;
      dz.forcedRarity = null;
    } else if (dz.level >= bl.minDumpsterLevel && dz.dryStreak >= bl.drySpell) {
      rarity = rollRarity(luck, rng, bl.minRarity);
    } else {
      rarity = rollRarity(luck, rng);
    }
    const slot = rollSlot(rng);
    const level = rollItemLevel(d.player.level, rng);
    const enchants = rollEnchants(rng, enchantChance(d));
    rarity = bumpRarity(rarity, rarityBump(enchants));
    const base = pickBaseItem(slot, theme, rarity, rng);
    item = createItem(base, rarity, level, theme, rng, d.nextItemUid++, enchants, itemTierFor(d));
  }
  d.roll.count += 1;
  dz.totalDives += 1;
  dz.dryStreak = rarityAtLeast(item.rarity, BAL.dumpster.badLuck.minRarity) ? 0 : dz.dryStreak + 1;
  const odds = RARITY_ODDS[item.rarity];
  const newRecord = odds > d.records.bestOdds;
  if (newRecord) {
    d.records.bestOdds = odds;
    d.records.bestItemName = itemName(item);
    d.records.bestRarity = item.rarity;
  }
  const placed = decidePlacement(d, item);
  ev.push({ type: 'roll', item, lucky, source, odds, luck, placed, newRecord });
  registerCodex(d, item, ev);
  if (placed === 'equipped') equip(d, item, ev, true);
  else if (placed === 'bag') addToBag(d, item, ev);
  else scrapItem(d, item, ev, true);
  return item;
}

/** Advances the roller: timed free rolls plus bonus rolls from Trash Bags. */
export function rollTick(d: GameState, rng: Rng, now: number, ev: CoreEvent[], dt: number): void {
  let budget = BAL.roll.maxRollsPerTick;
  const interval = rollInterval(d);
  d.roll.timer += dt;
  while (d.roll.timer >= interval && budget > 0) {
    d.roll.timer -= interval;
    performRoll(d, rng, now, ev, 'timer');
    budget--;
  }
  if (d.roll.timer > interval) d.roll.timer = interval;
  if (d.currencies.bags >= 1) {
    const step = 1 / BAL.roll.bagRollsPerSecond;
    d.roll.bagTimer += dt;
    while (d.roll.bagTimer >= step && d.currencies.bags >= 1 && budget > 0) {
      d.roll.bagTimer -= step;
      d.currencies.bags -= 1;
      performRoll(d, rng, now, ev, 'bag');
      budget--;
    }
  } else {
    d.roll.bagTimer = 0;
  }
}

/** Manually equip an item from the bag. */
export function equipFromBag(d: GameState, uid: number, ev: CoreEvent[]): boolean {
  const idx = d.inventory.findIndex((x) => x.uid === uid);
  if (idx < 0) return false;
  const [item] = d.inventory.splice(idx, 1);
  equip(d, snap(item), ev, false);
  return true;
}

export function scrapFromBag(d: GameState, uid: number, ev: CoreEvent[]): boolean {
  const idx = d.inventory.findIndex((x) => x.uid === uid);
  if (idx < 0 || d.inventory[idx].locked) return false;
  const [item] = d.inventory.splice(idx, 1);
  scrapItem(d, snap(item), ev, false);
  return true;
}

export function toggleLock(d: GameState, uid: number): boolean {
  const it = d.inventory.find((x) => x.uid === uid);
  if (!it) return false;
  it.locked = !it.locked;
  return true;
}

/** Luck boost (from a potion drop): extends any running boost. */
export function addLuckBoost(d: GameState, now: number, seconds: number, ev: CoreEvent[]): void {
  const from = d.luckBoostEndsAt !== null && d.luckBoostEndsAt > now ? d.luckBoostEndsAt : now;
  d.luckBoostEndsAt = from + seconds * 1000;
  ev.push({ type: 'luckBoost', endsAt: d.luckBoostEndsAt, seconds });
}
