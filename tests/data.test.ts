import { describe, expect, it } from 'vitest';
import { buildGameData, DATA, SLOTS } from '../src/data';
import balance from '../src/data/balance.json';
import items from '../src/data/items.json';
import affixes from '../src/data/affixes.json';
import themes from '../src/data/themes.json';
import enemies from '../src/data/enemies.json';
import worlds from '../src/data/worlds.json';
import strings from '../src/data/strings.en.json';
import assets from '../src/data/assets.json';
import enchants from '../src/data/enchants.json';

const raw = { balance, items, affixes, themes, enemies, worlds, strings, assets, enchants };

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
    const badWorld = [{ ...worlds[0], boss: { ...worlds[0].boss, id: 'nobody' } }];
    expect(() => buildGameData({ ...raw, worlds: badWorld })).toThrow(/unknown enemy nobody/);
    const bossAsRegular = [{ ...worlds[0], enemies: [{ ...worlds[0].enemies[0], id: 'officer_dale' }] }];
    expect(() => buildGameData({ ...raw, worlds: bossAsRegular })).toThrow(/not a regular enemy/);
  });

  it('has 20 worlds with unique ids, each with a roster and a boss', () => {
    expect(DATA.worlds).toHaveLength(20);
    expect(new Set(DATA.worlds.map((w) => w.id)).size).toBe(20);
    for (const w of DATA.worlds) {
      expect(w.enemies.length).toBeGreaterThan(0);
      expect(DATA.enemiesById.get(w.boss.id)?.kind).toBe('boss');
    }
  });

  it('every string value is non-empty', () => {
    for (const [k, v] of Object.entries(DATA.strings)) expect(v, k).not.toBe('');
  });
});
