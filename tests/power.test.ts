import { describe, expect, it } from 'vitest';
import { applyAction, performSpin, playerPower, Rng, wornPower, type CoreEvent, type GameState } from '../src/core';
import { freshState, T0 } from './helpers';

/**
 * The equip power count (src/ui/components/EquipFlight.tsx) adds up each equip's worn power less what
 * it replaced. That must be exactly how much the raccoon's power changed: never a count for nothing.
 */
describe('power change on equip', () => {
  it('the sum of each equip event (item less what it replaced) is exactly the change in power', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const rng = new Rng(seed);
      let st = structuredClone(freshState(seed)) as GameState;
      st.dumpster.beginner = { state: 'done', uid: null };
      for (let round = 0; round < 6; round++) {
        for (let i = 0; i < 12; i++) {
          const ev: CoreEvent[] = [];
          performSpin(st, rng, T0, ev);
        }
        for (const action of [{ type: 'equipBest' as const }, ...st.inventory.slice(0, 2).map((it) => ({ type: 'equipItem' as const, uid: it.uid }))]) {
          const before = playerPower(st);
          const r = applyAction(st, action, rng, T0);
          const equips = r.events.filter((e): e is Extract<CoreEvent, { type: 'equip' }> => e.type === 'equip');
          const delta = equips.reduce((n, e) => n + wornPower(r.state, e.item) - (e.replaced ? wornPower(r.state, e.replaced) : 0), 0);
          expect(playerPower(r.state) - before).toBe(delta);
          st = structuredClone(r.state) as GameState;
        }
      }
    }
  });
});
