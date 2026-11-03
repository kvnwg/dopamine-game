/**
 * UI icons: pixel art (src/render/pixel/ui.ts) at 9 stage px per art pixel. `size` picks one of the
 * sizes each icon is drawn at: 'sm' (about 5 x 5, next to text), 'md' (about 7 x 7, HUD and map),
 * 'nav' (10 x 10) or 'lg' (16 x 16). A number (the old stage px sizes) picks the nearest of those.
 * An icon is never stretched to a size: it shows at its own size, 9 px per pixel.
 */
import type { CSSProperties } from 'react';
import { uiIcon, type IconTier } from '../../render/icons';
import type { UiIcon } from '../../render/pixel/ui';
import { PixelArt } from './PixelArt';

interface P {
  size?: IconTier | number;
  style?: CSSProperties;
  className?: string;
}

function tierOf(size: IconTier | number | undefined): IconTier {
  if (typeof size === 'string') return size;
  if (size === undefined || size <= 50) return 'sm';
  return size <= 75 ? 'md' : size <= 120 ? 'nav' : 'lg';
}

function Pix({ name, size, style, className }: P & { name: UiIcon }) {
  return <PixelArt art={uiIcon(name, tierOf(size))} className={className} style={style} />;
}

export const CoinIcon = (p: P) => <Pix name="coin" {...p} />;
export const GemIcon = (p: P) => <Pix name="gem" {...p} />;
export const BagIcon = (p: P) => <Pix name="bag" {...p} />;
export const HeartIcon = (p: P) => <Pix name="heart" {...p} />;
export const SwordIcon = (p: P) => <Pix name="sword" {...p} />;
export const ShieldIcon = (p: P) => <Pix name="shield" {...p} />;
export const CloverIcon = (p: P) => <Pix name="clover" {...p} />;
export const BoltIcon = (p: P) => <Pix name="bolt" {...p} />;
export const PowerIcon = (p: P) => <Pix name="power" {...p} />;
export const GearIcon = (p: P) => <Pix name="gear" {...p} />;
export const LockIcon = (p: P) => <Pix name="lock" {...p} />;
export const TrashIcon = (p: P) => <Pix name="trash" {...p} />;
export const ArrowUpIcon = (p: P) => <Pix name="arrowUp" {...p} />;
export const RebirthIcon = (p: P) => <Pix name="rebirth" {...p} />;
export const DumpsterIcon = (p: P) => <Pix name="dumpster" {...p} />;
export const PotionIcon = (p: P) => <Pix name="potion" {...p} />;
export const DiceIcon = (p: P) => <Pix name="dice" {...p} />;
export const BookIcon = (p: P) => <Pix name="book" {...p} />;
export const ChartIcon = (p: P) => <Pix name="chart" {...p} />;
export const CartIcon = (p: P) => <Pix name="cart" {...p} />;
export const StarIcon = (p: P) => <Pix name="star" {...p} />;
export const CheckIcon = (p: P) => <Pix name="check" {...p} />;
export const ClockIcon = (p: P) => <Pix name="clock" {...p} />;
export const SkullIcon = (p: P) => <Pix name="skull" {...p} />;
export const GlobeIcon = (p: P) => <Pix name="globe" {...p} />;
export const BackpackIcon = (p: P) => <Pix name="backpack" {...p} />;
export const DropIcon = (p: P) => <Pix name="drop" {...p} />;
export const TargetIcon = (p: P) => <Pix name="target" {...p} />;
/** A little CRT: the Watch tab, and watching an ad. */
export const TvIcon = (p: P) => <Pix name="tv" {...p} />;
/** The slot-reel icon (the Roll tab, Extra Reel); gold for golden spins. */
export const ReelIcon = ({ gold, ...p }: P & { gold?: boolean }) => <Pix name={gold ? 'reelGold' : 'reel'} {...p} />;
/** Points right (Next, onward): drawn that way, so nothing has to rotate an arrow. */
export const ArrowRightIcon = (p: P) => <Pix name="arrowRight" {...p} />;
