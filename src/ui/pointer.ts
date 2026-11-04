/**
 * A mouse: a fine pointer that can hover, as on a PC (checked once at start). Touch strings say "tap";
 * with a mouse they say "click" (i18n.ts), and resting the pointer on gear shows what it is (HoverInfo).
 */
export const MOUSE = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
