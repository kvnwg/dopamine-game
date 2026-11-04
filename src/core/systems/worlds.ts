/**
 * World travel and threat. Every world is open from the start; one far above the raccoon's
 * power simply one-shots it. Items rolled while fighting take the world's tier, capped at one
 * world past the best world beaten (so a suicide trip to World 20 can't farm World 20 loot).
 */
import { BAL, DATA } from '../../data';
import type { GameState } from '../state';
import type { CoreEvent } from '../types';
import { computeDamage, startStage } from './combat';
import { perkFx, type PerkFx } from './perks';
import { defConstant, growth, scaledEnemyStats, worldCount, worldDef } from './stages';
import { computeStats } from './stats';

/** Sends the raccoon to `world`. Beaten worlds are farmed in place; unbeaten ones are pushed. */
export function travelTo(d: GameState, world: number, ev: CoreEvent[]): boolean {
  const w = Math.round(world);
  if (!Number.isFinite(w)) return false;
  // The raccoon is out on a heist: the Alley waits.
  if (d.heist?.run) return false;
  // (Before the first pick he stands in World 1 without fighting: picking it starts the fight.)
  if (w < 1 || w > worldCount() || (w === d.battle.stage && d.stage.chosen)) return false;
  const s = d.stage;
  s.chosen = true;
  s.returnTo = w > d.battle.stage ? d.battle.stage : w;
  s.mode = w > s.highestCleared ? 'push' : 'farm';
  s.powerAtDeath = null;
  s.showToughHint = false;
  s.losses = 0;
  startStage(d, w, ev, s.mode === 'push');
  return true;
}

/** The tier given to items rolled right now (from the Alley's world, also while a heist is on). */
export function itemTierFor(state: Pick<GameState, 'battle' | 'stage'> & Partial<Pick<GameState, 'heist'>>): number {
  const world = state.heist?.run ? state.heist.run.main.stage : state.battle.stage;
  return Math.max(1, Math.min(world, state.stage.highestCleared + 1, worldCount()));
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
 * The Alley crew's steady damage on one enemy, in ATK per second (the pigeon, the rats, the seagull and
 * the golem; Raccoon Mafia's recruits come and go, so they don't count).
 */
export function crewAtkPerSecond(state: Pick<GameState, 'perks'>, fx: Readonly<PerkFx> = perkFx(state)): number {
  const per = (pct: number, every: number) => (every > 0 ? pct / 100 / every : 0);
  return (
    per(fx.pigeonAtkPct, fx.pigeonEvery) + per(fx.ratAtkPct, fx.ratEvery) + per(fx.gullAtkPct, fx.gullEvery)
    + per(fx.golemAtkPct * state.perks.earned, fx.golemEvery)
  );
}

/**
 * How a world matches up against the raccoon's current stats (no randomness; dodge, lifesteal and
 * regen are ignored, so it errs on the safe side). ONE-SHOT means a single regular hit is lethal.
 * Alley perks count: the crew's damage, bosses taking more, and the enemies they make tougher.
 */
export function worldThreat(state: GameState, world: number): WorldThreat {
  const stats = computeStats(state);
  const fx = perkFx(state);
  const w = worldDef(world);
  const k = defConstant(world);
  const critAvg = 1 + (Math.min(stats.CRIT, 100) / 100) * (stats.CRIT_DMG / 100 - 1);
  const crew = crewAtkPerSecond(state, fx);
  const yourDps = (def: number) => computeDamage(stats.ATK, def, false, 100, 1, k) * (critAvg * stats.ATK_SPD + crew);
  const regularAtk = 1 + fx.regularAtkPct / 100;
  let hp = 0;
  let def = 0;
  let dps = 0;
  let maxAtk = 0;
  for (const foe of w.enemies) {
    const sc = scaledEnemyStats(DATA.enemiesById.get(foe.id)!, world, false);
    hp += sc.hp;
    def += sc.def;
    dps += computeDamage(sc.atk * regularAtk, stats.DEF, false, 100, 1, k) * sc.atkSpd;
    maxAtk = Math.max(maxAtk, sc.atk * regularAtk);
  }
  const n = w.enemies.length;
  hp /= n;
  def /= n;
  dps /= n;
  const t = BAL.worlds.threat;
  const waveMargin = (stats.HP * yourDps(def)) / (t.waveSize * hp * dps);

  const bossDef = DATA.enemiesById.get(w.boss.id)!;
  const b = scaledEnemyStats(bossDef, world, true);
  b.atk *= 1 + fx.bossAtkPct / 100;
  b.hp *= 1 + fx.bossHpPct / 100;
  let bossDps = computeDamage(b.atk, stats.DEF, false, 100, 1, k) * b.atkSpd;
  const sp = bossDef.special;
  if (sp?.type === 'heavyHit') bossDps += (computeDamage(b.atk, stats.DEF, false, 100, 1, k) * sp.damageMult) / sp.everySeconds;
  if (sp?.type === 'enrage') bossDps *= 1 + (sp.belowHpPct / 100) * (sp.atkMult * sp.atkSpdMult - 1);
  const bossMargin = (stats.HP * yourDps(b.def) * fx.bossDmgMult) / (b.hp * bossDps);

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
