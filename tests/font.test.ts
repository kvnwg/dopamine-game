import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data';
import { formatNumber, formatPct } from '../src/core';
import { rgb } from '../src/render/pixel/buf';
import {
  CHARSET, FACES, TEXT_INK, fontChars, glyph, gradientRows, lineWidth, linePitch, renderPlate, renderText, stackText, wrapBalanced, wrapText,
  type Face,
} from '../src/render/pixel/font';

const faces = Object.entries(FACES) as Array<[string, Face]>;
const alphas = (px: Uint8ClampedArray) => {
  const s = new Set<number>();
  for (let i = 3; i < px.length; i += 4) s.add(px[i]);
  return s;
};
const colorAt = (b: { w: number; px: Uint8ClampedArray }, x: number, y: number) => {
  const i = (y * b.w + x) * 4;
  return b.px[i + 3] ? [b.px[i], b.px[i + 1], b.px[i + 2]] : null;
};

describe('battle bitmap font', () => {
  it('draws every glyph on the art grid: face-high rows of one width, ink and gaps only, never empty', () => {
    for (const [name, face] of faces) {
      for (const [ch, rows] of Object.entries(face.glyphs)) {
        expect(rows, `${name} ${ch}`).toHaveLength(face.h);
        const w = rows[0].length;
        expect(w, `${name} ${ch} width`).toBeGreaterThan(0);
        for (const row of rows) {
          expect(row.length, `${name} ${ch} rows`).toBe(w);
          expect(/^[#.]+$/.test(row), `${name} ${ch} uses # and . only`).toBe(true);
        }
        expect(rows.join('').includes('#'), `${name} ${ch} has ink`).toBe(true);
      }
    }
    expect(FACES.small.h).toBe(5);
    expect(FACES.big.h).toBe(7);
    expect(FACES.huge.h).toBe(9);
  });

  it('every face draws the same characters: capitals, digits and the battle punctuation', () => {
    const need = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?:'-+×/%·";
    for (const [name, face] of faces) {
      for (const ch of need) expect(face.glyphs[ch], `${name} draws ${ch}`).toBeDefined();
      expect(Object.keys(face.glyphs).sort(), name).toEqual([...CHARSET].sort());
    }
    // Most letters are 3 wide in the small face, 5 in the big one and 7 in the huge one (a few are narrower or wider).
    expect(FACES.small.glyphs.A[0]).toHaveLength(3);
    expect(FACES.big.glyphs.A[0]).toHaveLength(5);
    expect(FACES.huge.glyphs.A[0]).toHaveLength(7);
  });

  it('the huge face is bold: its letters and digits stand on stems two pixels wide', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
      const rows = FACES.huge.glyphs[ch];
      // Every run of ink in the glyph's middle row is at least two pixels wide, except a diagonal's.
      const runs = rows.slice(1, -1).flatMap((r) => r.split('.').filter((x) => x.length > 0).map((x) => x.length));
      const wide = runs.filter((n) => n >= 2).length;
      expect(wide / runs.length, `${ch} is mostly two-pixel strokes`).toBeGreaterThanOrEqual(0.6);
    }
    expect(FACES.huge.glyphs.H).toEqual(['##...##', '##...##', '##...##', '##...##', '#######', '##...##', '##...##', '##...##', '##...##']);
  });

  it('shows lowercase as capitals, folds typographic quotes and dashes, and draws ? for anything else', () => {
    expect(fontChars('Gary, Who’s — ok')).toEqual([...'GARY, WHO\'S - OK']);
    const a = renderText('Count Vinnie', { face: 'small', fill: '#ffffff' });
    const b = renderText('COUNT VINNIE', { face: 'small', fill: '#ffffff' });
    expect(a.px).toEqual(b.px);
    expect(glyph(FACES.small, '@')).toEqual(FACES.small.glyphs['?']);
    expect(glyph(FACES.big, ' ').every((r) => /^\.+$/.test(r))).toBe(true);
  });

  it('every text the battle shows uses only characters the font draws', () => {
    const texts: string[] = [];
    for (const w of DATA.worlds) {
      texts.push(w.name, w.boss.name, ...w.enemies.map((e) => e.name));
      texts.push(`World ${DATA.worlds.length} · ${w.name}`);
    }
    for (const e of DATA.enemies) if (e.special) texts.push(`${e.special.name}!`);
    for (const [k, v] of Object.entries(DATA.strings)) if (k.startsWith('battle.') && k !== 'battle.tryAgain') texts.push(v.replace(/\{\w+\}/g, '2.5'));
    for (const n of [0, 7, 999, 1234, 56789, 1.2e6, 3.4e9, 7.8e12, 5.5e15, 9e20, -42]) texts.push(formatNumber(n), `+${formatNumber(n)}`);
    texts.push(formatPct(0.15), formatPct(12));
    for (const t of texts) {
      for (const ch of fontChars(t)) expect(ch === ' ' || ch in FACES.small.glyphs, `"${ch}" in "${t}"`).toBe(true);
    }
  });

  it('lays out lines: glyph widths plus one-pixel gaps', () => {
    const small = FACES.small;
    expect(lineWidth('A', small)).toBe(3);
    expect(lineWidth('AB', small)).toBe(7);
    expect(lineWidth('1.5K', small)).toBe(3 + 1 + 1 + 1 + 3 + 1 + 3);
    expect(lineWidth('A A', small)).toBe(3 + 1 + small.space + 1 + 3);
    expect(lineWidth('', small)).toBe(0);
    expect(linePitch(FACES.big)).toBe(8);
  });

  it('wraps at spaces within the width, and balances the lines', () => {
    const small = FACES.small;
    const name = 'Guy Who Is Concerned About Powerful Raccoon';
    expect(wrapText(name, small, 1000)).toEqual([name]);
    const lines = wrapText(name, small, 112);
    expect(lines.length).toBe(2);
    for (const l of lines) expect(lineWidth(l, small)).toBeLessThanOrEqual(112);
    const even = wrapBalanced(name, small, 112);
    expect(even).toEqual(['Guy Who Is Concerned', 'About Powerful Raccoon']);
    const spread = (ls: string[]) => Math.max(...ls.map((l) => lineWidth(l, small))) - Math.min(...ls.map((l) => lineWidth(l, small)));
    expect(spread(even)).toBeLessThanOrEqual(spread(lines));
    expect(wrapText('a\nb', small)).toEqual(['a', 'b']);
  });

  it('renders filled glyphs with a one-pixel ink outline, an optional shadow row, and per-row fills', () => {
    const t = renderText('HI', { face: 'big', fill: ['#ff0000', '#00ff00'] });
    expect([t.w, t.h]).toEqual([lineWidth('HI', FACES.big) + 2, 7 + 2]);
    expect([...alphas(t.px)].sort()).toEqual([0, 255]);
    const ink = rgb(TEXT_INK);
    // H's top-left stroke pixel, the row under it, its outline above and the corner diagonally out.
    expect(colorAt(t, 1, 1)).toEqual([255, 0, 0]);
    expect(colorAt(t, 1, 2)).toEqual([0, 255, 0]);
    expect(colorAt(t, 1, 0)).toEqual(ink);
    expect(colorAt(t, 0, 0)).toEqual(ink);
    // Inside the H, away from the strokes: clear.
    expect(colorAt(t, 3, 1)).toBeNull();
    const shadow = renderText('HI', { face: 'big', fill: '#ffffff', shadow: true });
    expect(shadow.h).toBe(t.h + 1);
    expect(colorAt(shadow, 1, shadow.h - 1)).toEqual(ink);
    const bare = renderText('HI', { face: 'small', fill: '#ffffff', ink: null });
    expect([bare.w, bare.h]).toEqual([lineWidth('HI', FACES.small), 5]);
  });

  it('sets a kicker in a smaller face over a title, their outlines sharing a row', () => {
    const style = { face: 'huge', lead: 'big', fill: '#ffffff', shadow: true } as const;
    const card = renderText('World 1\nSunny Suburbs', style);
    const kicker = renderText('World 1', { face: 'big', fill: '#ffffff' });
    const title = renderText('Sunny Suburbs', { face: 'huge', fill: '#ffffff', shadow: true });
    expect(card.w).toBe(Math.max(kicker.w, title.w));
    expect(card.h).toBe(kicker.h + title.h - 1);
    expect(kicker.h).toBe(7 + 2);
    expect(title.h).toBe(9 + 2 + 1);
    // Without a line break, or without a kicker face, it is plain text.
    expect(renderText('Sunny Suburbs', style).px).toEqual(title.px);
    // stackText centers, and opaque pixels win where the parts overlap.
    const a = renderText('A', { face: 'big', fill: '#ff0000' });
    const b = renderText('WIDE', { face: 'big', fill: '#00ff00' });
    const s = stackText([a, b]);
    expect([s.w, s.h]).toEqual([b.w, a.h + b.h - 1]);
    expect(colorAt(s, Math.floor((b.w - a.w) / 2) + 1, 1), "A's top-left stroke, centered").toEqual(colorAt(a, 1, 1));
    expect(colorAt(s, 1, a.h), "the second part's first glyph row").toEqual([0, 255, 0]);
  });

  it('stacks wrapped lines one pitch apart, centered by default', () => {
    const one = renderText('BOSS', { face: 'small', fill: '#ffffff' });
    const two = renderText('BIG BOSS', { face: 'small', fill: '#ffffff', maxW: lineWidth('BOSS', FACES.small) });
    expect(two.h).toBe(one.h + linePitch(FACES.small));
    expect(two.w).toBe(one.w);
  });

  it('makes stepped gradients and notice plates', () => {
    const g = gradientRows('#ffffff', '#000000', 7);
    expect(g).toHaveLength(7);
    expect(new Set(g).size).toBe(3);
    expect(g[0]).toBe('#ffffff');
    expect(g[6]).toBe('#000000');
    const text = renderText('OK', { face: 'small', fill: '#000000', ink: null });
    const plate = renderPlate([text], ['#ffeedd']);
    expect(plate.w).toBe(text.w + 4 * 2 + 2);
    expect(plate.h).toBe(text.h + 2 * 2 + 3);
    expect(colorAt(plate, 0, 0), 'cut corner').toBeNull();
    expect(colorAt(plate, 1, 0)).toEqual(rgb(TEXT_INK));
    expect(colorAt(plate, 2, 2)).toEqual(rgb('#ffeedd'));
  });
});
