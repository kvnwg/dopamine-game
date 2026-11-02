import { BAL, RARITIES } from '../../data';
import {
  adSpeedupsLeft, formatDuration, formatNumber, gemSpeedupCost, rarityOddsAt, upgradeCost, upgradeSeconds,
} from '../../core';
import { dispatch, useGame } from '../../app/store';
import { rarityColor } from '../../render/art';
import { ads, haptics } from '../../services';
import { CoinIcon, GemIcon } from '../components/Icons';
import { useNow } from '../hooks';
import { t } from '../i18n';
import { Modal } from './Modal';
import s from './popups.module.css';

function pct(v: number) {
  if (v === 0) return '—';
  return `${(v * 100).toFixed(v < 0.01 ? 2 : 1)}%`;
}

export function UpgradePopup({ onClose }: { onClose: () => void }) {
  const now = useNow(250);
  const g = useGame((x) => x);
  const level = g.dumpster.level;
  const endsAt = g.dumpster.upgradeEndsAt;
  const maxed = level >= BAL.dumpster.maxLevel;
  const cost = upgradeCost(level);
  const cur = rarityOddsAt(level);
  const next = rarityOddsAt(Math.min(level + 1, BAL.dumpster.maxLevel));
  const remaining = endsAt !== null ? endsAt - now : 0;
  const gemCost = gemSpeedupCost(remaining);
  const adsLeft = adSpeedupsLeft(g, now);

  return (
    <Modal title={t('upgrade.title', { level })} onClose={onClose}>
      <div className={s.inset}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>{t('odds.rarity')}</th>
            <th>{t('upgrade.now', { level })}</th>
            {!maxed && <th>{t('upgrade.next', { level: level + 1 })}</th>}
          </tr>
        </thead>
        <tbody>
          {RARITIES.filter((r) => cur[r] > 0 || next[r] > 0).map((r) => (
            <tr key={r}>
              <td style={{ color: rarityColor(r), fontWeight: 900 }}>{t(`rarity.${r}`)}</td>
              <td>{pct(cur[r])}</td>
              {!maxed && <td style={{ color: next[r] > cur[r] ? 'var(--good)' : undefined }}>{pct(next[r])}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {maxed ? (
        <p className={s.subtitle} style={{ marginTop: 30 }}>{t('dumpster.maxed')}</p>
      ) : endsAt !== null ? (
        <>
          <p className={s.title} style={{ marginTop: 30, fontSize: 52 }}>
            ⏳ {formatDuration(remaining / 1000)}
          </p>
          <div className={s.actions}>
            <button
              className="btn alt"
              disabled={adsLeft <= 0}
              onClick={async () => {
                const r = await ads.showRewarded('dumpster_speedup');
                if (r.rewarded) dispatch({ type: 'speedupDumpsterAd' });
              }}
            >
              📺 {t('upgrade.adSpeedup', { minutes: BAL.dumpster.adSpeedup.minutes, left: adsLeft, max: BAL.dumpster.adSpeedup.perDay })}
            </button>
            <button
              className="btn buy"
              disabled={g.currencies.gems < gemCost}
              onClick={() => {
                haptics.impact('medium');
                dispatch({ type: 'speedupDumpsterGems' });
              }}
            >
              {t('upgrade.finishNow')} <GemIcon /> {gemCost}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={s.subtitle} style={{ marginTop: 30 }}>
            {t('upgrade.takes', { time: formatDuration(upgradeSeconds(level)) })}
          </p>
          <div className={s.actions}>
            <button
              className={`btn buy ${g.currencies.coins >= cost ? 'breathe' : ''}`}
              disabled={g.currencies.coins < cost}
              onClick={() => {
                haptics.impact('medium');
                dispatch({ type: 'startDumpsterUpgrade' });
              }}
            >
              {t('upgrade.start')} <CoinIcon /> {formatNumber(cost)}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
