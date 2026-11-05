/**
 * The Endless Dump: after World 20, floors forever (Kevin: "make it a different world that unlocks
 * after 20th is beaten"). Floors are worlds past the last one (floors.ts), so the battle, rebirths and
 * the offline rate treat them like any world; this module adds what makes them their own place:
 *  - twists: most floors ask a different question, each answered by something already in the game
 *    (swarms by chain lightning and explosions, regeneration by burning, armor by crits...), and the
 *    floors right after a gate get a good one (gold, luck or bags) as a victory lap;
 *  - gates: every 10th floor ends with a gate boss, a recolored and titled boss with moves of its own
 *    (more the deeper it is), shown ahead of time so the player can get ready;
 *  - teeth: floors grow a little harder through each set of 10, then ease off after the gate;
 *  - Grit: stuck on a new floor a while, the raccoon gets stronger the longer he stays;
 *  - Stench: curses the player switches on for more gold, XP and Legend Stars;
 *  - the Weekly Dive: a ladder of its own with one set of rules a week, the same for everyone;
 *  - records and the rarity tiers past Grail, opened by the deepest floor ever.
 */
import { BAL, CLASSIC_TOP, DATA, GATE_MOVES, GOOD_TWISTS, HARD_TWISTS, RARITIES, type GateMove, type Rarity, type TwistId, type WeeklyRule } from '../../data';
import type { Rng } from '../rng';
import type { EnemyState, GameState } from '../state';
import { keySeed, weekKey } from '../time';
import type { CoreEvent } from '../types';
import { rarityAtLeast } from '../util';
import { dumpWorld, floorOf, gateNumber, hash32, hashUnit, isDump, isGate, lastWorld, nextGate } from './floors';
import { earnBread } from './perks';
import { makeEnemy, pickWord, worldDef } from './stages';

const E = () => BAL.endless;

// ------------------------------------------------------------------ where the raccoon is

/** The Endless Dump is open: World 20 has fallen this run. */
export function endlessOpen(state: Pick<GameState, 'stage'>): boolean {
  return state.stage.highestCleared >= lastWorld();
}

/** The raccoon is fighting in the Dump right now (not on a heist). */
export function inDump(state: Pick<GameState, 'battle'> & Partial<Pick<GameState, 'heist'>>): boolean {
  return !state.heist?.run && isDump(state.battle.stage);
}

/** In the Dump on its endless floors (not the Weekly Dive). */
export function inEndless(state: Pick<GameState, 'battle' | 'dump'> & Partial<Pick<GameState, 'heist'>>): boolean {
  return inDump(state) && state.dump.mode === 'endless';
}

/** On the Weekly Dive. */
export function inWeekly(state: Pick<GameState, 'battle' | 'dump'> & Partial<Pick<GameState, 'heist'>>): boolean {
  return inDump(state) && state.dump.mode === 'weekly';
}

/** The deepest endless floor beaten this run (0 before the Dump). */
export function runFloor(state: Pick<GameState, 'stage'>): number {
  return floorOf(state.stage.highestCleared);
}

/** The endless floor the Dump takes the raccoon to: the one he left, at most one past his best this run. */
export function entryFloor(state: Pick<GameState, 'stage' | 'dump'>): number {
  return Math.max(1, Math.min(state.dump.floor, runFloor(state) + 1));
}

// ------------------------------------------------------------------ twists

/** The seed a floor's twist is picked with: each Legend run gets a new run of twists; the Weekly Dive the week's. */
export function twistSalt(state: Pick<GameState, 'dump' | 'legend'>, weekly = state.dump.mode === 'weekly'): number {
  return weekly ? keySeed(state.dump.weekly.week) : state.legend.count;
}

/**
 * A floor's twist. Gates always have a hard one; the `goodAfterGate` floors after a gate a good one; any
 * other floor a hard one `twistChance` of the time (never the same as the floor before). The Weekly
 * Dive's rule can set one for every floor.
 */
export function floorTwist(floor: number, salt: number, rule: WeeklyRule | null = null): TwistId | null {
  if (rule?.twist) return rule.twist;
  const e = E();
  if (isGoodFloor(floor)) return GOOD_TWISTS[hash32(floor, salt, 5) % GOOD_TWISTS.length];
  if (!isHardFloor(floor, salt)) return null;
  // Two floors in a row never ask the same question: walk back to the start of this run of hard floors
  // (a floor with a good twist or none ends it, so it's short), then forward, moving any repeat along.
  let start = floor;
  while (start > 1 && isHardFloor(start - 1, salt) && floor - start < e.gateEvery * 4) start--;
  let prev: TwistId | null = null;
  let t: TwistId = HARD_TWISTS[0];
  for (let f = start; f <= floor; f++) {
    t = HARD_TWISTS[hash32(f, salt, 2) % HARD_TWISTS.length];
    if (t === prev) t = HARD_TWISTS[(HARD_TWISTS.indexOf(t) + 1 + (hash32(f, salt, 9) % (HARD_TWISTS.length - 1))) % HARD_TWISTS.length];
    prev = t;
  }
  return t;
}

/** One of the floors right after a gate: a good twist (the lap of honor). */
function isGoodFloor(floor: number): boolean {
  const e = E();
  const place = ((floor - 1) % e.gateEvery) + 1;
  return floor > e.gateEvery && place <= e.goodAfterGate;
}

/** A floor with a hard twist: every gate, and `twistChance` of the others (not the lap of honor). */
function isHardFloor(floor: number, salt: number): boolean {
  if (floor < 1 || isGoodFloor(floor)) return false;
  return isGate(floor) || hashUnit(floor, salt, 1) < E().twistChance;
}

/** This week's Weekly Dive rules. */
export function weeklyRule(week: string): WeeklyRule {
  const rules = BAL.weekly.rules;
  return rules[hash32(keySeed(week), 17) % rules.length];
}

/** The twist of `floor` for this raccoon (the Dump's mode decides whose floors they are). */
export function twistAt(state: Pick<GameState, 'dump' | 'legend'>, floor: number, weekly = state.dump.mode === 'weekly'): TwistId | null {
  return floorTwist(floor, twistSalt(state, weekly), weekly ? weeklyRule(state.dump.weekly.week) : null);
}

/** The twist of the floor being fought (null outside the Dump). */
export function currentTwist(state: Pick<GameState, 'battle' | 'dump' | 'legend'> & Partial<Pick<GameState, 'heist'>>): TwistId | null {
  return inDump(state) ? twistAt(state, floorOf(state.battle.stage)) : null;
}

// ------------------------------------------------------------------ gates

/** A gate boss's moves: more the deeper it is (and one more with Rotten Luck). */
export function gateMoves(floor: number, extra = 0): GateMove[] {
  if (!isGate(floor)) return [];
  const g = E().gate;
  const gate = gateNumber(floor);
  const n = Math.min(GATE_MOVES.length, g.maxMoves + extra, g.movesFirst + Math.floor((gate - 1) / g.movesEveryGates) + extra);
  const pool = [...GATE_MOVES];
  const out: GateMove[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) out.push(pool.splice(hash32(gate, i, 23) % pool.length, 1)[0]);
  return out;
}

/** A floor's name ("The Damp Basement of Regret"): the same floor always has the same one. */
export function floorName(floor: number): string {
  const fmt = DATA.strings['dump.names.format'] ?? 'The {adj} {place} of {noun}';
  return fmt
    .replace('{adj}', pickWord('dump.names.adj', hash32(floor, 31)))
    .replace('{place}', pickWord('dump.names.place', hash32(floor, 37)))
    .replace('{noun}', pickWord('dump.names.noun', hash32(floor, 41)));
}

/** What's coming at the next gate (for the warning ahead of it). */
export function gatePreview(state: Pick<GameState, 'dump' | 'legend'>, fromFloor: number, weekly = state.dump.mode === 'weekly') {
  const floor = nextGate(fromFloor);
  const boss = worldDef(dumpWorld(floor)).boss;
  return { floor, gate: gateNumber(floor), boss, twist: twistAt(state, floor, weekly), moves: gateMoves(floor, weekly ? 0 : stenchFx(state).gateMoves) };
}

// ------------------------------------------------------------------ Stench

export interface StenchFx {
  enemyHpPct: number;
  enemyAtkPct: number;
  extraEnemies: number;
  atkSpdCutPct: number;
  gateMoves: number;
  lifestealCutPct: number;
  enemyAtkSpdPct: number;
  regenCutPct: number;
  hpCutPct: number;
}

const NO_STENCH: StenchFx = {
  enemyHpPct: 0, enemyAtkPct: 0, extraEnemies: 0, atkSpdCutPct: 0, gateMoves: 0, lifestealCutPct: 0, enemyAtkSpdPct: 0, regenCutPct: 0, hpCutPct: 0,
};

/** The curses of a Stench level, added up. */
export function stenchAt(level: number): StenchFx {
  const out = { ...NO_STENCH };
  for (const c of BAL.stench.curses.slice(0, Math.max(0, level))) {
    for (const [k, v] of Object.entries(c.effect)) out[k as keyof StenchFx] += v ?? 0;
  }
  return out;
}

/** The Stench the raccoon fights under (only on the endless floors). */
export function stenchFx(state: Pick<GameState, 'dump'>): StenchFx {
  const lvl = state.dump.stench;
  return lvl > 0 && state.dump.mode === 'endless' ? stenchAt(lvl) : NO_STENCH;
}

/** Gold and XP multiplier from Stench in the Dump. */
export function stenchRewardMult(level: number): number {
  return 1 + BAL.stench.goldXpPerLevel * Math.max(0, level);
}

/** Legend Stars multiplier from Stench for new floors. */
export function stenchStarMult(level: number): number {
  return 1 + BAL.stench.starsPerLevel * Math.max(0, level);
}

/** Sets the Stench level (0 to max). In the Dump, the floor starts over under it. */
export function setStench(d: GameState, level: number): boolean {
  const lvl = Math.max(0, Math.min(BAL.stench.max, Math.round(level)));
  if (!Number.isFinite(lvl) || lvl === d.dump.stench) return false;
  d.dump.stench = lvl;
  return true;
}

// ------------------------------------------------------------------ what the Dump changes on the raccoon

/** Grit (catch-up): % ATK and HP after a while stuck on a new endless floor. */
export function gritPct(state: Pick<GameState, 'battle' | 'dump'> & Partial<Pick<GameState, 'heist'>>): number {
  if (!inEndless(state)) return 0;
  const c = E().catchUp;
  const minutes = state.dump.stuckMs / 60000 - c.afterMinutes;
  return minutes > 0 ? Math.min(c.maxPct, Math.floor(minutes * c.pctPerMinute)) : 0;
}

/** Multipliers on the raccoon from the Dump: Grit, Stench and the Weekly Dive's rules. */
export function dumpStatMults(state: Pick<GameState, 'battle' | 'dump'> & Partial<Pick<GameState, 'heist'>>): {
  atk: number; hp: number; atkSpd: number; lifesteal: number; regen: number;
} {
  const out = { atk: 1, hp: 1, atkSpd: 1, lifesteal: 1, regen: 1 };
  if (!inDump(state)) return out;
  if (state.dump.mode === 'weekly') {
    const rule = weeklyRule(state.dump.weekly.week);
    out.atk *= rule.atkMult;
    out.hp *= rule.hpMult;
    return out;
  }
  const grit = 1 + gritPct(state) / 100;
  out.atk *= grit;
  out.hp *= grit;
  const s = stenchAt(state.dump.stench);
  out.atkSpd *= Math.max(0.1, 1 - s.atkSpdCutPct / 100);
  out.lifesteal *= Math.max(0, 1 - s.lifestealCutPct / 100);
  out.regen *= Math.max(0, 1 - s.regenCutPct / 100);
  out.hp *= Math.max(0.1, 1 - s.hpCutPct / 100);
  return out;
}

/** Gold multiplier in the Dump: Gold Rush, Stench, the Weekly Dive. */
export function dumpGoldMult(state: Pick<GameState, 'battle' | 'dump' | 'legend'> & Partial<Pick<GameState, 'heist'>>): number {
  if (!inDump(state)) return 1;
  let m = currentTwist(state) === 'goldRush' ? E().twists.goldRush.goldMult : 1;
  if (state.dump.mode === 'weekly') m *= weeklyRule(state.dump.weekly.week).goldMult;
  else m *= stenchRewardMult(state.dump.stench);
  return m;
}

/** XP multiplier in the Dump (Stench). */
export function dumpXpMult(state: Pick<GameState, 'battle' | 'dump'> & Partial<Pick<GameState, 'heist'>>): number {
  return inEndless(state) ? stenchRewardMult(state.dump.stench) : 1;
}

/** Luck multiplier in the Dump (a Lucky Floor). */
export function dumpLuckMult(state: Pick<GameState, 'battle' | 'dump' | 'legend'> & Partial<Pick<GameState, 'heist'>>): number {
  return currentTwist(state) === 'lucky' ? E().twists.lucky.luckMult : 1;
}

/** Trash Bags multiplier per wave in the Dump (a Piñata Party). */
export function dumpBagMult(state: Pick<GameState, 'battle' | 'dump' | 'legend'> & Partial<Pick<GameState, 'heist'>>): number {
  return currentTwist(state) === 'pinata' ? E().twists.pinata.bagMult : 1;
}

// ------------------------------------------------------------------ rarity tiers past Grail

/** The floor (deepest ever) that opens a rarity, or null for one open from the start. */
export function tierFloor(r: Rarity): number | null {
  return (E().tierFloors as Partial<Record<Rarity, number>>)[r] ?? null;
}

/** The rarest tier the dumpster can roll for this raccoon. */
export function topRarity(state: Pick<GameState, 'dump'>): Rarity {
  let top: Rarity = CLASSIC_TOP as Rarity;
  for (const r of RARITIES) {
    const f = tierFloor(r);
    if (f !== null && state.dump.bestEver >= f && rarityAtLeast(r, top)) top = r;
  }
  return top;
}

/** The next tier to open, and where. */
export function nextTier(state: Pick<GameState, 'dump'>): { rarity: Rarity; floor: number } | null {
  for (const r of RARITIES) {
    const f = tierFloor(r);
    if (f !== null && state.dump.bestEver < f) return { rarity: r, floor: f };
  }
  return null;
}

// ------------------------------------------------------------------ travel

/**
 * Into the Dump: its endless floors (where he left off, at most one past his best this run), or this
 * week's Weekly Dive (where it stands). Not before World 20 falls, nor on a heist.
 */
export function enterDump(d: GameState, mode: 'endless' | 'weekly', ev: CoreEvent[], start: (world: number, push: boolean) => void): boolean {
  if (d.heist?.run || !endlessOpen(d)) return false;
  const floor = mode === 'weekly' ? d.dump.weekly.floor : entryFloor(d);
  const world = dumpWorld(floor);
  if (d.dump.mode === mode && d.battle.stage === world && d.stage.chosen) return false;
  d.dump.mode = mode;
  const s = d.stage;
  s.chosen = true;
  if (!isDump(d.battle.stage)) s.returnTo = d.battle.stage;
  const push = mode === 'weekly' ? floor > d.dump.weekly.best : world > s.highestCleared;
  s.mode = push ? 'push' : 'farm';
  s.powerAtDeath = null;
  s.showToughHint = false;
  s.losses = 0;
  d.dump.attemptAtMs = d.playTimeMs;
  ev.push({ type: 'dumpEnter', mode, floor });
  start(world, push);
  return true;
}

// ------------------------------------------------------------------ in the battle

/**
 * A wave walks in on a Dump floor: the twist reshapes it (a swarm doubles it, giants replace it),
 * Stench toughens it, and a gate boss gets its moves. `nextUid` hands out uids for added enemies.
 */
export function dumpFoes(d: GameState, wave: EnemyState[], rng: Rng, nextUid: () => number): EnemyState[] {
  if (!inDump(d)) return wave;
  const world = d.battle.stage;
  const floor = floorOf(world);
  const twist = currentTwist(d);
  const st = stenchFx(d);
  const tw = E().twists;
  let out = wave;
  const regulars = out.filter((e) => e.kind === 'regular');
  if (regulars.length > 0) {
    const roster = worldDef(world).enemies;
    const add = (n: number) => {
      for (let i = 0; i < n; i++) {
        const foe = rng.pick(roster);
        out.push(makeEnemy(DATA.enemiesById.get(foe.id)!, world, nextUid(), false));
      }
    };
    if (st.extraEnemies > 0) add(st.extraEnemies);
    if (twist === 'swarm') {
      add(Math.round(out.length * (tw.swarm.countMult - 1)));
      for (const e of out) {
        e.hp *= tw.swarm.hpMult;
        e.maxHp = e.hp;
      }
    } else if (twist === 'giants') {
      const total = out.reduce((a, e) => a + e.maxHp, 0) / out.length;
      out = out.slice(0, tw.giants.count);
      for (const e of out) {
        e.hp = total * tw.giants.hpMult;
        e.maxHp = e.hp;
        e.atk *= 1.6;
        e.giant = true;
      }
    }
  }
  for (const e of out) {
    e.hp *= 1 + st.enemyHpPct / 100;
    e.maxHp = e.hp;
    e.atk *= 1 + st.enemyAtkPct / 100;
    e.atkSpd *= 1 + st.enemyAtkSpdPct / 100;
    if (e.kind === 'boss' && d.dump.mode === 'endless') e.moves = gateMoves(floor, st.gateMoves);
    else if (e.kind === 'boss') e.moves = gateMoves(floor);
  }
  return out;
}

/** Play time on the frontier floor counts toward Grit (endless floors only). */
export function dumpTick(d: GameState, dtMs: number): void {
  if (!inEndless(d) || d.battle.phase === 'idle') return;
  if (d.battle.stage >= d.stage.highestCleared) d.dump.stuckMs += dtMs;
}

export interface FloorClear {
  floor: number;
  gate: boolean;
  /** Beaten for the first time this run (endless) or this week (weekly). */
  firstTime: boolean;
}

/**
 * A Dump floor is clear. Endless: the run's best moves on (it counts for rebirths), the deepest floor
 * ever and the records too, a gate pays gems, a loaf and a Luck Potion the first time, new floors earn
 * Legend Stars toward the next Legend, and new rarity tiers open. Weekly: its own best, and its rewards.
 * Then on to the next floor at once (`start`).
 */
export function onFloorCleared(
  d: GameState, ev: CoreEvent[], start: (world: number, push: boolean) => void, potion: () => void,
): FloorClear {
  const world = d.battle.stage;
  const floor = floorOf(world);
  const gate = isGate(floor);
  let firstTime: boolean;
  if (d.dump.mode === 'weekly') {
    const w = d.dump.weekly;
    firstTime = floor > w.best;
    if (firstTime) w.best = floor;
    for (const r of BAL.weekly.rewards) {
      if (w.best >= r.floor && !w.paid.includes(r.floor)) {
        w.paid.push(r.floor);
        d.currencies.gems += r.gems;
        d.legend.stars += r.stars;
        d.legend.earned += r.stars;
        ev.push({ type: 'weeklyReward', floor: r.floor, gems: r.gems, stars: r.stars });
      }
    }
    w.floor = floor + 1;
  } else {
    const s = d.stage;
    firstTime = world > s.highestCleared;
    if (firstTime) {
      s.highestCleared = world;
      if (d.heist) d.heist.bestWorld = Math.max(d.heist.bestWorld, world);
      d.dump.stuckMs = 0;
    }
    // Legend Stars for floors new this Legend run (worth more under Stench).
    const L = d.legend;
    if (floor > L.runDeepest) {
      L.runFloorStars += (floor - L.runDeepest) * BAL.legend.starsPerFloor * stenchStarMult(d.dump.stench);
      L.runDeepest = floor;
    }
    const rec = d.dump.records;
    rec.stench[d.dump.stench] = Math.max(rec.stench[d.dump.stench] ?? 0, floor);
    for (let i = 0; i < rec.stench.length; i++) rec.stench[i] ??= 0;
    if (gate) {
      const ms = d.playTimeMs - d.dump.attemptAtMs;
      if (firstTime && ms > 0 && (rec.fastestGateMs === null || ms < rec.fastestGateMs)) {
        const first = rec.fastestGateMs === null;
        rec.fastestGateMs = ms;
        if (!first) ev.push({ type: 'dumpRecord', kind: 'fastestGate', value: ms });
      }
      // A loaf for each gate's first fall this run (perks open), like a world's boss.
      earnBread(d, world, ev);
    }
    if (floor > d.dump.bestEver) {
      const before = d.dump.bestEver;
      d.dump.bestEver = floor;
      const gems = E().floorGems + (gate ? E().gate.gems + E().gate.gemsPerGate * gateNumber(floor) : 0);
      d.currencies.gems += gems;
      if (gate) potion();
      ev.push({ type: 'dumpDeepest', floor, gems });
      for (const m of E().milestones) {
        if (before < m && floor >= m && !rec.milestones.includes(m)) {
          rec.milestones.push(m);
          ev.push({ type: 'dumpRecord', kind: 'milestone', value: m });
        }
      }
      for (const r of RARITIES) {
        const f = tierFloor(r);
        if (f !== null && before < f && floor >= f) ev.push({ type: 'tierUnlocked', rarity: r, floor: f });
      }
    }
    d.dump.floor = floor + 1;
  }
  d.lifetime.bossesBeaten += gate ? 1 : 0;
  ev.push({ type: 'floorClear', floor, gate, firstTime, mode: d.dump.mode });
  if (gate) ev.push({ type: 'bossWin', stage: world });
  d.dump.attemptAtMs = d.playTimeMs;
  const next = world + 1;
  const push = d.dump.mode === 'weekly' ? floorOf(next) > d.dump.weekly.best : next > d.stage.highestCleared;
  d.stage.mode = push ? 'push' : 'farm';
  d.stage.losses = 0;
  d.stage.showToughHint = false;
  start(next, push);
  return { floor, gate, firstTime };
}

/**
 * Knocked out on a Dump floor: he tries it again; after `lossesBeforeBack` in a row, one floor back
 * (never out of the Dump on his own), and the floor after that brings him right back to try again.
 */
export function onDumpDeath(d: GameState, _ev: CoreEvent[], start: (world: number, push: boolean) => void): void {
  const s = d.stage;
  const world = d.battle.stage;
  s.showToughHint = d.dumpster.beginner.state === 'done';
  s.losses += 1;
  if (s.losses < E().lossesBeforeBack || floorOf(world) <= 1) {
    if (s.losses >= E().lossesBeforeBack) s.losses = 0;
    start(world, true);
    return;
  }
  s.losses = 0;
  s.mode = 'farm';
  if (d.dump.mode === 'weekly') d.dump.weekly.floor = floorOf(world - 1);
  else d.dump.floor = floorOf(world - 1);
  start(world - 1, false);
}

/**
 * A new week: the Weekly Dive starts over at Floor 1. On the old week's ladder when it changes, the
 * raccoon goes back to his endless floors (`start`).
 */
export function refreshWeekly(d: GameState, now: number, start: (world: number, push: boolean) => void): void {
  const wk = weekKey(now);
  const w = d.dump.weekly;
  if (w.week === wk) return;
  const was = inWeekly(d);
  w.week = wk;
  w.floor = 1;
  w.best = 0;
  w.paid = [];
  if (d.dump.mode !== 'weekly') return;
  d.dump.mode = 'endless';
  if (!was) return;
  const world = dumpWorld(entryFloor(d));
  d.stage.mode = world > d.stage.highestCleared ? 'push' : 'farm';
  start(world, d.stage.mode === 'push');
}
