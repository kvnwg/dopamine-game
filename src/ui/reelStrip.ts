/**
 * Reel strips for the Roll tab's reels. A strip is the column of cells a reel rolls through in one
 * spin: the last result at the bottom, fillers, then (for a reel that lands on luck tokens) each token
 * with more fillers after it, the result, and two cells on top.
 *
 * Fillers are a tease, not a sample: they lean much rarer than the real odds, with a near miss next to
 * most results (BAL.feel.reels), and now and then a token rolls past. They only show items the
 * raccoon has unlocked (never heist-only items). Only the landed results come from the real odds,
 * which the Luck popup lists.
 *
 * Motion (stripAt): each stretch kicks back a little, launches, cruises, brakes and clunks a little
 * past the line before settling on it, always arriving exactly at its stop time. A stretch marked
 * `slow` (a rare result's build-up, reelDrama.ts) brakes early into a long crawl toward the line.
 */
import { BAL, DATA, RARITIES, type Rarity } from '../data';
import { isItemUnlocked, rarityAtLeast, rarityChances, type Item } from '../core';
import { reelStops, tokenHoldMs, type SpinTiming } from './reelTiming';

export interface StripCell {
  /** Item art (base item id); unused for a token. */
  baseId: string;
  rarity: Rarity;
  odds: number;
  /** A real result (shown in color once landed), not a filler. */
  real: boolean;
  /** A luck token's multiplier, or null for an item. */
  token: number | null;
}

export interface StripStop {
  /** Index of the cell it stops on. */
  idx: number;
  /** Milliseconds after the spin starts. */
  at: number;
  token: number | null;
  /** 0 to 1: how much the approach to this stop slows into a crawl (a rare result's build-up). */
  slow?: number;
}

export interface Strip {
  cells: StripCell[];
  /** Tokens first, the item last. */
  stops: StripStop[];
}

export function hash(n: number): number {
  let h = Math.imul(n + 0x9e37, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return ((h >>> 0) % 100000) / 100000;
}

export const BASE_ODDS = (() => {
  const c = rarityChances(1);
  return Object.fromEntries(RARITIES.map((r) => [r, Math.max(1, Math.round(1 / c[r]))])) as Record<Rarity, number>;
})();

/** Odds of an enchanted roll at base chances (count I, tier I/II/III): used to dress up some fillers. */
function enchantFlair(u: number): number {
  const e = BAL.enchant;
  const countShare = e.countWeights[0] / e.countWeights.reduce((a, b) => a + b, 0);
  const tw = e.tierWeights.reduce((a, b) => a + b, 0);
  const tier = u < 0.6 ? 0 : u < 0.9 ? 1 : 2;
  return 1 / (e.baseChance * countShare * (e.tierWeights[tier] / tw));
}

function pickRarity(u: number, weights: Record<Rarity, number>): Rarity {
  const total = RARITIES.reduce((a, r) => a + weights[r], 0);
  let acc = 0;
  for (const r of RARITIES) {
    acc += weights[r] / total;
    if (u < acc) return r;
  }
  return 'junk';
}

const NEAR_MISS: Record<Rarity, number> = {
  junk: 0, decent: 0, shiny: 0, epic: 0, legendary: 50, mythic: 33, vintage: 30, limited: 26, prototype: 22, mint: 17, gemMint: 12, museum: 8, grail: 5,
};

/** The base items fillers may show: the ones unlocked at this many rebirths (heist-only items never roll). */
const pools = new Map<number, string[]>();
function pool(rebirths: number): string[] {
  let p = pools.get(rebirths);
  if (!p) {
    p = DATA.items.filter((i) => isItemUnlocked(i, rebirths) && !i.heist).map((i) => i.id);
    pools.set(rebirths, p);
  }
  return p;
}

const TOKEN_VALUES = BAL.roll.multiplier.values.map((v) => v.x);

/** A made-up cell rolling past: an item rarer than real odds, or (rarely) a luck token. */
export function filler(seed: number, nearMiss: boolean, rebirths: number, tokens = true): StripCell {
  const f = BAL.feel.reels;
  if (tokens && !nearMiss && hash(seed * 23 + 11) < BAL.roll.multiplier.chance * 0.2) {
    const x = TOKEN_VALUES[Math.floor(hash(seed * 29 + 4) * TOKEN_VALUES.length)];
    return { baseId: '', rarity: 'junk', odds: 1, real: false, token: x };
  }
  const rarity = pickRarity(hash(seed * 7 + 1), nearMiss ? NEAR_MISS : f.fillerWeights);
  const ids = pool(rebirths);
  const baseId = ids[Math.floor(hash(seed * 13 + 5) * ids.length)];
  let odds = BASE_ODDS[rarity];
  if (rarityAtLeast(rarity, 'epic') && hash(seed * 17 + 9) < f.flairChance) odds = Math.round(odds * enchantFlair(hash(seed * 19 + 3)));
  return { baseId, rarity, odds, real: false, token: null };
}

export function resultCell(item: Pick<Item, 'baseId' | 'rarity'>, odds: number): StripCell {
  return { baseId: item.baseId, rarity: item.rarity, odds, real: true, token: null };
}

function tokenCell(x: number): StripCell {
  return { baseId: '', rarity: 'junk', odds: 1, real: true, token: x };
}

/**
 * Reel `i`'s strip for a spin: starts from `prev` (the cell it rested on), rolls through fillers to
 * each token and finally its item. `cellsPerSecond` sets how many cells pass per second of travel.
 * `slow` (0 to 1) makes the last approach crawl (reelDrama.ts); that stretch gets fewer cells so its
 * shorter cruise stays a readable speed.
 */
export function buildStrip(
  spin: SpinTiming & { reels: ReadonlyArray<{ item: Item; odds: number; mults?: readonly number[] }> },
  i: number,
  prev: StripCell | undefined,
  rebirths: number,
  cellsPerSecond = BAL.feel.reels.cellsPerSecond,
  slow = 0,
): Strip {
  const f = BAL.feel.reels;
  const r = spin.reels[i];
  const timeline = reelStops(spin, i);
  const seed = r.item.uid * 97 + i * 13;
  const tease = !rarityAtLeast(r.item.rarity, 'legendary') && hash(seed + 77) < f.nearMissChance;
  const above = hash(seed + 91) < 0.5;
  const cells: StripCell[] = [prev ?? filler(seed, false, rebirths, false)];
  const stops: StripStop[] = [];
  let from = 0;
  timeline.forEach((st, j) => {
    const startAt = j === 0 ? 0 : Math.min(st.at, timeline[j - 1].at + tokenHoldMs());
    const secs = (st.at - startAt) / 1000;
    const last = j === timeline.length - 1;
    const crawl = last ? slow : 0;
    const k = Math.max(j === 0 ? f.minCells : 4, Math.round(secs * cellsPerSecond * (1 - 0.4 * crawl)));
    for (let c = 1; c < k; c++) cells.push(filler(seed + j * 977 + c * 31, last && tease && !above && c === k - 1, rebirths, !last || c < k - 2));
    cells.push(st.token === null ? resultCell(r.item, r.odds) : tokenCell(st.token));
    from += k;
    stops.push({ idx: from, at: st.at, token: st.token, ...(crawl > 0 ? { slow: crawl } : {}) });
  });
  cells.push(filler(seed + 7001, tease && above, rebirths, false));
  cells.push(filler(seed + 7002, false, rebirths, false));
  return { cells, stops };
}

/** Samples per travel curve. */
const SAMPLES = 240;
const curves = new Map<string, Float32Array>();

/** The wind-up before a stretch launches (ms, at most): the reel kicks back, then lets go. */
function kickMs(ms: number): number {
  return Math.min(150, ms * 0.12);
}

/**
 * Where a reel is along a stretch of `k` cells lasting `ms`, sampled at SAMPLES + 1 evenly spaced
 * moments: it waits out most of the wind-up, speeds up (about 0.18 s), cruises, then brakes onto the
 * line, still moving a little when it gets there (the clunk takes over). `slow` brakes earlier and
 * harder into a long crawl.
 */
function curve(k: number, ms: number, slow: number): Float32Array {
  const key = `${k}|${Math.round(ms)}|${slow}`;
  const hit = curves.get(key);
  if (hit) return hit;
  const hold = (0.55 * kickMs(ms)) / ms;
  const ramp = Math.min(0.15, 180 / ms);
  const brakeAt = 0.5 - 0.27 * slow;
  const tail = 0.1 - 0.09 * slow;
  const bend = 2 + 1.5 * slow;
  const speed = (x: number) => {
    if (x < hold) return 0;
    if (x < hold + ramp) {
      const u = (x - hold) / ramp;
      return u * u * (3 - 2 * u);
    }
    if (x < brakeAt) return 1;
    return tail + (1 - tail) * Math.pow(1 - (x - brakeAt) / (1 - brakeAt), bend);
  };
  const out = new Float32Array(SAMPLES + 1);
  let acc = 0;
  let v0 = speed(0);
  for (let s = 1; s <= SAMPLES; s++) {
    const v1 = speed(s / SAMPLES);
    acc += (v0 + v1) / 2;
    out[s] = acc;
    v0 = v1;
  }
  for (let s = 0; s <= SAMPLES; s++) out[s] = (out[s] / acc) * k;
  if (curves.size > 96) curves.clear();
  curves.set(key, out);
  return out;
}

/**
 * Cells travelled `t` ms into a stretch of `k` cells lasting `ms`: a little kick back before the
 * launch (the wind-up), the travel curve, and a clunk a little past the line that settles exactly
 * on it at the stop time.
 */
function travel(k: number, t: number, ms: number, slow: number): number {
  if (t >= ms) return k;
  const c = curve(k, ms, slow);
  const f = (t / ms) * SAMPLES;
  const s = Math.floor(f);
  let p = c[s] + (c[Math.min(SAMPLES, s + 1)] - c[s]) * (f - s);
  const kick = kickMs(ms);
  if (t < kick) p -= 0.16 * Math.sin((Math.PI * t) / kick) ** 2;
  const clunk = Math.min(130, ms * 0.1);
  if (t > ms - clunk) p += (0.17 - 0.07 * slow) * Math.sin((Math.PI * (t - (ms - clunk))) / clunk);
  return p;
}

/**
 * Where a strip is `ms` into the spin: `p` in cells from the bottom (fractional while moving) and how
 * many stops it has reached. Between stops it holds on a token, then rolls on to the next stop.
 * `calm` (Reduce motion): the strip doesn't move; each stop just shows.
 */
export function stripAt(strip: Strip, ms: number, calm = false): { p: number; reached: number } {
  let prevIdx = 0;
  let prevAt = 0;
  for (let j = 0; j < strip.stops.length; j++) {
    const st = strip.stops[j];
    const startAt = j === 0 ? 0 : Math.min(st.at, prevAt + tokenHoldMs());
    if (ms < st.at) {
      if (ms <= startAt) return { p: prevIdx, reached: j };
      const k = st.idx - prevIdx;
      return { p: prevIdx + (calm ? 0 : travel(k, ms - startAt, Math.max(1, st.at - startAt), st.slow ?? 0)), reached: j };
    }
    prevIdx = st.idx;
    prevAt = st.at;
  }
  return { p: prevIdx, reached: strip.stops.length };
}

/** When the stretch leading to stop `j` starts (ms after the spin starts): 0, or right after the token hold before it. */
export function stretchStart(strip: Strip, j: number): number {
  if (j <= 0) return 0;
  return Math.min(strip.stops[j].at, strip.stops[j - 1].at + tokenHoldMs());
}
