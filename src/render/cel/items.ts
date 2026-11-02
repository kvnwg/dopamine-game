/**
 * Junk-gear item drawings in local coordinates plus the rarity treatments.
 * Each draw function draws with the current transform and returns metadata (bounds, where a junk
 * tape patch goes, where a mint price tag hangs) in local units; `metaToCanvas` converts it.
 */
import { CEL_PALETTE as C, MYTHIC_RAINBOW, OUTLINE, RARITY_COLOR, type Rarity } from './palette';
import {
  type Ctx, type Hi, type Pt, cel, celMulti, circle, ellipse, fill, inClip, ink, lightOf, makeCanvas, mix, outline,
  polar, rgba, rng, roundPoly, rrect, sampleCurve, shadeOf, silhouette, smooth, softSpot, sparkle4, star, stroke, tube,
} from './core';

export interface Box { x: number; y: number; w: number; h: number }
export interface Tape { x: number; y: number; ang: number; len: number }
export interface ItemMeta { box: Box; tape?: Tape; tag?: Pt }

export interface Look {
  rarity: Rarity | null;
  main: string;
  shade: string;
  light: string;
  /** outline width in the current local units */
  lw: number;
}

export function lookOf(rarity: Rarity | null, lw: number): Look {
  const main = rarity ? RARITY_COLOR[rarity] : C.wood;
  let shade = shadeOf(main, 0.2);
  let light = lightOf(main, 0.45);
  if (rarity === 'mint') { shade = '#E8D3A2'; light = '#FFFFFF'; }
  if (rarity === 'legendary') { shade = '#E08A00'; light = '#FFE38A'; }
  if (rarity === 'junk') { shade = '#7C7A80'; light = '#C6C6C6'; }
  if (rarity === 'epic') { shade = '#76169A'; light = '#C77BE0'; }
  return { rarity, main, shade, light, lw };
}

// ------------------------------------------------------------------ transforms
export function toCanvas(ctx: Ctx, x: number, y: number): Pt {
  const m = ctx.getTransform();
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

export function metaToCanvas(ctx: Ctx, meta: ItemMeta): ItemMeta {
  const b = meta.box;
  const pts = [toCanvas(ctx, b.x, b.y), toCanvas(ctx, b.x + b.w, b.y), toCanvas(ctx, b.x, b.y + b.h), toCanvas(ctx, b.x + b.w, b.y + b.h)];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  const m = ctx.getTransform();
  const scale = Math.hypot(m.a, m.b);
  const rot = Math.atan2(m.b, m.a);
  const out: ItemMeta = { box };
  if (meta.tape) {
    const p = toCanvas(ctx, meta.tape.x, meta.tape.y);
    out.tape = { x: p.x, y: p.y, ang: meta.tape.ang + rot, len: meta.tape.len * scale };
  }
  if (meta.tag) out.tag = toCanvas(ctx, meta.tag.x, meta.tag.y);
  return out;
}

// ------------------------------------------------------------------ main-part treatments
export interface PartOpts {
  box: Box;
  dx?: number;
  dy?: number;
  extra?: (dark: boolean) => void;
  hi?: Hi | null;
  trim?: boolean;
}

function shineStreak(ctx: Ctx, b: Box, a: number): void {
  const s = Math.max(b.w, b.h);
  const m = Math.min(b.w, b.h);
  ctx.save();
  ctx.translate(b.x + b.w * 0.34, b.y + b.h * 0.36);
  ctx.rotate(-0.9);
  ctx.fillStyle = rgba('#FFFFFF', 0.9 * a);
  ctx.fillRect(-s, -m * 0.09, 2 * s, m * 0.18);
  ctx.fillRect(-s, m * 0.17, 2 * s, m * 0.06);
  ctx.restore();
}

function rainbowSheen(ctx: Ctx, b: Box): void {
  const g = ctx.createLinearGradient(b.x, b.y + b.h, b.x + b.w, b.y);
  MYTHIC_RAINBOW.forEach((c, i) => g.addColorStop(i / (MYTHIC_RAINBOW.length - 1), c));
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = g;
  ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
  ctx.restore();
}

/** The rarity-colored part of an item, with the per-rarity surface treatment. */
export function mainPart(ctx: Ctx, p: Path2D, L: Look, o: PartOpts): void {
  const b = o.box;
  const s = Math.min(b.w, b.h);
  celMulti(ctx, p, L.lw, o.dx ?? s * 0.09, o.dy ?? s * 0.12, (dark) => {
    fill(ctx, p, dark ? L.shade : L.main);
    o.extra?.(dark);
  });
  inClip(ctx, p, () => {
    if (L.rarity === 'mythic') rainbowSheen(ctx, b);
    if (L.rarity === 'shiny') shineStreak(ctx, b, 1);
    if (L.rarity === 'mythic') shineStreak(ctx, b, 0.65);
    if (o.hi !== null) {
      const h = o.hi ?? { x: b.x + b.w * 0.28, y: b.y + b.h * 0.24, rx: b.w * 0.14, ry: b.h * 0.08, a: 0.5, rot: -0.5 };
      softSpot(ctx, h.x, h.y, h.rx, h.ry, h.color ?? '#FFFFFF', h.a ?? 0.5, h.rot ?? 0, 0.6);
    }
  });
  if (L.rarity === 'legendary' && o.trim !== false) {
    inClip(ctx, p, () => {
      stroke(ctx, p, '#B86F00', L.lw * 3.1);
      stroke(ctx, p, '#FFE680', L.lw * 2.3);
      stroke(ctx, p, '#FFF8D2', L.lw * 0.8);
    });
  }
}

// ------------------------------------------------------------------ post effects
function desaturateCanvas(c: HTMLCanvasElement, k: number): void {
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    // pull toward gray, then a slightly grubby khaki cast
    d[i] = (d[i] + (l - d[i]) * k) * 0.95 + 8;
    d[i + 1] = (d[i + 1] + (l - d[i + 1]) * k) * 0.95 + 6;
    d[i + 2] = (d[i + 2] + (l - d[i + 2]) * k) * 0.93;
  }
  ctx.putImageData(img, 0, 0);
}

export function drawTape(ctx: Ctx, t: Tape, lw: number): void {
  const h = Math.max(7, t.len * 0.32);
  const half = t.len / 2;
  const pts: number[] = [];
  const teeth = 3;
  pts.push(-half, -h / 2);
  pts.push(half, -h / 2);
  for (let i = 1; i <= teeth * 2; i++) pts.push(half + (i % 2 ? h * 0.12 : -h * 0.04), -h / 2 + (h * i) / (teeth * 2));
  pts.push(-half, h / 2);
  for (let i = 1; i < teeth * 2; i++) pts.push(-half + (i % 2 ? -h * 0.12 : h * 0.04), h / 2 - (h * i) / (teeth * 2));
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(t.ang);
  const p = roundPoly(pts, 0.6);
  celMulti(ctx, p, lw * 0.55, 0, h * 0.42, (dark) => fill(ctx, p, dark ? C.tapeShade : C.tape));
  ink(ctx, [-half * 0.7, -h * 0.05, half * 0.6, -h * 0.05], Math.max(1, lw * 0.3), rgba(C.tapeShade, 0.9), false);
  ctx.restore();
}

export function drawSparkle(ctx: Ctx, x: number, y: number, r: number, glow: string, rot = 0): void {
  softSpot(ctx, x, y, r * 1.25, r * 1.25, glow, 0.55, 0, 0.2);
  fill(ctx, sparkle4(x, y, r, 0.17, rot), '#FFFFFF');
  fill(ctx, sparkle4(x, y, r * 0.45, 0.2, rot), mix(glow, '#FFFFFF', 0.6));
}

export function drawPriceTag(ctx: Ctx, anchor: Pt, size: number, lw: number): void {
  const tx = anchor.x + size * 0.75;
  const ty = anchor.y + size * 0.55;
  // string
  stroke(ctx, smooth([anchor.x, anchor.y, anchor.x + size * 0.35, anchor.y + size * 0.15, tx - size * 0.05, ty - size * 0.28], false), OUTLINE, Math.max(1.5, lw * 0.5));
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(0.35);
  const w = size * 0.62, h = size * 0.9;
  const p = roundPoly([0, -h * 0.42, w / 2, -h * 0.18, w / 2, h / 2, -w / 2, h / 2, -w / 2, -h * 0.18], [w * 0.12, w * 0.12, w * 0.12, w * 0.12, w * 0.12]);
  cel(ctx, p, C.tag, { lw: Math.max(1.5, lw * 0.7), shade: C.tagShade, dx: w * 0.14, dy: h * 0.06 });
  fill(ctx, circle(0, -h * 0.2, w * 0.1), OUTLINE);
  // a little "$"
  const s = w * 0.2;
  ink(ctx, [s, h * 0.05, -s * 0.2, -s * 0.2 + h * 0.08, -s * 0.9, h * 0.12, -s * 0.2, h * 0.2, s * 0.9, h * 0.29, s * 0.2, h * 0.38, -s, h * 0.33], Math.max(1.4, lw * 0.45));
  ink(ctx, [0, h * 0.0, 0, h * 0.43], Math.max(1.2, lw * 0.35), OUTLINE, false);
  ctx.restore();
}

function glowed(src: HTMLCanvasElement, color: string, grow: number): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(src.width, src.height);
  const sil = silhouette(src, color, grow);
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = grow * 3;
  ctx.globalAlpha = 0.68;
  ctx.drawImage(sil, 0, 0);
  ctx.restore();
  ctx.drawImage(src, 0, 0);
  return c;
}

/**
 * Applies the whole-item rarity treatments to an item canvas: junk desaturation + tape, epic glow,
 * legendary/mythic/mint sparkles and the mint price tag. `lw` is the outline width in px.
 */
export function finishItem(src: HTMLCanvasElement, rarity: Rarity | null, meta: ItemMeta, lw: number, seed: number, sparkles = 3): HTMLCanvasElement {
  if (!rarity || rarity === 'decent' || rarity === 'shiny') return src;
  const ctx = src.getContext('2d');
  if (!ctx) return src;
  const b = meta.box;
  const s = Math.max(b.w, b.h);
  const r = rng(seed);
  const around = (n: number, sz: number, glow: string) => {
    const spots = [
      { x: b.x + b.w * 0.95, y: b.y + b.h * 0.08 },
      { x: b.x + b.w * 0.04, y: b.y + b.h * 0.45 },
      { x: b.x + b.w * 0.86, y: b.y + b.h * 0.8 },
      { x: b.x + b.w * 0.3, y: b.y - b.h * 0.02 },
    ];
    for (let i = 0; i < n; i++) {
      const p = spots[i % spots.length];
      const k = i === 0 ? 1 : 0.62 + r() * 0.2;
      drawSparkle(ctx, p.x + (r() - 0.5) * s * 0.06, p.y + (r() - 0.5) * s * 0.06, sz * k, glow, (r() - 0.5) * 0.3);
    }
  };
  const spark = clamp(s * 0.13, 6, 22);
  switch (rarity) {
    case 'junk':
      desaturateCanvas(src, 0.75);
      if (meta.tape) drawTape(ctx, meta.tape, lw);
      return src;
    case 'epic':
      return glowed(src, C.glowEpic, Math.max(2.5, lw * 0.75));
    case 'legendary':
      around(sparkles, spark, '#FFC300');
      return src;
    case 'mythic':
      around(Math.max(1, sparkles - 1), spark * 0.9, '#FF6FD8');
      return src;
    case 'mint':
      if (meta.tag) drawPriceTag(ctx, meta.tag, clamp(s * 0.22, 12, 30), lw);
      around(sparkles + 1, spark * 1.1, '#7DF3C8');
      return src;
  }
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

// ------------------------------------------------------------------ items (local coordinates)

/** Traffic cone. Origin: bottom center of the base. ~88 wide x 120 tall. */
export function drawCone(ctx: Ctx, L: Look): ItemMeta {
  const base = rrect(-44, -16, 88, 16, 6);
  cel(ctx, base, L.shade, { lw: L.lw, shade: shadeOf(L.shade, 0.2), dx: 0, dy: 5 });
  const body = roundPoly([-31, -12, 31, -12, 9, -118, -9, -118], [3, 3, 7, 7]);
  const stripeW = L.rarity === 'junk' ? '#E9E5DA' : '#FFFFFF';
  mainPart(ctx, body, L, {
    box: { x: -31, y: -118, w: 62, h: 106 },
    dx: 8,
    dy: 1,
    extra: (dark) => {
      const w = dark ? '#D2D9E6' : stripeW;
      fill(ctx, rrect(-40, -84, 80, 17, 0), w);
      fill(ctx, rrect(-40, -47, 80, 15, 0), w);
    },
    hi: { x: -13, y: -98, rx: 3.5, ry: 11, a: 0.6, rot: 0.2 },
  });
  return { box: { x: -44, y: -118, w: 88, h: 118 }, tape: { x: 7, y: -62, ang: -0.6, len: 40 }, tag: { x: 22, y: -16 } };
}

export interface Lens { x: number; y: number; rx: number; ry: number }

/** Goggles: two framed lenses + strap. `see` = translucent glass (worn over the eyes). */
export function drawGoggles(ctx: Ctx, L: Look, a: Lens, b: Lens, strap: number[], strapW: number, see: boolean): ItemMeta {
  const lw = L.lw;
  const strapC = mix(L.shade, '#3A3445', 0.3);
  cel(ctx, tube(strap, strap.map(() => strapW)), strapC, { lw, shade: shadeOf(strapC, 0.2), dx: 0, dy: strapW * 0.35 });
  const bridge = tube([a.x + a.rx * 0.7, a.y - a.ry * 0.3, (a.x + b.x) / 2, Math.min(a.y, b.y) - a.ry * 0.45, b.x - b.rx * 0.7, b.y - b.ry * 0.3], [strapW * 0.7, strapW * 0.6, strapW * 0.7]);
  mainPart(ctx, bridge, L, { box: { x: a.x, y: a.y - a.ry, w: b.x - a.x, h: a.ry }, hi: null, trim: false });
  for (const e of [a, b]) {
    const fw = Math.max(e.rx, e.ry) * 0.32;
    const frame = ellipse(e.x, e.y, e.rx + fw, e.ry + fw);
    mainPart(ctx, frame, L, { box: { x: e.x - e.rx - fw, y: e.y - e.ry - fw, w: 2 * (e.rx + fw), h: 2 * (e.ry + fw) }, dx: fw * 0.5, dy: fw * 0.7, hi: null });
    const glass = ellipse(e.x, e.y, e.rx, e.ry);
    outline(ctx, glass, lw * 0.55);
    ctx.save();
    ctx.globalCompositeOperation = see ? 'destination-out' : 'source-over';
    fill(ctx, glass, '#000000');
    ctx.restore();
    const g = ctx.createLinearGradient(e.x, e.y - e.ry, e.x, e.y + e.ry);
    g.addColorStop(0, rgba('#B8F0FF', see ? 0.4 : 1));
    g.addColorStop(1, rgba('#4FB6E8', see ? 0.5 : 1));
    fill(ctx, glass, g);
    inClip(ctx, glass, () => {
      ctx.save();
      ctx.translate(e.x - e.rx * 0.2, e.y - e.ry * 0.1);
      ctx.rotate(-0.75);
      ctx.fillStyle = rgba('#FFFFFF', 0.85);
      ctx.fillRect(-e.rx * 2, -e.ry * 0.16, e.rx * 4, e.ry * 0.3);
      ctx.fillRect(-e.rx * 2, e.ry * 0.26, e.rx * 4, e.ry * 0.1);
      ctx.restore();
    });
  }
  const x0 = Math.min(a.x - a.rx * 1.4, strap[0], strap[strap.length - 2]);
  const x1 = b.x + b.rx * 1.4;
  return {
    box: { x: x0, y: Math.min(a.y - a.ry, b.y - b.ry) * 1 - a.ry * 0.35, w: x1 - x0, h: Math.max(a.ry, b.ry) * 2.7 },
    tape: { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - a.ry * 0.45, ang: 0.5, len: a.rx * 1.6 },
    tag: { x: b.x + b.rx * 1.1, y: b.y + b.ry * 0.4 },
  };
}

/** Trash-can lid. Origin: center. Radius r. `handle` = show the center grip (icons). */
export function drawLid(ctx: Ctx, L: Look, r: number, handle = true): ItemMeta {
  const lw = L.lw;
  const rim = ellipse(0, 0, r, r * 0.97);
  mainPart(ctx, rim, L, {
    box: { x: -r, y: -r, w: 2 * r, h: 2 * r },
    dx: r * 0.12,
    dy: r * 0.14,
    extra: (dark) => {
      fill(ctx, ellipse(-r * 0.04, -r * 0.05, r * 0.74, r * 0.71), dark ? shadeOf(L.shade, 0.08) : lightOf(L.main, 0.18));
      fill(ctx, ellipse(0, 0, r * 0.66, r * 0.63), dark ? L.shade : L.main);
      fill(ctx, ellipse(-r * 0.03, -r * 0.04, r * 0.44, r * 0.42), dark ? shadeOf(L.shade, 0.08) : lightOf(L.main, 0.18));
      fill(ctx, ellipse(0, 0, r * 0.37, r * 0.35), dark ? L.shade : L.main);
    },
    hi: { x: -r * 0.42, y: -r * 0.5, rx: r * 0.22, ry: r * 0.1, a: 0.55, rot: -0.6 },
  });
  stroke(ctx, ellipse(0, 0, r * 0.7, r * 0.67), rgba(OUTLINE, 0.85), lw * 0.55);
  stroke(ctx, ellipse(0, 0, r * 0.4, r * 0.38), rgba(OUTLINE, 0.85), lw * 0.55);
  if (handle) {
    const grip = rrect(-r * 0.3, -r * 0.13, r * 0.6, r * 0.26, r * 0.13);
    cel(ctx, grip, L.shade, { lw: lw * 0.85, shade: shadeOf(L.shade, 0.2), dx: 0, dy: r * 0.08, hi: { x: -r * 0.1, y: -r * 0.06, rx: r * 0.12, ry: r * 0.04, a: 0.5 } });
  } else {
    // a domed boss instead of the grip (the grip is on the inside face)
    cel(ctx, ellipse(-r * 0.02, -r * 0.02, r * 0.17, r * 0.16), lightOf(L.main, 0.12), { lw: lw * 0.6, shade: L.shade, dx: r * 0.05, dy: r * 0.06, hi: { x: -r * 0.07, y: -r * 0.08, rx: r * 0.06, ry: r * 0.04, a: 0.7 } });
  }
  // rivets on the rim
  for (const ang of [0.6, 2.2, 3.8, 5.3]) {
    fill(ctx, circle(Math.cos(ang) * r * 0.85, Math.sin(ang) * r * 0.83, r * 0.05), rgba(OUTLINE, 0.7));
  }
  return { box: { x: -r, y: -r, w: 2 * r, h: 2 * r }, tape: { x: r * 0.15, y: r * 0.45, ang: -0.35, len: r * 0.95 }, tag: { x: r * 0.7, y: r * 0.6 } };
}

/** Rubber glove, fingers up. Origin: palm center. ~60 wide x 95 tall. */
export function drawGlove(ctx: Ctx, L: Look): ItemMeta {
  const lw = L.lw;
  const cuff = roundPoly([-16, 12, 16, 12, 25, 42, -25, 42], [4, 4, 6, 6]);
  mainPart(ctx, cuff, L, { box: { x: -25, y: 12, w: 50, h: 30 }, dx: 4, dy: 4, hi: null, trim: false });
  const rim = rrect(-27, 37, 54, 11, 5.5);
  cel(ctx, rim, L.light, { lw, shade: L.main, dx: 0, dy: 4 });
  const fingers: Array<[number[], number[]]> = [
    [[-14, -6, -16, -24, -17, -34], [12, 11.5, 11]],
    [[-4, -8, -4, -30, -4, -41], [12.5, 12, 11.5]],
    [[7, -8, 8, -28, 9, -38], [12.5, 12, 11.5]],
    [[16, -4, 18, -18, 20, -27], [11, 10.5, 10]],
  ];
  for (const [pts, w] of fingers) {
    mainPart(ctx, tube(pts, w), L, { box: { x: pts[0] - 6, y: pts[pts.length - 1] - 6, w: 12, h: pts[1] - pts[pts.length - 1] + 12 }, dx: 2.5, dy: 2, hi: null, trim: false });
  }
  const palm = smooth([-19, -12, 0, -16, 20, -10, 21, 6, 13, 17, -13, 17, -21, 4], true);
  mainPart(ctx, palm, L, { box: { x: -21, y: -16, w: 42, h: 33 }, dx: 5, dy: 5, hi: { x: -9, y: -6, rx: 6, ry: 4, a: 0.45, rot: -0.4 } });
  const thumb = tube([-15, 4, -25, -4, -30, -14], [13, 12, 11]);
  mainPart(ctx, thumb, L, { box: { x: -36, y: -18, w: 22, h: 26 }, dx: 2.5, dy: 2.5, hi: null, trim: false });
  return { box: { x: -36, y: -47, w: 66, h: 95 }, tape: { x: 2, y: 2, ang: -0.4, len: 32 }, tag: { x: 20, y: 30 } };
}

/** Sneaker in side view, toe to the right. Origin: bottom center of the sole. ~72 x 38. */
export function drawSneaker(ctx: Ctx, L: Look): ItemMeta {
  const lw = L.lw;
  const upper = smooth([-31, -9, -32, -24, -24, -34, -9, -34, -2, -26, 12, -21, 28, -17, 35, -8], true);
  mainPart(ctx, upper, L, {
    box: { x: -32, y: -34, w: 67, h: 26 },
    dx: 3,
    dy: 5,
    extra: (dark) => {
      const w = dark ? '#D4DAE5' : '#FFFFFF';
      // side stripe
      fill(ctx, smooth([-20, -14, -6, -20, 10, -22, 20, -20, 8, -16, -8, -12], true), w);
      // toe cap
      fill(ctx, ellipse(31, -10, 11, 9), w);
    },
    hi: { x: -20, y: -28, rx: 6, ry: 3, a: 0.45 },
  });
  // laces
  for (const [x0, y0, x1, y1] of [[-4, -30, 4, -24], [2, -27, 10, -21], [8, -25, 16, -20]]) {
    stroke(ctx, smooth([x0, y0, x1, y1], false), OUTLINE, lw * 1.6 + 2.6);
    stroke(ctx, smooth([x0, y0, x1, y1], false), '#FFFFFF', 2.6);
  }
  const sole = rrect(-35, -11, 72, 11, 5.5);
  cel(ctx, sole, '#FFFFFF', { lw, shade: '#D3D9E4', dx: 0, dy: 4 });
  ink(ctx, [-31, -4.5, 33, -4.5], Math.max(1.2, lw * 0.35), rgba('#9AA4B5', 0.9), false);
  return { box: { x: -35, y: -34, w: 72, h: 34 }, tape: { x: 4, y: -18, ang: -0.25, len: 26 }, tag: { x: -28, y: -26 } };
}

/** Backpack. Origin: center. ~64 x 80 (straps optional, for the icon). */
export function drawBackpack(ctx: Ctx, L: Look, straps: boolean): ItemMeta {
  const lw = L.lw;
  const strapC = mix(L.shade, '#3A3445', 0.45);
  if (straps) {
    cel(ctx, tube([-20, -30, -34, -10, -30, 20], [9, 9, 9]), strapC, { lw, shade: shadeOf(strapC, 0.2), dx: 2, dy: 2 });
    cel(ctx, tube([20, -30, 34, -10, 30, 20], [9, 9, 9]), strapC, { lw, shade: shadeOf(strapC, 0.2), dx: 2, dy: 2 });
  }
  // top handle loop
  stroke(ctx, smooth([-9, -36, -6, -46, 6, -46, 9, -36], false), OUTLINE, lw * 2 + 5);
  stroke(ctx, smooth([-9, -36, -6, -46, 6, -46, 9, -36], false), strapC, 5);
  const body = rrect(-31, -38, 62, 78, 17);
  mainPart(ctx, body, L, { box: { x: -31, y: -38, w: 62, h: 78 }, dx: 6, dy: 6, hi: null });
  const flap = smooth([-30, -20, -28, -36, 0, -40, 28, -36, 30, -20, 18, -8, -18, -8], true);
  mainPart(ctx, flap, { ...L, main: L.shade, shade: shadeOf(L.shade, 0.2) }, { box: { x: -30, y: -40, w: 60, h: 32 }, dx: 3, dy: 4, hi: { x: -12, y: -30, rx: 9, ry: 3.5, a: 0.4, rot: -0.15 } });
  const pocket = rrect(-20, 6, 40, 26, 9);
  mainPart(ctx, pocket, L, { box: { x: -20, y: 6, w: 40, h: 26 }, dx: 3, dy: 4, hi: null, trim: false });
  ink(ctx, [-16, 14, 16, 14], lw * 0.7, OUTLINE, false);
  // buckle
  cel(ctx, rrect(-6, -14, 12, 12, 3), C.silver, { lw: lw * 0.8, shade: C.silverShade, dx: 0, dy: 3 });
  return { box: { x: -34, y: -46, w: 68, h: 86 }, tape: { x: -6, y: 22, ang: 0.4, len: 30 }, tag: { x: 26, y: -10 } };
}

/** Bottle cap medallion. Origin: center. */
export function drawCap(ctx: Ctx, L: Look, r: number): void {
  const crimp = polar(0, 0, (a) => r * (0.9 + 0.1 * (0.5 + 0.5 * Math.cos(a * 21))), 168);
  mainPart(ctx, crimp, L, { box: { x: -r, y: -r, w: 2 * r, h: 2 * r }, dx: r * 0.14, dy: r * 0.16, hi: null });
  const inner = circle(-r * 0.03, -r * 0.03, r * 0.62);
  cel(ctx, inner, lightOf(L.main, 0.12), { lw: L.lw * 0.5, shade: L.main, dx: r * 0.08, dy: r * 0.1, hi: { x: -r * 0.25, y: -r * 0.28, rx: r * 0.2, ry: r * 0.12, a: 0.65, rot: -0.6 } });
  cel(ctx, star(-r * 0.03, -r * 0.03, r * 0.34, r * 0.15, 5), '#FFFFFF', { lw: L.lw * 0.4, shade: '#E2E6EE', dx: r * 0.05, dy: r * 0.06 });
}

/** A chain of small links along a curve. */
export function drawChain(ctx: Ctx, pts: number[], link: number, lw: number): void {
  const s = sampleCurve(pts, 30, false);
  let acc = 0;
  let k = 0;
  for (let i = 1; i < s.length; i++) {
    acc += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
    if (acc < link * 1.45) continue;
    acc = 0;
    const ang = Math.atan2(s[i].y - s[i - 1].y, s[i].x - s[i - 1].x);
    const e = k % 2 === 0 ? ellipse(s[i].x, s[i].y, link, link * 0.62, ang) : ellipse(s[i].x, s[i].y, link * 0.95, link * 0.28, ang);
    if (k % 2 === 0) {
      stroke(ctx, e, OUTLINE, link * 0.5 + lw * 1.3);
      stroke(ctx, e, C.gold, link * 0.5);
      stroke(ctx, ellipse(s[i].x - link * 0.08, s[i].y - link * 0.12, link * 0.9, link * 0.5, ang), rgba(C.goldHi, 0.8), link * 0.16);
    } else {
      cel(ctx, e, C.goldShade, { lw: lw * 0.65 });
    }
    k++;
  }
}

/** Ring with a gem. Origin: center of the band. */
export function drawRingItem(ctx: Ctx, L: Look, r: number): ItemMeta {
  const lw = L.lw;
  const band = ellipse(0, r * 0.1, r * 0.8, r * 0.6);
  const bw = r * 0.34;
  stroke(ctx, band, OUTLINE, bw + lw * 2);
  stroke(ctx, band, L.main, bw);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-r * 2, r * 0.12, r * 4, r * 2);
  ctx.clip();
  stroke(ctx, band, L.shade, bw);
  ctx.restore();
  stroke(ctx, ellipse(-r * 0.04, r * 0.06, r * 0.8, r * 0.6), rgba('#FFFFFF', 0.55), bw * 0.25);
  if (L.rarity === 'shiny' || L.rarity === 'mythic') stroke(ctx, ellipse(0, r * 0.1, r * 0.8, r * 0.6), rgba('#FFFFFF', 0.35), bw * 0.5);
  if (L.rarity === 'legendary') stroke(ctx, ellipse(0, r * 0.1, r * 0.8, r * 0.6), '#FFE680', bw * 0.35);
  if (L.rarity === 'mythic') {
    const g = ctx.createLinearGradient(-r, 0, r, 0);
    MYTHIC_RAINBOW.forEach((c, i) => g.addColorStop(i / (MYTHIC_RAINBOW.length - 1), c));
    ctx.save();
    ctx.globalAlpha = 0.45;
    stroke(ctx, band, g, bw);
    ctx.restore();
  }
  // re-ink the band edges so the front reads over the back
  stroke(ctx, ellipse(0, r * 0.1, r * 0.8 + bw / 2, r * 0.6 + bw / 2), OUTLINE, lw * 0.6);
  // gem in a little setting
  const gy = -r * 0.5 - r * 0.12;
  cel(ctx, rrect(-r * 0.28, gy + r * 0.06, r * 0.56, r * 0.24, r * 0.08), L.shade, { lw: lw * 0.8 });
  const gem = polar(0, gy - r * 0.08, (a) => r * 0.3 * (1 - 0.06 * Math.cos(a * 6)), 48);
  celMulti(ctx, gem, lw * 0.8, r * 0.08, r * 0.1, (dark) => fill(ctx, gem, dark ? '#38B8E0' : '#8FEBFF'));
  fill(ctx, poly3(-r * 0.12, gy - r * 0.22, r * 0.02, gy - r * 0.26, -r * 0.06, gy - r * 0.1), '#FFFFFF');
  return { box: { x: -r * 1.05, y: gy - r * 0.42, w: r * 2.1, h: r * 1.3 + r * 0.42 + r * 0.25 }, tape: { x: r * 0.4, y: r * 0.55, ang: -0.6, len: r * 0.9 }, tag: { x: r * 0.8, y: r * 0.4 } };
}

function poly3(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): Path2D {
  return smooth([x0, y0, x1, y1, x2, y2], true, 0.4);
}

/** Big BBQ spatula, pointing up. Origin: the grip. ~54 wide x 172 long (+ hanging loop). */
export function drawSpatula(ctx: Ctx, L: Look): ItemMeta {
  const lw = L.lw;
  // hanging loop
  stroke(ctx, circle(0, 31, 5.5), OUTLINE, 3.6 + lw * 2);
  stroke(ctx, circle(0, 31, 5.5), C.silver, 3.6);
  // handle with tape wraps
  const handle = rrect(-9.5, -33, 19, 60, 9);
  celMulti(ctx, handle, lw, 4, 3, (dark) => {
    fill(ctx, handle, dark ? '#4E3326' : '#6E4630');
    const t = dark ? '#C9B98F' : '#EADBB0';
    for (const y of [-24, -5, 14]) fill(ctx, rrect(-12, y, 24, 7, 0), t);
  });
  inClip(ctx, handle, () => softSpot(ctx, -4, -6, 2.5, 22, '#FFFFFF', 0.3));
  // long thin metal neck + collar (thin where it crosses the hero's face)
  cel(ctx, rrect(-4.5, -86, 9, 50, 3), C.silver, { lw, shade: C.silverShade, dx: 3, dy: 0, hi: { x: -1.5, y: -62, rx: 1.2, ry: 16, a: 0.8 } });
  cel(ctx, rrect(-12.5, -44, 25, 13, 5), C.silver, { lw, shade: C.silverShade, dx: 4, dy: 2, hi: { x: -6, y: -40, rx: 5, ry: 2, a: 0.7 } });
  fill(ctx, circle(-6, -37.5, 2.2), OUTLINE);
  fill(ctx, circle(6, -37.5, 2.2), OUTLINE);
  // the big head
  const head = roundPoly([-16, -82, 16, -82, 27, -146, -27, -146], [7, 7, 13, 13]);
  const slot = (x: number, y0: number, y1: number) => rrect(x - 3.4, y0, 6.8, y1 - y0, 3.4);
  const slots = [slot(-12.5, -134, -96), slot(0, -136, -92), slot(12.5, -134, -96)];
  mainPart(ctx, head, L, {
    box: { x: -27, y: -146, w: 54, h: 64 },
    dx: 7,
    dy: 3,
    extra: (dark) => {
      for (const sl of slots) fill(ctx, sl, dark ? shadeOf(L.shade, 0.3) : shadeOf(L.main, 0.3));
    },
    hi: { x: -17, y: -131, rx: 4, ry: 10, a: 0.55, rot: 0.15 },
  });
  for (const sl of slots) stroke(ctx, sl, OUTLINE, lw * 0.75);
  return { box: { x: -27, y: -146, w: 54, h: 183 }, tape: { x: 2, y: -112, ang: -0.7, len: 46 }, tag: { x: 12, y: -40 } };
}

/** The default weapon: a plain wooden branch. Origin: the grip. */
export function drawStick(ctx: Ctx, lw: number): ItemMeta {
  const twig = tube([1, -78, 13, -95, 17, -104], [8, 6, 4.5]);
  cel(ctx, twig, C.wood, { lw, shade: C.woodShade, dx: 2, dy: 1 });
  const leaf = smooth([16, -104, 26, -116, 34, -112, 27, -103], true);
  cel(ctx, leaf, C.leaf, { lw: lw * 0.8, shade: C.leafShade, dx: 2, dy: 3 });
  ink(ctx, [19, -105, 29, -111], lw * 0.4, rgba(C.leafLine, 0.8), false);
  const branch = tube([0, 30, -2, 2, 1, -42, -2, -86, 2, -130], [17, 17, 15.5, 14, 11]);
  celMulti(ctx, branch, lw, 5, 2, (dark) => {
    fill(ctx, branch, dark ? C.woodShade : C.wood);
    fill(ctx, ellipse(-1, -52, 5, 3), dark ? C.woodDark : C.woodShade);
    fill(ctx, ellipse(1.5, -108, 4, 2.6), dark ? C.woodDark : C.woodShade);
  });
  inClip(ctx, branch, () => {
    ink(ctx, [-4, 20, -5, -20, -3, -40], 1.6, rgba(C.woodDark, 0.45));
    ink(ctx, [3, -60, 2, -96, 4, -118], 1.6, rgba(C.woodDark, 0.45));
    softSpot(ctx, -4, -60, 2.5, 40, '#FFFFFF', 0.25);
  });
  stroke(ctx, ellipse(-1, -52, 5, 3), OUTLINE, lw * 0.45);
  // cut end at the top
  cel(ctx, ellipse(2, -130, 5.5, 3), C.woodLight, { lw: lw * 0.5 });
  return { box: { x: -10, y: -134, w: 46, h: 172 } };
}

/** Front-view vest for icons. Origin: center. ~84 x 90. */
export function drawVestIcon(ctx: Ctx, L: Look): ItemMeta {
  const lw = L.lw;
  const left = smooth([-12, -44, -24, -42, -34, -30, -40, -6, -40, 22, -36, 44, -6, 46, -4, 10, -8, -18], true);
  const right = smooth([12, -44, 24, -42, 34, -30, 40, -6, 40, 22, 36, 44, 6, 46, 4, 10, 8, -18], true);
  // inner back (the lining seen through the neckline)
  cel(ctx, smooth([-14, -42, 14, -42, 6, 0, -6, 0], true), shadeOf(L.shade, 0.25), { lw });
  for (const p of [left, right]) {
    mainPart(ctx, p, L, { box: { x: -40, y: -44, w: 80, h: 90 }, dx: 5, dy: 6, hi: null });
  }
  // armholes
  for (const sx of [-1, 1]) {
    stroke(ctx, smooth([sx * 34, -30, sx * 27, -14, sx * 36, 0], false), OUTLINE, lw * 0.7);
  }
  // pockets
  for (const sx of [-1, 1]) {
    const pk = rrect(sx > 0 ? 12 : -32, 18, 20, 16, 5);
    mainPart(ctx, pk, L, { box: { x: sx > 0 ? 12 : -32, y: 18, w: 20, h: 16 }, dx: 2, dy: 3, hi: null, trim: false });
    ink(ctx, [sx > 0 ? 14 : -30, 23, sx > 0 ? 30 : -14, 23], lw * 0.5, OUTLINE, false);
  }
  // buttons
  for (const y of [-6, 12, 30]) cel(ctx, circle(-9, y, 3.6), '#FFF6E0', { lw: lw * 0.6, shade: '#E2D3B4', dx: 1, dy: 1.5 });
  return { box: { x: -40, y: -44, w: 80, h: 90 }, tape: { x: -22, y: -6, ang: 0.5, len: 26 }, tag: { x: 36, y: 30 } };
}
