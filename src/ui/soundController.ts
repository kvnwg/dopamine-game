/**
 * Connects the synthesized audio to the game: unlocks audio on the first tap, plays a pop on
 * every button, maps core events to sounds, follows the Sound/Music settings, and goes quiet
 * while the app is in the background.
 */
import { BAL } from '../data';
import { stageInfo, type CoreEvent } from '../core';
import { bus } from '../app/eventBus';
import { gameStore, getGame } from '../app/store';
import { audio } from '../services/audio';

export function installSound(): () => void {
  const onDown = (e: PointerEvent) => {
    audio.unlock();
    const btn = (e.target as Element | null)?.closest?.('button');
    // The dumpster has its own lid clunk.
    if (btn && !btn.hasAttribute('data-no-tap-sound')) audio.tap();
  };
  document.addEventListener('pointerdown', onDown, true);

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

  const unsubBus = bus.on((events: CoreEvent[]) => {
    for (const e of events) {
      switch (e.type) {
        case 'playerHit':
          audio.hit(e.crit);
          break;
        case 'enemyHit':
          audio.hurt(e.heavy);
          break;
        case 'playerDodge':
          audio.dodge();
          break;
        case 'kill':
          audio.kill(e.kind !== 'regular');
          break;
        case 'bagDrop':
          audio.bag();
          break;
        case 'levelUp':
          audio.levelUp(e.level);
          break;
        case 'bossSpecial':
          audio.bossWarn();
          break;
        case 'waveStart':
          if (e.wave === BAL.stages.wavesPerStage - 1 && stageInfo(e.stage).kind !== 'regular') audio.bossIntro();
          break;
        case 'playerDeath':
          audio.death();
          break;
        case 'stageClear':
          if (e.firstTime && stageInfo(e.stage).kind === 'regular') audio.stageClear();
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
        case 'equip':
          if (!e.auto) audio.equip();
          break;
        case 'recycle':
          audio.recycle(e.auto);
          break;
        case 'offlineCollected':
          audio.collect();
          break;
      }
    }
  });

  return () => {
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('visibilitychange', onVis);
    unsubStore();
    unsubBus();
  };
}
