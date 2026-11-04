import { describe, expect, it } from 'vitest';
import { applyAction, computeStats, currentRate, deserialize, featureView, introFeature, Rng, serialize, tick, type CoreEvent, type GameState } from '../src/core';
import { freshState, T0 } from './helpers';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** A brand-new game with its dumpster open: the raccoon hasn't picked a world yet. */
function newGame(): { st: GameState; rng: Rng } {
  const rng = new Rng(3);
  const st = applyAction(freshState(1, T0, true), { type: 'openDumpster' }, rng, T0).state;
  return { st, rng };
}

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

describe('the first world (a calm start)', () => {
  it('a new game\'s raccoon waits in his street: no enemies, no fighting, while the dumpster rolls', () => {
    const { st, rng } = newGame();
    expect(st.stage.chosen).toBe(false);
    expect(st.battle.phase).toBe('idle');
    const r = run(st, rng, 600);
    expect(r.events.some((e) => e.type === 'waveStart' || e.type === 'playerHit' || e.type === 'enemyHit' || e.type === 'kill')).toBe(false);
    expect(r.events.some((e) => e.type === 'spinStart')).toBe(true);
    expect(r.st.battle.enemies).toEqual([]);
    expect(r.st.battle.playerHp).toBe(computeStats(r.st).HP);
  });

  it('picking a world starts the fight there (World 1, where he stands, too)', () => {
    const { st, rng } = newGame();
    const picked = applyAction(st, { type: 'travel', world: 1 }, rng, T0);
    expect(picked.state.stage.chosen).toBe(true);
    expect(picked.events).toContainEqual(expect.objectContaining({ type: 'stageStart', stage: 1 }));
    const r = run(picked.state, rng, 300);
    expect(r.events.some((e) => e.type === 'waveStart')).toBe(true);
    // Once picked, World 1 is just "here": travelling to it again does nothing.
    expect(applyAction(r.st, { type: 'travel', world: 1 }, rng, T0).events.some((e) => e.type === 'stageStart')).toBe(false);
  });

  it('Worlds is open from the very start, padlock still on, so he can fight before a single roll; Luck and the Codex open quietly later', () => {
    const { st, rng } = newGame();
    expect(featureView(st, 'worlds')).toBe('open');
    expect(introFeature(st)).toBeNull();
    // Picked before the dumpster is even open: the fight starts at once.
    const padlocked = freshState(1, T0, true);
    expect(featureView(padlocked, 'worlds')).toBe('open');
    const picked = applyAction(padlocked, { type: 'travel', world: 1 }, rng, T0);
    expect(picked.state.stage.chosen).toBe(true);
    expect(picked.state.features.unlocked).not.toContain('roll');
    expect(run(picked.state, rng, 300).events.some((e) => e.type === 'waveStart')).toBe(true);
    // The tutorial over: Luck and the Codex appear without a walkthrough.
    const s = clone(st);
    s.lifetime.itemsEquipped = 1;
    s.features.unlocked.push('bag');
    s.features.seen.push('bag');
    s.dumpster.beginner = { state: 'done', uid: null };
    const r = applyAction(s, { type: 'featureSeen', feature: 'bag' }, new Rng(1), T0);
    expect(r.state.features.seen).toEqual(expect.arrayContaining(['luck', 'codex', 'worlds']));
    expect(featureView(r.state, 'luck')).toBe('open');
  });

  it('no fighting means no offline fight rewards, and a reload keeps him waiting', () => {
    const { st, rng } = newGame();
    expect(currentRate(st, T0)).toEqual({ bags: 0, coins: 0, xp: 0 });
    const loaded = deserialize(serialize(st))!;
    const booted = applyAction(loaded, { type: 'boot' }, rng, T0);
    expect(booted.state.battle.phase).toBe('idle');
    expect(booted.events.some((e) => e.type === 'stageStart')).toBe(false);
  });

  it('saves from before this are already fighting', () => {
    const old = clone(newGame().st) as unknown as { stage: Record<string, unknown> };
    delete old.stage.chosen;
    const loaded = deserialize(JSON.stringify(old))!;
    expect(loaded.stage.chosen).toBe(true);
  });
});
