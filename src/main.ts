import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/pixelify-sans/latin-500.css';
import '@fontsource/pixelify-sans/latin-700.css';
import './ui/global.css';
import './ui/pixel.css';
import { DATA } from './data'; // validates every JSON file at boot
import { boot } from './app/session';
import { dispatch, getGame } from './app/store';
import { serialize } from './core';
import { App } from './ui/App';
import { dismissBoot } from './ui/boot';
import { useUi } from './ui/uiStore';
import { applyPaletteToCss } from './ui/palette';

/** The claude.ai artifact viewer's hot-update hook (absent everywhere else). */
interface HotHook {
  snapshot?: (fn: () => unknown) => void;
  ready?: (start: (data: unknown) => void) => void;
  data?: unknown;
}
const hot = (window as unknown as { claude?: { hot?: HotHook } }).claude?.hot;

/**
 * The title screen shows on every start and holds the game until PLAY. `?notitle` skips it (tests and
 * headless checks); so does a hot update in place, which hands over a game already being played.
 */
function showTitle(hotSave: boolean): boolean {
  if (hotSave) return false;
  try {
    return !new URLSearchParams(location.search).has('notitle');
  } catch {
    return true;
  }
}

async function main(data?: unknown) {
  void DATA;
  applyPaletteToCss();
  const save = (data as { save?: unknown } | undefined)?.save;
  const handedOver = typeof save === 'string';
  await boot(handedOver ? save : undefined, { hold: showTitle(handedOver) });
  hot?.snapshot?.(() => ({ save: serialize(getGame()) }));
  createRoot(document.getElementById('root')!).render(createElement(App));
  dismissBoot();
  // Test hook for browser automation in dev builds only.
  if (import.meta.env.DEV) (window as unknown as { __dl: unknown }).__dl = { getGame, dispatch, ui: useUi };
}

const start = (data?: unknown) =>
  main(data).catch((err) => {
  console.error(err);
  const el = document.getElementById('root');
  if (el) {
    el.innerHTML = `<pre style="color:#ff8a80;padding:24px;white-space:pre-wrap;font:14px monospace">Dumpster Legend failed to start:\n\n${String(err?.message ?? err)}</pre>`;
  }
  dismissBoot();
});

if (hot?.ready) hot.ready(start);
else void start(hot?.data);
