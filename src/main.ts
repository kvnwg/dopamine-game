import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-800.css';
import './ui/global.css';
import { DATA } from './data'; // validates every JSON file at boot
import { boot } from './app/session';
import { App } from './ui/App';
import { applyPaletteToCss } from './ui/palette';

async function main() {
  void DATA;
  applyPaletteToCss();
  await boot();
  createRoot(document.getElementById('root')!).render(createElement(App));
}

main().catch((err) => {
  console.error(err);
  const el = document.getElementById('root');
  if (el) {
    el.innerHTML = `<pre style="color:#ff8a80;padding:24px;white-space:pre-wrap;font:14px monospace">Dumpster Legend failed to start:\n\n${String(err?.message ?? err)}</pre>`;
  }
});
