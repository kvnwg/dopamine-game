/**
 * Turns core events into UI moments: every reel's result pops in; Epic and up get a burst;
 * Legendary and up get a short build-up while the reels roll (glow, rattle, riser, silence drop)
 * and a full-screen reveal when they land. With several reels, sounds play once per spin for the
 * best result. Also toasts for level-ups, luck boosts, upgrades and rebirths.
 */
import { BAL, DATA } from '../data';
import { formatNumber, itemName, rarityIndex, type CoreEvent } from '../core';
import { bus } from '../app/eventBus';
import { haptics } from '../services';
import { audio, type Material } from '../services/audio';
import { t } from './i18n';
import { useUi, type RollView } from './uiStore';

let rollId = 1;
/** Big rolls that land while another reveal is showing wait their turn (at most a few). */
const queue: RollView[] = [];
let revealTimer: ReturnType<typeof setTimeout> | null = null;

function revealBusy(): boolean {
  return useUi.getState().celebrate !== null;
}

function next(): void {
  const v = queue.shift();
  if (v) celebrate(v);
}

/** While the reels roll toward a Legendary or better: rising rattle, a riser, then a silence drop. */
function buildUp(view: RollView, spinSeconds: number) {
  const tier = rarityIndex(view.item.rarity);
  useUi.setState({ charging: view });
  const ms = spinSeconds * 1000;
  const beats = BAL.feel.rattleBeatsByRarity[view.item.rarity];
  for (let b = 0; b < beats; b++) {
    setTimeout(() => {
      audio.rattle(b, beats, true);
      haptics.impact('light');
    }, ms * 0.35 + (b * ms * 0.45) / beats);
  }
  setTimeout(() => audio.riser(Math.max(0.3, (ms * 0.5) / 1000), tier), ms * 0.4);
  setTimeout(() => audio.silenceDrop(0.15), Math.max(0, ms - 160));
}

/** The full-screen reveal for a Legendary or better, as its reel lands. */
function celebrate(view: RollView) {
  useUi.setState({ charging: null, celebrate: view });
  audio.material(material(view.item.baseId));
  audio.reveal(view.item.rarity);
  haptics.impact('heavy');
  [180, 300, 420].forEach((ms) => setTimeout(() => haptics.impact('light'), ms));
  if (revealTimer) clearTimeout(revealTimer);
  revealTimer = setTimeout(() => {
    if (useUi.getState().celebrate?.id === view.id) {
      useUi.setState({ celebrate: null });
      next();
    }
  }, BAL.feel.revealSecondsByRarity[view.item.rarity] * 1000 + 600);
}

export function skipReveal(): void {
  if (revealTimer) clearTimeout(revealTimer);
  revealTimer = null;
  useUi.setState({ celebrate: null });
  next();
}

function material(baseId: string): Material {
  return (DATA.itemsById.get(baseId)?.material ?? 'plastic') as Material;
}

/** The best result of the spin landing right now, for the "last roll" card. */
let spinBest: RollView | null = null;
/** The best non-Legendary result in this batch of events: its sound plays once. */
let popped: { tier: number; item: RollView['item'] } | null = null;

function popSound(p: { tier: number; item: RollView['item'] }): void {
  audio.autoPop(p.item.rarity);
  if (p.tier >= rarityIndex('epic')) {
    audio.material(material(p.item.baseId), true);
    audio.reveal(p.item.rarity);
    haptics.impact('medium');
  } else if (p.tier >= rarityIndex('shiny')) {
    haptics.impact('light');
  }
}

export function installRollController(): () => void {
  return bus.on((events: CoreEvent[]) => {
    const ui = useUi.getState();
    popped = null;
    for (const e of events) {
      switch (e.type) {
        case 'spinStart': {
          const best = e.reels.reduce((a, b) => (rarityIndex(b.item.rarity) > rarityIndex(a.item.rarity) ? b : a));
          if (rarityIndex(best.item.rarity) >= rarityIndex(BAL.dumpster.bigRevealMinRarity)) {
            const view: RollView = {
              id: -best.item.uid, item: best.item, odds: best.odds, lucky: e.lucky, golden: e.golden, placed: 'bag', newRecord: false,
              at: performance.now(),
            };
            buildUp(view, e.spinSeconds);
          }
          if (e.golden) audio.jingle(5);
          spinBest = null;
          break;
        }
        case 'roll': {
          const view: RollView = {
            id: rollId++, item: e.item, odds: e.odds, lucky: e.lucky, golden: e.golden, placed: e.placed, newRecord: e.newRecord,
            at: performance.now(),
          };
          // The big "last roll" card shows the best result of the spin; every result goes in Recent.
          if (e.reel === 0 || !spinBest || e.odds > spinBest.odds) spinBest = view;
          const shown = spinBest;
          useUi.setState({ lastRoll: shown });
          const tier = rarityIndex(e.item.rarity);
          if (tier >= rarityIndex(BAL.dumpster.bigRevealMinRarity)) {
            if (!revealBusy()) celebrate(view);
            else if (queue.length < 3) queue.push(view);
            if (useUi.getState().charging?.item.uid === e.item.uid) useUi.setState({ charging: null });
          } else if (!popped || tier > popped.tier) {
            popped = { tier, item: e.item };
          }
          if (e.lucky && e.reel === 0) audio.jingle(3);
          break;
        }
        case 'codexEntry':
          useUi.setState((u) => ({ newCodexKeys: [...u.newCodexKeys.slice(-50), e.key] }));
          break;
        case 'equip':
          useUi.setState({ equipPulse: { slot: e.item.slot, id: e.item.uid } });
          if (!e.auto) ui.toast(t('toast.equipped', { name: itemName(e.item) }), 'good');
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
        case 'worldFirstClear':
          ui.toast(t('toast.worldCleared', { n: e.world, gems: e.gems }), 'good');
          haptics.impact('heavy');
          break;
        case 'clockWentBackward':
          ui.toast(t('toast.clockBackward'), 'warn');
          break;
        case 'scrap':
          if (!e.auto) ui.toast(t('toast.scrapped', { gold: formatNumber(e.coins) }), 'info');
          break;
        case 'scrapAll':
          ui.toast(t('toast.scrappedAll', { n: e.count, gold: formatNumber(e.coins) }), 'good');
          break;
      }
    }
    if (popped) popSound(popped);
  });
}
