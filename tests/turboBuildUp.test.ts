import { describe, expect, it } from 'vitest';
import { currentLuck, Rng, spinBuildsUp, tick, type CoreEvent, type GameState } from '../src/core';
import { BAL, type Rarity } from '../src/data';
import { freshState, T0 } from './helpers';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** A new game past its tutorial spins, with Trash Bags for turbo spins. */
function bagsState(bags: number): GameState {
  const st = clone(freshState(7));
  st.dumpster.firstDiveDone = true;
  st.dumpster.beginner = { state: 'done', uid: null };
  st.currencies.bags = bags;
  return st;
}

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
    if (spinBuildsUp(e.reels.map((r) => r.item), currentLuck(st, T0))) return; // (a heavily enchanted junk find)
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
      const builds = spinBuildsUp(r.e.reels.map((x) => x.item), currentLuck(r.state, T0 + r.at * 100));
      expect(r.e.turbo).toBe(!builds);
      if (builds) slowed++;
      else turbo++;
      st = r.state;
      at = r.at;
    }
    expect(turbo).toBeGreaterThan(30);
    expect(turbo + slowed).toBe(60);
  });

  it('spinBuildsUp: the rarest find rare enough at your luck, or any find with the full reveal', () => {
    const rare = BAL.feel.buildUp.rare;
    expect(rare).toBeGreaterThan(1);
    // Legendary is 1 in 1,000 at luck 1: a build-up; at luck 1,000 it's everyday.
    expect(spinBuildsUp([item('legendary')], 1)).toBe(true);
    expect(spinBuildsUp([item('legendary')], 1000)).toBe(false);
    expect(spinBuildsUp([item('junk')], 1)).toBe(false);
    expect(spinBuildsUp([], 1)).toBe(false);
    // Only the rarest find counts for the smaller build-up (the Roll tab builds up to that reel).
    expect(spinBuildsUp([item('junk'), item('epic')], 1)).toBe(true);
  });
});
