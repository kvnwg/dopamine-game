import type { CSSProperties } from 'react';
import { DATA, type Slot } from '../../data';
import { formatNumber, itemOddsOneIn, rarityAtLeast, type Item, gearPowerMult } from '../../core';
import { emptyItemArt, itemArt, UI_PX, type ArtScale } from '../../render/icons';
import { rarityColor } from '../../render/art';
import { useGame } from '../../app/store';
import { useItemDrag } from '../drag';
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, LockIcon } from './Icons';
import { PixelArt } from './PixelArt';
import s from './ItemIcon.module.css';

/**
 * A tile's size in stage px for 16 x 16 art at `scale` (1: 96 px as drawn, 2: its Scale2x version,
 * 192 px, 3: its Scale3x version, 288 px) plus a one-pixel border all round.
 */
export function tileSize(scale: ArtScale = 1): number {
  return 16 * scale * UI_PX + 2 * UI_PX;
}

/** Tile size in stage px in grids (bag, gear, codex): the 16 x 16 art (96) and its border (108). */
export const TILE = tileSize(1);

interface Props {
  item: Item | null;
  slot?: Slot;
  /**
   * Tile size in stage px (tileSize(scale) by default). The art inside is always its 16 x 16 at 6 px
   * per pixel, finer with `scale`; a bigger tile only adds room around it. Keep (size - art) a multiple
   * of 12 so the art lands on the 6 px grid.
   */
  size?: number;
  /**
   * The art's resolution: 1 in grids (16 x 16, 96 px), 2 in showcase spots (Scale2x, 32 x 32, 192 px),
   * 3 for the full-screen reveal (Scale3x, 48 x 48, 288 px).
   */
  scale?: ArtScale;
  showPower?: boolean;
  /** The "1 in X" banner (on by default for every item). */
  showOdds?: boolean;
  equipped?: boolean;
  /** Better than what is equipped in its slot: green arrow. */
  upgrade?: boolean;
  /** Worse than what is equipped in its slot: red arrow. */
  downgrade?: boolean;
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
  item, slot, size, scale = 1, showPower = true, showOdds = true, equipped, upgrade, downgrade, draggable, onTap, className, style,
}: Props) {
  const drag = useItemDrag(draggable && item ? item : null, onTap);
  // Power as worn by this raccoon (rarity power x its level and world scale), so tiles add up to its Power.
  const gearMult = useGame(gearPowerMult);
  const theSlot = item?.slot ?? slot ?? 'hat';
  const art = !item ? emptyItemArt(theSlot, scale) : itemArt(item.baseId, scale);
  const tile = size ?? tileSize(scale);
  // The art's top left inside the tile, on whole pixels.
  const inset = Math.round((tile - art.w * UI_PX) / 2);
  const vars = { ['--s' as string]: `${tile}px`, ['--inset' as string]: `${inset}px`, ...style } as CSSProperties;
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
      data-scale={scale}
      data-uid={item.uid}
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
        {equipped && <CheckIcon size={scale > 1 ? 'sm' : 'xs'} className={s.corner} />}
        {!equipped && item.locked && <LockIcon size={scale > 1 ? 'sm' : 'xs'} className={s.corner} />}
        {showPower && <span className={s.power}>{formatNumber(Math.round(item.power * gearMult))}</span>}
      </div>
      {showOdds && (
        <span className={`${s.odds} ${rare ? s.oddsRare : ''} ${rarityAtLeast(r, 'legendary') ? s.oddsLegend : ''}`}>
          <i>1 in</i>
          <b>{oddsShort(itemOddsOneIn(item))}</b>
        </span>
      )}
      {upgrade && !equipped && <ArrowUpIcon className={s.upgrade} />}
      {downgrade && !upgrade && !equipped && <ArrowDownIcon className={s.downgrade} />}
    </div>
  );
}
