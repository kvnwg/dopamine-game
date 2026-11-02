/**
 * Cel-style UI icons as inline SVG: flat fills, one highlight, thick dark outline.
 * All drawn on a 64x64 grid so they line up at any size.
 */
import type { CSSProperties, ReactNode } from 'react';

const INK = '#2e2523';

interface P {
  size?: number;
  style?: CSSProperties;
  className?: string;
}

function Svg({ size = 46, style, className, children }: P & { children: ReactNode }) {
  return (
    <svg
      className={className}
      style={{ flex: 'none', display: 'block', overflow: 'visible', ...style }}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke={INK}
      strokeWidth={5}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const CoinIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="32" cy="33" r="26" fill="#ffc233" />
    <circle cx="32" cy="33" r="17" fill="#ffd96a" stroke="#d48a12" strokeWidth={4} />
    <path d="M18 22a17 17 0 0 1 12-8" stroke="#fff6cc" strokeWidth={5} />
    <path d="M32 24v18" stroke="#d48a12" strokeWidth={5} />
  </Svg>
);

export const GemIcon = (p: P) => (
  <Svg {...p}>
    <path d="M14 22 24 10h16l10 12-18 32z" fill="#4fe0d0" />
    <path d="M14 22h36M24 10l8 12 8-12M32 22v32" stroke="#1f9c8e" strokeWidth={3} />
    <path d="M14 22 24 10h16l10 12-18 32z" />
    <path d="M22 20l5-6" stroke="#eafffb" strokeWidth={4} />
  </Svg>
);

export const BagIcon = (p: P) => (
  <Svg {...p}>
    <path d="M14 34c0-12 8-18 18-18s18 6 18 18-6 22-18 22-18-10-18-22z" fill="#4a4b5c" />
    <path d="M20 30c1-5 4-8 8-9" stroke="#8d8fa6" strokeWidth={4} />
    <path d="M24 16c-2-6 2-10 8-6 6-4 10 0 8 6" fill="#ffc233" />
    <path d="M26 18h12" />
  </Svg>
);

export const HeartIcon = (p: P) => (
  <Svg {...p}>
    <path d="M32 56S6 40 6 22c0-9 7-15 14-15 6 0 10 3 12 8 2-5 6-8 12-8 7 0 14 6 14 15 0 18-26 34-26 34z" fill="#ff4d5e" />
    <path d="M15 18c1-4 4-6 8-6" stroke="#ffc2c8" strokeWidth={5} />
  </Svg>
);

export const SwordIcon = (p: P) => (
  <Svg {...p}>
    <path d="M44 6h14v14L28 50l-14-14z" fill="#e9eef7" />
    <path d="M47 11 22 36" stroke="#b7c2d6" strokeWidth={4} />
    <path d="M10 32l22 22" stroke={INK} strokeWidth={13} />
    <path d="M10 32l22 22" stroke="#ffc233" strokeWidth={6} />
    <path d="M16 48 6 58" stroke={INK} strokeWidth={12} />
    <path d="M16 48 6 58" stroke="#9a5a2e" strokeWidth={5} />
  </Svg>
);

export const ShieldIcon = (p: P) => (
  <Svg {...p}>
    <path d="M32 6 54 13v16c0 15-10 25-22 30C20 54 10 44 10 29V13z" fill="#3d8ff0" />
    <path d="M32 14 46 18v11c0 10-6 17-14 21z" fill="#7cc0ff" stroke="none" />
    <path d="M32 6 54 13v16c0 15-10 25-22 30C20 54 10 44 10 29V13z" />
    <path d="M32 22v18M24 30h16" stroke="#fff" strokeWidth={5} />
  </Svg>
);

export const CloverIcon = (p: P) => (
  <Svg {...p}>
    <path d="M33 36c4 8 4 15 0 22" strokeWidth={6} />
    <path d="M33 36c4 8 4 15 0 22" stroke="#2f9e44" strokeWidth={2.5} />
    <g fill="#46d36b">
      <path d="M32 31c-10 0-17-6-15-13 2-6 9-6 12-1-1-6 3-11 8-9 7 2 6 13-5 23z" />
      <path d="M33 31c0-10 6-17 13-15 6 2 6 9 1 12 6-1 11 3 9 8-2 7-13 6-23-5z" />
      <path d="M31 33c0 10-6 17-13 15-6-2-6-9-1-12-6 1-11-3-9-8 2-7 13-6 23 5z" />
      <path d="M33 33c10 0 17 6 15 13-2 6-9 6-12 1 1 6-3 11-8 9-7-2-6-13 5-23z" />
    </g>
    <path d="M22 15c2-2 5-2 6 0" stroke="#c8ffd4" strokeWidth={3.5} />
  </Svg>
);

export const BoltIcon = (p: P) => (
  <Svg {...p}>
    <path d="M36 4 12 36h16l-6 24 28-34H34z" fill="#ffd23f" />
    <path d="M32 12 20 30" stroke="#fff3b0" strokeWidth={4} />
  </Svg>
);

export const PowerIcon = (p: P) => (
  <Svg {...p}>
    <path d="M32 4l7 15 16-4-8 14 13 9-16 4 3 16-15-9-15 9 3-16-16-4 13-9-8-14 16 4z" fill="#ff8a3d" />
    <circle cx="32" cy="34" r="10" fill="#ffd23f" />
    <path d="M24 17l4 7" stroke="#ffd6b0" strokeWidth={4} />
  </Svg>
);

export const GearIcon = (p: P) => (
  <Svg {...p}>
    <path
      d="M28 4h8l2 8 6 3 7-4 6 6-4 7 3 6 8 2v8l-8 2-3 6 4 7-6 6-7-4-6 3-2 8h-8l-2-8-6-3-7 4-6-6 4-7-3-6-8-2v-8l8-2 3-6-4-7 6-6 7 4 6-3z"
      fill="#e6e9f4"
    />
    <circle cx="32" cy="32" r="9" fill="#7c82a8" />
  </Svg>
);

export const LockIcon = (p: P) => (
  <Svg {...p}>
    <path d="M20 28v-8a12 12 0 0 1 24 0v8" fill="none" strokeWidth={6} />
    <path d="M20 28v-8a12 12 0 0 1 24 0v8" stroke="#c9ced9" strokeWidth={2.5} />
    <rect x="12" y="27" width="40" height="30" rx="7" fill="#ffc233" />
    <path d="M32 38v8" strokeWidth={6} />
  </Svg>
);

export const TrashIcon = (p: P) => (
  <Svg {...p}>
    <path d="M14 20h36l-4 36H18z" fill="#c9ced9" />
    <path d="M24 28l1 20M32 28v20M40 28l-1 20" strokeWidth={4} />
    <path d="M10 18h44" strokeWidth={6} />
    <path d="M24 16c0-6 16-6 16 0" fill="#c9ced9" />
  </Svg>
);

export const ArrowUpIcon = (p: P) => (
  <Svg {...p}>
    <path d="M32 6 56 32H42v24H22V32H8z" fill="#5bc236" />
    <path d="M30 14 18 27" stroke="#c9f7b0" strokeWidth={4} />
  </Svg>
);

export const RebirthIcon = (p: P) => (
  <Svg {...p}>
    <path d="M52 30A20 20 0 0 0 16 20" strokeWidth={11} />
    <path d="M12 34a20 20 0 0 0 36 10" strokeWidth={11} />
    <path d="M52 30A20 20 0 0 0 16 20" stroke="#c48bff" strokeWidth={5} />
    <path d="M12 34a20 20 0 0 0 36 10" stroke="#c48bff" strokeWidth={5} />
    <path d="M8 12l2 14 13-6z" fill="#c48bff" />
    <path d="M56 52l-2-14-13 6z" fill="#c48bff" />
    <path d="M32 24l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z" fill="#ffd23f" strokeWidth={3} />
  </Svg>
);

export const DumpsterIcon = (p: P) => (
  <Svg {...p}>
    <path d="M8 26h48l-5 28H13z" fill="#3fae6a" />
    <path d="M14 34h36" stroke="#2a7d4a" strokeWidth={4} />
    <path d="M6 18l50-6 2 12-50 4z" fill="#56c983" />
    <circle cx="18" cy="57" r="4" fill={INK} />
    <circle cx="46" cy="57" r="4" fill={INK} />
    <path d="M14 22l20-3" stroke="#bff3d2" strokeWidth={3.5} />
  </Svg>
);

export const PotionIcon = (p: P) => (
  <Svg {...p}>
    <path d="M24 6h16M26 6v14L12 46c-3 7 1 12 8 12h24c7 0 11-5 8-12L38 20V6" fill="#ffffff" />
    <path d="M16 40h32l4 7c2 5-1 9-7 9H19c-6 0-9-4-7-9z" fill="#46d36b" stroke="none" />
    <path d="M24 6h16M26 6v14L12 46c-3 7 1 12 8 12h24c7 0 11-5 8-12L38 20V6" />
    <circle cx="26" cy="46" r="3" fill="#c8ffd4" stroke="none" />
  </Svg>
);

export const DiceIcon = (p: P) => (
  <Svg {...p}>
    <rect x="8" y="8" width="48" height="48" rx="11" fill="#fff" />
    <g fill={INK} stroke="none">
      <circle cx="21" cy="21" r="5" />
      <circle cx="43" cy="21" r="5" />
      <circle cx="32" cy="32" r="5" />
      <circle cx="21" cy="43" r="5" />
      <circle cx="43" cy="43" r="5" />
    </g>
  </Svg>
);

export const BookIcon = (p: P) => (
  <Svg {...p}>
    <path d="M10 12c8-3 15-2 22 3v40c-7-5-14-6-22-3z" fill="#ff8a3d" />
    <path d="M54 12c-8-3-15-2-22 3v40c7-5 14-6 22-3z" fill="#ffb366" />
    <path d="M16 22c4-1 8-1 11 1M16 31c4-1 8-1 11 1" stroke="#fff1e0" strokeWidth={3.5} />
  </Svg>
);

export const ChartIcon = (p: P) => (
  <Svg {...p}>
    <rect x="8" y="8" width="48" height="48" rx="10" fill="#7c82a8" />
    <path d="M18 46V34M30 46V22M42 46V28" stroke="#fff" strokeWidth={7} />
  </Svg>
);

export const CartIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 10h8l7 32h30l5-22H17" fill="#ffd23f" />
    <circle cx="24" cy="52" r="5" fill="#fff" />
    <circle cx="46" cy="52" r="5" fill="#fff" />
  </Svg>
);

export const StarIcon = (p: P) => (
  <Svg {...p}>
    <path d="M32 5l8 17 18 2-14 12 4 19-16-9-16 9 4-19L6 24l18-2z" fill="#ffd23f" />
    <path d="M28 16l-3 7" stroke="#fff6cc" strokeWidth={4} />
  </Svg>
);

export const CheckIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="32" cy="32" r="26" fill="#5bc236" />
    <path d="M20 33l8 8 16-17" stroke="#fff" strokeWidth={7} />
  </Svg>
);

export const ClockIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="32" cy="34" r="24" fill="#fff" />
    <path d="M32 20v14l9 6" strokeWidth={5} />
    <path d="M24 6h16" strokeWidth={6} />
  </Svg>
);

export const SkullIcon = (p: P) => (
  <Svg {...p}>
    <path d="M32 6C18 6 9 15 9 28c0 8 4 13 9 16v10h28V44c5-3 9-8 9-16C55 15 46 6 32 6z" fill="#b388ff" />
    <circle cx="23" cy="29" r="6" fill={INK} />
    <circle cx="41" cy="29" r="6" fill={INK} />
    <path d="M28 54v-6M36 54v-6" strokeWidth={4} />
  </Svg>
);

export const GlobeIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="32" cy="32" r="26" fill="#42a5f5" />
    <path d="M14 22c6-2 10 2 14 0s4-8 10-8c4 2 2 8 6 10s8 0 8 6-6 6-8 10-2 10-8 10c-4-2-2-8-6-10s-10 0-12-6 2-6-4-12z" fill="#5bc236" stroke="none" />
    <circle cx="32" cy="32" r="26" />
    <path d="M18 18c2-3 6-6 10-7" stroke="#d6f0ff" strokeWidth={4} />
  </Svg>
);
