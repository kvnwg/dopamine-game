import { describe, expect, it } from 'vitest';
import {
  applyAction, currentRate, deserialize, featureView, firstWorldSafe, introFeature, Rng, serialize, tick, type CoreEvent, type GameState,
} from '../src/core';
import { BAL } from '../src/data';
import { freshState, T0 } from './helpers';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function run(st: GameState, rng: Rng, ticks: number, from = 0): { st: GameState; events: CoreEvent[] } {
  const events: CoreEvent[] = [];
  let s = st;
  for (let i = from; i < from + ticks; i++) {
    const r = tick(s, { ticks: 1 }, rng, T0 + i * 100);
    s = r.state;
    events.push(...r.events);
  }
  return { st: s, events };
}

describe('the first world (a new game lands in the fight)', () => {
  it('a brand-new game is already fighting in World 1: enemies within seconds, the padlock still on, nothing rolling', () => {
    const rng = new Rng(3);
    const st = freshState(1, T0, true);
    expect(st.battle.phase).toBe('walking');
    expect(st.battle.stage).toBe(1);
    expect(st.features).toEqual({ unlocked: [], seen: [] });
    // Two seconds in, the first wave is there and he is hitting it; the dumpster waits for its tap.
    const r = run(st, rng, 20);
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'waveStart', stage: 1, wave: 0 }));
    expect(r.st.battle.enemies.length).toBeGreaterThan(0);
    expect(r.events.some((e) => e.type === 'spinStart')).toBe(false);
    // Left alone on the title's first screen for a minute, he has killed things and earned gold.
    const later = run(r.st, rng, 580, 20);
    expect(later.st.lifetime.kills).toBeGreaterThan(3);
    expect(later.st.currencies.coins).toBeGreaterThan(0);
    expect(later.st.roll.count).toBe(0);
  });

  it('the Worlds tab stays locked until World 1\'s boss falls, then it is introduced like the others', () => {
    const rng = new Rng(3);
    let st = freshState();
    expect(featureView(st, 'worlds')).toBe('locked');
    // The tutorial over, the Bag met: still nothing to go to.
    st = clone(st);
    st.lifetime.itemsEquipped = 1;
    st.dumpster.beginner = { state: 'done', uid: null };
    st.features.unlocked.push('bag');
    st.features.seen.push('bag');
    let r = applyAction(st, { type: 'featureSeen', feature: 'bag' }, rng, T0);
    expect(r.state.features.unlocked).not.toContain('worlds');
    // World 1 beaten: it opens, waiting for its NEW bubble (not quietly, as Luck and the Codex do).
    st = clone(r.state);
    st.stage.highestCleared = 1;
    r = applyAction(st, { type: 'featureSeen', feature: 'bag' }, rng, T0);
    expect(r.events).toContainEqual({ type: 'featureUnlocked', feature: 'worlds' });
    expect(r.state.features.seen).not.toContain('worlds');
    expect(introFeature(r.state)).toBe('worlds');
    expect(featureView(r.state, 'worlds')).toBe('intro');
    const seen = applyAction(r.state, { type: 'featureSeen', feature: 'worlds' }, rng, T0).state;
    expect(featureView(seen, 'worlds')).toBe('open');
  });

  it('travelling to another world starts the fight there; to the one he is in, nothing', () => {
    const rng = new Rng(3);
    const st = freshState();
    expect(applyAction(st, { type: 'travel', world: 1 }, rng, T0).events.some((e) => e.type === 'stageStart')).toBe(false);
    const picked = applyAction(st, { type: 'travel', world: 2 }, rng, T0);
    expect(picked.events).toContainEqual(expect.objectContaining({ type: 'stageStart', stage: 2 }));
    expect(run(picked.state, rng, 300).events.some((e) => e.type === 'waveStart' && e.stage === 2)).toBe(true);
  });

  it('fighting gear-less from the first second, he never falls in World 1 until its boss has fallen once: not during the tutorial, not after it', () => {
    const rng = new Rng(9);
    let s = freshState(9, T0, true);
    let i = 0;
    // Gear-less, the padlock never touched, the tutorial's end passing by on the way (it ends about when
    // the boss arrives): he holds on at 1 HP, and beats the boss in the end.
    for (; i < 3000 && s.stage.highestCleared < 1; i++) {
      if (i === 400) {
        s = clone(s);
        s.dumpster.beginner = { state: 'done', uid: null };
        expect(firstWorldSafe(s)).toBe(true);
      }
      const x = tick(s, { ticks: 1 }, rng, T0 + i * 100);
      s = x.state;
      expect(x.events.some((e) => e.type === 'playerDeath')).toBe(false);
    }
    expect(s.stage.highestCleared).toBe(1);
    expect(s.lifetime.kills).toBeGreaterThan(10);
    // World 1 beaten: the same gear-less raccoon, staying there, falls in time like anyone.
    expect(firstWorldSafe(s)).toBe(false);
    const again = applyAction(s, { type: 'afterBoss', next: false }, rng, T0 + i * 100).state;
    expect(again.battle.stage).toBe(1);
    const after = run(again, rng, 3000, i);
    expect(after.st.battle.stage).toBe(1);
    expect(after.events.some((e) => e.type === 'playerDeath')).toBe(true);
  });

  it('he earns from the first second, so time away pays from the start; a reload puts him back in the fight', () => {
    const rng = new Rng(3);
    const st = freshState(1, T0, true);
    const rate = currentRate(st, T0);
    expect(rate.coins).toBeGreaterThan(0);
    expect(rate.xp).toBeGreaterThan(0);
    const loaded = deserialize(serialize(st))!;
    const booted = applyAction(loaded, { type: 'boot' }, rng, T0);
    expect(booted.state.battle.phase).toBe('walking');
    expect(booted.events).toContainEqual(expect.objectContaining({ type: 'stageStart', stage: 1 }));
  });

  it('a save from when he waited for his first world to be picked (Nov 2026) starts fighting', () => {
    const old = clone(freshState(1, T0, true)) as unknown as { stage: Record<string, unknown>; battle: Record<string, unknown>; features: Record<string, unknown> };
    old.stage.chosen = false;
    old.battle.phase = 'idle';
    old.battle.phaseTime = 0;
    old.features = { unlocked: ['worlds'], seen: ['worlds'] };
    const loaded = deserialize(JSON.stringify(old))!;
    expect(loaded).not.toBeNull();
    expect('chosen' in loaded.stage).toBe(false);
    // Its boot starts World 1...
    const rng = new Rng(4);
    const booted = applyAction(loaded, { type: 'boot' }, rng, T0);
    expect(booted.state.battle.phase).toBe('walking');
    // ...and even without one (a hot update hands the game over mid-play), the next tick does.
    const ticked = tick(loaded, { ticks: 1 }, rng, T0);
    expect(ticked.state.battle.phase).toBe('walking');
    expect(ticked.state.battle.phaseTime).toBe(BAL.combat.walkSeconds);
    // (Its Worlds tab, open back then, stays open.)
    expect(featureView(ticked.state, 'worlds')).toBe('open');
  });
});
