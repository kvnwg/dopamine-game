import { describe, expect, it } from 'vitest';
import {
  applyAction, currentRate, fallbackRate, offlineReward, recordRewards, Rng, tick, computeElapsed, MS_PER_HOUR,
  MS_PER_MINUTE, offlineDoubleGems, type GameState,
} from '../src/core';
import { BAL } from '../src/data';
import { freshState, T0 } from './helpers';

const clone = (s: GameState) => structuredClone(s) as GameState;

describe('computeElapsed (clock guard)', () => {
  it('clamps to [0, cap] and flags a backward clock', () => {
    expect(computeElapsed(1000, 5000, 10_000)).toEqual({ elapsedMs: 4000, clockWentBackward: false, capped: false });
    expect(computeElapsed(0, 50_000, 10_000)).toEqual({ elapsedMs: 10_000, clockWentBackward: false, capped: true });
    expect(computeElapsed(5000, 1000, 10_000)).toEqual({ elapsedMs: 0, clockWentBackward: true, capped: false });
  });
});

describe('offline reward math', () => {
  it('reward = rate x minutes x 0.75', () => {
    const r = offlineReward({ bags: 4, coins: 100, xp: 50 }, 60 * MS_PER_MINUTE, 0);
    expect(r).toEqual({ bags: Math.floor(4 * 60 * 0.75), coins: Math.floor(100 * 60 * 0.75), xp: Math.floor(50 * 60 * 0.75) });
  });

  it('neighborhood bonus adds +10% per cleared neighborhood', () => {
    const r = offlineReward({ bags: 10, coins: 0, xp: 0 }, 10 * MS_PER_MINUTE, 10);
    expect(r.bags).toBe(Math.floor(10 * 10 * 0.75 * 1.1));
  });

  it('tracks a 10-minute average rate from recorded rewards', () => {
    const st = clone(freshState());
    for (let m = 0; m < 15; m++) recordRewards(st, T0 + m * MS_PER_MINUTE, { bags: 5, coins: 100, xp: 20 });
    const now = T0 + 15 * MS_PER_MINUTE;
    const rate = currentRate(st, now);
    expect(rate.bags).toBeCloseTo(5, 0);
    expect(rate.coins).toBeCloseTo(100, -1);
    expect(st.offline.buckets.length).toBeLessThanOrEqual(BAL.offline.rateWindowMinutes + 1);
  });

  it('uses the stage estimate when there is no data yet', () => {
    const st = freshState();
    expect(currentRate(st, T0)).toEqual(fallbackRate(st));
    expect(fallbackRate(st).bags).toBeGreaterThan(0);
  });
});

describe('pause / resume', () => {
  function pausedState(rate: { bags: number; coins: number; xp: number }) {
    const st = clone(freshState());
    st.offline.pausedRate = rate;
    st.offline.paused = true;
    st.lastActiveAt = T0;
    return st;
  }

  it('grants rate x elapsed x 0.75 and offers the ad double after 30+ minutes', () => {
    const rng = new Rng(1);
    const st = pausedState({ bags: 6, coins: 200, xp: 40 });
    const r = applyAction(st, { type: 'resume' }, rng, T0 + 2 * MS_PER_HOUR);
    const p = r.state.offline.pending!;
    expect(p.bags).toBe(Math.floor(6 * 120 * 0.75));
    expect(p.coins).toBe(Math.floor(200 * 120 * 0.75));
    expect(p.canDouble).toBe(true);
    expect(r.events.some((e) => e.type === 'offlineReady')).toBe(true);
    const collected = applyAction(r.state, { type: 'collectOffline', doubled: true }, rng, T0 + 2 * MS_PER_HOUR);
    expect(collected.state.currencies.bags).toBe(st.currencies.bags + p.bags * 2);
    expect(collected.state.offline.pending).toBeNull();
  });

  it('the double can be paid with Gems instead of the ad: 10 per hour away, at most 80, and not without them', () => {
    expect(offlineDoubleGems(30 * MS_PER_MINUTE)).toBe(BAL.offline.doubleGems.perHour / 2);
    expect(offlineDoubleGems(2 * MS_PER_HOUR)).toBe(2 * BAL.offline.doubleGems.perHour);
    expect(offlineDoubleGems(48 * MS_PER_HOUR)).toBe(BAL.offline.doubleGems.max);
    const rng = new Rng(1);
    const st = pausedState({ bags: 6, coins: 200, xp: 40 });
    const r = applyAction(st, { type: 'resume' }, rng, T0 + 2 * MS_PER_HOUR);
    const p = r.state.offline.pending!;
    const cost = offlineDoubleGems(p.awayMs);
    const poor = structuredClone(r.state);
    poor.currencies.gems = cost - 1;
    const refused = applyAction(poor, { type: 'collectOffline', doubled: true, via: 'gems' }, rng, T0 + 2 * MS_PER_HOUR).state;
    expect(refused.offline.pending).not.toBeNull();
    expect(refused.currencies.gems).toBe(cost - 1);
    const rich = structuredClone(r.state);
    rich.currencies.gems = cost + 5;
    const paid = applyAction(rich, { type: 'collectOffline', doubled: true, via: 'gems' }, rng, T0 + 2 * MS_PER_HOUR).state;
    expect(paid.currencies.gems).toBe(5);
    expect(paid.currencies.bags).toBe(st.currencies.bags + p.bags * 2);
    expect(paid.offline.pending).toBeNull();
  });

  it('does not offer the ad double for short absences', () => {
    const rng = new Rng(1);
    const st = pausedState({ bags: 6, coins: 200, xp: 40 });
    const r = applyAction(st, { type: 'resume' }, rng, T0 + 10 * MS_PER_MINUTE);
    expect(r.state.offline.pending!.canDouble).toBe(false);
    const c = applyAction(r.state, { type: 'collectOffline', doubled: true }, rng, T0);
    expect(c.state.currencies.bags).toBe(st.currencies.bags + r.state.offline.pending!.bags);
  });

  it('caps offline time at 8 hours', () => {
    const rng = new Rng(1);
    const st = pausedState({ bags: 1, coins: 0, xp: 0 });
    const r = applyAction(st, { type: 'resume' }, rng, T0 + 48 * MS_PER_HOUR);
    expect(r.state.offline.pending!.bags).toBe(Math.floor(1 * 8 * 60 * 0.75));
  });

  it('grants nothing and resets lastActiveAt if the clock went backward', () => {
    const rng = new Rng(1);
    const st = pausedState({ bags: 10, coins: 10, xp: 10 });
    const back = T0 - 5 * MS_PER_HOUR;
    const r = applyAction(st, { type: 'resume' }, rng, back);
    expect(r.state.offline.pending).toBeNull();
    expect(r.state.lastActiveAt).toBe(back);
    expect(r.events.some((e) => e.type === 'clockWentBackward')).toBe(true);
  });

  it('ticks never move lastActiveAt backward (high-water mark)', () => {
    const rng = new Rng(1);
    const st = freshState();
    const r = tick(st, { ticks: 1 }, rng, T0 - MS_PER_HOUR);
    expect(r.state.lastActiveAt).toBe(T0);
  });

  it('a short absence grants nothing', () => {
    const rng = new Rng(1);
    const st = pausedState({ bags: 10, coins: 10, xp: 10 });
    const r = applyAction(st, { type: 'resume' }, rng, T0 + 30_000);
    expect(r.state.offline.pending).toBeNull();
  });

  it('pause snapshots the live rate; resume uses it', () => {
    const rng = new Rng(1);
    const st = clone(freshState());
    for (let m = 0; m < 10; m++) recordRewards(st, T0 + m * MS_PER_MINUTE, { bags: 3, coins: 30, xp: 9 });
    const pauseAt = T0 + 10 * MS_PER_MINUTE;
    const paused = applyAction(st, { type: 'pause' }, rng, pauseAt).state;
    expect(paused.offline.pausedRate!.bags).toBeCloseTo(3, 0);
    const resumed = applyAction(paused, { type: 'resume' }, rng, pauseAt + MS_PER_HOUR).state;
    expect(resumed.offline.pending!.bags).toBe(Math.floor(paused.offline.pausedRate!.bags * 60 * 0.75));
  });
});
