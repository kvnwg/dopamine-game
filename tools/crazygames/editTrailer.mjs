// Cuts the CrazyGames trailer from the scenes recordTrailer.mjs captured: fast shots with punch-in zooms,
// impact shakes and white flashes, framed separately for 16:9 and 2:3, opening on the cover.
//   node tools/crazygames/editTrailer.mjs
// Writes crazygames/video/preview-landscape-1920x1080.mp4 and preview-portrait-1080x1620.mp4.
// CrazyGames rules kept: 15-20 s, silent, opens on the cover, no fast-forward (every shot plays at real
// speed), no black screens or black bars, no cursor, no "play now" text.
//
// The camera is done here, frame by frame: ffmpeg decodes each shot to raw RGB, this script crops the
// eased zoom with exact sub-pixel framing and samples it bilinearly (the recording has 6 px per art
// pixel, so edges stay crisp while zooms glide without shimmer), adds the shake and the flash, and pipes
// the frames back to ffmpeg. A camera with an `h` shows a region taller than the output (the whole
// battle view, say) fitted into the frame over a blurred, darkened copy of itself instead of black bars.
// (ffmpeg's own scale+crop can't do this: its crop keeps the first frame's size while the zoom changes
// it, so the framing drifts.)
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
  const e = 1 - Math.pow(1 - u, 3); // ease out: a punch that settles
  const W = w0 + (w1 - w0) * e;
  const H = cam.h ? cam.h[0] + (cam.h[1] - cam.h[0]) * e : (W * OH) / OW;
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

/** Bilinear sample tables for `n` output pixels across [start, start + span) source pixels. */
function taps(n, start, span, limit) {
  const i0 = new Int32Array(n);
  const f = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const v = Math.max(0, Math.min(limit - 1.001, start + ((j + 0.5) * span) / n - 0.5));
    i0[j] = Math.floor(v);
    f[j] = v - i0[j];
  }
  return { i0, f };
}

/** Draws source rect `r` into dst at (ox, oy, dw, dh), bilinear. */
function blit(src, dst, OW, r, ox, oy, dw, dh, flash, dim = 1) {
  const X = taps(dw, r.x, r.w, SW);
  const Y = taps(dh, r.y, r.h, SH);
  const rowLen = SW * 3;
  for (let k = 0; k < dh; k++) {
    const y0 = Y.i0[k] * rowLen;
    const y1 = y0 + rowLen;
    const fy = Y.f[k];
    let o = ((oy + k) * OW + ox) * 3;
    for (let j = 0; j < dw; j++, o += 3) {
      const x0 = X.i0[j] * 3;
      const fx = X.f[j];
      for (let c = 0; c < 3; c++) {
        const a = src[y0 + x0 + c] + (src[y0 + x0 + 3 + c] - src[y0 + x0 + c]) * fx;
        const b = src[y1 + x0 + c] + (src[y1 + x0 + 3 + c] - src[y1 + x0 + c]) * fx;
        let v = (a + (b - a) * fy) * dim;
        if (flash > 0) v += (255 - v) * flash;
        dst[o + c] = v;
      }
    }
  }
}

/** A blurred, darkened backdrop: the area around `r` averaged down to a few dozen pixels, then stretched. */
function backdrop(src, dst, OW, OH, r) {
  const bw = 32;
  const bh = Math.max(2, Math.round((bw * OH) / OW));
  // The backdrop covers the output: widen (or heighten) the region to the output's aspect.
  let w = r.w;
  let h = r.h;
  if (w / h < OW / OH) w = (h * OW) / OH;
  else h = (w * OH) / OW;
  const x0 = Math.max(0, Math.min(SW - Math.min(w, SW), r.x + r.w / 2 - w / 2));
  const y0 = Math.max(0, Math.min(SH - Math.min(h, SH), r.y + r.h / 2 - h / 2));
  w = Math.min(w, SW);
  h = Math.min(h, SH);
  const small = new Float32Array(bw * bh * 3);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let sr = 0;
      let sg = 0;
      let sb = 0;
      for (let q = 0; q < 16; q++) {
        const sx = Math.min(SW - 1, Math.floor(x0 + ((bx + ((q % 4) + 0.5) / 4) * w) / bw));
        const sy = Math.min(SH - 1, Math.floor(y0 + ((by + (Math.floor(q / 4) + 0.5) / 4) * h) / bh));
        const p = (sy * SW + sx) * 3;
        sr += src[p];
        sg += src[p + 1];
        sb += src[p + 2];
      }
      const o = (by * bw + bx) * 3;
      small[o] = sr / 16;
      small[o + 1] = sg / 16;
      small[o + 2] = sb / 16;
    }
  }
  for (let k = 0; k < OH; k++) {
    const vy = Math.max(0, Math.min(bh - 1.001, ((k + 0.5) * bh) / OH - 0.5));
    const y0i = Math.floor(vy);
    const fy = vy - y0i;
    for (let j = 0; j < OW; j++) {
      const vx = Math.max(0, Math.min(bw - 1.001, ((j + 0.5) * bw) / OW - 0.5));
      const x0i = Math.floor(vx);
      const fx = vx - x0i;
      const p00 = (y0i * bw + x0i) * 3;
      const p10 = p00 + 3;
      const p01 = p00 + bw * 3;
      const p11 = p01 + 3;
      const o = (k * OW + j) * 3;
      for (let c = 0; c < 3; c++) {
        const a = small[p00 + c] + (small[p10 + c] - small[p00 + c]) * fx;
        const b = small[p01 + c] + (small[p11 + c] - small[p01 + c]) * fx;
        dst[o + c] = (a + (b - a) * fy) * 0.45;
      }
    }
  }
}

function renderFrame(src, dst, OW, OH, r, flash) {
  const s = Math.min(OW / r.w, OH / r.h);
  const dw = Math.min(OW, Math.round(r.w * s));
  const dh = Math.min(OH, Math.round(r.h * s));
  if (dw < OW - 1 || dh < OH - 1) {
    backdrop(src, dst, OW, OH, r);
    blit(src, dst, OW, r, Math.floor((OW - dw) / 2), Math.floor((OH - dh) / 2), dw, dh, flash);
  } else {
    blit(src, dst, OW, r, 0, 0, OW, OH, flash);
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

/** Decodes the one frame at `t` of a scene (raw RGB). */
function frameAt(scene, t) {
  return execFileSync('ffmpeg', ['-loglevel', 'error', '-ss', String(t), '-i', path.join(SRC, `${scene}.mp4`), '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 64 << 20 });
}

// --storyboard <land|port> <dir>: each shot's first and last frame as PNGs, rendered exactly as the video.
if (process.argv[2] === '--storyboard') {
  const f = FORMATS.find((x) => x.key === (process.argv[3] || 'land'));
  const dir = process.argv[4] || path.join(SRC, `storyboard-${f.key}`);
  fs.mkdirSync(dir, { recursive: true });
  SHOTS.forEach((shot, i) => {
    for (const [k, t] of [[0, 0], [1, shot.d - 1 / FPS]]) {
      const dst = Buffer.alloc(f.w * f.h * 3);
      renderFrame(frameAt(shot.s, shot.t + t), dst, f.w, f.h, cameraAt(shot, shot[f.key], f.w, f.h, t), 0);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${f.w}x${f.h}`, '-i', '-', '-frames:v', '1', path.join(dir, `${String(i).padStart(2, '0')}-${k}.png`)], { input: dst });
    }
  });
  console.log(`storyboard in ${dir}`);
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
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
        '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '20', '-pix_fmt', 'yuv420p',
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
