/**
 * The hero: Kevin's raccoon (art-src/raccoon_sheet.png, generated into packs/raccoon.ts by
 * tools/packs/chars.py), drawn 1:1 like every other battle sprite.
 *
 * Gear is drawn at the same pixel size, in two ways:
 *  - Hats, masks, shields, backpacks and weapons are separate sprites: their item icons at half
 *    resolution (16 x 16 icons become 8 x 8), placed on landmarks of the reference pose (frame 0).
 *  - Jackets, gloves, shoes and necklaces are baked into the body frames: the fur in that part of
 *    the body takes the item's colors, so they follow every pose exactly.
 * Each frame's offset from the reference pose is found by matching the head's silhouette; frames
 * where the head is hidden (curled up asleep) carry no gear.
 */
import { alphaAt, blank, color, downsample2, fromRows, rampOf, rgb, type PixelBuf, type SheetEntry } from './buf';
import { frameBuf } from './indexed';
import { DEFAULT_WEAPON_TILT, ITEM_SPRITES, WEAPON_ART_TILT, WEAPON_GRIP } from './items';
import { RACCOON, RACCOON_FUR } from './packs/raccoon';

export const HERO_SHEET = RACCOON;

/** Landmarks of the reference pose (frame 0), in frame pixels. */
export const HERO_POINTS = {
  /** Ground contact (the bottom edge of this row). */
  feet: RACCOON.anchor,
  /** The paw that holds the weapon (screen right, toward the enemies). */
  hand: { x: 15, y: 15 },
  /** The other paw: shields. */
  offHand: { x: 6, y: 15 },
  /** Top of the head between the ears: hats sit here. */
  head: { x: 11, y: 6 },
  /** Between the eyes: masks center here. */
  eyes: { x: 11, y: 10 },
} as const;

export type GearSlot = 'hat' | 'mask' | 'jacket' | 'gloves' | 'sneakers' | 'bling' | 'shield' | 'backpack' | 'ring';
/** Slots drawn as their own sprites (the rest are baked into the body). */
export const SPRITE_SLOTS = ['hat', 'mask', 'shield', 'backpack'] as const;
export type SpriteSlot = (typeof SPRITE_SLOTS)[number];

export interface FrameOffset {
  dx: number;
  dy: number;
  /** False when the head isn't visible (curled up): no gear is drawn on this frame. */
  head: boolean;
}

/** The head box in the reference pose, used to track the body from frame to frame. */
const HEAD_BOX = { x0: 7, y0: 5, x1: 16, y1: 12 };

let offsets: FrameOffset[] | null = null;

/** Every frame's offset from the reference pose. */
export function frameOffsets(): readonly FrameOffset[] {
  if (offsets) return offsets;
  const ref = frameBuf(RACCOON, 0);
  let total = 0;
  for (let y = HEAD_BOX.y0; y <= HEAD_BOX.y1; y++) for (let x = HEAD_BOX.x0; x <= HEAD_BOX.x1; x++) if (alphaAt(ref, x, y)) total++;
  offsets = RACCOON.frames.map((_, f) => {
    const b = frameBuf(RACCOON, f);
    let best = { dx: 0, dy: 0, score: -Infinity };
    for (let dy = -3; dy <= 8; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        let score = 0;
        for (let y = HEAD_BOX.y0; y <= HEAD_BOX.y1; y++) {
          for (let x = HEAD_BOX.x0; x <= HEAD_BOX.x1; x++) {
            const a = alphaAt(ref, x, y) > 0;
            const c = alphaAt(b, x + dx, y + dy) > 0;
            if (a && c) score++;
            else if (a !== c) score--;
          }
        }
        // Prefer the smallest shift among equal scores.
        if (score > best.score || (score === best.score && Math.abs(dx) + Math.abs(dy) < Math.abs(best.dx) + Math.abs(best.dy))) {
          best = { dx, dy, score };
        }
      }
    }
    return { dx: best.dx, dy: best.dy, head: best.score >= total * 0.8 };
  });
  return offsets;
}

// ------------------------------------------------------------------ item colors and icons

const halves = new Map<string, PixelBuf>();

/** An item's icon at half resolution (how it looks worn by the small raccoon). */
export function halfIcon(baseId: string): PixelBuf | null {
  const rows = ITEM_SPRITES[baseId];
  if (!rows) return null;
  let h = halves.get(baseId);
  if (!h) {
    h = downsample2(fromRows(rows));
    halves.set(baseId, h);
  }
  return h;
}

const OUTLINE_KEYS = new Set(['k', 'x', '.']);

/** dark / mid / light colors built around an item icon's most used (non-outline) color. */
export function itemRamp(baseId: string): [string, string, string] {
  const rows = ITEM_SPRITES[baseId];
  const counts = new Map<string, number>();
  for (const row of rows ?? []) for (const ch of row) if (!OUTLINE_KEYS.has(ch)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let best = '5';
  let n = -1;
  for (const [ch, c] of counts) if (c > n) [best, n] = [ch, c];
  return rampOf(color(best));
}

// ------------------------------------------------------------------ body frames with clothes

export interface BodyGear {
  jacket?: string | null;
  gloves?: string | null;
  sneakers?: string | null;
  bling?: string | null;
}

const FUR = RACCOON_FUR.map((k) => RACCOON.pal[k]);

function furTone(b: PixelBuf, x: number, y: number): number {
  if (!alphaAt(b, x, y)) return -1;
  const i = (y * b.w + x) * 4;
  for (let k = 0; k < FUR.length; k++) {
    const [r, g, bl] = rgb(FUR[k]);
    if (b.px[i] === r && b.px[i + 1] === g && b.px[i + 2] === bl) return k;
  }
  return -1;
}

function paint(b: PixelBuf, x: number, y: number, hex: string): void {
  const [r, g, bl] = rgb(hex);
  b.px.set([r, g, bl, 255], (y * b.w + x) * 4);
}

/** Recolors fur inside a box (reference-pose coordinates, shifted by the frame's offset). */
function recolorBox(b: PixelBuf, o: FrameOffset, x0: number, y0: number, x1: number, y1: number, ramp: readonly string[]): void {
  for (let y = y0 + o.dy; y <= y1 + o.dy; y++) {
    for (let x = x0 + o.dx; x <= x1 + o.dx; x++) {
      const k = furTone(b, x, y);
      if (k >= 0) paint(b, x, y, ramp[k]);
    }
  }
}

/** One body frame in the given clothes. */
export function heroFrame(f: number, gear: BodyGear = {}): PixelBuf {
  const b = frameBuf(RACCOON, f);
  const o = frameOffsets()[f];
  if (!o.head) return b;
  if (gear.jacket) {
    // Torso and arms, up to the tail on the right.
    recolorBox(b, o, 4, 13, 15, 17, itemRamp(gear.jacket));
  }
  if (gear.gloves) {
    const r = itemRamp(gear.gloves);
    recolorBox(b, o, 4, 14, 7, 16, [r[0], r[1], r[2]]);
    recolorBox(b, o, 14, 14, 15, 16, [r[0], r[1], r[2]]);
  }
  if (gear.sneakers) {
    const r = itemRamp(gear.sneakers);
    recolorBox(b, o, 8, 18, 10, 19, [r[1], r[1], r[2]]);
    recolorBox(b, o, 13, 18, 15, 19, [r[1], r[1], r[2]]);
  }
  if (gear.bling) {
    const r = itemRamp(gear.bling);
    for (let x = 9; x <= 14; x++) if (furTone(b, x + o.dx, 13 + o.dy) >= 0) paint(b, x + o.dx, 13 + o.dy, r[0]);
    paint(b, 11 + o.dx, 14 + o.dy, r[2]);
    paint(b, 12 + o.dx, 14 + o.dy, r[1]);
  }
  return b;
}

// ------------------------------------------------------------------ separate gear sprites

export interface GearSprite {
  buf: PixelBuf;
  /** Top-left corner in reference-pose frame pixels. */
  x: number;
  y: number;
  /** Behind the body (backpacks) or in front. */
  behind: boolean;
}

function opaqueBounds(b: PixelBuf): { x: number; y: number; w: number; h: number } {
  let x0 = b.w;
  let y0 = b.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (!alphaAt(b, x, y)) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return x1 < 0 ? { x: 0, y: 0, w: 0, h: 0 } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** A worn item drawn as its own sprite, or null (baked slots, rings, unknown items). */
export function gearSprite(slot: GearSlot, baseId: string): GearSprite | null {
  if (!(SPRITE_SLOTS as readonly string[]).includes(slot)) return null;
  const buf = halfIcon(baseId);
  if (!buf) return null;
  const bb = opaqueBounds(buf);
  const P = HERO_POINTS;
  switch (slot) {
    case 'hat':
      // Bottom of the hat covers the top row of the head, centered between the ears.
      return { buf, x: P.head.x + 1 - Math.round(bb.x + bb.w / 2), y: P.head.y + 1 - (bb.y + bb.h - 1), behind: false };
    case 'mask':
      return { buf, x: P.eyes.x + 1 - Math.round(bb.x + bb.w / 2), y: P.eyes.y - Math.floor(bb.y + bb.h / 2), behind: false };
    case 'shield':
      return { buf, x: P.offHand.x - Math.round(bb.x + bb.w / 2), y: P.offHand.y - Math.round(bb.y + bb.h / 2), behind: false };
    case 'backpack':
      // Peeks out behind the left shoulder.
      return { buf, x: 3 - bb.x, y: 9 - bb.y, behind: true };
    default:
      return null;
  }
}

export interface WeaponSprite {
  buf: PixelBuf;
  /** The pixel the paw holds. */
  grip: { x: number; y: number };
  /** How far the art leans clockwise from straight up, in degrees. */
  tilt: number;
}

/** A weapon at half resolution with its grip, or null if the item has no art. */
export function weaponBuf(baseId: string): WeaponSprite | null {
  const buf = halfIcon(baseId);
  const g = WEAPON_GRIP[baseId];
  if (!buf || !g) return null;
  // The grip at half resolution, moved to the nearest opaque pixel if the halving cleared it.
  let grip = { x: Math.floor(g.x / 2), y: Math.floor(g.y / 2) };
  if (!alphaAt(buf, grip.x, grip.y)) {
    let best = { x: grip.x, y: grip.y, d: Infinity };
    for (let y = 0; y < buf.h; y++) {
      for (let x = 0; x < buf.w; x++) {
        if (!alphaAt(buf, x, y)) continue;
        const d = (x - grip.x) ** 2 + (y - grip.y) ** 2;
        if (d < best.d) best = { x, y, d };
      }
    }
    grip = { x: best.x, y: best.y };
  }
  return { buf, grip, tilt: WEAPON_ART_TILT[baseId] ?? DEFAULT_WEAPON_TILT };
}

export type Outfit = Partial<Record<GearSlot | 'weapon', string>>;

/**
 * The hero in one frame with a whole outfit, as one buffer (for previews; the battle draws the
 * parts as separate sprites so the weapon can swing). PAD pixels of room on every side.
 */
export function composeHero(f: number, outfit: Outfit, pad = 10): PixelBuf {
  const o = frameOffsets()[f];
  const out = blank(RACCOON.w + pad * 2, RACCOON.h + pad * 2);
  const put = (b: PixelBuf, x: number, y: number) => {
    for (let yy = 0; yy < b.h; yy++) {
      for (let xx = 0; xx < b.w; xx++) {
        if (!alphaAt(b, xx, yy)) continue;
        const tx = x + xx + pad;
        const ty = y + yy + pad;
        if (tx < 0 || ty < 0 || tx >= out.w || ty >= out.h) continue;
        const i = (yy * b.w + xx) * 4;
        out.px.set(b.px.subarray(i, i + 4), (ty * out.w + tx) * 4);
      }
    }
  };
  const sprites = SPRITE_SLOTS.map((s) => (outfit[s] && o.head ? gearSprite(s, outfit[s]!) : null)).filter((g): g is GearSprite => !!g);
  for (const g of sprites) if (g.behind) put(g.buf, g.x + o.dx, g.y + o.dy);
  put(heroFrame(f, outfit), 0, 0);
  for (const g of sprites) if (!g.behind) put(g.buf, g.x + o.dx, g.y + o.dy);
  const w = outfit.weapon && o.head ? weaponBuf(outfit.weapon) : null;
  if (w) put(w.buf, HERO_POINTS.hand.x + o.dx - w.grip.x, HERO_POINTS.hand.y + o.dy - w.grip.y);
  return out;
}

/** Preview: every frame, then a few frames in two sample outfits. */
export function sheet(): SheetEntry[] {
  const out: SheetEntry[] = RACCOON.frames.map((_, f) => ({ name: `frame ${f}`, buf: frameBuf(RACCOON, f) }));
  const a: Outfit = {
    hat: 'hat_traffic_cone', mask: 'mask_gas_station_shades', jacket: 'jacket_blue_tarp', gloves: 'gloves_oven_mitts',
    sneakers: 'sneakers_crocs', bling: 'bling_dog_tag', shield: 'shield_trash_lid', backpack: 'backpack_lunchbox', weapon: 'weapon_broken_rake',
  };
  const b: Outfit = {
    hat: 'hat_bike_helmet', mask: 'mask_peewee_hockey', jacket: 'jacket_ugly_sweater', gloves: 'gloves_kid_boxing',
    sneakers: 'sneakers_rain_boots', bling: 'bling_bottle_cap_chain', shield: 'shield_hubcap', backpack: 'backpack_picnic_cooler', weapon: 'weapon_tiki_torch',
  };
  for (const f of [0, 2, 4, 13, 15]) out.push({ name: `outfit a ${f}`, buf: composeHero(f, a) });
  for (const f of [0, 2, 4, 13, 15]) out.push({ name: `outfit b ${f}`, buf: composeHero(f, b) });
  return out;
}
