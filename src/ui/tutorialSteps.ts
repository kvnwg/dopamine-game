/**
 * The first-run tutorial's story, as plain functions of the game (TutorialLayer.tsx draws it;
 * tests/tutorialSteps.test.ts plays it through). The raccoon is already fighting in World 1 as the
 * game opens, so every step is about his gear:
 *  1. open: tap the padlock on the dumpster. It rolls by itself: one quick everyday find, then the
 *     tutorial's own Legendary with the big reveal.
 *  2. wear: the reveal's tap puts it on (TAP TO WEAR IT). The slam and the power count show he is
 *     stronger, and one line says why that matters.
 *  3. best: once two better finds are waiting, the Bag tab and Equip best.
 *  4. lucky: a meter fills toward beginner's luck (meanwhile the Roll tab's first upgrade can be
 *     bought); its spin chains two luck tokens (a line says what they are) into a rare hat, and the
 *     reveal's tap puts it on. The tutorial ends.
 * Every line is two short ones: what to do, and why (Kevin: "explain things a bit more, but don't
 * use too much text"). The top line always names what the hand points at, so a button on another tab
 * is asked for in two steps: the tab, then the button.
 */
import { bestUpgrades, type GameState } from '../core';
import { BAL } from '../data';
import { reelStops } from './reelTiming';
import type { Tab } from './uiStore';

export type Step = 'open' | 'roll' | 'wear' | 'best' | 'fight' | 'lucky';

/** Where the tutorial is, from the game itself (nothing extra is saved): null when it's over. */
export function stepOf(g: GameState): Step | null {
  const b = g.dumpster.beginner;
  if (b.state === 'done') return null;
  // He's already fighting; the first thing to do is the padlocked dumpster.
  if (!g.features.unlocked.includes('roll')) return 'open';
  const worn = g.lifetime.itemsEquipped > 0;
  // The warm-up spin and the tutorial's own find rolling in, until that find has landed. (Its spin,
  // not its kind of item in the bag: the Bag only opens as the real one lands.)
  if (!g.dumpster.firstDiveDone) return 'roll';
  const spin = g.roll.current;
  if (!worn && spin !== null && spin.scripted === 'first' && !spin.landed) return 'roll';
  // Its find goes on from its reveal (TAP TO WEAR IT). Without the reveal (the game was reloaded on
  // it), the Bag's Equip best puts it on.
  if (!worn) return 'wear';
  // Beginner's luck has landed: it goes on from its reveal too.
  if (b.state === 'rolled' && g.inventory.some((x) => x.uid === b.uid)) return 'lucky';
  // The rest of what has rolled goes on with Equip best (taught once: after a few items are on, no more).
  if (g.lifetime.itemsEquipped < BAL.tutorial.beginnerAfterEquips && bestUpgrades(g).length >= 2) return 'best';
  return 'fight';
}

/** The pips: the dumpster open, the first find on, dressed with Equip best, beginner's luck on. */
export const STEPS = 4;

/** How many of the steps are done. */
export function doneCount(g: GameState): number {
  if (g.dumpster.beginner.state === 'done') return STEPS;
  if (!g.features.unlocked.includes('roll')) return 0;
  const n = g.lifetime.itemsEquipped;
  return n === 0 ? 1 : n < BAL.tutorial.beginnerAfterEquips ? 2 : 3;
}

/** Beginner's luck is rolling: its spin has started and its find hasn't landed in the bag yet. */
export function luckIncoming(g: GameState): boolean {
  const b = g.dumpster.beginner;
  return b.state === 'rolled' && !g.inventory.some((x) => x.uid === b.uid);
}

/** Beginner's luck is landing its luck tokens right now: from its first token until its item lands. */
export function tokensLanding(g: GameState): boolean {
  const spin = g.roll.current;
  if (!spin || spin.landed || spin.scripted !== 'beginner') return false;
  const first = reelStops(spin, 0)[0];
  return first.token !== null && g.roll.timer * 1000 >= first.at;
}

/** What the hand taps: the padlock, the Bag's Equip best, the first-upgrade card's Buy, or a tab. */
export type Spot = 'lock' | 'equipBest' | 'buy' | `tab:${Tab}`;

/** One ask: the strings `key` (what to do) and `key.why` (why), and where the hand points (null: just watch). */
export interface Prompt {
  key: string;
  spot: Spot | null;
  gold?: boolean;
}

/** A button on its own tab, or first the way to that tab. */
const onTab = (tab: Tab, home: Tab, here: Prompt, there: string): Prompt => (tab === home ? here : { key: there, spot: `tab:${home}`, gold: here.gold });

/** What a step asks for on the open tab (null: nothing to do, he fights and the reels roll). */
export function promptFor(step: Step, tab: Tab): Prompt | null {
  switch (step) {
    case 'open':
      return onTab(tab, 'alley', { key: 'tut.open', spot: 'lock' }, 'tut.goRoll');
    case 'roll':
      return { key: 'tut.roll', spot: null };
    case 'wear':
      return onTab(tab, 'bag', { key: 'tut.wear', spot: 'equipBest' }, 'tut.wearBag');
    case 'best':
      return onTab(tab, 'bag', { key: 'tut.best', spot: 'equipBest' }, 'tut.bag');
    case 'lucky':
      return onTab(tab, 'bag', { key: 'tut.lucky', spot: 'equipBest', gold: true }, 'tut.luckyBag');
    case 'fight':
      return null;
  }
}

/** The first upgrade's price is in: its Buy button on the Roll tab (FirstBuy.tsx). */
export function buyPrompt(tab: Tab): Prompt {
  return onTab(tab, 'alley', { key: 'tut.buy', spot: 'buy', gold: true }, 'tut.buyRoll');
}

/** Said once the first find is on and its power count has played: what the gear is for. */
export const AFTER_WEAR = 'tut.fight';
/** While he fights and beginner's luck is on its way: its meter (the bubble's default). */
export const CHARGE_LINE = 'tut.charge';
/** Its spin is rolling. */
export const INCOMING_LINE = 'tut.chargeNow';
/** Its luck tokens are landing. */
export const TOKENS_LINE = 'tut.tokens';
