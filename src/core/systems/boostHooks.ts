/**
 * The moments the boosts (boosts.ts) hook into, kept apart from it so the reels, the battle and rebirth can
 * call them without importing boosts.ts (which needs those systems itself).
 */
import { BAL } from '../../data';
import type { GameState } from '../state';
import { MS_PER_MINUTE } from '../time';
import type { CoreEvent } from '../types';

const B = BAL.boosts;

/** A rebirth happened: a Blessing waiting for it starts its fast spins. */
export function blessRebirth(d: GameState, now: number, ev: CoreEvent[]): void {
  const b = d.boosts;
  if (!b.blessReady) return;
  b.blessReady = false;
  b.blessEndsAt = now + B.rebirthBlessing.minutes * MS_PER_MINUTE;
  ev.push({ type: 'blessingStarted', endsAt: b.blessEndsAt });
}

/** A spin with a big chain on any reel: it's on offer as an Encore for a few minutes (not the tutorial's). */
export function offerEncore(d: GameState, tokens: number[][], mult: number, now: number): void {
  if (mult >= B.encore.minMult) d.boosts.encore = { tokens: tokens.map((m) => [...m]), mult, at: now };
}

/** A death at `world` (`losses` in a row there): Boss Rage is offered from the second. A Rage on there is used up. */
export function rageAfterDeath(d: GameState, world: number, losses: number, push: boolean): void {
  const b = d.boosts;
  if (b.rageWorld === world) b.rageWorld = null;
  if (push && losses >= B.bossRage.afterLosses) b.rageOffer = world;
}

/** `world`'s boss fell: its Rage (offered or on) is done. */
export function rageAfterClear(d: GameState, world: number): void {
  const b = d.boosts;
  if (b.rageWorld === world) b.rageWorld = null;
  if (b.rageOffer === world) b.rageOffer = null;
}
