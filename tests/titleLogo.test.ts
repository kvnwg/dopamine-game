import { describe, expect, it } from 'vitest';
import { bootArt } from '../src/boot/bootArt';
import { logoArt, playButtonArt } from '../src/render/logoArt';
import { LOGO_GLYPHS, LOGO_H } from '../src/render/logoGlyphs';
import { FEET_ROW } from '../src/render/pixel/sceneryTypes';
import { setTitleShape, TITLE, titleLayout, titleLogo } from '../src/render/titleScene';

const opaque = (b: { w: number; px: Uint8ClampedArray }, x: number, y: number) => b.px[(y * b.w + x) * 4 + 3] > 0;

// The title's logo (drawn letter by letter, a raccoon in the U's trash can) and its PLAY button.
describe('the logo and PLAY', () => {
  it('has a hand-drawn letter for every letter of DUMPSTER LEGEND and PLAY, each LOGO_H rows of even width', () => {
    for (const ch of 'DUMPSTERLEGENDPLAY') {
      const rows = LOGO_GLYPHS[ch];
      expect(rows, ch).toBeDefined();
      expect(rows).toHaveLength(LOGO_H);
      expect(new Set(rows.map((r) => r.length)).size, ch).toBe(1);
      expect(rows.join('')).toMatch(/^[#.]+$/);
    }
  });

  it('puts the raccoon in the can, a crown on him, and every piece inside the logo', () => {
    const art = logoArt();
    expect(art.pieces.filter((p) => p.kind === 'letter')).toHaveLength(14);
    expect(art.pieces.filter((p) => p.kind === 'coon')).toHaveLength(1);
    expect(art.pieces.some((p) => p.rides)).toBe(true);
    for (const p of art.pieces) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.buf.w).toBeLessThanOrEqual(art.buf.w);
      expect(p.y + p.buf.h).toBeLessThanOrEqual(art.buf.h);
    }
    // Four raccoon frames (rest, blink, looking left and right), all the same size.
    expect(art.coon).toHaveLength(4);
    expect(new Set(art.coon.map((f) => `${f.w}x${f.h}`)).size).toBe(1);
  });

  it('fits the phone title and the PC title, PLAY under or beside the logo, clear of the raccoon walking below', () => {
    for (const wide of [false, true]) {
      setTitleShape(wide);
      const { logo, button } = titleLayout('PLAY');
      for (const box of [logo, button]) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.w).toBeLessThanOrEqual(TITLE.w);
      }
      const apart = button.y >= logo.y + logo.h || button.x >= logo.x + logo.w;
      expect(apart).toBe(true);
      // The raccoon's head is about 20 rows above his feet.
      const heroTop = FEET_ROW + TITLE.drop - 20;
      expect(Math.max(logo.y + logo.h, button.y + button.h)).toBeLessThan(heroTop);
    }
    setTitleShape(false);
  });

  it('a PLAY the logo letters can\'t spell (a translation) is lettered in the pixel font', () => {
    expect(playButtonArt('PLAY').letters).toHaveLength(4);
    const other = playButtonArt('JOUER');
    expect(other.letters).toHaveLength(1);
    expect(other.w).toBeGreaterThan(other.letters[0].buf.w);
  });

  it('the loading screen shows exactly the logo the title rests on (so the glide lands without a jump)', () => {
    const boot = bootArt().logo;
    const title = titleLogo();
    expect([boot.w, boot.h]).toEqual([title.w, title.h]);
    expect(Buffer.from(boot.px).equals(Buffer.from(title.px))).toBe(true);
    // A sticker backing: no holes inside the logo's outline.
    let holes = 0;
    for (let y = 1; y < title.h - 1; y++) {
      for (let x = 1; x < title.w - 1; x++) {
        if (!opaque(title, x, y) && opaque(title, x - 1, y) && opaque(title, x + 1, y) && opaque(title, x, y - 1) && opaque(title, x, y + 1)) holes++;
      }
    }
    expect(holes).toBe(0);
  });
});
