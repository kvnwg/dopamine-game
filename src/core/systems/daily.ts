/**
 * Daily tasks: a few small goals each day (from balance.daily.tasks, the same day giving everyone the
 * same pick among the ones their game has opened), each paying gems, and a bonus chest for doing them
 * all. They change at local midnight. Progress comes from the core's own events (trackDaily, run after
 * every tick and action), so nothing else has to know about them.
 */
import { BAL, type DailyTaskDef } from '../../data';
import type { GameState } from '../state';
import { dayKey, keySeed } from '../time';
import type { CoreEvent } from '../types';
import { rarityAtLeast } from '../util';
import { hash32 } from './floors';
import { addLuckBoost } from './roller';

const D = () => BAL.daily;

/** Daily tasks are open once the tutorial is over and the first rebirth's world has fallen. */
export function dailyOpen(state: Pick<GameState, 'features'>): boolean {
  return state.features.unlocked.includes('daily');
}

export function dailyTask(id: string): DailyTaskDef | undefined {
  return D().tasks.find((t) => t.id === id);
}

/** The tasks a day gives this raccoon: `count` of the ones his game has opened, picked by the day. */
export function tasksFor(state: Pick<GameState, 'features' | 'stage' | 'dump'>, day: string): DailyTaskDef[] {
  const open = (t: DailyTaskDef) =>
    !t.needs || (t.needs === 'heist' ? state.features.unlocked.includes('heist') : state.dump.bestEver > 0 || state.features.unlocked.includes('endless'));
  const pool = D().tasks.filter(open);
  const seed = keySeed(day);
  const key = (t: DailyTaskDef) => hash32(seed, ...Array.from(t.id, (ch) => ch.charCodeAt(0)));
  const ranked = [...pool].sort((a, b) => key(a) - key(b) || a.id.localeCompare(b.id));
  return ranked.slice(0, D().count);
}

/** A new day: new tasks (and a closed chest). */
export function refreshDaily(d: GameState, now: number): boolean {
  if (!dailyOpen(d)) return false;
  const day = dayKey(now);
  if (d.daily.day === day) return false;
  d.daily.day = day;
  d.daily.tasks = tasksFor(d, day).map((t) => ({ id: t.id, progress: 0, claimed: false }));
  d.daily.chest = false;
  return true;
}

/** How much one event moves a task of this kind. */
function amount(event: DailyTaskDef['event'], e: CoreEvent): number {
  switch (event) {
    case 'roll':
      return e.type === 'roll' ? 1 : 0;
    case 'epicFind':
      return e.type === 'roll' && rarityAtLeast(e.item.rarity, 'epic') ? 1 : 0;
    case 'bossWin':
      return e.type === 'bossWin' ? 1 : 0;
    case 'kill':
      return e.type === 'kill' ? 1 : 0;
    case 'scrap':
      return e.type === 'scrap' ? 1 : e.type === 'scrapAll' ? e.count : 0;
    case 'equip':
      return e.type === 'equip' ? 1 : 0;
    case 'perfectDodge':
      return e.type === 'perfectDodge' ? 1 : 0;
    case 'floorClear':
      return e.type === 'floorClear' ? 1 : 0;
    case 'gateClear':
      return e.type === 'floorClear' && e.gate ? 1 : 0;
    case 'heistWin':
      return e.type === 'heistEnd' && e.won ? 1 : 0;
  }
}

/** Counts this step's events toward today's tasks. */
export function trackDaily(d: GameState, events: readonly CoreEvent[]): void {
  if (d.daily.tasks.length === 0 || events.length === 0) return;
  for (const task of d.daily.tasks) {
    const def = dailyTask(task.id);
    if (!def || task.progress >= def.target) continue;
    let n = 0;
    for (const e of events) n += amount(def.event, e);
    if (n > 0) task.progress = Math.min(def.target, task.progress + n);
  }
}

/** Claims a finished task's gems. */
export function claimDaily(d: GameState, id: string, ev: CoreEvent[]): boolean {
  const task = d.daily.tasks.find((t) => t.id === id);
  const def = dailyTask(id);
  if (!task || !def || task.claimed || task.progress < def.target) return false;
  task.claimed = true;
  d.currencies.gems += def.gems;
  ev.push({ type: 'dailyClaimed', id, gems: def.gems });
  return true;
}

/** The bonus chest, once every task of the day is claimed: gems and a Luck Potion. */
export function openDailyChest(d: GameState, now: number, ev: CoreEvent[]): boolean {
  if (d.daily.chest || d.daily.tasks.length === 0 || !d.daily.tasks.every((t) => t.claimed)) return false;
  d.daily.chest = true;
  const c = D().chest;
  d.currencies.gems += c.gems;
  if (c.potionSeconds > 0) addLuckBoost(d, now, c.potionSeconds, ev);
  ev.push({ type: 'dailyChest', gems: c.gems });
  return true;
}

/** Something to claim or open (for the button's badge). */
export function dailyNeedsYou(state: Pick<GameState, 'daily'>): boolean {
  const ts = state.daily.tasks;
  if (ts.some((t) => !t.claimed && t.progress >= (dailyTask(t.id)?.target ?? Infinity))) return true;
  return ts.length > 0 && ts.every((t) => t.claimed) && !state.daily.chest;
}
