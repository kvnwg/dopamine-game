/**
 * The first-run tutorial's story, as plain functions (TutorialLayer.tsx shows it): where a new game
 * is in it, and for each step what the bubble says and what the hand points at.
 *
 * Every line is two strings: `key` is what to do (or what just happened), and `key.why` one short
 * line of why (Kevin: "explain things a bit more, but don't use too much text. keep everything simply
 * worded"). The top line always names the thing the hand points at: a button on another tab is asked
 * for in two steps, its tab first.
 */
import { bestUpgrades, type GameState } from '../core';
import { reelStops } from './reelTiming';
import type { Tab } from './uiStore';

export type Step = 'world' | 'open' | 'roll' | 'best' | 'fight' | 'lucky';

/** Where the tutorial is, from the game itself (nothing extra is saved): null when it's over. */
export function stepOf(g: GameState): Step | null {
  const b = g.dumpster.beginner;
  if (b.state === 'done') return null;
  // First a world, then the dumpster (whose padlock waits for it, DumpsterLock).
  if (!g.features.unlocked.includes('roll')) return g.stage.chosen ? 'open' : 'world';
  const worn = g.lifetime.itemsEquipped > 0;
  // The warm-up spins and the tutorial's own find rolling in (Kevin: "get them accustomed a bit first"),
  // until that find has landed. (Its spin, not its kind of item in the bag: the Bag only opens as the
  // real one lands.)
  if (!g.dumpster.firstDiveDone) return 'roll';
  const spin = g.roll.current;
  if (!worn && spin !== null && spin.scripted === 'first' && !spin.landed) return 'roll';
  // Its find (and the warm-up's) go on with Equip best, no dragging (Kevin: "just take them to equip best").
  if (!worn) return 'best';
  // Beginner's luck: once its item has landed in the bag, put it on (Equip best again).
  if (b.state === 'rolled' && g.inventory.some((x) => x.uid === b.uid)) return 'lucky';
  // Then wear the best of the rest at once (done for good after a few items have gone on).
  if (g.lifetime.itemsEquipped < 3 && bestUpgrades(g).length >= 2) return 'best';
  return 'fight';
}

/** The bubble's pips: a world, the dumpster, Equip best, beginner's luck. */
export const STEPS = 4;

/** How many of the four are done. */
export function doneCount(step: Step): number {
  return step === 'world' ? 0 : step === 'open' ? 1 : step === 'roll' || step === 'best' ? 2 : 3;
}

/**
 * Beginner's luck is on the reels and its first luck token has landed: the bubble says what tokens
 * are while they chain (by the spin's own clock, so it holds on any tab).
 */
export function tokensLanding(g: GameState): boolean {
  const spin = g.roll.current;
  if (!spin || spin.landed || spin.scripted !== 'beginner') return false;
  const first = reelStops(spin, 0)[0];
  return first.token !== null && g.roll.timer * 1000 >= first.at;
}

/** What the hand taps: World 1's card, the dumpster's padlock, the Bag's Equip best button, or a tab. */
export type Spot = 'world1' | 'lock' | 'equipBest' | `tab:${Tab}`;

/** A line of the bubble (its strings are `key` and `key.why`), and where the hand points with it. */
export interface Prompt {
  key: string;
  spot: Spot | null;
  /** A gold bubble: something lucky. */
  gold?: boolean;
}

/** Picking the first world: its card on the Worlds tab, the tab itself from anywhere else. */
export function worldPrompt(tab: Tab): Prompt {
  return tab === 'worlds' ? { key: 'tut.pickWorld', spot: 'world1' } : { key: 'tut.goWorlds', spot: 'tab:worlds' };
}

/**
 * What a step asks for with `tab` open. The 'fight' step asks for nothing (TutorialLayer fills it
 * with what just happened: the lines after the first equip, the luck tokens).
 */
export function promptFor(step: Step, tab: Tab): Prompt | null {
  switch (step) {
    case 'world':
      return worldPrompt(tab);
    case 'open':
      // He's fighting with nothing on: to the Roll tab, then the padlock.
      return tab === 'alley' ? { key: 'tut.open', spot: 'lock' } : { key: 'tut.goRoll', spot: 'tab:alley' };
    case 'roll':
      return { key: 'tut.roll', spot: null };
    case 'best':
      return tab === 'bag' ? { key: 'tut.best', spot: 'equipBest' } : { key: 'tut.bag', spot: 'tab:bag' };
    case 'lucky':
      return tab === 'bag' ? { key: 'tut.lucky', spot: 'equipBest', gold: true } : { key: 'tut.luckyBag', spot: 'tab:bag', gold: true };
    case 'fight':
      return null;
  }
}

/** What the bubble says once the first gear is on, in order (each for a few seconds). */
export const AFTER_EQUIP = ['tut.fight', 'tut.more'] as const;
/** What it says while beginner's luck chains its tokens. */
export const TOKENS_LINE = 'tut.tokens';
