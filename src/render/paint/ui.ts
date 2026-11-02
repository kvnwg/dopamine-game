/** Painted UI pieces used by React (as data URLs): the dumpster body and lid. */
import { DATA } from '../../data';
import {
  ellipse, fillShape, glow, ink, LAMP, makeCanvas, mix, NEON_CYAN, paint, rrect, seeded, shadowOf, shape, stroke,
  within, type Pt,
} from './brush';

const GREEN = DATA.assets.placeholders.palette.dumpster;

/** The dumpster body (painted at 2x for crisp scaling). */
export function dumpsterBodyUrl(): string {
  const W = 640;
  const H = 400;
  const { c, ctx } = makeCanvas(W, H);
  const rnd = seeded(91);
  const body: Pt[] = [{ x: 14, y: 22 }, { x: W - 14, y: 22 }, { x: W - 34, y: H - 40 }, { x: 34, y: H - 40 }];
  glow(ctx, W / 2, H / 2, W * 0.55, mix(GREEN, '#69F0AE', 0.4), 0.18);
  const b = paint(ctx, rnd, body, { color: mix(GREEN, '#3F8F5F', 0.35), rim: NEON_CYAN, light: LAMP, lightAlpha: 0.35, grain: 0.3 });
  within(ctx, b, () => {
    // Ribs and grime.
    for (const x of [130, 250, 390, 510]) {
      fillShape(ctx, rrect(x - 14, 50, 28, H - 120, 10), shadowOf(GREEN, 0.35), 0.55);
      stroke(ctx, rnd, [{ x: x - 12, y: 58 }, { x: x - 12, y: H - 76 }], 3, mix(GREEN, '#FFFFFF', 0.35), 0.35);
    }
    for (let i = 0; i < 6; i++) fillShape(ctx, ellipse(60 + rnd() * (W - 120), 90 + rnd() * (H - 180), 10 + rnd() * 22, 6 + rnd() * 10), shadowOf(GREEN, 0.6), 0.25);
  });
  ink(ctx, rnd, body, { width: 9 });
  // Side handles and wheels.
  for (const x of [8, W - 8]) shape(ctx, rnd, rrect(x - 10, 70, 20, 60, 8), { color: shadowOf(GREEN, 0.4), line: 6 });
  for (const x of [90, W - 90]) shape(ctx, rnd, ellipse(x, H - 30, 26, 24), { color: '#2A2730', line: 6, light: '#9A8FB5', lightAlpha: 0.3 });
  return c.toDataURL('image/png');
}

/** The dumpster lid, a separate piece so it can rattle and flip open. */
export function dumpsterLidUrl(): string {
  const W = 680;
  const H = 110;
  const { c, ctx } = makeCanvas(W, H);
  const rnd = seeded(92);
  const lid = rrect(10, 14, W - 20, H - 34, 22);
  paint(ctx, rnd, lid, { color: shadowOf(mix(GREEN, '#3F8F5F', 0.2), 0.25), rim: NEON_CYAN, light: LAMP, lightAlpha: 0.4, grain: 0.3 });
  ink(ctx, rnd, lid, { width: 9 });
  shape(ctx, rnd, rrect(W / 2 - 60, 2, 120, 26, 10), { color: '#2A2730', line: 6, light: '#9A8FB5', lightAlpha: 0.3 });
  return c.toDataURL('image/png');
}
