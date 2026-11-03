import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { BAL, DATA } from '../../data';
import { nextWorldAvailable, worldThreat } from '../../core';
import { dispatch, useGame } from '../../app/store';
import { createBattleGame } from '../../render/BattleScene';
import { haptics } from '../../services';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { GlobeIcon, SkullIcon } from './Icons';
import { TopHud } from './TopHud';
import s from './hud.module.css';

export function worldLabel(world: number): string {
  const w = DATA.worlds[world - 1];
  return t('battle.worldLabel', { n: world, name: w?.name ?? '' });
}

export function BattlePanel() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let game: Phaser.Game | null = null;
    if (host.current) game = createBattleGame(host.current);
    return () => game?.destroy(true);
  }, []);

  const world = useGame((g) => g.battle.stage);
  const wave = useGame((g) => g.battle.wave);
  const mode = useGame((g) => g.stage.mode);
  const hint = useGame((g) => g.stage.showToughHint);
  // "Too tough!" is a passing notice when the raccoon is beaten (not a sign that stays up while farming).
  const hintWas = useRef(hint);
  useEffect(() => {
    if (hint && !hintWas.current) useUi.getState().toast(t('battle.toughHint'), 'warn');
    hintWas.current = hint;
  }, [hint]);
  const highest = useGame((g) => g.stage.highestCleared);
  const next = useGame(nextWorldAvailable);
  const nextThreat = useGame((g) => (next !== null ? worldThreat(g, next).level : null));
  const waves = BAL.stages.wavesPerStage;
  const drag = useUi((u) => u.drag);
  // First-time nudge: nothing worn yet but gear waiting in the bag.
  const bare = useGame((g) => g.inventory.length > 0 && Object.values(g.equipped).every((it) => !it));

  return (
    <div className={s.battle} data-drop="equip">
      <div className={s.canvasHost} ref={host} />
      {drag && (
        <div className={`${s.dropRing} ${drag.over ? s.dropRingOn : ''}`}>
          <span className={s.dropLabel}>{t('drag.ring')}</span>
        </div>
      )}
      {bare && !drag && (
        <div className={s.dragTip}>
          {t('drag.tip')}
          <span className={s.dragTipArrow} />
        </div>
      )}
      <TopHud />
      {/* The world's name shows as a title card on arrival, then leaves the sky clear. */}
      <div key={world} className={s.worldCard} aria-hidden>
        {worldLabel(world)}
      </div>
      <div className={s.battleActions}>
        <button className={`btn small blue ${s.worldsBtn}`} onClick={() => useUi.getState().setTab('worlds')} aria-label={t('tab.worlds')}>
          <GlobeIcon size={46} />
        </button>
        <button className={s.waveBox} onClick={() => useUi.getState().setTab('worlds')} aria-label={worldLabel(world)}>
          <div className={s.waveTrack}>
            {Array.from({ length: waves }, (_, i) => {
              const boss = i === waves - 1;
              return (
                <span key={i} className={s.waveSeg}>
                  {i > 0 && <span className={`${s.waveLine} ${i <= wave ? s.waveLineDone : ''}`} />}
                  {boss ? (
                    <SkullIcon size={i === wave ? 40 : 34} className={i < wave ? s.waveDone : ''} />
                  ) : (
                    <span className={[s.waveDot, i < wave ? s.waveDotDone : '', i === wave ? s.waveDotNow : ''].join(' ')} />
                  )}
                </span>
              );
            })}
          </div>
          {mode === 'farm' && world <= highest && <span className={s.farmTag}>{t('battle.farming')}</span>}
        </button>
        <span style={{ flex: 1 }} />
        {next !== null && mode === 'farm' && (
          <button
            className={`btn small ${nextThreat === 'easy' ? 'breathe' : nextThreat === 'tough' ? '' : 'red'}`}
            onClick={() => {
              haptics.impact('medium');
              dispatch({ type: 'travel', world: next });
            }}
          >
            {t('battle.nextWorld', { n: next })}
          </button>
        )}
      </div>
    </div>
  );
}
