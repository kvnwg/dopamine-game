import { describe, expect, it } from 'vitest';
import {
  applyAction, createItem, gemSpeedupCost, itemMods, mainStatValue, recycleRewards, rollItemLevel, rollSlot, Rng, upgradeCost,
  upgradeSeconds, codexBonusMods, itemName, tick, type GameState,
} from '../src/core';
import { BAL, DATA, RARITIES, SLOTS } from '../src/data';
import { freshState, histogram, T0 } from './helpers';

const N = 10_000;

/** Applies an action and returns a mutable copy (immer freezes results) so tests can poke at state. */
function act(st: GameState, a: Parameters<typeof applyAction>[1], rng: Rng, now = T0) {
  const r = applyAction(st, a, rng, now);
  return { ...r, state: structuredClone(r.state) as GameState };
}

describe('item rolls', () => {
  it('slots are uniform over 10,000 rolls', () => {
    const rng = new Rng(8);
    const h = histogram(N, () => rollSlot(rng));
    expect(h.size).toBe(10);
    for (const s of SLOTS) expect(Math.abs((h.get(s) ?? 0) / N - 0.1)).toBeLessThan(0.01);
  });

  it('item level is playerLevel + randInt(-2, +1), clamped to 1 (10,000 rolls)', () => {
    const rng = new Rng(9);
    const h = histogram(N, () => rollItemLevel(10, rng));
    expect([...h.keys()].sort((a, b) => a - b)).toEqual([8, 9, 10, 11]);
    for (const v of h.values()) expect(Math.abs(v / N - 0.25)).toBeLessThan(0.015);
    const low = histogram(1000, () => rollItemLevel(1, rng));
    expect(Math.min(...low.keys())).toBe(1);
  });

  it('main stat = slotBase x (1 + levelScale x (level - 1)) x rarity multiplier', () => {
    expect(mainStatValue(30, 1, 'junk')).toBeCloseTo(30);
    expect(mainStatValue(30, 11, 'legendary')).toBeCloseTo(30 * (1 + BAL.items.levelScalePerLevel * 10) * BAL.rarities.legendary.mult);
  });

  it('an item\'s flat HP/ATK/DEF grow with the world it was rolled in; percent stats do not', () => {
    const rng = new Rng(12);
    const mask = DATA.items.find((i) => i.slot === 'mask' && !i.unique)!;
    const t1 = createItem(mask, 'shiny', 5, 'curbside', new Rng(12), 1, [], 1);
    const t4 = createItem(mask, 'shiny', 5, 'curbside', rng, 1, [], 4);
    const k = BAL.worlds.itemGrowth ** 3;
    const atk = (it: typeof t1) => itemMods(it).filter((m) => m.stat === 'ATK' && m.mode === 'flat').reduce((a, m) => a + m.value, 0);
    const crit = (it: typeof t1) => itemMods(it).filter((m) => m.stat === 'CRIT' && m.mode === 'flat').reduce((a, m) => a + m.value, 0);
    expect(atk(t4)).toBeCloseTo(atk(t1) * k);
    expect(crit(t4)).toBeCloseTo(crit(t1));
    expect(t4.power).toBeGreaterThan(t1.power);
    expect(recycleRewards(t4).coins).toBeCloseTo(recycleRewards(t1).coins * BAL.worlds.goldGrowth ** 3, -1);
  });

  it('substat counts follow rarity, never duplicate, and are evenly spread (10,000 items)', () => {
    const rng = new Rng(10);
    const base = DATA.itemsById.get('hat_lawn_gnome')!;
    const affixCounts = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      const it = createItem(base, 'epic', 5, 'curbside', rng, i);
      expect(it.subs).toHaveLength(2);
      expect(new Set(it.subs.map((s) => s.affixId)).size).toBe(2);
      for (const s of it.subs) affixCounts.set(s.affixId, (affixCounts.get(s.affixId) ?? 0) + 1);
    }
    for (const v of affixCounts.values()) expect(Math.abs(v / (N * 2) - 1 / 12)).toBeLessThan(0.01);
    for (const r of RARITIES) {
      const it = createItem(base, r, 1, 'curbside', rng, 0);
      expect(it.subs).toHaveLength(BAL.rarities[r].substats);
      expect(it.mintPerkId !== null).toBe(r === 'mint');
    }
  });

  it('substat values scale with item level', () => {
    const rng = new Rng(11);
    const base = DATA.itemsById.get('hat_lawn_gnome')!;
    const it = createItem(base, 'mint', 21, 'curbside', rng, 0);
    for (const s of it.subs) {
      const a = DATA.affixesById.get(s.affixId)!;
      const scale = 1 + BAL.items.substatLevelScale * 20;
      expect(s.value).toBeGreaterThanOrEqual(a.min * scale - 0.01);
      expect(s.value).toBeLessThanOrEqual(a.max * scale + 0.01);
    }
  });

  it('recycle rewards scale with item level', () => {
    expect(recycleRewards({ rarity: 'junk', level: 10 })).toEqual({ xp: Math.round(5 * 1.5), coins: Math.round(10 * 1.5) });
  });

  it('uses the legendary name at Legendary and above', () => {
    expect(itemName({ baseId: 'hat_traffic_cone', rarity: 'epic' })).toBe('Traffic Cone');
    expect(itemName({ baseId: 'hat_traffic_cone', rarity: 'legendary' })).toBe('Traffic Cone of Destiny');
  });
});

describe('dumpster upgrades', () => {
  it('cost = 400 x 1.85^(L-1), time = 60s x 1.65^(L-1) capped at 24h', () => {
    expect(upgradeCost(1)).toBe(400);
    expect(upgradeCost(5)).toBe(Math.round(400 * 1.85 ** 4));
    expect(upgradeSeconds(1)).toBe(60);
    expect(upgradeSeconds(10)).toBe(Math.round(60 * 1.65 ** 9));
    expect(upgradeSeconds(29)).toBe(86_400);
  });

  it('gem speedup costs 1 Gem per 2 minutes remaining, minimum 1', () => {
    expect(gemSpeedupCost(10_000)).toBe(1);
    expect(gemSpeedupCost(120_000)).toBe(1);
    expect(gemSpeedupCost(121_000)).toBe(2);
    expect(gemSpeedupCost(60 * 60_000)).toBe(30);
  });

  it('runs one upgrade at a time and completes on the timer', () => {
    const rng = new Rng(1);
    let st = structuredClone(freshState()) as GameState;
    st.currencies.coins = 10_000;
    st = act(st, { type: 'startDumpsterUpgrade' }, rng).state;
    expect(st.currencies.coins).toBe(10_000 - 400);
    expect(st.dumpster.upgradeEndsAt).toBe(T0 + 60_000);
    const again = act(st, { type: 'startDumpsterUpgrade' }, rng).state;
    expect(again.currencies.coins).toBe(st.currencies.coins);
    st = structuredClone(tick(st, { ticks: 1 }, rng, T0 + 59_000).state) as GameState;
    expect(st.dumpster.level).toBe(1);
    st = structuredClone(tick(st, { ticks: 1 }, rng, T0 + 60_000).state) as GameState;
    expect(st.dumpster.level).toBe(2);
  });

  it('gem and ad speedups', () => {
    const rng = new Rng(1);
    let st = structuredClone(freshState()) as GameState;
    st.currencies.coins = 1e9;
    st.dumpster.level = 15;
    st = act(st, { type: 'startDumpsterUpgrade' }, rng).state;
    st.currencies.gems = 1000;
    const remaining = st.dumpster.upgradeEndsAt! - T0;
    const ad = act(st, { type: 'speedupDumpsterAd' }, rng).state;
    expect(ad.dumpster.upgradeEndsAt).toBe(st.dumpster.upgradeEndsAt! - 30 * 60_000);
    let capped = ad;
    for (let i = 0; i < 5; i++) capped = act(capped, { type: 'speedupDumpsterAd' }, rng).state;
    expect(capped.dumpster.adSpeedupsUsed).toBe(BAL.dumpster.adSpeedup.perDay);
    const g = act(st, { type: 'speedupDumpsterGems' }, rng).state;
    expect(g.currencies.gems).toBe(1000 - gemSpeedupCost(remaining));
    expect(g.dumpster.level).toBe(16);
  });
});

describe('codex', () => {
  it('grants a bonus every 10 entries, cycling ATK, HP, BAG_FIND', () => {
    expect(codexBonusMods(9)).toHaveLength(0);
    expect(codexBonusMods(10)).toEqual([BAL.codex.bonusCycle[0]]);
    expect(codexBonusMods(30).map((m) => m.stat)).toEqual(['ATK', 'HP', 'BAG_FIND']);
  });
});
