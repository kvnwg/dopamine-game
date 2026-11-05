import { describe, expect, it } from 'vitest';
import {
  applyAction, itemOddsOneIn, MS_PER_HOUR, offlineKeepOdds, offlineReward, offlineRollCount, Rng, reelCount, rollOffline,
  spinCycle, upgradeDef, type CoreEvent, type GameState,
} from '../src/core';
import { BAL } from '../src/data';
import { freshState, T0 } from './helpers';

const O = BAL.offline;
const clone = (s: GameState) => structuredClone(s) as GameState;

/** A raccoon that has dived before and left at T0 (paused with a known earning rate). */
function away(seed = 1): GameState {
  const st = clone(freshState(seed));
  st.dumpster.firstDiveDone = true;
  st.dumpster.beginner = { state: 'done', uid: null };
  st.offline.pausedRate = { bags: 2, coins: 50, xp: 10 };
  st.offline.paused = true;
  st.lastActiveAt = T0;
  return st;
}

describe('offline rolls', () => {
  it('one spin per spin cycle x rollSlowdown away, times the offline efficiency and bonus, at most maxRolls', () => {
    const st = away();
    const hour = MS_PER_HOUR;
    const spins = Math.floor((3600 / (spinCycle(st) * O.rollSlowdown)) * O.efficiency);
    expect(offlineRollCount(st, hour)).toBe(spins * reelCount(st));
    expect(offlineRollCount(st, 2 * hour)).toBeGreaterThanOrEqual(2 * spins);
    // Faster reels roll more; every line maxed hits the cap.
    const fast = clone(st);
    fast.upgrades = { rollSpeed: upgradeDef('rollSpeed')!.max, extraReel: upgradeDef('extraReel')!.max, offlinePct: upgradeDef('offlinePct')!.max };
    expect(offlineRollCount(fast, hour)).toBeGreaterThan(offlineRollCount(st, hour));
    expect(offlineRollCount(fast, 8 * hour)).toBe(O.maxRolls);
    // Nothing before the very first dive.
    const fresh = clone(st);
    fresh.dumpster.firstDiveDone = false;
    expect(offlineRollCount(fresh, 8 * hour)).toBe(0);
  });

  it('on return, rare finds go to the bag and the popup; the rest are scrapped into the reward', () => {
    const st = away(2);
    const rng = new Rng(5);
    const r = applyAction(st, { type: 'resume' }, rng, T0 + 6 * MS_PER_HOUR);
    const p = r.state.offline.pending!;
    const rolls = offlineRollCount(st, 6 * MS_PER_HOUR);
    expect(p.rolls).toBe(rolls);
    // The kills' reward (the rolls that weren't kept are dropped: offline.scrapShare is 0).
    expect(O.scrapShare).toBe(0);
    expect(p.coins).toBe(offlineReward({ bags: 2, coins: 50, xp: 10 }, 6 * MS_PER_HOUR, 0).coins);
    const keep = offlineKeepOdds();
    expect(p.foundCount).toBeGreaterThan(0);
    expect(p.found.length).toBe(Math.min(p.foundCount, O.keepListMax));
    for (const it of p.found) expect(itemOddsOneIn(it)).toBeGreaterThanOrEqual(keep);
    for (let i = 1; i < p.found.length; i++) expect(p.found[i - 1].power).toBeGreaterThanOrEqual(p.found[i].power);
    // In the bag (the bag had room), in the Codex, and the best one is the record.
    const bag = new Set(r.state.inventory.map((it) => it.uid));
    for (const it of p.found) expect(bag.has(it.uid)).toBe(true);
    for (const it of p.found) expect(r.state.codex.entries).toContain(`${it.baseId}:${it.rarity}`);
    expect(r.state.records.bestOdds).toBe(Math.max(...p.found.map(itemOddsOneIn)));
    // One event for all of it: no spins, no per-roll events.
    const types = new Set(r.events.map((e) => e.type));
    expect(types.has('roll')).toBe(false);
    expect(types.has('spinStart')).toBe(false);
    const ready = r.events.find((e) => e.type === 'offlineReady') as Extract<CoreEvent, { type: 'offlineReady' }>;
    expect(ready).toMatchObject({ rolls, kept: p.foundCount });
    expect(ready.best?.uid).toBe(p.found[0].uid);
  });

  it('keeps exactly the finds as rare as a plain keepRarity item', () => {
    const st = away(3);
    const rng = new Rng(8);
    const ev: CoreEvent[] = [];
    const scrapped = st.lifetime.itemsRecycled;
    st.upgrades = { bagSpace: 8 };
    st.inventory = [];
    const res = rollOffline(st, rng, T0, 800, ev);
    expect(res.rolls).toBe(800);
    const keep = offlineKeepOdds();
    for (const it of res.kept) expect(itemOddsOneIn(it)).toBeGreaterThanOrEqual(keep);
    const finds = res.kept.length + res.overflow;
    // Everything below the bar was dropped; the finds a full bag had no room for were scrapped by it.
    expect(st.lifetime.itemsRecycled - scrapped).toBe(res.overflow);
    expect(st.inventory.length).toBe(res.kept.length);
    expect(res.coins).toBe(0);
    // At about luck 1 (lucky spins and tokens help), an Epic or better, or an item as rare by its
    // enchantments, is a few percent of the rolls.
    expect(finds / 800).toBeGreaterThan(0.01);
    expect(finds / 800).toBeLessThan(0.12);
    // With a scrap share, the rest pays that share of its scrap value.
    const share = O.scrapShare;
    O.scrapShare = 0.5;
    try {
      const st2 = away(3);
      expect(rollOffline(st2, new Rng(8), T0, 200, []).coins).toBeGreaterThan(0);
    } finally {
      O.scrapShare = share;
    }
  });

  it('never scripts or triggers the tutorial, and leaves the dev overrides and Golden Dumpster spins alone', () => {
    // Not before the first dive.
    const fresh = clone(freshState(4));
    fresh.offline.pausedRate = { bags: 1, coins: 10, xp: 1 };
    fresh.offline.paused = true;
    fresh.lastActiveAt = T0;
    const f = applyAction(fresh, { type: 'resume' }, new Rng(1), T0 + 4 * MS_PER_HOUR).state;
    expect(f.dumpster.firstDiveDone).toBe(false);
    expect(f.offline.pending!.rolls).toBe(0);
    expect(f.inventory).toEqual([]);
    // Beginner's luck still pending: the reels' roll count (its timer) doesn't move, nor does its state.
    const st = away(6);
    st.dumpster.beginner = { state: 'pending', uid: null };
    st.roll.count = BAL.tutorial.beginnerAtRolls - 1;
    st.dumpster.forcedRarity = 'grail';
    st.dumpster.forcedTokens = [10, 10];
    st.roll.goldenLeft = 4;
    const r = applyAction(st, { type: 'resume' }, new Rng(2), T0 + 4 * MS_PER_HOUR).state;
    expect(r.offline.pending!.rolls).toBeGreaterThan(0);
    expect(r.dumpster.beginner).toEqual({ state: 'pending', uid: null });
    expect(r.roll.count).toBe(st.roll.count);
    expect(r.dumpster.forcedRarity).toBe('grail');
    expect(r.dumpster.forcedTokens).toEqual([10, 10]);
    expect(r.roll.goldenLeft).toBe(4);
    expect(r.offline.pending!.found.every((it) => it.rarity !== 'grail')).toBe(true);
  });

  it('a second return before collecting adds up', () => {
    const st = away(7);
    const rng = new Rng(9);
    let s = applyAction(st, { type: 'resume' }, rng, T0 + 3 * MS_PER_HOUR).state;
    const first = s.offline.pending!;
    s = applyAction(s, { type: 'pause' }, rng, T0 + 3 * MS_PER_HOUR).state;
    s = applyAction(s, { type: 'resume' }, rng, T0 + 6 * MS_PER_HOUR).state;
    const both = s.offline.pending!;
    expect(both.rolls).toBeGreaterThan(first.rolls);
    expect(both.foundCount).toBeGreaterThanOrEqual(first.foundCount);
    const done = applyAction(s, { type: 'collectOffline', doubled: false }, rng, T0 + 6 * MS_PER_HOUR).state;
    expect(done.offline.pending).toBeNull();
  });
});
