/** XP, levels (and class, from Milestone 3). */
import { BAL } from '../../data';
import type { GameState } from '../state';
import type { CoreEvent } from '../types';
import { computeStats } from './stats';

/** XP needed to go from `level` to `level + 1`: 60 x level^1.7. */
export function xpToNext(level: number): number {
  const { base, exponent } = BAL.player.xpCurve;
  return Math.round(base * Math.pow(level, exponent));
}

/** Total XP needed to reach `level` from level 1. */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return total;
}

/** Adds XP and applies any level-ups. Max HP gained on level-up is also added to current HP. */
export function addXp(d: GameState, amount: number, ev: CoreEvent[]): void {
  if (amount <= 0) return;
  const cap = BAL.player.levelCap;
  if (d.player.level >= cap) return;
  d.player.xp += amount;
  let leveled = false;
  const hpBefore = computeStats(d).HP;
  while (d.player.level < cap && d.player.xp >= xpToNext(d.player.level)) {
    d.player.xp -= xpToNext(d.player.level);
    d.player.level += 1;
    leveled = true;
    ev.push({ type: 'levelUp', level: d.player.level });
  }
  if (d.player.level >= cap) d.player.xp = 0;
  if (leveled) {
    const gained = computeStats(d).HP - hpBefore;
    if (gained > 0 && d.battle.phase !== 'dead') d.battle.playerHp += gained;
  }
}
