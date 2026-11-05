/**
 * Item unlocks: the dumpster starts with a small pool of junk and every rebirth adds more
 * (items.json `unlock`: the rebirths an item needs). Codex entries and owned items are never taken away.
 */
import { DATA, type BaseItem } from '../../data';

/** Whether the dumpster can roll this base item after `rebirths` rebirths. */
export function isItemUnlocked(base: Pick<BaseItem, 'unlock'>, rebirths: number): boolean {
  return (base.unlock ?? 0) <= rebirths;
}

/** Base items that unlock exactly at this rebirth count (the batch a rebirth adds). */
export function unlocksAt(rebirths: number): BaseItem[] {
  return DATA.items.filter((i) => (i.unlock ?? 0) === rebirths);
}

/** How many base items the dumpster can roll after `rebirths` rebirths. */
export function unlockedCount(rebirths: number): number {
  return DATA.items.filter((i) => isItemUnlocked(i, rebirths)).length;
}

/** The rebirth count that unlocks the last items. */
export function finalUnlock(): number {
  return Math.max(0, ...DATA.items.map((i) => i.unlock ?? 0));
}
