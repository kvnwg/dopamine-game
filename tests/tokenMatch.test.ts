import { describe, expect, it } from 'vitest';
import { applyAction, matchedSteps, performSpin, rarityAtLeast, Rng, SpinSchema, tokenMult, type CoreEvent, type GameState } from '../src/core';
import { luckRowsOf, luckSlot } from '../src/render/luckRows';
import { P } from '../src/render/pixel';
import { VIEW } from '../src/render/pixel/sceneryTypes';
import { multOf, reelStops, tokenStops, type SpinTiming } from '../src/ui/reelTiming';
import { freshState, T0 } from './helpers';

type SpinStart = Extract<CoreEvent, { type: 'spinStart' }>;
type Roll = Extract<CoreEvent, { type: 'roll' }>;

/** A spin with `reels` reels whose every reel is forced to land `mults` first (the dev cheat), and its events. */
function forcedSpin(mults: number[], reels: number, everyReel: boolean, seed = 7): { start: SpinStart; rolls: Roll[] } {
  const rng = new Rng(seed);
  let st: GameState = freshState(seed);
  st.dumpster.firstDiveDone = true;
  st.dumpster.beginner = { state: 'done', uid: null };
  st.currencies.bags = 0;
  st.upgrades.extraReel = reels - 1;
  st = structuredClone(applyAction(st, { type: 'cheat', cheat: { kind: 'forceTokens', mults, everyReel } }, rng, T0).state);
  const events: CoreEvent[] = [];
  // The whole spin at once: it starts and every reel lands.
  performSpin(st, rng, T0, events);
  return { start: events.find((e): e is SpinStart => e.type === 'spinStart')!, rolls: events.filter((e): e is Roll => e.type === 'roll') };
}

describe('every reel landing the same luck token squares it', () => {
  it('finds the token steps every reel matched (two reels or more, while all of them are landing tokens)', () => {
    expect(matchedSteps([[5], [5], [5]])).toEqual([0]);
    expect(matchedSteps([[5, 2], [5, 3]])).toEqual([0]);
    expect(matchedSteps([[2, 5], [3, 5]])).toEqual([1]);
    expect(matchedSteps([[2, 2], [2, 2]])).toEqual([0, 1]);
    expect(matchedSteps([[5], []])).toEqual([]);
    expect(matchedSteps([[5], [5], []])).toEqual([]);
    expect(matchedSteps([[5, 5], [5]])).toEqual([0]);
    // One reel matches nothing.
    expect(matchedSteps([[10]])).toEqual([]);
  });

  it('counts a matched token squared in the reel\'s luck', () => {
    expect(tokenMult([5])).toBe(5);
    expect(tokenMult([5], [0])).toBe(25);
    expect(tokenMult([2, 5], [1])).toBe(50);
    expect(tokenMult([2, 2], [0, 1])).toBe(16);
    expect(multOf([3, 10], [0])).toBe(90);
  });

  it('a spin whose three reels all land x5 gives each reel x25 luck (and x25 guarantees an Epic)', () => {
    const { start, rolls } = forcedSpin([5], 3, true);
    expect(start.reels).toHaveLength(3);
    expect(start.reels.every((r) => r.mults.join() === '5')).toBe(true);
    expect(start.matched).toEqual([0]);
    expect(rolls).toHaveLength(3);
    for (const r of rolls) {
      expect(r.mult).toBe(25);
      expect(r.luck).toBeCloseTo(start.luck * 25);
      expect(rarityAtLeast(r.item.rarity, 'epic')).toBe(true);
    }
  });

  it('a token on only some of the reels stays as it is', () => {
    let checked = 0;
    for (let seed = 1; seed < 40 && checked < 5; seed++) {
      const { start, rolls } = forcedSpin([5], 2, false, seed);
      // (The second reel rolls its own tokens: skip the rare spin where it also lands x5 first.)
      if (start.reels[1].mults[0] === 5) continue;
      checked++;
      expect(start.matched).toEqual([]);
      expect(rolls.find((r) => r.reel === 0)!.mult).toBe(5);
    }
    expect(checked).toBe(5);
  });

  it('a spin saved before the rule loads with no matched steps', () => {
    const { start } = forcedSpin([2], 2, true);
    const saved = { ...start, landed: false, scripted: null, reels: start.reels.map((r) => ({ ...r, landed: false })) } as Record<string, unknown>;
    delete saved.matched;
    delete saved.type;
    expect(SpinSchema.parse(saved).matched).toEqual([]);
  });
});

describe('the reels and the battle show a match', () => {
  const timing = (mults: number[][], matched: number[]): SpinTiming => ({
    reels: mults.map((m) => ({ item: { rarity: 'junk' as const }, mults: m })),
    spinSeconds: 2.6,
    baseSpinSeconds: 2.6,
    stepSeconds: 3.2,
    matched,
  });

  it('the last reel to land the matched token squares it: earlier ones show it plain until then', () => {
    const s = timing([[5], [5], [5]], [0]);
    const list = tokenStops(s);
    expect(list.map((tk) => tk.total)).toEqual([5, 5, 25]);
    expect(list.map((tk) => !!tk.match)).toEqual([false, false, true]);
    // The one that completes the match is the last of them to land.
    expect(list[2].at).toBe(Math.max(...[0, 1, 2].map((i) => reelStops(s, i)[0].at)));
  });

  it('a later matched step squares on top of earlier plain tokens', () => {
    const list = tokenStops(timing([[2, 5], [3, 5]], [1]));
    const last = list.filter((tk) => tk.step === 1);
    expect(last.map((tk) => tk.total)).toEqual([2 * 5, 3 * 25]);
    expect(last[1].match).toBe(true);
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
