/**
 * More item icons (carry group), drawn to the same rules as src/render/pixel/items.ts (16x16, one ink
 * outline, three tones per material lit from the top left, natural colors; the slot conventions in
 * that file's header). Merged into ITEM_SPRITES there.
 *
 * Backpacks, bling and rings. Backpacks are side or three-quarter views; rings sit on their band like
 * the rings in items.ts. The unique (the soda jetpack) carries the small gold sparkle.
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

/** Red and white striped popcorn bucket, heaped with buttery popcorn. */
const BACKPACK_POPCORN_BUCKET: Rows = [
  '................',
  '....kk.kkk.kk...',
  '...kwWkWwWkwWk..',
  '..kwWTYWWTWWTYk.',
  '.kWTWwWYwWWwWWk.',
  '.kkkkkkkkkkkkkk.',
  '.kWWRRWWRRWWRrk.',
  '.kWWRRWWRRWWRrk.',
  '..kWRRWWRRWWrk..',
  '..kWRRWWRRWWrk..',
  '..kWRRWWRRWWrk..',
  '...kRWWRRWWrk...',
  '...kRWWRRWW5k...',
  '...kkkkkkkkkk...',
  '................',
  '................',
];

/** Red plastic shopping basket, its two handles up. */
const BACKPACK_SHOPPING_BASKET: Rows = [
  '................',
  '................',
  '....kkkkkkkk....',
  '...k33333334k...',
  '...k3kkkkkk4k...',
  '...k3k....k4k...',
  '.kkk3kkkkkk4kkk.',
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

/** Chrome toaster, two slices popping up, its lever on the side. */
const BACKPACK_TOASTER: Rows = [
  '................',
  '..kkkk..........',
  '.kNTTNkkkkk.....',
  '.kNTtNkNTTNk....',
  '.kNttNkNTtNk....',
  '.kkkkkkkkkkkk...',
  '.k5w55555554k...',
  '.k5555555544kk..',
  '.k4444444443k1k.',
  '.k4444444443kk..',
  '.k4444444443k...',
  '.k3333333332k...',
  '..k22222222k....',
  '..k1kkkkkk1k....',
  '...k......k.....',
  '................',
];

/** Silver boombox: two speakers, a tape window, a handle and its antenna up. */
const BACKPACK_BOOMBOX: Rows = [
  '................',
  '.............k..',
  '...kkkkkkkk.k4k.',
  '..k34444443kk4k.',
  '..k3kkkkkk3kk4k.',
  '.kkkkkkkkkkkkkk.',
  '.k5w55R55y5554k.',
  '.k52225kk52225k.',
  '.k21112CC21112k.',
  '.k21412xx21412k.',
  '.k21112kk21112k.',
  '.k522254452225k.',
  '.k444444444443k.',
  '.k333333333332k.',
  '.kkkkkkkkkkkkkk.',
  '................',
];

/** Pink ceramic piggy bank, a gold coin going into its slot, a curly tail. */
const BACKPACK_PIGGY_BANK: Rows = [
  '................',
  '.......kkk......',
  '......kYyOk.k...',
  '...k..kyyOkkqk..',
  '..kqkkkkkkkkkqk.',
  '..kPPwwPPPPPkk..',
  '.kPPwPPPPPPPPqk.',
  'kPPkPkPPPPPPPqk.',
  'kqqkPPPPPPPPPqk.',
  'kqqkPPPPPPPPqqk.',
  '.kkPPPPPPPPqqqk.',
  '..kqPPPPPPqqqk..',
  '...kqqqqqqqqk...',
  '...kqqkkkkqqk...',
  '....kk....kk....',
  '................',
];

/** Steel kitchen sink: a gooseneck faucet with a drip, red and blue knobs. */
const BACKPACK_KITCHEN_SINK: Rows = [
  '................',
  '......kkkkk.....',
  '.....k5w554k....',
  '.....k5kkk54k...',
  '.....k4k..k4k...',
  '.....k4k..kxk...',
  '..kk.k4kkkkCk...',
  '.keRkk4kcUkk....',
  '.kRrkk4kUuk.....',
  '.kkkkkkkkkkkkkk.',
  '.kw55555555554k.',
  '.k5x22222222x4k.',
  '.k52111x111124k.',
  '.k444444444443k.',
  '.kkkkkkkkkkkkkk.',
  '................',
];

/** Round glass fishbowl with an orange goldfish and a sandy bottom. */
const BACKPACK_FISHBOWL: Rows = [
  '................',
  '................',
  '...kkkkkkkkkk...',
  '..kwCCCCCCCC5k..',
  '...kkCCCCCCkk...',
  '..kkCCCCCCCCkk..',
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

// ------------------------------------------------------------------ Bling: necklaces, pendants, collars, bibs, badges

/** Red cat collar with a gold jingle bell. */
const BLING_BELL_COLLAR: Rows = [
  '................',
  '.....kkkkkk.....',
  '...kkeeeRRRkk...',
  '..keRkkkkkkRrk..',
  '.keRk......kRrk.',
  '.kRk........krk.',
  '.kRRk......krrk.',
  '..kRRkkkkkkrrk..',
  '...kkRRkkRrkk...',
  '.....kkyykk.....',
  '....kYwyyyOk....',
  '....kYyyyyOk....',
  '....kOkkkkok....',
  '.....kOOook.....',
  '......kkkk......',
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

/** Coach's silver whistle on a red cord. */
const BLING_WHISTLE: Rows = [
  '.kkk............',
  '..kRk...........',
  '...kRk.......k..',
  '....kRk.....kRk.',
  '.....kRkkkkkRk..',
  '......kRRRRRkk..',
  '.......kk53kk.k.',
  '..kkkkk554453k..',
  '.k45ww5x4w443k..',
  '.k344444444443k.',
  '.k333334444443k.',
  '..kkkkk544443k..',
  '......k334433k..',
  '.......kk33kk...',
  '.........kk.....',
  '................',
];

/** Scratched CD on a string, a rainbow in its shine. */
const BLING_CD_PENDANT: Rows = [
  '..k..........k..',
  '...k........k...',
  '....k......k....',
  '.....kkkkkk.....',
  '....k555Y53k....',
  '...k5444PmC3k...',
  '..k544444PmC3k..',
  '..k544w555443k..',
  '..k544wkk5443k..',
  '..k5445kk4443k..',
  '..k5444444443k..',
  '..k3Cm4444443k..',
  '...k3P444443k...',
  '....k333333k....',
  '.....kkkkkk.....',
  '................',
];

/** Red headphones with a gray band, worn round the neck. */
const BLING_HEADPHONES: Rows = [
  '................',
  '.....kkkkkk.....',
  '...kk222222kk...',
  '..k22kkkkkk22k..',
  '.k2kk......kk2k.',
  '.k2k........k2k.',
  '.k2k........k2k.',
  '.kkkk......kkkk.',
  '.keR1k....k1Rrk.',
  '.kRR1k....k1RRk.',
  '.kRR1k....k1Rrk.',
  '.kRr1k....k1rrk.',
  '.krr1k....k1rrk.',
  '..kkk......kkk..',
  '................',
  '................',
];

/** Plastic Hawaiian lei: pink, yellow and purple flowers. */
const BLING_LEI: Rows = [
  '................',
  '....kk....kk....',
  '...kPqk..kYyk...',
  '..kPyPqkkYOYyk..',
  '..kqPqkkkkYyk...',
  '..kkGkk..kkGkk..',
  '.kmMmk....kPqk..',
  '.kMyMVk..kPyPqk.',
  '.kmMVk....kPqk..',
  '..kGkk....kkGk..',
  '..kYyk....kmMk..',
  '.kYOYykk.kMyMVk.',
  '..kYykPqkkmVkk..',
  '...kkPyPqkkk....',
  '.....kPqk.......',
  '......kk........',
];

/** Plastic lobster bib: a red lobster on white, ties at the top. */
const BLING_LOBSTER_BIB: Rows = [
  '................',
  '.k............k.',
  '..k..........k..',
  '..kkkk....kkkk..',
  '.kwwwwk..kwwW5k.',
  '.kwwwwwkkwwWW5k.',
  '.kwwewRwwRwrW5k.',
  '.kwweRRwwRRrW5k.',
  '.kwwwRwwwwrwW5k.',
  '.kwwwweRRrwwW5k.',
  '.kwwwwRRRrwwW5k.',
  '.kwwwwwRrwwwW5k.',
  '.kwwwwRRrrwwW5k.',
  '..kW555555555k..',
  '...kkkkkkkkkk...',
  '................',
];

/** Purple lanyard with a laminated gold VIP pass. */
const BLING_VIP_LANYARD: Rows = [
  '.kk..........kk.',
  '.kVk........kvk.',
  '..kVk......kvk..',
  '...kVk....kvk...',
  '....kVk..kvk....',
  '.....kVkkvk.....',
  '......k44k......',
  '..kkkkk34kkkkk..',
  '..kYYYYYYYYYyk..',
  '..kxyxyxyxxyOk..',
  '..kxyxyxyxyxOk..',
  '..kxyxyxyxxyOk..',
  '..kyxyyxyxyyOk..',
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

/** Puffy lilac scrunchie with white polka dots, gathered into folds. */
const RING_SCRUNCHIE: Rows = [
  '................',
  '................',
  '.....kkkkkk.....',
  '...kkVMwMVVkk...',
  '..kMMmmmmmmwVk..',
  '.kMmmmVVVVmmVVk.',
  '.kMVmVkkkkVmmVk.',
  '.kMmVk....kMmwk.',
  '.kMwmVkkkkMmmVk.',
  '.kMmmmMMMMmmVVk.',
  '.kVmVmmmmmmmmVk.',
  '..kVVmwmVmwVVk..',
  '...kkVVVVVVkk...',
  '.....kkkkkk.....',
  '................',
  '................',
];

/** Pink plastic bubble wand, its loop still filmed with soap, two bubbles floating off. */
const RING_BUBBLE_WAND: Rows = [
  '................',
  '.........kk.....',
  '..kkk..kkPPkk...',
  '.kCwCkkPPPPPPk..',
  '.kCCMkkPCwMCPk..',
  '..kkkkPPCMCCqqk.',
  '.....kPPCCCCqqk.',
  '...kk.kPCCAAqk..',
  '..kwCkkPPqqqqk..',
  '...kkkPkkqqkk...',
  '....kPqk.kk.....',
  '...kPqk.........',
  '..kPqk..........',
  '.kPqk...........',
  '..kk............',
  '................',
];

/** Yellow rubber duck on a blue plastic band. */
const RING_RUBBER_DUCK: Rows = [
  '................',
  '.....kkkk.......',
  '....kYYyyk......',
  '..kkYkkyyOk.....',
  '.kOOkyyyyOk..kk.',
  '.kooYyyyyyykkYk.',
  '..kkYYyyyyyyyOk.',
  '...kyYyyyyyyOk..',
  '...kkyOOOOOOkk..',
  '...kkcCCCCUkk...',
  '..kcCkkkkkkcUk..',
  '.kcCk......kUUk.',
  '..kUUkkkkkkUuk..',
  '...kkUUUUuukk...',
  '.....kkkkkk.....',
  '................',
];

/** Rubber tire off a toy truck, its tread showing, a yellow hub. */
const RING_TOY_TIRE: Rows = [
  '................',
  '.....kkkkkk.....',
  '...kk2222xxk....',
  '..k221111111k...',
  '..k21111111xxk..',
  '.k211yyy111111k.',
  '.k211YYyy11xxxk.',
  '.k21yYkyy11111k.',
  '.k21yykyO111xxk.',
  '.k211yyyO11111k.',
  '.kx11yyO111xxxk.',
  '..k2111111111k..',
  '..kxx11111xxk...',
  '...kkxxxx11k....',
  '.....kkkkkk.....',
  '................',
];

/** Mini pretzel, twisted and salted. */
const RING_PRETZEL: Rows = [
  '................',
  '...kkkk..kkkk...',
  '..ktttnkktttnk..',
  '.ktNwnNttNnwNnk.',
  '.ktnkknNNnkktnk.',
  '.ktnk.ktnk.ktnk.',
  '.ktnkktNNnkktnk.',
  '.ktNttNnnNttNnk.',
  '.ktNnnnkknnnNnk.',
  '.ktnkkk..kkktnk.',
  '.knwk......kwnk.',
  '..ktnkk..kktnk..',
  '..knNtnkkttNnk..',
  '...knnnttnnnk...',
  '....kkkkkkkk....',
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

/** Purple plastic toy spider on an orange Halloween band. */
const RING_TOY_SPIDER: Rows = [
  '................',
  '.kk...kkkk...kk.',
  '.kVk.kVmMVk.kVk.',
  '.kVVkVmMmVvkVvk.',
  '..kkVVmmVVvvkk..',
  '.kkVkVVVVVvkVkk.',
  '.kVkkkVvVkkkkVk.',
  '.kk.kVkRkRk..kk.',
  '....kVvkvVk.....',
  '...kkoOOOOokk...',
  '..koOkkkkkkook..',
  '.kOyk......kOok.',
  '..kOOkkkkkkook..',
  '...kkOOOOookk...',
  '.....kkkkkk.....',
  '................',
];

/** Gold band with a white lucky die on top. */
const RING_LUCKY_DIE: Rows = [
  '................',
  '...kkkkkkkkkk...',
  '..kwwwwwwwww5k..',
  '..kwWkWWWkW45k..',
  '..kwWWWWWWW45k..',
  '..kwWWWkWWW45k..',
  '..kwWWWWWWW45k..',
  '..kwWkWWWkW45k..',
  '..kw555555544k..',
  '..kkkkkkkkkkkk..',
  '..kyYkkkkkkyOk..',
  '.kyYk......kOOk.',
  '..kOOkkkkkkOok..',
  '...kkOOOOookk...',
  '.....kkkkkk.....',
  '................',
];

/** Fidget spinner in purple anodized metal with silver bearings. */
const RING_FIDGET_SPINNER: Rows = [
  '.......kk.......',
  '......kmvk......',
  '.....kMVVvk.....',
  '....kmV54Vvk....',
  '....kvV43Vvk....',
  '.....kmVVvk.....',
  '.....MmVVvk.....',
  '..kkkmV54Vvkkk..',
  '.kmmmVV43VVmmvk.',
  'kmM54VV43VV54Vvk',
  'kmV54VVvvVV54Vvk',
  'kvV43VvkkvV43Vvk',
  '.kvvvvk..kvvvvk.',
  '..kkkk....kkkk..',
  '................',
  '................',
];

/** Mirror disco ball on a gold band, sparkling. */
const RING_DISCO_BALL: Rows = [
  '......kkkk......',
  '..k..k5444k.....',
  '.kwkk444433k....',
  '..kk4ww5m533k...',
  '..k4455544332k..',
  '..k54ww555C43k..',
  '..k3444443322k..',
  '..k4355444333k..',
  '...k3M3333Y2k...',
  '...k24433323k...',
  '...kY222222Ok...',
  '..kYYkkkkkkOOk..',
  '..kYYkkkkkkOOk..',
  '...kyyyyOOOok...',
  '....kkkkkkkk....',
  '................',
];

// ------------------------------------------------------------------ Unique items: richer detail and a gold sparkle

/** Two soda bottles taped into a jetpack, flames out of the caps, a sparkle. */
const BACKPACK_UNIQUE_SODA_JETPACK: Rows = [
  '..k.............',
  '.kYk.kkkk.kkkk..',
  'kYwYkkLlGkkLlGk.',
  '.kYkkwlGgkwlGgk.',
  '..k.kLlGgkLlGgk.',
  '....k5554k5554k.',
  '....kLlGgkLlGgk.',
  '....keRRrkeRRrk.',
  '....keRwrkeRwrk.',
  '....kLlGgkLlGgk.',
  '.....kGgk.kGgk..',
  '.....kRrk.kRrk..',
  '....kYwYkkYwYk..',
  '.....kyOk.kyOk..',
  '......kk...kk...',
  '................',
];

/** Every carry icon by item id, in itemsCarry.json order. */
export const SPRITES: Record<string, Rows> = {
  backpack_frog_kiddie: BACKPACK_FROG_KIDDIE,
  backpack_popcorn_bucket: BACKPACK_POPCORN_BUCKET,
  backpack_shopping_basket: BACKPACK_SHOPPING_BASKET,
  backpack_birdhouse: BACKPACK_BIRDHOUSE,
  backpack_toaster: BACKPACK_TOASTER,
  backpack_boombox: BACKPACK_BOOMBOX,
  backpack_piggy_bank: BACKPACK_PIGGY_BANK,
  backpack_kitchen_sink: BACKPACK_KITCHEN_SINK,
  backpack_fishbowl: BACKPACK_FISHBOWL,
  bling_bell_collar: BLING_BELL_COLLAR,
  bling_name_tag: BLING_NAME_TAG,
  bling_whistle: BLING_WHISTLE,
  bling_cd_pendant: BLING_CD_PENDANT,
  bling_headphones: BLING_HEADPHONES,
  bling_lei: BLING_LEI,
  bling_lobster_bib: BLING_LOBSTER_BIB,
  bling_vip_lanyard: BLING_VIP_LANYARD,
  bling_participation_medal: BLING_PARTICIPATION_MEDAL,
  bling_big_clock: BLING_BIG_CLOCK,
  ring_scrunchie: RING_SCRUNCHIE,
  ring_bubble_wand: RING_BUBBLE_WAND,
  ring_rubber_duck: RING_RUBBER_DUCK,
  ring_toy_tire: RING_TOY_TIRE,
  ring_pretzel: RING_PRETZEL,
  ring_sea_glass: RING_SEA_GLASS,
  ring_toy_spider: RING_TOY_SPIDER,
  ring_lucky_die: RING_LUCKY_DIE,
  ring_fidget_spinner: RING_FIDGET_SPINNER,
  ring_disco_ball: RING_DISCO_BALL,
  backpack_unique_soda_jetpack: BACKPACK_UNIQUE_SODA_JETPACK,
};
