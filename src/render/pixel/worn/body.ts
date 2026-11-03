/**
 * The raccoon's body, frame by frame, measured by hand from his sheet (packs/raccoon.ts) so worn
 * gear can fit every pose: which body part each pixel belongs to, and where his head, face, paws,
 * feet and neck are. Everything is in the sheet's own pixels (24 x 24, facing left, tail on the
 * right); the battle mirrors the dressed body.
 */
import { RACCOON } from '../packs/raccoon';

/**
 * Body parts: h head (ears, face and their outline), n neck, b torso, f front arm (holds the weapon),
 * p front paw, k back arm (wears the shield), q back paw, t tail, l hips and legs, o feet,
 * x effects drawn into the frame (the dash's swing trail, sleep z's).
 */
export type Part = 'h' | 'n' | 'b' | 'f' | 'p' | 'k' | 'q' | 't' | 'l' | 'o' | 'x';

/** Frames that repeat another frame's art exactly. */
export const SAME_FRAME: Readonly<Record<number, number>> = { 6: 0, 12: 0, 23: 22, 30: 22, 34: 20, 35: 19 };

/** First row of PART_ROWS (rows above and below hold no raccoon in any frame). */
const ROW0 = 4;

/** Every pixel's body part ('.' where the frame is empty), rows 4 to 19 of each frame. */
const PART_ROWS: Readonly<Record<number, readonly string[]>> = {
  0: [
    '........................', // 4
    '........hh....hh........', // 5
    '.......hhhhhhhhhh.......', // 6
    '.......hhhhhhhhhh.......', // 7
    '.......hhhhhhhhhh.......', // 8
    '.......hhhhhhhhhh.......', // 9
    '.......hhhhhhhhhh.......', // 10
    '.......hhhhhhhhhhtt.....', // 11
    '.......hhhhhhhhhhttt....', // 12
    '........hhnnnhhhtttt....', // 13
    '......fbbbbbbbbbbttt....', // 14
    '.....fffbbbbbbbbkkk.....', // 15
    '.....pppbbbbbbbbqqq.....', // 16
    '......ppbbbbbbbbqq......', // 17
    '........llllllll........', // 18
    '........ooo..ooo........', // 19
  ],
  1: [
    '........................', // 4
    '........hh....hh........', // 5
    '.......hhhhhhhhhh.......', // 6
    '.......hhhhhhhhhh.......', // 7
    '.......hhhhhhhhhh.......', // 8
    '.......hhhhhhhhhh.......', // 9
    '.......hhhhhhhhhht......', // 10
    '.......hhhhhhhhhhtt.....', // 11
    '.......hhhhhhhhhhttt....', // 12
    '........hhnnnhhhtttt....', // 13
    '......fbbbbbbbbbbttt....', // 14
    '.....fffbbbbbbbbkkk.....', // 15
    '.....pppbbbbbbbbqqq.....', // 16
    '......llllllllllll......', // 17
    '........ooo..ooo........', // 18
    '........ooo..ooo........', // 19
  ],
  2: [
    '........hh....hh........', // 4
    '.......hhhhhhhhhh.......', // 5
    '.......hhhhhhhhhh.......', // 6
    '.......hhhhhhhhhh.......', // 7
    '.......hhhhhhhhhh.......', // 8
    '.......hhhhhhhhhh.......', // 9
    '.......hhhhhhhhhhtt.....', // 10
    '.......hhhhhhhhhhttt....', // 11
    '........hhnnnhhhtttt....', // 12
    '......fbbbbbbbbbbttt....', // 13
    '.....fffbbbbbbbbkkkk....', // 14
    '.....pppbbbbbbbbqqq.....', // 15
    '......ppbbbbbbbbqq......', // 16
    '.......llllllllll.......', // 17
    '........ooo..ooo........', // 18
    '........ooo..ooo........', // 19
  ],
  3: [
    '........hh....hh........', // 4
    '.......hhhhhhhhhh.......', // 5
    '.......hhhhhhhhhh.......', // 6
    '.......hhhhhhhhhh.......', // 7
    '.......hhhhhhhhhh.......', // 8
    '.......hhhhhhhhhh.......', // 9
    '.......hhhhhhhhhhtt.....', // 10
    '.......hhhhhhhhhhttt....', // 11
    '.......hhhnnnhhhtttt....', // 12
    '......fbbbbbbbbbbttt....', // 13
    '.....fffbbbbbbbbkkk.....', // 14
    '.....pppbbbbbbbbqqq.....', // 15
    '......ppbbbbbbbbqq......', // 16
    '.......bbbbbbbbbb.......', // 17
    '........llllllll........', // 18
    '........ooo..ooo........', // 19
  ],
  4: [
    '........................', // 4
    '........................', // 5
    '........hh....hh........', // 6
    '.......hhhhhhhhhh.......', // 7
    '.......hhhhhhhhhh.......', // 8
    '.......hhhhhhhhhh.......', // 9
    '.......hhhhhhhhhh.......', // 10
    '.......hhhhhhhhhhtt.....', // 11
    '.......hhhhhhhhhhttt....', // 12
    '........hhnnnhhhtttt....', // 13
    '......fbbbbbbbbbbttt....', // 14
    '.....fffbbbbbbbbkkk.....', // 15
    '.....pppbbbbbbbbqqq.....', // 16
    '......ppbbbbbbbbqq......', // 17
    '........bbbbbbbb........', // 18
    '........ooo..ooo........', // 19
  ],
  5: [
    '........................', // 4
    '........hh....hh........', // 5
    '.......hhhhhhhhhh.......', // 6
    '.......hhhhhhhhhh.......', // 7
    '.......hhhhhhhhhh.......', // 8
    '.......hhhhhhhhhh.......', // 9
    '.......hhhhhhhhhh.......', // 10
    '.......hhhhhhhhhht......', // 11
    '.......hhhhhhhhhhtt.....', // 12
    '........hhnnnhhhtttt....', // 13
    '......fbbbbbbbbbbttt....', // 14
    '.....fffbbbbbbbbkkk.....', // 15
    '.....pppbbbbbbbbqqq.....', // 16
    '......ppbbbbbbbbqq......', // 17
    '........llllllll........', // 18
    '........ooo..ooo........', // 19
  ],
  7: [
    '........................', // 4
    '........................', // 5
    '........hh....hh........', // 6
    '.......hhhhhhhhhh.......', // 7
    '.......hhhhhhhhhh.......', // 8
    '.......hhhhhhhhhh.......', // 9
    '.......hhhhhhhhhht......', // 10
    '.......hhhhhhhhhhtt.....', // 11
    '.......hhhhhhhhhhttt....', // 12
    '........hhnnnhhhtttt....', // 13
    '......fbbbbbbbbbbtt.....', // 14
    '.....fffbbbbbbbbkkk.....', // 15
    '.....pppbbbbbbbbqq......', // 16
    '......ppbbbbbbbq........', // 17
    '........llllllll........', // 18
    '........ooo.............', // 19
  ],
  8: [
    '........................', // 4
    '........hh....hh........', // 5
    '.......hhhhhhhhhh.......', // 6
    '.......hhhhhhhhhh.......', // 7
    '.......hhhhhhhhhh.......', // 8
    '.......hhhhhhhhhh.......', // 9
    '.......hhhhhhhhhhtt.....', // 10
    '.......hhhhhhhhhhttt....', // 11
    '.......hhhhhhhhhhttt....', // 12
    '........hhnnhhhhtttt....', // 13
    '.......fbbbbbbbbttt.....', // 14
    '......fffbbbbbbkkk......', // 15
    '......pppbbbbbqqqq......', // 16
    '.......bbbbbbqq.........', // 17
    '........lllllll.........', // 18
    '........ooo.............', // 19
  ],
  9: [
    '........................', // 4
    '........hh....hh........', // 5
    '.......hhhhhhhhhh.......', // 6
    '.......hhhhhhhhhh.......', // 7
    '.......hhhhhhhhhh.......', // 8
    '.......hhhhhhhhhh.......', // 9
    '.......hhhhhhhhhh.......', // 10
    '.......hhhhhhhhhhtt.....', // 11
    '.......hhhhhhhhhhttt....', // 12
    '........hhnnhhhhtttt....', // 13
    '.......fbbbbbbbbkttt....', // 14
    '......fffbbbbbbkkkk.....', // 15
    '......pppbbbbbbqqq......', // 16
    '.......bbbbbbbbbb.......', // 17
    '........lllllll.........', // 18
    '........ooo.ooo.........', // 19
  ],
  10: [
    '........................', // 4
    '........................', // 5
    '........hh....hh........', // 6
    '.......hhhhhhhhhh.......', // 7
    '.......hhhhhhhhhh.......', // 8
    '.......hhhhhhhhhh.......', // 9
    '.......hhhhhhhhhh.......', // 10
    '.......hhhhhhhhhht......', // 11
    '.......hhhhhhhhhhtt.....', // 12
    '.......hhhnnhhhhtttt....', // 13
    '......fbbbbbbbbbkttt....', // 14
    '......fffbbbbbbkkktt....', // 15
    '.......pbbbbbbbqqtt.....', // 16
    '........bbbbbbbbb.......', // 17
    '........lllllll.........', // 18
    '............ooo.........', // 19
  ],
  11: [
    '........................', // 4
    '........hh....hh........', // 5
    '.......hhhhhhhhhh.......', // 6
    '.......hhhhhhhhhh.......', // 7
    '.......hhhhhhhhhh.......', // 8
    '.......hhhhhhhhhh.......', // 9
    '.......hhhhhhhhhh.......', // 10
    '.......hhhhhhhhhh.......', // 11
    '.......hhhhhhhhhhtt.....', // 12
    '......hhhhnnnhhhtttt....', // 13
    '.....fbbbbbbbbbbbttt....', // 14
    '.....fffbbbbbbbbkkk.....', // 15
    '......ppbbbbbbbbqqq.....', // 16
    '........bbbbbbbbbb......', // 17
    '........llllllll........', // 18
    '.............ooo........', // 19
  ],
  13: [
    '........................', // 4
    '........hh....hh........', // 5
    '.......hhhhhhhhhh.......', // 6
    '.......hhhhhhhhhh.......', // 7
    '.......hhhhhhhhhh.......', // 8
    '.......hhhhhhhhhh.......', // 9
    '.......hhhhhhhhhh.......', // 10
    '.......hhhhhhhhhhqqq....', // 11
    '.....fffhhhhhhhhhqqqq...', // 12
    '....pfffhhnnnhhhkkktt...', // 13
    '....pppfbbbbbbbbkkktt...', // 14
    '....ppp.bbbbbbbbbttt....', // 15
    '.......bbbbbbbbbbbb.....', // 16
    '.......bbbbbbbbbb.......', // 17
    '........lllllllll.......', // 18
    '........ooo...ooo.......', // 19
  ],
  14: [
    '........................', // 4
    '........hh....hh........', // 5
    '.......hhhhhhhhhh.......', // 6
    '.......hhhhhhhhhh.......', // 7
    '.......hhhhhhhhhh.......', // 8
    '.......hhhhhhhhhh.......', // 9
    '.......hhhhhhhhhhqq.....', // 10
    '.....fffhhhhhhhhhqqq....', // 11
    '....ppfhhhhhhhhhhqqqq...', // 12
    '....pfffhhnnnhhhkkktt...', // 13
    '.....fffbbbbbbbbkkktt...', // 14
    '........bbbbbbbbbttt....', // 15
    '.......bbbbbbbbbbbb.....', // 16
    '.......bbbbbbbbbb.......', // 17
    '........llllllllll......', // 18
    '........ooo....ooo......', // 19
  ],
  15: [
    '........................', // 4
    '........................', // 5
    '........................', // 6
    '........hh....hh........', // 7
    '.......hhhhhhhhhh.......', // 8
    '.......hhhhhhhhhh.......', // 9
    '.......hhhhhhhhhh.......', // 10
    '...x..hhhhhhhhhhhtt.....', // 11
    '...xx.xhhhhhhhhhhttt....', // 12
    '....xxxhhhhhhhhhhtttt...', // 13
    '....xxxxhhnnnhhhktttt...', // 14
    '.....xxxxxxxxbbbbkttt...', // 15
    '....xxxxxxxxbbbbbktt....', // 16
    '.....xxxxxxxbbbbbkt.....', // 17
    '......xxxxxllllllt......', // 18
    '........xx.....ooo......', // 19
  ],
  16: [
    '........................', // 4
    '........................', // 5
    '........hh....hh........', // 6
    '.......hhhhhhhhhh.......', // 7
    '.......hhhhhhhhhh.......', // 8
    '.......hhhhhhhhhh.......', // 9
    '.......hhhhhhhhhh.......', // 10
    '.......hhhhhhhhhh.......', // 11
    '.......hhhhhhhhhh.tt....', // 12
    '.......hhhhhhhhhhtttt...', // 13
    '.......hhhnnhhhhttttt...', // 14
    '........fbbbbbkttttttt..', // 15
    '.......ffbbbbbbktttttt..', // 16
    '.......fpbbbbbbkttttt...', // 17
    '........llllllllllll....', // 18
    '........ooo....ooo......', // 19
  ],
  17: [
    '........................', // 4
    '........................', // 5
    '........hh....hh........', // 6
    '.......hhhhhhhhhh.......', // 7
    '.......hhhhhhhhhh.......', // 8
    '.......hhhhhhhhhh.......', // 9
    '.......hhhhhhhhhh.......', // 10
    '.......hhhhhhhhhh.......', // 11
    '.......hhhhhhhhhhtt.....', // 12
    '.......hhhhhhhhhhttt....', // 13
    '......fhhnnnhhhhktttt...', // 14
    '.....ffbbbbbbbbbkkktt...', // 15
    '.....ppbbbbbbbbbqqqq....', // 16
    '......bbbbbbbbbbbbb.....', // 17
    '........lllllllll.......', // 18
    '........ooo..ooo........', // 19
  ],
  18: [
    '........................', // 4
    '........hh....hh........', // 5
    '.......hhhhhhhhhh.......', // 6
    '.......hhhhhhhhhh.......', // 7
    '.......hhhhhhhhhh.......', // 8
    '.......hhhhhhhhhh.......', // 9
    '.......hhhhhhhhhh.......', // 10
    '.......hhhhhhhhhhtt.....', // 11
    '.......hhhhhhhhhhttt....', // 12
    '........hhnnnhhhtttt....', // 13
    '......fbbbbbbbbbbttt....', // 14
    '.....fffbbbbbbbbkkk.....', // 15
    '.....pppbbbbbbbbqqq.....', // 16
    '......ppbbbbbbbbqq......', // 17
    '........llllllll........', // 18
    '........ooo..ooo........', // 19
  ],
  19: [
    '........................', // 4
    '........................', // 5
    '........hh....hh........', // 6
    '.......hhhhhhhhhh.......', // 7
    '.......hhhhhhhhhh.......', // 8
    '.......hhhhhhhhhh.......', // 9
    '.......hhhhhhhhhh.......', // 10
    '.......hhhhhhhhhhtt.....', // 11
    '.......hhhhhhhhhhttt....', // 12
    '......fhhhnnnhhhkkttt...', // 13
    '.....ffbbbbbbbbbkkttt...', // 14
    '....pffbbbbbbbbkkktt....', // 15
    '.....pppbbbbbbbqqqq.....', // 16
    '.......bbbbbbbbbb.......', // 17
    '.......lllllllll........', // 18
    '........ooo..ooo........', // 19
  ],
  20: [
    '........................', // 4
    '........................', // 5
    '........................', // 6
    '........hh....hh........', // 7
    '.......hhhhhhhhhh.......', // 8
    '.......hhhhhhhhhh.......', // 9
    '.......hhhhhhhhhh.......', // 10
    '.......hhhhhhhhhh.......', // 11
    '.......hhhhhhhhhh.......', // 12
    '.......hhhhhhhhhh.......', // 13
    '......fhhhnnnhhhkkk.....', // 14
    '.....ffbbbbbbbbbkkkk....', // 15
    '....pffbbbbbbbbbkkqtt...', // 16
    '.....pfbbbbbbbbbqqttt...', // 17
    '.......llllllllllttt....', // 18
    '.......oooooooooooo.....', // 19
  ],
  21: [
    '........................', // 4
    '........................', // 5
    '........................', // 6
    '........................', // 7
    '........................', // 8
    '........hh....hh........', // 9
    '.......hhhhhhhhhh.......', // 10
    '.......hhhhhhhhhh.......', // 11
    '.......hhhhhhhhhh.......', // 12
    '.......hhhhhhhhhh.......', // 13
    '........hhnnnhhh........', // 14
    '.......fbbbbbbbbkttt....', // 15
    '......ffbbbbbbbbkkttt...', // 16
    '.....fffbbbbbbbbkkttt...', // 17
    '....ppllllllllllqqttt...', // 18
    '.....ooooooooooooooo....', // 19
  ],
  22: [
    '........................', // 4
    '........................', // 5
    '........................', // 6
    '........................', // 7
    '........................', // 8
    '........................', // 9
    '........................', // 10
    '........................', // 11
    '...........x............', // 12
    '.........bbbbbb.........', // 13
    '........bbbbbbbb........', // 14
    '.......bbbbbbbbbbb......', // 15
    '......bbbbbbbbbbbbb.....', // 16
    '.....oooooooooooottt....', // 17
    '....oooooooooooootttt...', // 18
    '.....oooooooooooottt....', // 19
  ],
  24: [
    '........................', // 4
    '........................', // 5
    '........................', // 6
    '........................', // 7
    '........................', // 8
    '........................', // 9
    '........................', // 10
    '........................', // 11
    '...........x.....x......', // 12
    '.........bbbbbb.........', // 13
    '........bbbbbbbb........', // 14
    '.......bbbbbbbbbbb......', // 15
    '......bbbbbbbbbbbbb.....', // 16
    '.....oooooooooooottt....', // 17
    '....oooooooooooootttt...', // 18
    '.....oooooooooooottt....', // 19
  ],
  25: [
    '........................', // 4
    '........................', // 5
    '........................', // 6
    '........................', // 7
    '........................', // 8
    '........................', // 9
    '........................', // 10
    '................xx......', // 11
    '..........bbbb..........', // 12
    '........bbbbbbbb........', // 13
    '.......bbbbbbbbbb.......', // 14
    '.......bbbbbbbbbbb......', // 15
    '......bbbbbbbbbbbbb.....', // 16
    '.....oooooooooooottt....', // 17
    '....oooooooooooootttt...', // 18
    '.....oooooooooooottt....', // 19
  ],
  26: [
    '........................', // 4
    '........................', // 5
    '........................', // 6
    '........................', // 7
    '........................', // 8
    '................xx......', // 9
    '.................xx.....', // 10
    '........................', // 11
    '..........bbbb...x......', // 12
    '........bbbbbbbb........', // 13
    '.......bbbbbbbbbb.......', // 14
    '.......bbbbbbbbbbb......', // 15
    '......bbbbbbbbbbbbb.....', // 16
    '.....oooooooooooottt....', // 17
    '....oooooooooooootttt...', // 18
    '.....oooooooooooottt....', // 19
  ],
  27: [
    '........................', // 4
    '........................', // 5
    '........................', // 6
    '........................', // 7
    '.................xx.....', // 8
    '..................xx....', // 9
    '........................', // 10
    '................xx......', // 11
    '..........bbbb..........', // 12
    '........bbbbbbbb........', // 13
    '.......bbbbbbbbbb.......', // 14
    '.......bbbbbbbbbbb......', // 15
    '......bbbbbbbbbbbbb.....', // 16
    '.....oooooooooooottt....', // 17
    '....oooooooooooootttt...', // 18
    '.....oooooooooooottt....', // 19
  ],
  28: [
    '........................', // 4
    '........................', // 5
    '........................', // 6
    '........................', // 7
    '........................', // 8
    '....................x...', // 9
    '................xx......', // 10
    '.................xx.....', // 11
    '...........x............', // 12
    '.........bbbbbb.........', // 13
    '........bbbbbbbb........', // 14
    '.......bbbbbbbbbbb......', // 15
    '......bbbbbbbbbbbbb.....', // 16
    '.....oooooooooooottt....', // 17
    '....oooooooooooootttt...', // 18
    '.....oooooooooooottt....', // 19
  ],
  29: [
    '........................', // 4
    '........................', // 5
    '........................', // 6
    '........................', // 7
    '........................', // 8
    '........................', // 9
    '........................', // 10
    '........................', // 11
    '...........x............', // 12
    '..........bbbb..........', // 13
    '........bbbbbbbb........', // 14
    '.......bbbbbbbbbbb......', // 15
    '......bbbbbbbbbbbbb.....', // 16
    '.....oooooooooooottt....', // 17
    '....oooooooooooootttt...', // 18
    '.....oooooooooooottt....', // 19
  ],
  31: [
    '........................', // 4
    '........................', // 5
    '........................', // 6
    '........................', // 7
    '........................', // 8
    '........................', // 9
    '........................', // 10
    '........................', // 11
    '..........bbbb..........', // 12
    '........bbbbbbbb........', // 13
    '.......bbbbbbbbbb.......', // 14
    '.......bbbbbbbbbbb......', // 15
    '......bbbbbbbbbbbbb.....', // 16
    '.....oooooooooooott.....', // 17
    '.....oooooooooooottt....', // 18
    '.....oooooooooooottt....', // 19
  ],
  32: [
    '........................', // 4
    '........................', // 5
    '........................', // 6
    '........................', // 7
    '........................', // 8
    '........................', // 9
    '........................', // 10
    '........................', // 11
    '..........bbbb..........', // 12
    '........bbbbbbbb........', // 13
    '.......bbbbbbbbbb.......', // 14
    '......bbbbbbbbbbbb......', // 15
    '......bbbbbbbbbbbb......', // 16
    '......ooooooooooott.....', // 17
    '.....oooooooooooott.....', // 18
    '......ooooooooooot......', // 19
  ],
  33: [
    '........................', // 4
    '........................', // 5
    '........................', // 6
    '.........hhh..hhh.......', // 7
    '........hhhhhhhhh.......', // 8
    '........hhhhhhhhh.......', // 9
    '.......hhhhhhhhhh.......', // 10
    '.......hhhhhhhhhhq......', // 11
    '.......bbpnnnbbbqq......', // 12
    '.......bbbbbbbkkqq......', // 13
    '......bbpbbbbbkkkkk.....', // 14
    '.....bbbbbbbbbbbbbb.....', // 15
    '....oooooooooooooott....', // 16
    '.....ooooooooooooott....', // 17
    '......oooooooooooott....', // 18
    '.......oooooooooooo.....', // 19
  ],
};

const art = (frame: number) => SAME_FRAME[frame] ?? frame;

/** The body part at a pixel of a frame, or null where the frame is empty. */
export function partAt(frame: number, x: number, y: number): Part | null {
  const rows = PART_ROWS[art(frame)];
  const ch = rows?.[y - ROW0]?.[x];
  return !ch || ch === '.' ? null : (ch as Part);
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Which way a forearm points from the elbow: hanging down, reaching out sideways, or raised. */
export type Reach = 'down' | 'out' | 'up';

export interface Paw extends Point {
  readonly reach: Reach;
}

export interface Pose {
  /** How far the head (ears, crown) sits from frame 0's; null when it's hidden (curled up). */
  head: Point | null;
  /** How far the eyes sit from frame 0's (9,10 and 13,10), and whether the face is squashed (eyes and nose on one row). */
  face: (Point & { readonly squash: boolean }) | null;
  /** The front paw (it holds the weapon) and the back paw (it wears the shield). */
  hand: Paw | null;
  offHand: Paw | null;
  /** The bottom pixel of the front foot and of the back foot. */
  feet: readonly [Point | null, Point | null];
  /** The middle of the neck, just under the chin. */
  neck: Point | null;
}

const P = (x: number, y: number): Point => ({ x, y });
const paw = (x: number, y: number, reach: Reach): Paw => ({ x, y, reach });
const face = (x: number, y: number, squash = false) => ({ x, y, squash });
const STAND: Pose = {
  head: P(0, 0), face: face(0, 0), hand: paw(6, 16, 'down'), offHand: paw(17, 16, 'down'), feet: [P(9, 19), P(14, 19)], neck: P(11, 13),
};
const CURLED: Pose = { head: null, face: null, hand: null, offHand: null, feet: [null, null], neck: null };

/** Landmarks of every frame (frames not listed repeat another frame, see SAME_FRAME). */
const POSES: Readonly<Record<number, Pose>> = {
  // Idle: stand, stretch the legs, rise, rise, squash, stand.
  0: STAND,
  1: STAND,
  2: { ...STAND, head: P(0, -1), face: face(0, -1), hand: paw(6, 15, 'down'), offHand: paw(17, 15, 'down'), neck: P(11, 12) },
  3: { ...STAND, head: P(0, -1), face: face(0, -1), hand: paw(6, 15, 'down'), offHand: paw(17, 15, 'down'), neck: P(11, 12) },
  4: { ...STAND, head: P(0, 1), face: face(0, 1, true) },
  5: STAND,
  // Look around (not played in battle): the head turns, a foot lifts.
  7: { ...STAND, head: P(0, 1), face: face(0, 1, true), offHand: paw(17, 15, 'down'), feet: [P(9, 19), P(14, 18)] },
  8: { ...STAND, face: face(-1, 0), hand: paw(7, 16, 'down'), offHand: paw(16, 15, 'down'), feet: [P(9, 19), P(13, 18)], neck: P(10, 13) },
  9: { ...STAND, face: face(-1, 0), hand: paw(7, 16, 'down'), offHand: paw(16, 16, 'down'), feet: [P(9, 19), P(13, 19)], neck: P(10, 13) },
  10: { ...STAND, head: P(0, 1), face: face(-1, 1, true), hand: paw(7, 15, 'down'), offHand: paw(16, 16, 'down'), feet: [P(9, 18), P(13, 19)], neck: P(10, 13) },
  11: { ...STAND, hand: paw(6, 15, 'down'), feet: [P(9, 18), P(14, 19)] },
  // Arms out (cheer, swing wind-up) and arms up (cheer, hurt).
  13: { ...STAND, hand: paw(5, 13, 'out'), offHand: paw(18, 12, 'up'), feet: [P(9, 19), P(15, 19)] },
  14: { ...STAND, hand: paw(5, 12, 'out'), offHand: paw(18, 11, 'up'), feet: [P(9, 19), P(16, 19)] },
  // Dash: ducks low behind the swing's trail; the front arm and foot are inside the trail.
  15: { head: P(0, 2), face: face(0, 2, true), hand: paw(6, 15, 'out'), offHand: paw(17, 15, 'down'), feet: [null, P(16, 19)], neck: P(11, 14) },
  // Sit and a hunched stand (not played in battle).
  16: { head: P(0, 1), face: face(0, 1), hand: paw(8, 17, 'down'), offHand: paw(15, 17, 'down'), feet: [P(9, 19), P(16, 19)], neck: P(11, 14) },
  17: { ...STAND, head: P(0, 1), face: face(0, 1), neck: P(11, 14) },
  // Lie down: eyes close, squat with the arms out, the head sinks, curl up.
  18: STAND,
  19: { ...STAND, head: P(0, 1), face: face(0, 1, true), hand: paw(5, 15, 'out'), offHand: paw(18, 15, 'out') },
  20: { ...STAND, head: P(0, 2), face: face(0, 2, true), hand: paw(5, 16, 'out'), offHand: paw(17, 16, 'down'), neck: P(11, 14) },
  21: { ...STAND, head: P(0, 4), face: face(0, 1, true), hand: paw(5, 18, 'out'), offHand: paw(17, 18, 'down'), neck: P(11, 14) },
  22: CURLED,
  // Asleep (curled up, z's rising).
  24: CURLED,
  25: CURLED,
  26: CURLED,
  27: CURLED,
  28: CURLED,
  29: CURLED,
  // Wake up: uncurl, stretch with both paws by the face, stand.
  31: CURLED,
  32: CURLED,
  33: { head: P(0, 2), face: face(0, 0, true), hand: paw(8, 14, 'up'), offHand: paw(17, 12, 'up'), feet: [P(9, 19), P(15, 19)], neck: P(11, 12) },
};

/** A frame's landmarks. */
export function pose(frame: number): Pose {
  return POSES[art(frame)] ?? CURLED;
}

/** Number of frames in the sheet. */
export const FRAME_COUNT = RACCOON.frames.length;
