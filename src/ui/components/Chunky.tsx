import type { CSSProperties } from 'react';
import s from './Chunky.module.css';

export const GRADIENTS = {
  gold: ['#fff7b0', '#ffc233', '#ff8a00'],
  blue: ['#f0fdff', '#7fd6ff', '#2a8cf0'],
  green: ['#f2ffe0', '#9ef06b', '#3fae2a'],
  purple: ['#fbefff', '#d29bff', '#8a3ff0'],
  red: ['#fff0e8', '#ff8a6b', '#e5323d'],
  white: ['#ffffff', '#ffffff', '#e6e9f4'],
  rainbow: ['#ff5252', '#ffb300', '#69f0ae', '#40c4ff', '#e040fb'],
} as const;

export type Grad = keyof typeof GRADIENTS;

/** Big outlined display text in banded colors (title cards, "LEGENDARY!", "FIGHT!"). */
export function Chunky({ text, size = 64, grad = 'white', className, style }: { text: string; size?: number; grad?: Grad; className?: string; style?: CSSProperties }) {
  const stops = GRADIENTS[grad];
  // Hard color bands, not a smooth blend: pixel-art lettering.
  const fill =
    grad === 'rainbow'
      ? `linear-gradient(90deg, ${stops.map((c, i) => `${c} ${(i * 100) / stops.length}% ${((i + 1) * 100) / stops.length}%`).join(', ')})`
      : `linear-gradient(180deg, ${stops[0]} 0 36%, ${stops[1]} 36% 70%, ${stops[2]} 70% 100%)`;
  return (
    <span className={`${s.chunky} ${className ?? ''}`} data-text={text} style={{ fontSize: size, ['--fill' as string]: fill, ...style } as CSSProperties}>
      {text}
    </span>
  );
}
