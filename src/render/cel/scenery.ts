/**
 * Sunny suburban street scenery. Tiles are 2048 px wide and wrap seamlessly: every object is drawn
 * through wrapX and every procedural contour is periodic over the tile width.
 */
import { CEL_PALETTE as C, OUTLINE } from './palette';
import {
  type Ctx, type Rng, TAU, cel, celMulti, circle, ellipse, fill, inClip, ink, makeCanvas, mix, moved, outline, poly,
  rgba, rng, roundPoly, rrect, shadeOf, smooth, softSpot, stroke, tube, union, wrapX,
} from './core';

export const TILE_W = 2048;
const LW = 5; // scenery ink

// ------------------------------------------------------------------ helpers
/** Periodic contour over the tile: base + sum of sines with integer cycle counts. */
function wave(base: number, terms: Array<[number, number, number]>): (x: number) => number {
  return (x) => {
    let y = base;
    for (const [amp, cycles, phase] of terms) y += amp * Math.sin((x / TILE_W) * TAU * cycles + phase);
    return y;
  };
}

function contourFill(f: (x: number) => number, bottom: number): Path2D {
  const pts: number[] = [];
  for (let x = -8; x <= TILE_W + 8; x += 8) pts.push(x, f(x));
  pts.push(TILE_W + 8, bottom, -8, bottom);
  return poly(pts);
}

function contourLine(f: (x: number) => number): Path2D {
  const pts: number[] = [];
  for (let x = -8; x <= TILE_W + 8; x += 8) pts.push(x, f(x));
  return poly(pts, false);
}

/** A puffy blob as a union of circles (canopies, bushes, clouds). */
function puffs(list: Array<[number, number, number]>): Path2D {
  return union(...list.map(([x, y, r]) => circle(x, y, r)));
}

/** Union-safe cel blob: outline, fill, shadow crescent, optional highlight. */
function blob(ctx: Ctx, p: Path2D, color: string, shadeC: string, lw: number, dx: number, dy: number, line = OUTLINE): void {
  if (lw > 0) outline(ctx, p, lw, line);
  fill(ctx, p, color);
  ctx.save();
  ctx.clip(p);
  fill(ctx, p, shadeC);
  fill(ctx, moved(p, -dx, -dy), color);
  ctx.restore();
}

// ------------------------------------------------------------------ sky + clouds
export function sky(w: number, h: number): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, C.skyTop);
  g.addColorStop(0.45, C.skyMid);
  g.addColorStop(0.75, C.skyLow);
  g.addColorStop(1, mix(C.skyLow, '#FFFFFF', 0.25));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // a few big pale cloud mounds rising from behind the horizon (lower parts hide behind the far layer)
  const mounds: Array<[number, number, number]> = [[0.13, 0.5, 0.15], [0.52, 0.46, 0.19], [0.9, 0.52, 0.14]];
  for (const [fx, fy, fr] of mounds) {
    const cx = fx * w, cy = fy * h, R = fr * w;
    const p = puffs([
      [cx - R * 0.62, cy + R * 0.32, R * 0.52],
      [cx - R * 0.18, cy - R * 0.02, R * 0.66],
      [cx + R * 0.38, cy + R * 0.12, R * 0.56],
      [cx + R * 0.8, cy + R * 0.48, R * 0.4],
      [cx - R * 0.95, cy + R * 0.7, R * 0.36],
    ]);
    const q = union(p, rrect(cx - R * 1.3, cy + R * 0.55, R * 2.5, h, R * 0.3));
    fill(ctx, q, C.horizonCloud);
    inClip(ctx, q, () => {
      fill(ctx, moved(p, -R * 0.05, -R * 0.06), C.horizonCloudHi);
      fill(ctx, moved(p, R * 0.02, R * 0.07), C.horizonCloud);
    });
  }
  return c;
}

export function cloudSprite(i: number): HTMLCanvasElement {
  const specs: Array<{ w: number; h: number; bumps: Array<[number, number, number]> }> = [
    { w: 320, h: 150, bumps: [[70, 98, 42], [128, 70, 58], [196, 78, 50], [248, 100, 36], [160, 108, 44]] },
    { w: 430, h: 170, bumps: [[70, 122, 40], [125, 92, 56], [195, 70, 66], [270, 88, 56], [338, 112, 40], [200, 124, 50]] },
    { w: 270, h: 128, bumps: [[62, 86, 36], [114, 62, 48], [170, 72, 42], [214, 92, 30], [140, 94, 38]] },
  ];
  const s = specs[((i % 3) + 3) % 3];
  const { c, ctx } = makeCanvas(s.w, s.h);
  const base = s.bumps.map(([x, , r]) => [x, r] as const);
  const xs = base.map(([x]) => x);
  const x0 = Math.min(...xs) - 10, x1 = Math.max(...xs) + 10;
  const bottom = s.h - 22;
  const p = union(puffs(s.bumps), rrect(x0, bottom - 34, x1 - x0, 34, 17));
  fill(ctx, p, C.cloud);
  inClip(ctx, p, () => {
    fill(ctx, p, C.cloudShade);
    fill(ctx, moved(p, -6, -12), C.cloud);
  });
  return c;
}

// ------------------------------------------------------------------ far layer
function farTree(ctx: Ctx, x: number, base: number, size: number, r: Rng): void {
  const trunkH = size * 0.75;
  const tw = size * 0.22;
  const trunk = tube([x, base, x - tw * 0.1, base - trunkH * 0.6, x + tw * 0.1, base - trunkH], [tw * 1.3, tw, tw * 0.8]);
  cel(ctx, trunk, C.farTrunk, { lw: 4, line: C.farLine, shade: shadeOf(C.farTrunk, 0.15), dx: tw * 0.3, dy: 0 });
  const cy = base - trunkH - size * 0.45;
  const list: Array<[number, number, number]> = [
    [x, cy, size * 0.62],
    [x - size * 0.55, cy + size * 0.22, size * 0.45],
    [x + size * 0.55, cy + size * 0.2, size * 0.47],
    [x - size * 0.2 + r() * 8, cy - size * 0.38, size * 0.42],
    [x + size * 0.3, cy - size * 0.25, size * 0.4],
  ];
  const p = puffs(list);
  blob(ctx, p, C.farTree, C.farTreeShade, 4, size * 0.08, size * 0.16, C.farLine);
  inClip(ctx, p, () => {
    for (const [bx, by, br] of list.slice(3)) stroke(ctx, smooth([bx - br * 0.7, by + br * 0.55, bx, by + br * 0.85, bx + br * 0.7, by + br * 0.55], false), C.farTreeShade, 5);
    softSpot(ctx, x - size * 0.25, cy - size * 0.45, size * 0.22, size * 0.1, C.farTreeHi, 0.9, -0.3, 0.7);
  });
}

export function farLayer(): HTMLCanvasElement {
  const H = 360;
  const { c, ctx } = makeCanvas(TILE_W, H);
  const r = rng(77);
  // distant hills
  const hills = wave(206, [[24, 2, 0.4], [16, 5, 1.9], [7, 11, 0.3]]);
  const hp = contourFill(hills, H + 10);
  fill(ctx, hp, C.hill);
  inClip(ctx, hp, () => {
    stroke(ctx, contourLine((x) => hills(x) + 7), C.hillHi, 10);
    fill(ctx, contourFill((x) => hills(x) + 60 + 10 * Math.sin((x / TILE_W) * TAU * 7), H + 10), mix(C.hill, C.farField, 0.25));
  });
  stroke(ctx, contourLine(hills), C.hillLine, 3);
  // tree line
  const trees: Array<[number, number]> = [];
  let x = 20;
  while (x < TILE_W - 40) {
    trees.push([x, 52 + r() * 34]);
    x += 110 + r() * 120;
  }
  for (const [tx, size] of trees) wrapX(TILE_W, tx, size * 1.3, (xx) => farTree(ctx, xx, 300, size, r));
  // bush row in front of the trunks
  const bushes = wave(282, [[8, 13, 0.7], [5, 29, 2.1]]);
  const bp = new Path2D();
  for (let bx = 0; bx < TILE_W; bx += 46) {
    const rr = 22 + 6 * Math.sin((bx / TILE_W) * TAU * 9);
    wrapX(TILE_W, bx, rr, (xx) => bp.addPath(circle(xx, bushes(bx), rr)));
  }
  bp.addPath(rrect(-20, 284, TILE_W + 40, 40, 0));
  blob(ctx, bp, '#46AFA0', '#389A91', 4, 2, 6, C.farLine);
  // near field band (sits behind the houses)
  const field = wave(300, [[3, 6, 1.1]]);
  const fp = contourFill(field, H + 10);
  fill(ctx, fp, C.farField);
  inClip(ctx, fp, () => fill(ctx, contourFill((x) => field(x) + 30, H + 10), C.farFieldShade));
  stroke(ctx, contourLine(field), C.farLine, 4);
  return c;
}

// ------------------------------------------------------------------ mid layer props
interface HouseSpec { x: number; w: number; wallH: number; roofH: number; roof: 'blue' | 'red'; wall: 'cream' | 'mint'; door: number; windows: number[]; chimney: number }

function house(ctx: Ctx, s: HouseSpec, ground: number): void {
  const roofC = s.roof === 'blue' ? C.roofBlue : C.roofRed;
  const roofS = s.roof === 'blue' ? C.roofBlueShade : C.roofRedShade;
  const roofH = s.roof === 'blue' ? C.roofBlueHi : C.roofRedHi;
  const wallC = s.wall === 'cream' ? C.wallCream : C.wallMint;
  const wallS = s.wall === 'cream' ? C.wallCreamShade : C.wallMintShade;
  const x0 = s.x, x1 = s.x + s.w;
  const wallTop = ground - s.wallH;
  // chimney (behind the roof)
  const chx = x0 + s.w * s.chimney;
  const chTop = wallTop - s.roofH - 26;
  cel(ctx, rrect(chx - 16, chTop + 8, 32, s.roofH * 0.55, 3), '#C08E73', { lw: LW, shade: '#9C6F59', dx: 7, dy: 0 });
  cel(ctx, rrect(chx - 21, chTop, 42, 14, 4), '#9B968C', { lw: LW, shade: '#827D73', dx: 0, dy: 5 });
  // walls
  const wall = rrect(x0, wallTop, s.w, s.wallH, 6);
  celMulti(ctx, wall, LW, 0, 0, () => {
    fill(ctx, wall, wallC);
    fill(ctx, rrect(x0 - 4, wallTop - 4, s.w + 8, 22, 0), wallS);
    fill(ctx, rrect(x1 - 14, wallTop, 20, s.wallH, 0), wallS);
  });
  // stone base
  const baseH = 22;
  const stones = new Path2D();
  let sx = x0 + 2;
  let k = 0;
  while (sx < x1 - 4) {
    const sw = Math.min(x1 - 2 - sx, k % 3 === 1 ? 30 : 44);
    stones.addPath(rrect(sx, ground - baseH, sw - 3, baseH - 2, 5));
    sx += sw;
    k++;
  }
  outline(ctx, stones, 3.5);
  fill(ctx, stones, C.stone);
  inClip(ctx, stones, () => fill(ctx, moved(stones, 0, 12), C.stoneShade));
  // windows
  for (const wx of s.windows) {
    const cx = x0 + s.w * wx;
    const wy = wallTop + 34;
    const ww = 46, wh = 50;
    cel(ctx, rrect(cx - ww / 2 - 6, wy - 6, ww + 12, wh + 12, 7), C.wood, { lw: LW, shade: C.woodShade, dx: 3, dy: 3 });
    const glass = rrect(cx - ww / 2, wy, ww, wh, 3);
    fill(ctx, glass, C.glass);
    inClip(ctx, glass, () => {
      ctx.save();
      ctx.translate(cx - 6, wy + 16);
      ctx.rotate(-0.7);
      ctx.fillStyle = rgba(C.glassHi, 0.85);
      ctx.fillRect(-40, -5, 80, 8);
      ctx.fillRect(-40, 8, 80, 3);
      ctx.restore();
    });
    // cross frame
    fill(ctx, rrect(cx - 3.5, wy, 7, wh, 0), C.wood);
    fill(ctx, rrect(cx - ww / 2, wy + wh / 2 - 3.5, ww, 7, 0), C.wood);
    stroke(ctx, glass, OUTLINE, 3.5);
    // flower box
    cel(ctx, rrect(cx - ww / 2 - 9, wy + wh + 4, ww + 18, 12, 3), C.woodShade, { lw: 4, shade: C.woodDark, dx: 0, dy: 4 });
    for (let i = 0; i < 5; i++) {
      const fx = cx - ww / 2 - 2 + i * ((ww + 4) / 4);
      cel(ctx, circle(fx, wy + wh + 2, 6.5), i % 2 ? C.flowerPink : C.leaf, { lw: 3, shade: i % 2 ? '#E26A93' : C.leafShade, dx: 1, dy: 2 });
    }
  }
  // arched door in a stone frame
  const dx = x0 + s.w * s.door;
  const dw = 52, dh = Math.min(84, s.wallH - 34);
  const arch = (w: number, h: number, ox: number) => {
    const p = new Path2D();
    p.moveTo(ox - w / 2, ground - 2);
    p.lineTo(ox - w / 2, ground - h + w / 2);
    p.arc(ox, ground - h + w / 2, w / 2, Math.PI, 0);
    p.lineTo(ox + w / 2, ground - 2);
    p.closePath();
    return p;
  };
  cel(ctx, arch(dw + 18, dh + 9, dx), '#9B968C', { lw: LW, shade: '#827D73', dx: 4, dy: 0 });
  const door = arch(dw, dh, dx);
  celMulti(ctx, door, LW * 0.8, 4, 0, (dark) => {
    fill(ctx, door, dark ? C.woodShade : C.wood);
    for (const px of [-13, 0, 13]) fill(ctx, rrect(dx + px - 1.5, ground - dh - 5, 3, dh + 5, 0), dark ? C.woodDark : C.woodShade);
  });
  for (const by of [ground - dh * 0.66, ground - dh * 0.28]) {
    inClip(ctx, door, () => {
      fill(ctx, rrect(dx - dw / 2, by - 4, dw, 8, 0), C.iron);
      for (const rx of [-17, 0, 17]) fill(ctx, circle(dx + rx, by, 2.4), '#9AA3B2');
    });
  }
  cel(ctx, circle(dx + 15, ground - dh * 0.45, 3.6), C.gold, { lw: 2.5 });
  // roof (drawn last so its eave overlaps the wall)
  const ov = 18;
  const roof = roundPoly([x0 - ov, wallTop + 8, x1 + ov, wallTop + 8, x1 - s.w * 0.12, wallTop - s.roofH, x0 + s.w * 0.12, wallTop - s.roofH], [6, 6, 10, 10]);
  celMulti(ctx, roof, LW, 0, 0, () => {
    fill(ctx, roof, roofC);
    // shingle rows: scalloped lower edges
    const rows = 4;
    for (let i = 1; i <= rows; i++) {
      const y = wallTop - s.roofH + (i * (s.roofH + 8)) / (rows + 0.6);
      const p = new Path2D();
      const step = 26;
      const off = i % 2 ? 0 : step / 2;
      for (let xx = x0 - ov - step + off; xx < x1 + ov + step; xx += step) {
        p.moveTo(xx, y);
        p.arc(xx + step / 2, y, step / 2, Math.PI, 0, true);
      }
      stroke(ctx, p, roofS, 4.5);
    }
    // light tiles + right-side shadow
    fill(ctx, rrect(x0 + s.w * 0.2, wallTop - s.roofH + 12, 30, 12, 6), roofH);
    fill(ctx, rrect(x0 + s.w * 0.55, wallTop - s.roofH * 0.45, 26, 11, 5.5), roofH);
    fill(ctx, poly([x1 - s.w * 0.12, wallTop - s.roofH, x1 + ov, wallTop + 8, x1 + ov + 40, wallTop + 8, x1 + 40, wallTop - s.roofH]), roofS);
  });
  // eave shadow line
  stroke(ctx, poly([x0 - ov + 6, wallTop + 8, x1 + ov - 6, wallTop + 8], false), OUTLINE, LW * 1.4);
}

function tree(ctx: Ctx, x: number, ground: number, size: number, variant: number): void {
  const th = size * 0.95;
  const tw = size * 0.24;
  const trunk = tube([x, ground, x + 2, ground - th * 0.5, x - 4, ground - th], [tw * 1.35, tw, tw * 0.85]);
  cel(ctx, trunk, C.trunk, { lw: LW, shade: C.trunkShade, dx: tw * 0.35, dy: 0 });
  cel(ctx, tube([x + 1, ground - th * 0.55, x + size * 0.32, ground - th * 0.82], [tw * 0.55, tw * 0.4]), C.trunk, { lw: LW, shade: C.trunkShade, dx: 3, dy: 2 });
  const cy = ground - th - size * 0.42;
  const list: Array<[number, number, number]> = variant % 2
    ? [[x, cy, size * 0.62], [x - size * 0.58, cy + size * 0.25, size * 0.42], [x + size * 0.6, cy + size * 0.22, size * 0.46], [x - size * 0.26, cy - size * 0.42, size * 0.42], [x + size * 0.3, cy - size * 0.36, size * 0.4]]
    : [[x, cy - size * 0.05, size * 0.6], [x - size * 0.52, cy + size * 0.2, size * 0.45], [x + size * 0.5, cy + size * 0.24, size * 0.44], [x + size * 0.05, cy - size * 0.5, size * 0.4]];
  const p = puffs(list);
  blob(ctx, p, C.leaf, C.leafShade, LW, size * 0.08, size * 0.16);
  inClip(ctx, p, () => {
    for (const [bx, by, br] of list.slice(3)) stroke(ctx, smooth([bx - br * 0.75, by + br * 0.5, bx, by + br * 0.86, bx + br * 0.75, by + br * 0.5], false), C.leafShade, 6);
    softSpot(ctx, x - size * 0.28, cy - size * 0.38, size * 0.24, size * 0.12, C.leafHi, 0.95, -0.4, 0.75);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + variant;
      const lx = x + Math.cos(a) * size * 0.45, ly = cy + Math.sin(a) * size * 0.32;
      ink(ctx, [lx, ly, lx + 3, ly - 6], 3, rgba(C.leafLine, 0.35), false);
    }
  });
}

function bush(ctx: Ctx, x: number, ground: number, w: number): void {
  const h = w * 0.5;
  const p = puffs([[x - w * 0.3, ground - h * 0.5, h * 0.6], [x + w * 0.05, ground - h * 0.75, h * 0.72], [x + w * 0.34, ground - h * 0.48, h * 0.58]]);
  const q = union(p, rrect(x - w * 0.55, ground - h * 0.6, w * 1.1, h * 0.6, h * 0.3));
  blob(ctx, q, C.bush, C.bushShade, LW, 4, 8);
  inClip(ctx, q, () => softSpot(ctx, x - w * 0.12, ground - h * 1.05, w * 0.14, h * 0.12, C.leafHi, 0.8, -0.3, 0.7));
}

function picketFence(ctx: Ctx, x0: number, x1: number, ground: number): void {
  const h = 54;
  for (const ry of [ground - h * 0.72, ground - h * 0.32]) cel(ctx, rrect(x0 - 4, ry, x1 - x0 + 8, 9, 3), C.picket, { lw: 4, shade: C.picketShade, dx: 0, dy: 4 });
  for (let x = x0; x <= x1 - 14; x += 22) {
    const p = roundPoly([x, ground - 2, x + 15, ground - 2, x + 15, ground - h + 8, x + 7.5, ground - h, x, ground - h + 8], [2, 2, 2, 2, 2]);
    cel(ctx, p, C.picket, { lw: 4, shade: C.picketShade, dx: 5, dy: 0 });
  }
}

function mailbox(ctx: Ctx, x: number, ground: number, color: string): void {
  cel(ctx, rrect(x - 5, ground - 62, 10, 62, 2), C.wood, { lw: 4, shade: C.woodShade, dx: 4, dy: 0 });
  // flag (behind the box, raised)
  cel(ctx, rrect(x + 17, ground - 104, 5, 36, 2), C.iron, { lw: 3 });
  cel(ctx, rrect(x + 19, ground - 106, 17, 12, 2), C.mailRed, { lw: 3, shade: shadeOf(C.mailRed, 0.2), dx: 0, dy: 3 });
  // tunnel-shaped box seen from the side, door end facing left
  const bx0 = x - 24, bx1 = x + 30, top = ground - 90, bot = ground - 58, r = 15;
  const box = new Path2D();
  box.moveTo(bx0, bot);
  box.lineTo(bx0, top + r);
  box.arcTo(bx0, top, bx0 + r, top, r);
  box.lineTo(bx1 - r, top);
  box.arcTo(bx1, top, bx1, top + r, r);
  box.lineTo(bx1, bot);
  box.closePath();
  cel(ctx, box, color, { lw: 4, shade: shadeOf(color, 0.22), dx: 0, dy: 8, hi: { x: x + 4, y: top + 6, rx: 14, ry: 3, a: 0.5 } });
  // the rounded door at the front end
  const door = new Path2D();
  door.moveTo(bx0 - 6, bot + 1);
  door.lineTo(bx0 - 6, top + 14);
  door.arc(bx0 + 6, top + 14, 12, Math.PI, 0);
  door.lineTo(bx0 + 18, bot + 1);
  door.closePath();
  cel(ctx, door, mix(color, '#FFFFFF', 0.18), { lw: 4, shade: color, dx: 4, dy: 0 });
  cel(ctx, rrect(bx0 - 9, top + 12, 6, 7, 2), C.metal, { lw: 2.5 });
}

function garbageCan(ctx: Ctx, x: number, ground: number, s: number): void {
  const w = 44 * s, h = 58 * s;
  const body = roundPoly([x - w / 2, ground - h, x + w / 2, ground - h, x + w * 0.44, ground, x - w * 0.44, ground], [3, 3, 5, 5]);
  celMulti(ctx, body, LW * 0.9, 0, 0, () => {
    fill(ctx, body, C.metal);
    fill(ctx, rrect(x + w * 0.18, ground - h, w, h, 0), C.metalShade);
    for (const fx of [-0.25, 0, 0.25]) fill(ctx, rrect(x + fx * w - 2, ground - h, 4, h, 0), C.metalShade);
    fill(ctx, rrect(x - w, ground - h * 0.62, 2 * w, 4, 0), C.metalShade);
    fill(ctx, rrect(x - w, ground - h * 0.3, 2 * w, 4, 0), C.metalShade);
    softSpot(ctx, x - w * 0.3, ground - h * 0.6, w * 0.08, h * 0.3, '#FFFFFF', 0.6);
  });
  const lid = new Path2D();
  lid.ellipse(x, ground - h, w * 0.6, h * 0.12, 0, Math.PI, 0);
  lid.closePath();
  const lp = union(lid, rrect(x - w * 0.6, ground - h - 2, w * 1.2, 8 * s, 3));
  blob(ctx, lp, C.metal, C.metalShade, LW * 0.9, 0, 4);
  cel(ctx, rrect(x - 7 * s, ground - h - h * 0.12 - 6, 14 * s, 7, 3), C.iron, { lw: 3.5 });
}

function miniDumpster(ctx: Ctx, x: number, ground: number): void {
  const w = 150, h = 82;
  for (const wx of [x - w * 0.36, x + w * 0.36]) cel(ctx, circle(wx, ground - 5, 7), '#4A4552', { lw: 4 });
  const body = roundPoly([x - w / 2, ground - h, x + w / 2, ground - h, x + w * 0.46, ground - 8, x - w * 0.46, ground - 8], [4, 4, 6, 6]);
  celMulti(ctx, body, LW, 8, 0, (dark) => {
    fill(ctx, body, dark ? C.dumpsterShade : C.dumpster);
    for (const rx of [-0.25, 0, 0.25]) fill(ctx, rrect(x + rx * w - 5, ground - h + 14, 10, h - 26, 4), dark ? shadeOf(C.dumpsterShade, 0.12) : C.dumpsterShade);
    fill(ctx, rrect(x - w, ground - h, 2 * w, 13, 0), dark ? C.dumpsterShade : C.dumpsterHi);
  });
  const lid = roundPoly([x - w / 2 - 6, ground - h + 2, x + w / 2 + 6, ground - h + 2, x + w / 2, ground - h - 12, x - w / 2 + 4, ground - h - 16], [3, 3, 4, 4]);
  cel(ctx, lid, C.dumpsterLid, { lw: LW, shade: C.dumpsterLidShade, dx: 0, dy: 4, hi: { x: x - 30, y: ground - h - 10, rx: 22, ry: 2.5, a: 0.4 } });
  // a raccoon-paw sticker
  const px = x + 32, py = ground - h * 0.48;
  fill(ctx, circle(px, py + 4, 7), rgba('#FFFFFF', 0.85));
  for (const [ox, oy] of [[-8, -6], [-3, -10], [3, -10], [8, -6]]) fill(ctx, circle(px + ox, py + oy, 2.8), rgba('#FFFFFF', 0.85));
}

function flowers(ctx: Ctx, x: number, ground: number, n: number, r: Rng): void {
  for (let i = 0; i < n; i++) {
    const fx = x + i * 13 + r() * 5;
    const fy = ground - 6 - r() * 10;
    stroke(ctx, poly([fx, ground, fx, fy], false), C.leafShade, 3);
    const col = [C.flowerPink, C.flowerYellow, C.flowerWhite][i % 3];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      fill(ctx, circle(fx + Math.cos(a) * 3.6, fy + Math.sin(a) * 3.6, 3.2), col);
    }
    fill(ctx, circle(fx, fy, 2.4), '#FFA726');
  }
}

export function midLayer(): HTMLCanvasElement {
  const H = 380;
  const ground = 342;
  const { c, ctx } = makeCanvas(TILE_W, H);
  const r = rng(31);
  // grass field the houses stand on (continues into the ground layer's top strip)
  fill(ctx, rrect(-10, ground - 14, TILE_W + 20, H - ground + 30, 0), C.grass);
  stroke(ctx, poly([-10, ground - 14, TILE_W + 10, ground - 14], false), C.grassShade, 4);
  const shadow = (x: number, w: number) => wrapX(TILE_W, x, w, (xx) => fill(ctx, ellipse(xx, ground + 1, w, 7), C.grassShade));

  const houses: HouseSpec[] = [
    { x: 150, w: 290, wallH: 150, roofH: 96, roof: 'blue', wall: 'cream', door: 0.7, windows: [0.27], chimney: 0.72 },
    { x: 1090, w: 260, wallH: 138, roofH: 90, roof: 'red', wall: 'mint', door: 0.3, windows: [0.7], chimney: 0.3 },
    { x: 1700, w: 240, wallH: 132, roofH: 88, roof: 'blue', wall: 'cream', door: 0.68, windows: [0.26], chimney: 0.25 },
  ];
  // trees behind the houses
  tree(ctx, 470, ground - 6, 120, 1);
  tree(ctx, 1385, ground - 4, 110, 0);
  for (const h of houses) {
    shadow(h.x + h.w / 2, h.w * 0.55);
    wrapX(TILE_W, h.x + h.w / 2, h.w / 2 + 30, (cx) => house(ctx, { ...h, x: cx - h.w / 2 }, ground));
  }
  // props along the street
  shadow(750, 70);
  tree(ctx, 750, ground, 124, 0);
  picketFence(ctx, 450, 630, ground);
  mailbox(ctx, 662, ground, C.mailBlue);
  shadow(870, 80);
  miniDumpster(ctx, 870, ground);
  shadow(990, 40);
  garbageCan(ctx, 978, ground, 1);
  garbageCan(ctx, 1026, ground, 0.92);
  bush(ctx, 1060, ground, 70);
  flowers(ctx, 1096, ground, 4, r);
  picketFence(ctx, 1374, 1550, ground);
  mailbox(ctx, 1588, ground, C.mailRed);
  shadow(1650, 60);
  bush(ctx, 1652, ground, 90);
  shadow(1975, 40);
  garbageCan(ctx, 1975, ground, 1);
  // a tree straddling the seam to prove the wrap
  shadow(2030, 70);
  wrapX(TILE_W, 2030, 150, (xx) => tree(ctx, xx, ground, 118, 1));
  wrapX(TILE_W, 70, 60, (xx) => bush(ctx, xx, ground, 80));
  flowers(ctx, 455, ground + 2, 3, r);
  flowers(ctx, 1555, ground + 2, 3, r);
  return c;
}

// ------------------------------------------------------------------ ground
function tuft(ctx: Ctx, x: number, y: number, s: number, color: string): void {
  const p = smooth([x - 9 * s, y, x - 7 * s, y - 9 * s, x - 3 * s, y - 2 * s, x, y - 12 * s, x + 3 * s, y - 2 * s, x + 7 * s, y - 9 * s, x + 9 * s, y], false, 0.5);
  stroke(ctx, p, color, 3.2 * s);
}

export function groundLayer(): HTMLCanvasElement {
  const H = 240;
  const grassH = 24;
  const wallTop = 180;
  const { c, ctx } = makeCanvas(TILE_W, H);
  const r = rng(91);
  // road
  fill(ctx, rrect(0, grassH, TILE_W, wallTop - grassH, 0), C.road);
  fill(ctx, rrect(0, grassH, TILE_W, 12, 0), C.roadShade);
  const streaks = new Path2D();
  for (let i = 0; i < 46; i++) {
    const x = r() * TILE_W, y = grassH + 24 + r() * (wallTop - grassH - 40), w = 30 + r() * 70;
    wrapX(TILE_W, x, w, (xx) => streaks.addPath(ellipse(xx, y, w, 2.6 + r() * 1.8)));
  }
  fill(ctx, streaks, rgba(C.roadSpeck, 0.45));
  const lights = new Path2D();
  for (let i = 0; i < 26; i++) {
    const x = r() * TILE_W, y = grassH + 30 + r() * (wallTop - grassH - 50), w = 20 + r() * 40;
    wrapX(TILE_W, x, w, (xx) => lights.addPath(ellipse(xx, y, w, 2.2)));
  }
  fill(ctx, lights, rgba(C.roadLight, 0.7));
  for (let i = 0; i < 34; i++) {
    const x = r() * TILE_W, y = grassH + 26 + r() * (wallTop - grassH - 40), s = 0.6 + r() * 0.8;
    wrapX(TILE_W, x, 12, (xx) => {
      const p = ellipse(xx, y, 6.5 * s, 4.2 * s, (r() - 0.5) * 0.4);
      cel(ctx, p, C.pebble, { lw: 2, line: '#AE9C6B', shade: C.pebbleShade, dx: 1, dy: 1.6 * s });
    });
  }
  // grass strip on top (continues the mid layer's field)
  fill(ctx, rrect(0, 0, TILE_W, grassH, 0), C.grass);
  fill(ctx, rrect(0, grassH - 7, TILE_W, 7, 0), C.grassShade);
  for (let i = 0; i < 40; i++) {
    const x = r() * TILE_W;
    const s = 0.7 + r() * 0.5;
    wrapX(TILE_W, x, 14, (xx) => tuft(ctx, xx, grassH - 6, s, C.grassDark));
  }
  stroke(ctx, poly([-10, grassH, TILE_W + 10, grassH], false), OUTLINE, 4);
  // low stone wall with a teal-green cap
  const wallP = rrect(-10, wallTop + 10, TILE_W + 20, H - wallTop, 0);
  fill(ctx, wallP, C.stoneShade);
  const rows: Array<[number, number]> = [[wallTop + 14, 24], [wallTop + 40, 24]];
  rows.forEach(([y, h], ri) => {
    const widths: number[] = [];
    let total = 0;
    while (total < TILE_W) {
      const w = 56 + r() * 52;
      widths.push(w);
      total += w;
    }
    const k = TILE_W / total;
    let x = ri ? 20 : 0;
    for (const w0 of widths) {
      const w = w0 * k;
      wrapX(TILE_W, x + w / 2, w / 2 + 4, (xx) => {
        const p = rrect(xx - w / 2 + 2, y, w - 4, h - 3, 6);
        cel(ctx, p, C.stone, { lw: 3.5, shade: C.stoneShade, dx: 3, dy: 5, hi: { x: xx - w * 0.2, y: y + 6, rx: w * 0.18, ry: 2.5, a: 0.5 } });
      });
      x += w;
    }
  });
  const cap = rrect(-10, wallTop, TILE_W + 20, 14, 0);
  fill(ctx, cap, C.wallCap);
  fill(ctx, rrect(-10, wallTop + 8, TILE_W + 20, 6, 0), C.wallCapShade);
  fill(ctx, rrect(-10, wallTop + 2, TILE_W + 20, 3, 0), C.wallCapHi);
  stroke(ctx, poly([-10, wallTop, TILE_W + 10, wallTop], false), OUTLINE, 4);
  stroke(ctx, poly([-10, wallTop + 14, TILE_W + 10, wallTop + 14], false), OUTLINE, 3.5);
  return c;
}

// ------------------------------------------------------------------ foreground
function blades(ctx: Ctx, x: number, base: number, s: number, r: Rng): void {
  const n = 4 + Math.floor(r() * 3);
  const list: Path2D[] = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 1.6 + (r() - 0.5) * 0.2;
    const len = (34 + r() * 26) * s * (1 - Math.abs(i / (n - 1) - 0.5) * 0.6);
    const tipx = x + Math.cos(a) * len, tipy = base + Math.sin(a) * len;
    const bend = (i / (n - 1) - 0.5) * 14 * s;
    list.push(tube([x + (i - n / 2) * 2.5 * s, base, x + Math.cos(a) * len * 0.55 + bend * 0.3, base + Math.sin(a) * len * 0.55, tipx + bend, tipy], [9 * s, 7 * s, 1.5]));
  }
  for (const p of list) outline(ctx, p, 4);
  for (const p of list) {
    fill(ctx, p, '#5CBF68');
    inClip(ctx, p, () => fill(ctx, moved(p, 4 * s, 0), '#47A456'));
  }
}

function flower(ctx: Ctx, x: number, base: number, h: number, col: string): void {
  stroke(ctx, poly([x, base, x + 2, base - h], false), OUTLINE, 7);
  stroke(ctx, poly([x, base, x + 2, base - h], false), '#4FA65A', 3);
  const petals = new Path2D();
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU - Math.PI / 2;
    petals.addPath(circle(x + 2 + Math.cos(a) * 6, base - h + Math.sin(a) * 6, 5.4));
  }
  blob(ctx, petals, col, shadeOf(col, 0.12), 3, 1, 2);
  cel(ctx, circle(x + 2, base - h, 3.6), '#FFB300', { lw: 2.5 });
}

export function fgLayer(): HTMLCanvasElement {
  const H = 120;
  const { c, ctx } = makeCanvas(TILE_W, H);
  const r = rng(13);
  const spots: number[] = [];
  let x = 40;
  while (x < TILE_W - 30) {
    spots.push(x);
    x += 150 + r() * 210;
  }
  for (const sx of spots) {
    const s = 0.9 + r() * 0.5;
    const kind = r();
    wrapX(TILE_W, sx, 70, (xx) => {
      const rr = rng(Math.round(sx));
      blades(ctx, xx, H + 4, s, rr);
      if (kind > 0.45) flower(ctx, xx + 18 * s, H + 2, 40 * s, [C.flowerWhite, C.flowerYellow, C.flowerPink][Math.floor(kind * 10) % 3]);
      if (kind > 0.75) blades(ctx, xx + 34 * s, H + 6, s * 0.7, rr);
    });
  }
  return c;
}
