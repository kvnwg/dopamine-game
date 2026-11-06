/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

/**
 * The loading screen (src/boot/boot.html, made by `npm run boot-art`) goes where index.html says
 * `<!-- boot -->`, so it paints before the game's script loads (tools/buildArtifact.mjs does the same
 * for the artifact page).
 */
function bootScreen(): Plugin {
  return {
    name: 'boot-screen',
    transformIndexHtml(html) {
      const boot = readFileSync(new URL('./src/boot/boot.html', import.meta.url), 'utf8');
      return html.replace('<!-- boot -->', () => boot);
    },
  };
}

// `--mode artifact` builds one self-contained page for the claude.ai artifact viewer
// (fonts and lazy chunks inlined; tools/buildArtifact.mjs folds the JS and CSS into the HTML).
/**
 * Right after the SDK, a few lines start it and tell CrazyGames loading has begun (loadingStart) the
 * moment the page opens, before the game's code downloads. Their funnel's "Loading started" counts from
 * this call, so a player who leaves during the download used to look like one who never loaded at all
 * (Kevin's Kaiju Rampage: 74% of visits start loading; Dumpster Legend, reporting late: 45%).
 * src/services/crazygames.ts picks up this init instead of starting the SDK a second time.
 */
const EARLY_SDK = `(function () {
  try {
    var sdk = window.CrazyGames && window.CrazyGames.SDK;
    if (!sdk) return;
    window.__cgInit = sdk.init().then(function () {
      try {
        if (sdk.environment === 'crazygames' || sdk.environment === 'local') {
          sdk.game.loadingStart();
          window.__cgLoadingStarted = true;
        }
      } catch (e) {}
    });
    window.__cgInit.catch(function () {});
  } catch (e) {}
})();`;

/** The CrazyGames build loads their SDK v3 from their CDN, in <head> as their docs require. */
const crazyGamesSdk = (): Plugin => ({
  name: 'crazygames-sdk',
  transformIndexHtml: () => [
    { tag: 'script', attrs: { src: 'https://sdk.crazygames.com/crazygames-sdk-v3.js' }, injectTo: 'head-prepend' },
    // (In <body>: the SDK's init adds to document.body, which doesn't exist yet in <head>.)
    { tag: 'script', children: EARLY_SDK, injectTo: 'body-prepend' },
  ],
});

export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact';
  // `--mode crazygames` (npm run build:crazygames): real SDK ads and saves, see src/services/crazygames.ts.
  const crazygames = mode === 'crazygames';
  return {
    plugins: [react(), bootScreen(), ...(crazygames ? [crazyGamesSdk()] : [])],
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    build: {
      outDir: artifact ? 'dist-artifact' : crazygames ? 'dist-crazygames' : 'dist',
      chunkSizeWarningLimit: 2000,
      ...(artifact
        ? {
            assetsInlineLimit: 100_000_000,
            cssCodeSplit: false,
            modulePreload: false,
            rollupOptions: { output: { inlineDynamicImports: true } },
          }
        : {}),
    },
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
      testTimeout: 60_000,
    },
  };
});
