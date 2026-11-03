/**
 * When each reel of a spin stops, shared by the Roll tab's reels, the Watch tab and the roll sounds.
 *
 * Reels stop left to right over the spin's base time (BAL.feel.reels.firstStopShare), except that an
 * Epic-or-better result always stops last. A reel with luck tokens stops on each token first: it holds
 * there while the token bursts, spins up again, and stops one token step (core stepSeconds) later,
 * until it stops on its item. Core lands the item at baseSpinSeconds + tokens x stepSeconds, so the
 * reel never shows a result before core has it.
 */
import { BAL } from '../data';
import { rarityAtLeast, rarityIndex, type Item } from '../core';

export interface SpinTiming {
  reels: ReadonlyArray<{ item: Pick<Item, 'rarity'>; mults?: readonly number[] }>;
  spinSeconds: number;
  baseSpinSeconds?: number;
  stepSeconds?: number;
}

export interface ReelStop {
  /** Milliseconds after the spin starts. */
  at: number;
  /** The token's multiplier, or null for the item. */
  token: number | null;
}

/** Share of the hold on a token (the rest of a token step is the spin up to the next stop). */
export const TOKEN_HOLD = 0.42;

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

/** When reel `i` stops on its item (ms after the spin starts). */
export function itemStopMs(spin: SpinTiming, i: number): number {
  const stops = reelStops(spin, i);
  return stops[stops.length - 1].at;
}

/** Product of the tokens a reel lands on before its item (1 without any). */
export function multOf(mults: readonly number[] | undefined): number {
  return (mults ?? []).reduce((a, b) => a * b, 1);
}
