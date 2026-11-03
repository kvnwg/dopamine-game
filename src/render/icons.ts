/**
 * Item and UI art as data URLs for React, cached. Every picture the UI shows comes through here, all
 * pixel art (src/render/pixel) with one image pixel per art pixel. The UI draws each one at exactly
 * UI_PX stage px per art pixel (src/ui/components/PixelArt.tsx), the battle's pixel size, so every
 * pixel on screen is the same size.
 */
import { DATA, type Slot } from '../data';
import { fromRows, scale2x, silhouette, type PixelBuf, type Rows } from './pixel/buf';
import { pixelUrl } from './pixel';
import { ITEM_SPRITES } from './pixel/items';
import { FX, LUCK_TOKENS, UI_BITS, UI_MD, UI_NAV, UI_SM, UI_SPRITES, type UiIcon } from './pixel/ui';

/** Stage px per art pixel everywhere in the UI (the battle uses the same). */
export const UI_PX = 9;

/** A picture: a data URL with one image pixel per art pixel, and its size in art pixels. */
export interface Art {
  url: string;
  w: number;
  h: number;
}

const arts = new Map<string, Art>();

function art(key: string, make: () => PixelBuf): Art {
  let a = arts.get(key);
  if (!a) {
    const buf = make();
    a = { url: pixelUrl(`px1:${key}`, () => buf, 1), w: buf.w, h: buf.h };
    arts.set(key, a);
  }
  return a;
}

function firstOfSlot(slot: Slot): string {
  return DATA.items.find((i) => i.slot === slot && !i.unique)?.id ?? DATA.items[0].id;
}

function itemRows(baseId: string): Rows {
  return ITEM_SPRITES[baseId] ?? ITEM_SPRITES[firstOfSlot(DATA.itemsById.get(baseId)?.slot ?? 'hat')];
}

/** A base item's icon (16 x 16), in its natural colors (rarity shows on the tile). */
export function itemArt(baseId: string): Art {
  return art(`item:${baseId}`, () => fromRows(itemRows(baseId)));
}

/** The same icon at twice the resolution (Scale2x, 32 x 32), for the big rare-roll reveal. */
export function itemArtHd(baseId: string): Art {
  return art(`item2x:${baseId}`, () => scale2x(fromRows(itemRows(baseId))));
}

/** The URL of a base item's icon (16 x 16 image pixels). */
export function itemArtUrl(baseId: string): string {
  return itemArt(baseId).url;
}

/** An empty gear slot: a dim silhouette of a typical item for that slot. */
export function emptyItemArt(slot: Slot): Art {
  return art(`empty:${slot}`, () => silhouette(fromRows(ITEM_SPRITES[firstOfSlot(slot)]), '#4a4466'));
}

/**
 * Icon sizes: 'sm' about 5 x 5 (next to text), 'md' about 7 x 7 (HUD, map hexes), 'nav' 10 x 10
 * (nav bar, big headers), 'lg' the 16 x 16 originals.
 */
export type IconTier = 'sm' | 'md' | 'nav' | 'lg';

const TIERS: readonly IconTier[] = ['sm', 'md', 'nav', 'lg'];
const SETS: Record<IconTier, Partial<Record<UiIcon, Rows>>> = { sm: UI_SM, md: UI_MD, nav: UI_NAV, lg: UI_SPRITES };

/** The size an icon really shows at: `want` if it is drawn at that size, else the nearest drawn size. */
export function iconTier(name: UiIcon, want: IconTier): IconTier {
  const i = TIERS.indexOf(want);
  for (let d = 0; d < TIERS.length; d++) {
    for (const j of [i - d, i + d]) {
      const tier = TIERS[j];
      if (tier && SETS[tier][name]) return tier;
    }
  }
  return 'lg';
}

/** A UI icon at the given size (or the nearest size it is drawn at). */
export function uiIcon(name: UiIcon, want: IconTier = 'sm'): Art {
  const tier = iconTier(name, want);
  return art(`ui:${tier}:${name}`, () => fromRows(SETS[tier][name]!));
}

/** A luck token (16 x 16): the clover badge reading ×2, ×3, ×5 or ×10. */
export function luckTokenArt(x: keyof typeof LUCK_TOKENS): Art {
  return art(`token:${x}`, () => fromRows(LUCK_TOKENS[x]));
}

/** A small UI piece (payline arrows). `flip` mirrors it left to right. */
export function uiBitArt(name: keyof typeof UI_BITS, flip = false): Art {
  return art(`bit:${name}:${flip ? 1 : 0}`, () => {
    const rows = UI_BITS[name];
    return fromRows(flip ? rows.map((r) => [...r].reverse().join('')) : rows);
  });
}

/** The sparkle from the battle effects (7 x 7). */
export function sparkleArt(): Art {
  return art('fx:sparkle', () => fromRows(FX.sparkle));
}

/** The dumpster for the Dumpster Level popup: body (40 x 24) and lid (42 x 6). */
export function dumpsterArt(): { body: Art; lid: Art } {
  return { body: art('dumpster:body', () => fromRows(FX.dumpsterBody)), lid: art('dumpster:lid', () => fromRows(FX.dumpsterLid)) };
}
