/**
 * The always-on dumpster reels (RNG-game style):
 * - every spin rolls one item per reel (1 reel, more with the Extra Reel upgrade): the results are
 *   rolled when the spin starts, land when it stops, then the reels rest and spin again
 *   (Spin Speed upgrades shorten the cycle);
 * - a Trash Bag from fights makes a spin a faster turbo spin;
 * - every Nth spin is a lucky spin, and a golden spin can strike any spin (both cover every reel);
 * - a reel can land on luck tokens (x2, x3, x5, x10) before its item: each multiplies that reel's
 *   luck and the reel rolls again at full length, with a 50% chance of another token, so a chain of
 *   tokens can end on something very rare;
 * - the dumpster only rolls items unlocked by the raccoon's rebirths (unlocks.ts);
 * - new items go to the bag; the player equips by dragging them onto the raccoon;
 * - the bag has limited space and always keeps the highest-power items (the rest are scrapped).
 */
import { BAL, DATA, RARITIES, type Rarity, type Slot } from '../../data';
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
  // Scrapping the beginner's luck item instead of wearing it ends the tutorial too (without its gems).
  if (d.dumpster.beginner.uid === item.uid) d.dumpster.beginner = { state: 'done', uid: null };
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
  // Wearing the beginner's luck item ends the tutorial.
  const lucky = d.dumpster.beginner;
  if (lucky.state === 'rolled' && lucky.uid === item.uid) {
    d.dumpster.beginner = { state: 'done', uid: null };
    d.currencies.gems += BAL.tutorial.rewardGems;
    ev.push({ type: 'tutorialDone', gems: BAL.tutorial.rewardGems });
  }
  const gained = computeStats(d).HP - hpBefore;
  // (During a heist this is the Alley's waiting battle; the run follows the raccoon's stats itself.)
  const b = d.heist?.run ? d.heist.run.main : d.battle;
  if (gained > 0 && b.phase !== 'dead') b.playerHp += gained;
  if (replaced) addToBag(d, replaced, ev);
}

function decidePlacement(d: GameState, item: Item): RollPlacement {
  if (d.inventory.length < inventoryCapacity(d)) return 'bag';
  const worst = lowestUnlockedIndex(d.inventory);
  return worst >= 0 && item.power > d.inventory[worst].power ? 'bag' : 'scrapped';
}

/** How many reels roll at once (1, plus the Extra Reel upgrade). */
export function reelCount(state: Pick<GameState, 'upgrades'>): number {
  return Math.max(1, Math.min(BAL.roll.maxReels, 1 + Math.round(upgradeEffects(state).reels)));
}

/** Lucky and golden are decided once per spin and cover every reel. The tutorial spin is neither. */
function rollSpinLuck(d: GameState, rng: Rng, now: number): { lucky: boolean; golden: boolean; luck: number } {
  let luck = currentLuck(d, now);
  let lucky = false;
  let golden = false;
  if (d.dumpster.firstDiveDone) {
    const up = upgradeEffects(d);
    d.roll.sinceLucky += 1;
    if (d.roll.sinceLucky >= luckyEvery(d)) {
      lucky = true;
      d.roll.sinceLucky = 0;
      luck *= BAL.roll.luckyRollMult + up.luckyMult;
    }
    if (d.roll.goldenLeft > 0) {
      // A heist's Golden Dumpster: its spins are golden at much higher luck.
      d.roll.goldenLeft -= 1;
      golden = true;
      luck *= BAL.heist.golden.luckMult;
    } else if (up.goldenSpin > 0 && rng.chance(up.goldenSpin)) {
      golden = true;
      luck *= BAL.roll.goldenLuckMult;
    }
  }
  return { lucky, golden, luck };
}

/**
 * Rolls one reel's item at `luck`. `dry` is the bad-luck streak as of this reel (earlier reels in
 * the same spin count), so protection triggers at most once per streak.
 */
function rollReelItem(d: GameState, rng: Rng, luck: number, dry: number, slotOverride?: Slot, avoidBase?: string): Item {
  const dz = d.dumpster;
  const theme = dz.theme;
  if (!dz.firstDiveDone) {
    const t = BAL.dumpster.tutorialItem;
    dz.firstDiveDone = true;
    return createItem(DATA.itemsById.get(t.baseId)!, t.rarity, t.level, theme, rng, d.nextItemUid++);
  }
  const up = upgradeEffects(d);
  let rarity: Rarity;
  const bl = BAL.dumpster.badLuck;
  if (dz.forcedRarity) {
    rarity = dz.forcedRarity;
    dz.forcedRarity = null;
  } else if (dz.level >= bl.minDumpsterLevel && dry >= drySpell(d)) {
    rarity = rollRarity(luck, rng, bl.minRarity);
  } else {
    rarity = rollRarity(luck, rng);
  }
  const slot = slotOverride ?? rollSlot(rng);
  const level = rollItemLevel(d.player.level, rng);
  const enchants = rollEnchants(rng, enchantChance(d), up.enchantTier);
  rarity = bumpRarity(rarity, rarityBump(enchants));
  const base = pickBaseItem(slot, theme, rarity, rng, d.rebirths, avoidBase);
  return createItem(base, rarity, level, theme, rng, d.nextItemUid++, enchants, itemTierFor(d));
}

/**
 * The luck tokens a reel lands on before its item, in order (usually none). The first comes with
 * `chance`; once one has landed, every re-roll lands another with `chainChance`.
 */
export function rollTokens(rng: Rng): number[] {
  const m = BAL.roll.multiplier;
  const pool = m.values.map((v) => [String(v.x), v.weight] as const);
  const out: number[] = [];
  while (out.length < m.maxSteps && rng.chance(out.length === 0 ? m.chance : m.chainChance)) out.push(Number(rng.weighted(pool)));
  return out;
}

/**
 * Seconds each luck token adds to its reel: the hold on the token, then a full re-roll as long as the
 * spin itself (a token never speeds the roll up).
 */
export function tokenStepSeconds(baseSpinSeconds: number): number {
  return BAL.roll.multiplier.holdSeconds + baseSpinSeconds;
}

/** Product of a reel's luck tokens (1 without any). */
export function tokenMult(mults: readonly number[]): number {
  return mults.reduce((a, b) => a * b, 1);
}

/** Starts a spin: rolls every reel's result. A Trash Bag, if there is one, pays for a faster turbo spin. */
export function startSpin(d: GameState, rng: Rng, now: number, ev: CoreEvent[]): void {
  const turbo = d.currencies.bags >= 1;
  if (turbo) d.currencies.bags -= 1;
  const { lucky, golden, luck } = rollSpinLuck(d, rng, now);
  const cycle = spinCycle(d, turbo);
  const baseSpinSeconds = cycle * spinShare();
  // The tutorial scripts two spins: the very first (rollReelItem gives the tutorial item) and, a little
  // later, beginner's luck: its first reel chains BAL.tutorial's tokens into a rare item. The reels
  // rest on either find while it waits in the bag to be put on (rollTick ends the rest when it goes).
  const scripted = !d.dumpster.firstDiveDone ? 'first' : beginnerLuckDue(d) ? 'beginner' : null;
  const restSeconds = scripted ? Math.max(cycle - baseSpinSeconds, BAL.tutorial.holdSeconds) : cycle - baseSpinSeconds;
  const stepSeconds = tokenStepSeconds(baseSpinSeconds);
  const reels: { item: Item; odds: number; mults: number[]; landAt: number; landed: boolean }[] = [];
  let dry = d.dumpster.dryStreak;
  for (let i = 0, n = reelCount(d); i < n; i++) {
    // No tokens on the tutorial spin or a forced (debug) roll; dev cheats can force a chain.
    let mults = d.dumpster.firstDiveDone && !d.dumpster.forcedRarity ? rollTokens(rng) : [];
    if (d.dumpster.forcedTokens) {
      mults = d.dumpster.forcedTokens;
      d.dumpster.forcedTokens = null;
    }
    const beginner = scripted === 'beginner' && i === 0;
    if (beginner) {
      mults = [...BAL.tutorial.beginnerTokens];
      d.dumpster.forcedRarity = BAL.tutorial.beginnerRarity;
    }
    // Beginner's luck lands in the tutorial item's slot: it upgrades what the raccoon got first.
    const tut = BAL.dumpster.tutorialItem.baseId;
    const slot = beginner ? DATA.itemsById.get(tut)?.slot : undefined;
    const item = rollReelItem(d, rng, luck * tokenMult(mults), dry, slot, beginner ? tut : undefined);
    if (beginner) d.dumpster.beginner = { state: 'rolled', uid: item.uid };
    dry = rarityAtLeast(item.rarity, BAL.dumpster.badLuck.minRarity) ? 0 : dry + 1;
    reels.push({ item, odds: itemOddsOneIn(item), mults, landAt: baseSpinSeconds + mults.length * stepSeconds, landed: false });
  }
  const spinSeconds = Math.max(...reels.map((r) => r.landAt));
  d.roll.current = { reels, lucky, golden, luck, turbo, spinSeconds, baseSpinSeconds, stepSeconds, restSeconds, landed: false, scripted };
  d.roll.timer = 0;
  ev.push({
    type: 'spinStart',
    reels: reels.map((r) => ({ item: snap(r.item), odds: r.odds, mults: [...r.mults], landAt: r.landAt })),
    lucky, golden, luck, turbo, spinSeconds, baseSpinSeconds, stepSeconds, restSeconds,
    ...(scripted ? { scripted } : {}),
  });
}

/**
 * Whether this spin is beginner's luck (BAL.tutorial): new games only, before the first rebirth, once
 * the raccoon has dressed up (the tutorial's Equip best) and a few items have rolled, or a few more
 * regardless.
 */
export function beginnerLuckDue(d: GameState): boolean {
  const t = BAL.tutorial;
  if (d.dumpster.beginner.state !== 'pending' || d.rebirths > 0) return false;
  return d.roll.count >= t.beginnerAtRolls || (d.roll.count >= t.beginnerAfterRolls && d.lifetime.itemsEquipped >= t.beginnerAfterEquips);
}

/**
 * Reels stop: every reel due by `upTo` seconds into the spin (all of them by default) lands its
 * item: records, Codex, then bag or scrap.
 */
function landSpin(d: GameState, ev: CoreEvent[], upTo = Infinity): void {
  const spin = d.roll.current;
  if (!spin || spin.landed) return;
  const dz = d.dumpster;
  spin.reels.forEach((r, reel) => {
    if (r.landed || (r.landAt ?? spin.spinSeconds) > upTo + 1e-9) return;
    r.landed = true;
    const mult = tokenMult(r.mults);
    const item = snap(r.item);
    d.roll.count += 1;
    dz.totalDives += 1;
    dz.dryStreak = rarityAtLeast(item.rarity, BAL.dumpster.badLuck.minRarity) ? 0 : dz.dryStreak + 1;
    const newRecord = r.odds > d.records.bestOdds;
    if (newRecord) {
      d.records.bestOdds = r.odds;
      d.records.bestItemName = itemName(item);
      d.records.bestRarity = item.rarity;
    }
    const placed = decidePlacement(d, item);
    ev.push({
      type: 'roll', item, reel, lucky: spin.lucky, golden: spin.golden, source: spin.turbo ? 'turbo' : 'free', odds: r.odds,
      luck: spin.luck * mult, mult, placed, newRecord, ...(spin.scripted && reel === 0 ? { scripted: spin.scripted } : {}),
    });
    registerCodex(d, item, ev);
    if (placed === 'bag') addToBag(d, item, ev);
    else scrapItem(d, item, ev, true);
  });
  spin.landed = spin.reels.every((r) => r.landed);
}

/** True when `item` would beat what is equipped in its slot (or the slot is empty). */
export function isUpgrade(state: Pick<GameState, 'equipped'>, item: Item): boolean {
  const cur = state.equipped[item.slot];
  return !cur || item.power > cur.power;
}

/** One whole spin right now (start and landing at once); returns every reel's item. Used by tests and tools. */
export function performSpin(d: GameState, rng: Rng, now: number, ev: CoreEvent[]): Item[] {
  if (d.roll.current && !d.roll.current.landed) landSpin(d, ev);
  startSpin(d, rng, now, ev);
  const items = d.roll.current!.reels.map((r) => snap(r.item));
  landSpin(d, ev);
  d.roll.current = null;
  d.roll.timer = 0;
  return items;
}

/** One whole spin right now; returns the first reel's item. Used by tests and tools. */
export function performRoll(d: GameState, rng: Rng, now: number, ev: CoreEvent[]): Item {
  return performSpin(d, rng, now, ev)[0];
}

/** When the next reel of the current spin lands (seconds into the spin), or Infinity once all have. */
function nextLanding(cur: NonNullable<GameState['roll']['current']>): number {
  let at = Infinity;
  if (cur.landed) return at;
  for (const r of cur.reels) if (!r.landed) at = Math.min(at, r.landAt ?? cur.spinSeconds);
  return at;
}

/** Advances the reels by `dt` seconds: spin, land (reel by reel), rest, spin again. */
export function rollTick(d: GameState, rng: Rng, now: number, ev: CoreEvent[], dt: number): void {
  let t = dt;
  for (let guard = 0; guard < BAL.roll.maxRollsPerTick * (BAL.roll.maxReels + 2) + 2; guard++) {
    if (!d.roll.current) startSpin(d, rng, now, ev);
    const cur = d.roll.current!;
    // A tutorial find holds the reels (startSpin's long rest) until it leaves the bag: put on or scrapped.
    if (cur.scripted && cur.landed && !d.inventory.some((x) => x.uid === cur.reels[0].item.uid)) {
      cur.restSeconds = Math.min(cur.restSeconds, Math.max(0, d.roll.timer - cur.spinSeconds));
    }
    const total = cur.spinSeconds + cur.restSeconds;
    const land = nextLanding(cur);
    const step = Math.max(0, Math.min(t, Math.min(land, total) - d.roll.timer));
    d.roll.timer += step;
    t -= step;
    if (!cur.landed && d.roll.timer >= land - 1e-9) {
      landSpin(d, ev, d.roll.timer);
      continue;
    }
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

/** For each slot, the bag item that beats what's worn there by the most (none if nothing does). */
export function bestUpgrades(state: Pick<GameState, 'inventory' | 'equipped'>): Item[] {
  const best = new Map<string, Item>();
  for (const it of state.inventory) {
    if (!isUpgrade(state, it)) continue;
    const cur = best.get(it.slot);
    if (!cur || it.power > cur.power) best.set(it.slot, it);
  }
  return [...best.values()];
}

/** Equips the biggest upgrade in every slot at once; returns how many slots changed. */
export function equipBest(d: GameState, ev: CoreEvent[]): number {
  const picks = bestUpgrades(d);
  for (const it of picks) equipFromBag(d, it.uid, ev);
  return picks.length;
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
    // Scrapping the beginner's luck item ends the tutorial (without its gems).
    if (d.dumpster.beginner.uid === it.uid) d.dumpster.beginner = { state: 'done', uid: null };
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
