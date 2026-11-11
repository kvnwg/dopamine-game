import { describe, expect, it } from 'vitest';
import { applyAction, bestUpgrades, FEATURES, Rng, tick, type GameState } from '../src/core';
import { BAL, DATA } from '../src/data';
import { reelStops } from '../src/ui/reelTiming';
import {
  AFTER_WEAR, buyPrompt, CHARGE_LINE, doneCount, INCOMING_LINE, luckIncoming, promptFor, stepOf, STEPS, TOKENS_LINE, tokensLanding,
  type Prompt, type Spot, type Step,
} from '../src/ui/tutorialSteps';
import type { Tab } from '../src/ui/uiStore';
import { freshState, T0 } from './helpers';

const TABS: Tab[] = ['alley', 'heist', 'bag', 'upgrades', 'rebirth', 'worlds'];
const ASKING: Step[] = ['open', 'roll', 'wear', 'best', 'lucky'];
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

/** A new game with its padlock just knocked off (he is already fighting in World 1). */
function opened(seed: number, rng: Rng): GameState {
  return applyAction(freshState(seed, T0, true), { type: 'openDumpster' }, rng, T0).state;
}

/** The tutorial find waiting in the bag (the first one, or beginner's luck): its reveal's tap wears it. */
function wearFind(st: GameState, rng: Rng): GameState {
  const b = st.dumpster.beginner;
  const find = st.inventory.find((x) => (b.state === 'rolled' ? x.uid === b.uid : x.baseId === BAL.dumpster.tutorialItem.baseId && x.rarity === BAL.dumpster.tutorialItem.rarity));
  expect(find).toBeDefined();
  return applyAction(st, { type: 'equipItem', uid: find!.uid }, rng, T0).state;
}

describe('the tutorial, step by step', () => {
  it('a new game played the way it asks goes: padlock, the find worn from its reveal, Equip best, the lucky find worn, done', () => {
    const rng = new Rng(5);
    let st = freshState(1, T0, true);
    // He is already fighting: nothing to pick first.
    expect(st.battle.phase).not.toBe('idle');
    // 1. The dumpster: the padlock comes off and it rolls by itself, up to the tutorial's own find.
    expect(stepOf(st)).toBe('open');
    expect(doneCount(st)).toBe(0);
    st = applyAction(st, { type: 'openDumpster' }, rng, T0).state;
    expect(stepOf(st)).toBe('roll');
    expect(doneCount(st)).toBe(1);
    st = run(st, rng, (g) => stepOf(g) !== 'roll');
    // 2. Wear it (the reveal's tap).
    expect(stepOf(st)).toBe('wear');
    st = wearFind(st, rng);
    expect(st.lifetime.itemsEquipped).toBe(1);
    expect(stepOf(st)).toBe('fight');
    expect(doneCount(st)).toBe(2);
    // 3. Equip best, once two better finds are waiting; then 4. beginner's luck: it is rolling, its
    // tokens are called out while they chain, and its find waits in the bag.
    let sawBest = false;
    let sawTokens = false;
    let sawIncoming = false;
    st = run(
      st,
      rng,
      (g) => stepOf(g) === 'lucky',
      (g) => {
        sawTokens ||= tokensLanding(g);
        sawIncoming ||= luckIncoming(g);
        if (stepOf(g) !== 'best') return g;
        sawBest = true;
        expect(bestUpgrades(g).length).toBeGreaterThanOrEqual(2);
        return applyAction(g, { type: 'equipBest' }, rng, T0).state;
      },
    );
    expect(sawBest).toBe(true);
    expect(sawIncoming).toBe(true);
    expect(sawTokens).toBe(true);
    expect(tokensLanding(st)).toBe(false);
    expect(luckIncoming(st)).toBe(false);
    expect(doneCount(st)).toBe(3);
    st = wearFind(st, rng);
    expect(stepOf(st)).toBeNull();
    expect(doneCount(st)).toBe(STEPS);
  });

  it('never asks to wear the find before its own spin has landed and the Bag has opened, whatever the warm-up rolls', () => {
    // (A warm-up find could once be the tutorial item's own base, a plain traffic cone: it counted as
    // the tutorial's find, and the hand pointed at the Bag tab, still locked, as the real one spun.)
    for (let seed = 1; seed <= 80; seed++) {
      const rng = new Rng(seed);
      const st = run(opened(seed, rng), rng, (g) => stepOf(g) !== 'roll');
      expect(stepOf(st), `seed ${seed}`).toBe('wear');
      expect(st.features.unlocked, `seed ${seed}`).toContain('bag');
      expect(st.roll.current?.landed, `seed ${seed}`).toBe(true);
      expect(st.inventory.some((x) => x.baseId === BAL.dumpster.tutorialItem.baseId && x.rarity === BAL.dumpster.tutorialItem.rarity), `seed ${seed}`).toBe(true);
    }
  });

  it('a warm-up find is for a slot of its own, so it is always an upgrade waiting for Equip best', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const rng = new Rng(seed);
      let st = run(opened(seed, rng), rng, (g) => stepOf(g) !== 'roll');
      const finds = BAL.tutorial.warmupRarities.length + 1;
      expect(new Set(st.inventory.map((x) => x.slot)).size, `seed ${seed}`).toBe(finds);
      st = wearFind(st, rng);
      expect(bestUpgrades(st).length, `seed ${seed}`).toBe(finds - 1);
    }
  });

  it('the pips only ever fill up', () => {
    const rng = new Rng(11);
    let st = freshState(3, T0, true);
    let before = doneCount(st);
    expect(before).toBe(0);
    st = applyAction(st, { type: 'openDumpster' }, rng, T0).state;
    for (let i = 0; i < 1500 && stepOf(st) !== null; i++) {
      st = tick(st, { ticks: 1 }, rng, T0 + i * 100).state;
      const step = stepOf(st);
      if (step === 'wear' || step === 'lucky') st = wearFind(st, rng);
      else if (step === 'best') st = applyAction(st, { type: 'equipBest' }, rng, T0).state;
      const now = doneCount(st);
      expect(now).toBeGreaterThanOrEqual(before);
      if (stepOf(st) !== null) expect(now).toBeLessThan(STEPS);
      before = now;
    }
    expect(stepOf(st)).toBeNull();
    expect(before).toBe(STEPS);
  });

  it("luck tokens are only called out on beginner's luck, from its first token to its landing", () => {
    const rng = new Rng(9);
    let st = opened(1, rng);
    let seen = 0;
    for (let i = 0; i < 1500 && st.dumpster.beginner.state !== 'done'; i++) {
      st = tick(st, { ticks: 1 }, rng, T0 + i * 100).state;
      const step = stepOf(st);
      if (step === 'wear' || step === 'lucky') st = wearFind(st, rng);
      else if (step === 'best') st = applyAction(st, { type: 'equipBest' }, rng, T0).state;
      const spin = st.roll.current;
      if (tokensLanding(st)) {
        seen++;
        expect(luckIncoming(st)).toBe(true);
        expect(spin!.scripted).toBe('beginner');
        expect(spin!.landed).toBe(false);
        expect(st.roll.timer * 1000).toBeGreaterThanOrEqual(reelStops(spin!, 0)[0].at);
      } else if (spin?.scripted === 'beginner' && !spin.landed) {
        // Not before its first token has stopped (it is on its way, though).
        expect(luckIncoming(st)).toBe(true);
        expect(st.roll.timer * 1000).toBeLessThan(reelStops(spin, 0)[0].at);
      }
    }
    expect(st.dumpster.beginner.state).toBe('done');
    expect(seen).toBeGreaterThan(10);
  });
});

describe('what the tutorial says', () => {
  /** Everything it can ask for: its steps and the first upgrade, on every tab. */
  const asks: { name: string; tab: Tab; p: Prompt }[] = [];
  for (const tab of TABS) {
    for (const step of ASKING) asks.push({ name: step, tab, p: promptFor(step, tab)! });
    asks.push({ name: 'buy', tab, p: buyPrompt(tab) });
  }
  /** Every line it can say: those, what follows the first find, beginner's luck on its way, each feature. */
  const keys = new Set<string>([AFTER_WEAR, CHARGE_LINE, INCOMING_LINE, TOKENS_LINE, ...asks.map((a) => a.p.key)]);
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
    // (Beside the meter there is less room.)
    expect(str(`${CHARGE_LINE}.why`).length).toBeLessThanOrEqual(22);
  });

  it('the top line names what the hand points at, the tab first when its button is on another one', () => {
    const named = (spot: Spot): string =>
      spot === 'lock' ? 'lock' : spot === 'equipBest' ? str('bag.equipBest').toUpperCase() : spot === 'buy' ? str('firstBuy.buy') : str(`tab.${spot.slice(4)}`);
    const home: Record<Exclude<Spot, `tab:${Tab}`>, Tab> = { lock: 'alley', equipBest: 'bag', buy: 'alley' };
    for (const { name, tab, p } of asks) {
      if (p.spot === null) continue;
      expect(str(p.key), `${name} on ${tab}`).toContain(named(p.spot));
      // A button is only asked for on the tab it lives on; anywhere else, its tab is.
      if (p.spot.startsWith('tab:')) expect(p.spot).not.toBe(`tab:${tab}`);
      else expect(home[p.spot as keyof typeof home]).toBe(tab);
    }
    // Watching the reels and the fight ask for nothing.
    for (const tab of TABS) {
      expect(promptFor('roll', tab)!.spot).toBeNull();
      expect(promptFor('fight', tab)).toBeNull();
    }
  });
});
