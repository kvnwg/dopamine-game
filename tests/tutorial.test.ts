import { describe, expect, it } from 'vitest';
import { applyAction, beginnerLuckDue, GameStateSchema, performSpin, Rng, type CoreEvent, type GameState } from '../src/core';
import { BAL, DATA } from '../src/data';
import { freshState, T0 } from './helpers';

const clone = (s: GameState) => structuredClone(s) as GameState;

type SpinStart = Extract<CoreEvent, { type: 'spinStart' }>;
type Roll = Extract<CoreEvent, { type: 'roll' }>;

/** One whole spin; returns the new state and its events. */
function spin(st: GameState, rng: Rng): { st: GameState; events: CoreEvent[] } {
  const d = clone(st);
  const events: CoreEvent[] = [];
  performSpin(d, rng, T0, events);
  return { st: d, events };
}

describe("tutorial: the first roll and beginner's luck", () => {
  const t = BAL.tutorial;
  const tutorialSlot = DATA.itemsById.get(BAL.dumpster.tutorialItem.baseId)!.slot;

  it('the very first spin is scripted: the tutorial item, marked as such', () => {
    const rng = new Rng(3);
    const { events } = spin(freshState(), rng);
    const start = events.find((e): e is SpinStart => e.type === 'spinStart')!;
    const roll = events.find((e): e is Roll => e.type === 'roll')!;
    expect(start.scripted).toBe('first');
    expect(roll.scripted).toBe('first');
    expect(roll.item.baseId).toBe(BAL.dumpster.tutorialItem.baseId);
  });

  it("comes once the raccoon has dressed up and a few items have rolled: a token chain into a rare item in the tutorial item's slot", () => {
    const rng = new Rng(7);
    let { st } = spin(freshState(), rng);
    // Roll a few, then put the best on (the tutorial's Equip best step).
    for (let i = 0; i < 4; i++) st = spin(st, rng).st;
    expect(beginnerLuckDue(st)).toBe(false);
    st = applyAction(st, { type: 'equipBest' }, rng, T0).state;
    expect(st.lifetime.itemsEquipped).toBeGreaterThanOrEqual(t.beginnerAfterEquips);
    let lucky: SpinStart | null = null;
    let rolledBefore = 0;
    for (let i = 0; i < 40 && !lucky; i++) {
      const due = beginnerLuckDue(st);
      const r = spin(st, rng);
      const start = r.events.find((e): e is SpinStart => e.type === 'spinStart')!;
      expect(start.scripted === 'beginner').toBe(due);
      if (due) {
        lucky = start;
        rolledBefore = st.roll.count;
      }
      st = r.st;
    }
    expect(lucky).not.toBeNull();
    // It waited for enough rolls, but not for the fallback.
    expect(rolledBefore).toBeGreaterThanOrEqual(t.beginnerAfterRolls);
    expect(rolledBefore).toBeLessThan(t.beginnerAtRolls);
    const reel = lucky!.reels[0];
    expect(reel.mults).toEqual(t.beginnerTokens);
    expect(reel.item.slot).toBe(tutorialSlot);
    // At least the scripted rarity (an enchant can only bump it higher).
    const order = ['junk', 'decent', 'shiny', 'epic', 'legendary', 'mythic', 'vintage', 'limited', 'prototype', 'mint', 'gemMint', 'museum', 'grail'];
    expect(order.indexOf(reel.item.rarity)).toBeGreaterThanOrEqual(order.indexOf(t.beginnerRarity));
    expect(st.dumpster.beginner).toEqual({ state: 'rolled', uid: reel.item.uid });
    // It never comes again.
    for (let i = 0; i < 20; i++) {
      const r = spin(st, rng);
      expect(r.events.some((e) => e.type === 'spinStart' && e.scripted === 'beginner')).toBe(false);
      st = r.st;
    }
  });

  it("comes by beginnerAtRolls even if nothing is worn; wearing it ends the tutorial with the gem gift, scrapping it ends it without", () => {
    const rng = new Rng(11);
    let st = spin(freshState(), rng).st;
    let uid: number | null = null;
    for (let i = 0; i < 40 && uid === null; i++) {
      st = spin(st, rng).st;
      if (st.dumpster.beginner.state === 'rolled') uid = st.dumpster.beginner.uid;
    }
    expect(uid).not.toBeNull();
    expect(st.roll.count).toBeLessThanOrEqual(t.beginnerAtRolls + 1);
    // Wear it.
    const gems = st.currencies.gems;
    const worn = applyAction(st, { type: 'equipItem', uid: uid! }, rng, T0);
    const done = worn.events.find((e) => e.type === 'tutorialDone');
    expect(done).toEqual({ type: 'tutorialDone', gems: t.rewardGems });
    expect(worn.state.currencies.gems).toBe(gems + t.rewardGems);
    expect(worn.state.dumpster.beginner.state).toBe('done');
    // Or scrap it instead.
    const scrapped = applyAction(st, { type: 'scrapItem', uid: uid! }, rng, T0);
    expect(scrapped.state.dumpster.beginner.state).toBe('done');
    expect(scrapped.events.some((e) => e.type === 'tutorialDone')).toBe(false);
  });

  it("saves from before the tutorial count as done, and rebirths never get beginner's luck", () => {
    const old = clone(freshState()) as unknown as { dumpster: Record<string, unknown> };
    delete old.dumpster.beginner;
    const parsed = GameStateSchema.parse(old);
    expect(parsed.dumpster.beginner.state).toBe('done');
    const reborn = clone(freshState());
    reborn.rebirths = 1;
    reborn.dumpster.firstDiveDone = true;
    reborn.roll.count = 50;
    expect(beginnerLuckDue(reborn)).toBe(false);
  });
});
