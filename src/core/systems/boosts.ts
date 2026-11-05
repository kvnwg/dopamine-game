/**
 * Boosts: short speed-ups the player takes from the Roll tab's Boosts panel, for a rewarded ad or Gems
 * (docs/MONETIZATION.md, B2). Every rewarded ad on CrazyGames needs another way to get the same thing,
 * so each boost has a Gem price beside its ad:
 *  - Quick Dive: the dumpster's offline rolls for two hours away, right now (rare finds go to the bag);
 *  - Potion Brew: luck x3 for 5 minutes, on top of everything else (a Luck Potion included);
 *  - Duct-Tape Reel: one more reel for 15 minutes, never past the maximum;
 *  - Bonus Crate: every 4 hours, a pile of Trash Bags, some gold or a short Luck Potion (odds shown).
 * Each can be taken `perDay` times a day, by ad or Gems alike; Quick Dive's Gem price climbs through the day.
 * The timed ones end on the wall clock, while the game is closed too (expireBoosts).
 */
import { BAL } from '../../data';
import type { Rng } from '../rng';
import type { BoostState, GameState } from '../state';
import { dayKey, MS_PER_HOUR, MS_PER_MINUTE } from '../time';
import type { CoreEvent } from '../types';
import { currentRate, offlineRollCount, rollOffline } from './offline';
import { addXp } from './progression';
import { addLuckBoost, reelCount } from './roller';

export const BOOSTS = ['quickDive', 'potionBrew', 'ductTapeReel', 'bonusCrate'] as const;
export type BoostId = (typeof BOOSTS)[number];

const B = BAL.boosts;

/** Why a boost can't be taken now (null: it can). */
export type BoostBlock = 'limit' | 'active' | 'cooldown' | 'maxReels' | 'nothing';

export type CrateReward = (typeof B.bonusCrate.rewards)[number];

function cfg(id: BoostId): { perDay: number; gems: number[] } {
  return B[id];
}

/** Today's uses (a new local day starts the counts over). */
export function boostUses(state: Pick<GameState, 'boosts'>, id: BoostId, now: number): number {
  const b = state.boosts;
  return b.day === dayKey(now) ? (b.used[id] ?? 0) : 0;
}

export function boostUsesLeft(state: Pick<GameState, 'boosts'>, id: BoostId, now: number): number {
  return Math.max(0, cfg(id).perDay - boostUses(state, id, now));
}

/** Gems for the next use today (Quick Dive's climbs with each use; the list's last price repeats). */
export function boostGems(state: Pick<GameState, 'boosts'>, id: BoostId, now: number): number {
  const prices = cfg(id).gems;
  return prices[Math.min(prices.length - 1, boostUses(state, id, now))];
}

/** When a timed boost (Potion Brew, Duct-Tape Reel) running now ends, else null. */
export function boostEndsAt(state: Pick<GameState, 'boosts'>, id: BoostId, now: number): number | null {
  const at = id === 'potionBrew' ? state.boosts.brewEndsAt : id === 'ductTapeReel' ? state.boosts.reelEndsAt : null;
  return at !== null && at > now ? at : null;
}

/** When the next Bonus Crate is ready (now or earlier: ready). */
export function crateReadyAt(state: Pick<GameState, 'boosts'>): number {
  return state.boosts.crateAt;
}

/** The rolls a Quick Dive gives right now (the offline rolls for its hours away). */
export function quickDiveRolls(state: GameState): number {
  return offlineRollCount(state, B.quickDive.hours * MS_PER_HOUR);
}

/** Why `id` can't be taken right now, or null. */
export function boostBlocked(state: GameState, id: BoostId, now: number): BoostBlock | null {
  if (boostUsesLeft(state, id, now) <= 0) return 'limit';
  switch (id) {
    case 'quickDive':
      return quickDiveRolls(state) > 0 ? null : 'nothing';
    case 'potionBrew':
      return boostEndsAt(state, id, now) !== null ? 'active' : null;
    case 'ductTapeReel':
      if (boostEndsAt(state, id, now) !== null) return 'active';
      return reelCount(state, false) >= BAL.roll.maxReels ? 'maxReels' : null;
    case 'bonusCrate':
      return now < crateReadyAt(state) ? 'cooldown' : null;
  }
}

/** Each Bonus Crate reward's chance, as shown on the crate (the weights in balance.json). */
export function crateOdds(): Array<{ reward: CrateReward; chance: number }> {
  const total = B.bonusCrate.rewards.reduce((n, r) => n + r.weight, 0);
  return B.bonusCrate.rewards.map((reward) => ({ reward, chance: reward.weight / total }));
}

/** How much a crate reward of bags or gold pays right now: `minutes` of the current rate, at least `min`. */
export function crateAmount(state: GameState, reward: CrateReward, now: number): number {
  if (reward.kind === 'potion') return reward.seconds;
  const rate = currentRate(state, now);
  const perMinute = reward.kind === 'bags' ? rate.bags : rate.coins;
  return Math.max(reward.min, Math.floor(perMinute * reward.minutes));
}

function touchDay(b: BoostState, now: number): void {
  const day = dayKey(now);
  if (b.day !== day) {
    b.day = day;
    b.used = {};
  }
}

/**
 * Takes boost `id`: after its rewarded ad (`via: 'ad'`, the UI plays it first) or for its Gem price.
 * Nothing happens if it can't be taken now or the Gems aren't there.
 */
export function takeBoost(d: GameState, id: BoostId, via: 'ad' | 'gems', rng: Rng, now: number, ev: CoreEvent[]): boolean {
  if (boostBlocked(d, id, now) !== null) return false;
  const gems = via === 'gems' ? boostGems(d, id, now) : 0;
  if (d.currencies.gems < gems) return false;
  d.currencies.gems -= gems;
  const b = d.boosts;
  touchDay(b, now);
  b.used[id] = (b.used[id] ?? 0) + 1;
  ev.push({ type: 'boostUsed', id, via, gems });
  switch (id) {
    case 'quickDive': {
      const rolled = rollOffline(d, rng, now, quickDiveRolls(d), ev);
      d.currencies.coins += rolled.coins;
      if (rolled.xp > 0) addXp(d, rolled.xp, ev);
      ev.push({ type: 'quickDive', rolls: rolled.rolls, kept: rolled.kept.length, best: rolled.kept.length > 0 ? structuredClone(rolled.kept[0]) : null });
      break;
    }
    case 'potionBrew':
      b.brewEndsAt = now + B.potionBrew.minutes * MS_PER_MINUTE;
      break;
    case 'ductTapeReel':
      b.reelEndsAt = now + B.ductTapeReel.minutes * MS_PER_MINUTE;
      break;
    case 'bonusCrate': {
      const reward = pickCrate(rng);
      const amount = crateAmount(d, reward, now);
      if (reward.kind === 'bags') d.currencies.bags += amount;
      else if (reward.kind === 'coins') d.currencies.coins += amount;
      else addLuckBoost(d, now, amount, ev);
      b.crateAt = now + B.bonusCrate.everyHours * MS_PER_HOUR;
      ev.push({ type: 'crateOpened', kind: reward.kind, amount });
      break;
    }
  }
  return true;
}

function pickCrate(rng: Rng): CrateReward {
  const rewards = B.bonusCrate.rewards;
  let roll = rng.next() * rewards.reduce((n, r) => n + r.weight, 0);
  for (const r of rewards) {
    roll -= r.weight;
    if (roll < 0) return r;
  }
  return rewards[rewards.length - 1];
}

/**
 * Ends the timed boosts whose time is up (run every tick, and on coming back before the offline rolls,
 * so a reel rented before leaving doesn't roll offline after it ran out).
 */
export function expireBoosts(d: GameState, now: number, ev: CoreEvent[]): void {
  const b = d.boosts;
  if (b.brewEndsAt !== null && now >= b.brewEndsAt) {
    b.brewEndsAt = null;
    ev.push({ type: 'boostEnded', id: 'potionBrew' });
  }
  if (b.reelEndsAt !== null && now >= b.reelEndsAt) {
    b.reelEndsAt = null;
    ev.push({ type: 'boostEnded', id: 'ductTapeReel' });
  }
}
