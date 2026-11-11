/**
 * Timing of the big rare-roll reveal (RareReveal): the screen goes black, a heartbeat in the dark,
 * the item rises and shines, then its "1 in X" counts up and lands. Bigger deals take longer.
 * The roll controller uses the total to close the reveal on its own.
 */
import { BAL } from '../data';
import type { RollDrama } from '../core';
import type { RollView } from './uiStore';

export const DRAMA_LEVEL: Record<RollDrama, number> = { big: 0, huge: 1, insane: 2, hyper: 3 };

/** HYPER RARE's showcase can't be skipped before this (ms from its start: the portal, then the burst). */
export const HYPER_LOCK_MS = 2400;

export interface RevealPhases {
  /** Fade to black. */
  black: number;
  /** Darkness with a heartbeat. */
  dark: number;
  /** The item rises out of the dark. */
  appear: number;
  /** The odds count up. */
  count: number;
  /** Heartbeats in the dark. */
  beats: number;
}

export function revealPhases(drama: RollDrama, calm: boolean): RevealPhases {
  const lvl = DRAMA_LEVEL[drama];
  // HYPER RARE: the dark is the summoning (a portal, warp, lightning, warning bands), ending in the burst
  // as the item appears; it can't be skipped until then (HYPER_LOCK_MS), Reduce motion or not.
  return {
    black: 250,
    dark: drama === 'hyper' ? HYPER_LOCK_MS - 250 : calm ? 300 : [700, 1300, 2000][lvl],
    appear: 650,
    count: [1700, 2400, 3100, 3800][lvl],
    beats: calm ? 1 : [2, 3, 5, 7][lvl],
  };
}

/** Milliseconds from the start until the odds land. */
export function revealIntroMs(drama: RollDrama, calm: boolean): number {
  const p = revealPhases(drama, calm);
  return p.black + p.dark + p.appear + p.count;
}

/** The whole reveal: the intro, then the result stays up for the rarity's reveal time. */
export function revealTotalMs(view: Pick<RollView, 'drama' | 'item'>, calm: boolean): number {
  const intro = view.drama ? revealIntroMs(view.drama, calm) : 0;
  return intro + BAL.feel.revealSecondsByRarity[view.item.rarity] * 1000 + 900;
}
