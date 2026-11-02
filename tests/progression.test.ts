import { describe, expect, it } from 'vitest';
import { addXp, totalXpForLevel, xpToNext, type CoreEvent, type GameState } from '../src/core';
import { freshState } from './helpers';

describe('XP and levels', () => {
  it('XP to next level = 60 x level^1.7', () => {
    expect(xpToNext(1)).toBe(60);
    expect(xpToNext(10)).toBe(Math.round(60 * 10 ** 1.7));
    expect(totalXpForLevel(3)).toBe(xpToNext(1) + xpToNext(2));
  });

  it('applies multiple level-ups and carries leftover XP', () => {
    const st = structuredClone(freshState()) as GameState;
    const ev: CoreEvent[] = [];
    addXp(st, xpToNext(1) + xpToNext(2) + 5, ev);
    expect(st.player.level).toBe(3);
    expect(st.player.xp).toBe(5);
    expect(ev.filter((e) => e.type === 'levelUp')).toHaveLength(2);
  });
});
