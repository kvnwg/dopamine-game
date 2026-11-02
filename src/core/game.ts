/**
 * Public, pure entry points for game logic:
 *   applyAction(state, action, rng, now) => { state, events }
 *   tick(state, { ticks }, rng, now)     => { state, events }
 * Both use immer so callers get a new immutable state; `rng` advances and its
 * state is written back to `state.rngState` for deterministic saves.
 */
import { produce } from 'immer';
import { BAL } from '../data';
import type { Rng } from './rng';
import type { GameState } from './state';
import type { CoreEvent, GameAction, StepResult } from './types';
import { MS_PER_MINUTE } from './time';
import { bossStageAvailable, canPushStage, combatTick, startStage } from './systems/combat';
import {
  autoDiveTick, checkUpgrade, dive, equipPending, recyclePending, speedupWithAd, speedupWithGems, startUpgrade,
} from './systems/dumpster';
import { collectOffline, onPause, onResume, snapshotForSave } from './systems/offline';
import { addXp } from './systems/progression';
import { maxStage } from './systems/stages';
import { clamp } from './util';

export const TICK_MS = 1000 / BAL.tickRate;
export const TICK_SECONDS = 1 / BAL.tickRate;

function run(state: GameState, rng: Rng, fn: (d: GameState, ev: CoreEvent[]) => void): StepResult<GameState> {
  const events: CoreEvent[] = [];
  const next = produce(state, (d) => {
    fn(d, events);
    d.rngState = rng.state;
  });
  return { state: next, events };
}

/** Advance the simulation by `ticks` fixed ticks of 100ms each. */
export function tick(state: GameState, input: { ticks: number }, rng: Rng, now: number): StepResult<GameState> {
  return run(state, rng, (d, ev) => {
    for (let i = 0; i < input.ticks; i++) {
      d.playTimeMs += TICK_MS;
      combatTick(d, rng, now, ev, TICK_SECONDS);
      autoDiveTick(d, rng, ev, TICK_SECONDS);
    }
    checkUpgrade(d, now, ev);
    if (!d.autoDive.unlocked && d.playTimeMs >= BAL.autoDive.unlockPlayMinutes * MS_PER_MINUTE) {
      d.autoDive.unlocked = true;
      ev.push({ type: 'autoDiveUnlocked' });
    }
    d.lastActiveAt = Math.max(d.lastActiveAt, now);
  });
}

export function applyAction(state: GameState, action: GameAction, rng: Rng, now: number): StepResult<GameState> {
  return run(state, rng, (d, ev) => {
    switch (action.type) {
      case 'dive':
        dive(d, rng, ev, false);
        break;
      case 'equipPending':
        equipPending(d, ev);
        break;
      case 'recyclePending':
        recyclePending(d, ev);
        break;
      case 'fightBoss': {
        const stage = bossStageAvailable(d);
        if (stage === null) break;
        d.stage.mode = 'push';
        startStage(d, stage, ev, true);
        ev.push({ type: 'bossAttempt', stage });
        break;
      }
      case 'pushStage': {
        if (!canPushStage(d)) break;
        d.stage.mode = 'push';
        d.stage.powerAtDeath = null;
        d.stage.showToughHint = false;
        startStage(d, d.stage.highestCleared + 1, ev, true);
        break;
      }
      case 'setAutoDive':
        if (d.autoDive.unlocked) d.autoDive.enabled = action.enabled;
        break;
      case 'setAutoDiveFilters':
        d.autoDive.keepMinRarity = action.keepMinRarity;
        d.autoDive.keepSubstats = [...action.keepSubstats];
        break;
      case 'acknowledgeAutoDiveUnlock':
        d.autoDive.unlockSeen = true;
        break;
      case 'startDumpsterUpgrade':
        startUpgrade(d, now, ev);
        break;
      case 'speedupDumpsterGems':
        speedupWithGems(d, now, ev);
        break;
      case 'speedupDumpsterAd':
        speedupWithAd(d, now, ev);
        break;
      case 'pause':
        onPause(d, now);
        break;
      case 'resume':
        onResume(d, now, ev);
        checkUpgrade(d, now, ev);
        break;
      case 'boot':
        // Loaded from a save: restart the current stage cleanly, then pay out offline time.
        startStage(d, d.battle.stage, ev, false);
        onResume(d, now, ev);
        checkUpgrade(d, now, ev);
        break;
      case 'snapshot':
        snapshotForSave(d, now);
        break;
      case 'collectOffline':
        collectOffline(d, action.doubled, ev);
        break;
      case 'setSetting':
        d.settings[action.key] = action.value;
        break;
      case 'cheat':
        applyCheat(d, action.cheat, ev);
        break;
    }
  });
}

function applyCheat(d: GameState, cheat: Extract<GameAction, { type: 'cheat' }>['cheat'], ev: CoreEvent[]): void {
  switch (cheat.kind) {
    case 'addCurrency':
      d.currencies.coins += cheat.coins ?? 0;
      d.currencies.gems += cheat.gems ?? 0;
      d.currencies.bags += cheat.bags ?? 0;
      break;
    case 'addXp':
      addXp(d, cheat.amount, ev);
      break;
    case 'setStage': {
      const stage = clamp(Math.round(cheat.stage), 1, maxStage());
      d.stage.highestCleared = Math.max(0, stage - 1);
      d.stage.mode = 'push';
      d.stage.powerAtDeath = null;
      d.stage.showToughHint = false;
      startStage(d, stage, ev, true);
      break;
    }
    case 'forceRarity':
      d.dumpster.forcedRarity = cheat.rarity;
      break;
    case 'unlockAll':
      d.autoDive.unlocked = true;
      d.dumpster.firstDiveDone = true;
      break;
    case 'skipToLastWave':
      d.battle.wave = BAL.stages.wavesPerStage - 1;
      d.battle.phase = 'walking';
      d.battle.phaseTime = BAL.combat.walkSeconds;
      d.battle.enemies = [];
      break;
    case 'setDumpsterLevel':
      d.dumpster.level = clamp(Math.round(cheat.level), 1, BAL.dumpster.maxLevel);
      d.dumpster.upgradeEndsAt = null;
      break;
  }
}
