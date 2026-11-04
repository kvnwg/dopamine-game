// Cuts the CrazyGames trailer from the scenes recordTrailer.mjs captured: fast shots with punch-in zooms,
// impact shakes and white flashes, framed separately for 16:9 and 2:3, opening on the cover.
//   node tools/crazygames/editTrailer.mjs
// Writes crazygames/video/preview-landscape-1920x1080.mp4 and preview-portrait-1080x1620.mp4.
// CrazyGames rules kept: 15-20 s, silent, opens on the cover, no fast-forward (every shot plays at real
// speed), no black screens or black bars, no cursor, no "play now" text.
//
// The camera is done here, frame by frame: ffmpeg decodes each shot to raw RGB, this script crops the
// eased zoom with exact sub-pixel framing and samples it nearest-neighbour (the pixel art stays square),
// adds the shake and the flash, and pipes the frames back to ffmpeg. (ffmpeg's own scale+crop can't do
// this: its crop keeps the first frame's size while the zoom changes it, so the framing drifts.)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, renderCover, startVite } from './renderCovers.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SRC = path.join(ROOT, 'crazygames', '.trailer');
const OUT = path.join(ROOT, 'crazygames', 'video');
const FPS = 30;
const INTRO = 1.2;
const FADE = 0.45;
const SW = 1080; // the recording: the game's 1080 x 1920 stage
const SH = 1920;
const FLASH = 0.14; // seconds of white on a flash cut
const SHAKE_FOR = 0.35; // seconds an impact shake lasts

/** The edit: tools/crazygames/trailerShots.json (shots, cameras and landmarks are described there). */
const SHOTS = JSON.parse(fs.readFileSync(new URL('./trailerShots.json', import.meta.url), 'utf8')).shots;

const FORMATS = [
  { key: 'land', name: 'preview-landscape-1920x1080.mp4', w: 1920, h: 1080, k: 6 },
  { key: 'port', name: 'preview-portrait-1080x1620.mp4', w: 1080, h: 1620, k: 6 },
];

/** Where the camera looks at `t` seconds into a shot: the crop rectangle in stage pixels. */
export function cameraAt(shot, cam, OW, OH, t) {
  const [cx, cy] = cam.c;
  const [w0, w1] = cam.w;
  const zt = cam.zt ?? shot.d;
  const u = Math.min(t / zt, 1);
  const W = w0 + (w1 - w0) * (1 - Math.pow(1 - u, 3)); // ease out: a punch that settles
  const H = (W * OH) / OW;
  let sx = 0;
  let sy = 0;
  if (shot.shake && t < SHAKE_FOR) {
    const k = (1 - t / SHAKE_FOR) * shot.shake * (W / OW); // shake in output px
    sx = Math.sin(t * 73) * k;
    sy = Math.cos(t * 61) * k;
  }
  const x = Math.max(0, Math.min(SW - W, cx - W / 2 + sx));
  const y = Math.max(0, Math.min(SH - H, cy - H / 2 + sy));
  return { x, y, w: W, h: H };
}

function renderFrame(src, dst, OW, OH, r, flash) {
  const xs = new Int32Array(OW);
  for (let j = 0; j < OW; j++) xs[j] = Math.min(SW - 1, Math.floor(r.x + ((j + 0.5) * r.w) / OW)) * 3;
  for (let k = 0; k < OH; k++) {
    const row = Math.min(SH - 1, Math.floor(r.y + ((k + 0.5) * r.h) / OH)) * SW * 3;
    let o = k * OW * 3;
    if (flash > 0) {
      for (let j = 0; j < OW; j++, o += 3) {
        const p = row + xs[j];
        dst[o] = src[p] + (255 - src[p]) * flash;
        dst[o + 1] = src[p + 1] + (255 - src[p + 1]) * flash;
        dst[o + 2] = src[p + 2] + (255 - src[p + 2]) * flash;
      }
    } else {
      for (let j = 0; j < OW; j++, o += 3) {
        const p = row + xs[j];
        dst[o] = src[p];
        dst[o + 1] = src[p + 1];
        dst[o + 2] = src[p + 2];
      }
    }
  }
}

const write = (stream, buf) => new Promise((res) => (stream.write(buf) ? res() : stream.once('drain', res)));

/** Streams one shot's frames through the camera into the encoder. */
async function renderShot(shot, f, enc) {
  const frames = Math.round(shot.d * FPS);
  const dec = spawn('ffmpeg', [
    '-loglevel', 'error', '-ss', String(shot.t), '-i', path.join(SRC, `${shot.s}.mp4`),
    '-vf', `fps=${FPS}`, '-frames:v', String(frames), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-',
  ], { stdio: ['ignore', 'pipe', 'inherit'] });
  const size = SW * SH * 3;
  const src = Buffer.alloc(size);
  let have = 0;
  let n = 0;
  for await (const chunk of dec.stdout) {
    let off = 0;
    while (off < chunk.length) {
      const take = Math.min(size - have, chunk.length - off);
      chunk.copy(src, have, off, off + take);
      have += take;
      off += take;
      if (have === size) {
        const t = n / FPS;
        const dst = Buffer.alloc(f.w * f.h * 3);
        renderFrame(src, dst, f.w, f.h, cameraAt(shot, shot[f.key], f.w, f.h, t), shot.flash ? Math.max(0, 1 - t / FLASH) : 0);
        await write(enc.stdin, dst);
        have = 0;
        n++;
      }
    }
  }
  if (n < frames) console.warn(`  ${shot.s}@${shot.t}: only ${n}/${frames} frames`);
  return n;
}

const marks = JSON.parse(fs.readFileSync(path.join(SRC, 'marks.json'), 'utf8'));
for (const shot of SHOTS) {
  const m = marks[shot.s];
  if (!m) throw new Error(`no scene "${shot.s}": run recordTrailer.mjs first`);
  if (shot.t + shot.d > m.duration + 0.01) throw new Error(`shot ${shot.s}@${shot.t} runs past the scene (${m.duration.toFixed(2)} s)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tmp = path.join(SRC, '_edit');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = loadPlaywright();
  const vite = await startVite();
  const browser = await chromium.launch();
  try {
    for (const f of FORMATS) {
      const cut = path.join(tmp, `${f.key}-cut.mp4`);
      const enc = spawn('ffmpeg', [
        '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${f.w}x${f.h}`, '-r', String(FPS), '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', cut,
      ], { stdio: ['pipe', 'inherit', 'inherit'] });
      const done = new Promise((res, rej) => enc.on('close', (c) => (c === 0 ? res() : rej(new Error(`encoder exit ${c}`)))));
      let frames = 0;
      for (const shot of SHOTS) frames += await renderShot(shot, f, enc);
      enc.stdin.end();
      await done;

      const cover = path.join(tmp, `cover-${f.key}.png`);
      await renderCover(browser, vite.base, cover, f.w, f.h, f.k);
      const out = path.join(OUT, f.name);
      execFileSync('ffmpeg', [
        '-y', '-loglevel', 'error',
        '-loop', '1', '-framerate', String(FPS), '-t', String(INTRO), '-i', cover,
        '-i', cut,
        '-filter_complex',
        `[0:v]scale=${f.w}:${f.h},setsar=1,format=yuv420p,fps=${FPS},settb=AVTB[c];` +
          `[1:v]setsar=1,format=yuv420p,fps=${FPS},settb=AVTB[g];` +
          `[c][g]xfade=transition=fade:duration=${FADE}:offset=${INTRO - FADE},format=yuv420p[v]`,
        '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-r', String(FPS), '-movflags', '+faststart', out,
      ]);
      const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
      console.log(`wrote ${path.relative(ROOT, out)}: ${Number(dur).toFixed(1)} s, ${SHOTS.length} shots (${frames} frames), ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
    }
  } finally {
    await browser.close();
    await vite.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
