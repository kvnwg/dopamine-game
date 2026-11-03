import { describe, expect, it } from 'vitest';
import { alphaAt } from '../src/render/pixel/buf';
import { fromIndexed, KEYS } from '../src/render/pixel/indexed';
import { DUNGEON, TORCH, TORCHES, sheet } from '../src/render/pixel/packs/dungeon';
import { DUNGEON_PAL, DUNGEON_TILES } from '../src/render/pixel/packs/dungeonTiles';
import { fromRows } from '../src/render/pixel/buf';
import { FEET_ROW, SCENE_FRAME, VIEW, frameTop, sceneFrame, type LayerName } from '../src/render/pixel/sceneryTypes';
import { layerRow } from '../src/render/worldLook';

const NAMES: readonly LayerName[] = ['far', 'mid', 'ground', 'fg'];

/** Every pixel in rows [y0, y1) is opaque. */
function opaqueRows(b: { w: number; h: number; px: Uint8ClampedArray }, y0: number, y1: number): boolean {
  for (let y = y0; y < y1; y++) for (let x = 0; x < b.w; x++) if (alphaAt(b, x, y) !== 255) return false;
  return true;
}

describe('dungeon backdrop (0x72 DungeonTileset II)', () => {
  it('has one shared palette of distinct #rrggbb colors that fits the index keys', () => {
    expect(DUNGEON_PAL.length).toBeGreaterThan(0);
    expect(DUNGEON_PAL.length).toBeLessThanOrEqual(KEYS.length);
    for (const c of DUNGEON_PAL) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(DUNGEON_PAL).size).toBe(DUNGEON_PAL.length);
  });

  it('every tile decodes 1:1: rectangular rows on the 16 px grid, every key in the palette', () => {
    const names = Object.keys(DUNGEON_TILES);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const rows = DUNGEON_TILES[name];
      const w = rows[0].length;
      expect(w % 16, `${name} width`).toBe(0);
      expect(rows.length % 8, `${name} height`).toBe(0);
      let inked = 0;
      rows.forEach((row, y) => {
        expect(row.length, `${name} row ${y}`).toBe(w);
        for (const ch of row) {
          if (ch === '.') continue;
          const k = KEYS.indexOf(ch);
          expect(k >= 0 && k < DUNGEON_PAL.length, `${name} row ${y} key "${ch}"`).toBe(true);
          inked++;
        }
      });
      const b = fromIndexed(rows, DUNGEON_PAL);
      expect([b.w, b.h], name).toEqual([w, rows.length]);
      let opaque = 0;
      for (let i = 3; i < b.px.length; i += 4) if (b.px[i] === 255) opaque++;
      expect(opaque, `${name} opaque pixels`).toBe(inked);
      expect(opaque, `${name} is not empty`).toBeGreaterThan(0);
    }
  });

  it('every layer is tileW wide and its declared height, and comes back as a fresh buffer', () => {
    expect(DUNGEON.tileW % 16).toBe(0);
    expect(DUNGEON.tileW).toBeGreaterThanOrEqual(VIEW.w);
    for (const name of NAMES) {
      const b = DUNGEON[name]();
      expect([b.w, b.h], name).toEqual([DUNGEON.tileW, DUNGEON.layers[name].h]);
      expect(b.px.length, name).toBe(b.w * b.h * 4);
      expect(DUNGEON[name]().px, `${name} is rebuilt each call`).not.toBe(b.px);
      const s = DUNGEON.scroll0[name];
      expect(Number.isInteger(s) && s >= 0 && s < DUNGEON.tileW, `${name} scroll0`).toBe(true);
    }
    expect(DUNGEON.sky).toBe(false);
    expect(DUNGEON.graded).toBe(false);
  });

  it('fills the 180 x 160 view: the far wall from the top of the view to the floor, the floor to the bottom edge', () => {
    const { far, mid, ground, fg } = DUNGEON.layers;
    // Drawn in the 123-row frame, whose last row is the view's last.
    expect(sceneFrame(DUNGEON)).toEqual(SCENE_FRAME);
    const frame = sceneFrame(DUNGEON);
    const top = frameTop(DUNGEON);
    // No sky: the far layer reaches up out of the frame to the top of the battle view.
    expect(top + far.y, 'far starts at view row 0').toBe(0);
    expect(layerRow(DUNGEON, 'far')).toBe(0);
    expect(opaqueRows(DUNGEON.far(), 0, far.h), 'far is fully opaque').toBe(true);
    expect(ground.y, 'no gap between the wall and the floor').toBeLessThanOrEqual(far.y + far.h);
    expect(ground.y + ground.h).toBe(frame.h);
    expect(top + ground.y + ground.h, 'the floor reaches the bottom of the view').toBe(VIEW.h);
    expect(ground.h, 'nearly two rows of slabs').toBeGreaterThanOrEqual(28);
    expect(opaqueRows(DUNGEON.ground(), 0, ground.h), 'the floor is fully opaque').toBe(true);
    expect(mid.y + mid.h, 'mid props stand on the floor line').toBe(ground.y);
    expect(fg.y + fg.h, 'fg sits on the bottom edge').toBe(frame.h);
    for (const name of NAMES) {
      const { y, h } = DUNGEON.layers[name];
      expect(top + y >= 0 && top + y + h <= VIEW.h, `${name} is inside the view`).toBe(true);
      if (name !== 'far') expect(y >= 0 && y + h <= frame.h, `${name} is inside the scene frame`).toBe(true);
    }
  });

  it('the wall keeps its scene rows under the upward extension: torch lights sit on the torches', () => {
    const far = DUNGEON.far();
    const up = -DUNGEON.layers.far.y;
    const torch = fromRows(TORCH);
    // The torch's flame tip (its top row) in the layer, and the light spot over it.
    const tip = TORCH[0].indexOf('Y');
    const lights = DUNGEON.lights().far!.filter((s) => s.kind === 'torch');
    expect(lights).toHaveLength(TORCHES.length);
    TORCHES.forEach(([x, y], i) => {
      const at = ((up + y) * far.w + x + tip) * 4;
      expect([...far.px.slice(at, at + 3)], `torch ${i} drawn at scene row ${y}`).toEqual([...torch.px.slice(tip * 4, tip * 4 + 3)]);
      expect(lights[i].y, `torch ${i} light`).toBe(up + y);
    });
  });

  it('fighters stand on the floor: the feet row is inside the opaque floor, a few rows below its top, clear of fg', () => {
    const { ground, fg } = DUNGEON.layers;
    const feet = sceneFrame(DUNGEON).feetRow;
    expect(frameTop(DUNGEON) + feet).toBe(FEET_ROW);
    const row = feet - ground.y;
    expect(row, 'a few rows below the floor top').toBeGreaterThanOrEqual(3);
    expect(row, 'a few rows below the floor top').toBeLessThanOrEqual(8);
    expect(row + 1, 'the ground line is inside the floor').toBeLessThan(ground.h);
    const g = DUNGEON.ground();
    for (const y of [row, row + 1]) {
      for (let x = 0; x < g.w; x++) expect(alphaAt(g, x, y), `floor at x ${x}, view row ${ground.y + y}`).toBe(255);
    }
    expect(fg.y, 'the fg strip stays below the feet').toBeGreaterThan(feet + 1);
  });

  it('mid props touch the floor line and leave most of the wall clear', () => {
    const m = DUNGEON.mid();
    let base = 0;
    let opaque = 0;
    for (let x = 0; x < m.w; x++) if (alphaAt(m, x, m.h - 1)) base++;
    for (let i = 3; i < m.px.length; i += 4) if (m.px[i]) opaque++;
    expect(base, 'something stands on the floor line').toBeGreaterThan(0);
    expect(opaque / (m.w * m.h), 'sparse').toBeLessThan(0.3);
  });

  it('sheet() lists the four layers for the preview tool', () => {
    const entries = sheet();
    expect(entries.map((e) => e.name)).toEqual([...NAMES]);
    for (const e of entries) expect([e.buf.w, e.buf.h], e.name).toEqual([DUNGEON.tileW, DUNGEON.layers[e.name as LayerName].h]);
  });
});
