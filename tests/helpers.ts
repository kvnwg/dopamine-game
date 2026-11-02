import { createInitialState, Rng, type GameState } from '../src/core';

export const T0 = new Date(2026, 0, 5, 12, 0, 0).getTime();

export function freshState(seed = 1, now = T0): GameState {
  return createInitialState(now, Rng.hashSeed(seed));
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
