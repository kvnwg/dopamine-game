/**
 * The raccoon hero in pixel art, plus everything it can wear. A chunky chibi raccoon (flat
 * colors, bold outline, big shiny eyes in the mask, cream snout, blush), facing right in a
 * 40 x 40 frame drawn at 6x. The tail is its own layer so a backpack can sit between tail and
 * body. Hats, shields, backpacks and weapons reuse the item icons; masks, jackets, shoes,
 * necklaces and gloves have worn versions drawn to fit the body.
 */
import { blank, blit, fromRows, type PixelBuf, type Rows, type SheetEntry } from './buf';
import { ITEM_SPRITES, WEAPON_GRIP } from './items';

/** The raccoon is drawn in a 40 x 40 grid (HERO_BODY, HERO_TAIL, WORN); frames add headroom on top for tall hats. */
export const HERO_SIZE = 40;
export const HEADROOM = 16;
export const HERO_W = HERO_SIZE;
export const HERO_H = HERO_SIZE + HEADROOM;
/** Landmarks in frame pixels (headroom included): feet (ground contact), the front paw's grip, the top of the head. */
export const HERO_POINTS = { feet: { x: 20, y: 35 + HEADROOM }, hand: { x: 32, y: 24 + HEADROOM }, head: { x: 20, y: 6 + HEADROOM } } as const;

export const HERO_TAIL: Rows = [
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '.......kkkk.............................',
  '.....kk3444k............................',
  '....k3x14441k...........................',
  '...k3xx111441k..........................',
  '..k344xx1144xk..........................',
  '..k34444xx41xk..........................',
  '.k3x1144444xxk..........................',
  '.k3xx1111444xk..........................',
  '.k34xxx11144k...........................',
  '.k3444xxx114k...........................',
  '..k3444444x4k...........................',
  '..k3x1114444k...........................',
  '...kxxx11144k...........................',
  '....k3444444k...........................',
  '.....kk3344k............................',
  '.......kkkk.............................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
];

export const HERO_BODY: Rows = [
  '........................................',
  '........................................',
  '..........kk................kk..........',
  '.........k33k..............k33k.........',
  '........k3xx3k............k3xx3k........',
  '........k3xx3kkkkkkkkkkkkkk3xx3k........',
  '........k4334444444444444444334k........',
  '.........k44554444442244444444k.........',
  '........k4454444444422444444444k........',
  '........k4544444444422444444444k........',
  '.......k44444WWWWWW4224WWWWW4443k.......',
  '.......k4444WWWWWWW4444WWWWWW443k.......',
  '.......k442222kwwk222222kwwk2243k.......',
  '.......k422222kwkk222222kwkk2223k.......',
  '.......k422222kkkk222222kkkk2223k.......',
  '.......k411111kkkk1Wk2kWkkkk1113k.......',
  '.......k4444111111WWWkWWW1111143k.......',
  '.......k444PP4444WWWWWWWWW44PP43k.......',
  '........k44444444WWkWWWkWW44444k........',
  '........k444444444WWkkkWW444444k........',
  '.........k44444444455555444444k.........',
  '..........k444444444444444333kk.........',
  '.........kk44444444444444444444k........',
  '........k44444444455555444444444k.......',
  '.......k444444445555555554444443k.......',
  '.......k444444445555555554444433k.......',
  '.......k44444445555555555544443k........',
  '........k444444555555555554433k.........',
  '.........k44444555555555554433k.........',
  '.........k44444555555555554433k.........',
  '..........k444445555555554443k..........',
  '..........k444445555555554333k..........',
  '..........k144444455555444331k..........',
  '..........k111444444444444111k..........',
  '...........k11111kkkkkk11111k...........',
  '............kkkkk......kkkkk............',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
];

/** The front paw, drawn over the weapon's grip. */
export const HERO_PAW: Rows = [
  '.kkk.',
  'k221k',
  'k21xk',
  '.kkk.',
];
/** A puffy glove paw (boxing gloves, mitts). */
const BIG_PAW: Rows = [
  '.kkkk.',
  'k2222k',
  'k2211k',
  'k211xk',
  '.kkkk.',
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

/** Worn overlays in the 40 x 40 grid (x, y is the top-left corner of the rows; frames add HEADROOM). */
export const WORN: Record<string, { x: number; y: number; rows: Rows }> = {
  mask_tube_sock: { x: 7, y: 8, rows: [
    '.kkkkkkkkkkkkkkkkkkkkkkkk.',
    'kRRRRRRRRRRRRRRRRRRRRRRRRk',
    'kUUUUUUUUUUUUUUUUUUUUUUUUk',
    'kWWWWWkkkkkkWWWWkkkkkk555k',
    'kWWWWWk....kWWWWk....k555k',
    'kWWWWWk....kWWWWk....k555k',
    'kWWWWWk....kWWWWk....k555k',
    'kWWWWWk....kWWWWk....k555k',
    'kWWWWWkkkkkkWWWWkkkkkk555k',
    '.kkkkk......kkkk......kkk.',
  ] },
  mask_gas_station_shades: { x: 8, y: 11, rows: [
    '.....kkkkkk....kkkkkk....',
    '.kkkk111111kkkk111111kkk.',
    'k1111xCwxxx1111xCwxxx111k',
    '.kkkkxCxxxxkkkkxCxxxxkkk.',
    '....kxxxxxxk..kxxxxxxk...',
    '.....kkkkkk....kkkkkk....',
  ] },
  mask_pool_snorkel: { x: 7, y: 0, rows: [
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
    '.......kkkk......kkkk....kyOk',
    '......kcccck....kcccck...kyOk',
    '.kkkkkcCwccckkkkcCwccckkkkyOk',
    'kUUUUUcckkccUUUUcckkccUUUkyOk',
    '.kkkkkcckkkckkkkcckkkckkkkyOk',
    '.....kcccccck..kcccccck..kyOk',
    '......kkcckk....kkcckk...kyOk',
    '........kk........kk.....kyOk',
    '...................kkkkkkkyOk',
    '..................kOOOOOOOOOk',
    '...................kkkkkkkkk.',
  ] },
  mask_peewee_hockey: { x: 9, y: 7, rows: [
    '......kkkkkkkkkkk......',
    '....kkWWWWWRWWWWWkk....',
    '...kWWWWWWWRWWWWWW5k...',
    '..kWWWWWWWWRWWWWWW55k..',
    '.kWWWWWWWWWRWWWWWW555k.',
    'kWWWWkkkkWWRWWWkkkk555k',
    'kWWWWk..kWWRWWWk..k555k',
    'kWWWWk..kWWRWWWk..k555k',
    'kWWWWkkkkWWRWWWkkkk555k',
    'kWWWWWWWWWWRWWWWWW5555k',
    '.kWW4WWWWWWRWWWWWW455k.',
    '.kWWWWWW4WWRWW4WWW555k.',
    '..kWWWWWWWW4WWWWWW55k..',
    '...kWWWWWWWRWWWWWW5k...',
    '....kkWWWWWRWWWWWkk....',
    '......kkkkkkkkkkk......',
  ] },
  mask_egg_carton: { x: 11, y: 9, rows: [
    '..kkkkkk....kkkkkk..',
    '.kTTTTTTkkkkTTTTTTk.',
    'kTTTTTTTttttTTTTTTTk',
    'kTTkkkkTttttTkkkkTTk',
    'kTTk..kTttttTk..kTTk',
    'kttk..kttttttk..kttk',
    'kttkkkkttkkttkkkkttk',
    '.kttttttk..kttttttk.',
    '..kkttkk....kkttkk..',
    '....kk........kk....',
  ] },
  mask_coffee_filter: { x: 8, y: 14, rows: [
    '.........kkkkkkkkk.......',
    '.kkkkkk.kW5WW5WW5Wk.kkkk.',
    'k555555kWW5WW5WW5WWk5555k',
    '.kkkkkk5WW5WW5WW5WW5kkkk.',
    '......k5WW5WW5WW5WW5k....',
    '......k5WW5WW5WW5WW5k....',
    '.......kWW5WW5WW5WWk.....',
    '........kW5WW5WW5Wk......',
    '.........kkkk5kkkk.......',
    '.............k...........',
  ] },
  jacket_garbage_bag: { x: 7, y: 21, rows: [
    '....kkkkkkkkkkkkkkkkkkkk..',
    '..kk11113111111311111131k.',
    '.k31111113111111311111131k',
    'k113111111311111131111113k',
    'k1113111111311111131111xxk',
    'k1111311111131111113111xk.',
    '.k1111311111131111113xxk..',
    '..k1111311111131111113xk..',
    '..k111113111111311111x3k..',
    '...k11111311111131111xk...',
    '...k1k11k13k11k11k1xkxk...',
    '....k.kk.kk.kk.kk.kk.k....',
  ] },
  jacket_lawn_chair: { x: 7, y: 21, rows: [
    '....kkkkkkkkkkkkkkkkkkkk..',
    '..kklWWllWWllWWllWWllWWlk.',
    '.kWllWWllWWllWWllWWllWWllk',
    'kllWWllWWllWWllWWllWWllWWk',
    'kllWWllWWllWWllWWllWWllWWk',
    'kWWllWWllWWllWWllWWllWWlk.',
    '.kWllWWllWWllWWllWWllWWk..',
    '..kWWllWWllWWllWWllWWllk..',
    '..kWWllWWllWWllWWllWWllk..',
    '...klWWllWWllWWllWWllWk...',
    '...klWWllWWllWWllWWllWk...',
    '....kkkkkkkkkkkkkkkkkk....',
  ] },
  jacket_bubble_wrap: { x: 7, y: 21, rows: [
    '....kkkkkkkkkkkkkkkkkkkk..',
    '..kkwwwwwwwwwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwwwwwwwwwwwwk',
    'kwwwwwwwwwwwwwwwwwwwwwwwCk',
    'kwwwwwwwwwwwwwwwwwwwwwwwCk',
    'kwwwwwwwwwwwwwwwwwwwwwwCk.',
    '.kwwwwwwwwwwwwwwwwwwwCCk..',
    '..kwwwwwwwwwwwwwwwwwwwCk..',
    '..kwwwwwwwwwwwwwwwwwwCCk..',
    '...kwwwwwwwwwwwwwwwwwwk...',
    '...kwwwwwwwwwwwwwwwwCCk...',
    '....kkkkkkkkkkkkkkkkkk....',
  ] },
  jacket_ugly_sweater: { x: 7, y: 21, rows: [
    '....kkkkkkkkkkkkkkkkkkkk..',
    '..kkeeeeeeeeeeeeeeeeeeeek.',
    '.keeeWeeeWeeeWeeeWeeeWeeek',
    'keeeeeeeeeeeeeeeeeeeeeeeRk',
    'keeeeeeeeeeeeeeeeeeeeeeRRk',
    'kWWGWWGWWGWWGWWGWWGWWGWWk.',
    '.kGWWGWWGWWGWWGWWGWWGWWk..',
    '..keeeeeeeeeeeeeeeeeeRRk..',
    '..keeeeeeeeeeeeeeeeeeRRk..',
    '...keeeeeeeeeeeeeeeeeRk...',
    '...keeeeeeeeeeeeeeeRRRk...',
    '....kkkkkkkkkkkkkkkkkk....',
  ] },
  jacket_blue_tarp: { x: 7, y: 21, rows: [
    '....kkkkkkkkkkkkkkkkkkkk..',
    '..kkcccccccccccccccccccck.',
    '.kccc4cccccccccccccc4cccck',
    'kcccccccccccccccccccccccUk',
    'kccccccccccccccccccccccUUk',
    'kccccccccccccccccccccccUk.',
    '.kcccccccccccccccccccUUk..',
    '..kccccccccccccccccccUUk..',
    '..kccccccccccccccccccUUk..',
    '...kcccccccccccccccccUk...',
    '...kckcckcckcckcckcUkUk...',
    '....k.kk.kk.kk.kk.kk.k....',
  ] },
  jacket_dog_raincoat: { x: 7, y: 21, rows: [
    '....kkkkkkkkkkkkkkkkkkkk..',
    '..kkYYYYYYYYYYYYYYYYYYYYk.',
    '.kYYYYYYYYYYYYYYYYYYYYYYYk',
    'kYYYYYYYYYYYYkYYYYYYYYYYyk',
    'kYYYYYYYYYYYYYYYYYYYYYYyyk',
    'kYYYYYYYYYYYYYYYYYYYYYYyk.',
    '.kYYYYYYYYYYYkYYYYYYYyyk..',
    '..kYYYYYYYYYYYYYYYYYYyyk..',
    '..kYYYYYYYYYYYYYYYYYYyyk..',
    '...kYYYYYYYYYkYYYYYYYyk...',
    '...kYYYYYYYYYYYYYYYyyyk...',
    '....kkkkkkkkkkkkkkkkkk....',
  ] },
  jacket_unique_hoa_vest: { x: 7, y: 21, rows: [
    '....kkkkkkkkkkkkkkkkkkkk..',
    '..kkyyyyyyyyyyyyyyyyyyyyk.',
    '.kyyyyyyyYyyyyyyyyyyyyyyyk',
    'kyyyyyyyyyyyyyyyyyyyyyyyOk',
    'kyyyyyyyyyyyyyyyyyyyyyyOOk',
    'kwwwwwwwwwwwwwwwwwwwwwwwk.',
    '.kyyyyyyyyyyyyyyyyyyyOOk..',
    '..kyyyyyyyyyyyyyyyyyyOOk..',
    '..kwwwwwwwwwwwwwwwwwwwwk..',
    '...kyyyyyyyyyyyyyyyyyOk...',
    '...kyyyyyyyyyyyyyyyOOOk...',
    '....kkkkkkkkkkkkkkkkkk....',
  ] },
  sneakers_crocs: { x: 10, y: 30, rows: [
    '.kkkkkkkkkkkkkkkkkk.',
    'kLLLLLLLLLLLLLLLlllk',
    'kGLGLGLLLLLLLLGLGlGk',
    'kGGGLLLLLLLLLLLLGGGk',
    '.kGGGGGkkkkkkGGGGGk.',
    '..kkkkk......kkkkk..',
  ] },
  sneakers_flip_flops: { x: 11, y: 32, rows: [
    '...k..........k...',
    '.kkRkk......kkRkk.',
    'kxxxRxk....kxxxRxk',
    'ktttttk....ktttttk',
    '.kkkkk......kkkkk.',
  ] },
  sneakers_roller_skates: { x: 10, y: 30, rows: [
    '.kkkkkkkkkkkkkkkkkk.',
    'kwwwwwwwwwwwwwww555k',
    'k4wwwwwwwwwwwwww554k',
    'k444wwwwwwwwwwww444k',
    '.k44444kkkkkk44444k.',
    '..kkkkkk.....kkkkkk.',
    '.k13kk13k...k13kk13k',
    '..kk..kk.....kk..kk.',
  ] },
  sneakers_bunny_slippers: { x: 10, y: 28, rows: [
    '...k.k........k.k...',
    '..kWkWk......kWkWk..',
    '.kkWPWkkkkkkkkWPWkk.',
    'kwwwwwwwwwwwwwwwWWWk',
    'k5wwwkwwwwwwwwwwkW5k',
    'k555wwwwwwwwwwww555k',
    '.k55555kkkkkk55555k.',
    '..kkkkk......kkkkk..',
  ] },
  sneakers_rain_boots: { x: 9, y: 27, rows: [
    '.kkkkkkkkkkkkkkkkkkkk.',
    'kYYYYYYYYYYYYYYYYYYyyk',
    'kYYYYYYYYYYYYYYYYYYyyk',
    '.kYYYYYYYYYYYYYYYYYyk.',
    '.kYYYYYYYYYYYYYYYyyyk.',
    '.kOYYYYYYYYYYYYYYyyOk.',
    '.kOOOYYYYYYYYYYYYOOOk.',
    '..kOOOOOkkkkkkOOOOOk..',
    '...kkkkk......kkkkk...',
  ] },
  sneakers_light_up: { x: 10, y: 30, rows: [
    '.kkkkkkkkkkkkkkkkkk.',
    'kwwwwwwwwwwwwwww555k',
    'k4wwwwwwwwwwwwww554k',
    'k444wwwwwwwwwwww444k',
    '.kR4cR4kkkkkkR4cR4k.',
    '..kkkkk......kkkkk..',
  ] },
  bling_bottle_cap_chain: { x: 13, y: 21, rows: [
    '.k...........k.',
    'k4kk.......kk4k',
    '.k34kkkkkkk43k.',
    '..kk3434343kk..',
    '....kkRRRkk....',
    '.....kRyRk.....',
    '.....kRRRk.....',
    '......kkk......',
  ] },
  bling_lost_house_key: { x: 13, y: 21, rows: [
    '.k...........k.',
    'kykk.......kkyk',
    '.kOykkkkkkkyOk.',
    '..kkOyOyOyOkk..',
    '....kkyykkk....',
    '.....kyYk......',
    '......kyk......',
    '......kyyk.....',
    '.......kk......',
  ] },
  bling_dog_tag: { x: 13, y: 21, rows: [
    '.k...........k.',
    'k4kk.......kk4k',
    '.k54kkkkkkk45k.',
    '..kk5454545kk..',
    '....kk555kk....',
    '.....k545k.....',
    '.....k444k.....',
    '......kkk......',
  ] },
  bling_wind_chime: { x: 13, y: 21, rows: [
    '.k...........k.',
    'k4kk.......kk4k',
    '.k34kkkkkkk43k.',
    '..kk3434343kk..',
    '....k5k5k5k....',
    '....k5k5k5k....',
    '....k4kkk4k....',
    '.....k...k.....',
  ] },
  bling_xmas_ornament: { x: 13, y: 21, rows: [
    '.k...........k.',
    'kykk.......kkyk',
    '.kOykkkkkkkyOk.',
    '..kkOyOyOyOkk..',
    '....kkkykkk....',
    '.....kRRRk.....',
    '.....kRwRk.....',
    '......kRk......',
    '.......k.......',
  ] },
  bling_soda_tab_bracelet: { x: 27, y: 24, rows: [
    '.k...',
    'k5kk.',
    'k445k',
    '.kkk.',
  ] },
  gloves_dish: { x: 6, y: 23, rows: [
    '..kk..',
    '.kYYk.',
    'kYYyyk',
    'kYyyok',
    '.kyok.',
    '..kk..',
  ] },
  gloves_gardening: { x: 6, y: 23, rows: [
    '..kk..',
    '.kLLk.',
    'kLLllk',
    'kLllGk',
    '.klGk.',
    '..kk..',
  ] },
  gloves_oven_mitts: { x: 5, y: 22, rows: [
    '...kk...',
    '..keek..',
    '.keeRRk.',
    'keeRRRrk',
    'keRRRrrk',
    '.kRRrrk.',
    '..krrk..',
    '...kk...',
  ] },
  gloves_kid_boxing: { x: 5, y: 22, rows: [
    '...kk...',
    '..keek..',
    '.keeRRk.',
    'keeRRRrk',
    'keRRRrrk',
    '.kRRrrk.',
    '..krrk..',
    '...kk...',
  ] },
  gloves_lost_mittens: { x: 6, y: 23, rows: [
    '..kk..',
    '.kcck.',
    'kccUUk',
    'kcUUuk',
    '.kUuk.',
    '..kk..',
  ] },
  gloves_baseball_mitt: { x: 5, y: 22, rows: [
    '...kk...',
    '..kttk..',
    '.kttNNk.',
    'kttNNNnk',
    'ktNNNnnk',
    '.kNNnnk.',
    '..knnk..',
    '...kk...',
  ] },
};

export type GearSlot = 'hat' | 'mask' | 'jacket' | 'shield' | 'gloves' | 'sneakers' | 'backpack' | 'bling' | 'ring';

function framed(rows: Rows): PixelBuf {
  const out = blank(HERO_W, HERO_H);
  blit(out, fromRows(rows), 0, HEADROOM);
  return out;
}

/** The tail layer in a full frame. */
export function tailBuf(): PixelBuf {
  return framed(HERO_TAIL);
}

/** The body layer in a full frame. */
export function bodyBuf(): PixelBuf {
  return framed(HERO_BODY);
}

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

/** One worn item in a hero frame, or null if it has no worn look (rings). */
export function gearBuf(slot: GearSlot, baseId: string): PixelBuf | null {
  const out = blank(HERO_W, HERO_H);
  const icon = ITEM_SPRITES[baseId];
  if (slot === 'hat' && icon) {
    // Sits on the head: the icon's bottom row lands just below the top of the head.
    blit(out, fromRows(icon), HERO_POINTS.head.x - 8, HERO_POINTS.head.y + 1 - lowestRow(icon));
    return out;
  }
  if (slot === 'shield' && icon) {
    blit(out, fromRows(icon), 0, 18 + HEADROOM);
    return out;
  }
  if (slot === 'backpack' && icon) {
    blit(out, fromRows(icon), 2, 14 + HEADROOM);
    return out;
  }
  const worn = WORN[baseId];
  if (!worn) return null;
  blit(out, fromRows(worn.rows), worn.x, worn.y + HEADROOM);
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
  const out = blank(HERO_W, HERO_H);
  blit(out, tailBuf(), 0, 0);
  if (gear.backpack) {
    const b = gearBuf('backpack', gear.backpack);
    if (b) blit(out, b, 0, 0);
  }
  blit(out, bodyBuf(), 0, 0);
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
