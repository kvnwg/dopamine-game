import { describe, expect, it } from 'vitest';
import {
  applyAction, canRebirth, combatEffects, luckOddsOneIn, rollDrama, haulMinutes, haulSize, currentRate, createItem, currentLuck, goldMult, inventoryCapacity, computeStats, isUpgrade, itemOddsOneIn, luckBreakdown, performRoll, luckyEvery, rarityChances, rebirthRequirement, rollEnchants, rollRarity, Rng, performSpin, rarityAtLeast, reelCount, spinCycle, spinShare, tick, sanitizeUpgrades, upgradeCostAt, upgradeDef, upgradeEffects, upgradeNodeState, type CoreEvent, type GameState, type Item, bestUpgrades,
} from '../src/core';
import { BAL, DATA, RARITIES } from '../src/data';
import { freshState, histogram, T0 } from './helpers';

const N = 10_000;
const clone = (s: GameState) => structuredClone(s) as GameState;

function act(st: GameState, a: Parameters<typeof applyAction>[1], rng: Rng, now = T0) {
  const r = applyAction(st, a, rng, now);
  return { ...r, state: clone(r.state) };
}

function runTicks(st: GameState, ticks: number, rng: Rng, now = T0) {
  const events: CoreEvent[] = [];
  let s = st;
  for (let i = 0; i < ticks; i++) {
    const r = tick(s, { ticks: 1 }, rng, now + i * 100);
    s = r.state;
    events.push(...r.events);
  }
  return { state: clone(s), events };
}

function makeItem(over: Partial<Item>): Item {
  return {
    uid: 1, baseId: 'hat_lawn_gnome', slot: 'hat', rarity: 'junk', level: 1, main: [], subs: [], bonus: [],
    mintPerkId: null, enchants: [], locked: false, tier: 1, power: 10, ...over,
  };
}

/** A state that has already had its scripted first roll. */
function rollingState(): GameState {
  const st = clone(freshState());
  st.dumpster.firstDiveDone = true;
  return st;
}

describe('luck odds ("1 in X")', () => {
  it('chances at luck 1 follow the base odds, rarest tier first', () => {
    const c = rarityChances(1);
    const odds = BAL.rarityOdds;
    // Tiers are tried rarest first: each one's chance is its own odds times "none rarer hit".
    expect(c.grail).toBeCloseTo(1 / odds.grail);
    let none = 1;
    for (const r of [...RARITIES].reverse()) {
      if (r === 'junk') break;
      expect(c[r], r).toBeCloseTo(none / odds[r], 12);
      none *= 1 - 1 / odds[r];
    }
    expect(RARITIES.reduce((s, r) => s + c[r], 0)).toBeCloseTo(1);
  });

  for (const luck of [1, 3, 25]) {
    it(`10,000 rolls at luck ${luck} land within 4 standard errors of the computed chances`, () => {
      const rng = new Rng(500 + luck);
      const h = histogram(N, () => rollRarity(luck, rng));
      const c = rarityChances(luck);
      for (const r of RARITIES) {
        const se = Math.sqrt((c[r] * (1 - c[r])) / N);
        expect(Math.abs((h.get(r) ?? 0) / N - c[r]), r).toBeLessThan(4 * se + 0.001);
      }
    });
  }

  it('a roll is judged by how rare it is at your luck: a Legendary is big at luck 1, routine at luck 50', () => {
    const legendary = { rarity: 'legendary' as const, enchants: [] };
    // At luck 1 it is about its own odds (this tier or better).
    expect(luckOddsOneIn(legendary, 1)).toBeGreaterThan(BAL.rarityOdds.legendary * 0.9);
    expect(luckOddsOneIn(legendary, 1)).toBeLessThanOrEqual(BAL.rarityOdds.legendary);
    expect(luckOddsOneIn(legendary, 10)).toBeLessThan(luckOddsOneIn(legendary, 1) / 9);
    expect(rollDrama(luckOddsOneIn(legendary, 1))).not.toBeNull();
    expect(rollDrama(luckOddsOneIn(legendary, 50))).toBeNull();
    // Enchantments make it rarer at any luck.
    expect(luckOddsOneIn({ rarity: 'legendary', enchants: [{ tier: 1 }] }, 10)).toBeGreaterThan(luckOddsOneIn(legendary, 10));
    // Bigger deals for rarer rolls.
    const b = BAL.feel.bigRoll;
    expect([rollDrama(b.big - 1), rollDrama(b.big), rollDrama(b.huge), rollDrama(b.insane)]).toEqual([null, 'big', 'huge', 'insane']);
    expect(rollDrama(luckOddsOneIn({ rarity: 'mythic', enchants: [] }, 1))).toBe('huge');
    expect(rollDrama(luckOddsOneIn({ rarity: 'vintage', enchants: [] }, 1))).toBe('insane');
  });

  it('a Scrap All haul is measured in minutes of fighting; long ones get a big, huge or mega moment', () => {
    const st = rollingState();
    const perMin = currentRate(st, T0).coins;
    expect(perMin).toBeGreaterThan(0);
    expect(haulMinutes(st, perMin * 30, T0)).toBeCloseTo(30);
    const h = BAL.feel.haul;
    expect([haulSize(h.big - 0.1), haulSize(h.big), haulSize(h.huge), haulSize(h.mega)]).toEqual([null, 'big', 'huge', 'mega']);
  });

  it('higher luck makes common rarities rarer and rare ones likelier', () => {
    expect(rarityChances(10).junk).toBeLessThan(rarityChances(1).junk);
    expect(rarityChances(10).epic).toBeGreaterThan(rarityChances(1).epic);
    // At luck >= the Decent odds, Decent-or-better is guaranteed.
    expect(rarityChances(BAL.rarityOdds.decent).junk).toBe(0);
  });

  it('a minimum rarity floor never rolls below it (10,000 rolls)', () => {
    const rng = new Rng(4);
    const h = histogram(N, () => rollRarity(1, rng, 'epic'));
    for (const r of h.keys()) expect(rarityAtLeast(r, 'epic'), r).toBe(true);
  });

  it('luck combines upgrades, dumpster level, enchantments, rebirths and boosts', () => {
    const st = rollingState();
    expect(currentLuck(st, T0)).toBeCloseTo(1);
    st.upgrades.luck = 3;
    st.dumpster.level = 6;
    st.rebirths = 2;
    st.luckBoostEndsAt = T0 + 60_000;
    st.equipped.ring = makeItem({ slot: 'ring', enchants: [{ id: 'lucky', tier: 3 }] });
    const b = luckBreakdown(st, T0);
    const perLevel = BAL.upgrades.find((u) => u.id === 'luck')!.perLevel;
    const add = 3 * perLevel + 5 * BAL.dumpster.luckPerLevel + 0.18;
    const rebirth = 1 + 2 * BAL.rebirth.luckPer;
    expect(b.upgrades).toBeCloseTo(3 * perLevel);
    expect(b.dumpster).toBeCloseTo(5 * BAL.dumpster.luckPerLevel);
    expect(b.enchants).toBeCloseTo(0.18);
    expect(b.rebirthMult).toBeCloseTo(rebirth);
    expect(b.boostMult).toBe(BAL.luck.potion.mult);
    expect(b.total).toBeCloseTo((1 + add) * rebirth * BAL.luck.potion.mult);
    expect(currentLuck(st, T0 + 61_000)).toBeCloseTo((1 + add) * rebirth);
  });
});

describe('the wheel', () => {
  it('the first spin is the scripted Legendary Traffic Cone, then spins keep coming without input', () => {
    const rng = new Rng(1);
    const { events } = runTicks(clone(freshState()), 120, rng);
    const rolls = events.filter((e) => e.type === 'roll');
    expect(rolls.length).toBeGreaterThanOrEqual(Math.floor(12 / spinCycle(freshState())) - 1);
    const first = rolls[0];
    expect(first.type === 'roll' && first.item.baseId).toBe('hat_traffic_cone');
    expect(first.type === 'roll' && first.item.rarity).toBe('legendary');
  });

  it('a spin starts with its result already decided, lands after spinSeconds, then rests', () => {
    const rng = new Rng(11);
    const st = rollingState();
    st.currencies.bags = 0;
    const cycle = spinCycle(st);
    expect(cycle).toBeGreaterThanOrEqual(2);
    expect(cycle).toBeLessThanOrEqual(4);
    const { events } = runTicks(st, 1, rng);
    const start = events.find((e) => e.type === 'spinStart');
    expect(start?.type === 'spinStart' && start.spinSeconds).toBeCloseTo(cycle * spinShare());
    expect(start?.type === 'spinStart' && start.restSeconds).toBeCloseTo(cycle * (1 - spinShare()));
    const ticksToLand = Math.ceil(((start as Extract<CoreEvent, { type: 'spinStart' }>).spinSeconds) * 10);
    const { events: ev2 } = runTicks(st, ticksToLand + 1, new Rng(11));
    const landed = ev2.find((e) => e.type === 'roll');
    expect(landed?.type === 'roll' && start?.type === 'spinStart' && landed.item.uid).toBe(start?.type === 'spinStart' ? start.reels[0].item.uid : -1);
  });

  it('Extra Reels roll one item per reel on every spin, sharing the spin\'s lucky and golden luck', () => {
    const rng = new Rng(21);
    const st = rollingState();
    st.currencies.bags = 0;
    expect(reelCount(st)).toBe(1);
    st.upgrades.luck = 1;
    st.upgrades.extraReel = 2;
    expect(reelCount(st)).toBe(3);
    st.upgrades.extraReel = 99;
    expect(reelCount(st)).toBe(BAL.roll.maxReels);
    st.upgrades.extraReel = 2;
    st.roll.sinceLucky = luckyEvery(st) - 1;
    const ev: CoreEvent[] = [];
    const before = st.roll.count;
    const items = performSpin(st, rng, T0, ev);
    expect(items).toHaveLength(3);
    expect(new Set(items.map((i) => i.uid)).size).toBe(3);
    expect(st.roll.count).toBe(before + 3);
    const start = ev.find((e) => e.type === 'spinStart');
    expect(start?.type === 'spinStart' && start.reels).toHaveLength(3);
    const rolls = ev.filter((e) => e.type === 'roll');
    expect(rolls.map((e) => e.type === 'roll' && e.reel)).toEqual([0, 1, 2]);
    // Lucky is decided once per spin and covers every reel.
    expect(rolls.every((e) => e.type === 'roll' && e.lucky)).toBe(true);
  });

  it('bad-luck protection fires once per streak even with several reels', () => {
    const rng = new Rng(22);
    const st = rollingState();
    st.currencies.bags = 0;
    st.upgrades.luck = 1;
    st.upgrades.extraReel = 4;
    st.dumpster.level = BAL.dumpster.badLuck.minDumpsterLevel;
    st.dumpster.dryStreak = 999;
    const ev: CoreEvent[] = [];
    const items = performSpin(st, rng, T0, ev);
    expect(rarityAtLeast(items[0].rarity, BAL.dumpster.badLuck.minRarity)).toBe(true);
  });

  it('Spin Speed upgrades shorten the cycle, down to a floor', () => {
    const st = rollingState();
    const base = spinCycle(st);
    const per = upgradeDef('rollSpeed')!.perLevel;
    st.upgrades.rollSpeed = 3;
    expect(spinCycle(st)).toBeCloseTo(base * (1 - BAL.roll.speedPerLevel) ** (3 * per));
    st.upgrades.rollSpeed = upgradeDef('rollSpeed')!.max;
    const fastest = spinCycle(st);
    expect(fastest).toBeGreaterThanOrEqual(BAL.roll.minCycleSeconds);
    expect(fastest).toBeLessThan(base * 0.35);
  });

  it('a Trash Bag pays for a faster turbo spin', () => {
    const rng = new Rng(2);
    const st = rollingState();
    st.currencies.bags = 5;
    expect(spinCycle(st, true)).toBeCloseTo(Math.max(BAL.roll.minTurboCycleSeconds, spinCycle(st) / BAL.roll.turboSpeedMult));
    const seconds = 5 * spinCycle(st, true) + 0.5;
    const { state, events } = runTicks(st, Math.ceil(seconds * 10), rng);
    const turbo = events.filter((e) => e.type === 'roll' && e.source === 'turbo').length;
    expect(turbo).toBeGreaterThanOrEqual(4);
    expect(state.currencies.bags).toBeLessThanOrEqual(1);
    // Without bags the same time gives fewer spins.
    const plain = runTicks(rollingState(), Math.ceil(seconds * 10), new Rng(2)).events.filter((e) => e.type === 'roll').length;
    expect(turbo).toBeGreaterThan(plain);
  });

  it('every Nth spin is a lucky spin', () => {
    const rng = new Rng(3);
    const st = rollingState();
    st.currencies.bags = 40;
    const { events } = runTicks(st, 300, rng);
    const rolls = events.filter((e) => e.type === 'roll');
    const lucky = rolls.filter((e) => e.type === 'roll' && e.lucky).length;
    expect(lucky).toBe(Math.floor(rolls.length / luckyEvery(st)));
  });

  it('never equips by itself; the bag keeps the highest-power items when full', () => {
    const rng = new Rng(4);
    const st = rollingState();
    st.currencies.bags = 300;
    const { state, events } = runTicks(st, 1200, rng);
    expect(events.some((e) => e.type === 'equip')).toBe(false);
    for (const slot of Object.keys(state.equipped)) expect(state.equipped[slot as keyof typeof state.equipped]).toBeNull();
    const cap = inventoryCapacity(state);
    expect(state.inventory.length).toBe(cap);
    for (let i = 1; i < state.inventory.length; i++) expect(state.inventory[i - 1].power).toBeGreaterThanOrEqual(state.inventory[i].power);
    expect(events.some((e) => e.type === 'roll' && e.placed === 'scrapped')).toBe(true);
  });

  it('scraps a new item that is weaker than everything in a full bag', () => {
    const rng = new Rng(5);
    const st = rollingState();
    st.inventory = Array.from({ length: inventoryCapacity(st) }, (_, i) => makeItem({ uid: 1000 + i, power: 1e9 }));
    const { state, events } = runTicks(st, 40, rng);
    expect(state.inventory.every((x) => x.power === 1e9)).toBe(true);
    expect(events.some((e) => e.type === 'roll' && e.placed === 'scrapped')).toBe(true);
    expect(state.currencies.coins).toBeGreaterThan(0);
  });

  it('locked items are never auto-scrapped', () => {
    const rng = new Rng(6);
    const st = rollingState();
    st.inventory = Array.from({ length: inventoryCapacity(st) }, (_, i) => makeItem({ uid: 2000 + i, power: 0, locked: true }));
    st.currencies.bags = 5;
    const { state } = runTicks(st, 60, rng);
    expect(state.inventory.filter((x) => x.locked)).toHaveLength(inventoryCapacity(st));
  });

  it('equipping (by dragging) moves the old item to the bag; scrap, lock, and Scrap All', () => {
    const rng = new Rng(7);
    let st = rollingState();
    st.inventory = [
      makeItem({ uid: 77, slot: 'hat', power: 5 }),
      makeItem({ uid: 78, slot: 'ring', power: 6 }),
      makeItem({ uid: 79, slot: 'hat', power: 9 }),
    ];
    st = act(st, { type: 'equipItem', uid: 77 }, rng).state;
    expect(st.equipped.hat?.uid).toBe(77);
    expect(isUpgrade(st, st.inventory.find((x) => x.uid === 79)!)).toBe(true);
    st = act(st, { type: 'equipItem', uid: 79 }, rng).state;
    expect(st.equipped.hat?.uid).toBe(79);
    expect(st.inventory.some((x) => x.uid === 77)).toBe(true);
    st = act(st, { type: 'toggleLock', uid: 78 }, rng).state;
    expect(act(st, { type: 'scrapItem', uid: 78 }, rng).state.inventory.some((x) => x.uid === 78)).toBe(true);
    const coins = st.currencies.coins;
    const r = act(st, { type: 'scrapAll' }, rng);
    expect(r.state.inventory.map((x) => x.uid)).toEqual([78]);
    const ev = r.events.find((e) => e.type === 'scrapAll');
    expect(ev?.type === 'scrapAll' && ev.count).toBe(1);
    expect(r.state.currencies.coins).toBeGreaterThan(coins);
  });
});

describe('Equip best', () => {
  it('wears the biggest upgrade in every slot at once, and leaves nothing better in the bag', () => {
    const rng = new Rng(8);
    let st = rollingState();
    st.equipped.hat = makeItem({ uid: 1, slot: 'hat', power: 20 });
    st.inventory = [
      makeItem({ uid: 10, slot: 'hat', power: 30 }),
      makeItem({ uid: 11, slot: 'hat', power: 50 }),
      makeItem({ uid: 12, slot: 'ring', power: 7 }),
      makeItem({ uid: 13, slot: 'ring', power: 9 }),
      makeItem({ uid: 14, slot: 'weapon', power: 4 }),
    ];
    expect(bestUpgrades(st).map((x) => x.uid).sort()).toEqual([11, 13, 14]);
    const r = act(st, { type: 'equipBest' }, rng);
    st = r.state;
    expect(st.equipped.hat?.uid).toBe(11);
    expect(st.equipped.ring?.uid).toBe(13);
    expect(st.equipped.weapon?.uid).toBe(14);
    expect(st.inventory.some((x) => x.uid === 1)).toBe(true);
    expect(r.events.filter((e) => e.type === 'equip')).toHaveLength(3);
    expect(bestUpgrades(st)).toHaveLength(0);
    // Nothing to do: no events.
    expect(act(st, { type: 'equipBest' }, rng).events.filter((e) => e.type === 'equip')).toHaveLength(0);
  });
});

describe('"1 in X" item odds', () => {
  it('match the base chance of the rarity, and enchantments make an item rarer', () => {
    const c = rarityChances(1);
    expect(itemOddsOneIn({ rarity: 'legendary', enchants: [] })).toBe(Math.round(1 / c.legendary));
    expect(itemOddsOneIn({ rarity: 'junk', enchants: [] })).toBe(Math.round(1 / c.junk));
    const plain = itemOddsOneIn({ rarity: 'epic', enchants: [] });
    const one = itemOddsOneIn({ rarity: 'epic', enchants: [{ tier: 1 }] });
    const three = itemOddsOneIn({ rarity: 'epic', enchants: [{ tier: 3 }, { tier: 3 }, { tier: 3 }] });
    expect(one).toBeGreaterThan(plain * 10);
    expect(three).toBeGreaterThan(one * 1000);
  });
});

describe('upgrade map', () => {
  it('costs grow geometrically per tier and buying applies the effect', () => {
    const rng = new Rng(8);
    const def = upgradeDef('rollSpeed')!;
    expect(upgradeCostAt(def, 0)).toBe(def.cost.base);
    expect(upgradeCostAt(def, 3)).toBe(Math.round(def.cost.base * def.cost.growth ** 3));
    let st = rollingState();
    st.currencies.coins = 1e7;
    const before = spinCycle(st);
    // Spin Speed hangs off Luck I, so it is locked until Luck I is owned.
    expect(upgradeNodeState(st, 'rollSpeed', 1)).toBe('locked');
    expect(act(st, { type: 'buyUpgrade', id: 'rollSpeed' }, rng).state.upgrades.rollSpeed).toBeUndefined();
    expect(upgradeNodeState(st, 'luck', 1)).toBe('open');
    st = act(st, { type: 'buyUpgrade', id: 'luck' }, rng).state;
    expect(upgradeNodeState(st, 'luck', 1)).toBe('owned');
    expect(upgradeNodeState(st, 'luck', 2)).toBe('open');
    expect(upgradeNodeState(st, 'luck', 3)).toBe('locked');
    expect(upgradeNodeState(st, 'rollSpeed', 1)).toBe('open');
    for (let i = 0; i < 3; i++) st = act(st, { type: 'buyUpgrade', id: 'rollSpeed' }, rng).state;
    expect(st.upgrades.rollSpeed).toBe(3);
    expect(spinCycle(st)).toBeCloseTo(before * (1 - BAL.roll.speedPerLevel) ** (3 * def.perLevel));
    st = act(st, { type: 'buyUpgrade', id: 'gold' }, rng).state;
    expect(goldMult(st)).toBeCloseTo(1 + upgradeDef('gold')!.perLevel / 100);
    st = act(st, { type: 'buyUpgrade', id: 'bagSpace' }, rng).state;
    expect(inventoryCapacity(st)).toBe(BAL.inventory.baseCapacity + upgradeDef('bagSpace')!.perLevel);
  });

  it('special gold hexes are one big tier that adds to the same effect', () => {
    const rng = new Rng(12);
    let st = rollingState();
    st.currencies.coins = 1e12;
    const luck = upgradeDef('luck')!;
    st.upgrades.luck = luck.max;
    const clover = upgradeDef('clover')!;
    expect(clover.special).toBe(true);
    expect(clover.max).toBe(1);
    st = act(st, { type: 'buyUpgrade', id: 'clover' }, rng).state;
    expect(st.upgrades.clover).toBe(1);
    expect(upgradeEffects(st).luck).toBeCloseTo(luck.perLevel * luck.max + clover.perLevel);
    expect(act(st, { type: 'buyUpgrade', id: 'clover' }, rng).state.upgrades.clover).toBe(1);
  });

  it('cleans up saved upgrades: unknown lines, tiers past max, and lines whose parent tier is not owned', () => {
    const st = rollingState();
    st.upgrades = { luck: 99, rollSpeed: 2, bagFind: 3, nope: 4, enchant: 1 };
    sanitizeUpgrades(st);
    // bagFind hangs off Spin Speed II (owned), enchant off Luck III (owned once luck is clamped to max).
    expect(st.upgrades).toEqual({ luck: upgradeDef('luck')!.max, rollSpeed: 2, bagFind: 3, enchant: 1 });
    st.upgrades = { rollSpeed: 1, bagFind: 2 };
    sanitizeUpgrades(st);
    expect(st.upgrades).toEqual({});
  });

  it('cannot buy without gold or past max level', () => {
    const rng = new Rng(9);
    expect(act(rollingState(), { type: 'buyUpgrade', id: 'luck' }, rng).state.upgrades.luck).toBeUndefined();
    const st = rollingState();
    st.currencies.coins = 1e30;
    st.upgrades.luckyRoll = upgradeDef('luckyRoll')!.max;
    expect(act(st, { type: 'buyUpgrade', id: 'luckyRoll' }, rng).state.upgrades.luckyRoll).toBe(upgradeDef('luckyRoll')!.max);
    expect(luckyEvery(st)).toBe(Math.max(BAL.roll.luckyRollMinEvery, BAL.roll.luckyRollEvery - upgradeEffects(st).luckyEvery));
  });
});

describe('rebirth', () => {
  it('requires the world and gold, then wipes the raccoon and grants permanent multipliers', () => {
    const rng = new Rng(10);
    let st = rollingState();
    const req = rebirthRequirement(0);
    expect(canRebirth(st)).toBe(false);
    st.stage.highestCleared = req.world;
    st.currencies.coins = req.gold;
    st.upgrades.luck = 4;
    st.equipped.hat = makeItem({ uid: 5, power: 99 });
    st.player.level = 9;
    expect(canRebirth(st)).toBe(true);
    st = act(st, { type: 'rebirth' }, rng).state;
    expect(st.rebirths).toBe(1);
    expect(st.currencies.coins).toBe(0);
    expect(st.upgrades).toEqual({});
    expect(st.stage.highestCleared).toBe(0);
    expect(st.battle.stage).toBe(1);
    // Items, bag and level are gone.
    expect(st.equipped.hat).toBeNull();
    expect(st.inventory).toEqual([]);
    expect(st.player.level).toBe(1);
    expect(st.player.xp).toBe(0);
    expect(currentLuck(st, T0)).toBeCloseTo(1 + BAL.rebirth.luckPer);
    expect(goldMult(st)).toBeCloseTo(1 + BAL.rebirth.goldMultPer);
    expect(computeStats(st).ATK).toBeCloseTo(BAL.player.base.ATK * (1 + BAL.rebirth.statPctPer / 100));
    const luckDef = upgradeDef('luck')!;
    expect(upgradeCostAt(luckDef, 0, 1)).toBe(Math.max(1, Math.round(luckDef.cost.base * (1 - BAL.rebirth.upgradeDiscountPer))));
    expect(rebirthRequirement(1).world).toBeGreaterThan(req.world);
    expect(rebirthRequirement(1).gold).toBeGreaterThan(req.gold);
    expect(rebirthRequirement(99).world).toBe(DATA.worlds.length);
  });
});

describe('enchantments', () => {
  it('roll at the configured chance with 1-3 distinct enchantments (10,000 rolls)', () => {
    const rng = new Rng(11);
    let enchanted = 0;
    const counts = new Map<number, number>();
    for (let i = 0; i < N; i++) {
      const e = rollEnchants(rng, 0.3);
      if (e.length) enchanted++;
      counts.set(e.length, (counts.get(e.length) ?? 0) + 1);
      expect(new Set(e.map((x) => x.id)).size).toBe(e.length);
      for (const x of e) expect([1, 2, 3]).toContain(x.tier);
    }
    expect(Math.abs(enchanted / N - 0.3)).toBeLessThan(0.015);
    const w = BAL.enchant.countWeights;
    const tot = w[0] + w[1] + w[2];
    expect(Math.abs((counts.get(1) ?? 0) / enchanted - w[0] / tot)).toBeLessThan(0.03);
  });

  it('make an item rarer and so stronger, and Prismatic bumps rarity', () => {
    const rng = new Rng(12);
    const base = DATA.itemsById.get('hat_lawn_gnome')!;
    const plain = createItem(base, 'epic', 5, 'curbside', new Rng(1), 1);
    const ench = createItem(base, 'epic', 5, 'curbside', new Rng(1), 1, [{ id: 'golden', tier: 2 }]);
    const tier3 = createItem(base, 'epic', 5, 'curbside', new Rng(1), 1, [{ id: 'golden', tier: 3 }]);
    expect(itemOddsOneIn(ench)).toBeGreaterThan(itemOddsOneIn(plain));
    expect(ench.power).toBeGreaterThan(plain.power);
    // A higher enchantment tier is rarer still.
    expect(tier3.power).toBeGreaterThan(ench.power);
    // Roll instantly (no wheel) until a Prismatic shows up on a forced Decent.
    const st = rollingState();
    st.upgrades.luck = 3;
    st.upgrades.enchant = upgradeDef('enchant')!.max;
    let bumped = false;
    for (let i = 0; i < 20_000 && !bumped; i++) {
      st.dumpster.forcedRarity = 'decent';
      const item = performRoll(st, rng, T0, []);
      if (item.enchants.some((x) => x.id === 'prismatic')) bumped = item.rarity !== 'decent';
    }
    expect(bumped).toBe(true);
  });

  it('equipped enchantments drive combat effects', () => {
    const st = rollingState();
    st.equipped.weapon = makeItem({ slot: 'weapon', enchants: [{ id: 'flaming', tier: 1 }, { id: 'thundering', tier: 3 }] });
    st.equipped.ring = makeItem({ slot: 'ring', enchants: [{ id: 'echoing', tier: 2 }, { id: 'golden', tier: 1 }] });
    const fx = combatEffects(st);
    expect(fx.burn).toBeCloseTo(0.2);
    expect(fx.chain).toBeCloseTo(0.35);
    expect(fx.echo).toBeCloseTo(0.18);
    expect(fx.goldPct).toBe(10);
  });

  it('burn, chain and explosion show up in a real fight', () => {
    const rng = new Rng(13);
    const st = rollingState();
    st.equipped.weapon = makeItem({
      slot: 'weapon', power: 1e9,
      enchants: [{ id: 'flaming', tier: 3 }, { id: 'thundering', tier: 3 }, { id: 'explosive', tier: 3 }],
    });
    const { events } = runTicks(st, 900, rng);
    expect(events.some((e) => e.type === 'burn')).toBe(true);
    expect(events.some((e) => e.type === 'chain')).toBe(true);
    expect(events.some((e) => e.type === 'explode')).toBe(true);
  });

  it('thorns reflect damage to attackers', () => {
    const rng = new Rng(14);
    const st = rollingState();
    st.equipped.jacket = makeItem({ slot: 'jacket', power: 1e9, enchants: [{ id: 'thorny', tier: 3 }] });
    const { events } = runTicks(st, 300, rng);
    const thorns = events.find((e) => e.type === 'thorns');
    expect(thorns).toBeDefined();
  });
});

describe('luck boosts', () => {
  it('bosses drop a luck potion that doubles luck for a while', () => {
    const rng = new Rng(15);
    let st = rollingState();
    st.player.level = 40;
    // World 1's first clear always pays a potion, and a level 40 raccoon clears it well inside the budget.
    st = act(st, { type: 'cheat', cheat: { kind: 'setStage', stage: 1 } }, rng).state;
    const { state, events } = runTicks(st, 1500, rng);
    const boost = events.find((e) => e.type === 'luckBoost');
    expect(boost).toBeDefined();
    expect(state.luckBoostEndsAt === null || state.luckBoostEndsAt > T0).toBe(true);
  });
});
