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

  // ---------------------------------------------------------------- more packs (carry group)
  // Green frog kiddie backpack: its big eyes pop up over his shoulder, pink cheeks and a smile.
  backpack_frog_kiddie: {
    pal: { w: 'w', x: 'x', L: 'L', l: 'l', G: 'G', g: 'g', P: 'P' },
    back: bag([
      '.##.##.',
      '#wx#wx#',
      '#LLLLl#',
      '#LPllP#',
      '#lgggl#',
      '#lllGG#',
      '#######',
    ]),
    straps: STRAPS('g'),
  },
  // Striped popcorn bucket, popcorn heaped over the rim.
  backpack_popcorn_bucket: {
    pal: { W: 'W', w: 'w', Y: 'Y', T: 'T', R: 'R', r: 'r' },
    back: bag([
      '.##.##.',
      '#Ww#WY#',
      '#WYWWT#',
      '#######',
      '#WRWRr#',
      '#WRWRr#',
      '.#RWR#.',
      '..###..',
    ]),
    straps: STRAPS('r'),
  },
  // Red shopping basket, its handles up, slots in its sides.
  backpack_shopping_basket: {
    pal: { e: 'e', R: 'R', r: 'r' },
    back: bag([
      '.####.',
      '.#..#.',
      '######',
      '#eeeR#',
      '#rrrr#',
      '#eRRr#',
      '#rrrr#',
      '######',
    ]),
    straps: STRAPS('r'),
  },
  // Wooden birdhouse with a red roof and a round hole.
  backpack_birdhouse: {
    pal: { e: 'e', R: 'R', r: 'r', T: 'T', t: 't', N: 'N', x: 'x' },
    back: bag([
      '..##..',
      '.#eR#.',
      '#eRRr#',
      '######',
      '#TTtN#',
      '#TxtN#',
      '#TttN#',
      '######',
    ]),
    straps: STRAPS('N'),
  },
  // Chrome toaster, two slices of toast sticking up.
  backpack_toaster: {
    pal: { T: 'T', t: 't', w: 'w', 5: '5', 4: '4', 3: '3', 2: '2' },
    back: bag([
      '.##.##.',
      '#TT#Tt#',
      '#######',
      '#w5554#',
      '#54443#',
      '#44433#',
      '#33322#',
      '#######',
    ]),
    straps: STRAPS('2'),
  },
  // Silver boombox: handle up, two dark speakers.
  backpack_boombox: {
    pal: { w: 'w', 5: '5', 4: '4', 3: '3', 2: '2', 1: '1', y: 'y' },
    back: bag([
      '..###..',
      '.#...#.',
      '#######',
      '#w5y55#',
      '#21521#',
      '#11511#',
      '#44443#',
      '#######',
    ]),
    straps: STRAPS('1'),
  },
  // Pink piggy bank: a gold coin in its slot, an ear up, its snout turned out at the far end.
  backpack_piggy_bank: {
    pal: { P: 'P', q: 'q', w: 'w', y: 'y', O: 'O', x: 'r' },
    back: bag([
      '..##...',
      '.#yO#.#',
      '.####q#',
      '#PwPPP#',
      '#PPPqq#',
      '#PPPqx#',
      '#qqqqq#',
      '.#q#q#.',
    ]),
    straps: STRAPS('q'),
  },
  // Steel kitchen sink, its faucet arching up over his shoulder.
  backpack_kitchen_sink: {
    pal: { w: 'w', 5: '5', 4: '4', 3: '3', 2: '2', R: 'R', U: 'U', C: 'C' },
    back: piece([-5, 11], [
      '.###...',
      '#554#..',
      '#4##4#.',
      '#4#.C..',
      '#4#....',
      '#######',
      '#w5554#',
      '#22222#',
      '#44443#',
      '#######',
    ]),
    straps: STRAPS('3'),
  },
  // Round fishbowl, an orange goldfish swimming in it.
  backpack_fishbowl: {
    pal: { C: 'C', c: 'c', U: 'U', w: 'w', O: 'O', y: 'y', T: 'T', t: 't' },
    back: bag([
      '.#####.',
      '.#CwC#.',
      '#CcccU#',
      '#cOyOU#',
      '#ccOcU#',
      '#TTttU#',
      '.#####.',
    ]),
    straps: STRAPS('U'),
  },
  // The soda jetpack: two green bottles with red labels, flames out of their caps, silver straps.
  backpack_unique_soda_jetpack: {
    pal: { L: 'L', G: 'G', g: 'g', 5: '5', 4: '4', e: 'e', R: 'R', Y: 'Y', O: 'O' },
    back: bag([
      '..##.##.',
      '.#LG#LG#',
      '.#LG#LG#',
      '.#eR#eR#',
      '.#Gg#Gg#',
      '.#RR#RR#',
      '.#YY#YY#',
      '..#O##O#',
      '...#..#.',
    ]),
    straps: STRAPS('4'),
  },
};
