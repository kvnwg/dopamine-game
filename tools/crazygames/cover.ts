/**
 * CrazyGames store covers and the logo, in the style of the store's tiles: the raccoon big in the frame,
 * all of him, his BBQ Spatula raised in his paw toward the top corner, over a soft, blurred view of the
 * town (World 1's sky, clouds and houses, as the title screen shows them), with a few flecks of light
 * and the game's sparkles on the blade. No text, no border.
 *
 * The raccoon (his cheer pose, frame 13, as the battle shows him: hero.ts composeHero) and the spatula
 * (the game's BBQ Spatula item art) are the game's own pixels, both at one big pixel size and never
 * smoothed. Only the background is soft.
 *   ?w=800&h=800 : the output size.
 */
import { titleArt, TITLE } from '../../src/render/titleScene';
import { blank, blit, fromRows, type PixelBuf } from '../../src/render/pixel/buf';
import { composeHero } from '../../src/render/pixel/hero';
import { ITEM_SPRITES } from '../../src/render/pixel/items';
import { FX } from '../../src/render/pixel/ui';
import { toCanvas } from '../../src/render/pixel';

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

// ---- the town behind, soft
const A = titleArt('PLAY');
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
tile(A.sky, 0, 0);
if (A.glow) sc.drawImage(cv(A.glow.buf), A.glow.x, A.glow.y);
for (const cl of A.clouds) tile(cl.buf, cl.y, cl.scroll0);
for (const name of ['far', 'mid', 'ground', 'fg'] as const) tile(A.layers[name].buf, A.layers[name].y, A.layers[name].scroll0);

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

// A deeper blue toward the edges, so he stands out.
{
  const g = ctx.createRadialGradient(W * 0.45, H * 0.55, Math.min(W, H) * 0.25, W * 0.45, H * 0.55, Math.hypot(W, H) * 0.65);
  g.addColorStop(0, 'rgba(20,60,140,0)');
  g.addColorStop(1, 'rgba(20,60,140,0.38)');
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

const P = PX;
const fx = (L.fig.x - heroAt.x) * P;
const fy = (L.fig.y - heroAt.y) * P;
// A light behind his head, then a soft shadow under the figure to lift it off the background.
{
  const hx = fx + (heroAt.x + 12) * P;
  const hy = fy + (heroAt.y + 10) * P;
  const r = 14 * P;
  const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
  g.addColorStop(0, 'rgba(255,250,225,0.55)');
  g.addColorStop(1, 'rgba(255,250,225,0)');
  ctx.fillStyle = g;
  ctx.fillRect(hx - r, hy - r, r * 2, r * 2);
}
// A soft shadow on the ground under his feet.
{
  const feet = { x: fx + (heroAt.x + 11.5) * P, y: fy + (heroAt.y + 19.7) * P };
  ctx.save();
  ctx.filter = `blur(${Math.round(P * 0.5)}px)`;
  ctx.fillStyle = 'rgba(15,30,45,0.4)';
  ctx.beginPath();
  ctx.ellipse(feet.x, feet.y, 7.5 * P, 1.1 * P, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
ctx.save();
ctx.imageSmoothingEnabled = false;
ctx.shadowColor = 'rgba(10,30,70,0.45)';
ctx.shadowBlur = P * 1.2;
ctx.shadowOffsetY = P * 0.35;
ctx.drawImage(cv(fig), fx, fy, fig.w * P, fig.h * P);
ctx.restore();

// The game's sparkles glinting on the spatula's blade.
{
  const sp = cv(fromRows(FX.sparkle));
  const blade = { x: fx + (spAt.x + 11) * P, y: fy + (spAt.y + 3) * P };
  ctx.imageSmoothingEnabled = false;
  for (const [dx, dy, s] of [[2.6, -3.2, 1], [-3.4, -1.6, 0.75], [4.2, 2.4, 0.6]] as const) {
    const size = sp.width * P * 0.5 * s;
    ctx.drawImage(sp, blade.x + dx * P - size / 2, blade.y + dy * P - size / 2, size, size);
  }
}

(window as unknown as { __coverReady: boolean }).__coverReady = true;
