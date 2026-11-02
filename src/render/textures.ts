/**
 * Registers the painted placeholder art (src/render/paint/*) as Phaser textures.
 * Style: hand-drawn storybook gouache/watercolor with dark-plum ink (see docs/ART_DIRECTION.md).
 * Real art replaces these through assets.json without touching the scene.
 */
import Phaser from 'phaser';
import { DATA, type Rarity, type Slot } from '../data';
import { hexToNum } from './art';
import { INK, makeCanvas, paperGrain, seeded } from './paint/brush';
import { paintEnemy, paintRaccoon } from './paint/characters';
import { paintRaccoonFrame, RACCOON_FEET, RACCOON_TEX } from './paint/frames';
import { gearOverlayCanvas } from './paint/gear';
import { paintFar, paintFg, paintGround, paintMid, paintParticle, paintProps, paintSignBoard, paintSky, TILE_W } from './paint/scenery';

export { RACCOON_FEET, RACCOON_TEX };
export const BG_TILE_W = TILE_W;
/** Dark plum ink, used for bars and outlines drawn at runtime. */
export const OUTLINE = hexToNum(INK);
export const SIGN_BOARD = { w: 360, h: 140, pad: 70 };

function put(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

export function enemyTexKey(id: string) {
  return `enemy_${id}`;
}

/** Texture box for an enemy of size S (height in px); feet at (w/2, h - pad). */
export function enemyTexBox(S: number) {
  return { w: Math.ceil(S * 1.75), h: Math.ceil(S * 1.32), pad: 16 };
}

export function gearTexKey(slot: Slot, rarity: Rarity) {
  return `gear_${slot}_${rarity}`;
}

/** Paints (once) and returns the overlay texture for an equipped item. */
export function ensureGearTexture(scene: Phaser.Scene, slot: Slot, rarity: Rarity): string {
  const key = gearTexKey(slot, rarity);
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, gearOverlayCanvas(slot, rarity));
  return key;
}

export function generateTextures(scene: Phaser.Scene): void {
  put(scene, 'raccoon_base', paintRaccoonFrame((ctx, fx, fy) => paintRaccoon(ctx, fx, fy, seeded(3))));
  for (const [id, ph] of Object.entries(DATA.assets.placeholders.enemies)) {
    const box = enemyTexBox(ph.size);
    const { c, ctx } = makeCanvas(box.w, box.h);
    paintEnemy(ctx, seeded(id.length * 7 + ph.size), ph.shape, ph.size, ph.color, ph.accent, box.w / 2, box.h - box.pad);
    put(scene, enemyTexKey(id), c);
  }
  const particles: Array<[string, string]> = [
    ['p_star', 'star'], ['p_dot', 'dot'], ['p_ring', 'ring'], ['p_smoke', 'smoke'], ['p_coin', 'coin'], ['p_bag', 'bag'],
    ['c_peel', 'peel'], ['c_cap', 'cap'], ['c_paper', 'paper'], ['c_crust', 'crust'],
  ];
  for (const [key, kind] of particles) put(scene, key, paintParticle(kind));
  put(scene, 'paper_grain', paperGrain(256));
}

export function generateBackground(scene: Phaser.Scene, bgId: string, w: number, h: number): void {
  const c = DATA.assets.placeholders.backgrounds[bgId];
  put(scene, `${bgId}_sky`, paintSky(w, h, c));
  put(scene, `${bgId}_far`, paintFar(c));
  put(scene, `${bgId}_mid`, paintMid(c));
  put(scene, `${bgId}_props`, paintProps());
  put(scene, `${bgId}_ground`, paintGround(c));
  put(scene, `${bgId}_fg`, paintFg());
  put(scene, `${bgId}_sign`, paintSignBoard(SIGN_BOARD.w, SIGN_BOARD.h, c.neon));
}
