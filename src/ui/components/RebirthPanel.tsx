/** Rebirth: reach the stage and gold requirement to restart with permanent luck and gold multipliers. */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { BAL } from '../../data';
import {
  boostBlocked, boostEndsAt, boostUsesLeft, canRebirth, formatNumber, perksOpen, rebirthGoldMult, rebirthLuckMult, rebirthRequirement,
} from '../../core';
import { dispatch, getGame, useGame } from '../../app/store';
import { haptics } from '../../services';
import { t } from '../i18n';
import { Chunky } from './Chunky';
import { ArrowUpIcon, CheckIcon, CloverIcon, CoinIcon, PotionIcon, RebirthIcon, SwordIcon } from './Icons';
import s from './panels.module.css';
import { UnlockPreview } from './Unlocks';
import { BoostButtons } from './BoostButtons';
import { clockText, msToMidnight } from './heistShared';
import { useNow } from '../hooks';
import pop from '../popups/popups.module.css';

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
  // With perks open, a rebirth also eats the run's loaves and perks.
  const perks = useGame(perksOpen);
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
        <span className={s.rbNote}>{t(perks ? 'rebirth.resetsPerks' : 'rebirth.resets')}</span>
        <span className={s.rbNote}>{t('rebirth.keeps')}</span>
      </div>
      <div className={`${s.rbCard} card`}>
        <UnlockPreview />
      </div>
      <Blessing />
      <button className={`btn ${ready ? 'gold breathe' : 'gray'} ${s.rbGo}`} disabled={!ready} onClick={go}>
        <RebirthIcon size="md" />
        {ready ? (armed ? t('rebirth.confirm') : t('rebirth.go')) : t('rebirth.notYet')}
      </button>
    </div>
  );
}

/**
 * Rebirth Blessing (a boost, core/systems/boosts.ts): taken here, for an ad or Gems, before rebirthing,
 * so the ad is never on the Rebirth button itself (a rebirth can't be undone). The next rebirth's first
 * minutes then spin faster. Shows once Boosts are open.
 */
function Blessing() {
  const now = useNow(1000);
  const open = useGame((g) => g.features.unlocked.includes('boosts'));
  const blocked = useGame((g) => boostBlocked(g, 'rebirthBlessing', now));
  const ready = useGame((g) => g.boosts.blessReady);
  const endsAt = useGame((g) => boostEndsAt(g, 'rebirthBlessing', now));
  if (!open) return null;
  const B = BAL.boosts.rebirthBlessing;
  const status = ready
    ? t('boosts.blessingReady')
    : endsAt !== null
      ? t('boosts.active', { time: clockText(endsAt - now) })
      : blocked === 'limit'
        ? t('boosts.limit', { time: clockText(msToMidnight(now)) })
        : t('boosts.left', { n: boostUsesLeft(getGame(), 'rebirthBlessing', now), max: B.perDay });
  return (
    <div className={`${pop.boostOffer} ${s.rbBless}`}>
      <PotionIcon size="nav" />
      <div className={pop.boostOfferText}>
        <b>{t('boosts.rebirthBlessing')}</b>
        <span>{t('boosts.blessingText', { minutes: B.minutes, mult: B.speedMult })}</span>
        <span className={ready || endsAt !== null ? pop.boostOn : pop.boostStatus}>{status}</span>
      </div>
      <BoostButtons id="rebirthBlessing" column />
    </div>
  );
}
