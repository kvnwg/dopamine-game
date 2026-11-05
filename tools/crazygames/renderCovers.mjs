// Renders the CrazyGames store covers and the logo from the game's own pixel art (tools/crazygames/cover.ts).
//   node tools/crazygames/renderCovers.mjs
// Needs Playwright with Chromium: npm i -D playwright && npx playwright install chromium
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const OUT = path.join(ROOT, 'crazygames', 'covers');

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

/** Renders one cover to `file` (also used for the preview videos' opening frames). */
export async function renderCover(browser, base, file, w, h, k) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('cover page error:', e.message));
  await page.goto(`${base}/tools/crazygames/cover.html?w=${w}&h=${h}&k=${k}`);
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
    for (const [name, w, h, k] of COVERS) {
      const file = path.join(OUT, name);
      await renderCover(browser, vite.base, file, w, h, k);
      console.log('wrote', path.relative(ROOT, file));
    }
    const logoDir = path.join(ROOT, 'crazygames', 'logo');
    fs.mkdirSync(logoDir, { recursive: true });
    for (const [name, w, h] of LOGOS) {
      const file = path.join(logoDir, name);
      await renderCover(browser, vite.base, file, w, h, 1);
      console.log('wrote', path.relative(ROOT, file));
    }
  } finally {
    await browser.close();
    await vite.close();
  }
}
