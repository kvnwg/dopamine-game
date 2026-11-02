/**
 * Effects and small pickups, plus the big UI dumpster (body + hinged lid).
 */
import { CEL_PALETTE as C, OUTLINE } from './palette';
import {
  TAU, cel, celMulti, circle, ellipse, fill, inClip, ink, makeCanvas, moved, outline, polar, poly, rgba,
  roundPoly, rrect, shadeOf, smooth, softSpot, sparkle4, star, stroke, union,
} from './core';

// ------------------------------------------------------------------ slash
/**
 * Crescent swoosh of an overhead swing: thin tail at the upper left, sweeping over the top and down
 * to a broad flaming head at the lower right. Outer (leading) edge white-hot, then yellow, orange inside.
 */
export function slashArc(): HTMLCanvasElement {
  const S = 300;
  const { c, ctx } = makeCanvas(S, S);
  const cx = 98, cy = 154, R = 138;
  const a0 = (-128 * Math.PI) / 180;
  const a1 = (62 * Math.PI) / 180;
  const n = 160;
  const width = (t: number) => {
    const grow = Math.pow(t, 1.35);
    const head = t > 0.8 ? Math.pow(Math.cos(((t - 0.8) / 0.2) * (Math.PI / 2)), 0.5) : 1;
    return 60 * grow * head;
  };
  // flame tongues on the inner edge: pointed licks whose tips lean back toward the tail
  const licks: Array<[number, number, number]> = [[0.55, 0.075, 14], [0.71, 0.085, 22], [0.86, 0.075, 16]];
  const tongue = (t: number) => {
    let off = 0;
    for (const [tc, hw, amp] of licks) {
      const u = Math.abs(t - tc) / hw;
      if (u < 1) off = Math.max(off, amp * Math.pow(1 - u, 1.6));
    }
    return off;
  };
  /** Crescent sharing the outer edge; its width is `k` of the full width (+ `extra` px), tongues scaled by `tk`. */
  const band = (k: number, extra: number, tk: number) => {
    const pts: number[] = [];
    const inner: number[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = a0 + (a1 - a0) * t;
      const w = width(t);
      const lick = tongue(t) * tk;
      const ri = R - Math.min(w, w * k + extra * Math.min(1, t * 4)) - lick;
      const ai = a - lick * 0.011;
      pts.push(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      inner.push(cx + Math.cos(ai) * ri, cy + Math.sin(ai) * ri);
    }
    for (let i = inner.length - 2; i >= 0; i -= 2) pts.push(inner[i], inner[i + 1]);
    return poly(pts);
  };
  fill(ctx, band(1, 0, 1), '#FF7417');
  fill(ctx, band(0.74, 0, 0.55), '#FFA62B');
  fill(ctx, band(0.5, 0, 0.2), C.slashYellow);
  fill(ctx, band(0.2, 2.5, 0), C.slashWhite);
  // fade the tail out
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  const tail = { x: cx + Math.cos(a0) * R, y: cy + Math.sin(a0) * R };
  const am = a0 + (a1 - a0) * 0.42;
  const mid = { x: cx + Math.cos(am) * R, y: cy + Math.sin(am) * R };
  const fg = ctx.createLinearGradient(tail.x, tail.y, mid.x, mid.y);
  fg.addColorStop(0, 'rgba(0,0,0,0)');
  fg.addColorStop(0.6, 'rgba(0,0,0,0.85)');
  fg.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = fg;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
  return c;
}

// ------------------------------------------------------------------ impact, puff, sparkle
export function impactStar(): HTMLCanvasElement {
  const S = 140;
  const { c, ctx } = makeCanvas(S, S);
  const m = S / 2;
  softSpot(ctx, m, m, 66, 66, '#FFFFFF', 0.55, 0, 0.25);
  const pts: number[] = [];
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + (i / 16) * TAU;
    const r = i % 2 === 0 ? (i % 4 === 0 ? 62 : 44) : 17;
    pts.push(m + Math.cos(a) * r, m + Math.sin(a) * r);
  }
  const p = roundPoly(pts, 2);
  fill(ctx, p, '#FFFFFF');
  fill(ctx, star(m, m, 26, 11, 8, -Math.PI / 2 + Math.PI / 8), '#FFF8D6');
  fill(ctx, circle(m, m, 10), '#FFFFFF');
  return c;
}

export function puff(): HTMLCanvasElement {
  const S = 80;
  const { c, ctx } = makeCanvas(S, S);
  const p = union(circle(30, 46, 20), circle(48, 40, 22), circle(40, 26, 17), circle(56, 54, 14), circle(22, 58, 12));
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = 8;
  fill(ctx, p, '#FFFFFF');
  ctx.restore();
  inClip(ctx, p, () => {
    fill(ctx, p, '#E3E8F2');
    fill(ctx, moved(p, -4, -7), '#FFFFFF');
  });
  return c;
}

export function sparkle(): HTMLCanvasElement {
  const S = 40;
  const { c, ctx } = makeCanvas(S, S);
  softSpot(ctx, 20, 20, 15, 15, '#FFFFFF', 0.5, 0, 0.2);
  fill(ctx, sparkle4(20, 20, 18, 0.15), '#FFFFFF');
  return c;
}

// ------------------------------------------------------------------ pickups
export function coinSprite(): HTMLCanvasElement {
  const S = 44;
  const { c, ctx } = makeCanvas(S, S);
  const m = S / 2;
  const p = circle(m, m, 18);
  cel(ctx, p, C.gold, { lw: 3, shade: C.goldShade, dx: 3, dy: 4 });
  stroke(ctx, circle(m, m, 12.5), C.goldShade, 3);
  cel(ctx, rrect(m - 3, m - 7.5, 6, 15, 3), C.goldShade, {});
  inClip(ctx, p, () => {
    const hi = new Path2D();
    hi.arc(m, m, 14.5, Math.PI * 1.05, Math.PI * 1.55);
    stroke(ctx, hi, '#FFFFFF', 3.4);
  });
  fill(ctx, sparkle4(m - 9, m - 9, 4, 0.2), '#FFFFFF');
  return c;
}

export function bagSprite(): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(64, 72);
  const sack = smooth([32, 20, 46, 24, 56, 40, 57, 56, 48, 67, 32, 69, 16, 67, 7, 56, 8, 40, 18, 24], true);
  const ears = union(smooth([28, 22, 18, 10, 22, 5, 31, 14], true, 0.6), smooth([36, 22, 46, 9, 43, 4, 33, 14], true, 0.6));
  outline(ctx, ears, 3.4);
  outline(ctx, sack, 3.4);
  for (const p of [ears, sack]) {
    fill(ctx, p, C.bag);
    inClip(ctx, p, () => {
      fill(ctx, p, C.bagShade);
      fill(ctx, moved(p, -4, -6), C.bag);
    });
  }
  inClip(ctx, sack, () => {
    stroke(ctx, smooth([17, 36, 14, 46, 15, 56], false), rgba(C.bagHi, 0.95), 3.6);
    fill(ctx, ellipse(22, 33, 3, 2), rgba('#FFFFFF', 0.5));
    ink(ctx, [30, 30, 33, 44, 31, 56], 2, rgba(OUTLINE, 0.45));
    ink(ctx, [42, 34, 46, 46], 2, rgba(OUTLINE, 0.45));
  });
  // gold twist tie
  cel(ctx, rrect(23, 16, 18, 7, 3.5), C.gold, { lw: 2.6, shade: C.goldShade, dx: 0, dy: 2.5 });
  cel(ctx, smooth([39, 18, 47, 14, 49, 18, 41, 21], true, 0.6), C.gold, { lw: 2.6 });
  return c;
}

export function confetti(kind: 0 | 1 | 2 | 3): HTMLCanvasElement {
  if (kind === 0) {
    const { c, ctx } = makeCanvas(36, 32);
    const flaps = [smooth([18, 12, 8, 18, 4, 28, 10, 22, 17, 17], true, 0.7), smooth([18, 12, 28, 18, 32, 28, 26, 22, 19, 17], true, 0.7), smooth([16, 14, 18, 26, 22, 29, 21, 20, 20, 14], true, 0.7)];
    for (const f of flaps) cel(ctx, f, '#FFD54F', { lw: 2.4, shade: '#E8B02A', dx: 1.5, dy: 2 });
    cel(ctx, rrect(15, 4, 6, 11, 3), '#FFE07A', { lw: 2.4, shade: '#E8B02A', dx: 1.5, dy: 0 });
    fill(ctx, rrect(15.5, 3, 5, 3.5, 1.5), '#6D4C2F');
    return c;
  }
  if (kind === 1) {
    const { c, ctx } = makeCanvas(26, 26);
    const p = polar(13, 13, (a) => 9.5 * (0.9 + 0.1 * (0.5 + 0.5 * Math.cos(a * 15))), 90);
    cel(ctx, p, '#E53935', { lw: 2.4, shade: '#B71C1C', dx: 1.5, dy: 2 });
    stroke(ctx, circle(12.5, 12.5, 5.6), '#FF8A80', 2);
    return c;
  }
  if (kind === 2) {
    const { c, ctx } = makeCanvas(30, 26);
    const p = roundPoly([4, 7, 13, 3, 25, 6, 27, 18, 16, 23, 5, 20], 2);
    cel(ctx, p, '#FFFFFF', { lw: 2.4, shade: '#D9DEE8', dx: 2, dy: 3 });
    ink(ctx, [13, 4, 15, 13, 26, 15], 1.4, rgba('#9AA4B5', 0.9));
    ink(ctx, [8, 10, 22, 11], 1.2, rgba('#8FB7F0', 0.9), false);
    ink(ctx, [8, 15, 20, 16], 1.2, rgba('#8FB7F0', 0.9), false);
    return c;
  }
  const { c, ctx } = makeCanvas(34, 22);
  const p = smooth([4, 14, 10, 6, 20, 4, 30, 8, 30, 14, 22, 12, 12, 13, 6, 18], true, 0.8);
  celMulti(ctx, p, 2.4, 1.5, 2.5, (dark) => {
    fill(ctx, p, dark ? '#C98A45' : '#E8B06A');
    for (const [x, y] of [[12, 8], [20, 7], [26, 10]]) fill(ctx, ellipse(x, y, 2.4, 1.4), dark ? '#9A5F2A' : '#B9773A');
  });
  return c;
}

// ------------------------------------------------------------------ UI dumpster
const DLW = 9;

export function dumpsterBody(): HTMLCanvasElement {
  const W = 640, H = 400;
  const { c, ctx } = makeCanvas(W, H);
  // casters
  for (const wx of [92, 548]) {
    cel(ctx, rrect(wx - 22, 330, 44, 22, 6), C.iron, { lw: DLW * 0.8, shade: shadeOf(C.iron, 0.2), dx: 0, dy: 6 });
    cel(ctx, circle(wx, 362, 26), '#3F3B46', { lw: DLW * 0.8, shade: '#2E2B34', dx: 4, dy: 6 });
    cel(ctx, circle(wx, 362, 10), C.metal, { lw: 4, shade: C.metalShade, dx: 1, dy: 2 });
  }
  const body = roundPoly([14, 16, 626, 16, 590, 340, 50, 340], [14, 14, 18, 18]);
  celMulti(ctx, body, DLW, 26, 0, (dark) => {
    const base = dark ? C.dumpsterShade : C.dumpster;
    const deep = dark ? shadeOf(C.dumpsterShade, 0.15) : C.dumpsterShade;
    fill(ctx, body, base);
    // top lip
    fill(ctx, rrect(0, 16, W, 40, 0), dark ? C.dumpsterShade : C.dumpsterHi);
    fill(ctx, rrect(0, 50, W, 10, 0), deep);
    // vertical ribs
    for (const rx of [150, 320, 490]) {
      fill(ctx, rrect(rx - 24, 64, 48, 260, 16), deep);
      fill(ctx, rrect(rx - 24, 64, 36, 252, 16), base);
      if (!dark) fill(ctx, rrect(rx - 17, 76, 8, 226, 4), C.dumpsterHi);
    }
    // bottom skid
    fill(ctx, rrect(0, 304, W, 36, 0), deep);
  });
  // rib outlines
  for (const rx of [150, 320, 490]) stroke(ctx, rrect(rx - 24, 64, 48, 260, 16), OUTLINE, 5);
  stroke(ctx, poly([30, 56, 610, 56], false), OUTLINE, 5);
  stroke(ctx, poly([42, 304, 598, 304], false), OUTLINE, 5);
  // lift pockets on the sides
  for (const [x, w] of [[22, 70], [548, 70]]) cel(ctx, rrect(x, 92, w, 34, 8), '#2B3A33', { lw: 5, shade: '#1F2A25', dx: 0, dy: 8 });
  // highlight streak on the left of the box
  inClip(ctx, body, () => {
    softSpot(ctx, 60, 190, 10, 100, '#FFFFFF', 0.45, 0.08, 0.7);
  });
  // paw-print decal on the middle panel
  const px = 405, py = 200;
  const pad = union(ellipse(px, py + 14, 24, 20), circle(px - 25, py - 12, 10), circle(px - 9, py - 26, 10.5), circle(px + 9, py - 26, 10.5), circle(px + 25, py - 12, 10));
  fill(ctx, pad, rgba('#FFFFFF', 0.92));
  stroke(ctx, pad, rgba(OUTLINE, 0.25), 3);
  return c;
}

export function dumpsterLid(): HTMLCanvasElement {
  const W = 680, H = 110;
  const { c, ctx } = makeCanvas(W, H);
  // hinge knuckles at the left
  for (const hy of [44, 74]) cel(ctx, rrect(6, hy - 11, 30, 22, 9), C.iron, { lw: 6, shade: shadeOf(C.iron, 0.2), dx: 0, dy: 6 });
  const top = roundPoly([30, 26, 666, 26, 672, 64, 22, 64], [12, 14, 4, 4]);
  const front = roundPoly([22, 60, 672, 60, 668, 96, 26, 96], [4, 4, 12, 12]);
  cel(ctx, top, C.dumpsterLid, { lw: DLW, shade: C.dumpsterLidShade, dx: 0, dy: 8, hi: { x: 210, y: 38, rx: 150, ry: 5, a: 0.4 } });
  celMulti(ctx, front, DLW, 0, 10, (dark) => {
    fill(ctx, front, dark ? shadeOf(C.dumpsterLidShade, 0.12) : C.dumpsterLidShade);
  });
  // molded ridge along the top
  stroke(ctx, poly([60, 44, 620, 44], false), rgba('#FFFFFF', 0.28), 6);
  // handle on the free (right) end
  stroke(ctx, smooth([566, 78, 574, 102, 640, 102, 648, 78], false), OUTLINE, 12 + DLW * 1.4);
  stroke(ctx, smooth([566, 78, 574, 102, 640, 102, 648, 78], false), C.metal, 12);
  stroke(ctx, smooth([578, 99, 636, 99], false), C.metalHi, 3);
  return c;
}
