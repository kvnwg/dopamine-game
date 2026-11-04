/**
 * CrazyGames store covers drawn from the game's own art: World 1's street and sky (titleArt), the
 * raccoon cheering, the dumpster with its lid blown off and rare finds bursting out of it in their
 * rarity colors. No text and no logo (the logo is its own image: raccoonMark.ts, renderLogo.ts).
 *
 * Everything is composed on a canvas of art pixels, then scaled up `k` times with no smoothing, so the
 * whole cover keeps square pixels. The raccoon and the finds use the game's Scale3x and Scale2x versions
 * (three and two times the art pixels at the same pixel size), as the reveal and showcase spots in the game do.
 */
import { titleArt, TITLE } from '../../src/render/titleScene';
import { fromRows, scale2x, scale3x, type PixelBuf } from '../../src/render/pixel/buf';
import { ITEM_SPRITES } from '../../src/render/pixel/items';
import { FX } from '../../src/render/pixel/ui';
import { FEET_ROW } from '../../src/render/pixel/sceneryTypes';
import { toCanvas } from '../../src/render/pixel';
import { rarityColor } from '../../src/render/art';
import type { Rarity } from '../../src/data';

const q = new URLSearchParams(location.search);
const W = Number(q.get('w')) || 1920;
const H = Number(q.get('h')) || 1080;
const K = Number(q.get('k')) || 6;
const AW = Math.round(W / K);
const AH = Math.round(H / K);
const layout = AW / AH > 1.3 ? 'land' : AW / AH < 0.8 ? 'port' : 'square';

const art = document.createElement('canvas');
art.width = AW;
art.height = AH;
const ctx = art.getContext('2d')!;
ctx.imageSmoothingEnabled = false;
const cv = (b: PixelBuf) => toCanvas(b, 1);

// Deterministic sprinkle positions.
let seed = 17;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

const A = titleArt('PLAY');
const dy = AH - TITLE.h; // bottoms aligned: the street sits at the bottom of every cover
const groundY = FEET_ROW + TITLE.drop + dy;

function tile(buf: PixelBuf, y: number, scroll: number) {
  const c = cv(buf);
  const start = -(((scroll % buf.w) + buf.w) % buf.w);
  for (let x = start; x < AW; x += buf.w) ctx.drawImage(c, x, y);
}

// ---- backdrop
tile(A.sky, dy, 0);
if (A.glow) ctx.drawImage(cv(A.glow.buf), Math.round(A.glow.x + (AW - TITLE.w) * (layout === 'land' ? 0.85 : 0.5)), A.glow.y + dy);
for (const cl of A.clouds) tile(cl.buf, cl.y + dy, cl.scroll0);
for (const name of ['far', 'mid', 'ground', 'fg'] as const) {
  const l = A.layers[name];
  tile(l.buf, l.y + dy, l.scroll0 + (layout === 'land' ? 40 : 0));
}

// ---- where things go (art px)
// hero / dump: centre x as a fraction of the width; burstUp: how far the finds fly (art px).
const P = {
  land: { hero: 0.29, dump: 0.7, burstUp: 70, spread: 1.35 },
  port: { hero: 0.26, dump: 0.64, burstUp: 62, spread: 1 },
  square: { hero: 0.21, dump: 0.64, burstUp: 52, spread: 1.15 },
}[layout];

// ---- the dumpster, lid blown off, light pouring out
const body = scale2x(fromRows(FX.dumpsterBody));
const dX = Math.min(AW - body.w + 4, Math.round(AW * P.dump - body.w / 2));
const dTop = groundY - body.h + 4;
const mouth = { x: dX + body.w / 2, y: dTop + 2 };

function glow(x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

// rays fanning up out of the dumpster
ctx.save();
ctx.beginPath();
ctx.rect(0, 0, AW, mouth.y);
ctx.clip();
for (let i = 0; i < 9; i++) {
  const a0 = Math.PI * (1.08 + i * 0.1);
  const a1 = a0 + 0.05;
  const R = AW * 1.2;
  ctx.globalAlpha = i % 2 ? 0.16 : 0.26;
  ctx.fillStyle = '#ffe48a';
  ctx.beginPath();
  ctx.moveTo(mouth.x, mouth.y);
  ctx.lineTo(mouth.x + Math.cos(a0) * R, mouth.y + Math.sin(a0) * R);
  ctx.lineTo(mouth.x + Math.cos(a1) * R, mouth.y + Math.sin(a1) * R);
  ctx.closePath();
  ctx.fill();
}
ctx.restore();
glow(mouth.x, mouth.y, 46, '#fff1b0', 0.9);

ctx.globalAlpha = 0.35;
ctx.fillStyle = '#000';
ctx.beginPath();
ctx.ellipse(dX + body.w / 2, groundY + 3, body.w * 0.48, 4, 0, 0, Math.PI * 2);
ctx.fill();
ctx.globalAlpha = 1;
ctx.drawImage(cv(body), dX, dTop);

// ---- the finds bursting out (Scale2x, each on a glow of its rarity color)
const finds: Array<[string, Rarity]> = [
  ['hat_unique_curb_crown', 'grail'],
  ['gloves_lobster_claws', 'mythic'],
  ['hat_traffic_cone', 'legendary'],
  ['weapon_plunger', 'epic'],
  ['shield_pizza_box', 'legendary'],
  ['ring_plastic_diamond', 'museum'],
];
const n = finds.length;
finds.forEach(([id, rarity], i) => {
  const rows = ITEM_SPRITES[id];
  if (!rows) return;
  const buf = scale2x(fromRows(rows));
  const t = n === 1 ? 0.5 : i / (n - 1);
  const ang = Math.PI * (1.12 + t * 0.76); // a fan above the mouth
  const reach = P.burstUp * (i % 2 ? 0.78 : 1);
  const x = Math.round(mouth.x + Math.cos(ang) * reach * P.spread - buf.w / 2);
  const y = Math.round(mouth.y + Math.sin(ang) * reach - buf.h / 2);
  glow(x + buf.w / 2, y + buf.h / 2, 24, rarityColor(rarity), 0.85);
  ctx.drawImage(cv(buf), x, y);
});

// sparkles and coins in the air
const sparkle = cv(fromRows(FX.sparkle));
const coin = cv(fromRows(FX.coin));
for (let i = 0; i < 14; i++) {
  const ang = Math.PI * (1.05 + rnd() * 0.9);
  const r = 18 + rnd() * P.burstUp * 1.25;
  const x = Math.round(mouth.x + Math.cos(ang) * r * P.spread);
  const y = Math.round(mouth.y + Math.sin(ang) * r);
  ctx.drawImage(i % 3 === 0 ? coin : sparkle, x, y);
}

// ---- the raccoon, cheering (arms up), Scale3x, in front of his dumpster
const heroBuf = scale3x(A.hero[Number(q.get('frame') ?? 14)]);
const hX = Math.max(-4, Math.round(AW * P.hero - heroBuf.w / 2));
ctx.globalAlpha = 0.35;
ctx.fillStyle = '#000';
ctx.beginPath();
ctx.ellipse(hX + heroBuf.w / 2, groundY + 2, 24, 4, 0, 0, Math.PI * 2);
ctx.fill();
ctx.globalAlpha = 1;
ctx.drawImage(cv(heroBuf), hX, groundY - heroBuf.h + 3);

// ---- vignette
const vg = ctx.createRadialGradient(AW / 2, AH * 0.55, Math.min(AW, AH) * 0.45, AW / 2, AH * 0.55, Math.hypot(AW, AH) * 0.62);
vg.addColorStop(0, 'rgba(0,0,0,0)');
vg.addColorStop(1, 'rgba(8,10,30,0.45)');
ctx.fillStyle = vg;
ctx.fillRect(0, 0, AW, AH);

// ---- scale up, crisp
const out = document.getElementById('c') as HTMLCanvasElement;
out.width = W;
out.height = H;
const o = out.getContext('2d')!;
o.imageSmoothingEnabled = false;
o.drawImage(art, 0, 0, W, H);
(window as unknown as { __coverReady: boolean }).__coverReady = true;
