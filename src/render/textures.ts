/**
 * Code-drawn placeholder art, generated once into textures. Follows docs/ART_DIRECTION.md:
 * night-purple outlines (never black), light from the top left, chunky shapes, items at ~1.3x scale.
 * Real art replaces these through assets.json without touching the scene.
 */
import Phaser from 'phaser';
import { DATA, type EnemyShape } from '../data';
import { hexToNum } from './art';

type G = Phaser.GameObjects.Graphics;
type Pt = { x: number; y: number };

const PAL = DATA.assets.placeholders.palette;
export const OUTLINE = hexToNum(PAL.outline);
const C = (k: string) => hexToNum(PAL[k] ?? '#ff00ff');

/** Raccoon texture box; the raccoon's feet sit at (RACCOON_FEET.x, RACCOON_FEET.y). */
export const RACCOON_TEX = { w: 320, h: 340 };
export const RACCOON_FEET = { x: 170, y: 326 };

// ------------------------------------------------------------------ drawing helpers
function ol(g: G, w = 6, a = 1) {
  g.lineStyle(w, OUTLINE, a);
}
function ellipse(g: G, x: number, y: number, w: number, h: number, fill: number, line = 6) {
  g.fillStyle(fill, 1);
  g.fillEllipse(x, y, w, h);
  if (line > 0) {
    ol(g, line);
    g.strokeEllipse(x, y, w, h);
  }
}
function circle(g: G, x: number, y: number, r: number, fill: number, line = 6) {
  g.fillStyle(fill, 1);
  g.fillCircle(x, y, r);
  if (line > 0) {
    ol(g, line);
    g.strokeCircle(x, y, r);
  }
}
function poly(g: G, pts: Pt[], fill: number, line = 6, alpha = 1) {
  g.fillStyle(fill, alpha);
  g.fillPoints(pts, true, true);
  if (line > 0) {
    ol(g, line);
    g.strokePoints(pts, true, true);
  }
}
function rrect(g: G, x: number, y: number, w: number, h: number, r: number, fill: number, line = 6) {
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, r);
  if (line > 0) {
    ol(g, line);
    g.strokeRoundedRect(x, y, w, h, r);
  }
}
function bezier(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
}
function curve(g: G, p0: Pt, p1: Pt, p2: Pt, width: number, color: number, alpha = 1) {
  const pts: Pt[] = [];
  for (let i = 0; i <= 16; i++) pts.push(bezier(p0, p1, p2, i / 16));
  g.lineStyle(width, color, alpha);
  g.strokePoints(pts, false, false);
}
/** Highlight from the top left: a soft light ellipse inside a shape. */
function shine(g: G, x: number, y: number, w: number, h: number, a = 0.25) {
  g.fillStyle(0xffffff, a);
  g.fillEllipse(x, y, w, h);
}

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

// ------------------------------------------------------------------ raccoon
/**
 * 2.5 heads tall: head ~40% of height, oversized hands, short legs, huge ringed tail.
 * Drawn facing right with the feet at RACCOON_FEET.
 */
function drawRaccoon(g: G, ox: number, oy: number) {
  const p = DATA.assets.placeholders.raccoon;
  const fur = hexToNum(p.body);
  const mask = hexToNum(p.mask);
  const belly = hexToNum(p.belly);
  const brow = hexToNum(p.brow);
  const P = (x: number, y: number): Pt => ({ x: ox + x, y: oy + y });

  // Tail: ringed segments along a curve, base on top, pointed tip.
  const a = P(-40, -62), b = P(-150, -60), c = P(-128, -180);
  const segs = 9;
  const tip = bezier(a, b, c, 1.04);
  poly(g, [bezier(a, b, c, 0.93), P(tip.x - ox - 8, tip.y - oy - 26), { x: tip.x + 14, y: tip.y + 4 }], mask, 5);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = segs - 1; i >= 0; i--) {
      const t = i / segs;
      const q = bezier(a, b, c, t);
      const r = 30 - i * 2;
      if (pass === 0) {
        g.fillStyle(OUTLINE, 1);
        g.fillCircle(q.x, q.y, r + 5);
      } else {
        g.fillStyle(i % 2 === 0 ? fur : mask, 1);
        g.fillCircle(q.x, q.y, r);
      }
    }
  }
  // Back hand and feet.
  circle(g, P(-46, -72).x, P(-46, -72).y, 18, fur, 5);
  ellipse(g, P(-24, -10).x, P(-24, -10).y, 44, 24, mask, 5);
  ellipse(g, P(24, -10).x, P(24, -10).y, 44, 24, mask, 5);
  // Body and belly.
  ellipse(g, P(0, -72).x, P(0, -72).y, 118, 112, fur, 6);
  shine(g, P(-20, -96).x, P(-20, -96).y, 40, 26, 0.18);
  ellipse(g, P(8, -64).x, P(8, -64).y, 68, 74, belly, 4);
  // Ears (pointed, for mischief).
  poly(g, [P(-26, -196), P(-30, -258), P(10, -218)], fur, 6);
  poly(g, [P(-20, -206), P(-24, -244), P(0, -220)], mask, 0);
  poly(g, [P(24, -222), P(50, -268), P(62, -210)], fur, 6);
  poly(g, [P(32, -224), P(50, -256), P(56, -214)], mask, 0);
  // Head.
  circle(g, P(16, -168).x, P(16, -168).y, 54, fur, 6);
  shine(g, P(-6, -196).x, P(-6, -196).y, 34, 20, 0.2);
  // Mask band with pointed sides.
  poly(g, [P(-34, -170), P(-14, -194), P(30, -198), P(74, -192), P(84, -170), P(60, -158), P(28, -164), P(-6, -156)], mask, 0);
  // Big eyes, small pupils looking right.
  ellipse(g, P(10, -177).x, P(10, -177).y, 32, 36, 0xffffff, 3);
  ellipse(g, P(46, -177).x, P(46, -177).y, 32, 36, 0xffffff, 3);
  circle(g, P(16, -175).x, P(16, -175).y, 6.5, OUTLINE, 0);
  circle(g, P(52, -175).x, P(52, -175).y, 6.5, OUTLINE, 0);
  circle(g, P(14, -179).x, P(14, -179).y, 2.5, 0xffffff, 0);
  circle(g, P(50, -179).x, P(50, -179).y, 2.5, 0xffffff, 0);
  // Eyebrows sit on the mask and do the acting.
  g.lineStyle(7, brow, 1);
  g.lineBetween(P(-6, -203).x, P(-6, -203).y, P(20, -206).x, P(20, -206).y);
  g.lineBetween(P(36, -206).x, P(36, -206).y, P(62, -201).x, P(62, -201).y);
  // Muzzle, nose, buck-toothed grin.
  ellipse(g, P(56, -146).x, P(56, -146).y, 56, 34, belly, 4);
  ellipse(g, P(78, -156).x, P(78, -156).y, 20, 15, OUTLINE, 0);
  g.lineStyle(4, OUTLINE, 1);
  g.beginPath();
  g.arc(P(56, -146).x, P(56, -146).y, 14, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(150), false);
  g.strokePath();
  rrect(g, P(47, -136).x, P(47, -136).y, 9, 11, 2, 0xffffff, 3);
  rrect(g, P(56, -136).x, P(56, -136).y, 9, 11, 2, 0xffffff, 3);
  // Oversized front hand.
  circle(g, P(54, -74).x, P(54, -74).y, 22, fur, 6);
  // Rim light: cyan facing the neon (right), amber facing the windows (left).
  g.lineStyle(5, C('neonCyan'), 0.85);
  g.beginPath();
  g.arc(P(16, -168).x, P(16, -168).y, 49, Phaser.Math.DegToRad(-70), Phaser.Math.DegToRad(20), false);
  g.strokePath();
  g.beginPath();
  g.arc(P(0, -72).x, P(0, -72).y, 54, Phaser.Math.DegToRad(-40), Phaser.Math.DegToRad(30), false);
  g.strokePath();
  g.lineStyle(5, C('window'), 0.6);
  g.beginPath();
  g.arc(P(16, -168).x, P(16, -168).y, 49, Phaser.Math.DegToRad(160), Phaser.Math.DegToRad(215), false);
  g.strokePath();
}

// ------------------------------------------------------------------ enemies (facing left, feet at origin)
function drawRat(g: G, ox: number, oy: number, S: number, color: number, accent: number) {
  const P = (x: number, y: number): Pt => ({ x: ox + x * S, y: oy + y * S });
  curve(g, P(0.3, -0.22), P(0.75, -0.2), P(0.7, -0.72), 0.07 * S + 6, OUTLINE);
  curve(g, P(0.3, -0.22), P(0.75, -0.2), P(0.7, -0.72), 0.07 * S, accent);
  ellipse(g, P(0.12, -0.3).x, P(0.12, -0.3).y, 0.72 * S, 0.5 * S, color, 6);
  shine(g, P(0.0, -0.45).x, P(0.0, -0.45).y, 0.25 * S, 0.1 * S, 0.18);
  // Triangular, threatening snout.
  poly(g, [P(-0.08, -0.6), P(-0.62, -0.34), P(-0.06, -0.14)], color, 6);
  circle(g, P(-0.62, -0.34).x, P(-0.62, -0.34).y, 0.045 * S, accent, 3);
  circle(g, P(-0.1, -0.66).x, P(-0.1, -0.66).y, 0.12 * S, color, 5);
  circle(g, P(-0.1, -0.66).x, P(-0.1, -0.66).y, 0.06 * S, accent, 0);
  // Beady red eye.
  circle(g, P(-0.3, -0.42).x, P(-0.3, -0.42).y, 0.05 * S, 0xff2d2d, 3);
  circle(g, P(-0.31, -0.43).x, P(-0.31, -0.43).y, 0.015 * S + 1, 0xffffff, 0);
  g.lineStyle(3, OUTLINE, 0.8);
  g.lineBetween(P(-0.55, -0.32).x, P(-0.55, -0.32).y, P(-0.72, -0.38).x, P(-0.72, -0.38).y);
  g.lineBetween(P(-0.55, -0.3).x, P(-0.55, -0.3).y, P(-0.72, -0.26).x, P(-0.72, -0.26).y);
  ellipse(g, P(-0.08, -0.04).x, P(-0.08, -0.04).y, 0.18 * S, 0.08 * S, accent, 4);
  ellipse(g, P(0.26, -0.04).x, P(0.26, -0.04).y, 0.18 * S, 0.08 * S, accent, 4);
}

function drawPigeon(g: G, ox: number, oy: number, S: number, color: number, accent: number) {
  const P = (x: number, y: number): Pt => ({ x: ox + x * S, y: oy + y * S });
  poly(g, [P(0.3, -0.4), P(0.62, -0.28), P(0.34, -0.2)], hexToNum('#6F7A8F'), 5);
  g.lineStyle(6, 0xe57399, 1);
  g.lineBetween(P(-0.06, -0.12).x, P(-0.06, -0.12).y, P(-0.08, 0).x, P(-0.08, 0).y);
  g.lineBetween(P(0.12, -0.12).x, P(0.12, -0.12).y, P(0.12, 0).x, P(0.12, 0).y);
  // Huge puffed chest, tiny head.
  ellipse(g, P(0.05, -0.42).x, P(0.05, -0.42).y, 0.82 * S, 0.66 * S, color, 6);
  shine(g, P(-0.1, -0.6).x, P(-0.1, -0.6).y, 0.3 * S, 0.12 * S, 0.2);
  ellipse(g, P(0.18, -0.44).x, P(0.18, -0.44).y, 0.4 * S, 0.3 * S, hexToNum('#76829A'), 4);
  g.lineStyle(0.07 * S, accent, 0.9);
  g.beginPath();
  g.arc(P(-0.18, -0.74).x, P(-0.18, -0.74).y, 0.13 * S, Phaser.Math.DegToRad(30), Phaser.Math.DegToRad(170), false);
  g.strokePath();
  circle(g, P(-0.2, -0.86).x, P(-0.2, -0.86).y, 0.13 * S, color, 5);
  poly(g, [P(-0.3, -0.88), P(-0.42, -0.84), P(-0.3, -0.8)], hexToNum('#F5A623'), 3);
  // The blank stare that never changes.
  circle(g, P(-0.24, -0.9).x, P(-0.24, -0.9).y, 0.045 * S, 0xffffff, 2);
  circle(g, P(-0.24, -0.9).x, P(-0.24, -0.9).y, 0.012 * S + 1, OUTLINE, 0);
}

function drawRaccoonFoe(g: G, ox: number, oy: number, S: number, color: number, accent: number, boss: boolean) {
  const P = (x: number, y: number): Pt => ({ x: ox + x * S, y: oy + y * S });
  const mask = hexToNum('#2A2A33');
  const belly = hexToNum('#D8D0C2');
  // Tail behind, to the right.
  for (let i = 6; i >= 0; i--) {
    const q = bezier(P(0.18, -0.25), P(0.6, -0.25), P(0.52, -0.7), i / 7);
    g.fillStyle(OUTLINE, 1);
    g.fillCircle(q.x, q.y, 0.1 * S - i * 2 + 5);
    g.fillStyle(i % 2 === 0 ? color : mask, 1);
    g.fillCircle(q.x, q.y, 0.1 * S - i * 2);
  }
  ellipse(g, P(-0.1, -0.04).x, P(-0.1, -0.04).y, 0.18 * S, 0.09 * S, mask, 4);
  ellipse(g, P(0.1, -0.04).x, P(0.1, -0.04).y, 0.18 * S, 0.09 * S, mask, 4);
  ellipse(g, P(0, -0.3).x, P(0, -0.3).y, 0.5 * S, 0.46 * S, color, 6);
  ellipse(g, P(-0.04, -0.27).x, P(-0.04, -0.27).y, 0.28 * S, 0.3 * S, belly, 4);
  poly(g, [P(0.04, -0.78), P(0.12, -1.0), P(-0.08, -0.84)], color, 5);
  poly(g, [P(-0.2, -0.82), P(-0.24, -1.0), P(-0.36, -0.78)], color, 5);
  circle(g, P(-0.08, -0.68).x, P(-0.08, -0.68).y, 0.22 * S, color, 6);
  poly(g, [P(0.12, -0.7), P(0.02, -0.8), P(-0.2, -0.8), P(-0.36, -0.72), P(-0.32, -0.62), P(-0.08, -0.66), P(0.08, -0.62)], mask, 0);
  ellipse(g, P(-0.04, -0.71).x, P(-0.04, -0.71).y, 0.11 * S, 0.11 * S, 0xffffff, 3);
  ellipse(g, P(-0.2, -0.71).x, P(-0.2, -0.71).y, 0.11 * S, 0.11 * S, 0xffffff, 3);
  circle(g, P(-0.07, -0.7).x, P(-0.07, -0.7).y, 0.025 * S, OUTLINE, 0);
  circle(g, P(-0.23, -0.7).x, P(-0.23, -0.7).y, 0.025 * S, OUTLINE, 0);
  // Angry brows.
  g.lineStyle(0.03 * S + 2, hexToNum('#C9C9D6'), 1);
  g.lineBetween(P(0.02, -0.82).x, P(0.02, -0.82).y, P(-0.1, -0.78).x, P(-0.1, -0.78).y);
  g.lineBetween(P(-0.14, -0.78).x, P(-0.14, -0.78).y, P(-0.28, -0.82).x, P(-0.28, -0.82).y);
  ellipse(g, P(-0.24, -0.58).x, P(-0.24, -0.58).y, 0.2 * S, 0.12 * S, belly, 3);
  circle(g, P(-0.33, -0.6).x, P(-0.33, -0.6).y, 0.03 * S, OUTLINE, 0);
  // Gang bandana with a knot.
  poly(g, [P(0.14, -0.78), P(-0.3, -0.86), P(-0.32, -0.8), P(0.14, -0.7)], accent, 4);
  poly(g, [P(0.12, -0.76), P(0.3, -0.86), P(0.26, -0.68)], accent, 4);
  circle(g, P(-0.3, -0.36).x, P(-0.3, -0.36).y, 0.09 * S, color, 5);
  if (boss) {
    // Vinnie "Two Lids": a trash-can lid in each hand.
    for (const [x, y] of [[-0.42, -0.42], [0.28, -0.38]] as const) {
      circle(g, P(x, y).x, P(x, y).y, 0.17 * S, hexToNum('#9AA3AE'), 6);
      g.lineStyle(4, hexToNum('#6B7480'), 1);
      g.strokeCircle(P(x, y).x, P(x, y).y, 0.11 * S);
      rrect(g, P(x, y).x - 0.05 * S, P(x, y).y - 0.02 * S, 0.1 * S, 0.04 * S, 6, hexToNum('#6B7480'), 3);
      shine(g, P(x - 0.05, y - 0.06).x, P(x - 0.05, y - 0.06).y, 0.12 * S, 0.06 * S, 0.35);
    }
  }
}

function drawRatKing(g: G, ox: number, oy: number, S: number, color: number, accent: number) {
  const P = (x: number, y: number): Pt => ({ x: ox + x * S, y: oy + y * S });
  // Pizza-box cape behind.
  poly(g, [P(-0.05, -0.62), P(0.48, -0.66), P(0.56, -0.06), P(0.0, -0.1)], accent, 6);
  g.fillStyle(hexToNum('#C0392B'), 0.9);
  for (const [x, y] of [[0.2, -0.45], [0.36, -0.3], [0.18, -0.22], [0.42, -0.52]] as const) g.fillCircle(P(x, y).x, P(x, y).y, 0.035 * S);
  drawRat(g, ox, oy, S * 0.95, color, hexToNum('#D9A1AE'));
  // Crown cut from a tin-can lid.
  const crown: Pt[] = [P(-0.24, -0.66), P(-0.22, -0.82), P(-0.17, -0.72), P(-0.12, -0.86), P(-0.07, -0.72), P(-0.02, -0.84), P(0.02, -0.66)];
  poly(g, crown, hexToNum('#C9CED6'), 5);
  shine(g, P(-0.15, -0.72).x, P(-0.15, -0.72).y, 0.08 * S, 0.03 * S, 0.5);
}

function drawOfficer(g: G, ox: number, oy: number, S: number, color: number, accent: number) {
  const P = (x: number, y: number): Pt => ({ x: ox + x * S, y: oy + y * S });
  const skin = hexToNum('#F1C6A6');
  // Catch pole with a loop at the end.
  g.lineStyle(0.03 * S + 6, OUTLINE, 1);
  g.lineBetween(P(-0.2, -0.42).x, P(-0.2, -0.42).y, P(-0.66, -0.98).x, P(-0.66, -0.98).y);
  g.lineStyle(0.03 * S, hexToNum('#B0B7C3'), 1);
  g.lineBetween(P(-0.2, -0.42).x, P(-0.2, -0.42).y, P(-0.66, -0.98).x, P(-0.66, -0.98).y);
  g.lineStyle(6, hexToNum('#E0E0E0'), 1);
  g.strokeCircle(P(-0.7, -1.02).x, P(-0.7, -1.02).y, 0.06 * S);
  // Legs and blocky oversized uniform.
  rrect(g, P(-0.16, -0.16).x, P(-0.16, -0.16).y, 0.12 * S, 0.16 * S, 6, hexToNum('#1C2C4A'), 5);
  rrect(g, P(0.04, -0.16).x, P(0.04, -0.16).y, 0.12 * S, 0.16 * S, 6, hexToNum('#1C2C4A'), 5);
  rrect(g, P(-0.25, -0.64).x, P(-0.25, -0.64).y, 0.5 * S, 0.5 * S, 12, color, 6);
  shine(g, P(-0.12, -0.56).x, P(-0.12, -0.56).y, 0.14 * S, 0.06 * S, 0.15);
  g.lineStyle(4, OUTLINE, 0.6);
  g.lineBetween(P(0, -0.62).x, P(0, -0.62).y, P(0, -0.16).x, P(0, -0.16).y);
  circle(g, P(-0.14, -0.52).x, P(-0.14, -0.52).y, 0.035 * S, accent, 3);
  // Clipboard.
  rrect(g, P(0.14, -0.5).x, P(0.14, -0.5).y, 0.2 * S, 0.26 * S, 4, hexToNum('#C49A6C'), 5);
  rrect(g, P(0.17, -0.46).x, P(0.17, -0.46).y, 0.14 * S, 0.18 * S, 2, 0xffffff, 0);
  // Head with cap and mustache.
  rrect(g, P(-0.14, -0.88).x, P(-0.14, -0.88).y, 0.28 * S, 0.26 * S, 18, skin, 6);
  circle(g, P(-0.06, -0.78).x, P(-0.06, -0.78).y, 0.02 * S + 2, OUTLINE, 0);
  poly(g, [P(-0.12, -0.7), P(0.02, -0.7), P(-0.02, -0.66), P(-0.08, -0.66)], hexToNum('#5D4037'), 3);
  rrect(g, P(-0.16, -0.98).x, P(-0.16, -0.98).y, 0.32 * S, 0.12 * S, 10, color, 5);
  rrect(g, P(-0.28, -0.88).x, P(-0.28, -0.88).y, 0.2 * S, 0.04 * S, 6, color, 4);
  circle(g, P(0, -0.93).x, P(0, -0.93).y, 0.03 * S, accent, 3);
}

export function enemyTexKey(id: string) {
  return `enemy_${id}`;
}

/** Texture box for an enemy of size S (height in px); feet at (w/2, h - pad). */
export function enemyTexBox(S: number) {
  return { w: Math.ceil(S * 1.7), h: Math.ceil(S * 1.25), pad: 10 };
}

function drawEnemy(g: G, shape: EnemyShape, S: number, color: number, accent: number) {
  const { w, h, pad } = enemyTexBox(S);
  const ox = w / 2;
  const oy = h - pad;
  switch (shape) {
    case 'rat':
      return drawRat(g, ox, oy, S, color, accent);
    case 'pigeon':
      return drawPigeon(g, ox, oy, S, color, accent);
    case 'raccoon':
      return drawRaccoonFoe(g, ox, oy, S, color, accent, false);
    case 'raccoonBoss':
      return drawRaccoonFoe(g, ox, oy, S, color, accent, true);
    case 'ratKing':
      return drawRatKing(g, ox, oy, S, color, accent);
    case 'officer':
      return drawOfficer(g, ox, oy, S, color, accent);
  }
}

// ------------------------------------------------------------------ particles & props
function drawStar(g: G, cx: number, cy: number, r: number, color: number) {
  const pts: Pt[] = [];
  for (let i = 0; i < 8; i++) {
    const ang = (Math.PI / 4) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.32;
    pts.push({ x: cx + Math.cos(ang) * rr, y: cy + Math.sin(ang) * rr });
  }
  g.fillStyle(color, 1);
  g.fillPoints(pts, true, true);
}

export function drawBag(g: G, cx: number, by: number, s: number) {
  // Black trash bag with a gold twist tie.
  ellipse(g, cx, by - 0.42 * s, 0.9 * s, 0.82 * s, hexToNum('#1E1E26'), 4);
  shine(g, cx - 0.18 * s, by - 0.58 * s, 0.22 * s, 0.14 * s, 0.25);
  poly(g, [{ x: cx - 0.12 * s, y: by - 0.8 * s }, { x: cx, y: by - 0.92 * s }, { x: cx + 0.12 * s, y: by - 0.8 * s }], hexToNum('#1E1E26'), 4);
  rrect(g, cx - 0.1 * s, by - 0.84 * s, 0.2 * s, 0.07 * s, 3, C('gold'), 2);
}

export function generateTextures(scene: Phaser.Scene): void {
  make(scene, 'raccoon_base', RACCOON_TEX.w, RACCOON_TEX.h, (g) => drawRaccoon(g, RACCOON_FEET.x, RACCOON_FEET.y));

  for (const [id, ph] of Object.entries(DATA.assets.placeholders.enemies)) {
    const { w, h } = enemyTexBox(ph.size);
    make(scene, enemyTexKey(id), w, h, (g) => drawEnemy(g, ph.shape, ph.size, hexToNum(ph.color), hexToNum(ph.accent)));
  }

  make(scene, 'p_star', 32, 32, (g) => drawStar(g, 16, 16, 15, 0xffffff));
  make(scene, 'p_dot', 16, 16, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 7);
  });
  make(scene, 'p_ring', 128, 128, (g) => {
    g.lineStyle(8, 0xffffff, 1);
    g.strokeCircle(64, 64, 58);
  });
  make(scene, 'p_smoke', 64, 64, (g) => {
    for (let r = 30; r > 0; r -= 5) {
      g.fillStyle(0xd8d8e0, 0.12);
      g.fillCircle(32, 32, r);
    }
  });
  make(scene, 'c_peel', 30, 20, (g) => {
    g.fillStyle(hexToNum('#F6D743'), 1);
    g.beginPath();
    g.arc(15, 2, 14, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
    g.arc(15, -4, 13, Phaser.Math.DegToRad(160), Phaser.Math.DegToRad(20), true);
    g.closePath();
    g.fillPath();
  });
  make(scene, 'c_cap', 22, 22, (g) => {
    drawStar(g, 11, 11, 11, hexToNum('#C0392B'));
    g.fillStyle(hexToNum('#E74C3C'), 1);
    g.fillCircle(11, 11, 8);
  });
  make(scene, 'c_paper', 18, 18, (g) => {
    g.fillStyle(hexToNum('#F2E6C9'), 1);
    g.fillRect(1, 1, 16, 16);
    g.lineStyle(2, hexToNum('#BFAF8A'), 1);
    g.lineBetween(1, 1, 17, 17);
  });
  make(scene, 'c_crust', 24, 18, (g) => {
    g.fillStyle(hexToNum('#D9A35B'), 1);
    g.fillTriangle(0, 18, 24, 18, 12, 0);
    g.fillStyle(hexToNum('#C0392B'), 1);
    g.fillCircle(12, 12, 3);
  });
  make(scene, 'p_coin', 40, 40, (g) => {
    circle(g, 20, 20, 16, C('gold'), 4);
    g.fillStyle(hexToNum('#8D6E00'), 1);
    g.fillEllipse(20, 18, 20, 7); // raccoon-face stamp
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(14, 13, 4);
  });
  make(scene, 'p_bag', 64, 72, (g) => drawBag(g, 32, 70, 64));
}

// ------------------------------------------------------------------ backgrounds (2048 px wide, tile left to right)
export const BG_TILE_W = 2048;

/** Deterministic pseudo-random in [0,1) for repeatable background layouts. */
function hash(i: number, salt = 0): number {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}

export function generateBackground(scene: Phaser.Scene, bgId: string): void {
  const c = DATA.assets.placeholders.backgrounds[bgId];
  const skyline = hexToNum(c.skyline);
  const win = hexToNum(c.window);
  const walls = hexToNum(c.walls);
  const ground = hexToNum(c.ground);

  // Far (0.2x): moon, skyline silhouettes, a scatter of lit windows.
  make(scene, `${bgId}_far`, BG_TILE_W, 560, (g) => {
    for (let r = 120; r > 50; r -= 10) {
      g.fillStyle(hexToNum('#FFF4D6'), 0.025);
      g.fillCircle(1500, 120, r);
    }
    g.fillStyle(hexToNum('#FFF4D6'), 1);
    g.fillCircle(1500, 120, 46);
    g.fillStyle(hexToNum('#E8DDBF'), 1);
    g.fillCircle(1486, 108, 8);
    g.fillCircle(1514, 134, 6);
    let x = 0;
    let i = 0;
    while (x < BG_TILE_W) {
      const w = 110 + Math.floor(hash(i, 1) * 120);
      const h = 170 + Math.floor(hash(i, 2) * 220);
      const top = 560 - h;
      g.fillStyle(skyline, 1);
      g.fillRect(x, top, w - 8, h);
      if (hash(i, 3) > 0.6) {
        g.fillRect(x + w * 0.3, top - 40, 34, 40);
        g.fillTriangle(x + w * 0.3 - 6, top - 40, x + w * 0.3 + 40, top - 40, x + w * 0.3 + 17, top - 60);
      }
      for (let wy = top + 20; wy < 540; wy += 42) {
        for (let wx = x + 14; wx < x + w - 30; wx += 30) {
          if (hash(wx * 7 + wy, 4) > 0.72) {
            g.fillStyle(win, 0.55);
            g.fillRect(wx, wy, 12, 18);
          }
        }
      }
      x += w;
      i++;
    }
  });

  // Mid (0.5x): suburban backs: houses, fences, porch lights.
  make(scene, `${bgId}_mid`, BG_TILE_W, 380, (g) => {
    let x = 0;
    let i = 0;
    while (x < BG_TILE_W) {
      const w = 260 + Math.floor(hash(i, 5) * 160);
      const h = 150 + Math.floor(hash(i, 6) * 80);
      const base = 380;
      g.fillStyle(walls, 1);
      g.fillRect(x + 20, base - h, w - 40, h);
      g.fillTriangle(x + 4, base - h, x + w - 4, base - h, x + w / 2, base - h - 90);
      g.lineStyle(5, OUTLINE, 0.7);
      g.strokeRect(x + 20, base - h, w - 40, h);
      g.fillStyle(hexToNum('#2A2140'), 1);
      g.fillRect(x + w / 2 - 28, base - 110, 56, 110);
      g.fillStyle(win, 0.85);
      g.fillRect(x + 50, base - h + 30, 44, 36);
      if (hash(i, 7) > 0.4) g.fillRect(x + w - 100, base - h + 30, 44, 36);
      // Porch light with a warm glow.
      for (let r = 46; r > 6; r -= 8) {
        g.fillStyle(win, 0.06);
        g.fillCircle(x + w / 2 + 44, base - 120, r);
      }
      g.fillStyle(win, 1);
      g.fillCircle(x + w / 2 + 44, base - 120, 7);
      x += w;
      i++;
    }
    // Picket fence along the bottom.
    for (let fx = 0; fx < BG_TILE_W; fx += 26) {
      g.fillStyle(hexToNum('#3A2E4A'), 1);
      g.fillRect(fx, 300, 18, 80);
      g.fillTriangle(fx, 300, fx + 18, 300, fx + 9, 286);
    }
    g.fillRect(0, 326, BG_TILE_W, 10);
    g.fillRect(0, 356, BG_TILE_W, 10);
  });

  // Ground (1x): wet asphalt, curb, puddles reflecting neon, a few signature props.
  make(scene, `${bgId}_ground`, BG_TILE_W, 220, (g) => {
    g.fillStyle(ground, 1);
    g.fillRect(0, 0, BG_TILE_W, 220);
    g.fillStyle(hexToNum('#3C4A5C'), 1);
    g.fillRect(0, 0, BG_TILE_W, 16);
    g.fillStyle(OUTLINE, 0.5);
    g.fillRect(0, 16, BG_TILE_W, 4);
    for (let i = 0; i < 9; i++) {
      const px = hash(i, 8) * BG_TILE_W;
      const py = 60 + hash(i, 9) * 120;
      const pw = 120 + hash(i, 10) * 160;
      g.fillStyle(hexToNum('#1F2836'), 1);
      g.fillEllipse(px, py, pw, pw * 0.16);
      g.fillStyle(i % 2 === 0 ? hexToNum(c.neon) : hexToNum(c.neon2), 0.22);
      g.fillEllipse(px - pw * 0.1, py, pw * 0.45, pw * 0.05);
    }
    g.lineStyle(3, OUTLINE, 0.35);
    for (let i = 0; i < 14; i++) {
      const cx = hash(i, 11) * BG_TILE_W;
      const cy = 40 + hash(i, 12) * 160;
      g.lineBetween(cx, cy, cx + 30, cy + 10);
      g.lineBetween(cx + 30, cy + 10, cx + 46, cy + 4);
    }
  });

  // Props layer drawn on the mid tile's floor line (recycling bins, gnome, lemonade stand).
  make(scene, `${bgId}_props`, BG_TILE_W, 200, (g) => {
    const blue = hexToNum('#2C5D8A');
    rrect(g, 300, 70, 70, 120, 8, blue, 5);
    rrect(g, 290, 60, 90, 18, 6, hexToNum('#244E75'), 5);
    rrect(g, 1240, 80, 64, 110, 8, hexToNum('#2F6B4F'), 5);
    // Lawn gnome.
    ellipse(g, 820, 170, 40, 40, hexToNum('#3A6EA5'), 4);
    circle(g, 820, 140, 14, hexToNum('#F1C6A6'), 4);
    poly(g, [{ x: 802, y: 134 }, { x: 838, y: 134 }, { x: 820, y: 96 }], hexToNum('#C0392B'), 4);
    poly(g, [{ x: 808, y: 146 }, { x: 832, y: 146 }, { x: 820, y: 170 }], 0xffffff, 3);
    // Abandoned lemonade stand.
    rrect(g, 1600, 100, 150, 90, 4, hexToNum('#C49A6C'), 5);
    rrect(g, 1590, 40, 170, 26, 4, hexToNum('#F6D743'), 5);
    g.lineStyle(6, OUTLINE, 1);
    g.lineBetween(1600, 66, 1600, 100);
    g.lineBetween(1750, 66, 1750, 100);
  });

  // Foreground (1.3x, semi-transparent): hanging wires with sneakers, steam.
  make(scene, `${bgId}_fg`, BG_TILE_W, 768, (g) => {
    for (let px = 0; px <= BG_TILE_W; px += 680) {
      const next = px + 680;
      for (const sag of [70, 110]) {
        const pts: Pt[] = [];
        for (let t = 0; t <= 20; t++) {
          const u = t / 20;
          pts.push({ x: px + (next - px) * u, y: 20 + sag * 4 * u * (1 - u) + (sag - 70) * 0.6 });
        }
        g.lineStyle(4, OUTLINE, 0.9);
        g.strokePoints(pts, false, false);
      }
    }
    // Sneakers hanging from a wire (a classic alley gag).
    g.lineStyle(3, OUTLINE, 0.9);
    g.lineBetween(1020, 90, 1010, 150);
    g.lineBetween(1020, 90, 1040, 140);
    rrect(g, 990, 150, 34, 16, 6, hexToNum('#E0E0E0'), 3);
    rrect(g, 1026, 140, 34, 16, 6, hexToNum('#E0E0E0'), 3);
    for (let i = 0; i < 6; i++) {
      const sx = hash(i, 13) * BG_TILE_W;
      for (let r = 70; r > 10; r -= 12) {
        g.fillStyle(0xe8e8f0, 0.05);
        g.fillCircle(sx, 720 - (70 - r), r);
      }
    }
  });
}
