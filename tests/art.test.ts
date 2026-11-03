import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data';
import { alphaAt, bounds, checkRows, fromRows } from '../src/render/pixel/buf';
import { ENEMY_ART, recolorEnemy, type EnemyShape } from '../src/render/pixel/enemies';
import { FOE_SHAPES, FOE_SHEETS, sheetFrames } from '../src/render/pixel/foes';
import { HERO_POINTS, HERO_SHEET, frameOffsets, gearSprite, heroFrame, weaponBuf, type GearSlot } from '../src/render/pixel/hero';
import { checkSheet, frameBuf } from '../src/render/pixel/indexed';
import { ITEM_SPRITES, WEAPON_GRIP } from '../src/render/pixel/items';
import { CLOUDS, LAYERS, TILE_W, farLayer, fgLayer, groundLayer, midLayer } from '../src/render/pixel/scenery';
import { FX, UI_SPRITES } from '../src/render/pixel/ui';

const same = (a: { px: Uint8ClampedArray }, b: { px: Uint8ClampedArray }) => Buffer.from(a.px).equals(Buffer.from(b.px));

describe('pixel art', () => {
  it('every base item has its own valid 16x16 icon, and every weapon has a grip on the art', () => {
    for (const item of DATA.items) {
      const rows = ITEM_SPRITES[item.id];
      expect(rows, item.id).toBeDefined();
      checkRows(item.id, rows);
      expect(rows.length, item.id).toBe(16);
      expect(rows[0].length, item.id).toBe(16);
      if (item.slot === 'weapon') {
        const grip = WEAPON_GRIP[item.id];
        expect(grip, item.id).toBeDefined();
        expect(alphaAt(fromRows(rows), grip.x, grip.y), `${item.id} grip is on the icon`).toBe(255);
        // Worn at half size, the paw still holds a pixel of the weapon.
        const w = weaponBuf(item.id)!;
        expect(alphaAt(w.buf, w.grip.x, w.grip.y), `${item.id} grip is on the worn weapon`).toBe(255);
      }
    }
  });

  it('every wearable item shows on the raccoon (rings are too small to draw)', () => {
    const plain = heroFrame(0);
    for (const item of DATA.items) {
      if (item.slot === 'weapon' || item.slot === 'ring') continue;
      const slot = item.slot as GearSlot;
      const sprite = gearSprite(slot, item.id);
      if (sprite) {
        expect(bounds(sprite.buf).w, item.id).toBeGreaterThan(0);
        continue;
      }
      // Clothes are baked into the body: the frame must change.
      const dressed = heroFrame(0, { [slot]: item.id });
      expect(same(dressed, plain), `${item.id} changes the raccoon`).toBe(false);
    }
  });

  it('the hero is Kevin\'s raccoon sheet, with every animation the battle plays', () => {
    checkSheet('raccoon', HERO_SHEET);
    for (const anim of ['idle', 'cheer', 'lie', 'sleep', 'wake']) expect(HERO_SHEET.anims[anim], anim).toBeDefined();
    const b = bounds(frameBuf(HERO_SHEET, 0));
    expect(b.y + b.h - 1, 'feet touch the ground point').toBe(HERO_POINTS.feet.y);
    expect(b.y, 'ears start above the head point').toBeLessThan(HERO_POINTS.head.y);
    expect(alphaAt(frameBuf(HERO_SHEET, 0), HERO_POINTS.hand.x, HERO_POINTS.hand.y), 'the weapon paw is on the art').toBe(255);
  });

  it('worn gear follows the body: standing frames track the head, curled-up frames carry none', () => {
    const o = frameOffsets();
    expect(o).toHaveLength(HERO_SHEET.frames.length);
    expect(o[0]).toEqual({ dx: 0, dy: 0, head: true });
    for (const f of HERO_SHEET.anims.idle.frames) expect(o[f].head, `idle frame ${f}`).toBe(true);
    for (const f of HERO_SHEET.anims.sleep.frames) expect(o[f].head, `sleep frame ${f}`).toBe(false);
  });

  it('every enemy shape the data uses has art; still shapes recolor per world', () => {
    const shapes = new Set(Object.values(DATA.assets.placeholders.enemies).map((e) => e.shape as string));
    for (const shape of shapes) {
      expect(FOE_SHAPES, shape).toContain(shape);
      const look = FOE_SHEETS[shape];
      if (look) {
        checkSheet(shape, look.sheet);
        expect(look.sheet.anims.idle, `${shape} idles`).toBeDefined();
        const a = sheetFrames(look, '#ff0000', '#00ff00');
        expect(a).toHaveLength(look.sheet.frames.length);
        if (look.tint) {
          const b = sheetFrames(look, '#0000ff', '#ffff00');
          expect(same(a[0], b[0]), `${shape} changes with world colors`).toBe(false);
        }
        continue;
      }
      const art = ENEMY_ART[shape as EnemyShape];
      checkRows(shape, art.rows);
      // The ground point may sit between two feet: there must be art on that row close to it.
      const row = art.rows[art.feet.y] ?? '';
      expect(/[^.]/.test(row.slice(Math.max(0, art.feet.x - 4), art.feet.x + 5)), `${shape} feet on the art`).toBe(true);
      const a = recolorEnemy(shape as EnemyShape, '#ff0000', '#00ff00');
      const b = recolorEnemy(shape as EnemyShape, '#0000ff', '#ffff00');
      expect(a.w).toBe(b.w);
      expect(same(a, b), `${shape} changes with world colors`).toBe(false);
    }
  });

  it('pack characters stand on their anchor in their idle pose', () => {
    for (const [shape, look] of Object.entries(FOE_SHEETS)) {
      const s = look.sheet;
      const b = bounds(frameBuf(s, s.anims.idle.frames[0]));
      expect(Math.abs(b.y + b.h - 1 - s.anchor.y), `${shape} feet on the anchor row`).toBeLessThanOrEqual(1);
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
