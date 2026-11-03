/**
 * The always-on dumpster wheel (RNG-game style):
 * - every roll is one spin: the result is rolled when the spin starts, lands when it stops, then
 *   the wheel rests briefly and spins again (Spin Speed upgrades shorten the cycle);
 * - a Trash Bag from fights makes a spin a faster turbo spin;
 * - every Nth spin is a lucky spin;
 * - new items go to the bag; the player equips by dragging them onto the raccoon;
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
import { currentLuck, itemOddsOneIn, luckyEvery, rollRarity } from './luck';
import { addXp } from './progression';
import { rebirthGoldMult } from './rebirth';
import { computeStats } from './stats';
import { upgradeEffects } from './upgrades';
import { combatEffects } from './enchants';
import { itemTierFor } from './worlds';

/** Seconds for one spin cycle (spin + rest) at the current Spin Speed; turbo spins are faster. */
export function spinCycle(state: Pick<GameState, 'upgrades'>, turbo = false): number {
  const r = BAL.roll;
  const levels = upgradeEffects(state).rollSpeed;
  const cycle = Math.max(r.minCycleSeconds, (r.spinSeconds + r.restSeconds) * Math.pow(1 - r.speedPerLevel, levels));
  return turbo ? Math.max(r.minTurboCycleSeconds, cycle / (r.turboSpeedMult + upgradeEffects(state).turboPower)) : cycle;
}

/** The share of a cycle spent spinning (the rest is the pause on the result). */
export function spinShare(): number {
  return BAL.roll.spinSeconds / (BAL.roll.spinSeconds + BAL.roll.restSeconds);
}

export function inventoryCapacity(state: GameState): number {
  return BAL.inventory.baseCapacity + upgradeEffects(state).capacity;
}

export function enchantChance(state: GameState): number {
  return Math.min(1, BAL.enchant.baseChance + upgradeEffects(state).enchantChance);
}

/** XP multiplier from the XP Boost upgrade. */
export function xpMult(state: Pick<GameState, 'upgrades'>): number {
  return 1 + upgradeEffects(state).xpPct / 100;
}

/** Seconds a Luck Potion lasts (Potion Time upgrade adds to it). */
export function potionSeconds(state: Pick<GameState, 'upgrades'>): number {
  return BAL.luck.potion.seconds + upgradeEffects(state).potionTime;
}

/** Rolls without Epic or better before bad-luck protection kicks in (Pity Shield shortens it). */
export function drySpell(state: Pick<GameState, 'upgrades'>): number {
  return Math.max(8, BAL.dumpster.badLuck.drySpell - upgradeEffects(state).pity);
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
  const scrapBonus = 1 + upgradeEffects(state).scrapPct / 100;
  return {
    coins: Math.round(r.coins * enchantBonus * goldMult(state) * scrapBonus * BAL.economy.scrapGoldMult),
    xp: Math.round(r.xp * enchantBonus * BAL.economy.scrapXpMult * xpMult(state)),
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
  if (d.inventory.length < inventoryCapacity(d)) return 'bag';
  const worst = lowestUnlockedIndex(d.inventory);
  return worst >= 0 && item.power > d.inventory[worst].power ? 'bag' : 'scrapped';
}

/** Rolls the next item (the wheel's target) without placing it. */
function rollItem(d: GameState, rng: Rng, now: number): { item: Item; lucky: boolean; golden: boolean; luck: number } {
  const dz = d.dumpster;
  const theme = dz.theme;
  let lucky = false;
  let golden = false;
  let luck = currentLuck(d, now);
  let item: Item;
  if (!dz.firstDiveDone) {
    const t = BAL.dumpster.tutorialItem;
    item = createItem(DATA.itemsById.get(t.baseId)!, t.rarity, t.level, theme, rng, d.nextItemUid++);
    dz.firstDiveDone = true;
  } else {
    const up = upgradeEffects(d);
    d.roll.sinceLucky += 1;
    if (d.roll.sinceLucky >= luckyEvery(d)) {
      lucky = true;
      d.roll.sinceLucky = 0;
      luck *= BAL.roll.luckyRollMult + up.luckyMult;
    }
    if (up.goldenSpin > 0 && rng.chance(up.goldenSpin)) {
      golden = true;
      luck *= BAL.roll.goldenLuckMult;
    }
    let rarity: Rarity;
    const bl = BAL.dumpster.badLuck;
    if (dz.forcedRarity) {
      rarity = dz.forcedRarity;
      dz.forcedRarity = null;
    } else if (dz.level >= bl.minDumpsterLevel && dz.dryStreak >= drySpell(d)) {
      rarity = rollRarity(luck, rng, bl.minRarity);
    } else {
      rarity = rollRarity(luck, rng);
    }
    const slot = rollSlot(rng);
    const level = rollItemLevel(d.player.level, rng);
    const enchants = rollEnchants(rng, enchantChance(d), up.enchantTier);
    rarity = bumpRarity(rarity, rarityBump(enchants));
    const base = pickBaseItem(slot, theme, rarity, rng);
    item = createItem(base, rarity, level, theme, rng, d.nextItemUid++, enchants, itemTierFor(d));
  }
  return { item, lucky, golden, luck };
}

/** Starts a spin. A Trash Bag, if there is one, pays for a faster turbo spin. */
export function startSpin(d: GameState, rng: Rng, now: number, ev: CoreEvent[]): void {
  const turbo = d.currencies.bags >= 1;
  if (turbo) d.currencies.bags -= 1;
  const { item, lucky, golden, luck } = rollItem(d, rng, now);
  const cycle = spinCycle(d, turbo);
  const spinSeconds = cycle * spinShare();
  const restSeconds = cycle - spinSeconds;
  const odds = itemOddsOneIn(item);
  d.roll.current = { item, lucky, golden, luck, odds, turbo, spinSeconds, restSeconds, landed: false };
  d.roll.timer = 0;
  ev.push({ type: 'spinStart', item: snap(item), lucky, golden, luck, odds, turbo, spinSeconds, restSeconds });
}

/** The wheel stops: records, Codex, then equip, bag, or scrap. */
function landSpin(d: GameState, ev: CoreEvent[]): void {
  const spin = d.roll.current;
  if (!spin || spin.landed) return;
  spin.landed = true;
  const item = snap(spin.item);
  const dz = d.dumpster;
  d.roll.count += 1;
  dz.totalDives += 1;
  dz.dryStreak = rarityAtLeast(item.rarity, BAL.dumpster.badLuck.minRarity) ? 0 : dz.dryStreak + 1;
  const newRecord = spin.odds > d.records.bestOdds;
  if (newRecord) {
    d.records.bestOdds = spin.odds;
    d.records.bestItemName = itemName(item);
    d.records.bestRarity = item.rarity;
  }
  const placed = decidePlacement(d, item);
  ev.push({
    type: 'roll', item, lucky: spin.lucky, golden: spin.golden, source: spin.turbo ? 'turbo' : 'free', odds: spin.odds, luck: spin.luck,
    placed, newRecord,
  });
  registerCodex(d, item, ev);
  if (placed === 'bag') addToBag(d, item, ev);
  else scrapItem(d, item, ev, true);
}

/** True when `item` would beat what is equipped in its slot (or the slot is empty). */
export function isUpgrade(state: Pick<GameState, 'equipped'>, item: Item): boolean {
  const cur = state.equipped[item.slot];
  return !cur || item.power > cur.power;
}

/** One whole roll right now (spin start and landing at once). Used by tests and tools. */
export function performRoll(d: GameState, rng: Rng, now: number, ev: CoreEvent[]): Item {
  if (d.roll.current && !d.roll.current.landed) landSpin(d, ev);
  startSpin(d, rng, now, ev);
  const item = snap(d.roll.current!.item);
  landSpin(d, ev);
  d.roll.current = null;
  d.roll.timer = 0;
  return item;
}

/** Advances the wheel by `dt` seconds: spin, land, rest, spin again. */
export function rollTick(d: GameState, rng: Rng, now: number, ev: CoreEvent[], dt: number): void {
  let t = dt;
  for (let guard = 0; guard < BAL.roll.maxRollsPerTick * 2 + 2; guard++) {
    if (!d.roll.current) startSpin(d, rng, now, ev);
    const cur = d.roll.current!;
    const total = cur.spinSeconds + cur.restSeconds;
    const step = Math.min(t, total - d.roll.timer);
    d.roll.timer += step;
    t -= step;
    if (!cur.landed && d.roll.timer >= cur.spinSeconds - 1e-9) landSpin(d, ev);
    if (d.roll.timer < total - 1e-9) return;
    d.roll.current = null;
    d.roll.timer = 0;
    if (t <= 1e-9) {
      startSpin(d, rng, now, ev);
      return;
    }
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

/** Scraps every unlocked item in the bag at once (one event, one XP grant). */
export function scrapAllFromBag(d: GameState, ev: CoreEvent[]): number {
  let coins = 0;
  let xp = 0;
  const keep: Item[] = [];
  let count = 0;
  for (const it of d.inventory) {
    if (it.locked) {
      keep.push(it);
      continue;
    }
    const v = scrapValue(d, it);
    coins += v.coins;
    xp += v.xp;
    count++;
  }
  if (count === 0) return 0;
  d.inventory = keep;
  d.currencies.coins += coins;
  d.lifetime.itemsRecycled += count;
  ev.push({ type: 'scrapAll', count, coins, xp });
  addXp(d, xp, ev);
  return count;
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
