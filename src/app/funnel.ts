/**
 * The first-session funnel: when each step of a new game's first minutes happens, in seconds of play
 * since PLAY, so where new players leave can be read off real numbers instead of guessed (CrazyGames'
 * conversion counts who plays past one minute). Every step is read off the game as it changes, so
 * nothing extra is saved, and each fires once per game. They go out as 'funnel' events through
 * services/analytics, to whatever sink is set there (store.ts sends them; session.ts sends 'play').
 */
import { BAL } from '../data';
import type { CoreEvent, GameState } from '../core';

/** Seconds of play at which a "still playing" mark goes out (`played_60s` is the one conversion counts). */
export const PLAY_MARKS = [15, 30, 45, 60, 90, 120, 180, 300] as const;

export interface FunnelHit {
  step: string;
  /** Seconds of play when it happened. */
  t: number;
}

const NONE: FunnelHit[] = [];

const tiersOwned = (g: GameState) => Object.values(g.upgrades).reduce((n, v) => n + v, 0);

/** The funnel steps passed between `prev` and `next` (one change of the game, with its events). */
export function funnelSteps(prev: GameState, next: GameState, events: readonly CoreEvent[]): FunnelHit[] {
  // The first run only, and nothing left to watch once it is well under way.
  if (next.rebirths > 0) return NONE;
  const lastMark = PLAY_MARKS[PLAY_MARKS.length - 1] * 1000;
  if (prev.playTimeMs >= lastMark && prev.dumpster.beginner.state === 'done' && prev.stage.highestCleared > 0) return NONE;
  const t = Math.round(next.playTimeMs / 100) / 10;
  const out: FunnelHit[] = [];
  const hit = (step: string, at = t) => out.push({ step, t: at });
  if (!prev.features.unlocked.includes('roll') && next.features.unlocked.includes('roll')) hit('dumpster_open');
  if (prev.roll.count === 0 && next.roll.count > 0) hit('first_roll');
  if (events.some((e) => e.type === 'roll' && e.scripted === 'first')) hit('first_find');
  const worn = (g: GameState) => g.lifetime.itemsEquipped;
  if (worn(prev) === 0 && worn(next) > 0) hit('first_equip');
  const dressed = BAL.tutorial.beginnerAfterEquips;
  if (worn(prev) < dressed && worn(next) >= dressed) hit('dressed');
  const owned = tiersOwned(next);
  const before = tiersOwned(prev);
  if (before < 1 && owned >= 1) hit('first_upgrade');
  if (before < 2 && owned >= 2) hit('second_upgrade');
  if (prev.dumpster.beginner.state === 'pending' && next.dumpster.beginner.state === 'rolled') hit('beginner_spin');
  if (events.some((e) => e.type === 'roll' && e.scripted === 'beginner')) hit('beginner_find');
  if (prev.dumpster.beginner.state !== 'done' && next.dumpster.beginner.state === 'done') {
    hit(events.some((e) => e.type === 'tutorialDone') ? 'tutorial_done' : 'tutorial_left');
  }
  if (next.lifetime.bossesBeaten === 0 && next.stage.losses === 0 && events.some((e) => e.type === 'bossAttempt')) hit('first_boss');
  if (prev.stage.highestCleared === 0 && next.stage.highestCleared > 0) hit('world_1_clear');
  for (const s of PLAY_MARKS) if (prev.playTimeMs < s * 1000 && next.playTimeMs >= s * 1000) hit(`played_${s}s`, s);
  return out;
}
