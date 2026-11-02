/**
 * Item and UI art as data URLs for React, cached. One place to switch art sets:
 * every icon the UI shows comes through here.
 */
import type { Rarity, Slot } from '../data';
import { dumpsterBody, dumpsterLid, emptySlotIcon, gearIcon } from './cel';

const ICON_PX = 192;
const cache = new Map<string, string>();

function url(key: string, make: () => HTMLCanvasElement): string {
  let u = cache.get(key);
  if (!u) {
    u = make().toDataURL('image/png');
    cache.set(key, u);
  }
  return u;
}

export function itemIconUrl(slot: Slot, rarity: Rarity): string {
  return url(`i_${slot}_${rarity}`, () => gearIcon(slot, rarity, ICON_PX));
}

export function emptyIconUrl(slot: Slot): string {
  return url(`e_${slot}`, () => emptySlotIcon(slot, ICON_PX));
}

export function dumpsterArt(): { body: string; lid: string } {
  return { body: url('bin_body', dumpsterBody), lid: url('bin_lid', dumpsterLid) };
}
