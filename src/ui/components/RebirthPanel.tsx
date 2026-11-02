/** Rebirth: reach the stage and gold requirement to restart with permanent luck and gold multipliers. */
import { useState } from 'react';
import {
  canRebirth, formatNumber, rebirthGoldMult, rebirthLuckMult, rebirthRequirement,
} from '../../core';
import { dispatch, useGame } from '../../app/store';
import { haptics } from '../../services';
import { t } from '../i18n';
import { stageLabel } from './BattlePanel';
import { Chunky } from './Chunky';
import { CheckIcon, CloverIcon, CoinIcon, RebirthIcon } from './Icons';
import s from './panels.module.css';

function Req({ label, have, need, done }: { label: string; have: number; need: number; done: boolean }) {
  return (
    <div className={s.req}>
      {done ? <CheckIcon size={52} /> : <span className={s.reqDot} />}
      <div className={s.reqBody}>
        <span className={s.reqLabel}>{label}</span>
        <div className={s.reqTrack}>
          <div className={`${s.reqFill} ${done ? s.reqDone : ''}`} style={{ width: `${Math.min(100, (have / need) * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

export function RebirthPanel() {
  const n = useGame((g) => g.rebirths);
  const highest = useGame((g) => g.stage.highestCleared);
  const coins = useGame((g) => g.currencies.coins);
  const ready = useGame(canRebirth);
  const req = rebirthRequirement(n);
  const [armed, setArmed] = useState(false);
  const go = () => {
    if (!ready) return;
    if (!armed) {
      setArmed(true);
      haptics.impact('medium');
      setTimeout(() => setArmed(false), 3000);
      return;
    }
    setArmed(false);
    dispatch({ type: 'rebirth' });
  };
  return (
    <div className={s.panel}>
      <div className={`${s.rbHero} card`}>
        <RebirthIcon size={124} className={s.rbIcon} />
        <div className={s.rbTitles}>
          <Chunky text={t('rebirth.title')} size={66} grad="purple" />
          <span className={s.rbCount}>{t('rebirth.count', { n })}</span>
          <span className={s.rbSub}>{t('rebirth.sub')}</span>
        </div>
      </div>
      <div className={`${s.rbCard} card`}>
        <span className={s.cardLabel}>{t('rebirth.need')}</span>
        <Req label={t('rebirth.reqStage', { stage: stageLabel(req.stage) })} have={highest} need={req.stage} done={highest >= req.stage} />
        <Req label={t('rebirth.reqGold', { gold: formatNumber(req.gold) })} have={coins} need={req.gold} done={coins >= req.gold} />
      </div>
      <div className={`${s.rbCard} card`}>
        <span className={s.cardLabel}>{t('rebirth.rewards')}</span>
        <div className={s.rbRewards}>
          <div className={s.rbReward} style={{ ['--rc' as string]: '#46d36b' }}>
            <CloverIcon size={78} />
            <div className={s.rbRewardText}>
              <span className={s.rbRewardName}>{t('rebirth.luck')}</span>
              <span className={s.rbFromTo}>
                ×{rebirthLuckMult(n).toFixed(2)} <b>▶</b> <em>×{rebirthLuckMult(n + 1).toFixed(2)}</em>
              </span>
            </div>
          </div>
          <div className={s.rbReward} style={{ ['--rc' as string]: '#ffc233' }}>
            <CoinIcon size={74} />
            <div className={s.rbRewardText}>
              <span className={s.rbRewardName}>{t('rebirth.gold')}</span>
              <span className={s.rbFromTo}>
                ×{rebirthGoldMult(n).toFixed(1)} <b>▶</b> <em>×{rebirthGoldMult(n + 1).toFixed(1)}</em>
              </span>
            </div>
          </div>
        </div>
        <span className={s.rbNote}>{t('rebirth.resets')}</span>
        <span className={s.rbNote}>{t('rebirth.keeps')}</span>
      </div>
      <button className={`btn ${ready ? 'gold breathe' : 'gray'} ${s.rbGo}`} disabled={!ready} onClick={go}>
        <RebirthIcon size={64} />
        {ready ? (armed ? t('rebirth.confirm') : t('rebirth.go')) : t('rebirth.notYet')}
      </button>
    </div>
  );
}
