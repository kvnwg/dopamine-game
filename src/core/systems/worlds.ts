/**
 * World travel and threat. Every world is open from the start; one far above the raccoon's
 * power simply one-shots it. Items rolled while fighting take the world's tier, capped at one
 * world past the best world beaten (so a suicide trip to World 20 can't farm World 20 loot).
 */
import { BAL, DATA } from '../../data';
import type { GameState } from '../state';
import type { CoreEvent } from '../types';
import { computeDamage, startStage } from './combat';
import { defConstant, growth, scaledEnemyStats, worldCount, worldDef } from './stages';
import { computeStats } from './stats';

/** Sends the raccoon to `world`. Beaten worlds are farmed in place; unbeaten ones are pushed. */
export function travelTo(d: GameState, world: number, ev: CoreEvent[]): boolean {
  const w = Math.round(world);
  if (w < 1 || w > worldCount() || w === d.battle.stage) return false;
  const s = d.stage;
  s.returnTo = w > d.battle.stage ? d.battle.stage : w;
  s.mode = w > s.highestCleared ? 'push' : 'farm';
  s.powerAtDeath = null;
  s.showToughHint = false;
  startStage(d, w, ev, s.mode === 'push');
  return true;
}

/** The tier given to items rolled right now. */
export function itemTierFor(state: Pick<GameState, 'battle' | 'stage'>): number {
  return Math.max(1, Math.min(state.battle.stage, state.stage.highestCleared + 1, worldCount()));
}

export type ThreatLevel = 'easy' | 'tough' | 'deadly' | 'oneShot';

export interface WorldThreat {
  level: ThreatLevel;
  /** (your HP x your DPS) / (their HP x their DPS), for the worse of a full wave and the boss. Under 1 you lose. */
  margin: number;
  /** The hardest regular hit in this world, after your DEF. */
  enemyHit: number;
  /** Your average hit on a regular enemy (crits included). */
  playerHit: number;
  enemyHp: number;
  bossHp: number;
  playerHp: number;
}

/**
 * How a world matches up against the raccoon's current stats (no randomness; dodge, lifesteal and
 * regen are ignored, so it errs on the safe side). ONE-SHOT means a single regular hit is lethal.
 */
export function worldThreat(state: GameState, world: number): WorldThreat {
  const stats = computeStats(state);
  const w = worldDef(world);
  const k = defConstant(world);
  const critAvg = 1 + (Math.min(stats.CRIT, 100) / 100) * (stats.CRIT_DMG / 100 - 1);
  const yourDps = (def: number) => computeDamage(stats.ATK, def, false, 100, 1, k) * critAvg * stats.ATK_SPD;
  let hp = 0;
  let def = 0;
  let dps = 0;
  let maxAtk = 0;
  for (const foe of w.enemies) {
    const sc = scaledEnemyStats(DATA.enemiesById.get(foe.id)!, world, false);
    hp += sc.hp;
    def += sc.def;
    dps += computeDamage(sc.atk, stats.DEF, false, 100, 1, k) * sc.atkSpd;
    maxAtk = Math.max(maxAtk, sc.atk);
  }
  const n = w.enemies.length;
  hp /= n;
  def /= n;
  dps /= n;
  const t = BAL.worlds.threat;
  const waveMargin = (stats.HP * yourDps(def)) / (t.waveSize * hp * dps);

  const bossDef = DATA.enemiesById.get(w.boss.id)!;
  const b = scaledEnemyStats(bossDef, world, true);
  let bossDps = computeDamage(b.atk, stats.DEF, false, 100, 1, k) * b.atkSpd;
  const sp = bossDef.special;
  if (sp?.type === 'heavyHit') bossDps += (computeDamage(b.atk, stats.DEF, false, 100, 1, k) * sp.damageMult) / sp.everySeconds;
  if (sp?.type === 'enrage') bossDps *= 1 + (sp.belowHpPct / 100) * (sp.atkMult * sp.atkSpdMult - 1);
  const bossMargin = (stats.HP * yourDps(b.def)) / (b.hp * bossDps);

  const enemyHit = computeDamage(maxAtk, stats.DEF, false, 100, 1, k);
  const margin = Math.min(waveMargin, bossMargin);
  let level: ThreatLevel = 'easy';
  if (enemyHit >= stats.HP) level = 'oneShot';
  else if (margin < 1) level = 'deadly';
  else if (margin < t.easyMargin) level = 'tough';
  return {
    level, margin, enemyHit, playerHit: computeDamage(stats.ATK, def, false, 100, 1, k) * critAvg, enemyHp: hp, bossHp: b.hp,
    playerHp: stats.HP,
  };
}

/** Reward multipliers of a world relative to World 1. */
export function worldRewards(world: number): { gold: number; xp: number; items: number } {
  return {
    gold: growth(BAL.worlds.goldGrowth, world),
    xp: growth(BAL.worlds.xpGrowth, world),
    items: growth(BAL.worlds.itemGrowth, world),
  };
}
