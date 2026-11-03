/**
 * Dresses the raccoon: every worn item's art, fitted to each frame of his sheet and his walk. Each
 * item is drawn for his shape (worn/*.ts) and placed on that frame's landmarks (body.ts): hats on
 * the head, masks on the face, gloves on the paws, shoes on the feet, bling at the neck, a shield on
 * the back paw, a pack at the neck. Garments are painted pixel by pixel over his torso and arms, so
 * they follow every pose exactly; everything else is clipped to the body part it sits on where it
 * must not leave it (a mask stays on his head, straps stay on his chest).
 *
 * Everything is in the sheet's own pixels (facing left); the battle mirrors the dressed body.
 */
import { alphaAt, blank, color, rgb, setPx, type PixelBuf } from '../buf';
import { frameBuf } from '../indexed';
import { RACCOON_WITH_WALK } from '../packs/raccoonWalk';
import { CHARACTER_OUTLINE } from '../palette';
import { FRAME_COUNT, partAt, pose, type Part, type Point } from './body';
import { BACKPACKS } from './backpacks';
import { BLING } from './bling';
import { GLOVES } from './gloves';
import { HATS } from './hats';
import { JACKETS } from './jackets';
import { MASKS } from './masks';
import { SHIELDS } from './shields';
import { SHOES } from './sneakers';
import type { Colors, Cut, GarmentPixel, JacketArt, Piece } from './types';
import { WEAPONS } from './weapons';

export const W = RACCOON_WITH_WALK.w;
export const H = RACCOON_WITH_WALK.h;
export const OUTLINE = CHARACTER_OUTLINE;

export type WornSlot = 'hat' | 'mask' | 'jacket' | 'gloves' | 'sneakers' | 'bling' | 'shield' | 'backpack';
export const WORN_SLOTS: readonly WornSlot[] = ['hat', 'mask', 'jacket', 'gloves', 'sneakers', 'bling', 'shield', 'backpack'];

/** Every worn item's art by slot and item id. */
export const WORN = {
  hat: HATS,
  mask: MASKS,
  jacket: JACKETS,
  gloves: GLOVES,
  sneakers: SHOES,
  bling: BLING,
  shield: SHIELDS,
  backpack: BACKPACKS,
} as const;

export { WEAPONS };

/** One pixel of worn art in frame pixels (may lie outside the frame: tests check it never does). */
export interface Px {
  x: number;
  y: number;
  c: string;
}

/** A worn item in one frame: what goes behind the raccoon and what goes over him. */
export interface WornPixels {
  back: Px[];
  front: Px[];
}

const NONE: WornPixels = { back: [], front: [] };

/** A palette key's color: '#' is the characters' outline. */
export function keyColor(pal: Colors, key: string): string {
  if (key === '#') return OUTLINE;
  const c = pal[key];
  if (!c) throw new Error(`no color for key "${key}"`);
  return color(c);
}

/** The colors an item may use: its palette and the outline. */
export function paletteOf(pal: Colors): Set<string> {
  return new Set([OUTLINE, ...Object.values(pal).map((c) => color(c).toLowerCase())]);
}

/** The row he stands on: nothing worn goes below it. */
const GROUND = RACCOON_WITH_WALK.anchor.y;

/**
 * Pixels of a piece with its `at` pixel on (x, y), kept where `keep` allows. `flip` mirrors the piece
 * about `at`. A piece that would reach below the ground row is lifted onto it (paws resting on the
 * ground while he lies down).
 */
function placed(pal: Colors, piece: Piece, x: number, y: number, keep?: (x: number, y: number) => boolean, flip = false): Px[] {
  let bottom = -Infinity;
  piece.rows.forEach((row, yy) => {
    if (/[^.]/.test(row)) bottom = Math.max(bottom, y + (yy - piece.at.y));
  });
  if (bottom > GROUND) y -= bottom - GROUND;
  const out: Px[] = [];
  piece.rows.forEach((row, yy) => {
    for (let xx = 0; xx < row.length; xx++) {
      const k = row[xx];
      if (k === '.') continue;
      const tx = flip ? x + (piece.at.x - xx) : x + (xx - piece.at.x);
      const ty = y + (yy - piece.at.y);
      if (keep && !keep(tx, ty)) continue;
      out.push({ x: tx, y: ty, c: keyColor(pal, k) });
    }
  });
  return out;
}

const frames = new Map<number, PixelBuf>();
/** The bare raccoon in a frame (cached; don't modify). */
export function bare(frame: number): PixelBuf {
  let b = frames.get(frame);
  if (!b) {
    b = frameBuf(RACCOON_WITH_WALK, frame);
    frames.set(frame, b);
  }
  return b;
}

const [OR, OG, OB] = rgb(OUTLINE);
const FUR = [3, 5, 7].map((k) => rgb(RACCOON_WITH_WALK.pal[k]));

/** Is the raccoon's pixel his outline brown? */
function isLine(b: PixelBuf, x: number, y: number): boolean {
  if (!alphaAt(b, x, y)) return false;
  const i = (y * b.w + x) * 4;
  return b.px[i] === OR && b.px[i + 1] === OG && b.px[i + 2] === OB;
}

/** The raccoon's fur shade at a pixel: 0 dark, 1 mid, 2 light, -1 not fur. */
function furShade(b: PixelBuf, x: number, y: number): number {
  if (!alphaAt(b, x, y)) return -1;
  const i = (y * b.w + x) * 4;
  return FUR.findIndex(([r, g, bl]) => b.px[i] === r && b.px[i + 1] === g && b.px[i + 2] === bl);
}

// ------------------------------------------------------------------ hats

/** Frame 0's ear tips: the top row, then the row under it (the ears' own pixels beside the crown). */
const EAR_ROWS: readonly (readonly Point[])[] = [
  [{ x: 8, y: 5 }, { x: 9, y: 5 }, { x: 14, y: 5 }, { x: 15, y: 5 }],
  [{ x: 7, y: 6 }, { x: 8, y: 6 }, { x: 9, y: 6 }, { x: 14, y: 6 }, { x: 15, y: 6 }, { x: 16, y: 6 }],
];

function hatPixels(id: string, frame: number): WornPixels {
  const a = HATS[id];
  const p = pose(frame);
  if (!a || !p.head) return NONE;
  const dx = p.head.x;
  const dy = p.head.y;
  // His ear tips poke through: leave them clear (the raccoon under the hat shows there).
  const ears = new Set<string>();
  for (const row of EAR_ROWS.slice(0, a.ears)) for (const e of row) ears.add(`${e.x + dx},${e.y + dy}`);
  const keep = (x: number, y: number) => !(ears.has(`${x},${y}`) && partAt(frame, x, y) === 'h');
  return { back: [], front: placed(a.pal, a.art, a.on.x + dx, a.on.y + dy, keep) };
}

// ------------------------------------------------------------------ masks

function maskPixels(id: string, frame: number): WornPixels {
  const a = MASKS[id];
  const p = pose(frame);
  if (!a || !p.face) return NONE;
  const art = p.face.squash && a.squash ? a.squash : a.art;
  const x = a.on.x + p.face.x;
  const y = a.on.y + p.face.y;
  const front = placed(a.pal, art, x, y, (tx, ty) => partAt(frame, tx, ty) === 'h');
  if (a.free) front.push(...placed(a.pal, a.free, x, y));
  return { back: [], front };
}

// ------------------------------------------------------------------ garments

const COVERS: Readonly<Record<Cut, ReadonlySet<Part>>> = {
  vest: new Set<Part>(['n', 'b']),
  jacket: new Set<Part>(['n', 'b', 'f', 'k']),
  coat: new Set<Part>(['n', 'b', 'f', 'k', 'l']),
};

/** The neck, or for curled-up frames the top middle of the body. */
function neckOf(frame: number): Point {
  const n = pose(frame).neck;
  if (n) return n;
  for (let y = 0; y < H; y++) {
    const xs: number[] = [];
    for (let x = 0; x < W; x++) if (partAt(frame, x, y) === 'b') xs.push(x);
    if (xs.length) return { x: Math.round((xs[0] + xs[xs.length - 1]) / 2), y: y - 1 };
  }
  return { x: 11, y: 13 };
}

/** The garment's pixels in a frame with where each one is (for its palette function). */
export function garment(cut: Cut, frame: number): GarmentPixel[] {
  const b = bare(frame);
  const cover = COVERS[cut];
  const neck = neckOf(frame);
  const curled = !pose(frame).head;
  const inside = (x: number, y: number) => {
    const part = partAt(frame, x, y);
    return !!part && cover.has(part) && !isLine(b, x, y);
  };
  const out: GarmentPixel[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      const part = partAt(frame, x, y)!;
      const u = x - neck.x;
      const v = y - neck.y;
      // Lit from the top left: the lit rim on the upper left, shade on the lower right and in his own fur's creases.
      const shade = furShade(b, x, y);
      const open = (dx: number, dy: number) => !inside(x + dx, y + dy);
      let tone: 0 | 1 | 2 = 1;
      if (shade === 0 || (open(1, 0) && u > 0) || (open(0, 1) && v > 2)) tone = 0;
      else if ((open(0, -1) && u <= 0) || (open(-1, 0) && v <= 2)) tone = 2;
      const below = partAt(frame, x, y + 1);
      const side = partAt(frame, x + (part === 'f' ? -1 : 1), y);
      const arm = part === 'f' || part === 'k';
      const cuff = arm && (below === 'p' || below === 'q' || side === 'p' || side === 'q');
      const hem = !arm && part !== 'n' && !inside(x, y + 1) && partAt(frame, x, y + 1) !== null;
      const collar = part === 'n' || (part === 'b' && Math.abs(u) <= 1 && v <= 1);
      out.push({ x, y, u, v, part, tone, cuff, hem, collar, curled });
    }
  }
  return out;
}

function jacketPixels(id: string, frame: number): WornPixels {
  const a: JacketArt | undefined = JACKETS[id];
  if (!a) return NONE;
  const front: Px[] = [];
  for (const g of garment(a.cut, frame)) {
    const k = a.paint(g);
    if (k) front.push({ x: g.x, y: g.y, c: keyColor(a.pal, k) });
  }
  const p = pose(frame);
  const back: Px[] = [];
  if (p.neck && a.back) back.push(...placed(a.pal, a.back, p.neck.x, p.neck.y));
  return { back, front };
}

// ------------------------------------------------------------------ gloves, shoes, bling

function glovePixels(id: string, frame: number): WornPixels {
  const a = GLOVES[id];
  if (!a) return NONE;
  const p = pose(frame);
  const front: Px[] = [];
  if (p.hand) front.push(...placed(a.pal, a[p.hand.reach], p.hand.x, p.hand.y));
  if (p.offHand) front.push(...placed(a.pal, (a.back ?? a)[p.offHand.reach], p.offHand.x, p.offHand.y, undefined, true));
  return { back: [], front };
}

function shoePixels(id: string, frame: number): WornPixels {
  const a = SHOES[id];
  if (!a) return NONE;
  const [f, b] = pose(frame).feet;
  const front: Px[] = [];
  // The back foot first: the front shoe overlaps it.
  if (b) front.push(...placed(a.pal, a.back ?? a.front, b.x, b.y));
  if (f) front.push(...placed(a.pal, a.front, f.x, f.y));
  return { back: [], front };
}

function blingPixels(id: string, frame: number): WornPixels {
  const a = BLING[id];
  if (!a) return NONE;
  const p = pose(frame);
  const front: Px[] = [];
  if (a.art && p.neck) {
    const on = new Set<Part>(a.on ?? ['n', 'b']);
    front.push(...placed(a.pal, a.art, p.neck.x, p.neck.y, (x, y) => on.has(partAt(frame, x, y) as Part)));
  }
  if (a.wrist && p.hand) front.push(...placed(a.pal, a.wrist[p.hand.reach], p.hand.x, p.hand.y));
  return { back: [], front };
}

// ------------------------------------------------------------------ shields and packs

function shieldPixels(id: string, frame: number): WornPixels {
  const a = SHIELDS[id];
  const p = pose(frame);
  const h = p.offHand;
  if (!a || !h) return NONE;
  const at = h.reach === 'down' ? a.art.at : (a.raised ?? a.art.at);
  const on = p.shield ?? h;
  const behind = new Set<Part>(a.behind ?? []);
  return { back: [], front: placed(a.pal, { rows: a.art.rows, at }, on.x, on.y, (x, y) => !behind.has(partAt(frame, x, y) as Part)) };
}

const STRAP_PARTS = new Set<Part>(['n', 'b', 'f', 'k']);

function packPixels(id: string, frame: number): WornPixels {
  const a = BACKPACKS[id];
  const n = pose(frame).neck;
  if (!a || !n) return NONE;
  const on = a.on ? new Set<Part>(a.on) : STRAP_PARTS;
  return {
    back: placed(a.pal, a.back, n.x, n.y),
    front: placed(a.pal, a.straps, n.x, n.y, (x, y) => on.has(partAt(frame, x, y) as Part)),
  };
}

const RENDER: Record<WornSlot, (id: string, frame: number) => WornPixels> = {
  hat: hatPixels,
  mask: maskPixels,
  jacket: jacketPixels,
  gloves: glovePixels,
  sneakers: shoePixels,
  bling: blingPixels,
  shield: shieldPixels,
  backpack: packPixels,
};

/** A worn item's pixels in a frame (empty for unknown items and frames where it doesn't show). */
export function wornPixels(slot: WornSlot, id: string, frame: number): WornPixels {
  return RENDER[slot](id, frame);
}

// ------------------------------------------------------------------ composing

/** What he wears, by slot (item ids). */
export type Outfit = Partial<Record<WornSlot | 'weapon' | 'ring', string | null>>;

/** Back to front: packs hang behind capes; over him, clothes, then bling, straps, shield, mask, hat. */
export const BACK_ORDER: readonly WornSlot[] = ['backpack', 'jacket'];
export const FRONT_ORDER: readonly WornSlot[] = ['jacket', 'sneakers', 'gloves', 'bling', 'backpack', 'shield', 'mask', 'hat'];

function drawPx(b: PixelBuf, pxs: readonly Px[], keep?: (x: number, y: number) => boolean): void {
  for (const p of pxs) {
    if (p.x < 0 || p.y < 0 || p.x >= b.w || p.y >= b.h) continue;
    if (keep && !keep(p.x, p.y)) continue;
    setPx(b, p.x, p.y, p.c);
  }
}

/**
 * The raccoon in one frame wearing `outfit` (only the slots in `slots`, all by default), as drawn
 * (facing left). Rings and the weapon are never part of the body.
 */
export function dress(frame: number, outfit: Outfit, slots: readonly WornSlot[] = WORN_SLOTS): PixelBuf {
  const out = blank(W, H);
  const items = (order: readonly WornSlot[]) => order.filter((s) => slots.includes(s) && outfit[s]).map((s) => wornPixels(s, outfit[s]!, frame));
  for (const w of items(BACK_ORDER)) drawPx(out, w.back);
  const body = bare(frame);
  for (let i = 0; i < body.px.length; i += 4) if (body.px[i + 3]) out.px.set(body.px.subarray(i, i + 4), i);
  for (const w of items(FRONT_ORDER)) drawPx(out, w.front);
  return out;
}

/**
 * One worn item as a picture of its own that lies exactly over a dressed body (`under`): its front
 * pixels, and its back pixels wherever `under` leaves them showing.
 */
export function wornOver(slot: WornSlot, id: string, frame: number, under: PixelBuf): PixelBuf {
  const out = blank(W, H);
  const w = wornPixels(slot, id, frame);
  drawPx(out, w.back, (x, y) => !alphaAt(under, x, y));
  drawPx(out, w.front);
  return out;
}

/** Every frame index of the sheet. */
export const ALL_FRAMES: readonly number[] = Array.from({ length: FRAME_COUNT }, (_, f) => f);
