/**
 * The DUMPSTER LEGEND logo, drawn like a sign painter would: fat, round letters that each lean and
 * bob their own way, glossy as candy, standing on a chunky drop of their own color.
 *   - DUMPSTER is dumpster green and jostled, as if the letters were tossed in a heap. Its U is a
 *     trash can, and the raccoon peeks out of it in a little gold crown.
 *   - LEGEND is gold, its letters lined up on a gentle arch, with sparkles.
 *   - A banana peel hangs off the R.
 * The title draws it piece by piece (each letter, the raccoon) so they can move on their own; the
 * loading screen and the apps' splash use it whole (logoArt().buf). Pure buffers: it builds in Node
 * too. One buffer pixel is one art pixel.
 */
import { blank, rgb, scale2x, type PixelBuf } from './pixel/buf';
import { renderText } from './pixel/font';
import { LOGO_GLYPHS, LOGO_H } from './logoGlyphs';

/** A shape: which pixels are in it. */
interface Mask {
  w: number;
  h: number;
  on: Uint8Array;
}

const INK = '#1a1326';

function maskOf(rows: readonly string[]): Mask {
  const w = Math.max(...rows.map((r) => r.length));
  const m: Mask = { w, h: rows.length, on: new Uint8Array(w * rows.length) };
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (r[x] === '#') m.on[y * w + x] = 1;
  });
  return m;
}

const at = (m: Mask, x: number, y: number) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.on[y * m.w + x] === 1;

/**
 * `m` turned `deg` degrees (clockwise, around its middle) without losing or doubling a pixel: three
 * shears, each moving whole rows or columns (Paeth). The result is padded to hold it.
 */
export function rotateMask(m: Mask, deg: number): Mask {
  if (!deg) return m;
  const a = (deg * Math.PI) / 180;
  const sh = -Math.tan(a / 2);
  const sv = Math.sin(a);
  const pad = Math.ceil(Math.max(m.w, m.h) * Math.abs(Math.sin(a))) + 2;
  const W = m.w + 2 * pad;
  const H = m.h + 2 * pad;
  const cx = W / 2;
  const cy = H / 2;
  let pts: Array<[number, number]> = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (at(m, x, y)) pts.push([x + pad, y + pad]);
  const shearX = (p: Array<[number, number]>) => p.map(([x, y]) => [x + Math.round(sh * (y + 0.5 - cy)), y] as [number, number]);
  const shearY = (p: Array<[number, number]>) => p.map(([x, y]) => [x, y + Math.round(sv * (x + 0.5 - cx))] as [number, number]);
  pts = shearX(shearY(shearX(pts)));
  const out: Mask = { w: W, h: H, on: new Uint8Array(W * H) };
  for (const [x, y] of pts) if (x >= 0 && y >= 0 && x < W && y < H) out.on[y * W + x] = 1;
  return trim(out);
}

/** `m` cut down to its pixels. */
function trim(m: Mask): Mask {
  let x0 = m.w;
  let y0 = m.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      if (!at(m, x, y)) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return { w: 0, h: 0, on: new Uint8Array(0) };
  const out: Mask = { w: x1 - x0 + 1, h: y1 - y0 + 1, on: new Uint8Array((x1 - x0 + 1) * (y1 - y0 + 1)) };
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.on[(y - y0) * out.w + (x - x0)] = m.on[y * m.w + x];
  return out;
}

/** A letter's paint: its face top to bottom, the edge light and shade, its gloss, and the drop under it. */
export interface Material {
  face: readonly string[];
  light: string;
  shade: string;
  gloss: string;
  drop: readonly [string, string];
}

export const GREEN: Material = {
  face: ['#d6ff8a', '#a8ec5a', '#7dd648', '#5cbc3c', '#45a238'],
  light: '#eaffb4',
  shade: '#2f7d2e',
  gloss: '#ffffff',
  drop: ['#256b2c', '#174a22'],
};

export const GOLD: Material = {
  face: ['#fff6c2', '#ffe47a', '#ffc93a', '#ffaa1e', '#f48a16'],
  light: '#fffbe6',
  shade: '#c45c12',
  gloss: '#ffffff',
  drop: ['#b04a16', '#7c2c10'],
};

/** How deep the drop under each letter is (art px). */
const DROP = 3;

/** One letter, painted: its picture, and where its face's top left sits in it. */
export interface LetterArt {
  buf: PixelBuf;
  /** The face's top-left corner inside `buf` (the outline and the drop take the rest). */
  ox: number;
  oy: number;
  /** The face's size. */
  w: number;
  h: number;
}

function put(b: PixelBuf, x: number, y: number, hex: string) {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
  const [r, g, bl] = rgb(hex);
  const i = (y * b.w + x) * 4;
  b.px[i] = r;
  b.px[i + 1] = g;
  b.px[i + 2] = bl;
  b.px[i + 3] = 255;
}

/**
 * A letter shape painted in `mat`: banded face with a light top-left edge and a shaded bottom-right
 * one, a gloss mark on its upper left, a one-pixel ink outline, and under it a drop of DROP rows in the
 * material's dark tones, outlined too.
 */
export function paintLetter(m: Mask, mat: Material): LetterArt {
  const pad = 1;
  const W = m.w + 2 * pad;
  const H = m.h + 2 * pad + DROP;
  const b = blank(W, H);
  const face = (x: number, y: number) => at(m, x - pad, y - pad);
  // The drop: the face moved down 1..DROP rows, its near half lighter.
  const dropAt = (x: number, y: number) => {
    for (let d = 1; d <= DROP; d++) if (face(x, y - d)) return d;
    return 0;
  };
  const solid = (x: number, y: number) => face(x, y) || dropAt(x, y) > 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (face(x, y)) continue;
      const d = dropAt(x, y);
      if (d) put(b, x, y, d <= 1 ? mat.drop[0] : mat.drop[1]);
      else if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) put(b, x, y, INK);
    }
  }
  // The outline between the face and its own drop: the face's bottom edge.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!face(x, y) && face(x, y - 1)) put(b, x, y, INK);
  // The face: bands by row, light along the top and left edges, shade along the bottom and right.
  const n = mat.face.length;
  for (let y = 0; y < m.h; y++) {
    const band = mat.face[Math.min(n - 1, Math.floor((y / m.h) * n))];
    for (let x = 0; x < m.w; x++) {
      if (!at(m, x, y)) continue;
      let c = band;
      if (!at(m, x, y + 1) || !at(m, x + 1, y)) c = mat.shade;
      if (!at(m, x, y - 1) || (!at(m, x - 1, y) && y < m.h * 0.6)) c = mat.light;
      put(b, x + pad, y + pad, c);
    }
  }
  // Gloss: a short stroke and a dot just inside the top left of the first stem or bowl.
  let gx = -1;
  let gy = -1;
  for (let y = 0; y < m.h && gx < 0; y++) {
    for (let x = 0; x < m.w; x++) {
      if (at(m, x, y) && at(m, x + 1, y + 1) && at(m, x + 2, y + 1) && at(m, x + 1, y + 2)) {
        gx = x;
        gy = y;
        break;
      }
    }
  }
  if (gx >= 0) {
    for (const [dx, dy] of [[1, 1], [2, 1], [1, 2], [1, 3]] as const) if (at(m, gx + dx, gy + dy)) put(b, gx + dx + pad, gy + dy + pad, mat.gloss);
  }
  return { buf: b, ox: pad, oy: pad, w: m.w, h: m.h };
}

/** A letter's mask: the hand-drawn glyph (logoGlyphs.ts), turned `deg` degrees. */
export function letterMask(ch: string, deg = 0): Mask {
  const rows = LOGO_GLYPHS[ch];
  if (!rows) throw new Error(`No logo glyph for "${ch}"`);
  return rotateMask(maskOf(rows), deg);
}

export { LOGO_H };

// ---------------------------------------------------------------------------------- the pieces

/** A sprite from rows of keys into `colors` ('.' is clear). */
function sprite(rows: readonly string[], colors: Readonly<Record<string, string>>): PixelBuf {
  const w = Math.max(...rows.map((r) => r.length));
  const b = blank(w, rows.length);
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const c = colors[r[x]];
      if (c) put(b, x, y, c);
    }
  });
  return b;
}

/** `b` turned `deg` degrees clockwise, every pixel moved whole (the three shears of rotateMask). */
function rotateBuf(b: PixelBuf, deg: number): PixelBuf {
  if (!deg) return b;
  const a = (deg * Math.PI) / 180;
  const sh = -Math.tan(a / 2);
  const sv = Math.sin(a);
  const pad = Math.ceil(Math.max(b.w, b.h) * Math.abs(Math.sin(a))) + 2;
  const W = b.w + 2 * pad;
  const H = b.h + 2 * pad;
  const cx = W / 2;
  const cy = H / 2;
  const out = blank(W, H);
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const i = (y * b.w + x) * 4;
      if (!b.px[i + 3]) continue;
      let px = x + pad;
      let py = y + pad;
      px += Math.round(sh * (py + 0.5 - cy));
      py += Math.round(sv * (px + 0.5 - cx));
      px += Math.round(sh * (py + 0.5 - cy));
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      out.px.set(b.px.subarray(i, i + 4), (py * W + px) * 4);
    }
  }
  return trimBuf(out);
}

/** `b` cut down to its pixels. */
function trimBuf(b: PixelBuf): PixelBuf {
  let x0 = b.w;
  let y0 = b.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (!b.px[(y * b.w + x) * 4 + 3]) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return blank(0, 0);
  const out = blank(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) out.px.set(b.px.subarray((y * b.w + x0) * 4, (y * b.w + x1 + 1) * 4), (y - y0) * out.w * 4);
  return out;
}

/** `b` with a one-pixel `color` outline around its shape (it grows a pixel on every side). */
function outlined(b: PixelBuf, color = INK): PixelBuf {
  const out = blank(b.w + 2, b.h + 2);
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < b.w && y < b.h && b.px[(y * b.w + x) * 4 + 3] > 0;
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      if (solid(x - 1, y - 1)) {
        const i = ((y - 1) * b.w + x - 1) * 4;
        out.px.set(b.px.subarray(i, i + 4), (y * out.w + x) * 4);
      } else if (solid(x - 2, y - 1) || solid(x, y - 1) || solid(x - 1, y - 2) || solid(x - 1, y)) put(out, x, y, color);
    }
  }
  return out;
}

/** Draws `src` onto `dst` at (x, y), over what is there. */
function over(dst: PixelBuf, src: PixelBuf, x: number, y: number) {
  for (let sy = 0; sy < src.h; sy++) {
    const dy = y + sy;
    if (dy < 0 || dy >= dst.h) continue;
    for (let sx = 0; sx < src.w; sx++) {
      const dx = x + sx;
      if (dx < 0 || dx >= dst.w) continue;
      const i = (sy * src.w + sx) * 4;
      if (!src.px[i + 3]) continue;
      dst.px.set(src.px.subarray(i, i + 4), (dy * dst.w + dx) * 4);
    }
  }
}

/** The raccoon's colors: the hero's own (pixel/hero.ts). */
const COON = { A: '#32282b', B: '#806657', C: '#b29d8e', D: '#483429', w: '#ffffff', k: '#0b0b22', n: '#1a1326', p: '#c9917f' } as const;

/**
 * The raccoon peeking out of the can, front on: at rest, blinking, looking left, looking right. His
 * paws grip the rim (the can's walls are 4 px wide, its mouth 10).
 */
const COON_FRAMES: ReadonlyArray<readonly string[]> = [
  [
    '.AA..........AA.',
    'ApBA........ABpA',
    'AppBAAAAAAAABppA',
    'ABBBBBBBBBBBBBBA',
    'ABBCCCBBBBCCCBBA',
    'ABDDDDDBBDDDDDBA',
    'ADDwwwDDDDwwwDDA',
    'ADDwkwDDDDwkwDDA',
    'ADDwkwDCCDwkwDDA',
    'ABDDDDCCCCDDDDBA',
    '.ABBCCCnnCCCBBA.',
    '..ABBCCCCCCBBA..',
    '...AAAAAAAAAA...',
  ],
  [
    '.AA..........AA.',
    'ApBA........ABpA',
    'AppBAAAAAAAABppA',
    'ABBBBBBBBBBBBBBA',
    'ABBCCCBBBBCCCBBA',
    'ABDDDDDBBDDDDDBA',
    'ADDDDDDDDDDDDDDA',
    'ADDDDDDDDDDDDDDA',
    'ADDkkkDCCDkkkDDA',
    'ABDDDDCCCCDDDDBA',
    '.ABBCCCnnCCCBBA.',
    '..ABBCCCCCCBBA..',
    '...AAAAAAAAAA...',
  ],
  [
    '.AA..........AA.',
    'ApBA........ABpA',
    'AppBAAAAAAAABppA',
    'ABBBBBBBBBBBBBBA',
    'ABBCCCBBBBCCCBBA',
    'ABDDDDDBBDDDDDBA',
    'ADDwwwDDDDwwwDDA',
    'ADDkkwDDDDkkwDDA',
    'ADDkkwDCCDkkwDDA',
    'ABDDDDCCCCDDDDBA',
    '.ABBCCCnnCCCBBA.',
    '..ABBCCCCCCBBA..',
    '...AAAAAAAAAA...',
  ],
  [
    '.AA..........AA.',
    'ApBA........ABpA',
    'AppBAAAAAAAABppA',
    'ABBBBBBBBBBBBBBA',
    'ABBCCCBBBBCCCBBA',
    'ABDDDDDBBDDDDDBA',
    'ADDwwwDDDDwwwDDA',
    'ADDwwkDDDDwwkDDA',
    'ADDwwkDCCDwwkDDA',
    'ABDDDDCCCCDDDDBA',
    '.ABBCCCnnCCCBBA.',
    '..ABBCCCCCCBBA..',
    '...AAAAAAAAAA...',
  ],
];
/** His paws hooked over the rim. */
const PAWS = ['.A.A.A.', 'ABACACA', 'ACCCCCA', '.AAAAA.'];

/** The little crown he wears (gold, a red gem in the middle). */
const CROWN = [
  'y...y...y',
  'yy.yYy.yy',
  'yyyyyyyyy',
  'YyRyyyRyY',
  'ooooooooo',
];
const CROWN_COLORS = { y: '#ffd84a', Y: '#fff3a6', R: '#e8324a', o: '#d9921c' } as const;

/** A fish skeleton, tossed onto the R. */
const BONE = [
  '...WW...W.W.W....W',
  '.WWWWW..W.W.W...WW',
  'WWkWWWWWWWWWWWWWWW',
  '.WWWWW..W.W.W...WW',
  '...WW...W.W.W....W',
];
const BONE_COLORS = { W: '#f4efe1', k: '#1a1326' } as const;

/** A piece of the logo, placed in its buffer: a letter (`line`, `index`), the raccoon, or a trimming. */
export interface LogoPiece {
  kind: 'letter' | 'coon' | 'deco';
  buf: PixelBuf;
  x: number;
  y: number;
  line?: 0 | 1;
  index?: number;
  /** It sits on the raccoon's head (his crown): it ducks with him. */
  rides?: boolean;
}

export interface LogoArt {
  /** The whole logo at rest. */
  buf: PixelBuf;
  /** Its pieces back to front, placed in `buf` (the title draws them one at a time). */
  pieces: LogoPiece[];
  /** The raccoon's frames (rest, blink, look left, look right), drawn where the 'coon' piece is. */
  coon: PixelBuf[];
  /** The can's mouth (its top middle) and the fish skeleton's middle, in `buf`: flies buzz round them. */
  can: { x: number; y: number };
  bone: { x: number; y: number };
}

interface LetterPlan {
  ch: string;
  deg: number;
  dy: number;
}

/** DUMPSTER, tossed in a heap; LEGEND, on a gentle arch. */
const TOP: readonly LetterPlan[] = [
  { ch: 'D', deg: -8, dy: 2 },
  { ch: 'U', deg: 0, dy: 0 },
  { ch: 'M', deg: 7, dy: -2 },
  { ch: 'P', deg: -6, dy: 2 },
  { ch: 'S', deg: 8, dy: -1 },
  { ch: 'T', deg: -5, dy: 1 },
  { ch: 'E', deg: 7, dy: -2 },
  { ch: 'R', deg: -7, dy: 2 },
];
const BOTTOM: readonly LetterPlan[] = [
  { ch: 'L', deg: -5, dy: 4 },
  { ch: 'E', deg: -3, dy: 1 },
  { ch: 'G', deg: -1, dy: 0 },
  { ch: 'E', deg: 1, dy: 0 },
  { ch: 'N', deg: 3, dy: 1 },
  { ch: 'D', deg: 5, dy: 4 },
];

/** The can's paint over the U: a dark inside, a light rim, two ribs. */
function dressCan(l: LetterArt): void {
  const { buf, ox, oy } = l;
  const inside = ['#0d2412', '#123018', '#163a1d', '#1a4322'];
  for (let y = 0; y <= 13; y++) {
    for (let x = 4; x <= 13; x++) {
      const i = ((oy + y) * buf.w + ox + x) * 4;
      if (buf.px[i + 3] && !(buf.px[i] === 0x1a && buf.px[i + 1] === 0x13)) continue;
      // The inside, darker toward the top (the mouth's shadow); the ink outline stays.
      if (buf.px[i + 3]) continue;
      put(buf, ox + x, oy + y, inside[Math.min(inside.length - 1, Math.floor(y / 4))]);
    }
  }
  for (let x = 0; x < 18; x++) {
    for (const [y, c] of [[0, GREEN.light], [1, GREEN.face[0]], [6, GREEN.shade], [11, GREEN.shade], [16, GREEN.shade]] as const) {
      const i = ((oy + y) * buf.w + ox + x) * 4;
      if (!buf.px[i + 3]) continue;
      const isInk = buf.px[i] === 0x1a && buf.px[i + 1] === 0x13 && buf.px[i + 2] === 0x26;
      if (!isInk) put(buf, ox + x, oy + y, c);
    }
  }
}

/** The logo: a piece per letter and trimming, and the whole of it at rest. */
export function logoArt(): LogoArt {
  const place = (plans: readonly LetterPlan[], mat: Material, gap: number) => {
    let x = 0;
    return plans.map((p) => {
      const art = paintLetter(letterMask(p.ch, p.deg), mat);
      if (p.ch === 'U') dressCan(art);
      const at = { art, x: x - art.ox, y: p.dy - art.oy + Math.round((LOGO_H - art.h) / 2) };
      x += art.w + gap;
      return at;
    });
  };
  const top = place(TOP, GREEN, -1);
  const bottom = place(BOTTOM, GOLD, 0);
  const span = (row: typeof top) => {
    const x0 = Math.min(...row.map((r) => r.x));
    const x1 = Math.max(...row.map((r) => r.x + r.art.buf.w));
    const y0 = Math.min(...row.map((r) => r.y));
    const y1 = Math.max(...row.map((r) => r.y + r.art.buf.h));
    return { x0, x1, y0, y1 };
  };
  const st = span(top);
  const sb = span(bottom);
  // Room above DUMPSTER for the raccoon's ears and crown.
  const ABOVE = 14;
  const width = Math.max(st.x1 - st.x0, sb.x1 - sb.x0) + 8;
  const topX = Math.floor((width - (st.x1 - st.x0)) / 2) - st.x0;
  const topY = ABOVE - st.y0;
  const botX = Math.floor((width - (sb.x1 - sb.x0)) / 2) - sb.x0 + 3;
  const botY = topY + LOGO_H + 4 - sb.y0 + sb.y0;
  const pieces: LogoPiece[] = [];
  top.forEach((t, i) => pieces.push({ kind: 'letter', buf: t.art.buf, x: topX + t.x, y: topY + t.y, line: 0, index: i }));
  bottom.forEach((b, i) => pieces.push({ kind: 'letter', buf: b.art.buf, x: botX + b.x, y: botY + b.y, line: 1, index: i }));
  // The raccoon in the can (the U), his chin a little below the rim, his paws on it, his crown on.
  const can = top[1];
  const canX = topX + can.x + can.art.ox;
  const canY = topY + can.y + can.art.oy;
  const coonFrames = COON_FRAMES.map((rows) => sprite(rows, COON));
  // His chin just inside the can's mouth.
  const coonX = canX + 1;
  const coonY = canY - 10;
  pieces.push({ kind: 'coon', buf: coonFrames[0], x: coonX, y: coonY });
  const paws = sprite(PAWS, COON);
  pieces.push({ kind: 'deco', buf: paws, x: canX - 2, y: canY - 1 });
  pieces.push({ kind: 'deco', buf: paws, x: canX + 13, y: canY - 1 });
  const crown = outlined(rotateBuf(sprite(CROWN, CROWN_COLORS), 10));
  pieces.push({ kind: 'deco', buf: crown, x: coonX + 3, y: coonY - crown.h + 3, rides: true });
  // A fish skeleton tossed onto the R.
  const r = top[7];
  const bone = outlined(rotateBuf(sprite(BONE, BONE_COLORS), -24));
  const boneAt = { x: topX + r.x + r.art.ox + 3, y: topY + r.y + r.art.oy - bone.h + 4 };
  pieces.push({ kind: 'deco', buf: bone, ...boneAt });
  const h = Math.max(...pieces.map((p) => p.y + p.buf.h)) + 1;
  const buf = blank(width, h);
  for (const p of pieces) over(buf, p.buf, p.x, p.y);
  return { buf, pieces, coon: coonFrames, can: { x: canX + 9, y: canY }, bone: { x: boneAt.x + Math.floor(bone.w / 2), y: boneAt.y + Math.floor(bone.h / 2) } };
}

// ---------------------------------------------------------------------------------- the sticker

const CREAM = '#fff7e8';

/**
 * The backing a sticker would have: `b`'s shape grown by `r` px of cream, round at the corners, with
 * a one-pixel ink edge. It has a pixel more on every side than the cream reaches.
 */
export function stickerOf(b: PixelBuf, r = 2): { buf: PixelBuf; pad: number } {
  const pad = r + 1;
  const o = blank(b.w + 2 * pad, b.h + 2 * pad);
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < b.w && y < b.h && b.px[(y * b.w + x) * 4 + 3] > 0;
  const grown = new Uint8Array(o.w * o.h);
  for (let y = 0; y < o.h; y++) {
    for (let x = 0; x < o.w; x++) {
      let hit = false;
      for (let dy = -r; dy <= r && !hit; dy++) for (let dx = -r; dx <= r && !hit; dx++) hit = dx * dx + dy * dy <= r * r + r && solid(x - pad + dx, y - pad + dy);
      grown[y * o.w + x] = hit ? 1 : 0;
    }
  }
  // A die-cut sticker has no holes: whatever the outside can't reach (the letters' counters) is backing too.
  const outside = new Uint8Array(o.w * o.h);
  const stack: number[] = [];
  for (let x = 0; x < o.w; x++) stack.push(x, (o.h - 1) * o.w + x);
  for (let y = 0; y < o.h; y++) stack.push(y * o.w, y * o.w + o.w - 1);
  while (stack.length) {
    const i = stack.pop()!;
    if (outside[i] || grown[i]) continue;
    outside[i] = 1;
    const x = i % o.w;
    const y = (i - x) / o.w;
    if (x > 0) stack.push(i - 1);
    if (x < o.w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - o.w);
    if (y < o.h - 1) stack.push(i + o.w);
  }
  for (let i = 0; i < grown.length; i++) if (!outside[i]) grown[i] = 1;
  const g = (x: number, y: number) => x >= 0 && y >= 0 && x < o.w && y < o.h && grown[y * o.w + x] === 1;
  for (let y = 0; y < o.h; y++) {
    for (let x = 0; x < o.w; x++) {
      if (g(x, y)) put(o, x, y, CREAM);
      else if (g(x - 1, y) || g(x + 1, y) || g(x, y - 1) || g(x, y + 1)) put(o, x, y, INK);
    }
  }
  return { buf: o, pad };
}

// ---------------------------------------------------------------------------------- PLAY

/** The PLAY button's paint: tomato red, glossy, on a deep lip. */
const BUTTON = {
  face: ['#ffb08a', '#ff8a5c', '#ff6f42', '#f75a34', '#ea4a2a'],
  shine: '#ffd3b8',
  edge: '#ffc7a6',
  lip: ['#c23a22', '#93261a'],
  bite: '#ffe2cf',
} as const;
const LABEL: Material = {
  face: ['#ffffff', '#fffaf0', '#fff3dc', '#ffe9c4', '#ffe0b0'],
  light: '#ffffff',
  shade: '#f0c890',
  gloss: '#ffffff',
  drop: ['#9b2a1a', '#6e1a12'],
};

/** How far the button's face stands above its lip (art px): pressing sinks it this far. */
export const BUTTON_LIP = 4;

export interface PlayButtonArt {
  /** The button's whole box (its sticker edge included). */
  w: number;
  h: number;
  /** The sticker backing and the lip under the face: they stay put. */
  sticker: PixelBuf;
  lip: PixelBuf;
  /** The face (outlined, with its shine, the bite and the play arrow) at (faceX, faceY + sink). */
  face: PixelBuf;
  faceX: number;
  faceY: number;
  /** The play arrow's box on the face (it nudges forward now and then): the face has it too. */
  arrow: { buf: PixelBuf; x: number; y: number };
  /** The label's letters, each drawn at (x, y + sink + its hop) over the face. */
  letters: Array<{ buf: PixelBuf; x: number; y: number }>;
  /** Where crumbs fall from: the bite's lower edge. */
  crumbs: { x: number; y: number };
}

/** A rounded box `w` x `h` with corners cut round by `r`. */
function roundBox(w: number, h: number, r: number): Mask {
  const m: Mask = { w, h, on: new Uint8Array(w * h) };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = x < r ? r - 0.5 : x >= w - r ? w - r - 0.5 : x;
      const cy = y < r ? r - 0.5 : y >= h - r ? h - r - 0.5 : y;
      const dx = x - cx;
      const dy = y - cy;
      m.on[y * w + x] = dx * dx + dy * dy <= r * r ? 1 : 0;
    }
  }
  return m;
}

/** A label in the pixel font's bold face, made finer (Scale2x) when it fits, cream with an ink outline. */
function fontLabel(label: string): LetterArt {
  const plain = renderText(label, { face: 'huge', fill: LABEL.face[1], ink: null });
  const fine = plain.w * 2 <= 150 ? scale2x(plain) : plain;
  const b = outlined(fine);
  return { buf: b, ox: 1, oy: 1, w: fine.w, h: fine.h };
}

/**
 * The PLAY button for `label` in the logo's lettering: a chunky tomato-red sticker button with a
 * glossy face on a deep lip, a play arrow, and a bite out of its top-right corner (the raccoon
 * couldn't wait).
 */
export function playButtonArt(label: string): PlayButtonArt {
  const chars = [...label.toUpperCase()];
  const ours = chars.length > 0 && chars.every((c) => LOGO_GLYPHS[c]);
  // A label the logo's letters can't spell (a translation) is the pixel font's, as one piece.
  const letters = ours ? chars.map((c, i) => paintLetter(letterMask(c, [-4, 3, -3, 4][i % 4]), LABEL)) : [fontLabel(label)];
  const arrowW = 11;
  const gap = 5;
  const labelW = letters.reduce((n, l) => n + l.w, 0) - (letters.length - 1);
  const padX = 11;
  const padY = 6;
  const faceW = padX + arrowW + gap + labelW + padX;
  const faceH = padY + Math.max(LOGO_H, ...letters.map((l) => l.h)) + DROP + padY - 2;
  // The bite: a few round nibbles out of the top-right corner.
  const bites: Array<[number, number, number]> = [[faceW - 3, 1, 6], [faceW - 11, -2, 3.6], [faceW + 1, 9, 3.6]];
  const bitten = (x: number, y: number) => bites.some(([bx, by, r]) => (x - bx) * (x - bx) + (y - by) * (y - by) <= r * r);
  const cut = (m: Mask) => {
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (bitten(x, y)) m.on[y * m.w + x] = 0;
    return m;
  };
  // The face, and the lip: the same round box, BUTTON_LIP rows deeper.
  const faceMask = cut(roundBox(faceW, faceH, 6));
  const body = cut(roundBox(faceW, faceH + BUTTON_LIP, 6));
  const lipBuf = blank(faceW, faceH + BUTTON_LIP);
  for (let y = Math.floor(faceH / 2); y < body.h; y++) {
    for (let x = 0; x < faceW; x++) if (at(body, x, y)) put(lipBuf, x, y, y < faceH + 1 ? BUTTON.lip[0] : BUTTON.lip[1]);
  }
  const lip = outlined(lipBuf);
  const bodyBuf = blank(faceW, faceH + BUTTON_LIP);
  for (let y = 0; y < body.h; y++) for (let x = 0; x < faceW; x++) if (at(body, x, y)) put(bodyBuf, x, y, INK);
  const st = stickerOf(outlined(bodyBuf), 2);
  // Face: bands, a light rim on top, a darker last row, the bite's pale inside, a gloss band.
  const faceBuf = blank(faceW, faceH);
  const n = BUTTON.face.length;
  for (let y = 0; y < faceH; y++) {
    const band = BUTTON.face[Math.min(n - 1, Math.floor((y / faceH) * n))];
    for (let x = 0; x < faceW; x++) {
      if (!at(faceMask, x, y)) continue;
      let c: string = band;
      if (bitten(x + 1, y) || bitten(x, y - 1) || bitten(x + 1, y - 1)) c = BUTTON.bite;
      else if (!at(faceMask, x, y - 1)) c = BUTTON.edge;
      else if (!at(faceMask, x, y + 1)) c = BUTTON.lip[0];
      put(faceBuf, x, y, c);
    }
  }
  for (let x = 5; x < faceW - 13; x++) for (const y of [2, 3]) if (at(faceMask, x, y)) put(faceBuf, x, y, BUTTON.shine);
  put(faceBuf, faceW - 11, 3, BUTTON.shine);
  // The play arrow: a cream triangle in the label's paint.
  const arrowRows: string[] = [];
  for (let y = 0; y < 15; y++) {
    const k = y <= 7 ? y : 14 - y;
    arrowRows.push('#'.repeat(Math.min(arrowW, 2 + Math.round(k * 1.25))).padEnd(arrowW, '.'));
  }
  const arrowArt = paintLetter(maskOf(arrowRows), LABEL);
  const face = outlined(faceBuf);
  const faceX = st.pad;
  const faceY = st.pad;
  const arrow = { buf: arrowArt.buf, x: faceX + 1 + padX - arrowArt.ox, y: faceY + 1 + padY + 2 - arrowArt.oy };
  // The letters, over the face (drawn on their own so they can hop).
  let lx = faceX + 1 + padX + arrowW + gap;
  const lh = Math.max(LOGO_H, ...letters.map((l) => l.h));
  const placed = letters.map((l) => {
    const p = { buf: l.buf, x: lx - l.ox, y: faceY + 1 + padY - l.oy + Math.round((lh - l.h) / 2) - 1 };
    lx += l.w - 1;
    return p;
  });
  return {
    w: st.buf.w,
    h: st.buf.h,
    sticker: st.buf,
    lip,
    face,
    faceX,
    faceY,
    arrow,
    letters: placed,
    crumbs: { x: faceX + faceW - 8, y: faceY + 8 },
  };
}
