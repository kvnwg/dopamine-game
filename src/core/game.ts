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
import { combatTick, resolveAfterBoss, startStage } from './systems/combat';
import { checkUpgrade, speedupWithAd, speedupWithGems, startUpgrade } from './systems/dumpster';
import {
  heistAbandon, heistAdTicket, heistBoot, heistChoose, heistClaim, heistDecline, heistGo, heistLeaveShop, heistReroll, heistRevive,
  heistsOpen, heistTick, refreshTickets, startHeist,
} from './systems/heist';
import { checkFeatures, markFeatureSeen, openDumpster } from './systems/features';
import { collectOffline, onPause, onResume, snapshotForSave } from './systems/offline';
import { buyPerk } from './systems/perks';
import { addXp } from './systems/progression';
import { doRebirth } from './systems/rebirth';
import { addLuckBoost, equipFromBag, rollTick, scrapAllFromBag, scrapFromBag, toggleLock, equipBest } from './systems/roller';
import { worldCount } from './systems/stages';
import { travelTo } from './systems/worlds';
import { buyUpgrade } from './systems/upgrades';
import { clamp } from './util';

export const TICK_MS = 1000 / BAL.tickRate;
export const TICK_SECONDS = 1 / BAL.tickRate;

function run(state: GameState, rng: Rng, fn: (d: GameState, ev: CoreEvent[]) => void): StepResult<GameState> {
  const events: CoreEvent[] = [];
  const next = produce(state, (d) => {
    fn(d, events);
    // A new game opens its features one by one, as each becomes useful.
    checkFeatures(d, events);
    d.rngState = rng.state;
  });
  return { state: next, events };
}

/** Advance the simulation by `ticks` fixed ticks of 100ms each. */
export function tick(state: GameState, input: { ticks: number }, rng: Rng, now: number): StepResult<GameState> {
  return run(state, rng, (d, ev) => {
    for (let i = 0; i < input.ticks; i++) {
      d.playTimeMs += TICK_MS;
      // A heist's battle replaces the Alley's while the run is on (the reels keep rolling).
      if (d.heist.run) heistTick(d, rng, now, ev, TICK_SECONDS);
      else combatTick(d, rng, now, ev, TICK_SECONDS);
      rollTick(d, rng, now, ev, TICK_SECONDS);
    }
    checkUpgrade(d, now, ev);
    refreshTickets(d, now, ev);
    if (d.luckBoostEndsAt !== null && now >= d.luckBoostEndsAt) d.luckBoostEndsAt = null;
    d.lastActiveAt = Math.max(d.lastActiveAt, now);
  });
}

export function applyAction(state: GameState, action: GameAction, rng: Rng, now: number): StepResult<GameState> {
  return run(state, rng, (d, ev) => {
    switch (action.type) {
      case 'openDumpster':
        openDumpster(d, ev);
        break;
      case 'featureSeen':
        markFeatureSeen(d, action.feature);
        break;
      case 'equipItem':
        equipFromBag(d, action.uid, ev);
        break;
      case 'equipBest':
        equipBest(d, ev);
        break;
      case 'scrapItem':
        scrapFromBag(d, action.uid, ev);
        break;
      case 'scrapAll':
        scrapAllFromBag(d, ev);
        break;
      case 'toggleLock':
        toggleLock(d, action.uid);
        break;
      case 'buyUpgrade':
        buyUpgrade(d, action.id, ev);
        break;
      case 'buyPerk':
        buyPerk(d, action.id, ev);
        break;
      case 'rebirth':
        doRebirth(d, ev);
        break;
      case 'travel':
        travelTo(d, action.world, ev);
        break;
      case 'afterBoss':
        resolveAfterBoss(d, action.next, ev);
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
        onResume(d, now, ev, rng);
        checkUpgrade(d, now, ev);
        refreshTickets(d, now, ev);
        break;
      case 'boot':
        // Loaded from a save: restart the current stage cleanly (mid-heist, the waiting one), then pay out offline time.
        if (d.heist.run) heistBoot(d);
        else startStage(d, d.battle.stage, ev, false);
        onResume(d, now, ev, rng);
        checkUpgrade(d, now, ev);
        refreshTickets(d, now, ev);
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
      case 'setVolume':
        d.settings[action.key] = Math.max(0, Math.min(1, Number.isFinite(action.value) ? action.value : 1));
        break;
      case 'heistStart':
        if (heistsOpen(d)) startHeist(d, action.location, rng, now, ev);
        break;
      case 'heistGo':
        heistGo(d, rng, ev);
        break;
      case 'heistChoose':
        heistChoose(d, action.index, rng, ev);
        break;
      case 'heistLeaveShop':
        heistLeaveShop(d, rng);
        break;
      case 'heistReroll':
        heistReroll(d, rng);
        break;
      case 'heistRevive':
        heistRevive(d, action.via, ev);
        break;
      case 'heistDecline':
        heistDecline(d);
        break;
      case 'heistClaim':
        heistClaim(d, rng, now, ev);
        break;
      case 'heistAbandon':
        heistAbandon(d, rng, now, ev);
        break;
      case 'heistAdTicket':
        if (heistsOpen(d)) heistAdTicket(d, now, ev);
        break;
      case 'cheat':
        applyCheat(d, action.cheat, ev, now);
        break;
    }
  });
}

function applyCheat(d: GameState, cheat: Extract<GameAction, { type: 'cheat' }>['cheat'], ev: CoreEvent[], now: number): void {
  switch (cheat.kind) {
    case 'addCurrency':
      d.currencies.coins += cheat.coins ?? 0;
      d.currencies.gems += cheat.gems ?? 0;
      d.currencies.bags += cheat.bags ?? 0;
      d.perks.bread = Math.max(0, d.perks.bread + Math.round(cheat.bread ?? 0));
      break;
    case 'addXp':
      addXp(d, cheat.amount, ev);
      break;
    case 'setStage': {
      if (d.heist.run) break;
      const stage = clamp(Math.round(cheat.stage), 1, worldCount());
      d.stage.highestCleared = Math.max(0, stage - 1);
      d.stage.mode = 'push';
      d.stage.powerAtDeath = null;
      d.stage.showToughHint = false;
      startStage(d, stage, ev, true);
      break;
    }
    case 'forceTokens':
      d.dumpster.forcedTokens = cheat.mults;
      break;
    case 'forceRarity':
      d.dumpster.forcedRarity = cheat.rarity;
      break;
    case 'luckBoost':
      addLuckBoost(d, now, cheat.seconds, ev);
      break;
    case 'skipToLastWave':
      if (d.heist.run) break;
      d.battle.wave = BAL.stages.wavesPerStage - 1;
      d.battle.phase = 'walking';
      d.battle.phaseTime = BAL.combat.walkSeconds;
      d.battle.enemies = [];
      break;
    case 'setDumpsterLevel':
      d.dumpster.level = clamp(Math.round(cheat.level), 1, BAL.dumpster.maxLevel);
      d.dumpster.upgradeEndsAt = null;
      break;
    case 'heistTickets':
      d.heist.tickets = clamp(Math.round(cheat.tickets), 0, 99);
      ev.push({ type: 'heistTickets', tickets: d.heist.tickets });
      break;
  }
}
