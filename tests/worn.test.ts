import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data';
import { alphaAt, color, toHex } from '../src/render/pixel/buf';
import { HERO_SHEET, composeHero, gearSprite, handOffsets, heroFrame, weaponBuf } from '../src/render/pixel/hero';
import { frameBuf } from '../src/render/pixel/indexed';
import { FRAME_COUNT, partAt, pose } from '../src/render/pixel/worn/body';
import { ALL_FRAMES, H, OUTLINE, W, WEAPONS, WORN, bare, paletteOf, wornPixels, type WornSlot } from '../src/render/pixel/worn/dress';

const wearable = DATA.items.filter((it) => it.slot !== 'ring' && it.slot !== 'weapon');
const weapons = DATA.items.filter((it) => it.slot === 'weapon');

describe('worn gear', () => {
  it('every wearable item has worn art drawn for the raccoon, and every weapon is redrawn at his size', () => {
    for (const it of wearable) expect(WORN[it.slot as WornSlot]?.[it.id], it.id).toBeDefined();
    for (const it of weapons) expect(WEAPONS[it.id], it.id).toBeDefined();
    // No art for items that don't exist (a typo would never show).
    const ids = new Set(DATA.items.map((it) => it.id));
    for (const slot of Object.keys(WORN) as WornSlot[]) {
      for (const id of Object.keys(WORN[slot])) {
        expect(ids.has(id), `${slot} art for unknown item ${id}`).toBe(true);
        expect(DATA.items.find((it) => it.id === id)?.slot, id).toBe(slot);
      }
    }
    for (const id of Object.keys(WEAPONS)) expect(ids.has(id), `weapon art for unknown item ${id}`).toBe(true);
  });

  it('the hand-measured body parts cover exactly the raccoon in every frame', () => {
    expect(FRAME_COUNT).toBe(HERO_SHEET.frames.length);
    for (const f of ALL_FRAMES) {
      const b = frameBuf(HERO_SHEET, f);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          expect(!!partAt(f, x, y), `frame ${f} pixel ${x},${y}`).toBe(alphaAt(b, x, y) > 0);
        }
      }
      const p = pose(f);
      // Landmarks sit on the body part they name.
      if (p.hand) expect(['p', 'f', 'x', 'h'], `frame ${f} hand`).toContain(partAt(f, p.hand.x, p.hand.y));
      if (p.offHand) expect(['q', 'k', 'b', 't'], `frame ${f} back paw`).toContain(partAt(f, p.offHand.x, p.offHand.y));
      for (const foot of p.feet) if (foot) expect(['o', 'l'], `frame ${f} foot`).toContain(partAt(f, foot.x, foot.y));
      if (p.neck) expect(['n', 'b'], `frame ${f} neck`).toContain(partAt(f, p.neck.x, p.neck.y));
    }
  });

  it('worn art uses only its own palette and the characters\' outline', () => {
    for (const it of wearable) {
      const slot = it.slot as WornSlot;
      const allowed = paletteOf(WORN[slot][it.id].pal);
      expect(allowed.has(OUTLINE)).toBe(true);
      for (const f of ALL_FRAMES) {
        const w = wornPixels(slot, it.id, f);
        for (const p of [...w.back, ...w.front]) expect(allowed.has(p.c.toLowerCase()), `${it.id} frame ${f} color ${p.c}`).toBe(true);
      }
    }
    for (const it of weapons) {
      const a = WEAPONS[it.id];
      const allowed = paletteOf(a.pal);
      const b = weaponBuf(it.id)!.buf;
      for (let i = 0; i < b.px.length; i += 4) {
        if (b.px[i + 3]) expect(allowed.has(toHex(b.px[i], b.px[i + 1], b.px[i + 2])), it.id).toBe(true);
      }
      for (const key of Object.keys(a.pal)) expect(() => color(a.pal[key]), `${it.id} ${key}`).not.toThrow();
    }
  });

  it('every piece stays inside the frame in every pose, and nothing goes below his feet', () => {
    const ground = HERO_SHEET.anchor.y;
    for (const it of wearable) {
      const slot = it.slot as WornSlot;
      for (const f of ALL_FRAMES) {
        const w = wornPixels(slot, it.id, f);
        for (const p of [...w.back, ...w.front]) {
          const where = `${it.id} frame ${f} at ${p.x},${p.y}`;
          expect(p.x >= 0 && p.x < W && p.y >= 0 && p.y < H, where).toBe(true);
          expect(p.y <= ground, `${where} is below the ground row`).toBe(true);
        }
      }
    }
  });

  it('each item shows on the reference pose and wherever its body part shows', () => {
    for (const it of wearable) {
      const slot = it.slot as WornSlot;
      expect(wornPixels(slot, it.id, 0).front.length, `${it.id} on frame 0`).toBeGreaterThan(0);
      for (const f of ALL_FRAMES) {
        const p = pose(f);
        const w = wornPixels(slot, it.id, f);
        const n = w.front.length + w.back.length;
        // Bling hangs on his chest: the dash's swing trail may hide it, so only frames that show his chest count.
        const chest = !!p.neck && [1, 2].some((dy) => partAt(f, p.neck!.x, p.neck!.y + dy) === 'b');
        const shown =
          slot === 'hat' ? !!p.head : slot === 'mask' ? !!p.face : slot === 'gloves' ? !!(p.hand || p.offHand)
          : slot === 'sneakers' ? !!(p.feet[0] || p.feet[1]) : slot === 'shield' ? !!p.offHand
          : slot === 'jacket' ? true : WORN.bling[it.id]?.wrist ? !!p.hand : chest;
        if (shown) expect(n, `${it.id} frame ${f}`).toBeGreaterThan(0);
      }
    }
  });

  it('garments only paint his body, masks stay on his head, and clothes keep his face', () => {
    for (const it of wearable) {
      const slot = it.slot as WornSlot;
      for (const f of ALL_FRAMES) {
        const raccoon = bare(f);
        if (slot === 'jacket') {
          // Painted pixels lie on his torso, arms or hips (a cape's hanging part is its back pixels).
          for (const p of wornPixels('jacket', it.id, f).front) expect(['n', 'b', 'f', 'k', 'l'], `${it.id} frame ${f} at ${p.x},${p.y}`).toContain(partAt(f, p.x, p.y));
        }
        if (slot === 'mask' && !WORN.mask[it.id].free) {
          for (const p of wornPixels('mask', it.id, f).front) expect(partAt(f, p.x, p.y), `${it.id} frame ${f}`).toBe('h');
        }
        if (slot !== 'hat' && slot !== 'mask') {
          // Below the hats and masks, his eyes always show.
          for (const p of wornPixels(slot, it.id, f).front) {
            const i = (p.y * raccoon.w + p.x) * 4;
            const eye = !!raccoon.px[i + 3] && toHex(raccoon.px[i], raccoon.px[i + 1], raccoon.px[i + 2]) === HERO_SHEET.pal[0];
            expect(eye && partAt(f, p.x, p.y) === 'h', `${it.id} covers an eye in frame ${f}`).toBe(false);
          }
        }
      }
    }
  });

  it('weapons are sized to him, lean like the scene expects and have their grip on the art', () => {
    for (const it of weapons) {
      const w = weaponBuf(it.id)!;
      expect(alphaAt(w.buf, w.grip.x, w.grip.y), `${it.id} grip`).toBe(255);
      expect(Math.max(w.buf.w, w.buf.h), `${it.id} size`).toBeLessThanOrEqual(13);
      expect(Math.max(w.buf.w, w.buf.h), `${it.id} size`).toBeGreaterThanOrEqual(8);
      expect([0, 45], it.id).toContain(w.tilt);
    }
  });

  it('the weapon stays in his front paw and gear shows only while his head does', () => {
    const o = handOffsets();
    expect(o[0]).toEqual({ dx: 0, dy: 0, head: true });
    for (const f of ALL_FRAMES) {
      const p = pose(f);
      expect(o[f].head, `frame ${f}`).toBe(!!p.head);
      if (p.hand && p.head) expect({ x: pose(0).hand!.x + o[f].dx, y: pose(0).hand!.y + o[f].dy }, `frame ${f}`).toEqual({ x: p.hand.x, y: p.hand.y });
    }
  });

  it('hats, masks, shields and packs are their own sprites; clothes are painted into every body frame', () => {
    for (const it of wearable) {
      const slot = it.slot as WornSlot;
      const sprite = gearSprite(slot, it.id);
      if (['hat', 'mask', 'shield', 'backpack'].includes(slot)) {
        expect(sprite, it.id).not.toBeNull();
        expect(sprite!.buf.w, it.id).toBe(W);
      } else {
        expect(sprite, it.id).toBeNull();
        const plain = heroFrame(0);
        const dressed = heroFrame(0, { [slot]: it.id });
        expect(Buffer.from(dressed.px).equals(Buffer.from(plain.px)), `${it.id} changes the body`).toBe(false);
      }
    }
    // Outline color sanity: the raccoon's own outline is the characters' brown.
    expect(HERO_SHEET.pal[1]).toBe(OUTLINE);
    // A preview with everything on still works.
    const all = Object.fromEntries(DATA.items.map((it) => [it.slot, it.id]));
    for (const f of ALL_FRAMES) expect(composeHero(f, all).w, `frame ${f}`).toBe(W + 20);
  });
});
