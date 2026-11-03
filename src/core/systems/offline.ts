/** Offline rewards: track a rewards-per-minute rate while active, pay it out on return. */
import { BAL } from '../../data';
import type { GameState, Rate } from '../state';
import type { CoreEvent } from '../types';
import { computeElapsed, MS_PER_HOUR, MS_PER_MINUTE } from '../time';
import { addXp } from './progression';
import { killRewards } from './stages';
import { upgradeEffects } from './upgrades';
import { computeStats } from './stats';

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
  const k = killRewards(state.battle.stage, 'regular', stats.COIN_FIND);
  const minutes = o.fallbackStageSeconds / 60;
  return {
    bags: (waves * (BAL.drops.bagsPerWave + stats.BAG_FIND / 100)) / minutes,
    coins: (waves * o.fallbackEnemiesPerWave * k.coins) / minutes,
    xp: (waves * o.fallbackEnemiesPerWave * k.xp) / minutes,
  };
}

/** Average rewards per minute over the last 10 minutes of active play (or the fallback estimate). */
export function currentRate(state: GameState, now: number): Rate {
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

/** App returning (or booting from a save): compute the offline reward, guarding against clock tampering. */
export function onResume(d: GameState, now: number, ev: CoreEvent[]): void {
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
  if (reward.bags <= 0 && reward.coins <= 0 && reward.xp <= 0) return;
  const prev = d.offline.pending;
  const canDouble = elapsedMs >= BAL.offline.adDoubleMinAwayMinutes * MS_PER_MINUTE;
  d.offline.pending = {
    awayMs: (prev?.awayMs ?? 0) + elapsedMs,
    bags: (prev?.bags ?? 0) + reward.bags,
    coins: (prev?.coins ?? 0) + reward.coins,
    xp: (prev?.xp ?? 0) + reward.xp,
    canDouble: canDouble || (prev?.canDouble ?? false),
  };
  ev.push({ type: 'offlineReady', awayMs: d.offline.pending.awayMs });
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
