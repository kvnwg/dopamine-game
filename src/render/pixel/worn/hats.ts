/**
 * Hats, drawn on frame 0's head (ear tips at rows 5 and 6, x 7 to 9 and 14 to 16; the crown's outline
 * on row 6, x 10 to 13; brows on row 7). Most sit down over the crown with his ears poking out through
 * them (`ears`), so the raccoon still reads: only 4 pixels of a hat show between his ears on rows 5 and 6,
 * so a hat wider than that (a takeout box, a nest, a crown) widens above them. Helmets and anything pulled
 * down over his head (the paint bucket, the bike helmet, the colander, the lampshade, the shower cap) cover
 * them. A hat may reach up to row 1: his head rises a row in the idle loop, and every pose must stay in the frame.
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
  // Open takeout box perched between his ears: noodles heaped up, chopsticks stuck in, a red band.
  hat_takeout_box: {
    pal: { T: 'T', t: 't', y: 'y', Y: 'Y', w: 'w', W: 'W', '5': '5', R: 'R', r: 'r' },
    art: { at: TOP, rows: [
      '........Tt',
      '.#####.Tt.',
      '#yYyyyTty#',
      '#wWWWWWW5#',
      '.#RRRRRr#.',
      '..#WWW5#..',
    ] },
    on: { x: 7, y: 1 },
    ears: 2,
  },
  // Green ball cap pulled down over his ears, the bent brim sticking out front.
  hat_bent_cap: {
    pal: { G: 'G', g: 'g', l: 'l', L: 'L' },
    art: { at: TOP, rows: [
      '........######...',
      '.......#lGGGGg#..',
      '......#lGGGGGGg#.',
      '......#lGGGGGGg#.',
      '.######ggggggggg#',
      '#LlllllgG#.......',
      '.#gggg##.........',
      '..####...........',
    ] },
    on: { x: 1, y: 2 },
    ears: 0,
  },
  // Puffy lilac shower cap pulled over his ears (two bumps), white dots, a frilly elastic edge.
  hat_shower_cap: {
    pal: { M: 'M', m: 'm', V: 'V', w: 'w' },
    art: { at: TOP, rows: [
      '...####..####...',
      '..#MMMM##mmmV#..',
      '.#MMwMMMmmmmVV#.',
      '.#MMMMmmmwmmVV#.',
      '#MwMMmmmmmmmVVV#',
      '#MMMMMMMMMMMMMm#',
      '#MM#MM#MM#MM#Mm#',
      '.##.##.##.##.##.',
    ] },
    on: { x: 4, y: 2 },
    ears: 0,
  },
  // Blue birthday party hat leaning off his head, pink dots, a gold pompom.
  hat_party_hat: {
    pal: { C: 'C', c: 'c', U: 'U', q: 'q', Y: 'Y', y: 'y', O: 'O' },
    art: { at: TOP, rows: [
      '....#Yy#',
      '...##yO#',
      '..#Cc##.',
      '.#CqU#..',
      '#CccU#..',
      '#cqcU#..',
    ] },
    on: { x: 9, y: 1 },
    ears: 2,
  },
  // Steel colander upside down over his ears: the foot ring on top, rows of holes, a loop handle each side.
  hat_colander: {
    pal: { w: 'w', '5': '5', '4': '4', '3': '3', '2': '2' },
    art: { at: TOP, rows: [
      '......####......',
      '....##w554##....',
      '...#5w555554#...',
      '..#5w52552554#..',
      '###5555555554###',
      '#.#2552552553#.#',
      '###4444444443###',
      '..############..',
    ] },
    on: { x: 4, y: 1 },
    ears: 0,
  },
  // A crumpled tinfoil cone pulled down over his ears.
  hat_tinfoil: {
    pal: { w: 'w', '5': '5', '4': '4', '3': '3' },
    art: { at: TOP, rows: [
      '......##......',
      '.....#w4#.....',
      '....#w5w4#....',
      '...#w55w43#...',
      '..#w5w54w43#..',
      '.#w5w55w4433#.',
      '#5w5w5444w433#',
      '#3#33#3#3#33#.',
    ] },
    on: { x: 5, y: 1 },
    ears: 0,
  },
  // Pink lampshade pulled down over his ears, gold fringe at his brow.
  hat_lampshade: {
    pal: { P: 'P', w: 'w', q: 'q', O: 'O', y: 'y' },
    art: { at: TOP, rows: [
      '....######.....',
      '....#wPPq#.....',
      '...#wPPPPq#....',
      '...#wPPPPq#....',
      '..#wPPPPPPq#...',
      '.#wwPPPPPPqq#..',
      '#OyyyyyyyyyyyO#',
      '#y#y#y#y#y#y#y#',
    ] },
    on: { x: 5, y: 1 },
    ears: 0,
  },
  // Jack-o'-lantern lid perched between his ears: ribbed orange, a green stem, the zigzag cut.
  hat_pumpkin_lid: {
    pal: { G: 'G', g: 'g', y: 'y', O: 'O', o: 'o', Y: 'Y' },
    art: { at: TOP, rows: [
      '....##....',
      '...#Gg#...',
      '..##Gg##..',
      '#yOOoOOoo#',
      '.#yOoOOo#.',
      '..#YoYo#..',
    ] },
    on: { x: 7, y: 1 },
    ears: 2,
  },
  // Twig nest perched between his ears, three robin's eggs on top.
  hat_bird_nest: {
    pal: { w: 'w', A: 'A', t: 't', N: 'N', n: 'n', b: 'b' },
    art: { at: TOP, rows: [
      '..##.##.##..',
      '.#wA#wA#wA#.',
      '#tNtnNtNtnN#',
      '.#NnbNnbNn#.',
      '..#nnbnbb#..',
      '...#bnbb#...',
    ] },
    on: { x: 6, y: 1 },
    ears: 2,
  },
  // Puffy chef's toque standing tall between his ears.
  hat_chef_toque: {
    pal: { w: 'w', W: 'W', '5': '5' },
    art: { at: TOP, rows: [
      '..###.###.',
      '.#wWW#WW5#',
      '#wWWWWWW5#',
      '.#WWWW55#.',
      '..#WW5W#..',
      '..#WW5W#..',
    ] },
    on: { x: 7, y: 1 },
    ears: 2,
  },
  // Propeller beanie between his ears: red, yellow and blue panels, a green band, the propeller up top.
  hat_propeller_beanie: {
    pal: { R: 'R', y: 'y', U: 'U', u: 'u', G: 'G', '4': '4' },
    art: { at: TOP, rows: [
      '.####..####..',
      '#RRRR#4#yyyy#',
      '.####.#.####.',
      '...#RRyyUU#..',
      '...#RRyyUu#..',
      '...#GGGGGG#..',
    ] },
    on: { x: 6, y: 1 },
    ears: 2,
  },
  // Black mortarboard balanced between his ears, the gold tassel hanging past his ear.
  hat_graduation_cap: {
    pal: { '2': '2', '1': '1', x: 'x', y: 'y', Y: 'Y', O: 'O' },
    art: { at: TOP, rows: [
      '....####....',
      '..##22y2##..',
      '##111111y1##',
      '..##xxxx##y.',
      '...#1xx1#.y.',
      '...#xxxx#.Y.',
      '.........O..',
    ] },
    on: { x: 6, y: 1 },
    ears: 2,
  },
  // Granny's china teapot on his head: spout out front, a loop handle at the back, a blue band.
  hat_teapot: {
    pal: { w: 'w', W: 'W', '5': '5', U: 'U' },
    art: { at: TOP, rows: [
      '.......##......',
      '#w#..#wWW5#....',
      '.#W##wWWWW5###.',
      '..#WwUUUUUU5#W#',
      '....##WWW55####',
      '.....#5555#....',
    ] },
    on: { x: 4, y: 1 },
    ears: 2,
  },
  // The Curb King's crown perched between his ears: gold points, bottle caps round the band, a glint.
  hat_unique_curb_crown: {
    pal: { Y: 'Y', y: 'y', O: 'O', w: 'w', R: 'R', c: 'c', G: 'G' },
    art: { at: TOP, rows: [
      '.#.##.#.',
      '#w#Yy#y#',
      '#YyYyyO#',
      '#yRycGO#',
      '#yyyyyO#',
      '.#OOOO#.',
    ] },
    on: { x: 8, y: 1 },
    ears: 2,
  },
};
