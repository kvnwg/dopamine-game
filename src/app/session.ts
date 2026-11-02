/**
 * Boot, fixed-tick game loop, pause/resume, and autosave.
 */
import { App as CapApp } from '@capacitor/app';
import { BAL } from '../data';
import { createInitialState, deserialize, SaveManager, TICK_MS, offlineCapMs, MS_PER_HOUR } from '../core';
import { analytics, createStorage, notifications } from '../services';
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

function newSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}

export async function saveNow(): Promise<void> {
  if (!paused) dispatch({ type: 'snapshot' });
  try {
    await saveManager.save(getGame());
  } catch (err) {
    console.error('Save failed', err);
  }
}

function frame(t: number) {
  rafId = requestAnimationFrame(frame);
  if (paused) {
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
  if (paused) return;
  paused = true;
  dispatch({ type: 'pause' });
  analytics.track('session_end', { seconds: Math.round((clock.now() - sessionStartedAt) / 1000) });
  const g = getGame();
  void notifications.scheduleOfflineFull(g.lastActiveAt + offlineCapMs(g), t('notif.offlineFull.title'), t('notif.offlineFull.body'));
  void saveManager.save(getGame());
}

export function resumeGame(): void {
  if (!paused) return;
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
  replaceGame(createInitialState(clock.now(), newSeed()));
}

/** `snapshot` is a serialized save handed over when the page is hot-updated in place. */
export async function boot(snapshot?: string): Promise<void> {
  const fromSnapshot = snapshot ? deserialize(snapshot) : null;
  const loaded = fromSnapshot ? { state: fromSnapshot, source: 'main' as const } : await saveManager.load();
  if (loaded) {
    replaceGame(loaded.state);
    dispatch({ type: 'boot' });
    if (loaded.source === 'backup') console.warn('Main save was unreadable; restored from backup.');
  } else {
    replaceGame(createInitialState(clock.now(), newSeed()));
    analytics.track('tutorial_step', { step: 'start' });
  }
  sessionStartedAt = clock.now();
  analytics.track('session_start');

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
    if (!paused) void saveNow();
  }, BAL.save.autosaveSeconds * 1000);

  lastFrame = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(frame);
}

export function stopLoop(): void {
  cancelAnimationFrame(rafId);
  if (autosaveTimer) clearInterval(autosaveTimer);
}
