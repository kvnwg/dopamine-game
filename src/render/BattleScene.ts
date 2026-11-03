/**
 * The battle view (Phaser). Reads GameState every frame and choreographs core events:
 * the raccoon hops along, closes in, winds up and dashes into a swing (pack hit effects, hit-stop
 * on crits, knockback), enemies walk in, attack, flinch and fall with their own animations, HP
 * bars sit under every fighter, and coins arc up to the gold counter. Combat results always come
 * from core; this file only animates them.
 *
 * Everything is drawn on one pixel grid (P screen pixels per art pixel): Kevin's raccoon, the pack
 * characters, the backdrops and the effects. Nothing is scaled or squashed; motion is position,
 * frames and (for weapon swings and knock-outs) rotation.
 */
import Phaser from 'phaser';
import { BAL, SLOTS, type Rarity } from '../data';
import { computeStats, formatNumber, rarityAtLeast, worldDef, type CoreEvent, type GameState } from '../core';
import { bus } from '../app/eventBus';
import { gameStore } from '../app/store';
import { t } from '../ui/i18n';
import { rarityColorNum } from './art';
import {
  HERO, WEAPON_TILT, enemyTex, fxTex, gearTex, generateTextures, heroFrameOffset, heroTex, releaseWorlds, texSize, weaponTex,
  worldTextures, type FoeTex, type WorldKeys,
} from './textures';
import { P } from './pixel';
import { SPRITE_SLOTS } from './pixel/hero';
import { FEET_ROW } from './pixel/sceneryTypes';
import type { FxName } from './pixel/packs/fx';
import { layerY, scenerySet, scroll0, worldArt, worldSeed } from './worldLook';
import { Ambience } from './ambience';
import type { LayerName } from './pixel/sceneryTypes';

export const BATTLE_W = 1080;
export const BATTLE_H = 820;
/** The ground line: the bottom edge of the view row fighters stand on. */
const FEET_Y = (FEET_ROW + 1) * P;
const HERO_WALK_X = 300;
const HERO_FIGHT_X = 336;
/** Where the front enemy's leading edge stands while fighting. */
const ENGAGE_EDGE = 456;
const COIN_TARGET = { x: 694, y: 58 };
/** Top of the boss HP bar: just under the HUD row. */
const BOSS_BAR_Y = 176;
/** Fighters' HP bars: how far under the feet, and how tall (slim, so a row of foes reads cleanly). */
const BAR_DY = 16;
const BAR_H = 12;
const BAG_TARGET = { x: 190, y: BATTLE_H + 220 };
const FONT = '"Dumpster Digits", "Pixelify Sans", "Courier New", monospace';
const INK = '#1A1326';
const INK_N = 0x1a1326;
/** Weapon angles in degrees (0 = pointing up, clockwise positive). */
const REST = WEAPON_TILT;
const WIND = -100;
const STRIKE = 128;
/** The weapon paw relative to the hero's feet, in the reference pose. */
const HAND = { x: HERO.hand.x - HERO.feet.x, y: HERO.hand.y - HERO.feet.y };
/** Hero sheet frames used directly (see tools/packs/chars.py): standing, crouched, stretched up, arms out, blushing, dash. */
const FRAME = { stand: 0, up: 2, squash: 4, armsOut: 13, blush: 14, dash: 15 } as const;

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
  bar: Phaser.GameObjects.Graphics;
  num: Phaser.GameObjects.Text;
  front: number;
  back: number;
  height: number;
  x: number;
  lunge: number;
  knock: number;
  knockV: number;
  shownHp: number;
  ghostHp: number;
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

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeOutQuad = (k: number) => 1 - (1 - k) * (1 - k);
const easeInQuad = (k: number) => k * k;
const easeOutBack = (k: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};
/** Snaps a screen offset to the pixel grid. */
const snap = (v: number) => Math.round(v / P) * P;

export class BattleScene extends Phaser.Scene {
  private sky!: Phaser.GameObjects.Image;
  private cover!: Phaser.GameObjects.Rectangle;
  private worldShown = 0;
  private far!: Phaser.GameObjects.TileSprite;
  private mid!: Phaser.GameObjects.TileSprite;
  private ground!: Phaser.GameObjects.TileSprite;
  private fg!: Phaser.GameObjects.TileSprite;
  /** Cloud strips, back to front, and their drift in art pixels per second. */
  private clouds: Array<{ ts: Phaser.GameObjects.TileSprite; speed: number }> = [];
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
  private aura!: Phaser.GameObjects.Graphics;
  private heroBar!: Phaser.GameObjects.Graphics;
  private heroNum!: Phaser.GameObjects.Text;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossName!: Phaser.GameObjects.Text;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bigSparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private flames!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
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
  private shownHeroHp = 0;
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
    generateTextures(this, BATTLE_W, BATTLE_H);
    this.buildBackground();
    this.buildHero();
    this.buildEffects();
    this.heroBar = this.add.graphics().setDepth(40);
    this.heroNum = this.label(0, 0, 20).setDepth(41);
    this.bossBar = this.add.graphics().setDepth(40);
    // Boss name and HP bar sit right under the HUD (the sky below the HUD is otherwise clear).
    this.bossName = this.label(BATTLE_W / 2, BOSS_BAR_Y - 6, 32).setOrigin(0.5, 1).setDepth(41);
    this.cover = this.add.rectangle(0, 0, BATTLE_W, BATTLE_H, 0xffffff, 1).setOrigin(0, 0).setDepth(60).setAlpha(0);
    this.shownHeroHp = gameStore.getState().game.battle.playerHp;
    this.unsub = bus.on((events) => this.onEvents(events));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsub?.());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.unsub?.());
    // Canvas text doesn't make the browser fetch a font limited to a few characters (the 2 and 5 of
    // Dumpster Digits), so ask for both weights before redrawing the labels.
    const fonts = document.fonts;
    void Promise.all(
      fonts ? ['500 20px "Dumpster Digits"', '700 20px "Dumpster Digits"'].map((f) => fonts.load(f, '25').catch(() => [])) : [],
    )
      .then(() => fonts?.ready)
      .then(() => {
        if (!this.sys.isActive()) return;
        for (const tx of [this.heroNum, this.bossName]) tx.setFontFamily(FONT);
      });
  }

  private label(x: number, y: number, size: number): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, '', { fontFamily: FONT, fontSize: `${size}px`, color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke(INK, Math.max(5, size / 4.5));
  }

  // ------------------------------------------------------------------ scenery
  private buildBackground() {
    const world = gameStore.getState().game.battle.stage;
    const k = worldTextures(this, world);
    this.worldShown = world;
    // Back to front: sky (0), stars (0.5), clouds (1), the sun or moon and its halo (1.5), lightning
    // (1.7), the far, mid and ground layers (2 to 4, torches 2.5), particles behind the fighters (5),
    // fighters, the foreground (30), particles in front (31), the vignette (32), effects and UI.
    this.sky = this.add.image(0, 0, k.sky).setOrigin(0, 0).setScale(P).setDepth(0);
    for (let i = 0; i < 2; i++) {
      const ts = this.add.tileSprite(0, 0, BATTLE_W, P, '__DEFAULT').setOrigin(0, 0).setDepth(1 + i * 0.1).setVisible(false);
      this.clouds.push({ ts, speed: 0 });
    }
    this.glow = this.add.image(0, 0, '__DEFAULT').setOrigin(0, 0).setScale(P).setDepth(1.5).setVisible(false);
    this.far = this.add.tileSprite(0, 0, BATTLE_W, texSize(k.far).h, k.far).setOrigin(0, 0).setDepth(2);
    this.mid = this.add.tileSprite(0, 0, BATTLE_W, texSize(k.mid).h, k.mid).setOrigin(0, 0).setDepth(3);
    this.ground = this.add.tileSprite(0, 0, BATTLE_W, texSize(k.ground).h, k.ground).setOrigin(0, 0).setDepth(4);
    this.fg = this.add.tileSprite(0, 0, BATTLE_W, texSize(k.fg).h, k.fg).setOrigin(0, 0).setDepth(30);
    this.vignette = this.add.image(0, 0, k.vignette).setOrigin(0, 0).setScale(P).setDepth(32);
    this.ambience = new Ambience(this, { stars: 0.5, bolt: 1.7, torch: 2.5, back: 5, front: 31, flash: 31.5 });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.ambience.destroy());
    this.placeLayers(world, k, true);
  }

  private layer(name: LayerName): Phaser.GameObjects.TileSprite {
    return { far: this.far, mid: this.mid, ground: this.ground, fg: this.fg }[name];
  }

  /** Puts each layer, the clouds and the sun or moon at the world's placement; `reset` restarts the scroll. */
  private placeLayers(world: number, keys: WorldKeys, reset: boolean) {
    const set = scenerySet(worldDef(world));
    const y = layerY(set);
    const s0 = scroll0(set);
    for (const name of ['far', 'mid', 'ground', 'fg'] as const) {
      const ts = this.layer(name);
      // (A tile sprite's own texture key is internal; the size comes from the world's layer texture.)
      ts.setPosition(0, y[name]);
      ts.setSize(BATTLE_W, texSize(keys[name]).h);
      if (reset) ts.tilePositionX = s0[name];
    }
    this.clouds.forEach((c, i) => {
      const strip = keys.clouds[i];
      c.ts.setVisible(!!strip);
      // (Hidden layers drop the last world's texture, which is about to be freed.)
      if (!strip) {
        c.ts.setTexture('__DEFAULT');
        return;
      }
      c.ts.setTexture(strip.key).setPosition(0, strip.y * P).setSize(BATTLE_W, texSize(strip.key).h);
      c.speed = strip.speed;
    });
    if (keys.glow) this.glow.setTexture(keys.glow.key).setPosition(keys.glow.x * P, keys.glow.y * P).setVisible(true);
    else this.glow.setTexture('__DEFAULT').setVisible(false);
    this.vignette.setTexture(keys.vignette);
    const art = worldArt(world);
    this.ambience.setWorld({ atmo: art.atmo, seed: worldSeed(world), sky: set.sky, flicker: art.flicker, layerY: y, tileW: set.tileW });
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
    this.far.setTexture(k.far);
    this.mid.setTexture(k.mid);
    this.ground.setTexture(k.ground);
    this.fg.setTexture(k.fg);
    this.placeLayers(world, k, scenerySet(worldDef(world)) !== before);
    this.releaseLater = releaseWorlds(this, world, this.foeTextures()) > 0;
    this.tweens.killTweensOf(this.cover);
    if (this.reduceMotion || this.reduceFlashing) {
      this.cover.setAlpha(0);
      return;
    }
    const sky = worldDef(world).look.atmo.sky;
    this.cover.setFillStyle(Phaser.Display.Color.HexStringToColor(sky[sky.length - 1]).color, 1).setAlpha(1);
    this.tweens.add({ targets: this.cover, alpha: 0, duration: 450, ease: 'Quad.easeOut' });
  }

  // ------------------------------------------------------------------ hero
  private buildHero() {
    const body = heroTex(this);
    this.hero = this.add.container(HERO_WALK_X, FEET_Y).setDepth(20);
    const shadow = this.add.ellipse(0, 2, 13 * P, 2 * P, INK_N, 0.18);
    this.aura = this.add.graphics();
    this.rig = this.add.container(0, 0);
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
    // Front order, back to front: shield, mask, hat.
    for (const slot of ['backpack', 'shield', 'mask', 'hat'] as const) {
      const base = id(slot);
      if (!base || !(SPRITE_SLOTS as readonly string[]).includes(slot)) continue;
      const i = gearTex(this, slot, base);
      if (!i) continue;
      (i.behind ? this.gearBack : this.gearFront).add(this.add.image(0, 0, i.key).setOrigin(i.ox, i.oy));
    }
    const w = weaponTex(this, id('weapon'));
    this.weapon.setTexture(w.key).setOrigin(w.ox, w.oy);
    this.weaponTilt = w.tilt;
    this.aimWeapon(REST);
    // A soft aura for Legendary-or-better gear.
    let best: Rarity | null = null;
    for (const s of SLOTS) {
      const it = g.equipped[s];
      if (it && rarityAtLeast(it.rarity, 'legendary') && (!best || rarityAtLeast(it.rarity, best))) best = it.rarity;
    }
    this.aura.clear();
    this.tweens.killTweensOf(this.aura);
    if (best) {
      for (let r = 150; r > 40; r -= 22) {
        this.aura.fillStyle(rarityColorNum(best), 0.06);
        this.aura.fillEllipse(0, -96, r * 1.4, r * 1.8);
      }
      this.aura.setAlpha(0.6);
      this.tweens.add({ targets: this.aura, alpha: 1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
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
      return { angle: lerp(REST, WIND, u), dx: lerp(0, -18, u), frame: FRAME.armsOut };
    }
    if (k < b) {
      const u = easeInQuad((k - a) / (b - a));
      return { angle: lerp(WIND, STRIKE, u), dx: lerp(-18, 62, u), frame: FRAME.dash };
    }
    const u = easeOutBack((k - b) / (1 - b));
    return { angle: lerp(STRIKE, REST, u), dx: lerp(62, 0, u), frame: u < 0.5 ? FRAME.dash : FRAME.stand };
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
    this.sparks = this.add
      .particles(0, 0, 'px_spark', {
        emitting: false, lifespan: { min: 200, max: 360 }, speed: { min: 240, max: 520 }, scale: { start: 1, end: 0.34 },
        maxAliveParticles: 60,
      })
      .setDepth(34);
    this.bigSparks = this.add
      .particles(0, 0, 'px_spark', {
        emitting: false, lifespan: { min: 380, max: 680 }, speed: { min: 360, max: 860 }, scale: { start: 1, end: 0.34 },
        tint: [0xffe14a, 0xffffff, 0xffb300], maxAliveParticles: 60,
      })
      .setDepth(34);
    this.dust = this.add
      .particles(0, 0, 'px_dust', {
        emitting: false, lifespan: { min: 360, max: 560 }, speed: { min: 40, max: 150 }, angle: { min: 180, max: 360 },
        alpha: { start: 0.85, end: 0 }, tint: 0xe8e0d0, maxAliveParticles: 30,
      })
      .setDepth(33);
    this.flames = this.add
      .particles(0, 0, 'px_spark', {
        emitting: false, lifespan: { min: 300, max: 520 }, speedY: { min: -220, max: -120 }, speedX: { min: -40, max: 40 },
        scale: { start: 1, end: 0.34 }, tint: [0xff7043, 0xffb300, 0xffe14a], maxAliveParticles: 50,
      })
      .setDepth(34);
    for (let k = 0; k < 4; k++) {
      this.confetti.push(
        this.add
          .particles(0, 0, `fx_conf${k}`, {
            emitting: false, lifespan: { min: 900, max: 1500 }, speed: { min: 320, max: 760 }, angle: { min: 200, max: 340 },
            gravityY: 900, rotate: { start: 0, end: 720 }, maxAliveParticles: 40,
          })
          .setDepth(35),
      );
    }
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

  /** Pop-up number: bounces in, floats up, fades. */
  private number(x: number, y: number, text: string, opts: { size?: number; color?: string; grad?: [string, string]; life?: number } = {}) {
    const size = opts.size ?? 52;
    const tx = this.add
      .text(x + Phaser.Math.Between(-22, 22), y, text, { fontFamily: FONT, fontSize: `${size}px`, color: opts.color ?? '#ffffff' })
      .setOrigin(0.5)
      .setDepth(45)
      .setStroke(INK, Math.max(7, size / 5.5))
      .setScale(0.3);
    if (opts.grad) {
      const g = tx.context.createLinearGradient(0, 0, 0, tx.height);
      g.addColorStop(0.15, opts.grad[0]);
      g.addColorStop(0.85, opts.grad[1]);
      tx.setFill(g);
    }
    this.tweens.add({ targets: tx, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: tx, y: y - 110, duration: opts.life ?? 800, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: tx, alpha: 0, delay: (opts.life ?? 800) * 0.55, duration: (opts.life ?? 800) * 0.45, onComplete: () => tx.destroy() });
  }

  private stamp(x: number, y: number, text: string, color: string, size = 44) {
    const tx = this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color })
      .setOrigin(0.5)
      .setDepth(46)
      .setStroke(INK, 10)
      .setAngle(-10)
      .setScale(2.2);
    this.tweens.add({ targets: tx, scale: 1, duration: 150, ease: 'Back.easeOut' });
    this.tweens.add({ targets: tx, alpha: 0, y: y - 30, delay: 420, duration: 240, onComplete: () => tx.destroy() });
  }

  /** Big title that sweeps in with a smear and sweeps out ("FIGHT!", "BOSS!", "VICTORY!"). */
  private banner(text: string, grad: [string, string], y = 420) {
    const make = (alpha: number) => {
      const tx = this.add
        .text(-300, y, text, { fontFamily: FONT, fontSize: '128px', color: '#ffffff' })
        .setOrigin(0.5)
        .setDepth(50)
        .setStroke(INK, 18)
        .setShadow(0, 10, INK, 0, true, false)
        .setAlpha(alpha)
        .setAngle(-6);
      const g = tx.context.createLinearGradient(0, 0, 0, tx.height);
      g.addColorStop(0.2, grad[0]);
      g.addColorStop(0.8, grad[1]);
      tx.setFill(g);
      return tx;
    };
    const smears = this.reduceMotion ? [] : [make(0.25), make(0.45)];
    const main = make(1);
    smears.forEach((s, i) => {
      this.tweens.add({ targets: s, x: BATTLE_W / 2 - 70 + i * 30, duration: 240, ease: 'Cubic.easeOut' });
      this.tweens.add({ targets: s, alpha: 0, delay: 200, duration: 160, onComplete: () => s.destroy() });
    });
    this.tweens.add({ targets: main, x: BATTLE_W / 2, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: main, scale: { from: 1.08, to: 1 }, delay: 260, duration: 220, ease: 'Sine.easeOut' });
    this.tweens.add({
      targets: main, x: BATTLE_W + 500, alpha: 0, delay: 900, duration: 260, ease: 'Cubic.easeIn',
      onComplete: () => main.destroy(),
    });
  }

  private shake(duration: number, intensity: number) {
    if (!this.reduceMotion) this.cameras.main.shake(duration, intensity);
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
      const star = this.add.image(p.x, p.y, 'fx_impact').setDepth(33);
      this.tweens.add({ targets: star, alpha: 0, delay: 90, duration: 150, onComplete: () => star.destroy() });
    }
    if (s.crit) this.fx('slash', p.x + 2 * P, p.y, { depth: 35 });
    this.flash(f.spr, 0xffffff, 60);
    f.knockV += s.crit ? 900 : 560;
    this.foeAct(f, 'hurt');
    f.shownHp = Math.max(0, f.shownHp - s.amount);
    if (s.crit) {
      this.bigSparks.explode(12, p.x, p.y);
      this.number(p.x, p.y - 70, formatNumber(s.amount), { size: 76, grad: ['#fff6a8', '#ff9a1a'], life: 950 });
      this.stamp(p.x + 10, p.y - 160, t('battle.crit'), '#FFD54F', 40);
      this.shake(110, 0.006);
      this.hitStop(70);
    } else {
      this.sparks.explode(6, p.x, p.y);
      this.number(p.x, p.y - 60, formatNumber(s.amount), { size: s.echo ? 44 : 54, color: s.echo ? '#e2ccff' : '#ffffff' });
    }
    for (const r of s.riders) r();
    if (s.killed || this.kills.has(f.uid)) this.die(f);
  }

  private die(f: Foe) {
    if (f.dying) return;
    f.dying = true;
    f.bar.clear();
    f.num.setVisible(false);
    const info = this.kills.get(f.uid);
    this.kills.delete(f.uid);
    const p = this.foeHitPoint(f);
    this.dust.explode(info && info.kind !== 'regular' ? 10 : 5, p.x, FEET_Y - P);
    const coins = info ? (info.kind === 'boss' ? 16 : info.kind === 'miniboss' ? 9 : 3) : 2;
    this.coinBurst(p.x, p.y, coins);
    if (info && info.kind !== 'regular') {
      this.shake(320, 0.014);
      this.confetti.forEach((em) => em.explode(10, p.x, p.y));
      this.fx('boom', p.x, p.y, { depth: 35 });
    }
    this.flash(f.spr, 0xffffff, 90);
    const remove = () => {
      f.c.destroy();
      f.num.destroy();
      this.foes.delete(f.uid);
    };
    this.tweens.killTweensOf(f.spr);
    if (f.tex.anims.has('death')) {
      // Its own death animation, then it fades into the ground.
      f.spr.play(`${f.tex.key}:death`);
      this.tweens.add({ targets: f.c, alpha: 0, delay: 650, duration: 380, onComplete: remove });
      return;
    }
    // Knocked out of the park.
    this.tweens.add({ targets: f.c, x: f.c.x + 700, y: f.c.y - 380, angle: 540, duration: 650, ease: 'Quad.easeOut', onComplete: remove });
  }

  /** Coins pop out, bounce once, then fly up to the gold counter. */
  private coinBurst(x: number, y: number, n: number) {
    for (let i = 0; i < n && this.coinsFlying < 50; i++) {
      this.coinsFlying++;
      const c = this.add.image(x, y, 'fx_coin').setDepth(36);
      const vx = Phaser.Math.Between(-260, 260);
      const landX = x + vx * 0.45;
      const peak = y - Phaser.Math.Between(90, 190);
      this.tweens.add({ targets: c, scaleX: { from: 1, to: 0.34 }, duration: 110, yoyo: true, repeat: 5, ease: 'Stepped', easeParams: [2] });
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
    const from = { x: ENGAGE_EDGE + 80, y: FEET_Y - 120 };
    for (let i = 0; i < Math.min(count, 6); i++) {
      const bag = this.add.image(from.x + i * 30, from.y, 'fx_bag').setDepth(36);
      this.tweens.add({ targets: bag, y: from.y - 120, duration: 260, ease: 'Back.easeOut', delay: i * 70 });
      this.tweens.add({
        targets: bag, x: BAG_TARGET.x, y: BAG_TARGET.y, angle: -40, duration: 520, ease: 'Cubic.easeIn',
        delay: 380 + i * 70, onComplete: () => bag.destroy(),
      });
    }
  }

  private lightning(a: { x: number; y: number }, b: { x: number; y: number }) {
    const g = this.add.graphics().setDepth(35);
    const pts: Phaser.Math.Vector2[] = [];
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const jitter = i === 0 || i === n ? 0 : Phaser.Math.Between(-2, 2) * P;
      pts.push(new Phaser.Math.Vector2(snap(lerp(a.x, b.x, k)), snap(lerp(a.y, b.y, k)) + jitter));
    }
    g.lineStyle(P * 2, INK_N, 1).strokePoints(pts);
    g.lineStyle(P, 0xffe14a, 1).strokePoints(pts);
    this.tweens.add({ targets: g, alpha: 0, duration: 220, delay: 60, onComplete: () => g.destroy() });
    this.fx('lightning', b.x, b.y, { depth: 35 });
  }

  private boom(x: number, y: number) {
    if (!this.fx('boom', x, y, { depth: 35 })) {
      const ring = this.add.image(x, y, 'fx_puff').setDepth(34).setTint(0xff8a3d);
      this.tweens.add({ targets: ring, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    }
    this.bigSparks.explode(8, x, y);
    this.flames.explode(8, x, y);
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
      this.stamp(this.hero.x + 30, FEET_Y - 300, t('battle.oneShot'), '#FF5A5A', 72);
      this.shake(320, 0.02);
      this.fx('hit', this.hero.x + 2 * P, FEET_Y - 8 * P, { depth: 34, flipX: true });
    }
    this.heroKnock = this.reduceMotion ? 0 : heavy ? -40 : -18;
    const p = { x: this.hero.x + 10, y: FEET_Y - 9 * P };
    if (heavy) {
      this.fx('hit', p.x + 3 * P, p.y, { depth: 34, flipX: true });
      this.shake(220, 0.012);
    }
    this.number(p.x - 30, p.y - 60, `-${formatNumber(amount)}`, { size: heavy ? 58 : 44, color: '#ff8a80' });
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
    const dist = heavy ? 90 : 56;
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
            const pa = a ? this.foeHitPoint(a) : { x: this.hero.x + 120, y: FEET_Y - 160 };
            const pb = this.foeHitPoint(b);
            this.lightning(pa, pb);
            this.flash(b.spr, 0xfff3a0, 70);
            b.shownHp = Math.max(0, b.shownHp - e.amount);
            b.knockV += 300;
            this.number(pb.x, pb.y - 50, formatNumber(e.amount), { size: 42, color: '#ffe14a' });
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
              this.number(pb.x, pb.y - 50, formatNumber(e.amount), { size: 46, color: '#ffab70' });
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
          this.flames.explode(6, p.x, p.y + 20);
          f.shownHp = Math.max(0, f.shownHp - e.amount);
          this.number(p.x + 30, p.y - 30, formatNumber(e.amount), { size: 34, color: '#ff9e5e', life: 600 });
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
            this.sparks.explode(5, p.x, p.y);
            f.shownHp = Math.max(0, f.shownHp - e.amount);
            this.number(p.x, p.y - 40, formatNumber(e.amount), { size: 36, color: '#9cff8a' });
            if (this.kills.has(f.uid) && f.pending === 0) this.die(f);
          });
          break;
        }
        case 'playerDodge': {
          const f = this.foes.get(e.enemyUid);
          const dodge = () => {
            this.heroKnock = this.reduceMotion ? 0 : -46;
            this.number(this.hero.x, FEET_Y - 260, t('battle.dodge'), { size: 40, color: '#7fe9ff' });
          };
          if (f) this.lungeAt(f, dodge, false);
          else dodge();
          break;
        }
        case 'heal':
          if (e.source === 'lifesteal') this.healAcc += e.amount;
          else {
            this.number(this.hero.x - 40, FEET_Y - 250, `+${formatNumber(e.amount)}`, { size: 38, color: '#7ef08f' });
            this.fx('sparkle', this.hero.x, FEET_Y - 8 * P, { depth: 34, tint: 0x9dff9a });
          }
          break;
        case 'bossSpecial': {
          const f = this.foes.get(e.enemyUid);
          if (f) this.stamp(f.c.x - f.front * 0.3, FEET_Y - f.height - 40, `${e.name}!`, '#FF9800', 46);
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
          else if (e.wave === 0) this.time.delayedCall(700, () => this.banner(t('battle.fight'), ['#fff6a8', '#ffa21a']));
          break;
        }
        case 'worldFirstClear':
          this.banner(t('battle.worldCleared'), ['#fff6a8', '#ffa21a'], 400);
          this.confetti.forEach((em) => em.explode(18, BATTLE_W / 2, 300));
          this.cheer(1.6);
          break;
        case 'bossWin':
          if (!events.some((x) => x.type === 'worldFirstClear')) this.confetti.forEach((em) => em.explode(5, BATTLE_W / 2 + 120, 420));
          this.cheer(1.2);
          break;
        case 'levelUp': {
          if (!this.fx('levelUp', this.hero.x, FEET_Y - 8 * P, { depth: 33 })) {
            const ring = this.add.image(this.hero.x, FEET_Y - 140, 'fx_puff').setDepth(33).setTint(0xffe14a);
            this.tweens.add({ targets: ring, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
          }
          this.bigSparks.explode(14, this.hero.x, FEET_Y - 160);
          this.number(this.hero.x, FEET_Y - 320, t('battle.levelUp'), { size: 54, grad: ['#fff6a8', '#ffa21a'], life: 1100 });
          this.cheer(1);
          break;
        }
        case 'equip': {
          const c = rarityColorNum(e.item.rarity);
          this.sparks.setParticleTint(c);
          this.sparks.explode(rarityAtLeast(e.item.rarity, 'epic') ? 14 : 6, this.hero.x, FEET_Y - 160);
          this.time.delayedCall(400, () => this.sparks.setParticleTint(0xffffff));
          if (rarityAtLeast(e.item.rarity, 'epic')) {
            this.fx('sparkle', this.hero.x, FEET_Y - 9 * P, { depth: 34 });
            this.cheer(0.8);
          }
          break;
        }
        case 'luckBoost':
          this.flames.setParticleTint(0x46d36b);
          this.flames.explode(20, this.hero.x, FEET_Y - 120);
          this.time.delayedCall(600, () => this.flames.setParticleTint([0xff7043, 0xffb300, 0xffe14a]));
          this.fx('sparkle', this.hero.x, FEET_Y - 9 * P, { depth: 34, tint: 0x8dff8a });
          this.number(this.hero.x, FEET_Y - 330, t('battle.luckUp', { mult: BAL.luck.potion.mult }), { size: 50, grad: ['#d8ffd0', '#2fb150'], life: 1200 });
          break;
        case 'playerDeath':
          this.dead = true;
          this.mode = 'ko';
          this.swingQueue = [];
          // Curls up and falls asleep.
          this.heroSpr.play('hero:lie');
          this.heroSpr.chain('hero:sleep');
          this.aimWeapon(REST);
          this.stamp(this.hero.x, FEET_Y - 240, t('battle.ko'), '#FF8A80', 64);
          break;
        case 'stageStart':
          this.clearFoes();
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
    const c = this.add.container(startX, FEET_Y).setDepth(18);
    const shadow = this.add.ellipse(0, 2, snap(Math.max(8 * P, (tex.front + tex.back) * 0.6)), 2 * P, INK_N, 0.18);
    const rig = this.add.container(0, 0);
    const spr = this.add.sprite(0, 0, tex.key, '0').setOrigin(tex.ox, tex.oy).setScale(P);
    rig.add(spr);
    const bar = this.add.graphics();
    c.add([shadow, rig, bar]);
    const num = this.label(0, 0, 20).setDepth(41);
    spr.play(`${tex.key}:${tex.anims.has('walk') ? 'walk' : 'idle'}`);
    if (!tex.animated) {
      // Stills breathe: one pixel up and down so nothing sits perfectly still.
      this.tweens.add({ targets: spr, y: -P, duration: 420 + (uid % 5) * 60, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [1] });
    }
    return {
      uid, id: enemyId, kind, c, rig, spr, tex, bar, num, front: tex.front, back: tex.back, height: tex.height,
      x: startX, lunge: 0, knock: 0, knockV: 0, shownHp: hp, ghostHp: hp, maxHp, pending: 0, dead: false, dying: false, acting: false,
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
        f = this.makeFoe(e.uid, e.enemyId, e.kind, e.hp, e.maxHp, BATTLE_W + 160 + i * 120, g.battle.stage);
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
          f.num.destroy();
          this.foes.delete(uid);
        }
      }
    }
    for (const f of this.foes.values()) {
      if (f.dying) {
        f.num.setVisible(false);
        continue;
      }
      // Knockback spring.
      f.knockV += -f.knock * 260 * dt - f.knockV * 16 * dt;
      f.knock += f.knockV * dt;
      f.c.x = snap(f.x + f.lunge + (this.reduceMotion ? 0 : f.knock));
      f.ghostHp = f.ghostHp > f.shownHp ? Math.max(f.shownHp, f.ghostHp - f.maxHp * 0.9 * dt) : f.shownHp;
      const regular = f.kind === 'regular';
      const w = regular ? Phaser.Math.Clamp((f.front + f.back) * 0.42, 60, 120) : 0;
      f.bar.clear();
      if (regular) {
        this.drawBar(f.bar, 0, BAR_DY, w, BAR_H, f.shownHp / f.maxHp, f.ghostHp / f.maxHp, 0xff4d5e);
        // Only the foe being fought shows its number; the rest just show their bars.
        const fighting = f.uid === frontUid;
        f.num.setVisible(fighting);
        if (fighting) f.num.setText(formatNumber(Math.ceil(Math.max(0, f.shownHp)))).setPosition(f.c.x, FEET_Y + BAR_DY + BAR_H / 2);
      } else {
        f.num.setVisible(false);
      }
    }
  }

  private drawBar(g: Phaser.GameObjects.Graphics, cx: number, y: number, w: number, h: number, pct: number, ghost: number, color: number) {
    const x = cx - w / 2;
    const border = h >= 20 ? 6 : 4;
    g.fillStyle(INK_N, 1).fillRect(x - border, y - border, w + border * 2, h + border * 2);
    g.fillStyle(0x4a3b38, 1).fillRect(x, y, w, h);
    const gw = w * Phaser.Math.Clamp(ghost, 0, 1);
    if (gw > 2) g.fillStyle(0xffffff, 0.95).fillRect(x, y, gw, h);
    const fw = w * Phaser.Math.Clamp(pct, 0, 1);
    if (fw > 2) {
      g.fillStyle(color, 1).fillRect(x, y, fw, h);
      g.fillStyle(0xffffff, 0.35).fillRect(x, y, fw, Math.max(4, Math.round(h * 0.3)));
    }
  }

  private clearFoes() {
    for (const f of this.foes.values()) {
      f.c.destroy();
      f.num.destroy();
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
      if (Math.floor(this.walkT / Math.PI) !== Math.floor(before / Math.PI)) this.dust.explode(2, this.hero.x - 3 * P, FEET_Y - P);
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

    // Parallax while walking; clouds always drift.
    const speed = walking ? 330 : 0;
    this.far.tilePositionX += speed * 0.18 * dt;
    this.mid.tilePositionX += speed * 0.5 * dt;
    this.ground.tilePositionX += speed * dt;
    this.fg.tilePositionX += speed * 1.3 * dt;
    for (const c of this.clouds) c.ts.tilePositionX += (c.speed * P + speed * 0.05) * dt;
    if (b.stage !== this.worldShown) this.showWorld(b.stage);
    this.ambience.update(dt, speed * dt, (name) => this.layer(name).tilePositionX, {
      reduceMotion: this.reduceMotion,
      reduceFlashing: this.reduceFlashing,
    });

    const sig = SLOTS.map((s) => `${g.equipped[s]?.uid ?? 0}`).join(',');
    if (sig !== this.gearSig) {
      this.gearSig = sig;
      this.drawGear(g);
    }

    // Hero: hops along, closes in to fight.
    const targetX = b.phase === 'fighting' ? HERO_FIGHT_X : HERO_WALK_X;
    this.heroX += (targetX - this.heroX) * (1 - Math.pow(0.001, dt));
    this.heroKnock += (0 - this.heroKnock) * (1 - Math.pow(0.0005, dt));
    this.hero.x = snap(this.heroX + this.heroDx + this.heroKnock);
    this.animateHero(walking, dt);
    this.followBody();
    void time;

    this.syncFoes(g, dt);
    if (this.releaseLater) this.releaseLater = releaseWorlds(this, this.worldShown, this.foeTextures()) > 0;

    // Lifesteal heals are batched into one number.
    this.healTimer -= dt;
    if (this.healAcc >= 1 && this.healTimer <= 0) {
      this.number(this.hero.x - 50, FEET_Y - 250, `+${formatNumber(this.healAcc)}`, { size: 34, color: '#7ef08f', life: 600 });
      this.healAcc = 0;
      this.healTimer = 0.5;
    }

    // Hero HP bar.
    const maxHp = Math.max(1, b.playerHp, this.maxHp(g));
    this.shownHeroHp += (b.playerHp - this.shownHeroHp) * (1 - Math.pow(0.0001, dt));
    this.heroBar.clear();
    if (!this.dead) {
      this.drawBar(this.heroBar, this.hero.x - 4, FEET_Y + BAR_DY, 132, BAR_H, b.playerHp / maxHp, this.shownHeroHp / maxHp, 0x5bd23a);
      this.heroNum.setText(formatNumber(Math.max(0, Math.ceil(b.playerHp)))).setPosition(this.hero.x - 4, FEET_Y + BAR_DY + BAR_H / 2).setVisible(true);
    } else {
      this.heroNum.setVisible(false);
    }

    // Boss bar under the stage name.
    const boss = b.enemies.find((e) => e.kind !== 'regular');
    this.bossBar.clear();
    if (boss) {
      const f = this.foes.get(boss.uid);
      const shown = f ? f.shownHp : boss.hp;
      const ghost = f ? f.ghostHp : boss.hp;
      this.drawBar(this.bossBar, BATTLE_W / 2, BOSS_BAR_Y, 600, 28, shown / boss.maxHp, ghost / boss.maxHp, boss.kind === 'boss' ? 0xffb300 : 0xff4d5e);
      this.bossName.setText(`${worldDef(b.stage).boss.name}  ${formatNumber(Math.max(0, Math.ceil(shown)))}`);
    } else {
      this.bossName.setText('');
    }
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
