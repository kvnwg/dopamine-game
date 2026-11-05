import { describe, expect, it } from 'vitest';
import { applyAction, chainFloor, rarityAtLeast, Rng, tick, type GameState } from '../src/core';
import { BAL } from '../src/data';
import { freshState, T0 } from './helpers';

describe('a big luck token chain guarantees a rarity', () => {
  it('x25 an Epic, x50 a Legendary, x250 a Mythic (the item still rolls at the multiplied luck)', () => {
    expect(chainFloor(1)).toBeNull();
    expect(chainFloor(24)).toBeNull();
    expect(chainFloor(25)).toBe('epic');
    expect(chainFloor(60)).toBe('legendary');
    expect(chainFloor(249)).toBe('legendary');
    expect(chainFloor(250)).toBe('mythic');
    expect(chainFloor(5000)).toBe('mythic');
    expect(BAL.roll.multiplier.floors.length).toBe(3);
  });

  it('a forced x60 chain (x5, x3, x2, x2) lands a Legendary or better, every time', () => {
    const rng = new Rng(21);
    for (let k = 0; k < 40; k++) {
      let st: GameState = freshState(100 + k);
      st.dumpster.firstDiveDone = true;
      st.dumpster.beginner = { state: 'done', uid: null };
      st = applyAction(st, { type: 'cheat', cheat: { kind: 'forceTokens', mults: [5, 3, 2, 2] } }, rng, T0).state;
      const r = tick(st, { ticks: 1 }, rng, T0);
      const start = r.events.find((e) => e.type === 'spinStart');
      expect(start?.type).toBe('spinStart');
      if (start?.type !== 'spinStart') continue;
      const reel = start.reels.find((x) => x.mults.length === 4)!;
      expect(reel.mults.reduce((a, b) => a * b, 1)).toBe(60);
      expect(rarityAtLeast(reel.item.rarity, 'legendary')).toBe(true);
    }
  });
});
