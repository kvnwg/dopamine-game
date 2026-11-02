/**
 * The hero: a chibi raccoon facing right, drawn in RACCOON_FRAME pixel coordinates.
 * The front paw is a separate sprite so the weapon grip can sit between body and paw.
 */
import { CEL_PALETTE as C } from './palette';
import {
  type Ctx, type Pt, cel, celMulti, circle, ellipse, fill, inClip, ink, makeCanvas, moved, outline,
  polar, sampleCurve, smooth, softSpot, stroke, tube,
} from './core';

/** The face is designed around a head center of (150, 188) and shifted by FACE_DX. */
const FACE_DX = -5;

export const RACCOON_FRAME: { w: 360; h: 360; feet: Pt; hand: Pt; head: Pt } = {
  w: 360,
  h: 360,
  feet: { x: 160, y: 344 },
  hand: { x: 212, y: 258 },
  head: { x: 150 + FACE_DX, y: 188 },
};

/** Outline width on the hero (px). */
export const HERO_LW = 5;

/** Anatomy landmarks shared with the gear overlays (all in RACCOON_FRAME px). */
export const ANAT = {
  head: { x: 150 + FACE_DX, y: 188, rx: 67, ry: 57 },
  earBack: { x: 103 + FACE_DX, y: 146, r: 21 },
  earFront: { x: 188 + FACE_DX, y: 138, r: 20 },
  eyeNear: { x: 158 + FACE_DX, y: 190, rx: 12.5, ry: 14.5 },
  eyeFar: { x: 202 + FACE_DX, y: 186, rx: 10, ry: 13.5 },
  muzzle: { x: 206 + FACE_DX, y: 213, rx: 24, ry: 17.5 },
  torso: { x: 160, y: 290 },
  chest: { x: 165, y: 270 },
  backPaw: { x: 115, y: 284, r: 12.5 },
  footBack: { x: 138, y: 334, rx: 19, ry: 10 },
  footFront: { x: 184, y: 334.5, rx: 20, ry: 10 },
};

const TORSO_PTS = [160, 236, 196, 244, 211, 272, 212, 310, 197, 336, 160, 345, 123, 337, 108, 311, 109, 272, 124, 244];
const TAIL_PTS = [126, 318, 98, 328, 69, 320, 50, 297, 45, 268, 54, 244];
const TAIL_W = [26, 40, 47, 47, 41, 24];
const BACK_ARM = [128, 253, 124, 264, 120, 273];
const FRONT_ARM = [185, 249, 199, 255, 209, 258];

export function torsoPath(): Path2D {
  return smooth(TORSO_PTS, true);
}

/** Head silhouette in face-design coordinates (center 150,188), with swept cheek tufts at the back. */
function headLocal(): Path2D {
  const cx = 150, cy = 188, rx = 67, ry = 57;
  const tufts: Array<[number, number, number]> = [[116, 9, 9], [137, 11, 12], [158, 10, 8.5]];
  return polar(cx, cy, (a) => {
    const deg = ((a * 180) / Math.PI + 360) % 360;
    let r = rx;
    for (const [c, w, h] of tufts) {
      const d = deg - c;
      const u = d < 0 ? -d / (w * 1.35) : d / (w * 0.62);
      if (u < 1) r += h * Math.pow(1 - u, 1.7);
    }
    return r;
  }, 360, ry / rx);
}

export function headPath(): Path2D {
  return moved(headLocal(), FACE_DX, 0);
}

function muzzleLocal(): Path2D {
  return ellipse(206, 213, 24, 17.5, -0.08);
}

function drawTail(ctx: Ctx, lw: number): void {
  const p = tube(TAIL_PTS, TAIL_W, 10);
  const s = sampleCurve(TAIL_PTS, 10, false);
  const band = (t0: number, t1: number, color: string) => {
    const i0 = Math.floor(t0 * (s.length - 1));
    const i1 = Math.ceil(t1 * (s.length - 1));
    const pts: number[] = [];
    for (let i = i0; i <= i1; i++) pts.push(s[i].x, s[i].y);
    stroke(ctx, smooth(pts, false), color, 80, 'butt');
  };
  celMulti(ctx, p, lw, 5, 7, (dark) => {
    fill(ctx, p, dark ? C.furShade : C.fur);
    const d = dark ? C.furDarkShade : C.furDark;
    band(0.3, 0.4, d);
    band(0.53, 0.63, d);
    band(0.75, 0.84, d);
    band(0.93, 1, d);
  });
  inClip(ctx, p, () => softSpot(ctx, 62, 282, 6, 16, '#FFFFFF', 0.22, 0.45, 0.7));
}

function drawEar(ctx: Ctx, x: number, y: number, r: number, lw: number, ix: number): void {
  cel(ctx, circle(x, y, r), C.fur, { lw, shade: C.furShade, dx: 3, dy: 4 });
  cel(ctx, ellipse(x + ix, y + 4, r * 0.52, r * 0.58), C.earInner, { shade: C.pinkShade, dx: 2, dy: 3 });
}

export function drawBackArm(ctx: Ctx, lw: number): void {
  cel(ctx, tube(BACK_ARM, [25, 23]), C.fur, { lw, shade: C.furShade, dx: 3, dy: 3 });
  drawBackPaw(ctx, lw);
}

export function drawBackPaw(ctx: Ctx, lw: number): void {
  const b = ANAT.backPaw;
  cel(ctx, circle(b.x, b.y, b.r), C.paw, { lw, shade: C.pawShade, dx: 2, dy: 3, hi: { x: b.x - 4, y: b.y - 5, rx: 4, ry: 3, a: 0.35 } });
  ink(ctx, [b.x - 6, b.y + 8, b.x - 5, b.y + 3], 2.4);
  ink(ctx, [b.x + 0.5, b.y + 10, b.x + 0.5, b.y + 4.5], 2.4);
}

export function drawFrontArm(ctx: Ctx, lw: number): void {
  cel(ctx, tube(FRONT_ARM, [24, 22, 21]), C.fur, { lw, shade: C.furShade, dx: 2, dy: 4 });
}

function drawFoot(ctx: Ctx, x: number, y: number, rx: number, ry: number, lw: number): void {
  cel(ctx, ellipse(x, y, rx, ry), C.paw, { lw, shade: C.pawShade, dx: 2, dy: 3, hi: { x: x - 4, y: y - 4, rx: 7, ry: 3, a: 0.3 } });
  ink(ctx, [x + rx * 0.35, y + ry * 0.9, x + rx * 0.3, y + ry * 0.1], 2.2);
  ink(ctx, [x + rx * 0.72, y + ry * 0.6, x + rx * 0.66, y], 2.2);
}

function drawTorso(ctx: Ctx, lw: number): void {
  const t = torsoPath();
  const belly = ellipse(178, 299, 26, 34, -0.05);
  const cast = moved(headPath(), 4, 11);
  celMulti(ctx, t, lw, 6, 7, (dark) => {
    fill(ctx, t, dark ? C.furShade : C.fur);
    fill(ctx, belly, dark ? C.creamShade : C.cream);
    if (!dark) {
      inClip(ctx, cast, () => {
        fill(ctx, t, C.furShade);
        fill(ctx, belly, C.creamShade);
      });
    }
  });
}

function drawEye(ctx: Ctx, e: { x: number; y: number; rx: number; ry: number }, k: number): void {
  const w = ellipse(e.x, e.y, e.rx, e.ry);
  outline(ctx, w, 2.2);
  fill(ctx, w, C.eyeWhite);
  inClip(ctx, w, () => {
    fill(ctx, ellipse(e.x + 3.5 * k, e.y + 2 * k, e.rx * 0.74, e.ry * 0.76), C.pupil);
    softSpot(ctx, e.x + 3 * k, e.y + 7 * k, e.rx * 0.5, e.ry * 0.25, '#7A6FA0', 0.55);
  });
  fill(ctx, circle(e.x + 6 * k, e.y - 4 * k, 4 * k), '#FFFFFF');
  fill(ctx, circle(e.x + 0.5 * k, e.y + 6.5 * k, 1.8 * k), '#FFFFFF');
}

/** Head and face, drawn in face-design coordinates (the caller shifts by FACE_DX). */
function drawHeadLocal(ctx: Ctx, lw: number): void {
  const h = headLocal();
  const m = muzzleLocal();
  // one silhouette for head + muzzle (no inner line between them)
  outline(ctx, h, lw);
  outline(ctx, m, lw);
  celMulti(ctx, h, 0, 5, 9, (dark) => fill(ctx, h, dark ? C.furShade : C.fur));
  inClip(ctx, h, () => softSpot(ctx, 124, 150, 15, 7, '#FFFFFF', 0.32, -0.5, 0.72));
  // light brows
  fill(ctx, ellipse(153, 162, 18, 8, -0.12), C.furLight);
  fill(ctx, ellipse(203, 159, 13, 7, 0.18), C.furLight);
  // forehead stripe and mask band
  fill(ctx, smooth([167, 172, 183, 172, 180, 150, 175, 134, 170, 150], true), C.furDark);
  const mask = smooth([93, 186, 107, 172, 132, 166, 156, 170, 178, 166, 200, 164, 217, 171, 225, 185, 219, 199, 203, 206, 184, 206, 168, 212, 148, 214, 126, 208, 105, 199], true);
  celMulti(ctx, mask, 0, 0, 4, (dark) => fill(ctx, mask, dark ? C.furDarkShade : C.furDark));
  drawEye(ctx, { x: 158, y: 190, rx: 12.5, ry: 14.5 }, 1);
  drawEye(ctx, { x: 202, y: 186, rx: 10, ry: 13.5 }, 0.82);
  // muzzle (shares the head silhouette)
  cel(ctx, m, C.cream, { shade: C.creamShade, dx: 3, dy: 6, hi: { x: 199, y: 205, rx: 9, ry: 4, a: 0.6 } });
  // nose and mouth
  const nose = smooth([218, 199, 235, 197, 230, 209, 224, 211], true);
  outline(ctx, nose, 1.2);
  fill(ctx, nose, C.nose);
  fill(ctx, ellipse(224.5, 201, 3.2, 2, -0.2), 'rgba(255,255,255,0.75)');
  ink(ctx, [227.5, 210, 226.5, 217, 220, 221, 213, 219], 3.2);
  softSpot(ctx, 152, 223, 10, 5.5, C.blush, 0.6);
}

/** Full hero body (no front paw). */
export function drawRaccoonBody(ctx: Ctx, lw = HERO_LW): void {
  drawTail(ctx, lw);
  drawEar(ctx, ANAT.earBack.x, ANAT.earBack.y, ANAT.earBack.r, lw, 2);
  drawEar(ctx, ANAT.earFront.x, ANAT.earFront.y, ANAT.earFront.r, lw, -2);
  drawTorso(ctx, lw);
  drawFoot(ctx, ANAT.footBack.x, ANAT.footBack.y, ANAT.footBack.rx, ANAT.footBack.ry, lw);
  drawFoot(ctx, ANAT.footFront.x, ANAT.footFront.y, ANAT.footFront.rx, ANAT.footFront.ry, lw);
  drawBackArm(ctx, lw);
  drawFrontArm(ctx, lw);
  ctx.save();
  ctx.translate(FACE_DX, 0);
  drawHeadLocal(ctx, lw);
  ctx.restore();
}

export function raccoonBody(): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(RACCOON_FRAME.w, RACCOON_FRAME.h);
  drawRaccoonBody(ctx);
  return c;
}

/** Front paw: a round mitt with finger creases, drawn over the weapon grip. */
export function drawFrontPaw(ctx: Ctx, x: number, y: number, lw = HERO_LW): void {
  const p = circle(x, y, 12.5);
  cel(ctx, p, C.paw, { lw, shade: C.pawShade, dx: 2, dy: 3, hi: { x: x - 4, y: y - 5, rx: 5, ry: 3.5, a: 0.4 } });
  for (const dy of [-4.5, 0.5, 5.5]) ink(ctx, [x + 3, y + dy, x + 9, y + dy + 0.5], 2.2);
}

export function raccoonPaw(): { canvas: HTMLCanvasElement; center: Pt } {
  const size = 44;
  const { c, ctx } = makeCanvas(size, size);
  drawFrontPaw(ctx, size / 2, size / 2);
  return { canvas: c, center: { x: size / 2, y: size / 2 } };
}
