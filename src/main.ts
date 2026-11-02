import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/nunito/latin-800.css';
import './ui/global.css';
import { DATA } from './data'; // validates every JSON file at boot
import { boot } from './app/session';
import { dispatch, getGame } from './app/store';
import { serialize } from './core';
import { App } from './ui/App';
import { applyPaletteToCss } from './ui/palette';

/** The claude.ai artifact viewer's hot-update hook (absent everywhere else). */
interface HotHook {
  snapshot?: (fn: () => unknown) => void;
  ready?: (start: (data: unknown) => void) => void;
  data?: unknown;
}
const hot = (window as unknown as { claude?: { hot?: HotHook } }).claude?.hot;

async function main(data?: unknown) {
  void DATA;
  applyPaletteToCss();
  const save = (data as { save?: unknown } | undefined)?.save;
  await boot(typeof save === 'string' ? save : undefined);
  hot?.snapshot?.(() => ({ save: serialize(getGame()) }));
  createRoot(document.getElementById('root')!).render(createElement(App));
  // Test hook for browser automation in dev builds only.
  if (import.meta.env.DEV) (window as unknown as { __dl: unknown }).__dl = { getGame, dispatch };
}

const start = (data?: unknown) =>
  main(data).catch((err) => {
  console.error(err);
  const el = document.getElementById('root');
  if (el) {
    el.innerHTML = `<pre style="color:#ff8a80;padding:24px;white-space:pre-wrap;font:14px monospace">Dumpster Legend failed to start:\n\n${String(err?.message ?? err)}</pre>`;
  }
});

if (hot?.ready) hot.ready(start);
else void start(hot?.data);
