/**
 * CrazyGames glue, active only in the CrazyGames build (services/platform.ts isCrazyGames):
 *  - loadingStart while the save loads, loadingStop once the title screen is up;
 *  - gameplayStart on PLAY; gameplayStop for real breaks only (Settings open, an ad playing), never
 *    for focus loss, which CrazyGames handles itself;
 *  - happytime, sparingly: a full-screen rare-find reveal, at most once every few minutes;
 *  - their "mute audio" setting silences everything, and an ad pauses the game and mutes it;
 *  - a toast when no ad could play (rewards are only ever given for a finished ad);
 *  - arrow keys and Space never scroll the CrazyGames page around the game.
 */
import { audio } from '../services/audio';
import { cgReady, crazyGames } from '../services/crazygames';
import { isCrazyGames } from '../services/platform';
import { t } from '../ui/i18n';
import { useUi } from '../ui/uiStore';
import { pauseGame, resumeGame, whenStarted } from './session';

const HAPPYTIME_GAP_MS = 3 * 60 * 1000;
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'PageUp', 'PageDown']);

/** Call before boot(): loading starts as soon as the SDK is up. */
export function crazyGamesBeforeBoot(): void {
  if (!isCrazyGames) return;
  void cgReady.then(() => crazyGames.loadingStart());
}

/** Call once the app has rendered (the title screen is showing). */
export function crazyGamesAfterBoot(): void {
  if (!isCrazyGames) return;
  crazyGames.loadingStop();

  let muteSetting = crazyGames.muteAudio();
  let adPlaying = false;
  let started = false;
  let lastHappy = -Infinity;
  const applyMute = () => audio.setSystemMute(muteSetting || adPlaying);
  applyMute();
  crazyGames.onSettingsChange((s) => {
    muteSetting = !!s?.muteAudio;
    applyMute();
  });

  const settingsOpen = () => useUi.getState().popup === 'settings';
  whenStarted(() => {
    started = true;
    if (!settingsOpen()) crazyGames.gameplayStart();
  });

  useUi.subscribe((now, prev) => {
    if (now.popup !== prev.popup && started && !adPlaying) {
      if (now.popup === 'settings') crazyGames.gameplayStop();
      else if (prev.popup === 'settings') crazyGames.gameplayStart();
    }
    if (now.celebrate && !prev.celebrate) {
      const at = performance.now();
      if (at - lastHappy >= HAPPYTIME_GAP_MS) {
        lastHappy = at;
        crazyGames.happytime();
      }
    }
  });

  crazyGames.on('adStart', () => {
    adPlaying = true;
    applyMute();
    crazyGames.gameplayStop();
    pauseGame();
  });
  crazyGames.on('adEnd', () => {
    adPlaying = false;
    applyMute();
    if (document.visibilityState === 'visible') resumeGame();
    if (started && !settingsOpen()) crazyGames.gameplayStart();
  });
  crazyGames.on('adFailed', () => useUi.getState().toast(t('ads.unavailable'), 'info'));

  window.addEventListener('keydown', (e) => {
    if (!SCROLL_KEYS.has(e.code)) return;
    const el = e.target as HTMLElement | null;
    if (el?.closest?.('input, textarea, select, button, [contenteditable="true"]')) return;
    e.preventDefault();
  });
}
