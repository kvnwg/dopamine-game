import type { CSSProperties } from 'react';
import { formatDuration, formatNumber, type PendingOffline } from '../../core';
import { dispatch } from '../../app/store';
import { rarityColor } from '../../render/art';
import { ads, haptics } from '../../services';
import { BagIcon, CoinIcon, StarIcon, TrashIcon, TvIcon } from '../components/Icons';
import { ItemIcon } from '../components/ItemIcon';
import { t } from '../i18n';
import { Modal } from './Modal';
import s from './popups.module.css';

/** Rare finds shown as tiles (the rest are counted as "+N more"). */
const SHOWN_FINDS = 10;

/**
 * What the dumpster rolled while the raccoon was away: the count, then the rare finds that went into
 * the bag as tiles, best first, the rarest one glowing.
 */
function OfflineFinds({ pending }: { pending: PendingOffline }) {
  if (pending.rolls <= 0) return null;
  const shown = pending.found.slice(0, SHOWN_FINDS);
  const more = Math.max(0, pending.foundCount - shown.length);
  return (
    <div className={s.offlineRolls}>
      <p className={s.rolledLine}>{t('offline.rolled', { n: formatNumber(pending.rolls) })}</p>
      {shown.length === 0 ? (
        <p className={s.noFinds}>{t('offline.noFinds')}</p>
      ) : (
        <>
          <p className={s.findsTitle}>{t('offline.finds')}</p>
          <div className={s.finds}>
            {shown.map((it, i) => (
              <div
                key={it.uid}
                className={i === 0 ? `${s.find} ${s.findBest}` : s.find}
                style={{ ['--c' as string]: rarityColor(it.rarity) } as CSSProperties}
              >
                <ItemIcon item={it} showPower={false} />
              </div>
            ))}
            {more > 0 && <div className={s.findMore}>{t('offline.more', { n: formatNumber(more) })}</div>}
          </div>
        </>
      )}
    </div>
  );
}

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
        <TrashIcon size="nav" />
        <TrashIcon size="nav" />
        <TrashIcon size="nav" />
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
      <OfflineFinds pending={pending} />
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
