import { describe, expect, it } from 'vitest';
import { addXp, totalXpForLevel, xpToNext, type CoreEvent, type GameState } from '../src/core';
import { freshState } from './helpers';
import { BAL } from '../src/data';

describe('XP and levels', () => {
  it('XP to next level = 60 x level^1.7, with the first levels front-loaded (xpCurve.early)', () => {
    const early = BAL.player.xpCurve.early;
    expect(xpToNext(1)).toBe(Math.round(60 * early[0]));
    expect(xpToNext(2)).toBe(Math.round(60 * 2 ** 1.7 * early[1]));
    // Past the early levels the plain curve takes over.
    expect(xpToNext(10)).toBe(Math.round(60 * 10 ** 1.7));
    // Each early level still costs more than the one before.
    for (let l = 1; l < early.length + 2; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
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
