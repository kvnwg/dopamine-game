/**
 * How big a deal a Scrap All haul is (Kevin: "late game, every single sell is seen as a big haul and
 * gets the animation, early game, i RARELY see one. please find a system to make it proportionate").
 * A haul is measured against the run's own hauls: their trend says what a usual haul is worth right
 * now, growth included (hauls grow a thousandfold in a run, so the last few alone would make every
 * new one look huge). Big, huge and mega hauls are feel.haul times that. It comes about once in
 * several sales at any point in the game, more often for a player who sells less often.
 */
import { BAL } from '../../data';
import type { GameState } from '../state';

export type HaulSize = 'big' | 'huge' | 'mega';

/**
 * Judges a Scrap All of `coins` against the run's trend of hauls and adds it to the trend. `usual` is
 * what a usual haul is worth now (null while the run has no trend yet). The game's very first haul is
 * a big one (it shows what Scrap All is for); the run's first feel.haul.warmup hauls only set the trend.
 */
export function judgeHaul(d: GameState, coins: number): { size: HaulSize | null; usual: number | null } {
  const h = BAL.feel.haul;
  const tr = d.haulTrend;
  if (tr.run !== d.rebirths) {
    tr.run = d.rebirths;
    tr.n = 0;
    tr.level = 0;
    tr.slope = 0;
  }
  const x = Math.log(Math.max(1, coins));
  const gap = Math.min(h.maxGapMinutes, Math.max(0, (d.playTimeMs - tr.atMs) / 60_000));
  let size: HaulSize | null = null;
  let usual: number | null = null;
  if (tr.n >= h.warmup) {
    const expected = tr.level + tr.slope * gap;
    usual = Math.exp(expected);
    const k = Math.exp(x - expected);
    size = k >= h.mega ? 'mega' : k >= h.huge ? 'huge' : k >= h.big ? 'big' : null;
  } else if (tr.n === 0 && d.rebirths === 0) {
    size = 'big';
  }
  // Holt's linear trend on the log of a haul, per minute of play.
  if (tr.n === 0) {
    tr.level = x;
    tr.slope = 0;
  } else {
    const expected = tr.level + tr.slope * gap;
    const level = h.trendWeight * x + (1 - h.trendWeight) * expected;
    if (gap > 0) tr.slope = h.slopeWeight * ((level - tr.level) / gap) + (1 - h.slopeWeight) * tr.slope;
    tr.level = level;
  }
  tr.n += 1;
  tr.atMs = d.playTimeMs;
  return { size, usual };
}
