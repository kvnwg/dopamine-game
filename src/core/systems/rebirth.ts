/**
 * Rebirth: once you beat the required world and hold enough gold, start over from scratch in
 * World 1 with permanent multipliers (luck, gold, ATK/HP, cheaper upgrades). Wipes world progress,
 * gold, the upgrade tree, every item (equipped and in the bag), and level/XP. Keeps the Dumpster
 * Level, Codex, Gems and best-find record. Each rebirth also unlocks more items for the dumpster
 * (unlocks.ts).
 */
import { BAL } from '../../data';
import { emptyEquipment, type GameState } from '../state';
import type { CoreEvent } from '../types';
import { startStage } from './combat';
import { growth, worldCount } from './stages';
import { unlocksAt } from './unlocks';

/** World to beat and gold to hold for the next rebirth. Gold follows the world's gold growth. */
export function rebirthRequirement(rebirths: number): { world: number; gold: number } {
  const r = BAL.rebirth;
  const world = Math.min(worldCount(), r.baseWorld + r.worldPer * rebirths);
  return { world, gold: Math.round(r.goldBase * growth(BAL.worlds.goldGrowth, world) * Math.pow(r.goldPerRebirth, rebirths)) };
}

export function canRebirth(state: GameState): boolean {
  if (state.heist?.run) return false;
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
  d.equipped = emptyEquipment();
  d.inventory = [];
  d.player.level = 1;
  d.player.xp = 0;
  d.luckBoostEndsAt = null;
  d.roll.current = null;
  d.roll.timer = 0;
  d.stage.highestCleared = 0;
  d.stage.mode = 'push';
  d.stage.returnTo = 1;
  d.stage.powerAtDeath = null;
  d.stage.showToughHint = false;
  d.offline.buckets = [];
  d.offline.trackingSince = null;
  ev.push({ type: 'rebirth', count: d.rebirths, unlocked: unlocksAt(d.rebirths).map((i) => i.id) });
  startStage(d, 1, ev, true);
  return true;
}
