/**
 * Worlds (the battle's "stages"): wave generation, enemy scaling and kill rewards.
 * World W multiplies enemy stats, the DEF constant, gold and XP by growth^(W - 1), so harder
 * worlds hit much harder and pay proportionally more. Every world is 4 regular waves, then its boss.
 */
import { BAL, DATA, type EnemyDef, type EnemyKind, type WorldDef, type WorldFoe } from '../../data';
import type { Rng } from '../rng';
import type { EnemyState } from '../state';
import { effWorld, floorOf, gateNumber, hash32, isDump, isGate, isLastWave, sawtooth } from './floors';

/** The regular worlds (20). Past them, world numbers are Endless Dump floors (floors.ts). */
export function worldCount(): number {
  return DATA.worlds.length;
}

/** The regular world a Dump floor borrows its look and enemies from: a new one every gate, all 20 in turn. */
export function lookWorld(world: number): number {
  if (!isDump(world)) return Math.max(1, Math.min(DATA.worlds.length, Math.round(world)));
  const set = Math.floor((floorOf(world) - 1) / BAL.endless.gateEvery);
  // (7 and 20 share no factor: every world comes up once in 20 sets, starting with the last one.)
  return ((set * 7 + DATA.worlds.length - 1) % DATA.worlds.length) + 1;
}

/** One of a "|"-separated list in the strings, picked by `h`. */
export function pickWord(key: string, h: number): string {
  const list = (DATA.strings[key] ?? '').split('|').filter(Boolean);
  return list.length ? list[h % list.length] : '';
}

/** The gate boss of gate `gate`: a boss from the list, recolored and titled ("Officer Dale, Duke of Damp"). */
export function gateBoss(gate: number): WorldFoe {
  const ids = BAL.endless.gateBosses;
  const id = ids[hash32(gate, 3) % ids.length];
  const def = DATA.enemiesById.get(id);
  const tints = BAL.endless.tints;
  const [color, accent] = tints[(gate - 1 + tints.length) % tints.length];
  const title = pickWord('dump.titles', hash32(gate, 11));
  const fmt = DATA.strings['dump.bossTitled'] ?? '{name}, {title}';
  const name = title ? fmt.replace('{name}', def?.name ?? id).replace('{title}', title) : def?.name ?? id;
  return { id, name, color, accent };
}

const dumpDefs = new Map<number, WorldDef>();

/** A Dump floor as a world: a borrowed world's look and enemies, the Dump's name, a gate boss on gates. */
function dumpFloorDef(floor: number): WorldDef {
  const hit = dumpDefs.get(floor);
  if (hit) return hit;
  const base = DATA.worlds[lookWorld(DATA.worlds.length + floor) - 1];
  const def: WorldDef = {
    ...base,
    id: `dump_${floor}`,
    name: DATA.strings['dump.name'] ?? 'The Endless Dump',
    boss: isGate(floor) ? gateBoss(gateNumber(floor)) : base.boss,
  };
  // (Kept for the floors near the one being fought; a long session never piles them up.)
  if (dumpDefs.size > 64) dumpDefs.clear();
  dumpDefs.set(floor, def);
  return def;
}

/** A stage is a world; kept under this name for older callers. */
export function maxStage(): number {
  return worldCount();
}

export function worldDef(world: number): WorldDef {
  if (isDump(world)) return dumpFloorDef(floorOf(world));
  const i = Math.min(Math.max(1, Math.round(world)), DATA.worlds.length) - 1;
  return DATA.worlds[i];
}

/** base^(world - 1), a Dump floor counting as a share of a world (floors.ts effWorld). */
export function growth(base: number, world: number): number {
  return Math.pow(base, Math.max(0, effWorld(world) - 1));
}

/** The boss's wave: a world's last, a gate floor's last (other floors have no boss). */
export function isBossWave(wave: number, world = 1): boolean {
  if (isDump(world)) return isGate(floorOf(world)) && isLastWave(wave, world);
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
  if (isDump(world)) {
    // The Dump's teeth: easy floors after a gate, a squeeze before the next.
    const saw = sawtooth(floorOf(world));
    hp *= saw;
    atk *= saw;
  }
  if (boss) {
    const m = isDump(world) ? BAL.endless.gate : BAL.worlds.boss;
    hp *= m.hpMult;
    atk *= m.atkMult;
  }
  return { hp, atk, def: d, atkSpd: def.atkSpd };
}

/** The DEF constant of the damage formula in a world (grows with the world so DEF keeps its meaning). */
export function defConstant(world: number): number {
  return BAL.combat.defConstant * growth(BAL.worlds.defConstantGrowth, world);
}

export function makeEnemy(def: EnemyDef, world: number, uid: number, boss: boolean): EnemyState {
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
    moves: [],
    tele: 0,
    moveTimer: 0,
    shieldLeft: 0,
    shields: 0,
    moveEnraged: false,
    giant: false,
  };
}

/** Waves 1-4 have 3-5 regular enemies from the world's roster; wave 5 is the world's boss alone. */
export function generateWave(world: number, waveIndex: number, rng: Rng, firstUid: number): EnemyState[] {
  const w = worldDef(world);
  if (isBossWave(waveIndex, world)) return [makeEnemy(DATA.enemiesById.get(w.boss.id)!, world, firstUid, true)];
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
