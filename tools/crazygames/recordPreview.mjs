// Records the CrazyGames preview videos from real gameplay: a new game's first minute (title, PLAY,
// busting the padlock off the dumpster, the first roll's Legendary reveal, dragging it onto the raccoon).
//   node tools/crazygames/recordPreview.mjs
// Writes crazygames/video/preview-landscape-1920x1080.mp4 and preview-portrait-1080x1620.mp4.
// CrazyGames rules followed: 15-20 s, no sound, opens on the cover image, no fast-forward, no cursor,
// no black screens (the iris and the reveal's black beat are detected and cut), no black bars (the
// portrait game sits on a blurred copy of itself), no "play now" text.
// Needs Playwright (npm i -D playwright && npx playwright install chromium) and ffmpeg on PATH.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, renderCover, startVite } from './renderCovers.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const OUT = path.join(ROOT, 'crazygames', 'video');
const FPS = 30;
const INTRO = 1.2; // seconds on the cover
const FADE = 0.5;
const CLIP = 17.3; // seconds of gameplay → about 18 s in all
// Half the 1080 x 1920 stage: every art pixel is exactly 3 screen pixels, so a 2x nearest-neighbour
// upscale gives a pixel-perfect 1080 x 1920 picture.
const VIEW = { width: 540, height: 960 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function record(browser, base, dir) {
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.addInitScript(() => {
    try {
      localStorage.clear(); // a brand-new player
    } catch {}
  });
  await page.goto(`${base}/index.html`);
  await page.waitForTimeout(3000);

  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    frames.push({ t: metadata.timestamp, data });
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  // JPEG keeps the page running at full speed (PNG encoding slowed the drag down).
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: Number(process.env.PREVIEW_NTH ?? 1) });

  // The script of the take (real time).
  await sleep(1600); // the title: the raccoon walking down his street
  await page.keyboard.press('Space'); // PLAY
  await sleep(2300);
  const lock = await page.locator('[class*="_padlock_"]').first().boundingBox();
  if (lock) await page.mouse.click(lock.x + lock.width / 2, lock.y + lock.height / 2);
  await sleep(9000); // the reels roll, the black beat, the count-up, then the gold LEGENDARY card a while
  await page.mouse.click(VIEW.width / 2, VIEW.height * 0.5);
  await sleep(700);
  const tile = await page.locator('[class*="_grab_"]').first().boundingBox();
  if (tile) {
    // Drag the find up onto the raccoon (he stands left of centre in the battle view).
    const from = { x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 };
    const to = { x: VIEW.width * 0.29, y: VIEW.height * 0.39 };
    const dragAt = Date.now();
    // Raw input events, not awaited one by one: each awaited move waits on the busy headless
    // renderer (~200 ms), which made the drag crawl. Pipelined, it moves at the page's frame rate.
    const send = (type, p, buttons) =>
      cdp.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: type === 'mouseMoved' && !buttons ? 'none' : 'left', buttons, clickCount: 1 });
    await send('mouseMoved', from, 0);
    await send('mousePressed', from, 1);
    const moves = [];
    for (let i = 1; i <= 14; i++) {
      const k = i / 14;
      const e = k * k * (3 - 2 * k);
      moves.push(send('mouseMoved', { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e }, 1));
      await sleep(18);
    }
    await Promise.all(moves);
    await sleep(120);
    await send('mouseReleased', to, 0);
    console.log(`drag took ${Date.now() - dragAt} ms`);
  }
  await sleep(6000); // the slam onto him, his power counting up, the next spins
  await cdp.send('Page.stopScreencast');
  await page.close();

  // Frames → files + a concat list with each frame's real duration.
  const list = [];
  frames.forEach((f, i) => {
    const name = `f${String(i).padStart(5, '0')}.jpg`;
    fs.writeFileSync(path.join(dir, name), Buffer.from(f.data, 'base64'));
    const next = frames[i + 1];
    list.push(`file '${name}'`, `duration ${(next ? next.t - f.t : 1 / FPS).toFixed(4)}`);
  });
  list.push(`file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'`);
  fs.writeFileSync(path.join(dir, 'list.txt'), list.join('\n'));
  const span = frames.length ? frames[frames.length - 1].t - frames[0].t : 0;
  console.log(`captured ${frames.length} frames over ${span.toFixed(1)} s (${(frames.length / span).toFixed(0)} fps)`);

  // One clean 30 fps, 1080 x 1920 master.
  const master = path.join(dir, 'master.mp4');
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'),
    '-vf', `fps=${FPS},scale=1080:1920:flags=neighbor,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', master,
  ]);
  return master;
}

/**
 * The take with its black moments (the PLAY iris closing, the reveal's black beat) cut out, so the
 * preview never shows a black screen. Plain cuts: nothing is sped up.
 */
function cutBlack(master, dir) {
  const probe = spawnSync('ffmpeg', ['-hide_banner', '-i', master, '-vf', 'blackdetect=d=0.05:pix_th=0.1:pic_th=0.92', '-an', '-f', 'null', '-']);
  const log = probe.stderr.toString();
  const spans = [...log.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => [Math.max(0, Number(m[1]) - 0.15), Number(m[2]) + 0.1]);
  console.log('cut black:', spans.map(([a, b]) => `${a.toFixed(2)}-${b.toFixed(2)}s`).join(', ') || 'none');
  if (!spans.length) return master;
  const keep = spans.map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`).join('+');
  const out = path.join(dir, 'cut.mp4');
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', master,
    '-vf', `select='not(${keep})',setpts=N/(${FPS}*TB)`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-r', String(FPS), out,
  ]);
  return out;
}

/** The portrait game on a blurred, darkened copy of itself (no black bars), opening on the cover. */
function compose(master, cover, start, w, h, out) {
  const fg = `scale=-2:${h}:flags=lanczos`;
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-loop', '1', '-framerate', String(FPS), '-t', String(INTRO), '-i', cover,
    '-ss', String(start), '-t', String(CLIP), '-i', master,
    '-filter_complex',
    `[1:v]split[a][b];` +
      `[a]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=24:2,eq=brightness=-0.12:saturation=1.1[bg];` +
      `[b]${fg}[fg];[bg][fg]overlay=(W-w)/2:0,setsar=1,format=yuv420p,fps=${FPS},settb=AVTB[game];` +
      `[0:v]scale=${w}:${h},setsar=1,format=yuv420p,fps=${FPS},settb=AVTB[c];` +
      `[c][game]xfade=transition=fade:duration=${FADE}:offset=${INTRO - FADE},format=yuv420p[v]`,
    '-map', '[v]', '-an', '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
  ]);
}

const { chromium } = loadPlaywright();
fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-preview-'));
const vite = await startVite();
const browser = await chromium.launch();
try {
  // PREVIEW_MASTER=file reuses an earlier take (KEEP_MASTER=1 saves one) to re-cut without re-recording.
  const master = process.env.PREVIEW_MASTER || (await record(browser, vite.base, tmp));
  const take = cutBlack(master, tmp);
  const start = Number(process.env.PREVIEW_START ?? 0.3);
  for (const [name, w, h, k] of [
    ['preview-landscape-1920x1080.mp4', 1920, 1080, 6],
    ['preview-portrait-1080x1620.mp4', 1080, 1620, 6],
  ]) {
    const cover = path.join(tmp, `cover-${w}x${h}.png`);
    await renderCover(browser, vite.base, cover, w, h, k);
    const out = path.join(OUT, name);
    compose(take, cover, start, w, h, out);
    console.log(`wrote ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
  }
  if (process.env.KEEP_MASTER) fs.copyFileSync(master, path.join(OUT, 'master-1080x1920.mp4'));
} finally {
  await browser.close();
  await vite.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
