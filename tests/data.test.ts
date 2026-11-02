import { describe, expect, it } from 'vitest';
import { buildGameData, DATA, SLOTS } from '../src/data';
import balance from '../src/data/balance.json';
import items from '../src/data/items.json';
import affixes from '../src/data/affixes.json';
import themes from '../src/data/themes.json';
import enemies from '../src/data/enemies.json';
import neighborhoods from '../src/data/neighborhoods.json';
import strings from '../src/data/strings.en.json';
import assets from '../src/data/assets.json';
import enchants from '../src/data/enchants.json';

const raw = { balance, items, affixes, themes, enemies, neighborhoods, strings, assets, enchants };

describe('game data', () => {
  it('validates at boot', () => {
    expect(DATA.items.length).toBeGreaterThan(0);
    expect(DATA.affixes).toHaveLength(12);
  });

  it('has 6 base items per slot plus 3 unique Legendaries for the curbside theme', () => {
    for (const slot of SLOTS) {
      expect(DATA.items.filter((i) => i.theme === 'curbside' && i.slot === slot && !i.unique)).toHaveLength(6);
    }
    expect(DATA.items.filter((i) => i.unique)).toHaveLength(3);
  });

  it('rejects malformed data with a readable error', () => {
    const bad = { ...raw, balance: { ...balance, tickRate: -1 } };
    expect(() => buildGameData(bad)).toThrow(/balance.json/);
  });

  it('rejects broken cross-references', () => {
    const badHood = [{ ...neighborhoods[0], boss: 'nobody' }];
    expect(() => buildGameData({ ...raw, neighborhoods: badHood })).toThrow(/unknown enemy nobody/);
  });

  it('every string value is non-empty', () => {
    for (const [k, v] of Object.entries(DATA.strings)) expect(v, k).not.toBe('');
  });
});
