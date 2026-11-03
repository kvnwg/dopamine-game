/**
 * Turns core events into UI moments: every reel's result pops in; Epic and up get a burst. A roll
 * that is rare for the raccoon's current luck (see luckOddsOneIn and feel.bigRoll) gets a build-up
 * while the reels roll (glow, rattle, riser, silence drop) and the full-screen reveal when it lands
 * (black screen, the item shining, its "1 in X" counting up). With several reels, sounds play once
 * per spin for the best result. Also toasts for level-ups, luck boosts, upgrades and rebirths (with
 * the items each rebirth unlocks).
 */
import { BAL, DATA } from '../data';
import { currentLuck, formatNumber, haulMinutes, haulSize, itemName, luckOddsOneIn, rarityIndex, rollDrama, type CoreEvent, type Item } from '../core';
import { getGame } from '../app/store';
import { saveNow } from '../app/session';
import { bus } from '../app/eventBus';
import { haptics } from '../services';
import { audio, type Material } from '../services/audio';
import { t } from './i18n';
import { revealTotalMs } from './revealTiming';
import { itemStopMs, multOf } from './reelTiming';
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

/** How rare an item is at the raccoon's luck right now, and how big a deal that makes it. */
function rareness(item: Item): Pick<RollView, 'luckOdds' | 'drama'> {
  const luckOdds = luckOddsOneIn(item, currentLuck(getGame(), Date.now()));
  return { luckOdds, drama: rollDrama(luckOdds) };
}

/**
 * While the reels roll toward a big roll: rising rattle, a riser, then a silence drop just before its
 * reel stops on it (`ms` after the spin starts, after any luck tokens on that reel).
 */
function buildUp(view: RollView, ms: number) {
  const tier = rarityIndex(view.item.rarity);
  useUi.setState({ charging: view });
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

/** The full-screen reveal for a big roll, as its reel lands (RareReveal plays it and its sounds). */
function celebrate(view: RollView) {
  useUi.setState({ charging: null, celebrate: view });
  haptics.impact('heavy');
  if (revealTimer) clearTimeout(revealTimer);
  revealTimer = setTimeout(() => {
    if (useUi.getState().celebrate?.id === view.id) {
      useUi.setState({ celebrate: null });
      next();
    }
  }, revealTotalMs(view, getGame().settings.reduceMotion));
}

/** RareReveal calls this when the counter lands: the item's own material and rarity sting. */
export function revealLanded(view: RollView): void {
  audio.material(material(view.item.baseId));
  audio.reveal(view.item.rarity);
  [0, 140, 280, 420].forEach((ms) => setTimeout(() => haptics.impact(ms ? 'light' : 'heavy'), ms));
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
    // Equip best wears several items at once: one toast for the lot.
    const equips = events.filter((e) => e.type === 'equip' && !e.auto).length;
    if (equips > 1) ui.toast(t('toast.equippedN', { n: equips }), 'good');
    for (const e of events) {
      switch (e.type) {
        case 'spinStart': {
          const best = e.reels.reduce((a, b) => (b.odds > a.odds ? b : a));
          const rare = rareness(best.item);
          if (rare.drama) {
            const view: RollView = {
              id: -best.item.uid, item: best.item, odds: best.odds, lucky: e.lucky, golden: e.golden, placed: 'bag', newRecord: false,
              at: performance.now(), mult: multOf(best.mults), ...rare,
            };
            buildUp(view, itemStopMs(e, e.reels.indexOf(best)));
          }
          if (e.golden) audio.jingle(5);
          spinBest = null;
          break;
        }
        case 'roll': {
          const view: RollView = {
            id: rollId++, item: e.item, odds: e.odds, lucky: e.lucky, golden: e.golden, placed: e.placed, newRecord: e.newRecord,
            at: performance.now(), mult: e.mult, ...rareness(e.item),
          };
          // The big "last roll" card shows the best result of the spin; every result goes in Recent.
          if (e.reel === 0 || !spinBest || e.odds > spinBest.odds) spinBest = view;
          const shown = spinBest;
          useUi.setState({ lastRoll: shown });
          const tier = rarityIndex(e.item.rarity);
          // A rare find is saved right away (autosave is every 30 s): a phone that crashes or a
          // tab that closes during the big reveal must never lose it.
          if (view.drama || tier >= rarityIndex('legendary')) saveSoon();
          if (view.drama) {
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
          if (!e.auto && equips === 1) ui.toast(t('toast.equipped', { name: itemName(e.item) }), 'good');
          break;
        case 'levelUp':
          // One toast for a batch (a big haul can grant many levels at once): the level reached.
          if (e === lastOf(events, 'levelUp')) {
            ui.toast(t('toast.levelUp', { level: e.level }), 'good');
            haptics.impact('medium');
          }
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
          // The unlock card (UnlockedFx) follows the burst.
          useUi.setState({ rebirthFx: e.count, tab: 'alley', unlocked: e.unlocked.length ? { count: e.count, ids: e.unlocked } : null });
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
          useUi.setState({ afterBoss: { world: e.world, firstTime: true, gems: e.gems } });
          haptics.impact('heavy');
          break;
        case 'bossChoice':
          if (!e.firstTime) useUi.setState({ afterBoss: { world: e.world, firstTime: false, gems: 0 } });
          break;
        case 'clockWentBackward':
          ui.toast(t('toast.clockBackward'), 'warn');
          break;
        case 'scrap':
          if (!e.auto) ui.toast(t('toast.scrapped', { gold: formatNumber(e.coins) }), 'info');
          break;
        case 'scrapAll': {
          // A haul worth many minutes of fighting gets its own moment; an everyday one a toast.
          const minutes = haulMinutes(getGame(), e.coins, Date.now());
          const size = Number.isFinite(minutes) ? haulSize(minutes) : null;
          if (size) {
            useUi.setState({ haul: { id: Date.now(), coins: e.coins, minutes, count: e.count, size } });
            audio.haul(size === 'big' ? 0 : size === 'huge' ? 1 : 2);
            haptics.impact('heavy');
          } else {
            ui.toast(t('toast.scrappedAll', { n: e.count, gold: formatNumber(e.coins) }), 'good');
          }
          break;
        }
      }
    }
    if (popped) popSound(popped);
  });
}

/** The last event of a type in a batch. */
function lastOf(events: readonly CoreEvent[], type: CoreEvent['type']): CoreEvent | undefined {
  for (let i = events.length - 1; i >= 0; i--) if (events[i].type === type) return events[i];
  return undefined;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Saves once, right after this batch of events has been applied to the game state. */
function saveSoon(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveNow();
  }, 0);
}
