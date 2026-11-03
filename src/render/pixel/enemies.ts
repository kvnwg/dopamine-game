/**
 * Enemies and bosses in pixel art (see docs/PIXEL_ART.md). Every sprite faces LEFT, toward the hero,
 * and stands with its feet on its bottom row (`feet`, the ground point between the feet).
 *
 * The cast is drawn like Kevin's raccoon hero, the farm animals and the user's otter reference: chunky,
 * rounded critters with tiny dot eyes and a little blush, a light belly or face patch, 3 or 4 flat tones
 * per material and one small prop that says who each one is. Lines inside a shape use a darker tone of
 * the local color.
 *
 * Each character is drawn once as a fill (its art without the outer outline) plus a few moves. castSheet()
 * builds its animated sheet from them: idle (breathe and blink), walk (step, bob), attack (wind up, strike
 * toward the left) and hurt (flinch). Every frame gets a 1 px outline in key `x`, always drawn in the
 * raccoon's brown (CHARACTER_OUTLINE).
 *
 * Colors: each world recolors an enemy. The three `body` keys take rampOf(world color) and the three
 * `accent` keys take rampOf(world accent); those keys are used for nothing else in that sprite. Every
 * other key is drawn in CAST_COLORS, a muted, earthy take on the palette (cream, moss, warm browns, soft
 * gold), so eyes, teeth, skin, wood and metal look the same in every world. Raw rows only approximate the
 * look; always draw through recolorEnemy() or the sheets.
 */
import { checkRows, fromRows, rampOf, type PixelBuf, type Rows, type SheetEntry } from './buf';
import { KEYS, type AnimSheet } from './indexed';
import { CHARACTER_OUTLINE } from './palette';
import worlds from '../../data/worlds.json';

export type EnemyShape =
  | 'rat'
  | 'pigeon'
  | 'raccoon'
  | 'ratKing'
  | 'raccoonBoss'
  | 'officer'
  | 'soldier'
  | 'orc'
  | 'pumpkin'
  | 'doc'
  | 'bigDemon';

/** The shapes drawn here as animated sheets (the punk raccoon uses the hero's sheet instead). */
export type CastShape = Exclude<EnemyShape, 'raccoon'>;

export interface EnemyArt {
  rows: Rows;
  /** Bottom-center art pixel where the enemy touches the ground. */
  feet: { x: number; y: number };
  /** Dark, mid, light palette keys replaced by rampOf(world color). */
  body: [string, string, string];
  /** Dark, mid, light palette keys replaced by rampOf(world accent). */
  accent: [string, string, string];
  /** The key drawn in CHARACTER_OUTLINE (default `x`). */
  outline?: string;
}

/**
 * How the cast draws every key that is not a body, accent or outline key: muted, natural colors in the
 * style of the otter reference, so fixed parts (eyes, cream bellies, skin, wood, metal, gold) sit with
 * the hero and the farm animals instead of the brighter UI palette.
 */
export const CAST_COLORS: Readonly<Record<string, string>> = {
  k: '#1e1619', // eyes, nostrils: darker than the outline
  x: CHARACTER_OUTLINE,
  w: '#fbf6e6', // soft white: glints, teeth
  W: '#efe4c9', // cream: bellies, muzzles
  T: '#d9c29a', // cream shadow, light tan
  t: '#b48f63', // tan
  N: '#8a6646', // brown, wood
  n: '#62483a', // dark brown
  b: '#46352d', // darkest brown
  s: '#efc4a2', // skin
  S: '#cf9878', // skin shadow
  P: '#e6a096', // blush, pink
  q: '#c27779', // rose
  e: '#d08566', // terracotta
  R: '#a8503f', // dusty red
  r: '#6e3530', // dark red
  o: '#966037', // amber brown
  O: '#c78f4f', // amber
  y: '#e3c06e', // soft gold
  Y: '#f5e3a6', // pale gold, lantern glow
  g: '#424b26', // dark olive
  G: '#687a3e', // moss
  l: '#9caf70', // sage
  L: '#cbd5a2', // pale sage
  u: '#323b4e', // dusty navy
  U: '#516683', // dusty blue
  c: '#8099ab', // gray blue
  C: '#bccdd3', // pale blue
  a: '#53867b', // dusty teal
  A: '#a8cbbc', // pale teal
  v: '#40334a', // plum
  V: '#6d5c82', // dusty purple
  m: '#9d8db0', // lilac
  M: '#d6cbdd', // pale lilac
  '1': '#4d4649', // warm grays, dark to light: iron, stone
  '2': '#6e6767',
  '3': '#918a85',
  '4': '#b6afa5',
  '5': '#dbd4c7',
};

// ------------------------------------------------------------------ the cast (fills, no outer outline)

/** Alley Rat: big round ear, pointy snout with a buck tooth, cream belly, a cheese wedge in its paws, tail curling up. */
const RAT: Rows = [
  '..........44.....',
  '.........4mV3....',
  '....4444.4Vv3....',
  '...4444433VV3....',
  '..44k44333332....',
  '..444P3333332....',
  'V444333333332....',
  '.w33333322222....',
  '....y22222....VV.',
  '...yYyW33332...V.',
  '..yyOyWW33332..V.',
  '.yyyyVWT33322.V..',
  '...WWT33333222V..',
  '....2222222VVV...',
  '...mVV..mVV......',
];

/** Porch Pigeon: small round head, dark beak with a white cere, a bread crust, shiny neck band, puffed chest, barred wing. */
const PIGEON: Rows = [
  '......4444......',
  '.....44k443.....',
  'tTT1w444P433....',
  'NtT..4443333....',
  '.....mVVVv3.....',
  '....4mmVVv333...',
  '...44443333333..',
  '...44434444443..',
  '...443333232222.',
  '...443332322222.',
  '....4333222222..',
  '.....33222222...',
  '......22222.....',
  '.......q..q.....',
  '......qP.qP.....',
];

/** Tin Soldier: round helmet with a glint and a plume, little face, tiny sword up, round shield with a gold boss, tunic. */
const SOLDIER: Rows = [
  '........eRr......',
  '......eRRRr......',
  '.......RRr.......',
  '....cwcUUUu...5..',
  '...ccUUUUUUu..5..',
  '..CCCCCCCCCcu.5..',
  '..ssksssSUUUu.4..',
  '..sPsssSUUUu..4..',
  '...sssSUUUu..yyy.',
  '....cUUUUUu...s..',
  '..ccc.UUUUUUUs...',
  '.cRRRcUUUUUu.....',
  '.cRyRcnnnnnn.....',
  '.cRRRcRRRRRr.....',
  '..ccc.eRRRRr.....',
  '......bb..bb.....',
  '.....bbb.bbb.....',
];

/** Orc Brute: round green egg with pointy ears, heavy brows, little tusks, a leather strap and loincloth, a big club. */
const ORC: Rows = [
  '...................t.',
  '......GGGGGG......tTt',
  '....GGllllGGGG....tTo',
  '.l.GllllGGGGGGG.l.tTo',
  '.llGlggGGGGggGGll.to.',
  '..GGGGkGGGGkGGGG..to.',
  '..GGGPGGllGGPGGG..to.',
  '..GGGGWggggWGGGG.lGGo',
  '..GGGGGGGGGGGGGGlGGGo',
  '..GGGGGGGGGGGGGGGGgo.',
  '.lGNNGGGGGGGGGGGgg...',
  '.lllNNGGlllGGGGggg...',
  '.llllNNGllllGGGgg....',
  '..lllGNNGlllGGggg....',
  '...GGGGNNGGGGggg.....',
  '....nNNNNNNNNnn......',
  '.....NNn..NNn........',
  '....GGgg..GGgg.......',
  '...GGGgg.GGGgg.......',
];

/** Pumpkin Dude: jack-o'-lantern head with a glowing carved grin, stem and leaf, a tiny plum cloak, a hay fork. */
const PUMPKIN: Rows = [
  '.......gl.........',
  '.......gGlL...4.4.',
  '....OOOgOOOO..4.4.',
  '..OeeOOeOOOOo.444.',
  '.OeeOOeOOOOOOo.N..',
  '.OeYyOeOYyOOOo.N..',
  '.OeYYOOOYYOOoo.N..',
  '.OOOOOOOOOOOoo.N..',
  '.OYOYOYOYYOOoo.N..',
  '..OYYYYYYYYoo..N..',
  '...ooOOOOooo..sN..',
  '....vVVVVv...VN...',
  '...vVmVVVVvVV.N...',
  '...vVVVVVVv...N...',
  '....vvvvvv....N...',
  '....bb.bb.........',
  '...bbb.bbb........',
];

/** Plague Doc: wide hat with a band, cream beak mask with a round goggle, little cape and coat, a glowing lantern. */
const DOC: Rows = [
  '........uUUu......',
  '.......uUcUUu.....',
  '.......unnnnu.....',
  '....ccccccccccu...',
  '.....uuuuuuuuu....',
  '.......TTTTTu.....',
  '......TTCCTTUu....',
  '...tttTTkCTTUu....',
  '.NttttTTTTTuUu....',
  'NNNNttttTTuUUu....',
  '.....NNttuUUUUu...',
  '....cccUUUUUUUUu..',
  '..bUUcUUUUUUUUUu..',
  '..b.uUUUUUUUUUUu..',
  '.bYb.UUUUUUUUUUu..',
  '.YwY.UUUUUUUUUuu..',
  '.bYb.uUUUUUUUuu...',
  '......bb...bb.....',
  '.....bbb..bbb.....',
];

/** Dumpgor the Demon: chubby and round, gold horns, big shiny eyes, two fangs, cream belly, bat wings, spade tail, gold claws. */
const BIG_DEMON: Rows = [
  '.....Y...........Y........',
  '.....yY.........Yy........',
  '.....Oyy.......yyO........',
  '......OyRRRRRRRyO.......mV',
  'V....ReeeeRRRRRRRR.....mVV',
  'mV..ReeeRRRRRRRRRRR...mVVV',
  'VmVReeRRRRRRRRRRRRRR.mVvVV',
  'vVVReRRRRRRRRRRRRRRrmVvVvV',
  '.vVRewkRRRRwkRRRRRRrVvVVvV',
  '..vRRkkRRRRkkRRRRRRrvV.v.V',
  '...RRkkRRRRkkRRRRRRr.v....',
  '...RRPRRRRRRRPRRRRRr......',
  '...RRRRRrrrrRRRRRRRr......',
  '...RRRRRRwRRwRRRRRrr......',
  '...RRRRRRRRRRRRRRRr.......',
  '..eRRRRTWWWWTRRRRRr.......',
  '..eRRRTWWWWWWTRRRrr...e...',
  '...RRTWWWWWWWWTRRRrr.eRR..',
  '....RTWWWWWWWWTRRRrrRRRRr.',
  '....RTTWWWWWWTTRRrr...r...',
  '.....RTTTTTTTTRRrrr..r....',
  '......RRRRRRRRRrrrrrr.....',
  '.......rRRRrrrRRRrr.......',
  '.......RRRr...RRRr........',
  '......RRRRr..RRRRr........',
  '.....yRyRyr.yRyRyr........',
];

/** Officer Dale: chibi cop with a big peaked cap and badge, bushy brows and mustache, a whistle, buttons, belt. */
const OFFICER: Rows = [
  '........UUUUUUU......',
  '......UUcccUUUUUu....',
  '.....UccccUUUUUUUu...',
  '.....UccUyYyUUUUUu...',
  '.....UcUUyyyUUUUUu...',
  '.....uuuuuuuuuuuuu...',
  '...1111111111nnnn....',
  '....nnssnnsssSnnn....',
  '....sksssksssSSnn....',
  '...sssssssssSSSn.....',
  '....nnNNNNnnPsSS.....',
  '.45nNNnnnNNnPSSS.....',
  '55w44sssssssSS.......',
  '.44..ssssssSS........',
  '....ccUUUUUUcc.......',
  '...yUUUUUUUUUUy......',
  '..sUUyYUUyUUUUUU.....',
  '..sUUyyUUUUUUUUUu....',
  '..sUUUUUUUyUUUUUu....',
  '...sUUUUUUUUUUUUu....',
  '....UUUUUUUUUUUu.....',
  '....bbbbbyybbbbb.....',
  '....uuuuuuuuuuuu.....',
  '....uuuuuu.uuuuu.....',
  '....uuuuu..uuuuu.....',
  '...bbbbbb..bbbbbb....',
  '..bbbbbbb.bbbbbbb....',
];

/** Big Earl: fat rat king with a jeweled crown, angry brows, a scar through one eye, buck teeth, a royal robe with gold trim over a cream belly, curled tail. */
const RAT_KING: Rows = [
  '.........y.y.y..........',
  '....44..yYyYyYy..33.....',
  '...4PP4.yyyRyyy.3PP3....',
  '..4PqP4.OOOOOOO.3PqP3...',
  '..44qP4.4443333.3Pq33...',
  '...44444433333333333....',
  '....22433333333q233.....',
  '...444233333332q3332....',
  '..4433k3333333k33332....',
  'q4443333333333q33332....',
  '.3ww333P333333q33322....',
  '....333333333333222.....',
  '.....3333333333222....P.',
  '....VVV333333222VVV....P',
  '...VVVVyWWWWWWyVVVVV...P',
  '..mVVVyWWWWWWWWyVVVV..P.',
  '.PPVVVyWWWWWWWWyVVVV.P..',
  '.mmVVVyWWWWWWWTyVVVVvv..',
  '..mVVVyWWWWWWTTyVVvvv...',
  '..mVVVyWWWWWWTTyvvvvv...',
  '...VVVyWWWWWTTTyvvvv....',
  '....VVVyWWWTTTyvvvv.....',
  '....PPPq.....PPPqv......',
  '...PPPPq...PPPPq........',
];

/** Vinnie "Two Lids": mob-boss raccoon in a fedora, bandit mask, gold-tooth smirk, gold chain, one lid raised and one held in front, ringed tail. */
const RACCOON_BOSS: Rows = [
  '........eRRRRr............',
  '.......eRRRrRRr...........',
  '.......eRRRRRRr...........',
  '.......bbbbbbbbb.....2222.',
  '...eeRRRRRRRRRRRRRr.245542',
  '...mmvvvvvvmvvvvvmm.251w52',
  '...mPmmmmmVVVVVVVPV.245542',
  '....1111VV1111VVVV...2222.',
  '....11kw1V11kw1VVVVm......',
  '.....111WW1111VVVVVV......',
  '.....VWWWkkWWWVVVVV.......',
  '.....VVWWWWWbbyVvv........',
  '.......VWWWWWVVvv....vv...',
  '.......VVVVVVvvv....vvvv..',
  '.......yVVVVVyVV....1111..',
  '..2222.VyOyOyVVVV...Vvvv..',
  '.244442VVVVWWWVVVV.1111...',
  '24555542VVWWWWWVVV.vvvv...',
  '2451w542VWWWWWWWVVv111....',
  '24555542VWWWWWWTvvvvv.....',
  '.244442VVWWWWWTTvv........',
  '..2222VVVWWWWTTTvv........',
  '.......VVVWWTTTvv.........',
  '.......1111..1111.........',
  '......11111.11111.........',
];

/** Punk Raccoon: three-fin mohawk, bandit mask, sneer with a fang, fists up, ringed tail. 24x32. (In battle it uses the hero's sheet.) */
const ROWS_RACCOON: Rows = [
  '............k...........',
  '...........kRk.k........',
  '.........kkeRkkRk.......',
  '........kekerkerk.......',
  '....kk.kereRrkerkkk.....',
  '...k43kkereRrkerk43k....',
  '..k4qP3eRreRreRr3qP2k...',
  '..k3PP3eRrRRrRRr3PP2k...',
  '...k334444444443332k....',
  '...kWW444444WWW33332k...',
  '..kxxWW343WWxxxx13332k..',
  '.kxxwwxx1xxxwwwxx1332k..',
  '.kxxkwxxxxxkkwwxx1332k..',
  '.kxxxxx343xxxxxx13332k..',
  '.k1xWWWWW523333333332k..',
  'kxxWWWWxW523333333332k..',
  'k5xxxxx55523333333332k..',
  '.k55w555523333333322k...',
  '..k5555222222222222k....',
  '..kkkkkk22222222kkkkk...',
  '.k443kkx5xx5xx5k..kxxk..',
  'k4332323WWWW3332kkxx1xk.',
  'k3322223WWWW5332k443332k',
  '.k22k443xWWW5332k333332k',
  '..kk43332xWW5332xxx1xxxk',
  '...k33222xW55322xx1xxxxk',
  '....k222x5553222x433332k',
  '.....kkk22222222333322k.',
  '.......k222k222kxx1xxk..',
  '......k111xk111xkkkkk...',
  '.....kxxxxxkxxxxxk......',
  '......kkkkk.kkkkk.......',
];

// ------------------------------------------------------------------ moves

/** A box in fill coordinates: left, top, right, bottom (inclusive). */
type Box = readonly [number, number, number, number];

/** One change to a frame, in the fill's coordinates (moves may push art past its edges). */
type Move =
  /** Moves the pixels in a box; `stretch` leaves the old pixels where nothing lands on them. */
  | { move: Box; by: readonly [number, number]; stretch?: boolean }
  /** Draws rows at a point: '.' leaves a pixel alone, '_' clears it. */
  | { at: readonly [number, number]; draw: Rows }
  /** Clears the pixels of these keys inside a box. */
  | { erase: Box; keys: string };

interface CastDef {
  fill: Rows;
  /** Ground point x in the fill. */
  feet: number;
  body: [string, string, string];
  accent: [string, string, string];
  /** The part that sinks 1 px when it breathes (it covers the row under it). */
  breathe: Box;
  /** First row that stays put when the body leans (the legs). */
  waist: number;
  /** Front (left) foot and back foot, shuffled 1 px apart in the walk. */
  steps: readonly [Box, Box];
  /** Eye pixels and the key they take when shut (blinks and flinches). */
  eyes: ReadonlyArray<readonly [number, number]>;
  shut: string;
  /** Extra moves per pose, drawn before the pose's own squash or lean. */
  idle?: Move[];
  blink?: Move[];
  windup?: Move[];
  strike?: Move[];
  hurt?: Move[];
}

const CAST: Record<CastShape, CastDef> = {
  rat: {
    fill: RAT,
    feet: 7,
    body: ['2', '3', '4'],
    accent: ['v', 'V', 'm'],
    breathe: [0, 0, 16, 11],
    waist: 13,
    steps: [
      [3, 14, 5, 14],
      [8, 14, 10, 14],
    ],
    eyes: [[4, 4]],
    shut: '2',
    strike: [{ at: [2, 7], draw: ['kk'] }],
    hurt: [{ at: [2, 7], draw: ['k'] }],
  },
  pigeon: {
    fill: PIGEON,
    feet: 8,
    body: ['2', '3', '4'],
    accent: ['v', 'V', 'm'],
    breathe: [0, 0, 15, 9],
    waist: 13,
    steps: [
      [6, 13, 7, 14],
      [9, 13, 10, 14],
    ],
    eyes: [[7, 1]],
    shut: '2',
    idle: [{ move: [0, 0, 11, 3], by: [-1, 0] }],
    windup: [{ move: [0, 0, 11, 3], by: [1, 0] }],
    strike: [{ move: [0, 0, 11, 3], by: [-1, 1] }],
  },
  soldier: {
    fill: SOLDIER,
    feet: 8,
    body: ['u', 'U', 'c'],
    accent: ['r', 'R', 'e'],
    breathe: [0, 0, 12, 8],
    waist: 15,
    steps: [
      [5, 15, 7, 16],
      [9, 15, 11, 16],
    ],
    eyes: [[4, 6]],
    shut: 'S',
    idle: [{ move: [6, 0, 10, 1], by: [1, 0] }],
    windup: [{ move: [13, 3, 15, 10], by: [0, -1], stretch: true }],
    strike: [
      { erase: [13, 3, 15, 10], keys: '54ys' },
      { at: [-1, 8], draw: ['........y', 'w5555555ysU', '........y'] },
    ],
  },
  orc: {
    fill: ORC,
    feet: 8,
    body: ['g', 'G', 'l'],
    accent: ['b', 'n', 'N'],
    breathe: [0, 0, 15, 8],
    waist: 17,
    steps: [
      [3, 17, 7, 18],
      [9, 17, 13, 18],
    ],
    eyes: [
      [6, 5],
      [11, 5],
    ],
    shut: 'g',
    windup: [{ move: [17, 0, 20, 9], by: [0, -1], stretch: true }],
    strike: [
      { erase: [17, 0, 20, 9], keys: 'tTolGg' },
      { at: [-2, 8], draw: ['.tTt', 'tTTTooo', 'tTToooolG', '.too...lG'] },
    ],
  },
  pumpkin: {
    fill: PUMPKIN,
    feet: 6,
    body: ['o', 'O', 'e'],
    accent: ['g', 'G', 'l'],
    breathe: [0, 0, 13, 9],
    waist: 15,
    steps: [
      [3, 15, 5, 16],
      [7, 15, 9, 16],
    ],
    eyes: [],
    shut: 'y',
    idle: [{ move: [8, 0, 10, 1], by: [1, 0] }],
    blink: [
      { at: [3, 5], draw: ['yO', 'yy'] },
      { at: [8, 5], draw: ['yO', 'yy'] },
    ],
    windup: [{ move: [13, 1, 16, 14], by: [0, -1], stretch: true }],
    strike: [
      { move: [13, 1, 16, 14], by: [-1, 1] },
      { at: [2, 8], draw: ['YYYYYYYY'] },
    ],
    hurt: [
      { at: [3, 5], draw: ['oo', 'yo'] },
      { at: [8, 5], draw: ['oo', 'yo'] },
    ],
  },
  doc: {
    fill: DOC,
    feet: 9,
    body: ['u', 'U', 'c'],
    accent: ['N', 't', 'T'],
    breathe: [0, 0, 17, 12],
    waist: 17,
    steps: [
      [5, 17, 7, 18],
      [10, 17, 12, 18],
    ],
    eyes: [[8, 7]],
    shut: 'C',
    idle: [{ move: [0, 14, 3, 16], by: [1, 0] }],
    strike: [{ move: [0, 13, 3, 16], by: [-1, -2] }],
  },
  bigDemon: {
    fill: BIG_DEMON,
    feet: 11,
    body: ['r', 'R', 'e'],
    accent: ['O', 'y', 'Y'],
    breathe: [3, 0, 19, 13],
    waist: 22,
    steps: [
      [5, 22, 10, 25],
      [12, 22, 17, 25],
    ],
    eyes: [],
    shut: 'R',
    idle: [
      { move: [20, 3, 25, 10], by: [0, -1] },
      { move: [0, 4, 2, 9], by: [0, -1] },
    ],
    blink: [
      { at: [5, 8], draw: ['RR', 'kk', 'RR'] },
      { at: [11, 8], draw: ['RR', 'kk', 'RR'] },
    ],
    windup: [
      { move: [20, 3, 25, 10], by: [0, -1] },
      { move: [0, 4, 2, 9], by: [0, -1] },
    ],
    strike: [{ at: [8, 12], draw: ['kkkk', 'wkkw', 'rkkr'] }],
    hurt: [
      { at: [5, 8], draw: ['kR', 'Rk', 'kR'] },
      { at: [11, 8], draw: ['Rk', 'kR', 'Rk'] },
      { at: [9, 12], draw: ['kk'] },
    ],
  },
  officer: {
    fill: OFFICER,
    feet: 9,
    body: ['u', 'U', 'c'],
    accent: ['O', 'y', 'Y'],
    breathe: [0, 0, 17, 19],
    waist: 23,
    steps: [
      [2, 23, 9, 26],
      [10, 23, 16, 26],
    ],
    eyes: [
      [5, 8],
      [9, 8],
    ],
    shut: 'S',
    strike: [
      { move: [0, 11, 4, 13], by: [-1, 0] },
      { at: [12, 10], draw: ['P', 'P'] },
      { erase: [2, 16, 3, 19], keys: 's' },
      { at: [-1, 15], draw: ['s', 'sUUU'] },
    ],
    hurt: [{ move: [3, 0, 17, 6], by: [0, -1] }],
  },
  ratKing: {
    fill: RAT_KING,
    feet: 9,
    body: ['2', '3', '4'],
    accent: ['v', 'V', 'm'],
    breathe: [0, 0, 23, 17],
    waist: 22,
    steps: [
      [3, 22, 7, 23],
      [11, 22, 16, 23],
    ],
    eyes: [
      [6, 8],
      [14, 8],
    ],
    shut: '2',
    strike: [
      { at: [1, 11], draw: ['kkk3', '.333'] },
      { erase: [1, 16, 2, 16], keys: 'P' },
      { at: [0, 13], draw: ['PP'] },
    ],
    hurt: [{ move: [8, 0, 14, 3], by: [1, 0] }],
  },
  raccoonBoss: {
    fill: RACCOON_BOSS,
    feet: 11,
    body: ['v', 'V', 'm'],
    accent: ['r', 'R', 'e'],
    breathe: [0, 0, 25, 12],
    waist: 23,
    steps: [
      [6, 23, 10, 24],
      [12, 23, 16, 24],
    ],
    eyes: [
      [6, 8],
      [7, 8],
      [12, 8],
      [13, 8],
    ],
    shut: '1',
    idle: [{ move: [20, 3, 25, 7], by: [0, -1] }],
    windup: [{ move: [19, 3, 25, 8], by: [0, -2], stretch: true }],
    strike: [{ move: [19, 3, 25, 8], by: [-2, 2] }],
    hurt: [{ move: [3, 0, 18, 4], by: [0, -1] }],
  },
};

// ------------------------------------------------------------------ frames

type Grid = string[][];

/** Room around the fill for moves and their outline (left, top, right); nothing moves below the feet. */
const MARGIN = { l: 7, t: 4, r: 4 };

function apply(g: Grid, m: Move): void {
  const inside = (x: number, y: number) => y >= 0 && y < g.length && x >= 0 && x < g[0].length;
  if ('move' in m) {
    const [x0, y0, x1, y1] = m.move;
    const picked: Array<[number, number, string]> = [];
    for (let y = y0 + MARGIN.t; y <= y1 + MARGIN.t; y++) {
      for (let x = x0 + MARGIN.l; x <= x1 + MARGIN.l; x++) if (inside(x, y) && g[y][x] !== '.') picked.push([x, y, g[y][x]]);
    }
    if (!m.stretch) for (const [x, y] of picked) g[y][x] = '.';
    for (const [x, y, ch] of picked) if (inside(x + m.by[0], y + m.by[1])) g[y + m.by[1]][x + m.by[0]] = ch;
  } else if ('draw' in m) {
    m.draw.forEach((row, dy) => {
      [...row].forEach((ch, dx) => {
        const x = m.at[0] + dx + MARGIN.l;
        const y = m.at[1] + dy + MARGIN.t;
        if (ch !== '.' && inside(x, y)) g[y][x] = ch === '_' ? '.' : ch;
      });
    });
  } else {
    const [x0, y0, x1, y1] = m.erase;
    for (let y = y0 + MARGIN.t; y <= y1 + MARGIN.t; y++) {
      for (let x = x0 + MARGIN.l; x <= x1 + MARGIN.l; x++) if (inside(x, y) && m.keys.includes(g[y][x])) g[y][x] = '.';
    }
  }
}

/** Every open pixel next to art (not counting diagonals) becomes outline `x`. */
function outlined(g: Grid): Grid {
  const solid = (x: number, y: number) => y >= 0 && y < g.length && x >= 0 && x < g[0].length && g[y][x] !== '.' && g[y][x] !== 'x';
  return g.map((row, y) => row.map((ch, x) => (ch === '.' && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) ? 'x' : ch)));
}

/** The poses every character has, in sheet frame order. */
const POSES = ['base', 'breathe', 'blink', 'stepA', 'stepB', 'windup', 'strike', 'hurt'] as const;
type Pose = (typeof POSES)[number];

function poseMoves(d: CastDef, pose: Pose): Move[] {
  const shut: Move[] = d.eyes.map(([x, y]) => ({ at: [x, y], draw: [d.shut] }));
  const lean = (dx: number): Move => ({ move: [-MARGIN.l, -MARGIN.t, d.fill[0].length + MARGIN.r, d.waist - 1], by: [dx, 0] });
  const squash: Move = { move: d.breathe, by: [0, 1] };
  switch (pose) {
    case 'base':
      return [];
    case 'breathe':
      return [...(d.idle ?? []), squash];
    case 'blink':
      return d.blink ?? shut;
    case 'stepA':
      return [{ move: d.steps[0], by: [-1, 0] }];
    case 'stepB':
      return [{ move: d.steps[1], by: [1, 0] }];
    case 'windup':
      return [...(d.windup ?? []), lean(1)];
    case 'strike':
      return [...(d.strike ?? []), lean(-2)];
    case 'hurt':
      return [...shut, ...(d.hurt ?? []), lean(1)];
  }
}

/** The outlined frames of a character on one shared canvas, and where its feet are. */
function castFrames(d: CastDef): { frames: string[][]; feet: { x: number; y: number } } {
  const w = d.fill[0].length + MARGIN.l + MARGIN.r;
  const grids = POSES.map((pose) => {
    const g: Grid = [
      ...Array.from({ length: MARGIN.t }, () => Array<string>(w).fill('.')),
      ...d.fill.map((row) => [...'.'.repeat(MARGIN.l), ...row, ...'.'.repeat(MARGIN.r)]),
    ];
    for (const m of poseMoves(d, pose)) apply(g, m);
    return outlined(g);
  });
  // One crop for every frame: the union of their art.
  let x0 = w;
  let x1 = 0;
  let y0 = grids[0].length;
  for (const g of grids) {
    g.forEach((row, y) =>
      row.forEach((ch, x) => {
        if (ch === '.') return;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
      }),
    );
  }
  const frames = grids.map((g) => g.slice(y0).map((row) => row.slice(x0, x1 + 1).join('')));
  return { frames, feet: { x: d.feet + MARGIN.l - x0, y: frames[0].length - 1 } };
}

/** Crops a frame to its own art (the feet row stays the bottom row). */
function tight(rows: string[], feet: { x: number; y: number }): { rows: string[]; feet: { x: number; y: number } } {
  const cols = rows[0].length;
  let l = 0;
  while (l < cols - 1 && rows.every((row) => row[l] === '.')) l++;
  let r = cols - 1;
  while (r > l && rows.every((row) => row[r] === '.')) r--;
  let t = 0;
  while (t < rows.length - 1 && /^\.*$/.test(rows[t])) t++;
  return { rows: rows.slice(t).map((row) => row.slice(l, r + 1)), feet: { x: feet.x - l, y: rows.length - 1 - t } };
}

const SHAPE_OF: Record<string, EnemyShape> = {
  alley_rat: 'rat',
  porch_pigeon: 'pigeon',
  punk_raccoon: 'raccoon',
  big_earl: 'ratKing',
  vinnie_two_lids: 'raccoonBoss',
  officer_dale: 'officer',
  tin_soldier: 'soldier',
  orc_brute: 'orc',
  pumpkin_dude: 'pumpkin',
  plague_doc: 'doc',
  demon_king: 'bigDemon',
};

interface WorldFoe {
  id: string;
  color: string;
  accent: string;
}

const WORLDS = worlds as unknown as { enemies: WorldFoe[]; boss: WorldFoe }[];

/** The colors a shape wears in the first world it appears in (the raw sheet palette uses them). */
function firstLook(shape: EnemyShape): WorldFoe {
  for (const w of WORLDS) for (const f of [...w.enemies, w.boss]) if (SHAPE_OF[f.id] === shape) return f;
  return { id: shape, color: '#888888', accent: '#bbbbbb' };
}

/** An animated enemy: its sheet, and the palette indices that take the world's body color and accent. */
export interface EnemySheet {
  sheet: AnimSheet;
  /** Palette indices recolored with rampOf(world color): dark, mid, light. */
  body: readonly number[];
  /** Palette indices recolored with rampOf(world accent): dark, mid, light. */
  accent: readonly number[];
}

/** Breathing at 6 fps with a blink every 3 s (frames: 0 standing, 1 breathing in, 2 blink). */
const IDLE = [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 2, 0, 1, 1, 1];

function castSheet(shape: CastShape): { sheet: EnemySheet; still: EnemyArt } {
  const d = CAST[shape];
  const { frames, feet } = castFrames(d);
  const look = firstLook(shape);
  // Outline first, then the body and accent ramps, then every fixed color the frames use.
  const keys = ['x', ...d.body, ...d.accent];
  for (const f of frames) for (const row of f) for (const ch of row) if (ch !== '.' && !keys.includes(ch)) keys.push(ch);
  const b = rampOf(look.color);
  const a = rampOf(look.accent);
  const pal = keys.map((k, i) => (i === 0 ? CHARACTER_OUTLINE : i <= 3 ? b[i - 1] : i <= 6 ? a[i - 4] : CAST_COLORS[k]));
  const index = new Map(keys.map((k, i) => [k, KEYS[i]]));
  const sheet: AnimSheet = {
    w: frames[0][0].length,
    h: frames[0].length,
    anchor: feet,
    faces: 'left',
    pal,
    frames: frames.map((f) => f.map((row) => [...row].map((ch) => (ch === '.' ? '.' : index.get(ch))).join(''))),
    anims: {
      idle: { fps: 6, loop: true, frames: IDLE },
      walk: { fps: 8, loop: true, frames: [3, 1, 4, 1] },
      attack: { fps: 10, loop: false, frames: [5, 6, 6] },
      hurt: { fps: 8, loop: false, frames: [7, 7] },
    },
  };
  const still = tight(frames[0], feet);
  return {
    sheet: { sheet, body: [1, 2, 3], accent: [4, 5, 6] },
    still: { rows: still.rows, feet: still.feet, body: d.body, accent: d.accent },
  };
}

const CAST_SHAPES = Object.keys(CAST) as CastShape[];
const BUILT = Object.fromEntries(CAST_SHAPES.map((s) => [s, castSheet(s)])) as Record<CastShape, ReturnType<typeof castSheet>>;

/** Every hand-drawn enemy as an animated sheet (faces left): idle, walk, attack and hurt. */
export const ENEMY_SHEETS: Readonly<Record<CastShape, EnemySheet>> = Object.fromEntries(
  CAST_SHAPES.map((s) => [s, BUILT[s].sheet]),
) as Record<CastShape, EnemySheet>;

/** Each enemy's standing pose as a still (frame 0 of its sheet, cropped), for previews and as a fallback. */
export const ENEMY_ART: Record<EnemyShape, EnemyArt> = {
  ...(Object.fromEntries(CAST_SHAPES.map((s) => [s, BUILT[s].still])) as Record<CastShape, EnemyArt>),
  raccoon: { rows: ROWS_RACCOON, feet: { x: 11, y: 31 }, body: ['2', '3', '4'], accent: ['r', 'R', 'e'], outline: 'k' },
};

/** Builds an enemy still with the world's body color and accent swapped in. */
export function recolorEnemy(shape: EnemyShape, color: string, accent: string): PixelBuf {
  const art = ENEMY_ART[shape];
  const map: Record<string, string> = { ...CAST_COLORS };
  map[art.outline ?? 'x'] = CHARACTER_OUTLINE;
  const b = rampOf(color);
  const a = rampOf(accent);
  art.body.forEach((k, i) => (map[k] = b[i]));
  art.accent.forEach((k, i) => (map[k] = a[i]));
  return fromRows(art.rows, map);
}

/** Throws if an enemy's rows are invalid or its recolor keys overlap each other or the outline. */
export function checkArt(shape: EnemyShape): void {
  const art = ENEMY_ART[shape];
  checkRows(shape, art.rows);
  const keys = [...art.body, ...art.accent, art.outline ?? 'x'];
  if (new Set(keys).size !== keys.length) throw new Error(`${shape}: body, accent and outline keys must all differ`);
  if (art.feet.y !== art.rows.length - 1 || art.rows[art.feet.y][art.feet.x] === undefined) throw new Error(`${shape}: feet must be on the bottom row`);
}

/**
 * Preview sheet: each enemy's standing pose in the first world it appears in (World 1 for the regulars and
 * Officer Dale, World 2 for Big Earl, World 3 for Vinnie, World 8 for the dungeon cast) plus up to two
 * later worlds, named like "rat_w1".
 */
export function sheet(): SheetEntry[] {
  const seen = new Map<EnemyShape, { world: number; foe: WorldFoe }[]>();
  WORLDS.forEach((w, i) => {
    for (const foe of [...w.enemies, w.boss]) {
      const shape = SHAPE_OF[foe.id];
      if (!shape) continue;
      const arr = seen.get(shape) ?? [];
      arr.push({ world: i + 1, foe });
      seen.set(shape, arr);
    }
  });
  const out: SheetEntry[] = [];
  for (const shape of Object.keys(ENEMY_ART) as EnemyShape[]) {
    checkArt(shape);
    const hits = seen.get(shape) ?? [];
    const picks = [hits[0], hits[Math.min(2, hits.length - 1)], hits[Math.min(4, hits.length - 1)]].filter(
      (h, i, all) => h && all.indexOf(h) === i,
    );
    for (const h of picks) out.push({ name: `${shape}_w${h.world}`, buf: recolorEnemy(shape, h.foe.color, h.foe.accent) });
  }
  return out;
}
