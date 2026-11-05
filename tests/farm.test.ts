import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data';
import { alphaAt, type PixelBuf } from '../src/render/pixel/buf';
import { FARM, sheet } from '../src/render/pixel/farm';
import { FEET_ROW, SCENE_FRAME, VIEW, frameTop, sceneFrame, type LayerName } from '../src/render/pixel/sceneryTypes';
import { viewAtmo } from '../src/render/worldLook';
import { checkSheet, type AnimSheet } from '../src/render/pixel/indexed';
import { BUNNY, COW, DUCK, HEN, PIG, RAM } from '../src/render/pixel/packs/farm';

const NAMES: readonly LayerName[] = ['far', 'mid', 'ground', 'fg'];

/** Every pixel in rows [y0, y1) is opaque. */
function opaqueRows(b: PixelBuf, y0: number, y1: number): boolean {
  for (let y = y0; y < y1; y++) for (let x = 0; x < b.w; x++) if (alphaAt(b, x, y) !== 255) return false;
  return true;
}

/** The distinct colors of a row. */
function rowColors(b: PixelBuf, y: number): Set<number> {
  const out = new Set<number>();
  for (let x = 0; x < b.w; x++) {
    const i = (y * b.w + x) * 4;
    out.add((b.px[i] << 16) | (b.px[i + 1] << 8) | b.px[i + 2]);
  }
  return out;
}

describe('farm backdrop (Funky Farmland)', () => {
  it('is drawn for the 6 px grid: the 123-row frame (feet on row 100), 1.5 times the first farm (390 wide)', () => {
    expect(FARM.frame).toEqual(SCENE_FRAME);
    expect(sceneFrame(FARM)).toEqual({ h: 123, feetRow: 100 });
    expect(frameTop(FARM) + sceneFrame(FARM).feetRow, "feet on the battle's feet row").toBe(FEET_ROW);
    expect(FARM.tileW).toBe(390);
    expect(FARM.tileW).toBeGreaterThanOrEqual(VIEW.w);
  });

  it('every layer is tileW wide and its declared height, inside the frame, and comes back as a fresh buffer', () => {
    const frame = sceneFrame(FARM);
    for (const name of NAMES) {
      const b = FARM[name]();
      const { y, h } = FARM.layers[name];
      expect([b.w, b.h], name).toEqual([FARM.tileW, h]);
      expect(y >= 0 && y + h <= frame.h, `${name} is inside the frame`).toBe(true);
      expect(FARM[name]().px, `${name} is rebuilt each call`).not.toBe(b.px);
      const s = FARM.scroll0[name];
      expect(Number.isInteger(s) && s >= 0 && s < FARM.tileW, `${name} scroll0`).toBe(true);
    }
    // A sky world (the harvest sky shows through), with its own colors (not graded).
    expect(FARM.sky).toBe(true);
    expect(FARM.graded).toBe(false);
  });

  it('the road runs to the bottom of the frame, every row under the feet is solid, and the foreground stays below the feet', () => {
    const { ground, fg } = FARM.layers;
    const frame = sceneFrame(FARM);
    expect(ground.y + ground.h).toBe(frame.h);
    expect(fg.y + fg.h).toBe(frame.h);
    const g = FARM.ground();
    const feet = frame.feetRow - ground.y;
    // The road's far edge is a few rows above the feet; from there to the frame's last row, no sky.
    expect(opaqueRows(g, feet - 7, ground.h), 'solid road, grass and wheat from above the feet to the bottom').toBe(true);
    expect(ground.h - feet, 'the 23 rows from the feet down').toBe(23);
    expect(fg.y, 'the fg strip stays below the feet').toBeGreaterThan(frame.feetRow);
  });

  it('the rows under the feet are calm: plain dirt in two tones at most', () => {
    const g = FARM.ground();
    const feet = sceneFrame(FARM).feetRow - FARM.layers.ground.y;
    for (let y = feet; y <= feet + 5; y++) expect(rowColors(g, y).size, `ground row ${y}`).toBeLessThanOrEqual(2);
  });

  it("the farmyard's far edge is where World 5's horizon lands in the frame (1.5 times its legacy row)", () => {
    const def = DATA.worlds.find((w) => w.look.scenery === 'farm')!;
    const horizon = viewAtmo(def.look.atmo, FARM).horizon - frameTop(FARM);
    const mid = FARM.mid();
    let yard = -1;
    for (let y = 0; y < mid.h && yard < 0; y++) if (opaqueRows(mid, y, y + 1)) yard = y;
    expect(yard + FARM.layers.mid.y).toBe(horizon);
    // The far layer runs down behind the yard, so no sky shows between the two.
    const far = FARM.layers.far;
    expect(far.y + far.h).toBeGreaterThan(horizon);
    expect(opaqueRows(FARM.far(), horizon - far.y, far.h)).toBe(true);
  });

  it('lights are on their layers: barn and coop windows and the lamp in mid, farmhouse windows in far', () => {
    const l = FARM.lights();
    for (const name of ['far', 'mid'] as const) {
      const spots = l[name] ?? [];
      expect(spots.length, name).toBeGreaterThan(0);
      const b = FARM[name]();
      const { h } = FARM.layers[name];
      for (const s of spots) {
        expect(s.x >= 0 && s.x < FARM.tileW && s.y >= 0 && s.y + s.h <= h, `${name} spot ${s.x},${s.y}`).toBe(true);
        // Each spot sits on the art (a window's glass, the lamp's bulb), not on the sky.
        for (let yy = 0; yy < s.h; yy++) {
          for (let xx = 0; xx < s.w; xx++) expect(alphaAt(b, (s.x + xx) % b.w, s.y + yy), `${name} spot ${s.x},${s.y}`).toBe(255);
        }
      }
    }
    const mid = l.mid ?? [];
    expect(mid.filter((s) => s.kind === 'lamp')).toHaveLength(1);
    // Two barn windows and the coop's, each found with its mask (glass and muntins).
    const windows = mid.filter((s) => s.kind === 'window');
    expect(windows).toHaveLength(3);
    for (const w of windows) expect(w.mask?.join('')).toMatch(/g/);
  });

  it('sheet() lists the four layers for the preview tool', () => {
    expect(sheet().map((e) => e.name)).toEqual(expect.arrayContaining([...NAMES]));
  });
});

describe('farm animals (generated by tools/packs/farm.py and farm_anim.py)', () => {
  const ANIMALS: Record<string, AnimSheet> = { HEN, DUCK, BUNNY, RAM, PIG, COW };

  it('have idle, walk, a six-beat attack at 25 fps and a flinch, at the frame counts the generator makes', () => {
    const frames: Record<string, number> = { HEN: 12, DUCK: 12, BUNNY: 13, RAM: 12, PIG: 12, COW: 13 };
    for (const [name, s] of Object.entries(ANIMALS)) {
      checkSheet(name, s);
      expect(s.frames, name).toHaveLength(frames[name]);
      expect(s.faces, name).toBe('left');
      const a = s.anims.attack;
      expect([a.fps, a.frames.length], name).toEqual([25, 11]);
      // Five drawn poses (wind, coil, smear, hit, back), then the breath it settles on.
      expect(new Set(a.frames).size, name).toBe(6);
      expect(s.anims.idle.frames, `${name} settles into its idle`).toContain(a.frames[a.frames.length - 1]);
      for (const f of a.frames.slice(0, 7)) expect(s.anims.idle.frames, `${name} attack frame ${f} is drawn for it`).not.toContain(f);
    }
  });

  it('keep their own palettes: every frame is drawn in the colors of the drawn pose', () => {
    const colors: Record<string, number> = { HEN: 8, DUCK: 12, BUNNY: 7, RAM: 8, PIG: 17, COW: 17 };
    for (const [name, s] of Object.entries(ANIMALS)) {
      expect(s.pal, name).toHaveLength(colors[name]);
      const keys = (f: number) => new Set(s.frames[f].join('').replace(/\./g, ''));
      const own = keys(0);
      expect(own.size, `${name} uses its whole palette`).toBe(s.pal.length);
      s.frames.forEach((_, f) => {
        for (const k of keys(f)) expect(own.has(k), `${name} frame ${f} key ${k}`).toBe(true);
      });
    }
  });
});
