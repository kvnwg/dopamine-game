import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data';
import {
  CLOUD_W, glowOverlay, lightLayer, litSpots, mixLab, paintClouds, paintSky, paintVignette, twinkleSpots,
} from '../src/render/pixel/atmosphere';
import { SUBURBS, windowsOf } from '../src/render/pixel/scenery';
import { DUNGEON } from '../src/render/pixel/packs/dungeon';
import { VIEW } from '../src/render/pixel/sceneryTypes';
import { composeWorld, placeProps, sceneryFor, worldSeed } from '../src/render/worldLook';
import { PROPS } from '../src/render/pixel/packs/props';
import { clone } from '../src/render/pixel/buf';

const atmoOf = (id: string) => DATA.worlds.find((w) => w.id === id)!.look.atmo;
const alphas = (px: Uint8ClampedArray) => {
  const s = new Set<number>();
  for (let i = 3; i < px.length; i += 4) s.add(px[i]);
  return s;
};

describe('atmosphere', () => {
  it('every world has a sky that fits the view', () => {
    for (const w of DATA.worlds) {
      const a = w.look.atmo;
      expect(a.sky.length, w.id).toBeGreaterThanOrEqual(2);
      if (a.body) {
        expect(a.body.x, `${w.id} body x`).toBeGreaterThanOrEqual(0);
        expect(a.body.x, `${w.id} body x`).toBeLessThanOrEqual(VIEW.w);
        // Above the far hills, so the sun or moon is seen (a setting sun may dip behind them).
        expect(a.body.y, `${w.id} body y`).toBeLessThan(a.horizon - 10);
      }
    }
  });

  it('paints skies deterministically, fully opaque, in a handful of bands', () => {
    const a = atmoOf('pinecone_park');
    const one = paintSky(a, VIEW.w, VIEW.h + 1, 7);
    const two = paintSky(a, VIEW.w, VIEW.h + 1, 7);
    expect(one.px).toEqual(two.px);
    expect([...alphas(one.px)]).toEqual([255]);
    // A column well away from stars: few distinct colors (the bands), not a smooth ramp.
    const colors = new Set<number>();
    for (let y = 0; y < a.horizon; y++) {
      const i = (y * one.w + 3) * 4;
      colors.add((one.px[i] << 16) | (one.px[i + 1] << 8) | one.px[i + 2]);
    }
    expect(colors.size).toBeLessThanOrEqual(Math.round(a.horizon / 3.5) + 6);
  });

  it('mixes colors in OKLab (even steps of perceived lightness)', () => {
    expect(mixLab([10, 20, 30], [200, 100, 50], 0)).toEqual([10, 20, 30]);
    expect(mixLab([10, 20, 30], [200, 100, 50], 1)).toEqual([200, 100, 50]);
    // Halfway from black to white in OKLab is L = 0.5, sRGB 99 (a plain RGB mix would give 128).
    for (const c of mixLab([0, 0, 0], [255, 255, 255], 0.5)) expect(Math.abs(c - 99)).toBeLessThanOrEqual(2);
  });

  it('draws the sun, moon or planet over a halo of semi-transparent rings', () => {
    const a = atmoOf('neon_night');
    const g = glowOverlay(a, 3)!;
    const cx = Math.floor(a.body!.x) - g.x;
    const cy = Math.floor(a.body!.y) - g.y;
    expect(g.buf.px[(cy * g.buf.w + cx) * 4 + 3]).toBe(255);
    const steps = [...alphas(g.buf.px)].filter((v) => v > 0 && v < 255);
    expect(steps.length).toBeGreaterThanOrEqual(3);
  });

  it('cloud strips tile at CLOUD_W with binary alpha', () => {
    for (const id of ['sunny_suburbs', 'pinecone_park']) {
      const strips = paintClouds(atmoOf(id), 5);
      expect(strips.length, id).toBe(2);
      for (const s of strips) {
        expect(s.buf.w).toBe(CLOUD_W);
        expect([...alphas(s.buf.px)].every((v) => v === 0 || v === 255)).toBe(true);
        expect(alphas(s.buf.px).has(255), `${id} has clouds`).toBe(true);
      }
      expect(strips[0].speed).toBeLessThan(strips[1].speed);
    }
    expect(paintClouds(atmoOf('moon_junkyard'), 5)).toEqual([]);
  });

  it('finds the windows in the street houses and lights a share of them at night', () => {
    const lights = SUBURBS.lights();
    const windows = lights.mid!.filter((s) => s.kind === 'window');
    expect(windows.length).toBeGreaterThanOrEqual(7);
    for (const w of windows) expect(w.mask!.join('')).toContain('g');
    expect(lights.ground!.filter((s) => s.kind === 'lamp' && s.pool)).toHaveLength(2);
    expect(windowsOf(['xxxx', 'xcwx', 'xxxx'])).toEqual([{ x: 1, y: 1, w: 2, h: 1, mask: ['gf'] }]);
    // Glass that isn't closed in by frame (a wall, a roof edge) is not a window.
    expect(windowsOf(['.ccc.', 'xccxx'])).toEqual([]);
    // Curtains inside the frame belong to the window; a frame around curtains alone is not one.
    expect(windowsOf(['xxxxx', 'xPcMx', 'xxxxx'])).toEqual([{ x: 1, y: 1, w: 3, h: 1, mask: ['ugu'] }]);
    expect(windowsOf(['xxx', 'xPx', 'xxx'])).toEqual([]);

    const night = atmoOf('neon_night');
    const day = atmoOf('sunny_suburbs');
    expect(litSpots(day, windows, 1)).toHaveLength(0);
    const lit = litSpots(night, windows, worldSeed(6));
    expect(lit.length).toBeGreaterThan(0);
    expect(lit.length).toBeLessThanOrEqual(windows.length);
  });

  it('lights scenery: glow spills past the art as semi-transparent rings, day scenery is untouched by it', () => {
    const mid = SUBURBS.mid();
    const lights = SUBURBS.lights().mid!;
    const night = lightLayer(mid, { atmo: atmoOf('neon_night'), layer: 'mid', lights, seed: worldSeed(6), top: SUBURBS.layers.mid.y });
    const nightAlphas = alphas(night.px);
    expect([...nightAlphas].some((v) => v > 0 && v < 255), 'glow over open air').toBe(true);
    const day = lightLayer(mid, { atmo: atmoOf('sunny_suburbs'), layer: 'mid', lights, seed: worldSeed(1), top: SUBURBS.layers.mid.y });
    expect([...alphas(day.px)].every((v) => v === 0 || v === 255)).toBe(true);
    expect(day.w).toBe(mid.w);
    expect(day.h).toBe(mid.h);
  });

  it('dungeon torches flicker and the vignette darkens only the edges', () => {
    const torches = DUNGEON.lights().far!.filter((s) => s.kind === 'torch');
    expect(torches.length).toBeGreaterThanOrEqual(3);
    expect(torches.every((t) => t.flicker)).toBe(true);
    const v = paintVignette(VIEW.w, VIEW.h, 0.5);
    const at = (x: number, y: number) => v.px[(y * v.w + x) * 4 + 3];
    expect(at(Math.floor(VIEW.w / 2), Math.floor(VIEW.h / 2))).toBe(0);
    expect(at(0, 0)).toBeGreaterThan(0);
    expect(at(0, 0)).toBeGreaterThan(at(8, 6));
    expect([...alphas(paintVignette(VIEW.w, VIEW.h, 0).px)]).toEqual([0]);
  });

  it('twinkling stars stay in the upper sky, clear of the halo', () => {
    const a = atmoOf('moon_junkyard');
    const spots = twinkleSpots(a, 12, 4);
    expect(spots.length).toBeGreaterThan(6);
    for (const p of spots) {
      expect(p.y).toBeLessThan(a.horizon);
      expect(Math.hypot(p.x - a.body!.x, p.y - a.body!.y)).toBeGreaterThan(a.body!.r + 2);
    }
  });

  it('composes every world into an opaque view', () => {
    for (let w = 1; w <= DATA.worlds.length; w++) {
      const v = composeWorld(w);
      expect(v.w).toBe(VIEW.w);
      expect(v.h).toBe(VIEW.h + 1);
      expect([...alphas(v.px)], `world ${w}`).toEqual([255]);
    }
  });

  it('themed props exist, stand in the yards, and glowing ones light up', () => {
    for (const w of DATA.worlds) {
      for (const id of w.look.props ?? []) expect(id in PROPS, `${w.id}: unknown prop ${id}`).toBe(true);
    }
    const haunted = DATA.worlds.findIndex((w) => w.id === 'haunted_hollow') + 1;
    const def = DATA.worlds[haunted - 1];
    const mid = clone(sceneryFor(def).bufs.mid);
    const before = mid.px.slice();
    const spots = placeProps(mid, def.look.props!, worldSeed(haunted), sceneryFor(def).set.propSpots);
    let changed = 0;
    for (let i = 0; i < before.length; i += 4) if (before[i] !== mid.px[i] || before[i + 1] !== mid.px[i + 1]) changed++;
    expect(changed, 'props were drawn').toBeGreaterThan(40);
    expect(spots.length, 'a jack-o\'-lantern glows').toBeGreaterThanOrEqual(1);
    expect(placeProps(clone(mid), [], 1)).toEqual([]);
  });
});
