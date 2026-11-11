/**
 * The recorded sounds: src/assets/sounds/<name>.mp3 (made from WAVs by tools/sounds.mjs), by name. The
 * game plays each in place of the synthesized sound of that name (audio.ts); a sound without one is
 * synthesized. URLs in the app build, data: URLs in the artifact build (which inlines every file).
 */
import levels from '../assets/sounds/levels.json';

const urls = import.meta.glob<string>('../assets/sounds/*.mp3', { eager: true, query: '?url', import: 'default' });

export const SOUND_FILES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(urls).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.mp3'.length), url]),
);

/** Each recording's gain, matched to the loudness of the synthesized sound it replaces. */
export const SOUND_LEVELS: Readonly<Record<string, number>> = levels;
