import { describe, expect, it } from 'vitest';
import {
  applyAction, FEATURES, featureView, GameStateSchema, introFeature, rebirthTabWorld, Rng, tick, tutorialOver, upgradeCost, type CoreEvent, type Feature,
  type GameState,
} from '../src/core';
import { BAL } from '../src/data';
import { freshState, T0 } from './helpers';

const clone = (s: GameState) => structuredClone(s) as GameState;

/** One tick (features are checked after every tick and action); returns the state and what opened. */
function step(st: GameState, rng = new Rng(1), now = T0): { st: GameState; opened: Feature[]; events: CoreEvent[] } {
  const r = tick(st, { ticks: 1 }, rng, now);
  const opened = r.events.flatMap((e) => (e.type === 'featureUnlocked' ? [e.feature] : []));
  return { st: clone(r.state), opened, events: r.events };
}

describe('a new game opens its features one by one', () => {
  it('the dumpster waits, padlocked, for the first tap; then it rolls the tutorial\'s first find', () => {
    const rng = new Rng(2);
    let st = freshState(1, T0, true);
    expect(st.features).toEqual({ unlocked: [], seen: [] });
    const events: CoreEvent[] = [];
    for (let i = 0; i < 100; i++) {
      const r = tick(st, { ticks: 1 }, rng, T0 + i * 100);
      st = r.state;
      events.push(...r.events);
    }
    expect(events.some((e) => e.type === 'spinStart' || e.type === 'roll')).toBe(false);
    expect(st.roll.current).toBeNull();
    const opened = applyAction(st, { type: 'openDumpster' }, rng, T0);
    expect(opened.events).toContainEqual({ type: 'featureUnlocked', feature: 'roll' });
    expect(opened.state.features.seen).toContain('roll');
    // A second tap does nothing more.
    expect(applyAction(opened.state, { type: 'openDumpster' }, rng, T0).events.some((e) => e.type === 'featureUnlocked')).toBe(false);
    const next = tick(opened.state, { ticks: 1 }, rng, T0);
    const start = next.events.find((e) => e.type === 'spinStart');
    expect(start?.type === 'spinStart' && start.scripted).toBe('first');
  });

  it('each opens when it becomes useful, once: the Bag with the first item worn, luck, the Codex and Worlds after the tutorial, Upgrades and the dumpster\'s upgrade when affordable, Rebirth near the first rebirth, Heists with it, Perks with the second', () => {
    let st = freshState();
    let r = step(st);
    expect(r.opened).toEqual([]);
    // The first item goes on: the Bag.
    st = r.st;
    st.lifetime.itemsEquipped = 1;
    r = step(st);
    expect(r.opened).toEqual(['bag']);
    // The tutorial ends: luck (the odds), the Codex (the items) and Worlds, introduced in that order (a
    // new game's raccoon waits there for his first world); Upgrades and the dumpster wait for gold.
    st = r.st;
    st.dumpster.beginner = { state: 'done', uid: null };
    st.currencies.coins = 0;
    r = step(st);
    expect(r.opened).toEqual(['luck', 'codex', 'worlds']);
    // Gold for the cheapest upgrade (and the dumpster's).
    st = r.st;
    st.currencies.coins = Math.max(upgradeCost(st.dumpster.level), 1e6);
    r = step(st);
    expect(r.opened).toEqual(['upgrades', 'dumpster']);
    // A couple of worlds short of the first rebirth's: Rebirth.
    st = r.st;
    st.stage.highestCleared = rebirthTabWorld();
    r = step(st);
    expect(r.opened).toEqual(['rebirth']);
    // The first rebirth: Heists.
    st = r.st;
    st.rebirths = BAL.heist.unlockRebirths;
    r = step(st);
    expect(r.opened).toEqual(['heist']);
    // The second: the Upgrades screen's Perks page.
    st = r.st;
    st.rebirths = BAL.perks.unlockRebirths;
    r = step(st);
    expect(r.opened).toEqual(['perks']);
    expect([...r.st.features.unlocked].sort()).toEqual([...FEATURES].sort());
    // Nothing opens twice.
    expect(step(r.st).opened).toEqual([]);
  });

  it('a tutorial left unfinished never holds the game back: after enough rolls the rest opens anyway', () => {
    const st = freshState();
    st.dumpster.beginner = { state: 'rolled', uid: 7 };
    expect(tutorialOver(st)).toBe(false);
    st.roll.count = BAL.tutorial.overAtRolls;
    expect(tutorialOver(st)).toBe(true);
    expect(step(st).opened).toEqual(expect.arrayContaining(['luck', 'codex']));
  });

  it('an open feature is marked introduced when the tutorial has shown it; a locked one cannot be', () => {
    const rng = new Rng(3);
    expect(applyAction(freshState(), { type: 'featureSeen', feature: 'bag' }, rng, T0).state.features.seen).not.toContain('bag');
    const st = freshState();
    st.lifetime.itemsEquipped = 1;
    const open = step(st).st;
    expect(open.features.unlocked).toContain('bag');
    expect(open.features.seen).not.toContain('bag');
    expect(applyAction(open, { type: 'featureSeen', feature: 'bag' }, rng, T0).state.features.seen).toContain('bag');
  });

  it('opened features are introduced one at a time, in order: the next stays locked on screen until the one before is seen', () => {
    const st = freshState();
    st.features.unlocked.push('bag', 'luck', 'upgrades');
    st.features.seen.push('bag');
    expect(introFeature(st)).toBe('luck');
    expect(featureView(st, 'bag')).toBe('open');
    expect(featureView(st, 'luck')).toBe('intro');
    expect(featureView(st, 'upgrades')).toBe('locked');
    expect(featureView(st, 'worlds')).toBe('locked');
    st.features.seen.push('luck');
    expect(featureView(st, 'upgrades')).toBe('intro');
    st.features.seen.push('upgrades');
    expect(introFeature(st)).toBeNull();
  });

  it('saves from before this have everything open and introduced', () => {
    const old = clone(freshState()) as unknown as Record<string, unknown>;
    delete old.features;
    const parsed = GameStateSchema.parse(old);
    expect([...parsed.features.unlocked].sort()).toEqual([...FEATURES].sort());
    expect([...parsed.features.seen].sort()).toEqual([...FEATURES].sort());
  });
});
