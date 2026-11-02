/** Pushes the art-direction palette and rarity colors from assets.json into CSS variables. */
import { DATA, RARITIES } from '../data';

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export function applyPaletteToCss(root: HTMLElement = document.documentElement): void {
  const ph = DATA.assets.placeholders;
  for (const [k, v] of Object.entries(ph.palette)) root.style.setProperty(`--${kebab(k)}`, v);
  for (const r of RARITIES) {
    root.style.setProperty(`--r-${r}`, ph.rarities[r].color);
    const g = ph.rarities[r].gradient;
    if (g) root.style.setProperty(`--r-${r}-gradient`, `linear-gradient(135deg, ${g.join(', ')})`);
  }
}
