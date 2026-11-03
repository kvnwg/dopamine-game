/**
 * Gold and XP on their way to the HUD. Core credits a kill's gold and XP at once, but the battle first
 * flies its coins and XP sparks up to the counters (BattleScene): until they land, a counter holds that
 * much back, and each arrival lets its share in, so the number ticks up as they land and the counter
 * hops. Whatever is still held after a few seconds is let in anyway, so a counter can never stay behind.
 */
import { create } from 'zustand';

export type Counter = 'gold' | 'xp';

interface FlightState {
  /** How much each counter holds back. */
  held: Record<Counter, number>;
  /** Bumped every time something lands on a counter (it hops and flashes). */
  hits: Record<Counter, number>;
}

export const useHudFlight = create<FlightState>(() => ({ held: { gold: 0, xp: 0 }, hits: { gold: 0, xp: 0 } }));

/** A sum held back from a counter until it lands. */
export interface Held {
  readonly counter: Counter;
  left: number;
}

const live = new Set<Held>();

/** Exactly what the live holds add up to (0 when there are none, never a rounding crumb). */
function sync(counter: Counter, hit: boolean): void {
  let sum = 0;
  for (const h of live) if (h.counter === counter) sum += h.left;
  useHudFlight.setState((s) => ({
    held: { ...s.held, [counter]: sum },
    hits: hit ? { ...s.hits, [counter]: s.hits[counter] + 1 } : s.hits,
  }));
}

/** Holds `amount` back from `counter` until `land` lets it in (all of it after `ms` at the latest). */
export function hold(counter: Counter, amount: number, ms = 4000): Held {
  const h: Held = { counter, left: amount > 0 && Number.isFinite(amount) ? amount : 0 };
  if (h.left <= 0) return h;
  live.add(h);
  sync(counter, false);
  setTimeout(() => release(h), ms);
  return h;
}

/** Part of a held sum lands (Infinity: all that is left). The counter hops even when nothing was held. */
export function land(h: Held, amount: number): void {
  h.left = amount >= h.left ? 0 : h.left - Math.max(0, amount);
  if (h.left <= 0) live.delete(h);
  sync(h.counter, true);
}

/** Lets the rest of a held sum in at once, quietly (no hop). */
export function release(h: Held): void {
  if (!live.delete(h)) return;
  h.left = 0;
  sync(h.counter, false);
}

/** Lets everything `counter` holds back in at once. */
export function releaseAll(counter: Counter): void {
  let any = false;
  for (const h of live) {
    if (h.counter !== counter) continue;
    live.delete(h);
    h.left = 0;
    any = true;
  }
  if (any) sync(counter, false);
}
