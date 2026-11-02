/**
 * Painted scenery for the storybook night alley: watercolor sky, skyline with lit windows,
 * Suburbs houses with porch-lamp glow, props, wet asphalt with neon reflections, and a
 * foreground of wires and steam. Tiles are 2048 px wide and wrap left to right.
 */
import { DATA } from '../../data';
import {
  bloom, ellipse, fillShape, glow, grainOver, ink, INK, INK_DEEP, LAMP, makeCanvas, mix, NEON_CYAN, NEON_PINK, paint,
  rgba, rrect, seeded, shadowOf, shape, sparkle, stroke, within, type Ctx, type Pt, type Rnd,
} from './brush';

export const TILE_W = 2048;

type Bg = (typeof DATA.assets.placeholders.backgrounds)[string];
const PAL = DATA.assets.placeholders.palette;
const FAR_INK = mix(INK, '#6E6A9A', 0.35);

/** Stable pseudo-random in [0,1) for layout decisions. */
function hash(i: number, salt = 0): number {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}

// ------------------------------------------------------------------ sky (static)
export function paintSky(w: number, h: number, c: Bg): HTMLCanvasElement {
  const { c: cv, ctx } = makeCanvas(w, h);
  const rnd = seeded(21);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, c.sky);
  g.addColorStop(0.55, mix(c.sky, c.skyLow, 0.6));
  g.addColorStop(1, mix(c.skyLow, LAMP, 0.12));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Wet-in-wet blooms.
  const tints = [mix(c.sky, '#6B5FA8', 0.35), mix(c.skyLow, '#B05C8A', 0.25), mix(c.sky, '#000020', 0.3)];
  for (let i = 0; i < 18; i++) bloom(ctx, rnd() * w, rnd() * h * 0.8, 90 + rnd() * 220, tints[i % 3], 0.08 + rnd() * 0.1);
  // Stars.
  for (let i = 0; i < 70; i++) {
    const x = rnd() * w;
    const y = rnd() * h * 0.62;
    const a = 0.25 + rnd() * 0.65;
    fillShape(ctx, ellipse(x, y, 1 + rnd() * 1.3, 1 + rnd() * 1.3, 8), '#FFF4D6', a);
    if (rnd() < 0.12) {
      sparkle(ctx, x, y, 5 + rnd() * 4, '#FFF4D6', 0.8);
      glow(ctx, x, y, 14, '#FFF4D6', 0.25);
    }
  }
  // Moon with a warm halo.
  const mx = w * 0.78;
  const my = 128;
  glow(ctx, mx, my, 210, '#FFE9C2', 0.16);
  glow(ctx, mx, my, 90, '#FFF4D6', 0.3);
  paint(ctx, rnd, ellipse(mx, my, 46, 46), { color: '#FFF4D6', hard: 0.18, shadow: '#E3D3B5', light: '#FFFFFF', lightAlpha: 0.4, grain: 0.18 });
  for (const [dx, dy, r] of [[-14, -10, 8], [12, 14, 6], [16, -16, 4], [-6, 18, 5]] as const) {
    fillShape(ctx, ellipse(mx + dx, my + dy, r, r * 0.9), '#E6D6B8', 0.75);
  }
  ink(ctx, rnd, ellipse(mx, my, 46, 46), { width: 2.5, color: mix(INK, '#FFF4D6', 0.45), alpha: 0.6 });
  grainOver(ctx, w, h, 0.5);
  return cv;
}

// ------------------------------------------------------------------ far skyline (0.2x)
export function paintFar(c: Bg): HTMLCanvasElement {
  const H = 520;
  const { c: cv, ctx } = makeCanvas(TILE_W, H);
  const rnd = seeded(31);
  let x = 10;
  let i = 0;
  while (x < TILE_W - 140) {
    const bw = Math.min(TILE_W - 20 - x, 110 + Math.floor(hash(i, 1) * 120));
    if (bw < 60) break;
    const bh = 170 + Math.floor(hash(i, 2) * 230);
    const top = H - bh;
    const col = mix(c.skyline, c.sky, hash(i, 3) * 0.35);
    const pts = rrect(x, top, bw - 8, bh + 10, 4);
    const body = paint(ctx, rnd, pts, { color: col, hard: 0.22, lightAlpha: 0.06, grain: 0.32, wobble: 1.2 });
    within(ctx, body, () => {
      for (let wy = top + 22; wy < H - 30; wy += 40) {
        for (let wx = x + 14; wx < x + bw - 34; wx += 30) {
          const lit = hash(Math.round(wx * 7 + wy), 4) > 0.7;
          fillShape(ctx, rrect(wx, wy, 13, 19, 2), lit ? LAMP : mix(col, '#000010', 0.25), lit ? 0.85 : 0.6);
          if (lit) glow(ctx, wx + 6, wy + 9, 20, LAMP, 0.18);
        }
      }
    });
    ink(ctx, rnd, pts, { width: 2.2, color: FAR_INK, alpha: 0.7 });
    if (hash(i, 5) > 0.55) {
      // Water tower.
      const tx = x + bw * 0.35;
      const tank = rrect(tx, top - 46, 40, 34, 8);
      shape(ctx, rnd, tank, { color: mix(col, '#000010', 0.15), line: 2, ink: FAR_INK, lightAlpha: 0.05 });
      stroke(ctx, rnd, [{ x: tx + 8, y: top - 12 }, { x: tx + 8, y: top }], 2, FAR_INK, 0.7);
      stroke(ctx, rnd, [{ x: tx + 32, y: top - 12 }, { x: tx + 32, y: top }], 2, FAR_INK, 0.7);
    } else if (hash(i, 6) > 0.5) {
      stroke(ctx, rnd, [{ x: x + bw * 0.6, y: top }, { x: x + bw * 0.6, y: top - 40 }], 2, FAR_INK, 0.7);
      glow(ctx, x + bw * 0.6, top - 42, 10, NEON_PINK, 0.5);
    }
    x += bw;
    i++;
  }
  // Atmospheric haze at the base.
  const haze = ctx.createLinearGradient(0, H - 140, 0, H);
  haze.addColorStop(0, rgba(c.skyLow, 0));
  haze.addColorStop(1, rgba(c.skyLow, 0.55));
  ctx.fillStyle = haze;
  ctx.fillRect(0, H - 140, TILE_W, 140);
  return cv;
}

// ------------------------------------------------------------------ mid: suburban backs (0.5x)
function house(ctx: Ctx, rnd: Rnd, x: number, base: number, w: number, h: number, c: Bg, i: number) {
  const walls = mix(c.walls, '#2A2348', hash(i, 7) * 0.3);
  const wall = rrect(x + 14, base - h, w - 28, h + 6, 4);
  const body = paint(ctx, rnd, wall, { color: walls, hard: 0.3, lightAlpha: 0.12, grain: 0.3 });
  const roof = [{ x: x, y: base - h + 4 }, { x: x + w, y: base - h + 4 }, { x: x + w / 2, y: base - h - 86 }];
  shape(ctx, rnd, roof, { color: shadowOf(walls, 0.45), line: 3.5, lightAlpha: 0.08, grain: 0.35 });
  within(ctx, body, () => {
    // Warm windows with curtains.
    const wins = [x + 44, x + w - 96];
    for (const [k, wx] of wins.entries()) {
      if (k === 1 && hash(i, 8) < 0.35) continue;
      const wy = base - h + 30;
      fillShape(ctx, rrect(wx, wy, 52, 40, 4), LAMP, 0.92);
      glow(ctx, wx + 26, wy + 20, 70, LAMP, 0.22);
      fillShape(ctx, rrect(wx, wy, 14, 40, 3), mix(LAMP, '#C2574B', 0.55), 0.9);
      fillShape(ctx, rrect(wx + 38, wy, 14, 40, 3), mix(LAMP, '#C2574B', 0.55), 0.9);
      ink(ctx, rnd, rrect(wx, wy, 52, 40, 4), { width: 2.5 });
      stroke(ctx, rnd, [{ x: wx + 26, y: wy }, { x: wx + 26, y: wy + 40 }], 2, INK, 0.8);
    }
    // Back door.
    shape(ctx, rnd, rrect(x + w / 2 - 26, base - 112, 52, 116, 6), { color: shadowOf(walls, 0.5), line: 3, lightAlpha: 0.05 });
  });
  ink(ctx, rnd, wall, { width: 3.5 });
  // Porch lamp: a small fixture and a big warm halo.
  const lx = x + w / 2 + 46;
  const ly = base - 128;
  glow(ctx, lx, ly, 110, LAMP, 0.34);
  glow(ctx, lx, ly, 34, '#FFE2B0', 0.7);
  shape(ctx, rnd, rrect(lx - 7, ly - 10, 14, 18, 4), { color: '#FFE2B0', line: 2.5, hard: 0, lightAlpha: 0.6 });
}

export function paintMid(c: Bg): HTMLCanvasElement {
  const H = 380;
  const { c: cv, ctx } = makeCanvas(TILE_W, H);
  const rnd = seeded(41);
  // Trees and bushes behind the houses.
  for (let i = 0; i < 9; i++) {
    const x = 60 + hash(i, 9) * (TILE_W - 120);
    const r = 60 + hash(i, 10) * 50;
    paint(ctx, rnd, ellipse(x, H - 170, r, r * 0.9, 24), { color: mix('#2B3346', '#34284A', hash(i, 11)), hard: 0.35, lightAlpha: 0.08, grain: 0.35, wobble: 4 });
  }
  let x = 0;
  let i = 0;
  while (x < TILE_W - 200) {
    const w = Math.min(TILE_W - x, 270 + Math.floor(hash(i, 12) * 150));
    if (w < 220) break;
    house(ctx, rnd, x, H, w, 150 + Math.floor(hash(i, 13) * 70), c, i);
    x += w;
    i++;
  }
  // Picket fence along the bottom, wrapping cleanly.
  const fence = mix('#6E6380', c.walls, 0.3);
  for (let fx = 4; fx < TILE_W; fx += 30) {
    const post = [{ x: fx, y: H }, { x: fx, y: H - 74 }, { x: fx + 10, y: H - 88 }, { x: fx + 20, y: H - 74 }, { x: fx + 20, y: H }];
    shape(ctx, rnd, post, { color: fence, line: 2.5, hard: 0.35, lightAlpha: 0.12, grain: 0.3, wobble: 0.6 });
  }
  fillShape(ctx, rrect(0, H - 56, TILE_W, 9, 2), shadowOf(fence, 0.3), 0.95);
  fillShape(ctx, rrect(0, H - 26, TILE_W, 9, 2), shadowOf(fence, 0.3), 0.95);
  return cv;
}

// ------------------------------------------------------------------ props (0.5x, on the floor line)
function trashBag(ctx: Ctx, rnd: Rnd, x: number, base: number, s: number) {
  shape(ctx, rnd, ellipse(x, base - s * 0.42, s * 0.48, s * 0.42), { color: '#26232E', line: 3.5, light: '#9A8FB5', lightAlpha: 0.3 });
  shape(ctx, rnd, [{ x: x - s * 0.12, y: base - s * 0.78 }, { x: x, y: base - s * 0.95 }, { x: x + s * 0.12, y: base - s * 0.78 }], { color: '#26232E', line: 3 });
  shape(ctx, rnd, rrect(x - s * 0.11, base - s * 0.84, s * 0.22, s * 0.07, 3), { color: PAL.gold, line: 2, hard: 0.2 });
}

export function paintProps(): HTMLCanvasElement {
  const H = 200;
  const base = 190;
  const { c: cv, ctx } = makeCanvas(TILE_W, H);
  const rnd = seeded(51);
  // Recycling bins.
  shape(ctx, rnd, rrect(300, base - 122, 74, 122, 8), { color: '#2C5D8A', line: 4, rim: NEON_PINK });
  shape(ctx, rnd, rrect(290, base - 134, 94, 20, 6), { color: '#244E75', line: 4 });
  shape(ctx, rnd, rrect(1240, base - 112, 68, 112, 8), { color: PAL.dumpster, line: 4 });
  shape(ctx, rnd, rrect(1232, base - 124, 84, 18, 6), { color: shadowOf(PAL.dumpster, 0.3), line: 4 });
  // Lawn gnome.
  shape(ctx, rnd, ellipse(822, base - 22, 22, 22), { color: '#3A6EA5', line: 3.5 });
  shape(ctx, rnd, ellipse(822, base - 52, 15, 15), { color: '#F1C6A6', line: 3 });
  shape(ctx, rnd, [{ x: 802, y: base - 58 }, { x: 842, y: base - 58 }, { x: 822, y: base - 100 }], { color: '#C0392B', line: 3 });
  shape(ctx, rnd, [{ x: 808, y: base - 46 }, { x: 836, y: base - 46 }, { x: 822, y: base - 18 }], { color: '#F7F1E4', line: 2.5, hard: 0.2 });
  // Abandoned lemonade stand.
  shape(ctx, rnd, rrect(1600, base - 92, 152, 92, 4), { color: PAL.kraft, line: 4 });
  shape(ctx, rnd, rrect(1588, base - 152, 176, 28, 4), { color: '#F6D743', line: 4 });
  stroke(ctx, rnd, [{ x: 1602, y: base - 124 }, { x: 1602, y: base - 92 }], 5, INK);
  stroke(ctx, rnd, [{ x: 1748, y: base - 124 }, { x: 1748, y: base - 92 }], 5, INK);
  // Trash bags with gold twist ties.
  trashBag(ctx, rnd, 520, base, 70);
  trashBag(ctx, rnd, 570, base, 56);
  trashBag(ctx, rnd, 1460, base, 64);
  return cv;
}

// ------------------------------------------------------------------ ground (1x)
export function paintGround(c: Bg): HTMLCanvasElement {
  const H = 220;
  const { c: cv, ctx } = makeCanvas(TILE_W, H);
  const rnd = seeded(61);
  ctx.fillStyle = c.ground;
  ctx.fillRect(0, 0, TILE_W, H);
  // Dry-brush asphalt texture.
  for (let i = 0; i < 260; i++) {
    const y = 20 + rnd() * (H - 20);
    const x = rnd() * (TILE_W - 200);
    const len = 60 + rnd() * 200;
    const light = rnd() > 0.5;
    stroke(ctx, rnd, [{ x, y }, { x: x + len * 0.5, y: y + (rnd() - 0.5) * 6 }, { x: x + len, y }], 1 + rnd() * 3, light ? '#55657A' : '#1E2734', 0.1 + rnd() * 0.12);
  }
  // Curb.
  fillShape(ctx, rrect(0, 0, TILE_W, 18, 2), '#40506A', 1);
  fillShape(ctx, rrect(0, 16, TILE_W, 5, 1), INK_DEEP, 0.55);
  // Puddles reflecting neon and lamps.
  for (let i = 0; i < 8; i++) {
    const px = 140 + hash(i, 14) * (TILE_W - 280);
    const py = 70 + hash(i, 15) * 110;
    const pw = 100 + hash(i, 16) * 130;
    const puddle = ellipse(px, py, pw / 2, pw * 0.09, 28);
    const body = paint(ctx, rnd, puddle, { color: '#1A2230', hard: 0.15, lightAlpha: 0.05, grain: 0.15, wobble: 2 });
    within(ctx, body, () => {
      const cols = [NEON_PINK, NEON_CYAN, LAMP];
      for (let k = 0; k < 3; k++) {
        const rx = px + (k - 1) * pw * 0.22 + (rnd() - 0.5) * 10;
        glow(ctx, rx, py, pw * 0.16, cols[(i + k) % 3], 0.35);
        stroke(ctx, rnd, [{ x: rx, y: py - pw * 0.07 }, { x: rx + 2, y: py + pw * 0.07 }], 3, cols[(i + k) % 3], 0.5);
      }
    });
    ink(ctx, rnd, puddle, { width: 1.6, color: mix(INK, '#8FA3C0', 0.3), alpha: 0.6 });
  }
  // Cracks.
  for (let i = 0; i < 14; i++) {
    const cx = 40 + hash(i, 17) * (TILE_W - 120);
    const cy = 40 + hash(i, 18) * 160;
    stroke(ctx, rnd, [{ x: cx, y: cy }, { x: cx + 26, y: cy + 8 }, { x: cx + 46, y: cy + 2 }], 1.6, INK_DEEP, 0.45);
  }
  grainOver(ctx, TILE_W, H, 0.5);
  return cv;
}

// ------------------------------------------------------------------ foreground (1.3x, semi-transparent)
export function paintFg(): HTMLCanvasElement {
  const H = 768;
  const { c: cv, ctx } = makeCanvas(TILE_W, H);
  const rnd = seeded(71);
  // Wires sag between poles every 512 px, so the tile wraps.
  for (let px = 0; px < TILE_W; px += 512) {
    for (const [y0, sag] of [[24, 70], [44, 96]] as const) {
      const pts: Pt[] = [];
      for (let t = 0; t <= 16; t++) {
        const u = t / 16;
        pts.push({ x: px + 512 * u, y: y0 + sag * 4 * u * (1 - u) });
      }
      stroke(ctx, rnd, pts, 3.6, INK_DEEP, 0.95);
    }
  }
  // Sneakers hanging from a wire (a classic alley gag).
  stroke(ctx, rnd, [{ x: 1020, y: 112 }, { x: 1012, y: 168 }], 2, INK_DEEP);
  stroke(ctx, rnd, [{ x: 1020, y: 112 }, { x: 1044, y: 160 }], 2, INK_DEEP);
  shape(ctx, rnd, rrect(990, 166, 36, 17, 7), { color: '#E8E2F0', line: 2.5 });
  shape(ctx, rnd, rrect(1028, 158, 36, 17, 7), { color: '#E8E2F0', line: 2.5 });
  // Steam drifting up from below and a few paper scraps.
  for (let i = 0; i < 6; i++) {
    const sx = 120 + hash(i, 19) * (TILE_W - 240);
    for (let k = 0; k < 5; k++) bloom(ctx, sx + (rnd() - 0.5) * 50, H - 40 - k * 36, 60 - k * 6, '#E8E4F2', 0.06);
  }
  for (let i = 0; i < 10; i++) {
    const x = 60 + hash(i, 20) * (TILE_W - 120);
    const y = 220 + hash(i, 21) * 300;
    const q = [{ x, y }, { x: x + 14, y: y + 3 }, { x: x + 12, y: y + 15 }, { x: x - 2, y: y + 11 }];
    shape(ctx, rnd, q, { color: '#EFE6D2', line: 1.6, hard: 0.2, grain: 0.1 });
  }
  return cv;
}

// ------------------------------------------------------------------ sign board, particles
export function paintSignBoard(w: number, h: number, neon: string): HTMLCanvasElement {
  const pad = 70;
  const { c: cv, ctx } = makeCanvas(w + pad * 2, h + pad * 2);
  const rnd = seeded(81);
  glow(ctx, pad + w / 2, pad + h / 2, Math.max(w, h) * 0.85, neon, 0.22);
  const board = rrect(pad, pad, w, h, 18);
  paint(ctx, rnd, board, { color: '#2A1E36', hard: 0.3, lightAlpha: 0.08, grain: 0.35 });
  ink(ctx, rnd, board, { width: 5 });
  stroke(ctx, rnd, [{ x: pad + 40, y: pad }, { x: pad + 30, y: pad - 60 }], 3, INK_DEEP);
  stroke(ctx, rnd, [{ x: pad + w - 40, y: pad }, { x: pad + w - 30, y: pad - 60 }], 3, INK_DEEP);
  return cv;
}

export function paintParticle(kind: string): HTMLCanvasElement {
  const rnd = seeded(kind.length * 31 + kind.charCodeAt(0));
  switch (kind) {
    case 'star': {
      const { c, ctx } = makeCanvas(32, 32);
      sparkle(ctx, 16, 16, 15, '#FFFFFF');
      return c;
    }
    case 'dot': {
      const { c, ctx } = makeCanvas(16, 16);
      fillShape(ctx, ellipse(8, 8, 6.5, 6.5, 12), '#FFFFFF');
      return c;
    }
    case 'ring': {
      const { c, ctx } = makeCanvas(128, 128);
      ink(ctx, rnd, ellipse(64, 64, 56, 56), { width: 8, color: '#FFFFFF', jitter: 1.5 });
      return c;
    }
    case 'smoke': {
      const { c, ctx } = makeCanvas(64, 64);
      bloom(ctx, 32, 32, 30, '#DCD8E8', 0.6);
      return c;
    }
    case 'coin': {
      const { c, ctx } = makeCanvas(44, 44);
      shape(ctx, rnd, ellipse(22, 22, 16, 16), { color: PAL.gold, line: 3, light: '#FFF3B0', lightAlpha: 0.6, grain: 0.1 });
      fillShape(ctx, ellipse(22, 20, 10, 3.5), '#8D5A00', 0.9);
      return c;
    }
    case 'bag': {
      const { c, ctx } = makeCanvas(70, 78);
      trashBag(ctx, rnd, 35, 74, 64);
      return c;
    }
    case 'peel': {
      const { c, ctx } = makeCanvas(32, 22);
      shape(ctx, rnd, [{ x: 2, y: 6 }, { x: 16, y: 18 }, { x: 30, y: 6 }, { x: 16, y: 12 }], { color: '#F6D743', line: 1.6, hard: 0.2, grain: 0 });
      return c;
    }
    case 'cap': {
      const { c, ctx } = makeCanvas(24, 24);
      shape(ctx, rnd, ellipse(12, 12, 9, 9), { color: '#E74C3C', line: 1.6, hard: 0.2, grain: 0 });
      return c;
    }
    case 'paper': {
      const { c, ctx } = makeCanvas(22, 22);
      shape(ctx, rnd, [{ x: 3, y: 3 }, { x: 19, y: 5 }, { x: 17, y: 19 }, { x: 4, y: 16 }], { color: '#F2E6C9', line: 1.4, hard: 0.2, grain: 0 });
      return c;
    }
    case 'crust':
    default: {
      const { c, ctx } = makeCanvas(26, 20);
      shape(ctx, rnd, [{ x: 2, y: 18 }, { x: 24, y: 18 }, { x: 13, y: 2 }], { color: '#D9A35B', line: 1.6, hard: 0.2, grain: 0 });
      fillShape(ctx, ellipse(13, 13, 3, 3), '#C0392B');
      return c;
    }
  }
}
