import { describe, expect, it } from 'vitest';
import {
  glitchText, itemFlavor, itemName, nextTier, rarityAtLeast, rarityChances, RARITY_ODDS, rollRarity, Rng, tierFloor, topRarity, type GameState,
} from '../src/core';
import { BAL, CLASSIC_TOP, DATA, RARITIES, type Rarity } from '../src/data';
import { freshState } from './helpers';

const PAST = RARITIES.slice(RARITIES.indexOf(CLASSIC_TOP as Rarity) + 1);

function deep(bestEver: number): GameState {
  const st = freshState(1);
  st.dump.bestEver = bestEver;
  return st;
}

describe('rarity tiers past Grail', () => {
  it('there are seven, each rarer than the last, each opened by a deeper floor of the Endless Dump', () => {
    expect(PAST).toEqual(['cosmic', 'glitched', 'fourthWall', 'devsOwn', 'patchNotes', 'sourceCode', 'concept']);
    let floor = 0;
    for (const r of PAST) {
      expect(RARITY_ODDS[r]).toBeGreaterThan(RARITY_ODDS.grail);
      expect(tierFloor(r)).toBeGreaterThan(floor);
      floor = tierFloor(r)!;
      expect(DATA.strings[`rarity.${r}`]).toBeTruthy();
      expect(DATA.assets.placeholders.rarities[r].color).toMatch(/^#/);
    }
    expect(Object.keys(BAL.endless.tierFloors).sort()).toEqual([...PAST].sort());
  });

  it('the dumpster never rolls past the rarest open tier (10,000 rolls at enormous luck), and opens the next as you go deeper', () => {
    expect(topRarity(deep(0))).toBe(CLASSIC_TOP);
    expect(nextTier(deep(0))).toEqual({ rarity: 'cosmic', floor: tierFloor('cosmic') });
    expect(topRarity(deep(tierFloor('glitched')!))).toBe('glitched');
    expect(nextTier(deep(1e6))).toBeNull();
    const rng = new Rng(3);
    for (let i = 0; i < 10_000; i++) expect(rarityAtLeast('grail', rollRarity(1e16, rng, 'junk', topRarity(deep(0))))).toBe(true);
    // Open, they roll at their odds.
    const c = rarityChances(1, 'junk', 'concept');
    expect(c.cosmic).toBeGreaterThan(0);
    expect(rarityChances(1, 'junk', 'grail').cosmic).toBe(0);
    let cosmic = 0;
    for (let i = 0; i < 10_000; i++) if (rollRarity(RARITY_ODDS.cosmic / 2, rng, 'junk', 'cosmic') === 'cosmic') cosmic++;
    expect(Math.abs(cosmic / 10_000 - 0.5)).toBeLessThan(0.02);
  });

  it('their items get more ridiculous and more meta: in space, glitched, self-aware, the developer\'s, patched, raw code, an idea', () => {
    const cone = { baseId: 'hat_traffic_cone' };
    const base = DATA.itemsById.get('hat_traffic_cone')!;
    expect(itemName({ ...cone, rarity: 'grail' })).toBe(base.legendaryName);
    expect(itemName({ ...cone, rarity: 'cosmic' })).toBe(`${base.legendaryName} (Now in Space)`);
    expect(itemName({ ...cone, rarity: 'glitched' })).toBe(glitchText(base.legendaryName));
    expect(glitchText('Traffic Cone of Destiny')).not.toBe('Traffic Cone of Destiny');
    expect(glitchText('Traffic Cone of Destiny')).toMatch(/^[A-Za-z0-9 ]+$/);
    expect(itemName({ ...cone, rarity: 'fourthWall' })).toContain("Knows It's in a Game");
    expect(itemName({ ...cone, rarity: 'devsOwn' })).toBe(`The Developer's Own ${base.name}`);
    expect(itemName({ ...cone, rarity: 'patchNotes' })).toContain('Patch 2.0');
    expect(itemName({ ...cone, rarity: 'sourceCode' })).toBe('hat_traffic_cone');
    expect(itemName({ ...cone, rarity: 'concept' })).toBe('The Concept of a Hat');
    for (const r of PAST) expect(itemFlavor({ ...cone, rarity: r })).toBe(DATA.strings[`tierFlavor.${r}`]);
    expect(itemFlavor({ ...cone, rarity: 'grail' })).toBe(base.flavor);
  });
});
