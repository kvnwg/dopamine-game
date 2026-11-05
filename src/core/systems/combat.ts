/**
 * Fixed-tick battle simulation (10 ticks per second). Shared by the Alley and Heists (heist.ts runs
 * its fights through fightStep with a RunCombat, which adds the run's perks). Emits events that the
 * renderer turns into animation. Enchantments add burn, chain lightning, echo strikes, explosions and
 * thorns. The Alley battle runs in a world (battle.stage): 4 regular waves, then the world's boss.
 * The Alley's own perks (perks.ts, bought with Half-Eaten Bread Loaves) add the crew, the second wind,
 * the rage, harder-hit bosses and the loaves a boss pays the first time it falls in a run.
 */
import { BAL, DATA, type BossSpecial, type EnemyDef, type PerkEffectKey, type TwistId } from '../../data';
import type { Rng } from '../rng';
import type { EnemyState, GameState, HeistFight, PerkState } from '../state';
import type { CoreEvent, CrewHelper, Stats } from '../types';
import { combatEffects, type CombatEffects } from './enchants';
import { addXp } from './progression';
import { recordRewards } from './offline';
import { earnBread, NO_PERKS, perkFoes, perkFx, perksWorldStart, type PerkFx } from './perks';
import { addLuckBoost, goldMult, potionSeconds, xpMult } from './roller';
import { defConstant, generateWave, isBossWave, killRewards, makeEnemy, worldCount, worldDef } from './stages';
import { computeStats, playerPower } from './stats';
import {
  currentTwist, dumpBagMult, dumpFoes, dumpGoldMult, dumpTick, dumpXpMult, endlessOpen, enterDump, inDump, onDumpDeath, onFloorCleared,
} from './endless';
import { floorOf, isDump, isLastWave, lastWorld } from './floors';

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
  d.battle.dodge = false;
  d.battle.hatGone = 0;
  if (isDump(stage) && d.dump.mode === 'endless') d.dump.floor = floorOf(stage);
  perksWorldStart(d);
  ev.push({ type: 'stageStart', stage, push });
}

/** The first unbeaten world, when the raccoon is somewhere else and could go try it. */
export function nextWorldAvailable(state: GameState): number | null {
  // (No travel while a heist is on.)
  if (state.heist?.run) return null;
  const next = state.stage.highestCleared + 1;
  if (next > worldCount()) return null;
  return state.battle.stage === next ? null : next;
}

/** Every special of an enemy (`special`, then `specials`). */
export function enemySpecials(def: EnemyDef | undefined): BossSpecial[] {
  if (!def) return [];
  if (!def.specials) return def.special ? [def.special] : [];
  return def.special ? [def.special, ...def.specials] : def.specials;
}

/** A heist fight's extra rules (built by heist.ts): the run's perks and its own rewards. */
export interface RunCombat {
  /** Sum of every perk and curse effect the run holds (0 for anything it doesn't). */
  fx: Record<PerkEffectKey, number>;
  fight: HeistFight;
  /** Run XP and coins for a kill; returns them for the kill event. */
  onKill: (e: EnemyState) => { coins: number; xp: number };
  addCoins: (n: number) => void;
  /** Nine Lives: the HP to get back up with after a knockout (once per run), or null. */
  nineLives: () => number | null;
  /** After every hit taken (a saved snack heals under its threshold). */
  afterHurt: () => void;
  /** A regular enemy at the run's scaling (bosses summon them). */
  makeEnemy: (enemyId: string) => EnemyState;
}

export interface Ctx {
  d: GameState;
  rng: Rng;
  now: number;
  ev: CoreEvent[];
  stats: Stats;
  fx: CombatEffects;
  /** The DEF constant of the damage formula for this fight. */
  k: number;
  /** Set in heist fights. */
  run?: RunCombat;
  /** The Alley's perks (Alley fights with perks owned only). */
  perk?: Readonly<PerkFx>;
  /** The Dump floor's twist (Alley fights in the Dump only). */
  twist?: TwistId | null;
}

/** Perk burns burn at this share of ATK per second when no perk sets it. */
const PERK_BURN_ATK = 0.5;

/** More damage to a burning enemy (Dumpster Fire); 1 outside heists. */
function vsBurning(c: Ctx, e: EnemyState): number {
  return c.run && e.burnTime > 0 && c.run.fx.burningBonusPct ? 1 + c.run.fx.burningBonusPct / 100 : 1;
}

/** Sets an enemy (or, with Five-Alarm Raccoon, every enemy) on fire from a perk. */
function perkBurn(c: Ctx, target: EnemyState, seconds: number) {
  const fx = c.run!.fx;
  const dps = c.stats.ATK * (fx.burnAtk > 0 ? fx.burnAtk : PERK_BURN_ATK) * (1 + fx.burnBonusPct / 100);
  for (const e of fx.burnSpread > 0 ? c.d.battle.enemies : [target]) {
    e.burnDps = Math.max(e.burnDps, dps);
    e.burnTime = Math.max(e.burnTime, seconds);
  }
}

function onKill(c: Ctx, e: EnemyState) {
  const { d, ev, now } = c;
  if (c.run) {
    const r = c.run.onKill(e);
    ev.push({ type: 'kill', enemyUid: e.uid, enemyId: e.enemyId, coins: r.coins, xp: r.xp, kind: e.kind });
    // Grease Fire: the next enemy catches fire.
    const next = d.battle.enemies[0];
    if (next && c.run.fx.greaseFireSeconds > 0) perkBurn(c, next, c.run.fx.greaseFireSeconds);
    return;
  }
  const stage = d.battle.stage;
  const r = killRewards(stage, e.kind, c.stats.COIN_FIND);
  r.xp *= xpMult(d) * dumpXpMult(d);
  const coins = r.coins * goldMult(d) * dumpGoldMult(d);
  d.currencies.coins += coins;
  d.lifetime.kills += 1;
  ev.push({ type: 'kill', enemyUid: e.uid, enemyId: e.enemyId, coins, xp: r.xp, kind: e.kind });
  if (e.kind === 'regular') recordRewards(d, now, { bags: 0, coins, xp: r.xp });
  else if (c.rng.chance(BAL.worlds.boss.potionChance)) addLuckBoost(d, now, potionSeconds(d), ev);
  // Raccoon Mafia: a beaten regular joins the crew until the world ends.
  if (c.perk && c.perk.recruitAtkPct > 0 && e.kind === 'regular') d.perks.recruits = Math.min(c.perk.recruitMax, d.perks.recruits + 1);
  addXp(d, r.xp, ev);
}

/**
 * Deals damage to the enemy at `index`; handles its death (and explosions). Returns true if it died.
 * `direct`: a blow (not a burn), which a gate boss hiding under its lid shrugs off.
 */
function damageEnemy(c: Ctx, index: number, amount: number, allowExplode = true, direct = true): boolean {
  const b = c.d.battle;
  const e = b.enemies[index];
  if (!e || e.hp <= 0) return false;
  if (direct && e.shieldLeft > 0) return false;
  // (YOLO, an Alley perk, makes bosses take more from everything; a Giants floor's giants count as bosses.)
  const dmg = e.kind === 'regular' && !e.giant ? amount : amount * (1 + c.stats.BOSS_DMG / 100) * (c.perk?.bossDmgMult ?? 1);
  const before = e.hp;
  e.hp -= dmg;
  if (e.moves.length > 0 && e.hp > 0) bossMovesOnHit(c, e, before, direct);
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

/** A heist hit: Double or Nothing's ATK, Bullseye's sure crits, Rabid's triple damage, Dumpster Fire. */
function runRoll(c: Ctx, target: EnemyState): { amount: number; crit: boolean } {
  const run = c.run!;
  const fx = run.fx;
  run.fight.hits += 1;
  const sure = fx.critEvery > 0 && run.fight.hits % Math.max(1, Math.round(fx.critEvery)) === 0;
  const crit = sure || c.rng.chance(c.stats.CRIT / 100);
  let amount = computeDamage(c.stats.ATK * run.fight.atkMult, target.def, crit, c.stats.CRIT_DMG, rollVariance(c.rng), c.k);
  if (fx.rabidChance > 0 && c.rng.chance(fx.rabidChance)) amount *= Math.max(1, fx.rabidMult);
  return { amount: amount * vsBurning(c, target), crit };
}

/** A heist hit's riders: Jackpot Paws coins, the alley cat's finisher, Hot Sauce, Pocket Sand and Unhinged. */
function runOnHit(c: Ctx, uid: number, crit: boolean, killed: boolean) {
  const run = c.run!;
  const fx = run.fx;
  const b = c.d.battle;
  if (crit && fx.critCoins > 0) run.addCoins(fx.critCoins);
  if (killed) return;
  const t = b.enemies[0];
  if (!t || t.uid !== uid) return;
  if (fx.executePct > 0 && (t.hp / t.maxHp) * 100 < fx.executePct) {
    const amount = t.hp;
    damageEnemy(c, 0, amount);
    c.ev.push({ type: 'heistHelper', helper: 'cat', enemyUid: uid, amount, killed: true });
    return;
  }
  if (fx.burnChance > 0 && c.rng.chance(Math.min(1, fx.burnChance))) perkBurn(c, t, Math.max(1, fx.burnSeconds));
  const frenzy = fx.stunBelowHpPct > 0 && (b.playerHp / Math.max(1, c.stats.HP)) * 100 < fx.stunBelowHpPct;
  if (frenzy || (fx.stunChance > 0 && c.rng.chance(Math.min(1, fx.stunChance)))) {
    const seconds = Math.max(fx.stunSeconds, 1);
    t.stun = Math.max(t.stun ?? 0, seconds);
    c.ev.push({ type: 'heistStun', enemyUid: uid, seconds });
  }
}

/** An Alley hit: Hold My Soda (an Alley perk) multiplies it while the raccoon is low. */
function alleyRoll(c: Ctx, target: EnemyState): { amount: number; crit: boolean } {
  const roll = rollAttack(c.stats.ATK, target.def, c.stats.CRIT, c.stats.CRIT_DMG, c.rng, c.k);
  // An Armored floor: only crits get through properly.
  if (c.twist === 'armored' && !roll.crit) roll.amount *= BAL.endless.twists.armored.nonCritPct / 100;
  const fx = c.perk;
  if (fx && fx.rageMult > 1 && (c.d.battle.playerHp / Math.max(1, c.stats.HP)) * 100 < fx.rageBelowPct) roll.amount *= fx.rageMult;
  return roll;
}

/** One swing at the front enemy, with every on-hit enchantment (and, in heists, every on-hit perk). */
function playerAttack(c: Ctx, echo: boolean) {
  const b = c.d.battle;
  const target = b.enemies[0];
  if (!target) return;
  // A Slippery floor: they dodge some of his swings.
  if (c.twist === 'slippery' && c.rng.chance(BAL.endless.twists.slippery.dodgePct / 100)) {
    c.ev.push({ type: 'enemyDodge', enemyUid: target.uid });
    if (!echo && c.fx.echo > 0 && c.rng.chance(c.fx.echo)) playerAttack(c, true);
    return;
  }
  // Under its lid: the blow clangs off.
  if (target.shieldLeft > 0) {
    c.ev.push({ type: 'enemyDodge', enemyUid: target.uid, lid: true });
    return;
  }
  const roll = c.run ? runRoll(c, target) : alleyRoll(c, target);
  const hpBefore = target.hp;
  const uid = target.uid;
  const atk = target.atk;
  const killed = damageEnemy(c, 0, roll.amount);
  const dealt = Math.min(roll.amount, Math.max(0, hpBefore));
  c.ev.push({ type: 'playerHit', enemyUid: uid, targetUid: uid, amount: roll.amount, crit: roll.crit, killed, echo });
  // A Spiky floor: every blow pricks him back.
  if (c.twist === 'spiky') hurtRaccoon(c, uid, computeDamage(atk * BAL.endless.twists.spiky.atkShare, c.stats.DEF, false, 100, 1, c.k));
  if (c.run) runOnHit(c, uid, roll.crit, killed);
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

/** A heist block: Lid Shield's blocks first, then Fortress of Junk's charge. */
function runBlock(c: Ctx): boolean {
  const f = c.run!.fight;
  if (f.blocks > 0) {
    f.blocks -= 1;
    return true;
  }
  if (f.blockCharge) {
    f.blockCharge = false;
    f.blockTimer = 0;
    return true;
  }
  return false;
}

/**
 * A new game's first-run tutorial is still on (as features.ts tutorialOver has it: beginner's luck not
 * yet worn, no rebirth, not past the rolls that end it anyway).
 */
export function inTutorial(d: Pick<GameState, 'dumpster' | 'rebirths' | 'roll'> & Partial<Pick<GameState, 'legend'>>): boolean {
  return d.dumpster.beginner.state !== 'done' && d.rebirths === 0 && !(d.legend?.count ?? 0) && d.roll.count < BAL.tutorial.overAtRolls;
}

/** `unavoidable`: a charge, which can't be dodged or blocked. */
function enemyAttack(c: Ctx, e: EnemyState, mult: number, heavy: boolean, unavoidable = false) {
  const { d, stats, rng, ev } = c;
  if (!unavoidable && rng.chance(stats.DODGE / 100)) {
    ev.push({ type: 'playerDodge', enemyUid: e.uid });
    // Turbo Trash Panda: a dodge strikes back.
    if (c.run && c.run.fx.dodgeAttack > 0) playerAttack(c, true);
    return;
  }
  if (c.run && !unavoidable && runBlock(c)) {
    ev.push({ type: 'heistBlock', enemyUid: e.uid });
    return;
  }
  let amount = computeDamage(e.atk * mult, stats.DEF, false, 100, rollVariance(rng), c.k);
  if (c.run && c.run.fx.armorPct) amount *= Math.max(0.1, 1 - c.run.fx.armorPct / 100);
  d.battle.playerHp -= amount;
  // A new game's raccoon starts on World 1 before the dumpster is even open (Kevin's order), still
  // undressed: there, until the tutorial is over, he holds on at 1 HP instead of falling. (Sent further
  // on his own, he falls and tries again as ever.)
  if (!c.run && d.battle.playerHp < 1 && d.battle.stage === 1 && inTutorial(d)) d.battle.playerHp = 1;
  ev.push({ type: 'enemyHit', enemyUid: e.uid, amount, heavy });
  if (c.run) {
    if (d.battle.playerHp <= 0) {
      const back = c.run.nineLives();
      if (back !== null) {
        d.battle.playerHp = back;
        ev.push({ type: 'heal', amount: back, source: 'heist' });
      }
    }
    if (d.battle.playerHp > 0) c.run.afterHurt();
  } else if (c.perk && d.battle.playerHp <= 0) {
    secondWind(c);
  }
  if (c.fx.thorns > 0) {
    const idx = d.battle.enemies.findIndex((x) => x.uid === e.uid);
    const reflect = amount * c.fx.thorns;
    ev.push({ type: 'thorns', enemyUid: e.uid, amount: reflect });
    if (idx >= 0) damageEnemy(c, idx, reflect);
  }
}

function tickBurns(c: Ctx, dt: number) {
  const b = c.d.battle;
  // Burns can kill several enemies in one step (heist perks spread them; a death can explode into the
  // front one), so walk a copy of the line and find each enemy's current place.
  const line = [...b.enemies];
  for (let j = line.length - 1; j >= 0; j--) {
    const e = line[j];
    const i = b.enemies.indexOf(e);
    if (i < 0 || e.burnTime <= 0) continue;
    const dmg = c.run ? e.burnDps * dt * vsBurning(c, e) : e.burnDps * dt;
    e.burnTime -= dt;
    e.burnShown += dmg;
    const uid = e.uid;
    const died = damageEnemy(c, i, dmg, true, false);
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
  const bossWave = isBossWave(b.wave, b.stage);
  const last = isLastWave(b.wave, b.stage);
  let bags: number;
  if (bossWave) {
    bags = BAL.worlds.boss.bags;
  } else {
    // (A Piñata Party floor triples them.)
    bags = Math.round((BAL.drops.bagsPerWave + rollExtraBags(stats.BAG_FIND, rng)) * dumpBagMult(d));
    recordRewards(d, now, { bags, coins: 0, xp: 0 });
    if (rng.chance(BAL.luck.potion.waveDropChance)) addLuckBoost(d, now, potionSeconds(d), ev);
  }
  d.currencies.bags += bags;
  d.lifetime.wavesCleared += 1;
  b.hatGone = 0;
  b.dodge = false;
  ev.push({ type: 'bagDrop', count: bags });
  ev.push({ type: 'waveClear', stage: b.stage, wave: b.wave });
  if (last && inDump(d)) {
    b.enemies = [];
    b.playerAtkProgress = 0;
    onFloorCleared(d, ev, (w, push) => startStage(d, w, ev, push), () => addLuckBoost(d, now, potionSeconds(d), ev));
    return;
  }
  if (!last) {
    b.wave += 1;
    b.phase = 'walking';
    b.phaseTime = BAL.combat.walkSeconds;
    b.playerHp = Math.min(stats.HP, b.playerHp + (stats.HP * BAL.combat.waveHealPct) / 100);
    return;
  }
  onWorldCleared(c);
}

/**
 * The world's boss is down. The first clear pays Gems and a Luck Potion. Then the battle stops and
 * asks: this world again, or the next one (see resolveAfterBoss)?
 */
function onWorldCleared(c: Ctx) {
  const { d, ev, now } = c;
  const s = d.stage;
  const world = d.battle.stage;
  const firstTime = world > s.highestCleared;
  if (firstTime) {
    s.highestCleared = world;
    if (d.heist) d.heist.bestWorld = Math.max(d.heist.bestWorld, world);
    const gems = BAL.worlds.firstClearGems + BAL.worlds.firstClearGemsPerWorld * world;
    d.currencies.gems += gems;
    ev.push({ type: 'worldFirstClear', world, gems });
    addLuckBoost(d, now, potionSeconds(d), ev);
    // The last world's first fall this run opens the Endless Dump.
    if (world === lastWorld()) ev.push({ type: 'dumpUnlocked', first: d.dump.bestEver === 0 && d.legend.count === 0 && d.rebirths === 0 });
  }
  // Half-Eaten Bread Loaves: the first time this world's boss falls this run (perks open).
  earnBread(d, world, ev);
  d.lifetime.bossesBeaten += 1;
  ev.push({ type: 'stageClear', stage: world, firstTime });
  ev.push({ type: 'bossWin', stage: world });
  // The battle waits for the call: this world again, or on to the next (automatic after a few seconds).
  const b = d.battle;
  b.phase = 'choice';
  b.phaseTime = BAL.worlds.choiceSeconds;
  b.enemies = [];
  b.playerAtkProgress = 0;
  // After the last world, Next is the Endless Dump.
  const next = world < worldCount() ? world + 1 : endlessOpen(d) ? worldCount() + 1 : null;
  ev.push({ type: 'bossChoice', world, next, seconds: BAL.worlds.choiceSeconds, firstTime });
}

/**
 * The call after a boss: on to the next world (also what happens when nobody answers in time) or this
 * world again. In the last world there is no next, so it goes again.
 */
export function resolveAfterBoss(d: GameState, goNext: boolean, ev: CoreEvent[]): void {
  if (d.battle.phase !== 'choice') return;
  const s = d.stage;
  s.losses = 0;
  const world = d.battle.stage;
  const next = world + 1;
  if (goNext && next <= worldCount()) {
    s.mode = next > s.highestCleared ? 'push' : 'farm';
    s.returnTo = world;
    s.powerAtDeath = null;
    s.showToughHint = false;
    startStage(d, next, ev, s.mode === 'push');
    return;
  }
  // Past the last world: into the Endless Dump.
  if (goNext && world === worldCount() && enterDump(d, 'endless', ev, (w, push) => startStage(d, w, ev, push))) return;
  s.mode = 'farm';
  startStage(d, world, ev, false);
}

/**
 * After a death the raccoon tries the same world again from its first wave (Kevin: "losing doesn't
 * have to take u to the world before. u just retry that world again"). Only after
 * worlds.lossesBeforeBack losses in a row there does it fall back, so an idle raccoon at a wall goes
 * back to winning somewhere: a failed push to the world it came from, a beaten world one down.
 */
function onDeathResolved(d: GameState, ev: CoreEvent[]) {
  if (inDump(d)) {
    onDumpDeath(d, ev, (w, push) => startStage(d, w, ev, push));
    return;
  }
  const s = d.stage;
  const world = d.battle.stage;
  const push = world > s.highestCleared;
  // (Not during the first-run tutorial: it has its own guidance, and the raccoon is still dressing.)
  s.showToughHint = d.dumpster.beginner.state === 'done';
  if (push) s.powerAtDeath = playerPower(d);
  s.losses += 1;
  if (s.losses < BAL.worlds.lossesBeforeBack) {
    s.mode = push ? 'push' : 'farm';
    startStage(d, world, ev, push);
    return;
  }
  s.losses = 0;
  s.mode = 'farm';
  const back = push ? Math.max(1, Math.min(s.returnTo, world - 1)) : Math.max(1, world - 1);
  s.returnTo = Math.max(1, back - 1);
  startStage(d, back, ev, false);
}

/** Advance the Alley battle by one fixed tick of `dt` seconds. */
export function combatTick(d: GameState, rng: Rng, now: number, ev: CoreEvent[], dt: number): void {
  const b = d.battle;
  const stats = computeStats(d);
  if (b.playerHp > stats.HP) b.playerHp = stats.HP;

  // A new game's raccoon waits in his street until a world is picked (stage.chosen).
  if (b.phase === 'idle' || !d.stage.chosen) {
    b.playerHp = stats.HP;
    return;
  }

  if (b.phase === 'dead') {
    b.phaseTime -= dt;
    if (b.phaseTime <= 0) onDeathResolved(d, ev);
    return;
  }

  if (b.phase === 'choice') {
    b.phaseTime -= dt;
    if (b.phaseTime <= 0) resolveAfterBoss(d, true, ev);
    return;
  }

  b.playerHp = Math.min(stats.HP, b.playerHp + stats.REGEN * dt);
  const perk = perkFx(d);
  dumpTick(d, dt * 1000);

  if (b.phase === 'walking') {
    b.phaseTime -= dt;
    if (b.phaseTime <= 0) {
      let wave = generateWave(b.stage, b.wave, rng, b.nextEnemyUid);
      b.nextEnemyUid += wave.length;
      // A Dump floor's twist and Stench reshape the wave; a gate boss gets its moves.
      wave = dumpFoes(d, wave, rng, () => b.nextEnemyUid++);
      // Some perks change the enemies (angrier or well-fed bosses, harder-hitting regulars).
      perkFoes(wave, perk);
      b.enemies = wave;
      b.phase = 'fighting';
      b.phaseTime = 0;
      ev.push({ type: 'waveStart', stage: b.stage, wave: b.wave });
      if (isBossWave(b.wave, b.stage)) ev.push({ type: 'bossAttempt', stage: b.stage });
      // Steals Your Hat: it's gone the moment the gate boss walks in.
      const thief = wave.find((e) => e.moves.includes('hatSteal'));
      if (thief && d.equipped.hat) {
        b.hatGone = BAL.endless.moves.hatSteal.hits;
        ev.push({ type: 'hatStolen', enemyUid: thief.uid });
        b.playerHp = Math.min(b.playerHp, computeStats(d).HP);
      }
    }
    return;
  }

  const c: Ctx = {
    d, rng, now, ev, stats, fx: combatEffects(d), k: defConstant(b.stage), perk: perk === NO_PERKS ? undefined : perk, twist: currentTwist(d),
  };
  const result = fightStep(c, dt);
  if (result === 'cleared') {
    b.playerAtkProgress = 0;
    onWaveCleared(c);
  } else if (result === 'dead') {
    b.playerHp = 0;
    b.phase = 'dead';
    b.phaseTime = BAL.combat.deathSeconds;
    ev.push({ type: 'playerDeath', stage: b.stage });
  }
}

/** A heist helper's blow at the front enemy: a share of ATK through its DEF, no crits. */
function helperHit(c: Ctx, helper: 'pigeon' | 'rocco', share: number) {
  const t = c.d.battle.enemies[0];
  if (!t) return;
  const amount = computeDamage(c.stats.ATK * share, t.def, false, 100, 1, c.k) * vsBurning(c, t);
  const uid = t.uid;
  const killed = damageEnemy(c, 0, amount);
  c.ev.push({ type: 'heistHelper', helper, enemyUid: uid, amount, killed });
}

/** An Alley crew member's blow at the enemy at `index`: a share of ATK through its DEF, no crits (as heist helpers hit). */
function crewHit(c: Ctx, helper: CrewHelper, index: number, share: number) {
  const t = c.d.battle.enemies[index];
  if (!t || !(share > 0)) return;
  const amount = computeDamage(c.stats.ATK * share, t.def, false, 100, 1, c.k);
  const uid = t.uid;
  const killed = damageEnemy(c, index, amount);
  c.ev.push({ type: 'crewHit', helper, enemyUid: uid, amount, killed });
}

/** A crew member hitting every enemy on screen (the sewer rats, the seagull). */
function crewHitAll(c: Ctx, helper: CrewHelper, share: number) {
  const b = c.d.battle;
  // A blow can kill (and explode into) others: walk a copy of the line and find each one's place.
  for (const e of [...b.enemies]) {
    const i = b.enemies.indexOf(e);
    if (i >= 0) crewHit(c, helper, i, share);
  }
}

/**
 * The Alley crew at the top of a step (Alley perks): every so many seconds the pigeon pecks, the rats gnaw
 * every enemy, Dr. Squeaks patches the raccoon up, the seagull dive-bombs every enemy, Raccoon Mafia's
 * recruits swing and the Gluten Golem slams. A timer waits at its next move while no enemy is left.
 */
function crewStep(c: Ctx, dt: number) {
  const fx = c.perk!;
  const d = c.d;
  const b = d.battle;
  const p: PerkState = d.perks;
  const t = p.timers;
  const every = (key: keyof PerkState['timers'], interval: number, act: () => void) => {
    if (!(interval > 0)) return;
    t[key] += dt;
    while (t[key] >= interval && b.enemies.length > 0) {
      t[key] -= interval;
      act();
    }
    if (b.enemies.length === 0) t[key] = Math.min(t[key], interval);
  };
  if (fx.pigeonAtkPct > 0) every('pigeon', fx.pigeonEvery, () => crewHit(c, 'pigeon', 0, fx.pigeonAtkPct / 100));
  if (fx.ratAtkPct > 0) every('rats', fx.ratEvery, () => crewHitAll(c, 'rats', fx.ratAtkPct / 100));
  if (fx.healPct > 0) {
    every('heal', fx.healEvery, () => {
      const amount = Math.min(c.stats.HP - b.playerHp, (c.stats.HP * fx.healPct) / 100);
      if (amount <= 0) return;
      b.playerHp += amount;
      c.ev.push({ type: 'heal', amount, source: 'perk' });
    });
  }
  if (fx.gullAtkPct > 0) every('gull', fx.gullEvery, () => crewHitAll(c, 'gull', fx.gullAtkPct / 100));
  if (fx.recruitAtkPct > 0 && p.recruits > 0) {
    every('mafia', fx.recruitEvery, () => {
      // (One recruited by these very swings joins in on the next round.)
      const n = p.recruits;
      for (let i = 0; i < n && b.enemies.length > 0; i++) crewHit(c, 'mafia', 0, fx.recruitAtkPct / 100);
    });
  }
  if (fx.golemAtkPct > 0 && p.earned > 0) every('golem', fx.golemEvery, () => crewHit(c, 'golem', 0, (fx.golemAtkPct * p.earned) / 100));
}

/** Playing Possum (an Alley perk): once per world attempt, a knockout blow leaves the raccoon standing. */
function secondWind(c: Ctx) {
  const fx = c.perk!;
  const p = c.d.perks;
  if (!(fx.secondWindPct > 0) || p.windUsed) return;
  p.windUsed = true;
  const hp = (c.stats.HP * fx.secondWindPct) / 100;
  c.d.battle.playerHp = hp;
  c.ev.push({ type: 'secondWind', hp });
  c.ev.push({ type: 'heal', amount: hp, source: 'perk' });
}

/** Heist timers at the top of a step: stuns wear off, Fortress of Junk recharges, the crew attacks. */
function runTimers(c: Ctx, dt: number) {
  const run = c.run!;
  const { fx, fight: f } = run;
  const b = c.d.battle;
  f.time += dt;
  for (const e of b.enemies) if (e.stun) e.stun = Math.max(0, e.stun - dt);
  if (fx.blockEvery > 0 && !f.blockCharge) {
    f.blockTimer += dt;
    if (f.blockTimer >= fx.blockEvery) {
      f.blockCharge = true;
      f.blockTimer = 0;
    }
  }
  if (fx.pigeons > 0 && fx.pigeonEvery > 0) {
    f.pigeonTimer += dt;
    while (f.pigeonTimer >= fx.pigeonEvery && b.enemies.length > 0) {
      f.pigeonTimer -= fx.pigeonEvery;
      for (let p = 0; p < Math.round(fx.pigeons) && b.enemies.length > 0; p++) helperHit(c, 'pigeon', fx.pigeonAtk);
    }
  }
  if (fx.roccoAtk > 0 && fx.roccoEvery > 0) {
    f.roccoTimer += dt;
    while (f.roccoTimer >= fx.roccoEvery && b.enemies.length > 0) {
      f.roccoTimer -= fx.roccoEvery;
      helperHit(c, 'rocco', fx.roccoAtk);
    }
  }
}

/** The raccoon's attacks per second: Feral (missing HP) and Gas Station Espresso (the first seconds) in heists. */
function attackSpeed(c: Ctx): number {
  if (!c.run) return c.stats.ATK_SPD;
  const { fx, fight } = c.run;
  let spd = c.stats.ATK_SPD;
  if (fx.feral > 0) spd *= 1 + (fx.feral * Math.max(0, 1 - c.d.battle.playerHp / Math.max(1, c.stats.HP)) * 100) / 100;
  if (fx.rushPct > 0 && fight.time <= fx.rushSeconds) spd *= 1 + fx.rushPct / 100;
  return Math.min(spd, BAL.player.caps.ATK_SPD * 2);
}

/** One enemy's specials this step: heavy hits, charges, enrage, summons. */
function useSpecials(c: Ctx, e: EnemyState, dt: number) {
  const b = c.d.battle;
  for (const special of enemySpecials(DATA.enemiesById.get(e.enemyId))) {
    if (special.type === 'heavyHit' || special.type === 'charge') {
      e.specialTimer += dt;
      // In the Alley a boss's heavy hit winds up first: a Dodge tap meanwhile makes it miss.
      const windup = !c.run && special.type === 'heavyHit' && e.kind !== 'regular' ? Math.min(BAL.endless.windupSeconds, special.everySeconds * 0.8) : 0;
      if (windup > 0 && e.specialTimer >= special.everySeconds - windup && e.specialTimer < special.everySeconds) {
        if (e.tele === 0) c.ev.push({ type: 'bossWindup', enemyUid: e.uid, name: special.name, seconds: special.everySeconds - e.specialTimer });
        e.tele = Math.max(0.01, special.everySeconds - e.specialTimer);
      }
      if (e.specialTimer >= special.everySeconds) {
        e.specialTimer -= special.everySeconds;
        e.tele = 0;
        c.ev.push({ type: 'bossSpecial', enemyUid: e.uid, name: special.name });
        if (windup > 0 && b.dodge) {
          b.dodge = false;
          perfectDodge(c, e);
        } else {
          b.dodge = false;
          enemyAttack(c, e, special.damageMult, true, special.type === 'charge');
        }
      }
    } else if (special.type === 'enrage' && !e.enraged && (e.hp / e.maxHp) * 100 < special.belowHpPct) {
      e.enraged = true;
      e.atk *= special.atkMult;
      e.atkSpd *= special.atkSpdMult;
      c.ev.push({ type: 'bossSpecial', enemyUid: e.uid, name: special.name });
    } else if (special.type === 'summon' && c.run) {
      e.specialTimer += dt;
      if (e.specialTimer >= special.everySeconds) {
        e.specialTimer -= special.everySeconds;
        const alive = b.enemies.filter((x) => x.enemyId === special.enemyId).length;
        if (alive < special.max) {
          // The new arrival steps in front of the one who called it.
          b.enemies.unshift(c.run.makeEnemy(special.enemyId));
          c.ev.push({ type: 'bossSpecial', enemyUid: e.uid, name: special.name });
        }
      }
    }
  }
}

/**
 * One step of a fight, shared by the Alley and Heists: burns, the raccoon's attacks, then the
 * engaged enemies' specials and attacks. Returns 'cleared' when no enemy is left, 'dead' when the
 * raccoon is down (the caller handles both), or null while it goes on.
 */
export function fightStep(c: Ctx, dt: number): 'cleared' | 'dead' | null {
  const b = c.d.battle;
  if (c.run) runTimers(c, dt);
  else if (c.perk) crewStep(c, dt);
  if (!c.run) dumpStep(c, dt);
  tickBurns(c, dt);
  b.playerAtkProgress += attackSpeed(c) * dt;
  while (b.playerAtkProgress >= 1 && b.enemies.length > 0 && b.playerHp > 0) {
    b.playerAtkProgress -= 1;
    playerAttack(c, false);
  }
  // (A Spiky floor's pricks can knock him out mid-swing.)
  if (b.playerHp <= 0) return 'dead';
  if (b.enemies.length === 0) return 'cleared';

  // Engaged enemies attack the raccoon (stunned ones just stand there).
  const engaged = Math.min(BAL.combat.engagedEnemies, b.enemies.length);
  for (let i = 0; i < engaged && i < b.enemies.length; i++) {
    const e = b.enemies[i];
    if (e.stun) continue;
    useSpecials(c, e, dt);
    e.atkProgress += e.atkSpd * dt;
    while (e.atkProgress >= 1 && b.playerHp > 0 && b.enemies.includes(e)) {
      e.atkProgress -= 1;
      enemyAttack(c, e, 1, false);
    }
    if (b.playerHp <= 0) return 'dead';
  }
  return b.enemies.length === 0 ? 'cleared' : null;
}

// ------------------------------------------------------------------ the Endless Dump in the battle

/** Damage to the raccoon from something other than an attack (a Spiky floor's pricks): it can knock him out. */
function hurtRaccoon(c: Ctx, enemyUid: number, amount: number) {
  const b = c.d.battle;
  if (!(amount > 0)) return;
  b.playerHp -= amount;
  c.ev.push({ type: 'enemyHit', enemyUid, amount, heavy: false, spikes: true });
  if (c.perk && b.playerHp <= 0) secondWind(c);
}

/** A dodged heavy hit: it misses, and he answers with a big blow. */
function perfectDodge(c: Ctx, e: EnemyState) {
  c.ev.push({ type: 'perfectDodge', enemyUid: e.uid });
  const i = c.d.battle.enemies.indexOf(e);
  const mult = BAL.endless.dodgeCounterMult;
  if (i < 0 || !(mult > 0)) return;
  const amount = computeDamage(c.stats.ATK * mult, e.def, true, c.stats.CRIT_DMG, 1, c.k);
  const uid = e.uid;
  const killed = damageEnemy(c, i, amount);
  c.ev.push({ type: 'playerHit', enemyUid: uid, targetUid: uid, amount, crit: true, killed, echo: false });
}

/** A gate boss took a blow: it may hide under its lid, and enough hits get the hat back. */
function bossMovesOnHit(c: Ctx, e: EnemyState, before: number, direct: boolean) {
  const b = c.d.battle;
  const m = BAL.endless.moves;
  if (direct && b.hatGone > 0 && e.moves.includes('hatSteal')) {
    b.hatGone -= 1;
    if (b.hatGone === 0) c.ev.push({ type: 'hatBack', enemyUid: e.uid });
  }
  if (e.moves.includes('shield') && e.shields < m.shield.atHpPct.length) {
    const at = (m.shield.atHpPct[e.shields] / 100) * e.maxHp;
    if (before > at && e.hp <= at) {
      e.shields += 1;
      e.shieldLeft = m.shield.seconds;
      c.ev.push({ type: 'lidUp', enemyUid: e.uid, seconds: m.shield.seconds });
    }
  }
  if (e.moves.includes('enrage') && !e.moveEnraged && (e.hp / e.maxHp) * 100 < m.enrage.belowHpPct) {
    e.moveEnraged = true;
    e.atk *= m.enrage.atkMult;
    e.atkSpd *= m.enrage.atkSpdMult;
    c.ev.push({ type: 'bossSpecial', enemyUid: e.uid, name: DATA.strings['move.enrage'] ?? 'Enrage' });
  }
}

/**
 * The Dump's own clock in a fight: a Regenerating floor's enemies and a regenerating gate boss heal
 * unless they're burning, the lid comes back down, and a gate boss calls for backup.
 */
function dumpStep(c: Ctx, dt: number) {
  const b = c.d.battle;
  const tw = BAL.endless.twists;
  const m = BAL.endless.moves;
  for (const e of [...b.enemies]) {
    if (e.shieldLeft > 0) e.shieldLeft = Math.max(0, e.shieldLeft - dt);
    let pct = 0;
    if (c.twist === 'regen') pct += e.kind === 'regular' ? tw.regen.pctPerSecond : tw.regen.bossPctPerSecond;
    if (e.moves.includes('regen')) pct += m.regen.pctPerSecond;
    if (pct > 0 && e.burnTime <= 0 && e.hp > 0) e.hp = Math.min(e.maxHp, e.hp + (e.maxHp * pct * dt) / 100);
    if (e.moves.includes('summon')) {
      e.moveTimer += dt;
      if (e.moveTimer >= m.summon.everySeconds) {
        e.moveTimer -= m.summon.everySeconds;
        const roster = worldDef(b.stage).enemies;
        const helpers = b.enemies.filter((x) => x.kind === 'regular').length;
        if (helpers < m.summon.max && roster.length > 0) {
          const foe = roster[c.rng.int(0, roster.length - 1)];
          const add = makeEnemy(DATA.enemiesById.get(foe.id)!, b.stage, b.nextEnemyUid++, false);
          // The new arrival steps in front of the one who called it.
          b.enemies.unshift(add);
          c.ev.push({ type: 'bossSpecial', enemyUid: e.uid, name: DATA.strings['move.summon'] ?? 'Backup' });
        }
      }
    }
  }
}

/** A Dodge tap: it counts if a boss's heavy hit is winding up right now. */
export function dodge(d: GameState, ev: CoreEvent[]): boolean {
  const b = d.battle;
  if (b.phase !== 'fighting' || b.dodge) return false;
  if (!b.enemies.some((e) => e.tele > 0)) return false;
  b.dodge = true;
  ev.push({ type: 'dodgeArmed' });
  return true;
}
