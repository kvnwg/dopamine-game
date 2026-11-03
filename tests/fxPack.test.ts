import { statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bounds } from '../src/render/pixel/buf';
import { KEYS, checkSheet, frameBuf, type AnimSheet } from '../src/render/pixel/indexed';
import { FX_SHEETS, sheet, type FxName } from '../src/render/pixel/packs/fx';

const NAMES: readonly FxName[] = ['hit', 'crit', 'slash', 'boom', 'sparkle', 'levelUp', 'lightning'];

/** The battle view in art pixels (1080 x 820 screen pixels at 12 per art pixel). */
const VIEW = { w: 90, h: 68 };

/**
 * The most content (the union of all frames) each effect may have, in art pixels. hit and boom
 * meet the brief (~16 and ~32). The brief asked ~28 for crit and ~24 for slash, but apart from the
 * muzzle flash used for hit, the free pack has no impact or swipe smaller than 29 x 32. Those two
 * use the smallest effects that fit their roles, whole rather than cropped.
 */
const MAX_SIZE: Partial<Record<FxName, readonly [number, number]>> = {
  hit: [16, 16],
  crit: [32, 32],
  slash: [29, 32],
  boom: [32, 32],
};

const IMPACTS: readonly FxName[] = ['hit', 'crit', 'slash', 'boom'];

/** The union of every frame's opaque pixels. */
function content(s: AnimSheet): { x: number; y: number; w: number; h: number } {
  let x0 = s.w;
  let y0 = s.h;
  let x1 = 0;
  let y1 = 0;
  s.frames.forEach((_, f) => {
    const b = bounds(frameBuf(s, f));
    if (!b.w) return;
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  });
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

describe('fx pack (Super Pixel Effects Gigapack)', () => {
  it('has exactly the battle effects, each a valid sheet with one `play` animation', () => {
    expect(Object.keys(FX_SHEETS).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      const s = FX_SHEETS[name];
      checkSheet(name, s);
      expect(s.pal.length, name).toBeLessThanOrEqual(KEYS.length);
      expect(new Set(s.pal).size, `${name} has no duplicate colors`).toBe(s.pal.length);
      expect(Object.keys(s.anims), name).toEqual(['play']);
      const used = new Set(s.anims.play.frames);
      expect(used.size, `${name} plays every frame it stores`).toBe(s.frames.length);
    }
  });

  it('crops every sheet to its art and uses every palette color', () => {
    for (const name of NAMES) {
      const s = FX_SHEETS[name];
      expect(content(s), name).toEqual({ x: 0, y: 0, w: s.w, h: s.h });
      const keys = new Set(s.frames.flatMap((rows) => rows.flatMap((r) => [...r])));
      s.pal.forEach((c, k) => expect(keys.has(KEYS[k]), `${name} uses ${c}`).toBe(true));
    }
  });

  it('keeps effects within their size limits and inside the battle view', () => {
    for (const name of NAMES) {
      const s = FX_SHEETS[name];
      expect(s.w, name).toBeLessThanOrEqual(VIEW.w);
      expect(s.h, name).toBeLessThanOrEqual(VIEW.h);
      const max = MAX_SIZE[name];
      if (!max) continue;
      expect(s.w, `${name} width`).toBeLessThanOrEqual(max[0]);
      expect(s.h, `${name} height`).toBeLessThanOrEqual(max[1]);
    }
  });

  it('anchors every effect inside its frame', () => {
    for (const name of NAMES) {
      const { anchor, w, h } = FX_SHEETS[name];
      expect(anchor.x >= 0 && anchor.x < w && anchor.y >= 0 && anchor.y < h, name).toBe(true);
    }
  });

  it('plays impacts fast, and every effect once', () => {
    const hit = FX_SHEETS.hit.anims.play;
    expect(hit.frames.length).toBeGreaterThanOrEqual(4);
    expect(hit.frames.length).toBeLessThanOrEqual(8);
    for (const name of IMPACTS) {
      const a = FX_SHEETS[name].anims.play;
      expect(a.fps, name).toBeGreaterThanOrEqual(20);
      expect(a.fps, name).toBeLessThanOrEqual(24);
    }
    for (const name of NAMES) expect(FX_SHEETS[name].anims.play.loop, name).toBe(false);
  });

  it('sheet() shows the first frame of every effect', () => {
    const entries = sheet();
    expect(entries.map((e) => e.name)).toEqual([...NAMES]);
    for (const e of entries) {
      const s = FX_SHEETS[e.name as FxName];
      expect(Buffer.from(e.buf.px).equals(Buffer.from(frameBuf(s, s.anims.play.frames[0]).px)), e.name).toBe(true);
    }
  });

  it('keeps the generated module under 150 KB', () => {
    const bytes = statSync(new URL('../src/render/pixel/packs/fx.ts', import.meta.url)).size;
    expect(bytes).toBeLessThan(150 * 1024);
  });
});
