/** The Bag tab: equipped gear, then the bag grid (sorted by power), capacity and auto-equip. */
import { inventoryCapacity, formatNumber, playerPower } from '../../core';
import { dispatch, useGame } from '../../app/store';
import { haptics } from '../../services';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { GearRow } from './AlleyPanel';
import { ItemIcon } from './ItemIcon';
import { PowerIcon } from './Icons';
import s from './panels.module.css';

export function InventoryPanel() {
  const bag = useGame((g) => g.inventory);
  const cap = useGame(inventoryCapacity);
  const auto = useGame((g) => g.autoEquip);
  const power = useGame(playerPower);
  const full = bag.length >= cap;
  return (
    <div className={s.panel}>
      <div className={s.gearCard}>
        <div className={s.headRow}>
          <span className={s.headTitle}>{t('bag.equipped')}</span>
          <span className={s.powerTag}>
            <PowerIcon size={38} /> {formatNumber(power)}
          </span>
          <span style={{ flex: 1 }} />
          <button
            className={`${s.toggle} ${auto ? s.toggleOn : ''}`}
            onClick={() => {
              haptics.impact('light');
              dispatch({ type: 'setAutoEquip', enabled: !auto });
            }}
          >
            <span className={s.knob} />
            {t('bag.autoEquip')}
          </button>
        </div>
        <GearRow size={94} />
      </div>
      <div className={s.headRow}>
        <span className={s.headTitle}>{t('bag.title')}</span>
        <div className={s.capTrack}>
          <div className={`${s.capFill} ${full ? s.capFull : ''}`} style={{ width: `${Math.min(100, (bag.length / cap) * 100)}%` }} />
          <span className={s.capText}>{t('bag.capacity', { n: bag.length, cap })}</span>
        </div>
        <button className="btn small blue" onClick={() => useUi.getState().setTab('upgrades')}>
          {t('bag.moreSpace')}
        </button>
      </div>
      {full && <div className={s.warn}>{t('bag.full')}</div>}
      <div className={s.scroll}>
        {bag.length === 0 ? (
          <p className={s.emptyNote}>{t('bag.empty')}</p>
        ) : (
          <div className={s.grid}>
            {bag.map((it) => (
              <ItemIcon key={it.uid} item={it} size={152} onClick={() => useUi.getState().openPopup('itemDetail', it.uid)} />
            ))}
            {Array.from({ length: Math.max(0, Math.min(cap, 30) - bag.length) }, (_, i) => (
              <div key={`e${i}`} className={s.slotEmpty} />
            ))}
          </div>
        )}
      </div>
      <span className={s.footNote}>{t('bag.sorted')}</span>
    </div>
  );
}
