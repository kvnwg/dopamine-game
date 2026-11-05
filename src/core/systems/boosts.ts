/**
 * Boosts: optional extras the player takes for a rewarded ad or Gems (docs/MONETIZATION.md, B2). Every
 * rewarded ad on CrazyGames needs another way to get the same thing, so each has a Gem price beside its ad.
 * The Roll tab's Boosts panel holds four, any time:
 *  - Quick Dive: the dumpster's offline rolls for two hours away, right now (rare finds go to the bag);
 *  - Potion Brew: luck x3 for 5 minutes, on top of everything else (a Luck Potion included);
 *  - Duct-Tape Reel: one more reel for 15 minutes, never past the maximum;
 *  - Bonus Crate: every 4 hours, a pile of Trash Bags, some gold or a short Luck Potion (odds shown).
 * And five come up at a moment:
 *  - Encore: a spin with a big luck token chain (x25 or more) can be played again, its tokens on every
 *    reel, for a few minutes after (on the big reveal and in the panel);
 *  - Boss Rage: after two losses in a row at a world, +50% to the raccoon's hits for the next try there
 *    (on that world's card, and in the panel);
 *  - Rebirth Blessing: taken on the Rebirth tab, the next rebirth's first 10 minutes spin twice as fast;
 *  - Polish: a Mythic-or-better find gets +1 tier on an enchantment, or a new one (the reveal, the item card);
 *  - Gold top-up: an upgrade a little out of reach gets the missing gold (the upgrade's card).
 * Each can be taken `perDay` times a day, by ad or Gems alike; Quick Dive's Gem price climbs through the day.
 * The timed ones end on the wall clock, while the game is closed too (expireBoosts).
 */
import { BAL, DATA } from '../../data';
import type { Rng } from '../rng';
import type { BoostState, GameState } from '../state';
import { dayKey, MS_PER_HOUR, MS_PER_MINUTE } from '../time';
import type { CoreEvent, Item } from '../types';
import { rarityAtLeast } from '../util';
import { fitToPower } from './loot';
import { currentRate, offlineRollCount, rollOffline } from './offline';
import { addXp } from './progression';
import { addLuckBoost, reelCount } from './roller';
import { upgradeDef, upgradeLevel, upgradeNodeState, upgradePrice } from './upgrades';
import { travelTo } from './worlds';

/** The Boosts panel's four, any time. */
export const PANEL_BOOSTS = ['quickDive', 'potionBrew', 'ductTapeReel', 'bonusCrate'] as const;
export const BOOSTS = [...PANEL_BOOSTS, 'encore', 'bossRage', 'rebirthBlessing', 'polish', 'goldTopUp'] as const;
export type BoostId = (typeof BOOSTS)[number];

/** What a boost is for, when it needs saying: the item to polish, the upgrade to top up. */
export interface BoostTarget {
  uid?: number;
  upgradeId?: string;
}

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

/** When a timed boost running now ends (Potion Brew, Duct-Tape Reel, the Blessing's fast spins), else null. */
export function boostEndsAt(state: Pick<GameState, 'boosts'>, id: BoostId, now: number): number | null {
  const b = state.boosts;
  const at = id === 'potionBrew' ? b.brewEndsAt : id === 'ductTapeReel' ? b.reelEndsAt : id === 'rebirthBlessing' ? b.blessEndsAt : null;
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

/** The Encore on offer now (a big chain's spin, for a few minutes), else null. */
export function encoreOffer(state: Pick<GameState, 'boosts'>, now: number): BoostState['encore'] {
  const e = state.boosts.encore;
  return e && now < e.at + B.encore.minutes * MS_PER_MINUTE ? e : null;
}

/** An item in the bag or worn, by uid. */
function findItem(state: Pick<GameState, 'inventory' | 'equipped'>, uid: number | undefined): Item | null {
  if (uid === undefined) return null;
  return state.inventory.find((it) => it.uid === uid) ?? Object.values(state.equipped).find((it) => it?.uid === uid) ?? null;
}

const MAX_ENCHANT_TIER = BAL.enchant.tierWeights.length;
const MAX_ENCHANTS = BAL.enchant.countWeights.length;
/** Enchantments that raise an item's rarity (Prismatic) are left alone: a polish never changes a rarity. */
const bumpsRarity = (id: string) => DATA.enchantsById.get(id)?.effect.type === 'rarityUp';

/** What a polish would do to `item`: raise this enchantment, add a new one, or nothing (null). */
function polishStep(item: Item): { raise: number } | { add: true } | null {
  let best = -1;
  item.enchants.forEach((en, i) => {
    if (en.tier < MAX_ENCHANT_TIER && !bumpsRarity(en.id) && (best < 0 || en.tier < item.enchants[best].tier)) best = i;
  });
  if (best >= 0) return { raise: best };
  const free = DATA.enchants.some((e) => !bumpsRarity(e.id) && !item.enchants.some((x) => x.id === e.id));
  return item.enchants.length < MAX_ENCHANTS && free ? { add: true } : null;
}

/** Whether `item` can be polished (rare enough, and room to grow). */
export function canPolish(item: Item): boolean {
  return rarityAtLeast(item.rarity, B.polish.minRarity) && polishStep(item) !== null;
}

/** The gold an upgrade is short of, if a Gold top-up can cover it (a little short, and not much gold); else 0. */
export function topUpGold(state: GameState, upgradeId: string | undefined, now: number): number {
  const def = upgradeId ? upgradeDef(upgradeId) : undefined;
  if (!def) return 0;
  // (The next tier: one past a line's last isn't one, whatever upgradeNodeState says about it.)
  const next = upgradeLevel(state, def.id) + 1;
  if (next > def.max || upgradeNodeState(state, def.id, next) !== 'open') return 0;
  const price = upgradePrice(state, def);
  const short = Math.ceil(price - state.currencies.coins);
  if (short <= 0 || short > (price * B.goldTopUp.maxShortPct) / 100) return 0;
  return short <= currentRate(state, now).coins * B.goldTopUp.maxMinutes ? short : 0;
}

/** Why `id` can't be taken right now, or null. */
export function boostBlocked(state: GameState, id: BoostId, now: number, target: BoostTarget = {}): BoostBlock | null {
  if (boostUsesLeft(state, id, now) <= 0) return 'limit';
  const b = state.boosts;
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
    case 'encore':
      return encoreOffer(state, now) ? null : 'nothing';
    case 'bossRage':
      if (b.rageWorld !== null) return 'active';
      return b.rageOffer !== null && !state.heist.run ? null : 'nothing';
    case 'rebirthBlessing':
      return b.blessReady || boostEndsAt(state, id, now) !== null ? 'active' : null;
    case 'polish': {
      const item = findItem(state, target.uid);
      return item && canPolish(item) ? null : 'nothing';
    }
    case 'goldTopUp':
      return topUpGold(state, target.upgradeId, now) > 0 ? null : 'nothing';
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
export function takeBoost(d: GameState, id: BoostId, via: 'ad' | 'gems', rng: Rng, now: number, ev: CoreEvent[], target: BoostTarget = {}): boolean {
  if (boostBlocked(d, id, now, target) !== null) return false;
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
    case 'encore':
      // The next spin lands that spin's tokens again, each reel its own (the dev cheat's per-reel chains).
      d.dumpster.forcedReelTokens = b.encore!.tokens.map((m) => [...m]);
      b.encore = null;
      break;
    case 'bossRage': {
      const world = b.rageOffer!;
      b.rageWorld = world;
      b.rageOffer = null;
      // Straight back to that world (if he fell back from it), fresh from its first wave.
      if (d.battle.stage !== world) travelTo(d, world, ev);
      break;
    }
    case 'rebirthBlessing':
      b.blessReady = true;
      break;
    case 'polish': {
      const item = findItem(d, target.uid)!;
      polish(item, rng);
      ev.push({ type: 'itemPolished', uid: item.uid, enchants: item.enchants.map((e) => ({ ...e })) });
      break;
    }
    case 'goldTopUp': {
      const gold = topUpGold(d, target.upgradeId, now);
      d.currencies.coins += gold;
      ev.push({ type: 'goldTopUp', gold });
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

/** +1 tier on the item's lowest enchantment, or a new Tier I one; its power and stats follow (fitToPower). */
function polish(item: Item, rng: Rng): void {
  const step = polishStep(item);
  if (!step) return;
  if ('raise' in step) item.enchants[step.raise] = { ...item.enchants[step.raise], tier: item.enchants[step.raise].tier + 1 };
  else {
    const pool: Array<[string, number]> = DATA.enchants
      .filter((e) => !bumpsRarity(e.id) && !item.enchants.some((x) => x.id === e.id))
      .map((e) => [e.id, e.weight]);
    item.enchants.push({ id: rng.weighted(pool), tier: 1 });
  }
  Object.assign(item, fitToPower(item));
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
  if (b.blessEndsAt !== null && now >= b.blessEndsAt) {
    b.blessEndsAt = null;
    ev.push({ type: 'boostEnded', id: 'rebirthBlessing' });
  }
  if (b.encore && now >= b.encore.at + B.encore.minutes * MS_PER_MINUTE) b.encore = null;
}
