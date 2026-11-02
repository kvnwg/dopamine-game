/** Dumpster Dives: rarity tables, dives, equip/recycle, upgrades, bad luck protection, auto-dive. */
import { BAL, DATA, RARITIES, SLOTS, type Rarity, type Slot } from '../../data';
import type { Rng } from '../rng';
import type { GameState } from '../state';
import type { CoreEvent, DiveOutcome, Item } from '../types';
import { dayKey, MS_PER_MINUTE } from '../time';
import { clamp, rarityAtLeast, snap } from '../util';
import { registerCodex } from './codex';
import { createItem, pickBaseItem, recycleRewards } from './loot';
import { addXp } from './progression';
import { computeStats } from './stats';

/** Rarity weights at a Dumpster Level, linearly interpolated between table rows. */
export function rarityWeightsAt(level: number): Record<Rarity, number> {
  const table = BAL.dumpster.rarityTable;
  const lv = clamp(level, table[0].level, table[table.length - 1].level);
  let lo = table[0];
  let hi = table[table.length - 1];
  for (let i = 0; i < table.length - 1; i++) {
    if (lv >= table[i].level && lv <= table[i + 1].level) {
      lo = table[i];
      hi = table[i + 1];
      break;
    }
  }
  const t = hi.level === lo.level ? 0 : (lv - lo.level) / (hi.level - lo.level);
  const out = {} as Record<Rarity, number>;
  for (const r of RARITIES) out[r] = lo.weights[r] + (hi.weights[r] - lo.weights[r]) * t;
  return out;
}

/** Normalized probabilities (sum to 1) at a Dumpster Level. */
export function rarityOddsAt(level: number): Record<Rarity, number> {
  const w = rarityWeightsAt(level);
  const total = RARITIES.reduce((s, r) => s + w[r], 0);
  const out = {} as Record<Rarity, number>;
  for (const r of RARITIES) out[r] = w[r] / total;
  return out;
}

function orderedWeights(w: Record<Rarity, number>): Array<[Rarity, number]> {
  return RARITIES.map((r) => [r, w[r]] as [Rarity, number]);
}

export function rollRarity(level: number, rng: Rng): Rarity {
  return rng.weighted(orderedWeights(rarityWeightsAt(level)));
}

/** Roll from the table restricted to `min` or better (bad luck protection). */
export function rollRarityAtLeast(level: number, min: Rarity, rng: Rng): Rarity {
  const w = rarityWeightsAt(level);
  const entries = orderedWeights(w).filter(([r, wt]) => rarityAtLeast(r, min) && wt > 0);
  if (entries.length === 0) return min;
  return rng.weighted(entries);
}

export function rollSlot(rng: Rng): Slot {
  return rng.weighted(SLOTS.map((s) => [s, BAL.dumpster.slotWeights[s]] as [Slot, number]));
}

/** Item level = clamp(playerLevel + randInt(-2, +1), 1, levelCap) */
export function rollItemLevel(playerLevel: number, rng: Rng): number {
  const o = BAL.items.levelOffset;
  return clamp(playerLevel + rng.int(o.min, o.max), 1, BAL.items.levelCap);
}

/** Coins to upgrade from `level` to `level + 1`: 400 x 1.85^(level - 1). */
export function upgradeCost(level: number): number {
  const c = BAL.dumpster.upgradeCost;
  return Math.round(c.base * Math.pow(c.growth, level - 1));
}

/** Seconds to upgrade from `level`: 60 x 1.65^(level - 1), capped at 24 hours. */
export function upgradeSeconds(level: number): number {
  const t = BAL.dumpster.upgradeTime;
  return Math.min(t.capSeconds, Math.round(t.baseSeconds * Math.pow(t.growth, level - 1)));
}

/** 1 Gem per 2 minutes remaining (minimum 1). */
export function gemSpeedupCost(remainingMs: number): number {
  const g = BAL.dumpster.gemSpeedup;
  if (remainingMs <= 0) return 0;
  return Math.max(g.minGems, Math.ceil(remainingMs / MS_PER_MINUTE / g.minutesPerGem));
}

export function adSpeedupsLeft(state: GameState, now: number): number {
  const used = state.dumpster.adSpeedupDay === dayKey(now) ? state.dumpster.adSpeedupsUsed : 0;
  return Math.max(0, BAL.dumpster.adSpeedup.perDay - used);
}

export function matchesKeepFilter(state: GameState, item: Item): boolean {
  if (rarityAtLeast(item.rarity, state.autoDive.keepMinRarity)) return true;
  return item.subs.some((s) => state.autoDive.keepSubstats.includes(s.affixId));
}

export function isUpgrade(state: GameState, item: Item): boolean {
  const cur = state.equipped[item.slot];
  return !cur || item.power > cur.power;
}

export function recycleItem(d: GameState, item: Item, ev: CoreEvent[], auto: boolean): void {
  const r = recycleRewards(item);
  d.currencies.coins += r.coins;
  d.lifetime.itemsRecycled += 1;
  ev.push({ type: 'recycle', item: snap(item), xp: r.xp, coins: r.coins, auto });
  addXp(d, r.xp, ev);
}

/** Equips the item; the replaced item is recycled. Max HP gained is added to current HP. */
export function equipItem(d: GameState, item: Item, ev: CoreEvent[], auto: boolean): void {
  const hpBefore = computeStats(d).HP;
  const replaced = d.equipped[item.slot] ? snap(d.equipped[item.slot]) : null;
  d.equipped[item.slot] = item;
  d.lifetime.itemsEquipped += 1;
  ev.push({ type: 'equip', item: snap(item), replaced, auto });
  const gained = computeStats(d).HP - hpBefore;
  if (gained > 0 && d.battle.phase !== 'dead') d.battle.playerHp += gained;
  if (replaced) recycleItem(d, replaced, ev, auto);
}

/** Rolls the next item without spending anything (used by dive). */
export function rollDiveItem(d: GameState, rng: Rng): Item {
  const dz = d.dumpster;
  if (!dz.firstDiveDone) {
    const t = BAL.dumpster.tutorialItem;
    return createItem(DATA.itemsById.get(t.baseId)!, t.rarity, t.level, dz.theme, rng, d.nextItemUid++);
  }
  const slot = rollSlot(rng);
  let rarity: Rarity;
  const bl = BAL.dumpster.badLuck;
  if (dz.forcedRarity) {
    rarity = dz.forcedRarity;
    dz.forcedRarity = null;
  } else if (dz.level >= bl.minDumpsterLevel && dz.dryStreak >= bl.drySpell) {
    rarity = rollRarityAtLeast(dz.level, bl.minRarity, rng);
  } else {
    rarity = rollRarity(dz.level, rng);
  }
  const level = rollItemLevel(d.player.level, rng);
  const base = pickBaseItem(slot, dz.theme, rarity, rng);
  return createItem(base, rarity, level, dz.theme, rng, d.nextItemUid++);
}

/**
 * One Dumpster Dive. Manual dives always go to the compare card.
 * Auto-dives auto-equip upgrades, auto-recycle the rest, and pause (compare card)
 * for Legendary+ or items matching the keep filters.
 */
export function dive(d: GameState, rng: Rng, ev: CoreEvent[], auto: boolean): boolean {
  if (d.pendingItem || d.currencies.bags < 1) return false;
  d.currencies.bags -= 1;
  const item = rollDiveItem(d, rng);
  d.dumpster.firstDiveDone = true;
  d.dumpster.totalDives += 1;
  d.dumpster.dryStreak = rarityAtLeast(item.rarity, BAL.dumpster.badLuck.minRarity) ? 0 : d.dumpster.dryStreak + 1;
  const tease = item.rarity === 'epic' && rng.chance(BAL.dumpster.nearMissTeaseChance);
  const fullFlip = rarityAtLeast(item.rarity, BAL.dumpster.fullFlipMinRarity);
  d.stage.showToughHint = false;

  let outcome: DiveOutcome = 'pending';
  if (auto && !fullFlip) {
    if (isUpgrade(d, item)) outcome = 'autoEquipped';
    else if (!matchesKeepFilter(d, item)) outcome = 'autoRecycled';
  }
  ev.push({ type: 'dive', item, auto, fullFlip, tease, outcome });
  registerCodex(d, item, ev);
  if (outcome === 'autoEquipped') equipItem(d, item, ev, true);
  else if (outcome === 'autoRecycled') recycleItem(d, item, ev, true);
  else d.pendingItem = item;
  return true;
}

export function equipPending(d: GameState, ev: CoreEvent[]): boolean {
  const item = d.pendingItem;
  if (!item) return false;
  const plain = snap(item);
  d.pendingItem = null;
  equipItem(d, plain, ev, false);
  return true;
}

export function recyclePending(d: GameState, ev: CoreEvent[]): boolean {
  const item = d.pendingItem;
  if (!item) return false;
  const plain = snap(item);
  d.pendingItem = null;
  recycleItem(d, plain, ev, false);
  return true;
}

export function autoDiveTick(d: GameState, rng: Rng, ev: CoreEvent[], dt: number, speedMult = 1): void {
  const a = d.autoDive;
  if (!a.unlocked || !a.enabled || d.pendingItem || d.currencies.bags < 1) {
    a.timer = 0;
    return;
  }
  a.timer += dt;
  const interval = BAL.autoDive.intervalSeconds / speedMult;
  while (a.timer >= interval && !d.pendingItem && d.currencies.bags >= 1) {
    a.timer -= interval;
    dive(d, rng, ev, true);
  }
}

export function startUpgrade(d: GameState, now: number, ev: CoreEvent[]): boolean {
  const dz = d.dumpster;
  if (dz.upgradeEndsAt !== null || dz.level >= BAL.dumpster.maxLevel) return false;
  const cost = upgradeCost(dz.level);
  if (d.currencies.coins < cost) return false;
  d.currencies.coins -= cost;
  dz.upgradeEndsAt = now + upgradeSeconds(dz.level) * 1000;
  ev.push({ type: 'dumpsterUpgradeStarted', level: dz.level + 1, endsAt: dz.upgradeEndsAt });
  return true;
}

export function checkUpgrade(d: GameState, now: number, ev: CoreEvent[]): void {
  const dz = d.dumpster;
  if (dz.upgradeEndsAt !== null && now >= dz.upgradeEndsAt) {
    dz.upgradeEndsAt = null;
    dz.level = Math.min(BAL.dumpster.maxLevel, dz.level + 1);
    ev.push({ type: 'dumpsterUpgraded', level: dz.level });
  }
}

export function speedupWithGems(d: GameState, now: number, ev: CoreEvent[]): boolean {
  const dz = d.dumpster;
  if (dz.upgradeEndsAt === null) return false;
  const cost = gemSpeedupCost(dz.upgradeEndsAt - now);
  if (d.currencies.gems < cost) return false;
  d.currencies.gems -= cost;
  dz.upgradeEndsAt = now;
  checkUpgrade(d, now, ev);
  return true;
}

export function speedupWithAd(d: GameState, now: number, ev: CoreEvent[]): boolean {
  const dz = d.dumpster;
  if (dz.upgradeEndsAt === null || adSpeedupsLeft(d, now) <= 0) return false;
  const today = dayKey(now);
  if (dz.adSpeedupDay !== today) {
    dz.adSpeedupDay = today;
    dz.adSpeedupsUsed = 0;
  }
  dz.adSpeedupsUsed += 1;
  dz.upgradeEndsAt -= BAL.dumpster.adSpeedup.minutes * MS_PER_MINUTE;
  checkUpgrade(d, now, ev);
  return true;
}

