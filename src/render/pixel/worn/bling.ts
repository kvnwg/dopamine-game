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

  // ---------------------------------------------------------------- more bling (carry group)
  // Red cat collar round his neck, a gold jingle bell under his chin.
  bling_bell_collar: {
    pal: { e: 'e', R: 'R', r: 'r', Y: 'Y', y: 'y', O: 'O' },
    art: piece([2, 0], ['.eRr.', '..y..', '.YyO.', '.y#O.']),
  },
  // "HELLO my name is" sticker on his chest: a red band over white, the name scribbled in dark pen.
  bling_name_tag: {
    pal: { e: 'e', R: 'R', r: 'r', w: 'w', x: 'x' },
    art: piece([2, -2], ['eRRr', 'wxww']),
  },
  // Coach's whistle on a red cord.
  bling_whistle: {
    pal: { R: 'R', w: 'w', 5: '5', 4: '4', 3: '3' },
    art: piece([2, 0], ['.R.R.', '..R..', '#5w4#', '#433#', '.###.']),
  },
  // Scratched CD hanging from a string, a rainbow glint on it.
  bling_cd_pendant: {
    pal: { g: '2', w: '5', d: '4', s: '3', C: 'C', m: 'm' },
    art: piece([2, 0], ['.g.g.', '..g..', '#wCd#', '#d#s#', '.#m#.']),
  },
  // Red headphones round his neck, the cups resting under his jaw (on his head's outline there, hence 'h').
  bling_headphones: {
    pal: { g: '2', R: 'R', e: 'e', r: 'r' },
    art: piece([3, 0], ['eRgggeR', 'Rr...Rr', '##...##']),
    on: ['n', 'b', 'h'],
  },
  // Plastic lei of pink, yellow and purple flowers round his neck.
  bling_lei: {
    pal: { q: 'q', P: 'P', Y: 'Y', y: 'y', M: 'M', m: 'm' },
    art: piece([3, 0], ['..qYm..', '.Pq.yY.', '..MmP..']),
  },
  // Lobster bib tied at his neck: a red lobster on white.
  bling_lobster_bib: {
    pal: { w: 'w', W: 'W', e: 'e', R: 'R', r: 'r' },
    art: piece([2, 0], ['.#w#.', 'wwwwW', 'wRwRW', 'wwRWW', 'wRrRW']),
  },
  // Purple lanyard down to a gold VIP pass.
  bling_vip_lanyard: {
    pal: { V: 'V', v: 'v', g: '4', Y: 'Y', y: 'y', O: 'O', x: 'x' },
    art: piece([2, 0], ['.V.v.', '..V..', '..g..', '.Yyy.', '.yxO.']),
  },
  // Participation medal on a red and blue ribbon.
  bling_participation_medal: {
    pal: { U: 'U', R: 'R', e: 'e', Y: 'Y', y: 'y', O: 'O' },
    art: piece([2, 0], ['.U.R.', '..e..', '#YyO#', '#yOO#', '.###.']),
  },
  // Big clock on a heavy gold chain, its face on his belly.
  bling_big_clock: {
    pal: { y: 'y', Y: 'Y', O: 'O', W: 'W', w: 'w', x: 'x' },
    art: piece([3, 0], ['..y.y..', '..O.O..', '.YyyyO.', '.yWxWO.', '.yWWWO.']),
  },
};
