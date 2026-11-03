import { describe, expect, it } from 'vitest';
import {
  applyAction, createItem, enchantPowerMult, gearScale, gemSpeedupCost, itemMods, itemOddsOneIn, mainStatValue, modsScore, powerForOdds,
  recycleRewards, rollItemLevel, rollSlot, Rng, upgradeCost, upgradeSeconds, codexBonusMods, itemName, tick, type GameState,
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

  it('main stat before sizing = slotBase x rarity multiplier (it only sets the stat mix)', () => {
    expect(mainStatValue(30, 'junk')).toBeCloseTo(30);
    expect(mainStatValue(30, 'legendary')).toBeCloseTo(30 * BAL.rarities.legendary.mult);
  });

  it('power is rarity: an item\'s power comes from its odds alone, and a rarer item always has more (10,000 items)', () => {
    const rng = new Rng(21);
    const bases = DATA.items.filter((i) => !i.unique);
    const items = Array.from({ length: N }, (_, i) => {
      const r = RARITIES[Math.floor(rng.float(0, RARITIES.length))];
      const enchants = rng.chance(0.4) ? [{ id: DATA.enchants[0].id, tier: 1 + Math.floor(rng.float(0, 3)) }] : [];
      return createItem(rng.pick(bases), r, 1 + Math.floor(rng.float(0, 60)), 'curbside', rng, i, enchants, 1 + Math.floor(rng.float(0, 10)));
    });
    for (const it of items) expect(it.power).toBe(powerForOdds(itemOddsOneIn(it)));
    const byOdds = [...items].sort((a, b) => itemOddsOneIn(a) - itemOddsOneIn(b));
    for (let i = 1; i < byOdds.length; i++) expect(byOdds[i].power).toBeGreaterThanOrEqual(byOdds[i - 1].power);
    // Item level and world don't change an item's power: the same rarity and enchantments give the same power.
    const gnome = DATA.itemsById.get('hat_lawn_gnome')!;
    expect(createItem(gnome, 'epic', 40, 'curbside', rng, 1, [], 7).power).toBe(createItem(gnome, 'epic', 1, 'curbside', rng, 2, [], 1).power);
  });

  it('an enchantment makes an item rarer and stronger (an enchanted Epic outranks a plain Legendary)', () => {
    const rng = new Rng(22);
    const gnome = DATA.itemsById.get('hat_lawn_gnome')!;
    const plain = createItem(gnome, 'epic', 5, 'curbside', rng, 1);
    const ench = createItem(gnome, 'epic', 5, 'curbside', rng, 2, [{ id: DATA.enchants[0].id, tier: 1 }]);
    const legendary = createItem(gnome, 'legendary', 5, 'curbside', rng, 3);
    expect(itemOddsOneIn(ench)).toBeGreaterThan(itemOddsOneIn(plain));
    expect(ench.power).toBeGreaterThan(plain.power);
    expect(itemOddsOneIn(ench)).toBeGreaterThan(itemOddsOneIn(legendary));
    expect(ench.power).toBeGreaterThan(legendary.power);
  });

  it('stats are sized to the power: their weighted score (with enchantment bonus) is the item\'s power', () => {
    const rng = new Rng(23);
    for (const r of RARITIES) {
      const it = createItem(rng.pick(DATA.items), r, 9, 'curbside', rng, 0, r === 'epic' ? [{ id: DATA.enchants[1].id, tier: 2 }] : []);
      const score = modsScore(itemMods(it)) * (1 + enchantPowerMult(it.enchants));
      expect(Math.abs(score - it.power) / it.power, `${r}`).toBeLessThan(0.03);
    }
  });

  it('worn gear grows with the raccoon: level grows its own stats, the best world its flat HP / ATK / DEF', () => {
    const mask = DATA.items.find((i) => i.slot === 'mask' && !i.unique)!;
    const it = createItem(mask, 'shiny', 5, 'curbside', new Rng(12), 1);
    const sum = (mods: ReturnType<typeof itemMods>, stat: string) => mods.filter((m) => m.stat === stat && m.mode === 'flat').reduce((a, m) => a + m.value, 0);
    const fresh = gearScale({ player: { level: 1 } as never, stage: { highestCleared: 0 } as never });
    const later = gearScale({ player: { level: 11 } as never, stage: { highestCleared: 3 } as never });
    expect(fresh).toEqual({ level: 1, tier: 1 });
    expect(later.level).toBeCloseTo(1 + BAL.items.levelScalePerLevel * 10);
    expect(later.tier).toBeCloseTo(BAL.worlds.itemGrowth ** 3);
    expect(sum(itemMods(it, later), 'ATK')).toBeCloseTo(sum(itemMods(it), 'ATK') * later.level * later.tier);
    expect(sum(itemMods(it, later), 'CRIT')).toBeCloseTo(sum(itemMods(it), 'CRIT') * later.level);
    // Scrap gold still grows with the world the item came from.
    const t4 = createItem(mask, 'shiny', 5, 'curbside', new Rng(12), 1, [], 4);
    expect(recycleRewards(t4).coins).toBeCloseTo(recycleRewards(it).coins * BAL.worlds.goldGrowth ** 3, -1);
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
