/** Whether the dev cheat panel is in this build (dev server, or a playtest build with VITE_CHEATS=true). */
export const SHOW_DEV = import.meta.env.DEV || import.meta.env.VITE_CHEATS === 'true';
