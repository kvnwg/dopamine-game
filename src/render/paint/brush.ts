/**
 * Canvas 2D brush toolkit for the painterly storybook placeholder art:
 * hand-inked dark-plum lines with varied weight, gouache/watercolor fills with wet edges
 * and granulation, painterly shading with hard and soft edges, glows, and paper grain.
 * Cosmetic only (render layer): uses its own seeded generator, never game state.
 */
export type Pt = { x: number; y: number };
export type Ctx = CanvasRenderingContext2D;
export type Rnd = () => number;

/** Dark plum ink (never black) and the cozy-night light colors. */
export const INK = '#3E1F42';
export const INK_DEEP = '#2A1430';
export const LAMP = '#FFB347';
export const NEON_PINK = '#FF3EA5';
export const NEON_CYAN = '#2EE6FF';
export const SHADOW_PLUM = '#4A2550';

export function seeded(seed: number): Rnd {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w: number, h: number): { c: HTMLCanvasElement; ctx: Ctx } {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

// ------------------------------------------------------------------ color
export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a: string, b: string, t: number): string {
  const A = rgb(a);
  const B = rgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
export function rgba(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
/** Shadows lean toward plum, which keeps the night palette cozy instead of muddy. */
export function shadowOf(hex: string, k = 0.5): string {
  return mix(hex, SHADOW_PLUM, k);
}
export function desaturate(hex: string, k: number): string {
  const [r, g, b] = rgb(hex);
  const l = Math.round(0.3 * r + 0.59 * g + 0.11 * b);
  const gray = `#${[l, l, l].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  return mix(hex, gray, k);
}

// ------------------------------------------------------------------ shapes (point loops)
export function ellipse(cx: number, cy: number, rx: number, ry: number, n = 40): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return out;
}

export function rrect(x: number, y: number, w: number, h: number, r: number): Pt[] {
  const out: Pt[] = [];
  const rr = Math.min(r, w / 2, h / 2);
  const corners: Array<[number, number, number]> = [
    [x + w - rr, y + rr, -90],
    [x + w - rr, y + h - rr, 0],
    [x + rr, y + h - rr, 90],
    [x + rr, y + rr, 180],
  ];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= 6; i++) {
      const a = ((start + (i / 6) * 90) * Math.PI) / 180;
      out.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
    }
  }
  return out;
}

export const P = (x: number, y: number): Pt => ({ x, y });

export function translate(pts: Pt[], dx: number, dy: number): Pt[] {
  return pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

export function bbox(pts: Pt[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** Subdivide long edges so the hand-drawn wobble has points to move. */
export function densify(pts: Pt[], closed: boolean, maxSeg = 12): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  const edges = closed ? n : n - 1;
  for (let i = 0; i < edges; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const k = Math.max(1, Math.ceil(len / maxSeg));
    for (let j = 0; j < k; j++) out.push({ x: a.x + ((b.x - a.x) * j) / k, y: a.y + ((b.y - a.y) * j) / k });
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

/** Slightly imperfect handmade edges: push points along their normals by smooth noise. */
export function wobble(pts: Pt[], amp: number, rnd: Rnd, closed = true): Pt[] {
  if (amp <= 0) return pts;
  const n = pts.length;
  const ph1 = rnd() * Math.PI * 2;
  const ph2 = rnd() * Math.PI * 2;
  const f1 = 1 + Math.floor(rnd() * 3);
  const f2 = 4 + Math.floor(rnd() * 4);
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    let nx = -(b.y - a.y);
    let ny = b.x - a.x;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    if (!closed && (i === 0 || i === n - 1)) return p;
    const t = i / n;
    const d = amp * (0.65 * Math.sin(t * f1 * Math.PI * 2 + ph1) + 0.35 * Math.sin(t * f2 * Math.PI * 2 + ph2));
    return { x: p.x + nx * d, y: p.y + ny * d };
  });
}

/** Adds a smooth (midpoint-quadratic) subpath; caller owns beginPath/fill/stroke. */
export function addSmooth(ctx: Ctx, pts: Pt[], closed: boolean): void {
  const n = pts.length;
  if (n < 2) return;
  if (!closed) {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n - 1; i++) {
      const m = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
    }
    ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
    return;
  }
  const m0 = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  ctx.moveTo(m0.x, m0.y);
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n];
    const q = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
  }
  ctx.closePath();
}

export function fillShape(ctx: Ctx, pts: Pt[], color: string, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  addSmooth(ctx, pts, true);
  ctx.fill();
  ctx.restore();
}

/** Points along the smoothed path (for ink strokes with varying width). */
export function sampleSmooth(pts: Pt[], closed: boolean, steps = 5): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  const quad = (a: Pt, c: Pt, b: Pt) => {
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      out.push({ x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y });
    }
  };
  if (closed) {
    for (let i = 0; i < n; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % n];
      const p2 = pts[(i + 2) % n];
      quad({ x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }, p1, { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });
    }
    out.push(out[0]);
  } else {
    out.push(pts[0]);
    for (let i = 1; i < n - 1; i++) {
      const a = i === 1 ? pts[0] : { x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 };
      quad(a, pts[i], { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 });
    }
    out.push(pts[n - 1]);
  }
  return out;
}

// ------------------------------------------------------------------ texture sources
const cache = new Map<string, HTMLCanvasElement>();

/** Watercolor pigment granulation: sparse dark speckles, used with multiply. */
export function granulation(size = 192, seed = 7): HTMLCanvasElement {
  const key = `gran_${size}_${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { c, ctx } = makeCanvas(size, size);
  const rnd = seeded(seed);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = rnd();
    const dark = v < 0.12 ? 150 + rnd() * 60 : 255;
    img.data[i * 4] = dark;
    img.data[i * 4 + 1] = dark - 6;
    img.data[i * 4 + 2] = dark;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // Soft pigment pooling blotches.
  for (let i = 0; i < 10; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 14 + rnd() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(120,90,130,0.18)');
    g.addColorStop(1, 'rgba(120,90,130,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  cache.set(key, c);
  return c;
}

/** Paper grain: transparent canvas of light and dark flecks plus a few fibers (normal blending). */
export function paperGrain(size = 256, seed = 11): HTMLCanvasElement {
  const key = `paper_${size}_${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { c, ctx } = makeCanvas(size, size);
  const rnd = seeded(seed);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = rnd();
    const light = v > 0.5;
    const a = Math.abs(v - 0.5) * 2;
    const tone = light ? 255 : 40;
    img.data[i * 4] = tone;
    img.data[i * 4 + 1] = light ? 246 : 22;
    img.data[i * 4 + 2] = light ? 232 : 44;
    img.data[i * 4 + 3] = Math.round(Math.pow(a, 3) * 70);
  }
  ctx.putImageData(img, 0, 0);
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const len = 6 + rnd() * 16;
    const ang = rnd() * Math.PI;
    ctx.strokeStyle = rnd() > 0.5 ? 'rgba(255,248,235,0.12)' : 'rgba(40,20,45,0.10)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 + 2, y + Math.sin(ang) * len * 0.5 - 2, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  cache.set(key, c);
  return c;
}

// ------------------------------------------------------------------ painting
export interface PaintOpts {
  color: string;
  /** Hard-edged shadow color (defaults to the color pushed toward plum). */
  shadow?: string;
  /** 0..1 strength of the hard-edged shadow crescent (bottom right). */
  hard?: number;
  /** Warm soft light from the top left. */
  light?: string;
  lightAlpha?: number;
  /** Neon rim light color on the right (or left with rimSide = -1). */
  rim?: string | null;
  rimSide?: 1 | -1;
  /** Granulation strength. */
  grain?: number;
  /** Edge wobble in px. */
  wobble?: number;
  /** Watercolor bleed halo strength. */
  bleed?: number;
}

/**
 * Gouache/watercolor body: a bleed halo, pigment layers with uneven blotches, a hard-edged
 * shadow crescent away from the light, a soft warm light pool, granulation, and a darker wet edge.
 */
export function paint(ctx: Ctx, rnd: Rnd, base: Pt[], o: PaintOpts): Pt[] {
  const pts = densify(base, true);
  const body = wobble(pts, o.wobble ?? 1.4, rnd);
  const b = bbox(body);
  const size = Math.max(b.w, b.h);
  ctx.save();
  // Bleed halo: pigment that crept past the edge.
  fillShape(ctx, wobble(pts, (o.wobble ?? 1.4) + 2.5, rnd), o.color, o.bleed ?? 0.16);
  fillShape(ctx, body, o.color, 0.96);
  ctx.beginPath();
  addSmooth(ctx, body, true);
  ctx.clip();
  // Uneven pigment: a few soft lighter and darker blooms.
  for (let i = 0; i < 4; i++) {
    const x = b.x + rnd() * b.w;
    const y = b.y + rnd() * b.h;
    const r = size * (0.2 + rnd() * 0.35);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tint = i % 2 === 0 ? mix(o.color, '#FFFFFF', 0.25) : shadowOf(o.color, 0.35);
    g.addColorStop(0, rgba(tint, 0.22));
    g.addColorStop(1, rgba(tint, 0));
    ctx.fillStyle = g;
    ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
  }
  // Hard-edged shadow crescent on the side away from the top-left light.
  const hard = o.hard ?? 0.42;
  if (hard > 0) {
    const d = Math.max(3, size * 0.11);
    ctx.globalAlpha = hard;
    ctx.fillStyle = o.shadow ?? shadowOf(o.color, 0.55);
    ctx.beginPath();
    ctx.rect(b.x - 10, b.y - 10, b.w + 20, b.h + 20);
    addSmooth(ctx, translate(wobble(body, 1.5, rnd), -d * 0.75, -d), true);
    ctx.fill('evenodd');
    ctx.globalAlpha = 1;
  }
  // Soft warm lamp light from the top left.
  const la = o.lightAlpha ?? 0.3;
  if (la > 0) {
    const lx = b.x + b.w * 0.28;
    const ly = b.y + b.h * 0.2;
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, size * 0.75);
    g.addColorStop(0, rgba(o.light ?? LAMP, la));
    g.addColorStop(1, rgba(o.light ?? LAMP, 0));
    ctx.fillStyle = g;
    ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
  }
  // Granulation.
  const gr = o.grain ?? 0.22;
  if (gr > 0) {
    ctx.globalAlpha = gr;
    ctx.globalCompositeOperation = 'multiply';
    const pat = ctx.createPattern(granulation(), 'repeat');
    if (pat) {
      ctx.fillStyle = pat;
      ctx.save();
      ctx.translate(rnd() * 100, rnd() * 100);
      ctx.fillRect(b.x - 120, b.y - 120, b.w + 240, b.h + 240);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  // Wet edge: pigment darkens where the wash dried at its border.
  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = shadowOf(o.color, 0.45);
  ctx.lineWidth = Math.max(3, size * 0.05);
  ctx.filter = 'blur(1.5px)';
  ctx.beginPath();
  addSmooth(ctx, body, true);
  ctx.stroke();
  ctx.filter = 'none';
  ctx.restore();
  if (o.rim) rimLight(ctx, body, o.rim, o.rimSide ?? 1);
  return body;
}

/** Colored rim light hugging one side of a painted shape (neon on one side, lamp on the other). */
export function rimLight(ctx: Ctx, body: Pt[], color: string, side: 1 | -1, strength = 0.9): void {
  const b = bbox(body);
  const size = Math.max(b.w, b.h);
  ctx.save();
  const g = ctx.createLinearGradient(b.cx, 0, side > 0 ? b.x + b.w : b.x, 0);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(0.55, rgba(color, 0));
  g.addColorStop(1, rgba(color, strength));
  ctx.strokeStyle = g;
  ctx.lineWidth = Math.max(2.5, size * 0.035);
  ctx.beginPath();
  addSmooth(ctx, translate(body, -side * 1.5, 0), true);
  ctx.stroke();
  ctx.restore();
}

/** Run `fn` with the canvas clipped to a painted body. */
export function within(ctx: Ctx, body: Pt[], fn: () => void): void {
  ctx.save();
  ctx.beginPath();
  addSmooth(ctx, body, true);
  ctx.clip();
  fn();
  ctx.restore();
}

/** A small four-point sparkle. */
export function sparkle(ctx: Ctx, x: number, y: number, r: number, color = '#FFFFFF', alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.28;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export interface InkOpts {
  closed?: boolean;
  width?: number;
  color?: string;
  jitter?: number;
  /** Fraction of the path to overshoot past the start on closed shapes (sketchy closure). */
  overshoot?: number;
  alpha?: number;
}

/** Hand-inked line with pressure-varied weight, tapered ends, and a faint second pass. */
export function ink(ctx: Ctx, rnd: Rnd, base: Pt[], o: InkOpts = {}): void {
  const closed = o.closed ?? true;
  const w = o.width ?? 5;
  const pts0 = wobble(densify(base, closed, 10), o.jitter ?? 1.1, rnd, closed);
  let pts = sampleSmooth(pts0, closed, 4);
  if (closed) {
    const extra = Math.floor(pts.length * (o.overshoot ?? 0.04));
    pts = pts.concat(pts.slice(1, 1 + extra).map((p) => ({ x: p.x + 0.8, y: p.y - 0.6 })));
  }
  const ph = rnd() * Math.PI * 2;
  const f = 2 + rnd() * 3;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.strokeStyle = o.color ?? INK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const t = i / (n - 1);
    const pressure = 0.58 + 0.42 * (0.5 + 0.5 * Math.sin(t * f * Math.PI * 2 + ph));
    const taper = closed ? Math.min(1, 0.35 + t * 8, 0.35 + (1 - t) * 8) : Math.min(1, t * 7 + 0.15, (1 - t) * 7 + 0.15);
    ctx.lineWidth = Math.max(0.6, w * pressure * taper);
    ctx.beginPath();
    ctx.moveTo(pts[i].x, pts[i].y);
    ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
    ctx.stroke();
  }
  // Faint second pass over part of the line: the handmade double stroke.
  const from = Math.floor(n * (0.15 + rnd() * 0.3));
  const to = Math.min(n - 1, from + Math.floor(n * (0.2 + rnd() * 0.25)));
  ctx.globalAlpha = (o.alpha ?? 1) * 0.3;
  ctx.lineWidth = Math.max(0.6, w * 0.35);
  ctx.beginPath();
  for (let i = from; i <= to; i++) {
    const p = pts[i];
    if (i === from) ctx.moveTo(p.x + 1.2, p.y - 0.8);
    else ctx.lineTo(p.x + 1.2, p.y - 0.8);
  }
  ctx.stroke();
  ctx.restore();
}

/** Paint then ink a shape in one go. Returns the painted body loop. */
export function shape(ctx: Ctx, rnd: Rnd, pts: Pt[], o: PaintOpts & { line?: number; ink?: string }): Pt[] {
  const body = paint(ctx, rnd, pts, o);
  if ((o.line ?? 5) > 0) ink(ctx, rnd, pts, { width: o.line ?? 5, color: o.ink });
  return body;
}

/** A free brush stroke (open path) in a color, with taper. */
export function stroke(ctx: Ctx, rnd: Rnd, pts: Pt[], width: number, color: string, alpha = 1): void {
  ink(ctx, rnd, pts, { closed: false, width, color, alpha, jitter: 0.8 });
}

/** Additive glow (lamp halos, neon). */
export function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha = 0.6): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.35, rgba(color, alpha * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** Soft watercolor wash over a rectangle area (sky blooms, steam). */
export function bloom(ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.7, rgba(color, alpha * 0.4));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Lays paper grain over the whole canvas. */
export function grainOver(ctx: Ctx, w: number, h: number, alpha = 0.6): void {
  const pat = ctx.createPattern(paperGrain(), 'repeat');
  if (!pat) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
