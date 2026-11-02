/**
 * Enemies, all facing LEFT. Each is drawn in a design space 100 units tall with the feet at (0,0)
 * (y up is negative), then scaled so 100 units = S px. Outline width stays in px.
 */
import { CEL_PALETTE as C, OUTLINE } from './palette';
import {
  type Ctx, type Pt, cel, celMulti, circle, clamp, ellipse, fill, inClip, ink, lightOf, makeCanvas, mix, outline,
  polar, poly, rgba, roundPoly, rrect, sampleCurve, shadeOf, smooth, softSpot, star, stroke, tube,
} from './core';

export type EnemyShape = 'rat' | 'pigeon' | 'raccoon' | 'ratKing' | 'raccoonBoss' | 'officer';

interface Tones { base: string; shade: string; light: string; dark: string; darkShade: string }

function tones(color: string, lift = 0.1): Tones {
  const base = mix(color, '#FFFFFF', lift);
  return { base, shade: shadeOf(base, 0.2), light: lightOf(base, 0.35), dark: mix(color, '#2A2430', 0.55), darkShade: mix(color, '#1E1A24', 0.68) };
}

const PINK = C.pink;
const PINK_SHADE = C.pinkShade;

// ------------------------------------------------------------------ shared bits
function eyeWhite(ctx: Ctx, x: number, y: number, rx: number, ry: number, lw: number, px: number, py: number, pupil = 0.72): void {
  const w = ellipse(x, y, rx, ry);
  outline(ctx, w, lw * 0.45);
  fill(ctx, w, '#FFFFFF');
  inClip(ctx, w, () => fill(ctx, ellipse(x + px, y + py, rx * pupil, ry * pupil), C.pupil));
  fill(ctx, circle(x + px - rx * 0.25, y + py - ry * 0.3, Math.max(rx, ry) * 0.24), '#FFFFFF');
}

function beadyEye(ctx: Ctx, x: number, y: number, r: number, lw: number, lid = 0, lidColor = '#7A6A72'): void {
  const e = circle(x, y, r);
  outline(ctx, e, lw * 0.45);
  fill(ctx, e, '#E53935');
  inClip(ctx, e, () => fill(ctx, circle(x + r * 0.25, y + r * 0.3, r * 0.75), '#B71C1C'));
  fill(ctx, circle(x - r * 0.3, y - r * 0.35, r * 0.36), '#FFFFFF');
  if (lid > 0) {
    // a heavy, smug upper lid
    const l = new Path2D();
    l.rect(x - r * 1.6, y - r * 1.8, r * 3.2, r * (0.8 + lid));
    ctx.save();
    ctx.clip(circle(x, y, r + lw * 0.45));
    fill(ctx, l, lidColor);
    ctx.restore();
    ink(ctx, [x - r * 1.15, y - r + r * lid * 0.95, x + r * 1.15, y - r + r * lid * 1.05], lw * 0.6, OUTLINE, false);
  }
}

function ringedTail(ctx: Ctx, pts: number[], widths: number[], t: Tones, lw: number, dx: number, dy: number): void {
  const p = tube(pts, widths, 10);
  const s = sampleCurve(pts, 10, false);
  const band = (t0: number, t1: number, color: string) => {
    const i0 = Math.floor(t0 * (s.length - 1));
    const i1 = Math.ceil(t1 * (s.length - 1));
    const q: number[] = [];
    for (let i = i0; i <= i1; i++) q.push(s[i].x, s[i].y);
    stroke(ctx, smooth(q, false), color, 60, 'butt');
  };
  celMulti(ctx, p, lw, dx, dy, (dark) => {
    fill(ctx, p, dark ? t.shade : t.base);
    const d = dark ? t.darkShade : t.dark;
    band(0.32, 0.43, d);
    band(0.56, 0.67, d);
    band(0.79, 0.88, d);
    band(0.95, 1, d);
  });
}

/** Silver metal trash-can lid, seen at an angle. */
function metalLid(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot: number, lw: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const p = ellipse(0, 0, rx, ry);
  celMulti(ctx, p, lw, rx * 0.12, ry * 0.14, (dark) => {
    fill(ctx, p, dark ? C.metalShade : C.metal);
    fill(ctx, ellipse(-rx * 0.04, -ry * 0.05, rx * 0.72, ry * 0.7), dark ? shadeOf(C.metalShade, 0.05) : C.metalHi);
    fill(ctx, ellipse(0, 0, rx * 0.63, ry * 0.61), dark ? C.metalShade : C.metal);
  });
  stroke(ctx, ellipse(0, 0, rx * 0.68, ry * 0.66), rgba(OUTLINE, 0.8), lw * 0.55);
  stroke(ctx, ellipse(0, 0, rx * 0.36, ry * 0.35), rgba(OUTLINE, 0.8), lw * 0.55);
  cel(ctx, rrect(-rx * 0.28, -ry * 0.12, rx * 0.56, ry * 0.24, ry * 0.12), C.metalShade, { lw: lw * 0.8, shade: C.iron, dx: 0, dy: ry * 0.07 });
  inClip(ctx, p, () => softSpot(ctx, -rx * 0.42, -ry * 0.5, rx * 0.22, ry * 0.1, '#FFFFFF', 0.7, -0.6));
  for (const a of [0.7, 2.3, 3.9, 5.4]) fill(ctx, circle(Math.cos(a) * rx * 0.85, Math.sin(a) * ry * 0.84, Math.min(rx, ry) * 0.05), rgba(OUTLINE, 0.7));
  ctx.restore();
}

/** Raccoon head facing left (used by the punk and Vinnie). Returns nothing; draws ears, head, face. */
interface CoonHead { x: number; y: number; rx: number; ry: number }
function coonHeadPath(h: CoonHead): Path2D {
  return polar(h.x, h.y, (a) => {
    const deg = ((a * 180) / Math.PI + 360) % 360;
    let r = h.rx;
    if (deg > 6 && deg < 84) {
      const u = (deg - 6) / 78;
      const env = Math.sin(u * Math.PI);
      const saw = (u * 3) % 1;
      r += env * (saw < 0.7 ? saw / 0.7 : (1 - saw) / 0.3) * h.rx * 0.13;
    }
    return r;
  }, 140, h.ry / h.rx);
}

function coonEar(ctx: Ctx, x: number, y: number, r: number, t: Tones, lw: number, notch = false): void {
  let p = circle(x, y, r);
  if (notch) {
    const pts: number[] = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      let rr = r;
      const d = Math.abs(((a - 5.0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < 0.32) rr = r * (0.62 + d * 1.1);
      pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    p = poly(pts);
  }
  cel(ctx, p, t.base, { lw, shade: t.shade, dx: r * 0.15, dy: r * 0.2 });
  cel(ctx, ellipse(x - r * 0.08, y + r * 0.18, r * 0.5, r * 0.56), C.earInner, { shade: PINK_SHADE, dx: r * 0.1, dy: r * 0.12 });
}

// ------------------------------------------------------------------ alley rat
function drawRat(ctx: Ctx, lw: number, color: string, accent: string): void {
  const t = tones(color, 0.12);
  const pink = mix(accent, '#FFFFFF', 0.1);
  const pinkS = shadeOf(pink, 0.18);
  cel(ctx, tube([12, -14, 30, -10, 44, -18, 48, -32, 42, -42], [7, 6, 5, 4, 3]), pink, { lw, shade: pinkS, dx: 1.5, dy: 1.5 });
  cel(ctx, ellipse(9, -4, 9, 4.5), pink, { lw, shade: pinkS, dx: 0, dy: 2 });
  const body = smooth([-12, -44, 8, -46, 21, -32, 22, -14, 13, -2, -6, -1, -19, -8, -23, -26], true);
  celMulti(ctx, body, lw, 3, 4, (dark) => {
    fill(ctx, body, dark ? t.shade : t.base);
    fill(ctx, ellipse(-7, -20, 11, 14), dark ? mix(t.shade, C.creamShade, 0.55) : mix(t.base, C.cream, 0.55));
  });
  cel(ctx, ellipse(-11, -4, 10, 5), pink, { lw, shade: pinkS, dx: 0, dy: 2 });
  // back ear
  cel(ctx, circle(13, -82, 13), t.base, { lw, shade: t.shade, dx: 2, dy: 2 });
  cel(ctx, ellipse(12, -80, 7, 8), pink, { shade: pinkS, dx: 1.5, dy: 1.5 });
  const head = smooth([-2, -94, 16, -90, 26, -74, 22, -56, 6, -46, -16, -46, -36, -52, -52, -61, -50, -69, -34, -80, -18, -90], true);
  celMulti(ctx, head, lw, 3, 5, (dark) => {
    fill(ctx, head, dark ? t.shade : t.base);
    fill(ctx, ellipse(-30, -53, 14, 7), dark ? mix(t.shade, C.creamShade, 0.5) : mix(t.base, C.cream, 0.5));
  });
  inClip(ctx, head, () => softSpot(ctx, 0, -84, 10, 5, '#FFFFFF', 0.35, -0.3));
  // front ear (in front of the head)
  cel(ctx, circle(-9, -88, 14), t.base, { lw, shade: t.shade, dx: 2, dy: 2.5 });
  cel(ctx, ellipse(-10, -86, 7.5, 9), pink, { shade: pinkS, dx: 1.5, dy: 1.5 });
  // face
  beadyEye(ctx, -24, -70, 5, lw);
  beadyEye(ctx, -40, -71, 3.4, lw);
  ink(ctx, [-31, -80, -18, -77], lw * 0.7, OUTLINE, false);
  cel(ctx, circle(-51, -64, 5), pink, { lw: lw * 0.7, shade: pinkS, dx: 1, dy: 1.5, hi: { x: -52.5, y: -66, rx: 1.6, ry: 1.2, a: 0.8 } });
  cel(ctx, rrect(-46, -56, 4.4, 6, 1.2), '#FFFFFF', { lw: lw * 0.45 });
  cel(ctx, rrect(-41.6, -56, 4.4, 6, 1.2), '#FFFFFF', { lw: lw * 0.45 });
  for (const [x0, y0, x1, y1] of [[-46, -61, -62, -63], [-46, -58, -60, -53]]) ink(ctx, [x0, y0, x1, y1], lw * 0.32, rgba(OUTLINE, 0.75), false);
  // fork spear
  const tines = [-36.5, -33, -29.5, -26];
  for (const ty of tines) cel(ctx, tube([-64, ty + 0.5, -76, ty, -86, ty], [2.8, 2.6, 2.4]), C.silver, { lw: lw * 0.75 });
  cel(ctx, roundPoly([-56, -34, -56, -28.5, -66, -24, -66, -38.5], 1.5), C.silver, { lw: lw * 0.85, shade: C.silverShade, dx: 0, dy: 2 });
  cel(ctx, tube([28, -27, -57, -31.2], [4.4, 4.4]), C.silver, { lw: lw * 0.85, shade: C.silverShade, dx: 0, dy: 1.2, hi: { x: -10, y: -30.5, rx: 18, ry: 0.8, a: 0.8 } });
  cel(ctx, circle(-9, -29.5, 5.6), t.base, { lw, shade: t.shade, dx: 1, dy: 1.5 });
  cel(ctx, circle(10, -27.6, 5.6), t.base, { lw, shade: t.shade, dx: 1, dy: 1.5 });
}

// ------------------------------------------------------------------ porch pigeon
function drawPigeon(ctx: Ctx, lw: number, color: string, accent: string): void {
  const t = tones(color, 0.08);
  const coral = '#F07C82';
  const coralS = '#D45E69';
  const tail = smooth([14, -30, 44, -22, 51, -13, 42, -9, 12, -17], true);
  celMulti(ctx, tail, lw, 2, 3, (dark) => {
    fill(ctx, tail, dark ? shadeOf(t.shade, 0.15) : t.shade);
    fill(ctx, poly([36, -30, 60, -20, 50, 0, 30, -8]), dark ? t.darkShade : t.dark);
  });
  for (const lx of [-7, 7]) cel(ctx, tube([lx, -16, lx - 0.5, -2], [4.6, 4]), coral, { lw, shade: coralS, dx: 1, dy: 0 });
  const body = smooth([-35, -56, -21, -70, 1, -69, 20, -56, 27, -38, 22, -19, 6, -11, -16, -11, -32, -22, -41, -40], true);
  const neck = tube([-6, -58, -10, -71, -13, -82], [26, 21, 18]);
  const headC = shadeOf(t.base, 0.04);
  // body + neck share one silhouette
  outline(ctx, body, lw);
  outline(ctx, neck, lw);
  cel(ctx, neck, headC, { shade: t.shade, dx: 2.5, dy: 2 });
  celMulti(ctx, body, 0, 4, 5, (dark) => {
    fill(ctx, body, dark ? t.shade : t.base);
    fill(ctx, ellipse(-22, -38, 14, 18), dark ? t.base : t.light);
    fill(ctx, ellipse(-14, -64, 20, 10, -0.2), dark ? shadeOf(accent, 0.15) : accent);
    fill(ctx, ellipse(-2, -59, 10, 5.5, -0.3), dark ? '#7B5FB0' : '#9C7BCB');
  });
  inClip(ctx, body, () => softSpot(ctx, -24, -44, 5, 9, '#FFFFFF', 0.45, 0.4));
  const wing = smooth([-8, -50, 10, -55, 26, -45, 31, -28, 20, -19, 4, -25, -6, -37], true);
  celMulti(ctx, wing, lw, 3, 4, (dark) => {
    fill(ctx, wing, dark ? shadeOf(t.shade, 0.12) : shadeOf(t.base, 0.08));
    const bar = dark ? t.darkShade : t.dark;
    stroke(ctx, smooth([4, -48, 9, -36, 13, -24], false), bar, 4.2);
    stroke(ctx, smooth([14, -50, 19, -38, 23, -26], false), bar, 4.2);
  });
  for (const [lx, d] of [[-7.5, -1], [6.5, 1]]) {
    for (const tx of [-7, 0, 6]) ink(ctx, [lx, -2, lx + tx + d, 0.5], 3.4, OUTLINE, false);
    for (const tx of [-7, 0, 6]) ink(ctx, [lx, -2, lx + tx + d, 0.5], 1.8, coral, false);
  }
  // tiny head
  const head = circle(-13, -84, 15.5);
  cel(ctx, head, headC, { lw, shade: t.shade, dx: 2, dy: 3, hi: { x: -17, y: -93, rx: 4, ry: 2.5, a: 0.4 } });
  const beak = smooth([-27, -87, -42, -82, -27, -78], true, 0.5);
  cel(ctx, beak, '#E9C9A3', { lw: lw * 0.8, shade: '#C9A57E', dx: 0, dy: 1.5 });
  fill(ctx, ellipse(-27.5, -86.5, 3.8, 2.5), '#FFFFFF');
  // blank stare
  const e = circle(-17, -88, 6.2);
  outline(ctx, e, lw * 0.45);
  fill(ctx, e, '#FF9F43');
  fill(ctx, circle(-17, -88, 4.2), '#FFF7E8');
  fill(ctx, circle(-17, -88, 1.4), OUTLINE);
}

// ------------------------------------------------------------------ punk raccoon
function drawPunk(ctx: Ctx, lw: number, color: string, accent: string): void {
  const t = tones(color, 0.14);
  ringedTail(ctx, [12, -18, 30, -21, 46, -31, 52, -49], [12, 16, 16, 10], t, lw, 2.5, 3);
  for (const fx of [-12, 12]) cel(ctx, ellipse(fx, -4, 11, 5.2), C.paw, { lw, shade: C.pawShade, dx: 0, dy: 2 });
  const torso = smooth([-4, -58, 16, -52, 23, -32, 20, -10, 2, -3, -16, -6, -22, -24, -20, -46], true);
  celMulti(ctx, torso, lw, 3, 4, (dark) => {
    fill(ctx, torso, dark ? t.shade : t.base);
    fill(ctx, ellipse(-8, -28, 11, 15), dark ? C.creamShade : C.cream);
  });
  // far fist (guard)
  cel(ctx, tube([6, -50, -10, -54, -22, -56], [9, 8.5, 8]), t.base, { lw, shade: t.shade, dx: 1, dy: 1.5 });
  cel(ctx, circle(-25, -57, 7), C.paw, { lw, shade: C.pawShade, dx: 1.5, dy: 2 });
  // ears behind the head
  coonEar(ctx, 18, -95, 10, t, lw, true);
  coonEar(ctx, -14, -98, 10, t, lw);
  const h: CoonHead = { x: 0, y: -75, rx: 30, ry: 26 };
  const head = coonHeadPath(h);
  const muzzle = ellipse(-27, -60, 13, 9.5, 0.06);
  outline(ctx, head, lw);
  outline(ctx, muzzle, lw);
  celMulti(ctx, head, 0, 2.5, 4.5, (dark) => {
    fill(ctx, head, dark ? t.shade : t.base);
    // bandana over the top of the head
    const band = smooth([-40, -79, -20, -86, 4, -88, 26, -82, 40, -78, 40, -120, -40, -120], true);
    fill(ctx, band, dark ? shadeOf(accent, 0.18) : accent);
  });
  inClip(ctx, head, () => {
    stroke(ctx, smooth([-40, -79, -20, -86, 4, -88, 26, -82, 40, -78], false), OUTLINE, lw * 1.2);
    for (const [dx, dy] of [[-16, -94], [-2, -97], [12, -93], [4, -88.5], [-10, -88.5], [22, -88]]) fill(ctx, circle(dx, dy, 1.7), '#FFFFFF');
  });
  // mohawk tuft poking out of the bandana
  for (const [x, y, a] of [[-6, -100, -0.2], [3, -101.5, 0], [12, -99.5, 0.25]]) {
    const sp = smooth([x - 4, y + 3, x + Math.sin(a) * 9, y - 9, x + 4, y + 3], true, 0.3);
    cel(ctx, sp, t.dark, { lw, shade: t.darkShade, dx: 1, dy: 1 });
  }
  // knot + tails at the back
  cel(ctx, smooth([28, -88, 44, -96, 46, -86], true, 0.6), accent, { lw, shade: shadeOf(accent, 0.18), dx: 1, dy: 1.5 });
  cel(ctx, smooth([28, -85, 46, -80, 42, -74], true, 0.6), accent, { lw, shade: shadeOf(accent, 0.18), dx: 1, dy: 1.5 });
  cel(ctx, circle(28, -86, 4), shadeOf(accent, 0.1), { lw: lw * 0.8 });
  // face
  fill(ctx, smooth([-36, -70, -26, -78, -10, -78, 6, -77, 19, -71, 17, -63, 3, -62, -12, -62, -26, -60, -37, -64], true), t.dark);
  fill(ctx, smooth([1, -84, -6, -84, -14, -79.5, -8, -79], true), t.light);
  fill(ctx, smooth([-21, -79.5, -26, -83, -33, -82, -30, -79], true), t.light);
  eyeWhite(ctx, -8, -70.5, 5.6, 6.2, lw, -1.6, 0.6, 0.68);
  eyeWhite(ctx, -26, -71.5, 4.2, 5.8, lw, -1.2, 0.6, 0.68);
  ink(ctx, [2, -80, -14, -76], lw * 0.8, OUTLINE, false);
  ink(ctx, [-21, -76.5, -33, -80], lw * 0.7, OUTLINE, false);
  cel(ctx, muzzle, C.cream, { shade: C.creamShade, dx: 1.5, dy: 3 });
  cel(ctx, smooth([-35, -66, -43, -64, -38, -60], true, 0.6), C.nose, { lw: lw * 0.3 });
  ink(ctx, [-36, -55, -30, -53.5, -21, -55.5], lw * 0.55);
  fill(ctx, poly([-29, -54, -26.5, -54.4, -27.6, -50.8]), '#FFFFFF');
  // earring
  stroke(ctx, circle(-20, -92, 2.6), OUTLINE, lw * 0.5 + 2);
  stroke(ctx, circle(-20, -92, 2.6), C.gold, 2);
  // near fist (jab)
  cel(ctx, tube([-10, -44, -22, -42, -32, -42], [9.5, 9, 8.5]), t.base, { lw, shade: t.shade, dx: 1, dy: 1.5 });
  cel(ctx, circle(-35, -42, 7.4), C.paw, { lw, shade: C.pawShade, dx: 1.5, dy: 2, hi: { x: -37, y: -45, rx: 2.5, ry: 1.6, a: 0.4 } });
  ink(ctx, [-40, -44, -40, -39], lw * 0.4, OUTLINE, false);
}

// ------------------------------------------------------------------ Big Earl, the Rat King
function drawRatKing(ctx: Ctx, lw: number, color: string, accent: string): void {
  const t = tones(color, 0.14);
  const card = mix(accent, '#FFFFFF', 0.08);
  const cardS = shadeOf(card, 0.2);
  // pizza-box cape behind him
  const cape = roundPoly([-4, -70, 40, -76, 50, -6, 6, -2], [5, 5, 5, 5]);
  celMulti(ctx, cape, lw, 3, 4, (dark) => {
    fill(ctx, cape, dark ? cardS : card);
    fill(ctx, roundPoly([3, -63, 36, -67, 43, -13, 10, -10], 4), dark ? shadeOf(cardS, 0.08) : mix(card, '#9B6A3C', 0.18));
    fill(ctx, ellipse(24, -30, 9, 6.5, 0.3), rgba('#8A5A2C', dark ? 0.5 : 0.35));
    fill(ctx, ellipse(16, -52, 5.5, 4, -0.4), rgba('#8A5A2C', dark ? 0.5 : 0.35));
  });
  stroke(ctx, roundPoly([3, -63, 36, -67, 43, -13, 10, -10], 4), rgba(OUTLINE, 0.6), lw * 0.5);
  cel(ctx, circle(30, -46, 6), '#D84A3A', { lw: lw * 0.6, shade: '#B5382B', dx: 1, dy: 1.5 });
  for (const [x, y] of [[28, -48], [32, -44.5], [29, -43.5]]) fill(ctx, circle(x, y, 1), '#8F2A20');
  fill(ctx, smooth([14, -24, 20, -27, 25, -23, 22, -18, 16, -19], true), '#FFD54F');
  // tail
  cel(ctx, tube([16, -10, 34, -5, 50, -12, 57, -26], [8, 7, 5, 3.5]), PINK, { lw, shade: PINK_SHADE, dx: 1.5, dy: 1.5 });
  for (const fx of [-14, 14]) cel(ctx, ellipse(fx, -4, 12, 5.2), PINK, { lw, shade: PINK_SHADE, dx: 0, dy: 2 });
  const body = smooth([-22, -60, 2, -66, 24, -56, 32, -34, 26, -10, 4, -1, -20, -4, -32, -22, -32, -44], true);
  celMulti(ctx, body, lw, 4, 5, (dark) => {
    fill(ctx, body, dark ? t.shade : t.base);
    fill(ctx, ellipse(-10, -27, 17, 21), dark ? mix(t.shade, C.creamShade, 0.55) : mix(t.base, C.cream, 0.55));
  });
  // cape tie string
  ink(ctx, [-14, -60, -2, -55, 10, -60], lw * 0.55, '#FFFFFF');
  // back ear
  cel(ctx, circle(15, -86, 12), t.base, { lw, shade: t.shade, dx: 2, dy: 2 });
  cel(ctx, ellipse(14, -84, 6.5, 7.5), PINK, { shade: PINK_SHADE, dx: 1.5, dy: 1.5 });
  const head = smooth([-4, -92, 16, -86, 24, -70, 18, -56, 2, -50, -18, -50, -36, -55, -48, -62, -46, -71, -32, -80, -18, -88], true);
  celMulti(ctx, head, lw, 3, 5, (dark) => {
    fill(ctx, head, dark ? t.shade : t.base);
    fill(ctx, ellipse(-28, -56, 13, 7.5), dark ? mix(t.shade, C.creamShade, 0.5) : mix(t.base, C.cream, 0.5));
  });
  inClip(ctx, head, () => softSpot(ctx, 2, -82, 9, 4.5, '#FFFFFF', 0.3, -0.3));
  cel(ctx, circle(-11, -89, 12), t.base, { lw, shade: t.shade, dx: 2, dy: 2.5 });
  cel(ctx, ellipse(-12, -87, 6.5, 8), PINK, { shade: PINK_SHADE, dx: 1.5, dy: 1.5 });
  // tin-can-lid crown
  ctx.save();
  ctx.translate(2, -93);
  ctx.rotate(-0.1);
  const pts: number[] = [-16, 6];
  const n = 5;
  for (let i = 0; i <= n * 2; i++) {
    const x = -16 + (32 * i) / (n * 2);
    pts.push(x, i % 2 === 0 ? -10 - (i === n ? 3 : 0) : -1);
  }
  pts.push(16, 6);
  const crown = roundPoly(pts, 0.8);
  celMulti(ctx, crown, lw * 0.9, 3, 1.5, (dark) => {
    fill(ctx, crown, dark ? C.silverShade : C.silver);
    fill(ctx, rrect(-17, 0, 34, 7, 0), dark ? shadeOf(C.silverShade, 0.1) : C.silverShade);
  });
  for (let i = 0; i < 6; i++) ink(ctx, [-14 + i * 5.6, 1.5, -13 + i * 5.6, 5.5], lw * 0.3, rgba(OUTLINE, 0.6), false);
  cel(ctx, polar(0, -1, (a) => 3.6 * (0.9 + 0.1 * Math.cos(a * 12)), 48), '#E53935', { lw: lw * 0.55, shade: '#B71C1C', dx: 0.8, dy: 1 });
  ctx.restore();
  // face
  beadyEye(ctx, -23, -71, 4.6, lw, 0.75, t.base);
  ink(ctx, [-31, -80, -16, -79], lw * 0.65, OUTLINE, false);
  cel(ctx, circle(-48, -65, 4.6), PINK, { lw: lw * 0.7, shade: PINK_SHADE, dx: 1, dy: 1.5, hi: { x: -49.5, y: -67, rx: 1.5, ry: 1.1, a: 0.8 } });
  cel(ctx, rrect(-43, -57.5, 4.4, 6, 1.2), '#FFFFFF', { lw: lw * 0.45 });
  cel(ctx, rrect(-38.6, -57.5, 4.4, 6, 1.2), '#FFFFFF', { lw: lw * 0.45 });
  ink(ctx, [-35, -54, -28, -52, -22, -54.5], lw * 0.45);
  for (const [x0, y0, x1, y1] of [[-43, -62, -58, -64], [-43, -59, -56, -54]]) ink(ctx, [x0, y0, x1, y1], lw * 0.3, rgba(OUTLINE, 0.75), false);
  // fork scepter + paw (held out in front, clear of the snout)
  const fx = -16;
  for (const tx of [-44, -40.5, -37, -33.5]) cel(ctx, tube([tx + fx, -84, tx + fx, -94, tx + fx + 0.2, -101], [2.6, 2.5, 2.3]), C.silver, { lw: lw * 0.75 });
  cel(ctx, roundPoly([-45.5 + fx, -84, -32 + fx, -84, -36 + fx, -74, -41.5 + fx, -74], 1.5), C.silver, { lw: lw * 0.85, shade: C.silverShade, dx: 1.5, dy: 0 });
  cel(ctx, tube([-38.6 + fx, -75, -38.4 + fx, -2], [4, 4.4]), C.silver, { lw: lw * 0.85, shade: C.silverShade, dx: 1.2, dy: 0, hi: { x: -39.6 + fx, y: -40, rx: 0.8, ry: 18, a: 0.8 } });
  cel(ctx, tube([-18, -42, -34, -40, -50, -43], [9.5, 9, 8.5]), t.base, { lw, shade: t.shade, dx: 1, dy: 1.5 });
  cel(ctx, circle(-53.5, -44, 6.5), t.base, { lw, shade: t.shade, dx: 1.2, dy: 1.6 });
}

// ------------------------------------------------------------------ Vinnie "Two Lids"
function drawVinnie(ctx: Ctx, lw: number, color: string, accent: string): void {
  const t = tones(color, 0.14);
  // raised back arm + lid
  cel(ctx, tube([12, -54, 22, -64, 28, -70], [10, 9.5, 9]), t.base, { lw, shade: t.shade, dx: 1, dy: 1.5 });
  metalLid(ctx, 33, -73, 17, 20, 0.35, lw);
  cel(ctx, circle(26, -70, 6.4), C.paw, { lw, shade: C.pawShade, dx: 1, dy: 1.5 });
  ringedTail(ctx, [14, -16, 34, -17, 50, -27, 56, -43], [12, 17, 17, 11], t, lw, 2.5, 3);
  for (const fx of [-13, 13]) cel(ctx, ellipse(fx, -4, 12.5, 5.4), C.paw, { lw, shade: C.pawShade, dx: 0, dy: 2 });
  const torso = smooth([-26, -58, 0, -64, 24, -56, 30, -32, 24, -8, 2, -2, -22, -6, -30, -30], true);
  celMulti(ctx, torso, lw, 3.5, 4.5, (dark) => {
    fill(ctx, torso, dark ? t.shade : t.base);
    fill(ctx, ellipse(-6, -28, 14, 18), dark ? C.creamShade : C.cream);
  });
  coonEar(ctx, 17, -97, 9.5, t, lw);
  coonEar(ctx, -15, -99, 9.5, t, lw, true);
  const h: CoonHead = { x: -2, y: -78, rx: 29, ry: 24 };
  const head = coonHeadPath(h);
  const muzzle = ellipse(-26, -64, 13.5, 9.5, 0.05);
  outline(ctx, head, lw);
  outline(ctx, muzzle, lw);
  const bandTop = [-40, -90, -16, -95, 10, -95, 32, -90];
  const bandBot = [32, -82, 10, -87, -16, -87, -40, -82];
  celMulti(ctx, head, 0, 2.5, 4.5, (dark) => {
    fill(ctx, head, dark ? t.shade : t.base);
    fill(ctx, smooth([...bandTop, ...bandBot], true, 0.5), dark ? shadeOf(accent, 0.2) : accent);
  });
  inClip(ctx, head, () => {
    ink(ctx, bandTop, lw * 0.9);
    ink(ctx, bandBot, lw * 0.9);
  });
  // headband knot + tails
  cel(ctx, smooth([28, -90, 44, -98, 47, -88], true, 0.6), accent, { lw, shade: shadeOf(accent, 0.2), dx: 1, dy: 1.5 });
  cel(ctx, smooth([28, -86, 47, -82, 43, -76], true, 0.6), accent, { lw, shade: shadeOf(accent, 0.2), dx: 1, dy: 1.5 });
  cel(ctx, circle(28, -87.5, 4.2), shadeOf(accent, 0.12), { lw: lw * 0.8 });
  // face: mask, heavy brows, scar, toothpick grin
  fill(ctx, smooth([-37, -72, -28, -79, -12, -80, 4, -79, 18, -73, 16, -65, 2, -64, -12, -64, -26, -62, -38, -66], true), t.dark);
  eyeWhite(ctx, -9, -72, 5.4, 5.6, lw, -1.6, 0.8, 0.66);
  eyeWhite(ctx, -27, -72.5, 4, 5.2, lw, -1.2, 0.8, 0.66);
  cel(ctx, smooth([3, -84, -2, -80, -17, -77.5, -15, -81], true, 0.6), t.dark, { lw: lw * 0.5 });
  cel(ctx, smooth([-22, -77.5, -34, -80.5, -31, -83, -23, -81], true, 0.6), t.dark, { lw: lw * 0.5 });
  ink(ctx, [0, -86, -4, -76, -7, -65], lw * 0.5, mix(t.base, '#FFFFFF', 0.5));
  cel(ctx, muzzle, C.cream, { shade: C.creamShade, dx: 1.5, dy: 3 });
  cel(ctx, smooth([-35, -70, -44, -68, -39, -63], true, 0.6), C.nose, { lw: lw * 0.3 });
  // grin with teeth
  const grin = smooth([-36, -59, -26, -57.5, -17, -60, -20, -54, -32, -54.5], true, 0.6);
  cel(ctx, grin, '#FFFFFF', { lw: lw * 0.5 });
  ink(ctx, [-35, -57, -19, -57.5], lw * 0.3, rgba(OUTLINE, 0.7), false);
  cel(ctx, tube([-20, -57, -10, -61, -3, -63], [2.4, 2.2, 2]), C.woodLight, { lw: lw * 0.5 });
  // front arm + lid in front of the body
  cel(ctx, tube([-14, -48, -26, -42, -34, -40], [10.5, 10, 9.5]), t.base, { lw, shade: t.shade, dx: 1, dy: 1.5 });
  metalLid(ctx, -42, -38, 19, 21.5, -0.1, lw);
  cel(ctx, circle(-26, -39, 7.2), C.paw, { lw, shade: C.pawShade, dx: 1.5, dy: 2, hi: { x: -28, y: -42, rx: 2.5, ry: 1.6, a: 0.4 } });
}

// ------------------------------------------------------------------ Officer Dale
function drawOfficer(ctx: Ctx, lw: number, color: string, accent: string): void {
  const u = tones(color, 0.16);
  const pants = shadeOf(u.base, 0.28);
  const skin = C.skin;
  const skinS = C.skinShade;
  const boot = '#3E3436';
  const stache = '#7A4E36';
  // catch pole behind the hand
  stroke(ctx, ellipse(-122, -57, 10, 12.5, 0.15), OUTLINE, 3.4 + lw * 2);
  stroke(ctx, ellipse(-122, -57, 10, 12.5, 0.15), '#F0643E', 3.4);
  cel(ctx, rrect(-114, -60.5, 8, 7, 2), C.iron, { lw: lw * 0.8 });
  cel(ctx, tube([-4, -47.5, -108, -57], [4.6, 4.2]), C.metal, { lw: lw * 0.85, shade: C.metalShade, dx: 0, dy: 1.3, hi: { x: -60, y: -53.5, rx: 24, ry: 0.8, a: 0.8, rot: 0.09 } });
  cel(ctx, tube([-10, -48, -26, -49.5], [6.6, 6.6]), '#3B3B45', { lw: lw * 0.85 });
  // legs + boots
  for (const lx of [-15, 3]) cel(ctx, rrect(lx, -26, 13, 21, 3), pants, { lw, shade: shadeOf(pants, 0.18), dx: 2, dy: 0 });
  for (const bx of [-11, 8]) cel(ctx, smooth([bx - 10, -1, bx - 11, -6, bx - 5, -10, bx + 7, -10, bx + 8, -1], true), boot, { lw, shade: '#2A2325', dx: 0, dy: 2, hi: { x: bx - 4, y: -7.5, rx: 3, ry: 1.2, a: 0.35 } });
  // back arm (behind the clipboard)
  cel(ctx, tube([16, -60, 24, -50, 24, -42], [11, 10, 9.5]), u.base, { lw, shade: u.shade, dx: 1.5, dy: 1.5 });
  // torso
  const torso = roundPoly([-24, -64, 22, -64, 26, -24, -26, -24], [9, 9, 4, 4]);
  celMulti(ctx, torso, lw, 4, 3, (dark) => {
    fill(ctx, torso, dark ? u.shade : u.base);
    fill(ctx, rrect(-22, -51, 13, 7, 2), dark ? shadeOf(u.shade, 0.15) : u.shade);
    fill(ctx, rrect(7, -51, 13, 7, 2), dark ? shadeOf(u.shade, 0.15) : u.shade);
  });
  ink(ctx, [-1.5, -62, -1.5, -32], lw * 0.4, rgba(OUTLINE, 0.65), false);
  for (const y of [-55, -45, -36]) fill(ctx, circle(-1.5 + 2, y, 1.4), C.gold);
  // badge
  cel(ctx, star(-15, -42, 6.2, 3.4, 6, -Math.PI / 2), accent, { lw: lw * 0.6, shade: shadeOf(accent, 0.2), dx: 1, dy: 1.2 });
  fill(ctx, circle(-15, -42, 1.6), '#FFF6D0');
  // belt
  cel(ctx, rrect(-27, -31, 54, 8, 2), '#4A3528', { lw, shade: '#3A281E', dx: 0, dy: 2 });
  cel(ctx, rrect(-8, -31.5, 11, 9, 2), accent, { lw: lw * 0.7, shade: shadeOf(accent, 0.2), dx: 1, dy: 1 });
  // clipboard + hand
  ctx.save();
  ctx.translate(23, -45);
  ctx.rotate(0.12);
  cel(ctx, rrect(-11, -15, 22, 30, 2.5), '#B67C49', { lw, shade: '#93603A', dx: 2, dy: 2 });
  fill(ctx, rrect(-8, -11, 16, 23, 1), '#FFFFFF');
  for (const y of [-6, -2, 2, 6]) ink(ctx, [-5, y, 5, y], 0.9, '#9AA7BC', false);
  cel(ctx, rrect(-5, -17, 10, 5, 1.5), C.silver, { lw: lw * 0.6, shade: C.silverShade, dx: 0, dy: 1 });
  ctx.restore();
  cel(ctx, circle(21, -36, 5.6), skin, { lw, shade: skinS, dx: 1, dy: 1.4 });
  // head
  const head = roundPoly([-20, -91, 17, -91, 19, -62, -22, -60], [9, 9, 10, 11]);
  celMulti(ctx, head, lw, 3, 3, (dark) => {
    fill(ctx, head, dark ? skinS : skin);
    fill(ctx, rrect(8, -88, 14, 16, 5), dark ? shadeOf(stache, 0.15) : stache);
  });
  cel(ctx, ellipse(16, -75, 4, 5.5), skin, { lw: lw * 0.8, shade: skinS, dx: 1, dy: 1 });
  // cap
  const cap = roundPoly([-22, -84, 19, -84, 17, -101, -19, -101], [3, 3, 7, 7]);
  celMulti(ctx, cap, lw, 3, 2.5, (dark) => {
    fill(ctx, cap, dark ? u.shade : u.base);
    fill(ctx, rrect(-24, -90, 46, 6, 0), dark ? shadeOf(pants, 0.15) : pants);
  });
  cel(ctx, smooth([-21, -88, -36, -87, -41, -83, -22, -83], true, 0.6), '#2F2F38', { lw, shade: '#22222A', dx: 0, dy: 1 });
  cel(ctx, roundPoly([-9, -98.5, -3, -98.5, -2.5, -93, -6, -90, -9.5, -93], 1), accent, { lw: lw * 0.55, shade: shadeOf(accent, 0.2), dx: 1, dy: 1 });
  // face
  fill(ctx, ellipse(-8, -77, 2.1, 2.8), OUTLINE);
  fill(ctx, ellipse(-17.5, -77, 1.8, 2.5), OUTLINE);
  ink(ctx, [-3.5, -82.5, -11, -80.5], lw * 0.65, OUTLINE, false);
  ink(ctx, [-14.5, -80.5, -21, -82], lw * 0.6, OUTLINE, false);
  const nose = ellipse(-22.5, -72.5, 4.6, 4);
  cel(ctx, nose, skin, { lw: lw * 0.7, shade: skinS, dx: 1, dy: 1.2 });
  softSpot(ctx, -24, -71.5, 3, 2, '#FF8A80', 0.6);
  const ms = smooth([-31, -67, -24, -70.5, -14, -70, -4, -70.5, 2, -66.5, -3, -63.5, -8, -66, -14, -63.5, -20, -66, -26, -63.5], true, 0.7);
  cel(ctx, ms, stache, { lw: lw * 0.75, shade: shadeOf(stache, 0.2), dx: 0, dy: 1.6 });
  ink(ctx, [-16, -60.6, -10, -61.4], lw * 0.4, OUTLINE, false);
  // front arm reaching to the pole (sleeve + hand)
  cel(ctx, tube([-18, -60, -24, -54, -30, -50], [11, 10.5, 10]), u.base, { lw, shade: u.shade, dx: 1.5, dy: 1.5 });
  cel(ctx, circle(-33, -49.5, 6), skin, { lw, shade: skinS, dx: 1.2, dy: 1.5, hi: { x: -35, y: -52, rx: 2.2, ry: 1.4, a: 0.45 } });
}

const DRAW: Record<EnemyShape, (ctx: Ctx, lw: number, color: string, accent: string) => void> = {
  rat: drawRat,
  pigeon: drawPigeon,
  raccoon: drawPunk,
  ratKing: drawRatKing,
  raccoonBoss: drawVinnie,
  officer: drawOfficer,
};

/** Design-space bounds [minX, minY, maxX, maxY] per shape (units; 100 = S px). */
const BOUNDS: Record<EnemyShape, [number, number, number, number]> = {
  rat: [-92, -108, 54, 8],
  pigeon: [-48, -104, 64, 8],
  raccoon: [-50, -112, 60, 8],
  ratKing: [-70, -112, 62, 8],
  raccoonBoss: [-66, -112, 64, 8],
  officer: [-138, -106, 40, 8],
};

export function enemyLineWidth(S: number): number {
  return clamp(3.4 + S * 0.008, 3, 8);
}

export function enemySprite(shape: EnemyShape, S: number, color: string, accent: string): { canvas: HTMLCanvasElement; feet: Pt } {
  const k = S / 100;
  const lwPx = enemyLineWidth(S);
  const [x0, y0, x1, y1] = BOUNDS[shape];
  const pad = Math.ceil(lwPx + 3);
  const w = Math.ceil((x1 - x0) * k + pad * 2);
  const h = Math.ceil((y1 - y0) * k + pad * 2);
  const feet = { x: Math.round(-x0 * k + pad), y: Math.round(-y0 * k + pad) };
  const { c, ctx } = makeCanvas(w, h);
  ctx.translate(feet.x, feet.y);
  ctx.scale(k, k);
  DRAW[shape](ctx, lwPx / k, color, accent);
  return { canvas: c, feet };
}
