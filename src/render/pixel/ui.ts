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
  '....kAwAAAak....',
  '...kAwAAAAaak...',
  '..kAAAAAAAaaak..',
  '.kAAAAAAAAaaaak.',
  '.kaaaaaaaaaaagk.',
  '..kAAAaaaaaagk..',
  '...kAAaaaaagk...',
  '....kAaaaagk....',
  '.....kAaagk.....',
  '......kagk......',
  '.......kk.......',
  '................',
  '................',
];

const BAG: Rows = [
  '................',
  '...kk......kk...',
  '..k21kk..kk21k..',
  '...k211kkx11k...',
  '....kkYyyOkk....',
  '.....kyyOOk.....',
  '...kk221x11kk...',
  '..k2221111x11k..',
  '.k2241111111xxk.',
  '.k2411111111xxk.',
  '.k2111111111xxk.',
  '.k1111111111xxk.',
  '.k111111111xxxk.',
  '..kx11111xxxxk..',
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
  '...k....k543k...',
  '..kYk..k543k....',
  '..kYykk543k.....',
  '...kyy543k......',
  '....kyy3k.......',
  '...kNnyOk.......',
  '..kNnkkyOk......',
  '.kYyk..kOOk.....',
  '.kyOk...kk......',
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
  '....kkk..kkk....',
  '...kLLlkkLllk...',
  '..kkLllllllGkk..',
  '.kLlkllllllkLlk.',
  '.kLllklllGkllGk.',
  '.kllllkllkllGGk.',
  '..kllllGGllllk..',
  '..kllGlGGllGGk..',
  '.kLlllkggkllllk.',
  '.kllGkllllgllGk.',
  '.kGGklllllGgGGk.',
  '..kkllllGGGGgk..',
  '...kllGkkGGGkgk.',
  '....kkk..kkk.kk.',
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
  '....kyyOk.......',
  '...kyOk.........',
  '..kyk...........',
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
  '...kk.k54k.kk...',
  '..k55kk54kk43k..',
  '..k5555444443k..',
  '...k55444443k...',
  '..kk5544kk43kk..',
  '.k55544k..k433k.',
  '.k54444k..k333k.',
  '..kk444kkk33kk..',
  '...k44444333k...',
  '..k5444443333k..',
  '..k43kk43kk33k..',
  '...kk.k43k.kk...',
  '.......kk.......',
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
  power: BLANK,
  gear: GEAR,
  lock: BLANK,
  trash: BLANK,
  arrowUp: BLANK,
  rebirth: BLANK,
  dumpster: BLANK,
  potion: BLANK,
  dice: BLANK,
  book: BLANK,
  chart: BLANK,
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
