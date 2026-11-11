import { describe, expect, it } from 'vitest';
import { buildGameData, DATA, HEX_STEPS, SLOTS } from '../src/data';
import balance from '../src/data/balance.json';
import items from '../src/data/items.json';
import affixes from '../src/data/affixes.json';
import themes from '../src/data/themes.json';
import enemies from '../src/data/enemies.json';
import worlds from '../src/data/worlds.json';
import strings from '../src/data/strings.en.json';
import assets from '../src/data/assets.json';
import enchants from '../src/data/enchants.json';
import itemsHeadgear from '../src/data/itemsHeadgear.json';
import itemsClothes from '../src/data/itemsClothes.json';
import itemsArms from '../src/data/itemsArms.json';
import itemsCarry from '../src/data/itemsCarry.json';
import heist from '../src/data/heist.json';
import heistEvents from '../src/data/heistEvents.json';
import * as S from '../src/data/schemas';
import type { z } from 'zod';

const raw = { balance, items, affixes, themes, enemies, worlds, strings, assets, enchants };

describe('game data', () => {
  it('validates at boot', () => {
    expect(DATA.items.length).toBeGreaterThan(0);
    expect(DATA.affixes).toHaveLength(12);
  });

  it('has at least 6 base items per slot plus 7 unique Legendaries for the curbside theme, among the last unlocks', () => {
    for (const slot of SLOTS) {
      const n = DATA.items.filter((i) => i.theme === 'curbside' && i.slot === slot && !i.unique).length;
      expect(n, slot).toBeGreaterThanOrEqual(6);
    }
    // The first three, then one for each group of the item expansion (headgear, clothes, arms, carry).
    const uniques = DATA.items.filter((i) => i.unique);
    expect(uniques).toHaveLength(7);
    for (const u of uniques) expect(u.unlock, u.id).toBeGreaterThanOrEqual(4);
  });

  it('every bundled file comes out of its schema unchanged, so a production build can skip the check (data/index.ts)', () => {
    const files: Array<[string, z.ZodTypeAny, unknown]> = [
      ['balance', S.BalanceSchema, balance],
      ['items', S.ItemsSchema, [...items, ...itemsHeadgear, ...itemsClothes, ...itemsArms, ...itemsCarry]],
      ['affixes', S.AffixesFileSchema, affixes],
      ['themes', S.ThemesSchema, themes],
      ['enemies', S.EnemiesSchema, enemies],
      ['worlds', S.WorldsSchema, worlds],
      ['strings', S.StringsSchema, strings],
      ['assets', S.AssetsSchema, assets],
      ['enchants', S.EnchantsSchema, enchants],
      ['heist', S.HeistFileSchema, heist],
      ['heistEvents', S.HeistEventsSchema, heistEvents],
    ];
    // (Key order aside: a default filled in or a field dropped would show here.)
    const norm = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(norm)
        : v && typeof v === 'object'
          ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm((v as Record<string, unknown>)[k])]))
          : v;
    for (const [name, schema, raw] of files) expect(norm(schema.parse(raw)), name).toEqual(norm(raw));
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

  it('lays the upgrade map out as a honeycomb: every tier on its own hex, next to the hex it hangs off', () => {
    const tiers = DATA.balance.upgrades.reduce((n, u) => n + u.max, 0);
    expect(DATA.upgradeMap).toHaveLength(tiers);
    const cells = new Set(DATA.upgradeMap.map((n) => `${n.col},${n.row}`));
    expect(cells.size).toBe(tiers);
    const root = DATA.upgradeMap.filter((n) => n.prev === null);
    expect(root.map((n) => n.key)).toEqual(['luck:1']);
    expect([root[0].col, root[0].row]).toEqual([0, 0]);
    const byKey = new Map(DATA.upgradeMap.map((n) => [n.key, n]));
    const steps = Object.values(HEX_STEPS).map(([c, r]) => `${c},${r}`);
    for (const n of DATA.upgradeMap) {
      if (!n.prev) continue;
      const p = byKey.get(n.prev)!;
      expect(steps, `${n.key} must touch ${n.prev}`).toContain(`${n.col - p.col},${n.row - p.row}`);
    }
    for (const u of DATA.balance.upgrades) {
      expect(DATA.strings[`upgrade.${u.id}`], u.id).toBeTruthy();
      expect(DATA.strings[`upgradeDesc.${u.id}`], u.id).toBeTruthy();
    }
  });

  it('rejects an upgrade map where two tiers land on the same hex', () => {
    const ups = balance.upgrades.map((u) => (u.id === 'bagSpace' ? { ...u, path: 'n*8' } : u));
    expect(() => buildGameData({ ...raw, balance: { ...balance, upgrades: ups } })).toThrow(/overlaps/);
    const short = balance.upgrades.map((u) => (u.id === 'gold' ? { ...u, path: 'se*3' } : u));
    expect(() => buildGameData({ ...raw, balance: { ...balance, upgrades: short } })).toThrow(/path has 3 steps/);
  });

  it('every string value is non-empty', () => {
    for (const [k, v] of Object.entries(DATA.strings)) expect(v, k).not.toBe('');
  });
});
