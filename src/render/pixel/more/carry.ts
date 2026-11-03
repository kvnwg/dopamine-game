/**
 * More item icons (carry group), drawn to the same rules as src/render/pixel/items.ts (16x16, one ink
 * outline, three tones per material lit from the top left, natural colors; the slot conventions in
 * that file's header). Merged into ITEM_SPRITES there.
 */
import type { Rows } from '../buf';

// ------------------------------------------------------------------ Backpacks: side or three-quarter view

/** Green frog kiddie backpack: big eyes on top, pink cheeks, a wide smile. */
const BACKPACK_FROG_KIDDIE: Rows = [
  '................',
  '...kkk....kkk...',
  '..kwwwk..kwwwk..',
  '..kwkwk..kwkwk..',
  '.kkwwwkkkkwwwkk.',
  '.kLkkkLLLLkkklk.',
  '.kLllllllllllGk.',
  '.kLPPllllllPPGk.',
  '.kLlgllllllglGk.',
  '.kLllggggggllGk.',
  '.kLllllllllllGk.',
  '.klllllllllGGGk.',
  '..kGGGGGGGGGGk..',
  '...kkkkkkkkkk...',
  '................',
  '................',
];

/** Brown paper grocery bag, celery and an apple poking out of the top. */
const BACKPACK_PAPER_GROCERY_BAG: Rows = [
  '................',
  '...kk.kk........',
  '..kLlkLlk..kk...',
  '..klGlGlk.knGk..',
  '...kGlGk.kkkkk..',
  '...kLlLk.keRRrk.',
  '..kkLlLkkeRRRrrk',
  '..kTTkkTTkRRrrk.',
  '..kTtttttNkkkNk.',
  '..kTttttttNnNk..',
  '..kTttttttNnNk..',
  '..kTttttttNnNk..',
  '..kTttttttNnNk..',
  '..kNNNNNNNnnnk..',
  '..kkkkkkkkkkkk..',
  '................',
];

/** Red plastic shopping basket, its two handles up, a milk carton inside. */
const BACKPACK_SHOPPING_BASKET: Rows = [
  '................',
  '................',
  '....kkkkkkkk....',
  '...k33333334k...',
  '...k3kkkkkk4k...',
  '...k3kWWkk.4k...',
  '.kkk3kkkkkkk4kk.',
  '.keeeeeeeeeeeRk.',
  '.kRRRRRRRRRRRrk.',
  '..kerrRrrRrrrk..',
  '..keRRRRRRRRrk..',
  '..kerrRrrRrrrk..',
  '...kRRRRRRRrk...',
  '...kkkkkkkkkk...',
  '................',
  '................',
];

/** Wooden birdhouse with a red roof, a bluebird peeking out of the hole. */
const BACKPACK_BIRDHOUSE: Rows = [
  '................',
  '.......kk.......',
  '......keRk......',
  '.....keRRrk.....',
  '....keRRRRrk....',
  '...keRRRRRRrk...',
  '..keRRRRRRRRrk..',
  '.kkkkkkkkkkkkkk.',
  '..kTTTTTTTTTNk..',
  '..kTttkkktttNk..',
  '..kTtkcCkkttNk..',
  '..kTtkcykkttNk..',
  '..kTttkkktttNk..',
  '..kTttnntttNNk..',
  '..kkkkkkkkkkkk..',
  '................',
];

/** Chrome toaster, two slices of toast popping out of the top. */
const BACKPACK_TOASTER: Rows = [
  '................',
  '..kkkk..........',
  '.kNTTNk..kkkk...',
  '.kNTtNk.kNTTNk..',
  '.kNttNk.kNTtNk..',
  '.kkkkkkkkkkkkkk.',
  '.k5wxxxx5xxxx4k.',
  '.kw555555555543k',
  '.k5555555555543k',
  '.k5444444444433k',
  '.k5444444444433k',
  '.k4333333333322k',
  '..k3333333332kk.',
  '..kk1k.....k1k..',
  '...kk.......kk..',
  '................',
];

/** Silver boombox: two speakers, a tape deck, a handle and its antenna up. */
const BACKPACK_BOOMBOX: Rows = [
  '...........k....',
  '...........k....',
  '....kkkkkk.k....',
  '...k444443kk....',
  '...k4kkkk3k.....',
  '.kkk4kkkk3kkkk..',
  '.k55555555555k..',
  '.k5kkkk5kkkkk4k.',
  '.k5k21k5k21k44k.',
  '.kk2312kk2312k4k',
  '.kk2112kk2112k3k',
  '.k5k22k4k22k43k.',
  '.k5kkkk4kkkk33k.',
  '.k44444444433k..',
  '..kkkkkkkkkkk...',
  '................',
];

/** Pink ceramic piggy bank, a gold coin going into its slot. */
const BACKPACK_PIGGY_BANK: Rows = [
  '................',
  '.......kkk......',
  '......kYyOk.....',
  '...k..kyyOk.....',
  '..kqkkkkkkkk....',
  '..kPPwwPPPPPkk..',
  '.kPPwPPPPPPPPqk.',
  'kPPkPPPPPPPPPqkk',
  'kqqkPPPPPPPPPqkq',
  'kqqkPPPPPPPPqqkk',
  '.kkPPPPPPPPqqqk.',
  '..kqPPPPPPqqqk..',
  '...kqqqqqqqqk...',
  '...kqqk..kqqk...',
  '....kk....kk....',
  '................',
];

/** Black guitar case covered in stickers. */
const BACKPACK_GUITAR_CASE: Rows = [
  '................',
  '......kkkk......',
  '.....kNnnbk.....',
  '.....kNnnbk.....',
  '......kNbk......',
  '......kNbk......',
  '......kNbk......',
  '.....kNnnbk.....',
  '...kkNnnnnnkk...',
  '...kNneRnnnbk...',
  '....kNRrnnbk....',
  '...kNnnnnnnbk...',
  '..kNnnnnnYnnbk..',
  '..kNnnnnYyYnbk..',
  '...kbbbbbbbbk...',
  '................',
];

/** Round glass fishbowl with an orange goldfish and a sandy bottom. */
const BACKPACK_FISHBOWL: Rows = [
  '................',
  '................',
  '....kkkkkkkk....',
  '...kCwCCCCCck...',
  '....kCkkkkck....',
  '..kkCwCCCCCCkk..',
  '.kCwcccccccccUk.',
  '.kCwcccccOOcOUk.',
  '.kCccccOyOOOOUk.',
  '.kCcccckOOOcOUk.',
  '.kCccccccocccUk.',
  '.kcccccccccccUk.',
  '..kTTTTTttttNk..',
  '...kttttttNNk...',
  '....kkkkkkkk....',
  '................',
];

// ------------------------------------------------------------------ Bling: necklaces, pendants, chains, badges

/** Red cat collar with a gold jingle bell. */
const BLING_BELL_COLLAR: Rows = [
  '................',
  '................',
  '.....kkkkkk.....',
  '...kkeeeRRRkk...',
  '..keRkkkkkkRrk..',
  '.keRk......kRrk.',
  '.kRk........krk.',
  '.kRRk......krrk.',
  '..kRRkkkkkkrrk..',
  '...kkRRyyRrkk...',
  '.....kkYykk.....',
  '.....kYyyOk.....',
  '....kYyyyyOk....',
  '....kyOkkOOk....',
  '.....kkkkkk.....',
  '................',
];

/** "HELLO my name is" sticker, the name scribbled in blue pen. */
const BLING_NAME_TAG: Rows = [
  '................',
  '................',
  '................',
  '.kkkkkkkkkkkkkk.',
  '.keRRRRRRRRRRrk.',
  '.keRwwRwRwwRRrk.',
  '.krrrrrrrrrrrrk.',
  '.kwwwwwwwwwwwWk.',
  '.kwUUwUwwUUwwWk.',
  '.kwwUUwUUwwUUWk.',
  '.kwwwwwwwwwwwWk.',
  '.keRRRRRRRRRRrk.',
  '.kkkkkkkkkkkkkk.',
  '................',
  '................',
  '................',
];

/** Glow stick necklace in neon green, joined by its little clear connector. */
const BLING_GLOW_STICK: Rows = [
  '................',
  '................',
  '......k55k......',
  '....kkk44kkk....',
  '...kLLkkkklGk...',
  '..kLLk....klGk..',
  '.kLLk......klGk.',
  '.kLlk......klGk.',
  '.kLlk......kGGk.',
  '.klGk......kGgk.',
  '..klGk....kGgk..',
  '...kGGkkkkGgk...',
  '....kkGGGggk....',
  '......kkkk......',
  '................',
  '................',
];

/** Scratched CD on a string, a rainbow in its shine. */
const BLING_CD_PENDANT: Rows = [
  '.k...........k..',
  '..k.........k...',
  '...k.......k....',
  '....k.....k.....',
  '.....kkkkk......',
  '....k555544k....',
  '...k5wwM5443k...',
  '..k5wC5kk443k...',
  '..k5Y5k..k43k...',
  '..k54Mk..k33k...',
  '..k544kkkk33k...',
  '...k44443332k...',
  '....k333322k....',
  '.....kkkkkk.....',
  '................',
  '................',
];

/** Pastel pacifier on a ribbon: blue shield, pink ring handle. */
const BLING_PACIFIER: Rows = [
  '................',
  '...kk......kk...',
  '....kk....kk....',
  '.....kk..kk.....',
  '......kPPk......',
  '.....kPkkqk.....',
  '.....kPk.qk.....',
  '..kkkkkqqkkkkk..',
  '.kCCCCCCCCCCCck.',
  '.kCwCCkCCkCCcck.',
  '.kcCCCCCCCCccUk.',
  '..kcccccccccUk..',
  '...kkkkWWkkkk...',
  '......kW5k......',
  '.......kk.......',
  '................',
];

/** Plastic Hawaiian lei: pink, yellow and purple flowers. */
const BLING_LEI: Rows = [
  '................',
  '....kk....kk....',
  '...kPqk..kYyk...',
  '..kPyPqkkYOYyk..',
  '..kqPqkGkkYyk...',
  '..kkGkk..kkGkk..',
  '.kmMmk....kPqk..',
  '.kMyMVk..kPyPqk.',
  '.kmMVk....kPqk..',
  '..kGkk....kkGk..',
  '..kYyk....kmMk..',
  '.kYOYyk..kMyMVk.',
  '..kYykPqkkmVk...',
  '...kkPyPqkkk....',
  '.....kPqk.......',
  '......kk........',
];

/** Plastic lobster bib: a red lobster on white, ties at the top. */
const BLING_LOBSTER_BIB: Rows = [
  '....kk....kk....',
  '...k5k....k4k...',
  '...k5kkkkkk4k...',
  '..kwwk....kW5k..',
  '.kwwwwkkkkWWW5k.',
  '.kwwwwwwwwwWW5k.',
  '.kwkRkwwwkRkW5k.',
  '.kwkeRkwkRrkW5k.',
  '.kwwkRReRRkWW5k.',
  '.kwwwkRRrkWWW5k.',
  '.kwwwkReRkWWW5k.',
  '.kwwwwkRkWWWW5k.',
  '.kwwwkRrRkWW55k.',
  '..kW5555555555k.',
  '...kkkkkkkkkkk..',
  '................',
];

/** Purple lanyard with a laminated gold VIP pass. */
const BLING_VIP_LANYARD: Rows = [
  '.kk..........kk.',
  '.kVk........kVk.',
  '..kVk......kVk..',
  '...kVk....kvk...',
  '....kVk..kvk....',
  '.....kVkkvk.....',
  '......k44k......',
  '...kkkk34kkkk...',
  '..kYyyyyyyyyOk..',
  '..kykykykkyOOk..',
  '..kykykykykyOk..',
  '..kyykyykkyyOk..',
  '..kyyyyyyyyyOk..',
  '..kOOOOOOOOOOk..',
  '...kkkkkkkkkk...',
  '................',
];

/** Gold-ish participation medal on a striped ribbon. */
const BLING_PARTICIPATION_MEDAL: Rows = [
  '..kkk.....kkk...',
  '..kUek...kReUk..',
  '...kUek.kReUk...',
  '....kUekReUk....',
  '.....kUeRUk.....',
  '......kkkk......',
  '.....kyyyOk.....',
  '....kYyyyyOk....',
  '...kYyyYyyyOk...',
  '...kyyYYYyyOk...',
  '...kyyyYyyyOk...',
  '...kyyYyYyOok...',
  '....kyOOOOok....',
  '.....kkkkkk.....',
  '................',
  '................',
];

/** Big clock on a heavy gold chain, stuck at snack o'clock. */
const BLING_BIG_CLOCK: Rows = [
  '.kk..........kk.',
  '.kyk........kyk.',
  '..kOk......kOk..',
  '...kyk....kyk...',
  '....kOk..kOk....',
  '.....kkkkkk.....',
  '....kYyyyyOk....',
  '...kYwwkwwWOk...',
  '..kYwwwkwwwWOk..',
  '..kywwwkwwwWOk..',
  '..kywwwkkkwWOk..',
  '..kywwwwwwwWOk..',
  '...kyWWWWWWOk...',
  '....kyOOOOOk....',
  '.....kkkkkk.....',
  '................',
];

// ------------------------------------------------------------------ Rings

/** Puffy lilac velvet scrunchie. */
const RING_SCRUNCHIE: Rows = [
  '................',
  '................',
  '....kkkkkkkk....',
  '..kkMmMMmMMmkk..',
  '.kMmMmmkkmmVmVk.',
  '.kmMkk....kkVVk.',
  'kMmk........kVVk',
  'kmMk........kVvk',
  'kMmk........kVvk',
  '.kmMkk....kkVvk.',
  '.kVmVmmkkmVvVvk.',
  '..kkVVmVVvVvkk..',
  '....kkkkkkkk....',
  '................',
  '................',
  '................',
];

/** Pink plastic bubble wand, its loop still filmed with soap, two bubbles floating off. */
const RING_BUBBLE_WAND: Rows = [
  '................',
  '..kkk...........',
  '.kCwCk...kkkk...',
  '.kCCMk..kPPPqk..',
  '..kkk..kPkkkkqk.',
  '....kk.kPkMCCkqk',
  '...kwCk.kPkwCMkqk',
  '...kCMk.kPkCMAkq',
  '....kk...kPkkkkq',
  '..........kqPPq.',
  '.........kqkk...',
  '........kqk.....',
  '.......kqk......',
  '......kqk.......',
  '.......k........',
  '................',
];

/** A silver spoon bent into a ring, its bowl on top. */
const RING_SPOON: Rows = [
  '................',
  '......kkkk......',
  '.....k5ww4k.....',
  '....k5w5544k....',
  '....k554443k....',
  '.....k4433k.....',
  '......k43k......',
  '......k43k......',
  '...kk455553kk...',
  '..k45kkkkkk43k..',
  '.k45k......k33k.',
  '.k43k......k32k.',
  '..k33kkkkkk32k..',
  '...kk333322kk...',
  '.....kkkkkk.....',
  '................',
];

/** Roll of silver duct tape, its loose end hanging off. */
const RING_DUCT_TAPE: Rows = [
  '................',
  '................',
  '.....kkkkkk.....',
  '...kk555544kk...',
  '..k55w555444k...',
  '.k5w5kkkkk444k..',
  '.k55kTTTTtk44k..',
  '.k54kTkkkNk43k..',
  '.k44kTtttNk43k..',
  '.k444kkkkk433k..',
  '.k34444444333k..',
  '..k333433322kk..',
  '...kkk3kkkkk2k..',
  '.....k43k..k3k..',
  '......kk...k2k..',
  '............k...',
];

/** Mini donut with pink frosting and sprinkles. */
const RING_DONUT: Rows = [
  '................',
  '................',
  '.....kkkkkk.....',
  '...kkPPPPPqkk...',
  '..kPPwPYPPPqqk..',
  '.kPwPPkkkkPcqqk.',
  '.kPPlk....kPqqk.',
  '.kPPPk....kqqqk.',
  '.kTPPqkkkkqqwtk.',
  '.ktPqPPqPqqqttk.',
  '..ktTqqqqqqttk..',
  '...kktttttNkk...',
  '.....kkkkkk.....',
  '................',
  '................',
  '................',
];

/** Silver wire ring wrapped round a nugget of teal sea glass. */
const RING_SEA_GLASS: Rows = [
  '................',
  '......kkkk......',
  '....kkAAAakk....',
  '...kAA4AaaaAk...',
  '...kAaa4aaagk...',
  '...kaaaa4aggk...',
  '....kaaag4gk....',
  '.....kkkkkk.....',
  '...kk455543kk...',
  '..k45kkkkkk43k..',
  '.k45k......k33k.',
  '.k43k......k32k.',
  '..k33kkkkkk32k..',
  '...kk333322kk...',
  '.....kkkkkk.....',
  '................',
];

/** Rainbow plastic coil spring. */
const RING_RAINBOW_SPRING: Rows = [
  '................',
  '.....kkkkkk.....',
  '...kkeRRRRrkk...',
  '..keRkkkkkkRrk..',
  '..kOOkkkkkkOok..',
  '..kyyOOOOOOOok..',
  '..kYyyyyyyyyOk..',
  '..klLllllllGGk..',
  '..kLllllllllGk..',
  '..kcCcccccccUk..',
  '..kCcccccccccUk.',
  '..kmMmmmmmmmVk..',
  '..kMmmmmmmmmVk..',
  '...kkVVVVVVkk...',
  '.....kkkkkk.....',
  '................',
];

/** Gold band with a white lucky die on top. */
const RING_LUCKY_DIE: Rows = [
  '................',
  '.....kkkkkk.....',
  '....kwwwwwwk....',
  '...kwwkwwkw5k...',
  '..kkkkkkkkk55k..',
  '..kWkWWWkW45k...',
  '..kWWWkWWW44k...',
  '..kWkWWWkW4k....',
  '..k5555554k.....',
  '..kkkkkkkkk.....',
  '..kyYkkkkkkyOk..',
  '.kyYk......kOOk.',
  '.kyOk......kOok.',
  '..kOOkkkkkkOok..',
  '...kkOOOOookk...',
  '.....kkkkkk.....',
];

/** Fidget spinner in purple anodized metal with silver bearings. */
const RING_FIDGET_SPINNER: Rows = [
  '................',
  '......kkkk......',
  '.....kmMMVk.....',
  '....kmk55kVk....',
  '....kMk43kVk....',
  '.....kmkkVk.....',
  '.....kmVVVk.....',
  '..kkkmVkkVVkkk..',
  '.kmMmVk54kVVVvk.',
  'km55kVk32kVk55vk',
  'kM43kVVkkVVk43vk',
  '.kmkkVVVVVVVkkvk',
  '..kvvvvkkvvvvvk.',
  '...kkkk..kkkkk..',
  '................',
  '................',
];

/** Chunky gold bowling league ring, a red stone and a white pin on the side. */
const RING_BOWLING_CHAMP: Rows = [
  '................',
  '.....kkkkkk.....',
  '....kYyyyyOk....',
  '...kYkkkkkkOk...',
  '...kykeRRrkOk...',
  '...kykRwRrkOk...',
  '...kykRRrrkOk...',
  '...kykkkkkkOk...',
  '..kkYyyyyyyOkk..',
  '.kyYwkkkkkkyOOk.',
  '.kYwWk....kyOok.',
  '.kyYwk....kyOok.',
  '.kyyOkkkkkkOook.',
  '..kkyyOOOOoookk.',
  '....kkkkkkkkk...',
  '................',
];

// ------------------------------------------------------------------ Unique items: richer detail and a gold sparkle

/** Two soda bottles taped into a jetpack, flames out of the caps, a sparkle. */
const BACKPACK_UNIQUE_SODA_JETPACK: Rows = [
  '..k.............',
  '.kYk..kkk..kkk..',
  'kYwYkkLlGkkLlGk.',
  '.kYkkwlGGkwlGGk.',
  '..k.kLlGgkLlGgk.',
  '....k5555k5554k.',
  '....kLlGgkLlGgk.',
  '....keRrrkeRrrk.',
  '....kLlGgkLlGgk.',
  '....k5555k5554k.',
  '.....klGk.klGk..',
  '.....kRrk.kRrk..',
  '.....kYyk.kYyk..',
  '....kYyOkkYyOk..',
  '.....kOk..kOk...',
  '......k....k....',
];

/** Every carry icon by item id (backpacks, bling, rings). */
export const SPRITES: Record<string, Rows> = {
  backpack_frog_kiddie: BACKPACK_FROG_KIDDIE,
  backpack_paper_grocery_bag: BACKPACK_PAPER_GROCERY_BAG,
  backpack_shopping_basket: BACKPACK_SHOPPING_BASKET,
  backpack_birdhouse: BACKPACK_BIRDHOUSE,
  backpack_toaster: BACKPACK_TOASTER,
  backpack_boombox: BACKPACK_BOOMBOX,
  backpack_piggy_bank: BACKPACK_PIGGY_BANK,
  backpack_guitar_case: BACKPACK_GUITAR_CASE,
  backpack_fishbowl: BACKPACK_FISHBOWL,
  backpack_unique_soda_jetpack: BACKPACK_UNIQUE_SODA_JETPACK,
  bling_bell_collar: BLING_BELL_COLLAR,
  bling_name_tag: BLING_NAME_TAG,
  bling_glow_stick: BLING_GLOW_STICK,
  bling_cd_pendant: BLING_CD_PENDANT,
  bling_pacifier: BLING_PACIFIER,
  bling_lei: BLING_LEI,
  bling_lobster_bib: BLING_LOBSTER_BIB,
  bling_vip_lanyard: BLING_VIP_LANYARD,
  bling_participation_medal: BLING_PARTICIPATION_MEDAL,
  bling_big_clock: BLING_BIG_CLOCK,
  ring_scrunchie: RING_SCRUNCHIE,
  ring_bubble_wand: RING_BUBBLE_WAND,
  ring_spoon: RING_SPOON,
  ring_duct_tape: RING_DUCT_TAPE,
  ring_donut: RING_DONUT,
  ring_sea_glass: RING_SEA_GLASS,
  ring_rainbow_spring: RING_RAINBOW_SPRING,
  ring_lucky_die: RING_LUCKY_DIE,
  ring_fidget_spinner: RING_FIDGET_SPINNER,
  ring_bowling_champ: RING_BOWLING_CHAMP,
};
