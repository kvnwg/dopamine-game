/**
 * Rebirth: once you beat the required world and hold enough gold, start over from scratch in
 * World 1 with permanent multipliers (luck, gold, ATK/HP, cheaper upgrades). Wipes world progress,
 * gold, the upgrade tree, every item (equipped and in the bag), level/XP, and the run's Half-Eaten
 * Bread Loaves and Alley perks. Keeps the Dumpster Level, Codex, Gems and best-find record. Each
 * rebirth also unlocks more items for the dumpster (unlocks.ts).
 *
 * Past World 20 the required world goes on into the Endless Dump: a rebirth that would need World 21
 * asks for Floor 5, then 10 floors more each time (the gold price stops growing per rebirth there; the
 * deeper floors grow it instead). Become a Legend (legend.ts) is the bigger reset after it.
 */
import { BAL } from '../../data';
import { emptyEquipment, type GameState } from '../state';
import type { CoreEvent } from '../types';
import { startStage } from './combat';
import { lastWorld } from './floors';
import { canLegend, legendFx, legendGain } from './legend';
import { perksOpen, resetPerks } from './perks';
import { growth } from './stages';
import { unlocksAt } from './unlocks';

/** World to beat (past World 20: a Dump floor's world number) and gold to hold for the next rebirth. */
export function rebirthRequirement(rebirths: number): { world: number; gold: number } {
  const r = BAL.rebirth;
  const e = BAL.endless;
  const last = lastWorld();
  const raw = r.baseWorld + r.worldPer * rebirths;
  const world = raw <= last ? raw : last + (raw - last) * e.floorsPerRebirthWorld;
  const perRebirth = Math.pow(r.goldPerRebirth, Math.min(rebirths, e.goldRebirthsCap));
  return { world, gold: Math.round(r.goldBase * growth(BAL.worlds.goldGrowth, world) * perRebirth) };
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

/** What every rebirth (and a Legend) wipes: the run. Reel Memory keeps the Extra Reels. */
function wipeRun(d: GameState): void {
  const keep = legendFx(d).keepReels ? (d.upgrades.extraReel ?? 0) : 0;
  d.currencies.coins = 0;
  // (Extra Reel hangs off Luck I on the map: kept reels keep that one tier too.)
  d.upgrades = keep > 0 ? { luck: 1, extraReel: keep } : {};
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
  d.stage.losses = 0;
  d.offline.buckets = [];
  d.offline.trackingSince = null;
  // The Dump starts over too (its records and deepest floor ever stay).
  d.dump.mode = 'endless';
  d.dump.floor = 1;
  d.dump.stuckMs = 0;
  // The run's loaves and perks go with it: the next run builds its own.
  resetPerks(d);
  // A tutorial still waiting for beginner's luck to go on ends here (the bag it was in is gone).
  if (d.dumpster.beginner.state !== 'done') d.dumpster.beginner = { state: 'done', uid: null };
}

/** A new run starts: Head Start's levels and gear bonus, Loaf Stash's loaves. */
function startRun(d: GameState): void {
  const fx = legendFx(d);
  if (fx.startLevels > 0) d.player.level = Math.min(BAL.player.levelCap, 1 + fx.startLevels);
  if (fx.startWorlds > 0) d.stage.highestCleared = Math.min(lastWorld(), fx.startWorlds);
  if (fx.startLoaves > 0 && perksOpen(d)) {
    d.perks.bread += fx.startLoaves;
    d.perks.earned += fx.startLoaves;
  }
}

export function doRebirth(d: GameState, ev: CoreEvent[]): boolean {
  if (!canRebirth(d)) return false;
  d.rebirths += 1;
  wipeRun(d);
  startRun(d);
  ev.push({ type: 'rebirth', count: d.rebirths, unlocked: unlocksAt(d.rebirths).map((i) => i.id) });
  startStage(d, 1, ev, true);
  return true;
}

/**
 * Become a Legend: the run's Legend Stars are paid, then it all starts over, rebirths included. Kept:
 * stars and their upgrades, gems, the Codex, the Dumpster Level, unlocked items and rarity tiers, the
 * Dump's records, Heists and Perks (they stay open), the day's tasks.
 */
export function doLegend(d: GameState, ev: CoreEvent[]): boolean {
  if (!canLegend(d)) return false;
  const gain = legendGain(d);
  const L = d.legend;
  L.count += 1;
  L.stars += gain.total;
  L.earned += gain.total;
  L.runDeepest = 0;
  L.runFloorStars = 0;
  d.rebirths = 0;
  wipeRun(d);
  startRun(d);
  ev.push({ type: 'legend', count: L.count, stars: gain.total });
  startStage(d, 1, ev, true);
  return true;
}
