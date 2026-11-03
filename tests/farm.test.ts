import { describe, expect, it } from 'vitest';
import { alphaAt } from '../src/render/pixel/buf';
import { FARM, sheet } from '../src/render/pixel/farm';
import { FEET_ROW, VIEW, type LayerName } from '../src/render/pixel/sceneryTypes';

const NAMES: readonly LayerName[] = ['far', 'mid', 'ground', 'fg'];

/** Every pixel in rows [y0, y1) is opaque. */
function opaqueRows(b: { w: number; h: number; px: Uint8ClampedArray }, y0: number, y1: number): boolean {
  for (let y = y0; y < y1; y++) for (let x = 0; x < b.w; x++) if (alphaAt(b, x, y) !== 255) return false;
  return true;
}

describe('farm backdrop (Funky Farmland)', () => {
  it('every layer is tileW wide and its declared height, inside the view, and comes back as a fresh buffer', () => {
    expect(FARM.tileW).toBeGreaterThanOrEqual(VIEW.w);
    for (const name of NAMES) {
      const b = FARM[name]();
      const { y, h } = FARM.layers[name];
      expect([b.w, b.h], name).toEqual([FARM.tileW, h]);
      expect(y >= 0 && y + h <= VIEW.h, `${name} is inside the view`).toBe(true);
      expect(FARM[name]().px, `${name} is rebuilt each call`).not.toBe(b.px);
      const s = FARM.scroll0[name];
      expect(Number.isInteger(s) && s >= 0 && s < FARM.tileW, `${name} scroll0`).toBe(true);
    }
    // A sky world (the harvest sky shows through), with its own colors (not graded).
    expect(FARM.sky).toBe(true);
    expect(FARM.graded).toBe(false);
  });

  it('the road runs to the bottom of the view and the fighters stand on it, clear of the foreground', () => {
    const { ground, fg } = FARM.layers;
    expect(ground.y + ground.h).toBe(VIEW.h);
    const g = FARM.ground();
    const feet = FEET_ROW - ground.y;
    expect(opaqueRows(g, feet - 2, ground.h), 'solid ground under and around the feet').toBe(true);
    expect(fg.y, 'the fg strip stays below the feet').toBeGreaterThan(FEET_ROW);
  });

  it('lights are on their layers: barn windows and the lamp in mid, farmhouse windows in far', () => {
    const l = FARM.lights();
    for (const name of ['far', 'mid'] as const) {
      const spots = l[name] ?? [];
      expect(spots.length, name).toBeGreaterThan(0);
      const { h } = FARM.layers[name];
      for (const s of spots) expect(s.x >= 0 && s.x < FARM.tileW && s.y >= 0 && s.y < h, `${name} spot ${s.x},${s.y}`).toBe(true);
    }
    expect((l.mid ?? []).some((s) => s.kind === 'lamp')).toBe(true);
  });

  it('sheet() lists the four layers for the preview tool', () => {
    expect(sheet().map((e) => e.name)).toEqual(expect.arrayContaining([...NAMES]));
  });
});
