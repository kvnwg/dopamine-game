/**
 * The game's logo as its own image: the raccoon's face raising his spatula in front of the town
 * (raccoonMark.ts), a square with no outline, scaled up by whole pixels.
 *   npx tsx tools/crazygames/renderLogo.ts   ->  crazygames/logo/logo-720x720.png  (needs ffmpeg)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MARK, raccoonMark } from './raccoonMark';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const n = 20;
const b = raccoonMark(n);
const out = path.join(ROOT, 'crazygames', 'logo', `logo-${MARK.size * n}x${MARK.size * n}.png`);
fs.mkdirSync(path.dirname(out), { recursive: true });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${b.w}x${b.h}`, '-i', '-', '-frames:v', '1', '-pix_fmt', 'rgb24', out], {
  input: Buffer.from(b.px.buffer, b.px.byteOffset, b.px.byteLength),
});
console.log(`wrote ${path.relative(ROOT, out)}`);
