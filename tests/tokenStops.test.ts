import { describe, expect, it } from 'vitest';
import { reelStops, tokenStops, type SpinTiming } from '../src/ui/reelTiming';

const spin = (mults: number[][]): SpinTiming => ({
  reels: mults.map((m, i) => ({ item: { rarity: i === 1 ? 'decent' : 'junk' }, mults: m })),
  spinSeconds: 2.6,
  baseSpinSeconds: 2.6,
  stepSeconds: 3.2,
});

describe('luck tokens land on every tab (tokenFx.ts times them from the spin start)', () => {
  it('lists each token when its reel shows it, with its place in the chain and the reel\'s luck so far', () => {
    const s = spin([[], [2, 3], []]);
    const stops = reelStops(s, 1);
    expect(tokenStops(s)).toEqual([
      { reel: 1, step: 0, at: stops[0].at, x: 2, total: 2 },
      { reel: 1, step: 1, at: stops[1].at, x: 3, total: 6 },
    ]);
  });

  it('puts tokens on different reels in the order they land', () => {
    const s = spin([[5], [10], [2, 2]]);
    const list = tokenStops(s);
    expect(list).toHaveLength(4);
    for (let k = 1; k < list.length; k++) expect(list[k].at).toBeGreaterThanOrEqual(list[k - 1].at);
    expect(list.filter((t) => t.reel === 2).map((t) => t.total)).toEqual([2, 4]);
  });

  it('has nothing for a spin without tokens', () => {
    expect(tokenStops(spin([[], []]))).toEqual([]);
  });
});
