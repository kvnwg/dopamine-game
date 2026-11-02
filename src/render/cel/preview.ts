/**
 * Contact sheet + scene composite for eyeballing the cel art (tools/cel-preview.html).
 * Not part of the game bundle.
 */
import {
  type Rarity, type Slot, RACCOON_FRAME, bagSprite, cloudSprite, coinSprite, confetti, dumpsterBody, dumpsterLid,
  emptySlotIcon, enemySprite, farLayer, fgLayer, gearIcon, gearOverlay, groundLayer, impactStar, midLayer, puff,
  raccoonBody, raccoonPaw, sky, slashArc, sparkle, weaponSprite,
} from './index';

const RARITIES: Rarity[] = ['junk', 'decent', 'shiny', 'epic', 'legendary', 'mythic', 'mint'];
const SLOTS: Slot[] = ['hat', 'mask', 'jacket', 'weapon', 'shield', 'gloves', 'sneakers', 'backpack', 'bling', 'ring'];
const WEARABLE: Array<Exclude<Slot, 'weapon'>> = ['hat', 'mask', 'jacket', 'shield', 'gloves', 'sneakers', 'backpack', 'bling', 'ring'];
const FRONT_ORDER: Array<Exclude<Slot, 'weapon'>> = ['sneakers', 'jacket', 'bling', 'shield', 'gloves', 'ring', 'mask', 'hat'];

const ENEMIES: Array<{ shape: 'rat' | 'pigeon' | 'raccoon' | 'ratKing' | 'raccoonBoss' | 'officer'; S: number; color: string; accent: string }> = [
  { shape: 'rat', S: 110, color: '#7A6A72', accent: '#D9A1AE' },
  { shape: 'pigeon', S: 105, color: '#8E9AAF', accent: '#5FB49C' },
  { shape: 'raccoon', S: 150, color: '#77707F', accent: '#E53935' },
  { shape: 'ratKing', S: 260, color: '#6A5A62', accent: '#C49A6C' },
  { shape: 'raccoonBoss', S: 270, color: '#6E6878', accent: '#7E57C2' },
  { shape: 'officer', S: 320, color: '#2B4C7E', accent: '#F2C14E' },
];

const memo = new Map<string, HTMLCanvasElement>();
function m(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
  let c = memo.get(key);
  if (!c) {
    c = make();
    memo.set(key, c);
  }
  return c;
}

const body = raccoonBody();
const paw = raccoonPaw();

function drawHero(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, gear: Partial<Record<Slot, Rarity>>, weapon: Rarity | null, tilt: number): void {
  const F = RACCOON_FRAME;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-F.feet.x, -F.feet.y);
  if (gear.backpack) ctx.drawImage(m(`o_backpack_${gear.backpack}`, () => gearOverlay('backpack', gear.backpack!)), 0, 0);
  ctx.drawImage(body, 0, 0);
  for (const s of FRONT_ORDER) {
    const r = gear[s];
    if (r) ctx.drawImage(m(`o_${s}_${r}`, () => gearOverlay(s, r)), 0, 0);
  }
  const w = weaponSprite(weapon);
  ctx.save();
  ctx.translate(F.hand.x, F.hand.y);
  ctx.rotate(tilt);
  ctx.drawImage(w.canvas, -w.grip.x, -w.grip.y);
  ctx.restore();
  ctx.drawImage(paw.canvas, F.hand.x - paw.center.x, F.hand.y - paw.center.y);
  ctx.restore();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.save();
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = '#2E2523';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(60,45,30,0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y, w, w * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function buildSheet(): void {
  const sheet = document.getElementById('sheet') as HTMLCanvasElement;
  const W = 2200;
  sheet.width = W;
  sheet.height = 4590;
  const ctx = sheet.getContext('2d')!;
  ctx.fillStyle = '#EEF1F4';
  ctx.fillRect(0, 0, W, sheet.height);
  let y = 10;

  // --- hero parts
  label(ctx, 'Hero: body | body+paw+weapon (25 deg) | weapons null..mint | paw', 16, y + 24);
  y += 34;
  ctx.fillStyle = '#D8C99B';
  ctx.fillRect(0, y, W, 380);
  ctx.drawImage(body, 0, y + 10);
  drawHero(ctx, 360 + 160, y + 10 + 344, 1, {}, 'decent', (25 * Math.PI) / 180);
  let wx = 740;
  for (const r of [null, ...RARITIES] as Array<Rarity | null>) {
    const w = weaponSprite(r);
    ctx.drawImage(w.canvas, wx, y + 50);
    ctx.fillStyle = 'rgba(255,0,0,0.8)';
    ctx.fillRect(wx + w.grip.x - 2, y + 50 + w.grip.y - 2, 4, 4);
    wx += 128;
  }
  ctx.drawImage(paw.canvas, wx + 10, y + 160);
  y += 390;

  // --- swing angles
  label(ctx, 'Weapon swing angles: -40 -20 0 +20 +40 +70 +100 deg (legendary)', 16, y + 24);
  y += 34;
  ctx.fillStyle = '#D8C99B';
  ctx.fillRect(0, y, W, 300);
  [-40, -20, 0, 20, 40, 70, 100].forEach((deg, i) => {
    drawHero(ctx, 150 + i * 290, y + 280, 0.78, {}, 'legendary', (deg * Math.PI) / 180);
  });
  y += 310;

  // --- one overlay at a time (shiny), on the body
  label(ctx, 'Overlays one at a time (shiny), plus overlay alone on gray', 16, y + 24);
  y += 34;
  ctx.fillStyle = '#D8C99B';
  ctx.fillRect(0, y, W, 520);
  WEARABLE.forEach((s, i) => {
    const x = 20 + i * 240;
    drawHero(ctx, x + 115, y + 250, 0.66, { [s]: 'shiny' }, null, 0.4);
    ctx.fillStyle = '#B9C2CC';
    ctx.fillRect(x, y + 270, 238, 238);
    ctx.drawImage(gearOverlay(s, 'shiny'), x, y + 270, 238, 238);
    label(ctx, s, x + 6, y + 296);
  });
  y += 530;

  // --- full gear per rarity
  label(ctx, 'Full gear per rarity (weapon tilted 25 deg)', 16, y + 24);
  y += 34;
  ctx.fillStyle = '#D8C99B';
  ctx.fillRect(0, y, W, 420);
  RARITIES.forEach((r, i) => {
    const gear: Partial<Record<Slot, Rarity>> = {};
    for (const s of WEARABLE) gear[s] = r;
    drawHero(ctx, 150 + i * 300, y + 395, 1, gear, r, (25 * Math.PI) / 180);
    label(ctx, r, 100 + i * 300, y + 412);
  });
  y += 430;

  // --- enemies
  label(ctx, 'Enemies (feet marked red)', 16, y + 24);
  y += 34;
  ctx.fillStyle = '#D8C99B';
  ctx.fillRect(0, y, W, 440);
  let ex = 30;
  for (const e of ENEMIES) {
    const sp = enemySprite(e.shape, e.S, e.color, e.accent);
    const fy = y + 420;
    shadow(ctx, ex + sp.feet.x, fy, e.S * 0.32);
    ctx.drawImage(sp.canvas, ex, fy - sp.feet.y);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.strokeRect(ex + 0.5, fy - sp.feet.y + 0.5, sp.canvas.width, sp.canvas.height);
    ctx.fillStyle = 'red';
    ctx.fillRect(ex + sp.feet.x - 3, fy - 3, 6, 6);
    ex += sp.canvas.width + 20;
  }
  y += 450;

  // --- tiles, each drawn twice at half size so the seam is in the middle
  label(ctx, 'Tiles x2 at 50% (seam at center): far, mid, ground, fg', 16, y + 24);
  y += 34;
  const tiles: Array<[HTMLCanvasElement, string]> = [
    [m('far', farLayer), '#35C6F7'],
    [m('mid', midLayer), '#35C6F7'],
    [m('ground', groundLayer), '#35C6F7'],
    [m('fg', fgLayer), '#C9D3DC'],
  ];
  for (const [t, bg] of tiles) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, y, 2048, t.height / 2);
    ctx.drawImage(t, 0, y, 1024, t.height / 2);
    ctx.drawImage(t, 1024, y, 1024, t.height / 2);
    ctx.fillStyle = 'rgba(255,0,0,0.6)';
    ctx.fillRect(1023, y, 2, 8);
    y += t.height / 2 + 8;
  }
  y += 10;

  // --- sky, clouds, fx
  label(ctx, 'Sky (50%), clouds, FX, pickups, dumpster', 16, y + 24);
  y += 34;
  ctx.drawImage(sky(1080, 768), 0, y, 540, 384);
  ctx.fillStyle = '#35C6F7';
  ctx.fillRect(560, y, 1100, 180);
  let cx = 570;
  for (let i = 0; i < 3; i++) {
    const cl = cloudSprite(i);
    ctx.drawImage(cl, cx, y + 5);
    cx += cl.width + 10;
  }
  const fxRow = y + 200;
  ctx.fillStyle = '#7A8A9A';
  ctx.fillRect(560, fxRow, 1100, 310);
  ctx.drawImage(slashArc(), 570, fxRow + 5);
  ctx.drawImage(impactStar(), 880, fxRow + 20);
  ctx.drawImage(puff(), 1030, fxRow + 20);
  ctx.drawImage(sparkle(), 1120, fxRow + 30);
  ctx.drawImage(coinSprite(), 1170, fxRow + 30);
  ctx.drawImage(bagSprite(), 1230, fxRow + 20);
  let kx = 1310;
  for (const k of [0, 1, 2, 3] as const) {
    const cf = confetti(k);
    ctx.drawImage(cf, kx, fxRow + 30);
    kx += cf.width + 12;
  }
  ctx.fillStyle = '#D8C99B';
  ctx.fillRect(880, fxRow + 170, 400, 130);
  ctx.drawImage(slashArc(), 880, fxRow + 170, 130, 130);
  ctx.drawImage(impactStar(), 1020, fxRow + 190);
  ctx.drawImage(puff(), 1170, fxRow + 200);
  ctx.fillStyle = '#5B3B6E';
  ctx.fillRect(1680, y, 520, 520);
  ctx.drawImage(dumpsterLid(), 1690, y + 20, 500, 500 * (110 / 680));
  ctx.drawImage(dumpsterBody(), 1700, y + 110, 480, 300);
  ctx.drawImage(dumpsterBody(), 1700, y + 420, 160, 100);
  y += 530;

  // --- icons
  label(ctx, 'Icons 96px: rows = slots, cols = rarities; last col = empty slot', 16, y + 24);
  y += 34;
  SLOTS.forEach((s, row) => {
    RARITIES.forEach((r, col) => {
      const x = 20 + col * 110;
      ctx.fillStyle = col % 2 ? '#DDE3EA' : '#F7F2E6';
      ctx.fillRect(x, y + row * 104, 104, 100);
      ctx.drawImage(gearIcon(s, r, 96), x + 4, y + row * 104 + 2);
    });
    const ex2 = 20 + 7 * 110;
    ctx.fillStyle = '#F7F2E6';
    ctx.fillRect(ex2, y + row * 104, 104, 100);
    ctx.drawImage(emptySlotIcon(s, 96), ex2 + 4, y + row * 104 + 2);
    ctx.fillStyle = '#2B2F3A';
    ctx.fillRect(ex2 + 110, y + row * 104, 104, 100);
    ctx.drawImage(emptySlotIcon(s, 96), ex2 + 114, y + row * 104 + 2);
    label(ctx, s, ex2 + 230, y + row * 104 + 56);
  });
  // small icon sizes
  SLOTS.forEach((s, i) => {
    ctx.fillStyle = '#F7F2E6';
    ctx.fillRect(1300 + (i % 5) * 70, y + Math.floor(i / 5) * 70, 64, 64);
    ctx.drawImage(gearIcon(s, 'legendary', 56), 1304 + (i % 5) * 70, y + 4 + Math.floor(i / 5) * 70);
  });
  RARITIES.forEach((r, i) => {
    ctx.fillStyle = '#DDE3EA';
    ctx.fillRect(1300 + i * 54, y + 160, 50, 50);
    ctx.drawImage(gearIcon('hat', r, 44), 1303 + i * 54, y + 163);
  });
  y += 10 * 104 + 10;
  if (y > sheet.height) console.warn(`sheet needs ${y}px`);
}

function sceneCanvas(fx: boolean, boss = false): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 768;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(sky(1080, 768), 0, 0);
  ctx.drawImage(cloudSprite(0), 60, 34);
  ctx.drawImage(cloudSprite(1), 520, 70);
  ctx.drawImage(cloudSprite(2), 900, 14);
  const far = m('far', farLayer);
  const mid = m('mid', midLayer);
  const ground = m('ground', groundLayer);
  const fg = m('fg', fgLayer);
  // road top at 552; mid bottom = road top; far bottom tucked behind the mid grass
  ctx.drawImage(far, -260, 150);
  ctx.drawImage(far, -260 + 2048, 150);
  ctx.drawImage(mid, -40, 172);
  ctx.drawImage(mid, -40 + 2048, 172);
  ctx.drawImage(ground, -500, 528);
  ctx.drawImage(ground, -500 + 2048, 528);
  shadow(ctx, 300, 652, 58);
  if (boss) {
    drawHero(ctx, 300, 652, 1, { hat: 'legendary', jacket: 'epic', sneakers: 'shiny', bling: 'mythic' }, 'legendary', (30 * Math.PI) / 180);
    const dale = enemySprite('officer', 320, '#2B4C7E', '#F2C14E');
    shadow(ctx, 860, 652, 90);
    ctx.drawImage(dale.canvas, 860 - dale.feet.x, 652 - dale.feet.y);
    ctx.drawImage(fg, -300, 648);
    ctx.drawImage(fg, -300 + 2048, 648);
    return c;
  }
  drawHero(ctx, 300, 652, 1, { hat: 'shiny' }, 'decent', (25 * Math.PI) / 180);
  const rat = enemySprite('rat', 110, '#7A6A72', '#D9A1AE');
  shadow(ctx, 690, 652, 36);
  ctx.drawImage(rat.canvas, 690 - rat.feet.x, 652 - rat.feet.y);
  const punk = enemySprite('raccoon', 150, '#77707F', '#E53935');
  shadow(ctx, 880, 652, 48);
  ctx.drawImage(punk.canvas, 880 - punk.feet.x, 652 - punk.feet.y);
  if (fx) {
    ctx.drawImage(slashArc(), 560, 450);
    ctx.drawImage(impactStar(), 640, 530);
    ctx.drawImage(puff(), 720, 520);
    ctx.drawImage(coinSprite(), 610, 470);
    ctx.drawImage(coinSprite(), 760, 470);
    ctx.drawImage(bagSprite(), 820, 560);
  }
  ctx.drawImage(fg, -700, 648);
  ctx.drawImage(fg, -700 + 2048, 648);
  return c;
}

function buildFx(): void {
  const f = document.getElementById('fx') as HTMLCanvasElement;
  f.width = 1240;
  f.height = 340;
  const ctx = f.getContext('2d')!;
  ctx.fillStyle = '#D8C99B';
  ctx.fillRect(0, 0, 620, 340);
  ctx.fillStyle = '#35C6F7';
  ctx.fillRect(620, 0, 620, 340);
  ctx.drawImage(slashArc(), 10, 20);
  ctx.drawImage(impactStar(), 320, 30);
  ctx.drawImage(puff(), 470, 40);
  ctx.drawImage(sparkle(), 560, 50);
  ctx.drawImage(coinSprite(), 330, 200);
  ctx.drawImage(bagSprite(), 390, 190);
  let kx = 470;
  for (const k of [0, 1, 2, 3] as const) {
    const cf = confetti(k);
    ctx.drawImage(cf, kx, 210);
    kx += cf.width + 8;
  }
  ctx.drawImage(slashArc(), 630, 20);
  ctx.drawImage(impactStar(), 940, 30);
  ctx.drawImage(puff(), 1090, 40);
  ctx.drawImage(sparkle(), 1180, 50);
}

function buildFull(): void {
  const put = (id: string, src: HTMLCanvasElement, bg: string) => {
    const el = document.getElementById(id) as HTMLCanvasElement | null;
    if (!el) return;
    el.width = src.width;
    el.height = src.height;
    const ctx = el.getContext('2d')!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, el.width, el.height);
    ctx.drawImage(src, 0, 0);
  };
  put('tfar', m('far', farLayer), '#35C6F7');
  put('tmid', m('mid', midLayer), '#35C6F7');
  put('tground', m('ground', groundLayer), '#35C6F7');
  put('tfg', m('fg', fgLayer), '#C9D3DC');
  const d = document.createElement('canvas');
  d.width = 700;
  d.height = 560;
  const dc = d.getContext('2d')!;
  dc.drawImage(dumpsterLid(), 10, 10);
  dc.drawImage(dumpsterBody(), 30, 140);
  put('tdump', d, '#5B3B6E');
}

function buildScenes(): void {
  for (const [id, fx, boss] of [['scene', false, false], ['scenefx', true, false], ['sceneboss', false, true]] as const) {
    const s = document.getElementById(id) as HTMLCanvasElement;
    const sc = sceneCanvas(fx, boss);
    s.width = sc.width;
    s.height = sc.height;
    s.getContext('2d')!.drawImage(sc, 0, 0);
  }
  const ph = document.getElementById('phone') as HTMLCanvasElement;
  ph.width = 400;
  ph.height = Math.round(768 * (400 / 1080));
  const pctx = ph.getContext('2d')!;
  pctx.imageSmoothingQuality = 'high';
  pctx.drawImage(document.getElementById('scenefx') as HTMLCanvasElement, 0, 0, ph.width, ph.height);
  const ph2 = document.getElementById('phone2') as HTMLCanvasElement;
  ph2.width = 400;
  ph2.height = Math.round(768 * (400 / 1080));
  const p2 = ph2.getContext('2d')!;
  p2.imageSmoothingQuality = 'high';
  p2.drawImage(document.getElementById('scene') as HTMLCanvasElement, 0, 0, ph2.width, ph2.height);
}

try {
  const t0 = performance.now();
  buildSheet();
  buildFx();
  buildFull();
  buildScenes();
  document.title = 'ready';
  console.log(`cel preview built in ${Math.round(performance.now() - t0)} ms`);
} catch (e) {
  document.title = `error: ${(e as Error).message}`;
  throw e;
}
