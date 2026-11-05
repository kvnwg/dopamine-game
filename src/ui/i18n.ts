import { DATA } from '../data';
import { MOUSE } from './pointer';

/* The strings are written for touch: with a mouse, "tap" reads "click" and pinching to zoom is the scroll wheel. */
const CLICK: Record<string, string> = { tap: 'click', Tap: 'Click', TAP: 'CLICK' };
const ENDING: Record<string, string> = { s: 's', ping: 'ing', ped: 'ed' };

/** Touch wording to mouse wording ("Tap again" to "Click again", "pinch to zoom" to "scroll to zoom"). */
export function forMouse(text: string): string {
  return text
    .replace(/pinch to zoom/g, 'scroll to zoom')
    .replace(/\b(tap|Tap|TAP)(s|ping|ped)?\b/g, (_, w: string, end?: string) => {
      const tail = end ? ENDING[end] : '';
      return CLICK[w] + (w === 'TAP' ? tail.toUpperCase() : tail);
    });
}

/** Looks up a player-facing string from strings.en.json and fills {placeholders}. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const found = DATA.strings[key];
  if (found === undefined) {
    if (import.meta.env.DEV) console.warn(`Missing string: ${key}`);
    return key;
  }
  const raw = MOUSE ? forMouse(found) : found;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}
