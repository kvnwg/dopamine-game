/**
 * Where a spin's luck tokens end up: a row near the top of the battle for each reel that lands any,
 * its clovers side by side and its running total after them (BattleScene draws the rows). A token
 * that lands on a reel flies out of it and slams into its place in its row (TokenFlight.tsx), so both
 * sides take the places from here. The battle view is drawn 1:1 at the stage's top left, so battle
 * px are stage px.
 */
import { P } from './pixel';
import { VIEW } from './pixel/sceneryTypes';

export const LUCK_ROWS = {
  /** The first row's middle and the rows' pitch (art px): under the gold and XP pop-ups under the top bar. */
  top: 35,
  pitch: 19,
  /** Between one clover and the next (art px). */
  gap: 18,
  /** The row sits this far left of the middle, leaving room for its total on the right (art px). */
  totalRoom: 12,
} as const;

/**
 * A token's flight from its reel into its row (ms): it pops out, then flies and slams in. The row
 * shows it when it lands; with Reduce motion there is no flight and it shows at once.
 */
export const TOKEN_FLIGHT = { pop: 90, fly: 300 } as const;
export const TOKEN_FLIGHT_MS = TOKEN_FLIGHT.pop + TOKEN_FLIGHT.fly;

const snap = (v: number) => Math.round(v / P) * P;

/** The middle of token `k` (from 0) in row `row` once the row holds `n` tokens (battle px). */
export function luckSlot(row: number, k: number, n: number): { x: number; y: number } {
  const gap = LUCK_ROWS.gap * P;
  const left = snap((VIEW.w * P) / 2 - ((n - 1) * gap) / 2 - LUCK_ROWS.totalRoom * P);
  return { x: left + k * gap, y: (LUCK_ROWS.top + row * LUCK_ROWS.pitch) * P };
}

/**
 * The flight keeps the clock: it tells the battle when a token slams into its row (`land`, with the
 * token's key, tokenFx.ts tokenKey), and the battle shows it then. A token nothing flies (Reduce
 * motion, a covered row) is shown when tokenFx calls `land` as it lands on its reel; the battle also
 * shows any it hasn't been told about a little after its flight would have ended.
 */
export const luckBridge: { land?: (key: string) => void } = {};

/** Each reel's row: the reels that land tokens take a row each, in order; -1 for a reel without any. */
export function luckRowsOf(reels: ReadonlyArray<{ mults?: readonly number[] }>): number[] {
  let row = 0;
  return reels.map((r) => ((r.mults?.length ?? 0) > 0 ? row++ : -1));
}
