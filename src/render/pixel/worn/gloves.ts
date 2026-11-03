/**
 * Gloves, drawn for his front paw (the left one as drawn) with `at` on the paw:
 * - down: the arm hangs (frame 0's paw is 6,16 under a one-pixel forearm at 6,15);
 * - out: the arm reaches out sideways, the paw at its left end (frame 13: 5,13, forearm to its right);
 * - up: the arm is raised, the paw on top (a raised back paw: frames 13 and 14).
 * The back paw wears the same glove mirrored, unless `back` gives it its own. The cuff sits on the
 * forearm, the hand is a little wider than his paw so the glove reads.
 */
import type { GloveArt, Piece } from './types';

const piece = (at: [number, number], rows: string[]): Piece => ({ at: { x: at[0], y: at[1] }, rows });

/**
 * A glove from three keys: cuff C, hand H, hand shadow S (and L for a light pixel on the hand). Small
 * gloves are a fist one pixel wider than his paw, big ones (`big`) two.
 */
function glove(big: boolean, rows: { down: string[]; out: string[]; up: string[] }): { down: Piece; out: Piece; up: Piece } {
  return {
    down: piece(big ? [2, 1] : [1, 1], rows.down),
    out: piece(big ? [2, 1] : [1, 1], rows.out),
    up: piece([1, big ? 2 : 1], rows.up),
  };
}

const SMALL = { down: ['#C#.', '#LH#', '#HS#', '.##.'], out: ['.###.', '#LHC.', '#HSC.', '.###.'], up: ['.##.', '#LH#', '#HS#', '#CC#'] };
const BIG = { down: ['.#C#.', '#LHH#', '#HHS#', '.###.'], out: ['.###..', '#LHHC.', '#HHSC.', '.###..'], up: ['.##.', '#LH#', '#HH#', '#HS#', '#CC#'] };
const keyed = (rows: string[], keys: Record<string, string>) => rows.map((r) => r.replace(/[CHLS]/g, (k) => keys[k]));
const make = (big: boolean, keys: Record<string, string>) => {
  const t = big ? BIG : SMALL;
  return glove(big, { down: keyed(t.down, keys), out: keyed(t.out, keys), up: keyed(t.up, keys) });
};

export const GLOVES: Readonly<Record<string, GloveArt>> = {
  // Yellow rubber dish gloves, the cuffs rolled.
  gloves_dish: {
    pal: { y: 'y', Y: 'Y', O: 'O' },
    ...make(false, { C: 'Y', L: 'Y', H: 'y', S: 'O' }),
  },
  // Canvas gardening gloves: tan hands, green cuffs.
  gloves_gardening: {
    pal: { T: 'T', t: 't', G: 'G', l: 'l' },
    ...make(false, { C: 'G', L: 'T', H: 'T', S: 't' }),
  },
  // Big quilted oven mitts: pale blue checks, white cuffs.
  gloves_oven_mitts: {
    pal: { C: 'C', c: 'c', U: 'U', W: 'W' },
    down: piece([2, 1], ['.#W#.', '#CcC#', '#cCU#', '.###.']),
    out: piece([2, 1], ['.###..', '#CcCW.', '#cCUW.', '.###..']),
    up: piece([1, 2], ['.##.', '#Cc#', '#cC#', '#cU#', '#WW#']),
  },
  // Big round red boxing gloves with white cuffs.
  gloves_kid_boxing: {
    pal: { R: 'R', r: 'r', e: 'e', W: 'W' },
    ...make(true, { C: 'W', L: 'e', H: 'R', S: 'r' }),
  },
  // Lost mittens: a purple one and a teal one that don't match.
  gloves_lost_mittens: {
    pal: { V: 'V', v: 'v', m: 'm', M: 'M', a: 'a', A: 'A', g: 'g' },
    ...make(false, { C: 'M', L: 'm', H: 'V', S: 'v' }),
    back: make(false, { C: 'A', L: 'A', H: 'a', S: 'g' }),
  },
  // A catcher's mitt on the back paw, a white batting glove on the front one.
  gloves_baseball_mitt: {
    pal: { N: 'N', n: 'n', t: 't', T: 'T', w: 'w', g: '5' },
    ...make(false, { C: 'g', L: 'w', H: 'w', S: 'g' }),
    back: {
      down: piece([2, 1], ['.###.', '#TtNn#', '#tNNn#', '.#nn#', '..##.']),
      out: piece([2, 1], ['.####.', '#TtNNn', '#tNNnn', '.#nn#.', '..##..']),
      up: piece([1, 3], ['.###.', '#TtN#', '#tNN#', '#tNn#', '.#n#.']),
    },
  },
  // Brown leather work gloves, gray stitched cuffs.
  gloves_leather_work: {
    pal: { b: 'b', n: 'n', N: 'N', g: '4' },
    ...make(false, { C: 'g', L: 'N', H: 'n', S: 'b' }),
  },
  // Long white gala gloves, up past the wrist.
  gloves_white_gala: {
    pal: { w: 'w', W: 'W', g: '5', d: '4' },
    down: piece([1, 2], ['#W#.', '#W#.', '#wW#', '.#d#']),
    out: piece([1, 1], ['.####', '#wWWW', '#Wgdd', '.####']),
    up: piece([1, 1], ['.##.', '#wW#', '#Wd#', '#WW#', '#WW#']),
  },
};
