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
  '...kk...........',
  '................',
];

// ------------------------------------------------------------------ Shields: front-facing

/** Blue frisbee with a bite taken out of it. */
const SHIELD_CHEWED_FRISBEE: Rows = [
  '................',
  '.....kkkkk......',
  '...kkCCCcck.....',
  '..kCCwCccck.....',
  '..kCCcccck...k..',
  '.kCccUUUUckkkUk.',
  '.kCcUcccccUcUUk.',
  '.kCcUccYccUcUUk.',
  '.kCcUcYYYcUcUUk.',
  '.kccUcccccUcUUk.',
  '.kccccUUUUccUUk.',
  '..kcccccccUUUk..',
  '..kUcccUUUUUUk..',
  '...kkUUUUUUkk...',
  '.....kkkkkk.....',
  '................',
];

/** Silver minivan hubcap with four vents and a center cap. */
const SHIELD_HUBCAP: Rows = [
  '................',
  '.....kkkkkk.....',
  '...kk555443kkk..',
  '..k5w555544433k.',
  '..k5w21w5124x3k.',
  '.k55221w5122x3k.',
  '.k542115412243k.',
  '.k5w5555w55543k.',
  '.k54444w544443k.',
  '.k542215412243k.',
  '.k54221541224xk.',
  '..k4421541243k..',
  '..k4444433333k..',
  '...kk333333kk...',
  '.....kkkkkk.....',
  '................',
];

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
  '.k555355543443k.',
  '.k5535w5444343k.',
  '.k553355553343k.',
  '.k543222222343k.',
  '.k543444444333k.',
  '.k544344443433k.',
  '..k4443333433k..',
  '..k4444433333k..',
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
  '..kkkkkkkkkkkk..',
  '.kTttttttttttNk.',
  '.ktNNNNNNNNNNnk.',
  '.ktnkkkkkkkkkk..',
  '.ktnk.k4k..k4k..',
  '.ktnk.kkkkkkkk..',
  '.ktnkkeRRRRRRRk.',
  '.ktnkkRwwRwwwrk.',
  '.ktnkkRRRRRRRrk.',
  '.ktnkkRwwwRwwrk.',
  '.ktnkkrRRRRRrrk.',
  '.ktnk.kkkkkkkk..',
  '.knnk...........',
  '..kk............',
  '................',
];

// ------------------------------------------------------------------ Gloves

/** Yellow rubber dish glove. */
const GLOVES_DISH: Rows = [
  '................',
  '.......kk.......',
  '....kkkyYkkk....',
  '...kyYkyYkyYkk..',
  '...kyYkyYkyYkOk.',
  '...kyYkyYkyykyk.',
  '..kkyykyykyykyk.',
  '.kykyyyyyyyyyyk.',
  '.kYyyyyyyyyyyyk.',
  '.kyYyyyyyyyyyOk.',
  '..kyyyyyyyyyOk..',
  '..kYYYYYYYYYOk..',
  '..kyyyyyyyyyOk..',
  '..kOOOOOOOOOOk..',
  '...kkkkkkkkkk...',
  '................',
];

/** Canvas gardening glove with green thumbs and a worm in the cuff. */
const GLOVES_GARDENING: Rows = [
  '................',
  '....kk.kk.......',
  '...kTWkTWkkk....',
  '...kTTkTWkTWkk..',
  '...kTTkTTkTTktk.',
  '..kkGGkGGkTTktk.',
  '.kGkGGkGGkGGktk.',
  '.klGTTTTTTTTTtk.',
  '.kGGTTTTTTTTtNk.',
  '..kTTTTTTTTtNk..',
  '..kGGGGGGGGGgk..',
  '..klllllllllGk..',
  '..kGGGGGGPqGgk..',
  '...kkkkkkPqkk...',
  '.........kk.....',
  '................',
];

/** Quilted oven mitt with a hanging loop. */
const GLOVES_OVEN_MITTS: Rows = [
  '................',
  '......kkkk......',
  '.....kCCCck.....',
  '....kCcCcCck....',
  '...kCcCcCcCUk...',
  '..kkcCcCcCcUk...',
  '.kCkCcCcCcCUk...',
  '.kcCcCcCcCcUk...',
  '.kccCcCcCcUUk...',
  '..kcCcCcCcUk....',
  '..kWWWWWWW5k....',
  '..kW5555555k....',
  '...kkkkkkkk.....',
  '.....kk.........',
  '................',
  '................',
];

/** Red kid's boxing glove, signed on the cuff. */
const GLOVES_KID_BOXING: Rows = [
  '................',
  '.....kkkkkk.....',
  '...kkeeRRRrkk...',
  '..keeRRRRRRRrk..',
  '.keRRRRRRRRRRrk.',
  '.keRRRRRRRRRRrk.',
  '.keRRRRRRRRRrrk.',
  '.keRrRRRRRRRrrk.',
  '.kRRRrRRRRRrrk..',
  '.krRRrrrrrrrk...',
  '..kWWWWWWWW5k...',
  '..kWUWUUWWW5k...',
  '..kWWWWWWWW5k...',
  '..k55555555k....',
  '...kkkkkkkk.....',
  '................',
];

/** Two mittens that do not match. */
const GLOVES_LOST_MITTENS: Rows = [
  '................',
  '...kkkk.........',
  '..kmmMmk..kkkk..',
  '.kmVVVVmkkaAAak.',
  '.kVMMMMVkaaaaak.',
  '.kmVVVVmkaAaAak.',
  '.kVMMMMVgaaaaak.',
  '.kVVVVVVgaaAagk.',
  '.kVMMMMVkaaaaak.',
  '.kVVVVVvkaaaagk.',
  '.kMMMMMMkAAAAAk.',
  '.kmmmmmmkaaaaak.',
  '..kkkkkkkgggggk.',
  '.........kkkkk..',
  '................',
  '................',
];

/** Leather baseball mitt. */
const GLOVES_BASEBALL_MITT: Rows = [
  '................',
  '....kk.kk.......',
  '...kttktNkk.....',
  '..ktTtktNttkkk..',
  '..ktTNktNtNktNk.',
  '..ktTNktNtNktNk.',
  '.ktktNNtNtNNtNk.',
  '.kTtkttttttttNk.',
  '.kTtNTTTTTTNtNk.',
  '.ktTtTnnnnTNnNk.',
  '..ktTtTnnTNnNk..',
  '...knTTTTTnnNk..',
  '....kttttttNk...',
  '.....knnnnkk....',
  '......kkkk......',
  '................',
];

// ------------------------------------------------------------------ Sneakers: side view, toe pointing right

/** Lime clog with holes and the heel strap in sport mode. */
const SNEAKERS_CROCS: Rows = [
  '................',
  '................',
  '................',
  '...kkk..........',
  '..klllk.........',
  '.klkkklkkkk.....',
  '.klkklLLLLlk....',
  '.kGllLkLkLklk...',
  '.kGlllllllllGk..',
  '.kGGlllllllllGk.',
  '.kggGGGGGGGGGgk.',
  '..kggggggggggk..',
  '...kkkkkkkkkk...',
  '................',
  '................',
  '................',
];

/** Blue flip-flop with an orange strap. */
const SNEAKERS_FLIP_FLOPS: Rows = [
  '................',
  '................',
  '................',
  '................',
  '.......kkk......',
  '......kyyyk.....',
  '.....kOkkkOk....',
  '...kkOkkkkkOk...',
  '..kCCCCCCCCCCk..',
  '.kcccccccccccck.',
  '..kUUUUUUUUUUk..',
  '...kkkkkkkkkk...',
  '................',
  '................',
  '................',
  '................',
];

/** Red roller skate with white laces and yellow wheels. */
const SNEAKERS_ROLLER_SKATES: Rows = [
  '................',
  '................',
  '...kkkk.........',
  '..keRRrk........',
  '..keWRrk........',
  '..keRWrk........',
  '..keWRrkkk......',
  '..keRRRRRrkk....',
  '..keRRRRRRRrk...',
  '.keRRRRRRRRRrk..',
  '.k444444444443k.',
  '..kyOkkkkyOkkk..',
  '..kOOk..kOOk....',
  '...kk....kk.....',
  '................',
  '................',
];

/** Fluffy bunny slipper with floppy ears. */
const SNEAKERS_BUNNY_SLIPPERS: Rows = [
  '................',
  '................',
  '....kk.kk.......',
  '...kwPkwPk......',
  '...kwPkwPk......',
  '...kwPkwPkkk....',
  '..kwwwwwwwwwk...',
  '.kwwwwwwwwkwwk..',
  '.kwwwwwwwwwwwPk.',
  '.k55wwwwwwwww5k.',
  '.kPPPPPPPPPPPPk.',
  '..kqqqqqqqqqqk..',
  '...kkkkkkkkkk...',
  '................',
  '................',
  '................',
];

/** Yellow rubber rain boot. */
const SNEAKERS_RAIN_BOOTS: Rows = [
  '................',
  '................',
  '...kkkkk........',
  '..kOOOOOk.......',
  '..kYyyyOk.......',
  '..kYyyyOk.......',
  '..kYyyyOk.......',
  '..kYyyyOkkk.....',
  '..kYyyyyyyOkk...',
  '..kYyyyyyyyyOk..',
  '..kYyyyyyyyyyOk.',
  '..k22222222222k.',
  '...kkkkkkkkkkk..',
  '................',
  '................',
  '................',
];

/** White sneaker with blinking lights in the sole. */
const SNEAKERS_LIGHT_UP: Rows = [
  '................',
  '................',
  '................',
  '................',
  '...kkk..........',
  '..kwW5kkk.......',
  '.kwWWWWW5kkk....',
  '.kwWUUUWWWW5kk..',
  '.kwWWWWUUWWWW5k.',
  '.keeyyllccqqUUk.',
  '..k4444444443k..',
  '...kkkkkkkkkk...',
  '................',
  '................',
  '................',
  '................',
];

// ------------------------------------------------------------------ Backpacks: side or three-quarter view

/** Yellow metal lunchbox with a sunny picture. */
const BACKPACK_LUNCHBOX: Rows = [
  '................',
  '................',
  '.....kkkkkk.....',
  '....k222222k....',
  '...kk2kkkk2kk...',
  '..kyyyyyyyyyyk..',
  '.kYyyyy22yyyyOk.',
  '.kYCCCCCCCCyyOk.',
  '.kYCCCCYCCCyyOk.',
  '.kYGGGGGGGGyyOk.',
  '.kYyyyyyyyyyyOk.',
  '.kOOOOOOOOOOOOk.',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
  '................',
];

/** Purple fanny pack with a teal zipper. */
const BACKPACK_FANNY_PACK: Rows = [
  '................',
  '................',
  '................',
  '................',
  '....kkkkkkk.....',
  '...kmmmVVVvk....',
  '..kmVVVVVVVvkk..',
  '.kqmAAAAAAAAvqk.',
  '.kqmVVVVVVwVvqk.',
  '..kmVVVVVVVVvk..',
  '...kvvvvvvvvk...',
  '....kkkkkkkk....',
  '................',
  '................',
  '................',
  '................',
];

/** Red picnic cooler with a white lid and handle. */
const BACKPACK_PICNIC_COOLER: Rows = [
  '................',
  '................',
  '....kkkkkkkk....',
  '...k55555555k...',
  '..kk5kkkkkk5kk..',
  '.kwWWWWWWWWWW5k.',
  '.k555555555554k.',
  '.keRRRRRRRRRRrk.',
  '.keRRRRWWRRRRrk.',
  '.keRRRRRRRRRRrk.',
  '.keRRRRRRRRRRrk.',
  '.krrrrrrrrrrrrk.',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
  '................',
];

/** Lilac diaper bag with pockets and a bottle. */
const BACKPACK_DIAPER_BAG: Rows = [
  '................',
  '...........k....',
  '....kkkk..kTk...',
  '...kVVVVkkwwCk..',
  '..kVkkkkVkwwCk..',
  '.kmMMMMMMMMMMmk.',
  '.kmmmmmmmmmmmVk.',
  '.kmMMMMmMMMMmVk.',
  '.kmMMMMmMMMMmVk.',
  '.kmVVVVmVVVVmVk.',
  '.kmmmmmmmmmmmVk.',
  '.kVVVVVVVVVVVVk.',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
  '................',
];

/** Blue recycling bin with a bottle inside. */
const BACKPACK_RECYCLING_BIN: Rows = [
  '................',
  '.........kk.....',
  '........kllk....',
  '..kkkkkklGGkkk..',
  '.kuuuuuulGGuuuk.',
  '.kcUUUUUUUUUUuk.',
  '.kcUUUUUUUUUUuk.',
  '..kcUUUwUUUUuk..',
  '..kcUUwUwUUUuk..',
  '..kcUwwwwwUUuk..',
  '..kcUUUUUUUUuk..',
  '..kuuuuuuuuuuk..',
  '...kkkkkkkkkk...',
  '................',
  '................',
  '................',
];

/** Canvas tote with a leaf print and a baguette. */
const BACKPACK_REUSABLE_TOTE: Rows = [
  '................',
  '...........kk...',
  '.....kkkk.kTtk..',
  '....kNNNNkTtk...',
  '..kkNkkkkNTtkk..',
  '.kWWWWWWWWWWWTk.',
  '.kWTTTTTTTTTTtk.',
  '.kWTTTTGlTTTTtk.',
  '.kWTTTGGlTTTTtk.',
  '.kWTTTTGTTTTTtk.',
  '.kWTTTTTTTTTTtk.',
  '.kttttttttttttk.',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
  '................',
];

// ------------------------------------------------------------------ Bling: necklaces, pendants, chains, bracelets

/** Gold chain strung with bottle caps. */
const BLING_BOTTLE_CAP_CHAIN: Rows = [
  '................',
  '..k..........k..',
  '.kyk........kyk.',
  '.kyk........kyk.',
  '..kyk......kyk..',
  '..kyk......kyk..',
  '...kykkkkkkyk...',
  '...kyyyyyyyykk..',
  '..keRrkw54kCcck.',
  '..kRRrk544kcUUk.',
  '..krrrk443kUUuk.',
  '...kkk.kkk.kkk..',
  '................',
  '................',
  '................',
  '................',
];

/** Brass house key. */
const BLING_LOST_HOUSE_KEY: Rows = [
  '................',
  '...kkk..........',
  '..kyyyk.........',
  '.kyYkOok........',
  '.kyOkOok........',
  '..kOOook........',
  '...kkkyOk.......',
  '......kyOk......',
  '.......kyOkk....',
  '........kyOOk...',
  '.........kyOkk..',
  '..........kyOOk.',
  '...........kyOk.',
  '............kk..',
  '................',
  '................',
];

/** Bone-shaped dog tag on a ring. */
const BLING_DOG_TAG: Rows = [
  '................',
  '................',
  '.......kk.......',
  '......k45k......',
  '..kk.k4kk5k.kk..',
  '.kYYkkk45kkkyOk.',
  '.kYyyyyyyyyyyOk.',
  '..kyyOOOOOyyOk..',
  '.kYyyyyyyyyyyOk.',
  '.kyOkkkkkkkkOOk.',
  '..kk........kk..',
  '................',
  '................',
  '................',
  '................',
  '................',
];

/** Wind chime with four silver tubes. */
const BLING_WIND_CHIME: Rows = [
  '................',
  '.......k........',
  '...kkkk5kkkkk...',
  '..ktTTTTTTTTnk..',
  '..knnnnnnnnnnk..',
  '..kw4kw4kw4kw4k.',
  '..kw4kw4kw4kw4k.',
  '..kw4kw4kw4kw4k.',
  '..kw4kw4kw4k43k.',
  '..kw4k43kw4kkk..',
  '..kw4kkkkw4k....',
  '..k43k..kw4k....',
  '...kk...k43k....',
  '.........kk.....',
  '................',
  '................',
];

/** Bracelet of soda can pull tabs with a pink ribbon. */
const BLING_SODA_TAB_BRACELET: Rows = [
  '................',
  '................',
  '.....kkkkkk.....',
  '...kk5w5544kk...',
  '..k5w5q5444q3k..',
  '.k5w5kkkkkk443k.',
  '.kw5k......k43k.',
  '.kq5k......k4qk.',
  '.k54k......k33k.',
  '.k445kkkkkk433k.',
  '..k44q3333q33k..',
  '...kk333333kk...',
  '.....kkkkkk.....',
  '................',
  '................',
  '................',
];

/** Red glass bauble with a gold band. */
const BLING_XMAS_ORNAMENT: Rows = [
  '................',
  '.......kk.......',
  '......kyyk......',
  '.....kyYyOk.....',
  '....keRRRRrk....',
  '...keRwRRRRrk...',
  '..keRwRRRRRRrk..',
  '..keRRRRRRRRrk..',
  '..kyyyyyyyyyOk..',
  '..keRRRRRRRRrk..',
  '..krRRRRRRRrrk..',
  '...krRRRRRrrk...',
  '....krrrrrrk....',
  '.....kkkkkk.....',
  '................',
  '................',
];

// ------------------------------------------------------------------ Rings

/** Golden battered onion ring. */
const RING_ONION: Rows = [
  '................',
  '.....kkkkkk.....',
  '...kkyyyOOOkk...',
  '..kyyYyyOOOOok..',
  '..kyYyOOOOOOok..',
  '.kyyOOOOOOOOOok.',
  '.kyOOOWkkWOOOok.',
  '.kyOOWk..kWOOok.',
  '.kyOOWk..kWOook.',
  '.kOOOOWkkWOOook.',
  '.kOOOOOOOOOoook.',
  '..kOOOOOOooook..',
  '..koOOOooooook..',
  '...kkooooookk...',
  '.....kkkkkk.....',
  '................',
];

/** Soda can pull tab worn as a ring. */
const RING_PULL_TAB: Rows = [
  '................',
  '.....kkkkkk.....',
  '....k555444k....',
  '...k5w5kk443k...',
  '...k5w544443k...',
  '...k55444443k...',
  '...k54kkkk43k...',
  '...k54k..k43k...',
  '...k54k..k43k...',
  '...k54k..k43k...',
  '...k54kkkk33k...',
  '...k54433333k...',
  '....k433333k....',
  '.....kkkkkk.....',
  '................',
  '................',
];

/** Candy ring: a big sugar gem on a plastic band. */
const RING_CANDY: Rows = [
  '................',
  '......kkkk......',
  '.....kPPPqk.....',
  '....kPwPqqqk....',
  '....kPPqqqrk....',
  '.....kqqqrk.....',
  '.....kkrrkk.....',
  '...kkcCCCCUkk...',
  '..kcCkkkkkkcUk..',
  '.kcCk......kUUk.',
  '.kcUk......kUuk.',
  '..kUUkkkkkkUuk..',
  '...kkUUUUuukk...',
  '.....kkkkkk.....',
  '................',
  '................',
];

/** Red rubber band loop. */
const RING_RUBBER_BAND: Rows = [
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '...kkeeeRRRkk...',
  '..keekkkkkkRrk..',
  '.kekk......kkrk.',
  '.kekk......kkrk.',
  '..kRRkkkkkkrrk..',
  '...kkrrrrrrkk...',
  '.....kkkkkk.....',
  '................',
  '................',
  '................',
  '................',
  '................',
];

/** Green twist tie twisted into a ring. */
const RING_TWIST_TIE: Rows = [
  '................',
  '......k..k......',
  '.....klkkGk.....',
  '.....kklGkk.....',
  '...kkllGGGgkk...',
  '..klGkkkkkkGgk..',
  '.klGk......kGgk.',
  '.klk........kgk.',
  '.kGk........kgk.',
  '.kGGk......kggk.',
  '..kGgkkkkkkggk..',
  '...kkggggggkk...',
  '.....kkkkkk.....',
  '................',
  '................',
  '................',
];

/** Steel hardware washer. */
const RING_HARDWARE_WASHER: Rows = [
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '...kk555444kk...',
  '..k55w5554443k..',
  '.k5w55kkkk5443k.',
  '.k5545kkkk4433k.',
  '.k444445544433k.',
  '..k3444444333k..',
  '..k2333333332k..',
  '...kk222222kk...',
  '.....kkkkkk.....',
  '................',
  '................',
  '................',
];

// ------------------------------------------------------------------ Unique items: richer detail and a gold sparkle

/** Orange leaf blower mid-gust, a leaf flying from the nozzle. */
const WEAPON_UNIQUE_LEAF_BLOWER: Rows = [
  '................',
  '...k.........k..',
  '..kYk...kk..kCk.',
  '.kYwYk.kOykkCk..',
  '..kYk..koOOCkCk.',
  '...k....kx11kk..',
  '.......kyOOok...',
  '......kyOOok....',
  '..kkkkyOOok.....',
  '.k222yOOok......',
  '.k2k2OOok.......',
  '.kyOOOOOok......',
  '.kyO2x2Ook......',
  '..kooooook......',
  '...kkkkkk.......',
  '................',
];

/** Safety vest of the HOA president: reflective stripes, a gold badge, a sparkle. */
const JACKET_UNIQUE_HOA_VEST: Rows = [
  '................',
  '.....kk..kk.k...',
  '....k5OkkO5kYk..',
  '...ky5OkkO5YwYk.',
  '..kyy5OkkO5OYk..',
  '.kyYy5OkkO5OOok.',
  '.kyYw5OOOO5OOok.',
  '.kyYY5OOOO5OOok.',
  '.kw55555555544k.',
  '.kyOOOOOOOOOOok.',
  '.kw55555555544k.',
  '.kyOOOOOOOOOOok.',
  '.kooooooooooook.',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
];

/** Mailbox of many catalogs: flag up, gold trim, a sparkle. */
const SHIELD_UNIQUE_MAILBOX: Rows = [
  '................',
  '...kkk......k...',
  '..keRRk....kYk..',
  '..kRRrk...kYwYk.',
  '..k4kk.....kYk..',
  '..k4kkkkkkkkk...',
  '.k45555555555k..',
  '.k5w555555555k..',
  '.kw55555555543k.',
  '.k55555555554yk.',
  '.k44444444443yk.',
  '.kyyyyyyyyyyOk..',
  '..kkkkkNnkkkk...',
  '......kNnk......',
  '.......kk.......',
  '................',
];

// ------------------------------------------------------------------ Clothes pack: Kevin's pixel clothes pack, recolored to the palette

/** Thick black nerd glasses. */
const MASK_NERD_GLASSES: Rows = [
  '................',
  '................',
  '................',
  '................',
  '...k........k...',
  '..k.k......k.k..',
  '.k............k.',
  'kkkkkk....kkkkkk',
  'kk2242kkkk2242kk',
  '.k3332k..k3332k.',
  '.k3332k..k3332k.',
  '..kkkk....kkkk..',
  '................',
  '................',
  '................',
  '................',
];

/** Red and blue 3D glasses. */
const MASK_3D_GLASSES: Rows = [
  '................',
  '................',
  '................',
  '...k........k...',
  '..kkk......kkk..',
  '.kk.k......k.kk.',
  'kk............kk',
  'kkkkkkk..kkkkkkk',
  'kkrrPrkkkk22C2kk',
  '.kRRRrk..kCCC2k.',
  '.kRRRrk..kCCC2k.',
  '.kkkkkk..kkkkkk.',
  '................',
  '................',
  '................',
  '................',
];

/** Red sleep mask with cat ears and closed eyes. */
const MASK_CAT_SLEEP_MASK: Rows = [
  '................',
  '..k.........k...',
  '.krk.......krk..',
  '.krrk.....krrk..',
  '.krrkkkkkkkrrk..',
  '.kkkrrrrrrrkkk..',
  '.krrrrrrrrrrrk..',
  '.k4rrrrrrrrr4k..',
  'krr444rrr444rrk.',
  'krrrrrkkkrrrrrk.',
  '.krrrk...krrrk..',
  '..kkk.....kkk...',
  '...k.......k....',
  '....kk...kk.....',
  '......kkk.......',
  '................',
];

/** Long brown trench coat. */
const JACKET_TRENCH_COAT: Rows = [
  '......kkkkk.....',
  '.....kbbbbbkk...',
  '....kbbxxbbbbk..',
  '...kbbbxxbbbbbk.',
  '..kkbbbxxbbbk4k.',
  '..kbbbbxxbbbb44k',
  '..kkbbbxxbbbb44k',
  '.k4kbbbxxbbbk44k',
  'kb4kbbbxxbbbk44k',
  '.kbkbbbxxbb4kbbk',
  '..kk4bbxxbb44kkk',
  '...k44bxxb444k..',
  '...kb4kxxk4bbk..',
  '...kb4kkkk4bbk..',
  '...k44k..k444k..',
  '....kkk..kkkk...',
];

/** Quilted red puffer jacket. */
const JACKET_PUFFER: Rows = [
  '.....kkkkk......',
  '....kRRRRRk.....',
  '...kRkkkkRRkk...',
  '..kRkRkkRRkRRk..',
  '.kRPPPkkkkPPRRk.',
  'kRPrrrkkrrrrPRrk',
  'krRRRrkkrRRRRrrk',
  'kRrRRrkkrRRRrRrk',
  'kRkrrrkkrrrrkRrk',
  'krkRRrkkrRRRkrrk',
  'kRkRRrkkrRRRkRrk',
  'kRkrrrkkrrrrkRrk',
  'krkRRrkkrRRRkrrk',
  'kRkRRrkkrRRRkRrk',
  'kPkkkk..kkkkkRPk',
  '.kk..........kk.',
];

/** Shaggy brown fur coat. */
const JACKET_FUR_COAT: Rows = [
  '......kkkkk.....',
  '.....kbxxbnkk...',
  '....kbxkkxbnsk..',
  '...kbbxkkxbbnsk.',
  '..kkbxxkkxxbnnk.',
  '..knbxxkkxxbknsk',
  '..kkbxxkkxxbknsk',
  '.knkbbxkkxxbknsk',
  'ksnkbbxkkxxbknsk',
  '.kskbbxkkxbbkssk',
  '..kkbbxkkxxbnkkk',
  '...kbxxkkxxbnk..',
  '...kbxxkkkxbnk..',
  '...knbxkkkbnnk..',
  '...knnk..knnsk..',
  '....kkk..kkkk...',
];

/** Black leather jacket. */
const JACKET_LEATHER: Rows = [
  '.....kkkkk......',
  '....k4bbb4k.....',
  '...k4kkkkbbkk...',
  '..kkbbkk4bbk1k..',
  '.k3kkbkkbkkk11k.',
  'k311kbkkbbk1111k',
  'k311kbkkbbk1311k',
  'k311kkkkbk13111k',
  'k1k1kkkkkk13k11k',
  'k1kk1kkkk11kk11k',
  'k3k11kkkk111k11k',
  'k3kk1kkkk3kkk11k',
  'k1k11kkkk311k11k',
  'k1k11kkkk3kkk11k',
  'k1kkk....kkkk11k',
  '.kk..........kk.',
];

/** Red hooded parka, zipped up. */
const JACKET_HOODED_PARKA: Rows = [
  '......kkkkkk....',
  '.....k4bbb4bk...',
  '....k4bkk4b4bk..',
  '...kbbkrrkkbkk..',
  '....kkkrkkkkkRk.',
  '...kPRkrkPRRRk..',
  '..kkPPkrkPPkPk..',
  '..kPPPkrkRPkPRk.',
  '.kPkPPkrkPPkPRk.',
  'kPRkPPkrkRPkPRk.',
  '.kRkRPkrkPRkRRk.',
  '..kkRPkrkRPRkkk.',
  '...kRPkrkPPRk...',
  '...kRPkkkPPRk...',
  '...kRPk.kRRRk...',
  '....kkk.kkkk....',
];

/** Closed black umbrella with a J handle. Drawn upright, not diagonal like the other weapons. */
const WEAPON_UMBRELLA: Rows = [
  '......kkk.......',
  '.....k11kk......',
  '.....k1k1k......',
  '.....kk1kk......',
  '....kkk111k.....',
  '....k1k1k1k.....',
  '....k1k1kkk.....',
  '....kkk1kkk.....',
  '....k1k111k.....',
  '.....k1k1k......',
  '.....kkkkk......',
  '......k3k.......',
  '......k3k.k.....',
  '......k3kk3k....',
  '......k4443k....',
  '.......kkkk.....',
];

/** Open golf umbrella in green and gray panels. */
const SHIELD_GOLF_UMBRELLA: Rows = [
  'k..kkkkkkkkk....',
  '.kkgggggggggkk..',
  '.k11ggggggggggk.',
  'k11111gggggggkk.',
  'k1111111ggggk1k.',
  'k111111111kk11k.',
  'k11111111k111k..',
  'k1111111k111k...',
  'k111111kkk1k....',
  'k11111k1kkk.....',
  'k1111k111k1k....',
  'k11kk111k.k1k...',
  'k1k111kk...k3k..',
  '.k11kk.....kk3k.',
  '..kk......k333k.',
  '...........kkk..',
];

/** Open beach umbrella in tan, green and blue panels. */
const SHIELD_BEACH_UMBRELLA: Rows = [
  'k..kkkkkkkkk....',
  '.kkssssssssskk..',
  '.kgggsssssssssk.',
  'kCggggggssssskk.',
  'kCgggggggggskrk.',
  'kCCgggggggkkrrk.',
  'kCCCgggggkrrrk..',
  'kCCCggggkrrrk...',
  'kCCCCggkkkrk....',
  'kCCCCgkrkkk.....',
  'kCCCCkrrrk1k....',
  'kCCkk22rk.k1k...',
  'kCk222kk...k4k..',
  '.k22kk.....kk3k.',
  '..kk......k443k.',
  '...........kkk..',
];

/** A pair of brown leather work gloves. */
const GLOVES_LEATHER_WORK: Rows = [
  '...kkkk.........',
  '.kkbbkbk........',
  'kbbkbbkbkkkkk...',
  '.kbbkbbkk4k4bkk.',
  'kbkbbkbk4k4bk4bk',
  'kbbkbbk4k4bk4bk.',
  '.kbbkk444bk4bk4k',
  '..kbk4bbb44bk4bk',
  '...k4bbb4bbk4bk.',
  '...kbb4bbb44bk..',
  '..k4b4bbb4bbkk..',
  '.k444bbb444kkkk.',
  'k4bbbbbbbbbbbbbk',
  'k4bbbbbbbbbbbbk.',
  '.kbbbbkkkkkkkk..',
  '..kkkk..........',
];

/** A pair of white gala gloves. */
const GLOVES_WHITE_GALA: Rows = [
  '...kkkk.........',
  '.kk34k4k........',
  'k34k34k4kkkkk...',
  '.k34k34kk5k54kk.',
  'k4k34k3k5k54k54k',
  'k34k34k5k54k54k.',
  '.k34kk5554k54k5k',
  '..k3k5444554k54k',
  '...k5444544k54k.',
  '...k445444554k..',
  '..k545444544kk..',
  '.k555444555kkkk.',
  'k54444444444443k',
  'k5444433333333k.',
  '.k3333kkkkkkkk..',
  '..kkkk..........',
];

/** Gray striped clip-on tie. */
const BLING_CLIP_ON_TIE: Rows = [
  '......kkk.......',
  '.....k342k......',
  '......k2k.......',
  '.......k........',
  '......kkk.......',
  '......k3k.......',
  '......k4k.......',
  '......k2k.......',
  '......k34k......',
  '.....k342k......',
  '.....k423k......',
  '.....k234k......',
  '.....k342k......',
  '.....k422k......',
  '......k2k.......',
  '.......k........',
];

/** Purple bow tie on its neck band. */
const BLING_BOW_TIE: Rows = [
  '................',
  '...k............',
  '..kkk......kk...',
  '..kkkk....kkkk..',
  '.kv1kkk..kk1vk..',
  '.krv1kkk.k1vvk..',
  '.kvrvrkkkrrvvk..',
  '.krvvvkkkvvvvk..',
  '.krv1kkkkk1rvk..',
  '.kv1k.....k1rk..',
  '..kk.......kk...',
  '..kk......k1k...',
  '..kkkkkkkkk1k...',
  '...kkkkkkkkk....',
  '....kkkkkkk.....',
  '................',
];

/** Striped red knit scarf with fringed ends. */
const BLING_KNIT_SCARF: Rows = [
  '.....kkkkkk.....',
  '....kr1r1r1k....',
  '...kr1kkkkr1k...',
  '...k1k....krk...',
  '..k1r1k..kr1rk..',
  '..kr1rk..k1r1k..',
  '..k1r1k..kr1rk..',
  '..kr1rk..k1r1k..',
  '..k1r1k..kr1rk..',
  '..kr1rk..k1r1k..',
  '..k1r1k..kr1rk..',
  '..kr1rk..k1r1k..',
  '..k1r1k..kr1rk..',
  '..kkkkk..kkkkk..',
  '..k.k.k..k.k.k..',
  '..k.k.k..k.k.k..',
];

/** Toy police badge in gold plastic with a blue center. */
const BLING_TOY_POLICE_BADGE: Rows = [
  '...k...k...k....',
  '..knkkknkkknk...',
  '.knsnbbsnbbsnk..',
  '..knsssssssnk...',
  '...kbsssssbk....',
  '...knsnnnsnk....',
  '..knsn333nsnk...',
  '..knsn3uunsnk...',
  '.knssn3uunssnk..',
  '.knssn3uunssnk..',
  '.knTTsnnnsTTnk..',
  '.knsT5T5T5Tsnk..',
  '..kbs55555sbk...',
  '...kbbbsbbbk....',
  '....kkkbkkk.....',
  '.......k........',
];

/** Silver crescent moon pendant on a chain. */
const BLING_MOON_PENDANT: Rows = [
  '..kkkkkkkkkkk...',
  '.kkkkkkkkkkkkk..',
  'k4k.........k3k.',
  '.k5k.......k1k..',
  '..k4k.....k4k...',
  '...k5kkkkk4k....',
  '....k55435k.....',
  '.....kk3kk......',
  '.......k........',
  '......kkk.......',
  '.....k543k......',
  '....k3k443k.....',
  '....kk.k53k.....',
  '....k3k541k.....',
  '.....k441k......',
  '......kkk.......',
];

/** Mood ring, its stone green. */
const RING_MOOD: Rows = [
  '................',
  '......kkk.......',
  '....kksnbkk.....',
  '...ksnkkkbbk....',
  '..kskk...kkxk...',
  '.ksk.......kxk..',
  'ksk...kkk...kxk.',
  'knk..kWggk..kxk.',
  '.knkkggWggkkxk..',
  '..knkgggg1kxk...',
  '...kkggW11kk....',
  '.....kgggk......',
  '......kgk.......',
  '.......k........',
  '................',
  '................',
];

/** Plain gold band. */
const RING_GOLD_BAND: Rows = [
  '.......kkkk.....',
  '.....kknnsskk...',
  '....kTTsnnsssk..',
  '...kWWWTsTTTTsk.',
  '..ksTTWWTkkkksk.',
  '.kWTsTTkkkkkkksk',
  '.kTWTsk....kkksk',
  'ksTWWk......knsk',
  'knsTWk.....knnsk',
  'knsTk.....knnsk.',
  '.knTk....knnnsk.',
  '.knTkkkkknnnsk..',
  '.knskkkknnssk...',
  '..ksskkkkssk....',
  '...kkTTTskk.....',
  '.....kkkk.......',
];

/** Ring with a big plastic diamond. */
const RING_PLASTIC_DIAMOND: Rows = [
  '................',
  '................',
  '......kkk.......',
  '....kksnbkk.....',
  '...ksnkkkbbk....',
  '..kskk...kkxk...',
  '.ksk.......kxk..',
  'ksk...kkk...kxk.',
  'knk..kC54k..kxk.',
  '.knkk43C35kkxk..',
  '..knk35453kxk...',
  '...kk54C43kk....',
  '.....k355k......',
  '......kkk.......',
  '................',
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
  shield_chewed_frisbee: SHIELD_CHEWED_FRISBEE,
  shield_hubcap: SHIELD_HUBCAP,
  shield_cookie_tin: SHIELD_COOKIE_TIN,
  shield_for_sale_sign: SHIELD_FOR_SALE_SIGN,
  gloves_dish: GLOVES_DISH,
  gloves_gardening: GLOVES_GARDENING,
  gloves_oven_mitts: GLOVES_OVEN_MITTS,
  gloves_kid_boxing: GLOVES_KID_BOXING,
  gloves_lost_mittens: GLOVES_LOST_MITTENS,
  gloves_baseball_mitt: GLOVES_BASEBALL_MITT,
  sneakers_crocs: SNEAKERS_CROCS,
  sneakers_flip_flops: SNEAKERS_FLIP_FLOPS,
  sneakers_roller_skates: SNEAKERS_ROLLER_SKATES,
  sneakers_bunny_slippers: SNEAKERS_BUNNY_SLIPPERS,
  sneakers_rain_boots: SNEAKERS_RAIN_BOOTS,
  sneakers_light_up: SNEAKERS_LIGHT_UP,
  backpack_lunchbox: BACKPACK_LUNCHBOX,
  backpack_fanny_pack: BACKPACK_FANNY_PACK,
  backpack_picnic_cooler: BACKPACK_PICNIC_COOLER,
  backpack_diaper_bag: BACKPACK_DIAPER_BAG,
  backpack_recycling_bin: BACKPACK_RECYCLING_BIN,
  backpack_reusable_tote: BACKPACK_REUSABLE_TOTE,
  bling_bottle_cap_chain: BLING_BOTTLE_CAP_CHAIN,
  bling_lost_house_key: BLING_LOST_HOUSE_KEY,
  bling_dog_tag: BLING_DOG_TAG,
  bling_wind_chime: BLING_WIND_CHIME,
  bling_soda_tab_bracelet: BLING_SODA_TAB_BRACELET,
  bling_xmas_ornament: BLING_XMAS_ORNAMENT,
  ring_onion: RING_ONION,
  ring_pull_tab: RING_PULL_TAB,
  ring_candy: RING_CANDY,
  ring_rubber_band: RING_RUBBER_BAND,
  ring_twist_tie: RING_TWIST_TIE,
  ring_hardware_washer: RING_HARDWARE_WASHER,
  weapon_unique_leaf_blower: WEAPON_UNIQUE_LEAF_BLOWER,
  jacket_unique_hoa_vest: JACKET_UNIQUE_HOA_VEST,
  shield_unique_mailbox: SHIELD_UNIQUE_MAILBOX,
  mask_nerd_glasses: MASK_NERD_GLASSES,
  mask_3d_glasses: MASK_3D_GLASSES,
  mask_cat_sleep_mask: MASK_CAT_SLEEP_MASK,
  jacket_trench_coat: JACKET_TRENCH_COAT,
  jacket_puffer: JACKET_PUFFER,
  jacket_fur_coat: JACKET_FUR_COAT,
  jacket_leather: JACKET_LEATHER,
  jacket_hooded_parka: JACKET_HOODED_PARKA,
  weapon_umbrella: WEAPON_UMBRELLA,
  shield_golf_umbrella: SHIELD_GOLF_UMBRELLA,
  shield_beach_umbrella: SHIELD_BEACH_UMBRELLA,
  gloves_leather_work: GLOVES_LEATHER_WORK,
  gloves_white_gala: GLOVES_WHITE_GALA,
  bling_clip_on_tie: BLING_CLIP_ON_TIE,
  bling_bow_tie: BLING_BOW_TIE,
  bling_knit_scarf: BLING_KNIT_SCARF,
  bling_toy_police_badge: BLING_TOY_POLICE_BADGE,
  bling_moon_pendant: BLING_MOON_PENDANT,
  ring_mood: RING_MOOD,
  ring_gold_band: RING_GOLD_BAND,
  ring_plastic_diamond: RING_PLASTIC_DIAMOND,
};

/** The pixel of each weapon icon where the paw holds it (the weapon is rotated about this point). */
export const WEAPON_GRIP: Record<string, { x: number; y: number }> = {
  weapon_hose_whip: { x: 3, y: 12 },
  weapon_broken_rake: { x: 3, y: 12 },
  weapon_bbq_spatula: { x: 3, y: 12 },
  weapon_pool_noodle: { x: 3, y: 12 },
  weapon_wiffle_bat: { x: 3, y: 12 },
  weapon_tiki_torch: { x: 4, y: 12 },
  weapon_unique_leaf_blower: { x: 4, y: 11 },
  weapon_umbrella: { x: 7, y: 13 },
};

/** How far each weapon's art leans clockwise from straight up, in degrees (most are drawn on the 45 degree diagonal). */
export const WEAPON_ART_TILT: Readonly<Record<string, number>> = {
  weapon_umbrella: 0,
};
export const DEFAULT_WEAPON_TILT = 45;


/** Every item icon for the preview sheet (tools/pixelSheet.ts), in items.json order. */
export function sheet(): SheetEntry[] {
  return Object.entries(ITEM_SPRITES).map(([name, rows]) => {
    checkRows(name, rows);
    return { name, buf: fromRows(rows) };
  });
}
