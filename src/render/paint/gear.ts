/**
 * Painted gear: one storybook-style placeholder per slot, tinted by rarity, with the art
 * direction's rarity treatments (Junk dull and taped up, Shiny polished, Epic glowing trim,
 * Legendary gold accents and sparkles, Mythic rainbow sheen, Mint in Box with a price sticker).
 * The same drawings serve as gear-grid icons (React, data URLs) and raccoon overlays (Phaser).
 */
import type { Rarity, Slot } from '../../data';
import { DATA, RARITIES } from '../../data';
import {
  desaturate, ellipse, fillShape, glow, ink, INK, INK_DEEP, makeCanvas, mix, paint, rrect, seeded, shadowOf, shape,
  sparkle, stroke, within, type Ctx, type Pt, type Rnd,
} from './brush';
import { paintRaccoonFrame } from './frames';

const TAPE = DATA.assets.placeholders.palette.tape;
const GOLD = DATA.assets.placeholders.palette.gold;
const RAINBOW = ['#FF5252', '#FFB300', '#69F0AE', '#40C4FF', '#E040FB'];

type Glyph = (g: GearPen) => Pt[][];

/** A drawing pen in a local 100-unit box: (0,0) is the item's center. */
export class GearPen {
  constructor(
    public ctx: Ctx,
    public rnd: Rnd,
    private ox: number,
    private oy: number,
    private k: number,
    private rot: number,
    public color: string,
    public rarity: Rarity,
    public lineScale: number,
  ) {}
  p(x: number, y: number): Pt {
    const c = Math.cos(this.rot);
    const s = Math.sin(this.rot);
    return { x: this.ox + (x * c - y * s) * this.k, y: this.oy + (x * s + y * c) * this.k };
  }
  pts(list: Array<[number, number]>): Pt[] {
    return list.map(([x, y]) => this.p(x, y));
  }
  ell(x: number, y: number, rx: number, ry: number, n = 32): Pt[] {
    return ellipse(0, 0, rx, ry, n).map((q) => this.p(x + q.x, y + q.y));
  }
  box(x: number, y: number, w: number, h: number, r: number): Pt[] {
    return rrect(x, y, w, h, r).map((q) => this.p(q.x, q.y));
  }
  get line(): number {
    return Math.max(2, 5 * this.k * this.lineScale);
  }
  /** Paint + ink a part in the item's (rarity-treated) color or a given color. */
  part(pts: Pt[], color = this.body, opts: { line?: number; hard?: number; light?: number } = {}): Pt[] {
    const shine = this.rarity === 'shiny' || this.rarity === 'legendary' || this.rarity === 'mint' ? 0.45 : this.rarity === 'junk' ? 0.12 : 0.3;
    const b = paint(this.ctx, this.rnd, pts, { color, hard: opts.hard ?? 0.4, lightAlpha: opts.light ?? shine, light: '#FFE2B0' });
    ink(this.ctx, this.rnd, pts, { width: opts.line ?? this.line });
    return b;
  }
  get body(): string {
    return this.rarity === 'junk' ? desaturate(this.color, 0.45) : this.color;
  }
}

const GLYPHS: Record<Slot, Glyph> = {
  // Traffic cone: towering, striped, on a square base.
  hat: (g) => {
    const base = g.part(g.box(-46, 30, 92, 14, 5), shadowOf(g.body, 0.25));
    const cone = g.part(g.pts([[-32, 32], [32, 32], [7, -60], [-7, -60]]));
    within(g.ctx, cone, () => {
      fillShape(g.ctx, g.pts([[-24, 2], [24, 2], [19, -14], [-19, -14]]), '#F7F1E4', 0.92);
      fillShape(g.ctx, g.pts([[-14, -30], [14, -30], [10, -44], [-10, -44]]), '#F7F1E4', 0.92);
    });
    return [base, cone];
  },
  // Goggles: strap, two round frames, glassy lenses.
  mask: (g) => {
    const strap = g.part(g.box(-56, -6, 112, 12, 5), shadowOf(g.body, 0.45), { line: g.line * 0.7 });
    const parts = [strap];
    for (const x of [-21, 21]) {
      const frame = g.part(g.ell(x, 0, 20, 20));
      fillShape(g.ctx, g.ell(x, 0, 13, 13), '#BFF4F8', 0.85);
      fillShape(g.ctx, g.ell(x - 4, -4, 4, 3), '#FFFFFF', 0.9);
      ink(g.ctx, g.rnd, g.ell(x, 0, 13, 13), { width: g.line * 0.6 });
      parts.push(frame);
    }
    return parts;
  },
  // Vest: two front panels, a V-neck, buttons.
  jacket: (g) => {
    const left = g.part(g.pts([[-44, -40], [-16, -48], [-4, -20], [-4, 42], [-48, 42]]));
    const right = g.part(g.pts([[44, -40], [16, -48], [4, -20], [4, 42], [48, 42]]));
    for (const y of [-6, 14]) {
      fillShape(g.ctx, g.ell(-10, y, 3.5, 3.5), '#F7F1E4');
      ink(g.ctx, g.rnd, g.ell(-10, y, 3.5, 3.5), { width: g.line * 0.4 });
    }
    stroke(g.ctx, g.rnd, g.pts([[-36, 18], [-20, 18]]), g.line * 0.5, INK, 0.7);
    return [left, right];
  },
  // Spatula: a wooden handle and a slotted head.
  weapon: (g) => {
    const handle = g.part(g.box(-6, -6, 12, 68, 5), '#8D5A3B');
    const head = g.part(g.box(-20, -66, 40, 54, 10));
    for (const x of [-8, 0, 8]) fillShape(g.ctx, g.box(x - 2, -56, 4, 30, 2), shadowOf(g.body, 0.6), 0.9);
    return [handle, head];
  },
  // Trash-can lid with a handle and rivets.
  shield: (g) => {
    const lid = g.part(g.ell(0, 0, 46, 46));
    ink(g.ctx, g.rnd, g.ell(0, 0, 30, 30), { width: g.line * 0.5, alpha: 0.7 });
    const handle = g.part(g.box(-14, -6, 28, 12, 6), shadowOf(g.body, 0.4), { line: g.line * 0.7 });
    for (const [x, y] of [[-34, 0], [34, 0], [0, -34], [0, 34]] as const) fillShape(g.ctx, g.ell(x, y, 2.6, 2.6), '#F7F1E4', 0.9);
    return [lid, handle];
  },
  // Rubber glove with a cuff.
  gloves: (g) => {
    const thumb = g.part(g.ell(-28, 2, 12, 18));
    const palm = g.part(g.box(-26, -26, 52, 58, 20));
    for (const x of [-12, 2, 16]) stroke(g.ctx, g.rnd, g.pts([[x, -24], [x, -6]]), g.line * 0.45, INK, 0.6);
    const cuff = g.part(g.box(-30, 30, 60, 16, 6), shadowOf(g.body, 0.3));
    return [thumb, palm, cuff];
  },
  // Sneaker in side view with laces and a plain stripe.
  sneakers: (g) => {
    const upper = g.part(g.pts([[-48, 14], [-44, -14], [-14, -24], [18, -8], [48, 0], [50, 14]]));
    const sole = g.part(g.box(-52, 12, 104, 15, 7), '#F7F1E4', { hard: 0.25 });
    for (const x of [-30, -20, -10]) stroke(g.ctx, g.rnd, g.pts([[x, -18], [x + 8, -10]]), g.line * 0.45, '#F7F1E4', 0.95);
    stroke(g.ctx, g.rnd, g.pts([[-34, 4], [0, -4], [30, 4]]), g.line * 0.8, '#F7F1E4', 0.85);
    return [upper, sole];
  },
  // Backpack with a flap and a pocket.
  backpack: (g) => {
    const bag = g.part(g.box(-34, -34, 68, 78, 18));
    const flap = g.part(g.box(-34, -34, 68, 30, 16), shadowOf(g.body, 0.25));
    const pocket = g.part(g.box(-20, 10, 40, 24, 8), shadowOf(g.body, 0.15), { line: g.line * 0.7 });
    fillShape(g.ctx, g.ell(0, -6, 4, 4), GOLD, 0.95);
    return [bag, flap, pocket];
  },
  // Chain with a bottle-cap medallion.
  bling: (g) => {
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.15 + (0.7 * i) / 8);
      const x = Math.cos(a) * 42;
      const y = -30 + Math.sin(a) * 42 - 34;
      fillShape(g.ctx, g.ell(x, y + 34, 5, 4), '#C9CED6', 0.95);
      ink(g.ctx, g.rnd, g.ell(x, y + 34, 5, 4), { width: g.line * 0.35 });
    }
    const cap = g.part(g.ell(0, 30, 22, 22));
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      fillShape(g.ctx, g.ell(Math.cos(a) * 21, 30 + Math.sin(a) * 21, 3, 3), shadowOf(g.body, 0.35), 0.9);
    }
    fillShape(g.ctx, g.ell(-6, 24, 6, 4), '#FFFFFF', 0.6);
    return [cap];
  },
  // A chunky ring with a gem.
  ring: (g) => {
    const band = g.part(g.ell(0, 12, 34, 30));
    within(g.ctx, band, () => fillShape(g.ctx, g.ell(0, 14, 20, 17), INK_DEEP, 1));
    ink(g.ctx, g.rnd, g.ell(0, 14, 20, 17), { width: g.line * 0.7 });
    const gem = g.part(g.pts([[-16, -18], [0, -40], [16, -18], [0, -8]]), '#BFF4F8', { hard: 0.3, light: 0.6 });
    return [band, gem];
  },
};

/** The rarity treatment drawn over a finished glyph. */
function treat(g: GearPen, parts: Pt[][], cx: number, cy: number, size: number) {
  const ctx = g.ctx;
  switch (g.rarity) {
    case 'junk': {
      // Patched with tape and a little grime.
      const t = g.pts([[-14, -10], [16, -16], [18, -6], [-12, 0]]);
      fillShape(ctx, t, TAPE, 0.88);
      ink(ctx, g.rnd, t, { width: g.line * 0.35, alpha: 0.5 });
      break;
    }
    case 'shiny':
      for (const b of parts.slice(0, 1)) {
        within(ctx, b, () => {
          ctx.save();
          ctx.globalAlpha = 0.55;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = size * 0.06;
          ctx.beginPath();
          ctx.moveTo(cx - size * 0.5, cy + size * 0.1);
          ctx.lineTo(cx + size * 0.1, cy - size * 0.5);
          ctx.stroke();
          ctx.restore();
        });
      }
      break;
    case 'epic':
      glow(ctx, cx, cy, size * 0.75, g.color, 0.35);
      break;
    case 'legendary':
      glow(ctx, cx, cy, size * 0.85, GOLD, 0.35);
      sparkle(ctx, cx + size * 0.38, cy - size * 0.36, size * 0.09, '#FFF3B0');
      sparkle(ctx, cx - size * 0.4, cy - size * 0.1, size * 0.06, '#FFFFFF', 0.9);
      sparkle(ctx, cx + size * 0.2, cy + size * 0.42, size * 0.05, '#FFF3B0', 0.9);
      break;
    case 'mythic':
      for (const b of parts) {
        within(ctx, b, () => {
          ctx.save();
          ctx.globalAlpha = 0.5;
          ctx.globalCompositeOperation = 'screen';
          const grad = ctx.createLinearGradient(cx - size * 0.5, cy - size * 0.5, cx + size * 0.5, cy + size * 0.5);
          RAINBOW.forEach((c, i) => grad.addColorStop(i / (RAINBOW.length - 1), c));
          ctx.fillStyle = grad;
          ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
          ctx.restore();
        });
      }
      sparkle(ctx, cx + size * 0.36, cy - size * 0.38, size * 0.08, '#FFFFFF');
      break;
    case 'mint': {
      glow(ctx, cx, cy, size * 0.8, '#FFF4D6', 0.35);
      const tag = g.pts([[18, 22], [42, 18], [44, 34], [20, 38]]);
      shape(ctx, g.rnd, tag, { color: '#FFEB3B', line: g.line * 0.45, hard: 0.2, grain: 0.1 });
      sparkle(ctx, cx - size * 0.38, cy - size * 0.38, size * 0.08, '#FFFFFF');
      sparkle(ctx, cx + size * 0.4, cy - size * 0.2, size * 0.06, '#FFF3B0');
      break;
    }
    default:
      break;
  }
}

export function rarityHex(r: Rarity): string {
  return DATA.assets.placeholders.rarities[r].color;
}

/** Draws one gear item at (x, y) with `scale` (1 = ~100 px) and rotation in radians. */
export function paintGear(ctx: Ctx, slot: Slot, rarity: Rarity, x: number, y: number, scale: number, rot = 0, seed = 1, lineScale = 1): void {
  const rnd = seeded(seed * 97 + RARITIES.indexOf(rarity) * 13 + slot.length);
  const pen = new GearPen(ctx, rnd, x, y, scale, rot, rarityHex(rarity), rarity, lineScale);
  const parts = GLYPHS[slot](pen);
  treat(pen, parts, x, y, 100 * scale);
}

// ------------------------------------------------------------------ icons for React
const iconCache = new Map<string, string>();

/** Painted icon as a data URL (cached). */
export function gearIconUrl(slot: Slot, rarity: Rarity, size = 160): string {
  const key = `${slot}_${rarity}_${size}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const { c, ctx } = makeCanvas(size, size);
  paintGear(ctx, slot, rarity, size / 2, size / 2 + size * 0.02, size / 128, 0, 3, 1.2);
  const url = c.toDataURL('image/png');
  iconCache.set(key, url);
  return url;
}

/** A faint ink silhouette for an empty slot (collection gaps read as missing pieces). */
export function emptySlotUrl(slot: Slot, size = 160): string {
  const key = `empty_${slot}_${size}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const { c, ctx } = makeCanvas(size, size);
  const rnd = seeded(5);
  const pen = new GearPen(ctx, rnd, size / 2, size / 2, size / 128, 0, '#000000', 'junk', 1);
  // Draw the glyph's outline only: paint into a scratch canvas, then keep its alpha as a silhouette.
  const scratch = makeCanvas(size, size);
  const ghost = new GearPen(scratch.ctx, rnd, size / 2, size / 2, size / 128, 0, '#888888', 'decent', 1);
  GLYPHS[slot](ghost);
  ctx.drawImage(scratch.c, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = mix(INK, '#B9A6C9', 0.45);
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, 0, size, size);
  void pen;
  const url = c.toDataURL('image/png');
  iconCache.set(key, url);
  return url;
}

// ------------------------------------------------------------------ overlays on the raccoon
/** Where each slot sits on the raccoon (texture coordinates relative to the feet). */
export const OVERLAY: Record<Slot, Array<{ x: number; y: number; scale: number; rot?: number }>> = {
  backpack: [{ x: -78, y: -108, scale: 0.78 }],
  jacket: [{ x: 2, y: -80, scale: 1.08 }],
  sneakers: [
    { x: -24, y: -12, scale: 0.46 },
    { x: 26, y: -12, scale: 0.46 },
  ],
  shield: [{ x: -60, y: -84, scale: 0.9 }],
  weapon: [{ x: 96, y: -150, scale: 1.25, rot: 0.42 }],
  gloves: [
    { x: -46, y: -70, scale: 0.4 },
    { x: 58, y: -72, scale: 0.5 },
  ],
  mask: [{ x: 28, y: -177, scale: 0.92 }],
  hat: [{ x: 16, y: -262, scale: 1.04 }],
  bling: [{ x: 18, y: -104, scale: 0.46 }],
  ring: [{ x: 70, y: -86, scale: 0.26 }],
};

/** Slots drawn behind the raccoon's body. */
export const BACK_SLOTS: Slot[] = ['backpack'];

/** A raccoon-sized transparent canvas with one equipped item painted in place. */
export function gearOverlayCanvas(slot: Slot, rarity: Rarity): HTMLCanvasElement {
  return paintRaccoonFrame((ctx, fx, fy) => {
    OVERLAY[slot].forEach((o, i) => paintGear(ctx, slot, rarity, fx + o.x, fy + o.y, o.scale, o.rot ?? 0, 11 + i, 1.1));
  });
}
