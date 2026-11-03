/**
 * Shields strapped to his back arm (the right one as drawn, by the tail), facing out. `art.at` is the
 * pixel on the back paw while the arm hangs (frame 0: 17,16): shields sit low at his side (rows 14 to
 * 19), so his tail still curls up above them (rows 11 to 13). `raised` is the paw's pixel when the arm is up beside his head (cheer,
 * hurt: 18,12), set so a raised shield stays off his face. Umbrellas are held up over his shoulder
 * like parasols and pass behind his head.
 */
import type { ShieldArt } from './types';

export const SHIELDS: Readonly<Record<string, ShieldArt>> = {
  // Coir welcome mat: tan border, brown field, a row of tan letters.
  shield_welcome_mat: {
    pal: { T: 'T', t: 't', n: 'n', N: 'N' },
    art: { at: { x: 2, y: 2 }, rows: [
      '#######',
      '#TTTTt#',
      '#TnTnN#',
      '#TTnTN#',
      '#tNNNN#',
      '#######',
    ] },
    raised: { x: 1, y: 3 },
  },
  // Galvanized trash can lid: ridged gray metal, the handle across its middle.
  shield_trash_lid: {
    pal: { w: 'w', a: '5', b: '4', c: '3', d: '2' },
    art: { at: { x: 3, y: 2 }, rows: [
      '..###..',
      '.#wwa#.',
      '#wa#ab#',
      '#a###b#',
      '#abbbc#',
      '.#bcd#.',
      '..###..',
    ] },
    raised: { x: 1, y: 3 },
  },
  // Blue frisbee with a bite out of its edge and a yellow logo.
  shield_chewed_frisbee: {
    pal: { C: 'C', c: 'c', U: 'U', u: 'u', Y: 'Y' },
    art: { at: { x: 3, y: 2 }, rows: [
      '..##...',
      '.#CC#..',
      '#CcYc##',
      '#cYYYU#',
      '#ccYUu#',
      '.#cUu#.',
      '..###..',
    ] },
    raised: { x: 1, y: 3 },
  },
  // Silver minivan hubcap: dark vents round a shiny center cap.
  shield_hubcap: {
    pal: { w: 'w', a: '5', b: '4', c: '3', x: '1' },
    art: { at: { x: 3, y: 2 }, rows: [
      '..###..',
      '.#wab#.',
      '#axaxb#',
      '#aaw#c#',
      '#bxbxc#',
      '.#bcc#.',
      '..###..',
    ] },
    raised: { x: 1, y: 3 },
  },
  // Round blue butter cookie tin: a gold band, a cookie on the lid.
  shield_cookie_tin: {
    pal: { C: 'C', c: 'c', U: 'U', u: 'u', y: 'y', O: 'O', T: 'T', t: 't' },
    art: { at: { x: 3, y: 2 }, rows: [
      '..###..',
      '.#Ccc#.',
      '#yyyyO#',
      '#cTTtu#',
      '#cTtuu#',
      '.#UUu#.',
      '..###..',
    ] },
    raised: { x: 1, y: 3 },
  },
  // FOR SALE sign: a red and white board on the wooden stake he holds.
  shield_for_sale_sign: {
    pal: { R: 'R', r: 'r', e: 'e', w: 'w', t: 't', n: 'n' },
    art: { at: { x: 2, y: 4 }, rows: [
      '######',
      '#wwww#',
      '#ReRr#',
      '#wwwr#',
      '##t###',
      '.#n#..',
    ] },
    raised: { x: 2, y: 5 },
  },
  // The mailbox of many catalogs: rounded gray box, red flag up, gold trim, on its post.
  shield_unique_mailbox: {
    pal: { w: 'w', a: '5', b: '4', c: '3', R: 'R', r: 'r', y: 'y', O: 'O', n: 'n' },
    art: { at: { x: 2, y: 4 }, rows: [
      '.###.##',
      '#waa#Rr',
      '#abb###',
      '#abcc#.',
      '#yyyO#.',
      '.#n#...',
    ] },
    raised: { x: 2, y: 5 },
  },
  // Golf umbrella held up like a parasol: black and green panels on a long gray handle.
  shield_golf_umbrella: {
    pal: { g: 'g', G: 'G', x: '1', a: '3' },
    art: { at: { x: 4, y: 9 }, rows: [
      '...###...',
      '..#GxG#..',
      '.#GxGxG#.',
      '#GxGxGxg#',
      '#x#x#x#x#',
      '....a....',
      '....a....',
      '....a....',
      '....a....',
      '....a....',
    ] },
    raised: { x: 4, y: 9 },
    behind: ['h'],
  },
  // Beach umbrella held up like a parasol: tan, green, blue and red panels on a gray pole.
  shield_beach_umbrella: {
    pal: { s: 's', g: 'G', C: 'C', r: 'R', a: '4' },
    art: { at: { x: 4, y: 9 }, rows: [
      '...###...',
      '..#sgC#..',
      '.#ssgCr#.',
      '#sssgCrr#',
      '#s#s#C#r#',
      '....a....',
      '....a....',
      '....a....',
      '....a....',
      '....a....',
    ] },
    raised: { x: 4, y: 9 },
    behind: ['h'],
  },
  // Pizza box: a kraft lid with a little pizza printed on it, the box's front edge below.
  shield_pizza_box: {
    pal: { T: 'T', t: 't', y: 'y', N: 'N', R: 'R', n: 'n' },
    art: { at: { x: 2, y: 2 }, rows: [
      '########',
      '#TTTTTt#',
      '#TtyytN#',
      '#TtyRtN#',
      '#nnnnnn#',
      '########',
    ] },
    raised: { x: 2, y: 3 },
  },
  // Teal cafeteria tray: mashed potatoes, mystery meat, peas and a red jello.
  shield_cafeteria_tray: {
    pal: { A: 'A', a: 'a', W: 'W', N: 'N', l: 'l', G: 'G', R: 'R', g: 'g' },
    art: { at: { x: 2, y: 2 }, rows: [
      '########',
      '#AAAAAa#',
      '#AWWANa#',
      '#AaaAaa#',
      '#AlGARa#',
      '#aggggg#',
      '########',
    ] },
    raised: { x: 2, y: 3 },
  },
  // Frying pan: black cast iron with an egg in it, the handle out behind him.
  shield_frying_pan: {
    pal: { '3': '3', '1': '1', w: 'w', y: 'y', Y: 'Y', x: 'x', '2': '2' },
    art: { at: { x: 3, y: 2 }, rows: [
      '..###....',
      '.#331#...',
      '#3wwy1##.',
      '#3wYw1x2#',
      '#21ww1##.',
      '.#211#...',
      '..###....',
    ] },
    raised: { x: 3, y: 3 },
  },
  // Yellow wet floor sign with a big black exclamation mark.
  shield_wet_floor_sign: {
    pal: { Y: 'Y', y: 'y', O: 'O', x: 'x' },
    art: { at: { x: 3, y: 3 }, rows: [
      '..###..',
      '.#YyO#.',
      '.#YxO#.',
      '#YyxyO#',
      '#YyyyO#',
      '#YyxyO#',
      '#OOOOO#',
      '#######',
    ] },
    raised: { x: 2, y: 4 },
  },
  // Stop sign: a red face in its white rim, on a stub of its post.
  shield_stop_sign: {
    pal: { w: 'w', R: 'R', e: 'e', r: 'r', '4': '4' },
    art: { at: { x: 3, y: 5 }, rows: [
      '..###..',
      '.#www#.',
      '#wReRw#',
      '#wRRRw#',
      '#wRRrw#',
      '.#www#.',
      '..#4#..',
      '...#...',
    ] },
    raised: { x: 2, y: 5 },
  },
  // Vinyl record: black grooves, a red label round the hole.
  shield_vinyl_record: {
    pal: { '2': '2', '1': '1', R: 'R', x: 'x', r: 'r' },
    art: { at: { x: 3, y: 2 }, rows: [
      '..###..',
      '.#221#.',
      '#21R11#',
      '#1RxR1#',
      '#11Rr1#',
      '.#11x#.',
      '..###..',
    ] },
    raised: { x: 1, y: 3 },
  },
  // Dartboard: red and green rings round cream and black, a red bullseye.
  shield_dartboard: {
    pal: { R: 'R', G: 'G', x: 'x', W: 'W' },
    art: { at: { x: 3, y: 2 }, rows: [
      '..###..',
      '.#RGR#.',
      '#GxWxG#',
      '#RWRWR#',
      '#GxWxG#',
      '.#RGR#.',
      '..###..',
    ] },
    raised: { x: 1, y: 3 },
  },
  // Manhole cover: dark cast iron with a raised grid.
  shield_manhole_cover: {
    pal: { '3': '3', '2': '2', '4': '4', '1': '1', x: 'x' },
    art: { at: { x: 3, y: 2 }, rows: [
      '..###..',
      '.#323#.',
      '#34343#',
      '#23131#',
      '#33231#',
      '.#21x#.',
      '..###..',
    ] },
    raised: { x: 1, y: 3 },
  },
  // Donut pool float: pink frosting with sprinkles on a tan ring, the hole in the middle.
  shield_donut_float: {
    pal: { w: 'w', P: 'P', Y: 'Y', q: 'q', c: 'c', l: 'l', t: 't', N: 'N' },
    art: { at: { x: 3, y: 2 }, rows: [
      '..####..',
      '.#wPPP#.',
      '#wPY#Pq#',
      '#Pc##lq#',
      '#tPqqqt#',
      '.#tNNN#.',
      '..####..',
    ] },
    raised: { x: 2, y: 3 },
  },
  // Satellite dish: a gray bowl, the receiver's arm sticking out, on its bracket.
  shield_satellite_dish: {
    pal: { '1': '1', x: 'x', '5': '5', '2': '2', '4': '4' },
    art: { at: { x: 2, y: 4 }, rows: [
      '.....##.',
      '.##.#1x#',
      '#55#2##.',
      '#5442#..',
      '#24445#.',
      '.#2245#.',
      '..#12#..',
      '..#1#...',
      '...#....',
    ] },
    raised: { x: 2, y: 5 },
  },
};
