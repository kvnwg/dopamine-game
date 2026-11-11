import { describe, expect, it } from 'vitest';
import {
  applyAction, computeDamage, computeStats, defConstant, isBossWave, itemTierFor, killRewards, rollAttack, rollExtraBags, Rng,
  scaledEnemyStats, tick, generateWave, worldCount, worldThreat, type CoreEvent, type GameState,
} from '../src/core';
import { BAL, DATA } from '../src/data';
import { freshState, histogram, T0 } from './helpers';

describe('damage formula', () => {
  it('ATK x (100 / (100 + DEF)) x crit x variance', () => {
    expect(computeDamage(100, 0, false, 150, 1)).toBeCloseTo(100);
    expect(computeDamage(100, 100, false, 150, 1)).toBeCloseTo(50);
    expect(computeDamage(100, 0, true, 150, 1)).toBeCloseTo(150);
    expect(computeDamage(100, 25, true, 200, 1.05)).toBeCloseTo(100 * 0.8 * 2 * 1.05);
  });

  it('variance stays within 0.95..1.05 and crit rate matches CRIT over 10,000 rolls', () => {
    const rng = new Rng(9);
    let crits = 0;
    for (let i = 0; i < 10_000; i++) {
      const r = rollAttack(100, 0, 20, 150, rng);
      if (r.crit) {
        crits++;
        expect(r.amount).toBeGreaterThanOrEqual(150 * 0.95 - 1e-9);
        expect(r.amount).toBeLessThanOrEqual(150 * 1.05 + 1e-9);
      } else {
        expect(r.amount).toBeGreaterThanOrEqual(95 - 1e-9);
        expect(r.amount).toBeLessThanOrEqual(105 + 1e-9);
      }
    }
    expect(Math.abs(crits / 10_000 - 0.2)).toBeLessThan(0.015);
  });
});

describe('player stats', () => {
  it('level 1 base stats match the spec table', () => {
    const s = computeStats(freshState());
    expect(s.HP).toBe(100);
    expect(s.ATK).toBe(10);
    expect(s.DEF).toBe(0);
    expect(s.ATK_SPD).toBe(1);
    expect(s.CRIT).toBe(5);
    expect(s.CRIT_DMG).toBe(150);
    expect(s.REGEN).toBe(1);
  });

  it('applies per-level growth, flat gear (grown by the raccoon\'s level), % bonuses, and caps', () => {
    const st = freshState();
    st.player.level = 11;
    st.equipped.weapon = {
      uid: 1, baseId: 'weapon_bbq_spatula', slot: 'weapon', rarity: 'junk', level: 1,
      main: [{ stat: 'ATK', mode: 'flat', value: 5 }],
      subs: [{ affixId: 'ATK_PCT', stat: 'ATK', mode: 'pct', value: 10 }, { affixId: 'CRIT', stat: 'CRIT', mode: 'flat', value: 500 }],
      bonus: [], mintPerkId: null, enchants: [], locked: false, tier: 1, power: 0,
    };
    const s = computeStats(st);
    // Worn gear's own stats grow with the raccoon's level (World 1: no world growth yet).
    const lv = 1 + BAL.items.levelScalePerLevel * 10;
    expect(s.HP).toBeCloseTo(100 + 12 * 10);
    expect(s.ATK).toBeCloseTo((10 + 15 + 5 * lv) * (1 + 0.1 * lv));
    expect(s.CRIT).toBe(BAL.player.caps.CRIT);
  });
});

describe('worlds and enemies', () => {
  it('has 20 worlds, and the fifth wave of every world is its boss', () => {
    expect(worldCount()).toBe(20);
    expect(isBossWave(3)).toBe(false);
    expect(isBossWave(4)).toBe(true);
    const rng = new Rng(3);
    for (const w of [1, 7, 20]) {
      const wave = generateWave(w, 4, rng, 1);
      expect(wave).toHaveLength(1);
      expect(wave[0].kind).toBe('boss');
      expect(wave[0].enemyId).toBe(DATA.worlds[w - 1].boss.id);
    }
  });

  it('scales enemies by growth^(world - 1); bosses get the boss multipliers', () => {
    const g = BAL.worlds.enemyGrowth;
    const rat = DATA.enemiesById.get('alley_rat')!;
    const w5 = scaledEnemyStats(rat, 5, false);
    expect(w5.hp).toBeCloseTo(rat.hp * g.hp ** 4);
    expect(w5.atk).toBeCloseTo(rat.atk * g.atk ** 4);
    expect(w5.def).toBeCloseTo(rat.def * g.def ** 4);
    const boss = DATA.enemiesById.get('officer_dale')!;
    const b3 = scaledEnemyStats(boss, 3, true);
    expect(b3.hp).toBeCloseTo(boss.hp * g.hp ** 2 * BAL.worlds.boss.hpMult);
    expect(b3.atk).toBeCloseTo(boss.atk * g.atk ** 2 * BAL.worlds.boss.atkMult);
  });

  it('waves have 3-5 enemies from the world roster (10,000 rolls)', () => {
    const rng = new Rng(1);
    const roster = new Set(DATA.worlds[2].enemies.map((f) => f.id));
    const h = histogram(10_000, () => {
      const wave = generateWave(3, 0, rng, 1);
      for (const e of wave) expect(roster.has(e.enemyId)).toBe(true);
      return wave.length;
    });
    expect([...h.keys()].sort()).toEqual([3, 4, 5]);
    for (const v of h.values()) expect(Math.abs(v / 10_000 - 1 / 3)).toBeLessThan(0.02);
  });

  it('harder worlds pay proportionally more', () => {
    const r6 = killRewards(6, 'regular', 20);
    expect(r6.coins).toBeCloseTo(BAL.drops.killCoins.base * BAL.worlds.goldGrowth ** 5 * 1.2);
    expect(r6.xp).toBeCloseTo(BAL.drops.killXp.base * BAL.worlds.xpGrowth ** 5);
    expect(killRewards(6, 'boss', 0).coins).toBeCloseTo((r6.coins / 1.2) * BAL.worlds.boss.coinMult);
    // Gold grows exactly as fast as enemy HP, so a world pays in proportion to how hard it is.
    expect(killRewards(9, 'regular', 0).coins / killRewards(8, 'regular', 0).coins).toBeCloseTo(BAL.worlds.goldGrowth);
  });

  it('the DEF constant grows with the world, so the same ATK:DEF ratio deals the same share of damage', () => {
    const g = BAL.worlds.defConstantGrowth ** 4;
    expect(defConstant(5)).toBeCloseTo(BAL.combat.defConstant * g);
    expect(computeDamage(100 * g, 50 * g, false, 150, 1, defConstant(5)) / g).toBeCloseTo(computeDamage(100, 50, false, 150, 1));
  });

  it('BAG_FIND gives a matching extra-bag chance (10,000 rolls)', () => {
    const rng = new Rng(2);
    const h = histogram(10_000, () => rollExtraBags(30, rng));
    expect(Math.abs((h.get(1) ?? 0) / 10_000 - 0.3)).toBeLessThan(0.015);
    expect(rollExtraBags(250, rng)).toBeGreaterThanOrEqual(2);
  });
});

function run(state: GameState, seconds: number, rng: Rng, now = T0) {
  let st = state;
  const events = [];
  for (let i = 0; i < seconds * 10; i++) {
    const r = tick(st, { ticks: 1 }, rng, now + i * 100);
    st = r.state;
    events.push(...r.events);
  }
  return { state: st, events };
}

describe('world progression', () => {
  it('waves keep coming and each drops Trash Bags that become bonus rolls', () => {
    const rng = new Rng(1);
    const st = freshState();
    st.player.level = 10; // nothing equips by itself, so start a little stronger
    const { state, events } = run(st, 60, rng);
    expect(events.filter((e) => e.type === 'waveClear').length).toBeGreaterThanOrEqual(4);
    const dropped = events.reduce((n, e) => n + (e.type === 'bagDrop' ? e.count : 0), 0);
    expect(dropped).toBeGreaterThanOrEqual(4);
    // Trash Bags pay for faster turbo spins.
    expect(events.filter((e) => e.type === 'roll' && e.source === 'turbo').length).toBeGreaterThanOrEqual(BAL.start.bags);
    expect(state.roll.count).toBeGreaterThan(0);
  });

  it('beating a world boss clears the world, pays Gems and a Luck Potion, and moves on', () => {
    const rng = new Rng(1);
    const st = freshState();
    st.player.level = 40;
    const { state, events } = run(st, 90, rng);
    expect(state.stage.highestCleared).toBeGreaterThanOrEqual(1);
    const first = events.find((e): e is Extract<CoreEvent, { type: 'worldFirstClear' }> => e.type === 'worldFirstClear');
    expect(first?.world).toBe(1);
    expect(first?.gems).toBe(BAL.worlds.firstClearGems + BAL.worlds.firstClearGemsPerWorld);
    expect(events.some((e) => e.type === 'luckBoost')).toBe(true);
    expect(events.some((e) => e.type === 'stageStart' && e.stage === 2 && e.push)).toBe(true);
  });

  it('a world beaten again in a later run (after a rebirth) pays its Luck Potion but no Gems', () => {
    const rng = new Rng(1);
    const st = freshState();
    st.player.level = 40;
    // A rebirth starts the worlds over, but the best world ever beaten stays (heist.bestWorld).
    st.heist.bestWorld = 3;
    const gems0 = st.currencies.gems;
    const { state, events } = run(st, 90, rng);
    const first = events.find((e): e is Extract<CoreEvent, { type: 'worldFirstClear' }> => e.type === 'worldFirstClear');
    expect(first?.world).toBe(1);
    expect(first?.gems).toBe(0);
    expect(events.some((e) => e.type === 'luckBoost')).toBe(true);
    // Only a world past the best ever pays Gems.
    const paid = events.filter((e): e is Extract<CoreEvent, { type: 'worldFirstClear' }> => e.type === 'worldFirstClear' && e.gems > 0);
    for (const e of paid) expect(e.world).toBeGreaterThan(3);
    // (Codex bonuses from the rolls meanwhile pay their own Gems.)
    const codex = events.reduce((n, e) => n + (e.type === 'codexBonus' ? e.gems : 0), 0);
    expect(state.currencies.gems - gems0).toBe(paid.reduce((n, e) => n + e.gems, 0) + codex);
  });

  it('every world is open, but a fresh raccoon in World 10 is one-shot, tries World 10 again, and after 3 losses falls back', () => {
    const rng = new Rng(4);
    let st = freshState();
    // (Past the first-run tutorial, which keeps "too tough" quiet: see the next test.)
    st.dumpster.beginner = { state: 'done', uid: null };
    expect(worldThreat(st, 10).level).toBe('oneShot');
    expect(worldThreat(st, 1).level).not.toBe('oneShot');
    st = applyAction(st, { type: 'travel', world: 10 }, rng, T0).state;
    expect(st.battle.stage).toBe(10);
    expect(st.stage.mode).toBe('push');
    const maxHp = computeStats(st).HP;
    // Second by second until the first loss is resolved.
    let state = structuredClone(st) as GameState;
    const events: CoreEvent[] = [];
    for (let i = 0; i < 30 && state.stage.losses === 0; i++) {
      const r = run(state, 1, rng, T0 + i * 1000);
      state = r.state;
      events.push(...r.events);
    }
    const hits = events.filter((e) => e.type === 'enemyHit');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].type === 'enemyHit' && hits[0].amount).toBeGreaterThanOrEqual(maxHp);
    expect(events.some((e) => e.type === 'playerDeath')).toBe(true);
    // A loss doesn't send it back a world: it tries the same world again, from its first wave...
    expect(state.stage.losses).toBe(1);
    expect(state.battle.stage).toBe(10);
    expect(state.stage.mode).toBe('push');
    expect(state.stage.showToughHint).toBe(true);
    // ...until it has lost there worlds.lossesBeforeBack times in a row; then it falls back to winning.
    let later = state;
    let deaths = 1;
    for (let i = 0; i < 120 && later.battle.stage === 10; i++) {
      const r = run(later, 1, rng, T0 + 60_000 + i * 1000);
      later = r.state;
      deaths += r.events.filter((e) => e.type === 'playerDeath').length;
    }
    expect(deaths).toBe(BAL.worlds.lossesBeforeBack);
    expect(later.battle.stage).toBeLessThan(10);
    expect(later.stage.mode).toBe('farm');
    expect(later.stage.losses).toBe(0);
    expect(state.stage.powerAtDeath).not.toBeNull();
  });

  it('a raccoon still in the first-run tutorial tries again without the "too tough" hint', () => {
    const rng = new Rng(4);
    let st = freshState();
    expect(st.dumpster.beginner.state).toBe('pending');
    st = applyAction(st, { type: 'travel', world: 10 }, rng, T0).state;
    const { state, events } = run(structuredClone(st) as GameState, 15, rng);
    expect(events.some((e) => e.type === 'playerDeath')).toBe(true);
    expect(state.stage.showToughHint).toBe(false);
  });

  it('travelling to a beaten world farms it; travelling past the frontier pushes', () => {
    const rng = new Rng(5);
    const st = freshState();
    st.stage.highestCleared = 4;
    const farm = applyAction(st, { type: 'travel', world: 3 }, rng, T0).state;
    expect(farm.battle.stage).toBe(3);
    expect(farm.stage.mode).toBe('farm');
    const push = applyAction(st, { type: 'travel', world: 7 }, rng, T0).state;
    expect(push.battle.stage).toBe(7);
    expect(push.stage.mode).toBe('push');
    expect(applyAction(st, { type: 'travel', world: 21 }, rng, T0).state.battle.stage).toBe(1);
  });

  it('items take the tier of the world they are rolled in, at most one past the best world beaten', () => {
    const st = freshState();
    st.stage.highestCleared = 2;
    st.battle.stage = 2;
    expect(itemTierFor(st)).toBe(2);
    st.battle.stage = 3;
    expect(itemTierFor(st)).toBe(3);
    st.battle.stage = 15;
    expect(itemTierFor(st)).toBe(3);
  });
});
