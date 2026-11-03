/**
 * Item and UI art as data URLs for React, cached. Every picture the UI shows comes through here, all
 * pixel art (src/render/pixel) with one image pixel per art pixel. The UI draws each one at exactly
 * UI_PX stage px per image pixel (src/ui/components/PixelArt.tsx), the battle's pixel size, so every
 * pixel on screen is the same size. Big spots show finer versions of the same art (Scale2x, Scale3x:
 * two or three times the art pixels at that same pixel size), never a blow-up.
 */
import { DATA, type Slot } from '../data';
import { fromRows, scale2x, scale3x, silhouette, type PixelBuf, type Rows } from './pixel/buf';
import { pixelUrl } from './pixel';
import { ITEM_SPRITES } from './pixel/items';
import { FX, LUCK_TOKENS, UI_BITS, UI_MD, UI_SM, UI_SPRITES, UI_XS, type UiIcon } from './pixel/ui';

/** Stage px per art pixel everywhere in the UI (the battle uses the same). */
export const UI_PX = 6;

/**
 * How much finer than drawn a picture is: 1 as drawn, 2 its Scale2x version (twice the art pixels each
 * way), 3 its Scale3x version. Every version shows at UI_PX per image pixel.
 */
export type ArtScale = 1 | 2 | 3;

/** A picture: a data URL with one image pixel per art pixel, and its size in those pixels. */
export interface Art {
  url: string;
  w: number;
  h: number;
  /** A Scale2x (2) or Scale3x (3) version of art drawn `scale` times coarser; 1 or absent: as drawn. */
  scale?: ArtScale;
}

const arts = new Map<string, Art>();

function art(key: string, make: () => PixelBuf, scale: ArtScale = 1): Art {
  const k = scale === 1 ? key : `${key}@${scale}x`;
  let a = arts.get(k);
  if (!a) {
    const drawn = make();
    const buf = scale === 3 ? scale3x(drawn) : scale === 2 ? scale2x(drawn) : drawn;
    a = { url: pixelUrl(`px1:${k}`, () => buf, 1), w: buf.w, h: buf.h, scale };
    arts.set(k, a);
  }
  return a;
}

function firstOfSlot(slot: Slot): string {
  return DATA.items.find((i) => i.slot === slot && !i.unique)?.id ?? DATA.items[0].id;
}

function itemRows(baseId: string): Rows {
  return ITEM_SPRITES[baseId] ?? ITEM_SPRITES[firstOfSlot(DATA.itemsById.get(baseId)?.slot ?? 'hat')];
}

/**
 * A base item's icon in its natural colors (rarity shows on the tile): 16 x 16 as drawn (96 stage px,
 * for grids), or its Scale2x (32 x 32, 192 px, showcase spots) or Scale3x version (48 x 48, 288 px,
 * the rare-roll reveal).
 */
export function itemArt(baseId: string, scale: ArtScale = 1): Art {
  return art(`item:${baseId}`, () => fromRows(itemRows(baseId)), scale);
}

/** The icon at twice the resolution (Scale2x, 32 x 32): the last roll, the item popup, big Watch reels. */
export function itemArtHd(baseId: string): Art {
  return itemArt(baseId, 2);
}

/** The icon at three times the resolution (Scale3x, 48 x 48): the full-screen rare-roll reveal. */
export function itemArtX3(baseId: string): Art {
  return itemArt(baseId, 3);
}

/** The URL of a base item's icon (16 x 16 image pixels). */
export function itemArtUrl(baseId: string): string {
  return itemArt(baseId).url;
}

/** An empty gear slot: a dim silhouette of a typical item for that slot. */
export function emptyItemArt(slot: Slot, scale: ArtScale = 1): Art {
  return art(`empty:${slot}`, () => silhouette(fromRows(ITEM_SPRITES[firstOfSlot(slot)]), '#4a4466'), scale);
}

/**
 * Icon sizes, each drawn on its own (src/render/pixel/ui.ts): 'xs' about 5 x 5 (tiny badges), 'sm'
 * about 7 x 7 (next to text), 'md' about 10 x 10 (HUD, headers, map hexes), 'nav' the 16 x 16 originals
 * (the nav bar, big spots) and 'lg' their Scale2x versions (32 x 32, the biggest spots).
 */
export type IconTier = 'xs' | 'sm' | 'md' | 'nav' | 'lg';

const TIERS: readonly IconTier[] = ['xs', 'sm', 'md', 'nav', 'lg'];
const SETS: Record<IconTier, Partial<Record<UiIcon, Rows>>> = { xs: UI_XS, sm: UI_SM, md: UI_MD, nav: UI_SPRITES, lg: UI_SPRITES };

/** The size an icon really shows at: `want` if it is drawn at that size, else the nearest drawn size. */
export function iconTier(name: UiIcon, want: IconTier): IconTier {
  const i = TIERS.indexOf(want);
  for (let d = 0; d < TIERS.length; d++) {
    for (const j of [i - d, i + d]) {
      const tier = TIERS[j];
      if (tier && SETS[tier][name]) return tier;
    }
  }
  return 'nav';
}

/** A UI icon at the given size (or the nearest size it is drawn at). */
export function uiIcon(name: UiIcon, want: IconTier = 'sm'): Art {
  const tier = iconTier(name, want);
  return art(`ui:${tier === 'lg' ? 'nav' : tier}:${name}`, () => fromRows(SETS[tier][name]!), tier === 'lg' ? 2 : 1);
}

/**
 * A luck token: the clover badge reading ×2, ×3, ×5 or ×10 (16 x 16, like an item: 1 in grids and on
 * the reels, 2 or 3 in the spots where items show finer). A value without its own badge shows the
 * plain clover.
 */
export function luckTokenArt(x: number, scale: ArtScale = 1): Art {
  const rows = LUCK_TOKENS[x as keyof typeof LUCK_TOKENS] ?? UI_SPRITES.clover;
  return art(`token:${x in LUCK_TOKENS ? x : 'clover'}`, () => fromRows(rows), scale);
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

/** The dumpster for the Dumpster Level popup: body (60 x 32) and lid (62 x 9). */
export function dumpsterArt(): { body: Art; lid: Art } {
  return { body: art('dumpster:body', () => fromRows(FX.dumpsterBody)), lid: art('dumpster:lid', () => fromRows(FX.dumpsterLid)) };
}
