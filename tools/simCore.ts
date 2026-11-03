/**
 * Headless balance simulator: plays the real core logic with a bot.
 * The wheel spins on its own and the battle pushes through worlds by itself. Like an attentive
 * player, the bot drags every upgrade it finds onto the raccoon, buys the cheapest unlocked node of
 * the upgrade tree it can afford, upgrades the dumpster, rebirths as soon as it is allowed, and
 * jumps ahead to the hardest world that reads Easy. After a boss it taps Next within a second and a
 * half (when a push fails, the raccoon falls back on its own).
 */
import {
  affordableUpgrades, applyAction, canRebirth, computeStats, createInitialState, currentLuck, isUpgrade, Rng, tick, upgradeCost,
  upgradePrice, worldCount, worldThreat, TICK_MS, type CoreEvent, type GameAction, type GameState,
} from '../src/core';
import { BAL, RARITIES } from '../src/data';

export interface SimOptions {
  minutes: number;
  seed: number;
  /** Rebirth whenever allowed (default true). */
  rebirth?: boolean;
  /** Jump ahead to the hardest world that looks easy (default true). */
  jump?: boolean;
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
  /** Minute at which each world was first cleared (any rebirth). */
  clearedAt: Record<number, number>;
  rebirthAt: number[];
  deaths: number;
  jumps: number;
  bossWins: number;
  final: GameState;
  rarityCounts: Record<string, number>;
}

export function simulate(opts: SimOptions): SimResult {
  const sampleEvery = (opts.sampleEverySeconds ?? 60) * 1000;
  let now = opts.startTime ?? Date.UTC(2026, 0, 5, 12, 0, 0);
  let state = createInitialState(now, Rng.hashSeed(opts.seed));
  const rng = new Rng(state.rngState);
  // The player's first tap knocks the padlock off the dumpster.
  state = applyAction(state, { type: 'openDumpster' }, rng, now).state;
  const clearedAt: Record<number, number> = {};
  const rebirthAt: number[] = [];
  const samples: SimSample[] = [];
  const rarityCounts: Record<string, number> = Object.fromEntries(RARITIES.map((r) => [r, 0]));
  let deaths = 0;
  let jumps = 0;
  let bossWins = 0;
  let elapsed = 0;
  let nextSample = 0;
  let nextShop = 0;
  let nextJump = 0;

  let choiceAt: number | null = null;
  const onEvents = (events: CoreEvent[]) => {
    for (const e of events) {
      if (e.type === 'bossChoice') choiceAt = elapsed;
      if (e.type === 'stageClear' && clearedAt[e.stage] === undefined) clearedAt[e.stage] = elapsed / 60000;
      if (e.type === 'playerDeath') deaths++;
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
      if (opts.rebirth !== false && canRebirth(state)) act({ type: 'rebirth' });
      if (state.dumpster.upgradeEndsAt === null && state.dumpster.level < BAL.dumpster.maxLevel
        && state.currencies.coins >= upgradeCost(state.dumpster.level)) {
        act({ type: 'startDumpsterUpgrade' });
      }
      // Equip anything better than what is worn (the player drags it on).
      for (let guard = 0; guard < 10; guard++) {
        const up = state.inventory.find((it) => isUpgrade(state, it));
        if (!up) break;
        act({ type: 'equipItem', uid: up.uid });
      }
      // Buy the cheapest unlocked, affordable node of the tree, repeatedly.
      for (let guard = 0; guard < 30; guard++) {
        const options = affordableUpgrades(state);
        if (options.length === 0) break;
        options.sort((a, b) => upgradePrice(state, a) - upgradePrice(state, b));
        act({ type: 'buyUpgrade', id: options[0].id });
      }
    }

    // After a boss: a player taps Next within a second and a half (a death sends the raccoon back anyway).
    if (choiceAt !== null && state.battle.phase === 'choice' && elapsed - choiceAt >= 1500) {
      choiceAt = null;
      act({ type: 'afterBoss', next: true });
    }

    if (opts.jump !== false && elapsed >= nextJump && state.battle.phase !== 'dead') {
      nextJump = elapsed + 10_000;
      let target = 0;
      for (let w = worldCount(); w > state.battle.stage; w--) {
        if (worldThreat(state, w).level === 'easy') {
          target = w;
          break;
        }
      }
      if (target > state.battle.stage) {
        jumps++;
        act({ type: 'travel', world: target });
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
  return { samples, clearedAt, rebirthAt, deaths, jumps, bossWins, final: state, rarityCounts };
}
