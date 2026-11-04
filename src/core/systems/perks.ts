/**
 * Alley perks. Kevin: "within upgrades, allow player to unlock a separate page in upgrades for perks,
 * unlocked after 2 rebirths. perk trees are CREATIVE and fun augments that drastically change ur game,
 * making it more of a roguelike, they can only be purchased with half eaten bread loaves, and u get one
 * each time u defeat a world in that run".
 *
 * A run (from one rebirth to the next) earns Half-Eaten Bread Loaves: one for each world whose boss
 * falls for the first time in the run (beating it again pays nothing). They buy perks from four trees on
 * the Upgrades screen's Perks page: a tree's root first, then deeper perks for more loaves. A rebirth
 * wipes the loaves and the perks, so every run builds its own combination. Perks open with
 * BAL.perks.unlockRebirths rebirths; before that no loaves are earned, so the first runs are unchanged.
 *
 * This file holds the rules and adds up what the perks owned do (perkFx); stats.ts, luck.ts, roller.ts,
 * offline.ts, worlds.ts and combat.ts read it where each perk bites. The crew, the second wind, the rage
 * and the changed enemies act in the Alley battle only (heists have perks of their own); perks that change
 * the raccoon's stats or the reels apply wherever those do.
 */
import { ALLEY_PERK_KEYS, BAL, DATA, type AlleyPerkDef, type AlleyPerkKey, type PerkTreeId, type Rarity } from '../../data';
import { freshPerks, type EnemyState, type GameState, type PerkState } from '../state';
import type { CoreEvent } from '../types';
import { rarityAtLeast } from '../util';
import { computeStats } from './stats';
import { trimBag } from './roller';

const P = BAL.perks;

// ------------------------------------------------------------------ the catalog

/** Perks open (loaves are earned and spent) with BAL.perks.unlockRebirths rebirths. */
export function perksOpen(state: Pick<GameState, 'rebirths'>): boolean {
  return state.rebirths >= P.unlockRebirths;
}

export function alleyPerk(id: string): AlleyPerkDef | undefined {
  return DATA.alleyPerksById.get(id);
}

/** The trees in the order the Perks page shows them, each with its perks (cheapest first, as listed). */
export function perkTrees(): { id: PerkTreeId; icon: string; perks: AlleyPerkDef[] }[] {
  return P.trees.map((t) => ({ id: t.id, icon: t.icon, perks: DATA.alleyPerks.filter((p) => p.tree === t.id) }));
}

export function ownsPerk(state: { perks?: Pick<PerkState, 'owned'> }, id: string): boolean {
  return state.perks?.owned.includes(id) ?? false;
}

/** A tree's root is always open; any other perk once one of the perks it hangs off is owned. */
export function perkReachable(state: { perks?: Pick<PerkState, 'owned'> }, def: AlleyPerkDef): boolean {
  return def.requires.length === 0 || def.requires.some((id) => ownsPerk(state, id));
}

export type PerkNodeState = 'owned' | 'open' | 'locked';

/** How a perk shows on the Perks page: owned, open (its prerequisite is owned) or locked. */
export function perkNodeState(state: { perks?: Pick<PerkState, 'owned'> }, id: string): PerkNodeState {
  const def = alleyPerk(id);
  if (!def) return 'locked';
  if (ownsPerk(state, id)) return 'owned';
  return perkReachable(state, def) ? 'open' : 'locked';
}

/** Perks open, this perk open and not owned, and enough loaves in the pocket. */
export function canBuyPerk(state: Pick<GameState, 'rebirths' | 'perks'>, id: string): boolean {
  const def = alleyPerk(id);
  return !!def && perksOpen(state) && perkNodeState(state, id) === 'open' && state.perks.bread >= def.cost;
}

/** Perks the raccoon could buy right now. */
export function affordablePerks(state: Pick<GameState, 'rebirths' | 'perks'>): AlleyPerkDef[] {
  return DATA.alleyPerks.filter((p) => canBuyPerk(state, p.id));
}

// ------------------------------------------------------------------ what the perks owned do

/** Every perk number added up over the perks owned (see ALLEY_PERK_KEYS), and Rigged Jackpot's rarity. */
export type PerkFx = Record<AlleyPerkKey, number> & { jackpotRarity: Rarity | null };

const isMult = (k: string) => k.endsWith('Mult');
const isEvery = (k: string) => k.endsWith('Every');

function emptyFx(): PerkFx {
  const out = { jackpotRarity: null } as PerkFx;
  for (const k of ALLEY_PERK_KEYS) out[k] = isMult(k) ? 1 : 0;
  return out;
}

/** No perks: every multiplier 1, everything else 0. */
export const NO_PERKS: Readonly<PerkFx> = Object.freeze(emptyFx());

function combine(owned: readonly string[]): PerkFx {
  const out = emptyFx();
  for (const id of owned) {
    const def = alleyPerk(id);
    if (!def) continue;
    for (const k of Object.keys(def.effect) as AlleyPerkKey[]) {
      const v = def.effect[k] ?? 0;
      if (isMult(k)) out[k] *= v;
      else if (isEvery(k)) out[k] = out[k] > 0 ? Math.min(out[k], v) : v;
      else out[k] += v;
    }
    if (def.rarity && (!out.jackpotRarity || rarityAtLeast(def.rarity, out.jackpotRarity))) out.jackpotRarity = def.rarity;
  }
  return out;
}

const fxCache = new Map<string, PerkFx>();

/** What the perks owned do (cached by the list of perks: it is read every tick). */
export function perkFx(state: { perks?: Pick<PerkState, 'owned'> }): Readonly<PerkFx> {
  const owned = state.perks?.owned;
  if (!owned || owned.length === 0) return NO_PERKS;
  const key = owned.join(',');
  let fx = fxCache.get(key);
  if (!fx) {
    if (fxCache.size > 256) fxCache.clear();
    fx = combine(owned);
    fxCache.set(key, fx);
  }
  return fx;
}

/**
 * The perks' multipliers on the raccoon's stats: Glass Cannon's ATK and HP, the Energy Drink's attack
 * speed and HP, and Holy Crust's ATK and HP for every loaf eaten this run.
 */
export function perkStatMults(state: { perks?: Pick<PerkState, 'owned' | 'eaten'> }): { atk: number; hp: number; atkSpd: number } {
  const fx = perkFx(state);
  if (fx === NO_PERKS) return { atk: 1, hp: 1, atkSpd: 1 };
  const crust = 1 + (fx.eatenLoafPct * (state.perks?.eaten ?? 0)) / 100;
  return {
    atk: fx.atkMult * crust,
    hp: fx.hpMult * Math.max(0.05, 1 - fx.hpCutPct / 100) * crust,
    atkSpd: 1 + fx.atkSpdPct / 100,
  };
}

/** Carb Loading: luck x (1 + its % for every uneaten loaf). */
export function perkLuckMult(state: { perks?: Pick<PerkState, 'owned' | 'bread'> }): number {
  const fx = perkFx(state);
  return 1 + (fx.heldLoafLuckPct * (state.perks?.bread ?? 0)) / 100;
}

/** How long a spin cycle takes with the perks: Bootleg Reel's slower spins over Greased Gears' speed. */
export function perkSpinMult(state: { perks?: Pick<PerkState, 'owned'> }): number {
  const fx = perkFx(state);
  return (1 + fx.spinTimePct / 100) / Math.max(0.01, fx.spinSpeedMult);
}

/** Four-Leaf Litter: the share of bag space left. */
export function perkBagMult(state: { perks?: Pick<PerkState, 'owned'> }): number {
  return Math.max(0.05, 1 - perkFx(state).bagCutPct / 100);
}

// ------------------------------------------------------------------ loaves

/** The loaves the run's `nth` world beaten pays: the base, Bread Bait's extra, Sourdough Starter's bonus on every Nth. */
export function loavesForWorld(state: { perks?: Pick<PerkState, 'owned'> }, nth: number): number {
  const fx = perkFx(state);
  let n = P.loavesPerWorld + fx.extraLoaves;
  if (fx.bonusLoafEvery > 0 && nth > 0 && nth % fx.bonusLoafEvery === 0) n += 1;
  return n;
}

/**
 * A world's boss fell in the Alley. The first time this run (perks open), it pays its loaves; beating a
 * world again pays nothing. Returns the loaves paid.
 */
export function earnBread(d: GameState, world: number, ev: CoreEvent[]): number {
  const p = d.perks;
  if (!perksOpen(d) || p.worlds.includes(world)) return 0;
  p.worlds.push(world);
  const loaves = loavesForWorld(d, p.worlds.length);
  p.bread += loaves;
  p.earned += loaves;
  ev.push({ type: 'breadEarned', world, loaves, bread: p.bread });
  return loaves;
}

/**
 * Eats `cost` loaves for a perk. Max HP it adds comes with HP (as gear does); a smaller bag (Four-Leaf
 * Litter) scraps its weakest unlocked items down to size.
 */
export function buyPerk(d: GameState, id: string, ev: CoreEvent[]): boolean {
  const def = alleyPerk(id);
  if (!def || !canBuyPerk(d, id)) return false;
  const hpBefore = computeStats(d).HP;
  d.perks.bread -= def.cost;
  d.perks.eaten += def.cost;
  d.perks.owned.push(id);
  ev.push({ type: 'perkBought', id, cost: def.cost });
  const gained = computeStats(d).HP - hpBefore;
  const b = d.heist?.run ? d.heist.run.main : d.battle;
  if (gained > 0 && b.phase !== 'dead') b.playerHp += gained;
  trimBag(d, ev);
  return true;
}

/** A rebirth eats the run: no loaves, no perks. */
export function resetPerks(d: GameState): void {
  d.perks = freshPerks();
}

// ------------------------------------------------------------------ in the Alley battle and on the reels

/** A world attempt starts: Playing Possum's second wind is back, Raccoon Mafia's recruits go home. */
export function perksWorldStart(d: GameState): void {
  if (!d.perks) return;
  d.perks.windUsed = false;
  d.perks.recruits = 0;
}

/** A wave arrives: Greased Gears' angrier bosses, Bread Bait's well-fed ones, YOLO's harder-hitting regulars. */
export function perkFoes(enemies: EnemyState[], fx: Readonly<PerkFx>): void {
  if (fx === NO_PERKS) return;
  for (const e of enemies) {
    if (e.kind === 'regular') {
      e.atk *= 1 + fx.regularAtkPct / 100;
    } else {
      e.atk *= 1 + fx.bossAtkPct / 100;
      e.hp *= 1 + fx.bossHpPct / 100;
      e.maxHp = e.hp;
    }
  }
}

/**
 * Rigged Jackpot: counts a spin, and every jackpotEvery-th one is rigged: returns the rarity each of its
 * reels lands at least (null for an ordinary spin).
 */
export function rigSpin(d: GameState): Rarity | null {
  const fx = perkFx(d);
  if (!(fx.jackpotEvery > 0) || !fx.jackpotRarity) return null;
  d.perks.jackpotSpins += 1;
  if (d.perks.jackpotSpins < fx.jackpotEvery) return null;
  d.perks.jackpotSpins = 0;
  return fx.jackpotRarity;
}

// ------------------------------------------------------------------ old saves

/**
 * A save from before perks: once perks are open, every world already beaten this run counts as paid,
 * so a raccoon mid-run gets the loaves it would have earned (one per world up to its best this run).
 */
export function backfillBread(d: GameState): void {
  if (!perksOpen(d) || d.perks.worlds.length > 0) return;
  const best = Math.max(0, Math.floor(d.stage.highestCleared));
  for (let w = 1; w <= best; w++) d.perks.worlds.push(w);
  const loaves = best * P.loavesPerWorld;
  d.perks.bread += loaves;
  d.perks.earned += loaves;
}
