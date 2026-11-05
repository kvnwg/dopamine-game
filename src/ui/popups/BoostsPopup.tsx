/**
 * The Boosts panel (opened from the Roll tab): Quick Dive, Potion Brew, Duct-Tape Reel and the Bonus
 * Crate (core/systems/boosts.ts). Each card says what it gives and how many are left today; it takes a
 * rewarded ad or its Gem price. On CrazyGames: the ad buttons live here, in a panel the player opens, never
 * over the battle or the reels; one that's used up says when it's back (a timer); the Gem price is always
 * beside the ad; and with no ad able to play only the Gem price shows.
 */
import type { ReactNode } from 'react';
import { BAL } from '../../data';
import {
  boostBlocked, boostEndsAt, boostGems, boostUsesLeft, crateOdds, crateReadyAt, formatNumber, quickDiveRolls, type BoostBlock, type BoostId,
} from '../../core';
import { dispatch, useGame } from '../../app/store';
import { ads, haptics, type AdPlacement } from '../../services';
import { useAdReady } from '../adReady';
import { clockText, msToMidnight } from '../components/heistShared';
import { BagIcon, DumpsterIcon, GemIcon, PotionIcon, ReelIcon, TvIcon } from '../components/Icons';
import { useNow } from '../hooks';
import { t } from '../i18n';
import { Modal } from './Modal';
import s from './popups.module.css';

const B = BAL.boosts;

const PLACEMENT: Record<BoostId, AdPlacement> = {
  quickDive: 'quick_dive',
  potionBrew: 'potion_brew',
  ductTapeReel: 'duct_tape_reel',
  bonusCrate: 'bonus_crate',
};

const ICON: Record<BoostId, ReactNode> = {
  quickDive: <DumpsterIcon size="nav" />,
  potionBrew: <PotionIcon size="nav" />,
  ductTapeReel: <ReelIcon size="nav" />,
  bonusCrate: <BagIcon size="nav" />,
};

function crateOddsText(): string {
  return crateOdds()
    .map(({ reward, chance }) => {
      const pct = Math.round(chance * 100);
      return reward.kind === 'bags' ? t('boosts.crateBags', { pct }) : reward.kind === 'coins' ? t('boosts.crateCoins', { pct }) : t('boosts.cratePotion', { pct });
    })
    .join(' · ');
}

function BoostCard({ id, now }: { id: BoostId; now: number }) {
  const blocked = useGame((g) => boostBlocked(g, id, now));
  const left = useGame((g) => boostUsesLeft(g, id, now));
  const gems = useGame((g) => g.currencies.gems);
  const price = useGame((g) => boostGems(g, id, now));
  const endsAt = useGame((g) => boostEndsAt(g, id, now));
  const crateAt = useGame(crateReadyAt);
  const rolls = useGame((g) => (id === 'quickDive' ? quickDiveRolls(g) : 0));
  const adReady = useAdReady(PLACEMENT[id]);

  const text =
    id === 'quickDive'
      ? t('boosts.quickDiveText', { hours: B.quickDive.hours, n: formatNumber(rolls) })
      : id === 'potionBrew'
        ? t('boosts.potionBrewText', { mult: B.potionBrew.mult, minutes: B.potionBrew.minutes })
        : id === 'ductTapeReel'
          ? t('boosts.ductTapeReelText', { minutes: B.ductTapeReel.minutes })
          : t('boosts.bonusCrateText', { odds: crateOddsText() });
  const status = statusLine(blocked, { now, endsAt, crateAt, left, max: B[id].perDay });

  const watch = async () => {
    const r = await ads.showRewarded(PLACEMENT[id]);
    if (!r.rewarded) return;
    haptics.impact('medium');
    dispatch({ type: 'boost', id, via: 'ad' });
  };
  const pay = () => {
    if (gems < price) return;
    haptics.impact('medium');
    dispatch({ type: 'boost', id, via: 'gems' });
  };

  return (
    <div className={s.boostCard} data-blocked={blocked ?? undefined}>
      <span className={s.boostIcon}>{ICON[id]}</span>
      <div className={s.boostText}>
        <span className={s.boostName}>{t(`boosts.${id}`)}</span>
        <span className={s.boostDesc}>{text}</span>
        <span className={blocked === 'active' ? s.boostOn : s.boostStatus}>{status}</span>
      </div>
      {blocked === null && (
        <div className={s.boostBtns}>
          {adReady && (
            <button className="btn blue small" onClick={watch}>
              <TvIcon />
              {t('boosts.watch')}
            </button>
          )}
          <button className="btn gold small" disabled={gems < price} onClick={pay}>
            <GemIcon /> {price}
          </button>
        </div>
      )}
    </div>
  );
}

/** What a card says under its text: how many are left, or why it can't be taken now (with a timer). */
function statusLine(
  blocked: BoostBlock | null,
  p: { now: number; endsAt: number | null; crateAt: number; left: number; max: number },
): string {
  switch (blocked) {
    case null:
      return t('boosts.left', { n: p.left, max: p.max });
    case 'limit':
      return t('boosts.limit', { time: clockText(msToMidnight(p.now)) });
    case 'active':
      return t('boosts.active', { time: clockText((p.endsAt ?? p.now) - p.now) });
    case 'cooldown':
      return t('boosts.cooldown', { time: clockText(p.crateAt - p.now) });
    case 'maxReels':
      return t('boosts.maxReels');
    case 'nothing':
      return t('boosts.nothing');
  }
}

export function BoostsPopup({ onClose }: { onClose: () => void }) {
  const now = useNow(500);
  return (
    <Modal title={t('boosts.title')} subtitle={t('boosts.subtitle')} tone="purple" onClose={onClose}>
      <div className={s.boostList}>
        {(['bonusCrate', 'quickDive', 'potionBrew', 'ductTapeReel'] as const).map((id) => (
          <BoostCard key={id} id={id} now={now} />
        ))}
      </div>
    </Modal>
  );
}
