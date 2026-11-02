import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { BAL } from '../../data';
import { bossStageAvailable, canPushStage, stageInfo } from '../../core';
import { dispatch, useGame } from '../../app/store';
import { createBattleGame } from '../../render/BattleScene';
import { haptics } from '../../services';
import { t } from '../i18n';
import s from './panels.module.css';

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
  const farming = stage <= highest;

  return (
    <div className={s.battle}>
      <div className={s.canvasHost} ref={host} />
      <div className={s.vignette} />
      <div className={s.stageLabel}>
        <span className={s.stageName}>{stageLabel(stage)}</span>
        <div className={s.waveDots}>
          {Array.from({ length: waves }, (_, i) => (
            <span
              key={i}
              className={[
                s.waveDot,
                i < wave ? s.waveDotDone : '',
                i === wave ? s.waveDotNow : '',
                i === waves - 1 && info.kind !== 'regular' ? s.waveDotBoss : '',
              ].join(' ')}
            />
          ))}
        </div>
        {farming && <span className={s.farmTag}>{t(mode === 'farm' ? 'battle.farming' : 'battle.replaying')}</span>}
      </div>
      <div className={s.battleActions}>
        {bossStage !== null && (
          <button
            className={`btn ${s.fightBoss}`}
            onClick={() => {
              haptics.impact('medium');
              dispatch({ type: 'fightBoss' });
            }}
          >
            {t(stageInfo(bossStage).kind === 'boss' ? 'battle.fightBoss' : 'battle.fightMiniBoss')}
          </button>
        )}
        {canPush && (
          <button
            className="btn small"
            onClick={() => {
              haptics.impact('light');
              dispatch({ type: 'pushStage' });
            }}
          >
            {t('battle.tryAgain', { stage: stageLabel(highest + 1) })}
          </button>
        )}
      </div>
      {hint && (
        <div className={s.hint}>
          {t('battle.toughHint')} <span className={s.hintArrow}>👇</span>
        </div>
      )}
    </div>
  );
}
