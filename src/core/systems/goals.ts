/**
 * Three goals always in view (the Worlds tab's "Next up"): one a few minutes away (the next world or
 * floor), one about an hour away (the next rebirth, or the next gate), one a day or more away (the
 * Endless Dump, the next rarity tier, becoming a Legend). Each has a strings key, its numbers, and how
 * far along it is (have / need) for its bar.
 */
import type { GameState } from '../state';
import { endlessOpen, nextTier, runFloor } from './endless';
import { floorOf, isDump, lastWorld, nextGate } from './floors';
import { legendGain, legendOpen } from './legend';
import { BAL } from '../../data';
import { rebirthRequirement } from './rebirth';

export interface Goal {
  key: string;
  params: Record<string, string | number>;
  have: number;
  need: number;
}

export function goals(state: GameState): Goal[] {
  const out: Goal[] = [];
  const best = state.stage.highestCleared;
  const open = endlessOpen(state);
  const floor = runFloor(state);
  // A few minutes away: the next world, or the next floor.
  if (!open) out.push({ key: 'goals.world', params: { n: best + 1 }, have: best, need: best + 1 });
  else out.push({ key: 'goals.floor', params: { n: floor + 1 }, have: floor, need: floor + 1 });
  // About an hour: the next rebirth (in the Dump, past the rebirth floor: the next gate).
  const req = rebirthRequirement(state.rebirths);
  const next = state.rebirths + 1;
  if (isDump(req.world) && best >= req.world) {
    const g = nextGate(floor + 1);
    out.push({ key: 'goals.gate', params: { n: Math.round(g / BAL.endless.gateEvery), floor: g }, have: floor, need: g });
  } else if (isDump(req.world)) {
    out.push({ key: 'goals.rebirthFloor', params: { n: next, floor: floorOf(req.world) }, have: floor, need: floorOf(req.world) });
  } else {
    out.push({ key: 'goals.rebirth', params: { n: next, world: req.world }, have: Math.min(best, req.world), need: req.world });
  }
  // A day or more: the Dump itself, then Legend, then the next rarity tier.
  const L = BAL.legend.unlockRebirths;
  if (!open && state.dump.bestEver === 0) {
    out.push({ key: 'goals.dump', params: {}, have: Math.min(best, lastWorld()), need: lastWorld() });
  } else if (state.legend.count === 0 && !legendOpen(state)) {
    out.push({ key: 'goals.legend', params: { n: L }, have: state.rebirths, need: L });
  } else {
    const tier = nextTier(state);
    if (tier) {
      out.push({ key: 'goals.tier', params: { name: tier.rarity, floor: tier.floor }, have: state.dump.bestEver, need: tier.floor });
    } else {
      const gain = legendGain(state).total;
      out.push({ key: 'goals.legendReady', params: { n: gain }, have: 1, need: 1 });
    }
  }
  return out;
}
