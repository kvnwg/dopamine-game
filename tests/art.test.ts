import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data';
import { alphaAt, bounds, checkRows, fromRows, toHex, type PixelBuf } from '../src/render/pixel/buf';
import { CHARACTER_OUTLINE } from '../src/render/pixel/palette';
import { ATTACK_FPS, CAST_COLORS, ENEMY_ART, ENEMY_SHEETS, checkArt, recolorEnemy, type EnemyShape } from '../src/render/pixel/enemies';
import { FOE_SHAPES, FOE_SHEETS, sheetFrames } from '../src/render/pixel/foes';
import { HERO_POINTS, HERO_SHEET, frameOffsets, gearSprite, heroFrame, weaponBuf, type GearSlot } from '../src/render/pixel/hero';
import { checkSheet, frameBuf, type AnimSheet } from '../src/render/pixel/indexed';
import { ITEM_SPRITES, WEAPON_GRIP } from '../src/render/pixel/items';
import { BUNNY, COW, DUCK, HEN, PIG, RAM } from '../src/render/pixel/packs/farm';
import { LAYERS, TILE_W, farLayer, fgLayer, groundLayer, midLayer } from '../src/render/pixel/scenery';
import { FX, UI_SPRITES } from '../src/render/pixel/ui';

const same = (a: { px: Uint8ClampedArray }, b: { px: Uint8ClampedArray }) => Buffer.from(a.px).equals(Buffer.from(b.px));

/** When a foe's lunge lands its blow (BattleScene lungeAt), in ms from the start of its attack. */
const CONTACT_MS = 170;

/** How far a frame's art reaches toward the hero (its leftmost column, from the anchor) and whether it stands on the feet row. */
function reachOf(s: AnimSheet, f: number): { left: number; grounded: boolean } {
  const b = frameBuf(s, f);
  let left = Infinity;
  let grounded = false;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (!b.px[(y * b.w + x) * 4 + 3]) continue;
      left = Math.min(left, x - s.anchor.x);
      if (y === s.anchor.y) grounded = true;
    }
  }
  return { left, grounded };
}

/**
 * An attack drawn pose by pose and timed to the lunge: a wind-up away from the hero, the smear while it
 * darts in, the blow showing when it lands (its farthest reach, well past where the foe stands) and held,
 * then back to its standing pose, feet on the ground throughout, in at most 500 ms.
 */
function expectAttack(name: string, s: AnimSheet): void {
  const a = s.anims.attack;
  const ms = 1000 / a.fps;
  const at = (t: number) => a.frames[Math.floor(t / ms)];
  const reach = (f: number) => reachOf(s, f).left;
  expect(a.loop, name).toBe(false);
  expect(a.frames.length * ms, `${name} plays in at most 500 ms`).toBeLessThanOrEqual(500);
  const [windup, smear, blow] = [at(100), at(140), at(CONTACT_MS)];
  expect(new Set([windup, smear, blow]).size, `${name}: wind-up, smear and blow are three poses`).toBe(3);
  for (const f of a.frames) expect(reach(f), `${name} frame ${f} reaches no further than the blow`).toBeGreaterThanOrEqual(reach(blow));
  const standing = reach(s.anims.idle.frames[0]);
  expect(standing - reach(blow), `${name} strikes well past where it stands`).toBeGreaterThanOrEqual(3);
  expect(reach(windup) - reach(blow), `${name} winds up away from the blow`).toBeGreaterThanOrEqual(3);
  expect(a.frames.filter((f) => f === blow).length * ms, `${name} holds the blow`).toBeGreaterThanOrEqual(100);
  expect(Math.abs(reach(a.frames[a.frames.length - 1]) - standing), `${name} settles back`).toBeLessThanOrEqual(1);
  for (const f of a.frames) expect(reachOf(s, f).grounded, `${name} frame ${f} keeps its feet on the ground`).toBe(true);
}

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

  it('every hand-drawn enemy is an animated sheet in the world\'s colors, outlined in the raccoon\'s brown in every frame', () => {
    for (const shape of Object.keys(ENEMY_ART) as EnemyShape[]) checkArt(shape);
    for (const [shape, s] of Object.entries(ENEMY_SHEETS)) {
      const look = FOE_SHEETS[shape];
      expect(look?.sheet, `${shape} plays its own sheet`).toBe(s.sheet);
      checkSheet(shape, s.sheet);
      expect(s.sheet.faces, shape).toBe('left');
      for (const anim of ['idle', 'walk', 'attack', 'hurt']) expect(s.sheet.anims[anim], `${shape} ${anim}`).toBeDefined();
      expect(s.sheet.anims.attack.loop || s.sheet.anims.hurt.loop, `${shape} attack and hurt play once`).toBe(false);
      const a = sheetFrames(look, '#7A6A72', '#E53935');
      const b = sheetFrames(look, '#2B4C7E', '#F2C14E');
      expect(same(a[0], b[0]), `${shape} changes with world colors`).toBe(false);
      a.forEach((buf, f) => {
        // An edge pixel has open space beside, above or below it (the feet stand on the bottom row).
        const open = (x: number, y: number) => x >= 0 && y >= 0 && x < buf.w && y < buf.h && !buf.px[(y * buf.w + x) * 4 + 3];
        for (let y = 0; y < buf.h; y++) {
          for (let x = 0; x < buf.w; x++) {
            const i = (y * buf.w + x) * 4;
            if (!buf.px[i + 3] || !(open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1))) continue;
            expect(toHex(buf.px[i], buf.px[i + 1], buf.px[i + 2]), `${shape} frame ${f} edge at ${x},${y}`).toBe(CHARACTER_OUTLINE);
          }
        }
      });
    }
  });

  it('every hand-drawn enemy has 13 poses on one palette: outline, the world\'s body and accent ramps, then fixed cast colors', () => {
    for (const [shape, s] of Object.entries(ENEMY_SHEETS)) {
      // Standing, breathing, blinking, two steps; the attack's six (frames 5 to 10); the flinch's two.
      expect(s.sheet.frames, shape).toHaveLength(13);
      expect([...new Set(s.sheet.anims.attack.frames)], `${shape} attack poses`).toEqual([5, 6, 7, 8, 9, 10]);
      expect(s.sheet.anims.attack.fps, shape).toBe(ATTACK_FPS);
      expect(s.sheet.anims.hurt.frames, `${shape} flinch`).toEqual([11, 12]);
      expect([s.body, s.accent], shape).toEqual([[1, 2, 3], [4, 5, 6]]);
      expect(s.sheet.pal[0], shape).toBe(CHARACTER_OUTLINE);
      const fixed = new Set(Object.values(CAST_COLORS));
      for (const c of s.sheet.pal.slice(7)) expect(fixed.has(c), `${shape} ${c} is a cast color`).toBe(true);
    }
  });

  it('the hand-drawn cast and the farm animals attack in drawn poses timed to the lunge', () => {
    const sheets: Record<string, AnimSheet> = { ...Object.fromEntries(Object.entries(ENEMY_SHEETS).map(([k, v]) => [k, v.sheet])), HEN, DUCK, BUNNY, RAM, PIG, COW };
    expect(Object.keys(sheets)).toHaveLength(16);
    for (const [name, s] of Object.entries(sheets)) expectAttack(name, s);
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

  it('every pack character is outlined in the raccoon hero\'s brown', () => {
    const edge = (b: PixelBuf) => {
      const counts = new Map<string, number>();
      for (let y = 0; y < b.h; y++) {
        for (let x = 0; x < b.w; x++) {
          const i = (y * b.w + x) * 4;
          if (!b.px[i + 3]) continue;
          const open = (xx: number, yy: number) => xx < 0 || yy < 0 || xx >= b.w || yy >= b.h || !b.px[(yy * b.w + xx) * 4 + 3];
          if (!(open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1))) continue;
          const c = toHex(b.px[i], b.px[i + 1], b.px[i + 2]);
          counts.set(c, (counts.get(c) ?? 0) + 1);
        }
      }
      return [...counts].sort((a, b2) => b2[1] - a[1])[0][0];
    };
    for (const [shape, look] of Object.entries(FOE_SHEETS)) {
      const frames = sheetFrames(look, '#7A6A72', '#E53935');
      expect(edge(frames[look.sheet.anims.idle?.frames[0] ?? 0]), shape).toBe(CHARACTER_OUTLINE);
    }
  });
});
