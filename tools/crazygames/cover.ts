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
 * With ?label=IDLE%20RPG, the words go in the free sky in the logo's own lettering (logoArt.ts, as the
 * loading screen shows it): the first word in DUMPSTER's glossy green, its letters tossed about, the
 * second in LEGEND's gold on a gentle arch, all on the logo's cream die-cut sticker so they read on the
 * orange sky. Kept clear of the raccoon, his spatula and the bottom of the tile (where CrazyGames lays
 * its own title).
 *   ?w=800&h=800 : the output size.
 */
import { TITLE } from '../../src/render/titleScene';
import { CLOUD_SCROLL0, LAYER_NAMES, layerRow, viewAtmo, worldArt, worldSeed } from '../../src/render/worldLook';
import { glowOverlay, paintClouds, paintSky } from '../../src/render/pixel/atmosphere';
import { DATA } from '../../src/data';
import { blank, blit, fromRows, type PixelBuf } from '../../src/render/pixel/buf';
import { composeHero } from '../../src/render/pixel/hero';
import { ITEM_SPRITES } from '../../src/render/pixel/items';
import { FX } from '../../src/render/pixel/ui';
import { toCanvas } from '../../src/render/pixel';
import { GOLD, GREEN, LOGO_H, letterMask, paintLetter, stickerOf } from '../../src/render/logoArt';

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

// ---- the label (?label=): words in the logo's lettering, on its sticker
const label = (q.get('label') ?? '').trim().toUpperCase();
if (label) {
  /** Tilts and bobs per letter: the first word tossed like DUMPSTER, the second arched like LEGEND. */
  const TOSS = [{ deg: -7, dy: 2 }, { deg: 6, dy: -1 }, { deg: -5, dy: 1 }, { deg: 7, dy: -2 }, { deg: -6, dy: 2 }];
  const ARCH = (i: number, n: number) => ({ deg: Math.round(((i - (n - 1) / 2) / Math.max(1, (n - 1) / 2)) * 5), dy: Math.round(Math.abs(i - (n - 1) / 2) * 1.5) });
  const placed: Array<{ buf: PixelBuf; x: number; y: number }> = [];
  let x = 0;
  label.split(/\s+/).forEach((word, wi) => {
    const chars = [...word];
    chars.forEach((ch, i) => {
      const plan = wi === 0 ? TOSS[i % TOSS.length] : ARCH(i, chars.length);
      const art = paintLetter(letterMask(ch, plan.deg), wi === 0 ? GREEN : GOLD);
      placed.push({ buf: art.buf, x: x - art.ox, y: plan.dy - art.oy + Math.round((LOGO_H - art.h) / 2) });
      x += art.w + (wi === 0 ? -1 : 0);
    });
    x += 7;
  });
  const x0 = Math.min(...placed.map((p) => p.x));
  const y0 = Math.min(...placed.map((p) => p.y));
  const words = blank(Math.max(...placed.map((p) => p.x + p.buf.w)) - x0, Math.max(...placed.map((p) => p.y + p.buf.h)) - y0);
  for (const p of placed) blit(words, p.buf, p.x - x0, p.y - y0);
  const sticker = stickerOf(words, 3);
  const art = blank(sticker.buf.w, sticker.buf.h);
  blit(art, sticker.buf, 0, 0);
  blit(art, words, sticker.pad, sticker.pad);
  // Where it goes, and how big (screen px per art px, whole numbers so its pixels stay square): the
  // sky to the raccoon's upper left (square, landscape), the top of the tall portrait, centered.
  const spot = {
    square: { k: Math.floor(W / 168), x: W * 0.05, y: H * 0.05, center: false },
    port: { k: Math.floor(W / 120), x: W / 2, y: H * 0.08, center: true },
    // (Smaller than the others' share: the wide tile's raccoon stands tall, his ears near the top.)
    land: { k: Math.floor(W / 300), x: W * 0.035, y: H * 0.05, center: false },
  }[layout];
  const lw = art.w * spot.k;
  const lh = art.h * spot.k;
  const lx = Math.round(spot.center ? spot.x - lw / 2 : spot.x);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.shadowColor = 'rgba(40,10,10,0.45)';
  ctx.shadowBlur = spot.k * 3;
  ctx.shadowOffsetY = spot.k * 1.5;
  // (Not turned as a whole: its letters lean on their own, and every pixel stays square.)
  ctx.drawImage(cv(art), lx, Math.round(spot.y), lw, lh);
  ctx.restore();
}

(window as unknown as { __coverReady: boolean }).__coverReady = true;
