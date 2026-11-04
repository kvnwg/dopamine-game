// Records the raw scenes for the CrazyGames trailer from real gameplay, at the game's full 1080 x 1920.
//   node tools/crazygames/recordTrailer.mjs        (then: node tools/crazygames/editTrailer.mjs)
// Starts from a mid-game save made by the balance bot (trailerSave.ts) and uses the dev cheats only to
// set scenes up (which world, a forced Grail roll); everything on screen is the game.
//
// Frame-perfect: virtualTime.js takes over the page's clock (animation frames, timers, performance.now,
// Date, CSS animations), and every captured frame is exactly 1/30 s of game time, however slowly the
// headless browser renders. (Recording in real time gave 5-15 fps of real updates: a laggy video.)
// Writes crazygames/.trailer/<scene>.mp4 and marks.json (moments inside each scene, in seconds).
// Needs Playwright (npm i -D playwright && npx playwright install chromium), ffmpeg, and tsx (devDeps).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, startVite } from './renderCovers.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const OUT = path.join(ROOT, 'crazygames', '.trailer');
const FPS = 30;
const STEP = 1000 / FPS;
const VIEW = { width: 540, height: 960 }; // x2 device pixels = the 1080 x 1920 stage, 6 px per art pixel
const CLIP = { x: 0, y: 0, width: VIEW.width, height: VIEW.height, scale: 2 };

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
console.log('making the mid-game save (balance bot, about a minute)...');
const save = execFileSync('npx', ['tsx', 'tools/crazygames/trailerSave.ts'], { cwd: ROOT, maxBuffer: 64 << 20 }).toString();

const { chromium } = loadPlaywright();
const vite = await startVite();
const browser = await chromium.launch();
const allMarks = {};
try {
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.addInitScript({ path: fileURLToPath(new URL('./virtualTime.js', import.meta.url)) });
  await page.addInitScript((txt) => {
    const g = JSON.parse(txt);
    g.lastActiveAt = Date.now(); // no "while you were away" popup
    if (g.offline) g.offline.pending = null;
    localStorage.clear();
    localStorage.setItem('dumpster_legend_save', JSON.stringify(g));
  }, save);
  await page.goto(`${vite.base}/index.html?notitle`);
  await page.waitForTimeout(3000);
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => window.__vt.start()); // from here on, the game only moves when we step it

  const cheat = (c) => page.evaluate((c) => window.__dl.dispatch({ type: 'cheat', cheat: c }), c);
  const tab = (t) => page.evaluate((t) => window.__dl.ui.getState().setTab(t), t);
  const tap = () => page.mouse.click(VIEW.width / 2, VIEW.height / 2);
  /** One frame of game time; returns what the UI is showing. */
  const step = () =>
    page.evaluate((ms) => {
      window.__vt.step(ms);
      const u = window.__dl.ui.getState();
      return { charging: !!u.charging, celebrate: !!u.celebrate, afterBoss: !!u.afterBoss };
    }, STEP);
  const grab = async (file) => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, clip: CLIP });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
  };

  /** Off camera: run game time until `key` shows in the UI (or `seconds` pass). */
  const advance = async (seconds, key) => {
    for (let i = 0; i < seconds * FPS; i++) {
      const s = await step();
      if (key && s[key]) return true;
    }
    return !key;
  };
  /**
   * At this luck the reels find rare things on their own, and a rare find's full-screen reveal waits
   * for a tap. Between scenes (and in scenes that aren't about a reveal) tap them away.
   */
  const clearOverlays = async () => {
    for (let i = 0; i < 12; i++) {
      const s = await step();
      if (!s.charging && !s.celebrate) break;
      if (s.charging) await advance(6, 'celebrate');
      await tap();
      await advance(0.4);
    }
    await page.evaluate(() => window.__dl.ui.setState({ afterBoss: null, popup: null }));
  };
  const equipBest = async () => {
    await tab('bag');
    await advance(0.3);
    await page.getByRole('button', { name: /equip best/i }).first().click({ force: true });
  };

  /** Records one scene; `fn` drives it with r.run / r.until / r.mark. guard: tap away unasked-for reveals. */
  async function scene(name, fn, { guard = true } = {}) {
    await clearOverlays();
    const dir = path.join(OUT, `_${name}`);
    fs.mkdirSync(dir);
    let n = 0;
    const marks = {};
    const frame = async () => {
      const s = await step();
      if (guard && (s.charging || s.celebrate)) {
        if (marks.interrupt === undefined) marks.interrupt = n / FPS;
        if (s.celebrate) await tap();
      }
      await grab(path.join(dir, `f${String(n).padStart(5, '0')}.jpg`));
      n++;
      return s;
    };
    const r = {
      mark: (k) => (marks[k] = n / FPS),
      run: async (seconds) => {
        for (let i = 0; i < Math.round(seconds * FPS); i++) await frame();
      },
      until: async (key, seconds) => {
        for (let i = 0; i < seconds * FPS; i++) if ((await frame())[key]) return true;
        return false;
      },
    };
    await fn(r);
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg'),
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '12', '-pix_fmt', 'yuv420p', path.join(OUT, `${name}.mp4`),
    ]);
    fs.rmSync(dir, { recursive: true, force: true });
    marks.duration = n / FPS;
    allMarks[name] = marks;
    console.log(`${name}: ${marks.duration.toFixed(1)} s, marks ${JSON.stringify(marks)}`);
  }

  const world = (stage, seconds) => async (r) => {
    await cheat({ kind: 'setStage', stage });
    r.mark('go');
    await r.run(seconds);
  };

  // ---- the take ----
  await tab('alley');
  await scene('neon', world(6, 8)); // Neon Night Market: the fight, and the reels rolling under it
  await scene(
    'grail',
    async (r) => {
      await cheat({ kind: 'forceRarity', rarity: 'grail' });
      r.mark('go');
      if (await r.until('charging', 20)) r.mark('charge'); // the dumpster shakes and glows
      if (!(await r.until('celebrate', 20))) throw new Error('no reveal');
      r.mark('reveal'); // black beat, then the count-up through the tiers
      await r.run(7.4);
      r.mark('card'); // HOLY GRAIL!
      await r.run(2.4);
      await tap();
      await r.run(0.3);
    },
    { guard: false },
  );
  await scene('equip', async (r) => {
    await equipBest();
    r.mark('slam');
    await r.run(5);
    await tab('alley');
  });
  await scene('boss', async (r) => {
    await cheat({ kind: 'setStage', stage: 9 }); // Toxic Bayou
    await r.run(1.2);
    await cheat({ kind: 'skipToLastWave' });
    r.mark('boss');
    if (await r.until('afterBoss', 15)) r.mark('down');
    await r.run(2.5);
  });
  // Off camera: two more Grails, so he can stand in the late worlds.
  for (let i = 0; i < 2; i++) {
    await clearOverlays();
    await cheat({ kind: 'forceRarity', rarity: 'grail' });
    await advance(30, 'celebrate');
    await advance(7.5);
    await tap();
    await advance(0.5);
    await equipBest();
    await advance(3);
    await tab('alley');
  }
  await clearOverlays();
  await cheat({ kind: 'forceRarity', rarity: 'grail' });
  await advance(30, 'celebrate');
  await advance(7.5);
  await tap();
  await advance(0.5);
  await scene('equip2', async (r) => {
    await equipBest();
    r.mark('slam');
    await r.run(5);
    await tab('alley');
  });
  await scene('glacier', world(13, 4)); // Glacier Gulch
  await scene('cosmic', world(19, 4)); // Cosmic Compactor
  await scene('gardens', world(17, 4)); // Golden Gardens
  fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify(allMarks, null, 2));
  console.log(`scenes in ${path.relative(ROOT, OUT)}`);
} finally {
  await browser.close();
  await vite.close();
}
