/**
 * Hats, drawn on frame 0's head (ear tips at rows 5 and 6, x 7 to 9 and 14 to 16; the crown's outline
 * on row 6, x 10 to 13; brows on row 7). Most sit down over the crown with his ears poking out through
 * them (`ears`), so the raccoon still reads; the paint bucket and the bike helmet cover them. A hat may reach
 * up to row 1: his head rises a row in the idle loop, and every pose must stay in the frame.
 */
import type { HatArt } from './types';

const TOP = { x: 0, y: 0 };

export const HATS: Readonly<Record<string, HatArt>> = {
  // Orange cone with two white bands on a gray base.
  hat_traffic_cone: {
    pal: { O: 'O', o: 'o', y: 'y', w: 'w', g: '5', s: '3' },
    art: { at: TOP, rows: [
      '....##....',
      '...#yo#...',
      '...#ww#...',
      '..#yOOo#..',
      '.#wwwwwg#.',
      '#ssssssss#',
    ] },
    on: { x: 7, y: 1 },
    ears: 2,
  },
  // Glazed red gnome hat, its tip flopping over the back, a dark band round the bottom.
  hat_lawn_gnome: {
    pal: { R: 'R', r: 'r', e: 'e' },
    art: { at: TOP, rows: [
      '....###...',
      '...#eRr##.',
      '..#eRRrRr#',
      '..#eRRr##.',
      '.#eRRRRr#.',
      '#rrrrrrrr#',
    ] },
    on: { x: 7, y: 1 },
    ears: 2,
  },
  // Upturned terracotta pot, a petunia growing out of the drain hole.
  hat_flower_pot: {
    pal: { V: 'V', m: 'm', Y: 'Y', G: 'G', e: 'e', o: 'o', n: 'n', O: 'O' },
    art: { at: TOP, rows: [
      '...#mV#....',
      '...#VYV#...',
      '..###G###..',
      '..#eoooon#.',
      '.#eoooooon#',
      '#eeeeeeeeO#',
    ] },
    on: { x: 6, y: 1 },
    ears: 2,
  },
  // Upturned yogurt tub: white plastic, a pink label with a strawberry.
  hat_yogurt_tub: {
    pal: { w: 'w', g: '5', d: '4', P: 'P', q: 'q', R: 'R', e: 'e', G: 'G' },
    art: { at: TOP, rows: [
      '..######..',
      '.#wwwwgd#.',
      '.#PPGPPq#.',
      '.#PeRRPq#.',
      '.#PPRPPq#.',
      '#wwwgggdd#',
    ] },
    on: { x: 7, y: 1 },
    ears: 2,
  },
  // A paint can jammed down over his ears: beige paint dripping off the rim, the wire handle dangling.
  hat_paint_bucket: {
    pal: { a: '5', b: '4', c: '3', d: '2', W: 'W', T: 'T', t: 't' },
    art: { at: TOP, rows: [
      '..########...',
      '..#aaaabb#...',
      '.#aabbbbcc#..',
      '.#abbbbbcc#..',
      '.#WWTWWWTt#..',
      '#WWTWWWTWtW##',
      '#dddTdddddd#d',
      '....T......#.',
      '...........d.',
      '..........d..',
    ] },
    on: { x: 6, y: 1 },
    ears: 0,
  },
  // Cracked bike helmet: a blue vented shell over his whole crown (ears tucked in), a white crack, a gray rim.
  hat_bike_helmet: {
    pal: { C: 'C', c: 'c', U: 'U', u: 'u', w: 'w', W: 'W', g: '5', d: '4' },
    art: { at: TOP, rows: [
      '...######...',
      '..#CwCcUu#..',
      '.#Cw#c#Uuu#.',
      '#CcwccccUuu#',
      '#cc#cc#cUu##',
      '#cUUUUUUuuu#',
      '#WWWggggggd#',
    ] },
    on: { x: 6, y: 1 },
    ears: 0,
  },
};
