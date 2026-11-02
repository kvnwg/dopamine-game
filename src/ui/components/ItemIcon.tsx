import type { CSSProperties } from 'react';
import { DATA, type Slot } from '../../data';
import { formatNumber, rarityAtLeast, type Item } from '../../core';
import { emptyIconUrl, itemIconUrl } from '../../render/icons';
import { rarityColor } from '../../render/art';
import { CheckIcon, LockIcon } from './Icons';
import s from './ItemIcon.module.css';

interface Props {
  item: Item | null;
  slot?: Slot;
  size?: number;
  showPower?: boolean;
  equipped?: boolean;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function enchantColor(id: string): string {
  return DATA.enchantsById.get(id)?.color ?? '#ffffff';
}

/** An item tile: rarity-colored card, item art, power badge, enchant gems, lock/equipped badges. */
export function ItemIcon({ item, slot, size = 150, showPower = true, equipped, onClick, className, style }: Props) {
  const theSlot = item?.slot ?? slot ?? 'hat';
  const vars = { ['--s' as string]: `${size}px`, ...style } as CSSProperties;
  if (!item) {
    return (
      <div className={`${s.tile} ${s.empty} ${className ?? ''}`} style={vars} onClick={onClick}>
        <img className={s.ghost} src={emptyIconUrl(theSlot)} alt="" draggable={false} />
      </div>
    );
  }
  const r = item.rarity;
  (vars as Record<string, string>)['--c'] = rarityColor(r);
  return (
    <div
      className={[s.tile, s[r] ?? '', rarityAtLeast(r, 'epic') ? s.shine : '', onClick ? s.tappable : '', className ?? ''].join(' ')}
      style={vars}
      data-rarity={r}
      onClick={onClick}
    >
      <span className={s.glow} />
      <img className={s.art} src={itemIconUrl(item.slot, r)} alt="" draggable={false} />
      {item.enchants.length > 0 && (
        <span className={s.pips}>
          {item.enchants.map((en) => (
            <span key={en.id} className={s.pip} style={{ background: enchantColor(en.id) }} data-tier={en.tier} />
          ))}
        </span>
      )}
      {equipped && <CheckIcon className={s.corner} size={Math.round(size * 0.27)} />}
      {!equipped && item.locked && <LockIcon className={s.corner} size={Math.round(size * 0.25)} />}
      {showPower && <span className={s.power}>{formatNumber(item.power)}</span>}
    </div>
  );
}
