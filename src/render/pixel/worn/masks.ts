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
  // >>> headgear
  // Paper bag pulled over his head, ears poking out the top: two eye holes and a marker smile.
  mask_paper_bag: {
    pal: { T: 'T', t: 't', N: 'N', n: 'n' },
    art: { at: { x: 1, y: 4 }, rows: [
      '..T#TT..',
      '##TTtt##',
      'TTTTTTtN',
      'TTTTTTtN',
      'T.TTT.tN',
      'TnTTTntN',
      'TTnnntNN',
      '##...###',
    ] },
    squash: { at: { x: 1, y: 4 }, rows: [
      '..T#TT..',
      '##TTtt##',
      'TTTTTTtN',
      'TTTTTTtN',
      'T.TTT.tN',
      'TnnnnnNN',
      '##...###',
    ] },
    on: EYE,
  },
  // Red foam clown nose on his nose.
  mask_clown_nose: {
    pal: { w: 'w', e: 'e', R: 'R', r: 'r' },
    art: { at: { x: -1, y: 0 }, rows: [
      'weR',
      'eRr',
      'Rrr',
    ] },
    squash: { at: { x: -1, y: 1 }, rows: [
      'weR',
      'eRr',
      'Rrr',
    ] },
    on: EYE,
  },
  // Red bandana tied over his muzzle outlaw style, white dots, the point hanging under his chin.
  mask_bandana: {
    pal: { e: 'e', R: 'R', r: 'r', w: 'w' },
    art: { at: { x: 1, y: -1 }, rows: [
      'eeeeeeeR',
      'RRwRRRwr',
      '#R...Rr#',
    ] },
    squash: { at: { x: 1, y: -1 }, rows: [
      'eRwRRRwR',
      '#R...Rr#',
    ] },
    free: { at: { x: 0, y: -3 }, rows: [
      '.RRr',
      '#Rr#',
      '.##.',
    ] },
    on: EYE,
  },
  // Fake nose and glasses: bushy brows, thick black frames, a big pink nose, a black mustache.
  mask_groucho_glasses: {
    pal: { x: 'x', C: 'C', s: 's', S: 'S' },
    art: { at: { x: 1, y: 2 }, rows: [
      'xxx.xxx.',
      '#######.',
      'C.###C.#',
      '..ssS...',
      'xxsSSxx.',
    ] },
    squash: { at: { x: 1, y: 2 }, rows: [
      'xxx.xxx.',
      '#######.',
      'C.#s#C.#',
      'xxxSxxx.',
    ] },
    on: EYE,
  },
  // Two cucumber slices over his eyes. Spa day.
  mask_cucumber_slices: {
    pal: { G: 'G', g: 'g', L: 'L', l: 'l', W: 'W' },
    art: { at: { x: 2, y: 1 }, rows: [
      '.Gg...Gg.',
      'GLWg.GLWg',
      'GWlg.GWlg',
      '.gg...gg.',
    ] },
    on: EYE,
  },
  // Ski goggles: a white frame, a gold mirror lens across both eyes, the blue strap round his head.
  mask_ski_goggles: {
    pal: { w: 'w', '5': '5', Y: 'Y', y: 'y', O: 'O', U: 'U' },
    art: { at: { x: 2, y: 2 }, rows: [
      '.wwwwwwww.',
      'UwYwYYYy5U',
      'UwyyyyyO5U',
      '.555#5555.',
    ] },
    on: EYE,
  },
  // Glasses with two big googly eyes, the pupils off in two directions.
  mask_googly_glasses: {
    pal: { w: 'w', '5': '5', x: 'x' },
    art: { at: { x: 2, y: 2 }, rows: [
      '.###.###.',
      '#www#wxx#',
      '#www#wx5#',
      '#xx5#w55#',
      '.###.###.',
    ] },
    on: EYE,
  },
  // Black welding mask down over his face: a dark green window, a flame decal.
  mask_welding: {
    pal: { '2': '2', '1': '1', g: 'g', G: 'G', y: 'y', O: 'O', R: 'R' },
    art: { at: { x: 1, y: 3 }, rows: [
      '########',
      '22222221',
      '2######1',
      '2#Gggg#1',
      '2######1',
      '2yORyOy1',
      '##...###',
    ] },
    squash: { at: { x: 1, y: 3 }, rows: [
      '########',
      '22222221',
      '2######1',
      '2#Gggg#1',
      '2yORyOy1',
      '##...###',
    ] },
    on: EYE,
  },
  // A cereal box robot face: bottle cap eyes, a red stripe, a grille mouth, a wire antenna.
  mask_cereal_box_robot: {
    pal: { Y: 'Y', y: 'y', O: 'O', w: 'w', '5': '5', '4': '4', R: 'R', r: 'r', e: 'e' },
    art: { at: { x: 1, y: 3 }, rows: [
      '########',
      'YYYYYyyO',
      'w5yyyw5O',
      '54yyy54O',
      'RRRRRRRr',
      'Y#5#5#yO',
      '##...###',
    ] },
    squash: { at: { x: 1, y: 3 }, rows: [
      '########',
      'YYYYYyyO',
      'w5yyyw5O',
      '54yyy54O',
      'Y#5#5#yO',
      '##...###',
    ] },
    free: { at: { x: -2, y: 7 }, rows: [
      '.#.',
      '#e#',
      '.#.',
    ] },
    on: EYE,
  },
  // Gray rubber gas mask: two round lenses, a khaki filter can at the snout.
  mask_gas_mask: {
    pal: { '3': '3', '2': '2', '1': '1', w: 'w', C: 'C', c: 'c', T: 'T', t: 't', N: 'N' },
    art: { at: { x: 1, y: 3 }, rows: [
      '########',
      '33333332',
      'wC3332wC',
      'Cc2222Cc',
      '32222221',
      '32222111',
      '##...###',
    ] },
    squash: { at: { x: 1, y: 3 }, rows: [
      '########',
      '33333332',
      'wC3332wC',
      'Cc2222Cc',
      '32222111',
      '##...###',
    ] },
    free: { at: { x: 0, y: -1 }, rows: [
      '#TTt#',
      '#tTN#',
      '#NtN#',
      '.###.',
    ] },
    on: EYE,
  },
  // A monocle cut from a bottle bottom, gold rim round his eye, its chain dangling to his chest.
  mask_monocle: {
    pal: { Y: 'Y', y: 'y', O: 'O' },
    art: { at: { x: 1, y: 1 }, rows: [
      'Yyy',
      'y.O',
      'yOO',
    ] },
    free: { at: { x: -1, y: -2 }, rows: [
      'y..',
      'O..',
      '.y.',
      '..O',
    ] },
    on: EYE,
  },
  // Blue luchador mask: a white crest up the middle, gold flames round the eyes, laced up tight.
  mask_luchador: {
    pal: { c: 'c', U: 'U', u: 'u', w: 'w', y: 'y', Y: 'Y', R: 'R' },
    art: { at: { x: 1, y: 3 }, rows: [
      'cUUwwUUu',
      'cUUwwUUu',
      'yYyUUyYy',
      'y.yUUy.y',
      'cyUUUUyu',
      'cURRRUUu',
      '##...###',
    ] },
    squash: { at: { x: 1, y: 3 }, rows: [
      'cUUwwUUu',
      'cUUwwUUu',
      'yYyUUyYy',
      'y.yUUy.y',
      'cURRRUUu',
      '##...###',
    ] },
    on: EYE,
  },
  // <<< headgear
};
