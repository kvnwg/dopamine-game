/**
 * Weapons, redrawn at his size: as the battle shows them (never mirrored), held at `grip` in his front
 * paw. Most lean 45 degrees (up and to the right, toward the enemies); the scene turns them about the
 * grip for swings.
 */
import type { WeaponArt } from './types';

export const WEAPONS: Readonly<Record<string, WeaponArt>> = {
  // Green garden hose looped over itself, a brass nozzle at the end.
  weapon_hose_whip: {
    pal: { G: 'G', g: 'g', l: 'l', y: 'y', O: 'O' },
    rows: [
      '......##.',
      '.....#yO#',
      '....#lG#.',
      '.##.#G#..',
      '#lG#lG#..',
      '#G##G#...',
      '#lGG#....',
      '#g##.....',
      '.#.......',
    ],
    grip: { x: 1, y: 7 },
    tilt: 45,
  },
  // Broken rake: wooden handle, a few bent tines left.
  weapon_broken_rake: {
    pal: { N: 'N', n: 'n', t: 't', a: '5', b: '3' },
    rows: [
      '....#.#..',
      '...#a#a#.',
      '....#bb#.',
      '...#tn##.',
      '..#tn#...',
      '.#tn#....',
      '#tn#.....',
      '#n#......',
      '.#.......',
    ],
    grip: { x: 1, y: 7 },
    tilt: 45,
  },
  // BBQ spatula: wooden handle, a wide steel blade.
  weapon_bbq_spatula: {
    pal: { N: 'N', n: 'n', t: 't', w: 'w', a: '5', b: '4', c: '3' },
    rows: [
      '.....###.',
      '....#wab#',
      '....#abc#',
      '...#bcc#.',
      '..#cn##..',
      '.#tn#....',
      '#tn#.....',
      '#n#......',
      '.#.......',
    ],
    grip: { x: 1, y: 7 },
    tilt: 45,
  },
  // Pink foam pool noodle.
  weapon_pool_noodle: {
    pal: { P: 'P', q: 'q', w: 'w', v: 'v' },
    rows: [
      '......##.',
      '.....#wP#',
      '....#PPq#',
      '...#PPq#.',
      '..#PPq#..',
      '.#PPq#...',
      '#Pqq#....',
      '#qq#.....',
      '.##......',
    ],
    grip: { x: 1, y: 7 },
    tilt: 45,
  },
  // Yellow wiffle bat, fat at the end.
  weapon_wiffle_bat: {
    pal: { y: 'y', Y: 'Y', O: 'O', o: 'o' },
    rows: [
      '.....###.',
      '....#YyO#',
      '...#YyyO#',
      '...#yyO#.',
      '..#yO##..',
      '.#yO#....',
      '#yO#.....',
      '#O#......',
      '.#.......',
    ],
    grip: { x: 1, y: 7 },
    tilt: 45,
  },
  // Unlit tiki torch: bamboo pole, wicker head.
  weapon_tiki_torch: {
    pal: { T: 'T', t: 't', N: 'N', n: 'n', b: 'b' },
    rows: [
      '.....###.',
      '....#NtN#',
      '....#nNn#',
      '...#tnn#.',
      '..#Tt##..',
      '.#Tt#....',
      '#Tt#.....',
      '#t#......',
      '.#.......',
    ],
    grip: { x: 1, y: 7 },
    tilt: 45,
  },
  // The leaf blower: orange motor, long gray tube.
  weapon_unique_leaf_blower: {
    pal: { O: 'O', o: 'o', y: 'y', a: '5', b: '3', c: '2' },
    rows: [
      '.......##',
      '......#ab',
      '.....#ab#',
      '..##ab#..',
      '.#yOb#...',
      '#yOOo#...',
      '#Ooo#....',
      '.#c#.....',
      '..#......',
    ],
    grip: { x: 2, y: 6 },
    tilt: 45,
  },
  // Busted umbrella, closed: a black canopy wrapped round the shaft, a hooked wooden handle.
  weapon_umbrella: {
    pal: { a: '1', b: '2', c: '3', w: '4', N: 'N', n: 'n' },
    rows: [
      '.......#.',
      '......#w#',
      '.....#wb#',
      '....#wba#',
      '...#wba#.',
      '..#bba#..',
      '..#a##...',
      '.#N#.....',
      '#N#......',
      '#n##.....',
      '.#n#.....',
    ],
    grip: { x: 1, y: 8 },
    tilt: 45,
  },
};
