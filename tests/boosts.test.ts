import { describe, expect, it } from 'vitest';
import {
  applyAction, boostBlocked, boostGems, boostUsesLeft, canPolish, crateOdds, currentLuck, encoreOffer, GameStateSchema, luckBreakdown,
  MS_PER_HOUR, MS_PER_MINUTE, performSpin, quickDiveRolls, reelCount, rebirthRequirement, Rng, spinCycle, tick, topUpGold, upgradeDef, upgradePrice,
  type BoostId, type CoreEvent, type GameState, type Item,
} from '../src/core';
import { BAL } from '../src/data';
import { freshState, T0 } from './helpers';

const B = BAL.boosts;
const clone = (s: GameState) => structuredClone(s) as GameState;

/** A raccoon past the tutorial with Boosts open, rolling, with Gems to spend. */
function ready(gems = 10_000): GameState {
  const st = clone(freshState());
  st.dumpster.beginner = { state: 'done', uid: null };
  st.dumpster.firstDiveDone = true;
  st.playTimeMs = B.unlockMinutes * 60_000;
  st.features.unlocked.push('boosts');
  st.features.seen.push('boosts');
  st.currencies.gems = gems;
  return st;
}

function take(st: GameState, id: BoostId, via: 'ad' | 'gems', now = T0, seed = 1) {
  return applyAction(st, { type: 'boost', id, via }, new Rng(seed), now);
}

describe('boosts open after the tutorial and a few minutes of play', () => {
  it('not before BAL.boosts.unlockMinutes of play, and not during the tutorial; a boost before then does nothing', () => {
    const st = clone(freshState());
    st.dumpster.beginner = { state: 'done', uid: null };
    st.playTimeMs = B.unlockMinutes * 60_000 - 1000;
    let r = tick(st, { ticks: 1 }, new Rng(1), T0);
    expect(r.state.features.unlocked).not.toContain('boosts');
    expect(take(r.state, 'bonusCrate', 'ad').events.some((e) => e.type === 'boostUsed')).toBe(false);
    const later = clone(r.state);
    later.playTimeMs = B.unlockMinutes * 60_000;
    r = tick(later, { ticks: 1 }, new Rng(1), T0);
    expect(r.events).toContainEqual({ type: 'featureUnlocked', feature: 'boosts' });
    // Still in the tutorial: they wait.
    const early = clone(freshState());
    early.playTimeMs = 10 * 60_000;
    expect(tick(early, { ticks: 1 }, new Rng(1), T0).state.features.unlocked).not.toContain('boosts');
  });

  it('a save from before Boosts loads with none taken', () => {
    const raw = clone(ready()) as unknown as Record<string, unknown>;
    delete raw.boosts;
    const parsed = GameStateSchema.parse(raw);
    expect(parsed.boosts).toEqual({
      day: '', used: {}, brewEndsAt: null, reelEndsAt: null, crateAt: 0, blessReady: false, blessEndsAt: null, rageOffer: null, rageWorld: null, encore: null,
    });
    // A save from the first Boosts (four of them) keeps its counts and gets the rest empty.
    const first = clone(ready()) as unknown as { boosts: Record<string, unknown> };
    first.boosts = { day: '2026-01-05', used: { quickDive: 2 }, brewEndsAt: null, reelEndsAt: null, crateAt: 0 };
    expect(GameStateSchema.parse(first).boosts.used).toEqual({ quickDive: 2 });
  });
});

describe('daily limits and Gem prices', () => {
  it('each boost can be taken perDay times a day, by ad or Gems alike, and the count starts over the next day', () => {
    let st = ready();
    for (let i = 0; i < B.quickDive.perDay; i++) {
      expect(boostUsesLeft(st, 'quickDive', T0)).toBe(B.quickDive.perDay - i);
      st = take(st, 'quickDive', i % 2 ? 'gems' : 'ad', T0 + i).state;
    }
    expect(boostBlocked(st, 'quickDive', T0)).toBe('limit');
    expect(take(st, 'quickDive', 'ad', T0).events.some((e) => e.type === 'boostUsed')).toBe(false);
    const tomorrow = new Date(2026, 0, 6, 9, 0, 0).getTime();
    expect(boostUsesLeft(st, 'quickDive', tomorrow)).toBe(B.quickDive.perDay);
    expect(take(st, 'quickDive', 'ad', tomorrow).events.some((e) => e.type === 'boostUsed')).toBe(true);
  });

  it("Quick Dive's Gem price climbs with each use in a day; an ad costs nothing; without the Gems nothing happens", () => {
    let st = ready();
    const paid: number[] = [];
    for (let i = 0; i < B.quickDive.perDay; i++) {
      paid.push(boostGems(st, 'quickDive', T0));
      const before = st.currencies.gems;
      const r = take(st, 'quickDive', 'gems', T0);
      st = r.state;
      // (The rolls' new Codex entries can pay a Codex bonus meanwhile.)
      const codex = r.events.reduce((n, e) => n + (e.type === 'codexBonus' ? e.gems : 0), 0);
      expect(before - st.currencies.gems + codex).toBe(paid[i]);
      expect(r.events).toContainEqual({ type: 'boostUsed', id: 'quickDive', via: 'gems', gems: paid[i] });
    }
    expect(paid).toEqual(B.quickDive.gems.slice(0, B.quickDive.perDay));
    const ad = take(ready(), 'quickDive', 'ad', T0).state;
    expect(ad.currencies.gems).toBe(10_000);
    const poor = take(ready(B.quickDive.gems[0] - 1), 'quickDive', 'gems', T0);
    expect(poor.events.some((e) => e.type === 'boostUsed')).toBe(false);
    expect(boostUsesLeft(poor.state, 'quickDive', T0)).toBe(B.quickDive.perDay);
  });
});

describe('the four boosts', () => {
  it('Quick Dive rolls two hours of offline rolls at once and puts the rare finds in the bag', () => {
    const st = ready();
    const n = quickDiveRolls(st);
    expect(n).toBeGreaterThan(0);
    const { state, events } = take(st, 'quickDive', 'ad');
    const e = events.find((x): x is Extract<CoreEvent, { type: 'quickDive' }> => x.type === 'quickDive')!;
    expect(e.rolls).toBe(n);
    expect(state.dumpster.totalDives - st.dumpster.totalDives).toBe(n);
    expect(state.inventory.length - st.inventory.length).toBe(e.kept);
    // Before the very first find there is nothing to roll.
    const fresh = ready();
    fresh.dumpster.firstDiveDone = false;
    expect(boostBlocked(fresh, 'quickDive', T0)).toBe('nothing');
  });

  it('Potion Brew multiplies luck for its minutes, stacks with a Luck Potion, then ends on its own', () => {
    const st = ready();
    const base = currentLuck(st, T0);
    const r = take(st, 'potionBrew', 'ad');
    expect(currentLuck(r.state, T0 + 1000)).toBeCloseTo(base * B.potionBrew.mult);
    expect(luckBreakdown(r.state, T0 + 1000).brewMult).toBe(B.potionBrew.mult);
    expect(boostBlocked(r.state, 'potionBrew', T0 + 1000)).toBe('active');
    const potion = clone(r.state);
    potion.luckBoostEndsAt = T0 + 60_000;
    expect(currentLuck(potion, T0 + 1000)).toBeCloseTo(base * B.potionBrew.mult * BAL.luck.potion.mult);
    const end = T0 + B.potionBrew.minutes * MS_PER_MINUTE;
    const after = tick(r.state, { ticks: 1 }, new Rng(1), end);
    expect(after.events).toContainEqual({ type: 'boostEnded', id: 'potionBrew' });
    expect(currentLuck(after.state, end)).toBeCloseTo(base);
    expect(boostBlocked(after.state, 'potionBrew', end)).toBeNull();
  });

  it('Duct-Tape Reel adds a reel for its minutes (the next spin rolls one more), never past the maximum', () => {
    const st = ready();
    expect(reelCount(st)).toBe(1);
    let s = take(st, 'ductTapeReel', 'ad').state;
    expect(reelCount(s)).toBe(2);
    expect(boostBlocked(s, 'ductTapeReel', T0)).toBe('active');
    // The next spin rolls two reels.
    const rng = new Rng(4);
    let spun: Extract<CoreEvent, { type: 'spinStart' }> | undefined;
    for (let i = 0; i < 200 && !spun; i++) {
      const r = tick(s, { ticks: 1 }, rng, T0 + i * 100);
      s = r.state;
      spun = r.events.find((e): e is Extract<CoreEvent, { type: 'spinStart' }> => e.type === 'spinStart');
    }
    expect(spun?.reels).toHaveLength(2);
    const end = T0 + B.ductTapeReel.minutes * MS_PER_MINUTE;
    const after = tick(s, { ticks: 1 }, rng, end);
    expect(after.events).toContainEqual({ type: 'boostEnded', id: 'ductTapeReel' });
    expect(reelCount(after.state)).toBe(1);
    // Every reel already: nothing to rent.
    const full = ready();
    full.upgrades.extraReel = BAL.roll.maxReels - 1;
    expect(reelCount(full)).toBe(BAL.roll.maxReels);
    expect(boostBlocked(full, 'ductTapeReel', T0)).toBe('maxReels');
  });

  it("a reel rented before leaving that ran out meanwhile doesn't roll offline", () => {
    const st = take(ready(), 'ductTapeReel', 'ad').state;
    const away = clone(st);
    away.offline.paused = true;
    away.lastActiveAt = T0;
    const back = applyAction(away, { type: 'resume' }, new Rng(1), T0 + 2 * MS_PER_HOUR).state;
    expect(back.boosts.reelEndsAt).toBeNull();
    const plain = clone(ready());
    plain.offline.paused = true;
    plain.lastActiveAt = T0;
    const plainBack = applyAction(plain, { type: 'resume' }, new Rng(1), T0 + 2 * MS_PER_HOUR).state;
    expect(back.offline.pending?.rolls).toBe(plainBack.offline.pending?.rolls);
  });

  it('the Bonus Crate is ready at first, then every few hours; it pays bags, gold or a Luck Potion', () => {
    const st = ready();
    expect(boostBlocked(st, 'bonusCrate', T0)).toBeNull();
    const r = take(st, 'bonusCrate', 'ad');
    const e = r.events.find((x): x is Extract<CoreEvent, { type: 'crateOpened' }> => x.type === 'crateOpened')!;
    expect(['bags', 'coins', 'potion']).toContain(e.kind);
    if (e.kind === 'bags') expect(r.state.currencies.bags - st.currencies.bags).toBe(e.amount);
    if (e.kind === 'coins') expect(r.state.currencies.coins - st.currencies.coins).toBe(e.amount);
    if (e.kind === 'potion') expect(r.state.luckBoostEndsAt).toBe(T0 + e.amount * 1000);
    expect(boostBlocked(r.state, 'bonusCrate', T0 + MS_PER_HOUR)).toBe('cooldown');
    expect(boostBlocked(r.state, 'bonusCrate', T0 + B.bonusCrate.everyHours * MS_PER_HOUR)).toBeNull();
  });

  it("the crate's rewards come at the odds it shows, within 1% over 10,000 crates", () => {
    const counts: Record<string, number> = {};
    const rng = new Rng(11);
    for (let i = 0; i < 10_000; i++) {
      const st = ready();
      const ev = applyAction(st, { type: 'boost', id: 'bonusCrate', via: 'ad' }, rng, T0).events;
      const e = ev.find((x): x is Extract<CoreEvent, { type: 'crateOpened' }> => x.type === 'crateOpened')!;
      counts[e.kind] = (counts[e.kind] ?? 0) + 1;
    }
    for (const { reward, chance } of crateOdds()) expect(Math.abs((counts[reward.kind] ?? 0) / 10_000 - chance)).toBeLessThan(0.01);
  });
});

describe('the boosts that come up at a moment', () => {
  /** One whole spin of `st` (it starts and every reel lands), with its events. */
  function spin(st: GameState, seed = 7) {
    const events: CoreEvent[] = [];
    performSpin(st, new Rng(seed), T0, events);
    return events;
  }

  it('Encore: a spin with a chain of x25 or more is on offer for a few minutes; taking it lands the same tokens again next spin', () => {
    const st = ready();
    st.currencies.bags = 0;
    st.upgrades.extraReel = 1;
    st.dumpster.forcedReelTokens = [[5, 10], [2]];
    spin(st);
    const offer = encoreOffer(st, T0 + 1000)!;
    expect(offer.mult).toBeGreaterThanOrEqual(B.encore.minMult);
    expect(offer.tokens).toEqual([[5, 10], [2]]);
    expect(encoreOffer(st, T0 + B.encore.minutes * MS_PER_MINUTE)).toBeNull();
    const taken = take(st, 'encore', 'ad', T0 + 1000).state;
    expect(taken.boosts.encore).toBeNull();
    const again = clone(taken);
    const events = spin(again, 9);
    const start = events.find((e): e is Extract<CoreEvent, { type: 'spinStart' }> => e.type === 'spinStart')!;
    expect(start.reels.map((r) => r.mults)).toEqual([[5, 10], [2]]);
    // A small chain isn't on offer.
    const small = ready();
    small.currencies.bags = 0;
    small.dumpster.forcedReelTokens = [[2, 3]];
    spin(small);
    expect(encoreOffer(small, T0 + 1000)).toBeNull();
  });

  it('Boss Rage: offered after two losses in a row at a world; it brings him back there, his hits do +50% until the next win or loss there', () => {
    const rng = new Rng(4);
    let st = ready();
    st = applyAction(st, { type: 'travel', world: 10 }, rng, T0).state;
    let s = clone(st);
    for (let i = 0; i < 120 && s.stage.losses < B.bossRage.afterLosses; i++) s = tick(s, { ticks: 10 }, rng, T0 + i * 1000).state;
    expect(s.boosts.rageOffer).toBe(10);
    expect(boostBlocked(s, 'bossRage', T0)).toBeNull();
    // Back in World 1 (as if he'd fallen back): Rage takes him to World 10.
    const away = clone(s);
    away.battle.stage = 1;
    const raged = take(away, 'bossRage', 'ad', T0);
    expect(raged.state.boosts.rageWorld).toBe(10);
    expect(raged.state.boosts.rageOffer).toBeNull();
    expect(raged.state.battle.stage).toBe(10);
    expect(boostBlocked(raged.state, 'bossRage', T0)).toBe('active');
    // The same first swing, with and without Rage.
    const hit = (state: GameState) => {
      let x = clone(state);
      for (let i = 0; i < 200; i++) {
        const r = tick(x, { ticks: 1 }, new Rng(5), T0);
        x = r.state;
        const h = r.events.find((e): e is Extract<CoreEvent, { type: 'playerHit' }> => e.type === 'playerHit');
        if (h) return h.amount;
      }
      return 0;
    };
    const plain = clone(raged.state);
    plain.boosts.rageWorld = null;
    expect(hit(raged.state) / hit(plain)).toBeCloseTo(B.bossRage.atkMult, 5);
    // His next loss there uses it up.
    let r2 = clone(raged.state);
    for (let i = 0; i < 120 && r2.boosts.rageWorld !== null; i++) r2 = tick(r2, { ticks: 10 }, rng, T0 + i * 1000).state;
    expect(r2.boosts.rageWorld).toBeNull();
  });

  it('Rebirth Blessing: taken before a rebirth, the new run spins twice as fast for its minutes', () => {
    const st = ready();
    const blessed = take(st, 'rebirthBlessing', 'gems', T0).state;
    expect(blessed.boosts.blessReady).toBe(true);
    expect(boostBlocked(blessed, 'rebirthBlessing', T0)).toBe('active');
    const can = clone(blessed);
    const req = rebirthRequirement(can.rebirths);
    can.stage.highestCleared = req.world;
    can.currencies.coins = req.gold;
    const before = spinCycle(can);
    const r = applyAction(can, { type: 'rebirth' }, new Rng(1), T0);
    expect(r.state.rebirths).toBe(can.rebirths + 1);
    expect(r.events.some((e) => e.type === 'blessingStarted')).toBe(true);
    expect(r.state.boosts.blessReady).toBe(false);
    // (The new run has no Spin Speed upgrades: compare like with like.)
    const fresh = clone(r.state);
    fresh.boosts.blessEndsAt = null;
    expect(spinCycle(r.state)).toBeCloseTo(spinCycle(fresh) / B.rebirthBlessing.speedMult);
    expect(before).toBeGreaterThan(0);
    const end = T0 + B.rebirthBlessing.minutes * MS_PER_MINUTE;
    const after = tick(r.state, { ticks: 1 }, new Rng(1), end);
    expect(after.events).toContainEqual({ type: 'boostEnded', id: 'rebirthBlessing' });
    expect(spinCycle(after.state)).toBeCloseTo(spinCycle(fresh));
  });

  it('Polish: a Mythic-or-better item gets +1 tier on its lowest enchantment (or a new one) and more power; never its rarity', () => {
    const st = ready();
    const base: Item = clone(st).inventory[0] ?? (spin(st), st.inventory[0]);
    expect(base).toBeTruthy();
    const mythic: Item = { ...structuredClone(base), uid: 9001, rarity: 'mythic', enchants: [{ id: 'swift', tier: 1 }], power: base.power };
    const s1 = clone(st);
    s1.inventory = [mythic];
    expect(canPolish(mythic)).toBe(true);
    const r = take(s1, 'polish', 'ad', T0, 3);
    // (No target: nothing.)
    expect(r.events.some((e) => e.type === 'itemPolished')).toBe(false);
    const p = applyAction(s1, { type: 'boost', id: 'polish', via: 'ad', uid: 9001 }, new Rng(3), T0).state;
    const after = p.inventory[0];
    expect(after.rarity).toBe('mythic');
    expect(after.enchants).toEqual([{ id: 'swift', tier: 2 }]);
    expect(after.power).toBeGreaterThan(s1.inventory[0].power);
    // Every enchantment at its top tier: a new one comes, Tier I.
    const top: Item = { ...mythic, enchants: [{ id: 'swift', tier: 3 }] };
    const s2 = clone(st);
    s2.inventory = [top];
    const added = applyAction(s2, { type: 'boost', id: 'polish', via: 'ad', uid: 9001 }, new Rng(3), T0).state.inventory[0];
    expect(added.enchants).toHaveLength(2);
    expect(added.enchants[1].tier).toBe(1);
    // Below Mythic: no.
    expect(canPolish({ ...mythic, rarity: 'legendary' })).toBe(false);
  });

  it('Gold top-up: an upgrade a little out of reach gets exactly the missing gold; too far short, nothing', () => {
    const st = ready();
    const def = upgradeDef('luck')!;
    const price = upgradePrice(st, def);
    const near = clone(st);
    near.currencies.coins = price * 0.9;
    // (The current rate covers it: the bot's fallback rate in World 1 is plenty for a first upgrade.)
    const short = topUpGold(near, 'luck', T0);
    expect(short).toBe(Math.ceil(price - price * 0.9));
    const r = applyAction(near, { type: 'boost', id: 'goldTopUp', via: 'ad', upgradeId: 'luck' }, new Rng(1), T0);
    expect(r.state.currencies.coins).toBeGreaterThanOrEqual(price);
    expect(r.events).toContainEqual({ type: 'goldTopUp', gold: short });
    const far = clone(st);
    far.currencies.coins = price * 0.5;
    expect(topUpGold(far, 'luck', T0)).toBe(0);
    const enough = clone(st);
    enough.currencies.coins = price;
    expect(topUpGold(enough, 'luck', T0)).toBe(0);
    // A line already at its last tier has nothing to top up.
    const maxed = clone(st);
    maxed.upgrades.luck = upgradeDef('luck')!.max;
    maxed.currencies.coins = 0;
    expect(topUpGold(maxed, 'luck', T0)).toBe(0);
  });
});
