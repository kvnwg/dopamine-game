// Records the raw scenes for the CrazyGames trailers from real gameplay.
//   node tools/crazygames/recordTrailer.mjs [land|port|both] [--dpr 4] [--only fight,chain]
//   (then: node tools/crazygames/editTrailer.mjs)
// Each format is recorded in the layout players of it see: landscape on the PC stage (2160 x 960 stage
// px: the battle on the left, the menus on the right), portrait on the phone stage (1080 x 1920). At the
// default --dpr 4 every stage px is 2 x 2 captured px, so the editor's zoom-ins never upscale.
//
// Starts from a fixed mid-game save made by the balance bot (trailerSave.json, from trailerSave.ts).
// The dev cheats set scenes up (which world, a forced Grail, a forced luck-token chain), and two
// balance values are switched off while scenes that aren't about them record: random luck tokens
// (their flights and rows crowd the fight) and the full-screen reveal for finds that are merely rare
// at this luck. Everything on screen is the game.
//
// Frame-perfect: virtualTime.js takes over the page's clock (animation frames, timers, performance.now,
// Date, CSS animations), and every captured frame is exactly 1/30 s of game time, however slowly the
// headless browser renders. Frames are piped straight into ffmpeg.
// Writes crazygames/.trailer/<format>/<scene>.mp4 and marks.json (moments inside each scene, in seconds).
// Needs Playwright, ffmpeg, and tsx (devDeps).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, startVite } from './renderCovers.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const OUT = path.join(ROOT, 'crazygames', '.trailer');
const FPS = 30;
const STEP = 1000 / FPS;
/** Viewports in CSS px: the stage (App.tsx) fits them at exactly half scale. */
export const FORMATS = {
  land: { viewport: { width: 1080, height: 480 }, stage: [2160, 960] },
  port: { viewport: { width: 540, height: 960 }, stage: [1080, 1920] },
};

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const DPR = Number(opt('--dpr', 4));
const ONLY = opt('--only', '')?.split(',').filter(Boolean) ?? [];
const which = args[0] && !args[0].startsWith('--') ? args[0] : 'both';
const formats = which === 'both' ? ['land', 'port'] : [which];

fs.mkdirSync(OUT, { recursive: true });
// The trailer's save is a fixed file, so balance changes don't move the scenes (who wins where);
// `npx tsx tools/crazygames/trailerSave.ts > tools/crazygames/trailerSave.json` makes a new one.
const savePath = fileURLToPath(new URL('./trailerSave.json', import.meta.url));
const save = fs.readFileSync(savePath, 'utf8');

const { chromium } = loadPlaywright();
const vite = await startVite();
const browser = await chromium.launch();
try {
  for (const f of formats) await recordFormat(f);
} finally {
  await browser.close();
  await vite.close();
}

async function recordFormat(format) {
  const { viewport } = FORMATS[format];
  const dir = path.join(OUT, format);
  fs.mkdirSync(dir, { recursive: true });
  const marksPath = path.join(dir, 'marks.json');
  const allMarks = fs.existsSync(marksPath) && ONLY.length ? JSON.parse(fs.readFileSync(marksPath, 'utf8')) : {};
  allMarks._ = { dpr: DPR, px: DPR / 2, stage: FORMATS[format].stage };

  const page = await browser.newPage({ viewport, deviceScaleFactor: DPR });
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
  await page.waitForTimeout(3500);
  const cdp = await page.context().newCDPSession(page);
  await page.mouse.move(viewport.width * 0.2, 4); // the battle's sky: no hover info anywhere
  await page.evaluate(() => window.__vt.start()); // from here on, the game only moves when we step it

  const cheat = (c) => page.evaluate((c) => window.__dl.dispatch({ type: 'cheat', cheat: c }), c);
  const tab = (t) => page.evaluate((t) => window.__dl.ui.getState().setTab(t), t);
  /** Clean mode: no random luck tokens, no full-screen reveal for a find that's only rare at this luck. */
  const clean = (on) =>
    page.evaluate(async (on) => {
      const { BAL } = await import('/src/data/index.ts');
      window.__bal0 ??= { chance: BAL.roll.multiplier.chance, tier: BAL.feel.bigRoll.tierOneIn };
      BAL.roll.multiplier.chance = on ? 0 : window.__bal0.chance;
      BAL.feel.bigRoll.tierOneIn = on ? 1e18 : window.__bal0.tier;
    }, on);
  const tap = async () => {
    await page.mouse.click(viewport.width / 2, viewport.height / 2);
    await page.mouse.move(viewport.width * 0.2, 4);
  };
  const click = async (name) => {
    await page.getByRole('button', { name }).first().click({ force: true });
    await page.mouse.move(viewport.width * 0.2, 4);
  };
  /** One frame of game time; returns what the UI is showing. */
  const step = () =>
    page.evaluate((ms) => {
      window.__vt.step(ms);
      const u = window.__dl.ui.getState();
      const g = window.__dl.getGame();
      return {
        charging: !!u.charging,
        celebrate: !!u.celebrate,
        afterBoss: !!u.afterBoss,
        flight: u.tokenFlights.at(-1)?.id ?? 0,
        fstep: u.tokenFlights.at(-1)?.step ?? -1,
        wave: g.battle.wave,
        phase: g.battle.phase,
        foes: g.battle.enemies.length,
        boss: g.battle.enemies.some((e) => e.kind === 'boss'),
      };
    }, STEP);
  const advance = async (seconds, key) => {
    for (let i = 0; i < seconds * FPS; i++) {
      const s = await step();
      if (key && s[key]) return true;
    }
    return !key;
  };
  const clearOverlays = async () => {
    for (let i = 0; i < 12; i++) {
      const s = await step();
      if (!s.charging && !s.celebrate) break;
      if (s.charging) await advance(8, 'celebrate');
      await tap();
      await advance(0.5);
    }
    await page.evaluate(() => window.__dl.ui.setState({ afterBoss: null, popup: null }));
  };
  const equipBest = async () => {
    await tab('bag');
    await advance(0.4);
    await click(/equip best/i);
  };
  /** Off camera: a forced Grail, its reveal tapped away, put on. */
  const grailOffCamera = async () => {
    await clearOverlays();
    await clean(false);
    await cheat({ kind: 'forceRarity', rarity: 'grail' });
    await tab('alley');
    await advance(30, 'celebrate');
    await advance(8);
    await tap();
    await advance(0.6);
    await clean(true);
    await equipBest();
    await advance(3);
    await tab('alley');
  };

  /** Records one scene; `fn` drives it with r.run / r.until / r.mark. guard: tap away unasked-for reveals. */
  async function scene(name, fn, { guard = true } = {}) {
    const skip = ONLY.length && !ONLY.includes(name);
    await clearOverlays();
    let n = 0;
    const marks = {};
    let ff = null;
    let lastFlight = 0;
    if (!skip) {
      ff = spawn('ffmpeg', [
        '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '13', '-pix_fmt', 'yuv444p', path.join(dir, `${name}.mp4`),
      ], { stdio: ['pipe', 'inherit', 'inherit'] });
    }
    const t0 = Date.now();
    const frame = async () => {
      const s = await step();
      if (s.phase === 'dead' && marks.ko === undefined) {
        marks.ko = n / FPS; // knocked out: a scene to fix
        console.warn(`[${format}] ${name}: knocked out at ${marks.ko.toFixed(1)} s`);
      }
      // Luck tokens: when each step's first token pops out of its reel (it lands in its row 0.39 s later).
      if (s.flight && s.flight !== lastFlight) {
        lastFlight = s.flight;
        marks.steps ??= [];
        if (s.fstep >= 0 && marks.steps[s.fstep] === undefined) marks.steps[s.fstep] = n / FPS;
      }
      if (guard && (s.charging || s.celebrate)) {
        if (marks.interrupt === undefined) marks.interrupt = n / FPS;
        if (s.celebrate) await tap();
      }
      if (ff) {
        const { data } = await cdp.send('Page.captureScreenshot', {
          format: 'jpeg', quality: 95, optimizeForSpeed: true,
          clip: { x: 0, y: 0, width: viewport.width, height: viewport.height, scale: DPR },
        });
        if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
      }
      n++;
      return s;
    };
    const r = {
      mark: (k) => (marks[k] = n / FPS),
      run: async (seconds) => {
        for (let i = 0; i < Math.round(seconds * FPS); i++) await frame();
      },
      until: async (test, seconds) => {
        const fn = typeof test === 'string' ? (s) => s[test] : test;
        for (let i = 0; i < seconds * FPS; i++) if (fn(await frame())) return true;
        return false;
      },
    };
    await fn(r);
    if (ff) {
      ff.stdin.end();
      await new Promise((res, rej) => ff.on('close', (c) => (c ? rej(new Error(`ffmpeg ${c}`)) : res())));
      marks.duration = n / FPS;
      allMarks[name] = marks;
      fs.writeFileSync(marksPath, JSON.stringify(allMarks, null, 2)); // as it goes: a scene can be cut as soon as it's done
      const sec = (Date.now() - t0) / 1000;
      console.log(`[${format}] ${name}: ${marks.duration.toFixed(1)} s in ${sec.toFixed(0)} s, marks ${JSON.stringify(marks)}`);
    }
  }

  /** A world from its start: the banner, FIGHT!, the first waves. */
  const world = (stage, seconds) => async (r) => {
    await cheat({ kind: 'setStage', stage });
    r.mark('go');
    await r.run(seconds);
  };

  // ---- the take ----
  await clean(true);
  await tab('alley');
  await advance(1);
  // Two world intros the current edit doesn't use (Neon shows a TOO TOUGH hint at this power). They stay
  // in the take so a re-recording plays out the same as the one the edit was cut from.
  await scene('neon', world(6, 3.5));
  await scene('dungeon', world(8, 3.5));
  // The luck chain, on a fresh Dungeon Dumps (he wins there, and its boss comes after the reveal): all
  // three reels land x3, then x5, then x10, each a MATCH (LUCK SQUARED: x9, x225, x22.5K), and the first
  // reel lands the Grail; the screen goes dark, the odds count up through the tiers: HOLY GRAIL!
  await scene(
    'chain',
    async (r) => {
      await cheat({ kind: 'setStage', stage: 8 });
      await r.run(0.8);
      await clean(false);
      await page.evaluate(async () => {
        const { BAL } = await import('/src/data/index.ts');
        BAL.roll.multiplier.chance = 0; // only the forced chain
      });
      await cheat({ kind: 'forceTokens', mults: [3, 5, 10], everyReel: true });
      await cheat({ kind: 'forceRarity', rarity: 'grail' });
      r.mark('go');
      if (await r.until('charging', 25)) r.mark('charge');
      if (!(await r.until('celebrate', 25))) throw new Error('no reveal');
      r.mark('reveal');
      await r.run(7.4);
      r.mark('card');
      await r.run(2.6);
      await tap();
      await r.run(0.4);
      await clean(true);
    },
    { guard: false },
  );
  // Put on: the Grail slams onto him and his POWER counts up.
  await scene('equip', async (r) => {
    await equipBest();
    r.mark('click');
    await r.run(4.5);
    await tab('alley');
  });
  // The boss: Toxic Bayou's last wave, Gator Vinnie, until he's down and the world is cleared.
  await scene('boss', async (r) => {
    await cheat({ kind: 'setStage', stage: 9 });
    await r.run(0.6);
    await cheat({ kind: 'skipToLastWave' });
    r.mark('skip');
    if (await r.until('boss', 8)) r.mark('boss');
    if (await r.until('afterBoss', 20)) r.mark('down');
    await r.run(2);
  });
  // Off camera: three more Grails, so he can stand in the later worlds (10, 13 and 14; past those he
  // is knocked out, so they stay out of the trailer).
  for (let i = 0; i < 3; i++) await grailOffCamera();
  await clean(true);
  // The brawl: Lava Landfill from its start, now that he wins there (before the Grails it's a coin
  // flip that he mostly loses): CRIT!s, big numbers, coins flying.
  await scene('fight', world(10, 9));
  await scene('glacier', world(13, 4));
  await scene('mushroom', world(14, 4));
  fs.writeFileSync(marksPath, JSON.stringify(allMarks, null, 2));
  console.log(`[${format}] scenes in ${path.relative(ROOT, dir)}`);
  await page.close();
}
