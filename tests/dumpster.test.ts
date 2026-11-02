import { describe, expect, it } from 'vitest';
import {
  applyAction, createItem, gemSpeedupCost, mainStatValue, recycleRewards, rarityOddsAt, rarityWeightsAt, rollItemLevel,
  rollRarity, rollRarityAtLeast, rollSlot, Rng, upgradeCost, upgradeSeconds, codexBonusMods, itemName, tick,
  type GameState,
} from '../src/core';
import { BAL, DATA, RARITIES, SLOTS } from '../src/data';
import { freshState, histogram, T0 } from './helpers';

const N = 10_000;

describe('rarity tables', () => {
  it('matches the spec rows exactly at table levels', () => {
    expect(rarityWeightsAt(1)).toEqual({ junk: 72, decent: 24, shiny: 3.6, epic: 0.4, legendary: 0, mythic: 0, mint: 0 });
    expect(rarityWeightsAt(30).mint).toBe(0.5);
  });

  it('interpolates linearly between rows', () => {
    const w = rarityWeightsAt(3);
    expect(w.junk).toBeCloseTo(72 + (55 - 72) * 0.5);
    expect(w.epic).toBeCloseTo(0.4 + (2.6 - 0.4) * 0.5);
    const w12 = rarityWeightsAt(12);
    expect(w12.legendary).toBeCloseTo(1.8 + (4.3 - 1.8) * 0.4);
  });

  for (const level of [1, 5, 10, 20, 30]) {
    it(`10,000 dives at Dumpster Level ${level} land within 1% of the table`, () => {
      const rng = new Rng(1000 + level);
      const h = histogram(N, () => rollRarity(level, rng));
      const odds = rarityOddsAt(level);
      for (const r of RARITIES) {
        const observed = (h.get(r) ?? 0) / N;
        expect(Math.abs(observed - odds[r]), `${r} at level ${level}`).toBeLessThan(0.01);
      }
    });
  }

  it('bad luck roll is always Epic or better', () => {
    const rng = new Rng(4);
    const h = histogram(N, () => rollRarityAtLeast(3, 'epic', rng));
    for (const r of h.keys()) expect(['epic', 'legendary', 'mythic', 'mint']).toContain(r);
  });
});

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

  it('main stat = slotBase x (1 + 0.09 x (level - 1)) x rarity multiplier', () => {
    expect(mainStatValue(30, 1, 'junk')).toBeCloseTo(30);
    expect(mainStatValue(30, 11, 'legendary')).toBeCloseTo(30 * 1.9 * 2.8);
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

/** Applies an action and returns a mutable copy (immer freezes results) so tests can poke at state. */
function act(st: GameState, a: Parameters<typeof applyAction>[1], rng: Rng, now = T0) {
  const r = applyAction(st, a, rng, now);
  return { ...r, state: structuredClone(r.state) as GameState };
}

describe('dives', () => {
  it('the very first dive is the scripted Legendary Traffic Cone of Destiny', () => {
    const rng = new Rng(1);
    const r = act(freshState(), { type: 'dive' }, rng);
    const item = r.state.pendingItem!;
    expect(item.baseId).toBe('hat_traffic_cone');
    expect(item.rarity).toBe('legendary');
    expect(r.state.currencies.bags).toBe(BAL.start.bags - 1);
    expect(r.events.find((e) => e.type === 'dive')).toMatchObject({ fullFlip: true });
  });

  it('equip replaces and recycles the old item; recycle grants XP and coins', () => {
    const rng = new Rng(1);
    let st = act(freshState(), { type: 'dive' }, rng).state;
    st = act(st, { type: 'equipPending' }, rng).state;
    expect(st.equipped.hat?.baseId).toBe('hat_traffic_cone');
    st.currencies.bags = 5;
    st = act(st, { type: 'dive' }, rng).state;
    const pending = st.pendingItem!;
    const r = act(st, { type: 'recyclePending' }, rng);
    expect(r.state.pendingItem).toBeNull();
    expect(r.state.currencies.coins).toBe(st.currencies.coins + recycleRewards(pending).coins);
  });

  it('cannot dive without bags or while a compare card is open', () => {
    const rng = new Rng(1);
    const st = freshState();
    st.currencies.bags = 0;
    expect(act(st, { type: 'dive' }, rng).state.dumpster.totalDives).toBe(0);
    const st2 = act(freshState(), { type: 'dive' }, rng).state;
    expect(act(st2, { type: 'dive' }, rng).state.dumpster.totalDives).toBe(1);
  });

  it('bad luck protection: from Dumpster Level 3, 40 dry dives force Epic or better', () => {
    const rng = new Rng(1);
    let st = freshState();
    st.dumpster.firstDiveDone = true;
    st.dumpster.level = 3;
    st.dumpster.dryStreak = 40;
    st.currencies.bags = 1;
    st = act(st, { type: 'dive' }, rng).state;
    expect(['epic', 'legendary', 'mythic', 'mint']).toContain(st.pendingItem!.rarity);
    expect(st.dumpster.dryStreak).toBe(0);
  });

  it('bad luck protection does not apply below Dumpster Level 3', () => {
    let st = freshState();
    st.dumpster.firstDiveDone = true;
    st.dumpster.level = 2;
    st.dumpster.dryStreak = 1000;
    let epicPlus = 0;
    const rng = new Rng(2);
    for (let i = 0; i < 200; i++) {
      st.currencies.bags = 1;
      st.pendingItem = null;
      st = act(st, { type: 'dive' }, rng).state;
      if (['epic', 'legendary', 'mythic', 'mint'].includes(st.pendingItem!.rarity)) epicPlus++;
    }
    expect(epicPlus).toBeLessThan(20);
  });

  it('dry streak counter reaches the threshold in normal play', () => {
    let st = freshState();
    st.dumpster.firstDiveDone = true;
    st.dumpster.level = 3;
    const rng = new Rng(3);
    let maxStreak = 0;
    for (let i = 0; i < 2000; i++) {
      st.currencies.bags = 1;
      st.pendingItem = null;
      st = act(st, { type: 'dive' }, rng).state;
      maxStreak = Math.max(maxStreak, st.dumpster.dryStreak);
    }
    expect(maxStreak).toBeLessThanOrEqual(BAL.dumpster.badLuck.drySpell);
  });
});

describe('auto-dive', () => {
  function autoState(): GameState {
    const st = freshState();
    st.dumpster.firstDiveDone = true;
    st.autoDive.unlocked = true;
    st.autoDive.enabled = true;
    st.currencies.bags = 30;
    return st;
  }

  it('unlocks after 8 minutes of play', () => {
    const rng = new Rng(1);
    const st = freshState();
    st.playTimeMs = BAL.autoDive.unlockPlayMinutes * 60_000 - 100;
    const r = tick(st, { ticks: 1 }, rng, T0);
    expect(r.state.autoDive.unlocked).toBe(true);
    expect(r.events.some((e) => e.type === 'autoDiveUnlocked')).toBe(true);
  });

  it('dives one bag every 0.6s, equipping upgrades and recycling the rest', () => {
    const rng = new Rng(1);
    const st = autoState();
    st.autoDive.keepMinRarity = 'mint';
    st.dumpster.level = 1;
    const r = tick(st, { ticks: 60 }, rng, T0);
    const dives = r.events.filter((e) => e.type === 'dive');
    expect(dives.length).toBeGreaterThanOrEqual(9);
    expect(dives.length).toBeLessThanOrEqual(10);
    expect(r.events.some((e) => e.type === 'equip' && e.auto)).toBe(true);
    for (const d of dives) if (d.type === 'dive' && !d.fullFlip) expect(d.outcome).not.toBe('pending');
  });

  it('pauses for Legendary or better', () => {
    const rng = new Rng(1);
    const st = autoState();
    st.dumpster.forcedRarity = 'legendary';
    const r = tick(st, { ticks: 30 }, rng, T0);
    expect(r.state.pendingItem?.rarity).toBe('legendary');
    expect(r.events.filter((e) => e.type === 'dive')).toHaveLength(1);
  });

  it('pauses for items matching keep filters instead of recycling them', () => {
    const rng = new Rng(1);
    const st = autoState();
    // Fill every slot with something unbeatable so nothing auto-equips.
    for (const s of SLOTS) {
      st.equipped[s] = { uid: 0, baseId: 'x', slot: s, rarity: 'junk', level: 1, main: [], subs: [], bonus: [], mintPerkId: null, power: 1e9 };
    }
    st.autoDive.keepMinRarity = 'decent';
    const r = tick(st, { ticks: 600 }, rng, T0);
    expect(r.state.pendingItem).not.toBeNull();
    expect(['junk']).not.toContain(r.state.pendingItem!.rarity);
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
    let st = freshState();
    st.currencies.coins = 10_000;
    st = act(st, { type: 'startDumpsterUpgrade' }, rng).state;
    expect(st.currencies.coins).toBe(10_000 - 400);
    expect(st.dumpster.upgradeEndsAt).toBe(T0 + 60_000);
    const again = act(st, { type: 'startDumpsterUpgrade' }, rng).state;
    expect(again.currencies.coins).toBe(st.currencies.coins);
    st = tick(st, { ticks: 1 }, rng, T0 + 59_000).state;
    expect(st.dumpster.level).toBe(1);
    st = tick(st, { ticks: 1 }, rng, T0 + 60_000).state;
    expect(st.dumpster.level).toBe(2);
  });

  it('gem and ad speedups', () => {
    const rng = new Rng(1);
    let st = freshState();
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
  it('records first finds and grants a bonus every 10 entries', () => {
    expect(codexBonusMods(9)).toHaveLength(0);
    expect(codexBonusMods(10)).toEqual([BAL.codex.bonusCycle[0]]);
    expect(codexBonusMods(30).map((m) => m.stat)).toEqual(['ATK', 'HP', 'BAG_FIND']);
    const rng = new Rng(5);
    let st = freshState();
    st.dumpster.firstDiveDone = true;
    const gems0 = st.currencies.gems;
    let entriesSeen = 0;
    for (let i = 0; i < 300 && st.codex.entries.length < 10; i++) {
      st.currencies.bags = 1;
      st = act(st, { type: 'dive' }, rng).state;
      st = act(st, { type: 'recyclePending' }, rng).state;
      entriesSeen = st.codex.entries.length;
    }
    expect(entriesSeen).toBe(10);
    expect(st.currencies.gems).toBe(gems0 + BAL.codex.gemsPerBonus);
    expect(new Set(st.codex.entries).size).toBe(st.codex.entries.length);
  });
});
