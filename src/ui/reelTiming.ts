/**
 * When each reel of a spin stops, shared by the Roll tab's reels, the Watch tab and the roll sounds.
 *
 * Reels stop left to right over the spin's base time (BAL.feel.reels.firstStopShare), except that an
 * Epic-or-better result always stops last. A reel with luck tokens stops on each token first: it holds
 * there while the token bursts (tokenHoldMs), then rolls again for a full spin's length and stops one
 * token step (core stepSeconds) later, until it stops on its item. Core lands the item at
 * baseSpinSeconds + tokens x stepSeconds, so the reel never shows a result before core has it.
 */
import { BAL } from '../data';
import { rarityAtLeast, rarityIndex, type Item } from '../core';

export interface SpinTiming {
  reels: ReadonlyArray<{ item: Pick<Item, 'rarity'>; mults?: readonly number[] }>;
  spinSeconds: number;
  baseSpinSeconds?: number;
  stepSeconds?: number;
  /** Token steps every reel landed the same token on (core matchedSteps): those count squared. */
  matched?: readonly number[];
}

export interface ReelStop {
  /** Milliseconds after the spin starts. */
  at: number;
  /** The token's multiplier, or null for the item. */
  token: number | null;
}

/**
 * How long a reel holds on a luck token before rolling again (ms). The re-roll that follows takes the
 * rest of the token step: as long as the spin itself, so a token never speeds the roll up.
 */
export function tokenHoldMs(): number {
  return BAL.roll.multiplier.holdSeconds * 1000;
}

/** The order reels stop in: left to right, the rarest last when it's Epic or better. */
export function stopOrder(spin: SpinTiming): number[] {
  const order = spin.reels.map((_, i) => i);
  const n = order.length;
  const rarest = order.reduce((a, b) => (rarityIndex(spin.reels[b].item.rarity) > rarityIndex(spin.reels[a].item.rarity) ? b : a), 0);
  if (n > 1 && rarityAtLeast(spin.reels[rarest].item.rarity, 'epic')) {
    order.splice(order.indexOf(rarest), 1);
    order.push(rarest);
  }
  return order;
}

/** Every stop of reel `i`: its tokens in order, then its item (the last entry). */
export function reelStops(spin: SpinTiming, i: number): ReelStop[] {
  const f = BAL.feel.reels;
  const n = spin.reels.length;
  const pos = stopOrder(spin).indexOf(i);
  const share = n === 1 ? 1 : f.firstStopShare + (1 - f.firstStopShare) * (pos / (n - 1));
  const base = (spin.baseSpinSeconds ?? spin.spinSeconds) * 1000;
  const step = (spin.stepSeconds ?? 0) * 1000;
  const mults = spin.reels[i].mults ?? [];
  const first = base * share;
  const stops: ReelStop[] = mults.map((x, j) => ({ at: first + j * step, token: x }));
  stops.push({ at: first + mults.length * step, token: null });
  return stops;
}

/** A luck token a spin lands on: which reel, its place among that reel's stops, when, and its value. */
export interface TokenStop {
  reel: number;
  /** Its index among the reel's stops (0 for the first token): a chain climbs with it. */
  step: number;
  at: number;
  x: number;
  /**
   * The reel's multiplier once it lands (this token times the ones before it on that reel, a matched
   * one squared once the last reel has landed it).
   */
  total: number;
  /** The last of a matched step's tokens to land: every reel's token of that step now counts squared. */
  match?: true;
}

/** Every luck token of a spin, in the order they land. */
export function tokenStops(spin: SpinTiming): TokenStop[] {
  const out: TokenStop[] = [];
  const matched = spin.matched ?? [];
  spin.reels.forEach((_, reel) => {
    reelStops(spin, reel).forEach((stop, step) => {
      if (stop.token === null) return;
      out.push({ reel, step, at: stop.at, x: stop.token, total: 1 });
    });
  });
  out.sort((a, b) => a.at - b.at || a.reel - b.reel);
  // A matched step completes when its last token lands; every token of an earlier step has landed
  // by then (a token step is longer than the reels' stagger).
  const completes = new Map<number, TokenStop>();
  for (const tk of out) if (matched.includes(tk.step)) completes.set(tk.step, tk);
  for (const tk of completes.values()) tk.match = true;
  for (const tk of out) {
    const mults = (spin.reels[tk.reel].mults ?? []).slice(0, tk.step + 1);
    const squared = matched.filter((k) => k < tk.step || (k === tk.step && tk.match));
    tk.total = multOf(mults, squared);
  }
  return out;
}

/** When reel `i` stops on its item (ms after the spin starts). */
export function itemStopMs(spin: SpinTiming, i: number): number {
  const stops = reelStops(spin, i);
  return stops[stops.length - 1].at;
}

/** Product of the tokens a reel lands on before its item, the `matched` steps squared (1 without any). */
export function multOf(mults: readonly number[] | undefined, matched: readonly number[] = []): number {
  return (mults ?? []).reduce((a, x, k) => a * (matched.includes(k) ? x * x : x), 1);
}
