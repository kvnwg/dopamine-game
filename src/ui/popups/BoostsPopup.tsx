/**
 * The Boosts panel (opened from the Roll tab): Quick Dive, Potion Brew, Duct-Tape Reel and the Bonus
 * Crate any time, and on top, while they're on offer, an Encore (a big chain's spin again) and Boss Rage
 * (core/systems/boosts.ts). Each card says what it gives and how many are left today; it takes a rewarded
 * ad or its Gem price. On CrazyGames: the ad buttons live here, in a panel the player opens, never over the
 * battle or the reels; one that's used up says when it's back (a timer); the Gem price is always beside the
 * ad; and with no ad able to play only the Gem price shows.
 */
import type { ReactNode } from 'react';
import { BAL, DATA } from '../../data';
import {
  boostBlocked, boostEndsAt, boostUsesLeft, crateOdds, crateReadyAt, encoreOffer, formatNumber, quickDiveRolls, PANEL_BOOSTS, type BoostBlock,
  type BoostId,
} from '../../core';
import { useGame } from '../../app/store';
import { BoostButtons } from '../components/BoostButtons';
import { clockText, msToMidnight } from '../components/heistShared';
import { BagIcon, DumpsterIcon, PotionIcon, ReelIcon, SwordIcon, CloverIcon } from '../components/Icons';
import { useNow } from '../hooks';
import { t } from '../i18n';
import { Modal } from './Modal';
import s from './popups.module.css';

const B = BAL.boosts;

const ICON: Partial<Record<BoostId, ReactNode>> = {
  quickDive: <DumpsterIcon size="nav" />,
  potionBrew: <PotionIcon size="nav" />,
  ductTapeReel: <ReelIcon size="nav" />,
  bonusCrate: <BagIcon size="nav" />,
  encore: <CloverIcon size="nav" />,
  bossRage: <SwordIcon size="nav" />,
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
  const endsAt = useGame((g) => boostEndsAt(g, id, now));
  const crateAt = useGame(crateReadyAt);
  const rolls = useGame((g) => (id === 'quickDive' ? quickDiveRolls(g) : 0));
  const encore = useGame((g) => encoreOffer(g, now));
  const rage = useGame((g) => g.boosts.rageWorld ?? g.boosts.rageOffer);

  const text =
    id === 'quickDive'
      ? t('boosts.quickDiveText', { hours: B.quickDive.hours, n: formatNumber(rolls) })
      : id === 'potionBrew'
        ? t('boosts.potionBrewText', { mult: B.potionBrew.mult, minutes: B.potionBrew.minutes })
        : id === 'ductTapeReel'
          ? t('boosts.ductTapeReelText', { minutes: B.ductTapeReel.minutes })
          : id === 'encore'
            ? t('boosts.encoreText', { mult: formatNumber(encore?.mult ?? 0) })
            : id === 'bossRage'
              ? t('boosts.bossRageText', { pct: Math.round((B.bossRage.atkMult - 1) * 100), n: rage ?? 0, name: DATA.worlds[(rage ?? 1) - 1]?.name ?? '' })
              : t('boosts.bonusCrateText', { odds: crateOddsText() });
  const status =
    id === 'encore' && encore && blocked === null
      ? t('boosts.encoreLeft', { time: clockText(encore.at + B.encore.minutes * 60_000 - now) })
      : id === 'bossRage' && blocked === 'active'
        ? t('boosts.rageOn', { n: rage ?? 0 })
        : statusLine(blocked, { now, endsAt, crateAt, left, max: B[id].perDay });

  return (
    <div className={s.boostCard} data-blocked={blocked ?? undefined} data-hot={id === 'encore' || id === 'bossRage' || undefined}>
      <span className={s.boostIcon}>{ICON[id]}</span>
      <div className={s.boostText}>
        <span className={s.boostName}>{t(`boosts.${id}`)}</span>
        <span className={s.boostDesc}>{text}</span>
        <span className={blocked === 'active' ? s.boostOn : s.boostStatus}>{status}</span>
      </div>
      <BoostButtons id={id} column />
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
  // The moment's offers first, while they're on: an Encore, Boss Rage (offered or on).
  const encore = useGame((g) => encoreOffer(g, now) !== null && boostBlocked(g, 'encore', now) !== 'limit');
  const rage = useGame((g) => g.boosts.rageOffer !== null || g.boosts.rageWorld !== null);
  return (
    <Modal title={t('boosts.title')} subtitle={t('boosts.subtitle')} tone="purple" onClose={onClose}>
      <div className={s.boostList}>
        {encore && <BoostCard id="encore" now={now} />}
        {rage && <BoostCard id="bossRage" now={now} />}
        {(['bonusCrate', ...PANEL_BOOSTS.filter((x) => x !== 'bonusCrate')] as const).map((id) => (
          <BoostCard key={id} id={id} now={now} />
        ))}
      </div>
    </Modal>
  );
}
