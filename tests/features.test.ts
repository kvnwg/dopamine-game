import { describe, expect, it } from 'vitest';
import {
  applyAction, FEATURES, featureView, GameStateSchema, introFeature, rebirthTabWorld, Rng, spinCycle, spinShare, tick, tutorialOver, upgradeCost,
  type CoreEvent, type Feature, type GameState,
} from '../src/core';
import { BAL, DATA } from '../src/data';
import { freshState, T0 } from './helpers';

const clone = (s: GameState) => structuredClone(s) as GameState;

/** One tick (features are checked after every tick and action); returns the state and what opened. */
function step(st: GameState, rng = new Rng(1), now = T0): { st: GameState; opened: Feature[]; events: CoreEvent[] } {
  const r = tick(st, { ticks: 1 }, rng, now);
  const opened = r.events.flatMap((e) => (e.type === 'featureUnlocked' ? [e.feature] : []));
  return { st: clone(r.state), opened, events: r.events };
}

describe('a new game opens its features one by one', () => {
  it('the dumpster waits, padlocked, for the first tap; then one quick everyday warm-up find, then the tutorial\'s own find', () => {
    const rng = new Rng(2);
    let st = freshState(1, T0, true);
    // Nothing is open yet: the raccoon is already fighting, and the padlock is the first thing to tap.
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
    // The warm-up: one everyday find per spin, at BAL.tutorial.warmupRarities in turn, no tokens, nothing
    // scripted. It goes by as fast as a turbo spin, but isn't one (no Trash Bag spent, no TURBO badge).
    expect(BAL.tutorial.warmupRarities.length).toBeGreaterThan(0);
    const bags = opened.state.currencies.bags;
    expect(bags).toBeGreaterThan(0);
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
      expect(e.turbo).toBe(false);
      if (BAL.tutorial.warmupTurbo) expect(e.spinSeconds).toBeCloseTo(spinCycle(opened.state, true) * spinShare(), 6);
    }
    expect(s.currencies.bags).toBe(bags);
    // Then the tutorial's own find.
    const own = starts[BAL.tutorial.warmupRarities.length];
    expect(own.scripted).toBe('first');
    expect(own.reels[0].item.baseId).toBe(BAL.dumpster.tutorialItem.baseId);
    // The warm-up spin is a quick one, so the first Legendary isn't a long wait (Kevin: "we're still
    // waiting so long for the first legendary to appear"): it lands within 5 s of the lock coming off.
    for (const e of warm) expect(e.spinSeconds + e.restSeconds).toBeLessThan(BAL.roll.spinSeconds + BAL.roll.restSeconds);
    const wait = warm.reduce((a, e) => a + e.spinSeconds + e.restSeconds, 0) + own.spinSeconds;
    expect(wait).toBeLessThanOrEqual(5);
    // The tutorial's own find still takes a full spin: its build-up needs the time.
    expect(own.spinSeconds).toBeCloseTo(BAL.roll.spinSeconds, 5);
    // The warm-up find is for a slot of its own, never the tutorial item's: always an upgrade for Equip best.
    const ownSlot = DATA.itemsById.get(BAL.dumpster.tutorialItem.baseId)!.slot;
    expect(new Set([ownSlot, ...warm.map((e) => e.reels[0].item.slot)]).size).toBe(warm.length + 1);
    // The Bag opens with it in (it goes on from its reveal; whatever else rolled waits there for Equip best).
    expect(s.features.unlocked).not.toContain('bag');
    for (let i = 0; i < 100 && !s.features.unlocked.includes('bag'); i++) s = tick(s, { ticks: 1 }, rng, T0 + 40_000 + i * 100).state;
    expect(s.features.unlocked).toContain('bag');
    expect(s.lifetime.itemsEquipped).toBe(0);
  });

  it('each opens when it becomes useful, once: the Bag with the first item worn, luck and the Codex after the tutorial, Upgrades and the dumpster\'s upgrade when affordable, Worlds once World 1 is beaten, Rebirth near the first rebirth, Heists with it, Perks with the second, Boosts a few minutes in', () => {
    let st = freshState();
    let r = step(st);
    expect(r.opened).toEqual([]);
    // The first item goes on: the Bag.
    st = r.st;
    st.lifetime.itemsEquipped = 1;
    r = step(st);
    expect(r.opened).toEqual(['bag']);
    // The tutorial ends: luck and the Codex, which open quietly (already seen: no walkthrough); Upgrades
    // and the dumpster wait for gold, Worlds for World 1's boss.
    st = r.st;
    st.dumpster.beginner = { state: 'done', uid: null };
    st.currencies.coins = 0;
    r = step(st);
    expect(r.opened).toEqual(['luck', 'codex']);
    expect(r.st.features.seen).toEqual(expect.arrayContaining(['luck', 'codex']));
    expect(r.st.features.seen).not.toContain('worlds');
    // Gold for the cheapest upgrade (and the dumpster's).
    st = r.st;
    st.currencies.coins = Math.max(upgradeCost(st.dumpster.level), 1e6);
    r = step(st);
    expect(r.opened).toEqual(['upgrades', 'dumpster']);
    // World 1's boss falls: Worlds (there is somewhere else worth going now).
    st = r.st;
    st.stage.highestCleared = 1;
    r = step(st);
    expect(r.opened).toEqual(['worlds']);
    // A couple of worlds short of the first rebirth's: Rebirth.
    st = r.st;
    st.stage.highestCleared = rebirthTabWorld();
    r = step(st);
    // (Today's tasks open with it: a couple of worlds have fallen.)
    expect(r.opened).toEqual(['rebirth', 'daily']);
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
    // World 20 this run: the Endless Dump.
    st = r.st;
    st.stage.highestCleared = DATA.worlds.length;
    r = step(st);
    expect(r.opened).toEqual(['endless']);
    // Rebirth 5: Become a Legend.
    st = r.st;
    st.rebirths = BAL.legend.unlockRebirths;
    r = step(st);
    expect(r.opened).toEqual(['legend']);
    // A few minutes into the game (past the tutorial): the Roll tab's Boosts.
    st = r.st;
    st.playTimeMs = BAL.boosts.unlockMinutes * 60_000;
    r = step(st);
    expect(r.opened).toEqual(['boosts']);
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
    st.features.seen.push('luck');
    expect(featureView(st, 'upgrades')).toBe('intro');
    st.features.seen.push('upgrades');
    expect(introFeature(st)).toBeNull();
  });

  it('they take their turns in the order they opened: one being introduced is never cut off by another opening after it', () => {
    const st = freshState();
    // Upgrades opened as the tutorial ended; World 1's boss fell a moment later.
    st.features.unlocked.push('upgrades', 'worlds');
    expect(introFeature(st)).toBe('upgrades');
    expect(featureView(st, 'worlds')).toBe('locked');
    st.features.seen.push('upgrades');
    expect(introFeature(st)).toBe('worlds');
    // The other way round: the boss fell first, so Worlds keeps its turn when Upgrades opens.
    const other = freshState();
    other.features.unlocked.push('worlds', 'upgrades');
    expect(introFeature(other)).toBe('worlds');
    expect(featureView(other, 'upgrades')).toBe('locked');
  });

  it('Upgrades opens with the tutorial over once one is affordable, or at once if one was already bought from the Roll tab\'s card', () => {
    const st = freshState();
    st.dumpster.beginner = { state: 'done', uid: null };
    st.currencies.coins = 0;
    expect(step(st).opened).not.toContain('upgrades');
    // One bought during the tutorial, the gold spent: the screen where it lives opens anyway.
    const bought = freshState();
    bought.currencies.coins = 100;
    const r = applyAction(bought, { type: 'buyUpgrade', id: 'luck' }, new Rng(1), T0);
    expect(r.state.upgrades.luck).toBe(1);
    // (Not while the tutorial is still running.)
    expect(r.state.features.unlocked).not.toContain('upgrades');
    const over = clone(r.state);
    over.dumpster.beginner = { state: 'done', uid: null };
    over.currencies.coins = 0;
    expect(step(over).opened).toContain('upgrades');
  });

  it("the dumpster's upgrade is only introduced while it can be paid for; the ones after it go first", () => {
    const st = freshState();
    st.features.unlocked.push('dumpster', 'rebirth');
    st.currencies.coins = upgradeCost(st.dumpster.level) - 1;
    // Can't pay: no NEW bubble pointing at it, no button yet, and Rebirth's turn comes first.
    expect(introFeature(st)).toBe('rebirth');
    expect(featureView(st, 'dumpster')).toBe('locked');
    st.features.seen.push('rebirth');
    expect(introFeature(st)).toBeNull();
    // Enough gold: now it is introduced.
    st.currencies.coins = upgradeCost(st.dumpster.level);
    expect(introFeature(st)).toBe('dumpster');
    expect(featureView(st, 'dumpster')).toBe('intro');
    // Not while an upgrade is already running.
    st.dumpster.upgradeEndsAt = T0 + 60_000;
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
