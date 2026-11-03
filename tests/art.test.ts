import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data';
import { alphaAt, bounds, checkRows } from '../src/render/pixel/buf';
import { ENEMY_ART, recolorEnemy, type EnemyShape } from '../src/render/pixel/enemies';
import { HEADROOM, HERO_BODY, HERO_POINTS, HERO_SIZE, HERO_TAIL, WORN, gearBuf, weaponBuf } from '../src/render/pixel/hero';
import { ITEM_SPRITES, WEAPON_GRIP } from '../src/render/pixel/items';
import { CLOUDS, LAYERS, TILE_W, farLayer, fgLayer, groundLayer, midLayer } from '../src/render/pixel/scenery';
import { FX, UI_SPRITES } from '../src/render/pixel/ui';

describe('pixel art', () => {
  it('every base item has its own valid 16x16 icon, and every weapon has a grip on the art', () => {
    for (const item of DATA.items) {
      const rows = ITEM_SPRITES[item.id];
      expect(rows, item.id).toBeDefined();
      checkRows(item.id, rows);
      expect(rows.length, item.id).toBe(16);
      expect(rows[0].length, item.id).toBe(16);
      if (item.slot === 'weapon') {
        const w = weaponBuf(item.id)!;
        const grip = WEAPON_GRIP[item.id];
        expect(grip, item.id).toBeDefined();
        expect(alphaAt(w.buf, grip.x, grip.y), `${item.id} grip is on the art`).toBe(255);
      }
    }
  });

  it('every wearable item shows on the raccoon (rings are too small to draw)', () => {
    for (const item of DATA.items) {
      if (item.slot === 'weapon' || item.slot === 'ring') continue;
      const b = gearBuf(item.slot, item.id);
      expect(b, item.id).not.toBeNull();
      expect(bounds(b!).w, item.id).toBeGreaterThan(0);
    }
    for (const [id, w] of Object.entries(WORN)) checkRows(id, w.rows);
  });

  it('the hero is drawn in a 40x40 grid with its feet and head on the art', () => {
    checkRows('hero body', HERO_BODY);
    checkRows('hero tail', HERO_TAIL);
    expect(HERO_BODY).toHaveLength(HERO_SIZE);
    expect(HERO_BODY[0]).toHaveLength(HERO_SIZE);
    const { feet, head } = HERO_POINTS;
    expect(HERO_BODY[feet.y - HEADROOM - 1][feet.x - 4]).not.toBe('.');
    expect(HERO_BODY[head.y - HEADROOM + 2][head.x]).not.toBe('.');
  });

  it('every enemy shape the data uses has art, recolorable per world', () => {
    const shapes = new Set(Object.values(DATA.assets.placeholders.enemies).map((e) => e.shape as EnemyShape));
    for (const shape of shapes) {
      const art = ENEMY_ART[shape];
      expect(art, shape).toBeDefined();
      checkRows(shape, art.rows);
      // The ground point may sit between two feet: there must be art on that row close to it.
      const row = art.rows[art.feet.y] ?? '';
      expect(/[^.]/.test(row.slice(Math.max(0, art.feet.x - 4), art.feet.x + 5)), `${shape} feet on the art`).toBe(true);
      const a = recolorEnemy(shape, '#ff0000', '#00ff00');
      const b = recolorEnemy(shape, '#0000ff', '#ffff00');
      expect(a.w).toBe(b.w);
      expect(Buffer.from(a.px).equals(Buffer.from(b.px)), `${shape} changes with world colors`).toBe(false);
    }
  });

  it('scenery layers tile at TILE_W with their documented heights', () => {
    const layers = { far: farLayer(), mid: midLayer(), ground: groundLayer(), fg: fgLayer() };
    for (const [name, b] of Object.entries(layers)) {
      expect(b.w, name).toBe(TILE_W);
      expect(b.h, name).toBe(LAYERS[name as keyof typeof LAYERS].h);
    }
    expect(CLOUDS.length).toBeGreaterThanOrEqual(3);
    CLOUDS.forEach((c, i) => checkRows(`cloud ${i}`, c));
  });

  it('UI icons are 16x16 and every effect sprite is valid', () => {
    for (const [name, rows] of Object.entries(UI_SPRITES)) {
      checkRows(name, rows);
      expect(rows.length, name).toBe(16);
      expect(rows[0].length, name).toBe(16);
    }
    for (const key of ['slash', 'impact', 'puff', 'sparkle', 'coin', 'bag', 'dumpsterBody', 'dumpsterLid'] as const) checkRows(key, FX[key]);
    expect(FX.confetti.length).toBe(4);
  });
});
