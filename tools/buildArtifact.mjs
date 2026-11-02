/**
 * Folds the `vite build --mode artifact` output into one self-contained HTML page
 * for the claude.ai artifact viewer (which wraps the page in its own doctype/head/body).
 * Usage: node tools/buildArtifact.mjs [out.html]
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const dir = 'dist-artifact';
const out = process.argv[2] ?? 'artifact/dumpster-legend.html';
const html = readFileSync(join(dir, 'index.html'), 'utf8');

const jsRef = html.match(/<script[^>]*type="module"[^>]*src="\.\/([^"]+\.js)"[^>]*><\/script>/);
const cssRef = html.match(/<link[^>]*rel="stylesheet"[^>]*href="\.\/([^"]+\.css)"[^>]*>/);
if (!jsRef || !cssRef) throw new Error('Could not find the built script/stylesheet in dist-artifact/index.html');

const leftovers = readdirSync(join(dir, 'assets')).filter((f) => !f.endsWith('.js') && !f.endsWith('.css'));
if (leftovers.length) throw new Error(`Assets were not inlined: ${leftovers.join(', ')}`);
const jsFiles = readdirSync(join(dir, 'assets')).filter((f) => f.endsWith('.js'));
if (jsFiles.length !== 1) throw new Error(`Expected one JS bundle, found: ${jsFiles.join(', ')}`);

// `</script` inside the bundle would end the inline script early; `<\/script` means the same in JS.
const js = readFileSync(join(dir, jsRef[1]), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(dir, cssRef[1]), 'utf8');
if (/<\/style/i.test(css)) throw new Error('Stylesheet contains </style>');
if (/url\((?!["']?data:)/.test(css)) throw new Error('Stylesheet still references external files');

const page = `<title>Dumpster Legend</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
  /* One deliberate visual world: the game is always night-time dark, in either viewer theme. */
  :root { color-scheme: dark; --gutter-x: 16px; }
  html, body { height: 100%; background: #07080f; color: #f6efe2; }
</style>
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`Wrote ${out} (${(page.length / 1024 / 1024).toFixed(2)} MB)`);
