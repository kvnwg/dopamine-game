import type { CSSProperties } from 'react';
import { UI_PX, type Art } from '../../render/icons';

/**
 * A piece of pixel art at exactly UI_PX stage px per art pixel, the battle's pixel size. Its size
 * comes from the art alone (never from layout: no shrinking, no max-width, see pixel.css), and it is
 * never rotated or scaled by a fraction, so every pixel in the UI is the same size.
 */
export function PixelArt({ art, className, style }: { art: Art; className?: string; style?: CSSProperties }) {
  return (
    <img
      src={art.url}
      alt=""
      aria-hidden
      draggable={false}
      data-px=""
      className={className}
      style={{ ...style, width: art.w * UI_PX, height: art.h * UI_PX }}
    />
  );
}
