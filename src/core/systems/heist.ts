/**
 * Heists (spec section 9): roguelite runs at three locations, played in the battle view.
 *
 * A run costs a ticket (3 a day at local midnight, up to 6, one more a day from an ad). It is 3 acts
 * of 6 stops, then the location's boss. The player taps Go for each stop: fights play in the battle
 * with the Alley's combat code (fightStep) at 2x speed, and choices, shops, shrines and the Jackpot
 * Wheel wait for an answer (`pending`). Run HP carries over from stop to stop. Fights give run XP
 * (level-ups offer perks) and run coins (spent at shops). A win pays Trash Bags, gold, Gems and a
 * Luck Potion; a knockout offers a Second Chance once, and a lost run keeps half of what it collected.
 *
 * While a run is on, `state.battle` is the run's battle (the location's world look, its enemies, the
 * run's HP); the main battle waits untouched in `run.main` and comes back when the run ends.
 */
import {
  BAL, DATA, HEIST_ROLLED_KINDS, LOCATION_IDS, PERK_EFFECT_KEYS, STAT_IDS,
  type EnemyDef, type HeistEventDef, type HeistLocationDef, type HeistNodeKind, type HeistTrapDef, type LocationId, type OutcomeDef,
  type PerkDef, type PerkEffectKey, type PerkTag,
} from '../../data';
import { Rng } from '../rng';
import type { BattleState, EnemyState, GameState, HeistFight, HeistLogLine, HeistRewards, HeistRun, ShopItem } from '../state';
import { dayKey, MS_PER_MINUTE } from '../time';
import type { CoreEvent, Item, Stats } from '../types';
import { clamp, snap } from '../util';
import { computeDamage, enemySpecials, fightStep, type Ctx, type RunCombat } from './combat';
import { registerCodex } from './codex';
import { rollItemLevel } from './dumpster';
import { combatEffects } from './enchants';
import { createItem } from './loot';
import { currentLuck, rollRarity } from './luck';
import { currentRate } from './offline';
import { rebirthRequirement } from './rebirth';
import { addLuckBoost, addToBag, goldMult, potionSeconds } from './roller';
import { defConstant, growth, worldCount } from './stages';
import { topRarity } from './endless';
import { computeStats, zeroStats } from './stats';
import { itemTierFor } from './worlds';

const H = BAL.heist;

export type PerkOffer = { id: string; evolution?: boolean };
type OfferRarity = 'common' | 'rare' | 'epic';
const OFFER_RARITIES: readonly OfferRarity[] = ['common', 'rare', 'epic'];

// ------------------------------------------------------------------ data accessors (for the UI)

export function heistLocations(): readonly HeistLocationDef[] {
  return DATA.heistLocations;
}

export function heistLocation(id: LocationId): HeistLocationDef {
  return DATA.heistLocationsById.get(id)!;
}

/** A perk or evolution (name, tag, rarity, text, recipe). */
export function perkDef(id: string): PerkDef | undefined {
  return DATA.heistPerksById.get(id);
}

export function curseDef(id: string) {
  return DATA.heistCursesById.get(id);
}

/** A choice event (text, options with labels and outcomes). */
export function heistEventDef(id: string): HeistEventDef | undefined {
  return DATA.heistEventsById.get(id);
}

/** Display name of the enemy a location ends with. */
export function heistBossName(id: LocationId): string {
  return DATA.enemiesById.get(heistLocation(id).boss)?.name ?? '';
}

/** Cumulative run XP to reach run level `level` (Infinity past the top level). */
export function heistLevelXp(level: number): number {
  if (level <= 1) return 0;
  return H.levels[level - 2] ?? Infinity;
}

/** The highest run level. */
export function heistMaxLevel(): number {
  return H.levels.length + 1;
}

// ------------------------------------------------------------------ access and tickets

/**
 * Heists open with the first rebirth (`unlockRebirths`), so a new game has less going on at once.
 * Tickets keep coming meanwhile; only starting a run and the ad ticket wait for it.
 */
export function heistsOpen(state: Pick<GameState, 'rebirths'> & Partial<Pick<GameState, 'legend'>>): boolean {
  // (After a Legend they stay open.)
  return state.rebirths >= H.unlockRebirths || (state.legend?.count ?? 0) > 0;
}

/** The best world ever beaten, across rebirths (a rebirth proves its required world was beaten). */
export function bestWorldEver(state: Pick<GameState, 'heist' | 'stage' | 'rebirths'>): number {
  const floor = state.rebirths > 0 ? rebirthRequirement(state.rebirths - 1).world : 0;
  return Math.max(state.heist?.bestWorld ?? 0, state.stage.highestCleared, floor);
}

export function locationUnlocked(state: Pick<GameState, 'heist' | 'stage' | 'rebirths'>, id: LocationId): boolean {
  const loc = DATA.heistLocationsById.get(id);
  return !!loc && bestWorldEver(state) >= loc.unlockWorld;
}

/** Local days from day key `a` to day key `b` ("2026-11-02"). */
function daysBetween(a: string, b: string): number {
  const at = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  return Math.round((at(b) - at(a)) / 86_400_000);
}

/**
 * The daily tickets: every local midnight passed adds `perDay` (never past `max`). A clock that went
 * back gives nothing until the day comes round again.
 */
export function refreshTickets(d: GameState, now: number, ev: CoreEvent[]): void {
  const h = d.heist;
  const today = dayKey(now);
  if (h.ticketDay === today) return;
  if (h.ticketDay === '') {
    // Right after the save migration: the starting tickets were today's.
    h.ticketDay = today;
    return;
  }
  const days = daysBetween(h.ticketDay, today);
  if (!(days > 0)) return;
  const before = h.tickets;
  h.tickets = Math.max(h.tickets, Math.min(H.tickets.max, h.tickets + H.tickets.perDay * days));
  h.ticketDay = today;
  if (h.tickets !== before) ev.push({ type: 'heistTickets', tickets: h.tickets });
}

/** Whether the once-a-day ad ticket can be watched now. */
export function heistAdTicketAvailable(state: Pick<GameState, 'heist'>, now: number): boolean {
  const h = state.heist;
  return H.tickets.adPerDay > 0 && h.adTicketDay !== dayKey(now) && h.tickets < H.tickets.max;
}

/**
 * The daily bonus ticket: once a day, for a rewarded ad or (`via: 'gems'`, the alternative CrazyGames asks
 * every rewarded ad to have) tickets.bonusGems Gems. Either way it is the day's one bonus ticket.
 */
export function heistAdTicket(d: GameState, now: number, ev: CoreEvent[], via: 'ad' | 'gems' = 'ad'): boolean {
  refreshTickets(d, now, ev);
  if (!heistAdTicketAvailable(d, now)) return false;
  if (via === 'gems') {
    if (d.currencies.gems < H.tickets.bonusGems) return false;
    d.currencies.gems -= H.tickets.bonusGems;
  }
  d.heist.tickets += 1;
  d.heist.adTicketDay = dayKey(now);
  ev.push({ type: 'heistTickets', tickets: d.heist.tickets });
  return true;
}

export function canStartHeist(state: GameState, id: LocationId): boolean {
  return !state.heist.run && state.heist.tickets >= 1 && locationUnlocked(state, id);
}

// ------------------------------------------------------------------ the run's numbers

/** Sum of every perk (absorbed ones included) and curse effect the run holds. */
export function runEffects(run: Pick<HeistRun, 'perks' | 'absorbed' | 'curses'>): Record<PerkEffectKey, number> {
  const out = Object.fromEntries(PERK_EFFECT_KEYS.map((k) => [k, 0])) as Record<PerkEffectKey, number>;
  const add = (effect: Partial<Record<PerkEffectKey, number>>) => {
    for (const k of Object.keys(effect) as PerkEffectKey[]) out[k] += effect[k] ?? 0;
  };
  for (const id of run.perks) add(DATA.heistPerksById.get(id)?.effect ?? {});
  for (const id of run.absorbed) add(DATA.heistPerksById.get(id)?.effect ?? {});
  for (const id of run.curses) add(DATA.heistCursesById.get(id)?.effect ?? {});
  return out;
}

/** The raccoon's stats in the run: its own stats x heist.scaling, then perks, curses and shrines. HP is max HP. */
export function runStats(state: GameState, run: HeistRun): Stats {
  const base = computeStats(state);
  const fx = runEffects(run);
  const s = zeroStats();
  for (const k of STAT_IDS) s[k] = base[k] * H.scaling[k];
  s.HP = Math.max(1, s.HP * Math.max(0.1, 1 + (fx.hpPct + run.maxHpPct) / 100));
  s.ATK_SPD *= Math.max(0.1, 1 + fx.atkSpdPct / 100);
  s.DODGE += fx.dodge;
  s.CRIT += fx.crit;
  s.CRIT_DMG += fx.critDmg;
  const caps = BAL.player.caps;
  s.CRIT = Math.min(s.CRIT, caps.CRIT);
  s.DODGE = Math.min(s.DODGE, caps.DODGE);
  s.ATK_SPD = Math.min(s.ATK_SPD, caps.ATK_SPD);
  return s;
}

/** The main battle: waiting in the run while a heist is on, otherwise `state.battle`. */
export function mainBattle(state: Pick<GameState, 'battle' | 'heist'>): BattleState {
  return state.heist?.run?.main ?? state.battle;
}

/**
 * The stats behind what the battle view shows: the run's stats during a heist (attack speed times the
 * fight speed while a fight is on), the raccoon's own otherwise. For the hero's HP bar and swing speed.
 */
export function battleStats(state: GameState): Stats {
  const run = state.heist?.run;
  if (!run) return computeStats(state);
  const s = runStats(state, run);
  if (run.status === 'fighting') s.ATK_SPD *= H.fightSpeed;
  return s;
}

/** Max HP for the battle view's hero bar (the run's during a heist). */
export function battleMaxHp(state: GameState): number {
  return state.heist?.run ? state.heist.run.maxHp : computeStats(state).HP;
}

/** Gems for the next perk reroll (0: the run's free one). */
export function rerollCost(run: Pick<HeistRun, 'rerollsUsed'>): number {
  return run.rerollsUsed < H.rerolls.free ? 0 : H.rerolls.gems;
}

/** What banking the run would pay now: its rewards, Garbage Day's bonus on the Trash Bags included. */
export function heistPayout(run: HeistRun): HeistRewards {
  const fx = runEffects(run);
  const r = run.rewards;
  return {
    bags: Math.floor(r.bags * (1 + fx.bagPct / 100)),
    coins: Math.floor(r.coins),
    gems: Math.floor(r.gems),
    potion: r.potion,
    ring: r.ring,
  };
}

/** What a win at this location pays (before Garbage Day), for a raccoon at the run's world. */
export function heistWinRewards(state: GameState, id: LocationId, tier = heistTier(state)): Omit<HeistRewards, 'ring'> {
  const L = H.locations[id];
  return { bags: L.bags, coins: Math.round(L.coins * growth(BAL.worlds.goldGrowth, tier) * goldMult(state)), gems: L.gems, potion: true };
}

/**
 * How the raccoon (its run stats, before perks) stacks up one on one against enemy `def` in
 * (fractional) world `tier` with HP and ATK multiplied by `hpMult` and `atkMult`: (your HP x your
 * DPS) / (its HP x its DPS), with lifesteal, regen, dodge, the gear's echo, burn and thorns, boss
 * damage (against elites and bosses) and its specials counted. Under 1 the enemy wins.
 * Blows are discrete: an enemy's first lands a full attack interval after it steps up, so it only
 * hurts for the time it lives past that. (A raccoon that kills fast takes far less than its DPS
 * suggests; one that is all HP, more.)
 */
function oneOnOne(state: GameState, def: EnemyDef, tier: number, hpMult: number, atkMult: number): number {
  const base = computeStats(state);
  const sc = H.scaling;
  const hp = base.HP * sc.HP;
  const atk = base.ATK * sc.ATK;
  const crit = Math.min(base.CRIT * sc.CRIT, BAL.player.caps.CRIT) / 100;
  const critAvg = 1 + crit * ((base.CRIT_DMG * sc.CRIT_DMG) / 100 - 1);
  const dodge = Math.min(base.DODGE * sc.DODGE, BAL.player.caps.DODGE) / 100;
  const g = BAL.worlds.enemyGrowth;
  const k = defConstant(tier);
  const foeHp = def.hp * growth(g.hp, tier) * hpMult;
  const fx = combatEffects(state);
  const bonus = def.kind === 'regular' ? 1 : 1 + (base.BOSS_DMG * sc.BOSS_DMG) / 100;
  const hitDps = computeDamage(atk, def.def * growth(g.def, tier), false, 100, 1, k) * critAvg * base.ATK_SPD * sc.ATK_SPD * bonus * (1 + fx.echo);
  const hit = computeDamage(def.atk * growth(g.atk, tier) * atkMult, base.DEF * sc.DEF, false, 100, 1, k);
  let theirDps = hit * def.atkSpd * (1 - dodge);
  for (const sp of enemySpecials(def)) {
    if (sp.type === 'heavyHit') theirDps += ((hit * sp.damageMult) / sp.everySeconds) * (1 - dodge);
    else if (sp.type === 'charge') theirDps += (hit * sp.damageMult) / sp.everySeconds;
    else if (sp.type === 'enrage') theirDps *= 1 + (sp.belowHpPct / 100) * (sp.atkMult * sp.atkSpdMult - 1);
  }
  // Burns tick between hits; thorns hand back part of every hit taken.
  const yourDps = hitDps + atk * fx.burn * bonus + fx.thorns * theirDps * bonus;
  const sustain = ((base.LIFESTEAL * sc.LIFESTEAL) / 100) * hitDps + base.REGEN * sc.REGEN;
  const time = foeHp / Math.max(1e-9, yourDps);
  const exposed = Math.max(time * 0.15, time - 1 / def.atkSpd);
  return hp / (Math.max(1e-9, theirDps) * exposed) + sustain / Math.max(1e-9, theirDps);
}

/**
 * How a raccoon (before perks) matches up with a run in (fractional) world `tier`, before the
 * location's difficulty: the geometric mean of its one-on-one margins against a run's boss (the Pizza
 * Place's, with act 3's multiplier) and against one of its regular enemies (act 2's). The boss decides
 * most runs; the regular fights wear the raccoon down on the way.
 */
export function heistMargin(state: GameState, tier: number): number {
  const E = H.enemies;
  const pizza = heistLocation('pizza');
  const boss = DATA.enemiesById.get(pizza.boss)!;
  const foe = DATA.enemiesById.get(pizza.enemies[0])!;
  const a3 = H.actMult[2];
  const a2 = H.actMult[1];
  const vsBoss = oneOnOne(state, boss, tier, E.hpMult * E.boss.hpMult * a3, E.atkMult * E.boss.atkMult * a3);
  const vsFoe = oneOnOne(state, foe, tier, E.hpMult * a2, E.atkMult * a2);
  return Math.sqrt(vsBoss * vsFoe);
}

/**
 * The "heist world" a run started now scales its enemies and its gold from: the fractional world
 * where heistMargin comes to heist.enemies.refMargin. So a raccoon that has just scraped past a world
 * and one that has farmed it for an hour both get a fair run, and a stronger raccoon meets tougher
 * enemies and is paid more. (Each location's difficulty goes on top.)
 */
export function heistTier(state: GameState): number {
  const ref = H.enemies.refMargin;
  // Below World 1 for a raccoon too green for it (enemies and gold keep shrinking the same way).
  let lo = -3;
  // (Deep in the Endless Dump, heists keep up: its floors count as worlds.)
  let hi = Math.max(worldCount(), state.stage.highestCleared);
  if (heistMargin(state, lo) <= ref) return lo;
  if (heistMargin(state, hi) >= ref) return hi;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (heistMargin(state, mid) >= ref) lo = mid;
    else hi = mid;
  }
  return lo;
}

// ------------------------------------------------------------------ helpers

function log(run: HeistRun, key: string, params?: Record<string, string | number>): void {
  const line: HeistLogLine = params ? { key, params } : { key };
  run.log.push(line);
  if (run.log.length > H.logMax) run.log.splice(0, run.log.length - H.logMax);
}

function locationOf(run: HeistRun): HeistLocationDef {
  return heistLocation(run.location);
}

function setHp(d: GameState, run: HeistRun, hp: number): void {
  run.hp = clamp(hp, 0, run.maxHp);
  d.battle.playerHp = run.hp;
}

/** Keeps the run's max HP in step with the raccoon (gear swaps, perks); max HP gained comes with HP. */
function syncMaxHp(d: GameState, run: HeistRun, stats: Stats = runStats(d, run)): void {
  run.hp = d.battle.playerHp;
  const max = stats.HP;
  const down = run.status === 'secondChance' || run.status === 'lost';
  if (max > run.maxHp && !down) run.hp += max - run.maxHp;
  run.maxHp = max;
  setHp(d, run, run.hp);
}

function heal(d: GameState, run: HeistRun, pct: number, ev: CoreEvent[]): number {
  const before = run.hp;
  setHp(d, run, run.hp + (run.maxHp * pct) / 100);
  const n = run.hp - before;
  if (n > 0) ev.push({ type: 'heal', amount: n, source: 'heist' });
  return n;
}

/** Damage outside fights (traps, choices, curses) never knocks the raccoon out: it keeps at least 1 HP. */
function hurt(d: GameState, run: HeistRun, pct: number): number {
  const before = run.hp;
  setHp(d, run, Math.max(Math.min(1, before), run.hp - (run.maxHp * pct) / 100));
  return before - run.hp;
}

const isFightKind = (k: HeistNodeKind) => k === 'fight' || k === 'elite';

// ------------------------------------------------------------------ stops

/** One act's stops straight from the act's weights (no guarantees); with `shops` false, never a shop. */
export function rollActNodes(act: number, rng: Rng, shops = true): HeistNodeKind[] {
  const w = H.nodeWeights[act - 1];
  const entries = HEIST_ROLLED_KINDS.map((k) => [k, k === 'shop' && !shops ? 0 : w[k]] as const);
  return Array.from({ length: H.nodesPerAct }, () => rng.weighted(entries));
}

/**
 * Run coins an act needs when it's laid out to get shop stops: the cheapest perk a shop sells. A shop
 * the run can't buy anything in is a wasted stop, so a broke run doesn't meet one (a run starts with
 * fewer, so act 1 has none).
 */
export function shopMinCoins(): number {
  const P = H.shop.prices;
  return Math.min(P.common, P.rare, P.epic);
}

/**
 * Turns one stop from `from` on into `kind` (Bin Diver's treasures, Smelly's fights, the minimum
 * fights). Never a shop, the boss, the run's opening fight, or a stop that already is `kind`.
 */
function convertStop(nodes: HeistNodeKind[], kind: HeistNodeKind, rng: Rng, from: number, act: number): boolean {
  const ok = (k: HeistNodeKind, i: number) =>
    i >= from && k !== kind && k !== 'shop' && k !== 'boss' && !(act === 1 && i === 0) && !(kind === 'treasure' && k === 'golden');
  // Prefer plain stops: a fight is only turned into a treasure when nothing else is left.
  let idx = nodes.map((k, i) => (ok(k, i) && !(kind !== 'fight' && isFightKind(k)) ? i : -1)).filter((i) => i >= 0);
  if (idx.length === 0) idx = nodes.map((k, i) => (ok(k, i) ? i : -1)).filter((i) => i >= 0);
  if (idx.length === 0) return false;
  nodes[rng.pick(idx)] = kind;
  return true;
}

/**
 * An act's stops: rolled from the act's weights; the run opens with a fight; at least `minFights`
 * fights; Bin Diver and Smelly add treasures and fights; a treasure is a Golden Dumpster 1% of the
 * time; act 3 ends with the boss. Shops wait for money: an act laid out while the run's coins are under
 * shopMinCoins gets none, and the run's one sure shop comes in act 2, or in act 3 when act 2 had none.
 */
export function generateAct(run: Pick<HeistRun, 'perks' | 'absorbed' | 'curses' | 'coins' | 'nodes'>, act: number, rng: Rng): HeistNodeKind[] {
  const shops = run.coins >= shopMinCoins();
  const nodes = rollActNodes(act, rng, shops);
  if (act === 1) nodes[0] = 'fight';
  const sureShop = shops && (act === 2 || (act === 3 && !run.nodes[1]?.includes('shop')));
  if (sureShop && !nodes.includes('shop')) {
    let idx = nodes.map((k, i) => (!isFightKind(k) ? i : -1)).filter((i) => i >= 0);
    if (idx.length === 0) idx = nodes.map((_, i) => i);
    nodes[rng.pick(idx)] = 'shop';
  }
  const min = H.minFights[act - 1];
  for (let guard = 0; guard < nodes.length && nodes.filter(isFightKind).length < min; guard++) {
    if (!convertStop(nodes, 'fight', rng, 0, act)) break;
  }
  const fx = runEffects(run);
  for (let i = 0; i < fx.extraTreasures; i++) convertStop(nodes, 'treasure', rng, 0, act);
  for (let i = 0; i < fx.extraFights; i++) convertStop(nodes, 'fight', rng, 0, act);
  for (let i = 0; i < nodes.length; i++) if (nodes[i] === 'treasure' && rng.chance(H.golden.chance)) nodes[i] = 'golden';
  if (act === 3) nodes.push('boss');
  return nodes;
}

/** A perk or curse picked mid-act also changes the act's remaining stops. */
function convertUpcoming(run: HeistRun, kind: HeistNodeKind, times: number, rng: Rng): void {
  const nodes = run.nodes[run.act - 1];
  if (!nodes) return;
  // The stop being played (a choice, a shop) is done; start after it.
  const from = run.status === 'ready' && !run.pending ? run.index : run.index + 1;
  for (let i = 0; i < times; i++) convertStop(nodes, kind, rng, from, run.act);
}

/** The run moves past the current stop (on into the next act after the sixth). */
function completeStop(d: GameState, run: HeistRun, rng: Rng): void {
  run.index += 1;
  if (run.index < run.nodes[run.act - 1].length || run.act >= 3) return;
  run.act = (run.act + 1) as 2 | 3;
  run.index = 0;
  if (run.flags.noTrapsAct !== run.act) run.flags.noTrapsAct = 0;
  run.nodes.push(generateAct(run, run.act, rng));
  log(run, 'heist.log.act', { act: run.act });
  void d;
}

/** The hero walks to the next stop (a fight's enemies arrive at the end of it). */
function walk(d: GameState): void {
  d.battle.phase = 'walking';
  d.battle.phaseTime = BAL.combat.walkSeconds;
  d.battle.enemies = [];
  d.battle.playerAtkProgress = 0;
}

// ------------------------------------------------------------------ perks and curses

/** The perks an evolution would merge right now (null when its recipe isn't held). */
function recipeIngredients(perks: readonly string[], evo: PerkDef): string[] | null {
  const r = evo.recipe;
  if (!r || !r.perks.every((id) => perks.includes(id))) return null;
  const used = [...r.perks];
  if (r.anyTag) {
    const other = perks.find((id) => {
      const p = DATA.heistPerksById.get(id);
      return !!p && !used.includes(id) && p.tag === r.anyTag && !p.recipe;
    });
    if (!other) return null;
    used.push(other);
  }
  return used;
}

/** Evolutions whose recipes the run holds (offered, flagged, at the next perk offer). */
export function availableEvolutions(run: Pick<HeistRun, 'perks'>): string[] {
  return DATA.heistPerks.filter((p) => p.recipe && !run.perks.includes(p.id) && recipeIngredients(run.perks, p)).map((p) => p.id);
}

/** Perks that can be offered (never the shop-only ones), of a rarity, not in `taken`. */
function perkPool(rarity: OfferRarity, taken: ReadonlySet<string>, tag?: PerkTag): PerkDef[] {
  return DATA.heistPerks.filter((p) => p.rarity === rarity && !p.shopOnly && !taken.has(p.id) && (!tag || p.tag === tag));
}

/** The +max HP perks (Thick Fur and the shop-only ones): what a shop's health counter sells. */
const MAX_HP_PERKS: readonly PerkDef[] = DATA.heistPerks.filter((p) => !p.recipe && (p.effect.hpPct ?? 0) > 0);
const MAX_HP_IDS: readonly string[] = MAX_HP_PERKS.map((p) => p.id);

/** A +max HP perk not in `taken`, more often the commoner ones (heist.rarityWeights); null when none is left. */
function rollMaxHpPerk(rng: Rng, taken: ReadonlySet<string>): PerkDef | null {
  const pool = MAX_HP_PERKS.filter((p) => !taken.has(p.id));
  if (pool.length === 0) return null;
  const id = rng.weighted(pool.map((p) => [p.id, Math.max(1, H.rarityWeights[p.rarity as OfferRarity] ?? 1)] as const));
  return DATA.heistPerksById.get(id) ?? null;
}

/** A random perk not in `taken`: rarity by heist.rarityWeights (or `only`), falling back to what is left. */
function rollPerk(rng: Rng, taken: ReadonlySet<string>, only?: OfferRarity, tag?: PerkTag): PerkDef | null {
  let rarity: OfferRarity = only ?? rng.weighted(H.rarityWeights);
  let pool = perkPool(rarity, taken, tag);
  if (pool.length === 0) {
    const left = OFFER_RARITIES.filter((r) => perkPool(r, taken, tag).length > 0);
    if (left.length === 0) return null;
    rarity = rng.weighted(left.map((r) => [r, Math.max(1, H.rarityWeights[r])] as const));
    pool = perkPool(rarity, taken, tag);
  }
  return rng.pick(pool);
}

/**
 * A perk offer: every evolution the run can make (flagged, up to maxEvolutionsPerOffer), then random
 * perks it doesn't hold, up to offerSize. With every slot full only evolutions are offered.
 */
export function makeOffer(run: Pick<HeistRun, 'perks' | 'absorbed'>, rng: Rng, only?: OfferRarity): PerkOffer[] {
  const out: PerkOffer[] = availableEvolutions(run).slice(0, H.maxEvolutionsPerOffer).map((id) => ({ id, evolution: true }));
  if (run.perks.length >= H.maxPerks) return out;
  const taken = new Set([...run.perks, ...run.absorbed, ...out.map((o) => o.id)]);
  while (out.length < H.offerSize) {
    const p = rollPerk(rng, taken, only);
    if (!p) break;
    taken.add(p.id);
    out.push({ id: p.id });
  }
  return out;
}

/** Adds a perk (an evolution merges its recipe into itself). False if it can't be taken. */
export function gainPerk(d: GameState, run: HeistRun, id: string, rng: Rng, ev: CoreEvent[]): boolean {
  const def = DATA.heistPerksById.get(id);
  if (!def || run.perks.includes(id) || run.absorbed.includes(id)) return false;
  if (def.recipe) {
    const used = recipeIngredients(run.perks, def);
    if (!used) return false;
    run.perks = run.perks.filter((p) => !used.includes(p));
    run.absorbed.push(...used);
  } else if (run.perks.length >= H.maxPerks) {
    return false;
  }
  run.perks.push(id);
  ev.push({ type: 'heistPerk', id, evolution: !!def.recipe });
  log(run, def.recipe ? 'heist.log.evolved' : 'heist.log.perk', { perk: def.name });
  syncMaxHp(d, run);
  if (def.effect.extraTreasures) convertUpcoming(run, 'treasure', def.effect.extraTreasures, rng);
  if (def.effect.extraFights) convertUpcoming(run, 'fight', def.effect.extraFights, rng);
  return true;
}

/** Adds a curse (a given one, or a random one not held). Returns its id, or null when none can be added. */
export function gainCurse(d: GameState, run: HeistRun, id: string | undefined, rng: Rng, ev: CoreEvent[]): string | null {
  let pick = id && !run.curses.includes(id) ? id : null;
  if (!pick) {
    const left = DATA.heistCurses.filter((c) => !run.curses.includes(c.id));
    if (left.length === 0) return null;
    pick = rng.pick(left).id;
  }
  const def = DATA.heistCursesById.get(pick);
  if (!def) return null;
  run.curses.push(pick);
  ev.push({ type: 'heistCurse', id: pick, removed: false });
  log(run, 'heist.log.curse', { curse: def.name });
  syncMaxHp(d, run);
  if (def.effect.extraFights) convertUpcoming(run, 'fight', def.effect.extraFights, rng);
  return pick;
}

function addXp(run: HeistRun, xp: number, ev: CoreEvent[]): void {
  run.xp += xp;
  while (run.level < heistMaxLevel() && run.xp >= heistLevelXp(run.level + 1)) {
    run.level += 1;
    run.offersOwed += 1;
    ev.push({ type: 'heistLevelUp', level: run.level });
    log(run, 'heist.log.levelUp', { level: run.level });
  }
}

/** Shows the next owed level-up offer (a level-up with every slot full and no evolution heals instead). */
function openOffers(d: GameState, run: HeistRun, rng: Rng, ev: CoreEvent[]): void {
  while (run.offersOwed > 0 && !run.pending) {
    run.offersOwed -= 1;
    const options = makeOffer(run, rng);
    if (options.length === 0) {
      const hp = heal(d, run, H.fullHealPct, ev);
      log(run, 'heist.log.perksFull', { hp: Math.round(hp) });
      continue;
    }
    run.pending = { kind: 'perk', options, source: 'level' };
  }
}

// ------------------------------------------------------------------ fights

/** A run enemy: the raccoon's best world's stats for its base enemy, x heist multipliers, act and difficulty. */
export function runEnemyStats(run: Pick<HeistRun, 'tier' | 'act' | 'difficulty'>, def: EnemyDef): { hp: number; atk: number; def: number; atkSpd: number } {
  const g = BAL.worlds.enemyGrowth;
  const E = H.enemies;
  const act = H.actMult[run.act - 1];
  const kind = def.kind === 'miniboss' ? E.elite : def.kind === 'boss' ? E.boss : { hpMult: 1, atkMult: 1 };
  return {
    hp: def.hp * growth(g.hp, run.tier) * E.hpMult * kind.hpMult * act * run.difficulty,
    atk: def.atk * growth(g.atk, run.tier) * E.atkMult * kind.atkMult * act * run.difficulty,
    def: def.def * growth(g.def, run.tier),
    atkSpd: def.atkSpd,
  };
}

function makeRunEnemy(run: HeistRun, enemyId: string, uid: number): EnemyState {
  const def = DATA.enemiesById.get(enemyId)!;
  const s = runEnemyStats(run, def);
  return {
    uid, enemyId, kind: def.kind, hp: s.hp, maxHp: s.hp, atk: s.atk, def: s.def, atkSpd: s.atkSpd,
    atkProgress: 0, specialTimer: 0, enraged: false, burnDps: 0, burnTime: 0, burnShown: 0,
    moves: [], tele: 0, moveTimer: 0, shieldLeft: 0, shields: 0, moveEnraged: false, giant: false,
  };
}

function newFight(run: HeistRun, kind: HeistFight['kind'], rewardMult: number): HeistFight {
  const fx = runEffects(run);
  return {
    kind, rewardMult, time: 0, blocks: Math.max(0, Math.round(fx.blockFirst)), blockCharge: false, blockTimer: 0,
    pigeonTimer: 0, roccoTimer: 0, hits: 0, atkMult: 1, coins: 0, xp: 0,
  };
}

/** A fight begins: the hero walks in, then its enemies arrive (heistTick). */
function startFight(d: GameState, run: HeistRun, kind: HeistFight['kind'], rewardMult: number): void {
  run.status = 'fighting';
  run.fight = newFight(run, kind, rewardMult);
  walk(d);
  if (kind === 'boss') log(run, 'heist.log.boss', { boss: heistBossName(run.location) });
  else log(run, kind === 'elite' ? 'heist.log.elite' : 'heist.log.fight');
}

/** The choice event the run's current stop is playing (a fight it starts happens on its stop), if any. */
function currentEvent(run: HeistRun): HeistEventDef | undefined {
  if (run.nodes[run.act - 1]?.[run.index] !== 'choice') return undefined;
  return heistEventDef(run.seen[run.seen.length - 1] ?? '');
}

/**
 * The regular enemies a fight brings: the location's, or, for a fight a choice event started, only
 * those drawn as the foe its text names ("A gang of pigeons..." brings pigeons).
 */
function fightRoster(run: HeistRun): readonly string[] {
  const loc = locationOf(run);
  const foe = currentEvent(run)?.foe;
  if (!foe) return loc.enemies;
  const named = loc.enemies.filter((id) => DATA.assets.placeholders.enemies[id]?.shape === foe);
  return named.length > 0 ? named : loc.enemies;
}

/** The fight's enemies step in: a few regulars, an elite with its adds, or the boss. */
function spawnFight(d: GameState, run: HeistRun, rng: Rng, ev: CoreEvent[]): void {
  const f = run.fight!;
  const loc = locationOf(run);
  const roster = fightRoster(run);
  const b = d.battle;
  const ids: string[] = [];
  if (f.kind === 'boss') ids.push(loc.boss);
  else if (f.kind === 'elite') {
    for (let i = 0; i < H.enemies.eliteAdds[run.act - 1]; i++) ids.push(rng.pick(roster));
    ids.push(rng.pick(loc.elites));
  } else {
    const size = H.enemies.fightSize[run.act - 1];
    const n = rng.int(size.min, size.max);
    for (let i = 0; i < n; i++) ids.push(rng.pick(roster));
  }
  b.enemies = ids.map((id) => makeRunEnemy(run, id, b.nextEnemyUid++));
  b.phase = 'fighting';
  b.phaseTime = 0;
  b.playerAtkProgress = 0;
  const fx = runEffects(run);
  if (fx.flipUpPct > 0 || fx.flipDownPct > 0) {
    const heads = rng.chance(0.5);
    f.atkMult = heads ? 1 + fx.flipUpPct / 100 : Math.max(0.1, 1 - fx.flipDownPct / 100);
    log(run, heads ? 'heist.log.flipHeads' : 'heist.log.flipTails', { pct: heads ? fx.flipUpPct : fx.flipDownPct });
  }
  ev.push({ type: 'waveStart', stage: b.stage, wave: 0 });
}

/** The run side of a fight for the shared combat code. */
function runCombat(d: GameState, run: HeistRun, stats: Stats, ev: CoreEvent[]): RunCombat {
  const fx = runEffects(run);
  const fight = run.fight!;
  return {
    fx,
    fight,
    onKill: (e) => {
      const tough = e.kind !== 'regular';
      const xp = (tough ? H.xp.elite : H.xp.regular) * fight.rewardMult;
      const coins = Math.round((tough ? H.coins.elite : H.coins.regular) * fight.rewardMult * (1 + fx.coinPct / 100));
      fight.xp += xp;
      fight.coins += coins;
      run.coins += coins;
      addXp(run, xp, ev);
      return { coins, xp };
    },
    addCoins: (n) => {
      run.coins += n;
      fight.coins += n;
    },
    nineLives: () => {
      if (fx.nineLivesPct <= 0 || run.flags.nineLivesUsed) return null;
      run.flags.nineLivesUsed = true;
      log(run, 'heist.log.nineLives');
      return (stats.HP * fx.nineLivesPct) / 100;
    },
    afterHurt: () => {
      const saved = run.flags.savedHeal;
      if (!saved || (d.battle.playerHp / stats.HP) * 100 >= saved.below) return;
      const amount = Math.min(stats.HP - d.battle.playerHp, (stats.HP * saved.pct) / 100);
      d.battle.playerHp += amount;
      run.flags.savedHeal = null;
      ev.push({ type: 'heal', amount, source: 'heist' });
      log(run, 'heist.log.savedHeal', { hp: Math.round(amount) });
    },
    makeEnemy: (enemyId) => makeRunEnemy(run, enemyId, d.battle.nextEnemyUid++),
  };
}

function fightWon(d: GameState, run: HeistRun, rng: Rng, ev: CoreEvent[]): void {
  const f = run.fight!;
  ev.push({ type: 'heistFightEnd', won: true });
  d.battle.enemies = [];
  d.battle.phase = 'idle';
  d.battle.phaseTime = 0;
  d.battle.playerAtkProgress = 0;
  run.fight = null;
  if (f.kind === 'boss') {
    winRun(d, run, rng);
    return;
  }
  run.status = 'ready';
  log(run, 'heist.log.fightWon', { coins: Math.round(f.coins), xp: Math.round(f.xp) });
  const fx = runEffects(run);
  if (fx.healAfterFightPct > 0) {
    const hp = heal(d, run, fx.healAfterFightPct, ev);
    if (hp > 0) log(run, 'heist.log.snack', { hp: Math.round(hp) });
  }
  completeStop(d, run, rng);
  openOffers(d, run, rng, ev);
}

function fightLost(d: GameState, run: HeistRun, ev: CoreEvent[]): void {
  ev.push({ type: 'heistFightEnd', won: false });
  setHp(d, run, 0);
  d.battle.phase = 'dead';
  d.battle.phaseTime = 0;
  d.battle.playerAtkProgress = 0;
  ev.push({ type: 'playerDeath', stage: d.battle.stage });
  log(run, 'heist.log.knockedOut');
  if (!run.revived) {
    run.status = 'secondChance';
    log(run, 'heist.log.secondChance', { pct: H.revive.hpPct });
  } else {
    loseRun(run);
  }
}

/** The run is lost: it keeps lossKeepPct of what it collected (never the win-only Luck Potion and ring). */
function loseRun(run: HeistRun): void {
  run.status = 'lost';
  run.fight = null;
  const keep = H.lossKeepPct / 100;
  const r = run.rewards;
  r.bags = Math.floor(r.bags * keep);
  r.coins = Math.floor(r.coins * keep);
  r.gems = Math.floor(r.gems * keep);
  r.potion = false;
  r.ring = null;
  log(run, 'heist.log.lost', { pct: H.lossKeepPct });
}

function winRun(d: GameState, run: HeistRun, rng: Rng): void {
  run.status = 'won';
  const win = heistWinRewards(d, run.location, run.tier);
  const r = run.rewards;
  r.bags += win.bags;
  r.coins += win.coins;
  r.gems += win.gems;
  r.potion = true;
  d.heist.wins[run.location] += 1;
  log(run, 'heist.log.won', { boss: heistBossName(run.location) });
  if (rng.chance(H.ring.chance)) {
    const loc = locationOf(run);
    r.ring = loc.ring;
    log(run, 'heist.log.ring', { ring: DATA.itemsById.get(loc.ring)?.name ?? loc.ring });
  }
}

/**
 * Advances a heist's battle by one game tick: the walk to a stop, then (at fightSpeed steps per tick)
 * the fight. Between stops the hero idles. Called instead of the Alley's combatTick while a run is on.
 */
export function heistTick(d: GameState, rng: Rng, now: number, ev: CoreEvent[], dt: number): void {
  const run = d.heist.run;
  if (!run) return;
  const b = d.battle;
  const stats = runStats(d, run);
  syncMaxHp(d, run, stats);
  let rc: RunCombat | null = null;
  for (let step = 0; step < H.fightSpeed; step++) {
    if (b.phase === 'walking') {
      b.phaseTime -= dt;
      if (b.phaseTime > 1e-9) continue;
      if (run.status === 'fighting' && run.fight) spawnFight(d, run, rng, ev);
      else {
        b.phase = 'idle';
        b.phaseTime = 0;
      }
      continue;
    }
    if (b.phase !== 'fighting' || run.status !== 'fighting' || !run.fight) return;
    b.playerHp = Math.min(stats.HP, b.playerHp + stats.REGEN * dt);
    rc ??= runCombat(d, run, stats, ev);
    const c: Ctx = { d, rng, now, ev, stats, fx: combatEffects(d), k: defConstant(run.tier), run: rc };
    const result = fightStep(c, dt);
    run.hp = b.playerHp;
    if (result === 'cleared') {
      fightWon(d, run, rng, ev);
      return;
    }
    if (result === 'dead') {
      fightLost(d, run, ev);
      return;
    }
  }
}

// ------------------------------------------------------------------ starting and ending

/** Starts a run at `location` with a ticket. The main battle waits in the run until it ends. */
export function startHeist(d: GameState, location: LocationId, rng: Rng, now: number, ev: CoreEvent[]): boolean {
  refreshTickets(d, now, ev);
  if (!canStartHeist(d, location)) return false;
  const h = d.heist;
  h.tickets -= 1;
  ev.push({ type: 'heistTickets', tickets: h.tickets });
  const loc = heistLocation(location);
  const first = location === 'pizza' && h.wins.pizza === 0;
  const main = snap(d.battle);
  const run: HeistRun = {
    location,
    act: 1,
    index: 0,
    nodes: [],
    hp: 1,
    maxHp: 1,
    level: 1,
    xp: 0,
    coins: H.coins.start,
    perks: [],
    curses: [],
    pending: null,
    status: 'ready',
    log: [],
    rewards: { bags: 0, coins: 0, gems: 0, potion: false, ring: null },
    rerollsUsed: 0,
    revived: false,
    absorbed: [],
    offersOwed: 0,
    tier: heistTier(d),
    difficulty: H.locations[location].difficulty * (first ? H.enemies.firstRunMult : 1),
    maxHpPct: 0,
    fight: null,
    flags: { skipNext: false, skipFights: 0, truce: 0, noTrapsAct: 0, savedHeal: null, nineLivesUsed: false },
    seen: [],
    main,
    mainRate: currentRate(d, now),
    startedAt: now,
  };
  run.nodes.push(generateAct(run, 1, rng));
  const max = runStats(d, run).HP;
  run.maxHp = max;
  run.hp = max;
  d.battle = {
    stage: loc.world, wave: 0, phase: 'idle', phaseTime: 0, playerHp: max, playerAtkProgress: 0, enemies: [], nextEnemyUid: main.nextEnemyUid,
    dodge: false, hatGone: 0,
  };
  h.run = run;
  log(h.run, 'heist.log.start', { location: loc.name });
  // The battle view clears the Alley's foes (and wakes the hero up if he was down).
  ev.push({ type: 'stageStart', stage: loc.world, push: false });
  return true;
}

/** The run's minutes don't count toward the offline earning rate: the tracked window slides past them. */
function skipRateWindow(d: GameState, ms: number): void {
  const o = d.offline;
  if (!(ms > 0) || o.trackingSince === null) return;
  o.trackingSince += ms;
  const minutes = Math.floor(ms / MS_PER_MINUTE);
  for (const b of o.buckets) b.minute += minutes;
}

/** A heist-exclusive ring: rolled at the raccoon's luck x ring.luckMult, at least ring.minRarity, into the bag. */
function dropRing(d: GameState, baseId: string, rng: Rng, now: number, ev: CoreEvent[]): Item | null {
  const base = DATA.itemsById.get(baseId);
  if (!base) return null;
  const R = H.ring;
  const rarity = rollRarity(currentLuck(d, now) * R.luckMult, rng, R.minRarity, topRarity(d));
  const item = createItem(base, rarity, rollItemLevel(d.player.level, rng), d.dumpster.theme, rng, d.nextItemUid++, [], itemTierFor(d));
  registerCodex(d, item, ev);
  addToBag(d, item, ev);
  return snap(item);
}

/** Banks the run's payout, brings the main battle back exactly as it was, and ends the run. */
function endRun(d: GameState, run: HeistRun, rng: Rng, now: number, ev: CoreEvent[]): void {
  const won = run.status === 'won';
  const pay = heistPayout(run);
  const main = snap(run.main);
  d.battle = { ...main, nextEnemyUid: Math.max(main.nextEnemyUid, d.battle.nextEnemyUid) };
  skipRateWindow(d, now - run.startedAt);
  d.heist.run = null;
  d.currencies.bags += pay.bags;
  d.currencies.coins += pay.coins;
  d.currencies.gems += pay.gems;
  if (pay.potion) addLuckBoost(d, now, potionSeconds(d), ev);
  const item = pay.ring ? dropRing(d, pay.ring, rng, now, ev) : null;
  ev.push({ type: 'stageStart', stage: d.battle.stage, push: false });
  ev.push({ type: 'heistEnd', won, rewards: pay, item });
}

/** Banks a won or lost run. */
export function heistClaim(d: GameState, rng: Rng, now: number, ev: CoreEvent[]): boolean {
  const run = d.heist.run;
  if (!run || (run.status !== 'won' && run.status !== 'lost')) return false;
  endRun(d, run, rng, now, ev);
  return true;
}

/** Walks away: the run is lost (keeping part of its rewards) and banked at once. A won run is just claimed. */
export function heistAbandon(d: GameState, rng: Rng, now: number, ev: CoreEvent[]): boolean {
  const run = d.heist.run;
  if (!run) return false;
  if (run.status !== 'won' && run.status !== 'lost') {
    log(run, 'heist.log.abandon');
    loseRun(run);
  }
  endRun(d, run, rng, now, ev);
  return true;
}

/** Second Chance: back up at revive.hpPct of max HP, the fight going on where it stopped. */
export function heistRevive(d: GameState, via: 'ad' | 'gems', ev: CoreEvent[]): boolean {
  const run = d.heist.run;
  if (!run || run.status !== 'secondChance' || run.revived) return false;
  if (via === 'gems') {
    if (d.currencies.gems < H.revive.gems) return false;
    d.currencies.gems -= H.revive.gems;
  }
  run.revived = true;
  run.status = run.fight ? 'fighting' : 'ready';
  syncMaxHp(d, run);
  setHp(d, run, (run.maxHp * H.revive.hpPct) / 100);
  d.battle.phase = run.fight ? 'fighting' : 'idle';
  d.battle.playerAtkProgress = 0;
  log(run, 'heist.log.revive');
  // The battle view gets the hero back on his feet (its foes step back in).
  ev.push({ type: 'stageStart', stage: d.battle.stage, push: false });
  return true;
}

/** No Second Chance: the run is lost. */
export function heistDecline(d: GameState): boolean {
  const run = d.heist.run;
  if (!run || run.status !== 'secondChance') return false;
  loseRun(run);
  return true;
}

/** Loaded from a save mid-run: the waiting main battle restarts its world cleanly (as boot does); the run goes on. */
export function heistBoot(d: GameState): void {
  const run = d.heist.run;
  if (!run) return;
  const m = run.main;
  m.wave = 0;
  m.phase = 'walking';
  m.phaseTime = BAL.combat.walkSeconds;
  m.playerHp = computeStats(d).HP;
  m.playerAtkProgress = 0;
  m.enemies = [];
}

// ------------------------------------------------------------------ Go and the decisions

function treasure(run: HeistRun, rng: Rng): void {
  const T = H.treasure;
  if (rng.chance(T.bagsChance)) {
    const bags = rng.int(T.bags.min, T.bags.max);
    run.rewards.bags += bags;
    log(run, 'heist.log.treasureBags', { bags });
  } else {
    const coins = Math.round(rng.int(T.coins.min, T.coins.max) * (1 + 0.5 * (run.act - 1)));
    run.coins += coins;
    log(run, 'heist.log.treasureCoins', { coins });
  }
}

/**
 * The trap at stop `index` of act `act` (for a Trap stop; the UI names the ones passed). A location's
 * traps come in an order fixed by when the run started, its n-th Trap stop taking the n-th, so a trap
 * never changes on a reload and none comes twice before the location's list runs out. Only reached
 * stops count (what's ahead can still change), so it is final once its stop is reached.
 */
export function heistTrapAt(run: Pick<HeistRun, 'location' | 'startedAt' | 'nodes'>, act: number, index: number): HeistTrapDef {
  const pool = DATA.heistTraps.filter((tr) => !tr.locations || tr.locations.includes(run.location));
  const order = new Rng(Rng.hashSeed((run.startedAt % 2 ** 32) ^ Math.imul(LOCATION_IDS.indexOf(run.location) + 1, 0x9e3779b1)));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = order.int(0, i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let n = 0;
  for (let a = 1; a <= act; a++) {
    const nodes = run.nodes[a - 1] ?? [];
    n += (a < act ? nodes : nodes.slice(0, index)).filter((k) => k === 'trap').length;
  }
  return pool[n % pool.length];
}

/** A Trap stop: a named trap (heist.trap.*) that curses or hurts, or that the run saw coming. */
function trap(d: GameState, run: HeistRun, rng: Rng, ev: CoreEvent[]): void {
  const which = heistTrapAt(run, run.act, run.index);
  if (run.flags.noTrapsAct === run.act) {
    log(run, 'heist.log.trapSpotted', { trap: which.name });
    return;
  }
  log(run, 'heist.log.trapSprung', { trap: which.name, text: which.text });
  if (rng.chance(H.trap.curseChance) && gainCurse(d, run, undefined, rng, ev)) return;
  const hp = hurt(d, run, H.trap.damagePct);
  log(run, 'heist.log.damage', { hp: Math.round(hp) });
}

/**
 * A shop's stock. First its health counter: a +max HP perk (shop.maxHpChance of the time), otherwise a
 * Snack, as also when it has no +max HP perk to sell (all held, or no free perk slot). Then random
 * perks (never +max HP ones), a Hot Bath when cursed, and Fresh Stock.
 */
function openShop(run: HeistRun, rng: Rng): void {
  const S = H.shop;
  const held = [...run.perks, ...run.absorbed];
  const maxHp = run.perks.length < H.maxPerks && rng.chance(S.maxHpChance) ? rollMaxHpPerk(rng, new Set(held)) : null;
  const stock: ShopItem[] = [
    maxHp ? { id: maxHp.id, kind: 'perk', price: perkPrice(maxHp), sold: false } : { id: 'heal', kind: 'heal', price: S.prices.heal, sold: false },
  ];
  const taken = new Set([...held, ...MAX_HP_IDS]);
  for (let i = 0; i < S.perks; i++) {
    const p = rollPerk(rng, taken);
    if (!p) break;
    taken.add(p.id);
    stock.push({ id: p.id, kind: 'perk', price: perkPrice(p), sold: false });
  }
  if (run.curses.length > 0) stock.push({ id: 'removeCurse', kind: 'removeCurse', price: S.prices.removeCurse, sold: false });
  stock.push({ id: 'reroll', kind: 'reroll', price: S.prices.reroll, sold: false });
  run.pending = { kind: 'shop', stock };
}

function perkPrice(p: PerkDef): number {
  const P = H.shop.prices;
  return p.rarity === 'epic' ? P.epic : p.rarity === 'rare' ? P.rare : P.common;
}

function pickEvent(run: HeistRun, rng: Rng): HeistEventDef {
  const fits = (e: HeistEventDef) => e.acts.includes(run.act) && (!e.locations || e.locations.includes(run.location));
  let pool = DATA.heistEvents.filter((e) => fits(e) && !run.seen.includes(e.id));
  if (pool.length === 0) pool = DATA.heistEvents.filter(fits);
  const id = rng.weighted(pool.map((e) => [e.id, e.weight] as const));
  return DATA.heistEventsById.get(id)!;
}

/** Resolves the next stop. A fight sets status 'fighting' (the battle plays it); decisions set `pending`. */
export function heistGo(d: GameState, rng: Rng, ev: CoreEvent[]): boolean {
  const run = d.heist.run;
  if (!run || run.status !== 'ready' || run.pending) return false;
  const kind = run.nodes[run.act - 1]?.[run.index];
  if (!kind) return false;
  ev.push({ type: 'heistNode', kind, act: run.act, index: run.index });
  const fx = runEffects(run);
  if (fx.paperCutsPct > 0) {
    const hp = hurt(d, run, fx.paperCutsPct);
    if (hp > 0) log(run, 'heist.log.paperCuts', { hp: Math.round(hp) });
  }
  walk(d);
  const fight = isFightKind(kind);
  const truce = run.flags.truce > 0;
  if (truce) run.flags.truce -= 1;
  if (run.flags.skipNext && kind !== 'boss') {
    run.flags.skipNext = false;
    log(run, 'heist.log.skipped');
    completeStop(d, run, rng);
    return true;
  }
  if (fight && (truce || run.flags.skipFights > 0)) {
    if (!truce) run.flags.skipFights -= 1;
    log(run, truce ? 'heist.log.truceSkip' : 'heist.log.skipped');
    completeStop(d, run, rng);
    return true;
  }
  switch (kind) {
    case 'fight':
    case 'elite':
    case 'boss':
      run.flags.skipNext = false;
      startFight(d, run, kind, 1);
      break;
    case 'choice': {
      const e = pickEvent(run, rng);
      run.seen.push(e.id);
      run.pending = { kind: 'choice', eventId: e.id, options: e.options.length };
      log(run, 'heist.log.event', { text: e.text });
      break;
    }
    case 'treasure':
      treasure(run, rng);
      completeStop(d, run, rng);
      break;
    case 'golden':
      d.roll.goldenLeft += H.golden.spins;
      log(run, 'heist.log.golden', { spins: H.golden.spins, mult: H.golden.luckMult });
      completeStop(d, run, rng);
      break;
    case 'shop':
      openShop(run, rng);
      log(run, 'heist.log.shop');
      break;
    case 'shrine':
      run.pending = { kind: 'shrine' };
      log(run, 'heist.log.shrine', { pct: H.shrine.maxHpPct });
      break;
    case 'trap':
      trap(d, run, rng, ev);
      completeStop(d, run, rng);
      break;
    case 'wheel':
      run.pending = { kind: 'wheel' };
      log(run, 'heist.log.wheel');
      break;
  }
  return true;
}

/** Run coins an option costs up front (its sure negative coin outcomes). */
function optionCost(opt: HeistEventDef['options'][number]): number {
  let cost = 0;
  for (const o of opt.outcomes) if (o.type === 'runCoins' && o.chance === undefined && (o.value ?? 0) < 0) cost -= o.value ?? 0;
  return cost;
}

/** Whether option `index` of the pending choice can be picked (it may cost run coins). */
export function heistOptionAvailable(run: HeistRun, index: number): boolean {
  if (run.pending?.kind !== 'choice') return false;
  const opt = heistEventDef(run.pending.eventId)?.options[index];
  return !!opt && run.coins >= optionCost(opt);
}

/** Applies one outcome. True when it starts something the stop waits for (a fight, a shop, the wheel). */
function applyOutcome(d: GameState, run: HeistRun, o: OutcomeDef, rng: Rng, ev: CoreEvent[]): boolean {
  switch (o.type) {
    case 'healPct': {
      const hp = heal(d, run, o.value ?? 0, ev);
      log(run, 'heist.log.heal', { hp: Math.round(hp) });
      return false;
    }
    case 'damagePct': {
      const hp = hurt(d, run, o.value ?? 0);
      log(run, 'heist.log.damage', { hp: Math.round(hp) });
      return false;
    }
    case 'maxHpPct':
      run.maxHpPct += o.value ?? 0;
      syncMaxHp(d, run);
      log(run, 'heist.log.maxHp', { pct: o.value ?? 0 });
      return false;
    case 'gainPerk': {
      let id = o.perkId && !run.perks.includes(o.perkId) && !run.absorbed.includes(o.perkId) ? o.perkId : null;
      if (!id) {
        const taken = new Set([...run.perks, ...run.absorbed]);
        const known = o.perkId ? DATA.heistPerksById.get(o.perkId) : undefined;
        const rarity = o.rarity ?? (known && known.rarity !== 'evolution' ? known.rarity : undefined);
        id = rollPerk(rng, taken, rarity, o.tag ?? known?.tag)?.id ?? rollPerk(rng, taken, rarity)?.id ?? null;
      }
      if (!id || !gainPerk(d, run, id, rng, ev)) {
        run.coins += 15;
        log(run, 'heist.log.noPerkCoins', { coins: 15 });
      }
      return false;
    }
    case 'gainCurse':
      if (!gainCurse(d, run, o.curseId, rng, ev)) log(run, 'heist.log.nothing');
      return false;
    case 'runCoins': {
      const before = run.coins;
      run.coins = Math.max(0, run.coins + (o.value ?? 0));
      const n = run.coins - before;
      log(run, n >= 0 ? 'heist.log.coinsGain' : 'heist.log.coinsPay', { coins: Math.abs(n) });
      return false;
    }
    case 'trashBags':
      run.rewards.bags += o.value ?? 0;
      log(run, 'heist.log.bags', { bags: o.value ?? 0 });
      return false;
    case 'fight':
    case 'eliteFight':
      startFight(d, run, o.type === 'fight' ? 'fight' : 'elite', o.rewardMult ?? 1);
      return true;
    case 'skipNext':
      run.flags.skipNext = true;
      log(run, 'heist.log.skipNextSet');
      return false;
    case 'skipFight':
      run.flags.skipFights += 1;
      log(run, 'heist.log.skipFightSet');
      return false;
    case 'truce':
      run.flags.truce = Math.max(run.flags.truce, Math.round(o.value ?? 2));
      log(run, 'heist.log.truce', { n: run.flags.truce });
      return false;
    case 'openShop':
      openShop(run, rng);
      log(run, 'heist.log.shop');
      return true;
    case 'treasure':
      treasure(run, rng);
      return false;
    case 'jackpotWheel':
      run.pending = { kind: 'wheel' };
      log(run, 'heist.log.wheel');
      return true;
    case 'noTraps':
      run.flags.noTrapsAct = run.act;
      log(run, 'heist.log.noTraps');
      return false;
    case 'savedHeal':
      run.flags.savedHeal = { pct: o.value ?? 40, below: o.below ?? 20 };
      log(run, 'heist.log.savedHealSet', { pct: o.value ?? 40, below: o.below ?? 20 });
      return false;
    case 'nothing':
      log(run, 'heist.log.nothing');
      return false;
  }
}

function chooseOption(d: GameState, run: HeistRun, index: number, rng: Rng, ev: CoreEvent[]): boolean {
  if (run.pending?.kind !== 'choice') return false;
  const event = heistEventDef(run.pending.eventId);
  const opt = event?.options[index];
  if (!opt || !heistOptionAvailable(run, index)) return false;
  run.pending = null;
  log(run, 'heist.log.chose', { label: opt.label });
  // The outcomes with a chance are one roll between them; the rest always happen.
  const risky = opt.outcomes.filter((o) => o.chance !== undefined);
  let picked: OutcomeDef | null = null;
  if (risky.length > 0) {
    let r = rng.next();
    for (const o of risky) {
      if (r < o.chance!) {
        picked = o;
        break;
      }
      r -= o.chance!;
    }
  }
  const apply = opt.outcomes.filter((o) => o.chance === undefined || o === picked);
  if (apply.length === 0) log(run, 'heist.log.nothing');
  let waits = false;
  for (const o of apply) waits = applyOutcome(d, run, o, rng, ev) || waits;
  if (!waits) completeStop(d, run, rng);
  return true;
}

function buy(d: GameState, run: HeistRun, index: number, rng: Rng, ev: CoreEvent[]): boolean {
  if (run.pending?.kind !== 'shop') return false;
  const item = run.pending.stock[index];
  if (!item || item.sold || run.coins < item.price) return false;
  switch (item.kind) {
    case 'heal': {
      const hp = heal(d, run, H.shop.healPct, ev);
      log(run, 'heist.log.heal', { hp: Math.round(hp) });
      break;
    }
    case 'perk':
      if (!gainPerk(d, run, item.id, rng, ev)) return false;
      break;
    case 'removeCurse': {
      const id = run.curses.pop();
      if (!id) return false;
      ev.push({ type: 'heistCurse', id, removed: true });
      log(run, 'heist.log.curseRemoved', { curse: DATA.heistCursesById.get(id)?.name ?? id });
      syncMaxHp(d, run);
      break;
    }
    case 'reroll': {
      const stock = run.pending.stock;
      const taken = new Set([...run.perks, ...run.absorbed, ...stock.filter((s) => s.kind === 'perk').map((s) => s.id)]);
      for (const s of stock) {
        if (s.kind !== 'perk' || s.sold) continue;
        // The health counter's +max HP perk restocks as another one; the others as any perk but those.
        const p = MAX_HP_IDS.includes(s.id) ? rollMaxHpPerk(rng, taken) : rollPerk(rng, new Set([...taken, ...MAX_HP_IDS]));
        if (!p) continue;
        taken.add(p.id);
        s.id = p.id;
        s.price = perkPrice(p);
      }
      log(run, 'heist.log.restock');
      break;
    }
  }
  run.coins -= item.price;
  item.sold = true;
  log(run, 'heist.log.paid', { coins: item.price });
  return true;
}

function spinWheel(d: GameState, run: HeistRun, rng: Rng, ev: CoreEvent[]): boolean {
  const segs = H.wheel;
  const index = Number(rng.weighted(segs.map((s, i) => [String(i), s.weight] as const)));
  const s = segs[index];
  run.pending = null;
  ev.push({ type: 'heistWheel', index, kind: s.kind, value: s.value });
  switch (s.kind) {
    case 'coins':
      run.coins += s.value;
      log(run, 'heist.log.wheelCoins', { coins: s.value });
      break;
    case 'heal': {
      const hp = heal(d, run, s.value, ev);
      log(run, 'heist.log.wheelHeal', { hp: Math.round(hp) });
      break;
    }
    case 'bags':
      run.rewards.bags += s.value;
      log(run, 'heist.log.wheelBags', { bags: s.value });
      break;
    case 'gems':
      run.rewards.gems += s.value;
      log(run, 'heist.log.wheelGems', { gems: s.value });
      break;
    case 'perk': {
      const options = makeOffer(run, rng);
      if (options.length > 0) {
        run.pending = { kind: 'perk', options, source: 'wheel' };
        log(run, 'heist.log.wheelPerk');
      } else {
        run.coins += 30;
        log(run, 'heist.log.wheelCoins', { coins: 30 });
      }
      break;
    }
  }
  completeStop(d, run, rng);
  return true;
}

function shrine(d: GameState, run: HeistRun, accept: boolean, rng: Rng): boolean {
  if (accept) {
    if (run.perks.length >= H.maxPerks) return false;
    run.maxHpPct -= H.shrine.maxHpPct;
    syncMaxHp(d, run);
    log(run, 'heist.log.shrineAccept', { pct: H.shrine.maxHpPct });
    const options = makeOffer(run, rng, 'epic');
    run.pending = options.length > 0 ? { kind: 'perk', options, source: 'shrine' } : null;
  } else {
    run.pending = null;
    log(run, 'heist.log.shrineDecline');
  }
  completeStop(d, run, rng);
  return true;
}

function pickPerk(d: GameState, run: HeistRun, index: number, rng: Rng, ev: CoreEvent[]): boolean {
  if (run.pending?.kind !== 'perk') return false;
  const opt = run.pending.options[index];
  if (!opt) return false;
  const pending = run.pending;
  run.pending = null;
  if (!gainPerk(d, run, opt.id, rng, ev)) {
    run.pending = pending;
    return false;
  }
  openOffers(d, run, rng, ev);
  return true;
}

/** Answers the pending decision: a perk, a choice option, a shop item, the wheel's spin, the shrine (0 accept, 1 walk away). */
export function heistChoose(d: GameState, index: number, rng: Rng, ev: CoreEvent[]): boolean {
  const run = d.heist.run;
  if (!run || !run.pending || run.status !== 'ready' || !Number.isInteger(index) || index < 0) return false;
  switch (run.pending.kind) {
    case 'perk':
      return pickPerk(d, run, index, rng, ev);
    case 'choice':
      return chooseOption(d, run, index, rng, ev);
    case 'shop':
      return buy(d, run, index, rng, ev);
    case 'wheel':
      return spinWheel(d, run, rng, ev);
    case 'shrine':
      return shrine(d, run, index === 0, rng);
  }
}

export function heistLeaveShop(d: GameState, rng: Rng): boolean {
  const run = d.heist.run;
  if (!run || run.pending?.kind !== 'shop') return false;
  run.pending = null;
  log(run, 'heist.log.leftShop');
  completeStop(d, run, rng);
  return true;
}

/** New options for the pending perk offer (the run's free reroll first, then Gems). */
/** Rerolls the perk offer. The run's free reroll comes with an ad; `via: 'gems'` pays the usual price for it instead. */
export function heistReroll(d: GameState, rng: Rng, via: 'ad' | 'gems' = 'ad'): boolean {
  const run = d.heist.run;
  if (!run || run.pending?.kind !== 'perk' || run.status !== 'ready') return false;
  const free = rerollCost(run);
  const cost = free === 0 && via === 'gems' ? H.rerolls.gems : free;
  if (d.currencies.gems < cost) return false;
  const source = run.pending.source;
  const options = makeOffer(run, rng, source === 'shrine' ? 'epic' : undefined);
  if (options.length === 0) return false;
  d.currencies.gems -= cost;
  run.rerollsUsed += 1;
  run.pending = { kind: 'perk', options, source };
  log(run, 'heist.log.reroll');
  return true;
}

// ------------------------------------------------------------------ previews (for the UI)

export interface OutcomeLine {
  /** A strings.en.json key (heist.outcome.*). */
  key: string;
  params: Record<string, string | number>;
  /** Its chance (0 to 1) when it is one of a few possible results. */
  chance?: number;
}

/** What an outcome does, as a heist.outcome.* line. */
export function outcomeLine(o: OutcomeDef): OutcomeLine {
  const line = (key: string, params: Record<string, string | number> = {}): OutcomeLine =>
    o.chance === undefined ? { key, params } : { key, params, chance: o.chance };
  switch (o.type) {
    case 'healPct':
      return line('heist.outcome.heal', { pct: o.value ?? 0 });
    case 'damagePct':
      return line('heist.outcome.damage', { pct: o.value ?? 0 });
    case 'maxHpPct':
      return line('heist.outcome.maxHp', { pct: o.value ?? 0 });
    case 'gainPerk':
      if (o.perkId) return line('heist.outcome.perk', { perk: DATA.heistPerksById.get(o.perkId)?.name ?? o.perkId });
      if (o.tag) return line('heist.outcome.perkTag', { tag: o.tag });
      if (o.rarity) return line('heist.outcome.perkRarity', { rarity: o.rarity });
      return line('heist.outcome.perkAny');
    case 'gainCurse':
      return o.curseId ? line('heist.outcome.curse', { curse: DATA.heistCursesById.get(o.curseId)?.name ?? o.curseId }) : line('heist.outcome.curseAny');
    case 'runCoins':
      return line((o.value ?? 0) < 0 ? 'heist.outcome.pay' : 'heist.outcome.coins', { coins: Math.abs(o.value ?? 0) });
    case 'trashBags':
      return line('heist.outcome.bags', { bags: o.value ?? 0 });
    case 'fight':
      return line(o.rewardMult && o.rewardMult > 1 ? 'heist.outcome.fightBonus' : 'heist.outcome.fight', { mult: o.rewardMult ?? 1 });
    case 'eliteFight':
      return line(o.rewardMult && o.rewardMult > 1 ? 'heist.outcome.eliteBonus' : 'heist.outcome.elite', { mult: o.rewardMult ?? 1 });
    case 'skipNext':
      return line('heist.outcome.skipNext');
    case 'skipFight':
      return line('heist.outcome.skipFight');
    case 'truce':
      return line('heist.outcome.truce', { n: o.value ?? 2 });
    case 'openShop':
      return line('heist.outcome.shop');
    case 'treasure':
      return line('heist.outcome.treasure');
    case 'jackpotWheel':
      return line('heist.outcome.wheel');
    case 'noTraps':
      return line('heist.outcome.noTraps');
    case 'savedHeal':
      return line('heist.outcome.savedHeal', { pct: o.value ?? 40, below: o.below ?? 20 });
    case 'nothing':
      return line('heist.outcome.nothing');
  }
}

/** Every outcome of a choice event's option, as lines. */
export function optionPreview(eventId: string, index: number): OutcomeLine[] {
  return heistEventDef(eventId)?.options[index]?.outcomes.map(outcomeLine) ?? [];
}

/** Odds of each Jackpot Wheel segment (shown on the wheel: the spec asks for its odds to be disclosed). */
export function wheelOdds(): Array<{ kind: string; value: number; chance: number }> {
  const total = H.wheel.reduce((s, w) => s + w.weight, 0);
  return H.wheel.map((w) => ({ kind: w.kind, value: w.value, chance: w.weight / total }));
}
