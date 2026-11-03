/**
 * The Bag tab: equipped gear (a drop target), then the bag, always sorted by power (which is rarity:
 * a rarer item always has more power). Drag an item up to equip it, or Equip best to wear the biggest
 * upgrade in every slot at once; Scrap All clears every unlocked item.
 */
import { useState } from 'react';
import { formatNumber, inventoryCapacity, isUpgrade, playerPower, scrapValue } from '../../core';
import { dispatch, useGame } from '../../app/store';
import { haptics } from '../../services';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { GearRow } from './AlleyPanel';
import { EquipBestButton } from './EquipBest';
import { ItemIcon } from './ItemIcon';
import { CoinIcon, PowerIcon, TrashIcon } from './Icons';
import s from './panels.module.css';

export function InventoryPanel() {
  const g = useGame((x) => x);
  const bag = g.inventory;
  const cap = inventoryCapacity(g);
  const power = playerPower(g);
  const [armed, setArmed] = useState(false);
  const full = bag.length >= cap;
  // The core keeps the bag sorted by power.
  const shown = bag;
  const unlocked = bag.filter((x) => !x.locked);
  const scrapGold = unlocked.reduce((n, it) => n + scrapValue(g, it).coins, 0);
  const scrapAll = () => {
    if (unlocked.length === 0) return;
    if (!armed) {
      setArmed(true);
      haptics.impact('medium');
      setTimeout(() => setArmed(false), 3000);
      return;
    }
    setArmed(false);
    haptics.impact('heavy');
    dispatch({ type: 'scrapAll' });
  };
  return (
    <div className={s.panel}>
      <div className={s.gearCard}>
        <div className={s.headRow}>
          <span className={s.headTitle}>{t('bag.equipped')}</span>
          <span className={s.powerTag}>
            <PowerIcon size={38} /> {formatNumber(power)}
          </span>
          <span style={{ flex: 1 }} />
          <span className={s.dragNote}>{t('bag.dragNote')}</span>
        </div>
        <GearRow size={86} />
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
      <div className={s.tools}>
        <EquipBestButton />
        <span style={{ flex: 1 }} />
        <button className={`btn small red ${s.scrapAll}`} disabled={unlocked.length === 0} onClick={scrapAll}>
          <TrashIcon size={38} />
          {armed ? t('bag.scrapConfirm', { n: unlocked.length }) : t('bag.scrapAll')}
          {!armed && unlocked.length > 0 && (
            <span className={s.scrapGold}>
              <CoinIcon size={30} />
              {formatNumber(scrapGold)}
            </span>
          )}
        </button>
      </div>
      {full && <div className={s.warn}>{t('bag.full')}</div>}
      <div className={s.scroll}>
        {bag.length === 0 ? (
          <p className={s.emptyNote}>{t('bag.empty')}</p>
        ) : (
          <div className={s.grid}>
            {shown.map((it) => (
              <ItemIcon
                key={it.uid}
                item={it}
                size={146}
                draggable
                upgrade={isUpgrade(g, it)}
                onTap={() => useUi.getState().openPopup('itemDetail', it.uid)}
              />
            ))}
            {Array.from({ length: Math.max(0, Math.min(cap, 30) - bag.length) }, (_, i) => (
              <div key={`e${i}`} className={s.slotEmpty} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
