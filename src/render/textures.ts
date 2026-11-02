/**
 * Registers the cel-shaded placeholder art (src/render/cel) as Phaser textures, once per game.
 * Real art replaces these through assets.json without touching the scene.
 */
import Phaser from 'phaser';
import { DATA, type Rarity, type Slot } from '../data';
import {
  RACCOON_FRAME, bagSprite, cloudSprite, coinSprite, confetti, enemySprite, farLayer, fgLayer, gearOverlay, groundLayer,
  impactStar, midLayer, puff, raccoonBody, raccoonPaw, sky, slashArc, sparkle, weaponSprite, type EnemyShape, type Pt,
} from './cel';

export const HERO = RACCOON_FRAME;
export const BG_TILE_W = 2048;
/** Gear drawn over the body, back to front. The backpack goes behind the body; the weapon sits in the paw. */
export const FRONT_ORDER: Array<Exclude<Slot, 'weapon'>> = ['sneakers', 'jacket', 'bling', 'shield', 'gloves', 'ring', 'mask', 'hat'];

export interface SpriteInfo {
  key: string;
  /** Origin in 0..1 texture space. */
  ox: number;
  oy: number;
  w: number;
  h: number;
}

const info = new Map<string, SpriteInfo>();

function put(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement, origin?: Pt): SpriteInfo {
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

function lazy(scene: Phaser.Scene, key: string, make: () => { canvas: HTMLCanvasElement; origin?: Pt }): SpriteInfo {
  const known = info.get(key);
  if (known && scene.textures.exists(key)) return known;
  const m = make();
  return put(scene, key, m.canvas, m.origin);
}

export function heroBody(scene: Phaser.Scene): SpriteInfo {
  return lazy(scene, 'hero_body', () => ({ canvas: raccoonBody(), origin: HERO.feet }));
}

export function heroPaw(scene: Phaser.Scene): SpriteInfo {
  return lazy(scene, 'hero_paw', () => {
    const p = raccoonPaw();
    return { canvas: p.canvas, origin: p.center };
  });
}

export function weaponTex(scene: Phaser.Scene, rarity: Rarity | null): SpriteInfo {
  return lazy(scene, `weapon_${rarity ?? 'none'}`, () => {
    const w = weaponSprite(rarity);
    return { canvas: w.canvas, origin: w.grip };
  });
}

/** Gear overlays share the hero frame, so their origin is the hero's feet. */
export function gearTex(scene: Phaser.Scene, slot: Exclude<Slot, 'weapon'>, rarity: Rarity): SpriteInfo {
  return lazy(scene, `gear_${slot}_${rarity}`, () => ({ canvas: gearOverlay(slot, rarity), origin: HERO.feet }));
}

/** Enemy sprite with its feet as origin; `front` is how far the sprite reaches left of the feet. */
export function enemyTex(scene: Phaser.Scene, enemyId: string): SpriteInfo & { front: number; back: number } {
  const ph = DATA.assets.placeholders.enemies[enemyId] ?? { shape: 'rat', color: '#888888', accent: '#bbbbbb', size: 110 };
  const i = lazy(scene, `enemy_${enemyId}`, () => {
    const s = enemySprite(ph.shape as EnemyShape, ph.size, ph.color, ph.accent);
    return { canvas: s.canvas, origin: s.feet };
  });
  return { ...i, front: i.ox * i.w, back: (1 - i.ox) * i.w };
}

export function generateTextures(scene: Phaser.Scene, w: number, h: number): void {
  heroBody(scene);
  heroPaw(scene);
  put(scene, 'fx_slash', slashArc(), { x: 98, y: 154 });
  put(scene, 'fx_impact', impactStar());
  put(scene, 'fx_puff', puff());
  put(scene, 'fx_sparkle', sparkle());
  put(scene, 'fx_coin', coinSprite());
  put(scene, 'fx_bag', bagSprite());
  for (const k of [0, 1, 2, 3] as const) put(scene, `fx_conf${k}`, confetti(k));
  put(scene, 'bg_sky', sky(w, h), { x: 0, y: 0 });
  for (const k of [0, 1, 2]) put(scene, `bg_cloud${k}`, cloudSprite(k));
  put(scene, 'bg_far', farLayer(), { x: 0, y: 0 });
  put(scene, 'bg_mid', midLayer(), { x: 0, y: 0 });
  put(scene, 'bg_ground', groundLayer(), { x: 0, y: 0 });
  put(scene, 'bg_fg', fgLayer(), { x: 0, y: 0 });
}

export function texSize(key: string): { w: number; h: number } {
  const i = info.get(key);
  return i ? { w: i.w, h: i.h } : { w: 0, h: 0 };
}
