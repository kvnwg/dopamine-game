import { describe, expect, it } from 'vitest';
import { applyAction, FEATURES, Rng, tick, type GameState } from '../src/core';
import { BAL, DATA } from '../src/data';
import { reelStops } from '../src/ui/reelTiming';
import { AFTER_EQUIP, doneCount, promptFor, stepOf, STEPS, TOKENS_LINE, tokensLanding, worldPrompt, type Spot, type Step } from '../src/ui/tutorialSteps';
import type { Tab } from '../src/ui/uiStore';
import { freshState, T0 } from './helpers';

const TABS: Tab[] = ['alley', 'heist', 'bag', 'upgrades', 'rebirth', 'worlds'];
const ASKING: Step[] = ['world', 'open', 'roll', 'best', 'lucky'];
const str = (key: string) => DATA.strings[key];

/** Runs the game until `until` holds (100 ms ticks), doing `each` after every tick; fails if it never does. */
function run(st: GameState, rng: Rng, until: (g: GameState) => boolean, each?: (g: GameState) => GameState, max = 1500): GameState {
  let s = st;
  for (let i = 0; i < max && !until(s); i++) {
    s = tick(s, { ticks: 1 }, rng, T0 + i * 100).state;
    if (each) s = each(s);
  }
  expect(until(s)).toBe(true);
  return s;
}

describe('the tutorial, step by step', () => {
  it('a new game played the way the hand asks goes: world, dumpster, gear on, lucky find, done', () => {
    const rng = new Rng(5);
    let st = freshState(1, T0, true);
    const act = (a: Parameters<typeof applyAction>[1]) => (st = applyAction(st, a, rng, T0).state);
    // 1. A world: he starts fighting.
    expect(stepOf(st)).toBe('world');
    act({ type: 'travel', world: 1 });
    expect(st.stage.chosen).toBe(true);
    // 2. The dumpster: the padlock comes off and it rolls by itself, up to the tutorial's own find.
    expect(stepOf(st)).toBe('open');
    act({ type: 'openDumpster' });
    expect(stepOf(st)).toBe('roll');
    st = run(st, rng, (g) => stepOf(g) !== 'roll');
    // 3. Put it on.
    expect(stepOf(st)).toBe('best');
    act({ type: 'equipBest' });
    expect(st.lifetime.itemsEquipped).toBeGreaterThan(0);
    expect(stepOf(st)).toBe('fight');
    // 4. Beginner's luck: its tokens are called out while they chain, then its find waits in the bag.
    let sawTokens = false;
    st = run(
      st,
      rng,
      (g) => stepOf(g) === 'lucky',
      (g) => {
        sawTokens ||= tokensLanding(g);
        // (More gear before it comes: on it goes, as the hand asks.)
        return stepOf(g) === 'best' ? applyAction(g, { type: 'equipBest' }, rng, T0).state : g;
      },
    );
    expect(sawTokens).toBe(true);
    expect(tokensLanding(st)).toBe(false);
    act({ type: 'equipBest' });
    expect(stepOf(st)).toBeNull();
  });

  it('never asks for the Bag before its own find has landed and the Bag has opened, whatever the warm-up rolls', () => {
    // (A warm-up find could once be the tutorial item's own base, a plain traffic cone: it counted as
    // the tutorial's find, and the hand pointed at the Bag tab, still locked, as the real one spun.)
    for (let seed = 1; seed <= 80; seed++) {
      const rng = new Rng(seed);
      let st = applyAction(applyAction(freshState(seed, T0, true), { type: 'travel', world: 1 }, rng, T0).state, { type: 'openDumpster' }, rng, T0).state;
      st = run(st, rng, (g) => stepOf(g) !== 'roll');
      expect(stepOf(st), `seed ${seed}`).toBe('best');
      expect(st.features.unlocked, `seed ${seed}`).toContain('bag');
      expect(st.roll.current?.landed, `seed ${seed}`).toBe(true);
      expect(st.inventory.some((x) => x.baseId === BAL.dumpster.tutorialItem.baseId && x.rarity === BAL.dumpster.tutorialItem.rarity), `seed ${seed}`).toBe(true);
    }
  });

  it('the first Equip best puts on the tutorial\'s find and every warm-up find: each is for a slot of its own', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const rng = new Rng(seed);
      let st = applyAction(applyAction(freshState(seed, T0, true), { type: 'travel', world: 1 }, rng, T0).state, { type: 'openDumpster' }, rng, T0).state;
      st = run(st, rng, (g) => stepOf(g) !== 'roll');
      const finds = BAL.tutorial.warmupRarities.length + 1;
      expect(new Set(st.inventory.map((x) => x.slot)).size, `seed ${seed}`).toBe(finds);
      st = applyAction(st, { type: 'equipBest' }, rng, T0).state;
      expect(st.lifetime.itemsEquipped, `seed ${seed}`).toBe(finds);
      // Enough for beginner's luck to come on time (it waits for this many items worn).
      expect(finds).toBeGreaterThanOrEqual(BAL.tutorial.beginnerAfterEquips);
    }
  });

  it('the pips only ever fill up', () => {
    const order: Step[] = ['world', 'open', 'roll', 'best', 'fight', 'lucky'];
    const done = order.map(doneCount);
    expect(done[0]).toBe(0);
    for (let i = 1; i < done.length; i++) expect(done[i]).toBeGreaterThanOrEqual(done[i - 1]);
    expect(Math.max(...done)).toBeLessThan(STEPS);
  });

  it("luck tokens are only called out on beginner's luck, from its first token to its landing", () => {
    const rng = new Rng(9);
    let st = applyAction(applyAction(freshState(1, T0, true), { type: 'travel', world: 1 }, rng, T0).state, { type: 'openDumpster' }, rng, T0).state;
    let seen = 0;
    for (let i = 0; i < 1500 && st.dumpster.beginner.state !== 'done'; i++) {
      st = tick(st, { ticks: 1 }, rng, T0 + i * 100).state;
      const step = stepOf(st);
      if (step === 'best' || step === 'lucky') st = applyAction(st, { type: 'equipBest' }, rng, T0).state;
      const spin = st.roll.current;
      if (tokensLanding(st)) {
        seen++;
        expect(spin!.scripted).toBe('beginner');
        expect(spin!.landed).toBe(false);
        expect(st.roll.timer * 1000).toBeGreaterThanOrEqual(reelStops(spin!, 0)[0].at);
      } else if (spin?.scripted === 'beginner' && !spin.landed) {
        // Not before its first token has stopped.
        expect(st.roll.timer * 1000).toBeLessThan(reelStops(spin, 0)[0].at);
      }
    }
    expect(st.dumpster.beginner.state).toBe('done');
    expect(seen).toBeGreaterThan(10);
  });
});

describe('what the tutorial says', () => {
  /** Every line it can say: its steps on every tab, what follows the first equip, the tokens, each feature. */
  const keys = new Set<string>([...AFTER_EQUIP, TOKENS_LINE]);
  for (const step of ASKING) for (const tab of TABS) keys.add(promptFor(step, tab)!.key);
  for (const tab of TABS) keys.add(worldPrompt(tab).key);
  for (const f of FEATURES) if (f !== 'roll') keys.add(`tut.intro.${f}`);

  it('every line is two short ones: what to do, and why', () => {
    for (const key of keys) {
      const what = str(key);
      const why = str(`${key}.why`);
      expect(what, key).toBeTruthy();
      expect(why, `${key}.why`).toBeTruthy();
      // Short enough to read at a glance (and to fit the bubble on one line each).
      expect(what.length, what).toBeLessThanOrEqual(24);
      expect(why.length, why).toBeLessThanOrEqual(34);
    }
  });

  it('the top line names what the hand points at, the tab first when its button is on another one', () => {
    const named = (spot: Spot): string =>
      spot === 'world1' ? 'World 1' : spot === 'lock' ? 'lock' : spot === 'equipBest' ? str('bag.equipBest').toUpperCase() : str(`tab.${spot.slice(4)}`);
    const home: Record<Exclude<Spot, `tab:${Tab}`>, Tab> = { world1: 'worlds', lock: 'alley', equipBest: 'bag' };
    for (const step of ASKING) {
      for (const tab of TABS) {
        const p = promptFor(step, tab)!;
        if (p.spot === null) continue;
        expect(str(p.key), `${step} on ${tab}`).toContain(named(p.spot));
        // A button is only asked for on the tab it lives on; anywhere else, its tab is.
        if (p.spot.startsWith('tab:')) expect(p.spot).not.toBe(`tab:${tab}`);
        else expect(home[p.spot as keyof typeof home]).toBe(tab);
      }
    }
    // Watching the reels and the lines after it ask for nothing.
    for (const tab of TABS) {
      expect(promptFor('roll', tab)!.spot).toBeNull();
      expect(promptFor('fight', tab)).toBeNull();
    }
  });
});
