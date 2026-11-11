/**
 * CrazyGames store covers and the logo, in the style of the store's tiles: the raccoon big in the frame,
 * all of him, his BBQ Spatula raised in his paw toward the top corner, over a soft, blurred view of
 * Lava Landfill (World 10: its orange sunset sky, clouds, red trees and houses), with a few flecks of
 * light and the game's sparkles on the blade. No text, no border.
 *
 * The raccoon (his cheer pose, frame 13, as the battle shows him: hero.ts composeHero) and the spatula
 * (the game's BBQ Spatula item art) are the game's own pixels, both at one big pixel size and never
 * smoothed. Only the background is soft.
 *
 * With ?label=IDLE%20RPG it's the store's usual key art instead (like the CrazyGames tiles Kevin
 * pointed at): the game's logo big in the middle on its sticker (titleLogo, as the loading screen shows
 * it), the words on a nailed wooden sign hung across its foot in the logo's own lettering (cream), and
 * under it the raccoon on the left, spatula raised, facing off with an Orc Brute on the right. In the
 * tall tile the orc stands further back so the blade doesn't cover his face; the raccoon is drawn in
 * front of the title, the orc behind it.
 *   ?w=800&h=800 : the output size.
 */
import { TITLE } from '../../src/render/titleScene';
import { CLOUD_SCROLL0, LAYER_NAMES, layerRow, viewAtmo, worldArt, worldSeed } from '../../src/render/worldLook';
import { glowOverlay, paintClouds, paintSky } from '../../src/render/pixel/atmosphere';
import { DATA } from '../../src/data';
import { blank, blit, fromRows, outline, setPx, type PixelBuf } from '../../src/render/pixel/buf';
import { composeHero } from '../../src/render/pixel/hero';
import { ITEM_SPRITES } from '../../src/render/pixel/items';
import { FX } from '../../src/render/pixel/ui';
import { toCanvas } from '../../src/render/pixel';
import { GOLD, LOGO_H, letterMask, paintLetter } from '../../src/render/logoArt';
import { titleLogo } from '../../src/render/titleScene';
import { ENEMY_ART, recolorEnemy, type EnemyShape } from '../../src/render/pixel/enemies';

const q = new URLSearchParams(location.search);
const W = Number(q.get('w')) || 800;
const H = Number(q.get('h')) || 800;
const layout = W / H > 1.3 ? 'land' : W / H < 0.8 ? 'port' : 'square';

/**
 * Per format: across = how many game pixels span the cover's width (so the framing is the same at any
 * size); fig = where his frame's top left goes, in game pixels from the cover's top left (all of him,
 * standing, the blade toward the top right); bg = the part of the title scene behind (art px: centre x,
 * top, height), set so its street is about at his feet.
 */
const L = {
  square: { across: 28, fig: { x: -2.7, y: 6 }, bg: { cx: 92, top: 178, h: 90 } },
  port: { across: 28, fig: { x: -2.7, y: 16.3 }, bg: { cx: 120, top: 140, h: 140 } },
  land: { across: 41, fig: { x: 4, y: 1.3 }, bg: { cx: 96, top: 194, h: 72 } },
}[layout];
/** Screen px per game pixel. */
const PX = W / L.across;

const out = document.getElementById('c') as HTMLCanvasElement;
out.width = W;
out.height = H;
const ctx = out.getContext('2d')!;
const cv = (b: PixelBuf) => toCanvas(b, 1);

// Deterministic sprinkles.
let seed = 23;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

// ---- the world behind, soft: built the way the title screen builds World 1 (titleScene.ts titleArt),
// for any world, its sky stretched down to the title's height so the same windows fit.
/** The world behind him: Lava Landfill, its orange sunset and red trees (eye-catching on the grid). */
const WORLD = 10;
const scene = document.createElement('canvas');
scene.width = TITLE.w;
scene.height = TITLE.h;
const sc = scene.getContext('2d')!;
sc.imageSmoothingEnabled = false;
function tile(buf: PixelBuf, y: number, scroll: number) {
  const c = cv(buf);
  const start = -(((scroll % buf.w) + buf.w) % buf.w);
  for (let x = start; x < TITLE.w; x += buf.w) sc.drawImage(c, x, y);
}
{
  const world = worldArt(WORLD);
  const { set } = world;
  const wseed = worldSeed(WORLD);
  const base = viewAtmo(DATA.worlds[WORLD - 1].look.atmo, set);
  const d = TITLE.drop;
  const atmo = {
    ...base,
    sky: [base.sky[0], ...base.sky],
    horizon: base.horizon + d,
    body: base.body && { ...base.body, y: base.body.y + d },
    clouds: base.clouds && { ...base.clouds, y: base.clouds.y + d },
  };
  tile(paintSky(atmo, TITLE.w, TITLE.h, wseed, world.scale), 0, 0);
  const glow = glowOverlay(atmo, wseed);
  if (glow) sc.drawImage(cv(glow.buf), glow.x, glow.y);
  paintClouds(atmo, wseed, world.scale).forEach((c, i) => tile(c.buf, c.y, CLOUD_SCROLL0[i] ?? 0));
  for (const name of LAYER_NAMES) tile(world.layers[name], layerRow(set, name) + d, set.scroll0[name]);
}

{
  // The window onto the scene, widened to the cover's shape, drawn over the whole cover and blurred.
  const bh = L.bg.h;
  const bw = (bh * W) / H;
  const blur = Math.round(Math.min(W, H) / 40);
  ctx.save();
  ctx.filter = `blur(${blur}px) saturate(1.45) brightness(0.97)`;
  ctx.imageSmoothingEnabled = true;
  // (Drawn a little past the edges so the blur doesn't pull in the page's transparency.)
  const m = blur * 3;
  ctx.drawImage(scene, L.bg.cx - bw / 2, L.bg.top, bw, bh, -m, -m, W + 2 * m, H + 2 * m);
  ctx.restore();
}

// A deeper red toward the edges, so he stands out.
{
  const g = ctx.createRadialGradient(W * 0.45, H * 0.55, Math.min(W, H) * 0.25, W * 0.45, H * 0.55, Math.hypot(W, H) * 0.65);
  g.addColorStop(0, 'rgba(110,15,5,0)');
  g.addColorStop(1, 'rgba(110,15,5,0.4)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// Sunlight from the top corner the spatula points to: a soft glow and a few faint rays.
{
  const sx = W * 0.92;
  const sy = -H * 0.04;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const r = Math.max(W, H) * 0.75;
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
  g.addColorStop(0, 'rgba(255,244,200,0.75)');
  g.addColorStop(0.35, 'rgba(255,240,200,0.22)');
  g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.filter = `blur(${Math.round(Math.min(W, H) / 60)}px)`;
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.55 + i * 0.085);
    const R = Math.hypot(W, H) * 1.1;
    ctx.fillStyle = `rgba(255,248,220,${i % 2 ? 0.07 : 0.11})`;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(a) * R, sy + Math.sin(a) * R);
    ctx.lineTo(sx + Math.cos(a + 0.035) * R, sy + Math.sin(a + 0.035) * R);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Flecks of light drifting in the air (soft, out of focus, like the town behind).
for (let i = 0; i < 26; i++) {
  const x = rnd() * W;
  const y = rnd() * H * 0.85;
  const r = (0.12 + rnd() * 0.35) * PX;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${(0.18 + rnd() * 0.3).toFixed(2)})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ---- the figure: the raccoon with his spatula raised, the game's pixels
const hero = composeHero(13, {}, 0); // his cheer pose: arms out (the battle's view: facing us)
const spatula = fromRows(ITEM_SPRITES.weapon_bbq_spatula);
/**
 * His raised paw (the end of his arm on the right) and where it holds the handle in the item art (game
 * px): low on the handle, so the handle rises out of his fist to the blade by his head.
 */
const PAW = { x: 19, y: 14 };
const GRIP = { x: 4, y: 11 };
const fig = blank(hero.w + spatula.w, hero.h + spatula.h);
const heroAt = { x: 0, y: spatula.h };
const spAt = { x: heroAt.x + PAW.x - GRIP.x, y: heroAt.y + PAW.y - GRIP.y };
// The spatula behind his paw, so the paw grips its handle.
blit(fig, spatula, spAt.x, spAt.y);
blit(fig, hero, heroAt.x, heroAt.y);
/** Where his feet are in `fig` (game px). */
const FEET = { x: heroAt.x + 11.5, y: heroAt.y + 19.7 };

/** A soft shadow on the ground, `rx` wide (screen px) around (x, y). */
function groundShadow(x: number, y: number, rx: number, ry: number, p: number) {
  ctx.save();
  ctx.filter = `blur(${Math.round(p * 0.5)}px)`;
  ctx.fillStyle = 'rgba(15,30,45,0.4)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A sprite at `p` screen px per game px, crisp, lifted off the background by a soft shadow. */
function drawSprite(buf: PixelBuf, x: number, y: number, p: number) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.shadowColor = 'rgba(10,30,70,0.45)';
  ctx.shadowBlur = p * 1.2;
  ctx.shadowOffsetY = p * 0.35;
  ctx.drawImage(cv(buf), x, y, buf.w * p, buf.h * p);
  ctx.restore();
}

/**
 * The raccoon and his spatula with his feet at (x, y), `p` screen px per game px. In two parts, so a
 * title can go between: 'back' is the light behind his head and his shadow on the ground, 'front' is
 * him, and the game's sparkles glinting on the blade.
 */
function drawHero(x: number, y: number, p: number, part: 'back' | 'front' | 'both' = 'both') {
  const fx = x - FEET.x * p;
  const fy = y - FEET.y * p;
  if (part !== 'front') {
    const hx = fx + (heroAt.x + 12) * p;
    const hy = fy + (heroAt.y + 10) * p;
    const r = 14 * p;
    const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
    g.addColorStop(0, 'rgba(255,250,225,0.55)');
    g.addColorStop(1, 'rgba(255,250,225,0)');
    ctx.fillStyle = g;
    ctx.fillRect(hx - r, hy - r, r * 2, r * 2);
    groundShadow(x, y, 7.5 * p, 1.1 * p, p);
  }
  if (part === 'back') return;
  drawSprite(fig, fx, fy, p);
  const sp = cv(fromRows(FX.sparkle));
  const blade = { x: fx + (spAt.x + 11) * p, y: fy + (spAt.y + 3) * p };
  ctx.imageSmoothingEnabled = false;
  for (const [dx, dy, s] of [[2.6, -3.2, 1], [-3.4, -1.6, 0.75], [4.2, 2.4, 0.6]] as const) {
    const size = sp.width * p * 0.5 * s;
    ctx.drawImage(sp, blade.x + dx * p - size / 2, blade.y + dy * p - size / 2, size, size);
  }
}

// ---- the title (?label=IDLE%20RPG): the game's logo, and the words on a wooden sign under it
const label = (q.get('label') ?? '').trim().toUpperCase();

/** Wood for the sign: light top edge, face bands, shade, the seam between its two boards, grain, nails. */
const WOOD = {
  edge: '#f2be7e',
  face: ['#dca062', '#d09254', '#c3844a'],
  low: '#a7683a',
  side: ['#8a4f2a', '#6a3a1e'],
  seam: '#5b2f17',
  grain: '#a86c3c',
  knot: '#7a4424',
  nail: ['#f4f4f8', '#a9a9b8', '#62627a'],
};
/** The words' paint: cream, glossy, on a drop the color of dark wood. */
const CREAM: typeof GOLD = {
  face: ['#ffffff', '#fffaf0', '#fff3dc', '#ffe9c4', '#ffdca8'],
  light: '#ffffff',
  shade: '#eebf86',
  gloss: '#ffffff',
  drop: ['#7a3f1c', '#4e2610'],
};

function px(b: PixelBuf, x: number, y: number, hex: string) {
  if (x >= 0 && y >= 0 && x < b.w && y < b.h) setPx(b, x, y, hex);
}

/**
 * A wooden sign w x h (art px) of two boards, nailed, its ends a little ragged, standing on a few rows
 * of its own darker edge (its thickness), with an ink outline. Its face is (1, 1) to (w, h) in the result.
 */
function woodSign(w: number, h: number): PixelBuf {
  const SIDE = 3;
  const r = 3;
  const inBox = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const cx = x < r ? r - 0.5 : x >= w - r ? w - r - 0.5 : x;
    const cy = y < r ? r - 0.5 : y >= h - r ? h - r - 0.5 : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  // Ragged ends: a few bites out of the left and right edges.
  const chips = new Set(['0,6', '0,7', '1,7', `${w - 1},4`, `${w - 1},${h - 6}`, `${w - 2},${h - 6}`, `${w - 1},${h - 5}`, '0,' + (h - 4)]);
  const face = (x: number, y: number) => inBox(x, y) && !chips.has(`${x},${y}`);
  const b = blank(w, h + SIDE);
  // Its thickness under it.
  for (let y = 0; y < h + SIDE; y++) for (let x = 0; x < w; x++) if (!face(x, y)) for (let d = 1; d <= SIDE; d++) if (face(x, y - d)) { px(b, x, y, d === 1 ? WOOD.side[0] : WOOD.side[1]); break; }
  const seam = Math.floor(h / 2);
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!face(x, y)) continue;
      const top = y < seam ? 0 : seam + 1;
      const bottom = y < seam ? seam - 1 : h - 1;
      const t = (y - top) / Math.max(1, bottom - top);
      let c = WOOD.face[Math.min(2, Math.floor(t * 3))];
      if (y === seam) c = WOOD.seam;
      else if (y === top || !face(x, y - 1)) c = WOOD.edge;
      else if (y === bottom || !face(x, y + 1)) c = WOOD.low;
      else if (!face(x - 1, y)) c = WOOD.edge;
      else if (!face(x + 1, y)) c = WOOD.low;
      px(b, x, y, c);
    }
  }
  // Grain: short streaks along each board, and a knot on each.
  for (const [top, bottom] of [[2, seam - 2], [seam + 2, h - 3]]) {
    for (let i = 0; i < Math.round(w / 9); i++) {
      const y = top + Math.floor(rnd() * (bottom - top + 1));
      const x0 = 3 + Math.floor(rnd() * (w - 12));
      const len = 4 + Math.floor(rnd() * 10);
      for (let x = x0; x < Math.min(w - 3, x0 + len); x++) if (face(x, y)) px(b, x, y, WOOD.grain);
    }
    const kx = 6 + Math.floor(rnd() * (w - 14));
    const ky = Math.round((top + bottom) / 2);
    for (const [dx, dy, c] of [[0, 0, WOOD.knot], [1, 0, WOOD.seam], [2, 0, WOOD.knot], [-1, 0, WOOD.grain], [3, 0, WOOD.grain], [1, -1, WOOD.grain], [1, 1, WOOD.grain]] as const) px(b, kx + dx, ky + dy, c);
  }
  // Nails at the ends of each board.
  for (const y of [Math.floor(seam / 2), seam + Math.ceil((h - seam) / 2)]) {
    for (const x of [3, w - 5]) {
      px(b, x, y - 1, WOOD.nail[0]);
      px(b, x + 1, y - 1, WOOD.nail[1]);
      px(b, x, y, WOOD.nail[1]);
      px(b, x + 1, y, WOOD.nail[2]);
    }
  }
  return outline(b, '#1a1326');
}

/** The words for the sign, in the logo's lettering (cream), each letter leaning a little its own way. */
function signWords(text: string): PixelBuf {
  const tilts = [-4, 3, -3, 4, -2, 3];
  const placed: Array<{ buf: PixelBuf; x: number; y: number }> = [];
  let x = 0;
  let n = 0;
  text.split(/\s+/).forEach((word) => {
    for (const ch of word) {
      const art = paintLetter(letterMask(ch, tilts[n++ % tilts.length]), CREAM);
      placed.push({ buf: art.buf, x: x - art.ox, y: -art.oy + Math.round((LOGO_H - art.h) / 2) });
      x += art.w - 1;
    }
    x += 7;
  });
  const x0 = Math.min(...placed.map((p) => p.x));
  const y0 = Math.min(...placed.map((p) => p.y));
  const out = blank(Math.max(...placed.map((p) => p.x + p.buf.w)) - x0, Math.max(...placed.map((p) => p.y + p.buf.h)) - y0);
  for (const p of placed) blit(out, p.buf, p.x - x0, p.y - y0);
  return out;
}

/** The whole title: the logo on its sticker, and the sign hung across its foot (art px). */
function titleArt(text: string): PixelBuf {
  const logo = titleLogo();
  const words = signWords(text);
  const padX = 9;
  const padY = 5;
  const sign = woodSign(words.w + padX * 2, words.h + padY * 2);
  blit(sign, words, 1 + padX, 1 + padY);
  const OVERLAP = 7;
  const w = Math.max(logo.w, sign.w);
  const out = blank(w, logo.h + sign.h - OVERLAP);
  blit(out, logo, Math.floor((w - logo.w) / 2), 0);
  const sx = Math.floor((w - sign.w) / 2);
  const sy = logo.h - OVERLAP;
  blit(out, sign, sx, sy);
  return out;
}

if (!label) {
  // The plain cover: the raccoon big in the frame (no text).
  drawHero((L.fig.x - heroAt.x + FEET.x) * PX, (L.fig.y - heroAt.y + FEET.y) * PX, PX);
} else {
  /** Who he faces (?foe=): the Orc Brute in green (it stands out on the orange sky), or Dumpgor the Demon. */
  const FOES: Record<string, { shape: EnemyShape; color: string; accent: string }> = {
    orc: { shape: 'orc', color: '#5f9a3a', accent: '#b3542a' },
    demon: { shape: 'bigDemon', color: '#c8323c', accent: '#ffd054' },
  };
  const foe = FOES[q.get('foe') ?? 'orc'] ?? FOES.orc;
  const foeArt = ENEMY_ART[foe.shape];
  const foeBuf = recolorEnemy(foe.shape, foe.color, foe.accent);
  const title = titleArt(label);
  /**
   * Per format: k = screen px per art px for the title (whole, so its pixels stay square), its middle
   * and top; p = screen px per game px for the two of them, and where each one's feet are.
   */
  const S = {
    land: { k: Math.floor(W / 320), tx: W / 2, ty: H * 0.02, p: W / 82, hero: { x: W * 0.105, y: H * 0.97 }, foe: { x: W * 0.84, y: H * 0.97 } },
    // (The tall tile has room to stand the foe further back, so the spatula doesn't cover his face.)
    port: { k: Math.floor(W / 155), tx: W / 2, ty: H * 0.04, p: W / 36, hero: { x: W * 0.28, y: H * 0.97 }, foe: { x: W * 0.7, y: H * 0.8 } },
    // (Side by side, just far enough apart that the blade stops short of his face.)
    square: { k: W >= 700 ? Math.floor(W / 190) : W / 190, tx: W / 2, ty: H * 0.03, p: W / 47, hero: { x: W * 0.185, y: H * 0.97 }, foe: { x: W * 0.77, y: H * 0.97 } },
  }[layout];
  const pf = S.p;
  // The foe first (behind), its feet on the same ground as his.
  groundShadow(S.foe.x, S.foe.y, (foeArt.feet.x + 2) * pf * 0.75, 1.1 * pf, pf);
  drawSprite(foeBuf, S.foe.x - (foeArt.feet.x + 0.5) * pf, S.foe.y - (foeArt.feet.y + 1) * pf, pf);
  drawHero(S.hero.x, S.hero.y, pf, 'back');
  // The title over the foe (in the tall tile his head goes behind its sign), then the raccoon in front.
  const k = S.k;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.shadowColor = 'rgba(40,10,10,0.5)';
  ctx.shadowBlur = k * 4;
  ctx.shadowOffsetY = k * 2;
  ctx.drawImage(cv(title), Math.round(S.tx - (title.w * k) / 2), Math.round(S.ty), title.w * k, title.h * k);
  ctx.restore();
  drawHero(S.hero.x, S.hero.y, pf, 'front');
}

(window as unknown as { __coverReady: boolean }).__coverReady = true;
