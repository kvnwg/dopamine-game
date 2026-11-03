/**
 * Bling around his neck and on his chest, drawn with `at` on the neck (frame 0: 11,13, the fur under
 * the chin; the chest is rows 14 to 17, his light belly x 9 to 13). Clipped to the neck and torso
 * unless `on` lists other parts.
 */
import type { BlingArt, Piece } from './types';

const piece = (at: [number, number], rows: string[]): Piece => ({ at: { x: at[0], y: at[1] }, rows });

export const BLING: Readonly<Record<string, BlingArt>> = {
  // Gold chain strung with red, white and blue bottle caps.
  bling_bottle_cap_chain: {
    pal: { y: 'y', O: 'O', R: 'R', g: '5', U: 'U' },
    art: piece([3, 0], ['..y.y..', '.R...U.', '..yRy..']),
  },
  // A brass house key on a string: round head, bitted shaft.
  bling_lost_house_key: {
    pal: { y: 'y', O: 'O', o: 'o', Y: 'Y', w: 'W' },
    art: piece([2, 0], ['.w.w.', '..yY.', '..Oy.', '..O..', '..Oo.']),
  },
  // Ball chain and a gold dog tag.
  bling_dog_tag: {
    pal: { g: '4', y: 'y', Y: 'Y', O: 'O' },
    art: piece([2, 0], ['g...g', '.g.g.', '.#Y#.', '.#O#.']),
  },
  // Silver chime tubes of three lengths hanging from a wooden bar.
  bling_wind_chime: {
    pal: { w: 'w', g: '5', d: '4', n: 'n', N: 'N' },
    art: piece([3, 0], ['.n...n.', '..NNn..', '..wgd..', '..w.d..', '..w....']),
  },
  // Soda tab bracelet: silver tabs on the front wrist.
  bling_soda_tab_bracelet: {
    pal: { w: 'w', g: '5', d: '4', q: 'q' },
    wrist: {
      down: piece([1, 1], ['wqg', '...']),
      out: piece([-1, 1], ['w', 'q', 'g']),
      up: piece([1, -1], ['wqg']),
    },
  },
  // Red glass Christmas ornament on a string.
  bling_xmas_ornament: {
    pal: { R: 'R', r: 'r', e: 'e', w: 'w', y: 'y' },
    art: piece([2, 0], ['.y.y.', '..y..', '.#y#.', '#eRr#', '.#r#.']),
  },
  // Clip-on tie, gray with a darker stripe.
  bling_clip_on_tie: {
    pal: { a: '3', b: '2', c: '4' },
    art: piece([1, 0], ['.c.', '.a.', 'cab', '.ab', '.b.']),
  },
  // A red bow tie at the neck.
  bling_bow_tie: {
    pal: { R: 'R', r: 'r', e: 'e', v: 'v' },
    art: piece([2, 0], ['eRrRr', 'Rr.rr']),
  },
  // Red knit scarf wrapped at the neck, an end hanging down the front.
  bling_knit_scarf: {
    pal: { R: 'R', r: 'r', e: 'e', w: 'W' },
    art: piece([3, 0], ['eRRwRRr', '.rRRR..', '..Rw...', '..rR...']),
    on: ['n', 'b', 'f', 'k'],
  },
  // Gold star toy police badge on the chest.
  bling_toy_police_badge: {
    pal: { y: 'y', Y: 'Y', O: 'O', U: 'U' },
    art: piece([-1, -1], ['.Y.', 'YUy', '.O.']),
  },
  // Silver chain and a crescent moon pendant.
  bling_moon_pendant: {
    pal: { g: '4', w: 'w', W: 'W', d: '3' },
    art: piece([2, 0], ['g...g', '.g.g.', '.#Ww#', '.#w#.', '.#dW#', '..##.']),
  },
};
