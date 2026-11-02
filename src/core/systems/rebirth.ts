/**
 * Rebirth: once you reach the required stage and gold, start over from stage 1 with permanent
 * luck and gold multipliers. Resets stage progress, gold and the upgrade grid. Keeps items,
 * level, Dumpster Level, Codex and Gems.
 */
import { BAL } from '../../data';
import type { GameState } from '../state';
import type { CoreEvent } from '../types';
import { startStage } from './combat';
import { maxStage } from './stages';

export function rebirthRequirement(rebirths: number): { stage: number; gold: number } {
  const r = BAL.rebirth;
  return {
    stage: Math.min(maxStage(), r.baseStage + r.stagePer * rebirths),
    gold: Math.round(r.goldBase * Math.pow(r.goldGrowth, rebirths)),
  };
}

export function canRebirth(state: GameState): boolean {
  const req = rebirthRequirement(state.rebirths);
  return state.stage.highestCleared >= req.stage && state.currencies.coins >= req.gold;
}

export function rebirthLuckMult(rebirths: number): number {
  return 1 + rebirths * BAL.rebirth.luckPer;
}

export function rebirthGoldMult(rebirths: number): number {
  return 1 + rebirths * BAL.rebirth.goldMultPer;
}

export function doRebirth(d: GameState, ev: CoreEvent[]): boolean {
  if (!canRebirth(d)) return false;
  d.rebirths += 1;
  d.currencies.coins = 0;
  d.upgrades = {};
  d.stage.highestCleared = 0;
  d.stage.mode = 'push';
  d.stage.powerAtDeath = null;
  d.stage.showToughHint = false;
  d.offline.buckets = [];
  d.offline.trackingSince = null;
  ev.push({ type: 'rebirth', count: d.rebirths });
  startStage(d, 1, ev, true);
  return true;
}
