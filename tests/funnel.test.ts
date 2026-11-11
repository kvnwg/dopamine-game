import { describe, expect, it } from 'vitest';
import {
  applyAction, beginnerLuckCharge, beginnerLuckDue, bestUpgrades, cheapestUpgrade, createInitialState, performSpin, Rng, tick, upgradePrice,
  type GameAction, type GameState,
} from '../src/core';
import { BAL } from '../src/data';
import { funnelSteps, PLAY_MARKS } from '../src/app/funnel';
import { freshState, T0 } from './helpers';

const clone = (s: GameState) => structuredClone(s) as GameState;

/**
 * A new player's first two minutes, through the core: they take `react` seconds to act on each ask.
 * The padlock is tapped `react` + 2 s in (the title's iris takes the first two), each tutorial find is
 * worn `react` after its reveal has landed (3.3 s), and Equip best is tapped once two finds are waiting.
 * With `buy`, the first upgrades are bought as their price comes in. Returns when each step first
 * happened (seconds of play; `fell`: his first K.O.), and how many times.
 */
function firstSession(seed: number, react = 2.5, buy = false): { at: Record<string, number>; count: Record<string, number>; st: GameState } {
  const rng = new Rng(Rng.hashSeed(seed));
  let st = createInitialState(T0, Rng.hashSeed(seed));
  const at: Record<string, number> = {};
  const count: Record<string, number> = {};
  const note = (before: GameState, after: GameState, events: Parameters<typeof funnelSteps>[2]) => {
    for (const h of funnelSteps(before, after, events)) {
      at[h.step] ??= h.t;
      count[h.step] = (count[h.step] ?? 0) + 1;
    }
  };
  const REVEAL = 3.3;
  let wearAt = -1;
  let bestAt = -1;
  for (let i = 0; i < 1200; i++) {
    const now = T0 + i * 100;
    const sec = i / 10;
    const act = (a: GameAction) => {
      const r = applyAction(st, a, rng, now);
      note(st, r.state, r.events);
      st = r.state;
    };
    const r = tick(st, { ticks: 1 }, rng, now);
    note(st, r.state, r.events);
    st = r.state;
    // (Not a funnel step: when he first fell, for the checks here.)
    if (r.events.some((e) => e.type === 'playerDeath')) at.fell ??= st.playTimeMs / 1000;
    if (Math.abs(sec - (react + 2)) < 1e-9) act({ type: 'openDumpster' });
    // A tutorial find waiting in the bag: its reveal's tap puts it on.
    const cone = st.lifetime.itemsEquipped === 0 ? st.inventory.find((x) => x.baseId === BAL.dumpster.tutorialItem.baseId) : undefined;
    const lucky = st.dumpster.beginner.state === 'rolled' ? st.inventory.find((x) => x.uid === st.dumpster.beginner.uid) : undefined;
    const find = cone ?? lucky;
    if (find && wearAt < 0) wearAt = sec + REVEAL + react;
    if (find && wearAt >= 0 && sec >= wearAt) {
      act({ type: 'equipItem', uid: find.uid });
      wearAt = -1;
    }
    // The tutorial's Equip best step (the Bag tab, then the button: two asks).
    if (st.lifetime.itemsEquipped > 0 && st.lifetime.itemsEquipped < BAL.tutorial.beginnerAfterEquips && bestUpgrades(st).length >= 2) {
      if (bestAt < 0) bestAt = sec + 2 * react + 3;
      if (sec >= bestAt) {
        act({ type: 'equipBest' });
        bestAt = -1;
      }
    }
    if (buy && st.lifetime.itemsEquipped >= BAL.tutorial.beginnerAfterEquips) {
      const c = cheapestUpgrade(st);
      if (c && st.currencies.coins >= c.price && Object.keys(st.upgrades).length < 2) act({ type: 'buyUpgrade', id: c.def.id });
    }
  }
  return { at, count, st };
}

describe('the first minute (what a new player has seen by the time CrazyGames counts them)', () => {
  const ORDER = ['dumpster_open', 'first_roll', 'first_find', 'first_equip', 'dressed', 'beginner_spin', 'beginner_find', 'tutorial_done'];

  it('every step of the tutorial happens once, in order, inside the first minute of play', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { at, count } = firstSession(seed);
      for (const step of ORDER) {
        expect(count[step], `${step} (seed ${seed})`).toBe(1);
        expect(at[step], `${step} (seed ${seed})`).toBeLessThan(60);
      }
      for (let k = 1; k < ORDER.length; k++) expect(at[ORDER[k]], `${ORDER[k]} after ${ORDER[k - 1]} (seed ${seed})`).toBeGreaterThanOrEqual(at[ORDER[k - 1]]);
    }
  });

  it('the first Legendary lands within 5 s of the padlock, is on him 15 s in, and beginner\'s luck lands at about 50 s', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { at } = firstSession(seed);
      expect(at.first_roll - at.dumpster_open, `seed ${seed}`).toBeLessThan(2);
      expect(at.first_find - at.dumpster_open, `seed ${seed}`).toBeLessThan(5);
      expect(at.first_equip, `seed ${seed}`).toBeLessThan(16);
      expect(at.dressed, `seed ${seed}`).toBeLessThan(32);
      // (Its two luck tokens are rolling from about 41 s: a build-up to stay for.)
      expect(at.beginner_spin, `seed ${seed}`).toBeGreaterThan(36);
      expect(at.beginner_spin, `seed ${seed}`).toBeLessThan(46);
      expect(at.beginner_find, `seed ${seed}`).toBeGreaterThan(44);
      expect(at.beginner_find, `seed ${seed}`).toBeLessThan(55);
    }
  });

  it('World 1\'s boss is on screen around the one-minute mark: it arrives before, and never knocks him out', () => {
    let across = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const { at } = firstSession(seed);
      expect(at.first_boss, `seed ${seed}`).toBeGreaterThan(30);
      expect(at.first_boss, `seed ${seed}`).toBeLessThan(65);
      expect(at.world_1_clear, `seed ${seed}`).toBeGreaterThan(at.first_boss);
      expect(at.world_1_clear, `seed ${seed}`).toBeLessThan(120);
      // (Further on he can fall; never before World 1 is beaten.)
      if (at.fell !== undefined) expect(at.fell, `seed ${seed}`).toBeGreaterThan(at.world_1_clear);
      if (at.first_boss < 60 && at.world_1_clear > 55) across++;
    }
    // For most players the boss fight itself covers the minute's last seconds.
    expect(across).toBeGreaterThanOrEqual(5);
  });

  it('a slower player (4 s to act on each ask) is in the middle of the build-up as the minute passes', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const { at } = firstSession(seed, 4);
      expect(at.first_find, `seed ${seed}`).toBeLessThan(12);
      expect(at.first_equip, `seed ${seed}`).toBeLessThan(20);
      expect(at.beginner_spin, `seed ${seed}`).toBeLessThan(56);
      expect(at.beginner_find, `seed ${seed}`).toBeLessThan(66);
    }
  });

  it('the first two upgrades are affordable, and count, inside the first minute', () => {
    const { at, count, st } = firstSession(3, 2.5, true);
    expect(count.first_upgrade).toBe(1);
    expect(count.second_upgrade).toBe(1);
    expect(at.first_upgrade).toBeLessThan(40);
    expect(at.second_upgrade).toBeLessThan(60);
    expect(st.upgrades.luck).toBe(1);
  });

  it('the "still playing" marks go out once each, at their second', () => {
    const { at, count } = firstSession(2);
    for (const s of PLAY_MARKS) {
      if (s > 120) continue;
      expect(count[`played_${s}s`]).toBe(1);
      expect(at[`played_${s}s`]).toBe(s);
    }
    expect(count.played_180s).toBeUndefined();
  });

  it('nothing is sent after a rebirth, or for a game well under way', () => {
    const st = freshState();
    st.rebirths = 1;
    const next = clone(st);
    next.playTimeMs = 61_000;
    next.lifetime.itemsEquipped = 4;
    expect(funnelSteps(st, next, [])).toEqual([]);
    const late = freshState();
    late.playTimeMs = 400_000;
    late.dumpster.beginner = { state: 'done', uid: null };
    late.stage.highestCleared = 2;
    const later = clone(late);
    later.playTimeMs = 400_100;
    later.upgrades = { luck: 1 };
    expect(funnelSteps(late, later, [])).toEqual([]);
  });

  it('a tutorial ended without its find worn (scrapped) is told apart', () => {
    const rng = new Rng(11);
    let st = freshState();
    let uid: number | null = null;
    for (let i = 0; i < 40 && uid === null; i++) {
      const d = clone(st);
      performSpin(d, rng, T0, []);
      st = d;
      if (st.dumpster.beginner.state === 'rolled') uid = st.dumpster.beginner.uid;
    }
    expect(uid).not.toBeNull();
    const worn = applyAction(st, { type: 'equipItem', uid: uid! }, rng, T0);
    expect(funnelSteps(st, worn.state, worn.events).map((h) => h.step)).toContain('tutorial_done');
    const scrapped = applyAction(st, { type: 'scrapItem', uid: uid! }, rng, T0);
    const steps = funnelSteps(st, scrapped.state, scrapped.events).map((h) => h.step);
    expect(steps).toContain('tutorial_left');
    expect(steps).not.toContain('tutorial_done');
  });
});

describe("the beginner's luck meter", () => {
  it('fills as its spin gets closer, is full exactly when the next spin is it, and never runs backward', () => {
    for (const seed of [1, 2, 3]) {
      const rng = new Rng(Rng.hashSeed(seed));
      let st = applyAction(createInitialState(T0, Rng.hashSeed(seed)), { type: 'openDumpster' }, rng, T0).state;
      expect(beginnerLuckCharge(st)).toBe(0);
      let last = 0;
      let full = false;
      for (let i = 0; i < 900 && st.dumpster.beginner.state === 'pending'; i++) {
        const r = tick(st, { ticks: 1 }, rng, T0 + i * 100);
        st = r.state;
        // Wear whatever beats what's on (the cone first), as the tutorial has the player do.
        const cone = st.inventory.find((x) => x.baseId === BAL.dumpster.tutorialItem.baseId);
        if (cone) st = applyAction(st, { type: 'equipItem', uid: cone.uid }, rng, T0).state;
        else if (st.lifetime.itemsEquipped > 0 && bestUpgrades(st).length >= 2) st = applyAction(st, { type: 'equipBest' }, rng, T0).state;
        if (st.dumpster.beginner.state !== 'pending') break;
        const c = beginnerLuckCharge(st);
        expect(c).toBeGreaterThanOrEqual(last - 1e-9);
        expect(c === 1).toBe(beginnerLuckDue(st));
        if (c === 1) full = true;
        last = c;
      }
      // It filled, its spin came, and from then on it stays full.
      expect(full).toBe(true);
      expect(st.dumpster.beginner.state).toBe('rolled');
      expect(beginnerLuckCharge(st)).toBe(1);
    }
  });

  it('is empty after a rebirth (no beginner\'s luck then) and full once the tutorial is done', () => {
    const reborn = freshState();
    reborn.rebirths = 1;
    reborn.roll.count = 50;
    expect(beginnerLuckCharge(reborn)).toBe(0);
    const done = freshState();
    done.dumpster.beginner = { state: 'done', uid: null };
    expect(beginnerLuckCharge(done)).toBe(1);
  });
});

describe("the Roll tab's first upgrades", () => {
  it('the cheapest tier open to buy: Luck I first, then the cheapest line hanging off it', () => {
    const st = freshState();
    const first = cheapestUpgrade(st)!;
    expect(first.def.id).toBe('luck');
    expect(first.price).toBe(upgradePrice(st, first.def));
    st.currencies.coins = first.price;
    const bought = applyAction(st, { type: 'buyUpgrade', id: first.def.id }, new Rng(1), T0).state;
    expect(bought.currencies.coins).toBe(0);
    const next = cheapestUpgrade(bought)!;
    expect(next.def.id).not.toBe('luck');
    expect(next.def.requires?.id).toBe('luck');
    // Nothing unlocked is cheaper than it.
    for (const def of BAL.upgrades) {
      const open = !def.requires || (bought.upgrades[def.requires.id] ?? 0) >= def.requires.level;
      if (open && (bought.upgrades[def.id] ?? 0) < def.max) expect(upgradePrice(bought, def)).toBeGreaterThanOrEqual(next.price);
    }
  });
});
