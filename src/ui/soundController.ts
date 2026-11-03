/**
 * Connects the synthesized audio to the game: unlocks audio on the first tap, plays a pop on
 * every button, maps core events to sounds, follows the Sound/Music settings, and goes quiet
 * while the app is in the background.
 */
import { heistsOpen, isBossWave, type CoreEvent } from '../core';
import { bus } from '../app/eventBus';
import { gameStore, getGame } from '../app/store';
import { haptics } from '../services';
import { audio } from '../services/audio';
import { installButtonJuice } from './juice';

export function installSound(): () => void {
  // The recorded sounds decode now, so they're ready by the first tap.
  void audio.preload();
  // Taps in quick succession climb a step each (tap 1, tap 2, tap 3...), like a combo.
  let streak = 0;
  let lastTap = 0;
  const onDown = (e: PointerEvent) => {
    audio.unlock();
    const btn = (e.target as Element | null)?.closest?.('button');
    // The dumpster has its own lid clunk.
    if (btn && !btn.hasAttribute('data-no-tap-sound')) {
      const now = performance.now();
      streak = now - lastTap < 650 ? streak + 1 : 0;
      lastTap = now;
      audio.tap(streak);
      haptics.impact('light');
    }
  };
  document.addEventListener('pointerdown', onDown, true);
  const offJuice = installButtonJuice();

  let last = { sound: true, music: true };
  const sync = () => {
    const s = getGame().settings;
    if (s.sound !== last.sound) audio.setSound(s.sound);
    if (s.music !== last.music) audio.setMusic(s.music);
    last = { sound: s.sound, music: s.music };
  };
  audio.setSound(getGame().settings.sound);
  audio.setMusic(getGame().settings.music);
  last = { sound: getGame().settings.sound, music: getGame().settings.music };
  const unsubStore = gameStore.subscribe(sync);

  const onVis = () => (document.visibilityState === 'hidden' ? audio.suspend() : audio.resume());
  document.addEventListener('visibilitychange', onVis);

  // Heist tickets: a sound when one comes in (not when a run spends one).
  let tickets = getGame().heist.tickets;
  const unsubBus = bus.on((events: CoreEvent[]) => {
    for (const e of events) {
      switch (e.type) {
        // Blows, dodges and kills (and each coin reaching the gold counter) sound in the battle
        // (BattleScene), on the frame they visibly connect, with their pitch climbing.
        case 'bagDrop':
          audio.bag();
          break;
        case 'levelUp':
          // One jingle for a batch: a big haul can grant many levels at once.
          if (e === lastLevelUp(events)) audio.levelUp(e.level);
          break;
        case 'bossSpecial':
          audio.bossWarn();
          break;
        case 'waveStart':
          if (isBossWave(e.wave)) audio.bossIntro();
          break;
        case 'playerDeath':
          audio.death();
          break;
        case 'worldFirstClear':
          audio.stageClear();
          break;
        case 'bossWin':
          audio.bossWin();
          break;
        case 'dumpsterUpgraded':
          audio.ding();
          break;
        case 'codexBonus':
          audio.jingle(3);
          break;
        // Equips: the flight plays its own sounds as the item leaps, dives and hits (EquipFlight).
        case 'scrap':
          audio.recycle(e.auto);
          break;
        case 'scrapAll':
          audio.recycle(false);
          audio.coin();
          break;
        case 'upgradeBought':
          audio.coin();
          break;
        case 'offlineCollected':
          audio.collect();
          break;
        // ---- heists (the start, win and bust stings follow the run's status: heistSounds below)
        case 'heistNode':
          audio.heistNode(e.kind);
          break;
        case 'heistFightEnd':
          // (The boss's fall gets the getaway fanfare instead: heistSounds.)
          if (e.won && getGame().heist.run?.status !== 'won') audio.stageClear();
          break;
        case 'heistLevelUp':
          audio.levelUp(e.level);
          break;
        case 'heistPerk':
          audio.heistPerk(e.evolution);
          break;
        case 'heistCurse':
          audio.heistCurse(e.removed);
          break;
        case 'heistBlock':
          audio.heistBlock();
          break;
        case 'heistHelper':
          audio.heistHelper();
          break;
        case 'heistTickets':
          // (Tickets keep coming before Heists open, quietly.)
          if (e.tickets > tickets && heistsOpen(getGame())) audio.heistTicket();
          tickets = e.tickets;
          break;
        case 'heistEnd':
          // The loot is banked.
          if (e.won || e.rewards.coins > 0 || e.rewards.bags > 0) audio.collect();
          break;
      }
    }
  });
  const unsubHeist = heistSounds();

  return () => {
    offJuice();
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('visibilitychange', onVis);
    unsubStore();
    unsubBus();
    unsubHeist();
  };
}

/**
 * A heist's big moments follow its run's status: the start jingle when a run begins, a fanfare when
 * it's won, a sad trombone when the raccoon is busted (or walks away).
 */
function heistSounds(): () => void {
  let status: string | null = getGame().heist.run?.status ?? null;
  return gameStore.subscribe((st) => {
    const next = st.game.heist.run?.status ?? null;
    if (next === status) return;
    if (status === null && next !== null) audio.heistStart();
    else if (next === 'won') audio.heistWin();
    else if (next === 'secondChance' || (next === 'lost' && status !== 'secondChance')) audio.heistLose();
    else if (next === null && (status === 'ready' || status === 'fighting')) audio.heistLose();
    status = next;
  });
}

/** The last level-up in a batch of core events (only it gets a jingle). */
function lastLevelUp(events: readonly CoreEvent[]): CoreEvent | undefined {
  for (let i = events.length - 1; i >= 0; i--) if (events[i].type === 'levelUp') return events[i];
  return undefined;
}
