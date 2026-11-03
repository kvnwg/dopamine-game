/**
 * Offline rewards: track a rewards-per-minute rate while active, pay it out on return. The dumpster
 * also keeps rolling while the raccoon is away, much more slowly: rare finds go to the bag on return,
 * the rest are scrapped into the reward.
 */
import { BAL, RARITIES, type Rarity } from '../../data';
import type { Rng } from '../rng';
import type { GameState, Rate } from '../state';
import type { CoreEvent, Item } from '../types';
import { computeElapsed, MS_PER_HOUR, MS_PER_MINUTE } from '../time';
import { rarityAtLeast } from '../util';
import { registerCodex } from './codex';
import { rollItemLevel, rollSlot } from './dumpster';
import { rarityBump, rollEnchants } from './enchants';
import { createItem, itemName, pickBaseItem } from './loot';
import { currentLuck, itemOddsOneIn, luckyEvery, rollRarity } from './luck';
import { addXp } from './progression';
import { addToBag, drySpell, enchantChance, reelCount, rollTokens, scrapValue, spinCycle, tokenMult } from './roller';
import { killRewards } from './stages';
import { upgradeEffects } from './upgrades';
import { computeStats } from './stats';
import { itemTierFor } from './worlds';

export function offlineCapMs(_state: GameState): number {
  return BAL.offline.capHours * MS_PER_HOUR; // Monthly Card (+4h) arrives in Milestone 4.
}

/** Adds combat rewards to the per-minute buckets used for the offline rate. */
export function recordRewards(d: GameState, now: number, r: Rate): void {
  const o = d.offline;
  if (o.trackingSince === null) o.trackingSince = now;
  const minute = Math.floor(now / MS_PER_MINUTE);
  let last = o.buckets[o.buckets.length - 1];
  if (!last || last.minute !== minute) {
    last = { minute, bags: 0, coins: 0, xp: 0 };
    o.buckets.push(last);
  }
  last.bags += r.bags;
  last.coins += r.coins;
  last.xp += r.xp;
  const oldest = minute - BAL.offline.rateWindowMinutes;
  while (o.buckets.length > 0 && o.buckets[0].minute < oldest) o.buckets.shift();
}

/** Expected rewards per minute at the current stage, used before there is enough tracked data. */
export function fallbackRate(state: GameState): Rate {
  const stats = computeStats(state);
  const o = BAL.offline;
  const waves = BAL.stages.wavesPerStage;
  const world = state.heist?.run ? state.heist.run.main.stage : state.battle.stage;
  const k = killRewards(world, 'regular', stats.COIN_FIND);
  const minutes = o.fallbackStageSeconds / 60;
  return {
    bags: (waves * (BAL.drops.bagsPerWave + stats.BAG_FIND / 100)) / minutes,
    coins: (waves * o.fallbackEnemiesPerWave * k.coins) / minutes,
    xp: (waves * o.fallbackEnemiesPerWave * k.xp) / minutes,
  };
}

/** Average rewards per minute over the last 10 minutes of active play (or the fallback estimate). */
export function currentRate(state: GameState, now: number): Rate {
  // During a heist the Alley is paused: the rate is the one from when the run started.
  if (state.heist?.run) return { ...state.heist.run.mainRate };
  const o = state.offline;
  const windowMs = BAL.offline.rateWindowMinutes * MS_PER_MINUTE;
  if (o.trackingSince === null) return fallbackRate(state);
  const since = Math.max(o.trackingSince, now - windowMs);
  const coveredMin = (now - since) / MS_PER_MINUTE;
  if (coveredMin < BAL.offline.minRateMinutes) return fallbackRate(state);
  const firstMinute = Math.floor(since / MS_PER_MINUTE);
  const total = { bags: 0, coins: 0, xp: 0 };
  for (const b of o.buckets) {
    if (b.minute < firstMinute) continue;
    total.bags += b.bags;
    total.coins += b.coins;
    total.xp += b.xp;
  }
  return { bags: total.bags / coveredMin, coins: total.coins / coveredMin, xp: total.xp / coveredMin };
}

/** Pure offline reward math: rate x minutes x efficiency x (1 + bonus%). */
export function offlineReward(rate: Rate, elapsedMs: number, bonusPct: number): Rate {
  const mult = (elapsedMs / MS_PER_MINUTE) * BAL.offline.efficiency * (1 + bonusPct / 100);
  return {
    bags: Math.floor(rate.bags * mult),
    coins: Math.floor(rate.coins * mult),
    xp: Math.floor(rate.xp * mult),
  };
}

/** Offline bonus % (Offline Earnings in the upgrade tree). */
export function offlineBonusPct(state: GameState): number {
  return upgradeEffects(state).offlinePct;
}

/** App going to background: remember when and how fast we were earning. */
export function onPause(d: GameState, now: number): void {
  if (d.offline.paused) return;
  d.offline.pausedRate = currentRate(d, now);
  d.lastActiveAt = Math.max(d.lastActiveAt, now);
  d.offline.paused = true;
}

/** Snapshot for autosave so a killed app still earns offline rewards from its last save. */
export function snapshotForSave(d: GameState, now: number): void {
  if (d.offline.paused) return;
  d.offline.pausedRate = currentRate(d, now);
  d.lastActiveAt = Math.max(d.lastActiveAt, now);
}

/**
 * How many items the dumpster rolls in `elapsedMs` away: one spin (all its reels) per spin cycle x
 * offline.rollSlowdown, times the offline efficiency and bonus, at most offline.maxRolls. None before
 * the very first dive.
 */
export function offlineRollCount(state: GameState, elapsedMs: number): number {
  if (!state.dumpster.firstDiveDone || !(elapsedMs > 0)) return 0;
  const o = BAL.offline;
  const spins = (elapsedMs / 1000 / (spinCycle(state) * o.rollSlowdown)) * o.efficiency * (1 + offlineBonusPct(state) / 100);
  return Math.max(0, Math.min(o.maxRolls, Math.floor(spins) * reelCount(state)));
}

/** "1 in X" a find must reach to be kept: a plain item of offline.keepRarity. */
export function offlineKeepOdds(): number {
  return itemOddsOneIn({ rarity: BAL.offline.keepRarity, enchants: [] });
}

export interface OfflineRolls {
  rolls: number;
  /** The rare finds that went into the bag, best first. */
  kept: Item[];
  /** Rare finds a full bag had no room for (scrapped by the bag's rules: it keeps the best). */
  overflow: number;
  /** offline.scrapShare of the scrap value of everything else (0 by default: it is dropped). */
  coins: number;
  xp: number;
}

function bumpRarity(r: Rarity, by: number): Rarity {
  return RARITIES[Math.min(RARITIES.length - 1, RARITIES.indexOf(r) + by)];
}

/**
 * The dumpster's rolls while away: `count` items rolled like the reels' (the raccoon's luck, lucky
 * spins every Nth spin, golden spins, luck tokens, enchantments, bad-luck protection), but instantly:
 * no spins, no events per roll, never the tutorial's scripted rolls (and the reels' roll count, which
 * times beginner's luck, doesn't move). A Golden Dumpster's spins wait for the reels. Finds at least as
 * rare as a plain offline.keepRarity item go to the bag by the bag's rules, the Codex and the records;
 * the rest are dropped, or scrapped for offline.scrapShare of their coins and XP (returned).
 */
export function rollOffline(d: GameState, rng: Rng, now: number, count: number, ev: CoreEvent[]): OfflineRolls {
  const out: OfflineRolls = { rolls: 0, kept: [], overflow: 0, coins: 0, xp: 0 };
  const finds: Item[] = [];
  const dz = d.dumpster;
  if (count <= 0 || !dz.firstDiveDone) return out;
  const up = upgradeEffects(d);
  const bl = BAL.dumpster.badLuck;
  const reels = reelCount(d);
  const baseLuck = currentLuck(d, now);
  const keepOdds = offlineKeepOdds();
  const tier = itemTierFor(d);
  const share = BAL.offline.scrapShare;
  let dry = dz.dryStreak;
  while (out.rolls < count) {
    // One spin's luck, as startSpin rolls it (lucky every Nth spin, the golden chance from upgrades).
    let luck = baseLuck;
    d.roll.sinceLucky += 1;
    if (d.roll.sinceLucky >= luckyEvery(d)) {
      d.roll.sinceLucky = 0;
      luck *= BAL.roll.luckyRollMult + up.luckyMult;
    }
    if (up.goldenSpin > 0 && rng.chance(up.goldenSpin)) luck *= BAL.roll.goldenLuckMult;
    for (let r = 0; r < reels && out.rolls < count; r++) {
      // As the reels roll an item (rollReelItem), minus the tutorial and the dev's forced rarity.
      const itemLuck = luck * tokenMult(rollTokens(rng));
      let rarity = dz.level >= bl.minDumpsterLevel && dry >= drySpell(d) ? rollRarity(itemLuck, rng, bl.minRarity) : rollRarity(itemLuck, rng);
      const slot = rollSlot(rng);
      const level = rollItemLevel(d.player.level, rng);
      const enchants = rollEnchants(rng, enchantChance(d), up.enchantTier);
      rarity = bumpRarity(rarity, rarityBump(enchants));
      const base = pickBaseItem(slot, dz.theme, rarity, rng, d.rebirths);
      const item = createItem(base, rarity, level, dz.theme, rng, d.nextItemUid++, enchants, tier);
      out.rolls += 1;
      dz.totalDives += 1;
      dry = rarityAtLeast(item.rarity, bl.minRarity) ? 0 : dry + 1;
      if (itemOddsOneIn(item) >= keepOdds) {
        finds.push(item);
      } else if (share > 0) {
        const v = scrapValue(d, item);
        out.coins += Math.floor(v.coins * share);
        out.xp += Math.floor(v.xp * share);
        d.lifetime.itemsRecycled += 1;
      }
    }
  }
  dz.dryStreak = dry;
  // Best first, so a full bag keeps the best finds (and what it already holds that is better).
  finds.sort((a, b) => b.power - a.power);
  for (const item of finds) {
    const odds = itemOddsOneIn(item);
    if (odds > d.records.bestOdds) {
      d.records.bestOdds = odds;
      d.records.bestItemName = itemName(item);
      d.records.bestRarity = item.rarity;
    }
    registerCodex(d, item, ev);
    if (addToBag(d, item, ev)) out.kept.push(item);
    else out.overflow += 1;
  }
  return out;
}

/**
 * App returning (or booting from a save): compute the offline reward, guarding against clock tampering.
 * With `rng`, the dumpster's offline rolls happen too (see rollOffline).
 */
export function onResume(d: GameState, now: number, ev: CoreEvent[], rng?: Rng): void {
  const rate = d.offline.pausedRate ?? fallbackRate(d);
  const { elapsedMs, clockWentBackward } = computeElapsed(d.lastActiveAt, now, offlineCapMs(d));
  d.offline.paused = false;
  d.offline.pausedRate = null;
  d.offline.buckets = [];
  d.offline.trackingSince = null;
  d.lastActiveAt = now;
  if (clockWentBackward) {
    ev.push({ type: 'clockWentBackward' });
    return;
  }
  if (elapsedMs < BAL.offline.minAwaySecondsForPopup * 1000) return;
  const reward = offlineReward(rate, elapsedMs, offlineBonusPct(d));
  const rolled = rng ? rollOffline(d, rng, now, offlineRollCount(d, elapsedMs), ev) : null;
  const coins = reward.coins + (rolled?.coins ?? 0);
  const xp = reward.xp + (rolled?.xp ?? 0);
  if (reward.bags <= 0 && coins <= 0 && xp <= 0 && !rolled?.rolls) return;
  const prev = d.offline.pending;
  const canDouble = elapsedMs >= BAL.offline.adDoubleMinAwayMinutes * MS_PER_MINUTE;
  const kept = rolled?.kept ?? [];
  const found = [...(prev?.found ?? []), ...kept.map((it) => structuredClone(it))]
    .sort((a, b) => b.power - a.power)
    .slice(0, BAL.offline.keepListMax);
  d.offline.pending = {
    awayMs: (prev?.awayMs ?? 0) + elapsedMs,
    bags: (prev?.bags ?? 0) + reward.bags,
    coins: (prev?.coins ?? 0) + coins,
    xp: (prev?.xp ?? 0) + xp,
    canDouble: canDouble || (prev?.canDouble ?? false),
    rolls: (prev?.rolls ?? 0) + (rolled?.rolls ?? 0),
    found,
    foundCount: (prev?.foundCount ?? 0) + kept.length,
  };
  ev.push({
    type: 'offlineReady',
    awayMs: d.offline.pending.awayMs,
    rolls: rolled?.rolls ?? 0,
    kept: kept.length,
    best: kept.length > 0 ? structuredClone(kept[0]) : null,
  });
}

export function collectOffline(d: GameState, doubled: boolean, ev: CoreEvent[]): boolean {
  const p = d.offline.pending;
  if (!p) return false;
  const mult = doubled && p.canDouble ? 2 : 1;
  const bags = p.bags * mult;
  const coins = p.coins * mult;
  const xp = p.xp * mult;
  d.offline.pending = null;
  d.currencies.bags += bags;
  d.currencies.coins += coins;
  ev.push({ type: 'offlineCollected', bags, coins, xp, doubled: mult === 2, minutes: Math.round(p.awayMs / MS_PER_MINUTE) });
  addXp(d, xp, ev);
  return true;
}

/**
 * A Scrap All haul measured in minutes of the raccoon's recent gold income from fights (Infinity
 * before there is any income). Bags fill up, so a haul is often worth many minutes of fighting.
 */
export function haulMinutes(state: GameState, coins: number, now: number): number {
  const rate = currentRate(state, now).coins;
  return rate > 0 ? coins / rate : Infinity;
}

export type HaulSize = 'big' | 'huge' | 'mega';

/** How big a deal a Scrap All haul is (feel.haul, in minutes of fighting); null for an everyday one. */
export function haulSize(minutes: number): HaulSize | null {
  const h = BAL.feel.haul;
  if (minutes >= h.mega) return 'mega';
  if (minutes >= h.huge) return 'huge';
  if (minutes >= h.big) return 'big';
  return null;
}
