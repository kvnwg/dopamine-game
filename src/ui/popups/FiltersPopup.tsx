import { DATA, RARITIES, type Rarity } from '../../data';
import { dispatch, useGame } from '../../app/store';
import { rarityColor } from '../../render/art';
import { t } from '../i18n';
import { Modal } from './Modal';
import s from './popups.module.css';

export function FiltersPopup({ onClose }: { onClose: () => void }) {
  const keepMin = useGame((g) => g.autoDive.keepMinRarity);
  const keepSubs = useGame((g) => g.autoDive.keepSubstats);
  const set = (rarity: Rarity, subs: string[]) => dispatch({ type: 'setAutoDiveFilters', keepMinRarity: rarity, keepSubstats: subs });
  return (
    <Modal title={t('filters.title')} subtitle={t('filters.subtitle')} onClose={onClose}>
      <div className={s.section}>{t('filters.minRarity')}</div>
      <div className={s.chips}>
        {RARITIES.slice(1).map((r) => (
          <button
            key={r}
            className={`${s.chip} ${keepMin === r ? s.chipOn : ''}`}
            style={{ color: rarityColor(r) }}
            onClick={() => set(r, keepSubs)}
          >
            {t(`rarity.${r}`)}+
          </button>
        ))}
      </div>
      <div className={s.section}>{t('filters.substats')}</div>
      <div className={s.chips}>
        {DATA.affixes.map((a) => {
          const on = keepSubs.includes(a.id);
          return (
            <button
              key={a.id}
              className={`${s.chip} ${on ? s.chipOn : ''}`}
              onClick={() => set(keepMin, on ? keepSubs.filter((x) => x !== a.id) : [...keepSubs, a.id])}
            >
              {t(`affix.${a.id}`)}
            </button>
          );
        })}
      </div>
      <p className={s.note}>{t('filters.note')}</p>
    </Modal>
  );
}
