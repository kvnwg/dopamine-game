import type { CSSProperties } from 'react';
import { DATA, type Slot } from '../../data';
import { formatNumber, itemOddsOneIn, rarityAtLeast, type Item, gearPowerMult } from '../../core';
import { emptyItemArt, itemArt, itemArtHd, UI_PX } from '../../render/icons';
import { rarityColor } from '../../render/art';
import { useGame } from '../../app/store';
import { useItemDrag } from '../drag';
import { ArrowUpIcon, CheckIcon, LockIcon } from './Icons';
import { PixelArt } from './PixelArt';
import s from './ItemIcon.module.css';

/** Tile size in stage px for the usual 16 x 16 art: the art (144) plus a one-pixel border all round. */
export const TILE = 16 * UI_PX + 2 * UI_PX;

interface Props {
  item: Item | null;
  slot?: Slot;
  /**
   * Tile size in stage px (TILE by default). The art inside is always 16 x 16 at 9 px per pixel
   * (144 px), or its 32 x 32 Scale2x version with `hd`; a bigger tile only adds room around it.
   * Keep (size - art) even so the art lands on whole pixels.
   */
  size?: number;
  /** Show the art at twice the resolution (Scale2x, 288 px), for the big reveal. */
  hd?: boolean;
  showPower?: boolean;
  /** The "1 in X" banner (on by default for every item). */
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
  item, slot, size = TILE, hd, showPower = true, showOdds = true, equipped, upgrade, draggable, onTap, className, style,
}: Props) {
  const drag = useItemDrag(draggable && item ? item : null, onTap);
  // Power as worn by this raccoon (rarity power x its level and world scale), so tiles add up to its Power.
  const gearMult = useGame(gearPowerMult);
  const theSlot = item?.slot ?? slot ?? 'hat';
  const art = !item ? emptyItemArt(theSlot) : hd ? itemArtHd(item.baseId) : itemArt(item.baseId);
  // The art's top left inside the tile, on whole pixels.
  const inset = Math.round((size - art.w * UI_PX) / 2);
  const vars = { ['--s' as string]: `${size}px`, ['--inset' as string]: `${inset}px`, ...style } as CSSProperties;
  if (!item) {
    return (
      <div className={`${s.wrap} ${className ?? ''}`} style={vars} onClick={onTap} data-slot={theSlot}>
        <div className={`${s.tile} ${s.empty}`}>
          <PixelArt art={art} className={s.ghost} />
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
        <PixelArt art={art} className={s.art} />
        {item.enchants.length > 0 && (
          <span className={s.pips}>
            {item.enchants.map((en) => (
              <span key={en.id} className={s.pip} style={{ background: enchantColor(en.id) }} data-tier={en.tier} />
            ))}
          </span>
        )}
        {equipped && <CheckIcon className={s.corner} />}
        {!equipped && item.locked && <LockIcon className={s.corner} />}
        {showPower && <span className={s.power}>{formatNumber(Math.round(item.power * gearMult))}</span>}
      </div>
      {showOdds && (
        <span className={`${s.odds} ${rare ? s.oddsRare : ''} ${rarityAtLeast(r, 'legendary') ? s.oddsLegend : ''}`}>
          <i>1 in</i>
          <b>{oddsShort(itemOddsOneIn(item))}</b>
        </span>
      )}
      {upgrade && !equipped && <ArrowUpIcon className={s.upgrade} />}
    </div>
  );
}
