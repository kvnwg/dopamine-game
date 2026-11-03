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
  '.k5w5544R44R32k.',
  '.k5455444RR332k.',
  '.k3333334RR332k.',
  '.k5w5544R44R32k.',
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
  '..kWWWw22w554k..',
  '.kWWWWw22wW554k.',
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
  '...kkkkkkkkkk...',
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

/** Gold sequin blazer with black satin lapels over a white shirt. */
const JACKET_SEQUIN_BLAZER: Rows = [
  '................',
  '.....kk..kk.....',
  '...kkY1kk1ykk...',
  '..kYw1xw5xxOOk..',
  '.kYYy1xw5xxYOOk.',
  '.kYyYy1xxxyyOOk.',
  '.kYyyyyyOyYyOOk.',
  '.kyYyYyyxyyyyOk.',
  '.kYyyyyyOyyYyOk.',
  '.kyYyYyyOyyyyOk.',
  '.kYyyyyyxyYyOOk.',
  '.kOOyYyyOyyyOok.',
  '..kkyyyyOyOOkk..',
  '....kkkkkkkk....',
  '................',
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

// ------------------------------------------------------------------ Gloves

/** A raccoon paw dipped in cheese puff dust: orange fingers, a dusty palm. */
const GLOVES_CHEESE_DUST: Rows = [
  '................',
  '.......kk.......',
  '....kkkyOkkk....',
  '...kyOkyOkyOkk..',
  '...kyOkyOkyOkOk.',
  '...kOOkOokOOkok.',
  '..kkOokOokOokok.',
  '.kOkOO2OO2OO2ok.',
  '.kOO2O22222O21k.',
  '.kO22222222211k.',
  '..k2222222221k..',
  '..k3222222221k..',
  '..k2222222211k..',
  '..k1111111111k..',
  '...kkkkkkkkkk...',
  '................',
];

/** Bread bag pulled over a paw: polka dots, a green twist tie at the wrist. */
const GLOVES_BREAD_BAGS: Rows = [
  '................',
  '......kkkkk.....',
  '.....kwwWW5k....',
  '....kwWRWWW5k...',
  '....kWWWWcW5k...',
  '...kkWyWWWR5k...',
  '..kwkWWWWWW5k...',
  '..kWWkWRWWyW5k..',
  '..kWcWkWWWWW5k..',
  '...kWWWWcWW55k..',
  '....kWWWWWW55k..',
  '....kkGGGGGGkk..',
  '...kW5WW5W5W5k..',
  '..kW5W55555W55k.',
  '...kkkkkkkkkkk..',
  '................',
];

/** A roll of toilet paper, its cardboard tube showing, a sheet hanging loose. */
const GLOVES_TOILET_PAPER: Rows = [
  '................',
  '....kkkkkkkk....',
  '...kwwWWWWW5k...',
  '..kwWWkttkWW5k..',
  '..kWWktbbtkW5k..',
  '..kWWWkttkW55k..',
  '..k5WWWWWW554k..',
  '..kwWWWWWW554k..',
  '..kWWWWWWW554k..',
  '..kwWkkkkkk54k..',
  '..kWkwWWW5k44k..',
  '..k5kW444Wk44k..',
  '...kkwWWW5kkk...',
  '....kW444Wk.....',
  '....kkkkkkk.....',
  '................',
];

/** Tin of tomato soup: red and white label, a gold medal, ridged rims. */
const GLOVES_SOUP_CANS: Rows = [
  '................',
  '....kkkkkkkk....',
  '...k5wwwww54k...',
  '...k34444443k...',
  '...keRRRRRRrk...',
  '...keRRRRRRrk...',
  '...keRRRRRRrk...',
  '...keRRYyRRrk...',
  '...kWWWyOWW5k...',
  '...kWWWWWWW5k...',
  '...kWWWWWWW5k...',
  '...kWWWWWW55k...',
  '...k45555554k...',
  '...k34444443k...',
  '....kkkkkkkk....',
  '................',
];

/** Blue sock puppet: googly eyes, a pink felt tongue, a white cuff. */
const GLOVES_SOCK_PUPPETS: Rows = [
  '................',
  '.....kkk.kkk....',
  '....kwwwkwwwk...',
  '....kwxwkwxwk...',
  '...kckkkUkkkUk..',
  '..kcUUUUUUUUUUk.',
  '..kcUUUUUUUUUuk.',
  '..kcUUUUUUUkkkk.',
  '..kUUUUUUUkqqPk.',
  '..kcUUUUUUUkkkk.',
  '..kuUUUUUUUuuk..',
  '...kWWWWWWW5k...',
  '...kcUUUUUUuk...',
  '...kkkkkkkkkk...',
  '................',
  '................',
];

/** Black fingerless biker glove: furry fingertips out, studded knuckles, a strap. */
const GLOVES_FINGERLESS_BIKER: Rows = [
  '................',
  '.......kk.......',
  '....kkkNnkkk....',
  '...kNnkNnkNnkk..',
  '...kNnkNnkNnknk.',
  '...k21k21k21k1k.',
  '..kk11k11k11k1k.',
  '.k2k2w12w12w11k.',
  '.k221111111111k.',
  '.k2111111111x1k.',
  '..k211111111xk..',
  '..k5w5555555xk..',
  '..k2111111111k..',
  '..kxxxxxxxxxxk..',
  '...kkkkkkkkkk...',
  '................',
];

/** Strawberry ice cream in a waffle cone, dripping. */
const GLOVES_ICE_CREAM_CONES: Rows = [
  '................',
  '......kkkk......',
  '....kkPwPPkk....',
  '...kPwPPPPPqk...',
  '..kPPPPPPPPqqk..',
  '..kPPPPPPPqqqk..',
  '..kqPPPPPqqqqk..',
  '..kkqqPqqqkqkk..',
  '...kTtTTtTTNk...',
  '...ktTNtTNtNk...',
  '....kTtTtTNk....',
  '....kNtNtNNk....',
  '.....kTtNNk.....',
  '......ktNk......',
  '.......kk.......',
  '................',
];

/** Blue foam finger: number one, the thumb out, a white cuff. */
const GLOVES_FOAM_FINGER: Rows = [
  '................',
  '......kkk.......',
  '.....kcUuk......',
  '.....kcUuk......',
  '.....kcUuk......',
  '..kk.kcUukkkk...',
  '.kcUkkcUukUUuk..',
  '.kcUUkcUUkUUuk..',
  '.kcUUUcUUUUUuk..',
  '..kcUUyyUUUUuk..',
  '..kcUUUyUUUUuk..',
  '..kcUUUyUUUuk...',
  '...kcUyyyUUuk...',
  '...kWWWWWW5k....',
  '....kkkkkkk.....',
  '................',
];

/** Red lobster claw mitt, its pincer open. */
const GLOVES_LOBSTER_CLAWS: Rows = [
  '................',
  '...kkk....kk....',
  '..keRRk..kRrk...',
  '.keRRRrk.kRrk...',
  '.keRPRrk..kRrk..',
  '.keRRRk...kRrk..',
  '.keRRk....kRrk..',
  '.keRRk...kRRrk..',
  '.keRRRkkkRRrk...',
  '..keRRRRRRRrk...',
  '..keRRPRRRrrk...',
  '...keRRRRrrk....',
  '....krRRRrrk....',
  '....krrrrrk.....',
  '.....kkkkk......',
  '................',
];

/** Takeout chopsticks fanned out like claws from their red paper sleeve. */
const GLOVES_CHOPSTICK_CLAWS: Rows = [
  '................',
  '.kk....kk....kk.',
  '.kTk...kTk..kTk.',
  '..kTk..kTk.kTk..',
  '..kTtk.kTk.kTk..',
  '...kTk.kTkkTk...',
  '...kTtkkTkkTk...',
  '....kTtkTktk....',
  '....kWWWWW5k....',
  '....keRRRRrk....',
  '....keRRRRrk....',
  '....keRRRRrk....',
  '....kWWWWW5k....',
  '....kttkTtkk....',
  '.....kk.kk......',
  '................',
];

// ------------------------------------------------------------------ Sneakers: side view, toe pointing right

/** Plastic grocery bag tied around a foot, THANK YOU printed in red. */
const SNEAKERS_GROCERY_BAGS: Rows = [
  '................',
  '................',
  '..kk...kk.......',
  '..kWk.kWk.......',
  '...kWkW5k.......',
  '....kWW5k.......',
  '...kwWW55k......',
  '..kwWWWW55kk....',
  '..kWRRRWWW55kk..',
  '.kwWWWWWWWWW55k.',
  '.kWRRWRRWRRWW5k.',
  '.k555555555544k.',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
  '................',
];

/** Red soda can stomped flat: crumpled, its silver rims at heel and toe. */
const SNEAKERS_CAN_STOMPERS: Rows = [
  '................',
  '................',
  '................',
  '..kkk..kk..kkk..',
  '.k5ekkkRRkkkRwk.',
  '.k4eRRrRRrRRR5k.',
  '.k5eRwwwRRrRR4k.',
  '.k4RRRwwwwRrR5k.',
  '.k5RrRRRwwRRr4k.',
  '.k4rRRrRRRrrr5k.',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
  '................',
  '................',
  '................',
];

/** Flowery tissue box worn as a slipper, a tissue puffing out the top. */
const SNEAKERS_TISSUE_BOXES: Rows = [
  '................',
  '................',
  '........kkk.....',
  '.......kwWWk....',
  '......kwW5W5k...',
  '.......kW55k....',
  '.kkkkkkkW5kkkkk.',
  '.kCCCCCCCCCCCck.',
  '.kcCWcccccWccUk.',
  '.kcWyWcccWyWcUk.',
  '.kccWcccccWcUUk.',
  '.kUUUUUUUUUUUuk.',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
  '................',
];

/** Red canvas high-top: white toe cap, laces and ankle patch. */
const SNEAKERS_HIGH_TOPS: Rows = [
  '................',
  '................',
  '..kkkk..........',
  '..keRrk.........',
  '..kwWRk.........',
  '..kWwRrk........',
  '..keRRwRk.......',
  '..keRRRwRkk.....',
  '..keRRRRwRRkk...',
  '.keRRRRRRRwRWWk.',
  '.kWWWWWWWWWWW5k.',
  '.k444444444443k.',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
  '................',
];

/** White tube sock with red and blue stripes in a brown leather sandal. */
const SNEAKERS_SOCKS_AND_SANDALS: Rows = [
  '................',
  '..kkkk..........',
  '..kRRrk.........',
  '..kwWWk.........',
  '..kUUuk.........',
  '..kwWW5k........',
  '..kwWW55kk......',
  '..kNNNNnW5kk....',
  '.kwWWWWWWW55kk..',
  '.kwWWWWWNNNNn5k.',
  '.kbnnnnnnnnnnbk.',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
  '................',
  '................',
];

/** Rental bowling shoe: red heel and toe, tan laced middle, a size on the heel. */
const SNEAKERS_BOWLING_SHOES: Rows = [
  '................',
  '................',
  '................',
  '................',
  '...kkk..........',
  '..kRRrkkk.......',
  '.kRWRrTTTkkk....',
  '.kRRRrTxTxTRkk..',
  '.kRRRrTTxTxRRRk.',
  '.kRRRrTTTTTRRrk.',
  '.kWWWWWWWWWWW5k.',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
  '................',
  '................',
];

/** Swim flipper: a dark foot pocket, a long ribbed aqua blade. */
const SNEAKERS_FLIPPERS: Rows = [
  '................',
  '................',
  '................',
  '................',
  '..kkkk..........',
  '.kaaagk.........',
  '.kagggakkkkkkk..',
  '.kgggggAAAAAAAk.',
  '.kggggaaaaaaaak.',
  '..kkggagaagaagk.',
  '....kkkkkkkkkkk.',
  '................',
  '................',
  '................',
  '................',
  '................',
];

/** Brown cowboy boot: stitched shaft, stacked heel, pointy toe, a silver spur. */
const SNEAKERS_COWBOY_BOOTS: Rows = [
  '................',
  '....kkkkkk......',
  '....kNtNnk......',
  '....kNTNnk......',
  '....kNtTnk......',
  '....kNTtnk......',
  '....kNtNnk......',
  '....kNNNnkk.....',
  '....kNNNNNnkk...',
  '....kNNNNNNNnkk.',
  '..kkkNNNNNNNNnk.',
  '.k5wkbbkkkkkkkk.',
  '..kk.kk.........',
  '................',
  '................',
  '................',
];

/** Big red clown shoe: a huge round toe, a yellow bow. */
const SNEAKERS_CLOWN_SHOES: Rows = [
  '................',
  '................',
  '.........kkkk...',
  '........keRRrk..',
  '.......keRwRRrk.',
  '..kkk..kRRRRRrk.',
  '.kyyyk.kRRRRRrk.',
  '.kRyRRkRRRRRRrk.',
  '.kRRRRRRRRRRrrk.',
  '.keRRRRRRRRRrrk.',
  '.kWWWWWWWWWWW5k.',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
  '................',
  '................',
];

// ------------------------------------------------------------------ Unique: richer detail and a gold sparkle

/** The sneaker hanging over the power line by its lace: white and red, a gold sole, a sparkle. */
const SNEAKERS_UNIQUE_POWER_LINE: Rows = [
  '................',
  '............k...',
  '...........kYk..',
  '..........kYwYk.',
  '......kk...kYk..',
  '.....kwwk...k...',
  '.kkkkkwkkkkkkkk.',
  '.....kwk........',
  '...kkkwkk.......',
  '..kwWWwRkkk.....',
  '..kwRRWWRWWkk...',
  '.kwWWWRRWWWW5k..',
  '.kWWWWWWWWWWW5k.',
  '.kyyyyyyyyyyyyk.',
  '..kkkkkkkkkkkk..',
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
  jacket_sequin_blazer: JACKET_SEQUIN_BLAZER,
  jacket_hot_dog: JACKET_HOT_DOG,
  gloves_cheese_dust: GLOVES_CHEESE_DUST,
  gloves_bread_bags: GLOVES_BREAD_BAGS,
  gloves_toilet_paper: GLOVES_TOILET_PAPER,
  gloves_soup_cans: GLOVES_SOUP_CANS,
  gloves_sock_puppets: GLOVES_SOCK_PUPPETS,
  gloves_fingerless_biker: GLOVES_FINGERLESS_BIKER,
  gloves_ice_cream_cones: GLOVES_ICE_CREAM_CONES,
  gloves_foam_finger: GLOVES_FOAM_FINGER,
  gloves_lobster_claws: GLOVES_LOBSTER_CLAWS,
  gloves_chopstick_claws: GLOVES_CHOPSTICK_CLAWS,
  sneakers_grocery_bags: SNEAKERS_GROCERY_BAGS,
  sneakers_can_stompers: SNEAKERS_CAN_STOMPERS,
  sneakers_tissue_boxes: SNEAKERS_TISSUE_BOXES,
  sneakers_high_tops: SNEAKERS_HIGH_TOPS,
  sneakers_socks_and_sandals: SNEAKERS_SOCKS_AND_SANDALS,
  sneakers_bowling_shoes: SNEAKERS_BOWLING_SHOES,
  sneakers_flippers: SNEAKERS_FLIPPERS,
  sneakers_cowboy_boots: SNEAKERS_COWBOY_BOOTS,
  sneakers_clown_shoes: SNEAKERS_CLOWN_SHOES,
  sneakers_unique_power_line: SNEAKERS_UNIQUE_POWER_LINE,
};
