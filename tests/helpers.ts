import { createInitialState, Rng, type GameState } from '../src/core';

export const T0 = new Date(2026, 0, 5, 12, 0, 0).getTime();

/**
 * A new game, its dumpster already opened (the player's first tap; core/systems/features.ts), so the
 * reels roll on their own. `locked` keeps the padlock on.
 */
export function freshState(seed = 1, now = T0, locked = false): GameState {
  const st = createInitialState(now, Rng.hashSeed(seed));
  if (!locked) {
    st.features.unlocked.push('roll');
    st.features.seen.push('roll');
  }
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
