/** Rebirth: reach the stage and gold requirement to restart with permanent luck and gold multipliers. */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { BAL } from '../../data';
import {
  canRebirth, formatNumber, rebirthGoldMult, rebirthLuckMult, rebirthRequirement,
} from '../../core';
import { dispatch, useGame } from '../../app/store';
import { haptics } from '../../services';
import { t } from '../i18n';
import { Chunky } from './Chunky';
import { ArrowUpIcon, CheckIcon, CloverIcon, CoinIcon, RebirthIcon, SwordIcon } from './Icons';
import s from './panels.module.css';
import { UnlockPreview } from './Unlocks';

function discount(n: number): number {
  return Math.round((1 - Math.pow(1 - BAL.rebirth.upgradeDiscountPer, n)) * 100);
}

function Reward({ icon, color, label, from, to }: { icon: ReactNode; color: string; label: string; from: string; to: string }) {
  return (
    <div className={s.rbReward} style={{ ['--rc' as string]: color } as CSSProperties}>
      {icon}
      <div className={s.rbRewardText}>
        <span className={s.rbRewardName}>{label}</span>
        <span className={s.rbFromTo}>
          {from} <b>▶</b> <em>{to}</em>
        </span>
      </div>
    </div>
  );
}

function Req({ label, have, need, done }: { label: string; have: number; need: number; done: boolean }) {
  return (
    <div className={s.req}>
      {done ? <CheckIcon size="md" /> : <span className={s.reqDot} />}
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
    <div className={`${s.panel} ${s.rbPanel}`}>
      <div className={`${s.rbHero} card`}>
        <RebirthIcon size="nav" className={s.rbIcon} />
        <div className={s.rbTitles}>
          <Chunky text={t('rebirth.title')} size={56} grad="purple" />
          <span className={s.rbCount}>{t('rebirth.count', { n })}</span>
          <span className={s.rbSub}>{t('rebirth.sub')}</span>
        </div>
      </div>
      <div className={`${s.rbCard} card`}>
        <span className={s.cardLabel}>{t('rebirth.need')}</span>
        <Req label={t('rebirth.reqWorld', { n: req.world })} have={highest} need={req.world} done={highest >= req.world} />
        <Req label={t('rebirth.reqGold', { gold: formatNumber(req.gold) })} have={coins} need={req.gold} done={coins >= req.gold} />
      </div>
      <div className={`${s.rbCard} card`}>
        <span className={s.cardLabel}>{t('rebirth.rewards')}</span>
        <div className={s.rbRewards}>
          <Reward icon={<CloverIcon size="md" />} color="#46d36b" label={t('rebirth.rLuck')} from={`×${rebirthLuckMult(n).toFixed(2)}`} to={`×${rebirthLuckMult(n + 1).toFixed(2)}`} />
          <Reward icon={<CoinIcon size="md" />} color="#ffc233" label={t('rebirth.rGold')} from={`×${rebirthGoldMult(n).toFixed(1)}`} to={`×${rebirthGoldMult(n + 1).toFixed(1)}`} />
          <Reward icon={<SwordIcon size="md" />} color="#ef5350" label={t('rebirth.rPower')} from={`+${n * BAL.rebirth.statPctPer}%`} to={`+${(n + 1) * BAL.rebirth.statPctPer}%`} />
          <Reward icon={<ArrowUpIcon size="md" />} color="#42a5f5" label={t('rebirth.rCost')} from={discount(n) > 0 ? `-${discount(n)}%` : '0%'} to={`-${discount(n + 1)}%`} />
        </div>
        <span className={s.rbNote}>{t('rebirth.resets')}</span>
        <span className={s.rbNote}>{t('rebirth.keeps')}</span>
      </div>
      <div className={`${s.rbCard} card`}>
        <UnlockPreview />
      </div>
      <button className={`btn ${ready ? 'gold breathe' : 'gray'} ${s.rbGo}`} disabled={!ready} onClick={go}>
        <RebirthIcon size="md" />
        {ready ? (armed ? t('rebirth.confirm') : t('rebirth.go')) : t('rebirth.notYet')}
      </button>
    </div>
  );
}
