/**
 * Rebirth: once you beat the required world and hold enough gold, start over from World 1 with
 * permanent luck and gold multipliers. Resets world progress, gold and the upgrade grid. Keeps
 * items, level, Dumpster Level, Codex and Gems.
 */
import { BAL } from '../../data';
import type { GameState } from '../state';
import type { CoreEvent } from '../types';
import { startStage } from './combat';
import { growth, worldCount } from './stages';

/** World to beat and gold to hold for the next rebirth. Gold follows the world's gold growth. */
export function rebirthRequirement(rebirths: number): { world: number; gold: number } {
  const r = BAL.rebirth;
  const world = Math.min(worldCount(), r.baseWorld + r.worldPer * rebirths);
  return { world, gold: Math.round(r.goldBase * growth(BAL.worlds.goldGrowth, world) * Math.pow(r.goldPerRebirth, rebirths)) };
}

export function canRebirth(state: GameState): boolean {
  const req = rebirthRequirement(state.rebirths);
  return state.stage.highestCleared >= req.world && state.currencies.coins >= req.gold;
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
