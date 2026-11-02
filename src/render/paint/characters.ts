/**
 * Painted characters for the storybook look: gouache bodies, dark-plum ink with varied
 * weight, warm lamp light from the top left, and neon rim light (cyan on the raccoon,
 * pink on its foes). Drawn with the feet at (ox, oy).
 */
import { DATA, type EnemyShape } from '../../data';
import {
  bloom, ellipse, fillShape, glow, ink, INK_DEEP, mix, NEON_CYAN, NEON_PINK, LAMP, paint, rimLight, rrect, shadowOf,
  shape, sparkle, stroke, within, type Ctx, type Pt, type Rnd,
} from './brush';

const RC = DATA.assets.placeholders.raccoon;
const PINK_INNER = '#E59AB4';
const BLUSH = '#FF8FB1';

function bez(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
}

/** A tapered tube along a curve (tails), returned as a closed outline. */
function tube(p0: Pt, p1: Pt, p2: Pt, w0: number, w1: number, tipAt = 0.82): Pt[] {
  const left: Pt[] = [];
  const right: Pt[] = [];
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const c = bez(p0, p1, p2, t);
    const d = bez(p0, p1, p2, Math.min(1, t + 0.01));
    const e = bez(p0, p1, p2, Math.max(0, t - 0.01));
    let nx = -(d.y - e.y);
    let ny = d.x - e.x;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    let w = w0 + (w1 - w0) * t;
    if (t > tipAt) w *= Math.max(0, 1 - (t - tipAt) / (1 - tipAt));
    left.push({ x: c.x + nx * w, y: c.y + ny * w });
    right.push({ x: c.x - nx * w, y: c.y - ny * w });
  }
  return left.concat(right.reverse());
}

function castShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number) {
  ctx.save();
  ctx.filter = 'blur(5px)';
  fillShape(ctx, ellipse(x, y, rx, ry), INK_DEEP, 0.45);
  ctx.filter = 'none';
  ctx.restore();
}

// ------------------------------------------------------------------ the raccoon (faces right)
export function paintRaccoon(ctx: Ctx, ox: number, oy: number, rnd: Rnd): void {
  const A = (x: number, y: number): Pt => ({ x: ox + x, y: oy + y });
  const fur = RC.body;
  const mask = RC.mask;
  const belly = RC.belly;
  castShadow(ctx, ox, oy + 2, 82, 13);

  // Huge ringed tail with a pointed tip.
  const t0 = A(-36, -62), t1 = A(-160, -52), t2 = A(-132, -196);
  const tailPts = tube(t0, t1, t2, 30, 22, 0.8);
  const tail = paint(ctx, rnd, tailPts, { color: fur, rim: LAMP, rimSide: -1 });
  within(ctx, tail, () => {
    for (const t of [0.2, 0.38, 0.56, 0.74, 0.92]) {
      const c = bez(t0, t1, t2, t);
      const d = bez(t0, t1, t2, t + 0.02);
      const ang = Math.atan2(d.y - c.y, d.x - c.x) + Math.PI / 2;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(ang);
      fillShape(ctx, ellipse(0, 0, 40, t > 0.9 ? 30 : 9), mask, 0.92);
      ctx.restore();
    }
  });
  ink(ctx, rnd, tailPts, { width: 6 });

  // Back hand and stubby feet.
  shape(ctx, rnd, ellipse(A(-46, -72).x, A(-46, -72).y, 18, 17), { color: shadowOf(fur, 0.2), line: 4.5 });
  shape(ctx, rnd, ellipse(A(-24, -10).x, A(-24, -10).y, 23, 13), { color: mask, line: 4.5, lightAlpha: 0.2 });
  shape(ctx, rnd, ellipse(A(24, -10).x, A(24, -10).y, 23, 13), { color: mask, line: 4.5, lightAlpha: 0.2 });

  // Round, soft body and belly.
  const body = paint(ctx, rnd, ellipse(A(0, -72).x, A(0, -72).y, 60, 57), { color: fur, rim: NEON_CYAN });
  rimLight(ctx, body, LAMP, -1, 0.55);
  ink(ctx, rnd, ellipse(A(0, -72).x, A(0, -72).y, 60, 57), { width: 6.5 });
  paint(ctx, rnd, ellipse(A(8, -64).x, A(8, -64).y, 34, 38), { color: belly, hard: 0.25, lightAlpha: 0.2 });
  ink(ctx, rnd, ellipse(A(8, -64).x, A(8, -64).y, 34, 38), { width: 3, alpha: 0.7 });

  // Pointed ears for mischief.
  const earL = [A(-28, -196), A(-34, -262), A(12, -220)];
  const earR = [A(22, -224), A(50, -272), A(66, -210)];
  shape(ctx, rnd, earL, { color: fur, line: 5.5, wobble: 1 });
  fillShape(ctx, [A(-22, -206), A(-27, -246), A(2, -222)], PINK_INNER, 0.8);
  shape(ctx, rnd, earR, { color: fur, line: 5.5, wobble: 1 });
  fillShape(ctx, [A(32, -226), A(50, -258), A(58, -214)], PINK_INNER, 0.8);

  // Big head (40% of height).
  const headPts = ellipse(A(16, -168).x, A(16, -168).y, 56, 54);
  const head = paint(ctx, rnd, headPts, { color: fur, rim: NEON_CYAN });
  rimLight(ctx, head, LAMP, -1, 0.5);
  // Cheek tufts.
  shape(ctx, rnd, [A(-36, -158), A(-50, -146), A(-30, -140)], { color: fur, line: 4, hard: 0, wobble: 0.6 });
  ink(ctx, rnd, headPts, { width: 6.5 });

  // Mask band (a marking, so no outline) with soft edges.
  within(ctx, head, () => {
    ctx.save();
    ctx.filter = 'blur(1.2px)';
    fillShape(ctx, [A(-40, -168), A(-16, -196), A(30, -200), A(76, -194), A(88, -170), A(62, -156), A(28, -163), A(-8, -154)], mask, 0.95);
    ctx.filter = 'none';
    ctx.restore();
  });

  // Big eyes, small pupils looking right.
  for (const ex of [10, 46]) {
    const e = A(ex, -177);
    paint(ctx, rnd, ellipse(e.x, e.y, 16, 18), { color: '#FBF7F0', hard: 0.22, lightAlpha: 0.1, grain: 0.08 });
    ink(ctx, rnd, ellipse(e.x, e.y, 16, 18), { width: 3.2 });
    fillShape(ctx, ellipse(e.x + 6, e.y + 2, 7, 8), INK_DEEP);
    fillShape(ctx, ellipse(e.x + 3.5, e.y - 2.5, 2.8, 2.8), '#FFFFFF');
    fillShape(ctx, ellipse(e.x + 8.5, e.y + 5, 1.4, 1.4), '#FFFFFF', 0.85);
  }
  // Eyebrows sit on the mask and do the acting.
  stroke(ctx, rnd, [A(-8, -203), A(6, -207), A(20, -206)], 7, RC.brow);
  stroke(ctx, rnd, [A(34, -207), A(48, -206), A(62, -200)], 7, RC.brow);

  // Blush, muzzle, nose, buck-toothed grin, whiskers.
  bloom(ctx, A(-6, -150).x, A(-6, -150).y, 14, BLUSH, 0.35);
  bloom(ctx, A(40, -150).x, A(40, -150).y, 12, BLUSH, 0.3);
  shape(ctx, rnd, ellipse(A(56, -145).x, A(56, -145).y, 29, 18), { color: belly, line: 4, hard: 0.2, lightAlpha: 0.15 });
  shape(ctx, rnd, [A(70, -162), A(88, -160), A(79, -150)], { color: INK_DEEP, line: 2.5, hard: 0, lightAlpha: 0 });
  fillShape(ctx, ellipse(A(76, -159).x, A(76, -159).y, 3, 2), '#FFFFFF', 0.8);
  stroke(ctx, rnd, [A(44, -146), A(56, -137), A(70, -142)], 4, INK_DEEP);
  shape(ctx, rnd, rrect(A(49, -139).x, A(49, -139).y, 8, 10, 2), { color: '#FFFFFF', line: 2.5, hard: 0, grain: 0, lightAlpha: 0 });
  shape(ctx, rnd, rrect(A(57.5, -139).x, A(57.5, -139).y, 8, 10, 2), { color: '#FFFFFF', line: 2.5, hard: 0, grain: 0, lightAlpha: 0 });
  for (const [dy, len] of [[-4, 30], [3, 26]] as const) {
    stroke(ctx, rnd, [A(80, -148 + dy), A(80 + len * 0.6, -150 + dy * 2), A(80 + len, -148 + dy * 3)], 1.6, mix(belly, INK_DEEP, 0.4), 0.7);
  }

  // Oversized front hand on a stubby arm.
  shape(ctx, rnd, [A(30, -112), A(46, -110), A(64, -80), A(48, -70)], { color: fur, line: 5, wobble: 1 });
  const hand = paint(ctx, rnd, ellipse(A(56, -74).x, A(56, -74).y, 22, 21), { color: fur, rim: NEON_CYAN });
  void hand;
  ink(ctx, rnd, ellipse(A(56, -74).x, A(56, -74).y, 22, 21), { width: 5.5 });
}

// ------------------------------------------------------------------ enemies (face left)
function lineFor(S: number) {
  return Math.min(8, Math.max(3.5, S * 0.035));
}

function paintRat(ctx: Ctx, rnd: Rnd, ox: number, oy: number, S: number, color: string, accent: string, king = false) {
  const A = (x: number, y: number): Pt => ({ x: ox + x * S, y: oy + y * S });
  const lw = lineFor(S);
  castShadow(ctx, ox, oy + 2, S * 0.45, S * 0.07);
  if (king) {
    // Pizza-box cape.
    const cape = [A(-0.05, -0.62), A(0.5, -0.68), A(0.58, -0.04), A(0.0, -0.08)];
    paint(ctx, rnd, cape, { color: DATA.assets.placeholders.palette.kraft, rim: NEON_PINK });
    for (const [x, y] of [[0.2, -0.45], [0.36, -0.3], [0.18, -0.22], [0.42, -0.52]] as const) {
      shape(ctx, rnd, ellipse(A(x, y).x, A(x, y).y, S * 0.04, S * 0.035), { color: '#C0392B', line: 0, hard: 0.2 });
    }
    ink(ctx, rnd, cape, { width: lw });
  }
  // Long pink tail.
  stroke(ctx, rnd, [A(0.32, -0.2), A(0.62, -0.18), A(0.78, -0.42), A(0.7, -0.74)], S * 0.06 + 2, accent);
  // Triangular, threatening body and snout.
  const body = shape(ctx, rnd, ellipse(A(0.12, -0.3).x, A(0.12, -0.3).y, S * 0.37, S * 0.26), { color, rim: NEON_PINK, line: lw });
  void body;
  const snout = [A(-0.06, -0.6), A(-0.64, -0.34), A(-0.04, -0.13)];
  shape(ctx, rnd, snout, { color, rim: null, line: lw, wobble: 1 });
  shape(ctx, rnd, ellipse(A(-0.1, -0.66).x, A(-0.1, -0.66).y, S * 0.12, S * 0.12), { color, line: lw * 0.8 });
  fillShape(ctx, ellipse(A(-0.1, -0.66).x, A(-0.1, -0.66).y, S * 0.06, S * 0.06), accent, 0.9);
  // Beady red eye with a glint, pink nose, whiskers.
  fillShape(ctx, ellipse(A(-0.3, -0.42).x, A(-0.3, -0.42).y, S * 0.05, S * 0.05), '#E8202A');
  glow(ctx, A(-0.3, -0.42).x, A(-0.3, -0.42).y, S * 0.1, '#FF3030', 0.35);
  fillShape(ctx, ellipse(A(-0.31, -0.435).x, A(-0.31, -0.435).y, S * 0.016 + 1, S * 0.016 + 1), '#FFFFFF');
  shape(ctx, rnd, ellipse(A(-0.62, -0.34).x, A(-0.62, -0.34).y, S * 0.045, S * 0.04), { color: accent, line: 2.5, hard: 0 });
  stroke(ctx, rnd, [A(-0.52, -0.33), A(-0.66, -0.4), A(-0.76, -0.4)], 1.8, INK_DEEP, 0.8);
  stroke(ctx, rnd, [A(-0.52, -0.29), A(-0.66, -0.26), A(-0.76, -0.22)], 1.8, INK_DEEP, 0.8);
  shape(ctx, rnd, ellipse(A(-0.08, -0.04).x, A(-0.08, -0.04).y, S * 0.09, S * 0.04), { color: accent, line: 3, hard: 0.2 });
  shape(ctx, rnd, ellipse(A(0.26, -0.04).x, A(0.26, -0.04).y, S * 0.09, S * 0.04), { color: accent, line: 3, hard: 0.2 });
  if (king) {
    // Crown cut from a tin-can lid.
    const crown = [A(-0.25, -0.66), A(-0.23, -0.84), A(-0.17, -0.73), A(-0.12, -0.88), A(-0.07, -0.73), A(-0.01, -0.86), A(0.03, -0.66)];
    shape(ctx, rnd, crown, { color: '#C9CED6', line: lw * 0.8, light: '#FFFFFF', lightAlpha: 0.5, wobble: 0.6 });
    sparkle(ctx, A(-0.12, -0.9).x, A(-0.12, -0.9).y, S * 0.04, '#FFFFFF', 0.9);
  }
}

function paintPigeon(ctx: Ctx, rnd: Rnd, ox: number, oy: number, S: number, color: string, accent: string) {
  const A = (x: number, y: number): Pt => ({ x: ox + x * S, y: oy + y * S });
  const lw = lineFor(S);
  castShadow(ctx, ox, oy + 2, S * 0.38, S * 0.06);
  shape(ctx, rnd, [A(0.3, -0.42), A(0.64, -0.3), A(0.34, -0.2)], { color: shadowOf(color, 0.25), line: lw * 0.8 });
  stroke(ctx, rnd, [A(-0.06, -0.12), A(-0.08, 0)], 5, '#E57399');
  stroke(ctx, rnd, [A(0.12, -0.12), A(0.12, 0)], 5, '#E57399');
  // Huge puffed chest, tiny head, iridescent neck.
  shape(ctx, rnd, ellipse(A(0.05, -0.42).x, A(0.05, -0.42).y, S * 0.42, S * 0.34), { color, rim: NEON_PINK, line: lw });
  shape(ctx, rnd, ellipse(A(0.2, -0.44).x, A(0.2, -0.44).y, S * 0.2, S * 0.15), { color: shadowOf(color, 0.2), line: lw * 0.7 });
  paint(ctx, rnd, ellipse(A(-0.18, -0.72).x, A(-0.18, -0.72).y, S * 0.17, S * 0.09), { color: accent, hard: 0.2, light: '#E8B4FF', lightAlpha: 0.4 });
  shape(ctx, rnd, ellipse(A(-0.2, -0.86).x, A(-0.2, -0.86).y, S * 0.14, S * 0.13), { color, line: lw * 0.8 });
  shape(ctx, rnd, [A(-0.31, -0.88), A(-0.44, -0.84), A(-0.31, -0.8)], { color: '#F5A623', line: 2.5, hard: 0.2 });
  // The blank stare that never changes.
  fillShape(ctx, ellipse(A(-0.24, -0.9).x, A(-0.24, -0.9).y, S * 0.05, S * 0.05), '#FFF6E0');
  ink(ctx, rnd, ellipse(A(-0.24, -0.9).x, A(-0.24, -0.9).y, S * 0.05, S * 0.05), { width: 2 });
  fillShape(ctx, ellipse(A(-0.24, -0.9).x, A(-0.24, -0.9).y, S * 0.014 + 1, S * 0.014 + 1), INK_DEEP);
}

function paintRaccoonFoe(ctx: Ctx, rnd: Rnd, ox: number, oy: number, S: number, color: string, accent: string, boss: boolean) {
  const A = (x: number, y: number): Pt => ({ x: ox + x * S, y: oy + y * S });
  const lw = lineFor(S);
  const mask = '#2A2A33';
  const belly = '#D8D0C2';
  castShadow(ctx, ox, oy + 2, S * 0.4, S * 0.06);
  const t0 = A(0.18, -0.25), t1 = A(0.62, -0.24), t2 = A(0.54, -0.72);
  const tailPts = tube(t0, t1, t2, S * 0.1, S * 0.07, 0.8);
  const tail = paint(ctx, rnd, tailPts, { color, rim: NEON_PINK });
  within(ctx, tail, () => {
    for (const t of [0.25, 0.48, 0.7, 0.92]) {
      const c = bez(t0, t1, t2, t);
      const d = bez(t0, t1, t2, t + 0.02);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(Math.atan2(d.y - c.y, d.x - c.x) + Math.PI / 2);
      fillShape(ctx, ellipse(0, 0, S * 0.14, t > 0.9 ? S * 0.1 : S * 0.03), mask, 0.92);
      ctx.restore();
    }
  });
  ink(ctx, rnd, tailPts, { width: lw });
  shape(ctx, rnd, ellipse(A(-0.1, -0.04).x, A(-0.1, -0.04).y, S * 0.09, S * 0.045), { color: mask, line: lw * 0.7 });
  shape(ctx, rnd, ellipse(A(0.1, -0.04).x, A(0.1, -0.04).y, S * 0.09, S * 0.045), { color: mask, line: lw * 0.7 });
  shape(ctx, rnd, ellipse(A(0, -0.3).x, A(0, -0.3).y, S * 0.26, S * 0.24), { color, rim: NEON_PINK, line: lw });
  paint(ctx, rnd, ellipse(A(-0.04, -0.27).x, A(-0.04, -0.27).y, S * 0.14, S * 0.15), { color: belly, hard: 0.2 });
  shape(ctx, rnd, [A(0.04, -0.78), A(0.13, -1.0), A(-0.08, -0.84)], { color, line: lw * 0.8 });
  shape(ctx, rnd, [A(-0.2, -0.82), A(-0.25, -1.0), A(-0.36, -0.78)], { color, line: lw * 0.8 });
  const headPts = ellipse(A(-0.08, -0.68).x, A(-0.08, -0.68).y, S * 0.22, S * 0.21);
  const head = paint(ctx, rnd, headPts, { color, rim: NEON_PINK });
  within(ctx, head, () => {
    ctx.filter = 'blur(1px)';
    fillShape(ctx, [A(0.14, -0.7), A(0.02, -0.81), A(-0.2, -0.81), A(-0.38, -0.72), A(-0.32, -0.62), A(-0.08, -0.66), A(0.08, -0.62)], mask, 0.95);
    ctx.filter = 'none';
  });
  ink(ctx, rnd, headPts, { width: lw });
  for (const ex of [-0.04, -0.2]) {
    fillShape(ctx, ellipse(A(ex, -0.71).x, A(ex, -0.71).y, S * 0.055, S * 0.055), '#FBF7F0');
    ink(ctx, rnd, ellipse(A(ex, -0.71).x, A(ex, -0.71).y, S * 0.055, S * 0.055), { width: 2.2 });
    fillShape(ctx, ellipse(A(ex - 0.025, -0.7).x, A(ex - 0.025, -0.7).y, S * 0.024, S * 0.024), INK_DEEP);
  }
  // Angry brows.
  stroke(ctx, rnd, [A(0.03, -0.83), A(-0.1, -0.78)], S * 0.03 + 2, '#C9C9D6');
  stroke(ctx, rnd, [A(-0.14, -0.78), A(-0.29, -0.83)], S * 0.03 + 2, '#C9C9D6');
  shape(ctx, rnd, ellipse(A(-0.24, -0.58).x, A(-0.24, -0.58).y, S * 0.1, S * 0.06), { color: belly, line: lw * 0.6, hard: 0.15 });
  fillShape(ctx, ellipse(A(-0.33, -0.6).x, A(-0.33, -0.6).y, S * 0.03, S * 0.025), INK_DEEP);
  // Gang bandana with a knot.
  shape(ctx, rnd, [A(0.15, -0.78), A(-0.3, -0.87), A(-0.33, -0.8), A(0.15, -0.7)], { color: accent, line: lw * 0.7, wobble: 0.8 });
  shape(ctx, rnd, [A(0.13, -0.76), A(0.31, -0.87), A(0.27, -0.68)], { color: accent, line: lw * 0.7, wobble: 0.8 });
  shape(ctx, rnd, ellipse(A(-0.3, -0.36).x, A(-0.3, -0.36).y, S * 0.09, S * 0.085), { color, line: lw * 0.8 });
  if (boss) {
    // Vinnie "Two Lids": a trash-can lid in each hand.
    for (const [x, y] of [[-0.42, -0.42], [0.28, -0.38]] as const) {
      const lid = ellipse(A(x, y).x, A(x, y).y, S * 0.17, S * 0.17);
      shape(ctx, rnd, lid, { color: '#9AA3AE', light: '#FFFFFF', lightAlpha: 0.45, line: lw });
      ink(ctx, rnd, ellipse(A(x, y).x, A(x, y).y, S * 0.11, S * 0.11), { width: 2.5, alpha: 0.7 });
      shape(ctx, rnd, rrect(A(x, y).x - S * 0.05, A(x, y).y - S * 0.02, S * 0.1, S * 0.04, 6), { color: '#6B7480', line: 2.5 });
    }
  }
}

function paintOfficer(ctx: Ctx, rnd: Rnd, ox: number, oy: number, S: number, color: string, accent: string) {
  const A = (x: number, y: number): Pt => ({ x: ox + x * S, y: oy + y * S });
  const lw = lineFor(S);
  const skin = '#F1C6A6';
  castShadow(ctx, ox, oy + 2, S * 0.36, S * 0.05);
  // Catch pole with a loop.
  stroke(ctx, rnd, [A(-0.2, -0.42), A(-0.44, -0.7), A(-0.66, -0.98)], S * 0.03 + 4, '#B0B7C3');
  ink(ctx, rnd, ellipse(A(-0.7, -1.02).x, A(-0.7, -1.02).y, S * 0.06, S * 0.06), { width: 5, color: '#D8D8E0' });
  shape(ctx, rnd, rrect(A(-0.16, -0.16).x, A(-0.16, -0.16).y, S * 0.12, S * 0.16, 6), { color: '#1C2C4A', line: lw * 0.8 });
  shape(ctx, rnd, rrect(A(0.04, -0.16).x, A(0.04, -0.16).y, S * 0.12, S * 0.16, 6), { color: '#1C2C4A', line: lw * 0.8 });
  // Blocky, oversized uniform.
  shape(ctx, rnd, rrect(A(-0.25, -0.64).x, A(-0.25, -0.64).y, S * 0.5, S * 0.5, 14), { color, rim: NEON_PINK, line: lw });
  stroke(ctx, rnd, [A(0, -0.62), A(0, -0.16)], 3, INK_DEEP, 0.6);
  shape(ctx, rnd, ellipse(A(-0.14, -0.52).x, A(-0.14, -0.52).y, S * 0.035, S * 0.035), { color: accent, line: 2.5, light: '#FFFFFF', lightAlpha: 0.5 });
  // Clipboard.
  shape(ctx, rnd, rrect(A(0.14, -0.5).x, A(0.14, -0.5).y, S * 0.2, S * 0.26, 4), { color: DATA.assets.placeholders.palette.kraft, line: lw * 0.8 });
  fillShape(ctx, rrect(A(0.17, -0.46).x, A(0.17, -0.46).y, S * 0.14, S * 0.18, 2), '#FBF7F0', 0.95);
  for (let i = 0; i < 3; i++) stroke(ctx, rnd, [A(0.19, -0.42 + i * 0.05), A(0.29, -0.42 + i * 0.05)], 2, INK_DEEP, 0.5);
  // Head, mustache, cap with a badge.
  shape(ctx, rnd, rrect(A(-0.14, -0.88).x, A(-0.14, -0.88).y, S * 0.28, S * 0.26, 22), { color: skin, rim: NEON_PINK, line: lw });
  bloom(ctx, A(-0.1, -0.74).x, A(-0.1, -0.74).y, S * 0.05, BLUSH, 0.35);
  fillShape(ctx, ellipse(A(-0.06, -0.79).x, A(-0.06, -0.79).y, S * 0.022, S * 0.022), INK_DEEP);
  shape(ctx, rnd, [A(-0.13, -0.71), A(0.02, -0.71), A(-0.02, -0.66), A(-0.09, -0.66)], { color: '#5D4037', line: 2.5, hard: 0.2 });
  shape(ctx, rnd, rrect(A(-0.17, -0.99).x, A(-0.17, -0.99).y, S * 0.34, S * 0.13, 12), { color, line: lw * 0.9 });
  shape(ctx, rnd, rrect(A(-0.29, -0.88).x, A(-0.29, -0.88).y, S * 0.2, S * 0.04, 6), { color: shadowOf(color, 0.3), line: lw * 0.7 });
  shape(ctx, rnd, ellipse(A(0, -0.93).x, A(0, -0.93).y, S * 0.03, S * 0.03), { color: accent, line: 2.5, light: '#FFFFFF', lightAlpha: 0.6 });
  sparkle(ctx, A(0.01, -0.95).x, A(0.01, -0.95).y, S * 0.02, '#FFFFFF', 0.9);
}

/** Paints an enemy facing left with its feet at (ox, oy). */
export function paintEnemy(ctx: Ctx, rnd: Rnd, shapeId: EnemyShape, S: number, color: string, accent: string, ox: number, oy: number): void {
  switch (shapeId) {
    case 'rat':
      return paintRat(ctx, rnd, ox, oy, S, color, accent);
    case 'ratKing':
      return paintRat(ctx, rnd, ox, oy, S * 0.95, color, '#D9A1AE', true);
    case 'pigeon':
      return paintPigeon(ctx, rnd, ox, oy, S, color, accent);
    case 'raccoon':
      return paintRaccoonFoe(ctx, rnd, ox, oy, S, color, accent, false);
    case 'raccoonBoss':
      return paintRaccoonFoe(ctx, rnd, ox, oy, S, color, accent, true);
    case 'officer':
      return paintOfficer(ctx, rnd, ox, oy, S, color, accent);
  }
}
