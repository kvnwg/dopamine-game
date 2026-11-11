import { BAL } from '../../data';
import { adSpeedupsLeft, formatDuration, formatNumber, gemSpeedupCost, upgradeCost, upgradeSeconds, formatPct } from '../../core';
import { dispatch, useGame } from '../../app/store';
import { dumpsterArt } from '../../render/icons';
import { ads, haptics } from '../../services';
import { useAdReady } from '../adReady';
import { ClockIcon, CloverIcon, CoinIcon, GemIcon, TvIcon } from '../components/Icons';
import { PixelArt } from '../components/PixelArt';
import { useNow } from '../hooks';
import { t } from '../i18n';
import { Modal } from './Modal';
import s from './popups.module.css';

/** Dumpster Level upgrade: each level adds luck; upgrades take real time (speed up with gems or ads). */
export function UpgradePopup({ onClose }: { onClose: () => void }) {
  const now = useNow(250);
  const g = useGame((x) => x);
  const level = g.dumpster.level;
  const endsAt = g.dumpster.upgradeEndsAt;
  const maxed = level >= BAL.dumpster.maxLevel;
  const cost = upgradeCost(level);
  const per = BAL.dumpster.luckPerLevel;
  const remaining = endsAt !== null ? endsAt - now : 0;
  const gemCost = gemSpeedupCost(remaining);
  const adsLeft = adSpeedupsLeft(g, now);
  // (Hidden when no ad can play, or none are left today: the Gem Finish is the way then.)
  const adReady = useAdReady('dumpster_speedup');
  const art = dumpsterArt();
  const pityLevel = BAL.dumpster.badLuck.minDumpsterLevel;
  return (
    <Modal title={t('dumpster.title', { level })} tone="green" onClose={onClose}>
      <div className={s.binHero}>
        <PixelArt art={art.body} className={s.binHeroBody} />
        <PixelArt art={art.lid} className={s.binHeroLid} />
      </div>
      <div className={s.luckLine}>
        <CloverIcon size="md" />
        {maxed
          ? t('luck.dumpster', { level })
          : t('dumpster.luckLine', { now: formatPct((level - 1) * per), next: formatPct(level * per) })}
      </div>
      {!maxed && level + 1 === pityLevel && <p className={s.note}>{t('dumpster.unlocksPity', { level: pityLevel })}</p>}
      {maxed ? (
        <p className={s.subtitle}>{t('dumpster.maxed')}</p>
      ) : endsAt !== null ? (
        <>
          <div className={s.timer}>
            <ClockIcon size="md" />
            {formatDuration(remaining / 1000)}
          </div>
          <div className={s.actions}>
            {adReady && adsLeft > 0 && (
              <button
                className="btn blue"
                onClick={async () => {
                  const r = await ads.showRewarded('dumpster_speedup');
                  if (r.rewarded) dispatch({ type: 'speedupDumpsterAd' });
                }}
              >
                <TvIcon />
                {t('dumpster.adSpeedup', { minutes: BAL.dumpster.adSpeedup.minutes, left: adsLeft, max: BAL.dumpster.adSpeedup.perDay })}
              </button>
            )}
            <button
              className="btn gold"
              disabled={g.currencies.gems < gemCost}
              onClick={() => {
                haptics.impact('medium');
                dispatch({ type: 'speedupDumpsterGems' });
              }}
            >
              {t('dumpster.finishNow')} <GemIcon /> {gemCost}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={s.subtitle}>{t('dumpster.takes', { time: formatDuration(upgradeSeconds(level)) })}</p>
          <div className={s.actions}>
            <button
              className={`btn ${g.currencies.coins >= cost ? 'breathe' : 'gray'}`}
              disabled={g.currencies.coins < cost}
              onClick={() => {
                haptics.impact('medium');
                dispatch({ type: 'startDumpsterUpgrade' });
              }}
            >
              {t('dumpster.start')} <CoinIcon /> {formatNumber(cost)}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
