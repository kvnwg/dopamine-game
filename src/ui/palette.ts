/** Pushes the art-direction palette and rarity colors from assets.json into CSS variables. */
import { DATA, RARITIES } from '../data';
import { paperGrain } from '../render/paint/brush';
import { dumpsterBodyUrl, dumpsterLidUrl } from '../render/paint/ui';

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export function applyPaletteToCss(root: HTMLElement = document.documentElement): void {
  const ph = DATA.assets.placeholders;
  for (const [k, v] of Object.entries(ph.palette)) root.style.setProperty(`--${kebab(k)}`, v);
  for (const r of RARITIES) {
    root.style.setProperty(`--r-${r}`, ph.rarities[r].color);
    const g = ph.rarities[r].gradient;
    if (g) root.style.setProperty(`--r-${r}-gradient`, `linear-gradient(135deg, ${g.join(', ')})`);
  }
  try {
    root.style.setProperty('--paper-grain', `url(${paperGrain(256, 23).toDataURL('image/png')})`);
    root.style.setProperty('--bin-body', `url(${dumpsterBodyUrl()})`);
    root.style.setProperty('--bin-lid', `url(${dumpsterLidUrl()})`);
  } catch {
    /* canvas unavailable: no grain */
  }
}
