/** Stage and wave generation, enemy scaling, kill rewards. */
import { BAL, DATA, type EnemyDef, type EnemyKind, type Neighborhood } from '../../data';
import type { Rng } from '../rng';
import type { EnemyState } from '../state';

export function maxStage(): number {
  return DATA.neighborhoods[DATA.neighborhoods.length - 1].lastStage;
}

export function neighborhoodFor(stage: number): Neighborhood {
  const n = DATA.neighborhoods.find((x) => stage >= x.firstStage && stage <= x.lastStage);
  return n ?? DATA.neighborhoods[DATA.neighborhoods.length - 1];
}

export interface StageInfo {
  stage: number;
  neighborhood: Neighborhood;
  neighborhoodIndex: number; // 1-based
  local: number; // 1..20
  kind: EnemyKind;
  bossId: string | null;
}

export function stageInfo(stage: number): StageInfo {
  const neighborhood = neighborhoodFor(stage);
  const local = stage - neighborhood.firstStage + 1;
  const neighborhoodIndex = DATA.neighborhoods.indexOf(neighborhood) + 1;
  const mbIdx = BAL.stages.miniBossLocalStages.indexOf(local);
  if (local === BAL.stages.bossLocalStage) {
    return { stage, neighborhood, neighborhoodIndex, local, kind: 'boss', bossId: neighborhood.boss };
  }
  if (mbIdx >= 0) {
    return { stage, neighborhood, neighborhoodIndex, local, kind: 'miniboss', bossId: neighborhood.miniBosses[mbIdx] };
  }
  return { stage, neighborhood, neighborhoodIndex, local, kind: 'regular', bossId: null };
}

export function isBossStage(stage: number): boolean {
  return stageInfo(stage).kind !== 'regular';
}

/** Highest stage <= `stage` that is a regular (non-boss) stage; used as the farming stage. */
export function farmStageFor(stage: number): number {
  let s = Math.max(1, stage);
  while (s > 1 && isBossStage(s)) s--;
  return s;
}

export interface ScaledStats {
  hp: number;
  atk: number;
  def: number;
  atkSpd: number;
}

/** Enemy HP = base x 1.13^(stage-1), ATK x 1.10^(stage-1), DEF x 1.08^(stage-1), then boss multipliers. */
export function scaledEnemyStats(def: EnemyDef, stage: number): ScaledStats {
  const k = stage - 1;
  const sc = BAL.stages.scaling;
  let hp = def.hp * Math.pow(sc.hp, k);
  let atk = def.atk * Math.pow(sc.atk, k);
  const d = def.def * Math.pow(sc.def, k);
  if (def.kind === 'miniboss') {
    hp *= BAL.stages.miniBoss.hpMult;
    atk *= BAL.stages.miniBoss.atkMult;
  } else if (def.kind === 'boss') {
    hp *= BAL.stages.boss.hpMult;
    atk *= BAL.stages.boss.atkMult;
  }
  return { hp, atk, def: d, atkSpd: def.atkSpd };
}

function makeEnemy(def: EnemyDef, stage: number, uid: number): EnemyState {
  const s = scaledEnemyStats(def, stage);
  return {
    uid,
    enemyId: def.id,
    kind: def.kind,
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

/** The last wave of a mini-boss/boss stage is the boss alone; other waves have 3-5 regular enemies. */
export function generateWave(stage: number, waveIndex: number, rng: Rng, firstUid: number): EnemyState[] {
  const info = stageInfo(stage);
  const lastWave = waveIndex >= BAL.stages.wavesPerStage - 1;
  if (lastWave && info.bossId) {
    return [makeEnemy(DATA.enemiesById.get(info.bossId)!, stage, firstUid)];
  }
  const count = rng.int(BAL.stages.enemiesPerWave.min, BAL.stages.enemiesPerWave.max);
  const out: EnemyState[] = [];
  for (let i = 0; i < count; i++) {
    const def = DATA.enemiesById.get(rng.pick(info.neighborhood.enemies))!;
    out.push(makeEnemy(def, stage, firstUid + i));
  }
  return out;
}

/** Per kill: coins = 5 x 1.10^(stage-1) x (1 + COIN_FIND%), XP = 3 x 1.09^(stage-1). */
export function killRewards(stage: number, kind: EnemyKind, coinFindPct: number): { coins: number; xp: number } {
  const k = stage - 1;
  const dc = BAL.drops.killCoins;
  const dx = BAL.drops.killXp;
  const coins = dc.base * Math.pow(dc.growth, k) * (1 + coinFindPct / 100);
  let xp = dx.base * Math.pow(dx.growth, k);
  if (kind === 'miniboss') xp *= BAL.stages.miniBoss.xpMult;
  if (kind === 'boss') xp *= BAL.stages.boss.xpMult;
  return { coins, xp };
}
