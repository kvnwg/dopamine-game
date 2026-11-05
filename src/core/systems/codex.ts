/** Trash Codex: first find of each base item at each rarity. Every N entries grants a permanent bonus. */
import { BAL, type Mod } from '../../data';
import type { GameState } from '../state';
import type { CoreEvent, Item } from '../types';

export function codexKey(baseId: string, rarity: string): string {
  return `${baseId}:${rarity}`;
}

export function codexBonusMods(entryCount: number): Mod[] {
  const { entriesPerBonus, bonusCycle } = BAL.codex;
  const n = Math.floor(entryCount / entriesPerBonus);
  const out: Mod[] = [];
  for (let i = 0; i < n; i++) out.push(bonusCycle[i % bonusCycle.length]);
  return out;
}

/** Registers the item in the codex if new. Returns true if it was a new entry. */
export function registerCodex(d: GameState, item: Item, ev: CoreEvent[]): boolean {
  const key = codexKey(item.baseId, item.rarity);
  if (d.codex.entries.includes(key)) return false;
  d.codex.entries.push(key);
  const total = d.codex.entries.length;
  ev.push({ type: 'codexEntry', key, total });
  if (total % BAL.codex.entriesPerBonus === 0) {
    const gems = BAL.codex.gemsPerBonus;
    d.currencies.gems += gems;
    ev.push({ type: 'codexBonus', index: total / BAL.codex.entriesPerBonus - 1, gems });
  }
  return true;
}
