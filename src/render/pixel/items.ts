/**
 * 16x16 pixel icons for every base item in src/data/items.json, drawn to docs/PIXEL_ART.md: one
 * 1px ink outline, three tones per material lit from the top left, and natural item colors
 * (rarity is shown by the UI frame, not the icon).
 *
 * The icons are also worn by the raccoon in battle, so each slot keeps one convention:
 * - hat: upright, its brim or opening on rows 12 to 14
 * - mask, jacket, shield: front view
 * - weapon: diagonal, grip at the bottom left (see WEAPON_GRIP), business end at the top right
 * - sneakers: side view, toe pointing right
 * - backpack: side or three-quarter view
 * The three unique items carry a small gold sparkle.
 */
import { checkRows, fromRows, type Rows, type SheetEntry } from './buf';
import { REF_CONE } from './reference';

const TODO: Rows = [
  '................',
  '................',
  '..kkkkkkkkkkkk..',
  '..k4444444444k..',
  '..k4444444444k..',
  '..k4444444444k..',
  '..k4444444444k..',
  '..k4444444444k..',
  '..k4444444444k..',
  '..k4444444444k..',
  '..k4444444444k..',
  '..k4444444444k..',
  '..k4444444444k..',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
];

// ------------------------------------------------------------------ Hats: upright, brim or opening on rows 12 to 14

/** Glazed red gnome hat, its tip bent over. */
const HAT_LAWN_GNOME: Rows = [
  '................',
  '..........kkk...',
  '.........keRrk..',
  '........keRRRrk.',
  '.......keRRrrk..',
  '......keRRRrk...',
  '.....keRRRRrk...',
  '....kewRRRRrk...',
  '...kewRRRRRrk...',
  '...keRRRRRRRrk..',
  '..keRRRRRRRRrk..',
  '..keRRRRRRRRrrk.',
  '.keRRRRRRRRRRrk.',
  '.krrrrrrrrrrrrk.',
  '..kkkkkkkkkkkk..',
  '................',
];

/** Upturned terracotta pot, a petunia growing out of the drain hole. */
const HAT_FLOWER_POT: Rows = [
  '................',
  '........kkk.....',
  '.......kmmVk....',
  '......kmVYVvk...',
  '.......kVvvk....',
  '......kllGk.....',
  '....kkkkkGkk....',
  '...keoooooonk...',
  '...keoooooonk...',
  '..keoooooooonk..',
  '..keoooooooonk..',
  '.keeeeeeeeeeeok.',
  '.keooooooooonnk.',
  '.koooooooooonnk.',
  '..kkkkkkkkkkkk..',
  '................',
];

/** Upturned yogurt tub with a strawberry label. */
const HAT_YOGURT_TUB: Rows = [
  '................',
  '................',
  '.....kkkkkk.....',
  '....kwww554k....',
  '...kww555554k...',
  '...kww555554k...',
  '..kww55555544k..',
  '..kPPPGlGPPqqk..',
  '..kPPReRRrPqqk..',
  '..kPPRRYRrPqqk..',
  '..kPPPRRrPPqqk..',
  '..kPPPPrPPPqqk..',
  '..kww55555544k..',
  '.kww5555555544k.',
  '..kkkkkkkkkkkk..',
  '................',
];

/** Paint can with a wire handle and beige drips. */
const HAT_PAINT_BUCKET: Rows = [
  '................',
  '....kkkkkkkk....',
  '...k55555544k...',
  '..k5kkkkkkkk4k..',
  '.k5k........k4k.',
  '.k5k........k4k.',
  '.k4kkkkkkkkkk3k.',
  '.kWWWWWWWWWWWTk.',
  '.kWTTTTTTTTTTtk.',
  '.k5TT44TT44T33k.',
  '.k5tw44Tt44t33k.',
  '.k55w44t444433k.',
  '.k55w444444433k.',
  '.k554444444333k.',
  '..kkkkkkkkkkkk..',
  '................',
];

/** Vented bike helmet with a white crack, chin straps and buckle. */
const HAT_BIKE_HELMET: Rows = [
  '................',
  '................',
  '......kkkkk.....',
  '....kkCCCcck....',
  '...kCCwwcWcUk...',
  '..kCCcccccWcUk..',
  '.kCckkkkkcWcUk..',
  '.kCccccccWccUk..',
  '.kccckkkkkcUuuk.',
  '.kcUUUUUUUUUuuk.',
  '..kWW5555554kk..',
  '...k4kkkkk4k....',
  '....k4kkk4k.....',
  '.....k4y4k......',
  '......kkk.......',
  '................',
];

// ------------------------------------------------------------------ Masks: front view of what covers the face

/** Striped tube sock with two eye holes. */
const MASK_TUBE_SOCK: Rows = [
  '................',
  '...kkkkkkkk.....',
  '..kwWWWWWW5k....',
  '..kRRRRRRRrk....',
  '..kwWWWWWW5k....',
  '..kUUUUUUUuk....',
  '..kwWWWWWW5k....',
  '..kWkkWkkW5k....',
  '..kWkkWkkW5k....',
  '..kWWWWWWWW5kk..',
  '..kWWWWWWWWWW5k.',
  '..kWWWWWWWWWW5k.',
  '...k555555555k..',
  '....kkkkkkkkk...',
  '................',
  '................',
];

/** Hot pink gas station sunglasses. */
const MASK_GAS_STATION_SHADES: Rows = [
  '................',
  '................',
  '................',
  '..kkkkkkkkkkkk..',
  '.kPPPPPPPPPPPPk.',
  '.kqwvvvqqwvvvqk.',
  '.kqvvvVqqvvvVqk.',
  '.kqVVmmqqVVmmqk.',
  '..kqqqqkkqqqqk..',
  '...kkkk..kkkk...',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

/** Swim mask with the orange snorkel tube curling up the side. */
const MASK_POOL_SNORKEL: Rows = [
  '................',
  '..........kkk...',
  '.........kyyyk..',
  '...kkkkkk.kyOk..',
  '..kccccUUkkyOk..',
  '.kcCCCCCcUkyOk..',
  '.kcCwCCCcUUyOk..',
  '.kcCCCCccUkyOk..',
  '.kUcccccUUkyOk..',
  '..kUUccUUkkyOk..',
  '...kUUUUk.kyOk..',
  '....kkkkkkkyOk..',
  '....kuuyyyyyOk..',
  '....kuuOOOOOok..',
  '.....kkkkkkkk...',
  '................',
];

/** Goalie mask with red marks and breathing holes. */
const MASK_PEEWEE_HOCKEY: Rows = [
  '................',
  '.....kkkkk......',
  '....kwwwwWk.....',
  '...kwwRwWRWk....',
  '..kwwwRWRW55k...',
  '..kwWWWWWWW5k...',
  '..kwkkkWWkkk5k..',
  '..kWWkkWWkk55k..',
  '..kWWWWWWWWW5k..',
  '..kWWkWWWkW5k...',
  '...kWWWkWWW5k...',
  '...kWkWWWkW5k...',
  '....kWWkWW5k....',
  '.....kWW55k.....',
  '......kkkk......',
  '................',
];

/** Egg carton strip, eye holes poked through two cups. */
const MASK_EGG_CARTON: Rows = [
  '................',
  '................',
  '...kk..kk..kk...',
  '..kWTkkWTkkWTk..',
  '.kWkkNWWTNWkkNk.',
  '.kTkkNTTNNTkkNk.',
  '.ktNNttNNttNNtk.',
  '.ktWTttWTttWTtk.',
  '.kWWTNWWTNWWTNk.',
  '.kTTNNTTNNTTNNk.',
  '..kNNkkNNkkNNk..',
  '...kk..kk..kk...',
  '................',
  '................',
  '................',
  '................',
];

/** Fluted coffee filter with yesterday's stain. */
const MASK_COFFEE_FILTER: Rows = [
  '................',
  '................',
  '................',
  '..kk.kk.kk.kk...',
  '.kwwkwwkwwkwwk..',
  '.kwWWWWWWWWWW5k.',
  '.kWW5WW5WW5WW5k.',
  '..kW5WW5WW5W5k..',
  '..kWW5W5W5WW5k..',
  '...kWttNtWW5k...',
  '....ktNNtW5k....',
  '.....kttW5k.....',
  '......kkkk......',
  '................',
  '................',
  '................',
];

// ------------------------------------------------------------------ Jackets: front view

/** Black garbage bag poncho with a torn hem. */
const JACKET_GARBAGE_BAG: Rows = [
  '................',
  '.....kk..kk.....',
  '....k21kk1xk....',
  '...k2421k11xk...',
  '..k2242111x1xk..',
  '..k244211x11xk..',
  '.k22421x11x11xk.',
  '.k2421x111x11xk.',
  '.k2211x112x11xk.',
  '.k2111x121x1xxk.',
  '.k2111x1x1x1xxk.',
  '.k2111x1x11xxxk.',
  '.k21k11xk1xkxxk.',
  '..k1kkxk.kxkkk..',
  '...k..k...k.....',
  '................',
];

/** Vest woven from green and white lawn chair webbing. */
const JACKET_LAWN_CHAIR: Rows = [
  '................',
  '.....kk..kk.....',
  '....kWGkkWGk....',
  '...kwWGkkWGgk...',
  '..kwlGWkkGW5gk..',
  '.kwwlGWkkGW5ggk.',
  '.kllwWGGWWGg55k.',
  '.kllwWGGWWGg55k.',
  '.kwwlGWWGGW5ggk.',
  '.kwwlGWWGGW5ggk.',
  '.kllwWGGWWGg55k.',
  '.kllwWGGWWGg55k.',
  '.k554444444433k.',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
];

/** Bubble wrap breastplate held on with packing tape. */
const JACKET_BUBBLE_WRAP: Rows = [
  '................',
  '...kkk....kkk...',
  '..kCCCk..kCCCk..',
  '.kCwCCckkCwCCck.',
  '.kCCcCCCCCCcCck.',
  '..kcCwCcCwCcUk..',
  '..kCCCcCCCcCUk..',
  '..kcCwCcCwCcUk..',
  '..kTTTTCCCcCUk..',
  '..ktTTTTTTcCUk..',
  '..kcCwCtTTTTtk..',
  '..kCCCcCCCtTtk..',
  '...kCwCcCwCUk...',
  '....kkkkkkkk....',
  '................',
  '................',
];

/** Red holiday sweater with a zigzag band and a tree. */
const JACKET_UGLY_SWEATER: Rows = [
  '................',
  '.....kk..kk.....',
  '...kkGGkkGGkk...',
  '..keeeGGGGRRrk..',
  '.keeRRRRRRRRrrk.',
  '.keRRRRRRRRRRrk.',
  '.kGWGGGWGGGWGgk.',
  '.kWGWGWGWGWGWgk.',
  '.keRrRRRyRRrRrk.',
  '.keRrRRGGRRrRrk.',
  '.keRrRGGGGRrRrk.',
  '.kGGrRRnnRRrggk.',
  '..kkGGGGGGGGkk..',
  '....kkkkkkkk....',
  '................',
  '................',
];

/** Blue tarp cape with grommets and a rope tie. */
const JACKET_BLUE_TARP: Rows = [
  '................',
  '......kkk.......',
  '.....ktTtk......',
  '....kcUtUuk.....',
  '...kccUUUUuk....',
  '...k5cUUcUU5k...',
  '..kccUuUcUuUuk..',
  '..kcUUuUcUuUuk..',
  '..kcUUuUcUUuuk..',
  '.kccUUuUcUUuUuk.',
  '.kcUUuUUcUUuUuk.',
  '.kcUUuUUcUUuuuk.',
  '.k5cUUkuUUkUu5k.',
  '..kkkk.kkk.kkk..',
  '................',
  '................',
];

/** Pink dog raincoat with a hood and a PRINCESS crown. */
const JACKET_DOG_RAINCOAT: Rows = [
  '................',
  '.....kkkkk......',
  '....kPPqqPkk....',
  '..kkPqrrrrqPkk..',
  '.kPPPPqqqqPqqqk.',
  '.kPwPqPPqqqqqrk.',
  '.kPwqqkqqqkqqrk.',
  '.kPqqqkyyqkqqrk.',
  '.kPqqqkqqqkqqrk.',
  '.kPqqqkWqqkqqrk.',
  '.kPqqrkqqqkqrrk.',
  '.kWWWkkqqqkkWWk.',
  '..kkkkqqqrk.kk..',
  '......kkkk......',
  '................',
  '................',
];

// ------------------------------------------------------------------ Weapons: diagonal, grip at the bottom left, business end at the top right

/** Garden hose with a brass nozzle, kinked into a loop. */
const WEAPON_HOSE_WHIP: Rows = [
  '................',
  '.........kkkk...',
  '........klllGk..',
  '.......klGkkgGk.',
  '.......klGk.kGk.',
  '........klGklGk.',
  '.........klGgk..',
  '........klGgk...',
  '.......klGgk....',
  '....kkklGgk.....',
  '...kyylGgk......',
  '..kyYOGgk.......',
  '.kyYOokk........',
  '..kOok..........',
  '...kk...........',
  '................',
];

/** Garden rake with a missing tine. */
const WEAPON_BROKEN_RAKE: Rows = [
  '................',
  '.....k.k...k.k..',
  '....k4k4kkk4k3k.',
  '....k4k4k4k4k3k.',
  '...kw555555543k.',
  '....kkkkktnkkk..',
  '.......ktnk.....',
  '......ktnk......',
  '.....ktnk.......',
  '....ktnk........',
  '...ktnk.........',
  '..ktnk..........',
  '.ktnk...........',
  '.knk............',
  '..k.............',
  '................',
];

/** Slotted BBQ spatula with a wooden handle. */
const WEAPON_BBQ_SPATULA: Rows = [
  '................',
  '..........kk....',
  '.........kw5k...',
  '........kw554k..',
  '........k5k54k..',
  '.......k5k5k44k.',
  '.......k55k44k..',
  '......k5544kk...',
  '.....k44kkk.....',
  '....k4Nk........',
  '...ktNk.........',
  '..ktNnk.........',
  '.ktNnk..........',
  '.kNnk...........',
  '..kk............',
  '................',
];

/** Hot pink pool noodle, hollow end up. */
const WEAPON_POOL_NOODLE: Rows = [
  '................',
  '................',
  '...........kkk..',
  '..........kPPPk.',
  '.........kPxPqk.',
  '........kPPqqVk.',
  '.......kPqqVkk..',
  '......kPqqVk....',
  '.....kPqqVk.....',
  '....kPqqVk......',
  '...kPqqVk.......',
  '..kPqqVk........',
  '.kPqqVk.........',
  '.kqqVk..........',
  '..kkk...........',
  '................',
];

/** Yellow wiffle bat with holes in the barrel. */
const WEAPON_WIFFLE_BAT: Rows = [
  '................',
  '...........kk...',
  '..........kyyk..',
  '.........kYyyOk.',
  '........kYykyOk.',
  '.......kYyyyOk..',
  '......kYykyOk...',
  '.....kYyyyOk....',
  '.....kYyyOk.....',
  '....kYyOkk......',
  '...kYyOk........',
  '..kYyOk.........',
  '.kYYyOk.........',
  '.kyOOk..........',
  '..kkk...........',
  '................',
];

/** Bamboo tiki torch with a woven cup and a dry wick. */
const WEAPON_TIKI_TORCH: Rows = [
  '................',
  '...........k....',
  '.........kk5k...',
  '........kntNkk..',
  '.......knNtNtnk.',
  '......knTNtNtnk.',
  '......knNtNtnk..',
  '.......knNtnk...',
  '.......kTNkk....',
  '......kTNk......',
  '.....ktnk.......',
  '....kTNk........',
  '...kTNk.........',
  '..ktnk..........',
  '.kTNk...........',
  '..kk............',
];

// ------------------------------------------------------------------ Shields: front-facing

/** Coir welcome mat. */
const SHIELD_WELCOME_MAT: Rows = [
  '................',
  '................',
  '..kkkkkkkkkkkk..',
  '.ktTTTTTTTTTTtk.',
  '.kTnnnnnnnnnnNk.',
  '.kTnTTTTTTTTnNk.',
  '.kTnTnTnnTnTnNk.',
  '.kTnTTTTTTTTnNk.',
  '.kTnTnnTnTnnnNk.',
  '.kTnTTTTTTTTnNk.',
  '.kTnnnnnnnnnnNk.',
  '.ktNNNNNNNNNNNk.',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
  '................',
];

/** Galvanized trash can lid with its handle. */
const SHIELD_TRASH_LID: Rows = [
  '................',
  '.....kkkkkk.....',
  '...kk555444kk...',
  '..k5ww5554443k..',
  '..k5w53333443k..',
  '.k55533553344kk.',
  '.k5543544442433k',
  '.k553w4444442433',
  '.k5532222222433k',
  '.k5543222224433k',
  '.k5554333344333k',
  '..k54444444433k.',
  '..k4444443333k..',
  '...kk333333kk...',
  '.....kkkkkk.....',
  '................',
];

/** Blue butter cookie tin. */
const SHIELD_COOKIE_TIN: Rows = [
  '................',
  '.....kkkkkk.....',
  '...kkCCCccckk...',
  '..kCCcccccccUk..',
  '.kCccyyyyyyccUk.',
  '.kCccyTTtTyccUk.',
  '.kCcccyyyyccUUk.',
  '.kyyyyyyyyyyyOk.',
  '.kcUUUUUUUUUUuk.',
  '.kcUwUUUUwUUUuk.',
  '.kcUUUUUUUUUUuk.',
  '.kyyyyyyyyyyyOk.',
  '..kUUUUUUUUUuk..',
  '...kkkkkkkkkk...',
  '................',
  '................',
];

/** Hanging FOR SALE sign on a wooden post. */
const SHIELD_FOR_SALE_SIGN: Rows = [
  '................',
  '..kkkkkkkkkkkkk.',
  '.kTtttttttttttNk',
  '.ktNNNNNNNNNNNnk',
  '.ktnkk.k.kkkkkk.',
  '.ktnkkRRRRRRRRk.',
  '.ktnkkReeeeeRrk.',
  '.ktnkkRwwRwwRrk.',
  '.ktnkkRRRRRRRrk.',
  '.ktnkkRwRwwwRrk.',
  '.ktnkkrRRRRRrrk.',
  '.ktnk.kkkkkkkk..',
  '.ktnk...........',
  '.knnk...........',
  '..kk............',
  '................',
];

/** Every item icon by item id, in items.json order (sheet() relies on this order). */
export const ITEM_SPRITES: Record<string, Rows> = {
  hat_traffic_cone: REF_CONE,
  hat_lawn_gnome: HAT_LAWN_GNOME,
  hat_flower_pot: HAT_FLOWER_POT,
  hat_yogurt_tub: HAT_YOGURT_TUB,
  hat_paint_bucket: HAT_PAINT_BUCKET,
  hat_bike_helmet: HAT_BIKE_HELMET,
  mask_tube_sock: MASK_TUBE_SOCK,
  mask_gas_station_shades: MASK_GAS_STATION_SHADES,
  mask_pool_snorkel: MASK_POOL_SNORKEL,
  mask_peewee_hockey: MASK_PEEWEE_HOCKEY,
  mask_egg_carton: MASK_EGG_CARTON,
  mask_coffee_filter: MASK_COFFEE_FILTER,
  jacket_garbage_bag: JACKET_GARBAGE_BAG,
  jacket_lawn_chair: JACKET_LAWN_CHAIR,
  jacket_bubble_wrap: JACKET_BUBBLE_WRAP,
  jacket_ugly_sweater: JACKET_UGLY_SWEATER,
  jacket_blue_tarp: JACKET_BLUE_TARP,
  jacket_dog_raincoat: JACKET_DOG_RAINCOAT,
  weapon_hose_whip: WEAPON_HOSE_WHIP,
  weapon_broken_rake: WEAPON_BROKEN_RAKE,
  weapon_bbq_spatula: WEAPON_BBQ_SPATULA,
  weapon_pool_noodle: WEAPON_POOL_NOODLE,
  weapon_wiffle_bat: WEAPON_WIFFLE_BAT,
  weapon_tiki_torch: WEAPON_TIKI_TORCH,
  shield_welcome_mat: SHIELD_WELCOME_MAT,
  shield_trash_lid: SHIELD_TRASH_LID,
  shield_chewed_frisbee: TODO,
  shield_hubcap: TODO,
  shield_cookie_tin: SHIELD_COOKIE_TIN,
  shield_for_sale_sign: SHIELD_FOR_SALE_SIGN,
  gloves_dish: TODO,
  gloves_gardening: TODO,
  gloves_oven_mitts: TODO,
  gloves_kid_boxing: TODO,
  gloves_lost_mittens: TODO,
  gloves_baseball_mitt: TODO,
  sneakers_crocs: TODO,
  sneakers_flip_flops: TODO,
  sneakers_roller_skates: TODO,
  sneakers_bunny_slippers: TODO,
  sneakers_rain_boots: TODO,
  sneakers_light_up: TODO,
  backpack_lunchbox: TODO,
  backpack_fanny_pack: TODO,
  backpack_picnic_cooler: TODO,
  backpack_diaper_bag: TODO,
  backpack_recycling_bin: TODO,
  backpack_reusable_tote: TODO,
  bling_bottle_cap_chain: TODO,
  bling_lost_house_key: TODO,
  bling_dog_tag: TODO,
  bling_wind_chime: TODO,
  bling_soda_tab_bracelet: TODO,
  bling_xmas_ornament: TODO,
  ring_onion: TODO,
  ring_pull_tab: TODO,
  ring_candy: TODO,
  ring_rubber_band: TODO,
  ring_twist_tie: TODO,
  ring_hardware_washer: TODO,
  weapon_unique_leaf_blower: TODO,
  jacket_unique_hoa_vest: TODO,
  shield_unique_mailbox: TODO,
};

/** The pixel of each weapon icon where the paw holds it (the weapon is rotated about this point). */
export const WEAPON_GRIP: Record<string, { x: number; y: number }> = {
  weapon_hose_whip: { x: 3, y: 12 },
  weapon_broken_rake: { x: 3, y: 12 },
  weapon_bbq_spatula: { x: 3, y: 12 },
  weapon_pool_noodle: { x: 3, y: 12 },
  weapon_wiffle_bat: { x: 3, y: 12 },
  weapon_tiki_torch: { x: 3, y: 13 },
};

/** Every item icon for the preview sheet (tools/pixelSheet.ts), in items.json order. */
export function sheet(): SheetEntry[] {
  return Object.entries(ITEM_SPRITES).map(([name, rows]) => {
    checkRows(name, rows);
    return { name, buf: fromRows(rows) };
  });
}
