/**
 * Headless balance simulator: plays the real core logic with a bot.
 * The roller runs on its own; the bot buys the cheapest upgrade it can afford, upgrades the
 * dumpster, fights bosses when ready, and rebirths as soon as it is allowed.
 */
import {
  applyAction, bossStageAvailable, canRebirth, computeStats, createInitialState, currentLuck, playerPower, Rng, tick,
  upgradeCost, upgradeCostAt, upgradeLevel, TICK_MS, type CoreEvent, type GameAction, type GameState,
} from '../src/core';
import { BAL, RARITIES } from '../src/data';

export interface SimOptions {
  minutes: number;
  seed: number;
  /** Seconds to farm after a boss loss before retrying even without new power. */
  bossRetrySeconds?: number;
  /** Rebirth whenever allowed (default true). */
  rebirth?: boolean;
  startTime?: number;
  sampleEverySeconds?: number;
}

export interface SimSample {
  minute: number;
  stage: number;
  highestCleared: number;
  bestEver: number;
  rebirths: number;
  level: number;
  dumpsterLevel: number;
  gearPower: number;
  luck: number;
  hp: number;
  atk: number;
  coins: number;
  rolls: number;
}

export interface SimResult {
  samples: SimSample[];
  /** Minute at which each stage was first cleared (any rebirth). */
  clearedAt: Record<number, number>;
  rebirthAt: number[];
  deaths: number;
  bossAttempts: number;
  bossWins: number;
  final: GameState;
  rarityCounts: Record<string, number>;
}

export function simulate(opts: SimOptions): SimResult {
  const bossRetry = opts.bossRetrySeconds ?? 90;
  const sampleEvery = (opts.sampleEverySeconds ?? 60) * 1000;
  let now = opts.startTime ?? Date.UTC(2026, 0, 5, 12, 0, 0);
  let state = createInitialState(now, Rng.hashSeed(opts.seed));
  const rng = new Rng(state.rngState);
  const clearedAt: Record<number, number> = {};
  const rebirthAt: number[] = [];
  const samples: SimSample[] = [];
  const rarityCounts: Record<string, number> = Object.fromEntries(RARITIES.map((r) => [r, 0]));
  let deaths = 0;
  let bossAttempts = 0;
  let bossWins = 0;
  let elapsed = 0;
  let lastBossLossPower: number | null = null;
  let lastBossLossAt = 0;
  let nextSample = 0;
  let nextShop = 0;

  const onEvents = (events: CoreEvent[]) => {
    for (const e of events) {
      if (e.type === 'stageClear' && clearedAt[e.stage] === undefined) clearedAt[e.stage] = elapsed / 60000;
      if (e.type === 'playerDeath') {
        deaths++;
        if (e.stage === state.stage.highestCleared + 1) {
          lastBossLossPower = playerPower(state);
          lastBossLossAt = elapsed;
        }
      }
      if (e.type === 'bossWin') bossWins++;
      if (e.type === 'roll') rarityCounts[e.item.rarity]++;
      if (e.type === 'rebirth') rebirthAt.push(elapsed / 60000);
    }
  };
  const act = (a: GameAction) => {
    const r = applyAction(state, a, rng, now);
    state = r.state;
    onEvents(r.events);
  };

  const totalMs = opts.minutes * 60000;
  while (elapsed < totalMs) {
    const r = tick(state, { ticks: 1 }, rng, now);
    state = r.state;
    onEvents(r.events);
    now += TICK_MS;
    elapsed += TICK_MS;

    if (elapsed >= nextShop) {
      nextShop = elapsed + 1000;
      if (opts.rebirth !== false && canRebirth(state)) {
        act({ type: 'rebirth' });
        lastBossLossPower = null;
      }
      if (state.dumpster.upgradeEndsAt === null && state.dumpster.level < BAL.dumpster.maxLevel
        && state.currencies.coins >= upgradeCost(state.dumpster.level)) {
        act({ type: 'startDumpsterUpgrade' });
      }
      // Buy the cheapest affordable upgrade, repeatedly.
      for (let guard = 0; guard < 20; guard++) {
        let best: { id: string; cost: number } | null = null;
        for (const def of BAL.upgrades) {
          const lvl = upgradeLevel(state, def.id);
          if (lvl >= def.max) continue;
          const cost = upgradeCostAt(def, lvl);
          if (!best || cost < best.cost) best = { id: def.id, cost };
        }
        if (!best || best.cost > state.currencies.coins) break;
        act({ type: 'buyUpgrade', id: best.id });
      }
    }

    const boss = bossStageAvailable(state);
    if (boss !== null && state.battle.phase !== 'dead') {
      const p = playerPower(state);
      if (lastBossLossPower === null || p > lastBossLossPower || elapsed - lastBossLossAt > bossRetry * 1000) {
        bossAttempts++;
        act({ type: 'fightBoss' });
      }
    }

    if (elapsed >= nextSample) {
      nextSample += sampleEvery;
      const st = computeStats(state);
      let gear = 0;
      for (const it of Object.values(state.equipped)) gear += it?.power ?? 0;
      samples.push({
        minute: Math.round(elapsed / 60000),
        stage: state.battle.stage,
        highestCleared: state.stage.highestCleared,
        bestEver: Math.max(0, ...Object.keys(clearedAt).map(Number)),
        rebirths: state.rebirths,
        level: state.player.level,
        dumpsterLevel: state.dumpster.level,
        gearPower: gear,
        luck: currentLuck(state, now),
        hp: Math.round(st.HP),
        atk: Math.round(st.ATK),
        coins: Math.floor(state.currencies.coins),
        rolls: state.roll.count,
      });
    }
  }
  return { samples, clearedAt, rebirthAt, deaths, bossAttempts, bossWins, final: state, rarityCounts };
}
