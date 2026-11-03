/**
 * The raccoon hero in pixel art, plus everything it can wear. The hero faces right in a 60 x 60
 * frame (drawn at 6x). The tail is its own layer so a backpack can sit between tail and body.
 * Hats, shields, backpacks and weapons reuse the item icons; masks, jackets, shoes, necklaces and
 * gloves have worn versions drawn to fit the body.
 */
import { blank, blit, fromRows, type PixelBuf, type Rows, type SheetEntry } from './buf';
import { ITEM_SPRITES, WEAPON_GRIP } from './items';

export const HERO_SIZE = 60;
/** Landmarks in hero-frame pixels: feet (ground contact), the front paw's grip, the top of the head. */
export const HERO_POINTS = { feet: { x: 30, y: 59 }, hand: { x: 41, y: 44 }, head: { x: 31, y: 17 } } as const;

export const HERO_TAIL: Rows = [
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '.............k..............................................',
  '..........kkk4kkk...........................................',
  '.........k2224444k..........................................',
  '........k222222444k.........................................',
  '.......k44222222443k........................................',
  '......k4444422222233k.......................................',
  '.....k224444422222133k......................................',
  '.....k222444444221111k......................................',
  '.....k222224444441111k......................................',
  '....k4222222444433111xk.....................................',
  '....k4442222224433331xk.....................................',
  '....k4444422222333333xk.....................................',
  '....k44444422211133322k.....................................',
  '....k22444444111113322k.....................................',
  '....k22244443311111x22k.....................................',
  '....k2222243333311xxxxk.....................................',
  '....k4222113333331xxxxk.....................................',
  '.....k3111111333322xxk......................................',
  '.....k33311111132222xk......................................',
  '.....k333311111x22222k......................................',
  '......k3333311xxxx22k.......................................',
  '.......k33332xxxxxxk........................................',
  '........k222222xxxk.........................................',
  '.........kx22222xk..........................................',
  '..........kkk2kkk...........................................',
  '.............k..............................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
];

export const HERO_BODY: Rows = [
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '........................................kk..................',
  '....................kk.................k33k.................',
  '...................k33k.....kk.k.kkk..k3PP3k................',
  '..................k3PP3k.kkk44k3k444kkk3PP3k................',
  '..................k3PP3kk44554444444443kkkk.................',
  '...................kkkkk4554444444444443kk..................',
  '.....................k44544444444444444333k.................',
  '.....................k44444444444444444333k.................',
  '....................k4444444444444444433333k................',
  '...................k4455WWWWWWW444WWWWWW5533k...............',
  '...................k44541kk1114444411kk11533k...............',
  '..................k44441111111111111111111132k..............',
  '..................k4441111ww111111111ww111132k..............',
  '..................k4411111wk111111111wk111122k..............',
  '..................k444xxxxwkxxxxxxxxxwkxxxx22k..............',
  '..................k444xxxxxxxxxx3wxxxxxxxxwwwk..............',
  '..................k44444xxxxxx3wwwwwwxxwwwwwW3kk............',
  '...................k4444433333wwwwwwwwwwwwwWWkkk............',
  '...................k3333333333wwPPwwwwwwwwWWW5k.............',
  '....................k333333333wwwwwwWWWWWWWW55k.............',
  '.....................k33333333wwwWWWWWWWWk55kk..............',
  '.....................k333333333WWWWWWWW555kk................',
  '......................kk33333322WWWW55555k..................',
  '........................k22222222225552kk...................',
  '.......................k4444222222223kk.....................',
  '......................k444444444444433kk....................',
  '.....................k444444444444443444k...................',
  '....................k33324444444444344443k..................',
  '....................k333244444WWWWWW44443k..................',
  '...................k333322444WWWWWWW44433k..................',
  '...................k33322144WWWWWWW4443332k.................',
  '...................k33322144WWWWWWWW44332k..................',
  '...................k2222114WWWWWWWW533332k..................',
  '....................k222144WWWWWWW5533322k..................',
  '....................k211144WWWWWWW555222k...................',
  '....................k444444WWWWW55555542k...................',
  '....................k444433WWWW555555442k...................',
  '....................k3333335W55555554442k...................',
  '.....................k33333355555334442k....................',
  '.....................k33333355533333342k....................',
  '....................k33333333533333322k.....................',
  '....................k33333333233333322k.....................',
  '....................k333322223333332221k....................',
  '....................k333222223333222211k....................',
  '....................k22222211132222221k.....................',
  '....................k22222111k222222111k....................',
  '....................k211111xxkk111111xxk....................',
  '.....................kkxxxxkk..kkxxxxkk.....................',
  '.......................kkkk......kkkk.......................',
];

/** The front paw, drawn over the weapon's grip. */
export const HERO_PAW: Rows = [
  '.kkkk.',
  'k2221k',
  'k211xk',
  'k1xxxk',
  '.kkkk.',
];
/** A puffy glove paw (boxing gloves, mitts). */
const BIG_PAW: Rows = [
  '..kkkk..',
  '.k2222k.',
  'k222211k',
  'k22111xk',
  'k211xxxk',
  '.k1xxxk.',
  '..kkkk..',
];
const BIG_GLOVES = new Set(['gloves_kid_boxing', 'gloves_baseball_mitt', 'gloves_oven_mitts']);

/** Glove colors (dark, mid, light) that replace the paw's x / 1 / 2. */
export const GLOVE_RAMPS: Record<string, [string, string, string]> = {
  gloves_dish: ['o', 'y', 'Y'],
  gloves_gardening: ['G', 'l', 'L'],
  gloves_oven_mitts: ['r', 'R', 'e'],
  gloves_kid_boxing: ['r', 'R', 'e'],
  gloves_lost_mittens: ['u', 'U', 'c'],
  gloves_baseball_mitt: ['n', 'N', 't'],
};

/** Worn overlays in hero-frame pixels (x, y is the top-left corner of the rows). */
export const WORN: Record<string, { x: number; y: number; rows: Rows }> = {
  mask_tube_sock: { x: 19, y: 19, rows: [
    '.kkkkkkkkkkkkkkkkkkkkkkkkk.',
    'k5RRRRRRRRRRRRRRRRRRRRRRR5k',
    'k5UUUUUUUUUUUUUUUUUUUUUUU5k',
    'k5WWWkkkkkkWWWWWkkkkkk5555k',
    'k5WWWk....kWWWWWk....k5555k',
    'k5WWWk....kWWWWWk....k5555k',
    'k5WWWk....kWWWWWk....k5555k',
    'k5WWWkkkkkkWWWWWkkkkkk5555k',
    '.kkkk......kkkkk......kkkk.',
  ] },
  mask_gas_station_shades: { x: 19, y: 21, rows: [
    '....kkkkkkk....kkkkkkk.',
    '.kkk1111111kkkk1111111k',
    'k111xCwxxxx1111xCwxxxxk',
    '.kkkxCxxxxxkkkkxCxxxxxk',
    '...kxxxxxxxk..kxxxxxxxk',
    '...kxxxxxxxk..kxxxxxxxk',
    '....kkkkkkk....kkkkkkk.',
  ] },
  mask_pool_snorkel: { x: 19, y: 7, rows: [
    '..........................kk.',
    '.........................kRrk',
    '.........................kRRk',
    '.........................kyOk',
    '.........................kyOk',
    '.........................kyOk',
    '.........................kyOk',
    '.........................kyOk',
    '.........................kyOk',
    '.........................kyOk',
    '.........................kyOk',
    '.........................kyOk',
    '.........................kyOk',
    '.....kkkkk......kkkkk....kyOk',
    '....kccccck....kccccck...kyOk',
    '.kkkcCwcccckkkkcCwcccckkkkyOk',
    'kUUUcccccccUUUUcccccccUUUkyOk',
    '.kkkcccckcckkkkcccckcckkkkyOk',
    '...kcccckcck..kcccckcck..kyOk',
    '....kccccck....kccccck...kyOk',
    '.....kkkkk......kkkkk....kyOk',
    '.........................kyOk',
    '.......................kkkyOk',
    '......................kOOOOOk',
    '.......................kkkkk.',
  ] },
  mask_peewee_hockey: { x: 22, y: 17, rows: [
    '.......kkkkkkkkkkk.......',
    '.....kkWWWWWRWWWWWkk.....',
    '....kWWWWWWWRWWWWWW5k....',
    '...kWW4WWWWWRWWWWW455k...',
    '..kWWWWWWWWWRWWWWWW555k..',
    '.kWWWWWWWWWWRWWWWWW5555k.',
    'kWWkkkkWWWWWRWkkkkW55555k',
    'kWWk..kWWWWWRWk..kW55555k',
    'kWWkkkkWWWWWRWkkkkW55555k',
    'kWWWWWWWWWWWRWWWWWW55555k',
    'kWWWWWWWWWWWRWWWWWW55555k',
    'kWWWWWWWWWWWRWWWWWW55555k',
    '.kWWWWWWWWWWRWWWWWW5455k.',
    '..kWWWWW4WWWRW4WWWW555k..',
    '...kWWWWWWW4RWWWW4W55k...',
    '....kWWWWWWWRWWWWWW5k....',
    '.....kkWWWWWRWWWWWkk.....',
    '.......kkkkWRWkkkk.......',
    '...........kkk...........',
  ] },
  mask_egg_carton: { x: 21, y: 19, rows: [
    '...kkkkk......kkkkk...',
    '..kTTTTTk....kTTTTTk..',
    '.kTTTTTTTkkkkTTTTTTTk.',
    'kTTTTTTTTTtttTTTTTTTTk',
    'kTTTkkkTTTtttTTkkkTTTk',
    'ktttk.kttttttttk.ktttk',
    'ktttkkkttttttttkkktttk',
    'ktttttttttkktttttttttk',
    '.ktttttttk..ktttttttk.',
    '..ktttttk....ktttttk..',
    '...kkkkk......kkkkk...',
  ] },
  mask_coffee_filter: { x: 21, y: 25, rows: [
    '.kkkkkk......................',
    'k555555kkkkkk..kkkkkkkkkk....',
    '.kkkkkk555555kk5WW5WW5WW5kk..',
    '.......kkkkkkWW5WW5WW5WW5WWk.',
    '............kWW5WW5WW5WW5WWk.',
    '...........k5WW5WW5WW5WW5WW5k',
    '............kWW5WW5WW5WW5WWk.',
    '............kWW5WW5WW5WW5WWk.',
    '.............kk5WW5WW5WW5kk..',
    '...............kkk5WW5kkk....',
    '..................kkkk.......',
  ] },
  jacket_garbage_bag: { x: 19, y: 33, rows: [
    '................kkk....',
    '.....kkkkkkkkkkk211k...',
    '....k1132kkkkkkkkxk....',
    '...k11113211111113xkk..',
    '..k11111132111111x321k.',
    '.kxxxk1111321111x1132xk',
    '.k3xxk111113211111113xk',
    'kxx3xkk1111132111111x3k',
    'kxxxkkk111111321111xxxk',
    'kxxxkkk111111132111xxk.',
    '.kkkkkk2111111132xxxxk.',
    '..kkkk13211111113xxxkk.',
    '..kkkk113211111113kkk..',
    '.k111111132111111132k..',
    '.k2111xx113211111113k..',
    '.k3xxxxx111321111111k..',
    '..k3xxxxx11132xx111k...',
    '..kx3kxxk11kx3kxxk1k...',
    '...kk.kk.kk.kk.kk.k....',
  ] },
  jacket_lawn_chair: { x: 19, y: 33, rows: [
    '......kkkkkkkkkkkkkk....',
    '.....k5GG55GG55GlWWGk...',
    '....kWWll55GG55GGWkk....',
    '...kWllWWllWWllWWllkk...',
    '..kWWllWWllWWllWWllWWk..',
    '.kWll5WllWWllWWllWWllWk.',
    '.kWll5WllWWllWWllWWllWk.',
    'kllWWGGWWllWWllWWllWWlk.',
    'kllW5GGWWllWWllWWllWWlGk',
    'kWWlG55llWWllWWllWWll5k.',
    'k55GG55llWWllWWllWWll5k.',
    '.kG55GlWWllWWllWWllW5Gk.',
    '.kG55GlWWllWWllWWlG55k..',
    '.kWllWWllWWllWWllWWlGk..',
    '.kWllWWllWWllWWllWWlGk..',
    '.klWWllWWllWWllWWllW5k..',
    '..kWWllWWllWWllWWll5k...',
    '..kllWWllWWllWWllWWGk...',
    '...kkkkkkkkkkkkkkkkk....',
  ] },
  jacket_bubble_wrap: { x: 19, y: 33, rows: [
    '......kkkkkkkkkkkkkk....',
    '.....kcccwcccwccwwwck...',
    '....kwwwwccwcccwcCkk....',
    '...kwwwwwwwwwwwwwwCkk...',
    '..kwwwwwwwwwwwwwwCwwwk..',
    '.kCCCwwwwwwwwwwwCwwwwwk.',
    '.kCwCcwwwwwwwwwwwwwwwCk.',
    'kwCCCwcwwwwwwwwwwwwwCwk.',
    'kCCwcccwwwwwwwwwwwwwCCck',
    'kwCCcwcwwwwwwwwwwwwCCwk.',
    'kccwcccwwwwwwwwwwCCwCck.',
    '.kcccwwwwwwwwwwwwwCCcwk.',
    '.kcwccwwwwwwwwwwwwcwck..',
    '.kwwwwwwwwwwwwwwwwwwck..',
    '.kwwwwCwwwwwwwwwwwwwck..',
    '.kCCCwCCwwwwwwwwwwwwck..',
    '..kwCCCwCwwwwwCwwwwwk...',
    '..kCCwCCCwwwCwCCCwwck...',
    '...kkkkkkkkkkkkkkkkk....',
  ] },
  jacket_ugly_sweater: { x: 19, y: 33, rows: [
    '......kkkkkkkkkkkkkk....',
    '.....krrrrrrrrrreeerk...',
    '....keeeerrrrrrrrRkk....',
    '...keeeeeeeeeeeeeRRkk...',
    '..keeWeeeWeeeWeeeWeeek..',
    '.kRRRreeeeeeeeeeReeeeRk.',
    '.kRRRreeeeeeeeeeeeeeeRk.',
    'kGWWG55GWWGWWGWWGWWGWWk.',
    'kWWG55GWWGWWGWWGWWGWWG5k',
    'kWGW5G5WGWWGWWGWWGWWG5k.',
    'krrrrrreeeeeeeeeeRRRRrk.',
    '.krrrreeeeeeeeeeeRRRrrk.',
    '.krrrreeeeeeeeeeeerrrk..',
    '.keeeeeeeeeeeeeeeeeerk..',
    '.keeeeRReeeeeeeeeeeerk..',
    '.kRRRRRReeeeeeeeeeeerk..',
    '..kRRRRRReeeeeRReeerk...',
    '..kRRRRRReeeRRRRRRerk...',
    '...kkkkkkkkkkkkkkkkk....',
  ] },
  jacket_blue_tarp: { x: 19, y: 33, rows: [
    '......kkkkkkkkkkkkkk....',
    '.....kuuuuuuuuuucccuk...',
    '....kccccuuuuuuuuUkk....',
    '...kc4cccccccccccU4kk...',
    '..kccccccccccccccUccck..',
    '.kUUUuccccccccccUccccUk.',
    '.kUUUucccccccccccccccUk.',
    'kUUUUuucccccccccccccUUk.',
    'kUUUuuuccccccccccccUUUuk',
    'kUUUuuuccccccccccccUUuk.',
    'kuuuuuuccccccccccUUUUuk.',
    '.kuuuucccccccccccUUUuuk.',
    '.kuuuuccccccccccccuuuk..',
    '.kccccccccccccccccccuk..',
    '.kccccUUccccccccccccuk..',
    '.kUUUUUUccccccccccccuk..',
    '..kUUUUUUcccccUUcccuk...',
    '..kUUkUUkcckUUkUUkcuk...',
    '...kk.kk.kk.kk.kk.kk....',
  ] },
  jacket_dog_raincoat: { x: 19, y: 33, rows: [
    '......kkkkkkkkkkkkkk....',
    '.....kOOOOOOOOOOYYYOk...',
    '....kYYYYOOOOOOOOykk....',
    '...kYYYYYYYYYYYYYyykk...',
    '..kYYYYYYYYYYYYYYyYYYk..',
    '.kyyyOYYYYYYYYYkyYYYYyk.',
    '.kyyyOYYYYYYYYYYYYYYYyk.',
    'kyyyyOOYYYYYYYYYYYYYyyk.',
    'kyyyOOOYYYYYYYYYYYYyyyOk',
    'kyyyOOOYYYYYYYYkYYYyyOk.',
    'kOOOOOOYYYYYYYYYYyyyyOk.',
    '.kOOOOYYYYYYYYYYYyyyOOk.',
    '.kOOOOYYYYYYYYYYYYOOOk..',
    '.kYYYYYYYYYYYYYkYYYYOk..',
    '.kYYYYyyYYYYYYYYYYYYOk..',
    '.kyyyyyyYYYYYYYYYYYYOk..',
    '..kyyyyyyYYYYYyyYYYOk...',
    '..kyyyyyyYYYyyyyyyYOk...',
    '...kkkkkkkkkkkkkkkkk....',
  ] },
  jacket_unique_hoa_vest: { x: 19, y: 33, rows: [
    '......kkkkkkkkkkkkkk....',
    '.....kooooooooooyyyok...',
    '....kyyyyooooooooOkk....',
    '...kyyyyyyyyyyyyyOOkk...',
    '..kyyyyyyyyyYyyyyOyyyk..',
    '.kOOOoyyyyyyyyyyOyyyyOk.',
    '.kOOOoyyyyyyyyyyyyyyyOk.',
    'kOOOOooyyyyyyyyyyyyyOOk.',
    'kwww555wwwwwwwwwwwwwww5k',
    'kOOOoooyyyyyyyyyyyyOOok.',
    'kooooooyyyyyyyyyyOOOOok.',
    '.kooooyyyyyyyyyyyOOOook.',
    '.kooooyyyyyyyyyyyyoook..',
    '.kwwwwwwwwwwwwwwwwww5k..',
    '.kyyyyOOyyyyyyyyyyyyok..',
    '.kOOOOOOyyyyyyyyyyyyok..',
    '..kOOOOOOyyyyyOOyyyok...',
    '..kOOOOOOyyyOOOOOOyok...',
    '...kkkkkkkkkkkkkkkkk....',
  ] },
  sneakers_crocs: { x: 20, y: 54, rows: [
    '.kkkkkkkkkkkkkkkkk..',
    'kGGGGGGGGGlGGGGGGGk.',
    'kGGGGGGGGkGGGGGGGGGk',
    'kGGGGGGGGkkGGGGGGGGk',
    '.kkGGGGkk..kkGGGGkk.',
    '...kkkk......kkkk...',
  ] },
  sneakers_flip_flops: { x: 20, y: 55, rows: [
    '....k.........k.....',
    '...kRk.......kRk....',
    '...kkRk......kkRk...',
    '.kkxxxxkk..kkxxxxkk.',
    'kttttttttkkttttttttk',
  ] },
  sneakers_roller_skates: { x: 20, y: 54, rows: [
    '.kkkkkkkkkkkkkkkkk...',
    'k44444444454444444k..',
    'k44444444k444444444k.',
    'k44444444kk44444444k.',
    '.kk4444kkk.kk4444kkk.',
    'k13k13kk13k13k13kk13k',
  ] },
  sneakers_bunny_slippers: { x: 20, y: 52, rows: [
    '.......k.k.......k.k.',
    '......kWkWk.....kWkWk',
    '.kkkkkkWPWkkkkkkkWPWk',
    'k555555555W5555555kk.',
    'k5555555kk555555555k.',
    'k55555555kk55555555k.',
    '.kk5555kk..kk5555kk..',
    '...kkkk......kkkk....',
  ] },
  sneakers_rain_boots: { x: 20, y: 49, rows: [
    '..kkkkkkkkkkkkkkkkk.',
    '.kyyyyyyYYYyyyyyyYOk',
    'kyyyyyyyyYyyyyyyOOk.',
    'kyyyyyyyyOyyyyyyOOk.',
    'kyyyyOOOOyyyyyyOOOOk',
    'kyyyOOOOOyyyyOOOOOOk',
    'kOOOOOOOOOyOOOOOOOk.',
    'kOOOOOOOOkOOOOOOOOOk',
    'kOOOOOOOOkkOOOOOOOOk',
    '.kkOOOOkk..kkOOOOkk.',
    '...kkkk......kkkk...',
  ] },
  sneakers_light_up: { x: 20, y: 54, rows: [
    '.kkkkkkkkkkkkkkkkk..',
    'k44444444454444444k.',
    'k44444444k444444444k',
    'k44444444kk44444444k',
    '.kR4c4Rkk..kkR4c4Rk.',
    '..kkkkk......kkkkk..',
  ] },
  bling_bottle_cap_chain: { x: 26, y: 33, rows: [
    '.k..........k.',
    'k4k........k3k',
    '.k3kk....kk4k.',
    '..k43kkkk43k..',
    '...kk4343kk...',
    '.....kRRRk....',
    '.....kRyRk....',
    '.....kRRRk....',
    '......kkk.....',
  ] },
  bling_lost_house_key: { x: 26, y: 33, rows: [
    '.k..........k.',
    'kyk........kOk',
    '.kOkk....kkyk.',
    '..kyOkkkkyOk..',
    '...kkyOyOkk...',
    '.....kyyk.....',
    '.....kyYk.....',
    '......kyk.....',
    '......kyyk....',
    '......kyk.....',
    '.......k......',
  ] },
  bling_dog_tag: { x: 26, y: 33, rows: [
    '.k..........k.',
    'k4k........k5k',
    '.k5kk....kk4k.',
    '..k45kkkk45k..',
    '...kk4545kk...',
    '.....k555k....',
    '.....k545k....',
    '.....k555k....',
    '.....k444k....',
    '......kkk.....',
  ] },
  bling_wind_chime: { x: 26, y: 33, rows: [
    '.k..........k.',
    'k4k........k3k',
    '.k3kk....kk4k.',
    '..k43kkkk43k..',
    '...kk4343kk...',
    '....k5k5k5k...',
    '....k5k5k5k...',
    '....k5k4k5k...',
    '....k4kkk4k...',
    '.....k...k....',
  ] },
  bling_xmas_ornament: { x: 26, y: 33, rows: [
    '.k..........k.',
    'kyk........kOk',
    '.kOkk....kkyk.',
    '..kyOkkkkyOk..',
    '...kkyOyOkk...',
    '.....kkyk.....',
    '.....kRRRk....',
    '.....kRwRk....',
    '.....kRRRk....',
    '......kRk.....',
    '.......k......',
  ] },
  bling_soda_tab_bracelet: { x: 37, y: 43, rows: [
    '.k..k.',
    'k5kk4k',
    'k445k.',
    '.kkk..',
  ] },
  gloves_dish: { x: 19, y: 43, rows: [
    '..kkk..',
    '.kYYyk.',
    'kYYyyok',
    'kYyyook',
    '.kyook.',
    '..kkk..',
  ] },
  gloves_gardening: { x: 19, y: 43, rows: [
    '..kkk..',
    '.kLLlk.',
    'kLLllGk',
    'kLllGGk',
    '.klGGk.',
    '..kkk..',
  ] },
  gloves_oven_mitts: { x: 18, y: 42, rows: [
    '...kkk...',
    '..keeek..',
    '.keeeRRk.',
    'keeeRRRrk',
    'keeRRRrrk',
    '.kRRRrrk.',
    '..kRrrk..',
    '...kkk...',
  ] },
  gloves_kid_boxing: { x: 18, y: 42, rows: [
    '...kkk...',
    '..keeek..',
    '.keeeRRk.',
    'keeeRRRrk',
    'keeRRRrrk',
    '.kRRRrrk.',
    '..kRrrk..',
    '...kkk...',
  ] },
  gloves_lost_mittens: { x: 19, y: 43, rows: [
    '..kkk..',
    '.kccUk.',
    'kccUUuk',
    'kcUUuuk',
    '.kUuuk.',
    '..kkk..',
  ] },
  gloves_baseball_mitt: { x: 18, y: 42, rows: [
    '...kkk...',
    '..ktttk..',
    '.ktttNNk.',
    'ktttNNNnk',
    'kttNNNnnk',
    '.kNNNnnk.',
    '..kNnnk..',
    '...kkk...',
  ] },
};

export type GearSlot = 'hat' | 'mask' | 'jacket' | 'shield' | 'gloves' | 'sneakers' | 'backpack' | 'bling' | 'ring';

/** The front paw, in glove colors when gloves are worn. */
export function pawBuf(glovesId: string | null): PixelBuf {
  const ramp = glovesId ? GLOVE_RAMPS[glovesId] : undefined;
  if (!ramp) return fromRows(HERO_PAW);
  return fromRows(BIG_GLOVES.has(glovesId!) ? BIG_PAW : HERO_PAW, { x: ramp[0], '1': ramp[1], '2': ramp[2] });
}

function lowestRow(rows: Rows): number {
  for (let y = rows.length - 1; y >= 0; y--) if (/[^.]/.test(rows[y])) return y;
  return rows.length - 1;
}

/** One worn item in the hero frame (60 x 60), or null if it has no worn look (rings). */
export function gearBuf(slot: GearSlot, baseId: string): PixelBuf | null {
  const out = blank(HERO_SIZE, HERO_SIZE);
  const icon = ITEM_SPRITES[baseId];
  if (slot === 'hat' && icon) {
    // Sits on the head: the icon's bottom row lands just below the top of the head.
    blit(out, fromRows(icon), HERO_POINTS.head.x - 8, HERO_POINTS.head.y + 1 - lowestRow(icon));
    return out;
  }
  if (slot === 'shield' && icon) {
    blit(out, fromRows(icon), 9, 33);
    return out;
  }
  if (slot === 'backpack' && icon) {
    blit(out, fromRows(icon), 9, 26);
    return out;
  }
  const worn = WORN[baseId];
  if (!worn) return null;
  blit(out, fromRows(worn.rows), worn.x, worn.y);
  return out;
}

/** A weapon's art and grip (it points up and to the right; the scene turns it to point straight up). */
export function weaponBuf(baseId: string): { buf: PixelBuf; grip: { x: number; y: number } } | null {
  const icon = ITEM_SPRITES[baseId];
  if (!icon) return null;
  return { buf: fromRows(icon), grip: WEAPON_GRIP[baseId] ?? { x: 3, y: 12 } };
}

/** The whole hero with gear, for previews. */
export function dressed(gear: Partial<Record<GearSlot | 'weapon', string>>): PixelBuf {
  const out = blank(HERO_SIZE, HERO_SIZE);
  blit(out, fromRows(HERO_TAIL), 0, 0);
  if (gear.backpack) {
    const b = gearBuf('backpack', gear.backpack);
    if (b) blit(out, b, 0, 0);
  }
  blit(out, fromRows(HERO_BODY), 0, 0);
  for (const slot of ['sneakers', 'jacket', 'bling', 'shield', 'gloves', 'mask', 'hat'] as const) {
    const id = gear[slot];
    const b = id ? gearBuf(slot, id) : null;
    if (b) blit(out, b, 0, 0);
  }
  if (gear.weapon) {
    const w = weaponBuf(gear.weapon);
    if (w) blit(out, w.buf, HERO_POINTS.hand.x - w.grip.x, HERO_POINTS.hand.y - w.grip.y);
  }
  const paw = pawBuf(gear.gloves ?? null);
  blit(out, paw, HERO_POINTS.hand.x - Math.floor(paw.w / 2), HERO_POINTS.hand.y - Math.floor(paw.h / 2));
  return out;
}

export function sheet(): SheetEntry[] {
  return [
    { name: 'bare', buf: dressed({}) },
    { name: 'starter', buf: dressed({ hat: 'hat_traffic_cone', weapon: 'weapon_broken_rake', sneakers: 'sneakers_crocs' }) },
    {
      name: 'geared',
      buf: dressed({
        hat: 'hat_bike_helmet', mask: 'mask_gas_station_shades', jacket: 'jacket_bubble_wrap', weapon: 'weapon_wiffle_bat',
        shield: 'shield_trash_lid', gloves: 'gloves_dish', sneakers: 'sneakers_light_up', backpack: 'backpack_fanny_pack', bling: 'bling_dog_tag',
      }),
    },
    {
      name: 'legend',
      buf: dressed({
        hat: 'hat_lawn_gnome', mask: 'mask_pool_snorkel', jacket: 'jacket_unique_hoa_vest', weapon: 'weapon_unique_leaf_blower',
        shield: 'shield_unique_mailbox', gloves: 'gloves_kid_boxing', sneakers: 'sneakers_bunny_slippers', backpack: 'backpack_picnic_cooler',
        bling: 'bling_lost_house_key',
      }),
    },
  ];
}
