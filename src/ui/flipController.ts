/**
 * Turns core 'dive' events into the lid-flip sequence (spec section 14 + Dopamine Playbook):
 * rattle beats scale with rarity, the glow climbs the rarity ladder, the lid pops, and the
 * reveal celebration scales by tier. The compare card only shows once the reveal lands.
 */
import { BAL, RARITIES } from '../data';
import { rarityIndex, type CoreEvent, type Item } from '../core';
import { bus } from '../app/eventBus';
import { getGame } from '../app/store';
import { haptics } from '../services';
import { audio, type Material } from '../services/audio';
import { DATA } from '../data';
import { t } from './i18n';
import { useUi, type Flip } from './uiStore';

let flipId = 1;
let timers: ReturnType<typeof setTimeout>[] = [];

export function flipTimings(item: Item, full: boolean): { popAt: number; endAt: number } {
  const f = BAL.feel;
  if (!full) {
    const popAt = f.autoFlipSeconds * 1000;
    return { popAt, endAt: popAt + 150 };
  }
  const beats = f.rattleBeatsByRarity[item.rarity];
  const rattle = beats * f.rattleBeatSeconds * 1000;
  // Spec: the glow ladder takes 0.5s after a 0.45s rattle (0.95s total for common pulls).
  const ladder = (f.lidFlipSeconds - f.lidRattleSeconds) * 1000;
  const popAt = rattle + ladder;
  return { popAt, endAt: popAt + f.revealSecondsByRarity[item.rarity] * 1000 };
}

/** Glow colors to step through, with the near-miss gold flash inserted for teased Epics. */
export function ladderSteps(item: Item, tease: boolean): Array<{ rarity: string; holdMs: number }> {
  const top = rarityIndex(item.rarity);
  const steps: Array<{ rarity: string; holdMs: number }> = [];
  const ladder = (BAL.feel.lidFlipSeconds - BAL.feel.lidRattleSeconds) * 1000;
  const n = top + 1 + (tease ? 1 : 0);
  // Each step holds a little longer than the last.
  let weightSum = 0;
  for (let i = 0; i < n; i++) weightSum += Math.pow(1.25, i);
  for (let i = 0; i <= top; i++) steps.push({ rarity: RARITIES[i], holdMs: (ladder * Math.pow(1.25, i)) / weightSum });
  if (tease) {
    const teaseMs = BAL.feel.teaseFlashSeconds * 1000;
    steps.splice(steps.length - 1, 0, { rarity: 'legendary', holdMs: teaseMs });
  }
  return steps;
}

function revealHaptics(item: Item) {
  switch (item.rarity) {
    case 'junk':
      break;
    case 'decent':
    case 'shiny':
      haptics.impact('light');
      break;
    case 'epic':
      haptics.impact('medium');
      timers.push(setTimeout(() => haptics.impact('medium'), 110));
      break;
    default:
      haptics.impact('heavy');
      [180, 300, 420].forEach((ms) => timers.push(setTimeout(() => haptics.impact('light'), ms)));
  }
}

function finishFlip(flip: Flip, pending: boolean) {
  const ui = useUi.getState();
  if (ui.flip?.id !== flip.id) return;
  useUi.setState({ flip: null, celebrate: null });
  if (pending) useUi.setState({ revealedUid: flip.item.uid });
}

function startFlip(item: Item, full: boolean, tease: boolean, pending: boolean) {
  const { popAt, endAt } = flipTimings(item, full);
  const flip: Flip = { id: flipId++, item, full, tease, startedAt: performance.now(), popAt, endAt };
  timers.forEach(clearTimeout);
  timers = [];
  useUi.setState({ flip });
  const tier = rarityIndex(item.rarity);
  const material = (DATA.itemsById.get(item.baseId)?.material ?? 'plastic') as Material;
  if (full) {
    // Rising rattle (sound + heartbeat haptics from Epic up), then the riser under the color ladder.
    const beatMs = BAL.feel.rattleBeatSeconds * 1000;
    const beats = BAL.feel.rattleBeatsByRarity[item.rarity];
    const heavy = tier >= rarityIndex('epic');
    audio.lidClunk();
    for (let b = 0; b < beats; b++) {
      timers.push(
        setTimeout(() => {
          audio.rattle(b, beats, heavy);
          if (heavy && b > 0) haptics.impact('light');
        }, b * beatMs),
      );
    }
    timers.push(setTimeout(() => audio.riser((popAt - beats * beatMs) / 1000, tier), beats * beatMs));
    if (tier >= rarityIndex('legendary')) timers.push(setTimeout(() => audio.silenceDrop(0.2), Math.max(0, popAt - 200)));
  }
  timers.push(
    setTimeout(() => {
      useUi.setState({ lastItem: item });
      if (full) {
        audio.material(material);
        audio.reveal(item.rarity);
      } else {
        audio.autoPop(item.rarity);
      }
      if (full) {
        revealHaptics(item);
        if (rarityIndex(item.rarity) >= rarityIndex('epic')) useUi.setState({ celebrate: { id: flip.id, item } });
      }
      // The compare card appears as soon as the lid pops for small pulls, after the show for big ones.
      const wait = full && rarityIndex(item.rarity) >= rarityIndex('epic') ? endAt - popAt : 0;
      timers.push(setTimeout(() => finishFlip(flip, pending), wait));
    }, popAt),
  );
}

/** Tapping during a manual flip skips straight to the result. */
export function skipFlip(): boolean {
  const flip = useUi.getState().flip;
  if (!flip || !flip.full) return false;
  const elapsed = performance.now() - flip.startedAt;
  if (elapsed < 150) return false; // ignore the tap that started it
  timers.forEach(clearTimeout);
  timers = [];
  if (elapsed < flip.popAt) {
    audio.material((DATA.itemsById.get(flip.item.baseId)?.material ?? 'plastic') as Material);
    audio.reveal(flip.item.rarity);
  }
  useUi.setState({ lastItem: flip.item, celebrate: null });
  finishFlip(flip, getGame().pendingItem?.uid === flip.item.uid);
  return true;
}

export function installFlipController(): () => void {
  // A compare card restored from a save shows immediately.
  const pending = getGame().pendingItem;
  if (pending) useUi.setState({ revealedUid: pending.uid, lastItem: pending });
  return bus.on((events: CoreEvent[]) => {
    const ui = useUi.getState();
    for (const e of events) {
      if (e.type === 'dive') {
        const pendingItem = e.outcome === 'pending';
        const full = !e.auto || e.fullFlip;
        if (!full && ui.flip?.full) {
          useUi.setState({ lastItem: e.item });
          continue;
        }
        startFlip(e.item, full, e.tease, pendingItem);
      } else if (e.type === 'codexEntry') {
        useUi.setState((u) => ({ newCodexKeys: [...u.newCodexKeys.slice(-50), e.key] }));
      } else if (e.type === 'equip') {
        useUi.setState({ equipPulse: { slot: e.item.slot, id: e.item.uid } });
      } else if (e.type === 'levelUp') {
        ui.toast(t('toast.levelUp', { level: e.level }), 'good');
        haptics.impact('medium');
      } else if (e.type === 'codexBonus') {
        ui.toast(t('toast.codexBonus', { gems: e.gems }), 'good');
      } else if (e.type === 'dumpsterUpgraded') {
        ui.toast(t('toast.dumpsterUpgraded', { level: e.level }), 'good');
        haptics.impact('medium');
      } else if (e.type === 'bossWin') {
        haptics.impact('heavy');
      } else if (e.type === 'neighborhoodCleared') {
        ui.toast(t('toast.neighborhoodCleared'), 'good');
      } else if (e.type === 'clockWentBackward') {
        ui.toast(t('toast.clockBackward'), 'warn');
      }
    }
  });
}

