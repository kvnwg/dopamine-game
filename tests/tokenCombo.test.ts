import { describe, expect, it } from 'vitest';
import { applyAction, comboSteps, comboValue, performSpin, rarityAtLeast, Rng, SpinSchema, tokenMult, type CoreEvent, type GameState } from '../src/core';
import { luckRowsOf, luckSlot } from '../src/render/luckRows';
import { P } from '../src/render/pixel';
import { VIEW } from '../src/render/pixel/sceneryTypes';
import { chainMult, comboOf, reelStops, tokenStops, type SpinTiming } from '../src/ui/reelTiming';
import { freshState, T0 } from './helpers';

type SpinStart = Extract<CoreEvent, { type: 'spinStart' }>;
type Roll = Extract<CoreEvent, { type: 'roll' }>;

/** A spin with `reels` reels whose tokens are forced by the dev cheat, and its events. */
function forcedSpin(cheat: { mults?: number[]; everyReel?: boolean; perReel?: number[][] }, reels: number, seed = 7): { start: SpinStart; rolls: Roll[] } {
  const rng = new Rng(seed);
  let st: GameState = freshState(seed);
  st.dumpster.firstDiveDone = true;
  st.dumpster.beginner = { state: 'done', uid: null };
  st.currencies.bags = 0;
  st.upgrades.extraReel = reels - 1;
  const action = { type: 'cheat' as const, cheat: { kind: 'forceTokens' as const, mults: cheat.mults ?? null, everyReel: cheat.everyReel, perReel: cheat.perReel } };
  st = structuredClone(applyAction(st, action, rng, T0).state);
  const events: CoreEvent[] = [];
  // The whole spin at once: it starts and every reel lands.
  performSpin(st, rng, T0, events);
  return { start: events.find((e): e is SpinStart => e.type === 'spinStart')!, rolls: events.filter((e): e is Roll => e.type === 'roll') };
}

describe('luck tokens landing together on two or more reels multiply (a combo)', () => {
  it('finds the rounds two or more reels land a token in, whatever the tokens are', () => {
    expect(comboSteps([[5], [5], [5]])).toEqual([0]);
    expect(comboSteps([[2], [5]])).toEqual([0]);
    expect(comboSteps([[5, 2], [5]])).toEqual([0]);
    expect(comboSteps([[2, 5], [3, 5]])).toEqual([0, 1]);
    expect(comboSteps([[], [2, 3], [5]])).toEqual([0]);
    expect(comboSteps([[2, 2, 2], [3], [4, 4]])).toEqual([0, 1]);
    expect(comboSteps([[5], []])).toEqual([]);
    // One reel makes no combo.
    expect(comboSteps([[10]])).toEqual([]);
    expect(comboSteps([])).toEqual([]);
  });

  it("each reel in a combo counts the product of the round's tokens (Kevin: x2 and x2 make x4, x2 and x5 make x10)", () => {
    expect(comboValue([[2], [5]], 0)).toBe(10);
    expect(comboValue([[2], [3], [5]], 0)).toBe(30);
    expect(tokenMult([[2], [2]], 0, [0])).toBe(4);
    expect(tokenMult([[2], [2]], 1, [0])).toBe(4);
    expect(tokenMult([[2], [5]], 0, [0])).toBe(10);
    expect(tokenMult([[2], [5]], 1, [0])).toBe(10);
    // Three at once: the same, all three multiplied.
    for (const i of [0, 1, 2]) expect(tokenMult([[2], [3], [5]], i, [0])).toBe(30);
    // A reel's own chain keeps multiplying on top: x3 then x2 on the first reel, x5 with it in the first round.
    expect(tokenMult([[3, 2], [5]], 0, [0])).toBe(30);
    expect(tokenMult([[3, 2], [5]], 1, [0])).toBe(15);
    expect(tokenMult([[3, 2], [5]], 0, [0], 1)).toBe(15);
    // A reel with no tokens isn't in it.
    expect(tokenMult([[2], [], [5]], 1, [0])).toBe(1);
    // Without the combo, the plain product.
    expect(tokenMult([[2], [5]], 0)).toBe(2);
    expect(tokenMult([[5]], 0)).toBe(5);
  });

  it('a spin landing x2 and x5 together gives both reels x10 luck', () => {
    const { start, rolls } = forcedSpin({ perReel: [[2], [5]] }, 2);
    expect(start.reels.map((r) => r.mults)).toEqual([[2], [5]]);
    expect(start.matched).toEqual([0]);
    expect(rolls).toHaveLength(2);
    for (const r of rolls) {
      expect(r.mult).toBe(10);
      expect(r.luck).toBeCloseTo(start.luck * 10);
    }
  });

  it('three reels landing x2, x3 and x5 together give each x30 luck (x25 and up guarantees an Epic)', () => {
    const { start, rolls } = forcedSpin({ perReel: [[2], [3], [5]] }, 3);
    expect(start.matched).toEqual([0]);
    expect(rolls).toHaveLength(3);
    for (const r of rolls) {
      expect(r.mult).toBe(30);
      expect(rarityAtLeast(r.item.rarity, 'epic')).toBe(true);
    }
  });

  it('every reel landing x5 multiplies it by itself as many times (x125 on three reels)', () => {
    const { start, rolls } = forcedSpin({ mults: [5], everyReel: true }, 3);
    expect(start.matched).toEqual([0]);
    for (const r of rolls) {
      expect(r.mult).toBe(125);
      expect(rarityAtLeast(r.item.rarity, 'legendary')).toBe(true);
    }
  });

  it('a combo in one round, then a reel chaining on alone', () => {
    const { start, rolls } = forcedSpin({ perReel: [[3, 2], [5], []] }, 3);
    expect(start.matched).toEqual([0]);
    expect(rolls.find((r) => r.reel === 0)!.mult).toBe(30);
    expect(rolls.find((r) => r.reel === 1)!.mult).toBe(15);
    expect(rolls.find((r) => r.reel === 2)!.mult).toBe(1);
  });

  it('a token on only one reel stays as it is', () => {
    const { start, rolls } = forcedSpin({ perReel: [[5], []] }, 2);
    expect(start.matched).toEqual([]);
    expect(rolls.find((r) => r.reel === 0)!.mult).toBe(5);
    expect(rolls.find((r) => r.reel === 1)!.mult).toBe(1);
  });

  it('the per-reel cheat is used once', () => {
    const rng = new Rng(3);
    let st: GameState = freshState(3);
    st.dumpster.firstDiveDone = true;
    st = structuredClone(applyAction(st, { type: 'cheat', cheat: { kind: 'forceTokens', mults: null, perReel: [[2], [5]] } }, rng, T0).state);
    expect(st.dumpster.forcedReelTokens).toEqual([[2], [5]]);
    performSpin(st, rng, T0, []);
    expect(st.dumpster.forcedReelTokens).toBeNull();
  });

  it('a spin saved before combos loads with none', () => {
    const { start } = forcedSpin({ perReel: [[2], [2]] }, 2);
    const saved = { ...start, landed: false, scripted: null, reels: start.reels.map((r) => ({ ...r, landed: false })) } as Record<string, unknown>;
    delete saved.matched;
    delete saved.type;
    expect(SpinSchema.parse(saved).matched).toEqual([]);
  });
});

describe('the reels and the battle show a combo', () => {
  const timing = (mults: number[][]): SpinTiming => ({
    reels: mults.map((m) => ({ item: { rarity: 'junk' as const }, mults: m })),
    spinSeconds: 2.6,
    baseSpinSeconds: 2.6,
    stepSeconds: 3.2,
    matched: comboSteps(mults),
  });

  it("the last of a combo's tokens to land completes it: earlier ones show their own token until then", () => {
    const s = timing([[2], [5]]);
    const list = tokenStops(s);
    expect(list.map((tk) => tk.total)).toEqual([2, 10]);
    expect(list.map((tk) => !!tk.match)).toEqual([false, true]);
    expect(list[1].at).toBe(Math.max(reelStops(s, 0)[0].at, reelStops(s, 1)[0].at));
  });

  it('three reels: the third token lands the product of all three', () => {
    const list = tokenStops(timing([[2], [3], [5]]));
    expect(list.map((tk) => tk.total)).toEqual([2, 3, 30]);
    expect(list.map((tk) => !!tk.match)).toEqual([false, false, true]);
  });

  it('a later combo multiplies on top of an earlier one', () => {
    const list = tokenStops(timing([[2, 5], [3, 5]]));
    expect(list.map((tk) => `${tk.reel}:${tk.step}`)).toEqual(['0:0', '1:0', '0:1', '1:1']);
    expect(list.map((tk) => tk.total)).toEqual([2, 6, 6 * 5, 6 * 25]);
    expect(list.map((tk) => !!tk.match)).toEqual([false, true, false, true]);
  });

  it("a reel chaining on alone after a combo keeps the combo's product", () => {
    const s = timing([[3, 2], [5]]);
    expect(tokenStops(s).map((tk) => tk.total)).toEqual([3, 15, 30]);
    expect(chainMult(s, 0, s.matched)).toBe(30);
    expect(chainMult(s, 1, s.matched)).toBe(15);
    expect(chainMult(s, 0)).toBe(6);
  });

  it("names the combo's reels, their tokens and the product (a reel without one isn't in it)", () => {
    expect(comboOf(timing([[2], [3], [5]]), 0)).toEqual({ reels: [0, 1, 2], values: [2, 3, 5], product: 30 });
    expect(comboOf(timing([[2], [], [5]]), 0)).toEqual({ reels: [0, 2], values: [2, 5], product: 10 });
  });

  it('the luck rows: one per reel with tokens, centered like the battle draws them', () => {
    expect(luckRowsOf([{ mults: [] }, { mults: [2] }, { mults: [5, 2] }])).toEqual([-1, 0, 1]);
    // A single token sits left of the middle (its total takes the room on the right); a row's tokens are 18 art px apart.
    const one = luckSlot(0, 0, 1);
    expect(one.x).toBe(Math.round(((VIEW.w * P) / 2 - 12 * P) / P) * P);
    expect(luckSlot(1, 1, 2).x - luckSlot(1, 0, 2).x).toBe(18 * P);
    expect(luckSlot(1, 0, 2).y - one.y).toBe(19 * P);
  });
});
