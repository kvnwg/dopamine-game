/**
 * More item icons (arms group), drawn to the same rules as src/render/pixel/items.ts (16x16, one ink
 * outline, three tones per material lit from the top left, natural colors; the slot conventions in
 * that file's header). Merged into ITEM_SPRITES there.
 */
import type { Rows } from '../buf';

// ------------------------------------------------------------------ Weapons: diagonal, grip at the bottom left, business end at the top right

/** Toilet plunger: a red rubber cup, its rim facing out, on a wooden handle. */
const WEAPON_PLUNGER: Rows = [
  '................',
  '........kk......',
  '.......kerk.....',
  '......keeRrk....',
  '......keRRRrk...',
  '......keRRRRrk..',
  '.......keRRRRrk.',
  '......ktRRRrrrk.',
  '.....ktnkkrrrk..',
  '....ktnk..kkk...',
  '...ktnk.........',
  '..ktnk..........',
  '.ktnk...........',
  '.knk............',
  '..k.............',
  '................',
];

/** Green plastic fly swatter, its square head full of holes. */
const WEAPON_FLY_SWATTER: Rows = [
  '................',
  '..........k.....',
  '.........kLk....',
  '........kLllk...',
  '.......kLglglk..',
  '......kLllgllGk.',
  '.......klglgGk..',
  '......klGllGk...',
  '.....klGkkGk....',
  '....klGk..k.....',
  '...klGk.........',
  '..klGk..........',
  '.klGk...........',
  '.kGk............',
  '..k.............',
  '................',
];

/** Feather duster: a fluffy purple plume bound to a wooden handle. */
const WEAPON_FEATHER_DUSTER: Rows = [
  '................',
  '.........kk.kk..',
  '........kMMkmVk.',
  '........kMmmmVk.',
  '.......kkmVVVvk.',
  '......kMMmmmmVk.',
  '......kMmmVmVvk.',
  '......kmVVVvvk..',
  '.....kMmmVvkk...',
  '....kMmVvkk.....',
  '...k21kkk.......',
  '..ktnk..........',
  '.ktnk...........',
  '.knk............',
  '..k.............',
  '................',
];

/** A stale baguette, scored on top. */
const WEAPON_BAGUETTE: Rows = [
  '................',
  '............kk..',
  '...........kTtk.',
  '..........kWWNk.',
  '.........kTtNk..',
  '........kTtNk...',
  '.......kWWNk....',
  '......kTtNk.....',
  '.....kTtNk......',
  '....kWWNk.......',
  '...kTtNk........',
  '..kTtNk.........',
  '.kTtNk..........',
  '.ktNk...........',
  '..kk............',
  '................',
];

/** Golf club with its shaft bent halfway: black grip, a steel iron head. */
const WEAPON_GOLF_CLUB: Rows = [
  '................',
  '.........kk.....',
  '........k55kkk..',
  '........k5w544k.',
  '........k4kk43k.',
  '........k4k.kk..',
  '........k4k.....',
  '.......k4k......',
  '......k4k.......',
  '.....k4k........',
  '....k3k.........',
  '...k22k.........',
  '..k2x1k.........',
  '..kx1k..........',
  '...kk...........',
  '................',
];

/** Tennis racket: a red frame, strings, a taped grip. */
const WEAPON_TENNIS_RACKET: Rows = [
  '................',
  '.........kkkk...',
  '........keeRRk..',
  '.......ke5454Rk.',
  '......ke54545Rk.',
  '.....keR45454rk.',
  '.....kR545454rk.',
  '.....kR45454rk..',
  '.....kkR54rrk...',
  '....kW5Rrrrk....',
  '...kWW5kkkk.....',
  '..kW5Wk.........',
  '.kW5W4k.........',
  '.k54kk..........',
  '..kk............',
  '................',
];

/** Snow shovel: a wide blue plastic blade with a steel edge, a wooden shaft and a D-grip. */
const WEAPON_SNOW_SHOVEL: Rows = [
  '................',
  '........k.......',
  '.......k5k......',
  '......kCc5k.....',
  '.....kCccc5k....',
  '......kUccc5k...',
  '.......kUccc5k..',
  '......kTtUccc4k.',
  '.....kTtkkUcUk..',
  '....kTtk..kuk...',
  '..kkTtk....k....',
  '.k221k..........',
  '.k2kxk..........',
  '.k1xxk..........',
  '..kkk...........',
  '................',
];

/** Pool cue: a dark butt with a pearl inlay, a maple shaft, a chalked blue tip. */
const WEAPON_POOL_CUE: Rows = [
  '................',
  '.............k..',
  '............kck.',
  '...........kWk..',
  '..........kTk...',
  '........kkTk....',
  '.......kTtk.....',
  '......kTtk......',
  '.....kTtk.......',
  '....k54k........',
  '...kNnbk........',
  '..kNWbk.........',
  '.kNnbk..........',
  '.knbk...........',
  '..kk............',
  '................',
];

/** Rubber chicken, held by the feet: long floppy neck, red comb, open beak. */
const WEAPON_RUBBER_CHICKEN: Rows = [
  '................',
  '..........kkk...',
  '.........kRRek..',
  '........kWWWkk..',
  '........kWkWOOk.',
  '........kWWYkkk.',
  '.......kYWYk....',
  '......kYWYk.....',
  '.....kYWWYyk....',
  '....kYWWYyyk....',
  '....kYWYyyk.....',
  '....kyyyyk......',
  '...kOkOkk.......',
  '..kOkOk.........',
  '...k.k..........',
  '................',
];

/** Croquet mallet: a wooden head with blue bands on a long shaft. */
const WEAPON_CROQUET_MALLET: Rows = [
  '................',
  '........kkk.....',
  '.......kTTck....',
  '......kTtUTTk...',
  '......kNUtttTk..',
  '.......kNttttck.',
  '.......kTNNtUNk.',
  '......kTtkNuNnk.',
  '.....kTtk.knnk..',
  '....kTtk...kk...',
  '...kTtk.........',
  '..kTtk..........',
  '.kTtk...........',
  '.kNk............',
  '..k.............',
  '................',
];

/** Pink plastic lawn flamingo on its wire legs. */
const WEAPON_LAWN_FLAMINGO: Rows = [
  '................',
  '..........kk....',
  '.........kPPk...',
  '.........kPqk...',
  '..........kPWk..',
  '.......kkkPqk1k.',
  '......kPPwPqkk..',
  '.....kPwPPqqk...',
  '.....kPPPqqk....',
  '......kqqqk.....',
  '.....k4k4k......',
  '....k4k4k.......',
  '...k4k3k........',
  '..k3kkk.........',
  '..kk............',
  '................',
];

/** Selfie stick: a phone in its clamp on a telescoping pole, a black grip. */
const WEAPON_SELFIE_STICK: Rows = [
  '................',
  '.........kkkk...',
  '........kxxx1k..',
  '........kxCcxk..',
  '........kxcc1k..',
  '........kxcU1k..',
  '........kx111k..',
  '.......k4kkkk...',
  '......k4k.......',
  '.....k5k........',
  '....k4k.........',
  '...k43k.........',
  '..kx1k..........',
  '..k1k...........',
  '...k............',
  '................',
];

/** A whole fish skewered on a stick, fresh from somebody's cooler. */
const WEAPON_FISH_ON_A_STICK: Rows = [
  '................',
  '..........kk....',
  '.........kCck...',
  '..........kckk..',
  '........kkcUUuk.',
  '.......kCccUkuk.',
  '......kCcc5k.k..',
  '.....kCcU54k....',
  '.....kcx54k.....',
  '....ktc54k......',
  '...ktnkkk.......',
  '..ktnk..........',
  '.ktnk...........',
  '.knk............',
  '..k.............',
  '................',
];

// ------------------------------------------------------------------ Shields: front view

/** Pizza box: kraft cardboard, a pizza printed on the lid, a grease spot. */
const SHIELD_PIZZA_BOX: Rows = [
  '................',
  '................',
  '.kkkkkkkkkkkkkk.',
  '.kTTTTTTTTTTTTk.',
  '.kTttttttttttNk.',
  '.kTtttOOOOtttNk.',
  '.kTttOYyyyottNk.',
  '.kTttOyRyyottNk.',
  '.kTttOyyyRottNk.',
  '.kTNNORyyyottNk.',
  '.kTNttooootttNk.',
  '.kNNNNNNNNNNNNk.',
  '.knnnnnnnnnnnnk.',
  '.kkkkkkkkkkkkkk.',
  '................',
  '................',
];

/** Teal cafeteria tray: mashed potatoes, peas, mystery meat and a red jello cube. */
const SHIELD_CAFETERIA_TRAY: Rows = [
  '................',
  '................',
  '.kkkkkkkkkkkkkk.',
  '.kAAAAAAAAAAAAk.',
  '.kAggggggAgggak.',
  '.kAgtNNnaAgWWak.',
  '.kAgNNnnaAgN5ak.',
  '.kAgaaaaaAgaaak.',
  '.kAAAAAAAAAAAak.',
  '.kAggggAgggggak.',
  '.kAgllGAgaeRaak.',
  '.kAgGlaAgaRraak.',
  '.kagggggggggggk.',
  '.kkkkkkkkkkkkkk.',
  '................',
  '................',
];

/** Black cast iron frying pan with an egg in it. */
const SHIELD_FRYING_PAN: Rows = [
  '................',
  '.....kkkk.......',
  '....k3333k......',
  '...k311112k.....',
  '..k31www112k....',
  '.k31wYyww11xk...',
  '.k31wyOw511xk...',
  '.k31wwww511xk...',
  '.k311ww5111xk...',
  '..k2111111xk....',
  '...k21111xx2k...',
  '....kxxxxkx22k..',
  '.....kkkk.kx22k.',
  '...........kxxk.',
  '............kk..',
  '................',
];

/** Yellow wet floor sign with a big black exclamation mark, standing in its own puddle. */
const SHIELD_WET_FLOOR_SIGN: Rows = [
  '................',
  '......kkkk......',
  '.....kYyyOk.....',
  '.....kYkkOk.....',
  '....kYyyyyOk....',
  '....kYyxxyOk....',
  '...kYyyxxyyOk...',
  '...kYyyxxyyOk...',
  '..kYyyyyyyyyOk..',
  '..kYyyyxxyyyOk..',
  '.kYyyyyyyyyyyOk.',
  '.kOOOOOOOOOOOOk.',
  '.kOkkkkkkkkkkOk.',
  '.kkkCccccccUkkk.',
  '...kkkkkkkkkk...',
  '................',
];

/** Red STOP sign on a stub of its post. */
const SHIELD_STOP_SIGN: Rows = [
  '................',
  '....kkkkkkk.....',
  '...kwwwwwwwk....',
  '..kwReeeeeRwk...',
  '.kwRReeRRRRrwk..',
  '.kwwwRwwwRwwwk..',
  '.kwRRRRwRRwRwk..',
  '.kwwwRRwRRwwwk..',
  '.kwRRRRRRRRrwk..',
  '..kwRrrrrrrwk...',
  '...kwwwwwwwk....',
  '....kkk4kkk.....',
  '......k4k.......',
  '......k3k.......',
  '......kkk.......',
  '................',
];

/** Black vinyl record: a sheen on its grooves, a red label round the hole. */
const SHIELD_VINYL_RECORD: Rows = [
  '................',
  '.....kkkkk......',
  '....k22221k.....',
  '...k2111111k....',
  '..k213311111k...',
  '.k2131eeR1111k..',
  '.k211eeRRR11xk..',
  '.k211eRkRr11xk..',
  '.k211RRRrr11xk..',
  '.k1111Rrr121xk..',
  '..k11111221xk...',
  '...k111111xk....',
  '....k1xxxxk.....',
  '.....kkkkk......',
  '................',
  '................',
];

/** Dartboard with a dart stuck in it. */
const SHIELD_DARTBOARD: Rows = [
  '................',
  '.....kkkkk.kk...',
  '....kxxxxxkeRk..',
  '...kxGRRRGx4rk..',
  '..kxGGWWWG5xk...',
  '.kxGGxxWxxGGxk..',
  '.kxRWxGGGxWRxk..',
  '.kxRWWGRGWWRxk..',
  '.kxRWxGGGxWRxk..',
  '.kxGGxxWxxGGxk..',
  '..kxGGWWWGGxk...',
  '...kxGRRRGxk....',
  '....kxxxxxk.....',
  '.....kkkkk......',
  '................',
  '................',
];

/** Cast iron manhole cover with a raised grid. */
const SHIELD_MANHOLE_COVER: Rows = [
  '................',
  '.....kkkkk......',
  '....k44444k.....',
  '...k4223223k....',
  '..k443343343k...',
  '.k42322322321k..',
  '.k42322322321k..',
  '.k43433433431k..',
  '.k42322322321k..',
  '.k42322322321k..',
  '..k343343341k...',
  '...k3223221k....',
  '....k11111k.....',
  '.....kkkkk......',
  '................',
  '................',
];

/** Inflatable pool float: a pink frosted donut with sprinkles. */
const SHIELD_DONUT_FLOAT: Rows = [
  '................',
  '.....kkkkkk.....',
  '...kkwPPPPPkk...',
  '..kwPcPPPYPPqk..',
  '.kwPPPPlPPPPPqk.',
  '.kPYPPkkkkPcPqk.',
  '.kPPPk....kPqqk.',
  '.kPcPk....kPYqk.',
  '.ktPqk....kqqtk.',
  '.kTtqqkkkkqqttk.',
  '.kTtttqqqqqtttk.',
  '..kNtttttttttNk.',
  '...kkNNNNNNNkk..',
  '.....kkkkkkk....',
  '................',
  '................',
];

/** Satellite dish on its stand, the arm holding its receiver out front. */
const SHIELD_SATELLITE_DISH: Rows = [
  '................',
  '..........kk....',
  '...kkkk..k11k...',
  '..k5444kkk21k...',
  '.k25334442kk....',
  '.k25333424k.....',
  '.k25334244k.....',
  '.k225444454k....',
  '.k225444554k....',
  '..k22555554k....',
  '...k1115555k....',
  '...k211111k.....',
  '...k1kkkkk......',
  '..k211k.........',
  '...kkk..........',
  '................',
];

// ------------------------------------------------------------------ Unique: richer detail and a gold sparkle

/** The glow stick of the final rave: a lime glow stick blade on a taped flashlight hilt, a sparkle. */
const WEAPON_UNIQUE_GLOW_SABER: Rows = [
  '................',
  '...k.......kkk..',
  '..kYk.....kwLLk.',
  '.kYwYk...kwLlk..',
  '..kYk...kwLlk...',
  '...k...kwLlk....',
  '......kwLlk.....',
  '.....kwLlk......',
  '....k5kkk.......',
  '...k55xk........',
  '..k54xk.........',
  '.k5R3k..........',
  '.kx3xk..........',
  '..kkk...........',
  '................',
  '................',
];

export const SPRITES: Record<string, Rows> = {
  weapon_plunger: WEAPON_PLUNGER,
  weapon_fly_swatter: WEAPON_FLY_SWATTER,
  weapon_feather_duster: WEAPON_FEATHER_DUSTER,
  weapon_baguette: WEAPON_BAGUETTE,
  weapon_golf_club: WEAPON_GOLF_CLUB,
  weapon_tennis_racket: WEAPON_TENNIS_RACKET,
  weapon_snow_shovel: WEAPON_SNOW_SHOVEL,
  weapon_pool_cue: WEAPON_POOL_CUE,
  weapon_rubber_chicken: WEAPON_RUBBER_CHICKEN,
  weapon_croquet_mallet: WEAPON_CROQUET_MALLET,
  weapon_lawn_flamingo: WEAPON_LAWN_FLAMINGO,
  weapon_selfie_stick: WEAPON_SELFIE_STICK,
  weapon_fish_on_a_stick: WEAPON_FISH_ON_A_STICK,
  weapon_unique_glow_saber: WEAPON_UNIQUE_GLOW_SABER,
  shield_pizza_box: SHIELD_PIZZA_BOX,
  shield_cafeteria_tray: SHIELD_CAFETERIA_TRAY,
  shield_frying_pan: SHIELD_FRYING_PAN,
  shield_wet_floor_sign: SHIELD_WET_FLOOR_SIGN,
  shield_stop_sign: SHIELD_STOP_SIGN,
  shield_vinyl_record: SHIELD_VINYL_RECORD,
  shield_dartboard: SHIELD_DARTBOARD,
  shield_manhole_cover: SHIELD_MANHOLE_COVER,
  shield_donut_float: SHIELD_DONUT_FLOAT,
  shield_satellite_dish: SHIELD_SATELLITE_DISH,
};

/** Where the paw holds each of these weapons (see WEAPON_GRIP in items.ts). */
export const GRIPS: Record<string, { x: number; y: number }> = {
  weapon_plunger: { x: 3, y: 12 },
  weapon_fly_swatter: { x: 3, y: 12 },
  weapon_feather_duster: { x: 3, y: 12 },
  weapon_baguette: { x: 3, y: 12 },
  weapon_golf_club: { x: 3, y: 12 },
  weapon_tennis_racket: { x: 3, y: 12 },
  weapon_snow_shovel: { x: 2, y: 12 },
  weapon_pool_cue: { x: 3, y: 12 },
  weapon_rubber_chicken: { x: 4, y: 12 },
  weapon_croquet_mallet: { x: 3, y: 12 },
  weapon_lawn_flamingo: { x: 4, y: 12 },
  weapon_selfie_stick: { x: 3, y: 12 },
  weapon_fish_on_a_stick: { x: 3, y: 12 },
  weapon_unique_glow_saber: { x: 3, y: 11 },
};

/** Weapons not drawn on the 45 degree diagonal (see WEAPON_ART_TILT in items.ts). */
export const TILTS: Record<string, number> = {};
