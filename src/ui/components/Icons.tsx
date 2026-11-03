/**
 * UI icons: pixel art (src/render/pixel/ui.ts) shown as crisp images. Each component keeps the
 * same props as before (size in stage px, style, className).
 */
import type { CSSProperties } from 'react';
import { uiIconUrl } from '../../render/icons';
import type { UiIcon } from '../../render/pixel/ui';

interface P {
  size?: number;
  style?: CSSProperties;
  className?: string;
}

function Pix({ name, size = 46, style, className }: P & { name: UiIcon }) {
  return (
    <img
      className={className}
      src={uiIconUrl(name)}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      style={{ flex: 'none', display: 'block', imageRendering: 'pixelated', ...style }}
    />
  );
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
/** The slot-reel icon (the Roll tab, Extra Reel); gold for golden spins. */
export const ReelIcon = (p: P & { gold?: boolean }) => <Pix name={p.gold ? 'reelGold' : 'reel'} size={p.size} style={p.style} className={p.className} />;
