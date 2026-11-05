import { describe, expect, it } from 'vitest';
import { applyAction, dailyNeedsYou, dailyTask, Rng, tasksFor, tick, trackDaily, type CoreEvent, type GameState } from '../src/core';
import { BAL, DATA } from '../src/data';
import { freshState, T0 } from './helpers';

const rng = () => new Rng(9);
const DAY = 86_400_000;

function open(): GameState {
  const st = freshState(1);
  st.dumpster.beginner = { state: 'done', uid: null };
  st.features.unlocked.push('daily');
  st.features.seen.push('daily');
  return st;
}

describe('daily tasks', () => {
  it('a day gives the same few tasks to everyone with the same game open, and only ones the game has opened', () => {
    const st = open();
    const a = tasksFor(st, '2026-11-05').map((t) => t.id);
    expect(a).toHaveLength(BAL.daily.count);
    expect(tasksFor(st, '2026-11-05').map((t) => t.id)).toEqual(a);
    const days = new Set(Array.from({ length: 14 }, (_, i) => tasksFor(st, `2026-11-${String(i + 1).padStart(2, '0')}`).map((t) => t.id).join()));
    expect(days.size).toBeGreaterThan(3);
    for (let i = 1; i <= 28; i++) {
      for (const t of tasksFor(st, `2026-11-${String(i).padStart(2, '0')}`)) expect(t.needs).toBeUndefined();
    }
  });

  it('they come with the day, count what happens, pay their gems when claimed, and the chest opens when all are done', () => {
    let st = tick(open(), { ticks: 1 }, rng(), T0).state;
    expect(st.daily.tasks).toHaveLength(BAL.daily.count);
    const s = structuredClone(st);
    const events: CoreEvent[] = [];
    for (const task of s.daily.tasks) {
      const def = dailyTask(task.id)!;
      task.progress = def.target - 1;
    }
    trackDaily(s, events);
    expect(dailyNeedsYou(s)).toBe(false);
    for (const task of s.daily.tasks) task.progress = dailyTask(task.id)!.target;
    expect(dailyNeedsYou(s)).toBe(true);
    st = s;
    const gems = st.currencies.gems;
    for (const task of st.daily.tasks) st = applyAction(st, { type: 'claimDaily', id: task.id }, rng(), T0).state;
    const paid = st.daily.tasks.reduce((a, t) => a + dailyTask(t.id)!.gems, 0);
    expect(st.currencies.gems).toBe(gems + paid);
    // Claiming twice pays once.
    expect(applyAction(st, { type: 'claimDaily', id: st.daily.tasks[0].id }, rng(), T0).state.currencies.gems).toBe(st.currencies.gems);
    const r = applyAction(st, { type: 'openDailyChest' }, rng(), T0);
    expect(r.state.currencies.gems).toBe(st.currencies.gems + BAL.daily.chest.gems);
    expect(r.state.luckBoostEndsAt).not.toBeNull();
    expect(dailyNeedsYou(r.state)).toBe(false);
    // The next day: new tasks, the chest closed again.
    const next = tick(r.state, { ticks: 1 }, rng(), T0 + DAY).state;
    expect(next.daily.day).not.toBe(r.state.daily.day);
    expect(next.daily.chest).toBe(false);
    expect(next.daily.tasks.every((t) => t.progress === 0 && !t.claimed)).toBe(true);
  });

  it('progress comes from the core\'s own events (rolls, rare finds, kills, scraps, dodges, floors, gates, heist wins)', () => {
    const st = open();
    st.daily.tasks = BAL.daily.tasks.map((t) => ({ id: t.id, progress: 0, claimed: false }));
    const item = { rarity: 'epic' } as never;
    trackDaily(st, [
      { type: 'roll', item } as unknown as CoreEvent,
      { type: 'kill', enemyUid: 1, enemyId: 'x', coins: 0, xp: 0, kind: 'regular' },
      { type: 'scrapAll', count: 7, xp: 0, coins: 0, size: null, usual: null },
      { type: 'perfectDodge', enemyUid: 1 },
      { type: 'floorClear', floor: 10, gate: true, firstTime: true, mode: 'endless' },
      { type: 'heistEnd', won: true, rewards: { bags: 0, coins: 0, gems: 0, potion: false, ring: null }, item: null },
    ]);
    const p = (id: string) => st.daily.tasks.find((t) => t.id === id)!.progress;
    expect(p('rolls')).toBe(1);
    expect(p('epics')).toBe(1);
    expect(p('kills')).toBe(1);
    expect(p('scraps')).toBe(7);
    expect(p('dodges')).toBe(1);
    expect(p('floors')).toBe(1);
    expect(p('gates')).toBe(1);
    expect(p('heist')).toBe(1);
    for (const t of BAL.daily.tasks) expect(DATA.strings[`daily.task.${t.id}`]).toBeTruthy();
  });
});
