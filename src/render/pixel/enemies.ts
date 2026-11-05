/**
 * Enemies and bosses in pixel art (see docs/PIXEL_ART.md). Every sprite faces LEFT, toward the hero,
 * and stands with its feet on its bottom row (`feet`, the ground point between the feet).
 *
 * The cast is drawn like Kevin's raccoon hero, the farm animals and the user's otter reference: chunky,
 * rounded critters with tiny dot eyes and a little blush, a light belly or face patch, 3 or 4 flat tones
 * per material and one small prop that says who each one is. Lines inside a shape use a darker tone of
 * the local color.
 *
 * Each character is drawn once as a fill (its art without the outer outline) plus moves. castSheet()
 * builds its animated sheet from them: idle (breathe and blink), walk (step, bob), attack and hurt (flinch).
 * The attack is six poses drawn on the fill (`CastDef.attack`: leans, squashes and stretches, then the
 * weapon, limb, open mouth and smear drawn in rows): wind and coil wind up, smear swings at the hero,
 * strike holds the blow at full reach, recoil and settle come back. Every frame gets a 1 px outline in key
 * `x`, always drawn in the raccoon's brown (CHARACTER_OUTLINE).
 *
 * Colors: each world recolors an enemy. The three `body` keys take rampOf(world color) and the three
 * `accent` keys take rampOf(world accent); those keys are used for nothing else in that sprite. Every
 * other key is drawn in CAST_COLORS, a muted, earthy take on the palette (cream, moss, warm browns, soft
 * gold), so eyes, teeth, skin, wood and metal look the same in every world. Raw rows only approximate the
 * look; always draw through recolorEnemy() or the sheets.
 */
import { checkRows, fromRows, rampOf, type PixelBuf, type Rows, type SheetEntry } from './buf';
import { KEYS, frameBuf, type AnimSheet } from './indexed';
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
  /** Draws rows at a point: '.' leaves a pixel alone, '_' clears it; `under` only fills open pixels (behind the art). */
  | { at: readonly [number, number]; draw: Rows; under?: boolean }
  /** Clears the pixels of these keys inside a box. */
  | { erase: Box; keys: string }
  /** Drops row `squash` (in columns x0..x1): everything above it comes down a pixel. */
  | { squash: number; cols?: readonly [number, number] }
  /** Doubles row `grow` (in columns x0..x1): everything above it goes up a pixel. */
  | { grow: number; cols?: readonly [number, number] }
  /** Doubles column `widen` (in rows y0..y1): everything left of it goes a pixel further left (a smear). */
  | { widen: number; rows: readonly [number, number] }
  /** Drops column `narrow` (in rows y0..y1): everything left of it comes a pixel right (a squash on impact). */
  | { narrow: number; rows: readonly [number, number] };

/** Slides rows y0..y1, every column, sideways by dx (and down by dy): a lean, one band of rows at a time. */
const band = (y0: number, y1: number, dx: number, dy = 0): Move => ({ move: [-40, y0, 80, y1], by: [dx, dy] });

/**
 * A smear: the crescent a swung tip sweeps around a pivot (the shoulder), drawn as one solid shape.
 * Angles are in degrees from the pivot, 0 pointing left at the hero and 90 straight up; the crescent runs
 * from `from` (where the swing started) to `to` (where the weapon is now), its outer edge `r` pixels from
 * the pivot, and thickens from `w0` to `w1` pixels toward the leading end. `keys` color it from the outer
 * edge in, so the edge the tip leads with is the lightest. It passes behind the art already drawn.
 */
function smear(pivot: readonly [number, number], r: number, from: number, to: number, w0: number, w1: number, keys: string): Move {
  const [cx, cy] = pivot;
  const span = to - from;
  const rows: string[] = [];
  for (let y = cy - r - 1; y <= cy + r + 1; y++) {
    let row = '';
    for (let x = cx - r - 1; x <= cx + r + 1; x++) {
      const vx = cx - x;
      const vy = cy - y;
      const d = Math.hypot(vx, vy);
      let a = (Math.atan2(vy, vx) * 180) / Math.PI;
      // The angle along the swing, 0 at its start and 1 where the weapon is.
      let t = (a - from) / span;
      for (const turn of [-360, 360]) if (t < 0 || t > 1) (a += turn), (t = (a - from) / span);
      const w = w0 + (w1 - w0) * t;
      const depth = r + 0.5 - d;
      row += t >= 0 && t <= 1 && depth > 0 && depth <= w ? keys[Math.min(keys.length - 1, Math.floor(depth))] : '.';
    }
    rows.push(row);
  }
  return { at: [cx - r - 1, cy - r - 1], draw: rows, under: true };
}

/**
 * The attack's poses in play order: `wind` eases into the wind-up and `coil` is the full wind-up
 * (leaning back, the weapon, beak, claws or head raised); `smear` is the swing in motion (the body
 * stretched toward the hero, the moving part smeared along its path); `strike` is the blow at full
 * reach, held while it lands; `recoil` and `settle` bring it back to idle.
 */
interface Attack {
  wind: Move[];
  coil: Move[];
  smear: Move[];
  strike: Move[];
  recoil: Move[];
  settle: Move[];
}

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
  hurt?: Move[];
  /** The attack, drawn pose by pose: each pose's moves in order, leans included. */
  attack: Attack;
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
    hurt: [{ at: [2, 7], draw: ['k'] }],
    attack: {
      // Crouches, rocking back.
      wind: [band(-9, 12, 1), { squash: 8, cols: [-9, 12] }],
      // Rears back baring its teeth, a clawed paw up.
      coil: [
        band(-9, 7, 2),
        band(8, 12, 1),
        { squash: 8, cols: [-9, 12] },
        { at: [3, 8], draw: ['wrw'] },
        { at: [0, 8], draw: ['w', 'wV', '.VV'] },
      ],
      // Pounces: head stretched along the lunge, jaws open, the claw raking down.
      smear: [
        band(-9, 7, -2),
        band(8, 10, -2),
        band(11, 12, -1),
        { widen: 6, rows: [-9, 7] },
        { widen: 6, rows: [-9, 7] },
        { at: [-3, 7], draw: ['wrrr', 'w333'] },
        { at: [-3, 10], draw: ['wVVV'] },
        smear([0, 9], 5, 115, -15, 1, 2, 'wm'),
      ],
      // The bite lands, claws out.
      strike: [
        band(-9, 7, -4),
        band(8, 10, -2),
        band(11, 12, -1),
        { at: [-3, 7], draw: ['wrrr', 'w333'] },
        { at: [-5, 9], draw: ['wVVVV', 'wVV'] },
      ],
      recoil: [band(-9, 7, -1), band(8, 12, -1)],
      settle: [{ squash: 8, cols: [-9, 12] }],
    },
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
    attack: {
      // Pulls its head back.
      wind: [band(-9, 3, 2), band(4, 9, 1), { grow: 4, cols: [-9, 12] }],
      // Neck cocked up and back, wing flared.
      coil: [
        band(-9, 3, 3),
        band(4, 9, 1),
        { grow: 4, cols: [-9, 12] },
        { grow: 4, cols: [-9, 12] },
        smear([10, 5], 7, 75, 170, 7, 7, '2334'),
      ],
      // The peck: the head darts out on a stretched neck, wing beating.
      smear: [
        band(-9, 3, -4),
        band(4, 5, -3),
        band(6, 9, -2),
        band(10, 12, -1),
        { widen: 6, rows: [-9, 5] },
        { widen: 6, rows: [-9, 5] },
        smear([8, 6], 7, 95, 185, 7, 7, '2334'),
      ],
      // The beak lands.
      strike: [
        band(-9, 3, -6),
        band(4, 5, -4),
        band(6, 9, -2),
        band(10, 12, -1),
        smear([8, 6], 6, 100, 175, 6, 6, '2334'),
      ],
      // Head comes back, wing folding.
      recoil: [band(-9, 3, -2), band(4, 9, -1), smear([10, 6], 5, 110, 170, 5, 5, '234')],
      settle: [{ squash: 6, cols: [-9, 15] }],
    },
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
    attack: {
      // Rocks back and lifts the sword.
      wind: [
        { erase: [13, 3, 15, 10], keys: '54ys' },
        { erase: [11, 10, 12, 10], keys: 'U' },
        band(-9, 8, 1),
        { at: [11, 1], draw: ['...5', '...5', '...5', '...4', '...4', '..yyy', '...s', '..U', 'UU', 'U'] },
      ],
      // Crouched, the sword cocked back over his shoulder, the shield forward.
      coil: [
        { erase: [13, 3, 15, 10], keys: '54ys' },
        { erase: [11, 10, 12, 10], keys: 'U' },
        { erase: [1, 10, 5, 14], keys: 'cRy' },
        band(-9, 8, 2),
        band(9, 14, 1),
        { squash: 10 },
        { at: [1, 10], draw: ['.ccc.', 'cRRRc', 'cRyRc', 'cRRRc', '.ccc.'] },
        { at: [11, 0], draw: ['......w', '.....5.', '...y4..', '...sy..', '..UU...', '.UU....', 'UU.....', 'U......'] },
      ],
      // The chop: the blade sweeps over his helmet to point at the hero; the shield drops back.
      smear: [
        { erase: [13, 3, 15, 10], keys: '54ys' },
        { erase: [11, 10, 12, 10], keys: 'U' },
        { erase: [1, 10, 5, 14], keys: 'cRy' },
        band(-9, 8, -3),
        band(9, 12, -2),
        band(13, 14, -1),
        { at: [-1, 11], draw: ['.ccc.', 'cRRRc', 'cRyRc', 'cRRRc', '.ccc.'] },
        { at: [-6, 9], draw: ['.....y', 'w5554ysUUU', '.....y'] },
        smear([5, 10], 11, 125, 0, 1, 3, 'wC'),
      ],
      // The blow lands, sword at full reach.
      strike: [
        { erase: [13, 3, 15, 10], keys: '54ys' },
        { erase: [11, 10, 12, 10], keys: 'U' },
        { erase: [1, 10, 5, 14], keys: 'cRy' },
        band(-9, 8, -3),
        band(9, 12, -2),
        band(13, 14, -1),
        { at: [-1, 11], draw: ['.ccc.', 'cRRRc', 'cRyRc', 'cRRRc', '.ccc.'] },
        { at: [-6, 9], draw: ['.....y', 'w5554ysUUUU', '.....y'] },
      ],
      // Pulls the sword back over his shoulder.
      recoil: [
        { erase: [13, 3, 15, 10], keys: '54ys' },
        { erase: [11, 10, 12, 10], keys: 'U' },
        { erase: [1, 10, 5, 14], keys: 'cRy' },
        band(-9, 8, -1),
        band(9, 12, -1),
        { at: [0, 10], draw: ['.ccc.', 'cRRRc', 'cRyRc', 'cRRRc', '.ccc.'] },
        { at: [11, 4], draw: ['.....w', '....5.', '..y4..', '..sy..', '.UU...', 'UU....'] },
      ],
      settle: [{ squash: 9 }],
    },
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
    attack: {
      // Rocks back, hoisting the club.
      wind: [
        { erase: [17, 0, 20, 8], keys: 'tTolGg' },
        { erase: [18, 9, 20, 9], keys: 'go' },
        { erase: [16, 7, 16, 8], keys: 'l' },
        band(-9, 14, 1),
        { at: [18, -2], draw: ['..t', '.tTt', '.tTo', '.tTo', '.to', '.to', 'lGGo', 'lGGGo', 'GGg'] },
      ],
      // Crouched, the club cocked back behind his head.
      coil: [
        { erase: [17, 0, 20, 8], keys: 'tTolGg' },
        { erase: [18, 9, 20, 9], keys: 'go' },
        { erase: [16, 7, 16, 8], keys: 'l' },
        band(-9, 8, 2),
        band(9, 14, 1),
        { squash: 9 },
        { at: [16, -2], draw: ['....tt', '...tTTt', '...TTTo', '..tToo', '.to', 'lGG', 'lGGG', 'GGg'] },
      ],
      // The smash: the club comes over his head at the hero.
      smear: [
        { erase: [17, 0, 20, 8], keys: 'tTolGg' },
        { erase: [18, 9, 20, 9], keys: 'go' },
        { erase: [16, 7, 16, 8], keys: 'l' },
        band(-9, 8, -3),
        band(9, 12, -2),
        band(13, 14, -1),
        { at: [-6, 7], draw: ['.....lGG', '.tTtoGGl', 'tTTTo', 'tTTo', '.to'] },
        smear([7, 9], 12, 125, -8, 1, 4, 'WT'),
      ],
      // The blow lands.
      strike: [
        { erase: [17, 0, 20, 8], keys: 'tTolGg' },
        { erase: [18, 9, 20, 9], keys: 'go' },
        { erase: [16, 7, 16, 8], keys: 'l' },
        band(-9, 8, -3),
        band(9, 12, -2),
        band(13, 14, -1),
        { at: [-6, 7], draw: ['.....lGG', '....ooGGl', '...to', '.tTTt', 'tTTTo', 'tTTo', '.to'] },
      ],
      // Hauls the club back up.
      recoil: [
        { erase: [17, 0, 20, 8], keys: 'tTolGg' },
        { erase: [18, 9, 20, 9], keys: 'go' },
        { erase: [16, 7, 16, 8], keys: 'l' },
        band(-9, 8, -1),
        band(9, 12, -1),
        { at: [16, 0], draw: ['...tt', '..tTTt', '..TTTo', '.tToo', 'to', 'lGG', 'lGGG', 'GGg'] },
      ],
      settle: [{ squash: 9 }],
    },
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
    hurt: [
      { at: [3, 5], draw: ['oo', 'yo'] },
      { at: [8, 5], draw: ['oo', 'yo'] },
    ],
    attack: {
      // Ducks its head, rocking back.
      wind: [
        { erase: [13, 1, 16, 14], keys: '4Ns' },
        { erase: [13, 11, 13, 11], keys: 'V' },
        band(-9, 10, 1),
        { squash: 11, cols: [-9, 12] },
        { at: [13, 1], draw: ['.4.4', '.4.4', '.444', '..N', '..N', '..N', '..N', '..N', '..N', '.sN', 'VN', '.N', '.N', '.N'] },
      ],
      // Head tipped back, eyes blazing.
      coil: [
        { erase: [13, 1, 16, 14], keys: '4Ns' },
        { erase: [13, 11, 13, 11], keys: 'V' },
        band(-9, 4, 3),
        band(5, 10, 2),
        band(11, 14, 1),
        { at: [5, 5], draw: ['w', 'ww'] },
        { at: [10, 5], draw: ['w', 'ww'] },
        { at: [14, 1], draw: ['.4.4', '.4.4', '.444', '..N', '..N', '..N', '..N', '..N', '..N', '.sN', 'VN', '.N', '.N', '.N'] },
      ],
      // The butt: the head flies at the hero, smeared along the way.
      smear: [
        { erase: [13, 1, 16, 14], keys: '4Ns' },
        { erase: [13, 11, 13, 11], keys: 'V' },
        band(-9, 10, -3),
        band(11, 12, -2),
        band(13, 14, -1),
        { widen: 9, rows: [-9, 10] },
        { widen: 9, rows: [-9, 10] },
        { at: [11, 1], draw: ['.4.4', '.4.4', '.444', '..N', '..N', '..N', '..N', '..N', '..N', '.sN', 'VN', '.N', '.N', '.N'] },
      ],
      // Bonk: the head squashed flat on impact.
      strike: [
        { erase: [13, 1, 16, 14], keys: '4Ns' },
        { erase: [13, 11, 13, 11], keys: 'V' },
        band(-9, 10, -6),
        band(11, 12, -2),
        band(13, 14, -1),
        { narrow: 2, rows: [-9, 10] },
        { grow: 6, cols: [-9, 8] },
        { at: [11, 1], draw: ['.4.4', '.4.4', '.444', '..N', '..N', '..N', '..N', '..N', '..N', '.sN', 'VN', '.N', '.N', '.N'] },
      ],
      // Bounces back.
      recoil: [
        { erase: [13, 1, 16, 14], keys: '4Ns' },
        { erase: [13, 11, 13, 11], keys: 'V' },
        band(-9, 10, -2),
        band(11, 14, -1),
        { grow: 10, cols: [-9, 12] },
        { at: [12, 1], draw: ['.4.4', '.4.4', '.444', '..N', '..N', '..N', '..N', '..N', '..N', '.sN', 'VN', '.N', '.N', '.N'] },
      ],
      settle: [{ squash: 11, cols: [-9, 12] }],
    },
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
    attack: {
      // Draws a syringe from his coat, rocking back.
      wind: [
        band(-9, 10, 1),
        { at: [14, 2], draw: ['w', '4', 'Cl', 'Cl', 'Cl', 'cc', 'bb', 'bb', '.U'], under: true },
      ],
      // Crouched, the syringe cocked back behind him.
      coil: [
        band(-9, 10, 2),
        band(11, 16, 1),
        { squash: 11, cols: [-9, 17] },
        { at: [12, 4], draw: ['..CCCc1', 'w4lllcbb', '......bU', '......UU'], under: true },
      ],
      // The jab: the needle shoots out, smeared along its path.
      smear: [
        band(-9, 10, -3),
        band(11, 16, -2),
        { at: [-7, 10], draw: ['..CCCCCCcbbUU', 'w4llllllcbbUUu'] },
      ],
      // The needle lands.
      strike: [
        band(-9, 10, -3),
        band(11, 16, -2),
        { at: [-7, 10], draw: ['..CCCCcbbUU', 'w4llllcbbUUu'] },
      ],
      // Pulls it back.
      recoil: [
        band(-9, 10, -1),
        band(11, 16, -1),
        { at: [-2, 10], draw: ['..CCCcbbU', 'w4lllcbbUU'] },
      ],
      settle: [{ squash: 11, cols: [-9, 17] }],
    },
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
    hurt: [
      { at: [5, 8], draw: ['kR', 'Rk', 'kR'] },
      { at: [11, 8], draw: ['Rk', 'kR', 'Rk'] },
      { at: [9, 12], draw: ['kk'] },
    ],
    attack: {
      // Rears back, arms going up.
      wind: [
        band(-9, 14, 1),
        { grow: 14, cols: [-9, 19] },
        { at: [0, 7], draw: ['.y', 'yeR', 'eRRr', '.eRr', '.eR', '.eR'], under: true },
      ],
      // Up on his toes, both fists over his horns, roaring.
      coil: [
        band(-9, 14, 2),
        band(15, 21, 1),
        { grow: 14, cols: [-9, 19] },
        { grow: 14, cols: [-9, 19] },
        { at: [9, 12], draw: ['kkkk', 'wkkw'] },
        { at: [-1, -4], draw: ['.y.y', 'yeRRr', 'eRRRr', 'eRRRr', 'xrRrx', '.eRrx', '.eRrx', '.eRrx', '..eRrx', '..eRrx', '..eRrx', '..eRrx', '...eRx', '...eRx', '....eR', '....eR'] },
        { at: [19, -4], draw: ['.y.y', 'yeRRr', 'eRRRr', 'eRRrr', 'xrRrx', 'xeRr', 'xeRr', 'xeRr', 'eRr', 'eRr', 'eRr', 'eRr', 'eR', 'eR', 'R', 'R'] },
      ],
      // The slam: both arms come down at the hero.
      smear: [
        band(-9, 7, -3),
        band(8, 14, -2),
        band(15, 21, -1),
        { at: [6, 11], draw: ['kkkk', 'wkkw'] },
        { at: [-7, 10], draw: ['....eRRRRR', '.yeRRRRRRr', 'yeRRRr', 'eRRRr', '.rRr'] },
        smear([6, 12], 13, 95, -15, 2, 4, 'Ye'),
      ],
      // Fists land, body bent over the blow.
      strike: [
        band(-9, 7, -5),
        band(8, 14, -3),
        band(15, 18, -2),
        band(19, 21, -1),
        { squash: 12, cols: [-9, 19] },
        { at: [4, 12], draw: ['kkkk', 'wkkw'] },
        { at: [-7, 12], draw: ['.....eRRRR', '..yeRRRRRr', '.yeRRRrRr', 'yeRRRr', 'eRRRr', '.rRr'] },
        { at: [-10, 15], draw: ['......eRRRRR', '...yeRRRRRRr', '..yeRRRr', '.yeRRRr', '.eRRRr', '..rRr'] },
      ],
      // Straightens up, arms coming back.
      recoil: [
        band(-9, 14, -1),
        band(15, 21, -1),
        { at: [-3, 13], draw: ['..eRRR', '.yeRRr', 'yeRRr', 'eRRr', '.rr'] },
      ],
      settle: [{ squash: 14, cols: [-9, 19] }],
    },
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
    hurt: [{ move: [3, 0, 17, 6], by: [0, -1] }],
    attack: {
      // Leans back, drawing his nightstick behind him.
      wind: [
        band(-9, 13, 1),
        { at: [17, 4], draw: ['.2', '21', '21', '21', '21', '21', '21', '21', 'ss', 'ss', 'U'], under: true },
      ],
      // Crouched, the stick cocked back over his shoulder.
      coil: [
        band(-9, 13, 2),
        band(14, 20, 1),
        { squash: 14 },
        { at: [15, 2], draw: ['......2', '.....21', '....21.', '...21..', '..ss...', '.ss....', 'UU.....'], under: true },
      ],
      // The swing: the stick comes over his cap at the hero.
      smear: [
        { erase: [2, 16, 3, 19], keys: 's' },
        band(-9, 13, -3),
        band(14, 18, -2),
        band(19, 20, -1),
        { at: [-8, 14], draw: ['.......ssUUU', '..2221ssUUu', '2211....', '11'] },
        smear([8, 12], 15, 120, -14, 1, 3, 'w4'),
      ],
      // The blow lands.
      strike: [
        { erase: [2, 16, 3, 19], keys: 's' },
        band(-9, 13, -3),
        band(14, 18, -2),
        band(19, 20, -1),
        { at: [-8, 14], draw: ['.......ssUUU', '..2221ssUUu', '2211....', '11'] },
      ],
      // Brings the stick back up.
      recoil: [
        band(-9, 13, -1),
        band(14, 18, -1),
        { at: [15, 4], draw: ['.....2', '....21', '...21.', '..21..', '.ss...', 'ss....', 'U.....'], under: true },
      ],
      settle: [{ squash: 14 }],
    },
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
    hurt: [{ move: [8, 0, 14, 3], by: [1, 0] }],
    attack: {
      // Rears back, raising his scepter.
      wind: [
        { at: [1, 16], draw: ['mm'] },
        band(-9, 12, 1),
        { at: [-2, 4], draw: ['.Y.', 'YRy', '.y.', '.y.', '.O.', '.O.', '.O.', '.O.', 'PPm', 'PPm'] },
      ],
      // Crouched, the scepter held high.
      coil: [
        { at: [1, 16], draw: ['mm'] },
        band(-9, 12, 2),
        band(13, 21, 1),
        { squash: 13 },
        { at: [-1, 0], draw: ['.Y.', 'YRy', '.y.', '.y.', '.O.', '.O.', '.O.', '.O.', 'PP', 'PPm', '.mm'] },
      ],
      // The swipe: the scepter swings down at the hero.
      smear: [
        { at: [1, 16], draw: ['mm'] },
        band(-9, 12, -3),
        band(13, 17, -2),
        band(18, 21, -1),
        { at: [-7, 13], draw: ['....PPmm', 'yyyyPPm'] },
        smear([0, 13], 8, 95, -5, 1, 3, 'Yy'),
        { at: [-9, 13], draw: ['.Y', 'YRy', '.y'] },
      ],
      // The blow lands.
      strike: [
        { at: [1, 16], draw: ['mm'] },
        band(-9, 12, -3),
        band(13, 17, -2),
        band(18, 21, -1),
        { at: [-6, 13], draw: ['...PPmm', 'yOOPPm'] },
        { at: [-9, 13], draw: ['.Y.', 'YRy', '.y.'] },
      ],
      // Lifts it back.
      recoil: [
        { at: [1, 16], draw: ['mm'] },
        band(-9, 12, -1),
        band(13, 17, -1),
        { at: [-4, 6], draw: ['Y.', 'Ry', '.yy', '..O', '...O', '....OP', '.....PPm'] },
      ],
      settle: [{ squash: 13 }],
    },
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
    hurt: [{ move: [3, 0, 18, 4], by: [0, -1] }],
    attack: {
      // Rears back, lifting the lid.
      wind: [
        { erase: [20, 3, 25, 7], keys: '2451w' },
        band(-9, 12, 1),
        { at: [21, 1], draw: ['.2222', '245542', '251w52', '245542', '.2222', '..vv', '..vV'] },
      ],
      // Wound up: the lid hauled way back, his weight on his back foot.
      coil: [
        { erase: [20, 3, 25, 7], keys: '2451w' },
        { erase: [0, 15, 7, 21], keys: '2451w' },
        band(-9, 12, 2),
        band(13, 22, 1),
        { squash: 13 },
        { at: [1, 16], draw: ['..2222', '.244442', '24555542', '2451w542', '24555542', '.244442', '..2222'] },
        { at: [22, -1], draw: ['.2222', '245542', '251w52', '245542', '.2222.', '.vv', 'vV', 'V'] },
      ],
      // The haymaker: the lid comes round over his hat at the hero's head.
      smear: [
        { erase: [20, 3, 25, 7], keys: '2451w' },
        { erase: [0, 15, 7, 21], keys: '2451w' },
        band(-9, 12, -3),
        band(13, 18, -2),
        band(19, 22, -1),
        { at: [-2, 15], draw: ['..2222', '.244442', '24555542', '2451w542', '24555542', '.244442', '..2222'] },
        { at: [-7, 6], draw: ['.2222', '245542', '251w52VV', '245542vV', '.2222'] },
        smear([9, 12], 16, 150, 10, 2, 4, 'w5'),
      ],
      // The blow lands.
      strike: [
        { erase: [20, 3, 25, 7], keys: '2451w' },
        { erase: [0, 15, 7, 21], keys: '2451w' },
        band(-9, 12, -4),
        band(13, 18, -2),
        band(19, 22, -1),
        { at: [-2, 15], draw: ['..2222', '.244442', '24555542', '2451w542', '24555542', '.244442', '..2222'] },
        { at: [-9, 6], draw: ['.2222', '245542', '251w52VVV', '245542vVV', '.2222'] },
      ],
      // Swings the lid back up over his hat.
      recoil: [
        { erase: [20, 3, 25, 7], keys: '2451w' },
        band(-9, 12, -1),
        band(13, 18, -1),
        { at: [17, -3], draw: ['.2222', '245542', '251w52', '245542', '.2222', '..vv', '..vV'] },
      ],
      settle: [{ squash: 13 }],
    },
  },
};

// ------------------------------------------------------------------ frames

type Grid = string[][];

/** Room around the fill for moves and their outline (left, top, right); nothing moves below the feet. */
const MARGIN = { l: 14, t: 10, r: 10 };

function apply(g: Grid, m: Move): void {
  const inside = (x: number, y: number) => y >= 0 && y < g.length && x >= 0 && x < g[0].length;
  if ('widen' in m || 'narrow' in m) {
    const col = ('widen' in m ? m.widen : m.narrow) + MARGIN.l;
    for (let y = Math.max(0, m.rows[0] + MARGIN.t); y <= Math.min(g.length - 1, m.rows[1] + MARGIN.t); y++) {
      if ('widen' in m) for (let x = 0; x < col; x++) g[y][x] = g[y][x + 1];
      else {
        for (let x = col; x > 0; x--) g[y][x] = g[y][x - 1];
        g[y][0] = '.';
      }
    }
  } else if ('squash' in m || 'grow' in m) {
    const row = ('squash' in m ? m.squash : m.grow) + MARGIN.t;
    const [c0, c1] = m.cols ?? [-MARGIN.l, g[0].length];
    for (let x = Math.max(0, c0 + MARGIN.l); x <= Math.min(g[0].length - 1, c1 + MARGIN.l); x++) {
      if ('squash' in m) {
        for (let y = row; y > 0; y--) g[y][x] = g[y - 1][x];
        g[0][x] = '.';
      } else {
        for (let y = 0; y < row; y++) g[y][x] = g[y + 1][x];
      }
    }
  } else if ('move' in m) {
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
        if (ch !== '.' && inside(x, y) && !(m.under && g[y][x] !== '.')) g[y][x] = ch === '_' ? '.' : ch;
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

/** The poses every character has, in sheet frame order (the attack's six from frame 5, then the flinch's two). */
const POSES = ['base', 'breathe', 'blink', 'stepA', 'stepB', 'wind', 'coil', 'smear', 'strike', 'recoil', 'settle', 'hurt', 'hurt2'] as const;
type Pose = (typeof POSES)[number];

function poseMoves(d: CastDef, pose: Pose): Move[] {
  const shut: Move[] = d.eyes.map(([x, y]) => ({ at: [x, y], draw: [d.shut] }));
  const lean = (dx: number): Move => band(-MARGIN.t, d.waist - 1, dx);
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
    case 'hurt':
      // Snaps back, head first, eyes squeezed shut...
      return [...shut, ...(d.hurt ?? []), { move: d.breathe, by: [1, 0] }, lean(1)];
    case 'hurt2':
      // ...and eases forward again.
      return [...shut, lean(1)];
    default:
      return d.attack[pose];
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

/**
 * The attack at 25 fps (40 ms a beat), timed to the battle's lunge (BattleScene `lungeAt`): wind 40 ms
 * and coil 80 ms while it rocks back, the smear while it lunges (120 to 160 ms), the strike from 160 ms
 * (the blow lands at 170 ms) held 120 ms, then recoil and settle, 80 ms each: 440 ms in all.
 */
export const ATTACK_FPS = 25;
const ATTACK = [5, 6, 6, 7, 8, 8, 8, 9, 9, 10, 10];

function castSheet(shape: CastShape): { sheet: EnemySheet; still: EnemyArt } {
  const d = CAST[shape];
  const { frames, feet } = castFrames(d);
  const look = firstLook(shape);
  // Outline first, then the body and accent ramps, then every fixed color the frames use.
  const keys = ['x', ...d.body, ...d.accent];
  for (const f of frames) for (const row of f) for (const ch of row) if (ch !== '.' && !keys.includes(ch)) keys.push(ch);
  for (const k of keys.slice(7)) if (!(k in CAST_COLORS)) throw new Error(`${shape}: unknown key "${k}"`);
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
      attack: { fps: ATTACK_FPS, loop: false, frames: ATTACK },
      hurt: { fps: 8, loop: false, frames: [11, 12] },
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
 * later worlds, named like "rat_w1"; then each hand-drawn enemy's attack pose by pose in its first world's
 * colors ("rat_attack1" to "rat_attack6": wind, coil, smear, strike, recoil, settle).
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
  for (const shape of CAST_SHAPES) {
    const s = ENEMY_SHEETS[shape].sheet;
    [...new Set(s.anims.attack.frames)].forEach((f, k) => out.push({ name: `${shape}_attack${k + 1}`, buf: frameBuf(s, f) }));
  }
  return out;
}
