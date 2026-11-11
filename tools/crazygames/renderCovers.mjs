// Renders the CrazyGames store covers and the logo from the game's own pixel art (tools/crazygames/cover.ts).
//   node tools/crazygames/renderCovers.mjs
// They're key art: the game's logo with LABEL ("IDLE RPG", Kevin's ask: the store won't let him change the
// game's name) on a wooden sign under it, the raccoon and an orc either side; the plain raccoon-only images
// go to no-text/ beside each set (COVER_LABEL= for those only).
// Needs Playwright with Chromium: npm i -D playwright && npx playwright install chromium
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const OUT = path.join(ROOT, 'crazygames', 'covers');

/** The words on the covers and the logo (an empty COVER_LABEL leaves them plain). */
export const LABEL = process.env.COVER_LABEL ?? 'IDLE RPG';

/** The logo: the square close-up on its own (crazygames/logo/), at the usual icon sizes. */
export const LOGOS = [
  ['logo-1024x1024.png', 1024, 1024],
  ['logo-800x800.png', 800, 800],
  ['logo-512x512.png', 512, 512],
];

// [file, width, height, screen px per art px]
export const COVERS = [
  ['cover-landscape-1920x1080.png', 1920, 1080, 6],
  ['cover-portrait-800x1200.png', 800, 1200, 5],
  ['cover-square-800x800.png', 800, 800, 4],
];

export function loadPlaywright() {
  try {
    return createRequire(import.meta.url)('playwright');
  } catch {
    console.error('\nThis needs Playwright:  npm i -D playwright && npx playwright install chromium\n');
    process.exit(1);
  }
}

/** Starts the Vite dev server on a free port; returns its base URL and a close(). */
export async function startVite() {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
  await server.listen();
  const { port } = server.httpServer.address();
  return { base: `http://127.0.0.1:${port}`, close: () => server.close() };
}

/** Renders one cover to `file`, with `label` on it if given (the preview videos' opening frames have none). */
export async function renderCover(browser, base, file, w, h, k, label = '') {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('cover page error:', e.message));
  await page.goto(`${base}/tools/crazygames/cover.html?w=${w}&h=${h}&k=${k}${label ? `&label=${encodeURIComponent(label)}` : ''}`);
  await page.waitForFunction(() => window.__coverReady === true, null, { timeout: 60000 });
  await page.locator('#c').screenshot({ path: file });
  await page.close();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { chromium } = loadPlaywright();
  fs.mkdirSync(OUT, { recursive: true });
  const vite = await startVite();
  const browser = await chromium.launch();
  try {
    const logoDir = path.join(ROOT, 'crazygames', 'logo');
    const sets = [
      ...COVERS.map(([name, w, h, k]) => [OUT, name, w, h, k]),
      ...LOGOS.map(([name, w, h]) => [logoDir, name, w, h, 1]),
    ];
    for (const [dir, name, w, h, k] of sets) {
      const plainDir = LABEL ? path.join(dir, 'no-text') : dir;
      fs.mkdirSync(plainDir, { recursive: true });
      const plain = path.join(plainDir, name);
      await renderCover(browser, vite.base, plain, w, h, k);
      console.log('wrote', path.relative(ROOT, plain));
      if (!LABEL) continue;
      const file = path.join(dir, name);
      await renderCover(browser, vite.base, file, w, h, k, LABEL);
      console.log('wrote', path.relative(ROOT, file), `("${LABEL}")`);
    }
  } finally {
    await browser.close();
    await vite.close();
  }
}
