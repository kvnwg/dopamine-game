/**
 * Per-world look for the battle backdrop: which scenery set a world uses, a hue / saturation /
 * brightness grade for the street layers (dark outline pixels are left alone so line work stays
 * crisp; the fantasy dungeon keeps its own colors), and the world's atmosphere (atmosphere.ts:
 * sky, clouds, sun or moon, haze, lit windows and lamps, vignette). Used by the battle scene, the
 * Worlds tab's previews (src/ui/worldThumbs.ts, from composeWorld) and tools/worldPreview.ts.
 */
import { DATA, type Atmo, type WorldDef } from '../data';
import { clone, type PixelBuf } from './pixel/buf';
import { P } from './pixel';
import { SUBURBS } from './pixel/scenery';
import { DUNGEON } from './pixel/packs/dungeon';
import { FARM } from './pixel/farm';
import {
  glowOverlay, lightLayer, litSpots, over, paintClouds, paintSky, paintVignette, type CloudStrip,
} from './pixel/atmosphere';
import { SCENE_Y, VIEW, type LayerName, type LightSpot, type ScenerySet } from './pixel/sceneryTypes';
import { frameBuf } from './pixel/indexed';
import { PROPS, type PropId } from './pixel/packs/props';
import { blit } from './pixel/buf';

export type Look = WorldDef['look'];

export const LAYER_NAMES: readonly LayerName[] = ['far', 'mid', 'ground', 'fg'];

const SETS: Record<NonNullable<Look['scenery']>, ScenerySet> = { suburbs: SUBURBS, dungeon: DUNGEON, farm: FARM };

/** The backdrop a world uses. */
export function scenerySet(def: WorldDef): ScenerySet {
  return SETS[def.look.scenery ?? 'suburbs'] ?? SUBURBS;
}

export interface SceneryKeys {
  far: string;
  mid: string;
  ground: string;
  fg: string;
}

const built = new Map<ScenerySet, Record<LayerName, PixelBuf>>();

/** A world's backdrop and its (ungraded) layer tiles, each set built once. */
export function sceneryFor(def: WorldDef): { set: ScenerySet; bufs: Record<LayerName, PixelBuf> } {
  const set = scenerySet(def);
  let bufs = built.get(set);
  if (!bufs) {
    bufs = { far: set.far(), mid: set.mid(), ground: set.ground(), fg: set.fg() };
    built.set(set, bufs);
  }
  return { set, bufs };
}

/** A layer's top as a view row: the scene frame sits SCENE_Y rows down the view. */
export function layerRow(set: ScenerySet, name: LayerName): number {
  return SCENE_Y + set.layers[name].y;
}

/** Layer tops in the 1080 x 963 battle view (multiples of the pixel size, so pixels line up). */
export function layerY(set: ScenerySet): Record<LayerName, number> {
  return { far: layerRow(set, 'far') * P, mid: layerRow(set, 'mid') * P, ground: layerRow(set, 'ground') * P, fg: layerRow(set, 'fg') * P };
}

/**
 * A world's atmosphere in view rows. worlds.json places the horizon, the sun or moon and the clouds in
 * rows of the 82-row scene frame; the battle view shows that frame SCENE_Y rows down, under more sky.
 */
export function viewAtmo(atmo: Atmo): Atmo {
  return {
    ...atmo,
    horizon: atmo.horizon + SCENE_Y,
    body: atmo.body && { ...atmo.body, y: atmo.body.y + SCENE_Y },
    clouds: atmo.clouds && { ...atmo.clouds, y: atmo.clouds.y + SCENE_Y },
  };
}

/** Where each layer's tile starts scrolling, in screen pixels. */
export function scroll0(set: ScenerySet): Record<LayerName, number> {
  return { far: set.scroll0.far * P, mid: set.scroll0.mid * P, ground: set.scroll0.ground * P, fg: set.scroll0.fg * P };
}

/** 3x3 color matrix = brightness x saturation x hue rotation (same math as CSS filters). */
export function colorMatrix(look: Pick<Look, 'hue' | 'sat' | 'bright'>): number[] {
  const a = Math.cos((look.hue * Math.PI) / 180);
  const b = Math.sin((look.hue * Math.PI) / 180);
  const hue = [
    0.213 + a * 0.787 - b * 0.213, 0.715 - a * 0.715 - b * 0.715, 0.072 - a * 0.072 + b * 0.928,
    0.213 - a * 0.213 + b * 0.143, 0.715 + a * 0.285 + b * 0.14, 0.072 - a * 0.072 - b * 0.283,
    0.213 - a * 0.213 - b * 0.787, 0.715 - a * 0.715 + b * 0.715, 0.072 + a * 0.928 + b * 0.072,
  ];
  const s = look.sat;
  const sat = [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ];
  const out = new Array<number>(9).fill(0);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      let v = 0;
      for (let k = 0; k < 3; k++) v += sat[r * 3 + k] * hue[k * 3 + c];
      out[r * 3 + c] = v * look.bright;
    }
  }
  return out;
}

function isIdentity(look: Look): boolean {
  return look.hue === 0 && look.sat === 1 && look.bright === 1;
}

/** A graded copy of `src`. Near-black pixels (the outlines) keep their color. */
export function gradeBuf(src: PixelBuf, look: Look): PixelBuf {
  const out = clone(src);
  if (isIdentity(look)) return out;
  const d = out.px;
  const m = colorMatrix(look);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const k = lum < 0.16 ? 0 : lum > 0.3 ? 1 : (lum - 0.16) / 0.14;
    d[i] = r + (m[0] * r + m[1] * g + m[2] * b - r) * k;
    d[i + 1] = g + (m[3] * r + m[4] * g + m[5] * b - g) * k;
    d[i + 2] = b + (m[6] * r + m[7] * g + m[8] * b - b) * k;
  }
  return out;
}

/** Props that glow at night, and their light. */
const GLOWING: Partial<Record<PropId, string>> = {
  jackOLantern: '#FF9A3A',
  jackOLanternDim: '#FF8A2A',
  cauldron: '#7AFF6A',
};

/**
 * Sets a world's themed props into a mid layer (already graded, so they keep their own colors) and
 * returns light spots for the ones that glow. With `spots` (the scenery's propSpots) each prop stands
 * at the next spot, best first, its lowest pixel on the spot's row. Otherwise they stand a few rows in
 * front of the house line (the first fully opaque row) on stretches of plain grass, spread out.
 */
export function placeProps(mid: PixelBuf, ids: readonly string[], seed: number, spots?: ScenerySet['propSpots']): LightSpot[] {
  const props = ids.filter((id): id is PropId => id in PROPS).map((id) => ({ id, buf: frameBuf(PROPS[id], 0) }));
  if (props.length === 0) return [];
  const lights: LightSpot[] = [];
  const stand = (p: (typeof props)[number], x: number, feet: number) => {
    let low = p.buf.h - 1;
    while (low > 0 && !rowHasInk(p.buf, low)) low--;
    const top = feet - low;
    blit(mid, p.buf, x, top, { wrapX: true });
    const color = GLOWING[p.id];
    if (color) lights.push({ x: x + Math.floor(p.buf.w / 2) - 1, y: top + Math.floor(low / 2) - 1, w: 3, h: 2, kind: 'fire', color, radius: 7, power: 0.9 });
  };
  if (spots) {
    props.slice(0, spots.x.length).forEach((p, i) => stand(p, spots.x[i], spots.row));
    return lights;
  }
  const W = mid.w;
  const at = (x: number, y: number) => {
    const i = (y * W + (((x % W) + W) % W)) * 4;
    return mid.px[i + 3] > 0 ? (mid.px[i] << 16) | (mid.px[i + 1] << 8) | mid.px[i + 2] : -1;
  };
  let lawn = -1;
  for (let y = 0; y < mid.h && lawn < 0; y++) {
    let full = true;
    for (let x = 0; x < W && full; x++) full = at(x, y) >= 0;
    if (full) lawn = y;
  }
  if (lawn < 0) return [];
  const base = Math.min(lawn + 3, mid.h - 2);
  // Grass colors: the common ones on the yard rows.
  const counts = new Map<number, number>();
  for (let y = lawn; y <= base + 1; y++) for (let x = 0; x < W; x++) counts.set(at(x, y), (counts.get(at(x, y)) ?? 0) + 1);
  const grass = new Set([...counts].filter(([, n]) => n >= W * 0.04).map(([c]) => c));
  // A column is free when every yard row there is plain grass (no path, bed, mailbox or shadow).
  const free = Array.from({ length: W }, (_, x) => {
    for (let y = lawn; y <= base + 1; y++) if (!grass.has(at(x, y))) return false;
    return true;
  });
  const gap = Math.floor(W / (props.length + 1));
  let start = Math.floor(((seed % 97) / 97) * gap);
  for (const p of props) {
    for (let k = 0; k < W; k++) {
      const x = (start + k) % W;
      let ok = true;
      for (let i = -1; i <= p.buf.w && ok; i++) ok = free[(x + i + W) % W];
      if (!ok) continue;
      stand(p, x, base);
      for (let i = -2; i <= p.buf.w + 1; i++) free[(x + i + W) % W] = false;
      start = x + p.buf.w + gap;
      break;
    }
  }
  return lights;
}

function rowHasInk(b: PixelBuf, y: number): boolean {
  for (let x = 0; x < b.w; x++) if (b.px[(y * b.w + x) * 4 + 3]) return true;
  return false;
}

/** Seed for a world's sky and lights, so each world's stars, clouds and lit windows stay put. */
export function worldSeed(world: number): number {
  return world * 7919 + 13;
}

/** Everything a world's backdrop is painted from, in art pixels and view rows (see atmosphere.ts). */
export interface WorldArt {
  set: ScenerySet;
  /** The world's atmosphere in view rows (viewAtmo). */
  atmo: Atmo;
  /** The sky, VIEW.w x (VIEW.h + 1) so it also fills the canvas' last screen rows. */
  sky: PixelBuf;
  clouds: CloudStrip[];
  /** The sun / moon / planet and its halo, placed at view (x, y). */
  glow: { buf: PixelBuf; x: number; y: number } | null;
  /** Scenery layers, graded and lit for the world. */
  layers: Record<LayerName, PixelBuf>;
  /** Light spots that flicker (torches), per layer, for the battle scene to animate. */
  flicker: Array<{ layer: LayerName; spot: LightSpot }>;
  vignette: PixelBuf;
}

const arts = new Map<number, WorldArt>();

/** A world's backdrop art (built on first use; the last few are kept). */
export function worldArt(world: number): WorldArt {
  const n = Math.max(1, Math.min(world, DATA.worlds.length));
  const hit = arts.get(n);
  if (hit) return hit;
  const def = DATA.worlds[n - 1];
  const atmo = viewAtmo(def.look.atmo);
  const seed = worldSeed(n);
  const { set, bufs } = sceneryFor(def);
  const spots = lightsFor(set);
  const layers = {} as Record<LayerName, PixelBuf>;
  for (const name of LAYER_NAMES) {
    const graded = set.graded ? gradeBuf(bufs[name], def.look) : clone(bufs[name]);
    // A world's themed props stand in the mid layer's yards (in their own colors).
    const extra = name === 'mid' && def.look.props ? placeProps(graded, def.look.props, seed, set.propSpots) : [];
    layers[name] = lightLayer(graded, { atmo, layer: name, lights: [...(spots[name] ?? []), ...extra], seed, top: layerRow(set, name) });
  }
  const flicker = LAYER_NAMES.flatMap((layer) =>
    litSpots(atmo, spots[layer] ?? [], seed).filter((spot) => spot.flicker).map((spot) => ({ layer, spot })),
  );
  const art: WorldArt = {
    set,
    atmo,
    sky: paintSky(atmo, VIEW.w, VIEW.h + 1, seed),
    clouds: set.sky ? paintClouds(atmo, seed) : [],
    glow: set.sky ? glowOverlay(atmo, seed) : null,
    layers,
    flicker,
    vignette: paintVignette(VIEW.w, VIEW.h + 1, atmo.vignette, seed),
  };
  if (arts.size >= 3) arts.delete(arts.keys().next().value!);
  arts.set(n, art);
  return art;
}

const lightCache = new Map<ScenerySet, Readonly<Partial<Record<LayerName, readonly LightSpot[]>>>>();

function lightsFor(set: ScenerySet): Readonly<Partial<Record<LayerName, readonly LightSpot[]>>> {
  let l = lightCache.get(set);
  if (!l) {
    l = set.lights();
    lightCache.set(set, l);
  }
  return l;
}

/**
 * A world's whole backdrop as one picture (`w` x `h` view pixels from the top left): sky, clouds,
 * sun or moon, the four layers at their opening scroll (shifted by `walk` art pixels of walking)
 * and the vignette. For thumbnails and tools/worldPreview.ts; the battle scene draws the parts itself.
 */
export function composeWorld(world: number, opts: { walk?: number; vignette?: boolean; fg?: boolean } = {}): PixelBuf {
  const art = worldArt(world);
  const { set } = art;
  const out = clone(art.sky);
  const walk = opts.walk ?? 0;
  const speed: Record<LayerName, number> = { far: 0.18, mid: 0.5, ground: 1, fg: 1.3 };
  const put = (src: PixelBuf, sx: number, y: number) => {
    const off = ((Math.round(sx) % src.w) + src.w) % src.w;
    for (let x = -off; x < out.w; x += src.w) over(out, src, x, y);
  };
  if (set.sky) {
    art.clouds.forEach((c, i) => put(c.buf, 37 + i * 61, c.y));
    if (art.glow) over(out, art.glow.buf, art.glow.x, art.glow.y);
  }
  for (const name of LAYER_NAMES) {
    if (name === 'fg' && opts.fg === false) continue;
    put(art.layers[name], set.scroll0[name] + walk * speed[name], layerRow(set, name));
  }
  if (opts.vignette !== false) over(out, art.vignette, 0, 0);
  return out;
}
