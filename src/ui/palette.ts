/** Pushes the rarity colors from assets.json into CSS variables (one source of truth for rarity color). */
import { DATA, RARITIES } from '../data';

export function applyPaletteToCss(root: HTMLElement = document.documentElement): void {
  const ph = DATA.assets.placeholders;
  for (const r of RARITIES) {
    root.style.setProperty(`--r-${r}`, ph.rarities[r].color);
    const g = ph.rarities[r].gradient;
    if (g) root.style.setProperty(`--r-${r}-gradient`, `linear-gradient(135deg, ${g.join(', ')})`);
  }
}
