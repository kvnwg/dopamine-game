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

/** Alley Rat: hunched, big ear, angry eye, buck teeth, scruffy back, long curling tail. 26x18. */
const ROWS_RAT: Rows = [
  '..........kkkk............',
  '.........k4443k...........',
  '........k44qq32k.k.k......',
  '......kkk4qPPP2kk4k4k.....',
  '....kk4424qPPW3x44443k....',
  '...k443323qPPW2x443332k...',
  '..k443xx323PP2x3333332k...',
  '.k43xxw333222333333332k...',
  'kWP3kww333332333333332k...',
  'kPq3333333332333322232k...',
  '.kwwx33333332333244332k.k.',
  '..kw2xx33333233243332k.kPk',
  '...kk222222233324322k..kPk',
  '.....k3322233332332kkkkPk.',
  '.....k322x222222332qPPPk..',
  '....kWPPqkkkkkWPPqkkkkk...',
  '...kPPPPqk..kPPPPPqk......',
  '....kkkkk....kkkkkk.......',
];

/** Porch Pigeon: puffed chest, orange glaring eye, iridescent neck, barred wing. 18x20. */
const ROWS_PIGEON: Rows = [
  '.....kkk..........',
  '....k443k.........',
  '..kk4xx32k........',
  '.kW4xOO332k.......',
  'kx133kO332k.......',
  '.kk3333322k.......',
  '..kAaaag332k......',
  '.kAaaagg4432k.....',
  '.kaaag2444432k....',
  'k4444323333332k...',
  'k443324333x3x22k..',
  'k4333233333x3x2k..',
  'k33333233333x3x2k.',
  '.k33332233333x2xxk',
  '.k3332222222223xxk',
  '..k3322222222kxxk.',
  '...k22222222k.kk..',
  '....kkekkekk......',
  '....keRkeRk.......',
  '.....kk.kk........',
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

/** Big Earl: fat rat king with a bottle-cap crown, scar over one eye, toothpick, crossed arms, cape. 40x44. */
const ROWS_RAT_KING: Rows = [
  '................k.k.kk..................',
  '...........kkkkkYkykyOkkkkkk............',
  '..........kYYYYYYyyyyOk44444k...........',
  '.....kkkkkkYyRyyyyyyyOx222332k..........',
  '....k42244kYReeyyyyyyOxwwww33k..........',
  '...k422ww3xOOrOOOOOOOOxwPPPP32k.........',
  '...k42wwPP3xxxxxxxxxxxwPPPPP42k.........',
  '...k42wPPP422333333324wPPPPP22k.........',
  '...k42wPPP22233333P3243PPPP42k..........',
  '....kxxPP22243333xP33233PP222k..........',
  '....k22xx22433xxxP333322222kk...........',
  '....k22kw24333kkwP333332222k............',
  '...k4432333333kkxPx333333332k...........',
  '.kk4433333333322P23333333332k...........',
  'kPP433333333333xPx3333333322kkkk........',
  'kqP3333333333333333333333322mmmmkk......',
  '.kk3333333333333333333333222VVVVVvk.....',
  '.k4xxxxxxxxtTTt333333333222mVVVVVvk.....',
  '..k2ww22333333333333333222mVVVVVVvk.....',
  '...kkkkkk23333333333322222VVVVVVVVk.....',
  '.........kk223333322222xxxxxVVVVVVvk....',
  '........kx222222222xxxx44444xVVVVVvk....',
  '.......kx4xxxx2xxxx4444433332xVVVVvk....',
  '......k44432xxx44444333333332xmVVVvk....',
  '......k432xx44443333333333322x2VVVvk....',
  '......k42x444333333333333222x42mVVvk....',
  '.....kx2x44333333333322222xx4322VVVk....',
  '.....k2xx4333333322222xxxx433322mVVvk...',
  '.....k2wx433332222xxxx42x3333322mVVvk...',
  '.....k2wWx22222xxx223222x3333322mVVvk...',
  '.....k2wWWxxxxxwWxxxx2xx43333322mVVvk...',
  '.....k2wWWWWWWWWWWWWWxwT43333222mVVvkk..',
  '.....k2wWWWWWWWWWWWWWWWT43333222mVVvwqk.',
  '......kwWWWWWWWWWWWWWWTT4333222mmVVVwPk.',
  '......k2WWWWWWWWWWWWWWT44333222mVVVVvPqk',
  '.......kwWWWWWWWWWWWWTT4333222mmVVVVvwqk',
  '.......k2WWWWWWWWWWWTT44322222mVVVVVvwqk',
  '........k2WWWWWWWWWTT44322222mmVVVVVvqqk',
  '.........kkTWWWWWTTT4222222mmmVVVVVVvqk.',
  '........kkww2TTTTT22222222mmVVVVVVVVvqk.',
  '.......kwwwPPww22222222wwwwvvvvvvvvvvk..',
  '......kwwPPPPPqqkkkwwwwwPPqqkkkkqqqkk...',
  '.......kqqqqqqqk...kqqqqqqqk....kkk.....',
  '........kkkkkkk.....kkkkkkk.............',
];

/** Vinnie "Two Lids": mob-boss raccoon in a fedora with two trash-can lids and a gold chain. 40x46. */
const ROWS_RACCOON_BOSS: Rows = [
  '..........kkkkkkkkkkkkkkkk..............',
  '.........keeeeeeeeeeeeeeerk.............',
  '.........keRRRRRRRRRRRRRRrkk............',
  '.......kkkrrrrrrrrrrrrrrrrkmkk..........',
  '......kmmvxxxxxxxxxxxxxxxxmmVmk.........',
  '.....kvxxxxxxxxxxxxxxxxxxxxxxVvk........',
  '....kxxeeeeeeeeeeeeeeeeeeeeeexxk........',
  '....krreRRRRRRRRRRRRRRRRRRRrrrrk........',
  '....kxxxrrrrrrrrrrrrrrrrrrrrxxxkk.......',
  '.....kVVxxxxxxxxxxxxxxxxxxxxvv555k......',
  '......kvxmmVVVVVVVVVVVVVVVVV525444k.....',
  '......kkvvvvvvvvvvvvvvvvvvVVV2w2444k....',
  '.....k111xx11111xx11111111xVVvw4w442k...',
  '.....k11kww111111kwww11111xmVvw44344k...',
  '.....k11kkw1xxxxxkkww11111xmVvw443542k..',
  '.....kxxxxxxxmmmmmmmmxxxxxxmVvw444542k..',
  '...kkwwwwwwwmmVVVVVVVVmmmmmmVvw443342k..',
  '..kxxwWWWWWWWVVVVVVVVVVVVVVvxvx443552k..',
  '.kwxWWWWWWWWW5VVVVVVVVVVVVvx1xxv43522k..',
  '.kwWWWWWWWWWW5mVVVVVVVVVVvx111xv3352k...',
  '.kwWxxxxxxWWW5mVVVVVVVVVVx111xxx3522k...',
  '..kWWWyWWWWW55mVVVVVVVVVvvx1xxx5522k....',
  '...k5W55WW555mmVVVVVVVvvvxxxxx5522k.....',
  '....kk55555kkxvvvvvvxvvxxvvVxv222k......',
  '....k555445YvmxxxxxxmxxvVVYOvkkkkkk.....',
  '...k55224444yvvvxxmmmVvxVOOOk..kmmmk....',
  '..k5222ww2444OxxmmmVVVvxOOmmvkkmmVVVk...',
  '.k552www443442mmmVVVVVvxOmmVvkmmVVVVvk..',
  '.k522w444442x2mVVVVVvvvxmmVVvvmVVVVVVk..',
  '.k52ww44443x1xmVVVVvvxxwVVVVvvmVVVVVVvk.',
  '.k52w44443x111xVVvvvxwWW5VVVVvmVVVVVVvk.',
  'k552w4444x111xxxvvxxwWWW5mVVvvmVVVVVVvk.',
  'k542w44444x1xxxvxxwWWWWW5mVVvvvVVVVVVvk.',
  '.k42w444444xxxwxwWWWWWWW5mVVvvmmVVVVVvk.',
  '.k54w4444433x2wWWWWWWWWW5mVVvvmVVVVVVvk.',
  '.k542444443552wWWWWWWWWW5mVvvvmVVVVVVvk.',
  '.k544344333522wWWWWWWWWW5mVvvvmVVVVVVvk.',
  '..k4445335522wwWWWWWWWW55mvvvmmVVVVVvvk.',
  '...k44445522mwWWWWWWWW55mvvvvkVVVVVVvk..',
  '....k244222mmVWWWWWWW55mvvvvkkmVVVVvvk..',
  '.....kk22kkkvVV5WWW555vvvvvk..kVVVvvk...',
  '.......kk.kkkvvvv555vvvvvvkk...kvvvk....',
  '.........k11111vvvvvvvvv1111k...kkk.....',
  '........k1111111xxkv1111111xxk..........',
  '.........kxxxxxxxk.kkxxxxxxxk...........',
  '..........kkkkkkk....kkkkkkk............',
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
  rat: { rows: ROWS_RAT, feet: { x: 11, y: 17 }, body: ['2', '3', '4'], accent: ['q', 'P', 'W'] },
  pigeon: { rows: ROWS_PIGEON, feet: { x: 7, y: 19 }, body: ['2', '3', '4'], accent: ['g', 'a', 'A'] },
  raccoon: { rows: ROWS_RACCOON, feet: { x: 11, y: 31 }, body: ['2', '3', '4'], accent: ['r', 'R', 'e'] },
  ratKing: { rows: ROWS_RAT_KING, feet: { x: 17, y: 43 }, body: ['2', '3', '4'], accent: ['v', 'V', 'm'] },
  raccoonBoss: { rows: ROWS_RACCOON_BOSS, feet: { x: 18, y: 45 }, body: ['v', 'V', 'm'], accent: ['r', 'R', 'e'] },
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
