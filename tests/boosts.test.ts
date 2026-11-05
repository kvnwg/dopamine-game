import { describe, expect, it } from 'vitest';
import {
  applyAction, boostBlocked, boostGems, boostUsesLeft, crateOdds, currentLuck, GameStateSchema, luckBreakdown, MS_PER_HOUR,
  MS_PER_MINUTE, quickDiveRolls, reelCount, Rng, tick, type BoostId, type CoreEvent, type GameState,
} from '../src/core';
import { BAL } from '../src/data';
import { freshState, T0 } from './helpers';

const B = BAL.boosts;
const clone = (s: GameState) => structuredClone(s) as GameState;

/** A raccoon past the tutorial with Boosts open, rolling, with Gems to spend. */
function ready(gems = 10_000): GameState {
  const st = clone(freshState());
  st.dumpster.beginner = { state: 'done', uid: null };
  st.dumpster.firstDiveDone = true;
  st.playTimeMs = B.unlockMinutes * 60_000;
  st.features.unlocked.push('boosts');
  st.features.seen.push('boosts');
  st.currencies.gems = gems;
  return st;
}

function take(st: GameState, id: BoostId, via: 'ad' | 'gems', now = T0, seed = 1) {
  return applyAction(st, { type: 'boost', id, via }, new Rng(seed), now);
}

describe('boosts open after the tutorial and a few minutes of play', () => {
  it('not before BAL.boosts.unlockMinutes of play, and not during the tutorial; a boost before then does nothing', () => {
    const st = clone(freshState());
    st.dumpster.beginner = { state: 'done', uid: null };
    st.playTimeMs = B.unlockMinutes * 60_000 - 1000;
    let r = tick(st, { ticks: 1 }, new Rng(1), T0);
    expect(r.state.features.unlocked).not.toContain('boosts');
    expect(take(r.state, 'bonusCrate', 'ad').events.some((e) => e.type === 'boostUsed')).toBe(false);
    const later = clone(r.state);
    later.playTimeMs = B.unlockMinutes * 60_000;
    r = tick(later, { ticks: 1 }, new Rng(1), T0);
    expect(r.events).toContainEqual({ type: 'featureUnlocked', feature: 'boosts' });
    // Still in the tutorial: they wait.
    const early = clone(freshState());
    early.playTimeMs = 10 * 60_000;
    expect(tick(early, { ticks: 1 }, new Rng(1), T0).state.features.unlocked).not.toContain('boosts');
  });

  it('a save from before Boosts loads with none taken', () => {
    const raw = clone(ready()) as unknown as Record<string, unknown>;
    delete raw.boosts;
    const parsed = GameStateSchema.parse(raw);
    expect(parsed.boosts).toEqual({ day: '', used: {}, brewEndsAt: null, reelEndsAt: null, crateAt: 0 });
  });
});

describe('daily limits and Gem prices', () => {
  it('each boost can be taken perDay times a day, by ad or Gems alike, and the count starts over the next day', () => {
    let st = ready();
    for (let i = 0; i < B.quickDive.perDay; i++) {
      expect(boostUsesLeft(st, 'quickDive', T0)).toBe(B.quickDive.perDay - i);
      st = take(st, 'quickDive', i % 2 ? 'gems' : 'ad', T0 + i).state;
    }
    expect(boostBlocked(st, 'quickDive', T0)).toBe('limit');
    expect(take(st, 'quickDive', 'ad', T0).events.some((e) => e.type === 'boostUsed')).toBe(false);
    const tomorrow = new Date(2026, 0, 6, 9, 0, 0).getTime();
    expect(boostUsesLeft(st, 'quickDive', tomorrow)).toBe(B.quickDive.perDay);
    expect(take(st, 'quickDive', 'ad', tomorrow).events.some((e) => e.type === 'boostUsed')).toBe(true);
  });

  it("Quick Dive's Gem price climbs with each use in a day; an ad costs nothing; without the Gems nothing happens", () => {
    let st = ready();
    const paid: number[] = [];
    for (let i = 0; i < B.quickDive.perDay; i++) {
      paid.push(boostGems(st, 'quickDive', T0));
      const before = st.currencies.gems;
      const r = take(st, 'quickDive', 'gems', T0);
      st = r.state;
      // (The rolls' new Codex entries can pay a Codex bonus meanwhile.)
      const codex = r.events.reduce((n, e) => n + (e.type === 'codexBonus' ? e.gems : 0), 0);
      expect(before - st.currencies.gems + codex).toBe(paid[i]);
      expect(r.events).toContainEqual({ type: 'boostUsed', id: 'quickDive', via: 'gems', gems: paid[i] });
    }
    expect(paid).toEqual(B.quickDive.gems.slice(0, B.quickDive.perDay));
    const ad = take(ready(), 'quickDive', 'ad', T0).state;
    expect(ad.currencies.gems).toBe(10_000);
    const poor = take(ready(B.quickDive.gems[0] - 1), 'quickDive', 'gems', T0);
    expect(poor.events.some((e) => e.type === 'boostUsed')).toBe(false);
    expect(boostUsesLeft(poor.state, 'quickDive', T0)).toBe(B.quickDive.perDay);
  });
});

describe('the four boosts', () => {
  it('Quick Dive rolls two hours of offline rolls at once and puts the rare finds in the bag', () => {
    const st = ready();
    const n = quickDiveRolls(st);
    expect(n).toBeGreaterThan(0);
    const { state, events } = take(st, 'quickDive', 'ad');
    const e = events.find((x): x is Extract<CoreEvent, { type: 'quickDive' }> => x.type === 'quickDive')!;
    expect(e.rolls).toBe(n);
    expect(state.dumpster.totalDives - st.dumpster.totalDives).toBe(n);
    expect(state.inventory.length - st.inventory.length).toBe(e.kept);
    // Before the very first find there is nothing to roll.
    const fresh = ready();
    fresh.dumpster.firstDiveDone = false;
    expect(boostBlocked(fresh, 'quickDive', T0)).toBe('nothing');
  });

  it('Potion Brew multiplies luck for its minutes, stacks with a Luck Potion, then ends on its own', () => {
    const st = ready();
    const base = currentLuck(st, T0);
    const r = take(st, 'potionBrew', 'ad');
    expect(currentLuck(r.state, T0 + 1000)).toBeCloseTo(base * B.potionBrew.mult);
    expect(luckBreakdown(r.state, T0 + 1000).brewMult).toBe(B.potionBrew.mult);
    expect(boostBlocked(r.state, 'potionBrew', T0 + 1000)).toBe('active');
    const potion = clone(r.state);
    potion.luckBoostEndsAt = T0 + 60_000;
    expect(currentLuck(potion, T0 + 1000)).toBeCloseTo(base * B.potionBrew.mult * BAL.luck.potion.mult);
    const end = T0 + B.potionBrew.minutes * MS_PER_MINUTE;
    const after = tick(r.state, { ticks: 1 }, new Rng(1), end);
    expect(after.events).toContainEqual({ type: 'boostEnded', id: 'potionBrew' });
    expect(currentLuck(after.state, end)).toBeCloseTo(base);
    expect(boostBlocked(after.state, 'potionBrew', end)).toBeNull();
  });

  it('Duct-Tape Reel adds a reel for its minutes (the next spin rolls one more), never past the maximum', () => {
    const st = ready();
    expect(reelCount(st)).toBe(1);
    let s = take(st, 'ductTapeReel', 'ad').state;
    expect(reelCount(s)).toBe(2);
    expect(boostBlocked(s, 'ductTapeReel', T0)).toBe('active');
    // The next spin rolls two reels.
    const rng = new Rng(4);
    let spun: Extract<CoreEvent, { type: 'spinStart' }> | undefined;
    for (let i = 0; i < 200 && !spun; i++) {
      const r = tick(s, { ticks: 1 }, rng, T0 + i * 100);
      s = r.state;
      spun = r.events.find((e): e is Extract<CoreEvent, { type: 'spinStart' }> => e.type === 'spinStart');
    }
    expect(spun?.reels).toHaveLength(2);
    const end = T0 + B.ductTapeReel.minutes * MS_PER_MINUTE;
    const after = tick(s, { ticks: 1 }, rng, end);
    expect(after.events).toContainEqual({ type: 'boostEnded', id: 'ductTapeReel' });
    expect(reelCount(after.state)).toBe(1);
    // Every reel already: nothing to rent.
    const full = ready();
    full.upgrades.extraReel = BAL.roll.maxReels - 1;
    expect(reelCount(full)).toBe(BAL.roll.maxReels);
    expect(boostBlocked(full, 'ductTapeReel', T0)).toBe('maxReels');
  });

  it("a reel rented before leaving that ran out meanwhile doesn't roll offline", () => {
    const st = take(ready(), 'ductTapeReel', 'ad').state;
    const away = clone(st);
    away.offline.paused = true;
    away.lastActiveAt = T0;
    const back = applyAction(away, { type: 'resume' }, new Rng(1), T0 + 2 * MS_PER_HOUR).state;
    expect(back.boosts.reelEndsAt).toBeNull();
    const plain = clone(ready());
    plain.offline.paused = true;
    plain.lastActiveAt = T0;
    const plainBack = applyAction(plain, { type: 'resume' }, new Rng(1), T0 + 2 * MS_PER_HOUR).state;
    expect(back.offline.pending?.rolls).toBe(plainBack.offline.pending?.rolls);
  });

  it('the Bonus Crate is ready at first, then every few hours; it pays bags, gold or a Luck Potion', () => {
    const st = ready();
    expect(boostBlocked(st, 'bonusCrate', T0)).toBeNull();
    const r = take(st, 'bonusCrate', 'ad');
    const e = r.events.find((x): x is Extract<CoreEvent, { type: 'crateOpened' }> => x.type === 'crateOpened')!;
    expect(['bags', 'coins', 'potion']).toContain(e.kind);
    if (e.kind === 'bags') expect(r.state.currencies.bags - st.currencies.bags).toBe(e.amount);
    if (e.kind === 'coins') expect(r.state.currencies.coins - st.currencies.coins).toBe(e.amount);
    if (e.kind === 'potion') expect(r.state.luckBoostEndsAt).toBe(T0 + e.amount * 1000);
    expect(boostBlocked(r.state, 'bonusCrate', T0 + MS_PER_HOUR)).toBe('cooldown');
    expect(boostBlocked(r.state, 'bonusCrate', T0 + B.bonusCrate.everyHours * MS_PER_HOUR)).toBeNull();
  });

  it("the crate's rewards come at the odds it shows, within 1% over 10,000 crates", () => {
    const counts: Record<string, number> = {};
    const rng = new Rng(11);
    for (let i = 0; i < 10_000; i++) {
      const st = ready();
      const ev = applyAction(st, { type: 'boost', id: 'bonusCrate', via: 'ad' }, rng, T0).events;
      const e = ev.find((x): x is Extract<CoreEvent, { type: 'crateOpened' }> => x.type === 'crateOpened')!;
      counts[e.kind] = (counts[e.kind] ?? 0) + 1;
    }
    for (const { reward, chance } of crateOdds()) expect(Math.abs((counts[reward.kind] ?? 0) / 10_000 - chance)).toBeLessThan(0.01);
  });
});
