/**
 * The raccoon hero, drawn like Kevin's reference (a chunky low-res pixel raccoon): one blob for
 * head and body, square ears with dark insides, cream brows, a dark mask with shiny black eyes, a
 * cream muzzle with a black nose, flat tan fur with darker sides, stubby dark feet and a fat ringed
 * tail. He is drawn in a coarse 30 x 23 grid and every one of his pixels is SCALE art pixels wide,
 * so he reads as chunky next to the world. Masks, jackets, shoes, necklaces and gloves have worn
 * versions in the same grid; hats, shields, backpacks and weapons are the item icons at normal size.
 * The tail is its own layer so a backpack can sit between tail and body.
 */
import { blank, blit, fromRows, scaleUp, type PixelBuf, type Rows, type SheetEntry } from './buf';
import { ITEM_SPRITES, WEAPON_GRIP } from './items';

/** The hero's grid, in hero pixels. */
export const HERO_GRID = { w: 30, h: 23 } as const;
/** Art pixels per hero pixel. */
export const SCALE = 2;
/** Room above the head for tall hats, in art pixels. */
export const HEADROOM = 16;
/** Hero frames in art pixels. */
export const HERO_W = HERO_GRID.w * SCALE;
export const HERO_H = HERO_GRID.h * SCALE + HEADROOM;
/** Landmarks in frame pixels: feet (ground contact), the front paw's grip, the top of the head. */
export const HERO_POINTS = {
  feet: { x: 16 * SCALE, y: 22 * SCALE - 1 + HEADROOM },
  hand: { x: 26 * SCALE, y: 13 * SCALE + HEADROOM },
  head: { x: 16 * SCALE + 1, y: 3 * SCALE + HEADROOM },
} as const;

export const HERO_TAIL: Rows = [
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..kk..........................',
  '.knnk.........................',
  'knbbnk........................',
  'kntnnnk.......................',
  'knttnnnk......................',
  '.knnttnnk.....................',
  '.kttttnnk.....................',
  '..knnnttnk....................',
  '..kttttnnk....................',
  '...knnnnnk....................',
  '....ktttk.....................',
  '.....kkk......................',
  '..............................',
  '..............................',
  '..............................',
];

export const HERO_BODY: Rows = [
  '........kkkk.........kkkk.....',
  '.......kttttk.......kttttk....',
  '.......ktbntk.......ktnbtk....',
  '.......ktbntkkkkkkkkktnbtk....',
  '.......ktttttttttttttttttk....',
  '........kttttttttttttttNk.....',
  '........ktTTTTtttttTTTTNk.....',
  '.......knbwkbbbbbbbbbwkbnk....',
  '.......knbkkbbTTTTTbbkkbnk....',
  '.......kttttTTTkkkTTTttNNk....',
  '.......kNttttTTTkTTTtttNNk....',
  '.......kNttttttttttttttNNk....',
  '......kkNttttttttttttttNNk....',
  '.....knnNttttttttttttttNNk....',
  '.....kbnNttttttttttttttNNk....',
  '......kkNttttttttttttttNNk....',
  '.......kNttttttttttttttNNk....',
  '........kttttttttttttttNk.....',
  '........kNNNNNNNNNNNNNNNk.....',
  '........knnnnnNNNNNnnnnnk.....',
  '........kbbbbbkkkkkbbbbbk.....',
  '.........kkkkk.....kkkkk......',
  '..............................',
];

/** The front paw, drawn over the weapon's grip (hero pixels). */
export const HERO_PAW: Rows = [
  '.kk.',
  'knbk',
  'kbbk',
  '.kk.',
];
/** A puffy glove paw (boxing gloves, mitts). */
const BIG_PAW: Rows = [
  '.kkk.',
  'knnbk',
  'knbbk',
  'kbbbk',
  '.kkk.',
];
const BIG_GLOVES = new Set(['gloves_kid_boxing', 'gloves_baseball_mitt', 'gloves_oven_mitts']);

/** Glove colors (dark, mid, light) that replace the paw's b / n / N. */
export const GLOVE_RAMPS: Record<string, [string, string, string]> = {
  gloves_dish: ['o', 'y', 'Y'],
  gloves_gardening: ['G', 'l', 'L'],
  gloves_oven_mitts: ['r', 'R', 'e'],
  gloves_kid_boxing: ['r', 'R', 'e'],
  gloves_lost_mittens: ['u', 'U', 'c'],
  gloves_baseball_mitt: ['n', 'N', 't'],
};

/** Worn overlays in the hero grid (x, y is the top-left corner of the rows). */
export const WORN: Record<string, { x: number; y: number; rows: Rows }> = {
  mask_tube_sock: { x: 7, y: 4, rows: [
    '.kkkkkkkkkkkkkkkkk.',
    'kRRRRRRRRRRRRRRRRRk',
    'kUUUUUUUUUUUUUUUUUk',
    'kWWkkWWWWWWWWWkk55k',
    'kWWkkWWWWWWWWWkk55k',
    'kWWWWWWWWWWWWWWW55k',
    '.kkkkkkkkkkkkkkkkk.',
  ] },
  mask_gas_station_shades: { x: 8, y: 6, rows: [
    '.kkkkkkkkkkkkkkk.',
    'kCwxx1111111Cwxxk',
    'kxxxxkkkkkkkxxxxk',
    '.kkkk.......kkkk.',
  ] },
  mask_pool_snorkel: { x: 7, y: 0, rows: [
    '..................kRk',
    '..................kyk',
    '..................kyk',
    '..................kyk',
    '..................kyk',
    '..kkkk.......kkkk.kyk',
    '.kCwcckkkkkkkCwcckkyk',
    'kUcckcUUUUUUUcckcUkyk',
    '.kcckckkkkkkkcckckkyk',
    '.kcccck.....kcccckkyk',
    '..kkkk......kkkkkkkyk',
    '...........kOOOOOOOOk',
    '............kkkkkkkk.',
  ] },
  mask_peewee_hockey: { x: 8, y: 3, rows: [
    '..kkkkkkkkkkkkk..',
    '.kWWWWWWRWWWWW5k.',
    'kWWWWWWWRWWWWW55k',
    'kWWWWWWWRWWWWW55k',
    'kWkkWWWWRWWWWkk5k',
    'kWkkWWWWRWWWWkk5k',
    'kWWWWWWWRWWWWW55k',
    'kWWWWWWW4WWWWW55k',
    'kWWWW4WWRWW4WW55k',
    '.kWWWWWWRWWWWW5k.',
    '..kkkkkkkkkkkkk..',
  ] },
  mask_egg_carton: { x: 7, y: 5, rows: [
    '.kkkkkk.....kkkkkk.',
    'kTTTTTTkkkkkTTTTTTk',
    'kTTkkTTtttttTTkkTTk',
    'kttkkttkkkkkttkkttk',
    'kttttttk...kttttttk',
    '.kkkkkk.....kkkkkk.',
  ] },
  mask_coffee_filter: { x: 7, y: 7, rows: [
    '.kkkkkkkkkkkkkkkkk.',
    'k55555W5W5W5W55555k',
    '.kkkk5W5W5W5W5kkkk.',
    '....k5W5W5W5W5k....',
    '.....kW5W5W5Wk.....',
    '......kkkkkkk......',
  ] },
  jacket_garbage_bag: { x: 6, y: 10, rows: [
    '..kkkkkkkkkkkkkkkkk.',
    '.kx112111112111112xk',
    '.kx11121111121111x2k',
    'kkx11112111112111xxk',
    'kk211111211111211xxk',
    '.kx21111121111121xxk',
    '.kx12111112111112xxk',
    '..k112111112111112k.',
    '..kxkxkxkxkxkxkxkxk.',
    '...k.k.k.k.k.k.k.k..',
  ] },
  jacket_lawn_chair: { x: 5, y: 10, rows: [
    '...kkkkkkkkkkkkkkkkk.',
    '..kWlWlWlWlWlWlWlWlWk',
    '.kklWlWlWlWlWlWlWlWlk',
    'k5GWlWlWlWlWlWlWlWlWk',
    'kG5lWlWlWlWlWlWlWlWlk',
    '.kkWlWlWlWlWlWlWlWlWk',
    '..klWlWlWlWlWlWlWlWlk',
    '...klWlWlWlWlWlWlWlk.',
    '...kWlWlWlWlWlWlWlWk.',
    '....kkkkkkkkkkkkkkk..',
  ] },
  jacket_bubble_wrap: { x: 5, y: 10, rows: [
    '...kkkkkkkkkkkkkkkkk.',
    '..kwwwwwwwwwwwwwwwwCk',
    '.kkCwwwwwwwwwwwwwwCwk',
    'kcwCwwwwwwwwwwwwwwCCk',
    'kccwwwwwwwwwwwwwwwwCk',
    '.kkCwwwwwwwwwwwwwwCwk',
    '..kCwwwwwwwwwwwwwwCCk',
    '...kwwwwwwwwwwwwwwwk.',
    '...kwCCwCCwCCwCCwCCk.',
    '....kkkkkkkkkkkkkkk..',
  ] },
  jacket_ugly_sweater: { x: 5, y: 10, rows: [
    '...kkkkkkkkkkkkkkkkk.',
    '..kReeeeeeeeeeeeeeRRk',
    '.kkReeeeeeeeeeeeeeRRk',
    'krrReeeeeeeeeeeeeeRRk',
    'kWGWGWGWGWGWGWGWGWGWk',
    '.kkReeeeeeeeeeeeeeRRk',
    '..kReeeeeeeeeeeeeeRRk',
    '...keeeeeeeeeeeeeeRk.',
    '...kRRRRRRRRRRRRRRRk.',
    '....kkkkkkkkkkkkkkk..',
  ] },
  jacket_blue_tarp: { x: 5, y: 10, rows: [
    '...kkkkkkkkkkkkkkkkk.',
    '..kUccccccccccccccUUk',
    '.kkUc4ccccccccccc4UUk',
    'kuuUccccccccccccccUUk',
    'kuuUccccccccccccccUUk',
    '.kkUccccccccccccccUUk',
    '..kUccccccccccccccUUk',
    '...kccccccccccccccUk.',
    '...kUkUkUkUkUkUkUkUk.',
    '....k.k.k.k.k.k.k.k..',
  ] },
  jacket_dog_raincoat: { x: 5, y: 10, rows: [
    '...kkkkkkkkkkkkkkkkk.',
    '..kyYYYYYYYYYYYYYYyyk',
    '.kkyYYYYYYYkYYYYYYyyk',
    'kOOyYYYYYYYYYYYYYYyyk',
    'kOOyYYYYYYYYYYYYYYyyk',
    '.kkyYYYYYYYkYYYYYYyyk',
    '..kyYYYYYYYYYYYYYYyyk',
    '...kYYYYYYYYYYYYYYyk.',
    '...kyyyyyyyyyyyyyyyk.',
    '....kkkkkkkkkkkkkkk..',
  ] },
  jacket_unique_hoa_vest: { x: 5, y: 10, rows: [
    '...kkkkkkkkkkkkkkkkk.',
    '..kOyyyyyyyyyyyyyyOOk',
    '.kkOyyyyYyyyyyyyyyOOk',
    'kooOyyyyyyyyyyyyyyOOk',
    'k55wwwwwwwwwwwwwwwwwk',
    '.kkOyyyyyyyyyyyyyyOOk',
    '..kwwwwwwwwwwwwwwwwwk',
    '...kyyyyyyyyyyyyyyOk.',
    '...kOOOOOOOOOOOOOOOk.',
    '....kkkkkkkkkkkkkkk..',
  ] },
  sneakers_crocs: { x: 8, y: 18, rows: [
    '.kkkkkkkkkkkkkkk.',
    'kGGGGGlllllGGGGGk',
    'kGGGGGkkkkkGGGGGk',
    '.kkkkk.....kkkkk.',
  ] },
  sneakers_flip_flops: { x: 8, y: 19, rows: [
    '...k.........k...',
    '.kkRkk.....kkRkk.',
    'ktttttk...ktttttk',
    '.kkkkk.....kkkkk.',
  ] },
  sneakers_roller_skates: { x: 8, y: 18, rows: [
    '.kkkkkkkkkkkkkkk.',
    'k444445555544444k',
    'k44444kkkkk44444k',
    'k1kk1k....k1kk1k.',
    '.k..k......k..k..',
  ] },
  sneakers_bunny_slippers: { x: 8, y: 17, rows: [
    '..k.k.......k.k..',
    '.kWkWkkkkkkkWkWk.',
    'k55555WWWWW55555k',
    'k55555kkkkk55555k',
    '.kkkkk.....kkkkk.',
  ] },
  sneakers_rain_boots: { x: 7, y: 15, rows: [
    '.kkkkkkkkkkkkkkkkk.',
    'kyYYYYYYYYYYYYYYyyk',
    '.kYYYYYYYYYYYYYYyk.',
    '.kyyyyyyyyyyyyyyyk.',
    '.kOOOOOyyyyyOOOOOk.',
    '.kOOOOOkkkkkOOOOOk.',
    '..kkkkk.....kkkkk..',
  ] },
  sneakers_light_up: { x: 8, y: 18, rows: [
    '.kkkkkkkkkkkkkkk.',
    'k444445555544444k',
    'k4R44Rkkkkk4R44Rk',
    '.kkkkk.....kkkkk.',
  ] },
  bling_bottle_cap_chain: { x: 11, y: 10, rows: [
    '.k.......k.',
    'k4kkkkkkk4k',
    '.k3434343k.',
    '..kkRyRkk..',
    '....kRk....',
    '.....k.....',
  ] },
  bling_lost_house_key: { x: 11, y: 10, rows: [
    '.k.......k.',
    'kykkkkkkkyk',
    '.kOyOyOyOk.',
    '..kkkykkk..',
    '....kyyk...',
    '.....kk....',
  ] },
  bling_dog_tag: { x: 11, y: 10, rows: [
    '.k.......k.',
    'k4kkkkkkk4k',
    '.k5454545k.',
    '..kk55kkk..',
    '...k44k....',
    '....kk.....',
  ] },
  bling_wind_chime: { x: 11, y: 10, rows: [
    '.k.......k.',
    'k4kkkkkkk4k',
    '.k3434343k.',
    '..k5k5k5k..',
    '..k4kkk4k..',
    '...k...k...',
  ] },
  bling_xmas_ornament: { x: 11, y: 10, rows: [
    '.k.......k.',
    'kykkkkkkkyk',
    '.kOyOyOyOk.',
    '..kkkykkk..',
    '...kRwRk...',
    '....kRk....',
    '.....k.....',
  ] },
  bling_soda_tab_bracelet: { x: 23, y: 11, rows: [
    '.k.',
    'k5k',
    'k4k',
    '.k.',
  ] },
  gloves_dish: { x: 5, y: 12, rows: [
    '.kk.',
    'kyYk',
    'koyk',
    '.kk.',
  ] },
  gloves_gardening: { x: 5, y: 12, rows: [
    '.kk.',
    'klLk',
    'kGlk',
    '.kk.',
  ] },
  gloves_oven_mitts: { x: 4, y: 11, rows: [
    '..kk.',
    '.keek',
    'kRRek',
    'krrRk',
    '.krrk',
    '..kk.',
  ] },
  gloves_kid_boxing: { x: 4, y: 11, rows: [
    '..kk.',
    '.keek',
    'kRRek',
    'krrRk',
    '.krrk',
    '..kk.',
  ] },
  gloves_lost_mittens: { x: 5, y: 12, rows: [
    '.kk.',
    'kUck',
    'kuUk',
    '.kk.',
  ] },
  gloves_baseball_mitt: { x: 4, y: 11, rows: [
    '..kk.',
    '.kttk',
    'kNNtk',
    'knnNk',
    '.knnk',
    '..kk.',
  ] },
};

export type GearSlot = 'hat' | 'mask' | 'jacket' | 'shield' | 'gloves' | 'sneakers' | 'backpack' | 'bling' | 'ring';

/** Hero-grid rows as a full frame (scaled up, below the headroom). */
function framed(rows: Rows, x = 0, y = 0): PixelBuf {
  const out = blank(HERO_W, HERO_H);
  blit(out, scaleUp(fromRows(rows), SCALE), x * SCALE, y * SCALE + HEADROOM);
  return out;
}

export function tailBuf(): PixelBuf {
  return framed(HERO_TAIL);
}

export function bodyBuf(): PixelBuf {
  return framed(HERO_BODY);
}

/** The front paw (in glove colors when gloves are worn), scaled to hero pixels. */
export function pawBuf(glovesId: string | null): PixelBuf {
  const ramp = glovesId ? GLOVE_RAMPS[glovesId] : undefined;
  const rows = ramp && BIG_GLOVES.has(glovesId!) ? BIG_PAW : HERO_PAW;
  return scaleUp(fromRows(rows, ramp ? { b: ramp[0], n: ramp[1], N: ramp[2] } : undefined), SCALE);
}

function lowestRow(rows: Rows): number {
  for (let y = rows.length - 1; y >= 0; y--) if (/[^.]/.test(rows[y])) return y;
  return rows.length - 1;
}

/** One worn item in a hero frame, or null if it has no worn look (rings). */
export function gearBuf(slot: GearSlot, baseId: string): PixelBuf | null {
  const icon = ITEM_SPRITES[baseId];
  if ((slot === 'hat' || slot === 'shield' || slot === 'backpack') && icon) {
    const out = blank(HERO_W, HERO_H);
    const b = fromRows(icon);
    // Hats sit on the head between the ears; shields hang on the back paw; backpacks peek out behind.
    if (slot === 'hat') blit(out, b, HERO_POINTS.head.x - 8, HERO_POINTS.head.y + 3 - lowestRow(icon));
    else if (slot === 'shield') blit(out, b, 4, 11 * SCALE + HEADROOM);
    else blit(out, b, 2, 7 * SCALE + HEADROOM);
    return out;
  }
  const worn = WORN[baseId];
  return worn ? framed(worn.rows, worn.x, worn.y) : null;
}

/** A weapon's art and grip (it points up and to the right; the scene turns it to point straight up). */
export function weaponBuf(baseId: string): { buf: PixelBuf; grip: { x: number; y: number } } | null {
  const icon = ITEM_SPRITES[baseId];
  if (!icon) return null;
  return { buf: fromRows(icon), grip: WEAPON_GRIP[baseId] ?? { x: 3, y: 12 } };
}

/** The whole hero with gear, for previews. */
export function dressed(gear: Partial<Record<GearSlot | 'weapon', string>>): PixelBuf {
  const out = blank(HERO_W + 12, HERO_H);
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
