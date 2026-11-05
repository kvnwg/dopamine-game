/**
 * Worlds (the battle's "stages"): wave generation, enemy scaling and kill rewards.
 * World W multiplies enemy stats, the DEF constant, gold and XP by growth^(W - 1), so harder
 * worlds hit much harder and pay proportionally more. Every world is 4 regular waves, then its boss.
 */
import { BAL, DATA, type EnemyDef, type EnemyKind, type WorldDef, type WorldFoe } from '../../data';
import type { Rng } from '../rng';
import type { EnemyState } from '../state';

export function worldCount(): number {
  return DATA.worlds.length;
}

/** A stage is a world; kept under this name for older callers. */
export function maxStage(): number {
  return worldCount();
}

export function worldDef(world: number): WorldDef {
  const i = Math.min(Math.max(1, Math.round(world)), DATA.worlds.length) - 1;
  return DATA.worlds[i];
}

/** base^(world - 1). */
export function growth(base: number, world: number): number {
  return Math.pow(base, Math.max(0, world - 1));
}

export function isBossWave(wave: number): boolean {
  return wave >= BAL.stages.wavesPerStage - 1;
}

/** The world-specific name of an enemy (falls back to its base name). */
export function foeIn(world: number, enemyId: string, kind: EnemyKind): WorldFoe | null {
  const w = worldDef(world);
  if (kind !== 'regular') return w.boss.id === enemyId ? w.boss : null;
  return w.enemies.find((f) => f.id === enemyId) ?? null;
}

export function enemyName(world: number, enemyId: string, kind: EnemyKind): string {
  return foeIn(world, enemyId, kind)?.name ?? DATA.enemiesById.get(enemyId)?.name ?? enemyId;
}

export interface ScaledStats {
  hp: number;
  atk: number;
  def: number;
  atkSpd: number;
}

/** Enemy HP/ATK/DEF = base x growth^(world - 1); a world's boss also gets the boss multipliers. */
export function scaledEnemyStats(def: EnemyDef, world: number, boss: boolean): ScaledStats {
  const g = BAL.worlds.enemyGrowth;
  let hp = def.hp * growth(g.hp, world);
  let atk = def.atk * growth(g.atk, world);
  const d = def.def * growth(g.def, world);
  if (boss) {
    hp *= BAL.worlds.boss.hpMult;
    atk *= BAL.worlds.boss.atkMult;
  }
  return { hp, atk, def: d, atkSpd: def.atkSpd };
}

/** The DEF constant of the damage formula in a world (grows with the world so DEF keeps its meaning). */
export function defConstant(world: number): number {
  return BAL.combat.defConstant * growth(BAL.worlds.defConstantGrowth, world);
}

function makeEnemy(def: EnemyDef, world: number, uid: number, boss: boolean): EnemyState {
  const s = scaledEnemyStats(def, world, boss);
  return {
    uid,
    enemyId: def.id,
    kind: boss ? 'boss' : 'regular',
    hp: s.hp,
    maxHp: s.hp,
    atk: s.atk,
    def: s.def,
    atkSpd: s.atkSpd,
    atkProgress: 0,
    specialTimer: 0,
    enraged: false,
    burnDps: 0,
    burnTime: 0,
    burnShown: 0,
  };
}

/** Waves 1-4 have 3-5 regular enemies from the world's roster; wave 5 is the world's boss alone. */
export function generateWave(world: number, waveIndex: number, rng: Rng, firstUid: number): EnemyState[] {
  const w = worldDef(world);
  if (isBossWave(waveIndex)) return [makeEnemy(DATA.enemiesById.get(w.boss.id)!, world, firstUid, true)];
  const count = rng.int(BAL.stages.enemiesPerWave.min, BAL.stages.enemiesPerWave.max);
  const out: EnemyState[] = [];
  for (let i = 0; i < count; i++) {
    const foe = rng.pick(w.enemies);
    out.push(makeEnemy(DATA.enemiesById.get(foe.id)!, world, firstUid + i, false));
  }
  return out;
}

/** Per kill: coins = 5 x goldGrowth^(world-1) x (1 + COIN_FIND%), XP = 3 x xpGrowth^(world-1); bosses pay more. */
export function killRewards(world: number, kind: EnemyKind, coinFindPct: number): { coins: number; xp: number } {
  const boss = kind !== 'regular';
  const coins =
    BAL.drops.killCoins.base * growth(BAL.worlds.goldGrowth, world) * (1 + coinFindPct / 100) * (boss ? BAL.worlds.boss.coinMult : 1);
  const xp = BAL.drops.killXp.base * growth(BAL.worlds.xpGrowth, world) * (boss ? BAL.worlds.boss.xpMult : 1);
  return { coins, xp };
}
