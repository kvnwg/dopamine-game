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
  it('the dumpster waits, padlocked, for the first tap; then a few everyday warm-up finds, then the tutorial\'s own find', () => {
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
    // The warm-up: one everyday find per spin, climbing BAL.tutorial.warmupRarities, no tokens, nothing scripted.
    let s = opened.state;
    const starts: Extract<CoreEvent, { type: 'spinStart' }>[] = [];
    for (let i = 0; i < 400 && starts.length < BAL.tutorial.warmupRarities.length + 1; i++) {
      const r = tick(s, { ticks: 1 }, rng, T0 + i * 100);
      s = r.state;
      for (const e of r.events) if (e.type === 'spinStart') starts.push(e);
    }
    const warm = starts.slice(0, BAL.tutorial.warmupRarities.length);
    expect(warm.map((e) => e.reels[0].item.rarity)).toEqual(BAL.tutorial.warmupRarities);
    for (const e of warm) {
      expect(e.scripted).toBeUndefined();
      expect(e.reels[0].mults).toEqual([]);
    }
    // Then the tutorial's own find.
    const own = starts[BAL.tutorial.warmupRarities.length];
    expect(own.scripted).toBe('first');
    expect(own.reels[0].item.baseId).toBe(BAL.dumpster.tutorialItem.baseId);
    // The Bag opens with it in (its Equip best puts it on).
    expect(s.features.unlocked).not.toContain('bag');
    for (let i = 0; i < 100 && !s.features.unlocked.includes('bag'); i++) s = tick(s, { ticks: 1 }, rng, T0 + 40_000 + i * 100).state;
    expect(s.features.unlocked).toContain('bag');
    expect(s.lifetime.itemsEquipped).toBe(0);
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
    // The tutorial ends: Worlds (a new game's raccoon waits there for his first world), and luck and the
    // Codex, which open quietly (already seen: no walkthrough); Upgrades and the dumpster wait for gold.
    st = r.st;
    st.dumpster.beginner = { state: 'done', uid: null };
    st.currencies.coins = 0;
    r = step(st);
    expect(r.opened).toEqual(['worlds', 'luck', 'codex']);
    expect(r.st.features.seen).toEqual(expect.arrayContaining(['luck', 'codex']));
    expect(r.st.features.seen).not.toContain('worlds');
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
