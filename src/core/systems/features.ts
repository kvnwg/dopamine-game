/**
 * A new game opens one feature at a time, each when it becomes useful, so the first minutes show
 * only what the tutorial is talking about (Kevin: "have everything locked until the tutorial walks
 * the player through it"):
 *  - the dumpster itself: it starts padlocked and the player's tap knocks the lock off (openDumpster);
 *  - the Bag, once the first item is on the raccoon;
 *  - luck and the Codex, once the tutorial is over;
 *  - Upgrades and the dumpster's own upgrade, once the tutorial is over and one is affordable;
 *  - Worlds, once World 1's boss is beaten; Rebirth, a couple of worlds before the first rebirth's;
 *  - Heists, with the first rebirth (BAL.heist.unlockRebirths).
 * Core decides when each opens; the UI introduces them one at a time (the tutorial points at it) and
 * marks each `seen`. Saves from before this have everything (state.ts).
 */
import { BAL } from '../../data';
import { FEATURES, type Feature, type GameState } from '../state';
import type { CoreEvent } from '../types';
import { upgradeCost as dumpsterUpgradeCost } from './dumpster';
import { rebirthRequirement } from './rebirth';
import { affordableUpgrades } from './upgrades';

/** The order features are introduced in when several are waiting. */
export const FEATURE_ORDER: readonly Feature[] = FEATURES;

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
      return d.lifetime.itemsEquipped > 0;
    case 'luck':
    case 'codex':
      return tutorialOver(d);
    case 'upgrades':
      return tutorialOver(d) && affordableUpgrades(d).length > 0;
    case 'dumpster':
      return tutorialOver(d) && d.currencies.coins >= dumpsterUpgradeCost(d.dumpster.level);
    case 'worlds':
      return d.stage.highestCleared >= 1 || d.rebirths > 0;
    case 'rebirth':
      return d.stage.highestCleared >= rebirthTabWorld() || d.rebirths > 0;
    case 'heist':
      return d.rebirths >= BAL.heist.unlockRebirths;
  }
}

/** Opens every feature that has become useful (run after every tick and action). */
export function checkFeatures(d: GameState, ev: CoreEvent[]): void {
  const open = d.features.unlocked;
  if (open.length >= FEATURES.length) return;
  for (const f of FEATURE_ORDER) {
    if (open.includes(f) || !ready(d, f)) continue;
    open.push(f);
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

/** The opened feature being introduced now: the first opened and not yet seen (one at a time), or null. */
export function introFeature(state: Pick<GameState, 'features'>): Feature | null {
  for (const f of FEATURE_ORDER) if (state.features.unlocked.includes(f) && !state.features.seen.includes(f)) return f;
  return null;
}

/**
 * How a feature shows: 'open' once introduced, 'intro' while it is the one being introduced, else
 * 'locked' (not open yet, or waiting for the one before it to be introduced).
 */
export function featureView(state: Pick<GameState, 'features'>, f: Feature): FeatureView {
  if (state.features.seen.includes(f)) return 'open';
  if (!state.features.unlocked.includes(f)) return 'locked';
  return introFeature(state) === f ? 'intro' : 'locked';
}
