/**
 * The game's mark for the covers: the raccoon exactly as the game draws him, raising his BBQ Spatula
 * (his cheer pose, frame 13, holding the spatula the way the battle shows it: hero.ts composeHero),
 * cropped to his face, his paw and the spatula. Nothing is redrawn: the game's own pixels on a die-cut
 * sticker backing (logoArt.ts stickerOf, one game pixel wide), scaled up by whole pixels.
 */
import { blank, blit, crop, scaleUp, type PixelBuf } from '../../src/render/pixel/buf';
import { composeHero } from '../../src/render/pixel/hero';
import { stickerOf } from '../../src/render/logoArt';

/** His cheer pose, the paw with the spatula raised beside his face. */
const FRAME = 13;
const PAD = 6;
/**
 * His face (from the ear tips), the raised paw and the whole spatula, in the padded frame's pixels: the
 * tail and the legs are left out.
 */
const CROP = { x: 13, y: 11, w: 19, h: 11 };

/** The mark at the game's own size: his face, paw and spatula on its sticker. */
export function raccoonMarkArt(): PixelBuf {
  const hero = composeHero(FRAME, { weapon: 'weapon_bbq_spatula' }, PAD);
  const art = crop(hero, CROP.x, CROP.y, CROP.w, CROP.h);
  const st = stickerOf(art, 1);
  const out = blank(st.buf.w, st.buf.h);
  blit(out, st.buf, 0, 0);
  blit(out, art, st.pad, st.pad);
  return out;
}

/** The mark scaled up `n` times (whole pixels, no smoothing). */
export function raccoonMark(n = 4): PixelBuf {
  return scaleUp(raccoonMarkArt(), n);
}
