/**
 * Boot, fixed-tick game loop, pause/resume, and autosave.
 */
import { App as CapApp } from '@capacitor/app';
import { BAL } from '../data';
import { createInitialState, deserialize, readSave, SaveManager, serialize, TICK_MS, offlineCapMs, MS_PER_HOUR, type GameState } from '../core';
import { analytics, createStorage, notifications } from '../services';
import { cloudClear, cloudLoad, cloudLoadAll, cloudPossible, cloudSave } from '../services/cloudSave';
import { isNative } from '../services/platform';
import { t } from '../ui/i18n';
import { clock, dispatch, getGame, replaceGame, runTicks } from './store';

export const saveManager = new SaveManager(createStorage(), BAL.save.backups);

let rafId = 0;
let lastFrame = 0;
let accumulator = 0;
let paused = false;
let sessionStartedAt = 0;
let autosaveTimer: ReturnType<typeof setInterval> | undefined;
/**
 * The game waits behind the title screen until PLAY (startGame): no ticks, saves, pauses or offline
 * payout before then, so nothing plays unseen and the time on the title counts as time away.
 */
let held = false;
/** A save was loaded: its 'boot' (restart the stage, pay out the time away) runs when the game starts. */
let bootPending = false;
/** The page is reloading into another save: nothing may be saved over it on the way out. */
let swapping = false;
let lastCloudAt = 0;

/** What the player should hear about the save once the game starts: it was mended, or came from their account. */
export type BootNote = { kind: 'mended'; count: number } | { kind: 'cloud' };
const bootNotes: BootNote[] = [];
export function takeBootNotes(): BootNote[] {
  return bootNotes.splice(0);
}

/** Copies the game to the player's Claude account (claude.ai only; at most every minute unless `now`). */
function pushCloud(state: GameState, now = false): void {
  if (swapping || !cloudPossible()) return;
  const t = performance.now();
  if (!now && t - lastCloudAt < 55_000) return;
  lastCloudAt = t;
  cloudSave(serialize(state), { playTimeMs: state.playTimeMs, lastActiveAt: state.lastActiveAt });
}

/** Whether save `a` has more play in it than `b` (a second's slack: the same game saved twice). */
const newer = (a: GameState, b: GameState) => a.playTimeMs > b.playTimeMs + 1000;

function newSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}

export async function saveNow(cloudNow = false): Promise<void> {
  // Nothing has happened behind the title yet; a save now would only cut the time away short.
  if (held || swapping) return;
  if (!paused) dispatch({ type: 'snapshot' });
  try {
    await saveManager.save(getGame());
  } catch (err) {
    console.error('Save failed', err);
  }
  pushCloud(getGame(), cloudNow);
}

function frame(t: number) {
  rafId = requestAnimationFrame(frame);
  if (paused || held) {
    lastFrame = t;
    return;
  }
  const dt = t - lastFrame;
  lastFrame = t;
  if (dt > BAL.offline.maxTickGapSeconds * 1000) {
    // The page was frozen without a visibility event: treat the gap as offline time.
    const now = clock.now();
    dispatch({ type: 'pause' }, now - dt);
    dispatch({ type: 'resume' }, now);
    accumulator = 0;
    return;
  }
  accumulator += dt;
  const ticks = Math.min(Math.floor(accumulator / TICK_MS), BAL.feel.maxCatchUpTicksPerFrame);
  if (ticks > 0) {
    accumulator -= ticks * TICK_MS;
    if (accumulator > TICK_MS * BAL.feel.maxCatchUpTicksPerFrame) accumulator = 0;
    runTicks(ticks);
  }
}

export function pauseGame(): void {
  if (paused || held || swapping) return;
  paused = true;
  dispatch({ type: 'pause' });
  analytics.track('session_end', { seconds: Math.round((clock.now() - sessionStartedAt) / 1000) });
  const g = getGame();
  void notifications.scheduleOfflineFull(g.lastActiveAt + offlineCapMs(g), t('notif.offlineFull.title'), t('notif.offlineFull.body'));
  void saveManager.save(getGame());
  pushCloud(getGame(), true);
}

export function resumeGame(): void {
  if (!paused || held) return;
  paused = false;
  lastFrame = performance.now();
  accumulator = 0;
  sessionStartedAt = clock.now();
  dispatch({ type: 'resume' });
  void notifications.cancelOfflineFull();
  analytics.track('session_start');
}

/** Dev cheat: pretend the app was closed for `hours`. */
export function skipTime(hours: number): void {
  const wasPaused = paused;
  if (!wasPaused) {
    paused = true;
    dispatch({ type: 'pause' });
  }
  clock.skip(hours * MS_PER_HOUR);
  paused = false;
  lastFrame = performance.now();
  dispatch({ type: 'resume' });
}

export async function resetSave(): Promise<void> {
  await saveManager.reset();
  await cloudClear();
  replaceGame(createInitialState(clock.now(), newSeed()));
}

/**
 * Plays `state` instead of the game running now: written as the save, then the page starts over
 * into it (a save code, a rescued save, or a newer save from the player's account).
 */
export async function switchToSave(state: GameState): Promise<void> {
  swapping = true;
  stopLoop();
  await saveManager.save(state);
  cloudSave(serialize(state), { playTimeMs: state.playTimeMs, lastActiveAt: state.lastActiveAt });
  location.reload();
}

/**
 * `snapshot` is a serialized save handed over when the page is hot-updated in place. With `hold`, the
 * game loads but waits for startGame() (the title screen's PLAY).
 */
export async function boot(snapshot?: string, opts: { hold?: boolean } = {}): Promise<void> {
  const fromSnapshot = snapshot ? deserialize(snapshot) : null;
  // Ask the player's account for its save right away, alongside the browser's.
  if (!fromSnapshot && cloudPossible()) void cloudLoadAll();
  let loaded: { state: GameState; source: 'main' | 'backup' | 'cloud'; fixed: string[] } | null = fromSnapshot
    ? { state: fromSnapshot, source: 'main', fixed: [] }
    : await saveManager.load();
  // The copy in the player's Claude account: the newer of the two is played. It gets a moment to
  // answer here (the loading screen is up); a late answer is still taken (lateCloud).
  let late = false;
  if (!fromSnapshot && cloudPossible()) {
    const text = await cloudLoad(2500);
    if (text === 'late') late = true;
    else if (text) {
      const cloud = readSave(text);
      if (cloud && (!loaded || newer(cloud.state, loaded.state))) {
        loaded = { state: cloud.state, source: 'cloud', fixed: cloud.fixed };
        bootNotes.push({ kind: 'cloud' });
      }
    }
  }
  if (loaded) {
    replaceGame(loaded.state);
    if (loaded.source === 'backup') console.warn('Main save was unreadable; restored from backup.');
    if (loaded.fixed.length) {
      console.warn('Save mended:', loaded.fixed.join(', '));
      bootNotes.push({ kind: 'mended', count: loaded.fixed.length });
    }
  } else {
    replaceGame(createInitialState(clock.now(), newSeed()));
    analytics.track('tutorial_step', { step: 'start' });
  }
  bootPending = !!loaded;
  held = opts.hold === true;
  if (!held) begin();
  if (late) lateCloud();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') pauseGame();
    else resumeGame();
  });
  window.addEventListener('pagehide', () => pauseGame());
  if (isNative()) {
    void CapApp.addListener('pause', () => pauseGame());
    void CapApp.addListener('resume', () => resumeGame());
  }
  autosaveTimer = setInterval(() => {
    if (!paused && !held) void saveNow();
  }, BAL.save.autosaveSeconds * 1000);

  lastFrame = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(frame);
}

/**
 * The account's save answered after the boot went on without it. Still at the title: it is simply
 * played if newer. Already playing: if it has more play in it than this game, the page starts over
 * into it (rare: the boot waits for it, and the title gives it longer).
 */
function lateCloud(): void {
  void cloudLoadAll().then((text) => {
    const cloud = text ? readSave(text) : null;
    if (!cloud || !newer(cloud.state, getGame())) return;
    if (held) {
      replaceGame(cloud.state);
      bootPending = true;
      bootNotes.push({ kind: 'cloud' });
    } else {
      void switchToSave(cloud.state);
    }
  });
}

/** The session starts: a loaded save restarts its stage and pays out the time away, and the clock runs. */
function begin(): void {
  if (bootPending) {
    bootPending = false;
    dispatch({ type: 'boot' });
  }
  sessionStartedAt = clock.now();
  analytics.track('session_start');
  lastFrame = performance.now();
  accumulator = 0;
}

/** Whether the game is still waiting behind the title screen. */
export function isHeld(): boolean {
  return held;
}

const starters = new Set<() => void>();

/** Runs `fn` when the game starts: on PLAY, or now if it isn't held. Returns a way to cancel that. */
export function whenStarted(fn: () => void): () => void {
  if (!held) {
    fn();
    return () => {};
  }
  starters.add(fn);
  return () => starters.delete(fn);
}

/** PLAY: the game held behind the title screen starts (once). */
export function startGame(): void {
  if (!held) return;
  held = false;
  begin();
  const waiting = [...starters];
  starters.clear();
  for (const fn of waiting) fn();
}

export function stopLoop(): void {
  cancelAnimationFrame(rafId);
  if (autosaveTimer) clearInterval(autosaveTimer);
}
