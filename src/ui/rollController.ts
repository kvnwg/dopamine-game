/**
 * Turns core events into UI moments: every roll pops out of the dumpster; Epic and up get a
 * burst; Legendary and up get a short build-up (shake, glow, rising tone, silence drop) and a
 * full-screen reveal. Also toasts for level-ups, luck boosts, upgrades and rebirths.
 */
import { BAL, DATA } from '../data';
import { formatNumber, rarityIndex, type CoreEvent } from '../core';
import { bus } from '../app/eventBus';
import { haptics } from '../services';
import { audio, type Material } from '../services/audio';
import { t } from './i18n';
import { useUi, type RollView } from './uiStore';

let rollId = 1;
const BUILD_MS = 900;
/** Big rolls that land while another reveal is showing wait their turn (at most a few). */
const queue: RollView[] = [];
let revealTimer: ReturnType<typeof setTimeout> | null = null;

function revealBusy(): boolean {
  const u = useUi.getState();
  return u.charging !== null || u.celebrate !== null;
}

function next(): void {
  const v = queue.shift();
  if (v) bigReveal(v);
}

function material(baseId: string): Material {
  return (DATA.itemsById.get(baseId)?.material ?? 'plastic') as Material;
}

function bigReveal(view: RollView) {
  const tier = rarityIndex(view.item.rarity);
  useUi.setState({ charging: view });
  audio.lidClunk();
  const beats = BAL.feel.rattleBeatsByRarity[view.item.rarity];
  for (let b = 0; b < beats; b++) {
    setTimeout(() => {
      audio.rattle(b, beats, true);
      haptics.impact('light');
    }, (b * BUILD_MS * 0.6) / beats);
  }
  setTimeout(() => audio.riser(BUILD_MS * 0.0004, tier), BUILD_MS * 0.6);
  setTimeout(() => audio.silenceDrop(0.2), BUILD_MS - 200);
  setTimeout(() => {
    useUi.setState({ charging: null, celebrate: view });
    audio.material(material(view.item.baseId));
    audio.reveal(view.item.rarity);
    haptics.impact('heavy');
    [180, 300, 420].forEach((ms) => setTimeout(() => haptics.impact('light'), ms));
    revealTimer = setTimeout(() => {
      if (useUi.getState().celebrate?.id === view.id) {
        useUi.setState({ celebrate: null });
        next();
      }
    }, BAL.feel.revealSecondsByRarity[view.item.rarity] * 1000 + 600);
  }, BUILD_MS);
}

export function skipReveal(): void {
  if (useUi.getState().charging) return;
  if (revealTimer) clearTimeout(revealTimer);
  revealTimer = null;
  useUi.setState({ celebrate: null });
  next();
}

export function installRollController(): () => void {
  return bus.on((events: CoreEvent[]) => {
    const ui = useUi.getState();
    for (const e of events) {
      switch (e.type) {
        case 'roll': {
          const view: RollView = { id: rollId++, item: e.item, odds: e.odds, lucky: e.lucky, placed: e.placed, newRecord: e.newRecord, at: performance.now() };
          useUi.setState((s) => ({ lastRoll: view, recent: [view, ...s.recent].slice(0, 8) }));
          const tier = rarityIndex(e.item.rarity);
          if (tier >= rarityIndex(BAL.dumpster.bigRevealMinRarity)) {
            if (!revealBusy()) bigReveal(view);
            else if (queue.length < 3) queue.push(view);
          } else {
            audio.autoPop(e.item.rarity);
            if (tier >= rarityIndex('epic')) {
              audio.material(material(e.item.baseId), true);
              audio.reveal(e.item.rarity);
              haptics.impact('medium');
            } else if (tier >= rarityIndex('shiny')) {
              haptics.impact('light');
            }
          }
          if (e.lucky) audio.jingle(3);
          break;
        }
        case 'codexEntry':
          useUi.setState((u) => ({ newCodexKeys: [...u.newCodexKeys.slice(-50), e.key] }));
          break;
        case 'equip':
          useUi.setState({ equipPulse: { slot: e.item.slot, id: e.item.uid } });
          break;
        case 'levelUp':
          ui.toast(t('toast.levelUp', { level: e.level }), 'good');
          haptics.impact('medium');
          break;
        case 'codexBonus':
          ui.toast(t('toast.codexBonus', { gems: e.gems }), 'good');
          break;
        case 'dumpsterUpgraded':
          ui.toast(t('toast.dumpsterUpgraded', { level: e.level }), 'good');
          haptics.impact('medium');
          break;
        case 'luckBoost':
          ui.toast(t('toast.luckBoost', { mult: BAL.luck.potion.mult, seconds: e.seconds }), 'good');
          audio.jingle(5);
          haptics.impact('medium');
          break;
        case 'upgradeBought':
          haptics.impact('light');
          break;
        case 'rebirth':
          useUi.setState({ rebirthFx: e.count, tab: 'alley' });
          setTimeout(() => {
            if (useUi.getState().rebirthFx === e.count) useUi.setState({ rebirthFx: null });
          }, 3200);
          audio.bossWin();
          haptics.impact('heavy');
          break;
        case 'bossWin':
          haptics.impact('heavy');
          break;
        case 'neighborhoodCleared':
          ui.toast(t('toast.neighborhoodCleared'), 'good');
          break;
        case 'clockWentBackward':
          ui.toast(t('toast.clockBackward'), 'warn');
          break;
        case 'scrap':
          if (!e.auto) ui.toast(t('toast.scrapped', { gold: formatNumber(e.coins) }), 'info');
          break;
      }
    }
  });
}
