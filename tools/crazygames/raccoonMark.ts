/**
 * The game's mark: the raccoon's face, front on and grinning, a paw raising a BBQ spatula (the game's
 * own BBQ Spatula: steel blade with slots, wooden handle) beside his head. No lettering. Drawn in art
 * pixels in the hero's colors (pixel/hero.ts, logoArt.ts COON) with a dark outline, on a die-cut
 * sticker like the title logo's. Pure buffers, so it builds in Node too.
 */
import { blank, outline, type PixelBuf } from '../../src/render/pixel/buf';
import { stickerOf } from '../../src/render/logoArt';

/** The raccoon's colors (the hero's), plus the spatula's. */
const C = {
  ink: '#32282b',
  fur: '#806657',
  furDark: '#5e4a40',
  furLight: '#b29d8e',
  cream: '#e8ddd0',
  mask: '#3a2a22',
  maskHi: '#4e3a30',
  white: '#ffffff',
  pupil: '#0b0b22',
  nose: '#1a1326',
  pink: '#c9917f',
  blush: '#d98f86',
  mouth: '#5a1f2a',
  tongue: '#e0606e',
  steel: '#c7ced8',
  steelHi: '#eef2f7',
  steelLo: '#8b95a3',
  wood: '#9a5b32',
  woodHi: '#c27a45',
  woodLo: '#6b3c22',
} as const;

const W = 72;
const H = 72;
/** Everything is drawn this far down, leaving the blade room at the top. */
const OY = 5;

type Px = (x: number, y: number) => boolean;
const ell = (cx: number, cy: number, rx: number, ry: number): Px => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
/** Inside triangle a-b-c. */
const tri = (a: [number, number], b: [number, number], c: [number, number]): Px => (x, y) => {
  const s = (p: [number, number], q: [number, number]) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
  const d1 = s(a, b);
  const d2 = s(b, c);
  const d3 = s(c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};
const or = (...fs: Px[]): Px => (x, y) => fs.some((f) => f(x, y));
/** Inside the band of half-width `r` around segment a-b. */
const seg = (a: [number, number], b: [number, number], r: number): Px => (x, y) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return (x - a[0] - t * dx) ** 2 + (y - a[1] - t * dy) ** 2 <= r * r;
};
/** A rectangle `w` x `h` centred on (cx, cy), turned `deg` degrees. */
const rect = (cx: number, cy: number, w: number, h: number, deg: number): Px => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return (x, y) => {
    const u = (x - cx) * c + (y - cy) * s;
    const v = -(x - cx) * s + (y - cy) * c;
    return Math.abs(u) <= w / 2 && Math.abs(v) <= h / 2;
  };
};

function paint(b: PixelBuf, f: Px, color: string | ((x: number, y: number) => string | null)): void {
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (!f(x + 0.5, y + 0.5 - OY)) continue;
      const c = typeof color === 'string' ? color : color(x, y - OY);
      if (!c) continue;
      const i = (y * b.w + x) * 4;
      const n = parseInt(c.slice(1), 16);
      b.px[i] = n >> 16;
      b.px[i + 1] = (n >> 8) & 255;
      b.px[i + 2] = n & 255;
      b.px[i + 3] = 255;
    }
  }
}

/** The mark, outlined, without its sticker. */
export function raccoonMarkArt(): PixelBuf {
  const b = blank(W, H);
  const cx = 30;

  // ---- the spatula, behind his head: handle from his fist (lower right) up to the blade (top right)
  const grip: [number, number] = [52, 51];
  const neck: [number, number] = [59.5, 21];
  paint(b, seg([50.3, 60], neck, 2.1), C.wood);
  paint(b, seg([49.6, 59], [58.6, 22], 0.6), C.woodHi);
  paint(b, seg([58.3, 28], neck, 1.5), C.steelLo); // the metal shank
  const ba = (12 * Math.PI) / 180;
  const bx = 61.5;
  const by = 10;
  paint(b, rect(bx, by, 15, 19, 12), (x, y) => {
    const u = (x + 0.5 - bx) * Math.cos(ba) + (y + 0.5 - by) * Math.sin(ba);
    const v = -(x + 0.5 - bx) * Math.sin(ba) + (y + 0.5 - by) * Math.cos(ba);
    if (Math.abs(v + 1) <= 5 && [-4, 0, 4].some((s) => Math.abs(u - s) <= 0.9)) return C.steelLo; // three slots
    if (u < -5.5 || v < -7.5) return C.steelHi;
    return v > 6.5 ? C.steelLo : C.steel;
  });

  // ---- ears
  const earL = tri([7, 22], [13, 3], [24, 14]);
  const earR = tri([53, 22], [47, 3], [36, 14]);
  paint(b, or(earL, earR), C.fur);
  paint(b, or(tri([10, 19], [14, 8], [20, 15]), tri([50, 19], [46, 8], [40, 15])), C.pink);

  // ---- head: a wide round face with jowl tufts at the sides
  const head = or(
    ell(cx, 31, 23, 18),
    tri([6, 32], [1, 44], [14, 44]),
    tri([54, 32], [59, 44], [46, 44]),
    ell(cx, 40, 19, 13),
  );
  paint(b, head, (_x, y) => (y > 42 ? C.furDark : C.fur));
  // the cheeks' pale ruff and the brow
  paint(b, or(tri([3, 41], [12, 36], [16, 45]), tri([57, 41], [48, 36], [44, 45])), C.furLight);
  paint(b, or(ell(19, 20, 7, 3), ell(41, 20, 7, 3)), C.furLight);
  // forehead stripe
  paint(b, or(tri([cx - 2, 13], [cx + 2, 13], [cx, 26]), ell(cx, 14, 2.5, 2)), C.furDark);

  // ---- the bandit mask: two lobes round the eyes, joined over the nose, sweeping down at the sides
  const mask = or(ell(19.5, 28, 10, 6.5), ell(40.5, 28, 10, 6.5), tri([8, 26], [6, 35], [14, 31]), tri([52, 26], [54, 35], [46, 31]), rect(cx, 27, 8, 4, 0));
  paint(b, mask, (_x, y) => (y < 25 ? C.maskHi : C.mask));
  // ---- eyes: big whites, pupils glancing up at the spatula, a highlight
  paint(b, or(ell(20, 28, 4.6, 4.2), ell(40, 28, 4.6, 4.2)), C.white);
  paint(b, or(ell(21.5, 27.5, 2.3, 2.8), ell(41.5, 27.5, 2.3, 2.8)), C.pupil);
  paint(b, or(rect(22.5, 26, 1, 1, 0), rect(42.5, 26, 1, 1, 0)), C.white);

  // ---- muzzle, nose and a toothy grin
  paint(b, ell(cx, 40, 10, 6.5), C.cream);
  paint(b, or(ell(cx, 35.6, 3.6, 2.2), tri([cx - 3, 36], [cx + 3, 36], [cx, 39])), C.nose);
  paint(b, rect(cx - 1, 35, 1, 1, 0), '#4a3a58');
  const grin = (x: number, y: number) => y >= 40.5 && ((x - cx) / 6) ** 2 + ((y - 40.5) / 4.5) ** 2 <= 1;
  paint(b, grin, (x, y) => (y >= 43 && Math.abs(x + 0.5 - cx) < 3 ? C.tongue : C.mouth));
  paint(b, or(rect(cx - 2.5, 41, 2, 2, 0), rect(cx + 2.5, 41, 2, 2, 0)), C.white); // two buck teeth
  paint(b, or(ell(14, 37, 2.5, 1.5), ell(46, 37, 2.5, 1.5)), C.blush);

  // ---- his fist round the handle, in front of his cheek: fingers curled toward us, thumb on top.
  // (Inked round where it lies over his face, like the handle above it.)
  paint(b, seg([grip[0] - 0.6, grip[1] - 7.5], neck, 3.1), C.ink);
  paint(b, or(ell(grip[0], grip[1], 7.2, 6.2), ell(grip[0] + 2.5, grip[1] - 4.8, 3.8, 3)), C.ink);
  paint(b, seg([grip[0] - 0.6, grip[1] - 7.5], neck, 2.1), C.wood);
  paint(b, seg([grip[0] - 1.3, grip[1] - 8], [58.6, 22], 0.6), C.woodHi);
  paint(b, ell(grip[0], grip[1], 6.2, 5.2), (_x, y) => (y < grip[1] - 2.5 ? C.furLight : y > grip[1] + 2.5 ? C.furDark : C.fur));
  paint(b, ell(grip[0] + 2.5, grip[1] - 4.8, 2.8, 2), C.furLight); // thumb
  for (const dy of [-1.5, 1, 3.5]) paint(b, seg([grip[0] - 5.5, grip[1] + dy], [grip[0] - 1.5, grip[1] + dy], 0.55), C.ink);

  return outline(b, C.ink);
}

/** The mark on its sticker backing, ready to place. */
export function raccoonMark(): PixelBuf {
  const art = raccoonMarkArt();
  const st = stickerOf(art, 2);
  const out = st.buf;
  // the art over its backing
  for (let y = 0; y < art.h; y++) {
    for (let x = 0; x < art.w; x++) {
      const i = (y * art.w + x) * 4;
      if (!art.px[i + 3]) continue;
      const o = ((y + st.pad) * out.w + x + st.pad) * 4;
      out.px[o] = art.px[i];
      out.px[o + 1] = art.px[i + 1];
      out.px[o + 2] = art.px[i + 2];
      out.px[o + 3] = 255;
    }
  }
  return out;
}
