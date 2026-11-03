import { bestUpgrades } from '../../core';
import { dispatch, useGame } from '../../app/store';
import { haptics } from '../../services';
import { t } from '../i18n';

/** Equips the biggest upgrade in every slot (shows how many slots would change). */
export function EquipBestButton({ className }: { className?: string }) {
  const n = useGame((g) => bestUpgrades(g).length);
  return (
    <button
      data-equip-best=""
      className={`btn small ${n > 0 ? 'breathe' : ''} ${className ?? ''}`}
      disabled={n === 0}
      onClick={() => {
        haptics.impact('medium');
        dispatch({ type: 'equipBest' });
      }}
    >
      {n > 0 ? t('bag.equipBestN', { n }) : t('bag.equipBest')}
    </button>
  );
}
