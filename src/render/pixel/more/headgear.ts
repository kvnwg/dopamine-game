/**
 * More item icons (headgear group), drawn to the same rules as src/render/pixel/items.ts (16x16, one ink
 * outline, three tones per material lit from the top left, natural colors; the slot conventions in
 * that file's header). Merged into ITEM_SPRITES there.
 */
import type { Rows } from '../buf';

// ------------------------------------------------------------------ Hats: upright, brim or opening on rows 12 to 14

/** Open takeout box: noodles heaped up, chopsticks stuck in, a red band. */
const HAT_TAKEOUT_BOX: Rows = [
  '................',
  '...........kk...',
  '..........kTtk..',
  '.........kTtk...',
  '.kk.....kTtk..kk',
  'kWwk.kkkTtkkk5Wk',
  'kwWWkyYTtyyyk55k',
  '.kWWwYYyyyyO555k',
  '..kwwwwwwwwW55k.',
  '..kRRRRRRRRRrrk.',
  '..kWWWWWWWWW55k.',
  '...kWWWWWWWW5k..',
  '...kWWWWWWW55k..',
  '...k555555544k..',
  '....kkkkkkkkk...',
  '................',
];

/** Green ball cap, its brim bent down hard. */
const HAT_BENT_CAP: Rows = [
  '................',
  '................',
  '.........kkk....',
  '.......kkGlGkk..',
  '......kGllGGGGk.',
  '.....kGlGGGgGGgk',
  '....kGlGGGGgGGgk',
  '....kGlGGGGgGGgk',
  '...kGlGGGGGgGGgk',
  '...kGGGGGGGgGggk',
  '..kkgggggggggggk',
  '.klllllllGgkkkk.',
  'kLllllllGGgk....',
  'kGGGGGGGggk.....',
  '.kkkkkkkkk......',
  '................',
];

/** Lilac motel shower cap with white dots and a frilly elastic edge. */
const HAT_SHOWER_CAP: Rows = [
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '...kkMMMMMmkk...',
  '..kMMwMMMmmmmk..',
  '.kMMMMMmmmwmmVk.',
  '.kMwMmmmmmmmmVk.',
  'kMMMmmmwmmmmVVVk',
  'kMmmmmmmmmwmVVVk',
  'kmmmmmmmmmmmVVVk',
  'kkMMMMMMMMMMMmkk',
  'kMMkMMkMMkMMkMmk',
  '.kk.kk.kk.kk.kk.',
  '................',
  '................',
];

/** Blue birthday party hat with pink dots and a gold tinsel pompom. */
const HAT_PARTY_HAT: Rows = [
  '................',
  '.......kk.......',
  '......kYyk......',
  '.....kYYyOk.....',
  '.....kyyOOk.....',
  '......kkkk......',
  '......kCck......',
  '.....kCccUk.....',
  '.....kCqcUk.....',
  '....kCcccUUk....',
  '....kCcccqUk....',
  '...kCqcccUUUk...',
  '...kCcccqcUUk...',
  '..kCCcccccUUUk..',
  '..kkkkkkkkkkkk..',
  '................',
];

/** Steel colander upside down: its foot ring on top, rows of holes, a handle each side. */
const HAT_COLANDER: Rows = [
  '................',
  '................',
  '......kkkk......',
  '.....kw554k.....',
  '....kkkkkkkk....',
  '...k5w555554k...',
  '..k5w2552552k...',
  '..k55555555544k.',
  'kkk5255255254kkk',
  'k4k5555555544k3k',
  'kkk4525525243kkk',
  '..k4444444443k..',
  '.kw55555555544k.',
  '.k333333333333k.',
  '..kkkkkkkkkkkk..',
  '................',
];

/** Crumpled tinfoil cone, the tip twisted over. */
const HAT_TINFOIL: Rows = [
  '................',
  '..........kk....',
  '.........kwwk...',
  '........kw4kk...',
  '.......kw54k....',
  '......kww544k...',
  '......kw5w443k..',
  '.....kw55w4433k.',
  '.....kw555w433k.',
  '....kww555w4433k',
  '....kw5w555w433k',
  '...kw5w5555w433k',
  '..kw55w55554w43k',
  '..k5k55kk4k44k3k',
  '...k.kk..k.kk.k.',
  '................',
];

/** Pink lampshade, its top opening dark, a gold fringe round the bottom. */
const HAT_LAMPSHADE: Rows = [
  '................',
  '................',
  '.....kkkkkk.....',
  '....kPxxxxqk....',
  '....kwPPPPqk....',
  '...kwwPPPPPqk...',
  '...kwPPPPPPqk...',
  '..kwwPPPPPPPqk..',
  '..kwPPPPPPPPqk..',
  '.kwwPPPPPPPPPqk.',
  '.kwPPPPPPPPPqqk.',
  'kOyyyyyyyyyyyyOk',
  'kykykykykykykyOk',
  '.k.k.k.k.k.k.kk.',
  '................',
  '................',
];

/** Jack-o'-lantern lid: ribbed orange, a green stem, the zigzag cut on its rim. */
const HAT_PUMPKIN_LID: Rows = [
  '................',
  '................',
  '........kk......',
  '.......kGgk.....',
  '.......kGk......',
  '....kkkkGkkkk...',
  '...kyOOkgkOOok..',
  '..kyyOOoOOOOook.',
  '..kyOOOoOOOOook.',
  '.kyyOOOoOOOOoook',
  '.kyOOOoOOOOoOook',
  '.kyOOOoOOOOoOook',
  '.kYkYYkYYkYYkYYk',
  '..k..k..k..k..k.',
  '................',
  '................',
];

/** Twig nest from the gutter with three robin's eggs. */
const HAT_BIRD_NEST: Rows = [
  '................',
  '................',
  '................',
  '................',
  '.......kk.......',
  '...kk.kwAk.kk...',
  '..kwAkkAAakwAk..',
  '..kAAakAaakAAak.',
  '.ktNtnNtNnNtNnk.',
  'ktNnNtnNtNnNtnNk',
  'kNnbNnNbnNnbNnbk',
  '.knNbnNnbNnbnbk.',
  '..kbnbnbnbnbbk..',
  '...kkkkkkkkkk...',
  '................',
  '................',
];

/** Tall pleated chef's toque. */
const HAT_CHEF_TOQUE: Rows = [
  '................',
  '.....kkk.kkk....',
  '...kkwwWkwWW5k..',
  '..kwwWWWkWWW55k.',
  '.kwwWWWWWWWWW55k',
  '.kwWWWWWWWWWW55k',
  '.kWWWWWWWWWWW55k',
  '..kWWWWWWWW555k.',
  '...kWW5WW5WW5k..',
  '...kWW5WW5WW5k..',
  '...kWW5WW5WW5k..',
  '...kWW5WW5WW5k..',
  '...k555555555k..',
  '....kkkkkkkkk...',
  '................',
  '................',
];

/** Propeller beanie: four bright panels, a red and yellow propeller on top. */
const HAT_PROPELLER_BEANIE: Rows = [
  '................',
  '.kkkk....kkkk...',
  'kRRRRkkkkyyyyk..',
  '.kkkkkO4kkkkk...',
  '......kk........',
  '....kkkkkkkk....',
  '...kRRRyyyUUk...',
  '..kRRRRyyyUUUk..',
  '..keRRRyyycUUk..',
  '.keRRRRyyyUUUuk.',
  '.kRRRRRyyyUUUuk.',
  '.krrrrrOOOuuuuk.',
  '.kGGGGGGGGGGGgk.',
  '.kgggggggggggggk',
  '..kkkkkkkkkkkkk.',
  '................',
];

/** Black graduation mortarboard, a gold tassel hanging off the side. */
const HAT_GRADUATION_CAP: Rows = [
  '................',
  '................',
  '......kkkk......',
  '....kk2222kk....',
  '..kk22222222kk..',
  'kk22222yy2211kk.',
  '.kk1111yy1111xkk',
  '...kk111111xkkyk',
  '....kkkkkkkk.kyk',
  '....kxx11xxk.kyk',
  '....k111111k.kYk',
  '....k1x11x1k.kyk',
  '....kxxxxxxk.kOk',
  '.....kkkkkk...k.',
  '................',
  '................',
];

/** Granny's china teapot: white with a blue band, spout and handle. */
const HAT_TEAPOT: Rows = [
  '................',
  '.......kk.......',
  '......kwWk......',
  '......kkkk......',
  '.....kwWW5k.....',
  'kk...kkkkkk.....',
  'kwk.kwwWWW5k....',
  'kWk.kwWWWWW5kkk.',
  '.kWkwWUUUUW55k5k',
  '.kWWwUWWWWU55k5k',
  '..kWwWUUUUW55k5k',
  '...kwWWWWW5kkkk.',
  '....k555544k....',
  '....kkkkkkkk....',
  '................',
  '................',
];

// ------------------------------------------------------------------ Masks: front view of what covers the face

/** Brown paper bag: crumpled top, two eye holes, a marker smile. */
const MASK_PAPER_BAG: Rows = [
  '................',
  '..kk.kkk.kk.kk..',
  '.kTTkTTTkTTkTtk.',
  '.kTTTTTTTTTTttk.',
  '.kTttTTTTTTtttk.',
  '.kTTTTTTTTTTttk.',
  '.kTTkkTTTTkktNk.',
  '.kTTkkTTTTkktNk.',
  '.kTTTTTTTTTttNk.',
  '.kTTTTTTTTTttNk.',
  '.kTTnTTTTTnttNk.',
  '.kTTTnnnnnTttNk.',
  '.kTTTTTTTTTttNk.',
  '.ktttttttttNNNk.',
  '..kkkkkkkkkkkk..',
  '................',
];

/** Red foam clown nose on its black elastic. */
const MASK_CLOWN_NOSE: Rows = [
  '................',
  '................',
  '................',
  '......kkkk......',
  '....kkeeeRkk....',
  '...keewweRRrk...',
  '...kewwRRRRrk...',
  'xxkeeRRRRRRrrkxx',
  '..keRRRRRRRrrk..',
  '..kRRRRRRRrrrk..',
  '...kRRRRRrrrk...',
  '...krRRrrrrrk...',
  '....kkrrrrkk....',
  '......kkkk......',
  '................',
  '................',
];

/** Fake Santa beard: sideburns, a curly mustache over the mouth, a fluffy white beard. */
const MASK_SANTA_BEARD: Rows = [
  '................',
  '................',
  '..kk........kk..',
  '.kwWk......kW5k.',
  '.kwWWk....kWW5k.',
  '.kwWWkkkkkkWW5k.',
  'kwWkwwWWWW55kW5k',
  'kwWWkkk55kkkWW5k',
  'kwWWWWkxxkWWWW5k',
  'kwWW5WWkkWW5WW5k',
  '.kWWW5WWWW5WW5k.',
  '.kWW5WW5WW5W5k..',
  '..kWWW5WW5WW5k..',
  '...kWW5WW5W5k...',
  '....kkWWW55k....',
  '......kkkk......',
];

/** Fake nose and glasses: bushy brows, thick frames, a big pink nose and a mustache. */
const MASK_GROUCHO_GLASSES: Rows = [
  '................',
  '................',
  '..kkkkk..kkkkk..',
  '.kx1111kk1111xk.',
  '..kkkkk..kkkkk..',
  'kkkkkkkkkkkkkkkk',
  'kkCwCCkkkkCwCCkk',
  '.kCCCck.kkCCCck.',
  '.kkkkkkksskkkkk.',
  '.......ksssk....',
  '......ksssSSk...',
  '...kkkksSSSkkkk.',
  '..kbnnnkkkknnnbk',
  '...kbbbnnnnbbbk.',
  '....kkkkkkkkkk..',
  '................',
];

/** Two cucumber slices: dark rind, pale flesh, seeds in the middle. */
const MASK_CUCUMBER_SLICES: Rows = [
  '................',
  '................',
  '................',
  '..kkkk....kkkk..',
  '.kGGGGk..kGGGGk.',
  'kGLLLlgkkGLLLlgk',
  'kGLLWLgkkGLLWLgk',
  'kGLLLlgkkGLLLlgk',
  'kGLWlWgkkGLWlWgk',
  'kGlllggkkGlllggk',
  '.kgggk....kgggk.',
  '..kkk......kkk..',
  '................',
  '................',
  '................',
  '................',
];

/** Ski goggles: a white frame, a gold mirror lens, a blue strap. */
const MASK_SKI_GOGGLES: Rows = [
  '................',
  '................',
  '................',
  '................',
  '..kkkkkkkkkkkk..',
  '.kwwwwwwwwwww5k.',
  'kkwYYwYYYYYYy5kk',
  'Ukwyyyyyyyyyy5kU',
  'UkwyyyyyyyyyO5kU',
  'kkwOOOOkkOOOO5kk',
  '.k5555k..k5555k.',
  '..kkkk....kkkk..',
  '................',
  '................',
  '................',
  '................',
];

/** Glasses with two big googly eyes, the pupils looking two ways at once. */
const MASK_GOOGLY_GLASSES: Rows = [
  '................',
  '................',
  '..kkkkk..kkkkk..',
  '.kwwwwwkkwwwwwk.',
  'kwwwwww5kwwwxx5k',
  'kwwwwww5kwwwxx5k',
  'kwwwwww5kwwwww5k',
  'kxxwwww5kwwwww5k',
  'kxxwww55kwwww55k',
  '.k5555kk.k5555k.',
  '..kkkkk..kkkkk..',
  '................',
  '................',
  '................',
  '................',
  '................',
];

/** Black welding mask with a flame decal and a dark green window. */
const MASK_WELDING: Rows = [
  '................',
  '....kkkkkkkk....',
  '...k22222221k...',
  '..k2222222211k..',
  '..k2kkkkkkk11k..',
  '.kk2kgGGGgk11kk.',
  'k3k2kggggxk11k3k',
  '.kk2kkkkkkk11kk.',
  '..k2222222211k..',
  '..k22yy2yy211k..',
  '..k2yOOyOOy11k..',
  '...k2OROORO1k...',
  '...k1ROOROR1k...',
  '....k111111k....',
  '.....kkkkkk.....',
  '................',
];

/** A cereal box cut into a robot face: bottle cap eyes, a red stripe, a grille mouth, a wire antenna. */
const MASK_CEREAL_BOX_ROBOT: Rows = [
  '.......kk.......',
  '......kRek......',
  '.......kk.......',
  '.......kk.......',
  '..kkkkkkkkkkkk..',
  '.kYYYYYYYYYYyOk.',
  '.kYkkkYYYkkkyOk.',
  '.kyk5wkyyk5wkOk.',
  '.kyk44kyyk44kOk.',
  '.kyykkyyyykkyOk.',
  '.kRRRRRRRRRRRrk.',
  '.kyykxkxkxkyyOk.',
  '.kyykxkxkxkyyOk.',
  '.kOOOOOOOOOOOok.',
  '..kkkkkkkkkkkk..',
  '................',
];

/** Gray rubber gas mask: round lenses, a khaki filter can at the snout. */
const MASK_GAS_MASK: Rows = [
  '................',
  '....kkkkkkkk....',
  '...k33333332k...',
  '..k3kkk33kkk2k..',
  '..k3kCCk3kCck2k.',
  '.k33kCwk2kwck22k',
  '.k32kcck2kcck21k',
  '.k322kkk2kkk221k',
  '..k3222kk22221k.',
  '...k22kTTk221k..',
  '...k2ktTtNk21k..',
  '....kkNtNNkk1k..',
  '.....ktNNNk.k...',
  '.....kkkkkk.....',
  '................',
  '................',
];

/** A monocle cut from a green bottle bottom, in a gold rim on a gold chain. */
const MASK_MONOCLE: Rows = [
  '................',
  '....kkkkkk......',
  '...kyYYYyOk.....',
  '..kYkkkkkkOk....',
  '..kykLLlGkOk....',
  '.kYkLwLlGGkOk...',
  '.kykLLlGGGkOk...',
  '.kykllGGGgkok...',
  '..kykGGGgkok....',
  '..kOkkkkkkok....',
  '...kooOOook.k...',
  '....kkkkkkkyk...',
  '.........kyk....',
  '........kyk.kk..',
  '........kyk.kyk.',
  '.........kyyyk..',
];

/** Blue luchador mask: gold flames round the eyes, a white crest, a red mouth. */
const MASK_LUCHADOR: Rows = [
  '.....kkkkkk.....',
  '....kUUwwUUk....',
  '...kcUUwwUUuk...',
  '..kcUUUwwUUUuk..',
  '..kcyyyUUyyyuk..',
  '.kcyYkkyyykkyuk.',
  '.kcYkkkyykkkyuk.',
  '.kcyykkyyykkyuk.',
  '.kcUyyyUUyyyUuk.',
  '.kcUUUUUUUUUUuk.',
  '..kUUykkkkyUuk..',
  '..kcUykRRkyUuk..',
  '...kUUkkkkUuk...',
  '....kUUUUUuk....',
  '.....kkkkkk.....',
  '................',
];

// ------------------------------------------------------------------ Unique: richer detail and a gold sparkle

/** Crown of the Curb King: gold points, a band studded with bottle caps, a sparkle. */
const HAT_UNIQUE_CURB_CROWN: Rows = [
  '............k...',
  '...........kYk..',
  '.......kk.kYwYk.',
  '......kYyk.kYk..',
  '......kYyk..k...',
  '.kk..kYYyOk..kk.',
  'kYyk.kYyyOk.kyOk',
  'kYyOkYYyyyOkyyOk',
  'kYwyyyyyyyyyyyOk',
  'kYykkyykkyykkyOk',
  'kYkeRkkCUkklGkOk',
  'kykRrkkUukkGgkOk',
  'kyykkyykkyykkyOk',
  'kOOOOOOOOOOOOOok',
  '.kkkkkkkkkkkkkk.',
  '................',
];

export const SPRITES: Record<string, Rows> = {
  hat_takeout_box: HAT_TAKEOUT_BOX,
  hat_bent_cap: HAT_BENT_CAP,
  hat_shower_cap: HAT_SHOWER_CAP,
  hat_party_hat: HAT_PARTY_HAT,
  hat_colander: HAT_COLANDER,
  hat_tinfoil: HAT_TINFOIL,
  hat_lampshade: HAT_LAMPSHADE,
  hat_pumpkin_lid: HAT_PUMPKIN_LID,
  hat_bird_nest: HAT_BIRD_NEST,
  hat_chef_toque: HAT_CHEF_TOQUE,
  hat_propeller_beanie: HAT_PROPELLER_BEANIE,
  hat_graduation_cap: HAT_GRADUATION_CAP,
  hat_teapot: HAT_TEAPOT,
  hat_unique_curb_crown: HAT_UNIQUE_CURB_CROWN,
  mask_paper_bag: MASK_PAPER_BAG,
  mask_clown_nose: MASK_CLOWN_NOSE,
  mask_santa_beard: MASK_SANTA_BEARD,
  mask_groucho_glasses: MASK_GROUCHO_GLASSES,
  mask_cucumber_slices: MASK_CUCUMBER_SLICES,
  mask_ski_goggles: MASK_SKI_GOGGLES,
  mask_googly_glasses: MASK_GOOGLY_GLASSES,
  mask_welding: MASK_WELDING,
  mask_cereal_box_robot: MASK_CEREAL_BOX_ROBOT,
  mask_gas_mask: MASK_GAS_MASK,
  mask_monocle: MASK_MONOCLE,
  mask_luchador: MASK_LUCHADOR,
};
