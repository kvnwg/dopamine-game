import { BAL } from '../../data';
import { formatDuration, formatNumber, itemName, upgradeCost } from '../../core';
import { dispatch, useGame } from '../../app/store';
import { rarityColor } from '../../render/art';
import { haptics } from '../../services';
import { useNow } from '../hooks';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { Dumpster } from './Dumpster';
import { CoinIcon } from './Icons';
import { ItemIcon } from './ItemIcon';
import s from './panels.module.css';

export function DumpsterPanel() {
  const now = useNow(250);
  const auto = useGame((g) => g.autoDive);
  const level = useGame((g) => g.dumpster.level);
  const endsAt = useGame((g) => g.dumpster.upgradeEndsAt);
  const coins = useGame((g) => g.currencies.coins);
  const dryStreak = useGame((g) => g.dumpster.dryStreak);
  const playMs = useGame((g) => g.playTimeMs);
  const lastItem = useUi((u) => u.lastItem);
  const openPopup = useUi((u) => u.openPopup);

  const maxed = level >= BAL.dumpster.maxLevel;
  const cost = upgradeCost(level);
  const affordable = !maxed && endsAt === null && coins >= cost;
  const bl = BAL.dumpster.badLuck;
  const showPity = level >= bl.minDumpsterLevel;
  const unlockIn = Math.max(0, BAL.autoDive.unlockPlayMinutes * 60 - playMs / 1000);

  return (
    <div className={s.dumpsterPanel}>
      <Dumpster />
      <div className={s.dumpsterSide}>
        <div className={s.row}>
          <button
            className={[s.toggle, auto.enabled ? s.toggleOn : '', !auto.unlocked ? s.toggleLocked : ''].join(' ')}
            onClick={() => {
              haptics.impact('light');
              if (!auto.unlocked) {
                useUi.getState().toast(t('autoDive.lockedToast', { time: formatDuration(unlockIn) }), 'info');
                return;
              }
              dispatch({ type: 'setAutoDive', enabled: !auto.enabled });
            }}
          >
            {auto.unlocked ? t(auto.enabled ? 'autoDive.on' : 'autoDive.off') : `🔒 ${t('autoDive.label')}`}
            {auto.unlocked && <span className={s.knob} />}
          </button>
          <button className={s.iconBtn} aria-label={t('filters.title')} onClick={() => openPopup('filters')}>
            🧺
          </button>
        </div>

        <div className={s.lastItem}>
          <ItemIcon item={lastItem} size={84} showLevel={false} slot="hat" />
          <div className={s.lastItemText}>
            {lastItem ? (
              <>
                <span className={s.lastItemName} style={{ color: rarityColor(lastItem.rarity) }}>{itemName(lastItem)}</span>
                <span className={s.lastItemSub}>{t('dumpster.lastFound')}</span>
              </>
            ) : (
              <span className={s.lastItemSub}>{t('dumpster.noneYet')}</span>
            )}
          </div>
        </div>

        {showPity && (
          <div className={s.pity}>
            <span>{t('dumpster.pity', { n: Math.max(0, bl.drySpell - dryStreak) })}</span>
            <div className={s.pityBar}>
              <div className={s.pityFill} style={{ width: `${Math.min(100, (dryStreak / bl.drySpell) * 100)}%` }} />
            </div>
          </div>
        )}

        <div className={s.dlRow}>
          <span className={s.dlLabel}>{t('dumpster.level', { level })}</span>
          <button
            className={`btn small ${affordable ? 'buy breathe' : 'alt'} ${s.upgradeBtn}`}
            disabled={maxed}
            onClick={() => openPopup('upgrade')}
          >
            {maxed ? t('dumpster.maxed') : endsAt !== null ? (
              <>⏳ {formatDuration((endsAt - now) / 1000)}</>
            ) : (
              <>
                ⬆ <CoinIcon /> {formatNumber(cost)}
              </>
            )}
          </button>
          <button className={s.iconBtn} aria-label={t('odds.title')} onClick={() => openPopup('odds')} style={{ fontSize: 30, fontWeight: 900 }}>
            %
          </button>
        </div>
      </div>
    </div>
  );
}
