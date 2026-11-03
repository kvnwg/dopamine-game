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
};
