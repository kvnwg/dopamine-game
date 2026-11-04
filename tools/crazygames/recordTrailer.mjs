// Records the raw scenes for the CrazyGames trailer from real gameplay, at the game's full 1080 x 1920.
//   node tools/crazygames/recordTrailer.mjs        (then: node tools/crazygames/editTrailer.mjs)
// Starts from a mid-game save made by the balance bot (trailerSave.ts) and uses the dev cheats only to
// set scenes up (which world, a forced roll, a luck token chain); everything on screen is the game.
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
const VIEW = { width: 540, height: 960 }; // x2 device pixels = the 1080 x 1920 stage, 6 px per art pixel
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

  const cheat = (c) => page.evaluate((c) => window.__dl.dispatch({ type: 'cheat', cheat: c }), c);
  const ui = () =>
    page.evaluate(() => {
      const u = window.__dl.ui.getState();
      return { charging: !!u.charging, celebrate: !!u.celebrate, afterBoss: !!u.afterBoss };
    });
  const waitFor = async (key, ms) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      if ((await ui())[key]) return true;
      await sleep(50);
    }
    return false;
  };
  const tab = (t) => page.evaluate((t) => window.__dl.ui.getState().setTab(t), t);
  /**
   * At this luck the reels find rare things on their own, and a rare find's full-screen reveal waits
   * for a tap. Between scenes (and in scenes that aren't about a reveal) tap any of them away.
   */
  const clearOverlays = async () => {
    for (let i = 0; i < 12; i++) {
      const s = await ui();
      if (!s.charging && !s.celebrate) break;
      if (s.charging) await waitFor('celebrate', 5000);
      await page.mouse.click(VIEW.width / 2, VIEW.height / 2);
      await sleep(350);
    }
    await page.evaluate(() => window.__dl.ui.setState({ afterBoss: null, popup: null }));
  };
  /** Runs `fn` while tapping away any reveal that turns up; marks when the first one did (the edit avoids it). */
  const guarded = (fn) => async (mark) => {
    let on = true;
    let seen = false;
    const watch = (async () => {
      while (on) {
        const s = await ui().catch(() => ({}));
        if (s.charging || s.celebrate) {
          if (!seen) mark('interrupt');
          seen = true;
          if (s.celebrate) await page.mouse.click(VIEW.width / 2, VIEW.height / 2).catch(() => {});
        }
        await sleep(120);
      }
    })();
    try {
      await fn(mark);
    } finally {
      on = false;
      await watch;
    }
  };
  const equipBest = async () => {
    await tab('bag');
    await sleep(350);
    await page.getByRole('button', { name: /equip best/i }).first().click({ force: true });
  };
  /** A rare find: wait for its reveal, let it play, tap it away. Returns the moments seen. */
  const grail = async (mark = () => {}) => {
    await cheat({ kind: 'forceRarity', rarity: 'grail' });
    mark('go');
    if (await waitFor('charging', 20000)) mark('charge');
    if (!(await waitFor('celebrate', 20000))) throw new Error('no reveal');
    mark('reveal');
    await sleep(6600);
    mark('card');
    await sleep(900);
    await page.mouse.click(VIEW.width / 2, VIEW.height / 2);
    await sleep(500);
  };

  /** Records one scene: frames stream to disk, then become <name>.mp4 at 30 fps. */
  async function scene(name, fn) {
    await clearOverlays();
    const dir = path.join(OUT, `_${name}`);
    fs.mkdirSync(dir);
    const frames = [];
    const onFrame = async ({ data, metadata, sessionId }) => {
      const file = path.join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`);
      frames.push({ file, t: metadata.timestamp });
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
      await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    };
    const marks = {};
    const mark = (k) => {
      marks[k] = frames.length ? frames[frames.length - 1].t - frames[0].t : 0;
    };
    cdp.on('Page.screencastFrame', onFrame);
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
    await fn(mark);
    await cdp.send('Page.stopScreencast');
    cdp.off('Page.screencastFrame', onFrame);
    await sleep(100);
    const list = [];
    frames.forEach((f, i) => {
      const next = frames[i + 1];
      list.push(`file '${path.basename(f.file)}'`, `duration ${(next ? next.t - f.t : 1 / FPS).toFixed(4)}`);
    });
    list.push(`file '${path.basename(frames[frames.length - 1].file)}'`);
    fs.writeFileSync(path.join(dir, 'list.txt'), list.join('\n'));
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'),
      '-vf', `fps=${FPS},scale=1080:1920:flags=neighbor,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '12', path.join(OUT, `${name}.mp4`),
    ]);
    const span = frames[frames.length - 1].t - frames[0].t;
    marks.duration = span;
    allMarks[name] = marks;
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`${name}: ${span.toFixed(1)} s, ${frames.length} frames, marks ${JSON.stringify(marks)}`);
  }

  const world = (n, seconds) =>
    guarded(async (mark) => {
      await cheat({ kind: 'setStage', stage: n });
      mark('go');
      await sleep(seconds * 1000);
    });

  // ---- the take ----
  await tab('alley');
  await scene('neon', world(6, 4.5)); // Neon Night Market
  await scene('farm', world(5, 4.5)); // Funky Farmland: angry hens
  await scene('dungeon', world(8, 4.5)); // Dungeon Dumps
  await scene('lava', world(10, 4)); // Lava Landfill
  await scene('tokens', async (mark) => {
    await cheat({ kind: 'forceTokens', mults: [2, 5, 10] }); // x100 luck: Legendary or better
    mark('go');
    await sleep(7000);
  });
  // The x100 roll lands Legendary or better: its own reveal, recorded as a scene too.
  await scene('tokenReveal', async (mark) => {
    if (await waitFor('celebrate', 8000)) mark('reveal');
    await sleep(5500);
  });
  await scene('grail', grail);
  await scene('equip', guarded(async (mark) => {
    await equipBest();
    mark('slam');
    await sleep(4200);
    await tab('alley');
  }));
  await scene('boss', guarded(async (mark) => {
    await cheat({ kind: 'setStage', stage: 9 }); // Toxic Bayou
    await sleep(1200);
    await cheat({ kind: 'skipToLastWave' });
    mark('boss');
    if (await waitFor('afterBoss', 25000)) mark('down');
    await sleep(2500);
  }));
  // Off camera: three more Grails, so he can stand in the late worlds.
  for (let i = 0; i < 2; i++) {
    await clearOverlays();
    await grail();
    await equipBest();
    await sleep(2600);
    await tab('alley');
  }
  await scene('grail2', grail);
  await scene('equip2', guarded(async (mark) => {
    await equipBest();
    mark('slam');
    await sleep(4200);
    await tab('alley');
  }));
  await scene('glacier', world(13, 4.5)); // Glacier Gulch
  await scene('gardens', world(17, 4.5)); // Golden Gardens
  await scene('cosmic', world(19, 4.5)); // Cosmic Compactor
  await scene('finale', async (mark) => {
    await cheat({ kind: 'forceTokens', mults: [5, 10] });
    mark('go');
    await sleep(6500);
  });
  fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify(allMarks, null, 2));
  console.log(`scenes in ${path.relative(ROOT, OUT)}`);
} finally {
  await browser.close();
  await vite.close();
}
