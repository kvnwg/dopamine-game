/**
 * The battle view (Phaser). Reads GameState every frame and choreographs core events:
 * the raccoon hops along, closes in, winds up and dashes into a swing (pack hit effects, hit-stop
 * on crits, knockback), enemies walk in, attack, flinch and fall with their own animations, pixel
 * HP bars float over the fighters' heads (the boss's sits under the HUD), and coins arc up to the
 * gold counter. Combat results always come from core; this file only animates them.
 *
 * Everything is drawn on one pixel grid (P screen pixels per art pixel, docs/PIXEL_ART.md "One
 * grid"): Kevin's raccoon, the pack characters, the backdrops, the effects, the HP bars and the text
 * (the bitmap font in pixel/font.ts). Nothing is scaled or squashed. Things move in whole art pixels:
 * positions are snapped, pops step and flash instead of scaling, particles are 1 x 1 and 2 x 2 art
 * pixel bits, lines are pixel lines, the screen shakes by whole art pixels. Only the weapon's swing
 * rotates freely; a camera post-pass (gridSnap.ts) puts that, and anything else that slips off the
 * grid, back on it.
 */
import Phaser from 'phaser';
import { BAL, DATA, SLOTS, type Rarity } from '../data';
import { computeStats, enemyName, formatNumber, rarityAtLeast, worldDef, type CoreEvent, type GameState } from '../core';
import { bus } from '../app/eventBus';
import { gameStore } from '../app/store';
import { t } from '../ui/i18n';
import { rarityColor, rarityColorNum } from './art';
import {
  AURA, HERO, WEAPON_TILT, auraTex, coinTex, enemyTex, fxTex, gearTex, generateTextures, heroFrameOffset, heroTex, releaseWorlds,
  shadowTex, texOrigin, texSize, weaponTex, worldTextures, type FoeTex, type WorldKeys,
} from './textures';
import { P, toCanvas } from './pixel';
import { linePixels, mix } from './pixel/buf';
import { FACES, TEXT_INK, gradientRows, lineWidth, renderPlate, renderText, type TextStyle } from './pixel/font';
import { SPRITE_SLOTS } from './pixel/hero';
import { CHARACTER_OUTLINE, PAL } from './pixel/palette';
import { FEET_ROW, VIEW, VIEW_MARGIN, frameTop, type LayerName } from './pixel/sceneryTypes';
import type { FxName } from './pixel/packs/fx';
import { CLOUD_SCROLL0, layerY, scenerySet, scroll0, worldArt, worldSeed } from './worldLook';
import { Ambience } from './ambience';
import { PixelBits, type BitStyle } from './pixelBits';
import { PixelTexts, type PixelText } from './pixelText';
import { snapCameraToGrid } from './gridSnap';

/** The battle view: 120 x 107 art pixels, 1080 x 963 screen pixels. */
export const BATTLE_W = VIEW.w * P;
export const BATTLE_H = VIEW.h * P;
/** The ground line: the bottom edge of the view row fighters stand on. */
const FEET_Y = (FEET_ROW + 1) * P;
/** How far (screen px) the full-view pictures reach past each edge, for the screen shake. */
const MARGIN = VIEW_MARGIN * P;
const HERO_WALK_X = 33 * P;
const HERO_FIGHT_X = 37 * P;
/** Where the front enemy's leading edge stands while fighting. */
const ENGAGE_EDGE = 51 * P;
const COIN_TARGET = { x: 694, y: 58 };
/** Top of the boss HP bar: under the HUD row, with the boss's name (one or two lines) over it. */
const BOSS_BAR_Y = 27 * P;
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
const BAR_TALL = 4;
const FOE_BAR_W = { min: 10, max: 16 };
const HERO_BAR_W = 14;
const BOSS_BAR = { w: 52, h: 5 };
/** The heart (7 x 6) shares its right column with the hero bar's left edge; the skull (9 x 9) sits left of the boss bar. */
const HEART_W = 7;
const SKULL_W = 9;
/** Art pixels between a bar and the top of the head under it. */
const BAR_GAP = 2;
/** Seconds the light part of a fresh hit holds before it drains. */
const GHOST_HOLD = 0.3;

// ------------------------------------------------------------------ text styles (pixel/font.ts)

/** A fill with a lighter top row over `color`. */
const litTop = (color: string): readonly string[] => [mix(color, '#ffffff', 0.55), color];
/** A big-face fill in three flat bands from `top` to `bottom`. */
const bands = (grad: readonly [string, string]): readonly string[] => gradientRows(grad[0], grad[1], FACES.big.h);
/** Widest a line of battle text may be (art px), leaving room for the outline and a margin. */
const TEXT_MAX_W = VIEW.w - 8;
const BOSS_NAME: TextStyle = { face: 'small', fill: '#ffffff', maxW: TEXT_MAX_W };
const BOSS_HP: TextStyle = { face: 'small', fill: '#ffffff' };
const WORLD_CARD: TextStyle = { face: 'small', fill: '#ffffff', shadow: true, maxW: TEXT_MAX_W };
const GOLD: readonly [string, string] = ['#fff6a8', '#ffa21a'];

/** The "too tough" notice: a cream plate like the toasts', ink text, its first sentence big and red. */
const NOTICE = { bg: ['#fff0e0', '#ffe0c8', '#ffd0b0'], head: '#c8323a', ms: 2400 } as const;

// ------------------------------------------------------------------ particle styles (pixelBits.ts)

const SPARK: BitStyle = { speed: [240, 520], life: [200, 360], drag: 2, colors: [0xffffff], fade: [0xfff28c], sizes: [2, 1] };
const BIG_SPARK: BitStyle = {
  speed: [360, 860], life: [380, 680], drag: 2.5, colors: [0xffe14a, 0xffffff, 0xffb300], fade: [0xffb300], sizes: [2, 2, 1],
};
const DUST: BitStyle = { speed: [40, 150], angle: [180, 360], life: [360, 560], colors: [0xe8e0d0], sizes: [2, 1], alpha: [0.85, 0.55, 0.3] };
const FLAME: BitStyle = { speedX: [-40, 40], speedY: [-220, -120], life: [300, 520], colors: [0xffe14a, 0xffb300], fade: [0xff7043, 0xc8323a], sizes: [2, 1] };
const CONFETTI_COLORS = [0xff5a7a, 0xffd54f, 0x5bd23a, 0x4fc3f7] as const;
const CONFETTI: BitStyle = { speed: [320, 760], angle: [200, 340], gravity: 900, drag: 1.2, life: [900, 1500], colors: CONFETTI_COLORS, tumble: 90 };

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
  if (m && lineWidth(m[1], FACES.big) <= TEXT_MAX_W) return { head: m[1], rest: m[2] };
  return { head: null, rest: text };
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
  /** Screen shake: seconds left, reach in art pixels, seconds to the next jolt. */
  private shakeT = 0;
  private shakeAmp = 0;
  private shakeNext = 0;
  private foes = new Map<number, Foe>();
  private kills = new Map<number, { kind: Kind; coins: number }>();
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
  private hpCache: { key: unknown; hp: number } = { key: null, hp: 1 };
  private healAcc = 0;
  private healTimer = 0;
  private coinsFlying = 0;
  private unsub?: () => void;

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
    snapCameraToGrid(this);
    // Tweened things land on whole art pixels.
    this.events.on(Phaser.Scenes.Events.PRE_RENDER, () => {
      for (const o of this.locked) {
        o.x = snap(o.x);
        o.y = snap(o.y);
      }
    });
    this.unsub = bus.on((events) => this.onEvents(events));
    const done = () => {
      this.unsub?.();
      this.texts.destroy();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, done);
    this.events.once(Phaser.Scenes.Events.DESTROY, done);
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
    const card = this.texts.add(t('battle.worldLabel', { n: world, name }), WORLD_CARD).setDepth(48);
    this.worldCard = card;
    const y = 14 * P;
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
      ...(head ? [renderText(head, { face: 'big', fill: NOTICE.head, ink: null })] : []),
      renderText(rest, { face: 'small', fill: TEXT_INK, ink: null, maxW: TEXT_MAX_W - 8 }),
    ];
    const plate = renderPlate(parts, NOTICE.bg);
    const key = `notice_${this.noticeN++}`;
    this.textures.addCanvas(key, toCanvas(plate, 1));
    const img = this.add.image(0, 0, key).setOrigin(0, 0).setScale(P).setDepth(55);
    img.once(Phaser.GameObjects.Events.DESTROY, () => this.time.delayedCall(0, () => this.textures.exists(key) && this.textures.remove(key)));
    this.notice = img;
    const x = snap(BATTLE_W / 2 - (plate.w * P) / 2);
    const y = 23 * P;
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

  private drawGear(g: GameState) {
    const id = (s: (typeof SLOTS)[number]) => g.equipped[s]?.baseId ?? null;
    heroTex(this, { jacket: id('jacket'), gloves: id('gloves'), sneakers: id('sneakers'), bling: id('bling') });
    this.gearBack.removeAll(true);
    this.gearFront.removeAll(true);
    this.heroTop = HERO.top;
    // Front order, back to front: shield, mask, hat.
    for (const slot of ['backpack', 'shield', 'mask', 'hat'] as const) {
      const base = id(slot);
      if (!base || !(SPRITE_SLOTS as readonly string[]).includes(slot)) continue;
      const i = gearTex(this, slot, base);
      if (!i) continue;
      (i.behind ? this.gearBack : this.gearFront).add(this.add.image(0, 0, i.key).setOrigin(i.ox, i.oy));
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
      const it = g.equipped[s];
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
    this.glints.burst(1, x, y, { speedX: [-12, 12], speedY: [-70, -35], life: [500, 900], colors: [0xffffff], fade: [c, c], alpha: [1, 1, 0.6] });
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
    const u = easeOutBack((k - b) / (1 - b));
    return { angle: lerp(STRIKE, REST, u), dx: lerp(7 * P, 0, u), frame: u < 0.5 ? FRAME.dash : FRAME.stand };
  }

  private swingMs(): number {
    const spd = Math.max(0.2, computeStats(gameStore.getState().game).ATK_SPD);
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
   * Pop-up number: flashes white for its first frames, floats up by whole art pixels (fast, then
   * slowing) and steps out.
   */
  private number(x: number, y: number, text: string, opts: { big?: boolean; fill?: string | readonly string[]; life?: number } = {}) {
    const life = opts.life ?? 800;
    const tx = this.texts.add(text, { face: opts.big ? 'big' : 'small', fill: opts.fill ?? '#ffffff' }).setDepth(45);
    const cx = this.clampX(x + Phaser.Math.Between(-2, 2) * P, tx.artW * P);
    tx.place(cx, y);
    if (!this.reduceFlashing) {
      tx.setFlash(true);
      this.time.delayedCall(60, () => tx.active && tx.setFlash(false));
    }
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: life,
      onUpdate: (tw) => {
        if (!tx.active) return;
        const k = tw.getValue() ?? 0;
        tx.place(cx, y - Math.round(easeOutCubic(k) * 12) * P);
        tx.setAlpha(k < 0.55 ? 1 : stepsDown((k - 0.55) / 0.45));
      },
      onComplete: () => tx.destroy(),
    });
  }

  /**
   * A stamped word (CRIT!, K.O., a boss's special): slams down three art pixels in white, shakes a
   * pixel, holds, then rises and steps out.
   */
  private stamp(x: number, y0: number, text: string, color: string) {
    const tx = this.texts.add(text, { face: 'big', fill: litTop(color), shadow: true, maxW: TEXT_MAX_W }).setDepth(46);
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
  private banner(text: string, grad: readonly [string, string], y = FEET_Y - 30 * P) {
    const style: TextStyle = { face: 'big', fill: bands(grad), shadow: true, maxW: TEXT_MAX_W };
    const main = this.texts.add(text, style).setDepth(50);
    const w = main.artW * P;
    const mid = BATTLE_W / 2;
    const start = -w;
    const smears = this.reduceMotion ? [] : [0.25, 0.45].map((a) => this.texts.add(text, style).setDepth(49.5).setAlpha(a));
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

  /** Shakes the view by whole art pixels for `duration` ms (intensity as a share of the view's width, like Phaser's). */
  private shake(duration: number, intensity: number) {
    if (this.reduceMotion) return;
    this.shakeT = Math.max(this.shakeT, duration / 1000);
    this.shakeAmp = Math.max(this.shakeAmp, Phaser.Math.Clamp(Math.round((intensity * BATTLE_W) / P), 1, VIEW_MARGIN));
  }

  private updateShake(dt: number) {
    const cam = this.cameras.main;
    if (this.shakeT <= 0) {
      this.shakeAmp = 0;
      if (cam.scrollX !== 0 || cam.scrollY !== 0) cam.setScroll(0, 0);
      return;
    }
    this.shakeT -= dt;
    this.shakeNext -= dt;
    if (this.shakeNext > 0) return;
    this.shakeNext = 0.03;
    const a = this.shakeAmp;
    // Sideways both ways, but only down (the art reaches past the top and sides, not the bottom).
    cam.setScroll(Phaser.Math.Between(-a, a) * P, -Phaser.Math.Between(0, a) * P);
  }

  private hitStop(ms: number) {
    if (this.reduceMotion) return;
    this.tweens.timeScale = 0.04;
    this.anims.globalTimeScale = 0.04;
    setTimeout(() => {
      if (!this.sys.isActive()) return;
      this.tweens.timeScale = 1;
      this.anims.globalTimeScale = 1;
    }, ms);
  }

  private flash(img: Phaser.GameObjects.Sprite, color: number, ms: number) {
    if (this.reduceFlashing) return;
    img.setTintFill(color);
    this.time.delayedCall(ms, () => img.active && img.clearTint());
  }

  private foeHitPoint(f: Foe): { x: number; y: number } {
    return { x: f.c.x - f.front * 0.45, y: FEET_Y - f.height * 0.5 };
  }

  /** Where a pop-up number over foe `f` starts: no lower than just over its HP bar, so the bar stays readable. */
  private overFoe(f: Foe, y: number): number {
    return f.kind === 'regular' ? Math.min(y, FEET_Y + f.barY - 5 * P) : y;
  }

  /** The same over the hero's bar (its heart stands a pixel taller than the bar). */
  private overHero(y: number): number {
    return Math.min(y, FEET_Y - snap(this.heroTop) - (BAR_GAP + BAR_TALL + 1 + 5) * P);
  }

  /** The blow lands: pack hit effect, sparks, number, knockback, maybe a kill. */
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
    f.knockV += s.crit ? 900 : 560;
    this.foeAct(f, 'hurt');
    f.shownHp = Math.max(0, f.shownHp - s.amount);
    if (s.crit) {
      this.bits.burst(12, p.x, p.y, BIG_SPARK);
      this.number(p.x, this.overFoe(f, p.y - 7 * P), formatNumber(s.amount), { big: true, fill: bands(['#fff6a8', '#ff9a1a']), life: 950 });
      this.stamp(p.x + P, p.y - 16 * P, t('battle.crit'), '#FFD54F');
      this.shake(110, 0.006);
      this.hitStop(70);
    } else {
      this.bits.burst(6, p.x, p.y, SPARK);
      this.number(p.x, this.overFoe(f, p.y - 6 * P), formatNumber(s.amount), { fill: s.echo ? '#e2ccff' : '#ffffff' });
    }
    for (const r of s.riders) r();
    if (s.killed || this.kills.has(f.uid)) this.die(f);
  }

  private die(f: Foe) {
    if (f.dying) return;
    f.dying = true;
    f.bar.setVisible(false);
    const info = this.kills.get(f.uid);
    this.kills.delete(f.uid);
    const p = this.foeHitPoint(f);
    this.dust.burst(info && info.kind !== 'regular' ? 10 : 5, p.x, FEET_Y - P, DUST);
    const coins = info ? (info.kind === 'boss' ? 16 : info.kind === 'miniboss' ? 9 : 3) : 2;
    this.coinBurst(p.x, p.y, coins);
    if (info && info.kind !== 'regular') {
      this.shake(320, 0.014);
      this.confetti.burst(40, p.x, p.y, CONFETTI);
      this.fx('boom', p.x, p.y, { depth: 35 });
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

  /** Coins pop out, bounce once, then fly up to the gold counter, turning (frame by frame) all the way. */
  private coinBurst(x: number, y: number, n: number) {
    const coin = coinTex(this);
    for (let i = 0; i < n && this.coinsFlying < 50; i++) {
      this.coinsFlying++;
      const c = this.gridLock(
        this.add.sprite(x, y, coin.key, String(i % 4)).setOrigin(coin.cx / (coin.w / P), coin.cy / (coin.h / P)).setScale(P).setDepth(36),
      );
      c.play({ key: `${coin.key}:spin`, startFrame: i % 4 });
      const vx = Phaser.Math.Between(-260, 260);
      const landX = x + vx * 0.45;
      const peak = y - Phaser.Math.Between(9, 19) * P;
      this.tweens.chain({
        targets: c,
        tweens: [
          { x: landX, duration: 420, ease: 'Linear' },
          { x: COIN_TARGET.x, y: COIN_TARGET.y, duration: 420 + i * 35, ease: 'Cubic.easeIn' },
        ],
        onComplete: () => {
          c.destroy();
          this.coinsFlying--;
        },
      });
      this.tweens.add({ targets: c, y: peak, duration: 200, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: c, y: FEET_Y - P, delay: 200, duration: 220, ease: 'Bounce.easeOut' });
    }
  }

  private bagBurst(count: number) {
    const from = { x: ENGAGE_EDGE + 9 * P, y: FEET_Y - 13 * P };
    for (let i = 0; i < Math.min(count, 6); i++) {
      const o = texOrigin('fx_bag');
      const bag = this.gridLock(this.add.image(from.x + i * 3 * P, from.y, 'fx_bag').setOrigin(o.x, o.y).setDepth(36));
      this.tweens.add({ targets: bag, y: from.y - 13 * P, duration: 260, ease: 'Back.easeOut', delay: i * 70 });
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

  private heroHurt(amount: number, heavy: boolean) {
    this.flashHero(0xff8a8a, 110);
    if (!this.dead && this.mode !== 'swing') {
      this.mode = 'hurt';
      this.poseT = heavy ? 0.34 : 0.22;
    }
    if (amount >= this.maxHp(gameStore.getState().game)) {
      // Way out of its league: make it obvious.
      this.stamp(this.hero.x + 3 * P, FEET_Y - 30 * P, t('battle.oneShot'), '#FF5A5A');
      this.shake(320, 0.02);
      this.fx('hit', this.hero.x + 2 * P, FEET_Y - 8 * P, { depth: 34, flipX: true });
    }
    this.heroKnock = this.reduceMotion ? 0 : heavy ? -4 * P : -2 * P;
    const p = { x: this.hero.x + P, y: FEET_Y - 9 * P };
    if (heavy) {
      this.fx('hit', p.x + 3 * P, p.y, { depth: 34, flipX: true });
      this.shake(220, 0.012);
    }
    this.number(p.x - 3 * P, this.overHero(p.y - 6 * P), `-${formatNumber(amount)}`, { big: heavy, fill: '#ff8a80' });
  }

  /** Plays a foe's one-shot animation (attack / hurt) if it has one, then its base loop again. */
  private foeAct(f: Foe, anim: 'attack' | 'hurt') {
    if (f.dying || !f.tex.anims.has(anim)) return;
    f.acting = true;
    f.spr.play(`${f.tex.key}:${anim}`);
    f.spr.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      f.acting = false;
      if (!f.dying && f.spr.active) f.spr.play(`${f.tex.key}:idle`);
    });
  }

  private lungeAt(f: Foe, contact: () => void, heavy: boolean) {
    this.foeAct(f, 'attack');
    if (this.reduceMotion) {
      contact();
      return;
    }
    const dist = heavy ? 10 * P : 6 * P;
    this.tweens.chain({
      targets: f,
      tweens: [
        { lunge: 14, duration: 90, ease: 'Quad.easeOut' },
        { lunge: -dist, duration: 80, ease: 'Quad.easeIn', onComplete: contact },
        { lunge: 0, duration: 200, ease: 'Back.easeOut' },
      ],
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

  private cheer(seconds: number) {
    if (this.dead || this.mode === 'swing') return;
    this.mode = 'cheer';
    this.poseT = seconds;
  }

  private onEvents(events: CoreEvent[]) {
    if (!this.sys.isActive()) return;
    // Kills arrive with the blow that caused them; remember them so the death plays when the blow lands.
    for (const e of events) if (e.type === 'kill') this.kills.set(e.enemyUid, { kind: e.kind, coins: e.coins });
    let lastSwing: Swing | null = null;
    for (const e of events) {
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
            b.knockV += 300;
            this.number(pb.x, this.overFoe(b, pb.y - 5 * P), formatNumber(e.amount), { fill: '#ffe14a' });
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
              b.knockV += 500;
              this.number(pb.x, this.overFoe(b, pb.y - 5 * P), formatNumber(e.amount), { fill: '#ffab70' });
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
          this.number(p.x + 3 * P, this.overFoe(f, p.y - 3 * P), formatNumber(e.amount), { fill: '#ff9e5e', life: 600 });
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
            this.number(p.x, this.overFoe(f, p.y - 4 * P), formatNumber(e.amount), { fill: '#9cff8a' });
            if (this.kills.has(f.uid) && f.pending === 0) this.die(f);
          });
          break;
        }
        case 'playerDodge': {
          const f = this.foes.get(e.enemyUid);
          const dodge = () => {
            this.heroKnock = this.reduceMotion ? 0 : -5 * P;
            this.number(this.hero.x, this.overHero(FEET_Y - 26 * P), t('battle.dodge'), { fill: '#7fe9ff' });
          };
          if (f) this.lungeAt(f, dodge, false);
          else dodge();
          break;
        }
        case 'heal':
          if (e.source === 'lifesteal') this.healAcc += e.amount;
          else {
            this.number(this.hero.x - 4 * P, this.overHero(FEET_Y - 25 * P), `+${formatNumber(e.amount)}`, { fill: '#7ef08f' });
            this.fx('sparkle', this.hero.x, FEET_Y - 8 * P, { depth: 34, tint: 0x9dff9a });
          }
          break;
        case 'bossSpecial': {
          const f = this.foes.get(e.enemyUid);
          if (f) this.stamp(f.c.x - f.front * 0.3, FEET_Y - f.height - 4 * P, `${e.name}!`, '#FF9800');
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
          const g = gameStore.getState().game;
          const boss = g.battle.enemies.some((x) => x.kind !== 'regular');
          if (boss) this.time.delayedCall(700, () => this.banner(t('battle.bossIncoming'), ['#ffd0c0', '#ff4d3d']));
          else if (e.wave === 0) this.time.delayedCall(700, () => this.banner(t('battle.fight'), GOLD));
          break;
        }
        case 'worldFirstClear':
          this.banner(t('battle.worldCleared'), GOLD, FEET_Y - 34 * P);
          this.confetti.burst(72, BATTLE_W / 2, FEET_Y - 34 * P, CONFETTI);
          this.cheer(1.6);
          break;
        case 'bossWin':
          if (!events.some((x) => x.type === 'worldFirstClear')) this.confetti.burst(20, BATTLE_W / 2 + 13 * P, FEET_Y - 29 * P, CONFETTI);
          this.cheer(1.2);
          break;
        case 'levelUp': {
          if (!this.fx('levelUp', this.hero.x, FEET_Y - 8 * P, { depth: 33 })) {
            this.still('fx_puff', this.hero.x, FEET_Y - 14 * P, { depth: 33, tint: 0xffe14a, ms: 700 });
          }
          this.bits.burst(14, this.hero.x, FEET_Y - 16 * P, BIG_SPARK);
          this.number(this.hero.x, this.overHero(FEET_Y - 32 * P), t('battle.levelUp'), { big: true, fill: bands(GOLD), life: 1100 });
          this.cheer(1);
          break;
        }
        case 'equip': {
          const c = rarityColorNum(e.item.rarity);
          const epic = rarityAtLeast(e.item.rarity, 'epic');
          this.bits.burst(epic ? 14 : 6, this.hero.x, FEET_Y - 16 * P, { ...SPARK, colors: [0xffffff, c], fade: [c] });
          if (epic) {
            this.fx('sparkle', this.hero.x, FEET_Y - 9 * P, { depth: 34 });
            this.cheer(0.8);
          }
          break;
        }
        case 'luckBoost':
          this.bits.burst(20, this.hero.x, FEET_Y - 12 * P, { ...FLAME, colors: [0xd8ffd0, 0x8dff8a], fade: [0x46d36b, 0x2fb150] });
          this.fx('sparkle', this.hero.x, FEET_Y - 9 * P, { depth: 34, tint: 0x8dff8a });
          this.number(this.hero.x, this.overHero(FEET_Y - 33 * P), t('battle.luckUp', { mult: BAL.luck.potion.mult }), {
            big: true, fill: bands(['#d8ffd0', '#2fb150']), life: 1200,
          });
          break;
        case 'playerDeath':
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
    this.kills.clear();
    this.swingQueue = [];
  }

  private maxHp(g: GameState): number {
    if (this.hpCache.key !== g.equipped || this.hpCache.hp <= 0) this.hpCache = { key: g.equipped, hp: computeStats(g).HP };
    return this.hpCache.hp;
  }

  /** Hero pose for this frame: hop while walking, short poses, idle loop. */
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
      // Let the wake-up play out before hopping or idling.
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
    if (walking && !this.reduceMotion) {
      // Hops along: crouch, stretch up into the air, land.
      this.mode = 'walk';
      const before = this.walkT;
      this.walkT += dt * 9;
      const s = Math.abs(Math.sin(this.walkT));
      this.rig.y = -Math.round(s * 2.4) * P;
      this.heroFrame(s < 0.3 ? FRAME.squash : s > 0.7 ? FRAME.up : FRAME.stand);
      if (Math.floor(this.walkT / Math.PI) !== Math.floor(before / Math.PI)) this.dust.burst(2, this.hero.x - 3 * P, FEET_Y - P, DUST);
      return;
    }
    this.mode = 'idle';
    this.rig.y = 0;
    this.heroAnim('idle');
  }

  update(time: number, deltaMs: number) {
    const dt = Math.min(0.05, deltaMs / 1000);
    const g = gameStore.getState().game;
    const b = g.battle;
    const walking = b.phase === 'walking' && !this.dead;

    // Parallax while walking (each layer drawn at whole art pixels); clouds always drift.
    const speed = walking ? 330 : 0;
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

    const sig = SLOTS.map((s) => `${g.equipped[s]?.uid ?? 0}`).join(',');
    if (sig !== this.gearSig) {
      this.gearSig = sig;
      this.drawGear(g);
    }

    // Hero: hops along, closes in to fight, and stays put (idling) while the player picks a world after a boss.
    const targetX = b.phase === 'fighting' || b.phase === 'choice' ? HERO_FIGHT_X : HERO_WALK_X;
    this.heroX += (targetX - this.heroX) * (1 - Math.pow(0.001, dt));
    this.heroKnock += (0 - this.heroKnock) * (1 - Math.pow(0.0005, dt));
    this.hero.x = snap(this.heroX + this.heroDx + this.heroKnock);
    this.animateHero(walking, dt);
    this.followBody();
    this.updateAura(dt);
    void time;

    this.syncFoes(g, dt);
    if (this.releaseLater) this.releaseLater = releaseWorlds(this, this.worldShown, this.foeTextures()) > 0;

    // Lifesteal heals are batched into one number.
    this.healTimer -= dt;
    if (this.healAcc >= 1 && this.healTimer <= 0) {
      this.number(this.hero.x - 5 * P, this.overHero(FEET_Y - 25 * P), `+${formatNumber(this.healAcc)}`, { fill: '#7ef08f', life: 600 });
      this.healAcc = 0;
      this.healTimer = 0.5;
    }

    // "Too tough!" when the raccoon has just been beaten back (not while it stays up).
    const hint = g.stage.showToughHint;
    if (hint && !this.hintWas) this.showToughNotice();
    this.hintWas = hint;

    for (const bits of [this.bits, this.dust, this.confetti, this.glints]) bits.update(dt);
    this.updateShake(dt);
    this.updateHeroBar(g, dt);
    this.updateBossBar(g, dt);
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
