import { current, isDraft } from 'immer';
import { RARITIES, type Rarity } from '../data';

/** Snapshot an immer draft (or pass a plain value through) so it is safe to keep outside `produce`. */
export function snap<T>(value: T): T {
  return isDraft(value) ? (current(value as never) as T) : value;
}

export function rarityIndex(r: Rarity): number {
  return RARITIES.indexOf(r);
}

export function rarityAtLeast(r: Rarity, min: Rarity): boolean {
  return rarityIndex(r) >= rarityIndex(min);
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
