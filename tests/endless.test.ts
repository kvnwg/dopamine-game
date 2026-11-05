import { describe, expect, it } from 'vitest';
import {
  applyAction, computeStats, createInitialState, currentLuck, currentTwist, deserialize, dumpWorld, effWorld, entryFloor, floorOf, floorName,
  floorTwist, gateBoss, gateMoves, gatePreview, generateWave, goals, gritPct, growth, inDump, isBossWave, isDump, isGate, itemTierFor, killRewards,
  lookWorld, nextGate, rebirthRequirement, Rng, scaledEnemyStats, serialize, stenchAt, tick, wavesIn, worldCount, worldDef, worldThreat,
  type CoreEvent, type EnemyState, type GameState,
} from '../src/core';
import { BAL, DATA, GOOD_TWISTS, HARD_TWISTS, type TwistId } from '../src/data';
import { freshState, T0 } from './helpers';

const E = BAL.endless;
const LAST = DATA.worlds.length;
const rng = () => new Rng(77);

/** A raccoon past the tutorial with World 20 beaten this run, standing on Dump floor `floor` (the floors before it beaten). */
function inTheDump(floor = 1, seed = 1): GameState {
  const st = freshState(seed);
  st.dumpster.beginner = { state: 'done', uid: null };
  st.dumpster.firstDiveDone = true;
  st.stage.highestCleared = dumpWorld(floor) - 1;
  st.stage.current = dumpWorld(floor);
  st.battle.stage = dumpWorld(floor);
  st.dump.floor = floor;
  st.dump.bestEver = floor - 1;
  st.player.level = 100;
  return st;
}

/** The first floor at or after `from` with this twist (for this raccoon's salt). */
function floorWith(twist: TwistId, st: GameState, from = 1): number {
  for (let f = from; f < from + 2000; f++) if (floorTwist(f, st.legend.count) === twist) return f;
  throw new Error(`no floor with ${twist}`);
}

/** A plain foe for a fight set up by hand. */
let uid = 9000;
function foe(over: Partial<EnemyState> = {}): EnemyState {
  uid += 1;
  return {
    uid, enemyId: 'alley_rat', kind: 'regular', hp: 1e6, maxHp: 1e6, atk: 0, def: 0, atkSpd: 0.0001, atkProgress: 0, specialTimer: 0, enraged: false,
    burnDps: 0, burnTime: 0, burnShown: 0, moves: [], tele: 0, moveTimer: 0, shieldLeft: 0, shields: 0, moveEnraged: false, giant: false,
    ...over,
  };
}

/** A copy that can be changed (the core hands back frozen states). */
const own = (st: GameState): GameState => structuredClone(st);

/** Puts `enemies` in front of him, mid-fight (on a copy), his first swing ready. */
function fight(state: GameState, enemies: EnemyState[]): GameState {
  const st = own(state);
  st.battle.playerAtkProgress = 0.99;
  st.battle.phase = 'fighting';
  st.battle.enemies = enemies;
  st.battle.playerHp = computeStats(st).HP;
  return st;
}

function run(st: GameState, ticks: number, r = rng()): { st: GameState; ev: CoreEvent[] } {
  const ev: CoreEvent[] = [];
  let s = st;
  for (let i = 0; i < ticks; i++) {
    const out = tick(s, { ticks: 1 }, r, T0 + i * 100);
    s = out.state;
    ev.push(...out.events);
  }
  return { st: s, ev };
}

describe('the Endless Dump: floors are worlds past the last one', () => {
  it('World 21 is Floor 1, and floors grow by floorStep of a world each', () => {
    expect(isDump(LAST)).toBe(false);
    expect(isDump(LAST + 1)).toBe(true);
    expect(floorOf(dumpWorld(7))).toBe(7);
    expect(effWorld(LAST)).toBe(LAST);
    expect(effWorld(dumpWorld(5))).toBeCloseTo(LAST + 5 * E.floorStep);
    // Gold, XP and enemies keep growing, a little a floor.
    expect(growth(BAL.worlds.goldGrowth, dumpWorld(1))).toBeGreaterThan(growth(BAL.worlds.goldGrowth, LAST));
    expect(growth(3, dumpWorld(1)) / growth(3, LAST)).toBeCloseTo(Math.pow(3, E.floorStep));
    expect(killRewards(dumpWorld(10), 'regular', 0).coins).toBeCloseTo(killRewards(LAST, 'regular', 0).coins * Math.pow(BAL.worlds.goldGrowth, 10 * E.floorStep));
    // A thousand floors in, the numbers are still real numbers (a NaN or Infinity once reset saves).
    expect(Number.isFinite(killRewards(dumpWorld(1000), 'regular', 0).coins)).toBe(true);
  });

  it('a floor borrows a world\'s look and enemies for a whole set of 10, every world in turn, the last one first', () => {
    expect(lookWorld(dumpWorld(1))).toBe(LAST);
    expect(lookWorld(dumpWorld(E.gateEvery))).toBe(LAST);
    const seen = new Set<number>();
    for (let set = 0; set < LAST; set++) seen.add(lookWorld(dumpWorld(set * E.gateEvery + 1)));
    expect(seen.size).toBe(LAST);
    const def = worldDef(dumpWorld(3));
    expect(def.name).toBe(DATA.strings['dump.name']);
    expect(def.enemies).toEqual(DATA.worlds[lookWorld(dumpWorld(3)) - 1].enemies);
    expect(worldDef(dumpWorld(3))).toBe(def);
  });

  it('every 10th floor is a gate: its last wave is a titled, recolored gate boss; other floors have no boss', () => {
    expect(isGate(E.gateEvery)).toBe(true);
    expect(isGate(E.gateEvery + 1)).toBe(false);
    expect(nextGate(1)).toBe(E.gateEvery);
    expect(nextGate(E.gateEvery)).toBe(E.gateEvery);
    expect(nextGate(E.gateEvery + 1)).toBe(2 * E.gateEvery);
    expect(wavesIn(dumpWorld(3))).toBe(E.wavesPerFloor);
    expect(wavesIn(dumpWorld(E.gateEvery))).toBe(E.wavesPerFloor + 1);
    const gate = dumpWorld(E.gateEvery);
    expect(isBossWave(E.wavesPerFloor, gate)).toBe(true);
    expect(isBossWave(E.wavesPerFloor - 1, gate)).toBe(false);
    for (let w = 0; w < E.wavesPerFloor; w++) expect(isBossWave(w, dumpWorld(3))).toBe(false);
    const boss = generateWave(gate, E.wavesPerFloor, new Rng(1), 1);
    expect(boss).toHaveLength(1);
    expect(boss[0].kind).toBe('boss');
    const b = gateBoss(1);
    expect(E.gateBosses).toContain(b.id);
    expect(b.name).toContain(DATA.enemiesById.get(b.id)!.name);
    expect(b.name.length).toBeGreaterThan(DATA.enemiesById.get(b.id)!.name.length);
    expect([b.color, b.accent]).toEqual(E.tints[0]);
    // Deeper gates know more moves, never more than maxMoves, never the same one twice.
    expect(gateMoves(E.gateEvery)).toHaveLength(E.gate.movesFirst);
    for (let g = 1; g <= 40; g++) {
      const m = gateMoves(g * E.gateEvery);
      expect(m.length).toBeLessThanOrEqual(E.gate.maxMoves);
      expect(new Set(m).size).toBe(m.length);
    }
    expect(gateMoves(40 * E.gateEvery).length).toBe(E.gate.maxMoves);
    expect(gateMoves(5)).toEqual([]);
  });

  it('teeth: harder through each set of 10, easier right after a gate; a gate boss is tougher than a world boss', () => {
    const rat = DATA.enemiesById.get('alley_rat')!;
    const at = (f: number) => scaledEnemyStats(rat, dumpWorld(f), false).hp / growth(BAL.worlds.enemyGrowth.hp, dumpWorld(f));
    expect(at(1)).toBeCloseTo(rat.hp * E.sawtooth[0]);
    expect(at(9)).toBeGreaterThan(at(8));
    expect(at(11)).toBeLessThan(at(9));
    const boss = DATA.enemiesById.get('big_earl')!;
    const g = scaledEnemyStats(boss, dumpWorld(10), true);
    const plain = scaledEnemyStats(boss, dumpWorld(10), false);
    expect(g.hp / plain.hp).toBeCloseTo(E.gate.hpMult);
  });

  it('floors have names and twists that never change; gates always have a hard twist, the floors after a gate a good one', () => {
    expect(floorName(43)).toBe(floorName(43));
    expect(floorName(43)).not.toBe(floorName(44));
    expect(floorName(43)).toMatch(/^The .+ of .+$/);
    const hard = new Set<string>(HARD_TWISTS);
    const good = new Set<string>(GOOD_TWISTS);
    let twisted = 0;
    for (let f = 1; f <= 600; f++) {
      const tw = floorTwist(f, 0);
      expect(floorTwist(f, 0)).toBe(tw);
      const place = ((f - 1) % E.gateEvery) + 1;
      if (isGate(f)) expect(hard.has(tw!)).toBe(true);
      else if (f > E.gateEvery && place <= E.goodAfterGate) expect(good.has(tw!)).toBe(true);
      else if (tw) {
        expect(hard.has(tw)).toBe(true);
        twisted++;
      }
      // Two floors in a row never ask the same question.
      if (f > 1 && tw && hard.has(tw)) expect(floorTwist(f - 1, 0)).not.toBe(tw);
    }
    const ordinary = Array.from({ length: 600 }, (_, i) => i + 1).filter((f) => !isGate(f) && !(f > E.gateEvery && ((f - 1) % E.gateEvery) + 1 <= E.goodAfterGate)).length;
    expect(Math.abs(twisted / ordinary - E.twistChance)).toBeLessThan(0.08);
    // A Legend run gets new ones.
    expect(Array.from({ length: 50 }, (_, i) => floorTwist(i + 1, 1)).join()).not.toBe(Array.from({ length: 50 }, (_, i) => floorTwist(i + 1, 0)).join());
  });
});

describe('the Endless Dump: getting in, going deeper, falling back', () => {
  it('opens when World 20 falls this run; Next after World 20\'s boss goes in', () => {
    const st = freshState(1);
    st.dumpster.beginner = { state: 'done', uid: null };
    st.stage.highestCleared = LAST - 1;
    expect(applyAction(own(st), { type: 'enterDump', mode: 'endless' }, rng(), T0).state.battle.stage).toBe(st.battle.stage);
    st.stage.highestCleared = LAST;
    st.battle.stage = LAST;
    st.battle.phase = 'choice';
    const r = applyAction(st, { type: 'afterBoss', next: true }, rng(), T0);
    expect(r.state.battle.stage).toBe(dumpWorld(1));
    expect(inDump(r.state)).toBe(true);
    expect(r.events.some((e) => e.type === 'dumpEnter')).toBe(true);
  });

  it('a cleared floor moves on to the next at once: the run\'s best, the deepest ever, gems, and stars toward the next Legend', () => {
    let st = inTheDump(4);
    st.battle.wave = E.wavesPerFloor - 1;
    st = fight(st, [foe({ hp: 1, maxHp: 1 })]);
    const gems = st.currencies.gems;
    const { st: s, ev } = run(st, 5);
    expect(ev.some((e) => e.type === 'floorClear' && e.floor === 4 && e.firstTime)).toBe(true);
    expect(s.stage.highestCleared).toBe(dumpWorld(4));
    expect(s.battle.stage).toBe(dumpWorld(5));
    expect(s.dump.bestEver).toBe(4);
    expect(s.dump.floor).toBe(5);
    expect(s.currencies.gems).toBe(gems + E.floorGems);
    expect(s.legend.runDeepest).toBe(4);
    expect(s.legend.runFloorStars).toBeCloseTo(4 * BAL.legend.starsPerFloor);
  });

  it('a gate\'s first fall pays gems, a Luck Potion, a loaf with perks open; a new rarity tier opens at its floor', () => {
    let st = inTheDump(E.tierFloors.cosmic!);
    st.rebirths = BAL.perks.unlockRebirths;
    st.battle.wave = E.wavesPerFloor;
    st = fight(st, [foe({ kind: 'boss', hp: 1, maxHp: 1 })]);
    const { st: s, ev } = run(st, 5);
    const gate = E.tierFloors.cosmic! / E.gateEvery;
    expect(ev.find((e) => e.type === 'dumpDeepest')).toMatchObject({ gems: E.floorGems + E.gate.gems + E.gate.gemsPerGate * gate });
    expect(ev.some((e) => e.type === 'tierUnlocked' && e.rarity === 'cosmic')).toBe(true);
    expect(ev.some((e) => e.type === 'breadEarned')).toBe(true);
    expect(ev.some((e) => e.type === 'luckBoost')).toBe(true);
    expect(ev.some((e) => e.type === 'floorClear' && e.gate)).toBe(true);
    expect(s.dump.records.fastestGateMs).not.toBeNull();
  });

  it('knocked out, he tries the floor again; after lossesBeforeBack in a row, one floor back, and the next brings him back up', () => {
    let st = inTheDump(8);
    st = fight(st, [foe({ atk: 1e30, atkSpd: 50 })]);
    let s = own(run(st, 40).st);
    expect(s.battle.stage).toBe(dumpWorld(8));
    for (let i = 0; i < E.lossesBeforeBack + 1 && s.battle.stage === dumpWorld(8); i++) {
      s = fight(s, [foe({ atk: 1e30, atkSpd: 50 })]);
      s = own(run(s, 40).st);
    }
    expect(s.battle.stage).toBe(dumpWorld(7));
    expect(isDump(s.battle.stage)).toBe(true);
  });

  it('Grit: stuck on a new floor a while, ATK and HP grow (up to maxPct), and it starts over when the floor falls', () => {
    const st = inTheDump(30);
    const base = computeStats(st);
    expect(gritPct(st)).toBe(0);
    st.dump.stuckMs = (E.catchUp.afterMinutes + 10) * 60000;
    expect(gritPct(st)).toBe(10 * E.catchUp.pctPerMinute);
    expect(computeStats(st).ATK).toBeCloseTo(base.ATK * (1 + gritPct(st) / 100));
    st.dump.stuckMs = 1e12;
    expect(gritPct(st)).toBe(E.catchUp.maxPct);
    // Time on the frontier counts.
    const s2 = run(fight(inTheDump(30), [foe()]), 50).st;
    expect(s2.dump.stuckMs).toBeGreaterThan(4000);
  });

  it('past World 20 a rebirth asks for a Dump floor, and the run\'s floors count for it', () => {
    const r = Array.from({ length: 30 }, (_, i) => i).find((n) => isDump(rebirthRequirement(n).world))!;
    const st = inTheDump(floorOf(rebirthRequirement(r).world) + 1);
    st.rebirths = r;
    st.currencies.coins = rebirthRequirement(r).gold;
    const s = applyAction(st, { type: 'rebirth' }, rng(), T0).state;
    expect(s.rebirths).toBe(r + 1);
    expect(s.battle.stage).toBe(1);
    expect(s.dump.floor).toBe(1);
    expect(s.dump.bestEver).toBe(st.dump.bestEver);
  });

  it('items rolled in the Dump are at most one floor past the run\'s best; the threat read-out works on floors', () => {
    const st = inTheDump(12);
    expect(itemTierFor(st)).toBe(dumpWorld(12));
    st.battle.stage = dumpWorld(40);
    expect(itemTierFor(st)).toBe(dumpWorld(12));
    const t = worldThreat(st, dumpWorld(13));
    expect(Number.isFinite(t.margin)).toBe(true);
    expect(worldThreat(st, dumpWorld(13)).margin).toBeGreaterThan(worldThreat(st, dumpWorld(40)).margin);
  });
});

describe('the Endless Dump: twists in the fight', () => {
  it('Armored: normal hits do nonCritPct; crits get through', () => {
    const st = inTheDump(1);
    const f = floorWith('armored', st);
    const a = fight(inTheDump(f), [foe()]);
    const b = fight(inTheDump(f + 1), [foe()]);
    expect(currentTwist(a)).toBe('armored');
    const hit = (s: GameState) => run(s, 30).ev.filter((e) => e.type === 'playerHit' && !e.crit).map((e) => (e as { amount: number }).amount);
    const plain = currentTwist(b) === 'armored' ? null : hit(b);
    const armored = hit(a);
    expect(armored.length).toBeGreaterThan(0);
    if (plain && plain.length) {
      const avg = (x: number[]) => x.reduce((p, q) => p + q, 0) / x.length;
      expect(avg(armored) / avg(plain)).toBeLessThan((E.twists.armored.nonCritPct / 100) * 1.6);
    }
  });

  it('Slippery: about dodgePct of his swings miss (2,000 swings)', () => {
    const f = floorWith('slippery', inTheDump(1));
    const st = fight(inTheDump(f), [foe()]);
    st.equipped.gloves = null;
    const { ev } = run(st, 2000);
    const miss = ev.filter((e) => e.type === 'enemyDodge').length;
    const hit = ev.filter((e) => e.type === 'playerHit' && !e.echo).length;
    expect(Math.abs(miss / (miss + hit) - E.twists.slippery.dodgePct / 100)).toBeLessThan(0.05);
  });

  it('Regenerating: enemies heal unless burning', () => {
    const f = floorWith('regen', inTheDump(1));
    const st = fight(inTheDump(f), [foe({ hp: 5e5, maxHp: 1e6, atkSpd: 0.0001 })]);
    st.battle.playerAtkProgress = -1e9;
    const healed = run(st, 10).st.battle.enemies[0];
    expect(healed.hp).toBeGreaterThan(5e5);
    const st2 = fight(inTheDump(f), [foe({ hp: 5e5, maxHp: 1e6, burnTime: 100, burnDps: 0 })]);
    st2.battle.playerAtkProgress = -1e9;
    expect(run(st2, 10).st.battle.enemies[0].hp).toBeLessThanOrEqual(5e5);
  });

  it('Spiky: his own blows prick him', () => {
    const f = floorWith('spiky', inTheDump(1));
    const st = fight(inTheDump(f), [foe({ atk: 1e6 })]);
    st.player.level = 1;
    const { ev } = run(st, 30);
    expect(ev.some((e) => e.type === 'enemyHit' && e.spikes)).toBe(true);
  });

  it('Swarm doubles a wave at less HP each; Giants make it two giants that Boss Damage hits', () => {
    const fs = floorWith('swarm', inTheDump(1));
    let st = inTheDump(fs);
    st.battle.phase = 'walking';
    st.battle.phaseTime = 0;
    const r = run(st, 1).st.battle.enemies;
    const plain = generateWave(dumpWorld(fs), 0, new Rng(1), 1);
    expect(r.length).toBeGreaterThanOrEqual(2 * BAL.stages.enemiesPerWave.min);
    expect(r[0].maxHp).toBeLessThan(scaledEnemyStats(DATA.enemiesById.get(r[0].enemyId)!, dumpWorld(fs), false).hp);
    expect(plain.length).toBeLessThanOrEqual(BAL.stages.enemiesPerWave.max);
    const fg = floorWith('giants', inTheDump(1));
    st = inTheDump(fg);
    st.battle.phase = 'walking';
    st.battle.phaseTime = 0;
    const g = run(st, 1).st.battle.enemies;
    expect(g).toHaveLength(E.twists.giants.count);
    expect(g.every((e) => e.giant)).toBe(true);
  });

  it('Gold Rush, Lucky Floor and Pinata Party pay more on their floor', () => {
    const base = inTheDump(1);
    const fg = floorWith('goldRush', base, E.gateEvery + 1);
    const fl = floorWith('lucky', base, E.gateEvery + 1);
    const plain = inTheDump(floorWith('swarm', base));
    expect(currentLuck(inTheDump(fl), T0) / currentLuck(plain, T0)).toBeCloseTo(E.twists.lucky.luckMult);
    let st = fight(inTheDump(fg), [foe({ hp: 1, maxHp: 1 })]);
    const kill = run(st, 5).ev.find((e) => e.type === 'kill') as Extract<CoreEvent, { type: 'kill' }>;
    st = fight(plain, [foe({ hp: 1, maxHp: 1 })]);
    const kill2 = run(st, 5).ev.find((e) => e.type === 'kill') as Extract<CoreEvent, { type: 'kill' }>;
    const k = killRewards(dumpWorld(fg), 'regular', computeStats(inTheDump(fg)).COIN_FIND).coins / killRewards(plain.battle.stage, 'regular', computeStats(plain).COIN_FIND).coins;
    expect(kill.coins / kill2.coins / k).toBeCloseTo(E.twists.goldRush.goldMult);
  });
});

describe('the Endless Dump: gate bosses and the Dodge button', () => {
  it('a heavy hit winds up first; DODGE in that time makes it miss and he answers with a big blow', () => {
    const st = inTheDump(10);
    const boss = foe({ enemyId: 'big_earl', kind: 'boss', atk: 1e40, atkSpd: 0.0001 });
    const every = DATA.enemiesById.get('big_earl')!.special!.type === 'heavyHit' ? (DATA.enemiesById.get('big_earl')!.special as { everySeconds: number }).everySeconds : 7;
    boss.specialTimer = every - E.windupSeconds - 0.05;
    let s = fight(st, [boss]);
    s.battle.playerAtkProgress = -1e9;
    const a = run(s, 2);
    expect(a.ev.some((e) => e.type === 'bossWindup')).toBe(true);
    expect(a.st.battle.enemies[0].tele).toBeGreaterThan(0);
    s = own(applyAction(a.st, { type: 'dodge' }, rng(), T0).state);
    expect(s.battle.dodge).toBe(true);
    const b = run(s, 20);
    expect(b.ev.some((e) => e.type === 'perfectDodge')).toBe(true);
    expect(b.ev.some((e) => e.type === 'enemyHit' && e.heavy)).toBe(false);
    expect(b.st.battle.playerHp).toBeGreaterThan(0);
    // Without the tap the same slam lands (and at that ATK, knocks him out).
    const calm = fight(inTheDump(10), [{ ...boss, uid: 1, hp: 1e300, maxHp: 1e300 }]);
    calm.battle.playerAtkProgress = -1e9;
    const c = run(calm, 20);
    expect(c.ev.some((e) => e.type === 'enemyHit' && e.heavy)).toBe(true);
    // A tap with nothing winding up does nothing.
    expect(applyAction(fight(inTheDump(10), [foe()]), { type: 'dodge' }, rng(), T0).state.battle.dodge).toBe(false);
  });

  it('Steals Your Hat: its stats are gone until he has hit the boss enough times', () => {
    const st = inTheDump(10);
    st.equipped.hat = { ...DATA.items[0], uid: 1, baseId: 'hat_traffic_cone', slot: 'hat', rarity: 'legendary', level: 1, main: [{ stat: 'HP', mode: 'flat', value: 1e6 }], subs: [], bonus: [], mintPerkId: null, enchants: [], locked: false, tier: 1, power: 100 } as GameState['equipped']['hat'];
    const withHat = computeStats(st).HP;
    st.battle.hatGone = BAL.endless.moves.hatSteal.hits;
    expect(computeStats(st).HP).toBeLessThan(withHat);
    const s = fight(st, [foe({ kind: 'boss', moves: ['hatSteal'] })]);
    s.battle.hatGone = 2;
    s.battle.playerAtkProgress = 0.99;
    const r = run(s, 30);
    expect(r.ev.some((e) => e.type === 'hatBack')).toBe(true);
    expect(r.st.battle.hatGone).toBe(0);
  });

  it('Lid Up: under its lid, direct hits do nothing; Regenerates; Calls for Backup', () => {
    let s = fight(inTheDump(10), [foe({ kind: 'boss', moves: ['shield'] })]);
    s.battle.enemies[0].hp = s.battle.enemies[0].maxHp * (BAL.endless.moves.shield.atHpPct[0] / 100 + 0.0001);
    const r = run(s, 8);
    expect(r.ev.some((e) => e.type === 'lidUp')).toBe(true);
    const hp = r.st.battle.enemies[0].hp;
    expect(run(r.st, 5).st.battle.enemies[0].hp).toBe(hp);
    s = fight(inTheDump(10), [foe({ kind: 'boss', moves: ['summon'] })]);
    s.battle.playerAtkProgress = -1e9;
    expect(run(s, Math.ceil(BAL.endless.moves.summon.everySeconds * 10) + 2).st.battle.enemies.length).toBe(2);
  });

  it('the warning ahead names the next gate: its floor, boss, twist and moves', () => {
    const st = inTheDump(3);
    const p = gatePreview(st, 3);
    expect(p.floor).toBe(E.gateEvery);
    expect(p.boss.name).toBe(gateBoss(1).name);
    expect(p.twist).toBe(floorTwist(E.gateEvery, 0));
    expect(p.moves).toEqual(gateMoves(E.gateEvery));
  });
});

describe('Stench and the Weekly Dive', () => {
  it('Stench N turns on the first N curses: tougher enemies, a weaker raccoon, more gold, XP and stars', () => {
    const s3 = stenchAt(3);
    expect(s3.enemyHpPct).toBe(50);
    expect(s3.extraEnemies).toBe(1);
    expect(s3.enemyAtkPct).toBe(40);
    expect(stenchAt(BAL.stench.max).hpCutPct).toBeGreaterThan(0);
    const st = inTheDump(5);
    const base = computeStats(st);
    const r = applyAction(st, { type: 'setStench', level: BAL.stench.max }, rng(), T0);
    expect(r.state.dump.stench).toBe(BAL.stench.max);
    expect(r.events.some((e) => e.type === 'stageStart')).toBe(true);
    expect(computeStats(r.state).HP).toBeLessThan(base.HP);
    expect(computeStats(r.state).LIFESTEAL).toBe(0);
    expect(applyAction(st, { type: 'setStench', level: 99 }, rng(), T0).state.dump.stench).toBe(BAL.stench.max);
  });

  it('the Weekly Dive: its own ladder (the run\'s best is untouched), the week\'s rules, rewards paid once, a new week starts over', () => {
    let st = inTheDump(30);
    st = tick(st, { ticks: 1 }, rng(), T0).state;
    const week = st.dump.weekly.week;
    expect(week).not.toBe('');
    st = own(applyAction(st, { type: 'enterDump', mode: 'weekly' }, rng(), T0).state);
    expect(st.dump.mode).toBe('weekly');
    expect(st.battle.stage).toBe(dumpWorld(1));
    const best = st.stage.highestCleared;
    st.dump.weekly.floor = 5;
    st.battle.stage = dumpWorld(5);
    st.battle.wave = E.wavesPerFloor - 1;
    st = fight(st, [foe({ hp: 1, maxHp: 1 })]);
    const gems = st.currencies.gems;
    const r = run(st, 3);
    expect(r.st.stage.highestCleared).toBe(best);
    expect(r.st.dump.weekly.best).toBe(5);
    expect(r.st.currencies.gems).toBe(gems + BAL.weekly.rewards[0].gems);
    expect(r.ev.some((e) => e.type === 'weeklyReward')).toBe(true);
    // A new week: back to Floor 1 and the endless floors.
    const later = tick(r.st, { ticks: 1 }, rng(), T0 + 8 * 86400000).state;
    expect(later.dump.weekly.week).not.toBe(week);
    expect(later.dump.weekly.best).toBe(0);
    expect(later.dump.mode).toBe('endless');
  });
});

describe('the Endless Dump in a save, and the goals', () => {
  it('an old save without the Dump loads with it fresh; a game in the Dump round-trips', () => {
    const old = JSON.parse(serialize(createInitialState(T0, 5))) as Record<string, unknown>;
    delete old.dump;
    delete old.legend;
    delete old.daily;
    const st = deserialize(JSON.stringify(old))!;
    expect(st.dump.bestEver).toBe(0);
    expect(st.legend.count).toBe(0);
    expect(st.daily.tasks).toEqual([]);
    const deep = inTheDump(23);
    deep.dump.stench = 4;
    deep.dump.records.stench = [0, 0, 0, 0, 22];
    expect(deserialize(serialize(deep))).toEqual(deep);
    expect(entryFloor(deep)).toBe(23);
  });

  it('three goals: minutes, an hour, a day away', () => {
    const early = freshState(1);
    expect(goals(early).map((g) => g.key)).toEqual(['goals.world', 'goals.rebirth', 'goals.dump']);
    const deep = inTheDump(12);
    deep.rebirths = 9;
    const g = goals(deep);
    expect(g).toHaveLength(3);
    expect(g[0].key).toBe('goals.floor');
    expect(worldCount()).toBe(LAST);
  });
});
