import { describe, expect, it } from 'vitest';
import { isItemUnlocked, performSpin, Rng, type CoreEvent, type GameState } from '../src/core';
import { DATA } from '../src/data';
import { itemStopMs, reelStops, stopOrder } from '../src/ui/reelTiming';
import { buildStrip, filler, stripAt } from '../src/ui/reelStrip';
import { freshState, T0 } from './helpers';

type SpinStart = Extract<CoreEvent, { type: 'spinStart' }>;

function spinWith(mults: number[][], extraReels = 0, seed = 3): SpinStart {
  const st = structuredClone(freshState()) as GameState;
  st.dumpster.firstDiveDone = true;
  st.currencies.bags = 0;
  st.upgrades.extraReel = extraReels;
  const ev: CoreEvent[] = [];
  // Force each reel's tokens in turn through the dev cheat's field.
  st.dumpster.forcedTokens = mults[0] ?? null;
  performSpin(st, new Rng(seed), T0, ev);
  return ev.find((e): e is SpinStart => e.type === 'spinStart')!;
}

describe('reel timing (Roll and Watch tabs)', () => {
  it('a reel shows its item no later than core lands it, tokens first, one step apart', () => {
    const spin = spinWith([[2, 5]], 2);
    expect(spin.reels.length).toBe(3);
    spin.reels.forEach((r, i) => {
      const stops = reelStops(spin, i);
      expect(stops.length).toBe(r.mults.length + 1);
      expect(stops.slice(0, -1).map((s) => s.token)).toEqual(r.mults);
      expect(stops[stops.length - 1].token).toBeNull();
      for (let j = 1; j < stops.length; j++) expect(stops[j].at - stops[j - 1].at).toBeCloseTo(spin.stepSeconds * 1000);
      expect(itemStopMs(spin, i)).toBeLessThanOrEqual(r.landAt * 1000 + 1e-6);
    });
  });

  it('an Epic-or-better result stops last', () => {
    const fake = {
      spinSeconds: 2, reels: [{ item: { rarity: 'legendary' as const } }, { item: { rarity: 'junk' as const } }, { item: { rarity: 'decent' as const } }],
    };
    expect(stopOrder(fake)).toEqual([1, 2, 0]);
    expect(itemStopMs(fake, 0)).toBeGreaterThan(itemStopMs(fake, 2));
  });

  it('a strip stops on each token cell, then the result; stripAt reaches them on time', () => {
    const spin = spinWith([[3, 2]]);
    const strip = buildStrip(spin, 0, undefined, 0);
    expect(strip.stops.map((s) => s.token)).toEqual([3, 2, null]);
    strip.stops.forEach((s, j) => {
      const cell = strip.cells[s.idx];
      if (j < 2) expect(cell.token).toBe(s.token);
      else expect(cell.real && cell.token === null && cell.baseId === spin.reels[0].item.baseId).toBe(true);
      expect(stripAt(strip, s.at - 1).reached).toBe(j);
      expect(stripAt(strip, s.at + 1).reached).toBe(j + 1);
      expect(stripAt(strip, s.at + 1).p).toBe(s.idx);
    });
    // While holding on a token it doesn't move.
    const hold = stripAt(strip, strip.stops[0].at + 50);
    expect(hold.p).toBe(strip.stops[0].idx);
  });

  it('fillers only show items the raccoon has unlocked', () => {
    for (let seed = 0; seed < 500; seed++) {
      const c = filler(seed, seed % 3 === 0, 0, false);
      expect(isItemUnlocked(DATA.itemsById.get(c.baseId)!, 0)).toBe(true);
    }
  });
});
