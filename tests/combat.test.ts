import { describe, expect, it } from 'vitest';
import {
  applyAction, computeDamage, computeStats, killRewards, rollAttack, rollExtraBags, Rng, scaledEnemyStats, stageInfo,
  tick, generateWave, type GameState,
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

  it('applies per-level growth, flat gear, % bonuses, and caps', () => {
    const st = freshState();
    st.player.level = 11;
    st.equipped.weapon = {
      uid: 1, baseId: 'weapon_bbq_spatula', slot: 'weapon', rarity: 'junk', level: 1,
      main: [{ stat: 'ATK', mode: 'flat', value: 5 }],
      subs: [{ affixId: 'ATK_PCT', stat: 'ATK', mode: 'pct', value: 10 }, { affixId: 'CRIT', stat: 'CRIT', mode: 'flat', value: 500 }],
      bonus: [], mintPerkId: null, power: 0,
    };
    const s = computeStats(st);
    expect(s.HP).toBeCloseTo(100 + 12 * 10);
    expect(s.ATK).toBeCloseTo((10 + 15 + 5) * 1.1);
    expect(s.CRIT).toBe(BAL.player.caps.CRIT);
  });
});

describe('stages and enemies', () => {
  it('marks stages 5/10/15 as mini-boss and 20 as boss', () => {
    expect(stageInfo(4).kind).toBe('regular');
    expect(stageInfo(5).kind).toBe('miniboss');
    expect(stageInfo(10).kind).toBe('miniboss');
    expect(stageInfo(15).kind).toBe('miniboss');
    expect(stageInfo(20).kind).toBe('boss');
    expect(stageInfo(5).bossId).toBe('big_earl');
  });

  it('scales enemy stats by 1.13 / 1.10 / 1.08 per stage, with boss multipliers', () => {
    const rat = DATA.enemiesById.get('alley_rat')!;
    const s10 = scaledEnemyStats(rat, 10);
    expect(s10.hp).toBeCloseTo(rat.hp * 1.13 ** 9);
    expect(s10.atk).toBeCloseTo(rat.atk * 1.1 ** 9);
    const boss = DATA.enemiesById.get('officer_dale')!;
    const b20 = scaledEnemyStats(boss, 20);
    expect(b20.hp).toBeCloseTo(boss.hp * 1.13 ** 19 * 10);
    expect(b20.atk).toBeCloseTo(boss.atk * 1.1 ** 19 * 2);
    expect(b20.def).toBeCloseTo(boss.def * 1.08 ** 19);
  });

  it('waves have 3-5 enemies (10,000 rolls) and the last wave of a boss stage is the boss', () => {
    const rng = new Rng(1);
    const h = histogram(10_000, () => generateWave(3, 0, rng, 1).length);
    expect([...h.keys()].sort()).toEqual([3, 4, 5]);
    for (const v of h.values()) expect(Math.abs(v / 10_000 - 1 / 3)).toBeLessThan(0.02);
    const bossWave = generateWave(20, 4, rng, 1);
    expect(bossWave).toHaveLength(1);
    expect(bossWave[0].enemyId).toBe('officer_dale');
  });

  it('kill rewards follow 5 x 1.10^(s-1) coins and 3 x 1.09^(s-1) XP', () => {
    const r = killRewards(11, 'regular', 20);
    expect(r.coins).toBeCloseTo(5 * 1.1 ** 10 * 1.2);
    expect(r.xp).toBeCloseTo(3 * 1.09 ** 10);
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

describe('alley progression', () => {
  it('auto-advances through easy stages and drops Trash Bags per wave', () => {
    const rng = new Rng(1);
    const { state, events } = run(freshState(), 60, rng);
    expect(state.stage.highestCleared).toBeGreaterThanOrEqual(1);
    expect(events.filter((e) => e.type === 'waveClear').length).toBeGreaterThanOrEqual(5);
    expect(state.currencies.bags).toBeGreaterThan(BAL.start.bags);
  });

  it('stops before a mini-boss stage and waits for Fight Boss', () => {
    const rng = new Rng(1);
    let st = freshState();
    st.player.level = 30;
    st = applyAction(st, { type: 'cheat', cheat: { kind: 'setStage', stage: 4 } }, rng, T0).state;
    st = run(st, 60, rng).state;
    expect(st.stage.highestCleared).toBe(4);
    expect(st.battle.stage).toBe(4);
    const fought = applyAction(st, { type: 'fightBoss' }, rng, T0);
    expect(fought.state.battle.stage).toBe(5);
    expect(fought.events.some((e) => e.type === 'bossAttempt')).toBe(true);
  });

  it('drops back to the last cleared stage on death and shows the hint', () => {
    const rng = new Rng(1);
    let st = freshState();
    st = applyAction(st, { type: 'cheat', cheat: { kind: 'setStage', stage: 14 } }, rng, T0).state;
    const { state, events } = run(st, 120, rng);
    expect(events.some((e) => e.type === 'playerDeath')).toBe(true);
    expect(state.stage.mode).toBe('farm');
    expect(state.battle.stage).toBe(13);
    expect(state.stage.showToughHint).toBe(true);
  });
});
