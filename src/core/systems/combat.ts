/**
 * Fixed-tick battle simulation (10 ticks per second). Shared by the Alley and,
 * later, Heists / Junkyard. Emits events that the renderer turns into animation.
 * Enchantments add burn, chain lightning, echo strikes, explosions and thorns.
 * The battle runs in a world (battle.stage): 4 regular waves, then the world's boss.
 */
import { BAL, DATA } from '../../data';
import type { Rng } from '../rng';
import type { EnemyState, GameState } from '../state';
import type { CoreEvent, Stats } from '../types';
import { combatEffects, type CombatEffects } from './enchants';
import { addXp } from './progression';
import { recordRewards } from './offline';
import { addLuckBoost, goldMult } from './roller';
import { defConstant, generateWave, isBossWave, killRewards, worldCount } from './stages';
import { computeStats, playerPower } from './stats';

/**
 * damage = ATK x (K / (K + DEF)) x (crit ? CRIT_DMG/100 : 1) x variance, where K is the DEF constant
 * (100 in world 1; it grows with the world so DEF matters the same everywhere).
 */
export function computeDamage(
  atk: number, targetDef: number, isCrit: boolean, critDmgPct: number, variance: number, k: number = BAL.combat.defConstant,
): number {
  const dmg = atk * (k / (k + Math.max(0, targetDef))) * (isCrit ? critDmgPct / 100 : 1) * variance;
  return Math.max(BAL.combat.minDamage, dmg);
}

export function rollVariance(rng: Rng): number {
  return rng.float(BAL.combat.damageVariance.min, BAL.combat.damageVariance.max);
}

export function rollAttack(atk: number, targetDef: number, critPct: number, critDmgPct: number, rng: Rng, k: number = BAL.combat.defConstant) {
  const crit = rng.chance(critPct / 100);
  return { amount: computeDamage(atk, targetDef, crit, critDmgPct, rollVariance(rng), k), crit };
}

/** Extra bags from BAG_FIND: each full 100% is a guaranteed extra bag, the remainder is a chance. */
export function rollExtraBags(bagFindPct: number, rng: Rng): number {
  const whole = Math.floor(bagFindPct / 100);
  const frac = bagFindPct / 100 - whole;
  return whole + (frac > 0 && rng.chance(frac) ? 1 : 0);
}

/** Resets the battle to the start of `stage` with full HP. */
export function startStage(d: GameState, stage: number, ev: CoreEvent[], push: boolean): void {
  const stats = computeStats(d);
  d.stage.current = stage;
  d.battle.stage = stage;
  d.battle.wave = 0;
  d.battle.phase = 'walking';
  d.battle.phaseTime = BAL.combat.walkSeconds;
  d.battle.playerHp = stats.HP;
  d.battle.playerAtkProgress = 0;
  d.battle.enemies = [];
  ev.push({ type: 'stageStart', stage, push });
}

/** The first unbeaten world, when the raccoon is somewhere else and could go try it. */
export function nextWorldAvailable(state: GameState): number | null {
  const next = state.stage.highestCleared + 1;
  if (next > worldCount()) return null;
  return state.battle.stage === next ? null : next;
}

interface Ctx {
  d: GameState;
  rng: Rng;
  now: number;
  ev: CoreEvent[];
  stats: Stats;
  fx: CombatEffects;
}

function onKill(c: Ctx, e: EnemyState) {
  const { d, ev, now } = c;
  const stage = d.battle.stage;
  const r = killRewards(stage, e.kind, c.stats.COIN_FIND);
  const coins = r.coins * goldMult(d);
  d.currencies.coins += coins;
  d.lifetime.kills += 1;
  ev.push({ type: 'kill', enemyUid: e.uid, enemyId: e.enemyId, coins, xp: r.xp, kind: e.kind });
  if (e.kind === 'regular') recordRewards(d, now, { bags: 0, coins, xp: r.xp });
  else if (c.rng.chance(BAL.worlds.boss.potionChance)) addLuckBoost(d, now, BAL.luck.potion.seconds, ev);
  addXp(d, r.xp, ev);
}

/** Deals damage to the enemy at `index`; handles its death (and explosions). Returns true if it died. */
function damageEnemy(c: Ctx, index: number, amount: number, allowExplode = true): boolean {
  const b = c.d.battle;
  const e = b.enemies[index];
  if (!e || e.hp <= 0) return false;
  const dmg = e.kind === 'regular' ? amount : amount * (1 + c.stats.BOSS_DMG / 100);
  e.hp -= dmg;
  if (e.hp > 0) return false;
  b.enemies.splice(index, 1);
  onKill(c, e);
  if (allowExplode && c.fx.explode > 0 && b.enemies.length > 0) {
    const splash = c.stats.ATK * c.fx.explode;
    c.ev.push({ type: 'explode', fromUid: e.uid, toUid: b.enemies[0].uid, amount: splash });
    damageEnemy(c, 0, splash, false);
  }
  return true;
}

/** One swing at the front enemy, with every on-hit enchantment. */
function playerAttack(c: Ctx, echo: boolean) {
  const b = c.d.battle;
  const target = b.enemies[0];
  if (!target) return;
  const roll = rollAttack(c.stats.ATK, target.def, c.stats.CRIT, c.stats.CRIT_DMG, c.rng, defConstant(b.stage));
  const hpBefore = target.hp;
  const uid = target.uid;
  const killed = damageEnemy(c, 0, roll.amount);
  const dealt = Math.min(roll.amount, Math.max(0, hpBefore));
  c.ev.push({ type: 'playerHit', enemyUid: uid, targetUid: uid, amount: roll.amount, crit: roll.crit, killed, echo });
  if (c.stats.LIFESTEAL > 0) {
    const heal = Math.min((dealt * c.stats.LIFESTEAL) / 100, c.stats.HP - b.playerHp);
    if (heal > 0) {
      b.playerHp += heal;
      c.ev.push({ type: 'heal', amount: heal, source: 'lifesteal' });
    }
  }
  if (!killed && c.fx.burn > 0) {
    const t = b.enemies[0];
    if (t && t.uid === uid) {
      t.burnDps = Math.max(t.burnDps, c.stats.ATK * c.fx.burn);
      t.burnTime = BAL.enchant.burnSeconds;
    }
  }
  if (c.fx.chain > 0 && c.rng.chance(c.fx.chain)) {
    const idx = b.enemies.length > 0 && b.enemies[0].uid !== uid ? 0 : 1;
    const next = b.enemies[idx];
    if (next) {
      const amount = roll.amount * BAL.enchant.chainDamage;
      c.ev.push({ type: 'chain', fromUid: uid, toUid: next.uid, amount });
      damageEnemy(c, idx, amount);
    }
  }
  if (!echo && c.fx.echo > 0 && b.enemies.length > 0 && c.rng.chance(c.fx.echo)) playerAttack(c, true);
}

function enemyAttack(c: Ctx, e: EnemyState, mult: number, heavy: boolean) {
  const { d, stats, rng, ev } = c;
  if (rng.chance(stats.DODGE / 100)) {
    ev.push({ type: 'playerDodge', enemyUid: e.uid });
    return;
  }
  const amount = computeDamage(e.atk * mult, stats.DEF, false, 100, rollVariance(rng), defConstant(d.battle.stage));
  d.battle.playerHp -= amount;
  ev.push({ type: 'enemyHit', enemyUid: e.uid, amount, heavy });
  if (c.fx.thorns > 0) {
    const idx = d.battle.enemies.findIndex((x) => x.uid === e.uid);
    const reflect = amount * c.fx.thorns;
    ev.push({ type: 'thorns', enemyUid: e.uid, amount: reflect });
    if (idx >= 0) damageEnemy(c, idx, reflect);
  }
}

function tickBurns(c: Ctx, dt: number) {
  const b = c.d.battle;
  for (let i = b.enemies.length - 1; i >= 0; i--) {
    const e = b.enemies[i];
    if (e.burnTime <= 0) continue;
    const dmg = e.burnDps * dt;
    e.burnTime -= dt;
    e.burnShown += dmg;
    const uid = e.uid;
    const died = damageEnemy(c, i, dmg);
    if (died || e.burnTime <= 0 || e.burnShown >= e.burnDps * BAL.enchant.burnEventSeconds) {
      c.ev.push({ type: 'burn', enemyUid: uid, amount: e.burnShown });
      e.burnShown = 0;
    }
    if (e.burnTime <= 0) e.burnDps = 0;
  }
}

function onWaveCleared(c: Ctx) {
  const { d, rng, now, ev, stats } = c;
  const b = d.battle;
  const bossWave = isBossWave(b.wave);
  let bags: number;
  if (bossWave) {
    bags = BAL.worlds.boss.bags;
  } else {
    bags = BAL.drops.bagsPerWave + rollExtraBags(stats.BAG_FIND, rng);
    recordRewards(d, now, { bags, coins: 0, xp: 0 });
    if (rng.chance(BAL.luck.potion.waveDropChance)) addLuckBoost(d, now, BAL.luck.potion.seconds, ev);
  }
  d.currencies.bags += bags;
  d.lifetime.wavesCleared += 1;
  ev.push({ type: 'bagDrop', count: bags });
  ev.push({ type: 'waveClear', stage: b.stage, wave: b.wave });
  if (!bossWave) {
    b.wave += 1;
    b.phase = 'walking';
    b.phaseTime = BAL.combat.walkSeconds;
    b.playerHp = Math.min(stats.HP, b.playerHp + (stats.HP * BAL.combat.waveHealPct) / 100);
    return;
  }
  onWorldCleared(c);
}

/**
 * The world's boss is down. The first clear pays Gems and a Luck Potion. Pushing raccoons move on to
 * the next world; farming raccoons loop this world, and retry the frontier once they are stronger
 * than when they last died there.
 */
function onWorldCleared(c: Ctx) {
  const { d, ev, now } = c;
  const s = d.stage;
  const world = d.battle.stage;
  const firstTime = world > s.highestCleared;
  if (firstTime) {
    s.highestCleared = world;
    const gems = BAL.worlds.firstClearGems + BAL.worlds.firstClearGemsPerWorld * world;
    d.currencies.gems += gems;
    ev.push({ type: 'worldFirstClear', world, gems });
    addLuckBoost(d, now, BAL.luck.potion.seconds, ev);
  }
  d.lifetime.bossesBeaten += 1;
  ev.push({ type: 'stageClear', stage: world, firstTime });
  ev.push({ type: 'bossWin', stage: world });
  const next = world + 1;
  if (s.mode === 'push' && next <= worldCount()) {
    s.returnTo = world;
    startStage(d, next, ev, true);
    return;
  }
  const frontier = s.highestCleared + 1;
  const stronger = s.powerAtDeath !== null && playerPower(d) > s.powerAtDeath;
  if (s.mode === 'farm' && stronger && world === s.highestCleared && frontier <= worldCount()) {
    s.mode = 'push';
    s.returnTo = world;
    s.powerAtDeath = null;
    s.showToughHint = false;
    startStage(d, frontier, ev, true);
    return;
  }
  startStage(d, world, ev, false);
}

/**
 * After a death: a failed push falls back to the world it started from; a death in a world already
 * beaten steps down one world. Each further death steps down again, so the raccoon always ends up
 * somewhere it can win.
 */
function onDeathResolved(d: GameState, ev: CoreEvent[]) {
  const s = d.stage;
  const world = d.battle.stage;
  s.mode = 'farm';
  s.showToughHint = true;
  let back: number;
  if (world > s.highestCleared) {
    s.powerAtDeath = playerPower(d);
    back = Math.max(1, Math.min(s.returnTo, world - 1));
  } else {
    back = Math.max(1, world - 1);
  }
  s.returnTo = Math.max(1, back - 1);
  startStage(d, back, ev, false);
}

/** Advance the Alley battle by one fixed tick of `dt` seconds. */
export function combatTick(d: GameState, rng: Rng, now: number, ev: CoreEvent[], dt: number): void {
  const b = d.battle;
  const stats = computeStats(d);
  if (b.playerHp > stats.HP) b.playerHp = stats.HP;

  if (b.phase === 'dead') {
    b.phaseTime -= dt;
    if (b.phaseTime <= 0) onDeathResolved(d, ev);
    return;
  }

  b.playerHp = Math.min(stats.HP, b.playerHp + stats.REGEN * dt);

  if (b.phase === 'walking') {
    b.phaseTime -= dt;
    if (b.phaseTime <= 0) {
      const wave = generateWave(b.stage, b.wave, rng, b.nextEnemyUid);
      b.nextEnemyUid += wave.length;
      b.enemies = wave;
      b.phase = 'fighting';
      b.phaseTime = 0;
      ev.push({ type: 'waveStart', stage: b.stage, wave: b.wave });
      if (isBossWave(b.wave)) ev.push({ type: 'bossAttempt', stage: b.stage });
    }
    return;
  }

  const c: Ctx = { d, rng, now, ev, stats, fx: combatEffects(d) };
  tickBurns(c, dt);
  b.playerAtkProgress += stats.ATK_SPD * dt;
  while (b.playerAtkProgress >= 1 && b.enemies.length > 0) {
    b.playerAtkProgress -= 1;
    playerAttack(c, false);
  }
  if (b.enemies.length === 0) {
    b.playerAtkProgress = 0;
    onWaveCleared(c);
    return;
  }

  // Engaged enemies attack the raccoon.
  const engaged = Math.min(BAL.combat.engagedEnemies, b.enemies.length);
  for (let i = 0; i < engaged && i < b.enemies.length; i++) {
    const e = b.enemies[i];
    const special = DATA.enemiesById.get(e.enemyId)?.special;
    if (special?.type === 'heavyHit') {
      e.specialTimer += dt;
      if (e.specialTimer >= special.everySeconds) {
        e.specialTimer -= special.everySeconds;
        ev.push({ type: 'bossSpecial', enemyUid: e.uid, name: special.name });
        enemyAttack(c, e, special.damageMult, true);
      }
    } else if (special?.type === 'enrage' && !e.enraged && (e.hp / e.maxHp) * 100 < special.belowHpPct) {
      e.enraged = true;
      e.atk *= special.atkMult;
      e.atkSpd *= special.atkSpdMult;
      ev.push({ type: 'bossSpecial', enemyUid: e.uid, name: special.name });
    }
    e.atkProgress += e.atkSpd * dt;
    while (e.atkProgress >= 1 && b.playerHp > 0 && b.enemies.includes(e)) {
      e.atkProgress -= 1;
      enemyAttack(c, e, 1, false);
    }
    if (b.playerHp <= 0) {
      b.playerHp = 0;
      b.phase = 'dead';
      b.phaseTime = BAL.combat.deathSeconds;
      ev.push({ type: 'playerDeath', stage: b.stage });
      return;
    }
  }
  if (b.enemies.length === 0) {
    b.playerAtkProgress = 0;
    onWaveCleared(c);
  }
}
