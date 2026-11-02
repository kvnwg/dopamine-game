import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { BAL } from '../../data';
import { bossStageAvailable, canPushStage, stageInfo } from '../../core';
import { dispatch, useGame } from '../../app/store';
import { createBattleGame } from '../../render/BattleScene';
import { haptics } from '../../services';
import { t } from '../i18n';
import { SkullIcon, SwordIcon } from './Icons';
import { TopHud } from './TopHud';
import s from './hud.module.css';

export function stageLabel(stage: number): string {
  const info = stageInfo(stage);
  return t('battle.stageLabel', { name: info.neighborhood.name, n: info.neighborhoodIndex, local: info.local });
}

export function BattlePanel() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let game: Phaser.Game | null = null;
    if (host.current) game = createBattleGame(host.current);
    return () => game?.destroy(true);
  }, []);

  const stage = useGame((g) => g.battle.stage);
  const wave = useGame((g) => g.battle.wave);
  const mode = useGame((g) => g.stage.mode);
  const hint = useGame((g) => g.stage.showToughHint);
  const bossStage = useGame(bossStageAvailable);
  const canPush = useGame(canPushStage);
  const highest = useGame((g) => g.stage.highestCleared);
  const info = stageInfo(stage);
  const waves = BAL.stages.wavesPerStage;

  return (
    <div className={s.battle}>
      <div className={s.canvasHost} ref={host} />
      <TopHud />
      <div className={s.stageBox}>
        <span className={s.stageName}>{stageLabel(stage)}</span>
        <div className={s.waveTrack}>
          {Array.from({ length: waves }, (_, i) => {
            const boss = i === waves - 1 && info.kind !== 'regular';
            return (
              <span key={i} className={s.waveSeg}>
                {i > 0 && <span className={`${s.waveLine} ${i <= wave ? s.waveLineDone : ''}`} />}
                {boss ? (
                  <SkullIcon size={i === wave ? 50 : 40} className={i < wave ? s.waveDone : ''} />
                ) : (
                  <span className={[s.waveDot, i < wave ? s.waveDotDone : '', i === wave ? s.waveDotNow : ''].join(' ')} />
                )}
              </span>
            );
          })}
        </div>
        {mode === 'farm' && stage <= highest && <span className={s.farmTag}>{t('battle.farming')}</span>}
      </div>
      <div className={s.battleActions}>
        {canPush && (
          <button
            className="btn small"
            onClick={() => {
              haptics.impact('light');
              dispatch({ type: 'pushStage' });
            }}
          >
            {t('battle.tryNext', { stage: stageLabel(highest + 1) })}
          </button>
        )}
        <span style={{ flex: 1 }} />
        {bossStage !== null && (
          <button
            className="btn red breathe"
            onClick={() => {
              haptics.impact('medium');
              dispatch({ type: 'fightBoss' });
            }}
          >
            <SwordIcon size={50} />
            {t(stageInfo(bossStage).kind === 'boss' ? 'battle.fightBoss' : 'battle.fightMiniBoss')}
          </button>
        )}
      </div>
      {hint && <div className={s.hint}>{t('battle.toughHint')}</div>}
    </div>
  );
}
