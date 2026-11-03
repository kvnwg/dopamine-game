import type { CSSProperties } from 'react';
import { DATA, SLOTS } from '../../data';
import { formatNumber, formatStatValue, itemFlavor, itemName, itemOddsOneIn, scrapValue, type Item } from '../../core';
import { dispatch, useGame } from '../../app/store';
import { rarityColor } from '../../render/art';
import { haptics } from '../../services';
import { enchantLabel, fmtOdds } from '../components/AlleyPanel';
import { CheckIcon, LockIcon, PowerIcon, TrashIcon } from '../components/Icons';
import { enchantColor, ItemIcon } from '../components/ItemIcon';
import { enchantDesc } from '../components/RevealLayer';
import { t } from '../i18n';
import { Modal } from './Modal';
import { statLines } from './statRows';
import s from './popups.module.css';

function findItem(equipped: Record<string, Item | null>, bag: Item[], uid: number): { item: Item | null; equipped: boolean } {
  for (const slot of SLOTS) if (equipped[slot]?.uid === uid) return { item: equipped[slot], equipped: true };
  return { item: bag.find((x) => x.uid === uid) ?? null, equipped: false };
}

export function ItemDetailPopup({ uid, onClose }: { uid: number; onClose: () => void }) {
  const g = useGame((x) => x);
  const equippedMap = g.equipped;
  const bag = g.inventory;
  const { item, equipped } = findItem(equippedMap, bag, uid);
  if (!item) {
    return (
      <Modal title={t('item.equipped')} onClose={onClose}>
        <p className={s.subtitle}>{t('item.emptySlot')}</p>
      </Modal>
    );
  }
  const color = rarityColor(item.rarity);
  const cur = equippedMap[item.slot];
  const diff = !equipped && cur ? item.power - cur.power : null;
  const perk = item.mintPerkId ? DATA.mintPerksById.get(item.mintPerkId) : null;
  const scrapGold = scrapValue(g, item).coins;
  return (
    <Modal title={t(`rarity.${item.rarity}`)} tone={item.rarity === 'legendary' || item.rarity === 'mint' ? 'gold' : item.rarity === 'epic' ? 'purple' : item.rarity === 'mythic' ? 'red' : item.rarity === 'decent' ? 'green' : 'blue'} onClose={onClose}>
      <div className={s.bigOdds} data-rarity={item.rarity} style={{ ['--c' as string]: color } as CSSProperties}>
        <i>1 in</i>
        <b>{fmtOdds(itemOddsOneIn(item))}</b>
      </div>
      <div className={s.itemHead}>
        <ItemIcon item={item} size={200} equipped={equipped} showPower={false} showOdds={false} />
        <div className={s.itemHeadText}>
          <span className={s.itemName} style={{ color }}>
            {itemName(item)}
          </span>
          <span className={s.meta}>
            {t('item.meta', { slot: t(`slot.${item.slot}`), level: item.level })} · {t('item.worldTier', { n: item.tier })}
          </span>
          <div className={s.powerBig}>
            <PowerIcon size={54} />
            {formatNumber(item.power)}
            {diff !== null && (
              <span className={diff > 0 ? s.up : diff < 0 ? s.down : s.same}>
                {diff > 0 ? t('item.better', { n: formatNumber(diff) }) : diff < 0 ? t('item.worse', { n: `-${formatNumber(-diff)}` }) : t('item.same')}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className={s.stats}>
        {statLines(item).map((l) => (
          <div key={l.key} className={s.statRow}>
            <span className={l.main ? s.statMain : s.statSub}>
              {t(`stat.${l.stat}`)}
              {l.mode === 'pct' ? ' %' : ''}
            </span>
            <span>{formatStatValue(l.stat, l.mode, l.value)}</span>
          </div>
        ))}
        {perk && (
          <div className={s.mintPerk}>
            ✨ {perk.name}: {perk.text}
          </div>
        )}
      </div>
      {item.enchants.length > 0 && (
        <div className={s.enchantList}>
          {item.enchants.map((en) => (
            <div key={en.id} className={s.enchantRow}>
              <span className={s.enchantChip} style={{ background: enchantColor(en.id) }}>
                {enchantLabel(en.id, en.tier)}
              </span>
              <span>{enchantDesc(en.id, en.tier)}</span>
            </div>
          ))}
        </div>
      )}
      <p className={s.flavor}>“{itemFlavor(item)}”</p>
      <div className={s.actions}>
        {equipped ? (
          <span className={s.equippedTag}>
            <CheckIcon size={48} /> {t('item.equipped')}
          </span>
        ) : (
          <>
            <button
              className="btn blue"
              onClick={() => {
                haptics.impact('light');
                dispatch({ type: 'toggleLock', uid: item.uid });
              }}
            >
              <LockIcon size={44} />
              {item.locked ? t('item.unlock') : t('item.lock')}
            </button>
            <button
              className="btn red"
              disabled={item.locked}
              onClick={() => {
                haptics.impact('medium');
                dispatch({ type: 'scrapItem', uid: item.uid });
                onClose();
              }}
            >
              <TrashIcon size={44} />
              {t('item.scrap')} {formatNumber(scrapGold)}
            </button>
          </>
        )}
      </div>
      {!equipped && <p className={s.dragHint}>{t('item.dragHint')}</p>}
      {!equipped && <p className={s.note}>{t('item.lockedNote')}</p>}
    </Modal>
  );
}
