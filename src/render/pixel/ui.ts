/**
 * Pixel UI icons (16x16) and battle effects. See docs/PIXEL_ART.md for the style rules.
 */
import { checkRows, fromRows, type Rows, type SheetEntry } from './buf';
import { REF_COIN } from './reference';

const BLANK: Rows = Array.from({ length: 16 }, () => '................');

const GEM: Rows = [
  '................',
  '................',
  '.....kkkkkk.....',
  '....kAwAAaak....',
  '...kAwAAAaaak...',
  '..kAAAAAaaaagk..',
  '.kaAAAAaaaaaagk.',
  '.kaaaaaaaaaaggk.',
  '..kaAAaaaaaggk..',
  '...kaAAaaaagk...',
  '....kaAaaagk....',
  '.....kaAagk.....',
  '......kagk......',
  '.......kk.......',
  '................',
  '................',
];

const BAG: Rows = [
  '................',
  '...kkk....kkk...',
  '..k221k..k211k..',
  '...kk21kk1xkk...',
  '....kYyyyyOk....',
  '.....k2x1xk.....',
  '....k221x1xk....',
  '...k22111x11k...',
  '..k2241111x1xk..',
  '.k224111111xxxk.',
  '.k241111111xxxk.',
  '.k21111111111xk.',
  '.k1111111111xxk.',
  '..kx1111111xxk..',
  '...kkkkkkkkkk...',
  '................',
];

const HEART: Rows = [
  '................',
  '................',
  '...kkkk..kkkk...',
  '..keeeRkkeeRRk..',
  '.keweeRRRRRRRRk.',
  '.keeeRRRRRRRRrk.',
  '.keRRRRRRRRRRrk.',
  '.kRRRRRRRRRRrrk.',
  '..kRRRRRRRRRrk..',
  '...kRRRRRRRrk...',
  '....kRRRRRrk....',
  '.....kRRRrk.....',
  '......kRrk......',
  '.......kk.......',
  '................',
  '................',
];

const SWORD: Rows = [
  '................',
  '............kk..',
  '...........kw4k.',
  '..........k543k.',
  '.........k543k..',
  '........k543k...',
  '....k..k543k....',
  '...kYkk543k.....',
  '...kYy543k......',
  '....kyy3k.......',
  '...kNnyOk.......',
  '..kNnkkyOk......',
  '.kYyk..kk.......',
  '.kyOk...........',
  '..kk............',
  '................',
];

const SHIELD: Rows = [
  '................',
  '..kkkkkkkkkkkk..',
  '..k5555555554k..',
  '..k5CcccUUUU3k..',
  '..k5ccccUUUU3k..',
  '..k5ccccUUUU3k..',
  '..k5ccccUUUU3k..',
  '..k5ccccUUUU3k..',
  '..k5ccccUUUu3k..',
  '...k4cccUUu3k...',
  '...k4cccUuu3k...',
  '....k4ccUu3k....',
  '.....k4cu3k.....',
  '......k43k......',
  '.......kk.......',
  '................',
];

const CLOVER: Rows = [
  '................',
  '.....kk..kk.....',
  '....kLlkkLlk....',
  '....kLllllGk....',
  '..kk.klllGk.kk..',
  '.kLlk.klGk.kLlk.',
  '.kLllkkllkkllGk.',
  '..kllllllllllk..',
  '..klllllGllllk..',
  '.klllkkGGkklllk.',
  '.kllk.kllkGkGGk.',
  '..kk.kLllkGkkk..',
  '....kLlllGkGk...',
  '....kllkkGGkkGk.',
  '.....kk..kk..k..',
  '................',
];

const BOLT: Rows = [
  '................',
  '.......kkkkkk...',
  '......kYYyyyOk..',
  '.....kYyyyyOk...',
  '....kYyyyyOk....',
  '...kYyyyyykkk...',
  '..kYyyyyyyyyOk..',
  '..kyyyyyyyyyOk..',
  '..kkkkkkyyyOk...',
  '......kyyyOk....',
  '.....kyyyOk.....',
  '....kyyOkk......',
  '...kyOkk........',
  '..kykk..........',
  '..kk............',
  '................',
];

const STAR: Rows = [
  '................',
  '.......kk.......',
  '......kYyk......',
  '......kYyk......',
  '.....kYyyyk.....',
  '.kkkkkYyyykkkkk.',
  '.kYYYYYyyyyyyOk.',
  '..kyyyyyyyyyOk..',
  '...kyyyyyyyOk...',
  '....kyyyyyOk....',
  '....kyyyyyOk....',
  '...kyyyyyyyOk...',
  '...kyyykkyyOk...',
  '..kyOOk..kyOOk..',
  '..kkkk....kkkk..',
  '................',
];

const GEAR: Rows = [
  '................',
  '.......kk.......',
  '...kk.k55k.kk...',
  '..k55kk54kk43k..',
  '..k5555444443k..',
  '...k55444443k...',
  '..kk544kk443kk..',
  '.k5544k..k4333k.',
  '.k5444k..k4333k.',
  '..kk444kk433kk..',
  '...k44444333k...',
  '..k4444443333k..',
  '..k43kk43kk33k..',
  '...kk.k33k.kk...',
  '.......kk.......',
  '................',
];

const POWER: Rows = [
  '................',
  '.......kk.......',
  '...k..kYOk..k...',
  '..kYkkkYOkkkOk..',
  '...kYOOYOOOok...',
  '...kOOYYyyOok...',
  '..kkOYYwYyyokk..',
  '.kYOyYwwYyyyOok.',
  '.kOOyyYYyyyyOok.',
  '..kkOyyyyyOokk..',
  '...kOOyyyOook...',
  '...kOoOOooook...',
  '..kOkkkOokkkok..',
  '...k..kOok..k...',
  '.......kk.......',
  '................',
];

const LOCK: Rows = [
  '................',
  '.....kkkkkk.....',
  '....k554443k....',
  '...k54kkkk43k...',
  '...k54k..k43k...',
  '...k54k..k43k...',
  '...kkkkkkkkkk...',
  '..kYYYYYYYYyOk..',
  '..kYyyyyyyyyOk..',
  '..kYyyykkyyyOk..',
  '..kYyyykkyyyOk..',
  '..kyyyykkyyyOk..',
  '..kyyyyyyyyOOk..',
  '..kyOOOOOOOOok..',
  '...kkkkkkkkkk...',
  '................',
];

const TRASH: Rows = [
  '................',
  '......kkkk......',
  '..kkkk5443kkkk..',
  '.k555555544443k.',
  '.k444444433332k.',
  '.kkkkkkkkkkkkkk.',
  '..k3333333332k..',
  '..k5443443443k..',
  '..k5443443443k..',
  '..k5443443443k..',
  '..k5443443443k..',
  '..k5443443443k..',
  '..k5443443443k..',
  '..k3332332332k..',
  '...kkkkkkkkkk...',
  '................',
];

const ARROW_UP: Rows = [
  '................',
  '.......kk.......',
  '......kLlk......',
  '.....kLllGk.....',
  '....kLllllGk....',
  '...kLllllllGk...',
  '..kLllllllllGk..',
  '.kLGGlllllllGGk.',
  '..kkkLllllGkkk..',
  '....kLllllGk....',
  '....kLllllGk....',
  '....kLllllGk....',
  '....kLllllGk....',
  '....klGGGGGk....',
  '....kkkkkkkk....',
  '................',
];

const REBIRTH: Rows = [
  '................',
  '................',
  '......kkkk......',
  '....kkMmmmkk....',
  '...kMMkkkkmmk...',
  '...kMkkYykkmk...',
  '...kkYYyyyOkmk..',
  '..kmkkyyyOkmmVk.',
  '.kmmVkyyyOkkVk..',
  '..kmkyOkkyOkk...',
  '...kVkkkkkkVk...',
  '...kVVkkkkVVk...',
  '....kkVVVVkk....',
  '......kkkk......',
  '................',
  '................',
];

const DUMPSTER: Rows = [
  '................',
  '................',
  '..kkkkkkkkkkkk..',
  '.kLLLLLLllllllk.',
  '.kGGGGGGGGGGGgk.',
  '.kkkkkkkkkkkkkk.',
  '..klGGgGGgGGgk..',
  '..klGGgGGgGGgk..',
  '..klGGgGGgGGgk..',
  '..klGGgGGgGGgk..',
  '..klGGgGGgGGgk..',
  '..kGggggggggGk..',
  '..kkkkkkkkkkkk..',
  '...k21k..k21k...',
  '....kk....kk....',
  '................',
];

const POTION: Rows = [
  '................',
  '......kkkk......',
  '.....ktNNnk.....',
  '.....kNNnnk.....',
  '.....kCwCck.....',
  '.....kCwCck.....',
  '....kCwCCCck....',
  '...kCwCCCCCck...',
  '..kLLLLLLLLLLk..',
  '.kwLlllllllllGk.',
  '.kwllllllllllGk.',
  '.kLllllllllGGGk.',
  '..klllllllGGGk..',
  '...kkGGGGGGkk...',
  '.....kkkkkk.....',
  '................',
];

const DICE: Rows = [
  '................',
  '...kkkkkkkkkk...',
  '..kwwwwwwwww5k..',
  '.kwwwwwwwwwww5k.',
  '.kwwxxwwwwxxw5k.',
  '.kwwxxwwwwxxw5k.',
  '.kwwwwwwwwwww5k.',
  '.kwwwwwxxwwww5k.',
  '.kwwwwwxxwwww5k.',
  '.kwwwwwwwwwww5k.',
  '.kwwxxwwwwxxw5k.',
  '.kwwxxwwwwxxw5k.',
  '.kw55555555554k.',
  '..k5555555554k..',
  '...kkkkkkkkkk...',
  '................',
];

const BOOK: Rows = [
  '................',
  '..kkkkkkkkkkk...',
  '.kVvmmmmmmmmVk..',
  '.kVvmMmmmmmmVk..',
  '.kVvmmmYymmmVk..',
  '.kVvmmYyyOmmVk..',
  '.kVvmmmyOmmmVk..',
  '.kVvmmmmmmmmVk..',
  '.kVvmmmmmmmmVk..',
  '.kVvmmmmmmmmVk..',
  '.kVvmmmmmmmmVk..',
  '.kVvVVVVVVVVVk..',
  '.kvkWWWWWWWWTk..',
  '.kvvvvvvvvvvvk..',
  '..kkkkkkkkkkk...',
  '................',
];

const CHART: Rows = [
  '................',
  '..........kkkkk.',
  '..........kLlGk.',
  '..........kLlGk.',
  '..........kLlGk.',
  '......kkkkkLlGk.',
  '......kYyOkLlGk.',
  '......kYyOkLlGk.',
  '..kkkkkYyOkLlGk.',
  '..keRrkYyOkLlGk.',
  '..keRrkYyOkLlGk.',
  '..keRrkYyOkLlGk.',
  '..keRrkYyOkLlGk.',
  '..keRrkYyOkLlGk.',
  '..kkkkkkkkkkkkk.',
  '................',
];

export type UiIcon =
  | 'coin' | 'gem' | 'bag' | 'heart' | 'sword' | 'shield' | 'clover' | 'bolt' | 'power' | 'gear'
  | 'lock' | 'trash' | 'arrowUp' | 'rebirth' | 'dumpster' | 'potion' | 'dice' | 'book' | 'chart' | 'cart'
  | 'star' | 'check' | 'clock' | 'skull' | 'globe' | 'reel' | 'reelGold' | 'backpack' | 'drop' | 'target';

export const UI_SPRITES: Record<UiIcon, Rows> = {
  coin: REF_COIN,
  gem: GEM,
  bag: BAG,
  heart: HEART,
  sword: SWORD,
  shield: SHIELD,
  clover: CLOVER,
  bolt: BOLT,
  power: POWER,
  gear: GEAR,
  lock: LOCK,
  trash: TRASH,
  arrowUp: ARROW_UP,
  rebirth: REBIRTH,
  dumpster: DUMPSTER,
  potion: POTION,
  dice: DICE,
  book: BOOK,
  chart: CHART,
  cart: BLANK,
  star: STAR,
  check: BLANK,
  clock: BLANK,
  skull: BLANK,
  globe: BLANK,
  reel: BLANK,
  reelGold: BLANK,
  backpack: BLANK,
  drop: BLANK,
  target: BLANK,
};

export const FX = {} as const;

export function sheet(): SheetEntry[] {
  const out: SheetEntry[] = [];
  for (const [name, rows] of Object.entries(UI_SPRITES)) {
    checkRows(`ui_${name}`, rows);
    out.push({ name: `ui_${name}`, buf: fromRows(rows) });
  }
  return out;
}
