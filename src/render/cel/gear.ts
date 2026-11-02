/**
 * Gear sprites: the weapon, the nine wearable overlays in RACCOON_FRAME coordinates, and UI icons.
 * Suggested layer order on the hero (back to front):
 *   backpack, body, sneakers, jacket, bling, shield, gloves, ring, mask, hat, weapon, front paw.
 */
import { CEL_PALETTE as C, type Rarity, type Slot } from './palette';
import { type Ctx, type Pt, makeCanvas, silhouette, smooth } from './core';
import { ANAT, HERO_LW, RACCOON_FRAME, drawBackArm, drawBackPaw, drawFrontArm } from './raccoon';
import {
  type ItemMeta, type Look, drawBackpack, drawCap, drawChain, drawCone, drawGlove, drawGoggles, drawLid, drawRingItem,
  drawSneaker, drawSparkle, drawSpatula, drawStick, drawVestIcon, finishItem, lookOf, mainPart, metaToCanvas,
} from './items';

const SEED: Record<Slot, number> = { hat: 11, mask: 23, jacket: 37, weapon: 41, shield: 53, gloves: 67, sneakers: 71, backpack: 83, bling: 97, ring: 101 };
const RSEED: Record<Rarity, number> = { junk: 1, decent: 2, shiny: 3, epic: 4, legendary: 5, mythic: 6, mint: 7 };

/** Run `fn` in a local frame (translate, rotate, uniform scale); returns its meta in canvas px. */
function local(ctx: Ctx, x: number, y: number, rot: number, s: number, fn: () => ItemMeta): ItemMeta {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  const meta = metaToCanvas(ctx, fn());
  ctx.restore();
  return meta;
}

// ------------------------------------------------------------------ weapon
const WEAPON_BOX = { w: 120, h: 240, grip: { x: 60, y: 196 } };

export function weaponSprite(rarity: Rarity | null): { canvas: HTMLCanvasElement; grip: Pt } {
  const { c, ctx } = makeCanvas(WEAPON_BOX.w, WEAPON_BOX.h);
  const g = WEAPON_BOX.grip;
  const meta = local(ctx, g.x, g.y, 0, 1, () => (rarity ? drawSpatula(ctx, lookOf(rarity, HERO_LW)) : drawStick(ctx, HERO_LW)));
  const out = finishItem(c, rarity, meta, HERO_LW, SEED.weapon * 13 + (rarity ? RSEED[rarity] : 0), 2);
  return { canvas: out, grip: { ...g } };
}

// ------------------------------------------------------------------ overlays (RACCOON_FRAME px)
function vestOverlay(ctx: Ctx, L: Look): ItemMeta {
  const back = smooth([123, 243, 150, 241, 165, 252, 170, 282, 168, 312, 162, 326, 138, 330, 115, 322, 106, 300, 106, 270], true);
  const front = smooth([186, 247, 198, 246, 211, 268, 213, 300, 207, 322, 190, 328, 185, 302, 183, 270], true);
  const box = { x: 106, y: 241, w: 107, h: 89 };
  mainPart(ctx, back, L, { box, dx: 5, dy: 6, hi: { x: 122, y: 262, rx: 7, ry: 12, a: 0.4, rot: 0.3 } });
  mainPart(ctx, front, L, { box: { x: 183, y: 246, w: 30, h: 82 }, dx: 4, dy: 6, hi: null });
  // pocket + flap on the back panel
  const pocket = smooth([128, 290, 156, 288, 157, 310, 129, 312], true);
  mainPart(ctx, pocket, L, { box: { x: 128, y: 288, w: 29, h: 24 }, dx: 2, dy: 3, hi: null, trim: false });
  const flap = smooth([126, 287, 158, 285, 156, 296, 128, 298], true);
  mainPart(ctx, flap, { ...L, main: L.shade, shade: L.shade }, { box: { x: 126, y: 285, w: 32, h: 13 }, dx: 0, dy: 2, hi: null, trim: false });
  // buttons
  for (const y of [268, 290, 310]) drawButton(ctx, 190, y);
  // hem shadow on the fur below the vest is implied by the outline; re-draw arms over the vest
  drawBackArm(ctx, HERO_LW);
  drawFrontArm(ctx, HERO_LW);
  return { box, tape: { x: 142, y: 266, ang: 0.5, len: 30 }, tag: { x: 208, y: 312 } };
}

function drawButton(ctx: Ctx, x: number, y: number): void {
  const p = new Path2D();
  p.arc(x, y, 3.8, 0, Math.PI * 2);
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.outline;
  ctx.stroke(p);
  ctx.fillStyle = '#FFF6E0';
  ctx.fill(p);
  ctx.restore();
}

function overlayDraw(ctx: Ctx, slot: Exclude<Slot, 'weapon'>, rarity: Rarity): ItemMeta {
  const lk = (s: number) => lookOf(rarity, HERO_LW / s);
  switch (slot) {
    case 'hat':
      return local(ctx, 147, 143, -0.07, 0.9, () => drawCone(ctx, lk(0.9)));
    case 'mask': {
      const a = { x: ANAT.eyeNear.x, y: ANAT.eyeNear.y, rx: 16.5, ry: 18 };
      const b = { x: ANAT.eyeFar.x + 1, y: ANAT.eyeFar.y, rx: 12.5, ry: 16.5 };
      const hx = ANAT.head.x;
      const strap = [hx - 9, 184, hx - 30, 181, hx - 50, 184, hx - 62, 192];
      return metaToCanvas(ctx, drawGoggles(ctx, lk(1), a, b, strap, 10, true));
    }
    case 'jacket':
      return vestOverlay(ctx, lk(1));
    case 'shield': {
      const m = local(ctx, 81, 290, -0.1, 0.7, () => drawLid(ctx, lk(0.7), 50, false));
      drawBackPaw(ctx, HERO_LW);
      return m;
    }
    case 'gloves':
      return local(ctx, ANAT.backPaw.x + 1, ANAT.backPaw.y + 2, Math.PI * 0.94, 0.62, () => drawGlove(ctx, lk(0.62)));
    case 'sneakers': {
      const m1 = local(ctx, ANAT.footBack.x + 1, 346, 0, 0.62, () => drawSneaker(ctx, lk(0.62)));
      const m2 = local(ctx, ANAT.footFront.x + 2, 347, 0, 0.64, () => drawSneaker(ctx, lk(0.64)));
      const x0 = Math.min(m1.box.x, m2.box.x);
      const y0 = Math.min(m1.box.y, m2.box.y);
      return {
        box: { x: x0, y: y0, w: Math.max(m1.box.x + m1.box.w, m2.box.x + m2.box.w) - x0, h: Math.max(m1.box.y + m1.box.h, m2.box.y + m2.box.h) - y0 },
        tape: m2.tape,
        tag: m2.tag,
      };
    }
    case 'backpack':
      return local(ctx, 94, 268, -0.12, 0.84, () => drawBackpack(ctx, lk(0.84), false));
    case 'bling': {
      drawChain(ctx, [125, 243, 138, 262, 160, 276, 182, 268, 197, 238], 5, HERO_LW * 0.8);
      return local(ctx, 160, 280, 0.05, 1, () => {
        drawCap(ctx, lk(1), 13);
        return { box: { x: -13, y: -13, w: 26, h: 26 }, tape: { x: 2, y: 3, ang: -0.6, len: 16 }, tag: { x: 10, y: 8 } };
      });
    }
    case 'ring': {
      const m = local(ctx, ANAT.backPaw.x + 3, ANAT.backPaw.y + 11, 0.2, 0.52, () => drawRingItem(ctx, lk(0.52), 20));
      drawSparkle(ctx, ANAT.backPaw.x - 15, ANAT.backPaw.y - 4, 8, '#FFF3A0');
      return m;
    }
  }
}

/** Slots big enough to carry the mint price tag when worn (all icons carry one). */
const TAGGED: ReadonlySet<Slot> = new Set<Slot>(['hat', 'jacket', 'shield', 'backpack']);

export function gearOverlay(slot: Exclude<Slot, 'weapon'>, rarity: Rarity): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(RACCOON_FRAME.w, RACCOON_FRAME.h);
  const meta = overlayDraw(ctx, slot, rarity);
  if (!TAGGED.has(slot)) delete meta.tag;
  const small = slot === 'ring' || slot === 'gloves' || slot === 'mask' || slot === 'bling';
  return finishItem(c, rarity, meta, HERO_LW, SEED[slot] * 13 + RSEED[rarity], small ? 1 : 2);
}

// ------------------------------------------------------------------ icons
/** Draws the slot's item centered in a 100x100 local box (fills ~80%). */
function iconDraw(ctx: Ctx, slot: Slot, rarity: Rarity, lwLocal: number): ItemMeta {
  const L = (s: number) => lookOf(rarity, lwLocal / s);
  switch (slot) {
    case 'hat':
      return local(ctx, 0, 41, -0.08, 0.68, () => drawCone(ctx, L(0.68)));
    case 'mask':
      return local(ctx, 0, 2, 0, 1, () =>
        drawGoggles(ctx, L(1), { x: -21, y: 0, rx: 14, ry: 15 }, { x: 21, y: 0, rx: 14, ry: 15 }, [-45, 3, 0, 1, 45, 3], 10, false));
    case 'jacket':
      return local(ctx, 0, 1, 0, 0.92, () => drawVestIcon(ctx, L(0.92)));
    case 'weapon':
      // center the spatula's mid-length (local y = -57) in the icon, tilted 45 degrees
      return local(ctx, -57 * 0.54 * Math.SQRT1_2, 57 * 0.54 * Math.SQRT1_2, Math.PI / 4, 0.54, () => drawSpatula(ctx, L(0.54)));
    case 'shield':
      return local(ctx, 0, 0, -0.08, 0.8, () => drawLid(ctx, L(0.8), 50));
    case 'gloves':
      return local(ctx, 3, -2, 0.22, 0.86, () => drawGlove(ctx, L(0.86)));
    case 'sneakers':
      return local(ctx, -1, 22, -0.12, 1.12, () => drawSneaker(ctx, L(1.12)));
    case 'backpack':
      return local(ctx, 0, 3, 0, 0.92, () => drawBackpack(ctx, L(0.92), true));
    case 'bling': {
      drawChain(ctx, [-27, -38, -30, -8, -12, 16, 0, 22, 12, 16, 30, -8, 27, -38], 4.6, lwLocal);
      drawChain(ctx, [-27, -38, -12, -44, 12, -44, 27, -38], 4.6, lwLocal);
      return local(ctx, 0, 22, 0, 1, () => {
        drawCap(ctx, L(1), 21);
        return { box: { x: -21, y: -21, w: 42, h: 42 }, tape: { x: 3, y: 4, ang: -0.6, len: 24 }, tag: { x: 16, y: 12 } };
      });
    }
    case 'ring':
      return local(ctx, 0, 10, 0, 1, () => drawRingItem(ctx, L(1), 34));
  }
}

function iconLw(size: number): number {
  return Math.max(2, Math.min(6, size * 0.042));
}

export function gearIcon(slot: Slot, rarity: Rarity, size: number): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(size, size);
  const k = size / 100;
  const lw = iconLw(size);
  ctx.translate(size / 2, size / 2);
  ctx.scale(k, k);
  const meta = iconDraw(ctx, slot, rarity, lw / k);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return finishItem(c, rarity, meta, lw, SEED[slot] * 17 + RSEED[rarity]);
}

export function emptySlotIcon(slot: Slot, size: number): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(size, size);
  const k = size / 100;
  ctx.translate(size / 2, size / 2);
  ctx.scale(k, k);
  iconDraw(ctx, slot, 'decent', iconLw(size) / k);
  return silhouette(c, 'rgba(112, 122, 146, 0.42)');
}
