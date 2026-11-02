import { DATA } from '../data';

/** Looks up a player-facing string from strings.en.json and fills {placeholders}. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const raw = DATA.strings[key];
  if (raw === undefined) {
    if (import.meta.env.DEV) console.warn(`Missing string: ${key}`);
    return key;
  }
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}
