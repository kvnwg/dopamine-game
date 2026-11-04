/**
 * The battle view (Phaser). Reads GameState every frame and choreographs core events:
 * the raccoon hops along, closes in, winds up and dashes into a swing (pack hit effects, knockback),
 * enemies walk in, attack, flinch and fall with their own animations, pixel HP bars float over the
 * fighters' heads (the boss's sits under the HUD), and loot flies to the HUD. Combat results always
 * come from core; this file only animates them.
 *
 * Game feel (Kevin's checklist): a blow freezes the fight for a beat when it's big (hitStop: crits,
 * kills, heavy blows, longer for bosses, budgeted so a fast fight doesn't stutter), the view shakes
 * by whole pixels and the shake dies away (a one-pixel kick on a plain hit), struck foes squash and
 * spring back, sounds play on the frame a blow connects with their pitch climbing (blows as a foe's HP
 * goes, kills through a wave, coins as they land), and the phone buzzes on crits, kills, a boss and a
 * knock-out. A kill's gold and XP fly as coins and sparks to the HUD's counters, which hold them back
 * until they land (ui/hudFlight.ts), and "+N" pops under each counter as they get there.
 *
 * Everything is drawn on one pixel grid (P screen pixels per art pixel, docs/PIXEL_ART.md "One
 * grid"): Kevin's raccoon, the pack characters, the backdrops, the effects, the HP bars and the text
 * (the bitmap font in pixel/font.ts). Things move in whole art pixels: positions are snapped, pops
 * step and flash instead of scaling, particles are 1 x 1 and 2 x 2 art pixel bits, lines are pixel
 * lines, the screen shakes by whole art pixels. Squash and stretch change a sprite by whole art
 * pixels (rows shorter, as many columns wider), never by a fraction. Only the weapon's swing rotates
 * freely; a camera post-pass (gridSnap.ts) puts that, the squashes and anything else that slips off
 * the grid back on it (squashes are off without it).
 */
import Phaser from 'phaser';
import { BAL, DATA, SLOTS, type Rarity, type Slot } from '../data';
import {
  battleMaxHp, battleStats, chainFloor, computeStats, enemyName, formatNumber, perkFx, rarityAtLeast, rarityIndex, runEffects, worldDef, type CoreEvent, type CrewHelper,
  type GameState, type Item,
} from '../core';
import { bus } from '../app/eventBus';
import { gameStore } from '../app/store';
import { t } from '../ui/i18n';
import { totalXpForLevel, xpToNext } from '../core';
import { haptics } from '../services';
import { audio } from '../services/audio';
import { hold, land, release, releaseAll, useHudFlight, type Held } from '../ui/hudFlight';
import { rarityColor, rarityColorNum } from './art';
import {
  AURA, HERO, WEAPON_TILT, auraTex, coinTex, enemyTex, fxTex, gearTex, generateTextures, heroFrameOffset, heroTex, luckTokenTex, releaseWorlds,
  shadowTex, texOrigin, texSize, weaponTex, worldTextures, type FoeTex, type WorldKeys,
} from './textures';
import { SLAM_FROM, SLAM_HEIGHT, slamAnchor, slamBridge } from './equipSlam';
import { multOf, reelStops, tokenStops } from '../ui/reelTiming';
import { tokenKey } from '../ui/tokenFx';
import { luckBridge, luckRowsOf, luckSlot, TOKEN_FLIGHT_MS } from './luckRows';
import { P, toCanvas } from './pixel';
import { linePixels, mix } from './pixel/buf';
import { blank, fromRows, setPx } from './pixel/buf';
import { FACES, TEXT_INK, gradientRows, lineWidth, renderPlate, renderText, type FaceName, type TextStyle } from './pixel/font';
import { SPRITE_SLOTS } from './pixel/hero';
import { CHARACTER_OUTLINE, PAL } from './pixel/palette';
import { FEET_ROW, VIEW, VIEW_MARGIN, frameTop, type LayerName } from './pixel/sceneryTypes';
import { UI_MD, UI_SPRITES } from './pixel/ui';
import type { FxName } from './pixel/packs/fx';
import { CLOUD_SCROLL0, layerY, scenerySet, scroll0, worldArt, worldSeed } from './worldLook';
import { Ambience } from './ambience';
import { PixelBits, type BitStyle } from './pixelBits';
import { PixelTexts, type PixelText } from './pixelText';
import { snapCameraToGrid } from './gridSnap';

/** The battle view: 180 x 160 art pixels, 1080 x 960 screen pixels. */
export const BATTLE_W = VIEW.w * P;

/** A reel's row of luck tokens near the top of the battle (showLuckChains). */
interface LuckChain {
  tokens: Phaser.GameObjects.Image[];
  total: PixelText | null;
  /** The rarity a big chain guarantees, under the total. */
  floor: PixelText | null;
  /** The reel's tokens, and the steps that count squared (every reel matched them). */
  mults: readonly number[];
  squared: number[];
  row: number;
  y: number;
  /** Its reel has landed its item: the row is on its way out. */
  done: boolean;
  /** The best rarity its total has guaranteed so far (crossing a new one is celebrated). */
  floorSeen?: string | null;
}

/**
 * A luck row's total gets bigger and brighter as it stacks up (Kevin: a playtester "didn't notice
 * the tiers stack ... esp when it gets to a higher number"): green, blue from ×10, then in the huge
 * face purple from ×25 (an Epic or better guaranteed), gold from ×50 (Legendary or better) and rainbow
 * from ×250 (Mythic or better). Matched (squared) rows stay gold.
 */
function luckTotalStyle(mult: number, gold: boolean): { face: 'big' | 'huge'; fill: string[] } {
  const face = mult >= 25 ? 'huge' : 'big';
  if (gold) return { face, fill: ['#fffbe0', '#ffd84a'] };
  if (mult >= 250) return { face, fill: ['#ff6b6b', '#ffc233', '#7dff9a', '#5ad1ff', '#e48bff'] };
  if (mult >= 50) return { face, fill: ['#fff7b0', '#ffc233', '#ff8a00'] };
  if (mult >= 25) return { face, fill: ['#fbefff', '#d29bff', '#8a3ff0'] };
  if (mult >= 10) return { face, fill: ['#e6f9ff', '#5ad1ff'] };
  return { face, fill: ['#d8ffd0', '#46d36b'] };
}
export const BATTLE_H = VIEW.h * P;
/** The ground line: the bottom edge of the view row fighters stand on (y 828). */
const FEET_Y = (FEET_ROW + 1) * P;
/** How far (screen px) the full-view pictures reach past each edge, for the screen shake. */
const MARGIN = VIEW_MARGIN * P;
/** The raccoon's feet column while walking and fighting: about a third of the way across. */
const HERO_WALK_X = 52 * P;
const HERO_FIGHT_X = 56 * P;
/** Where the front enemy's leading edge stands while fighting (14 art pixels in front of the raccoon). */
const ENGAGE_EDGE = 70 * P;
/**
 * How fast the ground goes by while he walks (screen px per second): his walk's stride at its frame
 * rate (24 art px a second), so a planted foot keeps its place on the ground.
 */
const WALK_SPEED = HERO.walk.speed;
/** Where coins fly when the HUD's gold counter ([data-gold-target]) can't be found, and XP sparks without its XP bar ([data-xp-target]). */
const COIN_TARGET = { x: 694, y: 58 };
const XP_TARGET = { x: 312, y: 60 };
/**
 * Hit-stop: while frozen the fight runs at STOP_SPEED (tweens, animations, particles, movement). One
 * stop lasts at most STOP_MAX ms however many blows land in it. Small stops (crits, kills, heavy hits)
 * spend a budget (ms) that refills at STOP_REFILL ms a second, so a fight with a crit or a kill on
 * every swing doesn't stutter; boss kills and slams always stop.
 */
const STOP_SPEED = 0.04;
const STOP_MAX = 140;
const STOP_BUDGET = 200;
const STOP_REFILL = 130;
/** Hit-stops (ms): a kill, a heavy blow on the raccoon, a crit, a mini-boss's and a boss's last blow. */
const STOP = { kill: 45, heavy: 55, crit: 70, miniboss: 90, boss: 120 } as const;
/** Top of the boss HP bar: under the HUD row, with the boss's name (one or two lines) over it. */
const BOSS_BAR_Y = 41 * P;
const BAG_TARGET = { x: 190, y: BATTLE_H + 220 };
const INK_N = 0x1a1326;
/** Weapon angles in degrees (0 = pointing up, clockwise positive). */
const REST = WEAPON_TILT;
const WIND = -100;
const STRIKE = 128;
/** The weapon paw relative to the hero's feet, in the reference pose. */
const HAND = { x: HERO.hand.x - HERO.feet.x, y: HERO.hand.y - HERO.feet.y };
/** Hero sheet frames used directly (see tools/packs/chars.py): standing, crouched, stretched up, arms out, blushing, dash. */
const FRAME = { stand: 0, up: 2, squash: 4, armsOut: 13, blush: 14, dash: 15 } as const;

/**
 * HP bars are pixel art on the battle grid (every edge on a multiple of P): a frame in the characters'
 * outline brown with its corners cut, a lit top row over the main color, the part just lost showing
 * light (the ghost) until it drains, and a dark empty part. Tones are [top row, rows below].
 */
type BarTones = readonly [top: number, main: number];
const hexNum = (hex: string) => parseInt(hex.slice(1), 16);
const BAR_LINE = hexNum(CHARACTER_OUTLINE);
const BAR_HERO: BarTones = [hexNum(PAL.L), hexNum(PAL.l)];
const BAR_FOE: BarTones = [hexNum(PAL.e), hexNum(PAL.R)];
const BAR_BOSS: BarTones = [hexNum(PAL.y), hexNum(PAL.O)];
const BAR_GHOST: BarTones = [hexNum(PAL.w), hexNum(PAL.W)];
/** The empty part reads as a groove (shadowed top row), light enough to show on night skies. */
const BAR_EMPTY: BarTones = [hexNum(PAL['1']), hexNum(PAL['2'])];
/** Bar sizes in art pixels, outline included. Fighters' bars are as wide as their art allows. */
const BAR_TALL = 5;
const FOE_BAR_W = { min: 10, max: 16 };
const HERO_BAR_W = 14;
const BOSS_BAR = { w: 78, h: 7 };
/**
 * The heart (7 x 7, a pixel over and under the bar) shares its right column with the hero bar's left
 * edge; the skull (11 x 11, two over and under) sits left of the boss bar.
 */
const HEART_W = 7;
const SKULL_W = 11;
/** Art pixels between a bar and the top of the head under it. */
const BAR_GAP = 2;
/** Seconds the light part of a fresh hit holds before it drains. */
const GHOST_HOLD = 0.3;

// ------------------------------------------------------------------ text styles (pixel/font.ts)

/** A fill with a lighter top row over `color`. */
const litTop = (color: string): readonly string[] => [mix(color, '#ffffff', 0.55), color];
/** A fill for `face` in three flat bands from `top` to `bottom`. */
const bands = (grad: readonly [string, string], face: FaceName = 'huge'): readonly string[] => gradientRows(grad[0], grad[1], FACES[face].h);
/** Widest a line of battle text may be (art px), leaving room for the outline and a margin. */
const TEXT_MAX_W = VIEW.w - 8;
/**
 * Faces: pop-up numbers and small notes in the 5 x 7 face, big moments (crits, level ups, banners,
 * stamps, the world's name) in the 7 x 9 bold one. (On the 6 px grid the 3 x 5 face is too small to
 * read at a glance.)
 */
const NUMBER: FaceName = 'big';
const BIG_NUMBER: FaceName = 'huge';
const BOSS_NAME: TextStyle = { face: 'big', fill: '#ffffff', maxW: TEXT_MAX_W };
const BOSS_HP: TextStyle = { face: 'big', fill: '#ffffff' };
/** The world's title card: "WORLD 1" over its name (font.ts TextStyle.lead). */
const WORLD_CARD: TextStyle = { face: 'huge', lead: 'big', fill: litTop('#ffffff'), shadow: true, maxW: TEXT_MAX_W };
/** A heist's corner badge: "HEIST" over "ACT 1 · 3/19". */
const HEIST_BADGE: TextStyle = { face: 'big', lead: 'small', fill: litTop('#ffd23f'), shadow: true, align: 'left' };
const GOLD: readonly [string, string] = ['#fff6a8', '#ffa21a'];

/** The "too tough" notice: a cream plate like the toasts', ink text, its first sentence big and red. */
const NOTICE = { bg: ['#fff0e0', '#ffe0c8', '#ffd0b0'], head: '#c8323a', ms: 2400 } as const;

// ------------------------------------------------------------------ particle styles (pixelBits.ts, art px)

const SPARK: BitStyle = { speed: [27, 58], life: [200, 360], drag: 2, colors: [0xffffff], fade: [0xfff28c], sizes: [2, 1] };
const BIG_SPARK: BitStyle = {
  speed: [40, 96], life: [380, 680], drag: 2.5, colors: [0xffe14a, 0xffffff, 0xffb300], fade: [0xffb300], sizes: [2, 2, 1],
};
/** The Alley crew's sparks and damage numbers, in each helper's colors (feathers, fur, gull white, the mob's red, crust). */
const CREW_SPARKS: Record<CrewHelper, Pick<BitStyle, 'colors' | 'fade'>> = {
  pigeon: { colors: [0xcfcedb, 0xffffff], fade: [0x7f7c94] },
  rats: { colors: [0xa7a5b8, 0xffa5a5], fade: [0x5b5870] },
  gull: { colors: [0xffffff, 0xf5c638], fade: [0xcfcedb] },
  mafia: { colors: [0xee6150, 0xffffff], fade: [0x7d1d2c] },
  golem: { colors: [0xecc596, 0xf4efe1], fade: [0x995b3a] },
};
const CREW_NUMBER: Record<CrewHelper, string> = { pigeon: '#cfe8ff', rats: '#e5cfff', gull: '#fff6a8', mafia: '#ffb4a8', golem: '#ffd9a0' };
/**
 * The crew's pigeons by the raccoon (a heist's Pigeon Pal and Pigeon Air Force, the Alley's Pigeon
 * Wingman): the crew perk's 10 x 10 pigeon, drawn facing left (ui.ts UI_MD), in the characters' outline.
 */
const PIGEON_ROWS = UI_MD.pigeon ?? UI_SPRITES.pigeon;
const PIGEON_W = PIGEON_ROWS[0].length;
const PIGEON_H = PIGEON_ROWS.length;
/** Where each pigeon waits: art px from the raccoon's feet column back to its left edge, and up (the third one flies). */
const PIGEON_PERCH = [
  { back: 24, up: 0 },
  { back: 36, up: 0 },
  { back: 30, up: 13 },
] as const;
/** A peck (seconds): the flight out to the foe, the peck, the flight home; and how high the hop arcs (art px). */
const PIGEON_TRIP = { out: 0.16, peck: 0.14, back: 0.32, arc: 8 } as const;

/** A crew pigeon's picture, facing right (at the foes) or left (on its way home). */
function pigeonTex(scene: Phaser.Scene, right: boolean): string {
  const key = right ? 'crew_pigeon_r' : 'crew_pigeon_l';
  if (!scene.textures.exists(key)) {
    const rows = right ? PIGEON_ROWS.map((r) => [...r].reverse().join('')) : PIGEON_ROWS;
    scene.textures.addCanvas(key, toCanvas(fromRows(rows, { k: CHARACTER_OUTLINE }), 1));
  }
  return key;
}
/** Glimmer boxes for pieces drawn into his body's texture (half sizes in art px around where the slot sits). */
const GLIMMER_BOX: Partial<Record<Slot, { w: number; h: number }>> = {
  jacket: { w: 4, h: 3 }, gloves: { w: 5, h: 2 }, sneakers: { w: 4, h: 1 }, bling: { w: 3, h: 2 }, ring: { w: 4, h: 2 },
};
const DUST: BitStyle = { speed: [4.5, 17], angle: [180, 360], life: [360, 560], colors: [0xe8e0d0], sizes: [2, 1], alpha: [0.85, 0.55, 0.3] };
const FLAME: BitStyle = { speedX: [-4.5, 4.5], speedY: [-24, -13], life: [300, 520], colors: [0xffe14a, 0xffb300], fade: [0xff7043, 0xc8323a], sizes: [2, 1] };
const CONFETTI_COLORS = [0xff5a7a, 0xffd54f, 0x5bd23a, 0x4fc3f7] as const;
/** Confetti fills the view (its spread follows the view, not the fighters). */
const CONFETTI: BitStyle = { speed: [53, 127], angle: [200, 340], gravity: 150, drag: 1.2, life: [900, 1500], colors: CONFETTI_COLORS, tumble: 90 };
/** A foe pops when it goes down: a ring of bits, more and faster for bigger foes (see die). */
const KILL_POP: BitStyle = { speed: [30, 64], life: [200, 380], drag: 2.6, colors: [0xffffff, 0xfff6c8], fade: [0xffe14a, 0xffb300], sizes: [2, 1] };
/** XP sparks on their way to the XP bar (xpSparkTex) leave a short trail. */
const XP_TRAIL: BitStyle = { speed: [0, 2], life: [140, 220], colors: [0x7ef08f], fade: [0x2fb150], alpha: [0.8, 0.45] };
/** "+N" gold and "+N XP" pop-ups. */
const GOLD_GAIN = bands(GOLD, 'big');
const XP_GAIN = bands(['#e6ffd8', '#46d36b'], 'big');

/** The damage trail behind an HP bar. */
interface Trail {
  /** The HP the light part still reaches. */
  hp: number;
  /** Seconds before it starts to drain. */
  hold: number;
}

/** Moves a trail toward `hp`: a hit holds a moment, then drains (faster for a bigger gap); heals show at once. */
function drainTrail(t: Trail, hp: number, max: number, dt: number): void {
  if (hp >= t.hp) {
    t.hp = hp;
    t.hold = GHOST_HOLD;
    return;
  }
  if (t.hold > 0) {
    t.hold -= dt;
    return;
  }
  t.hp = Math.max(hp, t.hp - (max * 0.3 + (t.hp - hp) * 3) * dt);
}

/**
 * How many of a bar's `inner` columns are full and how far the trail reaches: the nearest column, but
 * the last sliver stays until 0, so a bar never reads empty while its fighter stands.
 */
function barCells(inner: number, pct: number, ghost: number): { fill: number; trail: number } {
  const cells = (k: number) => (k >= 1 ? inner : k > 0 ? Phaser.Math.Clamp(Math.round(k * inner), 1, inner) : 0);
  const fill = cells(pct);
  return { fill, trail: Math.max(fill, cells(ghost)) };
}

type Kind = 'regular' | 'miniboss' | 'boss';
type HeroMode = 'idle' | 'walk' | 'swing' | 'hurt' | 'cheer' | 'ko' | 'wake';

interface Foe {
  uid: number;
  id: string;
  kind: Kind;
  c: Phaser.GameObjects.Container;
  rig: Phaser.GameObjects.Container;
  spr: Phaser.GameObjects.Sprite;
  tex: FoeTex;
  /** Its HP bar over its head (regular foes; the boss has the big one under the HUD). */
  bar: Phaser.GameObjects.Graphics;
  /** The bar's top-left corner relative to the feet (screen px, multiples of P) and its width (art px). */
  barX: number;
  barY: number;
  barW: number;
  /** What the bar shows (it's redrawn only when this changes). */
  barSig: string;
  front: number;
  back: number;
  height: number;
  x: number;
  lunge: number;
  knock: number;
  knockV: number;
  shownHp: number;
  trail: Trail;
  maxHp: number;
  /** Visual hits still on their way (so the sprite outlives its core death until the blow lands). */
  pending: number;
  dead: boolean;
  dying: boolean;
  /** A one-shot animation (attack / hurt) is playing; the base loop resumes after it. */
  acting: boolean;
}

interface Swing {
  targetUid: number;
  amount: number;
  crit: boolean;
  echo: boolean;
  killed: boolean;
  /** Effects that ride on this blow (chain lightning, explosions). */
  riders: Array<() => void>;
}

/** A crew pigeon: its picture, which way it faces, and its peck in progress (null: on its perch). */
interface Pigeon {
  img: Phaser.GameObjects.Image;
  right: boolean;
  trip: {
    /** Seconds into the trip, and the foe it flies at (its last spot, should the foe go). */
    t: number;
    uid: number;
    to: { x: number; y: number };
    /** The peck's sparks and number: they show as it lands. */
    land: () => void;
    landed: boolean;
  } | null;
}

type Movable = Phaser.GameObjects.GameObject & { x: number; y: number };

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeOutQuad = (k: number) => 1 - (1 - k) * (1 - k);
const easeInQuad = (k: number) => k * k;
const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
const easeOutBack = (k: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};
/** Snaps a screen offset to the pixel grid. */
const snap = (v: number) => Math.round(v / P) * P;
/** An opacity in `n` flat steps (1 down to 0 as k goes 0 to 1). */
const stepsDown = (k: number, n = 3) => 1 - Math.min(n, Math.floor(k * (n + 1))) / n;

/** Splits "Too tough! Keep rolling..." into its first sentence and the rest (or no head). */
function headline(text: string): { head: string | null; rest: string } {
  const m = /^(.{2,24}?[!?.])\s+(.+)$/.exec(text);
  if (m && lineWidth(m[1], FACES.huge) <= TEXT_MAX_W) return { head: m[1], rest: m[2] };
  return { head: null, rest: text };
}

/** "World 1 · Sunny Suburbs" as a kicker over the name ("World 1\nSunny Suburbs"), or as it is. */
function titleLines(label: string): string {
  const m = /^(.+?)\s+·\s+(.+)$/.exec(label);
  return m ? `${m[1]}\n${m[2]}` : label;
}

/**
 * Core reports a blow's kill (and a blast the kill sets off) before the blow itself. The battle takes
 * each kill's blow first, so the kill, the blast and their deaths wait for the swing to land (and its
 * hit-stop, sound and buzz with them) instead of playing before it connects.
 */
function blowsFirst(events: readonly CoreEvent[]): CoreEvent[] {
  const out: CoreEvent[] = [];
  const moved = new Set<number>();
  events.forEach((e, i) => {
    if (moved.has(i)) return;
    if (e.type === 'kill') {
      const j = events.findIndex((x, k) => k > i && !moved.has(k) && x.type === 'playerHit' && x.targetUid === e.enemyUid);
      if (j >= 0) {
        moved.add(j);
        out.push(events[j]);
      }
    }
    out.push(e);
  });
  return out;
}

/**
 * An XP spark (1 texel per art pixel: draw with setScale(P)): a 5 x 5 pixel diamond with a green rim,
 * white in the middle and light green arms, or the other way round (it twinkles between the two).
 */
function xpSparkTex(scene: Phaser.Scene, frame: 0 | 1): string {
  const key = `xp_spark_${frame}`;
  if (!scene.textures.exists(key)) {
    const b = blank(5, 5);
    const [core, arm] = frame ? ['#b6ffa8', '#ffffff'] : ['#ffffff', '#b6ffa8'];
    for (const [x, y] of [[2, 0], [1, 1], [3, 1], [0, 2], [4, 2], [1, 3], [3, 3], [2, 4]]) setPx(b, x, y, '#2fb150');
    for (const [x, y] of [[2, 1], [1, 2], [3, 2], [2, 3]]) setPx(b, x, y, arm);
    setPx(b, 2, 2, core);
    scene.textures.addCanvas(key, toCanvas(b, 1));
  }
  return key;
}

/**
 * A horizontally tiling layer (scenery, cloud strips) drawn as copies of its texture side by side, each
 * at a whole art pixel. (Phaser's TileSprite redraws a texture whose size isn't a power of two into one
 * that is, with smoothing on, which resamples and blurs the art.)
 */
class Strip {
  private imgs: Phaser.GameObjects.Image[] = [];
  /** Copies in use. */
  private n = 0;
  private w = 1;
  private y = 0;
  private visible = true;

  constructor(private scene: Phaser.Scene, private depth: number) {}

  /** Shows texture `key`, `w` screen px wide (one tile). */
  setTexture(key: string, w: number): this {
    this.w = Math.max(P, w);
    // Enough copies to cover the view and its margins from any scroll.
    this.n = Math.ceil((BATTLE_W + 2 * MARGIN) / this.w) + 2;
    while (this.imgs.length < this.n) this.imgs.push(this.scene.add.image(0, this.y, key).setOrigin(0, 0).setDepth(this.depth));
    this.imgs.forEach((img, i) => img.setTexture(key).setOrigin(0, 0).setVisible(this.visible && i < this.n));
    return this;
  }

  setY(y: number): this {
    this.y = y;
    for (const img of this.imgs) img.y = y;
    return this;
  }

  setVisible(v: boolean): this {
    this.visible = v;
    this.imgs.forEach((img, i) => img.setVisible(v && i < this.n));
    return this;
  }

  /** Hides it and lets go of its texture (about to be freed). */
  clear(): this {
    for (const img of this.imgs) img.setTexture('__DEFAULT');
    return this.setVisible(false);
  }

  /** Puts texture column `s` (screen px) at the view's left edge, at the nearest whole art pixel. */
  scrollTo(s: number): this {
    const off = ((snap(s) % this.w) + this.w) % this.w;
    let x = -off;
    if (x > -MARGIN) x -= this.w;
    this.imgs.forEach((img, i) => {
      img.x = x + i * this.w;
    });
    return this;
  }
}

export class BattleScene extends Phaser.Scene {
  private sky!: Phaser.GameObjects.Image;
  private cover!: Phaser.GameObjects.Rectangle;
  private worldShown = 0;
  private layers!: Record<LayerName, Strip>;
  /** Each layer's scroll (screen px, the texture column at the view's left edge); drawn at whole art pixels. */
  private scroll: Record<LayerName, number> = { far: 0, mid: 0, ground: 0, fg: 0 };
  /** Cloud strips, back to front, their drift in art pixels per second and their scroll. */
  private clouds: Array<{ strip: Strip; speed: number; scroll: number }> = [];
  /** The sun, moon or planet and its halo, over the clouds. */
  private glow!: Phaser.GameObjects.Image;
  private vignette!: Phaser.GameObjects.Image;
  private ambience!: Ambience;
  /** Last world's foe textures still on screen (a dying foe): freed once it's gone. */
  private releaseLater = false;
  private hero!: Phaser.GameObjects.Container;
  private rig!: Phaser.GameObjects.Container;
  private heroSpr!: Phaser.GameObjects.Sprite;
  private gearBack!: Phaser.GameObjects.Container;
  private gearFront!: Phaser.GameObjects.Container;
  private arm!: Phaser.GameObjects.Container;
  private weapon!: Phaser.GameObjects.Image;
  /** How far the current weapon's art leans from straight up. */
  private weaponTilt = WEAPON_TILT;
  /** The Legendary-or-better glow (two breathing frames) and the glints that rise from it. */
  private aura!: Phaser.GameObjects.Image;
  private auraColor: string | null = null;
  private auraT = 0;
  private glintT = 0;
  private heroBar!: Phaser.GameObjects.Graphics;
  private heart!: Phaser.GameObjects.Image;
  private heroBarSig = '';
  private heroTrail: Trail = { hp: 0, hold: 0 };
  /** How high the raccoon reaches above the ground, hat included (screen px). */
  private heroTop = HERO.top;
  /** The boss's bar, skull, name and HP, faded as one. */
  private bossUi!: Phaser.GameObjects.Container;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossName!: PixelText;
  private bossHp!: PixelText;
  private bossSig = '';
  private texts!: PixelTexts;
  /** Effect particles: in front of the fighters, dust at their feet, confetti on top, glints by the hero. */
  private bits!: PixelBits;
  private dust!: PixelBits;
  private confetti!: PixelBits;
  private glints!: PixelBits;
  /** Objects that move by tween but are drawn at whole art pixels. */
  private locked = new Set<Movable>();
  /** Stamps on screen and where they landed (screen px, centers and sizes), so a new one doesn't cover them. */
  private stamps: Array<{ tx: PixelText; x: number; y: number; w: number; h: number }> = [];
  /** The world's name as it arrives, and the "too tough" notice. */
  private worldCard: PixelText | null = null;
  private notice: Phaser.GameObjects.Image | null = null;
  private noticeN = 0;
  private hintWas = false;
  /** Screen shake: seconds left and its length, its peak reach (art px), seconds to the next jolt, which way the last one went. */
  private shakeT = 0;
  private shakeLen = 0;
  private shakeAmp = 0;
  private shakeNext = 0;
  private shakeSide = 1;
  private shakeFlat = false;
  /** Hit-stop: when it ends and when it began (performance.now() ms), its timer, and the small stops' budget (ms). */
  private stopUntil = 0;
  private stopFrom = 0;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private stopBudget = STOP_BUDGET;
  /** The camera post-pass is on (squash and stretch rely on it to land on the grid). */
  private snapped = false;
  /** Running squash-and-stretch tweens, by the object they squash. */
  private squashes = new Map<object, Phaser.Tweens.Tween>();
  /** Kills in this wave (the kill sound climbs with them) and when the last one was. */
  private streak = { n: 0, at: 0 };
  /** When the last light buzz went off (they're kept at least 120 ms apart). */
  private buzzAt = 0;
  /** Gold, level and XP as of the last batch of events or frame (what a batch adds is what its kills hold back). */
  private seen = { coins: 0, level: 1, xp: 0 };
  /** The "+N" under each HUD counter, and when it went up (more landing soon after adds to it). */
  private notes: Record<'gold' | 'xp', { tx: PixelText; sum: number; at: number } | null> = { gold: null, xp: null };
  private foes = new Map<number, Foe>();
  /**
   * Kills by foe, until the blow that caused them lands: what kind of foe and its gold, the gold and XP
   * held off the HUD until its coins and sparks get there, the XP it gave the raccoon (none in a heist
   * or at the level cap; given but not held when it levels him up), and whether the phone already
   * buzzed for it (a boss win does).
   */
  private kills = new Map<number, { kind: Kind; coins: number; gold: Held; xp: Held; xpGain: number; buzzed: boolean }>();
  private swingQueue: Swing[] = [];
  private swinging = false;
  private heroX = HERO_WALK_X;
  private heroDx = 0;
  private heroKnock = 0;
  private walkT = 0;
  private dead = false;
  private mode: HeroMode = 'idle';
  /** Seconds left in a short hero pose (hurt, cheer). */
  private poseT = 0;
  private gearSig = '';
  /**
   * Slots whose new gear is still flying to him (src/ui/components/EquipFlight.tsx): until it hits,
   * he keeps wearing what was there before (the item it replaced, or nothing).
   */
  private pendingGear = new Map<Slot, Item | null>();
  /** The worn pieces drawn as their own images (hat, mask, shield, backpack), by slot. */
  private gearImgs = new Map<Slot, Phaser.GameObjects.Image>();
  /** Scene time until which he stays squashed a pixel under an equip slam. */
  private squashUntil = 0;
  private hpCache: { key: unknown; perks: unknown; hp: number } = { key: null, perks: null, hp: 1 };
  private healAcc = 0;
  private healTimer = 0;
  private coinsFlying = 0;
  /** The crew's pigeons (updatePigeons) and the clock their bobbing keeps time with. */
  private pigeons: Pigeon[] = [];
  private pigeonClock = 0;
  private unsub?: () => void;
  /** Luck tokens on their way into their rows, by key (tokenFx.ts tokenKey): each shows itself once (landLuck). */
  private luckPending = new Map<string, () => void>();

  constructor() {
    super('Battle');
  }

  private get reduceMotion() {
    return gameStore.getState().game.settings.reduceMotion;
  }
  private get reduceFlashing() {
    return gameStore.getState().game.settings.reduceFlashing;
  }

  create() {
    generateTextures(this);
    this.texts = new PixelTexts(this);
    this.buildBackground();
    this.buildHero();
    this.buildEffects();
    this.heroBar = this.add.graphics().setDepth(40);
    this.heart = this.add.image(0, 0, 'bar_heart').setOrigin(0, 0).setDepth(40.5);
    this.buildBossBar();
    this.cover = this.add.rectangle(-MARGIN, -MARGIN, BATTLE_W + 2 * MARGIN, BATTLE_H + 2 * MARGIN, 0xffffff, 1).setOrigin(0, 0).setDepth(60).setAlpha(0);
    this.heroTrail.hp = gameStore.getState().game.battle.playerHp;
    this.hintWas = gameStore.getState().game.stage.showToughHint;
    // The camera's origin at its top-left corner: with the default (its middle), an odd view height puts
    // everything half a pixel off, and rounding then moves it a whole screen pixel off the grid.
    this.cameras.main.setOrigin(0, 0);
    this.snapped = snapCameraToGrid(this);
    this.look(gameStore.getState().game);
    // Tweened things land on whole art pixels.
    this.events.on(Phaser.Scenes.Events.PRE_RENDER, () => {
      for (const o of this.locked) {
        o.x = snap(o.x);
        o.y = snap(o.y);
      }
    });
    this.unsub = bus.on((events) => this.onEvents(events));
    // The equip flight (in the DOM) calls in when an item starts its dive and when it hits.
    const dive = (item: Item, tier: number, ms: number) => this.slamDive(item, tier, ms);
    const impact = (item: Item, tier: number) => this.slamImpact(item, tier);
    slamBridge.dive = dive;
    slamBridge.impact = impact;
    const kick = (ms: number, px: number) => this.shake(ms, (px * P) / BATTLE_W, 1);
    slamBridge.shake = kick;
    const landLuck = (key: string) => this.landLuck(key);
    luckBridge.land = landLuck;
    const done = () => {
      this.unsub?.();
      this.texts.destroy();
      if (slamBridge.dive === dive) slamBridge.dive = undefined;
      if (slamBridge.impact === impact) slamBridge.impact = undefined;
      if (slamBridge.shake === kick) slamBridge.shake = undefined;
      if (luckBridge.land === landLuck) luckBridge.land = undefined;
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, done);
    this.events.once(Phaser.Scenes.Events.DESTROY, done);
    // Once the battle is gone nothing stays frozen or held off the HUD.
    const settle = () => {
      if (this.stopTimer) clearTimeout(this.stopTimer);
      this.stopTimer = null;
      releaseAll('gold');
      releaseAll('xp');
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, settle);
    this.events.once(Phaser.Scenes.Events.DESTROY, settle);
    this.showWorldCard(this.worldShown);
  }

  /** Keeps a tweened object on whole art pixels (until it's destroyed). */
  private gridLock<T extends Movable>(o: T): T {
    this.locked.add(o);
    o.once(Phaser.GameObjects.Events.DESTROY, () => this.locked.delete(o));
    return o;
  }

  /**
   * The boss bar sits right under the HUD (the sky there is otherwise clear): a wide pixel bar with a
   * skull at its left end, the boss's name centered over it (two lines if it's long) and its HP to the
   * right, outside the bar.
   */
  private buildBossBar() {
    const x = BATTLE_W / 2 - (BOSS_BAR.w * P) / 2;
    this.bossBar = this.add.graphics().setPosition(x, BOSS_BAR_Y);
    // The skull's right column is the bar's left edge; it stands 2 art px over and under the bar.
    const skull = this.add.image(x - (SKULL_W - 1) * P, BOSS_BAR_Y - 2 * P, 'bar_skull').setOrigin(0, 0);
    this.bossName = this.texts.add('', BOSS_NAME);
    this.bossHp = this.texts.add('', BOSS_HP);
    this.bossUi = this.add.container(0, 0, [this.bossBar, skull, this.bossName, this.bossHp]).setDepth(40).setAlpha(0).setVisible(false);
  }

  // ------------------------------------------------------------------ scenery
  private buildBackground() {
    const world = gameStore.getState().game.battle.stage;
    const k = worldTextures(this, world);
    this.worldShown = world;
    // Back to front: sky (0), stars (0.5), clouds (1), the sun or moon and its halo (1.5), lightning
    // (1.7), the far, mid and ground layers (2 to 4, torches 2.5), particles behind the fighters (5),
    // fighters, the foreground (30), particles in front (31), the vignette (32), effects and UI.
    // Full-view pictures reach MARGIN past every edge (the screen shake never shows an edge).
    this.sky = this.add.image(-MARGIN, -MARGIN, k.sky).setOrigin(0, 0).setScale(P).setDepth(0);
    for (let i = 0; i < 2; i++) this.clouds.push({ strip: new Strip(this, 1 + i * 0.1), speed: 0, scroll: CLOUD_SCROLL0[i] * P });
    this.glow = this.add.image(0, 0, '__DEFAULT').setOrigin(0, 0).setScale(P).setDepth(1.5).setVisible(false);
    this.layers = { far: new Strip(this, 2), mid: new Strip(this, 3), ground: new Strip(this, 4), fg: new Strip(this, 30) };
    this.vignette = this.add.image(-MARGIN, -MARGIN, k.vignette).setOrigin(0, 0).setScale(P).setDepth(32);
    this.ambience = new Ambience(this, { stars: 0.5, bolt: 1.7, torch: 2.5, back: 5, front: 31, flash: 31.5 });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.ambience.destroy());
    this.placeLayers(world, k, true);
  }

  /** Sets a layer's scroll (screen px) and draws it at the nearest whole art pixel. */
  private scrollLayer(name: LayerName, to: number) {
    this.scroll[name] = to;
    this.layers[name].scrollTo(to);
  }

  /** Puts each layer, the clouds and the sun or moon at the world's placement; `reset` restarts the scroll. */
  private placeLayers(world: number, keys: WorldKeys, reset: boolean) {
    const set = scenerySet(worldDef(world));
    const y = layerY(set);
    const s0 = scroll0(set);
    for (const name of ['far', 'mid', 'ground', 'fg'] as const) {
      this.layers[name].setTexture(keys[name], texSize(keys[name]).w).setY(y[name]);
      this.scrollLayer(name, reset ? s0[name] : this.scroll[name]);
    }
    this.clouds.forEach((c, i) => {
      const strip = keys.clouds[i];
      // (Hidden strips drop the last world's texture, which is about to be freed.)
      if (!strip) {
        c.strip.clear();
        return;
      }
      c.strip.setVisible(true).setTexture(strip.key, texSize(strip.key).w).setY(strip.y * P).scrollTo(c.scroll);
      c.speed = strip.speed;
    });
    if (keys.glow) this.glow.setTexture(keys.glow.key).setPosition(keys.glow.x * P, keys.glow.y * P).setVisible(true);
    else this.glow.setTexture('__DEFAULT').setVisible(false);
    this.vignette.setTexture(keys.vignette);
    const art = worldArt(world);
    this.ambience.setWorld({
      atmo: art.atmo, seed: worldSeed(world), top: frameTop(set), scale: art.scale, sky: set.sky, flicker: art.flicker, layerY: y, tileW: set.tileW,
    });
  }

  /** Texture keys of the foes on screen. */
  private foeTextures(): Set<string> {
    return new Set([...this.foes.values()].map((f) => f.tex.key));
  }

  /** Swaps in another world's sky and scenery, revealed from under a sky-colored cover. */
  private showWorld(world: number) {
    if (world === this.worldShown) return;
    const before = scenerySet(worldDef(this.worldShown));
    this.worldShown = world;
    const k = worldTextures(this, world);
    this.sky.setTexture(k.sky);
    this.placeLayers(world, k, scenerySet(worldDef(world)) !== before);
    this.releaseLater = releaseWorlds(this, world, this.foeTextures()) > 0;
    this.showWorldCard(world);
    this.tweens.killTweensOf(this.cover);
    if (this.reduceMotion || this.reduceFlashing) {
      this.cover.setAlpha(0);
      return;
    }
    const sky = worldDef(world).look.atmo.sky;
    this.cover.setFillStyle(Phaser.Display.Color.HexStringToColor(sky[sky.length - 1]).color, 1).setAlpha(1);
    // The reveal fades in four flat steps.
    this.tweens.add({ targets: this.cover, alpha: 0, duration: 450, ease: 'Stepped', easeParams: [4] });
  }

  /**
   * The world's name as a title card on arrival ("World 1 · Sunny Suburbs"), then the sky is clear
   * again: up two art pixels into place and in (two steps), held, then up a pixel and out (three
   * steps), 2.8 seconds in all. With reduce motion it only fades.
   */
  private showWorldCard(world: number) {
    this.worldCard?.destroy();
    const name = DATA.worlds[world - 1]?.name ?? '';
    const card = this.texts.add(titleLines(t('battle.worldLabel', { n: world, name })), WORLD_CARD).setDepth(48);
    this.worldCard = card;
    const y = 21 * P;
    const still = this.reduceMotion;
    card.place(BATTLE_W / 2, y, 0.5, 0).setAlpha(0);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 2800,
      onUpdate: (tw) => {
        if (!card.active) return;
        const k = tw.getValue() ?? 0;
        let dy = 0;
        let alpha = 1;
        if (still) {
          alpha = k < 0.85 ? 1 : stepsDown((k - 0.85) / 0.15);
        } else if (k < 0.12) {
          const u = k / 0.12;
          dy = u < 0.5 ? 2 : u < 0.85 ? 1 : 0;
          alpha = u < 0.5 ? 0.5 : 1;
        } else if (k >= 0.78) {
          const u = (k - 0.78) / 0.22;
          dy = u < 0.5 ? 0 : -1;
          alpha = stepsDown(u);
        }
        card.place(BATTLE_W / 2, y + dy * P, 0.5, 0).setAlpha(alpha);
      },
      onComplete: () => {
        card.destroy();
        if (this.worldCard === card) this.worldCard = null;
      },
    });
  }

  /**
   * "Too tough! Keep rolling for better gear." when the raccoon is beaten back a world: a cream plate
   * under the world's title, its first sentence big. It drops in by whole art pixels and is gone after
   * 2.4 seconds, like the toast it replaces.
   */
  private showToughNotice() {
    this.notice?.destroy();
    const { head, rest } = headline(t('battle.toughHint'));
    const parts = [
      ...(head ? [renderText(head, { face: 'huge', fill: NOTICE.head, ink: null })] : []),
      renderText(rest, { face: 'big', fill: TEXT_INK, ink: null, maxW: TEXT_MAX_W - 12 }),
    ];
    const plate = renderPlate(parts, NOTICE.bg);
    const key = `notice_${this.noticeN++}`;
    this.textures.addCanvas(key, toCanvas(plate, 1));
    const img = this.add.image(0, 0, key).setOrigin(0, 0).setScale(P).setDepth(55);
    img.once(Phaser.GameObjects.Events.DESTROY, () => this.time.delayedCall(0, () => this.textures.exists(key) && this.textures.remove(key)));
    this.notice = img;
    const x = snap(BATTLE_W / 2 - (plate.w * P) / 2);
    // Under the world's title card (rows 21 to 40; it shows too: the raccoon was just sent back a world).
    const y = 43 * P;
    const drop = this.reduceMotion ? [0] : [-3, -2, -1, 0];
    drop.forEach((dy, i) => this.time.delayedCall(i * 40, () => img.active && img.setPosition(x, y + dy * P)));
    img.setPosition(x, y + drop[0] * P);
    [0.66, 0.33].forEach((a, i) => this.time.delayedCall(NOTICE.ms - 160 + i * 80, () => img.active && img.setAlpha(a)));
    this.time.delayedCall(NOTICE.ms, () => {
      img.destroy();
      if (this.notice === img) this.notice = null;
    });
  }

  // ------------------------------------------------------------------ hero
  private buildHero() {
    const body = heroTex(this);
    this.hero = this.add.container(HERO_WALK_X, FEET_Y).setDepth(20);
    // A flat pixel shadow on the feet row and the row under it, centered on the feet column.
    const sh = shadowTex(this, 13);
    const shadow = this.add.image(-Math.floor(sh.w / 2) * P, -P, sh.key).setOrigin(0, 0).setAlpha(0.22);
    this.aura = this.add.image(0, 0, '__DEFAULT').setOrigin(0, 0).setVisible(false);
    // The body's feet origin is the middle of its anchor column (textures.ts: HERO), so the rig sits half
    // an art pixel right: then, with the container on a whole art pixel, every pixel is on the grid.
    this.rig = this.add.container(P / 2, 0);
    this.gearBack = this.add.container(0, 0);
    this.heroSpr = this.add.sprite(0, 0, body.key, String(FRAME.stand)).setOrigin(body.ox, body.oy).setScale(P);
    this.gearFront = this.add.container(0, 0);
    this.arm = this.add.container(HAND.x, HAND.y);
    const w = weaponTex(this, null);
    this.weapon = this.add.image(0, 0, w.key).setOrigin(w.ox, w.oy);
    this.aimWeapon(REST);
    this.arm.add(this.weapon);
    this.rig.add([this.gearBack, this.heroSpr, this.gearFront, this.arm]);
    this.hero.add([shadow, this.aura, this.rig]);
    this.heroSpr.play('hero:idle');
  }

  /** Dresses him in `eq` (what he shows as worn: see shownEquipped). */
  private drawGear(eq: GameState['equipped']) {
    const id = (s: (typeof SLOTS)[number]) => eq[s]?.baseId ?? null;
    heroTex(this, { jacket: id('jacket'), gloves: id('gloves'), sneakers: id('sneakers'), bling: id('bling') });
    this.gearBack.removeAll(true);
    this.gearFront.removeAll(true);
    this.gearImgs.clear();
    this.heroTop = HERO.top;
    // Front order, back to front: shield, mask, hat.
    for (const slot of ['backpack', 'shield', 'mask', 'hat'] as const) {
      const base = id(slot);
      if (!base || !(SPRITE_SLOTS as readonly string[]).includes(slot)) continue;
      const i = gearTex(this, slot, base);
      if (!i) continue;
      const img = this.add.image(0, 0, i.key).setOrigin(i.ox, i.oy);
      (i.behind ? this.gearBack : this.gearFront).add(img);
      this.gearImgs.set(slot, img);
      // A tall hat lifts his HP bar.
      this.heroTop = Math.max(this.heroTop, i.top);
    }
    const w = weaponTex(this, id('weapon'));
    this.weapon.setTexture(w.key).setOrigin(w.ox, w.oy);
    this.weaponTilt = w.tilt;
    this.aimWeapon(REST);
    // A pixel glow for Legendary-or-better gear.
    let best: Rarity | null = null;
    for (const s of SLOTS) {
      const it = eq[s];
      if (it && rarityAtLeast(it.rarity, 'legendary') && (!best || rarityAtLeast(it.rarity, best))) best = it.rarity;
    }
    this.auraColor = best ? rarityColor(best) : null;
    this.auraT = 0;
    this.drawAura(0);
  }

  /** Shows aura frame `frame` (0 or 1, a pixel bigger) around the hero's body, or hides it. */
  private drawAura(frame: 0 | 1) {
    if (!this.auraColor) {
      this.aura.setVisible(false);
      return;
    }
    const a = auraTex(this, this.auraColor, frame);
    // Centered on the feet column, its middle row AURA.up rows over the feet row.
    this.aura.setTexture(a.key).setOrigin(0, 0).setPosition(-a.rx * P, -(AURA.up + 1 + a.ry) * P).setAlpha(frame ? 1 : 0.8).setVisible(true);
  }

  /** The aura breathes (two frames, a step at a time) and now and then a glint of its color rises. */
  private updateAura(dt: number) {
    if (!this.auraColor) return;
    const before = Math.floor(this.auraT / 0.5);
    this.auraT += dt;
    if (Math.floor(this.auraT / 0.5) !== before) this.drawAura((Math.floor(this.auraT / 0.5) % 2) as 0 | 1);
    this.glintT -= dt;
    if (this.glintT > 0 || this.dead || this.reduceMotion) return;
    this.glintT = 0.28 + Math.random() * 0.3;
    const c = hexNum(this.auraColor);
    const x = this.hero.x + P / 2 + Phaser.Math.Between(-AURA.rx + 2, AURA.rx - 2) * P;
    const y = FEET_Y - Phaser.Math.Between(2, AURA.up + AURA.ry - 2) * P;
    this.glints.burst(1, x, y, { speedX: [-1.3, 1.3], speedY: [-7.8, -3.9], life: [500, 900], colors: [0xffffff], fade: [c, c], alpha: [1, 1, 0.6] });
  }

  /** Points the weapon `angle` degrees from straight up (the art itself is drawn tilted). */
  private aimWeapon(angle: number) {
    this.weapon.setAngle(angle - this.weaponTilt);
  }

  /** Shows one hero frame (stops the running animation). */
  private heroFrame(frame: number) {
    if (this.heroSpr.anims.isPlaying) this.heroSpr.anims.stop();
    if (this.heroSpr.frame.name !== String(frame)) this.heroSpr.setFrame(String(frame));
  }

  /** Plays a hero animation unless it's already the one running. */
  private heroAnim(name: string) {
    const key = `hero:${name}`;
    if (this.heroSpr.anims.isPlaying && this.heroSpr.anims.currentAnim?.key === key) return;
    this.heroSpr.play(key);
  }

  /** Keeps worn gear and the weapon on the body as its frames change. */
  private followBody() {
    const o = heroFrameOffset(Number(this.heroSpr.frame.name));
    this.gearBack.setPosition(o.x, o.y).setVisible(o.head);
    this.gearFront.setPosition(o.x, o.y).setVisible(o.head);
    this.arm.setPosition(HAND.x + o.x, HAND.y + o.y).setVisible(o.head);
  }

  /** The swing pose at progress k (0..1). Fast swings skip most of the wind-up. */
  private pose(k: number, fast: boolean) {
    const a = fast ? 0.14 : 0.32;
    const b = fast ? 0.34 : 0.5;
    if (k < a) {
      const u = easeOutQuad(k / a);
      return { angle: lerp(REST, WIND, u), dx: lerp(0, -2 * P, u), frame: FRAME.armsOut };
    }
    if (k < b) {
      const u = easeInQuad((k - a) / (b - a));
      return { angle: lerp(WIND, STRIKE, u), dx: lerp(-2 * P, 7 * P, u), frame: FRAME.dash };
    }
    const x = (k - b) / (1 - b);
    const u = easeOutBack(x);
    // Back from the dash he lands crouched (his squash frame) as the return overshoots, then stands.
    return { angle: lerp(STRIKE, REST, u), dx: lerp(7 * P, 0, u), frame: u < 0.5 ? FRAME.dash : x > 0.32 && x < 0.68 ? FRAME.squash : FRAME.stand };
  }

  private swingMs(): number {
    // (During a heist, the run's attack speed at the fight speed.)
    const spd = Math.max(0.2, battleStats(gameStore.getState().game).ATK_SPD);
    return Phaser.Math.Clamp((1000 / spd) * 0.85, 170, 360);
  }

  private nextSwing() {
    const s = this.swingQueue.shift();
    if (!s || this.dead) {
      this.swinging = false;
      if (this.mode === 'swing') this.mode = 'idle';
      return;
    }
    this.swinging = true;
    this.mode = 'swing';
    const dur = s.echo ? 200 : this.swingMs();
    const fast = dur < 250;
    const impactAt = fast ? 0.27 : 0.43;
    let landed = false;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: dur,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        const p = this.pose(k, fast);
        this.aimWeapon(p.angle);
        this.heroDx = this.reduceMotion ? 0 : p.dx;
        if (!this.dead) this.heroFrame(p.frame);
        if (!landed && k >= impactAt) {
          landed = true;
          this.impact(s);
        }
      },
      onComplete: () => {
        if (!landed) this.impact(s);
        this.aimWeapon(REST);
        this.heroDx = 0;
        this.nextSwing();
      },
    });
  }

  private queueSwing(s: Swing) {
    const foe = this.foes.get(s.targetUid);
    if (foe) foe.pending++;
    if (this.swingQueue.length >= 3) {
      // Too many blows queued (very fast attacks): land the oldest at once.
      const old = this.swingQueue.shift()!;
      this.impact(old);
    }
    this.swingQueue.push(s);
    if (!this.swinging) this.nextSwing();
  }

  // ------------------------------------------------------------------ effects
  private buildEffects() {
    this.bits = new PixelBits(this, 34);
    this.dust = new PixelBits(this, 33, 60);
    this.confetti = new PixelBits(this, 35, 200);
    this.glints = new PixelBits(this, 21, 24);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const b of [this.bits, this.dust, this.confetti, this.glints]) b.destroy();
    });
  }

  /** Plays a pack effect once at (x, y). Returns null if the effect isn't in the pack. */
  private fx(name: FxName, x: number, y: number, opts: { depth?: number; flipX?: boolean; tint?: number; loops?: number } = {}): Phaser.GameObjects.Sprite | null {
    const i = fxTex(this, name);
    if (!i) return null;
    const spr = this.add.sprite(snap(x), snap(y), i.key, '0').setOrigin(i.ox, i.oy).setScale(P).setDepth(opts.depth ?? 33);
    if (opts.flipX) spr.setFlipX(true);
    if (opts.tint !== undefined) spr.setTint(opts.tint);
    spr.play({ key: i.anim, repeat: opts.loops ?? 0 });
    spr.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => spr.destroy());
    return spr;
  }

  /** A still effect image (impact star, puff) at a whole art pixel; it fades out in flat steps. */
  private still(key: string, x: number, y: number, opts: { depth: number; tint?: number; delay?: number; ms: number }) {
    const o = texOrigin(key);
    const img = this.add.image(snap(x), snap(y), key).setOrigin(o.x, o.y).setDepth(opts.depth);
    if (opts.tint !== undefined) img.setTint(opts.tint);
    this.tweens.add({ targets: img, alpha: 0, delay: opts.delay ?? 0, duration: opts.ms, ease: 'Stepped', easeParams: [3], onComplete: () => img.destroy() });
  }

  /** Keeps a text box of `w` screen px centered near `x` inside the view. */
  private clampX(x: number, w: number): number {
    return Phaser.Math.Clamp(x, w / 2 + P, BATTLE_W - w / 2 - P);
  }

  /**
   * Pop-up number: pops in flashing white (up past its spot and back, a pixel at a time: an overshoot
   * in whole pixels), floats up by whole art pixels (fast, then slowing) and steps out. Big ones (crits)
   * pop higher and shake a pixel side to side as they start up. It starts centered on (x, y), but its
   * bottom edge no lower than a pixel over `floor` (the top of the HP bar under it, so the bar stays
   * readable). `rise`: how far it floats (art px); `exact`: right at x (otherwise a pixel or two aside).
   */
  private number(
    x: number, y0: number, text: string,
    opts: { big?: boolean; fill?: string | readonly string[]; life?: number; floor?: number; rise?: number; exact?: boolean } = {},
  ): PixelText {
    const life = opts.life ?? 800;
    const rise = opts.rise ?? 14;
    const tx = this.texts.add(text, { face: opts.big ? BIG_NUMBER : NUMBER, fill: opts.fill ?? '#ffffff' }).setDepth(45);
    // (A little to one side or the other, so numbers in a row don't stack exactly, unless `exact`.)
    const cx = this.clampX(x + (opts.exact ? 0 : Phaser.Math.Between(-2, 2)) * P, tx.artW * P);
    const y = opts.floor === undefined ? y0 : Math.min(y0, opts.floor - P - (tx.artH * P) / 2);
    // The pop (art px from its spot, 40 ms a step), and a crit's shake; with Reduce Motion it just appears.
    const still = this.reduceMotion;
    const pop = still ? [] : opts.big ? [2, -3, -1] : [1, -2, -1];
    const jitter = still || !opts.big ? [] : [1, -1, 1, -1, 0];
    const popMs = pop.length * 40;
    tx.place(cx, y + (pop[0] ?? 0) * P);
    if (!this.reduceFlashing) {
      tx.setFlash(true);
      this.time.delayedCall(60, () => tx.active && tx.setFlash(false));
    }
    this.tweens.addCounter({
      from: 0,
      to: life,
      duration: life,
      onUpdate: (tw) => {
        if (!tx.active) return;
        const ms = tw.getValue() ?? 0;
        const dy = ms < popMs ? pop[Math.floor(ms / 40)] : -Math.round(easeOutCubic((ms - popMs) / (life - popMs)) * rise);
        const dx = jitter[Math.floor(ms / 45)] ?? 0;
        tx.place(cx + dx * P, y + dy * P);
        const k = ms / life;
        tx.setAlpha(k < 0.55 ? 1 : stepsDown((k - 0.55) / 0.45));
      },
      onComplete: () => tx.destroy(),
    });
    return tx;
  }

  /**
   * A stamped word (CRIT!, K.O., a boss's special): slams down three art pixels in white, shakes a
   * pixel, holds, then rises and steps out.
   */
  private stamp(x: number, y0: number, text: string, color: string) {
    const tx = this.texts.add(text, { face: 'huge', fill: litTop(color), shadow: true, maxW: TEXT_MAX_W }).setDepth(46);
    const w = tx.artW * P;
    const h = tx.artH * P;
    const cx = this.clampX(x, w);
    // Stacks over any stamp it would land on (a crit and a knock-out in the same moment).
    let y = y0;
    for (let tries = 0; tries < 4; tries++) {
      const hit = this.stamps.find((o) => o.tx.active && Math.abs(o.x - cx) * 2 < o.w + w && Math.abs(o.y - y) * 2 < o.h + h);
      if (!hit) break;
      y = hit.y - (hit.h + h) / 2 - P;
    }
    const box = { tx, x: cx, y, w, h };
    this.stamps.push(box);
    tx.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.stamps = this.stamps.filter((o) => o !== box);
    });
    const at = (dy: number, dx = 0) => tx.active && tx.place(cx + dx * P, y + dy * P);
    at(-3);
    if (!this.reduceFlashing) tx.setFlash(true);
    const slam: Array<[number, number, number]> = [[35, -1, 0], [70, 0, 0], [110, 0, 1], [150, 0, -1], [190, 0, 0]];
    for (const [ms, dy, dx] of slam) this.time.delayedCall(ms, () => at(dy, this.reduceMotion ? 0 : dx));
    this.time.delayedCall(70, () => tx.active && tx.setFlash(false));
    this.tweens.addCounter({
      from: 0,
      to: 1,
      delay: 420,
      duration: 240,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        at(-Math.round(k * 3));
        if (tx.active) tx.setAlpha(stepsDown(k));
      },
      onComplete: () => tx.destroy(),
    });
  }

  /** Big title that sweeps in with a smear and sweeps out ("FIGHT!", "BOSS!", "VICTORY!"), in whole art pixels. */
  private banner(text: string, grad: readonly [string, string], y = FEET_Y - 44 * P) {
    const style: TextStyle = { face: 'huge', fill: bands(grad), shadow: true, maxW: TEXT_MAX_W };
    const main = this.texts.add(text, style).setDepth(50);
    const w = main.artW * P;
    const mid = BATTLE_W / 2;
    const start = -w;
    // (Placed at once: a text is drawn at the view's top-left corner until it is placed.)
    const smears = this.reduceMotion ? [] : [0.25, 0.45].map((a) => this.texts.add(text, style).setDepth(49.5).setAlpha(a).place(start, y));
    smears.forEach((s, i) => {
      const to = mid - 8 * P + i * 3 * P;
      this.tweens.addCounter({
        from: 0, to: 1, duration: 240, ease: 'Cubic.easeOut',
        onUpdate: (tw) => s.active && s.place(lerp(start, to, tw.getValue() ?? 0), y),
      });
      this.tweens.add({ targets: s, alpha: 0, delay: 200, duration: 160, ease: 'Stepped', easeParams: [2], onComplete: () => s.destroy() });
    });
    main.place(start, y);
    this.tweens.addCounter({
      from: 0, to: 1, duration: 260, ease: 'Back.easeOut',
      onUpdate: (tw) => main.active && main.place(lerp(start, mid, tw.getValue() ?? 0), y),
      onComplete: () => {
        if (!main.active || this.reduceFlashing) return;
        // Lands with a white flash (the letters, not the outline) for a few frames.
        main.setFlash(true);
        this.time.delayedCall(70, () => main.active && main.setFlash(false));
      },
    });
    this.tweens.addCounter({
      from: 0, to: 1, delay: 900, duration: 260, ease: 'Cubic.easeIn',
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        if (!main.active) return;
        main.place(lerp(mid, BATTLE_W + w, k), y).setAlpha(stepsDown(k));
      },
      onComplete: () => main.destroy(),
    });
  }

  /**
   * Shakes the view for `duration` ms (intensity as a share of the view's width, like Phaser's) by whole
   * art pixels, dying away as it goes: its reach drops a pixel at a time (at least one while it lasts).
   * Jolts go side to side in turn and down. A weaker shake doesn't cut a stronger one short. `side` (1
   * right, -1 left) throws the first jolt the way a blow goes.
   */
  private shake(duration: number, intensity: number, side = 0) {
    if (this.reduceMotion) return;
    const amp = Phaser.Math.Clamp((intensity * BATTLE_W) / P, 1, VIEW_MARGIN);
    if (amp < this.shakeLevel()) return;
    this.shakeAmp = amp;
    this.shakeLen = this.shakeT = duration / 1000;
    this.shakeNext = 0;
    // A kick goes straight sideways; a shake also goes down.
    this.shakeFlat = side !== 0;
    if (side) this.shakeSide = -side;
  }

  /** How far the shake reaches now (art px, unrounded): its peak, fading to nothing. */
  private shakeLevel(): number {
    return this.shakeT > 0 && this.shakeLen > 0 ? this.shakeAmp * (this.shakeT / this.shakeLen) : 0;
  }

  /** Runs on the wall clock (`dt` unfrozen): a hit-stop's shake plays through the freeze. */
  private updateShake(dt: number) {
    const cam = this.cameras.main;
    if (this.shakeT <= 0) {
      if (cam.scrollX !== 0 || cam.scrollY !== 0) cam.setScroll(0, 0);
      return;
    }
    this.shakeNext -= dt;
    if (this.shakeNext <= 0) {
      this.shakeNext = 0.03;
      const a = Math.max(1, Math.round(this.shakeLevel()));
      this.shakeSide = -this.shakeSide;
      // Side to side, but only down (the art reaches past the top and sides, not the bottom).
      cam.setScroll(-this.shakeSide * a * P, this.shakeFlat ? 0 : -Phaser.Math.Between(0, a) * P);
    }
    this.shakeT -= dt;
  }

  /**
   * Freezes the fight for `ms` (wall clock), then lets it go: tweens, animations, particles, movement
   * and scrolling run at STOP_SPEED meanwhile (the shake doesn't). Stops that overlap merge, STOP_MAX
   * ms at most; `minor` ones get what the budget allows. None with Reduce Motion.
   */
  private hitStop(ms: number, minor = false) {
    if (this.reduceMotion || ms <= 0) return;
    const now = performance.now();
    const fresh = now >= this.stopUntil;
    // The freeze already runs until `base`; this one may only stretch it (and only so far).
    const base = fresh ? now : this.stopUntil;
    const from = fresh ? now : this.stopFrom;
    let until = Math.min(Math.max(base, now + ms), from + STOP_MAX);
    if (minor) until = Math.min(until, base + this.stopBudget);
    // Nothing to add, or (out of budget) a new freeze too short to feel.
    if (until <= base || (fresh && until - now < 20)) return;
    if (minor) this.stopBudget -= until - base;
    this.stopFrom = from;
    this.stopUntil = until;
    this.tweens.timeScale = STOP_SPEED;
    this.anims.globalTimeScale = STOP_SPEED;
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.stopTimer = setTimeout(() => {
      this.stopTimer = null;
      if (!this.sys.isActive()) return;
      this.tweens.timeScale = 1;
      this.anims.globalTimeScale = 1;
    }, until - now);
  }

  /** Whether a hit-stop is on right now. */
  private get frozen(): boolean {
    return performance.now() < this.stopUntil;
  }

  /**
   * Squash and stretch by whole art pixels: `obj` (anchored at its feet or center; `base` its usual
   * scale, `w` x `h` its art size in art px) goes `rows` rows shorter and as many columns wider (negative:
   * taller and narrower) for each step's ms, then back. Whole-pixel changes keep its pixels whole; the
   * camera post-pass (gridSnap.ts) puts them on the grid. Off with Reduce Motion or without the post-pass.
   */
  private squash(
    obj: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform, base: number, w: number, h: number,
    steps: ReadonlyArray<readonly [rows: number, ms: number]>,
  ) {
    if (this.reduceMotion || !this.snapped || w < 2 || h < 2) return;
    this.squashes.get(obj)?.remove();
    const set = (rows: number) => obj.active && obj.setScale((base * (w + rows)) / w, (base * (h - rows)) / h);
    const total = steps.reduce((sum, [, ms]) => sum + ms, 0);
    set(steps[0]?.[0] ?? 0);
    const tw = this.tweens.addCounter({
      from: 0,
      to: total,
      duration: total,
      onUpdate: (t) => {
        let at = t.getValue() ?? 0;
        for (const [rows, ms] of steps) {
          if (at < ms) {
            set(rows);
            return;
          }
          at -= ms;
        }
      },
      onComplete: () => {
        set(0);
        if (this.squashes.get(obj) === tw) this.squashes.delete(obj);
      },
    });
    this.squashes.set(obj, tw);
  }

  /** A buzz on the phone. Light ones come at most every 120 ms, so a fast fight doesn't turn into a hum. */
  private buzz(strength: 'light' | 'heavy') {
    const now = performance.now();
    if (strength === 'light' && now - this.buzzAt < 120) return;
    this.buzzAt = now;
    haptics.impact(strength);
  }

  private flash(img: Phaser.GameObjects.Sprite, color: number, ms: number) {
    if (this.reduceFlashing) return;
    img.setTintFill(color);
    this.time.delayedCall(ms, () => img.active && img.clearTint());
  }

  private foeHitPoint(f: Foe): { x: number; y: number } {
    return { x: f.c.x - f.front * 0.45, y: FEET_Y - f.height * 0.5 };
  }

  /** The top of foe `f`'s HP bar (screen px): pop-up numbers over it start above it. Bosses have theirs under the HUD. */
  private barTop(f: Foe): number | undefined {
    return f.kind === 'regular' ? FEET_Y + f.barY : undefined;
  }

  /** The top of the hero's bar (its heart stands a pixel taller than the bar). */
  private heroBarTop(): number {
    return FEET_Y - snap(this.heroTop) - (BAR_GAP + BAR_TALL + 1) * P;
  }

  /**
   * The blow lands: pack hit effect, sparks, number, knockback, a squash, its sound (climbing with
   * each blow in a row), a one-pixel kick of the view, maybe a kill. Crits add a bigger number, a
   * stamp, a hit-stop, a bigger shake and a buzz.
   */
  private impact(s: Swing) {
    const f = this.foes.get(s.targetUid);
    if (!f) {
      for (const r of s.riders) r();
      return;
    }
    f.pending = Math.max(0, f.pending - 1);
    const p = this.foeHitPoint(f);
    // A small spark on every blow; crits get the big burst and a shock spray.
    if (!this.fx(s.crit ? 'crit' : 'hit', p.x, p.y, { depth: 34, tint: s.echo ? 0xc9a6ff : undefined })) {
      this.still('fx_impact', p.x, p.y, { depth: 33, delay: 90, ms: 150 });
    }
    if (s.crit) this.fx('slash', p.x + 2 * P, p.y, { depth: 35 });
    this.flash(f.spr, 0xffffff, 60);
    f.knockV += (s.crit ? 100 : 62) * P;
    this.foeAct(f, 'hurt');
    this.squashFoe(f, s.crit ? 1 : 0);
    this.hitSound(f, s.crit);
    f.shownHp = Math.max(0, f.shownHp - s.amount);
    if (s.crit) {
      this.bits.burst(12, p.x, p.y, BIG_SPARK);
      const num = this.number(p.x, p.y - 8 * P, formatNumber(s.amount), { big: true, fill: bands(['#fff6a8', '#ff9a1a']), life: 950, floor: this.barTop(f), rise: 4 });
      // CRIT! stamps down right over its number, clear of it as it floats (its top ends 6 px over where it
      // pops in; the stamp is 12 px tall).
      this.stamp(p.x + P, num.y - 13 * P, t('battle.crit'), '#FFD54F');
      this.shake(170, 0.011);
      this.hitStop(STOP.crit, true);
      this.buzz('light');
    } else {
      this.bits.burst(6, p.x, p.y, SPARK);
      this.number(p.x, p.y - 7 * P, formatNumber(s.amount), { fill: s.echo ? '#e2ccff' : '#ffffff', floor: this.barTop(f) });
      // A one-pixel kick the way the blow goes.
      if (!s.echo) this.shake(30, 0, 1);
    }
    for (const r of s.riders) r();
    if (s.killed || this.kills.has(f.uid)) this.die(f);
  }

  /** A foe takes a blow: it squashes (`extra` rows more for a crit), springs up a pixel taller, and settles. */
  private squashFoe(f: Foe, extra: number) {
    const w = Math.round((f.tex.artR - f.tex.artL) / P);
    const h = Math.round(f.tex.reach / P);
    const rows = Phaser.Math.Clamp(Math.round(h / 12), 1, 3) + extra;
    this.squash(f.rig, 1, w, h, [[rows, 70], [-1, 60]]);
  }

  /**
   * The blow's sound, up to an octave higher the more of the foe's HP is gone before it lands: each blow
   * in a row on a foe rises, the killing blow highest, a fresh foe starts low again, and a boss's long
   * fight climbs all the way to its last blow instead of sitting at the top. (Kills climb per wave.)
   */
  private hitSound(f: Foe, crit: boolean) {
    const lost = f.maxHp > 0 ? 1 - f.shownHp / f.maxHp : 0;
    audio.hit(crit, Math.round(12 * Phaser.Math.Clamp(lost, 0, 1)));
  }

  /**
   * A foe goes down: it pops (bits, more and faster the bigger it is) in a puff of dust, the fight
   * freezes a beat, its sound climbs with each kill in the wave, its coins fly to the gold counter and
   * XP sparks to the XP bar (each puts its "+N" under its counter), then it plays its death or tumbles
   * away. A boss or mini-boss adds a boom, confetti, a longer freeze, a bigger shake and a heavy buzz.
   */
  private die(f: Foe) {
    if (f.dying) return;
    f.dying = true;
    f.bar.setVisible(false);
    const info = this.kills.get(f.uid);
    this.kills.delete(f.uid);
    const kind: Kind = info?.kind ?? 'regular';
    const big = kind !== 'regular';
    const p = this.foeHitPoint(f);
    // About 11 for a rat, 24 for a knight, 33 for a big boss.
    const size = Math.sqrt(Math.max(1, ((f.tex.artR - f.tex.artL) / P) * (f.tex.reach / P)));
    const k = Phaser.Math.Clamp(size / 14, 0.8, 1.8);
    const pop = KILL_POP.speed ?? [30, 64];
    this.bits.burst(Math.round(Phaser.Math.Clamp(size * 0.7, 6, 22)), p.x, p.y, { ...KILL_POP, speed: [pop[0] * k, pop[1] * k] });
    this.dust.burst(big ? 10 : 5, p.x, FEET_Y - P, DUST);
    const coins = info ? (kind === 'boss' ? 16 : kind === 'miniboss' ? 9 : 3) : 2;
    // (A heist's coins pay the run, not the gold counter: they fly but don't land on it.)
    this.coinBurst(p.x, p.y, coins, info && info.gold.left > 0 ? info.gold : null);
    if (info) this.xpSparks(p.x, p.y, kind === 'boss' ? 6 : big ? 4 : 3, info.xp, info.xpGain);
    const now = performance.now();
    if (now - this.streak.at > 5000) this.streak.n = 0;
    audio.kill(big, this.streak.n++, false);
    this.streak.at = now;
    if (big) {
      this.shake(kind === 'boss' ? 400 : 320, kind === 'boss' ? 0.017 : 0.012);
      this.confetti.burst(40, p.x, p.y, CONFETTI);
      this.fx('boom', p.x, p.y, { depth: 35 });
      this.hitStop(kind === 'boss' ? STOP.boss : STOP.miniboss);
      if (!info?.buzzed) this.buzz('heavy');
    } else {
      this.shake(120, 0.008);
      this.hitStop(STOP.kill, true);
      this.buzz('light');
    }
    this.flash(f.spr, 0xffffff, 90);
    const remove = () => {
      f.c.destroy();
      f.bar.destroy();
      this.foes.delete(f.uid);
    };
    this.tweens.killTweensOf(f.spr);
    if (f.tex.anims.has('death')) {
      // Its own death animation, then it fades into the ground (in flat steps).
      f.spr.play(`${f.tex.key}:death`);
      this.tweens.add({ targets: f.c, alpha: 0, delay: 650, duration: 380, ease: 'Stepped', easeParams: [3], onComplete: remove });
      return;
    }
    // Knocked out of the park, tumbling a quarter turn at a time (quarter turns keep its pixels on the grid).
    const x0 = f.c.x;
    const y0 = f.c.y;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 650,
      ease: 'Quad.easeOut',
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        f.c.setPosition(snap(x0 + 700 * k), snap(y0 - 380 * k)).setAngle(Math.round((540 * k) / 90) * 90);
      },
      onComplete: remove,
    });
  }

  /**
   * Coins pop out of a downed foe, land with a squash, hop and land again, then lift off one after
   * another (stretching as they go) and arc up into the gold counter, turning frame by frame all the
   * way. Each one that gets there lets its share of `held` into the counter (the number ticks up and
   * the counter hops) with a tink a step higher than the last; the first puts "+N" under the counter,
   * the last of a big burst rings a ka-ching.
   */
  private coinBurst(x: number, y: number, n: number, held: Held | null) {
    const coin = coinTex(this);
    const cw = coin.w / P;
    const ch = coin.h / P;
    const target = this.hudPoint('[data-gold-target]', 0.2) ?? COIN_TARGET;
    const count = Math.max(0, Math.min(n, 50 - this.coinsFlying));
    if (held && !count) release(held);
    const total = held?.left ?? 0;
    const share = total / Math.max(1, count);
    const ground = FEET_Y - P;
    for (let i = 0; i < count; i++) {
      this.coinsFlying++;
      const c = this.gridLock(this.add.sprite(x, y, coin.key, String(i % 4)).setOrigin(coin.cx / cw, coin.cy / ch).setScale(P).setDepth(36));
      c.play({ key: `${coin.key}:spin`, startFrame: i % 4 });
      const landX = x + Phaser.Math.Between(-13, 13) * P;
      const peak = y - Phaser.Math.Between(12, 26) * P;
      const hop = Phaser.Math.Between(2, 4) * P;
      const last = i === count - 1;
      // Up and out, down (squash), a little hop, down (squash): one counter, so a hit-stop holds it.
      let touched = false;
      this.tweens.addCounter({
        from: 0,
        to: 430,
        duration: 430,
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          c.x = lerp(x, landX, t / 430);
          if (t < 170) c.y = lerp(y, peak, easeOutQuad(t / 170));
          else if (t < 310) c.y = lerp(peak, ground, easeInQuad((t - 170) / 140));
          else if (t < 370) c.y = lerp(ground, ground - hop, easeOutQuad((t - 310) / 60));
          else c.y = lerp(ground - hop, ground, easeInQuad((t - 370) / 60));
          if (!touched && t >= 310) {
            touched = true;
            this.squash(c, P, cw, ch, [[1, 60]]);
          }
        },
        onComplete: () => {
          c.setPosition(landX, ground);
          this.squash(c, P, cw, ch, [[1, 45]]);
        },
      });
      // Then up to the counter, one after another (a quadratic curve that leans to one side). The first
      // to get there puts up "+N" under the counter.
      let from = { x: landX, y: ground };
      let bend = { x: 0, y: 0 };
      this.tweens.addCounter({
        from: 0,
        to: 1,
        delay: 460 + i * 60,
        duration: 400,
        ease: 'Quad.easeIn',
        onStart: () => {
          from = { x: c.x, y: c.y };
          const side = Phaser.Math.Between(0, 1) ? 1 : -1;
          bend = { x: lerp(from.x, target.x, 0.2) + side * Phaser.Math.Between(4, 16) * P, y: lerp(from.y, target.y, 0.8) };
          this.squash(c, P, cw, ch, [[-1, 90]]);
        },
        onUpdate: (tw) => {
          const u = tw.getValue() ?? 0;
          c.x = (1 - u) * (1 - u) * from.x + 2 * (1 - u) * u * bend.x + u * u * target.x;
          c.y = (1 - u) * (1 - u) * from.y + 2 * (1 - u) * u * bend.y + u * u * target.y;
        },
        onComplete: () => {
          c.destroy();
          this.coinsFlying--;
          if (held) land(held, last ? Infinity : share);
          if (i === 0 && total > 0) this.counterNote('gold', total);
          audio.coinLand(last && count >= 9);
        },
      });
    }
  }

  /**
   * XP sparks burst out of a downed foe, hang a beat, then arc up into the HUD's XP bar where its fill
   * ends, twinkling and trailing. Each lets its share of `held` into the bar; the last puts up "+N XP"
   * under it with a blip. None when the raccoon got no XP (`gain` 0: a heist's kill, the level cap).
   */
  private xpSparks(x: number, y: number, n: number, held: Held, gain: number) {
    if (gain <= 0) return;
    const share = held.left / n;
    const OUT = 160;
    const FLY = 560;
    for (let i = 0; i < n; i++) {
      // (Origin at its middle pixel's top-left corner: drawn at a whole art pixel, it's on the grid.)
      const s = this.gridLock(this.add.image(snap(x), snap(y), xpSparkTex(this, 0)).setOrigin(0.4, 0.4).setScale(P).setDepth(37));
      const out = { x: x + Phaser.Math.Between(-12, 12) * P, y: y - Phaser.Math.Between(5, 14) * P };
      const hang = 60 + i * 60;
      const last = i === n - 1;
      let aim: { from: { x: number; y: number }; bend: { x: number; y: number }; to: { x: number; y: number } } | null = null;
      let trailAt = 0;
      this.tweens.addCounter({
        from: 0,
        to: OUT + hang + FLY,
        duration: OUT + hang + FLY,
        onUpdate: (tw) => {
          if (!s.active) return;
          const t = tw.getValue() ?? 0;
          const twinkle = xpSparkTex(this, (Math.floor(t / 70) % 2) as 0 | 1);
          if (s.texture.key !== twinkle) s.setTexture(twinkle);
          if (t < OUT) {
            const k = easeOutQuad(t / OUT);
            s.setPosition(lerp(x, out.x, k), lerp(y, out.y, k));
            return;
          }
          if (t < OUT + hang) return;
          if (!aim) {
            const to = this.xpTarget();
            aim = { from: { x: s.x, y: s.y }, to, bend: { x: lerp(s.x, to.x, 0.3) + Phaser.Math.Between(-10, 10) * P, y: lerp(s.y, to.y, 0.85) } };
          }
          const u = easeInQuad((t - OUT - hang) / FLY);
          const { from, bend, to } = aim;
          s.setPosition(
            (1 - u) * (1 - u) * from.x + 2 * (1 - u) * u * bend.x + u * u * to.x,
            (1 - u) * (1 - u) * from.y + 2 * (1 - u) * u * bend.y + u * u * to.y,
          );
          if (t - trailAt >= 45) {
            trailAt = t;
            this.bits.burst(1, s.x, s.y, XP_TRAIL);
          }
        },
        onComplete: () => {
          s.destroy();
          land(held, last ? Infinity : share);
          if (!last) return;
          this.counterNote('xp', gain);
          audio.xpTick();
        },
      });
    }
  }

  /** Where the XP bar's fill ends (canvas px): XP sparks fly there. */
  private xpTarget(): { x: number; y: number } {
    const g = gameStore.getState().game;
    const need = xpToNext(g.player.level);
    const shown = Math.max(0, g.player.xp - useHudFlight.getState().held.xp);
    return this.hudPoint('[data-xp-target]', need > 0 ? Phaser.Math.Clamp(shown / need, 0.04, 1) : 1) ?? XP_TARGET;
  }

  /**
   * A gain pops up just under its HUD counter as it gets there: "+N" in gold under the gold, "+N XP" in
   * green under the XP bar (the fight below stays clear). More landing right after adds to it.
   */
  private counterNote(counter: 'gold' | 'xp', amount: number) {
    const gold = counter === 'gold';
    const at = this.hudPoint(gold ? '[data-gold-target]' : '[data-xp-target]', 0.5) ?? (gold ? COIN_TARGET : XP_TARGET);
    const now = performance.now();
    let sum = amount;
    const prev = this.notes[counter];
    if (prev?.tx.active && now - prev.at < 400) {
      sum += prev.sum;
      prev.tx.destroy();
    }
    const text = gold ? `+${formatNumber(sum)}` : t('battle.xpGain', { n: formatNumber(sum) });
    const tx = this.number(at.x, at.y + 13 * P, text, { fill: gold ? GOLD_GAIN : XP_GAIN, life: 750, rise: 2, exact: true });
    this.notes[counter] = { tx, sum, at: now };
  }

  /**
   * Point `ax` of the way across a HUD element ([selector], 0 its left edge, 1 its right) and halfway
   * down it, in canvas pixels (the canvas fills the top of the stage, so stage px), from the page; null
   * when it isn't there.
   */
  private hudPoint(selector: string, ax: number): { x: number; y: number } | null {
    const el = typeof document !== 'undefined' ? document.querySelector(selector) : null;
    const canvas = this.sys.game.canvas;
    if (!el || !canvas) return null;
    const r = el.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    if (!c.width || !r.height) return null;
    const k = BATTLE_W / c.width;
    return { x: (r.left + r.width * ax - c.left) * k, y: (r.top + r.height / 2 - c.top) * k };
  }

  private bagBurst(count: number) {
    const from = { x: ENGAGE_EDGE + 12 * P, y: FEET_Y - 13 * P };
    for (let i = 0; i < Math.min(count, 6); i++) {
      const o = texOrigin('fx_bag');
      const bag = this.gridLock(this.add.image(from.x + i * 6 * P, from.y, 'fx_bag').setOrigin(o.x, o.y).setDepth(36));
      this.tweens.add({ targets: bag, y: from.y - 18 * P, duration: 260, ease: 'Back.easeOut', delay: i * 70 });
      this.tweens.add({
        targets: bag, x: BAG_TARGET.x, y: BAG_TARGET.y, duration: 520, ease: 'Cubic.easeIn',
        delay: 380 + i * 70, onComplete: () => bag.destroy(),
      });
    }
  }

  /** Chain lightning: a jagged 1-art-pixel bolt with an ink edge, drawn pixel by pixel. */
  private lightning(a: { x: number; y: number }, b: { x: number; y: number }) {
    const g = this.add.graphics().setDepth(35);
    const pts: Array<[number, number]> = [];
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const jitter = i === 0 || i === n ? 0 : Phaser.Math.Between(-2, 2);
      pts.push([Math.round(lerp(a.x, b.x, k) / P), Math.round(lerp(a.y, b.y, k) / P) + jitter]);
    }
    const cells = linePixels(pts);
    g.fillStyle(INK_N, 1);
    for (const [x, y] of cells) g.fillRect((x - 1) * P, (y - 1) * P, 3 * P, 3 * P);
    g.fillStyle(0xffe14a, 1);
    for (const [x, y] of cells) g.fillRect(x * P, y * P, P, P);
    this.tweens.add({ targets: g, alpha: 0, duration: 220, delay: 60, ease: 'Stepped', easeParams: [2], onComplete: () => g.destroy() });
    this.fx('lightning', b.x, b.y, { depth: 35 });
  }

  private boom(x: number, y: number) {
    if (!this.fx('boom', x, y, { depth: 35 })) this.still('fx_puff', x, y, { depth: 34, tint: 0xff8a3d, ms: 380 });
    this.bits.burst(8, x, y, BIG_SPARK);
    this.bits.burst(8, x, y, FLAME);
    this.shake(140, 0.008);
  }

  /** A foe's blow lands on the raccoon (its sound plays here, as it connects); heavy ones freeze a beat. */
  private heroHurt(amount: number, heavy: boolean) {
    audio.hurt(heavy);
    this.flashHero(0xff8a8a, 110);
    if (!this.dead && this.mode !== 'swing') {
      this.mode = 'hurt';
      this.poseT = heavy ? 0.34 : 0.22;
    }
    if (amount >= this.maxHp(gameStore.getState().game)) {
      // Way out of its league: make it obvious.
      this.stamp(this.hero.x + 3 * P, FEET_Y - 32 * P, t('battle.oneShot'), '#FF5A5A');
      this.shake(320, 0.02);
      this.hitStop(100);
      this.fx('hit', this.hero.x + 2 * P, FEET_Y - 8 * P, { depth: 34, flipX: true });
    } else if (heavy) {
      this.hitStop(STOP.heavy, true);
    }
    this.heroKnock = this.reduceMotion ? 0 : heavy ? -4 * P : -2 * P;
    const p = { x: this.hero.x + P, y: FEET_Y - 9 * P };
    if (heavy) {
      this.fx('hit', p.x + 3 * P, p.y, { depth: 34, flipX: true });
      this.shake(220, 0.012);
    }
    this.number(p.x - 3 * P, p.y - 7 * P, `-${formatNumber(amount)}`, { big: heavy, fill: '#ff8a80', floor: this.heroBarTop() });
  }

  /** Plays a foe's one-shot animation (attack / hurt) if it has one, then its base loop again. */
  private foeAct(f: Foe, anim: 'attack' | 'hurt') {
    if (f.dying || !f.tex.anims.has(anim)) return;
    // A blow landing mid-attack doesn't cut the swing short: its flash and knockback show the hit.
    if (anim === 'hurt' && f.spr.anims.isPlaying && f.spr.anims.currentAnim?.key === `${f.tex.key}:attack`) return;
    f.acting = true;
    f.spr.play(`${f.tex.key}:${anim}`);
    f.spr.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      f.acting = false;
      if (!f.dying && f.spr.active) f.spr.play(`${f.tex.key}:idle`);
    });
  }

  /**
   * A foe's blow, over its attack animation (enemies.ts and farm_anim.py: the wind-up until 120 ms, the
   * smear, the strike from 160 ms, 440 ms in all): it rocks back while it winds up, darts in so the blow
   * lands at 170 ms (`contact`), holds a beat on the hero and goes back, 450 ms in all. One counter tween
   * drives it (a chain idles a few frames between its tweens), so a hit-stop slows it with the frames.
   */
  private lungeAt(f: Foe, contact: () => void, heavy: boolean) {
    this.foeAct(f, 'attack');
    if (this.reduceMotion) {
      contact();
      return;
    }
    const back = 2 * P;
    const dist = heavy ? 10 * P : 6 * P;
    const { Quadratic, Back } = Phaser.Math.Easing;
    let landed = false;
    this.tweens.addCounter({
      from: 0,
      to: 450,
      duration: 450,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        if (t < 120) f.lunge = back * Quadratic.Out(t / 120);
        else if (t < 170) f.lunge = back - (back + dist) * Quadratic.In((t - 120) / 50);
        else if (t < 250) f.lunge = -dist;
        else f.lunge = -dist * (1 - Back.Out((t - 250) / 200));
        if (!landed && t >= 170) {
          landed = true;
          contact();
        }
      },
      onComplete: () => {
        f.lunge = 0;
        if (!landed) contact();
      },
    });
  }

  /** Runs `run` when `swing` lands (or now). The target stays on screen until then. */
  private attachRider(swing: Swing | null, targetUid: number, run: () => void) {
    if (!swing) {
      run();
      return;
    }
    const f = this.foes.get(targetUid);
    if (f) f.pending++;
    swing.riders.push(() => {
      if (f) f.pending = Math.max(0, f.pending - 1);
      run();
    });
  }

  /** Tints the whole hero (body, gear, weapon) for a moment; a multiply tint keeps the drawing readable. */
  private flashHero(color: number, ms: number) {
    if (this.reduceFlashing) return;
    const imgs = [
      this.heroSpr, this.weapon,
      ...(this.gearBack.list as Phaser.GameObjects.Image[]), ...(this.gearFront.list as Phaser.GameObjects.Image[]),
    ];
    for (const i of imgs) i.setTint(color);
    this.time.delayedCall(ms, () => imgs.forEach((i) => i.active && i.clearTint()));
  }

  // ------------------------------------------------------------------ luck chains

  /**
   * A reel that lands on luck tokens shows them in a row near the top of the battle (luckRows.ts):
   * each token flies out of its reel into its place there (TokenFlight.tsx) and slams in (a flash,
   * bits, a kick), the earlier ones shuffling over, with the running total (×2 → ×10 LUCK) after them
   * and, for a big chain, the rarity it guarantees under it. When every reel lands the same token, the
   * last one to slam in squares it on every row: their tokens flash gold, their totals jump and a gold
   * "MATCH!" pops up under them. When the reel lands its item its row flashes and steps out. Timed like
   * the reels (reelTiming.ts), plus the flight (none with Reduce motion).
   */
  private showLuckChains(e: Extract<CoreEvent, { type: 'spinStart' }>) {
    const rows = luckRowsOf(e.reels);
    const delay = this.reduceMotion ? 0 : TOKEN_FLIGHT_MS;
    const chains: LuckChain[] = [];
    const match = new Set(tokenStops(e).filter((tk) => tk.match).map((tk) => `${tk.reel}:${tk.step}`));
    e.reels.forEach((r, i) => {
      if (rows[i] < 0) return;
      const chain: LuckChain = { tokens: [], total: null, floor: null, mults: r.mults, squared: [], row: rows[i], y: luckSlot(rows[i], 0, 1).y, done: false };
      chains.push(chain);
      reelStops(e, i).forEach((st, j) => {
        if (st.token === null) {
          this.time.delayedCall(st.at + delay + 150, () => this.endLuckChain(chain));
          return;
        }
        // Shown when its flight slams it in (luckBridge), or a little after it should have.
        const key = tokenKey(r.item.uid, j);
        this.luckPending.set(key, () => {
          this.addLuckToken(chain, j);
          // The last of a matched step's tokens squares it on every row.
          if (match.has(`${i}:${j}`)) this.time.delayedCall(70, () => this.squareLuck(chains, j));
        });
        this.time.delayedCall(st.at + delay + 250, () => this.landLuck(key));
      });
    });
  }

  /** A token slams into its row (its flight landed, or it's late): shown once. */
  private landLuck(key: string) {
    const add = this.luckPending.get(key);
    if (!add) return;
    this.luckPending.delete(key);
    add();
  }

  private addLuckToken(chain: LuckChain, step: number) {
    if (!this.sys.isActive() || chain.done) return;
    const tex = luckTokenTex(this, chain.mults[step]);
    const n = chain.tokens.length + 1;
    // The row stays centered: earlier tokens shuffle over a whole pixel at a time.
    chain.tokens.forEach((tk, k) => this.tweens.add({ targets: tk, x: luckSlot(chain.row, k, n).x, duration: 120, ease: 'Stepped', easeParams: [3] }));
    const at = luckSlot(chain.row, n - 1, n);
    if (tex) {
      const img = this.add.image(at.x, chain.y, tex.key).setOrigin(0.5, 0.5).setScale(P).setDepth(44);
      chain.tokens.push(img);
      // It slams in: a pixel down on impact, then back up.
      if (!this.reduceMotion) {
        img.y = chain.y + P;
        this.time.delayedCall(70, () => img.active && img.setY(chain.y));
      }
      if (!this.reduceFlashing) {
        img.setTintFill(0xffffff);
        this.time.delayedCall(70, () => img.active && img.clearTint());
      }
    }
    // More bits the higher the stack.
    const mult = multOf(chain.mults.slice(0, n), chain.squared);
    this.bits.burst(12 + step * 6 + Math.round(8 * Math.log10(Math.max(1, mult))), at.x, chain.y, { speed: [30, 90], life: [260, 520], drag: 2.2, colors: [0xffffff, 0x8dff8a, 0x46d36b], fade: [0x2fb150], sizes: [2, 1] });
    // A small kick, as gentle as a blow's (Kevin wanted the token slams' shake gentle).
    this.shake(160, P / BATTLE_W, 1);
    this.drawLuckTotal(chain);
  }

  /** A row's running total after its tokens, and under it the rarity a big chain guarantees. */
  private drawLuckTotal(chain: LuckChain, gold = false) {
    const n = chain.tokens.length;
    if (!n) return;
    const mult = multOf(chain.mults.slice(0, n), chain.squared);
    chain.total?.destroy();
    chain.floor?.destroy();
    chain.floor = null;
    const last = luckSlot(chain.row, n - 1, n);
    const look = luckTotalStyle(mult, gold);
    // (In the huge face the number says it all: "×625", not "×625 LUCK", so a long one still fits.)
    const label = look.face === 'huge' ? `×${formatNumber(mult)}` : `×${formatNumber(mult)} ${t('battle.luck')}`;
    const total = this.texts.add(label, { face: look.face, fill: look.fill, shadow: true }).setDepth(44);
    // After its tokens, but never past the view's right edge.
    const tx = snap(Math.min(last.x + 9 * P + (total.artW * P) / 2, BATTLE_W - 3 * P - (total.artW * P) / 2));
    total.place(tx, chain.y);
    if (!this.reduceFlashing) {
      total.setFlash(true);
      this.time.delayedCall(look.face === 'huge' ? 140 : 80, () => total.active && total.setFlash(false));
    }
    // A big total pops in from above (whole pixels).
    if (look.face === 'huge' && !this.reduceMotion) {
      [3, 1, 0].forEach((d, k) => this.time.delayedCall(k * 40, () => total.active && total.place(tx, chain.y - d * P)));
    }
    chain.total = total;
    const floor = chainFloor(mult);
    if (floor) {
      const tag = this.texts.add(t('reel.tokenFloorShort', { rarity: t(`rarity.${floor}`).toUpperCase() }), { face: 'big', fill: rarityColor(floor), shadow: true }).setDepth(44);
      tag.place(snap(Math.min(tx, BATTLE_W - 3 * P - (tag.artW * P) / 2)), chain.y + 9 * P);
      chain.floor = tag;
      // A new guarantee reached: a burst in its color, a harder kick, its chime.
      if (chain.floorSeen !== floor) {
        chain.floorSeen = floor;
        const c = Phaser.Display.Color.HexStringToColor(rarityColor(floor)).color;
        this.bits.burst(40, tx, chain.y, { speed: [60, 160], life: [380, 760], drag: 2, colors: [0xffffff, c], fade: [c], sizes: [2, 1] });
        this.shake(240, (2 * P) / BATTLE_W, 1);
        audio.tierPass(rarityIndex(floor as Rarity));
        haptics.impact('heavy');
        if (!this.reduceFlashing) {
          tag.setFlash(true);
          [120, 240, 360].forEach((ms, k) => this.time.delayedCall(ms, () => tag.active && tag.setFlash(k % 2 === 1)));
        }
      }
    }
  }

  /**
   * Every reel landed the same token at `step` (Kevin: "if u have multiple rows spinning and they all
   * land on the same multiplier, u need to square the luck"): it counts squared on every row now.
   */
  private squareLuck(chains: readonly LuckChain[], step: number) {
    if (!this.sys.isActive()) return;
    const live = chains.filter((c) => !c.done && c.tokens.length > step);
    if (!live.length) return;
    for (const c of live) {
      if (!c.squared.includes(step)) c.squared.push(step);
      const tk = c.tokens[step];
      if (tk && !this.reduceFlashing) {
        tk.setTintFill(0xffe680);
        this.time.delayedCall(160, () => tk.active && tk.clearTint());
      }
      if (tk) this.bits.burst(18, tk.x, c.y, { speed: [40, 110], life: [320, 640], drag: 2, colors: [0xffffff, 0xfff28c, 0xffc233], fade: [0xd48a12], sizes: [2, 1] });
      this.drawLuckTotal(c, true);
    }
    this.shake(260, (2 * P) / BATTLE_W, 1);
    // "MATCH!" under the rows: it pops in flashing, holds, then lifts away in steps.
    const y = Math.max(...live.map((c) => c.y)) + 17 * P;
    const text = this.texts.add(t('battle.luckMatch'), { face: 'big', fill: ['#ffffff', '#fff28c', '#ffc233', '#ff9a1a'], shadow: true }).setDepth(45);
    text.place(snap(BATTLE_W / 2), y + (this.reduceMotion ? 0 : 3 * P));
    if (!this.reduceFlashing) {
      text.setFlash(true);
      this.time.delayedCall(90, () => text.active && text.setFlash(false));
    }
    if (!this.reduceMotion) [2, 1, 0].forEach((d, k) => this.time.delayedCall(40 + k * 40, () => text.active && text.place(snap(BATTLE_W / 2), y + d * P)));
    [0.66, 0.33, 0].forEach((a, k) =>
      this.time.delayedCall(1500 + k * 90, () => {
        if (!text.active) return;
        if (!a) text.destroy();
        else text.setAlpha(a).place(snap(BATTLE_W / 2), y - (k + 1) * P);
      }),
    );
  }

  private endLuckChain(chain: LuckChain) {
    chain.done = true;
    const parts: Array<{ setAlpha(a: number): unknown; destroy(): void; active: boolean }> = [...chain.tokens, ...(chain.total ? [chain.total] : []), ...(chain.floor ? [chain.floor] : [])];
    for (const p of parts) if ('setTintFill' in p && !this.reduceFlashing) (p as Phaser.GameObjects.Image).setTintFill(0xffffff);
    this.time.delayedCall(80, () => {
      for (const p of parts) if (p.active && 'clearTint' in p) (p as Phaser.GameObjects.Image).clearTint();
    });
    [0.66, 0.33, 0].forEach((a, k) =>
      this.time.delayedCall(700 + k * 90, () => {
        for (const p of parts) if (p.active) (a ? p.setAlpha(a) : p.destroy());
      }),
    );
  }

  // ------------------------------------------------------------------ equip slam (equipSlam.ts)

  /**
   * An item was equipped: until it hits (EquipFlight flies it in and calls slamImpact), he keeps his
   * old look in that slot. Should no flight ever call (no UI running), it shows after a few seconds.
   */
  private holdGear(item: Item, replaced: Item | null) {
    if (!this.pendingGear.has(item.slot)) this.pendingGear.set(item.slot, replaced);
    this.time.delayedCall(6000, () => {
      if (gameStore.getState().game.equipped[item.slot]?.uid === item.uid) this.pendingGear.delete(item.slot);
    });
  }

  /** What he shows as worn: what he wears, except slots whose new gear is still flying in. */
  private shownEquipped(g: GameState): GameState['equipped'] {
    if (this.pendingGear.size === 0) return g.equipped;
    const eq = { ...g.equipped };
    for (const [slot, was] of this.pendingGear) eq[slot] = was;
    return eq;
  }

  /** Where `slot`'s gear sits on him (screen px). */
  private slotPoint(slot: Slot): { x: number; y: number } {
    return { x: this.hero.x + HERO.midX, y: FEET_Y - (SLAM_HEIGHT[slot] ?? 8) * P };
  }

  /** The item starts its dive onto him (EquipFlight): rare gear rides down a pillar of light. */
  private slamDive(item: Item, tier: number, ms: number) {
    if (!this.sys.isActive() || tier < SLAM_FROM.pillar || this.reduceMotion) return;
    const p = this.slotPoint(item.slot);
    this.pillar(p.x, p.y, rarityColorNum(item.rarity), ms, tier);
  }

  /**
   * The hit (EquipFlight calls it as the item lands): the new look shows, he takes the blow (a white
   * flash and a one-pixel squash), sparks, rings and light fly, and the piece glimmers.
   */
  private slamImpact(item: Item, tier: number) {
    if (!this.sys.isActive()) return;
    const color = rarityColor(item.rarity);
    const c = rarityColorNum(item.rarity);
    const { x, y } = this.slotPoint(item.slot);
    // The new look shows now.
    this.pendingGear.delete(item.slot);
    this.glimmer(item, tier, c);
    this.flash(this.heroSpr, 0xffffff, 70 + tier * 6);
    // A one-pixel squash under the blow (applied after animateHero, which sets his pose every frame).
    if (!this.reduceMotion) this.squashUntil = this.time.now + 90 + tier * 4;
    this.dust.burst(4 + Math.min(6, tier), this.hero.x, FEET_Y - P, DUST);
    // Sparks: more, faster and longer-lived the rarer it is.
    const sparks: BitStyle = {
      speed: [30 + tier * 4, 70 + tier * 10], life: [260 + tier * 30, 480 + tier * 40], drag: 2.2,
      colors: [0xffffff, c, c], fade: [c], sizes: tier >= 4 ? [2, 2, 1] : [2, 1],
    };
    this.bits.burst(8 + tier * 5, x, y, sparks);
    if (tier >= SLAM_FROM.ring) this.ring(x, y, c, 10 + tier * 3, 260 + tier * 20);
    if (tier >= SLAM_FROM.confetti) this.time.delayedCall(90, () => this.ring(x, y, 0xffffff, 16 + tier * 4, 420));
    if (tier >= SLAM_FROM.sparkle) {
      this.fx('sparkle', x, y, { depth: 37, tint: c });
      this.cheer(0.6 + tier * 0.08);
    }
    if (tier >= SLAM_FROM.pillar) {
      this.hitStop(50 + (tier - SLAM_FROM.pillar) * 18);
      this.stamp(this.hero.x, FEET_Y - 30 * P, `${t(`rarity.${item.rarity}`).toUpperCase()}!`, color);
      this.glints.burst(6 + tier, x, y - 4 * P, { ...BIG_SPARK, colors: [0xffffff, c], fade: [c] });
    }
    if (tier >= SLAM_FROM.confetti) this.confetti.burst(20 + tier * 6, x, y - 10 * P, CONFETTI);
    if (tier >= SLAM_FROM.flash && !this.reduceFlashing) this.whiteout(0.16 + (tier - SLAM_FROM.flash) * 0.025);
    this.shake(90 + tier * 30, 0.0015 + tier * 0.0011);
  }

  /**
   * After the slam the piece he now wears glimmers for a second, so you can see what changed:
   * sparkles twinkle where it sits, and a piece drawn on its own (hat, mask, shield, backpack, weapon)
   * blinks white twice. The rarer, the more twinkles.
   */
  private glimmer(item: Item, tier: number, c: number) {
    const n = 5 + Math.min(7, Math.floor(tier * 0.75));
    for (let k = 0; k < n; k++) {
      this.time.delayedCall(90 + k * 120, () => {
        if (!this.sys.isActive()) return;
        const b = this.partBox(item.slot);
        const x = b.x + Phaser.Math.Between(0, b.w);
        const y = b.y + Phaser.Math.Between(0, b.h);
        // Every other twinkle is the big four-point sparkle; the rest small glints that drift up.
        if (k % 2 === 0 && !this.reduceMotion) this.fx('sparkle', x, y, { depth: 38, tint: k % 4 === 0 ? undefined : c });
        else this.glints.burst(1, x, y, { speedX: [-0.6, 0.6], speedY: [-4, -1.5], life: [420, 640], colors: [0xffffff], fade: [c, c], alpha: [1, 1, 0.6] });
      });
    }
    if (this.reduceFlashing) return;
    for (const ms of [160, 420]) {
      this.time.delayedCall(ms, () => {
        const part = this.wornPart(item.slot);
        if (!part?.active) return;
        part.setTintFill(0xffffff);
        this.time.delayedCall(70, () => part.active && part.clearTint());
      });
    }
  }

  /** The image of a piece he wears that is drawn on its own (not part of his body's texture). */
  private wornPart(slot: Slot): Phaser.GameObjects.Image | null {
    return slot === 'weapon' ? this.weapon : this.gearImgs.get(slot) ?? null;
  }

  /** Where a worn piece is on screen (px): its image's bounds, or a box around where that slot sits on him. */
  private partBox(slot: Slot): { x: number; y: number; w: number; h: number } {
    const part = this.wornPart(slot);
    if (part?.active && part.visible) {
      const r = part.getBounds();
      if (r.width > 0) return { x: r.x + P, y: r.y + P, w: Math.max(P, r.width - 2 * P), h: Math.max(P, r.height - 2 * P) };
    }
    const p = this.slotPoint(slot);
    const half = GLIMMER_BOX[slot] ?? { w: 3, h: 2 };
    return { x: p.x - half.w * P, y: p.y - half.h * P, w: 2 * half.w * P, h: 2 * half.h * P };
  }

  /** A white flash over the whole view that steps out (the rarest slams). */
  private whiteout(alpha: number) {
    const m = VIEW_MARGIN * P;
    const r = this.add.rectangle(-m, -m, BATTLE_W + 2 * m, BATTLE_H + 2 * m, 0xffffff).setOrigin(0, 0).setDepth(47).setAlpha(alpha);
    r.setBlendMode(Phaser.BlendModes.ADD);
    // Fades on the wall clock, not the scene's, so a hit-stop doesn't hold the whole view white.
    const steps = [0.66, 0.33, 0];
    steps.forEach((k, i) => setTimeout(() => (k ? r.active && r.setAlpha(alpha * k) : r.destroy()), 70 * (i + 1)));
  }

  /** A one-pixel ring growing out from (x, y), flattened to the ground's perspective, stepping out. */
  private ring(x: number, y: number, c: number, radius: number, ms: number) {
    const g = this.add.graphics().setDepth(35);
    this.tweens.addCounter({
      from: 2,
      to: radius,
      duration: ms,
      ease: 'Quad.easeOut',
      onUpdate: (tw) => {
        const r = Math.round(tw.getValue() ?? 0);
        const k = tw.progress;
        g.clear();
        g.lineStyle(P, c, k < 0.6 ? 1 : 0.5);
        g.strokeEllipse(snap(x), snap(y), r * 2 * P, Math.max(2, Math.round(r * 1.3)) * P);
      },
      onComplete: () => g.destroy(),
    });
  }

  /** A pillar of light from the top of the view down onto him, with a white core, fading in steps. */
  private pillar(x: number, y: number, c: number, drop: number, tier: number) {
    const g = this.add.graphics().setDepth(19);
    const front = this.add.graphics().setDepth(34);
    const w = 8 + Math.min(8, tier - SLAM_FROM.pillar) * 2;
    const left = snap(x) - Math.floor(w / 2) * P;
    const bottom = snap(y) + 6 * P;
    const draw = (k: number, a: number) => {
      const h = Math.round((bottom / P) * k) * P;
      g.clear();
      front.clear();
      g.fillStyle(c, 0.28 * a).fillRect(left - 2 * P, bottom - h, (w + 4) * P, h);
      g.fillStyle(c, 0.5 * a).fillRect(left, bottom - h, w * P, h);
      front.fillStyle(0xffffff, 0.75 * a).fillRect(snap(x) - P, bottom - h, 2 * P, h);
    };
    // It reaches down as the item falls, holds a moment, then fades in steps.
    this.tweens.addCounter({ from: 0, to: 1, duration: drop, onUpdate: (tw) => draw(tw.getValue() ?? 0, 1) });
    this.tweens.addCounter({
      from: 1,
      to: 0,
      delay: drop + 160,
      duration: 380 + tier * 40,
      ease: 'Stepped',
      easeParams: [5],
      onUpdate: (tw) => draw(1, tw.getValue() ?? 0),
      onComplete: () => {
        g.destroy();
        front.destroy();
      },
    });
  }

  private cheer(seconds: number) {
    if (this.dead || this.mode === 'swing') return;
    this.mode = 'cheer';
    this.poseT = seconds;
  }

  /** Notes the raccoon's gold, level and XP (what the next batch of events adds is measured from here). */
  private look(g: GameState) {
    const s = this.seen;
    if (s.coins !== g.currencies.coins || s.level !== g.player.level || s.xp !== g.player.xp) {
      this.seen = { coins: g.currencies.coins, level: g.player.level, xp: g.player.xp };
    }
  }

  /**
   * Remembers a batch's kills until their blows land. What they really paid the raccoon (what his gold
   * and XP went up by: nothing for a heist's kills, which pay the run) is held off the HUD's counters
   * until their coins and sparks get there. XP isn't held when the batch levels him up: the bar shows the
   * new level with the jingle and the fanfare.
   */
  private noteKills(events: CoreEvent[]) {
    const g = gameStore.getState().game;
    const was = this.seen;
    this.look(g);
    if (!events.some((e) => e.type === 'kill')) return;
    let gold = Math.max(0, g.currencies.coins - was.coins);
    const lv = g.player.level;
    let xp = Math.max(0, lv === was.level ? g.player.xp - was.xp : totalXpForLevel(lv) + g.player.xp - totalXpForLevel(was.level) - was.xp);
    const leveled = events.some((e) => e.type === 'levelUp');
    // A boss win buzzes the phone already (rollController).
    const bossWin = events.some((e) => e.type === 'bossWin');
    for (const e of events) {
      if (e.type !== 'kill') continue;
      const paid = Math.min(e.coins, gold);
      const gain = Math.min(e.xp, xp);
      gold -= paid;
      xp -= gain;
      const old = this.kills.get(e.enemyUid);
      if (old) {
        release(old.gold);
        release(old.xp);
      }
      this.kills.set(e.enemyUid, {
        kind: e.kind, coins: e.coins, gold: hold('gold', paid), xp: hold('xp', leveled ? 0 : gain), xpGain: gain, buzzed: bossWin,
      });
    }
  }

  private onEvents(events: CoreEvent[]) {
    if (!this.sys.isActive()) return;
    // Kills arrive with the blow that caused them; remember them so the death plays when the blow lands.
    this.noteKills(events);
    this.heistEvents(events);
    this.perkEvents(events);
    let lastSwing: Swing | null = null;
    for (const e of blowsFirst(events)) {
      if (e.type === 'spinStart') this.showLuckChains(e);
      switch (e.type) {
        case 'playerHit': {
          lastSwing = { targetUid: e.targetUid, amount: e.amount, crit: e.crit, echo: e.echo, killed: e.killed, riders: [] };
          this.queueSwing(lastSwing);
          break;
        }
        case 'chain': {
          const run = () => {
            const a = this.foes.get(e.fromUid);
            const b = this.foes.get(e.toUid);
            if (!b) return;
            const pa = a ? this.foeHitPoint(a) : { x: this.hero.x + 13 * P, y: FEET_Y - 18 * P };
            const pb = this.foeHitPoint(b);
            this.lightning(pa, pb);
            this.flash(b.spr, 0xfff3a0, 70);
            b.shownHp = Math.max(0, b.shownHp - e.amount);
            b.knockV += 33 * P;
            this.number(pb.x, pb.y - 6 * P, formatNumber(e.amount), { fill: '#ffe14a', floor: this.barTop(b) });
            if (this.kills.has(b.uid)) this.die(b);
          };
          this.attachRider(lastSwing, e.toUid, run);
          break;
        }
        case 'explode': {
          const run = () => {
            const a = this.foes.get(e.fromUid);
            const b = this.foes.get(e.toUid);
            const pa = a ? this.foeHitPoint(a) : b ? this.foeHitPoint(b) : null;
            if (pa) this.boom(pa.x, pa.y);
            if (b) {
              const pb = this.foeHitPoint(b);
              b.shownHp = Math.max(0, b.shownHp - e.amount);
              b.knockV += 55 * P;
              this.number(pb.x, pb.y - 6 * P, formatNumber(e.amount), { fill: '#ffab70', floor: this.barTop(b) });
              if (this.kills.has(b.uid)) this.die(b);
            }
          };
          this.attachRider(lastSwing, e.toUid, run);
          break;
        }
        case 'burn': {
          const f = this.foes.get(e.enemyUid);
          if (!f) break;
          const p = this.foeHitPoint(f);
          // (The pack's fire is taller than most enemies at this pixel size, so burns stay pixel flames.)
          this.bits.burst(6, p.x, p.y + 2 * P, FLAME);
          f.shownHp = Math.max(0, f.shownHp - e.amount);
          this.number(p.x + 3 * P, p.y - 4 * P, formatNumber(e.amount), { fill: '#ff9e5e', life: 600, floor: this.barTop(f) });
          if (this.kills.has(f.uid) && f.pending === 0) this.die(f);
          break;
        }
        case 'enemyHit': {
          const f = this.foes.get(e.enemyUid);
          if (f) this.lungeAt(f, () => this.heroHurt(e.amount, e.heavy), e.heavy);
          else this.heroHurt(e.amount, e.heavy);
          break;
        }
        case 'thorns': {
          const f = this.foes.get(e.enemyUid);
          if (!f) break;
          this.time.delayedCall(170, () => {
            const p = this.foeHitPoint(f);
            this.bits.burst(5, p.x, p.y, SPARK);
            f.shownHp = Math.max(0, f.shownHp - e.amount);
            this.number(p.x, p.y - 5 * P, formatNumber(e.amount), { fill: '#9cff8a', floor: this.barTop(f) });
            if (this.kills.has(f.uid) && f.pending === 0) this.die(f);
          });
          break;
        }
        case 'playerDodge': {
          const f = this.foes.get(e.enemyUid);
          const dodge = () => {
            audio.dodge();
            this.heroKnock = this.reduceMotion ? 0 : -5 * P;
            this.number(this.hero.x, FEET_Y - 26 * P, t('battle.dodge'), { fill: '#7fe9ff', floor: this.heroBarTop() });
          };
          if (f) this.lungeAt(f, dodge, false);
          else dodge();
          break;
        }
        case 'heal':
          if (e.source === 'lifesteal') this.healAcc += e.amount;
          else {
            this.number(this.hero.x - 4 * P, FEET_Y - 25 * P, `+${formatNumber(e.amount)}`, { fill: '#7ef08f', floor: this.heroBarTop() });
            this.fx('sparkle', this.hero.x, FEET_Y - 8 * P, { depth: 34, tint: 0x9dff9a });
          }
          break;
        case 'bossSpecial': {
          const f = this.foes.get(e.enemyUid);
          if (f) this.stamp(f.c.x - f.front * 0.3, FEET_Y - f.height - 6 * P, `${e.name}!`, '#FF9800');
          break;
        }
        case 'kill': {
          const f = this.foes.get(e.enemyUid);
          // Deaths from burns, thorns or splash damage play right away; sword kills wait for the blow.
          if (f && f.pending === 0) this.die(f);
          break;
        }
        case 'bagDrop':
          this.time.delayedCall(250, () => this.bagBurst(e.count));
          break;
        case 'waveStart': {
          // A new wave's kills climb from the bottom again.
          this.streak.n = 0;
          const g = gameStore.getState().game;
          const boss = g.battle.enemies.some((x) => x.kind !== 'regular');
          if (boss) this.time.delayedCall(700, () => this.banner(t('battle.bossIncoming'), ['#ffd0c0', '#ff4d3d']));
          else if (e.wave === 0) this.time.delayedCall(700, () => this.banner(t('battle.fight'), GOLD));
          break;
        }
        case 'worldFirstClear':
          this.banner(t('battle.worldCleared'), GOLD, FEET_Y - 50 * P);
          this.confetti.burst(72, BATTLE_W / 2, FEET_Y - 50 * P, CONFETTI);
          this.cheer(1.6);
          break;
        case 'bossWin':
          if (!events.some((x) => x.type === 'worldFirstClear')) this.confetti.burst(20, BATTLE_W / 2 + 20 * P, FEET_Y - 42 * P, CONFETTI);
          this.cheer(1.2);
          break;
        case 'levelUp': {
          // The XP bar shows the new level now (with the jingle and the HUD's fanfare), not when sparks land.
          releaseAll('xp');
          // One burst for a batch: a big haul can grant many levels at once.
          if (events.some((x, j) => j > events.indexOf(e) && x.type === 'levelUp')) break;
          if (!this.fx('levelUp', this.hero.x, FEET_Y - 8 * P, { depth: 33 })) {
            this.still('fx_puff', this.hero.x, FEET_Y - 14 * P, { depth: 33, tint: 0xffe14a, ms: 700 });
          }
          this.bits.burst(14, this.hero.x, FEET_Y - 16 * P, BIG_SPARK);
          this.number(this.hero.x, FEET_Y - 32 * P, t('battle.levelUp'), { big: true, fill: bands(GOLD), life: 1100, floor: this.heroBarTop() });
          this.cheer(1);
          break;
        }
        case 'equip':
          // The item flies in from wherever it was (EquipFlight) and slams onto him: until then he
          // keeps his old look in that slot.
          this.holdGear(e.item, e.replaced);
          break;
        case 'luckBoost':
          this.bits.burst(20, this.hero.x, FEET_Y - 12 * P, { ...FLAME, colors: [0xd8ffd0, 0x8dff8a], fade: [0x46d36b, 0x2fb150] });
          this.fx('sparkle', this.hero.x, FEET_Y - 9 * P, { depth: 34, tint: 0x8dff8a });
          this.number(this.hero.x, FEET_Y - 33 * P, t('battle.luckUp', { mult: BAL.luck.potion.mult }), {
            big: true, fill: bands(['#d8ffd0', '#2fb150']), life: 1200, floor: this.heroBarTop(),
          });
          break;
        case 'playerDeath':
          this.buzz('heavy');
          this.dead = true;
          this.mode = 'ko';
          this.swingQueue = [];
          // Curls up and falls asleep.
          this.heroSpr.play('hero:lie');
          this.heroSpr.chain('hero:sleep');
          this.aimWeapon(REST);
          this.stamp(this.hero.x, FEET_Y - 24 * P, t('battle.ko'), '#FF8A80');
          break;
        case 'stageStart':
          this.clearFoes();
          this.bossUi.setAlpha(0).setVisible(false);
          if (this.dead) {
            this.dead = false;
            this.mode = 'idle';
            this.tweens.killTweensOf(this.hero);
            // Wakes up and stands.
            this.mode = 'wake';
            this.heroSpr.play('hero:wake');
            this.heroSpr.chain('hero:idle');
          }
          break;
      }
    }
  }

  // ------------------------------------------------------------------ heists

  /** "HEIST" over "ACT 1 · 3/19" in the top-left corner, under the HUD, while a run is on. */
  private heistBadge: PixelText | null = null;
  /** The location of the run on screen (a new run shows its title card), or null. */
  private heistAt: string | null = null;

  /**
   * A heist in the battle (core's heist events): "ACT 2" as each act begins, "BOSS: CHEF TONY" when the
   * boss's stop comes up, the getaway or the bust when the last fight ends, and the run's own hits:
   * blocks, stuns and the crew's pecks.
   */
  private heistEvents(events: CoreEvent[]) {
    const run = gameStore.getState().game.heist.run;
    for (const e of events) {
      switch (e.type) {
        case 'heistNode':
          if (e.kind === 'boss') {
            const loc = run ? DATA.heistLocationsById.get(run.location) : undefined;
            const name = loc ? DATA.enemiesById.get(loc.boss)?.name ?? '' : '';
            this.banner(t('heistUi.battle.boss', { name }), ['#ffd0c0', '#ff4d3d']);
          } else if (e.index === 0) {
            this.banner(t('heistUi.battle.act', { n: e.act }), GOLD);
          }
          break;
        case 'heistFightEnd':
          if (e.won && run?.status === 'won') {
            this.time.delayedCall(450, () => {
              this.banner(t('heistUi.battle.won'), GOLD, FEET_Y - 50 * P);
              this.confetti.burst(72, BATTLE_W / 2, FEET_Y - 50 * P, CONFETTI);
              this.cheer(1.6);
            });
          } else if (!e.won) {
            this.time.delayedCall(700, () => this.banner(t('heistUi.battle.busted'), ['#ffd0c0', '#ff4d3d'], FEET_Y - 50 * P));
          }
          break;
        case 'heistBlock':
          this.stamp(this.hero.x + 2 * P, FEET_Y - 30 * P, t('heistUi.battle.block'), '#9edcf7');
          this.bits.burst(8, this.hero.x + 8 * P, FEET_Y - 14 * P, SPARK);
          break;
        case 'heistStun': {
          const f = this.foes.get(e.enemyUid);
          if (!f) break;
          const p = this.foeHitPoint(f);
          this.number(p.x, p.y - 8 * P, t('heistUi.battle.stun'), { fill: '#fff28c', life: 700, floor: this.barTop(f) });
          break;
        }
        case 'heistHelper': {
          const hit = () => {
            const f = this.foes.get(e.enemyUid);
            if (!f) return;
            const p = this.foeHitPoint(f);
            this.bits.burst(5, p.x, p.y, { ...SPARK, colors: [0xcfcedb, 0xffffff], fade: [0x7f7c94] });
            this.flash(f.spr, 0xffffff, 60);
            this.number(p.x + 4 * P, p.y - 4 * P, formatNumber(e.amount), { fill: '#cfe8ff', life: 600, floor: this.barTop(f) });
            // A foe a peck killed falls as the peck lands.
            if (e.helper === 'pigeon' && this.kills.has(f.uid) && f.pending === 0) this.die(f);
          };
          if (e.helper === 'pigeon') this.pigeonPeck(e.enemyUid, hit);
          else hit();
          break;
        }
      }
    }
  }

  // ------------------------------------------------------------------ Alley perks

  /**
   * The Alley perks in the battle (core/systems/perks.ts): the crew's blows land as a heist helper's do
   * (sparks in the helper's colors, a flash and the damage), Playing Possum's second wind stamps the
   * hero, and a world paying its Half-Eaten Bread Loaves pops "+1 LOAF" over him.
   */
  private perkEvents(events: CoreEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'crewHit': {
          const hit = () => {
            const f = this.foes.get(e.enemyUid);
            if (!f) return;
            const p = this.foeHitPoint(f);
            this.bits.burst(e.helper === 'gull' ? 8 : 5, p.x, p.y, { ...SPARK, ...CREW_SPARKS[e.helper] });
            this.flash(f.spr, 0xffffff, 60);
            this.number(p.x + 4 * P, p.y - 4 * P, formatNumber(e.amount), { fill: CREW_NUMBER[e.helper], life: 600, floor: this.barTop(f) });
            if (this.kills.has(f.uid) && f.pending === 0) this.die(f);
          };
          // The Pigeon Wingman's pigeon flies over and pecks; the rest of the crew hits from off screen.
          if (e.helper === 'pigeon') this.pigeonPeck(e.enemyUid, hit);
          else hit();
          break;
        }
        case 'secondWind':
          this.stamp(this.hero.x, FEET_Y - 30 * P, t('battle.secondWind'), '#9dff9a');
          this.bits.burst(12, this.hero.x, FEET_Y - 14 * P, BIG_SPARK);
          this.cheer(1);
          break;
        case 'breadEarned':
          this.time.delayedCall(900, () => {
            const text = t(e.loaves === 1 ? 'battle.loaf' : 'battle.loaves', { n: e.loaves });
            this.number(this.hero.x, FEET_Y - 36 * P, text, { big: true, fill: bands(['#fff3c4', '#d4862a']), life: 1200, floor: this.heroBarTop() });
          });
          break;
      }
    }
  }

  // ------------------------------------------------------------------ the crew's pigeons

  /**
   * A crew pigeon flies to foe `uid` and pecks it: `land` (the peck's sparks, number and a kill) runs as
   * it lands, and the foe stays up until then. With no pigeon free (or reduced motion) it lands at once.
   */
  private pigeonPeck(uid: number, land: () => void) {
    const f = this.foes.get(uid);
    const p = !f || this.reduceMotion ? undefined : this.pigeons.find((x) => !x.trip);
    if (!f || !p) {
      land();
      return;
    }
    f.pending++;
    p.trip = {
      t: 0,
      uid,
      to: this.foeHitPoint(f),
      landed: false,
      land: () => {
        f.pending = Math.max(0, f.pending - 1);
        land();
      },
    };
  }

  /**
   * One little pigeon per pigeon the run has (Pigeon Pal, three with Pigeon Air Force), or the Alley's
   * Pigeon Wingman, waits behind the raccoon: the two on the ground peck at it now and then and hop
   * along on the walk, the third flutters a pixel up and down. A peck is a hop out to the foe (its beak
   * on the foe's hit point), a dip, and a hop home facing back. All in whole art pixels.
   */
  private updatePigeons(g: GameState, walking: boolean, dt: number) {
    const run = g.heist.run;
    const n = run ? Math.round(runEffects(run).pigeons) : perkFx(g).pigeonAtkPct > 0 ? 1 : 0;
    const want = Math.max(0, Math.min(PIGEON_PERCH.length, n));
    while (this.pigeons.length > want) {
      const p = this.pigeons.pop()!;
      if (p.trip && !p.trip.landed) p.trip.land();
      p.img.destroy();
    }
    while (this.pigeons.length < want) {
      this.pigeons.push({ img: this.add.image(0, 0, pigeonTex(this, true)).setOrigin(0, 0).setScale(P).setDepth(19), right: true, trip: null });
    }
    this.pigeonClock += dt;
    const beat = (seconds: number, i: number) => Math.floor(this.pigeonClock / seconds + i * 0.5) % 2;
    const T = PIGEON_TRIP;
    this.pigeons.forEach((p, i) => {
      const perch = PIGEON_PERCH[i];
      const homeX = this.heroX - perch.back * P;
      const homeY = FEET_Y - (PIGEON_H + perch.up) * P;
      let x = homeX;
      let y = homeY;
      let right = true;
      const tr = p.trip;
      if (tr) {
        tr.t += dt;
        const f = this.foes.get(tr.uid);
        if (f && !f.dying) tr.to = this.foeHitPoint(f);
        if (tr.t >= T.out && !tr.landed) {
          tr.landed = true;
          tr.land();
        }
        // The beak (its right column, third row) on the foe.
        const tx = tr.to.x - (PIGEON_W - 1) * P;
        const ty = tr.to.y - 2 * P;
        const hop = (k: number) => Math.round(Math.sin(Math.PI * k) * T.arc) * P;
        if (tr.t < T.out) {
          const k = easeOutQuad(tr.t / T.out);
          x = lerp(homeX, tx, k);
          y = lerp(homeY, ty, k) - hop(k) - beat(0.05, i) * P;
        } else if (tr.t < T.out + T.peck) {
          const k = (tr.t - T.out) / T.peck;
          x = tx + (k > 0.2 && k < 0.7 ? P : 0);
          y = ty + (k > 0.2 && k < 0.7 ? P : 0);
        } else if (tr.t < T.out + T.peck + T.back) {
          const k = easeInQuad((tr.t - T.out - T.peck) / T.back);
          x = lerp(tx, homeX, k);
          y = lerp(ty, homeY, k) - hop(k) - beat(0.05, i) * P;
          right = false;
        } else p.trip = null;
      } else if (!this.reduceMotion) {
        if (perch.up > 0) y -= beat(0.12, i) * P;
        else if (walking) y -= beat(0.16, i) * P;
        // Now and then it pecks at the ground: a pixel forward and down.
        else if (Math.floor(this.pigeonClock / 0.4 + i * 1.3) % 5 === 0) {
          x += P;
          y += P;
        }
      }
      if (right !== p.right) {
        p.right = right;
        p.img.setTexture(pigeonTex(this, right));
      }
      p.img.setPosition(snap(x), snap(y)).setDepth(p.trip ? 21 : 19);
    });
  }

  /** The heist's badge, and a new run's title card in place of the one for the world it borrows. */
  private updateHeist(g: GameState) {
    const run = g.heist.run;
    const at = run?.location ?? null;
    if (at !== this.heistAt) {
      this.heistAt = at;
      if (run) this.showHeistCard(DATA.heistLocationsById.get(run.location)?.name ?? '');
    }
    if (!run) {
      this.heistBadge?.setVisible(false);
      return;
    }
    const per = BAL.heist.nodesPerAct;
    const total = BAL.heist.actMult.length * per + 1;
    const n = Math.min(total, (run.act - 1) * per + run.index + 1);
    const text = `${t('heistUi.battle.kicker')}\n${t('heistUi.battle.badge', { act: run.act, n, total })}`;
    if (!this.heistBadge?.active) this.heistBadge = this.texts.add(text, HEIST_BADGE).setDepth(47);
    // Out of the way while a title card shows.
    this.heistBadge.setText(text).place(3 * P, 19 * P, 0, 0).setVisible(!this.worldCard);
  }

  /** A run's title card, "HEIST" over the place's name, timed like a world's (showWorldCard). */
  private showHeistCard(name: string) {
    this.worldCard?.destroy();
    const card = this.texts.add(`${t('heistUi.battle.kicker')}\n${name}`, WORLD_CARD).setDepth(48);
    this.worldCard = card;
    const y = 21 * P;
    const still = this.reduceMotion;
    card.place(BATTLE_W / 2, y, 0.5, 0).setAlpha(0);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 2800,
      onUpdate: (tw) => {
        if (!card.active) return;
        const k = tw.getValue() ?? 0;
        let dy = 0;
        let alpha = 1;
        if (still) alpha = k < 0.85 ? 1 : stepsDown((k - 0.85) / 0.15);
        else if (k < 0.12) {
          const u = k / 0.12;
          dy = u < 0.5 ? 2 : u < 0.85 ? 1 : 0;
          alpha = u < 0.5 ? 0.5 : 1;
        } else if (k >= 0.78) {
          const u = (k - 0.78) / 0.22;
          dy = u < 0.5 ? 0 : -1;
          alpha = stepsDown(u);
        }
        card.place(BATTLE_W / 2, y + dy * P, 0.5, 0).setAlpha(alpha);
      },
      onComplete: () => {
        card.destroy();
        if (this.worldCard === card) this.worldCard = null;
      },
    });
  }

  // ------------------------------------------------------------------ enemies
  private makeFoe(uid: number, enemyId: string, kind: Kind, hp: number, maxHp: number, startX: number, world: number): Foe {
    const tex = enemyTex(this, enemyId, world);
    const c = this.add.container(snap(startX), FEET_Y).setDepth(18);
    // A flat pixel shadow about as wide as the foe, centered on its feet column.
    const sh = shadowTex(this, Math.max(8, Math.round(((tex.front + tex.back) * 0.6) / P)));
    const shadow = this.add.image(-Math.floor(sh.w / 2) * P, -P, sh.key).setOrigin(0, 0).setAlpha(0.22);
    const rig = this.add.container(0, 0);
    const spr = this.add.sprite(0, 0, tex.key, '0').setOrigin(tex.ox, tex.oy).setScale(P);
    rig.add(spr);
    c.add([shadow, rig]);
    // Its HP bar: about as wide as its art, centered over it, BAR_GAP over the highest point of its
    // standing and walking frames. (Over the vignette and the weather, like the hero's.)
    const bar = this.add.graphics().setDepth(39).setVisible(false);
    const barW = Phaser.Math.Clamp(Math.round((tex.artR - tex.artL) / P) - 2, FOE_BAR_W.min, FOE_BAR_W.max);
    const barX = snap((tex.artL + tex.artR) / 2 - (barW * P) / 2);
    const barY = -snap(tex.reach) - (BAR_GAP + BAR_TALL) * P;
    spr.play(`${tex.key}:${tex.anims.has('walk') ? 'walk' : 'idle'}`);
    if (!tex.animated) {
      // Stills breathe: one pixel up and down so nothing sits perfectly still.
      this.tweens.add({ targets: spr, y: -P, duration: 420 + (uid % 5) * 60, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [1] });
    }
    return {
      uid, id: enemyId, kind, c, rig, spr, tex, bar, barX, barY, barW, barSig: '', front: tex.front, back: tex.back, height: tex.height,
      x: startX, lunge: 0, knock: 0, knockV: 0, shownHp: hp, trail: { hp, hold: GHOST_HOLD }, maxHp, pending: 0, dead: false, dying: false, acting: false,
    };
  }

  private syncFoes(g: GameState, dt: number) {
    const alive = new Set<number>();
    const frontUid = g.battle.enemies[0]?.uid;
    let edge = ENGAGE_EDGE;
    g.battle.enemies.forEach((e, i) => {
      alive.add(e.uid);
      let f = this.foes.get(e.uid);
      if (!f) {
        f = this.makeFoe(e.uid, e.enemyId, e.kind, e.hp, e.maxHp, BATTLE_W + 18 * P + i * 13 * P, g.battle.stage);
        this.foes.set(e.uid, f);
      }
      const target = edge + f.front;
      // Spaced apart (a little overlap for wide foes) so their HP bars never touch.
      edge = target + f.back * 0.8 + 2 * P;
      if (f.dying) return;
      f.maxHp = e.maxHp;
      // Heals and resets show at once; damage waits until its blow visibly lands.
      if (e.hp > f.shownHp) f.shownHp = e.hp;
      else if (f.pending === 0) f.shownHp = Math.max(0, e.hp);
      const k = 1 - Math.pow(0.002, dt);
      f.x += (target - f.x) * k;
      f.c.setDepth(18 - i * 0.01);
      // Walk while closing in, idle once in place.
      if (!f.acting && f.tex.anims.has('walk')) {
        const want = Math.abs(target - f.x) > 2 * P ? 'walk' : 'idle';
        const key = `${f.tex.key}:${want}`;
        if (f.spr.anims.currentAnim?.key !== key) f.spr.play(key);
      }
    });
    for (const [uid, f] of this.foes) {
      if (!alive.has(uid) && !f.dying && f.pending === 0 && !this.swingQueue.some((s) => s.targetUid === uid)) {
        // Gone from core without a visible blow (e.g. a stage reset): just remove it.
        if (this.kills.has(uid)) this.die(f);
        else {
          f.c.destroy();
          f.bar.destroy();
          this.foes.delete(uid);
        }
      }
    }
    for (const f of this.foes.values()) {
      if (f.dying) continue;
      // Knockback spring.
      f.knockV += -f.knock * 260 * dt - f.knockV * 16 * dt;
      f.knock += f.knockV * dt;
      f.c.x = snap(f.x + f.lunge + (this.reduceMotion ? 0 : f.knock));
      drainTrail(f.trail, f.shownHp, f.maxHp, dt);
      // A foe's bar stays hidden (a calmer field) until it fronts the line or has been hit.
      const show = f.kind === 'regular' && (f.uid === frontUid || f.shownHp < f.maxHp);
      f.bar.setVisible(show);
      if (!show) continue;
      f.bar.setPosition(f.c.x + f.barX, FEET_Y + f.barY);
      f.barSig = this.pixelBar(f.bar, f.barSig, f.barW, BAR_TALL, f.shownHp / f.maxHp, f.trail.hp / f.maxHp, BAR_FOE);
    }
  }

  /**
   * Draws a pixel HP bar `w` x `h` art pixels into `g` (its top-left corner at g's position): a
   * CHARACTER_OUTLINE frame with cut corners around a lit top row over the main rows; the part lost
   * since `ghost` light, the rest dark. Redraws only if the cells differ from `sig`; returns the new sig.
   */
  private pixelBar(g: Phaser.GameObjects.Graphics, sig: string, w: number, h: number, pct: number, ghost: number, tones: BarTones): string {
    const inner = w - 2;
    const { fill, trail } = barCells(inner, pct, ghost);
    const next = `${w}x${h}:${fill},${trail},${tones[1]}`;
    if (next === sig) return sig;
    g.clear();
    g.fillStyle(BAR_LINE, 1);
    g.fillRect(P, 0, inner * P, P);
    g.fillRect(P, (h - 1) * P, inner * P, P);
    g.fillRect(0, P, P, (h - 2) * P);
    g.fillRect((w - 1) * P, P, P, (h - 2) * P);
    const span = (from: number, to: number, c: BarTones) => {
      if (to <= from) return;
      g.fillStyle(c[0], 1).fillRect((1 + from) * P, P, (to - from) * P, P);
      if (h > 3) g.fillStyle(c[1], 1).fillRect((1 + from) * P, 2 * P, (to - from) * P, (h - 3) * P);
    };
    span(0, fill, tones);
    span(fill, trail, BAR_GHOST);
    span(trail, inner, BAR_EMPTY);
    return next;
  }

  private clearFoes() {
    for (const f of this.foes.values()) {
      f.c.destroy();
      f.bar.destroy();
    }
    this.foes.clear();
    // Their coins and sparks won't fly now: the counters get what they held back at once.
    for (const k of this.kills.values()) {
      release(k.gold);
      release(k.xp);
    }
    this.kills.clear();
    this.swingQueue = [];
  }

  private maxHp(g: GameState): number {
    // A heist's bar shows the run's HP.
    if (g.heist.run) return battleMaxHp(g);
    // (Alley perks change max HP too: Glass Cannon halves it.)
    if (this.hpCache.key !== g.equipped || this.hpCache.perks !== g.perks.owned || this.hpCache.hp <= 0) {
      this.hpCache = { key: g.equipped, perks: g.perks.owned, hp: computeStats(g).HP };
    }
    return this.hpCache.hp;
  }

  /** Hero pose for this frame: the walk cycle while walking, short poses, idle loop. */
  private animateHero(walking: boolean, dt: number) {
    if (this.dead) {
      this.rig.y = 0;
      return;
    }
    if (this.swinging) {
      this.rig.y = 0;
      return;
    }
    if (this.mode === 'wake') {
      // Let the wake-up play out before walking or idling.
      this.rig.y = 0;
      if (this.heroSpr.anims.isPlaying && this.heroSpr.anims.currentAnim?.key === 'hero:wake') return;
      this.mode = 'idle';
    }
    if (this.mode === 'hurt' || this.mode === 'cheer') {
      this.poseT -= dt;
      if (this.poseT > 0) {
        this.rig.y = 0;
        if (this.mode === 'hurt') this.heroFrame(FRAME.blush);
        else this.heroAnim('cheer');
        return;
      }
      this.mode = 'idle';
    }
    // Where he is on the ground (screen px): the ground going by, and his own way between the spots where
    // he walks and where he fights.
    const covered = this.heroX + this.heroDx + this.heroKnock + this.scroll.ground;
    // After a walk, he steps up to where he fights.
    const stepping = !walking && this.mode === 'walk' && HERO_FIGHT_X - this.heroX > P / 4;
    if ((walking || stepping) && !this.reduceMotion) {
      // Walks: Kevin's walk cycle (hero:walk's frames), a frame for each stride of ground he covers (at
      // WALK_SPEED, its frame rate), so a planted foot keeps its place on the ground. He steps off from
      // his idle stance, waits on that step while he slides back to where he walks, and dust puffs
      // where a foot comes down, drifting off with the ground.
      const w = HERO.walk;
      if (this.mode !== 'walk') this.walkT = covered;
      this.mode = 'walk';
      this.rig.y = 0;
      this.walkT = Math.min(this.walkT, covered);
      const step = Math.floor(((covered - this.walkT) * w.fps) / w.speed);
      const frame = w.frames[step % w.frames.length];
      const foot = w.footfalls[frame];
      if (foot !== undefined && this.heroSpr.frame.name !== String(frame)) {
        const v = walking ? WALK_SPEED / P : 0;
        this.dust.burst(2, this.hero.x + foot, FEET_Y - P, { ...DUST, speedX: [-v - 6, -v + 3], speedY: [-9, -3] });
      }
      this.heroFrame(frame);
      return;
    }
    this.mode = 'idle';
    this.rig.y = 0;
    this.heroAnim('idle');
  }

  update(time: number, deltaMs: number) {
    const real = Math.min(0.05, deltaMs / 1000);
    // A hit-stop slows the whole world (particles, movement, scrolling), not just tweens and animations.
    const dt = this.frozen ? real * STOP_SPEED : real;
    this.stopBudget = Math.min(STOP_BUDGET, this.stopBudget + real * STOP_REFILL);
    const g = gameStore.getState().game;
    this.look(g);
    const b = g.battle;
    const walking = b.phase === 'walking' && !this.dead;

    // Parallax while walking (each layer drawn at whole art pixels); clouds always drift.
    const speed = walking ? WALK_SPEED : 0;
    this.scrollLayer('far', this.scroll.far + speed * 0.18 * dt);
    this.scrollLayer('mid', this.scroll.mid + speed * 0.5 * dt);
    this.scrollLayer('ground', this.scroll.ground + speed * dt);
    this.scrollLayer('fg', this.scroll.fg + speed * 1.3 * dt);
    for (const c of this.clouds) {
      c.scroll += (c.speed * P + speed * 0.05) * dt;
      c.strip.scrollTo(c.scroll);
    }
    if (b.stage !== this.worldShown) this.showWorld(b.stage);
    this.ambience.update(dt, speed * dt, (name) => snap(this.scroll[name]), {
      reduceMotion: this.reduceMotion,
      reduceFlashing: this.reduceFlashing,
    });

    // New gear shows the moment its item slams onto him (slamImpact), not while it's still flying in.
    const shown = this.shownEquipped(g);
    const sig = SLOTS.map((s) => `${shown[s]?.uid ?? 0}`).join(',');
    if (sig !== this.gearSig) {
      this.gearSig = sig;
      this.drawGear(shown);
    }

    // Hero: hops along, closes in to fight, and stays put (idling) while the player picks a world after a boss.
    const targetX = b.phase === 'fighting' || b.phase === 'choice' ? HERO_FIGHT_X : HERO_WALK_X;
    this.heroX += (targetX - this.heroX) * (1 - Math.pow(0.001, dt));
    this.heroKnock += (0 - this.heroKnock) * (1 - Math.pow(0.0005, dt));
    this.hero.x = snap(this.heroX + this.heroDx + this.heroKnock);
    // Where an equipped item flies to (EquipFlight, in stage px: the view is drawn 1:1 at the stage's top).
    slamAnchor.x = this.hero.x + HERO.midX;
    slamAnchor.feetY = FEET_Y;
    this.animateHero(walking, dt);
    if (this.time.now < this.squashUntil) this.rig.y += P;
    this.followBody();
    this.updateAura(dt);
    void time;

    this.syncFoes(g, dt);
    this.updatePigeons(g, walking, dt);
    if (this.releaseLater) this.releaseLater = releaseWorlds(this, this.worldShown, this.foeTextures()) > 0;

    // Lifesteal heals are batched into one number.
    this.healTimer -= dt;
    if (this.healAcc >= 1 && this.healTimer <= 0) {
      this.number(this.hero.x - 5 * P, FEET_Y - 25 * P, `+${formatNumber(this.healAcc)}`, { fill: '#7ef08f', life: 600, floor: this.heroBarTop() });
      this.healAcc = 0;
      this.healTimer = 0.5;
    }

    // "Too tough!" when the raccoon has just been beaten back (not while it stays up).
    const hint = g.stage.showToughHint;
    if (hint && !this.hintWas) this.showToughNotice();
    this.hintWas = hint;

    for (const bits of [this.bits, this.dust, this.confetti, this.glints]) bits.update(dt);
    this.updateShake(real);
    this.updateHeroBar(g, dt);
    this.updateBossBar(g, dt);
    this.updateHeist(g);
  }

  /**
   * The hero's bar, with a heart at its left end, over his head (or hat). It follows his spot and his
   * hops but not his dashes and knockbacks, so it stays calm while he fights. Hidden while he's out cold.
   */
  private updateHeroBar(g: GameState, dt: number) {
    const b = g.battle;
    const max = Math.max(1, b.playerHp, this.maxHp(g));
    drainTrail(this.heroTrail, b.playerHp, max, dt);
    const show = !this.dead;
    this.heroBar.setVisible(show);
    this.heart.setVisible(show);
    if (!show) return;
    const span = HEART_W - 1 + HERO_BAR_W;
    const x = snap(this.heroX + HERO.midX - (span * P) / 2);
    const y = FEET_Y - snap(this.heroTop) - (BAR_GAP + BAR_TALL) * P + this.rig.y;
    this.heart.setPosition(x, y - P);
    this.heroBar.setPosition(x + (HEART_W - 1) * P, y);
    this.heroBarSig = this.pixelBar(this.heroBar, this.heroBarSig, HERO_BAR_W, BAR_TALL, b.playerHp / max, this.heroTrail.hp / max, BAR_HERO);
  }

  /**
   * The boss bar near the top. It follows the boss on screen rather than core, so the killing blow
   * empties it, then it fades out. Between waves and while the player picks the next world (phase
   * 'choice') there is no boss and it stays hidden.
   */
  private updateBossBar(g: GameState, dt: number) {
    const b = g.battle;
    let f: Foe | undefined;
    for (const x of this.foes.values()) if (x.kind !== 'regular' && (!f || f.dying)) f = x;
    const show = !!f && !f.dying && (b.phase !== 'choice' || f.pending > 0);
    const ui = this.bossUi;
    ui.setAlpha(show ? Math.min(1, ui.alpha + dt * 8) : Math.max(0, ui.alpha - dt * 4)).setVisible(ui.alpha > 0);
    if (!f || !ui.visible) return;
    // A boss that's down shows an empty bar while it fades (its trail drains here: syncFoes skips the dying).
    const hp = f.dying ? 0 : f.shownHp;
    if (f.dying) drainTrail(f.trail, 0, f.maxHp, dt);
    this.bossName.setText(enemyName(b.stage, f.id, f.kind));
    this.bossName.place(BATTLE_W / 2, BOSS_BAR_Y - P, 0.5, 1);
    this.bossHp.setText(formatNumber(Math.max(0, Math.ceil(hp))));
    this.bossHp.place(BATTLE_W / 2 + (BOSS_BAR.w / 2 + 2) * P, BOSS_BAR_Y + (BOSS_BAR.h * P) / 2, 0, 0.5);
    const tones = f.kind === 'boss' ? BAR_BOSS : BAR_FOE;
    this.bossSig = this.pixelBar(this.bossBar, this.bossSig, BOSS_BAR.w, BOSS_BAR.h, hp / f.maxHp, f.trail.hp / f.maxHp, tones);
  }
}

export function createBattleGame(parent: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: BATTLE_W,
    height: BATTLE_H,
    backgroundColor: '#35C6F7',
    scale: { mode: Phaser.Scale.NONE },
    render: { antialias: false, pixelArt: true, roundPixels: true },
    fps: { target: 60, smoothStep: true },
    input: { mouse: false, touch: false, keyboard: false, gamepad: false },
    audio: { noAudio: true },
    banner: false,
    scene: [BattleScene],
  });
  // Test hook for browser automation in dev builds only.
  if (import.meta.env.DEV) (window as unknown as { __phaser: Phaser.Game }).__phaser = game;
  return game;
}
