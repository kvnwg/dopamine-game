/**
 * Turns WAVs into one of the game's recorded sounds:
 *   node tools/sounds.mjs <name> <in.wav> [<more.wav> ...] [--start <seconds>] [--last <seconds>] [--length <seconds>]
 * writes src/assets/sounds/<name>.mp3, which the game plays in place of the synthesized sound of that
 * name (src/services/audio.ts; the names are the ones on the sound list). Several inputs are layered,
 * all starting together. Silence is trimmed from both ends (and `--start` cuts that much more off the
 * front, for a sound that swells in after the moment it marks; `--last` keeps only its last seconds, for
 * a riser the game only plays the end of; `--length` keeps only its first seconds, faded out, for one beat
 * of a loop), the sound is resampled to 48 kHz, and
 * layers that add up past full scale are brought down to -1 dBFS. Needs ffmpeg.
 *
 * Its level in the game is separate (src/assets/sounds/levels.json): matched to the loudness of the
 * synthesized sound it replaces.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const at = args.indexOf('--start');
const start = at >= 0 ? Number(args.splice(at, 2)[1]) : 0;
const atLast = args.indexOf('--last');
const last = atLast >= 0 ? Number(args.splice(atLast, 2)[1]) : 0;
const atLength = args.indexOf('--length');
const length = atLength >= 0 ? Number(args.splice(atLength, 2)[1]) : 0;
const [name, ...inputs] = args;
if (!name || !/^[a-z0-9_]+$/.test(name) || inputs.length === 0 || !(start >= 0) || !(last >= 0) || !(length >= 0)) {
  console.error('Usage: node tools/sounds.mjs <name> <in.wav> [<more.wav> ...] [--start <seconds>] [--last <seconds>] [--length <seconds>]');
  process.exit(1);
}
const dir = 'src/assets/sounds';
const out = join(dir, `${name}.mp3`);
mkdirSync(dir, { recursive: true });

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg failed:\n${r.stderr}`);
  return r.stderr;
}

// Silence (under -70 dB) off the start, then off the end (reversed); then `--start` more, faded in over 5 ms.
const cut =
  (start > 0 ? `,atrim=start=${start},asetpts=PTS-STARTPTS,afade=t=in:d=0.005` : '') +
  (last > 0 ? `,areverse,atrim=end=${last},asetpts=PTS-STARTPTS,areverse,afade=t=in:d=0.02` : '') +
  (length > 0 ? `,atrim=end=${length},afade=t=out:st=${Math.max(0, length - 0.06)}:d=0.06` : '');
const trim = `silenceremove=start_periods=1:start_threshold=-70dB,areverse,silenceremove=start_periods=1:start_threshold=-70dB,areverse${cut}`;
const resampled = inputs.map((_, i) => `[${i}:a]aresample=48000[a${i}]`).join(';');
const layered =
  inputs.length === 1
    ? `${resampled};[a0]${trim}[m]`
    : `${resampled};${inputs.map((_, i) => `[a${i}]`).join('')}amix=inputs=${inputs.length}:normalize=0:duration=longest,${trim}[m]`;
const files = inputs.flatMap((f) => ['-i', f]);

// (astats reads float samples, so it sees a peak past full scale; volumedetect would clip it at 0 dB.)
const probe = ffmpeg([...files, '-filter_complex', `${layered};[m]astats=metadata=0`, '-f', 'null', '-']);
const peak = Math.max(...[...probe.matchAll(/Peak level dB: (-?[\d.]+|-?inf)/g)].map((m) => Number(m[1]) || -Infinity));
const gain = peak > -1 ? -1 - peak : 0;

ffmpeg(['-y', '-loglevel', 'error', ...files, '-filter_complex', `${layered};[m]volume=${gain.toFixed(2)}dB[o]`, '-map', '[o]',
  '-c:a', 'libmp3lame', '-q:a', '2', '-map_metadata', '-1', out]);

const info = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], { encoding: 'utf8' }).stdout.trim();
console.log(`${out}: ${Number(info).toFixed(2)} s, ${(statSync(out).size / 1024).toFixed(1)} KB${gain ? `, brought down ${(-gain).toFixed(1)} dB` : ''}`);
