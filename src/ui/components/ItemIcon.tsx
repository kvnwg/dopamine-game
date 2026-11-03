import type { CSSProperties } from 'react';
import { DATA, type Slot } from '../../data';
import { formatNumber, itemOddsOneIn, rarityAtLeast, type Item, gearPowerMult } from '../../core';
import { emptyIconUrl, itemArtUrl } from '../../render/icons';
import { rarityColor } from '../../render/art';
import { useGame } from '../../app/store';
import { useItemDrag } from '../drag';
import { CheckIcon, LockIcon } from './Icons';
import s from './ItemIcon.module.css';

interface Props {
  item: Item | null;
  slot?: Slot;
  size?: number;
  showPower?: boolean;
  /** The big "1 in X" banner (on by default for every item). */
  showOdds?: boolean;
  equipped?: boolean;
  /** Better than what is equipped in its slot: green arrow. */
  upgrade?: boolean;
  /** Can be dragged onto the raccoon to equip. */
  draggable?: boolean;
  onTap?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function enchantColor(id: string): string {
  return DATA.enchantsById.get(id)?.color ?? '#ffffff';
}

/** "1 in X" with short numbers (1K, 25K, 1M). */
export function oddsShort(x: number): string {
  return formatNumber(x);
}

/** An item tile: rarity card, art, power, enchant gems, a loud "1 in X" banner, and badges. */
export function ItemIcon({
  item, slot, size = 150, showPower = true, showOdds = true, equipped, upgrade, draggable, onTap, className, style,
}: Props) {
  const drag = useItemDrag(draggable && item ? item : null, onTap);
  // Power as worn by this raccoon (rarity power x its level and world scale), so tiles add up to its Power.
  const gearMult = useGame(gearPowerMult);
  const theSlot = item?.slot ?? slot ?? 'hat';
  const vars = { ['--s' as string]: `${size}px`, ...style } as CSSProperties;
  if (!item) {
    return (
      <div className={`${s.wrap} ${className ?? ''}`} style={vars} onClick={onTap} data-slot={theSlot}>
        <div className={`${s.tile} ${s.empty}`}>
          <img className={s.ghost} src={emptyIconUrl(theSlot)} alt="" draggable={false} />
        </div>
      </div>
    );
  }
  const r = item.rarity;
  (vars as Record<string, string>)['--c'] = rarityColor(r);
  const rare = rarityAtLeast(r, 'epic');
  const handlers = draggable ? drag : { onClick: onTap };
  return (
    <div
      className={[s.wrap, onTap || draggable ? s.tappable : '', draggable ? s.grab : '', className ?? ''].join(' ')}
      style={vars}
      data-rarity={r}
      data-slot={theSlot}
      {...handlers}
    >
      <div className={[s.tile, s[r] ?? '', rare ? s.shine : ''].join(' ')}>
        <span className={s.glow} />
        <img className={s.art} src={itemArtUrl(item.baseId)} alt="" draggable={false} />
        {item.enchants.length > 0 && (
          <span className={s.pips}>
            {item.enchants.map((en) => (
              <span key={en.id} className={s.pip} style={{ background: enchantColor(en.id) }} data-tier={en.tier} />
            ))}
          </span>
        )}
        {equipped && <CheckIcon className={s.corner} size={Math.round(size * 0.27)} />}
        {!equipped && item.locked && <LockIcon className={s.corner} size={Math.round(size * 0.25)} />}
        {showPower && <span className={s.power}>{formatNumber(Math.round(item.power * gearMult))}</span>}
      </div>
      {showOdds && (
        <span className={`${s.odds} ${rare ? s.oddsRare : ''} ${rarityAtLeast(r, 'legendary') ? s.oddsLegend : ''}`}>
          <i>1 in</i>
          <b>{oddsShort(itemOddsOneIn(item))}</b>
        </span>
      )}
      {upgrade && !equipped && <span className={s.upgrade}>▲</span>}
    </div>
  );
}
