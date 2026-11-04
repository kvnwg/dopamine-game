/**
 * A new game opens one feature at a time, each when it becomes useful, so the first minutes show
 * only what the tutorial is talking about (Kevin: "have everything locked until the tutorial walks
 * the player through it"):
 *  - the dumpster itself: it starts padlocked and the player's tap knocks the lock off (openDumpster);
 *  - the Bag, once the first item is on the raccoon;
 *  - luck and the Codex, once the tutorial is over;
 *  - Upgrades and the dumpster's own upgrade, once the tutorial is over and one is affordable;
 *  - Worlds, once the tutorial is over (after Luck and the Codex: the player picks the first world
 *    there, and only then does the raccoon start fighting); Rebirth, a couple of worlds before the
 *    first rebirth's;
 *  - Heists, with the first rebirth (BAL.heist.unlockRebirths);
 *  - the Upgrades screen's Perks page, with the second rebirth (BAL.perks.unlockRebirths).
 * Core decides when each opens; the UI introduces them one at a time (the tutorial points at it) and
 * marks each `seen`. Saves from before this have everything (state.ts).
 */
import { BAL } from '../../data';
import { FEATURES, type Feature, type GameState } from '../state';
import type { CoreEvent } from '../types';
import { upgradeCost as dumpsterUpgradeCost } from './dumpster';
import { perksOpen } from './perks';
import { rebirthRequirement } from './rebirth';
import { affordableUpgrades } from './upgrades';

/**
 * The order features are introduced in when several are waiting: as the tutorial ends, Worlds, where
 * the player picks the first world and the fighting starts (stage.chosen).
 */
export const FEATURE_ORDER: readonly Feature[] = ['roll', 'bag', 'worlds', 'luck', 'codex', 'upgrades', 'dumpster', 'rebirth', 'heist', 'perks'];

/**
 * Features that open quietly, without the tutorial walking through them (no bubble, hand or popup;
 * Kevin: "in tutorial, no more walking through luck and codex"): their buttons just appear.
 */
const QUIET: readonly Feature[] = ['luck', 'codex'];

export function hasFeature(state: Pick<GameState, 'features'>, f: Feature): boolean {
  return state.features.unlocked.includes(f);
}

export function featureSeen(state: Pick<GameState, 'features'>, f: Feature): boolean {
  return state.features.seen.includes(f);
}

/**
 * The tutorial is over for the features waiting on it: beginner's luck worn (or scrapped), a rebirth,
 * or enough rolls that an unfinished tutorial never holds the game back.
 */
export function tutorialOver(state: Pick<GameState, 'dumpster' | 'rebirths' | 'roll'>): boolean {
  return state.dumpster.beginner.state === 'done' || state.rebirths > 0 || state.roll.count >= BAL.tutorial.overAtRolls;
}

/** The first world the Rebirth tab opens at. */
export function rebirthTabWorld(): number {
  return Math.max(1, rebirthRequirement(0).world - BAL.tutorial.rebirthTabWorldsEarly);
}

function ready(d: GameState, f: Feature): boolean {
  switch (f) {
    case 'roll':
      return false; // the player's tap: openDumpster
    case 'bag':
      // With the tutorial's own find in (after the warm-up spins): it goes on with Equip best there.
      return d.lifetime.itemsEquipped > 0 || (d.dumpster.firstDiveDone && d.roll.count > BAL.tutorial.warmupRarities.length);
    case 'luck':
    case 'codex':
      return tutorialOver(d);
    case 'upgrades':
      return tutorialOver(d) && affordableUpgrades(d).length > 0;
    case 'dumpster':
      return tutorialOver(d) && d.currencies.coins >= dumpsterUpgradeCost(d.dumpster.level);
    case 'worlds':
      // With the tutorial over (a new game waits for its first pick here), or a world already beaten.
      return tutorialOver(d) || d.stage.highestCleared >= 1 || d.rebirths > 0;
    case 'rebirth':
      return d.stage.highestCleared >= rebirthTabWorld() || d.rebirths > 0;
    case 'heist':
      return d.rebirths >= BAL.heist.unlockRebirths;
    case 'perks':
      return perksOpen(d);
  }
}

/** Opens every feature that has become useful (run after every tick and action). */
export function checkFeatures(d: GameState, ev: CoreEvent[]): void {
  const open = d.features.unlocked;
  if (open.length >= FEATURES.length) return;
  for (const f of FEATURE_ORDER) {
    if (open.includes(f) || !ready(d, f)) continue;
    open.push(f);
    if (QUIET.includes(f) && !featureSeen(d, f)) d.features.seen.push(f);
    ev.push({ type: 'featureUnlocked', feature: f });
  }
}

/** A new game's first tap: the padlock comes off and the reels start (rollTick waits for this). */
export function openDumpster(d: GameState, ev: CoreEvent[]): boolean {
  if (hasFeature(d, 'roll')) return false;
  d.features.unlocked.push('roll');
  if (!featureSeen(d, 'roll')) d.features.seen.push('roll');
  ev.push({ type: 'featureUnlocked', feature: 'roll' });
  return true;
}

/** The tutorial has introduced an open feature. */
export function markFeatureSeen(d: GameState, f: Feature): boolean {
  if (!hasFeature(d, f) || featureSeen(d, f)) return false;
  d.features.seen.push(f);
  return true;
}

export type FeatureView = 'locked' | 'intro' | 'open';

/** What the introductions look at: the features, and for the dumpster's upgrade, the gold and the dumpster. */
type IntroState = Pick<GameState, 'features' | 'currencies' | 'dumpster'>;

/** The dumpster's upgrade can be started right now: affordable, none running, not maxed. */
export function dumpsterUpgradeReady(state: Pick<GameState, 'currencies' | 'dumpster'>): boolean {
  const dz = state.dumpster;
  return dz.upgradeEndsAt === null && dz.level < BAL.dumpster.maxLevel && state.currencies.coins >= dumpsterUpgradeCost(dz.level);
}

/**
 * The opened feature being introduced now: the first opened and not yet seen (one at a time), or
 * null. The dumpster's upgrade waits its turn until the player can pay for it (Kevin: "don't ask
 * the player to upgrade dumpster when they don't have enough money"); the ones after it go first.
 */
export function introFeature(state: IntroState): Feature | null {
  for (const f of FEATURE_ORDER) {
    if (!state.features.unlocked.includes(f) || state.features.seen.includes(f)) continue;
    if (f === 'dumpster' && !dumpsterUpgradeReady(state)) continue;
    return f;
  }
  return null;
}

/**
 * How a feature shows: 'open' once introduced, 'intro' while it is the one being introduced, else
 * 'locked' (not open yet, or waiting for the one before it to be introduced).
 */
export function featureView(state: IntroState, f: Feature): FeatureView {
  if (state.features.seen.includes(f)) return 'open';
  if (!state.features.unlocked.includes(f)) return 'locked';
  return introFeature(state) === f ? 'intro' : 'locked';
}
