/**
 * Luck: rarities are "1 in X" chances (RNG-game style). A roll checks tiers from rarest to
 * commonest; each succeeds with probability min(1, luck / X). Luck comes from upgrades, the
 * Dumpster Level, Lucky enchantments, rebirths, luck boosts, and every Nth "lucky roll".
 */
import { BAL, RARITIES, type Rarity } from '../../data';
import type { Rng } from '../rng';
import type { GameState } from '../state';
import { rarityAtLeast } from '../util';
import { combatEffects, enchantTierWeights } from './enchants';
import { perkLuckMult } from './perks';
import { upgradeEffects } from './upgrades';

export const RARITY_ODDS: Record<Rarity, number> = { junk: 1, ...BAL.rarityOdds };

export interface LuckBreakdown {
  upgrades: number;
  dumpster: number;
  enchants: number;
  rebirthMult: number;
  boostMult: number;
  boostEndsAt: number | null;
  /** Carb Loading (an Alley perk): luck for every uneaten loaf. */
  perkMult: number;
  total: number;
}

export function luckBreakdown(state: GameState, now: number): LuckBreakdown {
  const upgrades = upgradeEffects(state).luck;
  const dumpster = (state.dumpster.level - 1) * BAL.dumpster.luckPerLevel;
  const enchants = combatEffects(state).luck;
  const rebirthMult = 1 + state.rebirths * BAL.rebirth.luckPer;
  const boosting = state.luckBoostEndsAt !== null && now < state.luckBoostEndsAt;
  const boostMult = boosting ? BAL.luck.potion.mult : 1;
  const perkMult = perkLuckMult(state);
  const total = (1 + upgrades + dumpster + enchants) * rebirthMult * boostMult * perkMult;
  return { upgrades, dumpster, enchants, rebirthMult, boostMult, boostEndsAt: boosting ? state.luckBoostEndsAt : null, perkMult, total };
}

export function currentLuck(state: GameState, now: number): number {
  return luckBreakdown(state, now).total;
}

/** Every Nth roll is a lucky roll with boosted luck. */
export function luckyEvery(state: GameState): number {
  return Math.max(BAL.roll.luckyRollMinEvery, BAL.roll.luckyRollEvery - upgradeEffects(state).luckyEvery);
}

/** Exact probability of each rarity at a given luck. */
export function rarityChances(luck: number, minRarity: Rarity = 'junk'): Record<Rarity, number> {
  const out = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
  let remaining = 1;
  for (let i = RARITIES.length - 1; i >= 1; i--) {
    const r = RARITIES[i];
    if (!rarityAtLeast(r, minRarity)) break;
    const p = Math.min(1, luck / RARITY_ODDS[r]);
    out[r] = remaining * p;
    remaining *= 1 - p;
  }
  out[minRarity] += remaining;
  return out;
}

/**
 * "1 in X" for an item: the chance, at base luck, of rolling its rarity together with its
 * enchantments (their count and tiers, at the base enchant chance). Shown on every item.
 */
export function itemOddsOneIn(item: { rarity: Rarity; enchants: Array<{ tier: number }> }): number {
  return Math.max(1, Math.round(1 / (rarityChances(1)[item.rarity] * enchantOdds(item.enchants))));
}

/** The chance of rolling exactly these enchantments (their count and tiers) at the base enchant chance. */
function enchantOdds(enchants: Array<{ tier: number }>): number {
  const n = enchants.length;
  if (n === 0) return 1;
  const e = BAL.enchant;
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  let p = e.baseChance * (e.countWeights[Math.min(n, e.countWeights.length) - 1] / sum(e.countWeights));
  for (const en of enchants) p *= e.tierWeights[en.tier - 1] / sum(e.tierWeights);
  return p;
}

/**
 * How rare a roll is for the raccoon that rolled it: "1 in X" for its tier or better at `luck`
 * (enchantments at their base odds, as in itemOddsOneIn). A Legendary is a 1 in 1,000 event at
 * luck 1 but only 1 in 100 at luck 10, so the big reveal follows what is rare for you right now.
 */
export function luckOddsOneIn(item: { rarity: Rarity; enchants: Array<{ tier: number }> }, luck: number): number {
  const c = rarityChances(Math.max(1, luck));
  let p = 0;
  for (const r of RARITIES) if (rarityAtLeast(r, item.rarity)) p += c[r];
  return Math.max(1, Math.round(1 / (p * enchantOdds(item.enchants))));
}

export type RollDrama = 'big' | 'huge' | 'insane';
const DRAMAS: RollDrama[] = ['big', 'huge', 'insane'];

/** The chance of enchantments as good as these (their count and tiers) at the raccoon's own enchant chance and mastery now. */
function enchantOddsNow(state: Pick<GameState, 'upgrades'>, enchants: Array<{ tier: number }>): number {
  const n = enchants.length;
  if (n === 0) return 1;
  const e = BAL.enchant;
  const up = upgradeEffects(state);
  const chance = Math.min(1, e.baseChance + up.enchantChance);
  const tiers = enchantTierWeights(up.enchantTier);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  let p = chance * (e.countWeights[Math.min(n, e.countWeights.length) - 1] / sum(e.countWeights));
  for (const en of enchants) p *= tiers[en.tier - 1] / sum(tiers);
  return p;
}

/**
 * How rare a find is for the raccoon right now, as "1 in X": its tier or better at his luck, times
 * its enchantments at his own enchant chance and mastery (so enchantments he rolls all the time
 * don't make a find special). Only compared with other finds (judgeFinds), never shown.
 */
export function findScore(state: Pick<GameState, 'upgrades'>, item: { rarity: Rarity; enchants: Array<{ tier: number }> }, luck: number): number {
  return luckOddsOneIn({ rarity: item.rarity, enchants: [] }, luck) / enchantOddsNow(state, item.enchants);
}

/**
 * Which finds of a spin get the full-screen reveal and how big, and how much the spin builds up
 * (Kevin: "late game ... every single [one] gets the animation, early game, i RARELY see one. please
 * find a system to make it proportionate"). A find gets the reveal when it is rarer for the raccoon
 * (findScore) than anything he found in the last few minutes of play (feel.bigRoll.windowMinutes:
 * big), the last hour or so (huge) or the last several hours (insane), and its tier is uncommon at
 * his luck. However fast he rolls and however lucky he is, that comes about every few minutes, early
 * and late alike. The build-up works the same over shorter windows (feel.buildUp). The finds are then
 * added to the ones watched (roll.rare). Nothing is judged in a new game's first couple of minutes
 * (feel.bigRoll.minHistoryMinutes): the tutorial scripts its own reveals.
 */
export function judgeFinds(
  d: GameState,
  finds: ReadonlyArray<{ rarity: Rarity; enchants: Array<{ tier: number }> }>,
  luck: number,
): { drama: Array<RollDrama | null>; tease: 0 | 1 | 2 } {
  const b = BAL.feel.bigRoll;
  const bu = BAL.feel.buildUp;
  const now = d.playTimeMs;
  const watch = d.roll.rare;
  watch.since ??= now;
  const l = Math.max(1, luck);
  const MIN = 60_000;
  const watched = now - watch.since;
  const longest = Math.max(...b.windowMinutes, ...bu.windowMinutes) * MIN;
  watch.hist = watch.hist.filter(([at]) => at >= now - longest);
  /** The rarest find of the last `ms` (0 if none). The history is rarest first, so the first one in the window is it. */
  const rarestSince = (ms: number) => watch.hist.find(([at]) => at >= now - ms)?.[1] ?? 0;
  /** How many of `windows` (minutes, shortest first) this find beats, each counting once the watch covers enough of it. */
  const beats = (score: number, windows: readonly number[]) => {
    let k = 0;
    for (const w of windows) {
      const ms = w * MIN;
      if (watched < Math.min(ms, Math.max(b.minHistoryMinutes * MIN, ms * b.coverShare))) break;
      if (score <= rarestSince(ms)) break;
      k++;
    }
    return k;
  };
  const scores = finds.map((f) => findScore(d, f, l));
  const drama = finds.map((f, i) => {
    if (luckOddsOneIn({ rarity: f.rarity, enchants: [] }, l) < b.tierOneIn) return null;
    const k = beats(scores[i], b.windowMinutes);
    return k > 0 ? DRAMAS[k - 1] : null;
  });
  let tease: 0 | 1 | 2 = 0;
  finds.forEach((f, i) => {
    if (luckOddsOneIn({ rarity: f.rarity, enchants: [] }, l) < bu.tierOneIn) return;
    tease = Math.max(tease, beats(scores[i], bu.windowMinutes)) as 0 | 1 | 2;
  });
  // Watched from now on: each find drops the ones before it that it's at least as rare as.
  for (const sc of scores) {
    while (watch.hist.length > 0 && watch.hist[watch.hist.length - 1][1] <= sc) watch.hist.pop();
    watch.hist.push([now, sc]);
  }
  if (watch.hist.length > b.historyMax) watch.hist.splice(0, watch.hist.length - b.historyMax);
  return { drama, tease };
}

/**
 * What the reveal takes at this luck, for the luck popup: a find whose tier is at least `rarity`
 * (1 in feel.bigRoll.tierOneIn at this luck), rarer than everything in the last `minutes`.
 */
export function revealBar(luck: number): { rarity: Rarity; minutes: number } {
  const l = Math.max(1, luck);
  const rarity = RARITIES.find((r) => luckOddsOneIn({ rarity: r, enchants: [] }, l) >= BAL.feel.bigRoll.tierOneIn) ?? RARITIES[RARITIES.length - 1];
  return { rarity, minutes: BAL.feel.bigRoll.windowMinutes[0] };
}

/** Rolls a rarity: tiers are tried from rarest down; anything below `minRarity` is never rolled. */
export function rollRarity(luck: number, rng: Rng, minRarity: Rarity = 'junk'): Rarity {
  for (let i = RARITIES.length - 1; i >= 1; i--) {
    const r = RARITIES[i];
    if (!rarityAtLeast(r, minRarity)) break;
    if (rng.chance(Math.min(1, luck / RARITY_ODDS[r]))) return r;
  }
  return minRarity;
}
