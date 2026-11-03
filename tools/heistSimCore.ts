/**
 * Headless heist balance: plays whole heist runs with the real core logic and a bot that decides
 * like a sensible (not perfect) player, on raccoons taken from the main balance simulator.
 *
 * The bot: takes an offered evolution, otherwise the perk it rates best (tank, speed and crit first,
 * loot last; a little noise so it isn't a perfect drafter); picks choice options by a rough value of
 * their outcomes (a quarter of the time it just picks one at random); at a shop it heals when hurt,
 * then buys the best perk it can afford; accepts a shrine when healthy; always spins the wheel.
 * `revive` decides whether it takes the free Second Chance.
 */
import {
  heistChoose, heistClaim, heistDecline, heistEventDef, heistGo, heistLeaveShop, heistOptionAvailable,
  heistRevive, heistTick, perkDef, Rng, startHeist, TICK_SECONDS, type CoreEvent, type GameState, type HeistRun,
} from '../src/core';
import { BAL, type LocationId, type OutcomeDef } from '../src/data';

export interface HeistSimOptions {
  /** The raccoon to send (cloned per run). */
  state: GameState;
  location: LocationId;
  runs: number;
  seed: number;
  /** Take the free Second Chance (default false: the bare win rate). */
  revive?: boolean;
  /** Count the run as the location's first (wins reset), or as a later one (one win already). */
  first?: boolean;
}

export interface HeistSimResult {
  runs: number;
  wins: number;
  winRate: number;
  /** Where losses happened: act 1, 2, 3, and at the boss. */
  lostAt: [number, number, number, number];
  revives: number;
  avgSeconds: number;
  avgPerks: number;
  avgLevel: number;
  avgHpLeft: number;
  bags: number;
  coins: number;
}

const TAG_SCORE: Record<string, number> = { tank: 9, speed: 8, crit: 7, fire: 6, crew: 6, chaos: 5, loot: 2 };
const RARITY_SCORE: Record<string, number> = { common: 0, rare: 3, epic: 6, evolution: 20 };

function perkScore(id: string, rng: Rng): number {
  const p = perkDef(id);
  if (!p) return 0;
  return (TAG_SCORE[p.tag] ?? 4) + (RARITY_SCORE[p.rarity] ?? 0) + rng.float(0, 4);
}

function outcomeValue(o: OutcomeDef, run: HeistRun): number {
  const hp = run.hp / Math.max(1, run.maxHp);
  const v = o.value ?? 0;
  switch (o.type) {
    case 'healPct':
      return (Math.min(v / 100, 1 - hp) * 100) / 3;
    case 'damagePct':
      return -(v / 3) * (hp < 0.5 ? 3 : 1);
    case 'maxHpPct':
      return v / 2;
    case 'gainPerk':
      return run.perks.length < BAL.heist.maxPerks ? 12 : 1;
    case 'gainCurse':
      return -10;
    case 'runCoins':
      return v / 4;
    case 'trashBags':
      return v / 3;
    case 'fight':
      return hp < 0.5 ? -8 : 2;
    case 'eliteFight':
      return hp < 0.65 ? -14 : -1;
    case 'skipNext':
      return 2;
    case 'skipFight':
    case 'truce':
      return 5;
    case 'openShop':
      return run.coins >= 25 ? 5 : 0;
    case 'treasure':
      return 6;
    case 'jackpotWheel':
      return 7;
    case 'noTraps':
      return 2;
    case 'savedHeal':
      return v / 4;
    case 'nothing':
      return 0;
  }
}

function chooseOption(run: HeistRun, rng: Rng): number {
  if (run.pending?.kind !== 'choice') return 0;
  const ev = heistEventDef(run.pending.eventId)!;
  const ok = ev.options.map((_, i) => i).filter((i) => heistOptionAvailable(run, i));
  if (ok.length === 0) return 0;
  if (rng.chance(0.25)) return rng.pick(ok);
  let best = ok[0];
  let bestV = -Infinity;
  for (const i of ok) {
    let v = 0;
    for (const o of ev.options[i].outcomes) v += outcomeValue(o, run) * (o.chance ?? 1);
    v += rng.float(0, 2);
    if (v > bestV) {
      bestV = v;
      best = i;
    }
  }
  return best;
}

/** One decision for the pending prompt. Returns false if nothing could be done. */
function decide(d: GameState, rng: Rng, ev: CoreEvent[]): boolean {
  const run = d.heist.run!;
  const p = run.pending!;
  switch (p.kind) {
    case 'perk': {
      let best = 0;
      let bestV = -Infinity;
      p.options.forEach((o, i) => {
        const v = o.evolution ? 100 : perkScore(o.id, rng);
        if (v > bestV) {
          bestV = v;
          best = i;
        }
      });
      return heistChoose(d, best, rng, ev);
    }
    case 'choice':
      return heistChoose(d, chooseOption(run, rng), rng, ev);
    case 'wheel':
      return heistChoose(d, 0, rng, ev);
    case 'shrine':
      return heistChoose(d, run.hp / run.maxHp > 0.6 && run.perks.length < BAL.heist.maxPerks ? 0 : 1, rng, ev);
    case 'shop': {
      const hp = run.hp / run.maxHp;
      const stock = p.stock;
      const heal = stock.findIndex((s) => s.kind === 'heal' && !s.sold);
      if (heal >= 0 && hp < 0.6 && run.coins >= stock[heal].price && heistChoose(d, heal, rng, ev)) return true;
      const curse = stock.findIndex((s) => s.kind === 'removeCurse' && !s.sold);
      if (curse >= 0 && run.coins >= stock[curse].price && heistChoose(d, curse, rng, ev)) return true;
      const perks = stock
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.kind === 'perk' && !s.sold && run.coins >= s.price && run.perks.length < BAL.heist.maxPerks)
        .sort((a, b) => perkScore(b.s.id, rng) - perkScore(a.s.id, rng));
      if (perks.length > 0 && heistChoose(d, perks[0].i, rng, ev)) return true;
      return heistLeaveShop(d, rng);
    }
  }
}

/** Plays one run to its end. */
function playRun(base: GameState, opts: HeistSimOptions, rng: Rng, out: HeistSimResult): void {
  const d = structuredClone(base);
  d.heist.tickets = 1;
  d.heist.run = null;
  d.heist.wins[opts.location] = opts.first ? 0 : Math.max(1, d.heist.wins[opts.location]);
  // The harness may try a location before the raccoon opens it (difficulty follows the raccoon anyway).
  d.heist.bestWorld = Math.max(d.heist.bestWorld, 20);
  const now = Date.UTC(2026, 0, 5, 12, 0, 0);
  const ev: CoreEvent[] = [];
  if (!startHeist(d, opts.location, rng, now, ev)) throw new Error('heist did not start');
  let seconds = 0;
  for (let guard = 0; guard < 200_000; guard++) {
    const run = d.heist.run!;
    ev.length = 0;
    if (run.status === 'won' || run.status === 'lost') {
      const won = run.status === 'won';
      out.wins += won ? 1 : 0;
      out.avgPerks += run.perks.length + run.absorbed.length;
      out.avgLevel += run.level;
      if (won) out.avgHpLeft += run.hp / run.maxHp;
      if (!won) {
        const at = run.act === 3 && run.index >= BAL.heist.nodesPerAct ? 3 : run.act - 1;
        out.lostAt[at] += 1;
      }
      const before = { bags: d.currencies.bags, coins: d.currencies.coins };
      heistClaim(d, rng, now, ev);
      out.bags += d.currencies.bags - before.bags;
      out.coins += d.currencies.coins - before.coins;
      out.avgSeconds += seconds;
      return;
    }
    if (run.status === 'secondChance') {
      if (opts.revive) {
        out.revives += 1;
        heistRevive(d, 'ad', ev);
      } else heistDecline(d);
      continue;
    }
    if (run.pending) {
      if (!decide(d, rng, ev)) throw new Error(`stuck on ${run.pending.kind}`);
      continue;
    }
    if (run.status === 'ready' && d.battle.phase !== 'walking') {
      heistGo(d, rng, ev);
      continue;
    }
    heistTick(d, rng, now, ev, TICK_SECONDS);
    seconds += TICK_SECONDS;
  }
  throw new Error('run did not finish');
}

export function simulateHeists(opts: HeistSimOptions): HeistSimResult {
  const out: HeistSimResult = {
    runs: opts.runs, wins: 0, winRate: 0, lostAt: [0, 0, 0, 0], revives: 0, avgSeconds: 0, avgPerks: 0,
    avgLevel: 0, avgHpLeft: 0, bags: 0, coins: 0,
  };
  const rng = new Rng(Rng.hashSeed(opts.seed));
  for (let i = 0; i < opts.runs; i++) playRun(opts.state, opts, rng, out);
  out.winRate = out.wins / opts.runs;
  out.avgSeconds /= opts.runs;
  out.avgPerks /= opts.runs;
  out.avgLevel /= opts.runs;
  out.avgHpLeft /= Math.max(1, out.wins);
  return out;
}
