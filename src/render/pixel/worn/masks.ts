/**
 * Masks and glasses, drawn on frame 0's face: `at` is the pixel over his left eye (9,10 as drawn;
 * the right eye is 13,10, the nose 11,11, the muzzle 10 to 12 on rows 11 and 12, the chin row 13).
 * They are clipped to his head. A squashed face (eyes and nose on one row) uses `squash`.
 */
import type { MaskArt } from './types';

const EYE = { x: 9, y: 10 };

export const MASKS: Readonly<Record<string, MaskArt>> = {
  // Striped tube sock pulled over the face, eye holes cut, the toe flopping off the back.
  mask_tube_sock: {
    pal: { w: 'w', W: 'W', g: '5', R: 'R', U: 'U' },
    art: { at: { x: 2, y: 3 }, rows: [
      '#RRRRRRRR#',
      '#UUUUUUUU#',
      '#wwwwwwwg#',
      '#w.ww.wwg#',
      '#wwwwwwgg#',
      '.#wwwwgg#.',
    ] },
    squash: { at: { x: 2, y: 3 }, rows: [
      '#RRRRRRRR#',
      '#UUUUUUUU#',
      '#wwwwwwwg#',
      '#w.ww.wwg#',
      '.#wwwwgg#.',
    ] },
    free: { at: { x: -6, y: 0 }, rows: [
      '.##',
      '#Wg#',
      '#wg#',
      '.##.',
    ] },
    on: EYE,
  },
  // Gas station shades: hot pink frames, dark lenses with a lilac glint.
  mask_gas_station_shades: {
    pal: { q: 'q', P: 'P', v: 'v', m: 'm' },
    art: { at: { x: 2, y: 1 }, rows: [
      '#qqqPqqqq#',
      '.qvmqvvmq.',
      '..qq.qqq..',
    ] },
    on: EYE,
  },
  // Pool snorkel: one blue goggle over both eyes, a yellow tube up the side of his head.
  mask_pool_snorkel: {
    pal: { U: 'U', u: 'u', c: 'c', C: 'C', y: 'y', O: 'O', o: 'o' },
    art: { at: { x: 2, y: 1 }, rows: [
      '#UUUUUUUU#',
      'UC.cCc.cuU',
      '#uuuuuuuu#',
    ] },
    free: { at: { x: 5, y: 5 }, rows: [
      '#...',
      '#y#.',
      '#O#.',
      '#O#.',
      '#O#.',
      '#oy#',
      '.##o',
    ] },
    on: EYE,
  },
  // Peewee hockey mask: white plate, red chevrons, eye and breathing holes.
  mask_peewee_hockey: {
    pal: { w: 'w', W: 'W', g: '5', d: '4', R: 'R' },
    art: { at: { x: 2, y: 3 }, rows: [
      '.#wwwwww#.',
      '#wRwwwwRg#',
      '#wwRwwRwg#',
      '#w#ww#wgg#',
      '#wwwwwwgd#',
      '.#w#w#gd#.',
      '..#wwgd#..',
    ] },
    squash: { at: { x: 2, y: 3 }, rows: [
      '.#wwwwww#.',
      '#wRwwwwRg#',
      '#wwRwwRwg#',
      '#w#ww#wgg#',
      '.#w#w#gd#.',
      '..#wwgd#..',
    ] },
    on: EYE,
  },
  // Egg carton strip over the eyes, its cups bumping up along the top.
  mask_egg_carton: {
    pal: { T: 'T', t: 't', N: 'N', W: 'W' },
    art: { at: { x: 2, y: 2 }, rows: [
      '.#T##T##T.',
      '#TtTTtTTt#',
      '#t#Tt#TtN#',
      '.#NN#NNN#.',
    ] },
    on: EYE,
  },
  // Paper coffee filter over the muzzle, a coffee stain, strings to the ears.
  mask_coffee_filter: {
    pal: { w: 'w', W: 'W', g: '5', t: 't' },
    art: { at: { x: 2, y: 0 }, rows: [
      'W........W',
      '.W......W.',
      '..#wwww#..',
      '.#wWwWtg#.',
      '..#wgtg#..',
    ] },
    squash: { at: { x: 2, y: 0 }, rows: [
      'W........W',
      '.#wwwwww#.',
      '.#wWwWtg#.',
      '..#wgtg#..',
    ] },
    on: EYE,
  },
  // Thick black nerd glasses: a heavy top bar, pale blue glare on the lenses beside his eyes.
  mask_nerd_glasses: {
    pal: { k: 'k', C: 'C' },
    art: { at: { x: 2, y: 1 }, rows: [
      '.kkk.kkk.',
      'kC.kkC.k.',
    ] },
    on: EYE,
  },
  // Paper 3D glasses: white frame, one red lens and one cyan.
  mask_3d_glasses: {
    pal: { w: 'w', g: '5', R: 'R', r: 'r', c: 'c', C: 'C' },
    art: { at: { x: 2, y: 1 }, rows: [
      'wwwwwwwwwg',
      'wR.rwc.Cw.',
      '.www.www..',
    ] },
    on: EYE,
  },
  // Cat sleep mask: dark red band with cat ears and two closed eyes stitched on.
  mask_cat_sleep_mask: {
    pal: { r: 'r', R: 'R', P: 'P', e: 'e' },
    art: { at: { x: 2, y: 2 }, rows: [
      '.#R#..#R#.',
      '#RrRRRRrR#',
      '#RPPRRPPr#',
      '.#rrrrrr#.',
    ] },
    on: EYE,
  },
};
