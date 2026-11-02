/**
 * Headless balance simulator: plays the real core logic with a bot.
 * The bot models an active player: dives whenever it has bags, equips upgrades,
 * upgrades the dumpster when affordable, and fights bosses when ready.
 */
import {
  applyAction, bossStageAvailable, computeStats, createInitialState, isUpgrade, playerPower, Rng, tick,
  upgradeCost, TICK_MS, type CoreEvent, type GameAction, type GameState,
} from '../src/core';
import { BAL } from '../src/data';

export interface SimOptions {
  minutes: number;
  seed: number;
  /** Seconds per manual dive (tap + lid flip + decision) before auto-dive unlocks. */
  manualDiveSeconds?: number;
  /** Seconds the player takes to decide on a paused (Legendary+) auto-dive item. */
  decisionSeconds?: number;
  /** Seconds to farm after a boss loss before retrying even without new power. */
  bossRetrySeconds?: number;
  startTime?: number;
  sampleEverySeconds?: number;
}

export interface SimSample {
  minute: number;
  stage: number;
  highestCleared: number;
  level: number;
  dumpsterLevel: number;
  gearPower: number;
  hp: number;
  atk: number;
  bags: number;
  coins: number;
  dives: number;
}

export interface SimResult {
  samples: SimSample[];
  /** Minute at which each stage was first cleared. */
  clearedAt: Record<number, number>;
  deaths: number;
  bossAttempts: number;
  bossWins: number;
  final: GameState;
  rarityCounts: Record<string, number>;
}

export function simulate(opts: SimOptions): SimResult {
  const manualDive = opts.manualDiveSeconds ?? 1.6;
  const decision = opts.decisionSeconds ?? 2.5;
  const bossRetry = opts.bossRetrySeconds ?? 90;
  const sampleEvery = (opts.sampleEverySeconds ?? 60) * 1000;
  let now = opts.startTime ?? Date.UTC(2026, 0, 5, 12, 0, 0);
  let state = createInitialState(now, Rng.hashSeed(opts.seed));
  const rng = new Rng(state.rngState);
  const clearedAt: Record<number, number> = {};
  const samples: SimSample[] = [];
  const rarityCounts: Record<string, number> = {};
  let deaths = 0;
  let bossAttempts = 0;
  let bossWins = 0;
  let elapsed = 0;
  let manualCooldown = 0;
  let pendingTimer = 0;
  let lastBossLossPower: number | null = null;
  let lastBossLossAt = 0;
  let nextSample = 0;

  const onEvents = (events: CoreEvent[]) => {
    for (const e of events) {
      if (e.type === 'stageClear' && e.firstTime) clearedAt[e.stage] = elapsed / 60000;
      if (e.type === 'playerDeath') {
        deaths++;
        if (e.stage === bossStageCandidate(state)) {
          lastBossLossPower = playerPower(state);
          lastBossLossAt = elapsed;
        }
      }
      if (e.type === 'bossWin') bossWins++;
      if (e.type === 'dive') rarityCounts[e.item.rarity] = (rarityCounts[e.item.rarity] ?? 0) + 1;
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
    const dt = TICK_MS / 1000;

    if (state.autoDive.unlocked && !state.autoDive.enabled) act({ type: 'setAutoDive', enabled: true });

    if (state.pendingItem) {
      pendingTimer += dt;
      if (pendingTimer >= (state.autoDive.enabled ? decision : manualDive * 0.4)) {
        pendingTimer = 0;
        act({ type: isUpgrade(state, state.pendingItem) ? 'equipPending' : 'recyclePending' });
      }
    } else if (!state.autoDive.enabled && state.currencies.bags > 0) {
      manualCooldown -= dt;
      if (manualCooldown <= 0) {
        manualCooldown = manualDive;
        act({ type: 'dive' });
      }
    }

    if (state.dumpster.upgradeEndsAt === null && state.dumpster.level < BAL.dumpster.maxLevel
      && state.currencies.coins >= upgradeCost(state.dumpster.level)) {
      act({ type: 'startDumpsterUpgrade' });
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
        level: state.player.level,
        dumpsterLevel: state.dumpster.level,
        gearPower: gear,
        hp: Math.round(st.HP),
        atk: Math.round(st.ATK),
        bags: state.currencies.bags,
        coins: Math.floor(state.currencies.coins),
        dives: state.dumpster.totalDives,
      });
    }
  }
  return { samples, clearedAt, deaths, bossAttempts, bossWins, final: state, rarityCounts };
}

function bossStageCandidate(state: GameState): number {
  return state.stage.highestCleared + 1;
}
