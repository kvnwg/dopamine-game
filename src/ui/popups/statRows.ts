import { STAT_IDS, type ModMode, type StatId } from '../../data';
import { itemMods, type GearScale, type Item } from '../../core';

export interface StatLine {
  key: string;
  stat: StatId;
  mode: ModMode;
  value: number;
  main: boolean;
}

/** Item modifiers merged by stat+mode, main stats first; with a gear scale, as worn by the raccoon. */
export function statLines(item: Item | null, scale?: GearScale): StatLine[] {
  if (!item) return [];
  const map = new Map<string, StatLine>();
  const mainKeys = new Set(item.main.map((m) => `${m.stat}:${m.mode}`));
  for (const m of itemMods(item, scale)) {
    const key = `${m.stat}:${m.mode}`;
    const cur = map.get(key);
    if (cur) cur.value += m.value;
    else map.set(key, { key, stat: m.stat, mode: m.mode, value: m.value, main: mainKeys.has(key) });
  }
  return [...map.values()].sort((a, b) => Number(b.main) - Number(a.main) || STAT_IDS.indexOf(a.stat) - STAT_IDS.indexOf(b.stat));
}
