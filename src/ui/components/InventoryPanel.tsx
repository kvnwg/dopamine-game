/**
 * The Bag tab: equipped gear (a drop target, two rows of five) and the raccoon's power (the only place
 * it shows), then the bag, always sorted by power (which is rarity: a rarer item always has more
 * power). The whole tab scrolls as one list. Drag an item up to equip it, or Equip best to wear the
 * biggest upgrade in every slot at once; Scrap All clears every unlocked item.
 */
import { useEffect, useRef, useState } from 'react';
import { formatNumber, inventoryCapacity, isUpgrade, playerPower, scrapValue } from '../../core';
import { dispatch, useGame } from '../../app/store';
import { haptics } from '../../services';
import { useCountUp } from '../hooks';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { GearRow } from './AlleyPanel';
import { EquipBestButton } from './EquipBest';
import { ItemIcon } from './ItemIcon';
import { CoinIcon, PowerIcon, TrashIcon } from './Icons';
import s from './panels.module.css';

/** The worn power: ticks up to its new value and its number swells for a moment whenever it grows. */
function PowerTag({ power }: { power: number }) {
  const shown = useCountUp(power, 900);
  const last = useRef(power);
  const [pop, setPop] = useState(0);
  useEffect(() => {
    if (power > last.current) setPop((n) => n + 1);
    last.current = power;
  }, [power]);
  return (
    <span className={s.powerTag}>
      <PowerIcon />
      {/* Only the number swells; the icon stays on the pixel grid. */}
      <span key={pop} className={pop > 0 ? s.powerPop : ''}>
        {formatNumber(Math.round(shown))}
      </span>
    </span>
  );
}

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
    <div className={`${s.panel} ${s.scrollPanel}`}>
      <div className={s.gearCard}>
        <div className={s.headRow}>
          <span className={s.headTitle}>{t('bag.equipped')}</span>
          <PowerTag power={power} />
          <span className={s.grow} />
          <span className={s.dragNote}>{t('bag.dragNote')}</span>
        </div>
        <GearRow />
      </div>
      {/* The bag's fill (tap it for more space) and the two big moves, in one row so the bag starts on screen. */}
      <div className={s.tools}>
        <button className={s.capTrack} onClick={() => useUi.getState().setTab('upgrades')} aria-label={t('bag.moreSpace')}>
          <div className={`${s.capFill} ${full ? s.capFull : ''}`} style={{ width: `${Math.min(100, (bag.length / cap) * 100)}%` }} />
          <span className={s.capText}>
            {t('bag.title')} {t('bag.capacity', { n: bag.length, cap })}
          </span>
          <span className={s.capPlus}>+</span>
        </button>
        <EquipBestButton />
        <button className={`btn small red ${s.scrapAll}`} disabled={unlocked.length === 0} onClick={scrapAll}>
          <TrashIcon />
          {armed ? t('bag.scrapConfirm', { n: unlocked.length }) : t('bag.scrapAll')}
          {!armed && unlocked.length > 0 && (
            <span className={s.scrapGold}>
              <CoinIcon />
              {formatNumber(scrapGold)}
            </span>
          )}
        </button>
      </div>
      {full && <div className={s.warn}>{t('bag.full')}</div>}
      {bag.length === 0 ? (
        <p className={s.emptyNote}>{t('bag.empty')}</p>
      ) : (
        <div className={s.grid}>
          {shown.map((it) => (
            <ItemIcon
              key={it.uid}
              item={it}
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
  );
}
