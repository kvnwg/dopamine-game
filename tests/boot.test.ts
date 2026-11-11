import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bootArt, bootHtml, splashImage } from '../src/boot/bootArt';
import { HERO_WALK } from '../src/render/pixel/hero';

const opaque = (b: { w: number; px: Uint8ClampedArray }, x: number, y: number) => b.px[(y * b.w + x) * 4 + 3] > 0;

// The loading screen (in the page before the game's script) and the apps' splash art.
describe('loading screen', () => {
  it('src/boot/boot.html matches the game art (run npm run boot-art after changing it)', () => {
    expect(readFileSync('src/boot/boot.html', 'utf8')).toBe(bootHtml());
  });

  it('needs nothing from outside the page: its pictures are data URLs', () => {
    const html = bootHtml();
    expect(html).toContain('id="boot"');
    expect(html).not.toMatch(/url\((?!data:)/);
    expect(html).not.toMatch(/src="(?!data:)/);
    expect(html.length).toBeLessThan(40_000);
  });

  it('shows the logo, the walk in its playing order, the street and four joke lines', () => {
    const a = bootArt();
    expect(a.walk.w).toBe(a.frame.w * HERO_WALK.frames.length);
    expect(a.lines).toHaveLength(4);
    expect(a.logo.w).toBeGreaterThan(100);
    // His feet land on the sidewalk, inside the strip.
    expect(a.streetFeet).toBeGreaterThan(0);
    expect(a.streetFeet).toBeLessThan(a.street.h);
  });

  it('cuts the lampposts out of the street: little stands above the curb', () => {
    const { street } = bootArt();
    let top = 0;
    for (let x = 0; x < street.w; x++) if (opaque(street, x, 0)) top++;
    expect(top / street.w).toBeLessThan(0.3);
  });

  it("Android's splash icon keeps the raccoon inside the circle the system shows (192 of 288 dp)", () => {
    const size = 288;
    const img = splashImage(size, size, { art: 'hero', scale: 6, bg: null });
    const r = 96;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!opaque(img, x, y)) continue;
        expect(Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2)).toBeLessThan(r);
      }
    }
  });
});
