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
import { comboValue, rarityAtLeast, rarityIndex, tokenMult, type Item } from '../core';

export interface SpinTiming {
  reels: ReadonlyArray<{ item: Pick<Item, 'rarity'>; mults?: readonly number[] }>;
  spinSeconds: number;
  baseSpinSeconds?: number;
  stepSeconds?: number;
  /**
   * Token steps two or more reels landed a token on together (core comboSteps): a combo, each of
   * those reels counting the product of all that step's tokens once the last of them has landed.
   */
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
   * The reel's multiplier once it lands (this token times the ones before it on that reel, a combo's
   * counting the whole combo once the last reel of it has landed).
   */
  total: number;
  /** The last of a combo step's tokens to land: every reel of that step now counts their product. */
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
  // A combo step completes when its last token lands; every token of an earlier step has landed by
  // then (a token step is longer than the reels' stagger).
  const completes = new Map<number, TokenStop>();
  for (const tk of out) if (matched.includes(tk.step)) completes.set(tk.step, tk);
  for (const tk of completes.values()) tk.match = true;
  const all = spin.reels.map((r) => r.mults ?? []);
  for (const tk of out) {
    const done = matched.filter((k) => k < tk.step || (k === tk.step && tk.match));
    tk.total = tokenMult(all, tk.reel, done, tk.step + 1);
  }
  return out;
}

/** The reels in combo step `k` (those landing a token then), each one's token, and their product. */
export function comboOf(spin: { reels: ReadonlyArray<{ mults?: readonly number[] }> }, k: number): { reels: number[]; values: number[]; product: number } {
  const all = spin.reels.map((r) => r.mults ?? []);
  const reels = all.map((m, i) => (m.length > k ? i : -1)).filter((i) => i >= 0);
  return { reels, values: reels.map((i) => all[i][k]), product: comboValue(all, k) };
}

/**
 * Reel `reel`'s luck multiplier after its first `steps` tokens (all by default), the `combos` steps
 * counting their whole combo (core tokenMult).
 */
export function chainMult(spin: { reels: ReadonlyArray<{ mults?: readonly number[] }> }, reel: number, combos: readonly number[] = [], steps = Infinity): number {
  return tokenMult(spin.reels.map((r) => r.mults ?? []), reel, combos, steps);
}

/** When reel `i` stops on its item (ms after the spin starts). */
export function itemStopMs(spin: SpinTiming, i: number): number {
  const stops = reelStops(spin, i);
  return stops[stops.length - 1].at;
}
