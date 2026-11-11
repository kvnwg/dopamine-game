/**
 * The hero: Kevin's raccoon (art-src/raccoon_sheet.png, generated into packs/raccoon.ts by
 * tools/packs/chars.py) with his walk cycle (packs/raccoonWalk.ts, drawn by hand in his style), drawn
 * 1:1 like every other battle sprite, and dressed in his gear.
 *
 * Every wearable item has worn art drawn for the raccoon's own shape at his pixel size (worn/), fitted
 * to each frame of the sheet by landmarks measured by hand (worn/body.ts): hats ride his head with his
 * ears poking through, masks sit on his face (a squashed version for squashed faces), garments are
 * painted over his torso and arms pixel by pixel so they wrap every pose, gloves go on his paws, shoes
 * on his feet, bling at his neck, a shield on his back paw, packs on his back with straps in front.
 * The weapon is redrawn at his size and held in his front paw. Rings are too small to show.
 *
 * The sheet faces left (tail on the right). The battle mirrors the body and the worn gear so he faces
 * the enemies on the right (textures.ts); everything here is in the sheet's own, unmirrored pixels,
 * except the weapon, which is drawn the way the battle shows it.
 */
import { blank, blit, flipX, setPx, type PixelBuf, type SheetEntry } from './buf';
import { frameBuf } from './indexed';
import { RACCOON_WITH_WALK, WALK_STRIDE } from './packs/raccoonWalk';
import { pose } from './worn/body';
import { WEAPONS, WORN, WORN_SLOTS, dress, keyColor, wornOver, type Outfit as WornOutfit } from './worn/dress';

/** Kevin's sheet and the walk drawn for it (frames 36 to 42, animation `walk`). */
export const HERO_SHEET = RACCOON_WITH_WALK;

/** The columns of his feet on the ground row in a frame (as drawn). */
function planted(frame: number): number[] {
  return pose(frame).feet.flatMap((p) => (p && p.y === HERO_SHEET.anchor.y ? [p.x] : []));
}

/**
 * The walk (packs/raccoonWalk.ts): its frames and frame rate, and how far a planted foot moves back
 * each frame (art px). The ground must go by at stride x fps art px a second, or his feet slide.
 * `footfalls` are the frames where a foot comes down, with that foot's column (as drawn).
 */
export const HERO_WALK = (() => {
  const { frames, fps } = HERO_SHEET.anims.walk;
  const footfalls: Record<number, number> = {};
  frames.forEach((f, i) => {
    const before = planted(frames[(i + frames.length - 1) % frames.length]);
    for (const x of planted(f)) if (!before.includes(x - WALK_STRIDE)) footfalls[f] = x;
  });
  return { frames, fps, stride: WALK_STRIDE, footfalls: footfalls as Readonly<Record<number, number>> };
})();

/** Landmarks of the reference pose (frame 0), in frame pixels as drawn (facing left). */
export const HERO_POINTS = {
  /** Ground contact (the bottom edge of this row). */
  feet: HERO_SHEET.anchor,
  /** The front paw (left as drawn, toward the enemies once mirrored): it holds the weapon. */
  hand: { x: pose(0).hand!.x, y: pose(0).hand!.y },
  /** The back paw, by the tail: shields. */
  offHand: { x: pose(0).offHand!.x, y: pose(0).offHand!.y },
  /** Top of the head between the ears: hats sit here. */
  head: { x: 11, y: 6 },
  /** Between the eyes: masks center here. */
  eyes: { x: 11, y: 10 },
} as const;

export type GearSlot = 'hat' | 'mask' | 'jacket' | 'gloves' | 'sneakers' | 'bling' | 'shield' | 'backpack' | 'ring';
/** Slots the battle draws as their own sprites over the body (gearTex); the rest are painted into the body frames. */
export const SPRITE_SLOTS = ['hat', 'mask', 'shield', 'backpack'] as const;
export type SpriteSlot = (typeof SPRITE_SLOTS)[number];

export interface FrameOffset {
  dx: number;
  dy: number;
  /** False when the head isn't visible (curled up): no head gear, shield, pack or weapon on this frame. */
  head: boolean;
}

let headOffsets: FrameOffset[] | null = null;

/** Every frame's head offset from the reference pose (measured by hand, worn/body.ts). */
export function frameOffsets(): readonly FrameOffset[] {
  headOffsets ??= HERO_SHEET.frames.map((_, f) => {
    const h = pose(f).head;
    return h ? { dx: h.x, dy: h.y, head: true } : { dx: 0, dy: 0, head: false };
  });
  return headOffsets;
}

let pawOffsets: FrameOffset[] | null = null;

/**
 * Every frame's front paw offset from the reference pose: the weapon stays in his paw as he raises his
 * arms, ducks into a dash or squats. `head` as in frameOffsets.
 */
export function handOffsets(): readonly FrameOffset[] {
  pawOffsets ??= HERO_SHEET.frames.map((_, f) => {
    const p = pose(f);
    return p.hand && p.head ? { dx: p.hand.x - HERO_POINTS.hand.x, dy: p.hand.y - HERO_POINTS.hand.y, head: true } : { dx: 0, dy: 0, head: false };
  });
  return pawOffsets;
}

// ------------------------------------------------------------------ body frames with clothes

/** What the body frames wear: clothes always; hats, masks, shields and packs too when given (baked in). */
export interface BodyGear {
  jacket?: string | null;
  gloves?: string | null;
  sneakers?: string | null;
  bling?: string | null;
  hat?: string | null;
  mask?: string | null;
  shield?: string | null;
  backpack?: string | null;
}

const bodyCache = new Map<string, PixelBuf>();

/** One body frame in the given gear (as drawn, facing left). */
export function heroFrame(f: number, gear: BodyGear = {}): PixelBuf {
  const slots = WORN_SLOTS.filter((s) => gear[s as keyof BodyGear]);
  if (!slots.length) return frameBuf(HERO_SHEET, f);
  const key = `${f}|${slots.map((s) => `${s}:${gear[s as keyof BodyGear]}`).join('|')}`;
  let b = bodyCache.get(key);
  if (!b) {
    b = dress(f, gear as WornOutfit, slots);
    if (bodyCache.size > 400) bodyCache.clear();
    bodyCache.set(key, b);
  }
  return { w: b.w, h: b.h, px: new Uint8ClampedArray(b.px) };
}

// ------------------------------------------------------------------ separate gear sprites

export interface GearSprite {
  buf: PixelBuf;
  /** Top-left corner in frame pixels (worn art is frame-sized, so 0, 0). */
  x: number;
  y: number;
  /** Behind the body or in front (worn art handles its own depth: always in front). */
  behind: boolean;
}

/** The body clothes in a BodyGear. */
export function clothesOf(gear: BodyGear): BodyGear {
  return { jacket: gear.jacket ?? null, gloves: gear.gloves ?? null, sneakers: gear.sneakers ?? null, bling: gear.bling ?? null };
}

/**
 * A hat, mask, shield or pack as its own frame-sized sprite for one frame, to lie over the body frame
 * dressed in `clothes`: a pack's bag shows only where the dressed body doesn't cover it. Null for the
 * other slots, rings and unknown items.
 */
export function gearSprite(slot: GearSlot, baseId: string, frame = 0, clothes: BodyGear = {}): GearSprite | null {
  if (!(SPRITE_SLOTS as readonly string[]).includes(slot) || !WORN[slot as SpriteSlot][baseId]) return null;
  return { buf: wornOver(slot as SpriteSlot, baseId, frame, heroFrame(frame, clothesOf(clothes))), x: 0, y: 0, behind: false };
}

export interface WeaponSprite {
  buf: PixelBuf;
  /** The pixel the paw holds. */
  grip: { x: number; y: number };
  /** How far the art leans clockwise from straight up, in degrees. */
  tilt: number;
}

const weapons = new Map<string, WeaponSprite>();

/** A weapon at the raccoon's size with its grip, or null if the item has no art. */
export function weaponBuf(baseId: string): WeaponSprite | null {
  const a = WEAPONS[baseId];
  if (!a) return null;
  let w = weapons.get(baseId);
  if (!w) {
    const buf = blank(a.rows[0].length, a.rows.length);
    a.rows.forEach((row, y) => [...row].forEach((k, x) => k !== '.' && setPx(buf, x, y, keyColor(a.pal, k))));
    w = { buf, grip: { ...a.grip }, tilt: a.tilt };
    weapons.set(baseId, w);
  }
  return w;
}

export type Outfit = Partial<Record<GearSlot | 'weapon', string>>;

/**
 * The hero in one frame with a whole outfit, as one buffer, the way the battle shows him: body and
 * worn gear mirrored to face right, the weapon (never mirrored) in his front paw. For previews; the
 * battle draws the parts as separate sprites so the weapon can swing. PAD pixels of room on every side.
 */
export function composeHero(f: number, outfit: Outfit, pad = 10): PixelBuf {
  const o = handOffsets()[f];
  const body = flipX(dress(f, outfit as WornOutfit));
  const out = blank(HERO_SHEET.w + pad * 2, HERO_SHEET.h + pad * 2);
  blit(out, body, pad, pad);
  const w = outfit.weapon && o.head ? weaponBuf(outfit.weapon) : null;
  if (w) blit(out, w.buf, pad + HERO_SHEET.w - 1 - (HERO_POINTS.hand.x + o.dx) - w.grip.x, pad + HERO_POINTS.hand.y + o.dy - w.grip.y);
  return out;
}

/** Preview: every frame, every worn item on frame 0, then a few frames in sample outfits, then the walk in both. */
export function sheet(): SheetEntry[] {
  const out: SheetEntry[] = HERO_SHEET.frames.map((_, f) => ({ name: `frame ${f}`, buf: frameBuf(HERO_SHEET, f) }));
  for (const slot of WORN_SLOTS) for (const id of Object.keys(WORN[slot])) out.push({ name: id, buf: dress(0, { [slot]: id }) });
  for (const id of Object.keys(WEAPONS)) out.push({ name: id, buf: composeHero(0, { weapon: id }, 4) });
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
  HERO_SHEET.anims.walk.frames.forEach((f, i) => out.push({ name: `walk a ${i}`, buf: composeHero(f, a) }));
  HERO_SHEET.anims.walk.frames.forEach((f, i) => out.push({ name: `walk b ${i}`, buf: composeHero(f, b) }));
  return out;
}
