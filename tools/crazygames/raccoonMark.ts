/**
 * The game's mark: the raccoon's face exactly as the game draws him, raising his BBQ Spatula (his cheer
 * pose, frame 13, holding the spatula the way the battle shows it: hero.ts composeHero), in front of the
 * street the game opens on (World 1, as the title screen shows it: titleScene.ts titleArt). A square, no
 * outline. Nothing is redrawn: his face is the game's pixels at three times the street's pixel size
 * (as the covers show the raccoon bigger than the scenery), and the whole mark scales up by whole pixels.
 */
import { blank, blit, crop, scaleUp, type PixelBuf } from '../../src/render/pixel/buf';
import { composeHero } from '../../src/render/pixel/hero';
import { FEET_ROW } from '../../src/render/pixel/sceneryTypes';
import { titleArt, TITLE } from '../../src/render/titleScene';

/** His cheer pose, the paw with the spatula raised beside his face. */
const FRAME = 13;
const PAD = 6;
/** His face (from the ear tips), the raised paw and the whole spatula, in the padded frame's pixels. */
const BUST = { x: 13, y: 11, w: 19, h: 11 };
/**
 * The square (art px): its size, the street column at its middle (the yellow house), how far below the
 * street's feet row it ends, and how many street pixels each of his pixels is.
 */
export const MARK = { size: 72, centerX: 92, below: 6, face: 3 };

/** Tiles `buf` across `dst` from row `y`, scrolled by `scroll`. */
function tile(dst: PixelBuf, buf: PixelBuf, y: number, scroll: number): void {
  const start = -(((scroll % buf.w) + buf.w) % buf.w);
  for (let x = start; x < dst.w; x += buf.w) blit(dst, buf, x, y);
}

/** The street the game opens on, nobody on it (art px, the title's width and height). */
function street(): PixelBuf {
  const A = titleArt('PLAY');
  const scene = blank(TITLE.w, TITLE.h);
  blit(scene, A.sky, 0, 0);
  if (A.glow) blit(scene, A.glow.buf, A.glow.x, A.glow.y);
  for (const cl of A.clouds) tile(scene, cl.buf, cl.y, cl.scroll0);
  for (const name of ['far', 'mid', 'ground', 'fg'] as const) tile(scene, A.layers[name].buf, A.layers[name].y, A.layers[name].scroll0);
  return scene;
}

/** His face, paw and spatula, the game's pixels, `n` times the game's size (no backing, no outline). */
export function raccoonFace(n = 1): PixelBuf {
  return scaleUp(crop(composeHero(FRAME, { weapon: 'weapon_bbq_spatula' }, PAD), BUST.x, BUST.y, BUST.w, BUST.h), n);
}

/** The mark at the street's pixel size (MARK.size square). */
export function raccoonMarkArt(): PixelBuf {
  const s = MARK.size;
  const feet = FEET_ROW + TITLE.drop;
  const out = crop(street(), MARK.centerX - s / 2, feet + MARK.below - s, s, s);
  const face = raccoonFace(MARK.face);
  blit(out, face, Math.round((s - face.w) / 2), s - face.h);
  return out;
}

/** The mark scaled up `n` times (whole pixels, no smoothing). */
export function raccoonMark(n = 1): PixelBuf {
  return scaleUp(raccoonMarkArt(), n);
}
