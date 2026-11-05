import { describe, expect, it } from 'vitest';
import { judgeFinds, Rng, tick, type CoreEvent, type GameState } from '../src/core';
import type { Rarity } from '../src/data';
import { freshState, T0 } from './helpers';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** A new game past its tutorial spins (its finds watched long enough to be judged), with Trash Bags for turbo spins. */
function bagsState(bags: number): GameState {
  const st = clone(freshState(7));
  st.dumpster.firstDiveDone = true;
  st.dumpster.beginner = { state: 'done', uid: null };
  st.currencies.bags = bags;
  st.playTimeMs = 60 * 60_000;
  st.roll.rare = { since: 0, hist: [], best: 0 };
  return st;
}

/** Whether a spin builds up (the core's judgement it carries). */
const buildsUp = (e: Extract<CoreEvent, { type: 'spinStart' }>) => e.tease > 0 || e.reels.some((r) => r.drama !== null);

/** Ticks until the next spin starts: its spinStart event and the state right after. */
function nextSpin(st: GameState, rng: Rng, from = 0): { e: Extract<CoreEvent, { type: 'spinStart' }>; state: GameState; at: number } {
  let s = st;
  for (let i = from; i < from + 400; i++) {
    const r = tick(s, { ticks: 1 }, rng, T0 + i * 100);
    s = r.state;
    const e = r.events.find((x) => x.type === 'spinStart');
    if (e && e.type === 'spinStart') return { e, state: clone(s), at: i + 1 };
  }
  throw new Error('no spin started');
}

const item = (rarity: Rarity, tiers: number[] = []) => ({ rarity, enchants: tiers.map((tier) => ({ tier })) });

describe('turbo spins and build-ups', () => {
  it('a spin building up to a rare find runs at normal speed and keeps its Trash Bag', () => {
    const st = bagsState(3);
    st.dumpster.forcedRarity = 'legendary';
    const { e, state } = nextSpin(st, new Rng(1));
    expect(e.reels[0].item.rarity).toBe('legendary');
    expect(e.turbo).toBe(false);
    expect(state.currencies.bags).toBe(3);
    // The same find on a spin without bags takes as long: no turbo either way.
    const plain = bagsState(0);
    plain.dumpster.forcedRarity = 'legendary';
    expect(nextSpin(plain, new Rng(1)).e.baseSpinSeconds).toBeCloseTo(e.baseSpinSeconds);
  });

  it('a spin with an everyday find still spends a bag on a turbo spin', () => {
    const st = bagsState(3);
    st.dumpster.forcedRarity = 'junk';
    const { e, state } = nextSpin(st, new Rng(1));
    expect(buildsUp(e)).toBe(false);
    expect(e.turbo).toBe(true);
    expect(state.currencies.bags).toBe(2);
    const slow = bagsState(0);
    slow.dumpster.forcedRarity = 'junk';
    expect(e.baseSpinSeconds).toBeLessThan(nextSpin(slow, new Rng(1)).e.baseSpinSeconds);
  });

  it('over many spins, a spin is turbo exactly when a bag is there and nothing builds up', () => {
    let st = bagsState(500);
    const rng = new Rng(5);
    let at = 0;
    let turbo = 0;
    let slowed = 0;
    for (let n = 0; n < 60; n++) {
      // (Fights drop Trash Bags too, so only the spin's own pace is checked here.)
      const r = nextSpin(st, rng, at);
      const builds = buildsUp(r.e);
      expect(r.e.turbo).toBe(!builds);
      if (builds) slowed++;
      else turbo++;
      st = r.state;
      at = r.at;
    }
    expect(turbo).toBeGreaterThan(30);
    expect(turbo + slowed).toBe(60);
  });

  it('a build-up: a find rarer than anything lately (feel.buildUp), a common one never', () => {
    const st = bagsState(0);
    // Nothing in a while: an Epic builds up; right after it, a Shiny doesn't, and Junk never does.
    expect(judgeFinds(st, [item('epic')], 1).tease).toBeGreaterThan(0);
    expect(judgeFinds(st, [item('shiny')], 1).tease).toBe(0);
    st.playTimeMs += 10 * 60_000;
    expect(judgeFinds(st, [item('junk')], 1).tease).toBe(0);
    // Only the spin's finds that beat the stretch count; one is enough.
    st.playTimeMs += 10 * 60_000;
    expect(judgeFinds(st, [item('junk'), item('legendary')], 1).tease).toBe(2);
  });
});
