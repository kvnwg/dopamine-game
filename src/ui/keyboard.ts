/**
 * Keys for PC players (Kevin: "make a PC version"): 1 to 6 open the tabs in their bar's order (a locked
 * one answers as a tap would), E is Equip best, Esc closes the open popup, or else the upgrade map.
 * (Enter and Space press PLAY on the title screen, TitleScreen.tsx.)
 */
import { dispatch, getGame } from '../app/store';
import { t } from './i18n';
import { useUi, type Tab } from './uiStore';

const TABS: Tab[] = ['alley', 'heist', 'bag', 'upgrades', 'rebirth', 'worlds'];

export function installKeyboard(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    const ui = useUi.getState();
    if (e.key === 'Escape') {
      if (ui.popup) ui.openPopup(null);
      else if (ui.tab === 'upgrades') ui.setTab(ui.prevTab);
      return;
    }
    // Not while the title screen or a popup has the stage.
    if (document.querySelector('[data-title]') || ui.popup) return;
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= TABS.length) {
      const btn = document.querySelector<HTMLButtonElement>(`nav button[aria-label="${t(`tab.${TABS[n - 1]}`)}"]`);
      btn?.click();
      return;
    }
    if (e.key === 'e' || e.key === 'E') {
      // The Bag's own button when it's on screen (its count-up shows), else straight to the core, once
      // the Bag is open (before that, the tutorial hasn't shown it yet).
      const best = document.querySelector<HTMLButtonElement>('[data-equip-best]');
      if (best) {
        if (!best.disabled) best.click();
      } else if (getGame().features.unlocked.includes('bag')) dispatch({ type: 'equipBest' });
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
