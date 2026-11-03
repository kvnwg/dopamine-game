/**
 * How each enemy shape is drawn: a hand-drawn still from ENEMY_ART (recolored per world), or an
 * animated sheet. Sheets: Kevin's raccoon as the punk raccoon (fur in the world's colors plus a
 * mohawk in its accent), the Mucho Pixels human as Officer Dale (shirt in the world's color), and
 * the fantasy pack characters and the farm animals (their own colors). Pure buffers, so Node tests can check them.
 */
import { rampOf, setPx, type PixelBuf } from './buf';
import { frameBuf, type AnimSheet } from './indexed';
import { ENEMY_ART } from './enemies';
import { frameOffsets } from './hero';
import { BIG_DEMON, DOC, ORC, PUMPKIN, SOLDIER } from './packs/fantasy';
import { BUNNY, COW, DUCK, HEN, PIG, RAM } from './packs/farm';
import { OFFICER, OFFICER_SHIRT } from './packs/humans';
import { RACCOON, RACCOON_FUR } from './packs/raccoon';

export interface SheetLook {
  sheet: AnimSheet;
  /** Recolor with the world's colors: the raccoon's fur, or the officer's shirt. */
  tint?: 'fur' | 'shirt';
  /** Adds a mohawk in the accent color. */
  punk?: boolean;
  /** A one-frame sheet that moves like the hand-drawn stills (it bobs, and is knocked out of the park). */
  still?: boolean;
}

/** Enemy shapes drawn from animated sheets; every other shape is a still in ENEMY_ART. */
export const FOE_SHEETS: Readonly<Record<string, SheetLook>> = {
  raccoon: { sheet: RACCOON, tint: 'fur', punk: true },
  officer: { sheet: OFFICER, tint: 'shirt' },
  soldier: { sheet: SOLDIER },
  orc: { sheet: ORC },
  pumpkin: { sheet: PUMPKIN },
  doc: { sheet: DOC },
  bigDemon: { sheet: BIG_DEMON },
  hen: { sheet: HEN, still: true },
  duck: { sheet: DUCK, still: true },
  bunny: { sheet: BUNNY, still: true },
  ram: { sheet: RAM, still: true },
  pig: { sheet: PIG, still: true },
  cow: { sheet: COW, still: true },
};

/** Every shape the enemy art knows. */
export const FOE_SHAPES: readonly string[] = [...new Set([...Object.keys(ENEMY_ART), ...Object.keys(FOE_SHEETS)])];

const MOHAWK = [
  '.o..',
  'oLo.',
  'oALo',
  'oAAo',
  'oDAo',
];

/** A raccoon frame in a world's colors, with a punk mohawk in its accent color. */
export function punkFrame(f: number, color: string, accent: string): PixelBuf {
  const fur = rampOf(color);
  const b = frameBuf(RACCOON, f, new Map(RACCOON_FUR.map((k, i) => [k, fur[i]])));
  const o = frameOffsets()[f];
  if (!o.head) return b;
  const acc = rampOf(accent);
  const keys: Record<string, string> = { o: RACCOON.pal[0], L: acc[2], A: acc[1], D: acc[0] };
  MOHAWK.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== '.') setPx(b, 10 + x + o.dx, 1 + y + o.dy, keys[ch]);
    });
  });
  return b;
}

/** Every frame of a sheet enemy in a world's colors (as drawn, before facing it left). */
export function sheetFrames(look: SheetLook, color: string, accent: string): PixelBuf[] {
  const s = look.sheet;
  return s.frames.map((_, f) => {
    if (look.punk) return punkFrame(f, color, accent);
    if (look.tint === 'shirt') {
      const r = rampOf(color);
      return frameBuf(s, f, new Map(OFFICER_SHIRT.map((k, i) => [k, i === OFFICER_SHIRT.length - 1 ? r[2] : r[1]])));
    }
    return frameBuf(s, f);
  });
}
