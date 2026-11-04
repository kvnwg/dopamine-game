/**
 * The game's mark: the raccoon's face exactly as the game draws him, raising his BBQ Spatula (his cheer
 * pose, frame 13, holding the spatula the way the battle shows it: hero.ts composeHero), in front of the
 * town on the hill behind the street the game opens on (World 1's far layer, its sky and clouds, as the
 * title screen shows them: titleScene.ts titleArt). A square with no outline, him and the town at the
 * same pixel size, scaled up by whole pixels. Nothing is redrawn.
 */
import { blank, blit, crop, scaleUp, type PixelBuf } from '../../src/render/pixel/buf';
import { composeHero } from '../../src/render/pixel/hero';
import { titleArt, TITLE } from '../../src/render/titleScene';

/** His cheer pose, the paw with the spatula raised beside his face. */
const FRAME = 13;
const PAD = 6;
/** His face (from the ear tips), the raised paw and the whole spatula, in the padded frame's pixels. */
const BUST = { x: 13, y: 11, w: 19, h: 11 };
/**
 * The square (art px): its size, its top left in the title's sky (the far layer's top row is the
 * town's: the church spire and the houses fill the square behind him), and where his face sits along
 * its bottom edge.
 */
export const MARK = { size: 36, x: 64, below: 0, faceX: 8 };

/** Tiles `buf` across `dst` from row `y`, scrolled by `scroll`. */
function tile(dst: PixelBuf, buf: PixelBuf, y: number, scroll: number): void {
  const start = -(((scroll % buf.w) + buf.w) % buf.w);
  for (let x = start; x < dst.w; x += buf.w) blit(dst, buf, x, y);
}

/** His face, paw and spatula: the game's pixels, `n` times the game's size, no backing, no outline. */
export function raccoonFace(n = 1): PixelBuf {
  return scaleUp(crop(composeHero(FRAME, { weapon: 'weapon_bbq_spatula' }, PAD), BUST.x, BUST.y, BUST.w, BUST.h), n);
}

/** The mark at the game's own pixel size (MARK.size square). */
export function raccoonMarkArt(): PixelBuf {
  const A = titleArt('PLAY');
  const sky = blank(TITLE.w, TITLE.h);
  blit(sky, A.sky, 0, 0);
  if (A.glow) blit(sky, A.glow.buf, A.glow.x, A.glow.y);
  for (const cl of A.clouds) tile(sky, cl.buf, cl.y, cl.scroll0);
  tile(sky, A.layers.far.buf, A.layers.far.y, A.layers.far.scroll0);
  const s = MARK.size;
  const out = crop(sky, MARK.x, A.layers.far.y + MARK.below, s, s);
  const face = raccoonFace(1);
  blit(out, face, MARK.faceX, s - face.h);
  return out;
}

/** The mark scaled up `n` times (whole pixels, no smoothing). */
export function raccoonMark(n = 1): PixelBuf {
  return scaleUp(raccoonMarkArt(), n);
}
