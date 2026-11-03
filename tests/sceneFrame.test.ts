import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data';
import { P } from '../src/render/pixel';
import { linePixels, padEdges, fromRows } from '../src/render/pixel/buf';
import { FEET_ROW, SCENE_FEET_ROW, SCENE_H, SCENE_Y, VIEW, VIEW_MARGIN, type LayerName } from '../src/render/pixel/sceneryTypes';
import { SUBURBS } from '../src/render/pixel/scenery';
import { DUNGEON } from '../src/render/pixel/packs/dungeon';
import { FARM } from '../src/render/pixel/farm';
import { FOE_SHEETS } from '../src/render/pixel/foes';
import { composeWorld, layerRow, layerY, viewAtmo, worldArt } from '../src/render/worldLook';

const NAMES: readonly LayerName[] = ['far', 'mid', 'ground', 'fg'];
const SETS = { suburbs: SUBURBS, dungeon: DUNGEON, farm: FARM };

describe('one battle grid and the scene frame', () => {
  it('the view is a whole number of 9-pixel art pixels: 120 x 107, 1080 x 963 screen pixels', () => {
    expect(P).toBe(9);
    expect([VIEW.w * P, VIEW.h * P]).toEqual([1080, 963]);
    expect(VIEW_MARGIN).toBeGreaterThanOrEqual(1);
  });

  it('every set is drawn for the 82-row scene, placed 25 rows down the view, feet on view row 92', () => {
    expect(SCENE_H).toBe(82);
    expect(SCENE_FEET_ROW).toBe(67);
    expect(SCENE_Y).toBe(25);
    expect(SCENE_Y + SCENE_H).toBe(VIEW.h);
    expect(FEET_ROW).toBe(92);
    for (const [name, set] of Object.entries(SETS)) {
      const y = layerY(set);
      for (const layer of NAMES) {
        const { y: top, h } = set.layers[layer];
        expect(layerRow(set, layer), `${name} ${layer}`).toBe(SCENE_Y + top);
        expect(y[layer] % P, `${name} ${layer} on the grid`).toBe(0);
        expect(y[layer], `${name} ${layer}`).toBe((SCENE_Y + top) * P);
        // Down to the bottom of the view at most; only a set without a sky reaches above the scene.
        expect(top + h, `${name} ${layer} bottom`).toBeLessThanOrEqual(SCENE_H);
        expect(top >= 0 || (!set.sky && SCENE_Y + top >= 0), `${name} ${layer} top`).toBe(true);
      }
      // The ground runs to the bottom of the view.
      expect(set.layers.ground.y + set.layers.ground.h, `${name} ground`).toBe(SCENE_H);
    }
  });

  it("a world's horizon, sun or moon and clouds move down with the scene", () => {
    for (const def of DATA.worlds) {
      const a = def.look.atmo;
      const v = viewAtmo(a);
      expect(v.horizon, def.id).toBe(a.horizon + SCENE_Y);
      if (a.body) expect(v.body!.y, def.id).toBe(a.body.y + SCENE_Y);
      if (a.body) expect(v.body!.x, def.id).toBe(a.body.x);
      if (a.clouds) expect(v.clouds!.y, def.id).toBe(a.clouds.y + SCENE_Y);
      expect(v.sky).toEqual(a.sky);
    }
    for (const world of [1, 6, 8]) {
      const def = DATA.worlds[world - 1];
      const art = worldArt(world);
      expect(art.atmo.horizon).toBe(def.look.atmo.horizon + SCENE_Y);
      expect([art.sky.w, art.sky.h]).toEqual([VIEW.w, VIEW.h + 1]);
      if (def.look.atmo.clouds && art.set.sky) expect(art.clouds[0].y).toBe(def.look.atmo.clouds.y + SCENE_Y);
      // The sun or moon's disc is in the middle of its glow overlay.
      if (art.glow) expect(art.glow.y + (art.glow.buf.h - 1) / 2).toBe(Math.floor(def.look.atmo.body!.y + SCENE_Y));
    }
  });

  it('the composed view shows the scene unchanged under the extra rows: sky above it for sky sets, wall for the dungeon', () => {
    const street = composeWorld(1, { vignette: false });
    const dungeon = composeWorld(8, { vignette: false });
    expect([street.w, street.h]).toEqual([VIEW.w, VIEW.h + 1]);
    // The street's sidewalk under the fighters' feet is the ground layer's own pixels.
    const art = worldArt(1);
    const g = art.layers.ground;
    const row = SCENE_FEET_ROW - SUBURBS.layers.ground.y;
    const s0 = SUBURBS.scroll0.ground;
    for (const x of [0, 30, 77, 119]) {
      const v = (FEET_ROW * street.w + x) * 4;
      const l = (row * g.w + ((x + s0) % g.w)) * 4;
      expect([...street.px.slice(v, v + 3)], `street feet row, x ${x}`).toEqual([...g.px.slice(l, l + 3)]);
    }
    // Above the scene: the dungeon's upper dark is far-layer art, opaque from the first row.
    const far = worldArt(8).layers.far;
    expect(far.h).toBe(DUNGEON.layers.far.h);
    for (const x of [0, 50, 119]) expect(dungeon.px[(0 * dungeon.w + x) * 4 + 3]).toBe(255);
  });

  it('punk raccoons face the hero (the sheet is marked as drawn: facing left)', () => {
    expect(FOE_SHEETS.raccoon.sheet.faces).toBe('left');
  });

  it('draws pixel lines and pads full-view art for the shake', () => {
    expect(linePixels([[0, 0], [3, 0]])).toEqual([[0, 0], [1, 0], [2, 0], [3, 0]]);
    const diag = linePixels([[0, 0], [4, 2], [4, 5]]);
    expect(diag[0]).toEqual([0, 0]);
    expect(diag[diag.length - 1]).toEqual([4, 5]);
    // 8-connected, one pixel per step, no repeats.
    for (let i = 1; i < diag.length; i++) {
      expect(Math.max(Math.abs(diag[i][0] - diag[i - 1][0]), Math.abs(diag[i][1] - diag[i - 1][1]))).toBe(1);
    }
    expect(new Set(diag.map((p) => p.join())).size).toBe(diag.length);
    const b = padEdges(fromRows(['wr', 'gk']), 2);
    expect([b.w, b.h]).toEqual([6, 6]);
    const at = (x: number, y: number) => [...b.px.slice((y * b.w + x) * 4, (y * b.w + x) * 4 + 4)];
    expect(at(0, 0)).toEqual(at(2, 2));
    expect(at(5, 5)).toEqual(at(3, 3));
  });
});
