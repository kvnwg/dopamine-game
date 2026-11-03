/**
 * Item and UI art as data URLs for React, cached. Every icon the UI shows comes through here,
 * all drawn as pixel art (src/render/pixel).
 */
import { DATA, type Slot } from '../data';
import { fromRows, silhouette } from './pixel/buf';
import { pixelUrl } from './pixel';
import { ITEM_SPRITES } from './pixel/items';
import { FX, UI_SPRITES, type UiIcon } from './pixel/ui';

function firstOfSlot(slot: Slot): string {
  return DATA.items.find((i) => i.slot === slot && !i.unique)?.id ?? DATA.items[0].id;
}

/** The icon for a base item: its own art, in its natural colors (rarity shows on the frame). */
export function itemArtUrl(baseId: string): string {
  const rows = ITEM_SPRITES[baseId] ?? ITEM_SPRITES[firstOfSlot(DATA.itemsById.get(baseId)?.slot ?? 'hat')];
  return pixelUrl(`item:${baseId}`, () => fromRows(rows));
}

/** An empty gear slot: a dim silhouette of a typical item for that slot. */
export function emptyIconUrl(slot: Slot): string {
  return pixelUrl(`empty:${slot}`, () => silhouette(fromRows(ITEM_SPRITES[firstOfSlot(slot)]), '#4a4466'));
}

export function uiIconUrl(name: UiIcon): string {
  return pixelUrl(`ui:${name}`, () => fromRows(UI_SPRITES[name]));
}

export function dumpsterArt(): { body: string; lid: string } {
  return {
    body: pixelUrl('dumpster:body', () => fromRows(FX.dumpsterBody)),
    lid: pixelUrl('dumpster:lid', () => fromRows(FX.dumpsterLid)),
  };
}
