/**
 * Packs: the bag on his back, drawn behind him so it peeks out over his back shoulder (the right one as
 * drawn) between his head and the curl of his tail, and the straps over his front. Both are placed
 * with `at` on the neck (frame 0: 11,13; the bag's visible part is x 17 to 21, rows 4 to 10, above the
 * curl of his tail).
 * The fanny pack is the exception: it's worn round his middle, in front.
 */
import type { PackArt, Piece } from './types';

const piece = (at: [number, number], rows: string[]): Piece => ({ at: { x: at[0], y: at[1] }, rows });
/** The bag's top-left corner sits 5 right of the neck and 9 above it: it ends above his tail's curl. */
const bag = (rows: string[]): Piece => piece([-5, 9], rows);
/** Two straps coming over his shoulders, down the edges of his chest. */
const STRAPS = (k: string) => piece([3, -1], ['k......k', 'k......k'].map((r) => r.replace(/k/g, k)));

export const BACKPACKS: Readonly<Record<string, PackArt>> = {
  // Dented yellow lunchbox, its picture of a green field under a blue sky, a black handle on top.
  backpack_lunchbox: {
    pal: { y: 'y', Y: 'Y', O: 'O', o: 'o', c: 'c', G: 'G', g: '2' },
    back: bag([
      '..###.',
      '.#...#',
      '######',
      '#YyyO#',
      '#ccco#',
      '#GGGo#',
      '#yOOo#',
      '######',
    ]),
    straps: STRAPS('g'),
  },
  // Purple fanny pack on a belt round his middle, the zip pouch in front.
  backpack_fanny_pack: {
    pal: { V: 'V', v: 'v', m: 'm', M: 'M', g: '2' },
    back: piece([0, 0], ['.']),
    straps: piece([3, -3], ['gg.....g', '.#mMVv#.', '.#VVvv#.']),
    on: ['b', 'l'],
  },
  // Red picnic cooler with a white lid and a gray handle.
  backpack_picnic_cooler: {
    pal: { R: 'R', r: 'r', e: 'e', w: 'w', g: '5', d: '3' },
    back: bag([
      '.####.',
      '.#dd#.',
      '######',
      '#wwwg#',
      '#eRRr#',
      '#RRrr#',
      '#Rrrr#',
      '######',
    ]),
    straps: STRAPS('d'),
  },
  // Purple diaper bag, a baby bottle poking out of it.
  backpack_diaper_bag: {
    pal: { V: 'V', v: 'v', m: 'm', M: 'M', w: 'w', C: 'C', y: 'y' },
    back: bag([
      '...#y#',
      '...#w#',
      '####C#',
      '#mVVv#',
      '#VMMv#',
      '#VVvv#',
      '#vvvv#',
      '######',
    ]),
    straps: STRAPS('v'),
  },
  // Blue recycling bin, a green bottle sticking out, white arrows on the side.
  backpack_recycling_bin: {
    pal: { U: 'U', u: 'u', c: 'c', w: 'w', G: 'G', l: 'l' },
    back: bag([
      '..#l#.',
      '..#G#.',
      '######',
      '#cUUu#',
      '#UwwU#',
      '#UwUu#',
      '#Uuuu#',
      '######',
    ]),
    straps: STRAPS('u'),
  },
  // Canvas tote with a green leaf, its handles over his shoulder.
  backpack_reusable_tote: {
    pal: { T: 'T', t: 't', N: 'N', G: 'G', l: 'l' },
    back: bag([
      '.#..#.',
      '#.##.#',
      '######',
      '#TTTt#',
      '#TlGN#',
      '#TGtN#',
      '#tttN#',
      '######',
    ]),
    straps: piece([3, -1], ['.......N', '.......N']),
  },
};
