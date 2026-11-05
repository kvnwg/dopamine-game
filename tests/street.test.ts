import { describe, expect, it } from 'vitest';
import { checkRows, type PixelBuf } from '../src/render/pixel/buf';
import { SCENE_FRAME, type LayerName } from '../src/render/pixel/sceneryTypes';
import { LAYERS, SUBURBS, TILE_W, farLayer, fgLayer, groundLayer, midLayer } from '../src/render/pixel/scenery';
import { FAR_SPRITES } from '../src/render/pixel/street/far';
import { MID_SPRITES } from '../src/render/pixel/street/mid';
import { GROUND_SPRITES } from '../src/render/pixel/street/ground';

const NAMES: readonly LayerName[] = ['far', 'mid', 'ground', 'fg'];
const layers: Record<LayerName, PixelBuf> = { far: farLayer(), mid: midLayer(), ground: groundLayer(), fg: fgLayer() };

const rgbOf = (b: PixelBuf, x: number, y: number): number => {
  const i = (y * b.w + (((x % b.w) + b.w) % b.w)) * 4;
  return b.px[i + 3] ? (b.px[i] << 16) | (b.px[i + 1] << 8) | b.px[i + 2] : -1;
};

/** Rows of a layer's buffer that differ between two columns. */
function columnDiff(b: PixelBuf, a: number, c: number): number {
  let n = 0;
  for (let y = 0; y < b.h; y++) if (rgbOf(b, a, y) !== rgbOf(b, c, y)) n++;
  return n;
}

describe('the street (Sunny Suburbs and the worlds graded from it)', () => {
  it('is drawn in the 123-row frame (feet on row 100), each layer inside it, ground and foreground down to its bottom', () => {
    expect(SUBURBS.frame).toEqual(SCENE_FRAME);
    expect(SCENE_FRAME).toEqual({ h: 123, feetRow: 100 });
    expect(TILE_W).toBe(342);
    expect(SUBURBS.tileW).toBe(TILE_W);
    for (const name of NAMES) {
      const { y, h } = LAYERS[name];
      expect(layers[name].w, name).toBe(TILE_W);
      expect(layers[name].h, name).toBe(h);
      expect(y, `${name} top`).toBeGreaterThanOrEqual(0);
      expect(y + h, `${name} bottom`).toBeLessThanOrEqual(SCENE_FRAME.h);
      expect(SUBURBS.scroll0[name], name).toBeGreaterThanOrEqual(0);
      expect(SUBURBS.scroll0[name], name).toBeLessThan(TILE_W);
      // binary alpha: every pixel is art or clear
      for (let i = 3; i < layers[name].px.length; i += 4) if (layers[name].px[i] !== 0 && layers[name].px[i] !== 255) throw new Error(`${name}: alpha ${layers[name].px[i]}`);
    }
    expect(LAYERS.ground.y + LAYERS.ground.h).toBe(SCENE_FRAME.h);
    expect(LAYERS.fg.y + LAYERS.fg.h).toBe(SCENE_FRAME.h);
  });

  it('every authored sprite is valid rows of palette keys', () => {
    for (const [name, rows] of [...FAR_SPRITES, ...MID_SPRITES, ...GROUND_SPRITES]) checkRows(name, rows);
  });

  it('fills every row from the lawn edge down, edge to edge: no sky under the feet', () => {
    const g = layers.ground;
    const lawnEdge = 86 - LAYERS.ground.y;
    for (let y = lawnEdge; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) expect(rgbOf(g, x, y), `ground row ${y + LAYERS.ground.y}, x ${x}`).toBeGreaterThanOrEqual(0);
    }
    // the mid layer's lawn is solid from the house line down, under the ground's lawn edge
    const m = layers.mid;
    for (let y = 78 - LAYERS.mid.y; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) expect(rgbOf(m, x, y), `mid row ${y + LAYERS.mid.y}, x ${x}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('the feet row and the rows around it are plain slab and joints, so the fighters read clearly', () => {
    const g = layers.ground;
    const feet = SCENE_FRAME.feetRow - LAYERS.ground.y;
    const colors = new Set<number>();
    for (let y = feet - 3; y <= feet + 4; y++) for (let x = 0; x < g.w; x++) colors.add(rgbOf(g, x, y));
    // slab (plain, newer, older), the joints' groove and lit lip: nothing else
    expect(colors.has(-1)).toBe(false);
    expect(colors.size).toBeLessThanOrEqual(5);
    // the foreground stays below the sidewalk
    expect(LAYERS.fg.y).toBeGreaterThan(SCENE_FRAME.feetRow + 4);
  });

  it('every layer tiles seamlessly: the seam is no harsher than the columns inside the tile', () => {
    for (const name of NAMES) {
      const b = layers[name];
      const inner = Array.from({ length: b.w - 1 }, (_, x) => columnDiff(b, x, x + 1)).sort((p, q) => p - q);
      const p90 = inner[Math.floor(inner.length * 0.9)];
      expect(columnDiff(b, b.w - 1, 0), `${name} seam`).toBeLessThanOrEqual(p90);
    }
  });

  it('the far layer is left uninked (distance), the nearer layers are inked', () => {
    const INK = 0x1a1326;
    const hasInk = (b: PixelBuf) => {
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (rgbOf(b, x, y) === INK) return true;
      return false;
    };
    expect(hasInk(layers.far)).toBe(false);
    expect(hasInk(layers.mid)).toBe(true);
    expect(hasInk(layers.ground)).toBe(true);
  });

  it('lights: windows found in every house with their glass in plain sight, porch lights, street lamps with pools, the far town', () => {
    const lights = SUBURBS.lights();
    const windows = lights.mid!.filter((s) => s.kind === 'window');
    expect(windows.length).toBeGreaterThanOrEqual(10);
    expect(lights.mid!.filter((s) => s.kind === 'lamp')).toHaveLength(3);
    // nothing in the yard covers a window's glass (lit glass glows over whatever covers it)
    const glass = new Set<number>();
    for (const s of windows) {
      s.mask!.forEach((row, yy) => [...row].forEach((m, xx) => {
        if (m === 'g') glass.add(rgbOf(layers.mid, s.x + xx, s.y + yy));
      }));
    }
    expect(glass.size, 'only the two glass colors under window glass').toBe(2);
    const lamps = lights.ground!.filter((s) => s.kind === 'lamp');
    expect(lamps).toHaveLength(2);
    for (const l of lamps) {
      expect(l.pool, 'a pool of light on the sidewalk').toBeDefined();
      // the pool falls on the sidewalk, between the curb and the feet
      expect(l.pool!.y + LAYERS.ground.y).toBeGreaterThan(92);
      expect(l.pool!.y + LAYERS.ground.y).toBeLessThan(SCENE_FRAME.feetRow);
    }
    expect(lights.far!.filter((s) => s.kind === 'window').length).toBeGreaterThanOrEqual(20);
    for (const [name, spots] of Object.entries(lights)) {
      const b = layers[name as LayerName];
      for (const s of spots!) {
        expect(s.y, `${name} light in its layer`).toBeGreaterThanOrEqual(0);
        expect(s.y + s.h, `${name} light in its layer`).toBeLessThanOrEqual(b.h);
      }
    }
  });

  it('prop spots stand in the open yards (lawn or the driveway), apart, and clear of every window', () => {
    const spots = SUBURBS.propSpots!;
    const PROP = 16;
    const houseLine = 78 - LAYERS.mid.y;
    expect(spots.x.length).toBeGreaterThanOrEqual(3);
    expect(spots.row).toBeGreaterThan(houseLine);
    expect(spots.row).toBeLessThan(86 - LAYERS.mid.y);
    const sorted = [...spots.x].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      const gap = (i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + TILE_W) - sorted[i];
      expect(gap, `spots ${sorted[i]} and the next are a prop apart`).toBeGreaterThanOrEqual(PROP);
    }
    const windows = SUBURBS.lights().mid!.filter((s) => s.kind === 'window');
    for (const x of spots.x) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(TILE_W);
      for (const w of windows) {
        const overlapX = x < w.x + w.w && w.x < x + PROP;
        const overlapY = spots.row - PROP + 1 < w.y + w.h && w.y <= spots.row;
        expect(overlapX && overlapY, `spot ${x} covers the window at ${w.x}, ${w.y}`).toBe(false);
      }
      // its feet on open ground: no outline (a bush, a fence, a trunk) under the middle of the spot
      for (let xx = x + 2; xx < x + PROP - 2; xx++) {
        const c = rgbOf(layers.mid, xx, spots.row);
        expect(c, `spot ${x}: ground at ${xx}`).toBeGreaterThanOrEqual(0);
        expect(c, `spot ${x}: no outline at ${xx}`).not.toBe(0x1a1326);
      }
    }
  });
});
