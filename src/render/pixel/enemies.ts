/**
 * Enemies and bosses in pixel art (see docs/PIXEL_ART.md). Every sprite faces LEFT, toward the hero,
 * and stands with its feet on its bottom row (`feet`, the ground point between the feet).
 *
 * The cast is drawn like Kevin's raccoon hero, the farm animals and the user's otter reference: chunky,
 * rounded critters with tiny dot eyes and a little blush, a light belly or face patch, 3 or 4 flat tones
 * per material and one small prop that says who each one is. The outside edge is a 1 px outline in key
 * `x`, always drawn in the raccoon's brown (CHARACTER_OUTLINE); lines inside a shape use a darker tone of
 * the local color instead.
 *
 * Colors: each world recolors an enemy. The three `body` keys take rampOf(world color) and the three
 * `accent` keys take rampOf(world accent); those keys are used for nothing else in that sprite. Every
 * other key is drawn in CAST_COLORS, a muted, earthy take on the palette (cream, moss, warm browns, soft
 * gold), so eyes, teeth, skin, wood and metal look the same in every world. Raw rows only approximate the
 * look; always draw through recolorEnemy().
 */
import { checkRows, fromRows, rampOf, type PixelBuf, type Rows, type SheetEntry } from './buf';
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

/** Alley Rat: big pink ear, angry squint, buck tooth, hunched back, tail curling up behind. 14x9. */
const ROWS_RAT: Rows = [
  '....xxx.......',
  '...xWPPx...x..',
  '...xPqqxxxxPx.',
  '..x4xq3333xxPx',
  '.x4k4333332xPx',
  'xP443333332xPx',
  '.xw44333322xPx',
  '..xx44x222PPx.',
  '...xPPxxPPxx..',
];

/** Porch Pigeon: orange glaring eye, dark beak with a white cere, iridescent neck, puffed chest, barred wing. 10x11. */
const ROWS_PIGEON: Rows = [
  '...xxx....',
  '..x443x...',
  '.x4O33x...',
  'x1W332x...',
  '.xAa32x...',
  'xAag333x..',
  'x443x333x.',
  'x4433x3x2x',
  'x44333x22x',
  '.x33222xx.',
  '..xxRxRx..',
];

/** Punk Raccoon: three-fin mohawk, bandit mask, sneer with a fang, fists up, ringed tail. 24x32. */
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

/** Big Earl: fat rat king with a jeweled crown, angry brows, a scar through one eye, a royal robe over a cream belly, curled tail. 22x19. */
const ROWS_RAT_KING: Rows = [
  '........x.x.x.........',
  '..xxx..xYxyxyx..xxx...',
  '.x3PPx.xYyRyyx.xPP3x..',
  '.x3PqxxxOOOOOxxxqP3x..',
  '..x444444333333333x...',
  '..x43x33333Px33332x...',
  '..x433k3333k333332x...',
  '.x444333333P333322x...',
  'xP4443333333333322x...',
  '.xwxx333333333322xx...',
  '.xxmmmmy3333ymmmVVVx..',
  'xmmVVVx333333xVVVVVx..',
  'xmVVVxWWWWWWW3xVVVVx..',
  'xmVVVxWWWWWWWWxVVVvx..',
  'xmVVVxWWWWWWWWxVVVvxx.',
  'xmVVVxWWWWWWWTxVVVvxPx',
  'xmVVVVxWWWWWTxVVVVvxPx',
  '.xVVVVVxxxxxxVVVVvxPx.',
  '..xPPPxxxxxPPPxvvxPx..',
];

/** Vinnie "Two Lids": mob-boss raccoon in a fedora, gold-tooth smirk, gold chain, one lid raised and one held in front, ringed tail. 20x21. */
const ROWS_RACCOON_BOSS: Rows = [
  '......xxxxxxxx......',
  '.....xeeereRRrx.....',
  '.....xeRRRRRRrx.....',
  '...xxx11111111xxx...',
  '..xeeeRRRRRRRRRRrx..',
  '...xxxxxxxxxxxxxxx..',
  '...x1111VV1111x543x.',
  '...x1kw1VV1kw1xw543x',
  '...xm11WWWW11x55432x',
  '...xmVWWkkWWVx44332x',
  '....xVWWWxyWVx4332x.',
  '.....xVWWWVVxmV32x..',
  '...xxVVyVVVyVVVxxx..',
  '..xxxxxVyyyvVVxvvvx.',
  '.x5554xxWWWWvxmVVvx.',
  'x5w5443xWWWWvxmVVvx.',
  'x55mV43xWWWWvxvvvvx.',
  'x44Vv33xWWWvxmVVvx..',
  'x443332xVVVvxvvvx...',
  '.x3332xVVVVvvxxx....',
  '..xxxx111x111x......',
];

/** Officer Dale: grumpy animal-control officer with cap, mustache, badge and a catch pole. 38x56. */
const ROWS_OFFICER: Rows = [
  '.................kkkkkkkkkkkkkkk......',
  '................kccccccccccccccuk.....',
  '...............kccUUUUUUUUUUUUUUk.....',
  '...............kcUUUUUUUUUUUUUUUuk....',
  '..............kccUUyYyUUUUUUUUUUuk....',
  '..............kcUUUOyOUUUUUUUUUUuk....',
  '..............kcUUUUOUUUUUUUUUUUuk....',
  '..............kcUUUUUUUUUUUUUUUUuk....',
  '..............kuuuuuuuuuuuuuuuuuuk....',
  '..........kkkkkxxx11111111111111xk....',
  '........kk11111111xxxxxxxxxxxxxxxk....',
  '.......kxxxxxxxxxxxTTTTTTTTTTTTkk.....',
  '........kkkkkkkkkTTTsssssssssssSk.....',
  '................kxxsssxxsssssssSk.....',
  '...............kkT4xsxssssssssssk.....',
  '..............kTTkksskksssssssssSk....',
  '.............kTTskksskksssssssssSk....',
  '............kTTsssSTsssssssssssSSk....',
  '............kTSSSSSSSssssssssssSk.....',
  '.............kSNNNNNNNSssssssssSk.....',
  '............kNNNnnnnnnnbssssssSSk.....',
  '............kNnnnnnnnnbbTssssSSk......',
  '.............kbbbbbbbbbTTssSSSk.......',
  '..............kkkkkkkSSTSSSSkkkkk.....',
  '...............kkkcckkkkSkkkkcccuk....',
  '..............kuxccUUxccccccccUUuuk...',
  '..............kxccUUUuxUUUUUUUUUUuk...',
  '....k.........kccUUUuuxUUUUUUUUUUuk...',
  '..kkekk......kccUUUUuxcUyYyUUUUUUuuk..',
  '.krrrRrk.....kcUUUUuuxUUOyOUUUUUUUuk..',
  '.krkkkRk....kccUUUuuxcUuuOUUUUUUUUuk..',
  'krrk..krk..kuxxxUuuxuuuuuxxxUUUUUUuuk.',
  'krkkkkkrkkkkxTTTxuxuuuuuxTTTxUUUUUuuk.',
  'kr55552r555xTTssSxx5555xTTssSxUUUuuuk.',
  'kr22222r222xTssSSx22222xTssSSxUuuuuuk.',
  'kekkkkkrkkkkkSSSxuuuuuuuxsSSxuuuuuuk..',
  'kerk..krk....kkxuuuuuuuuuxSxuuuuukk...',
  '.kRkkkrk......kNNNNNNNNyYyxNNNNNbk....',
  '.krRrrrk......kNnnnnnnnOyOnnnnnnbk....',
  '..kkrkk.......kbbbbbbbbbbbbbbbbbbk....',
  '....k..........kkcccccukkcccccukk.....',
  '................kcUUUUukkcUUUUuk......',
  '................kcUUUUukkcUUUUuk......',
  '................kcUUUUukkcUUUUuk......',
  '................kcUUUUukkcUUUUuk......',
  '................kcUUUUukkcUUUUuk......',
  '................kcUUUUukkcUUUUuk......',
  '................kcUUUUukkcUUUUuk......',
  '...............kxcUUUUukkcUUUUuxk.....',
  '...............kxuuuuuukkuuuuuuxk.....',
  '...............k1xxxxxxkkxxxxxxxk.....',
  '...............k111111xkk111111xk.....',
  '...............k111111xkk111111xk.....',
  '...............k11111xxkk11111xxk.....',
  '................kxxxxxk..kxxxxxk......',
  '.................kkkkk....kkkkk.......',
];

export const ENEMY_ART: Record<EnemyShape, EnemyArt> = {
  rat: { rows: ROWS_RAT, feet: { x: 6, y: 8 }, body: ['2', '3', '4'], accent: ['q', 'P', 'W'] },
  pigeon: { rows: ROWS_PIGEON, feet: { x: 5, y: 10 }, body: ['2', '3', '4'], accent: ['g', 'a', 'A'] },
  raccoon: { rows: ROWS_RACCOON, feet: { x: 11, y: 31 }, body: ['2', '3', '4'], accent: ['r', 'R', 'e'], outline: 'k' },
  ratKing: { rows: ROWS_RAT_KING, feet: { x: 8, y: 18 }, body: ['2', '3', '4'], accent: ['v', 'V', 'm'] },
  raccoonBoss: { rows: ROWS_RACCOON_BOSS, feet: { x: 9, y: 20 }, body: ['v', 'V', 'm'], accent: ['r', 'R', 'e'] },
  officer: { rows: ROWS_OFFICER, feet: { x: 23, y: 55 }, body: ['u', 'U', 'c'], accent: ['O', 'y', 'Y'] },
  soldier: { rows: ROWS_RAT, feet: { x: 6, y: 8 }, body: ['2', '3', '4'], accent: ['q', 'P', 'W'] },
  orc: { rows: ROWS_RAT, feet: { x: 6, y: 8 }, body: ['2', '3', '4'], accent: ['q', 'P', 'W'] },
  pumpkin: { rows: ROWS_RAT, feet: { x: 6, y: 8 }, body: ['2', '3', '4'], accent: ['q', 'P', 'W'] },
  doc: { rows: ROWS_RAT, feet: { x: 6, y: 8 }, body: ['2', '3', '4'], accent: ['q', 'P', 'W'] },
  bigDemon: { rows: ROWS_RAT, feet: { x: 6, y: 8 }, body: ['2', '3', '4'], accent: ['q', 'P', 'W'] },
};

/** Builds an enemy sprite with the world's body color and accent swapped in. */
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
  const bottom = art.rows[art.feet.y] ?? '';
  if (art.feet.y !== art.rows.length - 1 || bottom[art.feet.x] === undefined) throw new Error(`${shape}: feet must be on the bottom row`);
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

/**
 * Preview sheet: each enemy in the first world it appears in (World 1 for the regulars and Officer Dale,
 * World 2 for Big Earl, World 3 for Vinnie, World 8 for the dungeon cast) plus up to two later worlds,
 * named like "rat_w1".
 */
export function sheet(): SheetEntry[] {
  const list = worlds as unknown as { enemies: WorldFoe[]; boss: WorldFoe }[];
  const seen = new Map<EnemyShape, { world: number; foe: WorldFoe }[]>();
  list.forEach((w, i) => {
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
