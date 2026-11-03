/**
 * Registers the pixel art (src/render/pixel) as Phaser textures, once per game. Every texture is
 * drawn at P screen pixels per art pixel, so the battle reads as one pixel grid. Real art can
 * replace these through assets.json without touching the scene.
 */
import Phaser from 'phaser';
import { DATA, type Slot } from '../data';
import { blank, bounds, fromRows, type PixelBuf } from './pixel/buf';
import { P, toCanvas } from './pixel';
import { HERO_H, HERO_POINTS, HERO_W, bodyBuf, gearBuf, pawBuf, tailBuf, weaponBuf, type GearSlot } from './pixel/hero';
import { ENEMY_ART, recolorEnemy, type EnemyShape } from './pixel/enemies';
import { CLOUDS } from './pixel/scenery';
import { FX } from './pixel/ui';
import { baseLayers, gradeBuf, skyBuf } from './worldLook';

/** The hero frame in battle pixels: feet (ground contact), the paw's grip, the top of the head. */
export const HERO = {
  w: HERO_W * P,
  h: HERO_H * P,
  feet: { x: HERO_POINTS.feet.x * P + P / 2, y: (HERO_POINTS.feet.y + 1) * P },
  hand: { x: HERO_POINTS.hand.x * P + P / 2, y: HERO_POINTS.hand.y * P + P / 2 },
  head: { x: HERO_POINTS.head.x * P + P / 2, y: HERO_POINTS.head.y * P },
};
/** Weapon art points up and to the right; the scene turns it this much to point straight up. */
export const WEAPON_TILT = 45;
/** Gear drawn over the body, back to front. The backpack goes between tail and body; the weapon sits in the paw. */
export const FRONT_ORDER: Array<Exclude<Slot, 'weapon' | 'backpack'>> = ['sneakers', 'jacket', 'bling', 'shield', 'gloves', 'ring', 'mask', 'hat'];

export interface SpriteInfo {
  key: string;
  /** Origin in 0..1 texture space. */
  ox: number;
  oy: number;
  w: number;
  h: number;
}

const info = new Map<string, SpriteInfo>();

function put(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement, origin?: { x: number; y: number }): SpriteInfo {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, canvas);
  const known = info.get(key);
  if (known) return known;
  const i: SpriteInfo = {
    key,
    ox: origin ? origin.x / canvas.width : 0.5,
    oy: origin ? origin.y / canvas.height : 0.5,
    w: canvas.width,
    h: canvas.height,
  };
  info.set(key, i);
  return i;
}

function lazy(scene: Phaser.Scene, key: string, make: () => { canvas: HTMLCanvasElement; origin?: { x: number; y: number } }): SpriteInfo {
  const known = info.get(key);
  if (known && scene.textures.exists(key)) return known;
  const m = make();
  return put(scene, key, m.canvas, m.origin);
}

export function heroTail(scene: Phaser.Scene): SpriteInfo {
  return lazy(scene, 'hero_tail', () => ({ canvas: toCanvas(tailBuf()), origin: HERO.feet }));
}

export function heroBody(scene: Phaser.Scene): SpriteInfo {
  return lazy(scene, 'hero_body', () => ({ canvas: toCanvas(bodyBuf()), origin: HERO.feet }));
}

/** The front paw (in glove colors when gloves are worn), centered on the grip. */
export function heroPaw(scene: Phaser.Scene, glovesId: string | null = null): SpriteInfo {
  return lazy(scene, `hero_paw_${glovesId ?? 'none'}`, () => {
    const b = pawBuf(glovesId);
    return { canvas: toCanvas(b), origin: { x: (Math.floor(b.w / 2) + 0.5) * P, y: (Math.floor(b.h / 2) + 0.5) * P } };
  });
}

/** A weapon with its grip as origin (empty paw: an invisible 1px texture). */
export function weaponTex(scene: Phaser.Scene, baseId: string | null): SpriteInfo {
  return lazy(scene, `weapon_${baseId ?? 'none'}`, () => {
    const w = baseId ? weaponBuf(baseId) : null;
    if (!w) return { canvas: toCanvas(blank(1, 1)) };
    return { canvas: toCanvas(w.buf), origin: { x: (w.grip.x + 0.5) * P, y: (w.grip.y + 0.5) * P } };
  });
}

/** One worn item in the hero frame (origin at the hero's feet), or null if it has no worn look. */
export function gearTex(scene: Phaser.Scene, slot: Exclude<Slot, 'weapon'>, baseId: string): SpriteInfo | null {
  const key = `gear_${baseId}`;
  if (info.has(key) && scene.textures.exists(key)) return info.get(key)!;
  const b = gearBuf(slot as GearSlot, baseId);
  if (!b) return null;
  return put(scene, key, toCanvas(b), HERO.feet);
}

/**
 * Enemy sprite in a world's colors, with its feet as origin; `front` is how far the sprite reaches
 * left of the feet, `back` how far right.
 */
export function enemyTex(scene: Phaser.Scene, enemyId: string, world: number): SpriteInfo & { front: number; back: number } {
  const ph = DATA.assets.placeholders.enemies[enemyId] ?? { shape: 'rat', color: '#888888', accent: '#bbbbbb', size: 110 };
  const w = DATA.worlds[Math.max(1, Math.min(world, DATA.worlds.length)) - 1];
  const foe = w.boss.id === enemyId ? w.boss : w.enemies.find((f) => f.id === enemyId);
  const color = foe?.color ?? ph.color;
  const accent = foe?.accent ?? ph.accent;
  const i = lazy(scene, `enemy_${world}_${enemyId}`, () => {
    const shape = ph.shape as EnemyShape;
    const feet = ENEMY_ART[shape].feet;
    return { canvas: toCanvas(recolorEnemy(shape, color, accent)), origin: { x: (feet.x + 0.5) * P, y: (feet.y + 1) * P } };
  });
  return { ...i, front: i.ox * i.w, back: (1 - i.ox) * i.w };
}

export interface WorldKeys {
  sky: string;
  far: string;
  mid: string;
  ground: string;
  fg: string;
}

/** Sky and graded scenery tiles for a world (built on first visit). */
export function worldTextures(scene: Phaser.Scene, world: number, w: number, h: number): WorldKeys {
  const def = DATA.worlds[Math.max(1, Math.min(world, DATA.worlds.length)) - 1];
  const keys: WorldKeys = {
    sky: `w${world}_sky`, far: `w${world}_far`, mid: `w${world}_mid`, ground: `w${world}_ground`, fg: `w${world}_fg`,
  };
  if (!scene.textures.exists(keys.sky)) put(scene, keys.sky, toCanvas(skyBuf(Math.ceil(w / P), Math.ceil(h / P), def.look)), { x: 0, y: 0 });
  const L = baseLayers();
  for (const layer of ['far', 'mid', 'ground', 'fg'] as const) {
    if (!scene.textures.exists(keys[layer])) put(scene, keys[layer], toCanvas(gradeBuf(L[layer], def.look)), { x: 0, y: 0 });
  }
  return keys;
}

/** Frees every world's scenery and enemy textures except `keep`'s. */
export function releaseWorlds(scene: Phaser.Scene, keep: number): void {
  for (const key of scene.textures.getTextureKeys()) {
    const m = /^w(\d+)_|^enemy_(\d+)_/.exec(key);
    if (!m) continue;
    const world = Number(m[1] ?? m[2]);
    if (world !== keep) {
      scene.textures.remove(key);
      info.delete(key);
    }
  }
}

/** A sprite's buffer padded to its tight bounds' center (FX art can be any size). */
function centered(b: PixelBuf): { canvas: HTMLCanvasElement; origin: { x: number; y: number } } {
  const bb = bounds(b);
  return { canvas: toCanvas(b), origin: { x: (bb.x + bb.w / 2) * P, y: (bb.y + bb.h / 2) * P } };
}

export function generateTextures(scene: Phaser.Scene, w: number, h: number): void {
  heroTail(scene);
  heroBody(scene);
  heroPaw(scene, null);
  const slash = fromRows(FX.slash);
  // The slash hangs off its left edge, at mid height (where the swing starts).
  put(scene, 'fx_slash', toCanvas(slash), { x: 0, y: (slash.h / 2) * P });
  const fx: Array<[string, readonly string[]]> = [
    ['fx_impact', FX.impact], ['fx_puff', FX.puff], ['fx_sparkle', FX.sparkle], ['fx_coin', FX.coin], ['fx_bag', FX.bag],
  ];
  for (const [key, rows] of fx) {
    const c = centered(fromRows(rows));
    put(scene, key, c.canvas, c.origin);
  }
  FX.confetti.forEach((rows, k) => put(scene, `fx_conf${k}`, toCanvas(fromRows(rows))));
  CLOUDS.forEach((rows, k) => put(scene, `bg_cloud${k}`, toCanvas(fromRows(rows))));
  void w;
  void h;
}

export function texSize(key: string): { w: number; h: number } {
  const i = info.get(key);
  return i ? { w: i.w, h: i.h } : { w: 0, h: 0 };
}
