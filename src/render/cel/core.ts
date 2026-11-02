/**
 * Canvas 2D toolkit for the cel look: flat fill, one hard-edged shadow tone, a small soft highlight,
 * and a uniform dark outline with round joins. Shapes are Path2D objects so they can be stroked,
 * filled and used as clips repeatedly. Everything is deterministic (seeded PRNG only).
 */
import { OUTLINE } from './palette';

export interface Pt { x: number; y: number }
export type Ctx = CanvasRenderingContext2D;
export type Rng = () => number;

export function makeCanvas(w: number, h: number): { c: HTMLCanvasElement; ctx: Ctx } {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return { c, ctx };
}

/** mulberry32 */
export function rng(seed: number): Rng {
  let s = (seed >>> 0) || 0x9e3779b9;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ------------------------------------------------------------------ color
export function rgbOf(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hexOf(r: number, g: number, b: number): string {
  const f = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}

export function mix(a: string, b: string, t: number): string {
  const A = rgbOf(a);
  const B = rgbOf(b);
  return hexOf(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function toHsl(hex: string): [number, number, number] {
  const [r0, g0, b0] = rgbOf(hex);
  const r = r0 / 255, g = g0 / 255, b = b0 / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = 0;
  if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h: number, s: number, l: number): string {
  const hh = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return hexOf(l * 255, l * 255, l * 255);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return hexOf(f(hh + 1 / 3) * 255, f(hh) * 255, f(hh - 1 / 3) * 255);
}

/** Cel shadow tone: darker, a touch more saturated, hue nudged toward blue-violet. */
export function shadeOf(hex: string, k = 0.2): string {
  const [h, s, l] = toHsl(hex);
  const target = 250;
  let dh = target - h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const nh = h + dh * 0.08 * (s > 0.05 ? 1 : 0);
  const ns = s < 0.05 ? 0.06 : clamp(s * 1.06 + 0.03, 0, 1);
  return fromHsl(s < 0.05 ? 250 : nh, ns, clamp(l * (1 - k) - 0.02, 0, 1));
}

export function lightOf(hex: string, k = 0.35): string {
  return mix(hex, '#FFFFFF', k);
}

export function desat(hex: string, k: number): string {
  const [r, g, b] = rgbOf(hex);
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  return hexOf(lerp(r, l, k), lerp(g, l, k), lerp(b, l, k));
}

// ------------------------------------------------------------------ paths
export function circle(cx: number, cy: number, r: number): Path2D {
  const p = new Path2D();
  p.arc(cx, cy, Math.max(0.01, r), 0, TAU);
  return p;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0): Path2D {
  const p = new Path2D();
  p.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
  return p;
}

export function rrect(x: number, y: number, w: number, h: number, r: number): Path2D {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  const p = new Path2D();
  p.moveTo(x + rr, y);
  p.lineTo(x + w - rr, y);
  p.arcTo(x + w, y, x + w, y + rr, rr);
  p.lineTo(x + w, y + h - rr);
  p.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  p.lineTo(x + rr, y + h);
  p.arcTo(x, y + h, x, y + h - rr, rr);
  p.lineTo(x, y + rr);
  p.arcTo(x, y, x + rr, y, rr);
  p.closePath();
  return p;
}

export function poly(pts: number[], closed = true): Path2D {
  const p = new Path2D();
  p.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
  if (closed) p.closePath();
  return p;
}

function ptAt(pts: number[], i: number, closed: boolean): Pt {
  const n = pts.length / 2;
  let j = i;
  if (closed) j = ((i % n) + n) % n;
  else j = clamp(i, 0, n - 1);
  return { x: pts[2 * j], y: pts[2 * j + 1] };
}

/** Smooth Catmull-Rom curve through the points (closed loop or open run). */
export function smooth(pts: number[], closed = true, tension = 1): Path2D {
  const n = pts.length / 2;
  const p = new Path2D();
  const s = tension / 6;
  const first = ptAt(pts, 0, closed);
  p.moveTo(first.x, first.y);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = ptAt(pts, i - 1, closed);
    const p1 = ptAt(pts, i, closed);
    const p2 = ptAt(pts, i + 1, closed);
    const p3 = ptAt(pts, i + 2, closed);
    p.bezierCurveTo(p1.x + (p2.x - p0.x) * s, p1.y + (p2.y - p0.y) * s, p2.x - (p3.x - p1.x) * s, p2.y - (p3.y - p1.y) * s, p2.x, p2.y);
  }
  if (closed) p.closePath();
  return p;
}

/** Points along a Catmull-Rom curve (open). */
export function sampleCurve(pts: number[], steps = 10, closed = false): Pt[] {
  const n = pts.length / 2;
  const out: Pt[] = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = ptAt(pts, i - 1, closed);
    const p1 = ptAt(pts, i, closed);
    const p2 = ptAt(pts, i + 1, closed);
    const p3 = ptAt(pts, i + 2, closed);
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  if (!closed) out.push(ptAt(pts, n - 1, false));
  return out;
}

/** Polygon with rounded corners (radius per corner or one for all). */
export function roundPoly(pts: number[], r: number | number[]): Path2D {
  const n = pts.length / 2;
  const V = (i: number) => ptAt(pts, i, true);
  const p = new Path2D();
  const a = V(n - 1), b = V(0);
  p.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
  for (let i = 0; i < n; i++) {
    const v = V(i), w = V(i + 1);
    const rr = Array.isArray(r) ? r[i] ?? 0 : r;
    p.arcTo(v.x, v.y, (v.x + w.x) / 2, (v.y + w.y) / 2, rr);
  }
  p.closePath();
  return p;
}

export function union(...paths: Path2D[]): Path2D {
  const p = new Path2D();
  for (const q of paths) p.addPath(q);
  return p;
}

export function moved(p: Path2D, dx: number, dy: number): Path2D {
  const q = new Path2D();
  q.addPath(p, new DOMMatrix([1, 0, 0, 1, dx, dy]));
  return q;
}

export function transformed(p: Path2D, m: DOMMatrix): Path2D {
  const q = new Path2D();
  q.addPath(p, m);
  return q;
}

/**
 * A tapered tube along a smooth curve (tails, arms, poles). `widths` gives the full width at each
 * control point (interpolated along the curve); ends are rounded.
 */
export function tube(pts: number[], widths: number[], steps = 8): Path2D {
  const s = sampleCurve(pts, steps, false);
  const n = s.length;
  const nCtl = pts.length / 2;
  const wAt = (i: number) => {
    const u = (i / (n - 1)) * (nCtl - 1);
    const k = Math.min(nCtl - 2, Math.floor(u));
    const f = u - k;
    const a = widths[Math.min(k, widths.length - 1)];
    const b = widths[Math.min(k + 1, widths.length - 1)];
    return lerp(a, b, f) / 2;
  };
  const L: Pt[] = [];
  const R: Pt[] = [];
  const ang: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = s[Math.max(0, i - 1)];
    const b = s[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y;
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    const w = wAt(i);
    L.push({ x: s[i].x - ty * w, y: s[i].y + tx * w });
    R.push({ x: s[i].x + ty * w, y: s[i].y - tx * w });
    ang.push(Math.atan2(ty, tx));
  }
  const p = new Path2D();
  p.moveTo(L[0].x, L[0].y);
  for (let i = 1; i < n; i++) p.lineTo(L[i].x, L[i].y);
  p.arc(s[n - 1].x, s[n - 1].y, wAt(n - 1), ang[n - 1] + Math.PI / 2, ang[n - 1] - Math.PI / 2, true);
  for (let i = n - 1; i >= 0; i--) p.lineTo(R[i].x, R[i].y);
  p.arc(s[0].x, s[0].y, wAt(0), ang[0] - Math.PI / 2, ang[0] + Math.PI / 2, true);
  p.closePath();
  return p;
}

/** Star with n points (alternating outer/inner radius). */
export function star(cx: number, cy: number, rOut: number, rIn: number, n: number, rot = -Math.PI / 2): Path2D {
  const pts: number[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = rot + (i / (n * 2)) * TAU;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return poly(pts);
}

/** Four-point sparkle with concave curved sides. */
export function sparkle4(cx: number, cy: number, r: number, waist = 0.16, rot = 0): Path2D {
  const p = new Path2D();
  const pt = (a: number, rr: number) => ({ x: cx + Math.cos(a + rot) * rr, y: cy + Math.sin(a + rot) * rr });
  for (let i = 0; i < 4; i++) {
    const a0 = (i / 4) * TAU - Math.PI / 2;
    const tip = pt(a0, r);
    const nextTip = pt(a0 + TAU / 4, r);
    const ctl = pt(a0 + TAU / 8, r * waist);
    if (i === 0) p.moveTo(tip.x, tip.y);
    p.quadraticCurveTo(ctl.x, ctl.y, nextTip.x, nextTip.y);
  }
  p.closePath();
  return p;
}

/** Closed outline sampled from a polar radius function (fluffy clouds, bushes, fur). */
export function polar(cx: number, cy: number, rFn: (a: number) => number, n = 120, sy = 1): Path2D {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const r = rFn(a);
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r * sy);
  }
  return poly(pts);
}

// ------------------------------------------------------------------ painting
export function fill(ctx: Ctx, p: Path2D, color: string | CanvasGradient | CanvasPattern, rule: CanvasFillRule = 'nonzero'): void {
  ctx.fillStyle = color;
  ctx.fill(p, rule);
}

export function stroke(ctx: Ctx, p: Path2D, color: string | CanvasGradient, width: number, cap: CanvasLineCap = 'round'): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = cap;
  ctx.stroke(p);
  ctx.restore();
}

/** Outline that shows `lw` px outside the shape (stroke centered on the edge, fill drawn after). */
export function outline(ctx: Ctx, p: Path2D, lw: number, color = OUTLINE): void {
  if (lw > 0) stroke(ctx, p, color, lw * 2);
}

/** Clip to the part of `region` that is in cel shadow: region minus region shifted by (-dx,-dy). */
export function clipShadow(ctx: Ctx, region: Path2D, dx: number, dy: number): void {
  ctx.clip(region);
  const q = new Path2D();
  q.rect(-20000, -20000, 40000, 40000);
  q.addPath(region, new DOMMatrix([1, 0, 0, 1, -dx, -dy]));
  ctx.clip(q, 'evenodd');
}

export interface Hi { x: number; y: number; rx: number; ry: number; a?: number; rot?: number; color?: string }

export interface CelOpts {
  lw?: number;
  line?: string;
  shade?: string | null;
  dx?: number;
  dy?: number;
  hi?: Hi | null;
}

/** Soft-edged elliptical spot (highlights, glows, blush). */
export function softSpot(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string, alpha: number, rot = 0, core = 0.55): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(Math.max(0.01, rx), Math.max(0.01, ry));
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(core, rgba(color, alpha * 0.9));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function highlight(ctx: Ctx, clipP: Path2D, h: Hi): void {
  ctx.save();
  ctx.clip(clipP);
  softSpot(ctx, h.x, h.y, h.rx, h.ry, h.color ?? '#FFFFFF', h.a ?? 0.55, h.rot ?? 0, 0.6);
  ctx.restore();
}

/**
 * The basic cel part: outline, flat fill, one hard shadow (the shape minus itself shifted toward the
 * light, i.e. a crescent on the lower/right side), and a small soft highlight.
 */
export function cel(ctx: Ctx, p: Path2D, color: string, o: CelOpts = {}): void {
  const lw = o.lw ?? 0;
  if (lw > 0) outline(ctx, p, lw, o.line ?? OUTLINE);
  fill(ctx, p, color);
  if (o.shade) {
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = o.shade;
    ctx.fill(p);
    ctx.fillStyle = color;
    ctx.fill(moved(p, -(o.dx ?? 0), -(o.dy ?? 6)));
    ctx.restore();
  }
  if (o.hi) highlight(ctx, p, o.hi);
}

/**
 * Multi-colored cel part: `paint(dark)` draws all of the part's fills; it is called once lit, then
 * again (dark = true, with shadow colors) inside the shadow crescent of `region`.
 */
export function celMulti(ctx: Ctx, region: Path2D, lw: number, dx: number, dy: number, paint: (dark: boolean) => void, line = OUTLINE): void {
  if (lw > 0) outline(ctx, region, lw, line);
  ctx.save();
  ctx.clip(region);
  paint(false);
  ctx.restore();
  ctx.save();
  clipShadow(ctx, region, dx, dy);
  paint(true);
  ctx.restore();
}

/** Draw `fn` clipped to `p`. */
export function inClip(ctx: Ctx, p: Path2D, fn: () => void): void {
  ctx.save();
  ctx.clip(p);
  fn();
  ctx.restore();
}

/** An ink line through points (smooth when `curve`). */
export function ink(ctx: Ctx, pts: number[], width: number, color = OUTLINE, curve = true): void {
  const p = curve && pts.length > 4 ? smooth(pts, false) : poly(pts, false);
  stroke(ctx, p, color, width);
}

/** Draws `fn` at x and again shifted by the tile width when it would cross a tile edge. */
export function wrapX(W: number, x: number, half: number, fn: (x: number) => void): void {
  fn(x);
  if (x - half < 0) fn(x + W);
  if (x + half > W) fn(x - W);
}

/** Dilated tinted silhouette of `src` (used for glow outlines and empty-slot ghosts). */
export function silhouette(src: HTMLCanvasElement, color: string, grow = 0): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(src.width, src.height);
  if (grow > 0) {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      ctx.drawImage(src, Math.cos(a) * grow, Math.sin(a) * grow);
    }
  }
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}
