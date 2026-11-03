/**
 * Shoes, drawn on one foot with `at` on the foot's bottom pixel (frame 0's feet are 9,19 and 14,19:
 * one pixel of fur between outlines, the hips' row above). Toes point left, the way he faces as drawn.
 * Nothing goes below the foot: that row stands on the ground.
 */
import type { Piece, ShoeArt } from './types';

const piece = (at: [number, number], rows: string[]): Piece => ({ at: { x: at[0], y: at[1] }, rows });

export const SHOES: Readonly<Record<string, ShoeArt>> = {
  // Lime crocs: chunky clogs with holes on top.
  sneakers_crocs: {
    pal: { G: 'G', g: 'g', l: 'l', L: 'L' },
    front: piece([2, 1], ['.#Ll#', '#lglG#']),
  },
  // Flip-flops: a blue sole and an orange thong strap.
  sneakers_flip_flops: {
    pal: { C: 'C', c: 'c', U: 'U', O: 'O', o: 'o' },
    front: piece([2, 1], ['..O..', '#CcU#']),
  },
  // Red roller skates on yellow wheels.
  sneakers_roller_skates: {
    pal: { R: 'R', r: 'r', e: 'e', w: 'w', y: 'y', g: '3' },
    front: piece([2, 2], ['.#eR#', '#wRrr#', '.y#y#']),
  },
  // Fluffy white bunny slippers: pink-lined ears up, a pink nose.
  sneakers_bunny_slippers: {
    pal: { w: 'w', W: 'W', g: '5', P: 'P', q: 'q' },
    front: piece([2, 2], ['.wP..', '.#q#.', '#wWwg#']),
  },
  // Yellow rain boots up to the knee.
  sneakers_rain_boots: {
    pal: { y: 'y', Y: 'Y', O: 'O', o: 'o' },
    front: piece([1, 2], ['#Yy#', '#yO#', '#yyO#']),
  },
  // White sneakers with a rainbow light-up sole.
  sneakers_light_up: {
    pal: { w: 'w', g: '5', R: 'R', y: 'y', l: 'l', c: 'c' },
    front: piece([2, 1], ['.#ww#', '#Rylc#']),
  },

  // ---------------------------------------------------------------- more clothes (itemsClothes.json)

  // Grocery bags tied round the feet: the handles knotted at the ankle, red THANK YOU print.
  sneakers_grocery_bags: {
    pal: { w: 'w', W: 'W', d: '5', R: 'R' },
    front: piece([2, 2], ['..#W#.', '.#wWd#', '#WRWd#']),
  },
  // Soda cans stomped round the feet: red, a white swoosh, silver rims at toe and heel.
  sneakers_can_stompers: {
    pal: { R: 'R', r: 'r', w: 'w', d: '5' },
    front: piece([2, 1], ['.#RRr#.', '#dRwRd#']),
  },
  // Tissue boxes: blue with a white flower, a tissue puffing out of the top.
  sneakers_tissue_boxes: {
    pal: { C: 'C', c: 'c', U: 'U', W: 'W', w: 'w' },
    front: piece([2, 2], ['..#w#.', '#CCwC#', '#cWcU#']),
  },
  // Red canvas high-tops: up over the ankle, a white toe cap and sole.
  sneakers_high_tops: {
    pal: { R: 'R', e: 'e', w: 'w', W: 'W', d: '5' },
    front: piece([2, 2], ['..#eR#', '#wRRR#', '#WWWWd#']),
  },
  // White tube socks with a red stripe in brown sandals.
  sneakers_socks_and_sandals: {
    pal: { R: 'R', w: 'w', W: 'W', n: 'n', N: 'N', b: 'b' },
    front: piece([2, 2], ['..#R#.', '.#wWW#', '#WnNnb#']),
  },
  // Rental bowling shoes: red toe and heel, a tan laced middle.
  sneakers_bowling_shoes: {
    pal: { R: 'R', r: 'r', T: 'T', x: 'x' },
    front: piece([2, 1], ['.#TxR#', '#RTTRr#']),
  },
  // Swim flippers: the dark foot pocket, a long aqua blade slapping out in front.
  sneakers_flippers: {
    pal: { A: 'A', a: 'a', g: 'g' },
    front: piece([4, 1], ['....#gg#', '#AAAaagg#']),
  },
  // Cowboy boots: brown, up the leg, a pointy toe and a stacked heel.
  sneakers_cowboy_boots: {
    pal: { N: 'N', n: 'n', t: 't', b: 'b' },
    front: piece([2, 2], ['..#Nn#', '.#tNn#', '#tNNbb#']),
  },
  // Clown shoes: long and red, a huge round toe, a yellow bow at the ankle.
  sneakers_clown_shoes: {
    pal: { R: 'R', r: 'r', e: 'e', y: 'y' },
    front: piece([4, 2], ['.##.....', '#eR#.#y#', '#RRRRRr#']),
  },
  // The sneakers off the power line: white, a red stripe, a gold sole, a lace loop at the heel.
  sneakers_unique_power_line: {
    pal: { w: 'w', W: 'W', R: 'R', y: 'y', Y: 'Y' },
    front: piece([2, 2], ['...#w#', '.#wRW#', '#Yyyyy#']),
  },
};
