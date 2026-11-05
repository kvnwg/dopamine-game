// Cuts the CrazyGames trailers from the scenes recordTrailer.mjs captured: the cover, then fast shots of
// real gameplay with eased push-ins, punch-in zooms on impacts and impact shakes, framed for each format.
//   node tools/crazygames/editTrailer.mjs [land|port]            render the trailer(s)
//   node tools/crazygames/editTrailer.mjs --storyboard land [dir]  each shot's first, middle and last frame
// Writes crazygames/video/preview-landscape-1920x1080.mp4 and preview-portrait-1080x1620.mp4.
// CrazyGames rules kept: 15-20 s, silent, opens on the cover, no fast-forward (every shot plays at real
// speed), no black screens or black bars, no cursor, no "play now" text.
//
// The edit is tools/crazygames/trailerShots.json. Cameras are in stage px (the game's own layout: the
// PC stage is 2160 x 960, the phone stage 1080 x 1920), whatever resolution the scenes were recorded at.
// The camera is done here, frame by frame: ffmpeg decodes each shot to raw RGB and this script resamples
// the camera's rectangle by area (each output pixel averages exactly the source it covers), so zooms glide
// without shimmer and pixel art stays crisp, then pipes the frames to the encoder.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, renderCover, startVite } from './renderCovers.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SRC = path.join(ROOT, 'crazygames', '.trailer');
const OUT = process.env.TRAILER_OUT || path.join(ROOT, 'crazygames', 'video');
const FPS = 30;

/** The edit (shots, cameras and landmarks are described in its "about"). */
const EDIT = JSON.parse(fs.readFileSync(process.env.TRAILER_EDIT || new URL('./trailerShots.json', import.meta.url), 'utf8'));

export const FORMATS = [
  { key: 'land', name: 'preview-landscape-1920x1080.mp4', w: 1920, h: 1080, k: 6 },
  { key: 'port', name: 'preview-portrait-1080x1620.mp4', w: 1080, h: 1620, k: 6 },
];

const ease = {
  linear: (u) => u,
  out: (u) => 1 - Math.pow(1 - u, 3),
  inout: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  in: (u) => u * u * u,
};

/** A punch-in's envelope at `dt` seconds after it hits: in over 3 frames, then easing back (or held). */
function punchEnv(p, dt) {
  const attack = p.attack ?? 0.1;
  if (dt < 0) return 0;
  if (dt < attack) return ease.out(dt / attack);
  if (p.hold) return 1;
  const rel = p.release ?? 0.45;
  return dt < attack + rel ? 1 - ease.inout((dt - attack) / rel) : 0;
}

/** Where the camera looks `t` seconds into a shot: a rectangle in stage px. */
export function cameraAt(shot, cam, f, stage, t) {
  const d = shot.d;
  const u = Math.min(1, Math.max(0, (t - (cam.from ?? 0)) / Math.max(1e-6, (cam.to ?? d) - (cam.from ?? 0))));
  const e = ease[cam.ease ?? 'out'](u);
  const [w0, w1] = cam.w ?? [cam.w0, cam.w0];
  const c0 = cam.c;
  const c1 = cam.c2 ?? cam.c;
  let W = w0 + (w1 - w0) * e;
  let cx = c0[0] + (c1[0] - c0[0]) * e;
  let cy = c0[1] + (c1[1] - c0[1]) * e;
  // Punch-ins: quick zooms toward the punch's centre (or the camera's) on an impact.
  for (const p of [...(shot.punch ?? []), ...(cam.punch ?? [])]) {
    const k = punchEnv(p, t - p.at);
    if (!k) continue;
    const z = 1 + (p.amt ?? 0.12) * k;
    const pc = p.c ?? [cx, cy];
    cx += (pc[0] - cx) * (1 - 1 / z);
    cy += (pc[1] - cy) * (1 - 1 / z);
    W /= z;
  }
  let H = (W * f.h) / f.w;
  // Impact shakes: a few px of output, dying away.
  for (const s of shot.shake ?? []) {
    const dt = t - s.at;
    const dur = s.dur ?? 0.3;
    if (dt < 0 || dt > dur) continue;
    const k = (1 - dt / dur) ** 2 * (s.amp ?? 12) * (W / f.w);
    cx += Math.sin(dt * 91 + 1) * k;
    cy += Math.cos(dt * 77) * k;
  }
  // Kept inside its box (the stage, or "battle": the battle view alone), zooming in if it must.
  const box = cam.box === 'battle' ? [0, 0, 1080, 960] : cam.box ?? [0, 0, stage[0], stage[1]];
  const bw = box[2] - box[0];
  const bh = box[3] - box[1];
  if (W > bw) {
    W = bw;
    H = (W * f.h) / f.w;
  }
  if (H > bh) {
    H = bh;
    W = (H * f.w) / f.h;
  }
  const x = Math.max(box[0], Math.min(box[2] - W, cx - W / 2));
  const y = Math.max(box[1], Math.min(box[3] - H, cy - H / 2));
  return { x, y, w: W, h: H };
}

/**
 * Area-resampling taps for `n` output pixels over source [start, start + span): each output pixel
 * averages exactly the source pixels its footprint covers (crisp for pixel art, smooth while zooming).
 */
function areaTaps(n, start, span, limit) {
  const s = span / n;
  const K = Math.ceil(s) + 2;
  const idx = new Int32Array(n * K);
  const wt = new Float32Array(n * K);
  for (let j = 0; j < n; j++) {
    const a = start + j * s;
    const b = a + s;
    let k = 0;
    for (let i = Math.floor(a); i < b && k < K; i++) {
      const w = (Math.min(b, i + 1) - Math.max(a, i)) / s;
      if (w <= 0) continue;
      idx[j * K + k] = Math.max(0, Math.min(limit - 1, i));
      wt[j * K + k] = w;
      k++;
    }
  }
  return { idx, wt, K };
}

/** Resamples source rect `r` (source px) of a SWxSH RGB frame into an OWxOH RGB buffer. */
export function resample(src, SW, SH, r, OW, OH, tmp) {
  const X = areaTaps(OW, r.x, r.w, SW);
  const Y = areaTaps(OH, r.y, r.h, SH);
  const y0 = Math.max(0, Math.floor(r.y));
  const y1 = Math.min(SH, Math.ceil(r.y + r.h) + 1);
  const rows = y1 - y0;
  // Pass 1: every source row the camera sees, to the output's width.
  for (let ry = 0; ry < rows; ry++) {
    const sr = (y0 + ry) * SW * 3;
    const tr = ry * OW * 3;
    for (let j = 0; j < OW; j++) {
      let a = 0;
      let b = 0;
      let c = 0;
      const base = j * X.K;
      for (let k = 0; k < X.K; k++) {
        const w = X.wt[base + k];
        if (!w) break;
        const p = sr + X.idx[base + k] * 3;
        a += src[p] * w;
        b += src[p + 1] * w;
        c += src[p + 2] * w;
      }
      const o = tr + j * 3;
      tmp[o] = a;
      tmp[o + 1] = b;
      tmp[o + 2] = c;
    }
  }
  // Pass 2: down the columns (accumulated in float, stored once: a Buffer store clamps and truncates).
  const dst = Buffer.alloc(OW * OH * 3);
  const acc = new Float32Array(OW * 3);
  for (let k = 0; k < OH; k++) {
    const base = k * Y.K;
    acc.fill(0);
    for (let q = 0; q < Y.K; q++) {
      const w = Y.wt[base + q];
      if (!w) break;
      const tr = (Y.idx[base + q] - y0) * OW * 3;
      for (let j = 0; j < OW * 3; j++) acc[j] += tmp[tr + j] * w;
    }
    const o = k * OW * 3;
    for (let j = 0; j < OW * 3; j++) dst[o + j] = acc[j] + 0.5;
  }
  return dst;
}

/** Brightens toward white by `a` (0..1). */
function flashOver(buf, a) {
  if (a <= 0) return;
  for (let i = 0; i < buf.length; i++) buf[i] = buf[i] + (255 - buf[i]) * a;
}

/** Blends `b` over `a` by `t` (0..1), into `a`. */
function blend(a, b, t) {
  for (let i = 0; i < a.length; i++) a[i] = a[i] + (b[i] - a[i]) * t;
}

const write = (stream, buf) => new Promise((res) => (stream.write(buf) ? res() : stream.once('drain', res)));

function loadMarks(key) {
  const p = path.join(SRC, key, 'marks.json');
  if (!fs.existsSync(p)) throw new Error(`no scenes for ${key}: run recordTrailer.mjs first`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** A mark's time in its scene: "reveal", "steps.2" (the third luck token popping out), or absent (0). */
function markTime(marks, scene, at) {
  if (!at) return 0;
  const [k, i] = at.split('.');
  const v = marks[scene]?.[k];
  const t = i !== undefined ? v?.[Number(i)] : v;
  if (typeof t !== 'number') throw new Error(`scene "${scene}" has no mark "${at}"`);
  return t;
}

/** The format's shots, with in points resolved against its marks. */
export function shotsFor(f) {
  const marks = loadMarks(f.key);
  // (A storyboard may run while scenes are still recording: PARTIAL=1 skips shots of missing scenes.)
  const shots = EDIT.shots
    .filter((s) => s[f.key] !== null && !(process.env.PARTIAL && !marks[s.s]))
    .map((s) => {
      const cam = s[f.key];
      if (!cam) throw new Error(`shot ${s.s}@${s.at ?? s.t} has no "${f.key}" camera`);
      const m = marks[s.s];
      if (!m) throw new Error(`no scene "${s.s}" for ${f.key}: run recordTrailer.mjs`);
      const d = cam.d ?? s.d;
      const t = markTime(marks, s.s, cam.at ?? s.at) + (cam.t ?? s.t ?? 0);
      if (t < 0 || t + d > m.duration + 0.01) throw new Error(`shot ${s.s}@${t.toFixed(2)}+${d} is outside the scene (${m.duration.toFixed(2)} s)`);
      if (m.ko !== undefined && t + d > m.ko - 0.2) console.warn(`  [${f.key}] shot ${s.s}@${t.toFixed(2)} runs into the knockout at ${m.ko.toFixed(2)} s`);
      return { ...s, d, t, cam };
    });
  return { shots, meta: marks._ };
}

/** Streams `n` frames of a scene from `t` as raw RGB, calling `fn(frame, i)` for each. */
async function eachFrame(file, t, n, size, fn) {
  const dec = spawn('ffmpeg', [
    '-loglevel', 'error', '-ss', Math.max(0, t - 0.004).toFixed(4), '-i', file,
    '-frames:v', String(n), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-',
  ], { stdio: ['ignore', 'pipe', 'inherit'] });
  const buf = Buffer.alloc(size);
  let have = 0;
  let i = 0;
  for await (const chunk of dec.stdout) {
    let off = 0;
    while (off < chunk.length) {
      const take = Math.min(size - have, chunk.length - off);
      chunk.copy(buf, have, off, off + take);
      have += take;
      off += take;
      if (have === size) {
        await fn(buf, i++);
        have = 0;
      }
    }
  }
  return i;
}

function probeSize(file) {
  const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file])
    .toString().trim().split(',').map(Number);
  return { w, h };
}

/** Renders a shot's frames (or only the frames at `pick`, shot-relative seconds) through its camera. */
async function renderShot(shot, f, meta, out, pick) {
  const file = path.join(SRC, f.key, `${shot.s}.mp4`);
  const { w: SW, h: SH } = probeSize(file);
  const px = SW / meta.stage[0];
  const frames = Math.round(shot.d * FPS);
  const want = pick ? new Set(pick.map((p) => Math.min(frames - 1, Math.round(p * FPS)))) : null;
  const last = want ? Math.max(...want) + 1 : frames;
  const tmp = new Float32Array(Math.ceil(SH + 2) * f.w * 3);
  const n = await eachFrame(file, shot.t, last, SW * SH * 3, async (src, i) => {
    if (want && !want.has(i)) return;
    const t = i / FPS;
    const r = cameraAt(shot, shot.cam, f, meta.stage, t);
    const dst = resample(src, SW, SH, { x: r.x * px, y: r.y * px, w: r.w * px, h: r.h * px }, f.w, f.h, tmp);
    for (const fl of shot.flash ?? []) {
      const dt = t - (fl.at ?? 0);
      const dur = fl.dur ?? 0.15;
      if (dt >= 0 && dt < dur) flashOver(dst, (fl.amt ?? 0.8) * (1 - dt / dur));
    }
    await out(dst, i, t);
  });
  if (n < last) console.warn(`  ${shot.s}@${shot.t.toFixed(2)}: only ${n}/${last} frames`);
  return n;
}

/** The cover as raw RGB at the output size, pushed in by `z` around its centre. */
function coverFrame(cover, f, z) {
  const w = f.w / z;
  const h = f.h / z;
  return resample(cover, f.w, f.h, { x: (f.w - w) / 2, y: (f.h - h) / 2, w, h }, f.w, f.h, new Float32Array((f.h + 2) * f.w * 3));
}

async function coverRaw(browser, base, f, dir) {
  const png = path.join(dir, `cover-${f.key}.png`);
  await renderCover(browser, base, png, f.w, f.h, f.k);
  return execFileSync('ffmpeg', ['-loglevel', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 64 << 20 });
}

/** The whole trailer for one format: the cover, its push and dissolve, then every shot. */
async function renderTrailer(f, browser, base, tmpDir) {
  const { shots, meta } = shotsFor(f);
  const intro = EDIT.intro ?? { hold: 0.6, fade: 0.3, push: 0.06 };
  const cover = await coverRaw(browser, base, f, tmpDir);
  const out = path.join(OUT, f.name);
  const enc = spawn('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${f.w}x${f.h}`, '-r', String(FPS), '-i', '-',
    '-an', '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => enc.on('close', (c) => (c === 0 ? res() : rej(new Error(`encoder exit ${c}`)))));
  let frames = 0;
  const introFrames = Math.round((intro.hold + intro.fade) * FPS);
  const holdFrames = Math.round(intro.hold * FPS);
  const zoomAt = (i) => 1 + intro.push * ease.in(Math.min(1, i / introFrames));
  // The cover alone (the first frame is the cover exactly), then the first shot dissolving in over it.
  for (let i = 0; i < holdFrames; i++, frames++) await write(enc.stdin, i === 0 ? cover : coverFrame(cover, f, zoomAt(i)));
  let si = 0;
  for (const shot of shots) {
    const t0 = Date.now();
    await renderShot(shot, f, meta, async (dst, i) => {
      if (si === 0 && i < introFrames - holdFrames) {
        const k = (i + 1) / (introFrames - holdFrames + 1);
        const c = coverFrame(cover, f, zoomAt(holdFrames + i));
        blend(c, dst, ease.inout(k));
        dst = c;
      }
      await write(enc.stdin, dst);
      frames++;
    });
    console.log(`  [${f.key}] ${String(si).padStart(2)} ${shot.s}@${shot.t.toFixed(2)} ${shot.d}s  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    si++;
  }
  enc.stdin.end();
  await done;
  const dur = frames / FPS;
  console.log(`wrote ${path.relative(ROOT, out)}: ${dur.toFixed(2)} s, ${shots.length} shots, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
  if (dur < 15 || dur > 20) console.warn(`  ${dur.toFixed(2)} s is outside CrazyGames' 15-20 s`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain && process.argv[2] === '--storyboard') {
  // Each shot's first, middle and last frame, exactly as the video renders them, plus one sheet.
  const f = FORMATS.find((x) => x.key === (process.argv[3] || 'land'));
  const dir = process.argv[4] || path.join(SRC, `storyboard-${f.key}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const { shots, meta } = shotsFor(f);
  let si = 0;
  for (const shot of shots) {
    const picks = [0, shot.d / 2, shot.d - 1 / FPS];
    let k = 0;
    await renderShot(shot, f, meta, async (dst) => {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${f.w}x${f.h}`, '-i', '-', '-frames:v', '1',
        path.join(dir, `${String(si).padStart(2, '0')}-${k++}.png`)], { input: dst });
    }, picks);
    si++;
  }
  const tw = f.key === 'land' ? 480 : 270;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-pattern_type', 'glob', '-i', path.join(dir, '*.png'),
    '-vf', `scale=${tw}:-1,tile=3x${shots.length}:padding=4:color=white`, '-frames:v', '1', path.join(dir, 'sheet.png')]);
  console.log(`storyboard in ${dir} (sheet.png: rows are shots; first, middle, last frame)`);
} else if (isMain) {
  const only = process.argv[2];
  fs.mkdirSync(OUT, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(SRC, '_edit-'));
  const { chromium } = loadPlaywright();
  const vite = await startVite();
  const browser = await chromium.launch();
  try {
    for (const f of FORMATS) if (!only || only === f.key) await renderTrailer(f, browser, vite.base, tmpDir);
  } finally {
    await browser.close();
    await vite.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
