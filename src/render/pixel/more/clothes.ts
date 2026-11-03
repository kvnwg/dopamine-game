/**
 * More item icons (clothes group), drawn to the same rules as src/render/pixel/items.ts (16x16, one ink
 * outline, three tones per material lit from the top left, natural colors; the slot conventions in
 * that file's header). Merged into ITEM_SPRITES there.
 */
import type { Rows } from '../buf';

// ------------------------------------------------------------------ Jackets: front view

/** Cardboard box with its flaps open, a red FRAGILE stamp. */
const JACKET_CARDBOARD_BOX: Rows = [
  '................',
  '.....kkkkkk.....',
  '.kk.kTTTTTtk.kk.',
  '.kTtkttttttktNk.',
  '..kTtknnnnkNtk..',
  '..kTTTTTTTTTtk..',
  '..kTtttttttNNk..',
  '..kTtttttttNNk..',
  '..kTtRRRRRRrNk..',
  '..kTtReeeeRrNk..',
  '..kTtRRRRRRrNk..',
  '..kTtttttttNNk..',
  '..kTtttttttNNk..',
  '..kNNNNNNNNNNk..',
  '...kkkkkkkkkk...',
  '................',
];

/** Silver duct tape jacket, strip over strip, a red tape X patch, a torn end. */
const JACKET_DUCT_TAPE: Rows = [
  '................',
  '.....kk..kk.....',
  '...kk5wkk44kk...',
  '..k55w4kk4433k..',
  '.k5w5544R4R332k.',
  '.k5455444R4332k.',
  '.k333333R4R332k.',
  '.k5w5544444332k.',
  '.k545544433322k.',
  '.k545544444432k.',
  '.k333333344332k.',
  '.k5w5544444332k.',
  '..kk55444433kk..',
  '....kkkkk4kk....',
  '.........k......',
  '................',
];

/** Newspaper folded into a suit: lapels, a headline, columns of print. */
const JACKET_NEWSPAPER: Rows = [
  '................',
  '.....kk..kk.....',
  '...kkWwkkw5kk...',
  '..kWWWw44w554k..',
  '.kWWWWw44wW554k.',
  '.kW3W33ww3xx54k.',
  '.kWWWWWW5WWW54k.',
  '.kW33W33533W34k.',
  '.kWWWWWW5WWW54k.',
  '.kW3W33W53W334k.',
  '.kWWWWWW5WWW54k.',
  '.k555555555544k.',
  '..kkWWWW5W54kk..',
  '....kkkkkkkk....',
  '................',
  '................',
];

/** Hawaiian shirt: sky blue, pink hibiscus, green leaves, open collar. */
const JACKET_HAWAIIAN_SHIRT: Rows = [
  '................',
  '.....kk..kk.....',
  '...kkCCkkCckk...',
  '..kCCCCUUcccUk..',
  '.kCCCqCcUccGcUk.',
  '.kCCqyqcWcGlUUk.',
  '.kkkCqccUccUkkk.',
  '...kCcGcUcqUk...',
  '...kCcccWqyqk...',
  '...kCqccUcqUk...',
  '...kqyqcUcGUk...',
  '...kCqccWccUk...',
  '...kccccUcUUk...',
  '...kkkkkkkkkk...',
  '................',
  '................',
];

/** White hotel bathrobe: shawl collar, blue belt tied at the waist, a gold monogram. */
const JACKET_BATHROBE: Rows = [
  '................',
  '.....kk..kk.....',
  '...kkwwkkwWkk...',
  '..kWWww44wW55k..',
  '.kWWWWw44wWW55k.',
  '.kW5WWw44wWW54k.',
  '.kW5WWWwwWyW45k.',
  '.kW5WWWW5WWW45k.',
  '.kW5WWWW5WWW45k.',
  '.kW5CCCCcCCc45k.',
  '.kW5WWCW5cWW45k.',
  '.kCCWWCW5cW5cck.',
  '..kkWWWW5WW5kk..',
  '...kCCCCcCCck...',
  '....kkkkkkkk....',
  '................',
];

/** Black T-shirt printed with a tuxedo: white shirt front, bow tie, buttons. */
const JACKET_TUXEDO_TEE: Rows = [
  '................',
  '.....kk..kk.....',
  '...kk21kk11kk...',
  '..k22wwwwww1xk..',
  '.k222wxwwxw1xxk.',
  '.k222wxxxxw1xxk.',
  '.kkk2wxwwxw1kkk.',
  '...k211ww11xk...',
  '...k2111w11xk...',
  '...k211w511xk...',
  '...k2111511xk...',
  '...k211w51xxk...',
  '...k111551xxk...',
  '...kkkkkkkkkkk..',
  '................',
  '................',
];

/** Inflatable donut pool float: pink frosting, sprinkles, a shiny highlight. */
const JACKET_POOL_FLOAT: Rows = [
  '................',
  '.....kkkkkk.....',
  '...kkwPPPPPkk...',
  '..kwPPyPPcPPqk..',
  '.kPwPPPPPPPlqqk.',
  '.kPcPPPkkPPPPqk.',
  '.kPPPPk..kPyPqk.',
  '.kqPlPk..kPPqqk.',
  '.kTqPPk..kqPqtk.',
  '.kTTqqPkkqqqttk.',
  '.kTTTtqqqqtttNk.',
  '..kTttttttttNk..',
  '...kkttttNNkk...',
  '.....kkkkkk.....',
  '................',
  '................',
];

/** Purple velour track jacket: white stripes down the sleeves, a silver zip. */
const JACKET_VELOUR_TRACKSUIT: Rows = [
  '................',
  '.....kk..kk.....',
  '...kkmVkkVvkk...',
  '..kmmVVw5VVvvk..',
  '.kwmmmV54VVvV5k.',
  '.kwVmVV54VVvV5k.',
  '.kwVmVV54VVvV5k.',
  '.kwVmVV54VVvV5k.',
  '.kwVmVV54VVvv5k.',
  '.kwVmVV54VVvv5k.',
  '.kwvmVV54Vvvv5k.',
  '.kvvvVV54Vvvvvk.',
  '..kkvvv54vvvkk..',
  '....kkkkkkkk....',
  '................',
  '................',
];

/** Letterman jacket: blue wool, cream sleeves, a gold letter, ribbed hem. */
const JACKET_LETTERMAN: Rows = [
  '................',
  '.....kk..kk.....',
  '...kkuykkyukk...',
  '..kWcUukkuUu5k..',
  '.kwWcUUUuUUuW5k.',
  '.kwWyyUUuUUuW5k.',
  '.kwWyUyUWUUu54k.',
  '.kWWyyUUuUUu54k.',
  '.kW5yUyUuUUu54k.',
  '.kW5UUUUWUuu54k.',
  '.kW5UUUUuUuu44k.',
  '.kuuUUUUuUuuuuk.',
  '..kkyyyyyOOOkk..',
  '....kkkkkkkk....',
  '................',
  '................',
];

/** Sandwich board on its shoulder strap: a cream sign with red and black lettering. */
const JACKET_SANDWICH_BOARD: Rows = [
  '................',
  '....kkkkkkkk....',
  '....kNnnnnNk....',
  '....kNk..kNk....',
  '.kkkkNkkkkNkkkk.',
  '.kTTTTTTTTTTtNk.',
  '.kTWWWWWWWWW5Nk.',
  '.kTWRRRWRRRW5Nk.',
  '.kTWWWWWWWWW5Nk.',
  '.kTWRRWRRRRW5Nk.',
  '.kTWWWWWWWWW5Nk.',
  '.kTWxxxWxxW55Nk.',
  '.kTW555555555Nk.',
  '.knNNNNNNNNNNnk.',
  '.kkkkkkkkkkkkkk.',
  '................',
];

/** Gold foil space blanket wrapped like a cape, crinkled, its silver side folded back. */
const JACKET_SPACE_BLANKET: Rows = [
  '................',
  '......kkkk......',
  '.....kYyy5k.....',
  '....kYwyyO5k....',
  '...kYyYyOy45k...',
  '...kyYyOyy54k...',
  '..kYyyOyYy544k..',
  '..kYwyOyyO5w4k..',
  '.kYyyOyYyOy544k.',
  '.kyYyOyyYOy5w4k.',
  '.kYyOyyYyyO544k.',
  'kYyyOyYyyOy5w44k',
  'kyYOyyyYyOyy544k',
  'kOOOOOOOOOOO444k',
  'kkkkkkkkkkkkkkkk',
  '................',
];

/** Hot dog costume: a sausage standing in its bun, a face hole, a mustard zigzag. */
const JACKET_HOT_DOG: Rows = [
  '................',
  '......kkkk......',
  '.....keeRrk.....',
  '....keRRRRrk....',
  '..kkkeRbbRrkkk..',
  '.kTTkeRbbRrkttk.',
  '.kTtkeRRRRrkNtk.',
  '.kTtkeyRRRrkNtk.',
  '.kTtkeRyRRrkNtk.',
  '.kTtkeRRyRrkNtk.',
  '.kTtkeRRRyrkNtk.',
  '.kTtkeRRyRrkNtk.',
  '..kkkeRyRRrkkk..',
  '....keRRRrrk....',
  '.....kkkkkk.....',
  '................',
];

export const SPRITES: Record<string, Rows> = {
  jacket_cardboard_box: JACKET_CARDBOARD_BOX,
  jacket_duct_tape: JACKET_DUCT_TAPE,
  jacket_newspaper: JACKET_NEWSPAPER,
  jacket_hawaiian_shirt: JACKET_HAWAIIAN_SHIRT,
  jacket_bathrobe: JACKET_BATHROBE,
  jacket_tuxedo_tee: JACKET_TUXEDO_TEE,
  jacket_pool_float: JACKET_POOL_FLOAT,
  jacket_velour_tracksuit: JACKET_VELOUR_TRACKSUIT,
  jacket_letterman: JACKET_LETTERMAN,
  jacket_sandwich_board: JACKET_SANDWICH_BOARD,
  jacket_space_blanket: JACKET_SPACE_BLANKET,
  jacket_hot_dog: JACKET_HOT_DOG,
};
