import { describe, expect, it } from 'vitest';
import {
  applyAction, canRebirth, combatEffects, createItem, currentLuck, enchantPowerMult, goldMult, inventoryCapacity,
  luckBreakdown, luckyEvery, rarityChances, rebirthRequirement, rollEnchants, rollInterval, rollRarity, Rng, tick,
  upgradeCostAt, upgradeDef, upgradeEffects, type CoreEvent, type GameState, type Item,
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
    mintPerkId: null, enchants: [], locked: false, power: 10, ...over,
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
    expect(c.mint).toBeCloseTo(1 / odds.mint);
    expect(c.mythic).toBeCloseTo((1 - 1 / odds.mint) / odds.mythic);
    expect(RARITIES.reduce((s, r) => s + c[r], 0)).toBeCloseTo(1);
  });

  for (const luck of [1, 3, 25]) {
    it(`10,000 rolls at luck ${luck} land within 1% of the computed chances`, () => {
      const rng = new Rng(500 + luck);
      const h = histogram(N, () => rollRarity(luck, rng));
      const c = rarityChances(luck);
      for (const r of RARITIES) expect(Math.abs((h.get(r) ?? 0) / N - c[r]), r).toBeLessThan(0.01);
    });
  }

  it('higher luck makes common rarities rarer and rare ones likelier', () => {
    expect(rarityChances(10).junk).toBeLessThan(rarityChances(1).junk);
    expect(rarityChances(10).epic).toBeGreaterThan(rarityChances(1).epic);
    expect(rarityChances(4).junk).toBe(0); // 4 / 4 = a guaranteed Decent or better
  });

  it('a minimum rarity floor never rolls below it (10,000 rolls)', () => {
    const rng = new Rng(4);
    const h = histogram(N, () => rollRarity(1, rng, 'epic'));
    for (const r of h.keys()) expect(['epic', 'legendary', 'mythic', 'mint']).toContain(r);
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

describe('the auto-roller', () => {
  it('the first roll is the scripted Legendary Traffic Cone, then rolls keep coming without input', () => {
    const rng = new Rng(1);
    const { events } = runTicks(clone(freshState()), 120, rng);
    const rolls = events.filter((e) => e.type === 'roll');
    expect(rolls.length).toBeGreaterThanOrEqual(Math.floor(12 / BAL.roll.baseIntervalSeconds) - 1);
    const first = rolls[0];
    expect(first.type === 'roll' && first.item.baseId).toBe('hat_traffic_cone');
    expect(first.type === 'roll' && first.item.rarity).toBe('legendary');
  });

  it('trash bags are spent as fast bonus rolls', () => {
    const rng = new Rng(2);
    const st = rollingState();
    st.currencies.bags = 8;
    const ticks = Math.ceil((8 / BAL.roll.bagRollsPerSecond) * 10) + 2;
    const { state, events } = runTicks(st, ticks, rng);
    expect(state.currencies.bags).toBe(0);
    expect(events.filter((e) => e.type === 'roll' && e.source === 'bag')).toHaveLength(8);
  });

  it('every Nth roll is a lucky roll', () => {
    const rng = new Rng(3);
    const st = rollingState();
    st.currencies.bags = 40;
    const { events } = runTicks(st, 120, rng);
    const rolls = events.filter((e) => e.type === 'roll');
    const lucky = rolls.filter((e) => e.type === 'roll' && e.lucky).length;
    expect(lucky).toBe(Math.floor(rolls.length / luckyEvery(st)));
  });

  it('auto-equips upgrades and keeps the highest-power items when the bag is full', () => {
    const rng = new Rng(4);
    const st = rollingState();
    st.currencies.bags = 300;
    const { state } = runTicks(st, 1200, rng);
    const cap = inventoryCapacity(state);
    expect(state.inventory.length).toBe(cap);
    // Sorted by power, strongest first.
    for (let i = 1; i < state.inventory.length; i++) expect(state.inventory[i - 1].power).toBeGreaterThanOrEqual(state.inventory[i].power);
    // Nothing in the bag beats the equipped item of its slot (auto-equip on).
    for (const it of state.inventory) expect(it.power).toBeLessThanOrEqual(state.equipped[it.slot]!.power);
  });

  it('scraps a new item that is weaker than everything in a full bag', () => {
    const rng = new Rng(5);
    const st = rollingState();
    st.autoEquip = false;
    st.inventory = Array.from({ length: inventoryCapacity(st) }, (_, i) => makeItem({ uid: 1000 + i, power: 1e9 }));
    st.currencies.bags = 1;
    const { state, events } = runTicks(st, 4, rng);
    expect(state.inventory.every((x) => x.power === 1e9)).toBe(true);
    expect(events.some((e) => e.type === 'roll' && e.placed === 'scrapped')).toBe(true);
    expect(state.currencies.coins).toBeGreaterThan(0);
  });

  it('locked items are never auto-scrapped', () => {
    const rng = new Rng(6);
    const st = rollingState();
    st.autoEquip = false;
    st.inventory = Array.from({ length: inventoryCapacity(st) }, (_, i) => makeItem({ uid: 2000 + i, power: 0, locked: true }));
    st.currencies.bags = 5;
    const { state } = runTicks(st, 10, rng);
    expect(state.inventory.filter((x) => x.locked)).toHaveLength(inventoryCapacity(st));
  });

  it('manual equip, scrap and lock from the bag', () => {
    const rng = new Rng(7);
    let st = rollingState();
    st.inventory = [makeItem({ uid: 77, slot: 'hat', power: 5 }), makeItem({ uid: 78, slot: 'ring', power: 6 })];
    st = act(st, { type: 'equipItem', uid: 77 }, rng).state;
    expect(st.equipped.hat?.uid).toBe(77);
    st = act(st, { type: 'toggleLock', uid: 78 }, rng).state;
    expect(act(st, { type: 'scrapItem', uid: 78 }, rng).state.inventory).toHaveLength(1);
    st = act(st, { type: 'toggleLock', uid: 78 }, rng).state;
    expect(act(st, { type: 'scrapItem', uid: 78 }, rng).state.inventory).toHaveLength(0);
  });
});

describe('upgrade grid', () => {
  it('costs grow geometrically and buying applies the effect', () => {
    const rng = new Rng(8);
    const def = upgradeDef('rollSpeed')!;
    expect(upgradeCostAt(def, 0)).toBe(def.cost.base);
    expect(upgradeCostAt(def, 3)).toBe(Math.round(def.cost.base * def.cost.growth ** 3));
    let st = rollingState();
    st.currencies.coins = 1e6;
    const before = rollInterval(st);
    for (let i = 0; i < 3; i++) st = act(st, { type: 'buyUpgrade', id: 'rollSpeed' }, rng).state;
    expect(st.upgrades.rollSpeed).toBe(3);
    expect(rollInterval(st)).toBeCloseTo(before * (1 - BAL.roll.speedPerLevel) ** 3);
    st = act(st, { type: 'buyUpgrade', id: 'bagSpace' }, rng).state;
    expect(inventoryCapacity(st)).toBe(BAL.inventory.baseCapacity + upgradeDef('bagSpace')!.perLevel);
    st = act(st, { type: 'buyUpgrade', id: 'gold' }, rng).state;
    expect(goldMult(st)).toBeCloseTo(1 + upgradeDef('gold')!.perLevel / 100);
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
  it('requires the stage and gold, then resets progress and multiplies luck and gold', () => {
    const rng = new Rng(10);
    let st = rollingState();
    const req = rebirthRequirement(0);
    expect(canRebirth(st)).toBe(false);
    st.stage.highestCleared = req.stage;
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
    expect(st.equipped.hat?.uid).toBe(5);
    expect(st.player.level).toBe(9);
    expect(currentLuck(st, T0)).toBeCloseTo(1 + BAL.rebirth.luckPer);
    expect(goldMult(st)).toBeCloseTo(1 + BAL.rebirth.goldMultPer);
    expect(rebirthRequirement(1).stage).toBeGreaterThan(req.stage);
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

  it('add power, and Prismatic bumps rarity', () => {
    const rng = new Rng(12);
    const base = DATA.itemsById.get('hat_lawn_gnome')!;
    const plain = createItem(base, 'epic', 5, 'curbside', new Rng(1), 1);
    const ench = createItem(base, 'epic', 5, 'curbside', new Rng(1), 1, [{ id: 'golden', tier: 2 }]);
    const mult = 1 + enchantPowerMult([{ id: 'golden', tier: 2 }]);
    expect(Math.abs(ench.power - plain.power * mult)).toBeLessThanOrEqual(1.5);
    expect(ench.power).toBeGreaterThan(plain.power);
    let st = rollingState();
    st.dumpster.forcedRarity = 'decent';
    st.upgrades.enchant = 0;
    // Force a Prismatic roll by rolling until one appears in a controlled loop.
    let bumped = false;
    for (let i = 0; i < 4000 && !bumped; i++) {
      st.currencies.bags = 1;
      st.dumpster.forcedRarity = 'decent';
      const r = runTicks(st, 1, rng);
      st = r.state;
      for (const e of r.events) {
        if (e.type === 'roll' && e.item.enchants.some((x) => x.id === 'prismatic')) bumped = e.item.rarity !== 'decent';
      }
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
    st.autoEquip = false;
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
    st.autoEquip = false;
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
    st = act(st, { type: 'cheat', cheat: { kind: 'setStage', stage: 5 } }, rng).state;
    const { state, events } = runTicks(st, 1500, rng);
    const boost = events.find((e) => e.type === 'luckBoost');
    expect(boost).toBeDefined();
    expect(state.luckBoostEndsAt === null || state.luckBoostEndsAt > T0).toBe(true);
  });
});
