import { formatDuration, formatNumber, type PendingOffline } from '../../core';
import { dispatch } from '../../app/store';
import { ads, haptics } from '../../services';
import { BagIcon, CoinIcon, StarIcon, TrashIcon, TvIcon } from '../components/Icons';
import { t } from '../i18n';
import { Modal } from './Modal';
import s from './popups.module.css';

export function OfflinePopup({ pending }: { pending: PendingOffline }) {
  const collect = async (doubled: boolean) => {
    if (doubled) {
      const r = await ads.showRewarded('offline_double');
      if (!r.rewarded) return;
    }
    haptics.impact(doubled ? 'heavy' : 'medium');
    dispatch({ type: 'collectOffline', doubled });
  };
  return (
    <Modal title={t('offline.title')} subtitle={t('offline.away', { time: formatDuration(pending.awayMs / 1000) })}>
      <div className={s.pile}>
        <TrashIcon size="lg" />
        <TrashIcon size="lg" />
        <TrashIcon size="lg" />
      </div>
      <div className={s.rewardList}>
        <div className={s.rewardRow}>
          <BagIcon size="md" /> {t('offline.bags', { n: formatNumber(pending.bags) })}
        </div>
        <div className={s.rewardRow}>
          <CoinIcon size="md" /> {formatNumber(pending.coins)}
        </div>
        <div className={s.rewardRow}>
          <StarIcon size="md" /> {t('offline.xp', { n: formatNumber(pending.xp) })}
        </div>
      </div>
      <div className={s.actions}>
        <button className="btn" onClick={() => collect(false)}>
          {t('offline.collect')}
        </button>
        {pending.canDouble && (
          <button className="btn blue" onClick={() => collect(true)}>
            <TvIcon />
            {t('offline.collectDouble')}
          </button>
        )}
      </div>
    </Modal>
  );
}
