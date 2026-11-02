import type { Slot } from '../../data';
import { DATA } from '../../data';
import { formatNumber, formatStatValue, itemFlavor, itemName } from '../../core';
import { useGame } from '../../app/store';
import { rarityColor } from '../../render/art';
import { ItemIcon } from '../components/ItemIcon';
import { t } from '../i18n';
import { Modal } from './Modal';
import { statLines } from './statRows';
import s from './popups.module.css';

export function ItemDetailPopup({ slot, onClose }: { slot: Slot; onClose: () => void }) {
  const item = useGame((g) => g.equipped[slot]);
  if (!item) {
    return (
      <Modal title={t(`slot.${slot}`)} onClose={onClose}>
        <p className={s.subtitle}>{t('detail.empty')}</p>
      </Modal>
    );
  }
  const color = rarityColor(item.rarity);
  const perk = item.mintPerkId ? DATA.mintPerksById.get(item.mintPerkId) : null;
  return (
    <Modal onClose={onClose}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <span className={s.ribbon} style={{ background: color }}>{t(`rarity.${item.rarity}`)}</span>
      </div>
      <div className={s.itemHead}>
        <ItemIcon item={item} size={190} />
        <div className={s.itemHeadText}>
          <span className={s.itemName} style={{ color }}>{itemName(item)}</span>
          <span className={s.meta}>{t('compare.meta', { slot: t(`slot.${item.slot}`), level: item.level })}</span>
          <span className={s.flavor}>“{itemFlavor(item)}”</span>
        </div>
      </div>
      <div className={s.stats}>
        {statLines(item).map((l) => (
          <div key={l.key} className={s.statRow}>
            <span className={l.main ? s.statMain : s.statSub}>{t(`stat.${l.stat}`)}{l.mode === 'pct' ? ' %' : ''}</span>
            <span>{formatStatValue(l.stat, l.mode, l.value)}</span>
          </div>
        ))}
        {perk && <div className={s.mintPerk}>✨ {perk.name}: {perk.text}</div>}
      </div>
      <div className={s.powerRow}>⚡ {formatNumber(item.power)}</div>
    </Modal>
  );
}
