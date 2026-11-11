import type { CSSProperties, Ref } from 'react';

/**
 * Light rays (rays.ts) as an image element. Safari shows an image element straight from its small
 * picture (384 px), however big it is drawn and while it turns. A big box with the rays as its
 * background was redrawn at full size instead: on iPhones at 3 pixels per stage pixel, ignoring the
 * stage's shrink to the screen (WebKit), tens of MB for each burst of rays, enough with the rest of a
 * big reveal to crash the page (Kevin: "i just got a rare item and the animation crashed my game").
 */
export function Rays({ url, className, style, imgRef }: { url: string; className?: string; style?: CSSProperties; imgRef?: Ref<HTMLImageElement> }) {
  return <img ref={imgRef} src={url} alt="" aria-hidden draggable={false} data-rays className={className} style={style} />;
}
