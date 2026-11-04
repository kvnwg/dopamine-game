/**
 * Writes the loading screen and the phone apps' splash art from the game's own art (src/boot/bootArt.ts):
 *
 *   npm run boot-art
 *
 * - src/boot/boot.html: the loading screen fragment (index.html and the artifact page include it).
 * - Android: res/drawable-<density>/splash_icon.png, the raccoon the launch theme shows on the navy
 *   (styles.xml, all Android versions through androidx core-splashscreen).
 * - iOS: the Splash image set (2732 x 2732, shown aspect-filled: the logo stays in the middle).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { bootHtml, splashImage } from '../src/boot/bootArt';
import { encodePng } from '../src/boot/png';

const root = join(dirname(new URL(import.meta.url).pathname), '..');
const write = (rel: string, data: string | Buffer) => {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, data);
  console.log(`wrote ${rel} (${(data.length / 1024).toFixed(1)} KB)`);
};

write('src/boot/boot.html', bootHtml());

// Android 12+ splash icons are 288 x 288 dp, shown inside a 192 dp circle: the raccoon (24 x 24 art
// px, about 16 x 16 of him) at 6 dp per art pixel fills about 96 dp of it.
const DENSITIES: Array<[string, number]> = [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]];
for (const [name, k] of DENSITIES) {
  const size = Math.round(288 * k);
  const scale = Math.round(6 * k);
  write(`android/app/src/main/res/drawable-${name}/splash_icon.png`, encodePng(splashImage(size, size, { art: 'hero', scale, bg: null })));
}

// iOS: one 2732 px square, aspect-filled (a phone shows about its middle 1200 px across): the logo
// and the raccoon under it, about 770 px wide.
const ios = encodePng(splashImage(2732, 2732, { art: 'logo+hero', scale: 6 }));
for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) write(`ios/App/App/Assets.xcassets/Splash.imageset/${f}`, ios);
