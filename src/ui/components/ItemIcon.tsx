import type { CSSProperties } from 'react';
import { DATA, type Slot } from '../../data';
import { rarityAtLeast, type Item } from '../../core';
import { rarityColor } from '../../render/art';
import { t } from '../i18n';
import s from './ItemIcon.module.css';

interface Props {
  item: Item | null;
  slot?: Slot;
  size?: number;
  showLevel?: boolean;
}

const GEMS: Partial<Record<Item['rarity'], number[]>> = {
  decent: [50],
  shiny: [36, 64],
  epic: [28, 50, 72],
};

/** Placeholder item icon inside a rarity frame. Real icons drop in via assets.json later. */
export function ItemIcon({ item, slot, size = 150, showLevel = true }: Props) {
  const theSlot = item?.slot ?? slot ?? 'hat';
  const label = DATA.assets.placeholders.slots[theSlot];
  const style = { ['--s' as string]: `${size}px` } as CSSProperties;
  if (!item) {
    return (
      <div className={`${s.icon} ${s.empty}`} style={style}>
        <span className={`${s.label} ${s.emptyLabel}`}>{label}</span>
      </div>
    );
  }
  const r = item.rarity;
  (style as Record<string, string>)['--c'] = rarityColor(r);
  const gems = GEMS[r] ?? [];
  return (
    <div className={`${s.icon} ${s[r] ?? ''}`} style={style} data-rarity={r}>
      {r === 'mythic' && (
        <>
          <span className={`${s.wing} ${s.wingL}`} />
          <span className={`${s.wing} ${s.wingR}`} />
        </>
      )}
      <span className={`${s.clip} ${rarityAtLeast(r, 'epic') ? s.glint : ''}`} />
      <span className={s.label}>{label}</span>
      {showLevel && <span className={s.lv}>{t('item.levelShort', { level: item.level })}</span>}
      {r === 'junk' && <span className={s.patch} />}
      {gems.map((x) => (
        <span key={x} className={s.gem} style={{ left: `${x}%` }} />
      ))}
      {r === 'epic' && ['ctl', 'ctr', 'cbl', 'cbr'].map((c) => <span key={c} className={`${s.corner} ${s[c]}`} />)}
      {r === 'legendary' && (
        <>
          <span className={s.crown} />
          <span className={s.cap} />
        </>
      )}
      {r === 'mint' && (
        <>
          <span className={s.hanger} />
          <span className={s.price}>{t('item.priceTag')}</span>
        </>
      )}
    </div>
  );
}
