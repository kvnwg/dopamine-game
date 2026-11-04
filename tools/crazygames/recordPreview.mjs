// Records the CrazyGames preview videos from real gameplay: a new game's first minute (title, PLAY,
// busting the padlock off the dumpster, the first rolls, the Traffic Cone's Legendary reveal, then Equip
// best putting it on the raccoon). The take follows the game's own UI state (window.__dl, dev server).
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

  // Moments of the take, on the screencast's own clock (seconds from its first frame).
  const marks = {};
  const mark = (name) => {
    marks[name] = frames.length ? frames[frames.length - 1].t - frames[0].t : 0;
  };
  const ui = () => page.evaluate(() => {
    const u = window.__dl?.ui?.getState?.();
    return { charging: !!u?.charging, celebrate: !!u?.celebrate };
  });
  const waitFor = async (key, ms) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      if ((await ui())[key]) return true;
      await sleep(60);
    }
    return false;
  };
  const click = async (locator) => {
    const box = await locator.first().boundingBox().catch(() => null);
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    return !!box;
  };

  // The script of the take, in real time: a brand-new player's first minute.
  await sleep(1400); // the title: the raccoon walking down his street
  mark('space');
  await page.keyboard.press('Space'); // PLAY
  await sleep(2300);
  mark('lock');
  await click(page.locator('[class*="_padlock_"]')); // bust the padlock off the dumpster
  if (!(await waitFor('charging', 40000))) throw new Error('the first big roll never started charging');
  mark('charge'); // warm-up rolls done: the dumpster shakes and glows for the Traffic Cone of Destiny
  if (!(await waitFor('celebrate', 15000))) throw new Error('the Legendary reveal never showed');
  await sleep(6600); // the black beat, the count-up, then the gold YOUR FIRST FIND! LEGENDARY! card
  await page.mouse.click(VIEW.width / 2, VIEW.height * 0.5);
  await sleep(450);
  await click(page.getByRole('button', { name: 'Bag' })); // the tutorial points at the Bag
  await sleep(500);
  await click(page.getByRole('button', { name: /equip best/i }));
  mark('equip'); // the cone flies onto him, his power counts up
  await sleep(4500);
  await cdp.send('Page.stopScreencast');
  await page.close();
  console.log('marks (s):', Object.entries(marks).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', '));

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
  return { master, marks, total: span };
}

/** Black moments in the take (the PLAY iris closing, the reveal's black beat), in seconds. */
function blackSpans(master) {
  const probe = spawnSync('ffmpeg', ['-hide_banner', '-i', master, '-vf', 'blackdetect=d=0.05:pix_th=0.1:pic_th=0.92', '-an', '-f', 'null', '-']);
  return [...probe.stderr.toString().matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => [Math.max(0, Number(m[1]) - 0.15), Number(m[2]) + 0.1]);
}

/**
 * What to keep: the title, the padlock breaking and the first warm-up roll, then (a plain cut, nothing
 * sped up) from just before the Traffic Cone's build-up to just after Equip best lands it on him, with
 * every black moment cut. If that runs long, less of the warm-up is kept; the ending always stays.
 */
function plan(marks, black, total) {
  const endAt = Math.min(total, marks.equip + 3.6);
  const len = (k) => k.reduce((sum, [a, b]) => sum + b - a, 0);
  const build = (afterLock) => {
    const remove = [[marks.lock + afterLock, marks.charge - 0.3], ...black].filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
    const kept = [];
    let cur = 0;
    for (const [a, b] of remove) {
      if (a > cur) kept.push([cur, Math.min(a, endAt)]);
      cur = Math.max(cur, b);
      if (cur >= endAt) break;
    }
    if (cur < endAt) kept.push([cur, endAt]);
    return kept.filter(([a, b]) => b - a > 0.05);
  };
  let afterLock = 3.4;
  let kept = build(afterLock);
  while (len(kept) > CLIP + 0.3 && afterLock > 1.6) kept = build((afterLock -= 0.2));
  const start = Math.max(0, len(kept) - CLIP);
  console.log(`keep: ${kept.map(([a, b]) => `${a.toFixed(2)}-${b.toFixed(2)}`).join(', ')} (${len(kept).toFixed(1)} s, start ${start.toFixed(2)})`);
  if (len(kept) - start < 13.5) console.warn('warning: the preview will be under 15 s; lengthen the take');
  return { kept, start };
}

function cut(master, kept, dir) {
  const keep = kept.map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`).join('+');
  const out = path.join(dir, 'cut.mp4');
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', master,
    '-vf', `select='${keep}',setpts=N/(${FPS}*TB)`,
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
  const { master, marks, total } = await record(browser, vite.base, tmp);
  const { kept, start } = plan(marks, blackSpans(master), total);
  const take = cut(master, kept, tmp);
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
} finally {
  await browser.close();
  await vite.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
