import { createInitialState, Rng, type GameState } from '../src/core';
import { BAL } from '../src/data';

export const T0 = new Date(2026, 0, 5, 12, 0, 0).getTime();

/**
 * A new game, its dumpster already opened (the player's first tap; core/systems/features.ts), so the
 * reels roll on their own, and its first world (World 1) picked, so the raccoon fights. `locked` keeps
 * the padlock on and the raccoon waiting for his first world, as a brand-new game is.
 */
export function freshState(seed = 1, now = T0, locked = false): GameState {
  const st = createInitialState(now, Rng.hashSeed(seed));
  if (!locked) {
    st.features.unlocked.push('roll');
    st.features.seen.push('roll');
    st.battle.phase = 'walking';
    st.battle.phaseTime = BAL.combat.walkSeconds;
  }
  return st;
}

/** `st` past a new game's warm-up spins (BAL.tutorial.warmupRarities): its next spin is the tutorial's own find. */
export function pastWarmup(st: GameState): GameState {
  st.roll.count = Math.max(st.roll.count, BAL.tutorial.warmupRarities.length);
  return st;
}

/** Count occurrences of each value from `n` calls. */
export function histogram<T extends string | number | boolean>(n: number, f: () => T): Map<T, number> {
  const m = new Map<T, number>();
  for (let i = 0; i < n; i++) {
    const k = f();
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
