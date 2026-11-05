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
/** The CrazyGames build loads their SDK v3 from their CDN, in <head> as their docs require. */
const crazyGamesSdk = (): Plugin => ({
  name: 'crazygames-sdk',
  transformIndexHtml: () => [
    { tag: 'script', attrs: { src: 'https://sdk.crazygames.com/crazygames-sdk-v3.js' }, injectTo: 'head-prepend' },
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
