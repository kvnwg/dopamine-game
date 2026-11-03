import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data';
import { P } from '../src/render/pixel';
import { linePixels, padEdges, fromRows } from '../src/render/pixel/buf';
import {
  FEET_ROW, LEGACY_FRAME, SCENE_FEET_ROW, SCENE_FRAME, SCENE_H, SCENE_Y, VIEW, VIEW_MARGIN, frameScale, frameTop, sceneFrame,
  type LayerName, type ScenerySet,
} from '../src/render/pixel/sceneryTypes';
import { SUBURBS } from '../src/render/pixel/scenery';
import { DUNGEON } from '../src/render/pixel/packs/dungeon';
import { FARM } from '../src/render/pixel/farm';
import { FOE_SHEETS } from '../src/render/pixel/foes';
import { composeWorld, fitToView, layerRow, layerY, legacyRow, rowsBelow, sceneryFor, viewAtmo, worldArt } from '../src/render/worldLook';
import { blank } from '../src/render/pixel/buf';

const NAMES: readonly LayerName[] = ['far', 'mid', 'ground', 'fg'];
const SETS = { suburbs: SUBURBS, dungeon: DUNGEON, farm: FARM };
/** The world that shows each set. */
const WORLD_OF = { suburbs: 1, dungeon: 8, farm: 5 } as const;

describe('one battle grid and the scene frames', () => {
  it('the view is a whole number of 6-pixel art pixels: 180 x 160, 1080 x 960 screen pixels', () => {
    expect(P).toBe(6);
    expect([VIEW.w * P, VIEW.h * P]).toEqual([1080, 960]);
    expect(VIEW_MARGIN).toBeGreaterThanOrEqual(1);
  });

  it('every frame puts the feet on view row 137 (the ground line at y 828): the new frame fills the view, the legacy one sits 70 rows down', () => {
    expect(FEET_ROW).toBe(137);
    expect((FEET_ROW + 1) * P).toBe(828);
    expect(SCENE_FRAME).toEqual({ h: 123, feetRow: 100 });
    expect(LEGACY_FRAME).toEqual({ h: 82, feetRow: 67 });
    const fresh = { frame: SCENE_FRAME };
    expect(frameTop(fresh)).toBe(37);
    expect(frameTop(fresh) + SCENE_FRAME.h, 'its last row is the view\'s last').toBe(VIEW.h);
    expect(frameScale(fresh)).toBe(1.5);
    // A set without a frame is a legacy set.
    expect(sceneFrame({})).toBe(LEGACY_FRAME);
    expect(frameTop({})).toBe(70);
    expect(frameScale({})).toBe(1);
    // The legacy names still describe the legacy frame.
    expect([SCENE_H, SCENE_FEET_ROW, SCENE_Y]).toEqual([82, 67, 70]);
  });

  it("every set's layers are placed by its own frame, on the grid, and nothing under a frame shows sky", () => {
    for (const [name, set] of Object.entries(SETS) as Array<[keyof typeof SETS, ScenerySet]>) {
      const frame = sceneFrame(set);
      const top = frameTop(set);
      expect(top + frame.feetRow, `${name} feet`).toBe(FEET_ROW);
      expect(rowsBelow(set), name).toBe(VIEW.h - Math.min(VIEW.h, top + frame.h));
      const y = layerY(set);
      for (const layer of NAMES) {
        const { y: row, h } = set.layers[layer];
        const atBottom = row + h >= frame.h;
        expect(layerRow(set, layer), `${name} ${layer}`).toBe(top + row + (layer === 'fg' && atBottom ? rowsBelow(set) : 0));
        expect(y[layer] % P, `${name} ${layer} on the grid`).toBe(0);
        expect(y[layer], `${name} ${layer}`).toBe(layerRow(set, layer) * P);
        // Down to the frame's bottom at most; only a set without a sky reaches above the view.
        expect(row + h, `${name} ${layer} bottom`).toBeLessThanOrEqual(frame.h);
        expect(top + row >= 0 || (!set.sky && false), `${name} ${layer} top inside the view`).toBe(true);
      }
      // The ground runs to the frame's bottom, and (carried down if need be) to the view's.
      expect(set.layers.ground.y + set.layers.ground.h, `${name} ground`).toBe(frame.h);
      const { bufs } = sceneryFor(DATA.worlds[WORLD_OF[name] - 1]);
      expect(layerRow(set, 'ground') + bufs.ground.h, `${name} ground reaches the view's bottom`).toBe(VIEW.h);
      expect(layerRow(set, 'fg') + bufs.fg.h, `${name} fg on the view's bottom edge`).toBe(VIEW.h);
      // The view's bottom rows are the ground's own art, opaque all the way across.
      const g = bufs.ground;
      for (let r = g.h - Math.max(1, rowsBelow(set)); r < g.h; r++) {
        for (let x = 0; x < g.w; x++) expect(g.px[(r * g.w + x) * 4 + 3], `${name} ground row ${r}, x ${x}`).toBe(255);
      }
    }
  });

  it('a legacy set (no frame) sits 70 rows down, and its ground and fg are carried to the view\'s bottom edge', () => {
    const W = 4;
    const layer = (h: number) => () => blank(W, h);
    const legacy: ScenerySet = {
      tileW: W,
      layers: { far: { y: 20, h: 30 }, mid: { y: 10, h: 40 }, ground: { y: 40, h: 42 }, fg: { y: 73, h: 9 } },
      scroll0: { far: 0, mid: 0, ground: 0, fg: 0 },
      sky: true,
      graded: false,
      far: layer(30),
      mid: layer(40),
      ground: layer(42),
      fg: layer(9),
      lights: () => ({}),
    };
    expect(frameTop(legacy)).toBe(70);
    expect(rowsBelow(legacy)).toBe(8);
    expect(layerRow(legacy, 'far')).toBe(90);
    expect(layerRow(legacy, 'ground')).toBe(110);
    // The foreground sits on the view's bottom edge, the ground grows to meet it.
    expect(layerRow(legacy, 'fg') + 9).toBe(VIEW.h);
    const g = blank(W, 42);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < W; x++) g.px.set([y, x, 7, 255], (y * W + x) * 4);
    const tall = fitToView(legacy, 'ground', g);
    expect([tall.w, tall.h]).toEqual([W, 50]);
    expect(layerRow(legacy, 'ground') + tall.h).toBe(VIEW.h);
    // The new rows repeat the ground's bottom 8 rows, in order; the drawn rows are untouched.
    for (let y = 0; y < tall.h; y++) {
      const src = y < 42 ? y : 34 + (y - 42);
      expect(tall.px[(y * W + 1) * 4], `row ${y}`).toBe(src);
    }
    expect(fitToView(legacy, 'mid', g)).toBe(g);
    // A set in SCENE_FRAME reaches the bottom by itself.
    expect(fitToView({ ...legacy, frame: SCENE_FRAME, layers: { ...legacy.layers, ground: { y: 81, h: 42 } } }, 'ground', g)).toBe(g);
  });

  it("a world's horizon, sun or moon and clouds are mapped into the set's frame", () => {
    const fresh = { frame: SCENE_FRAME };
    for (const def of DATA.worlds) {
      const a = def.look.atmo;
      // Legacy frame: shifted down to its top.
      const v = viewAtmo(a);
      expect(v.horizon, def.id).toBe(a.horizon + 70);
      if (a.body) expect([v.body!.x, v.body!.y, v.body!.r], def.id).toEqual([a.body.x, a.body.y + 70, a.body.r]);
      if (a.clouds) expect(v.clouds!.y, def.id).toBe(a.clouds.y + 70);
      expect(v.sky).toEqual(a.sky);
      // The new frame: scaled 1.5 times and placed at its top (row 37).
      const n = viewAtmo(a, fresh);
      expect(n.horizon, def.id).toBe(Math.round(37 + a.horizon * 1.5));
      if (a.body) {
        expect([n.body!.x, n.body!.y, n.body!.r, n.body!.haloR], def.id).toEqual([a.body.x * 1.5, 37 + a.body.y * 1.5, a.body.r * 1.5, a.body.haloR * 1.5]);
        // Still clear of the horizon, and inside the view.
        expect(n.body!.y, def.id).toBeLessThan(n.horizon - 10);
        expect(n.body!.x, def.id).toBeLessThanOrEqual(VIEW.w);
      }
      if (a.clouds) expect(n.clouds!.y, def.id).toBe(Math.round(37 + a.clouds.y * 1.5));
      expect(legacyRow(fresh, a.horizon)).toBe(37 + a.horizon * 1.5);
    }
    for (const world of [1, 5, 6, 8]) {
      const def = DATA.worlds[world - 1];
      const art = worldArt(world);
      const v = viewAtmo(def.look.atmo, art.set);
      expect(art.atmo).toEqual(v);
      expect(art.scale).toBe(frameScale(art.set));
      expect([art.sky.w, art.sky.h]).toEqual([VIEW.w, VIEW.h]);
      if (v.clouds && art.set.sky) expect(art.clouds[0].y).toBe(v.clouds.y);
      // The sun or moon's disc is in the middle of its glow overlay.
      if (art.glow) expect(art.glow.y + (art.glow.buf.h - 1) / 2).toBe(Math.floor(v.body!.y));
    }
  });

  it('the composed view shows the scene unchanged: feet on the ground layer, sky above the street, wall above the dungeon floor', () => {
    const street = composeWorld(1, { vignette: false });
    const dungeon = composeWorld(8, { vignette: false });
    expect([street.w, street.h]).toEqual([VIEW.w, VIEW.h]);
    // The street's sidewalk under the fighters' feet is the ground layer's own pixels.
    const art = worldArt(1);
    const g = art.layers.ground;
    const row = sceneFrame(SUBURBS).feetRow - SUBURBS.layers.ground.y;
    const s0 = SUBURBS.scroll0.ground;
    for (const x of [0, 30, 77, 119, 179]) {
      const v = (FEET_ROW * street.w + x) * 4;
      const l = (row * g.w + ((x + s0) % g.w)) * 4;
      expect([...street.px.slice(v, v + 3)], `street feet row, x ${x}`).toEqual([...g.px.slice(l, l + 3)]);
    }
    // No sky in the dungeon: its far layer is opaque from the view's first row.
    const far = worldArt(8).layers.far;
    expect(far.h).toBe(DUNGEON.layers.far.h);
    expect(layerRow(DUNGEON, 'far')).toBe(0);
    for (const x of [0, 50, 119, 179]) expect(dungeon.px[(0 * dungeon.w + x) * 4 + 3]).toBe(255);
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
