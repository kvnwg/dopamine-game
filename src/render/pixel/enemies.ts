/**
 * Enemies and bosses in pixel art (see docs/PIXEL_ART.md). Every sprite faces LEFT, toward the hero.
 * Each world recolors an enemy: the three `body` keys take rampOf(world color) and the three `accent`
 * keys take rampOf(world accent). Those keys are used for nothing else in that sprite, so eyes, teeth,
 * metal, skin and outlines never change. Raw (un-recolored) rows only approximate the look; always draw
 * through recolorEnemy().
 */
import { checkRows, fromRows, rampOf, type PixelBuf, type Rows, type SheetEntry } from './buf';
import worlds from '../../data/worlds.json';

export type EnemyShape = 'rat' | 'pigeon' | 'raccoon' | 'ratKing' | 'raccoonBoss' | 'officer';

export interface EnemyArt {
  rows: Rows;
  /** Bottom-center art pixel where the enemy touches the ground. */
  feet: { x: number; y: number };
  /** Dark, mid, light palette keys replaced by rampOf(world color). */
  body: [string, string, string];
  /** Dark, mid, light palette keys replaced by rampOf(world accent). */
  accent: [string, string, string];
}

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
  raccoon: { rows: ROWS_RACCOON, feet: { x: 11, y: 31 }, body: ['2', '3', '4'], accent: ['r', 'R', 'e'] },
  ratKing: { rows: ROWS_RAT_KING, feet: { x: 8, y: 18 }, body: ['2', '3', '4'], accent: ['v', 'V', 'm'] },
  raccoonBoss: { rows: ROWS_RACCOON_BOSS, feet: { x: 9, y: 20 }, body: ['v', 'V', 'm'], accent: ['r', 'R', 'e'] },
  officer: { rows: ROWS_OFFICER, feet: { x: 23, y: 55 }, body: ['u', 'U', 'c'], accent: ['O', 'y', 'Y'] },
};

/** Builds an enemy sprite with the world's body color and accent swapped in. */
export function recolorEnemy(shape: EnemyShape, color: string, accent: string): PixelBuf {
  const art = ENEMY_ART[shape];
  const map: Record<string, string> = {};
  const b = rampOf(color);
  const a = rampOf(accent);
  art.body.forEach((k, i) => (map[k] = b[i]));
  art.accent.forEach((k, i) => (map[k] = a[i]));
  return fromRows(art.rows, map);
}

const SHAPE_OF: Record<string, EnemyShape> = {
  alley_rat: 'rat',
  porch_pigeon: 'pigeon',
  punk_raccoon: 'raccoon',
  big_earl: 'ratKing',
  vinnie_two_lids: 'raccoonBoss',
  officer_dale: 'officer',
};

interface WorldFoe {
  id: string;
  color: string;
  accent: string;
}

/**
 * Preview sheet: each enemy in the first world it appears in (World 1 for the regulars and Officer Dale,
 * World 2 for Big Earl, World 3 for Vinnie) plus two later worlds, named like "rat_w1".
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
    checkRows(shape, ENEMY_ART[shape].rows);
    const hits = seen.get(shape) ?? [];
    const picks = [hits[0], hits[Math.min(2, hits.length - 1)], hits[Math.min(4, hits.length - 1)]].filter(
      (h, i, all) => h && all.indexOf(h) === i,
    );
    for (const h of picks) out.push({ name: `${shape}_w${h.world}`, buf: recolorEnemy(shape, h.foe.color, h.foe.accent) });
  }
  return out;
}
