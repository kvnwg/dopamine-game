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

  // ---------------------------------------------------------------- more clothes (itemsClothes.json)

  // Cheese puff dust: paws licked clean twice and still orange to the wrist.
  gloves_cheese_dust: {
    pal: { o: 'o', O: 'O', y: 'y' },
    ...make(false, { C: 'o', L: 'y', H: 'O', S: 'o' }),
  },
  // Bread bags pulled over the paws: polka dots, a green twist tie at the wrist.
  gloves_bread_bags: {
    pal: { w: 'w', W: 'W', d: '5', R: 'R', c: 'c', G: 'G' },
    down: piece([2, 1], ['.#G#.', '#wRW#', '#cWd#', '.###.']),
    out: piece([2, 1], ['.###..', '#wRWG.', '#cWdG.', '.###..']),
    up: piece([1, 2], ['.##.', '#wR#', '#cW#', '#Wd#', '#GG#']),
  },
  // Toilet paper wound round each paw, a sheet dangling from the hanging one.
  gloves_toilet_paper: {
    pal: { w: 'w', W: 'W', d: '5' },
    down: piece([1, 1], ['#W#.', '#wW#', '#dW#', '.#W#', '..#.']),
    out: piece([1, 1], ['.###.', '#wWW.', '#WdW.', '.###.']),
    up: piece([1, 1], ['.##.', '#wW#', '#Wd#', '#WW#']),
  },
  // A soup can on each paw: silver rims, the red and white label.
  gloves_soup_cans: {
    pal: { w: 'w', d: '5', g: '4', R: 'R', r: 'r', W: 'W' },
    down: piece([2, 2], ['.###.', '#dwg#', '#RRr#', '#WWd#', '.###.']),
    out: piece([2, 1], ['.####.', '#wRWd#', '#dRWg#', '.####.']),
    up: piece([2, 3], ['.###.', '#dwg#', '#RRr#', '#WWd#', '.###.']),
  },
  // Sock puppets with googly eyes: a blue one on the front paw, a red one on the back paw.
  gloves_sock_puppets: {
    pal: { w: 'w', x: 'x', U: 'U', u: 'u', W: 'W', R: 'R', r: 'r' },
    down: piece([2, 1], ['.#W#.', '#wxU#', '#UUu#', '.###.']),
    out: piece([2, 1], ['.###..', '#xwUW.', '#UUuW.', '.###..']),
    up: piece([1, 2], ['.##.', '#wx#', '#UU#', '#Uu#', '#WW#']),
    back: {
      down: piece([2, 1], ['.#W#.', '#wxR#', '#RRr#', '.###.']),
      out: piece([2, 1], ['.###..', '#xwRW.', '#RRrW.', '.###..']),
      up: piece([1, 2], ['.##.', '#wx#', '#RR#', '#Rr#', '#WW#']),
    },
  },
  // Fingerless biker gloves: black leather, a silver stud, his furry fingertips poking out.
  gloves_fingerless_biker: {
    pal: { b: '1', x: 'x', a: '5', n: 'n' },
    down: piece([1, 1], ['#b#.', '#ab#', '#nn#', '.##.']),
    out: piece([1, 1], ['.###.', '#nab.', '#nxb.', '.###.']),
    up: piece([1, 1], ['.##.', '#nn#', '#ab#', '#bx#']),
  },
  // An ice cream cone in each paw, held up: a strawberry scoop over the waffle cone.
  gloves_ice_cream_cones: {
    pal: { w: 'w', P: 'P', q: 'q', t: 't', N: 'N' },
    down: piece([1, 3], ['.##.', '#wP#', '#Pq#', '#tN#', '#t#.', '.#..']),
    out: piece([1, 3], ['.##.', '#wP#', '#Pq#', '#tN#', '#t#.', '.#..']),
    up: piece([1, 3], ['.##.', '#wP#', '#Pq#', '#tN#', '#t#.', '.#..']),
  },
  // Blue foam fingers, the finger pointing the way the arm does (straight up when he cheers).
  gloves_foam_finger: {
    pal: { c: 'c', U: 'U', u: 'u', W: 'W' },
    down: piece([2, 1], ['.#W#.', '#cUU#', '#UUu#', '.#u#.', '..#..']),
    out: piece([3, 2], ['..##.', '.#cU#', '#uUUW', '.#Uu#', '..##.']),
    up: piece([2, 3], ['..#..', '.#c#.', '#cUU#', '#UUu#', '.#W#.']),
  },
  // Lobster claw mitts: red pincers, open.
  gloves_lobster_claws: {
    pal: { e: 'e', R: 'R', r: 'r' },
    down: piece([2, 1], ['.#r#.', '#eRr#', '#R#r#', '#R#r#', '.#.#.']),
    out: piece([3, 2], ['.###.', '#eRR#', '.##Rr', '#Rrr#', '..##.']),
    up: piece([2, 3], ['.#.#.', '#e#r#', '#R#r#', '#eRr#', '.#r#.']),
  },
  // Takeout chopsticks fanned out of the paper sleeve wrapped round each paw, like claws.
  gloves_chopstick_claws: {
    pal: { R: 'R', W: 'W', T: 'T' },
    down: piece([3, 1], ['..#R#..', '.#WWW#.', '.#TTT#.', '#T#T#T#', '.#.#.#.']),
    out: piece([3, 3], ['.#...', '#T##.', '.#TW#', '#TTWR', '.#TW#', '#T##.', '.#...']),
    up: piece([3, 3], ['.#.#.#.', '#T#T#T#', '.#TTT#.', '.#WWW#.', '..#R#..']),
  },
};
