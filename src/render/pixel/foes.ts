/**
 * How each enemy shape is drawn: an animated sheet. The hand-drawn cast (enemies.ts: rats, pigeons,
 * bosses, the dungeon crew) and Kevin's raccoon as the punk raccoon (plus a mohawk in its accent) take
 * the world's colors through `tint`; the farm animals keep their own. ENEMY_ART still has every shape's
 * standing pose as a fallback. Pure buffers, so Node tests can check them.
 */
import { rampOf, rgb, setPx, type PixelBuf } from './buf';
import { CHARACTER_OUTLINE } from './palette';
import { frameBuf, type AnimSheet } from './indexed';
import { ENEMY_ART, ENEMY_SHEETS } from './enemies';
import { frameOffsets } from './hero';
import { BUNNY, COW, DUCK, HEN, PIG, RAM } from './packs/farm';
import { RACCOON, RACCOON_FUR } from './packs/raccoon';

export interface SheetLook {
  sheet: AnimSheet;
  /**
   * Palette indices recolored with the world's colors, each list dark, mid, light: `body` takes
   * rampOf(world color) and `accent` takes rampOf(world accent).
   */
  tint?: { body?: readonly number[]; accent?: readonly number[] };
  /** Adds a mohawk in the accent color. */
  punk?: boolean;
  /** A one-frame sheet that moves like the hand-drawn stills (it bobs, and is knocked out of the park). */
  still?: boolean;
}

/** Enemy shapes drawn from animated sheets; any other shape falls back to its still in ENEMY_ART. */
export const FOE_SHEETS: Readonly<Record<string, SheetLook>> = {
  raccoon: { sheet: RACCOON, tint: { body: RACCOON_FUR }, punk: true },
  ...Object.fromEntries(
    Object.entries(ENEMY_SHEETS).map(([shape, s]) => [shape, { sheet: s.sheet, tint: { body: s.body, accent: s.accent } }]),
  ),
  hen: { sheet: HEN, still: true },
  duck: { sheet: DUCK, still: true },
  bunny: { sheet: BUNNY, still: true },
  ram: { sheet: RAM, still: true },
  pig: { sheet: PIG, still: true },
  cow: { sheet: COW, still: true },
};

/** Every shape the enemy art knows. */
export const FOE_SHAPES: readonly string[] = [...new Set([...Object.keys(ENEMY_ART), ...Object.keys(FOE_SHEETS)])];

/** A sheet's tint as a palette recolor for one world. */
function tintMap(look: SheetLook, color: string, accent: string): Map<number, string> | undefined {
  if (!look.tint) return undefined;
  const map = new Map<number, string>();
  const body = rampOf(color);
  const acc = rampOf(accent);
  look.tint.body?.forEach((k, i) => map.set(k, body[i]));
  look.tint.accent?.forEach((k, i) => map.set(k, acc[i]));
  return map;
}

const MOHAWK = [
  '.o..',
  'oLo.',
  'oALo',
  'oAAo',
  'oDAo',
];

/** Draws the punk mohawk (accent colors) on a raccoon frame whose head is up. */
function addMohawk(b: PixelBuf, f: number, accent: string): PixelBuf {
  const o = frameOffsets()[f];
  if (!o.head) return b;
  const acc = rampOf(accent);
  const keys: Record<string, string> = { o: CHARACTER_OUTLINE, L: acc[2], A: acc[1], D: acc[0] };
  MOHAWK.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== '.') setPx(b, 10 + x + o.dx, 1 + y + o.dy, keys[ch]);
    });
  });
  return b;
}

/** A raccoon frame in a world's colors, with a punk mohawk in its accent color. */
export function punkFrame(f: number, color: string, accent: string): PixelBuf {
  return addMohawk(frameBuf(RACCOON, f, tintMap(FOE_SHEETS.raccoon, color, accent)), f, accent);
}

/**
 * Recolors a sheet's outline to the raccoon's brown in every frame. A pack sprite's outline is its
 * most common edge color (an opaque pixel next to open space); it is only recolored when dark, so a
 * sprite drawn without outlines keeps its colors.
 */
export function brownOutlines(frames: PixelBuf[]): PixelBuf[] {
  const counts = new Map<number, number>();
  for (const b of frames) {
    const open = (x: number, y: number) => x < 0 || y < 0 || x >= b.w || y >= b.h || !b.px[(y * b.w + x) * 4 + 3];
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        const i = (y * b.w + x) * 4;
        if (!b.px[i + 3] || !(open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1))) continue;
        const c = (b.px[i] << 16) | (b.px[i + 1] << 8) | b.px[i + 2];
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
  }
  let line = -1;
  let best = 0;
  for (const [c, n] of counts) if (n > best) [line, best] = [c, n];
  const luma = (0.299 * ((line >> 16) & 255) + 0.587 * ((line >> 8) & 255) + 0.114 * (line & 255)) / 255;
  if (line < 0 || luma > 0.25) return frames;
  const [r, g, bl] = rgb(CHARACTER_OUTLINE);
  for (const b of frames) {
    for (let i = 0; i < b.px.length; i += 4) {
      if (b.px[i + 3] && ((b.px[i] << 16) | (b.px[i + 1] << 8) | b.px[i + 2]) === line) {
        b.px[i] = r;
        b.px[i + 1] = g;
        b.px[i + 2] = bl;
      }
    }
  }
  return frames;
}

/** Every frame of a sheet enemy in a world's colors (as drawn, before facing it left), outlined in the raccoon's brown. */
export function sheetFrames(look: SheetLook, color: string, accent: string): PixelBuf[] {
  return brownOutlines(rawSheetFrames(look, color, accent));
}

function rawSheetFrames(look: SheetLook, color: string, accent: string): PixelBuf[] {
  const map = tintMap(look, color, accent);
  return look.sheet.frames.map((_, f) => {
    const b = frameBuf(look.sheet, f, map);
    return look.punk ? addMohawk(b, f, accent) : b;
  });
}
