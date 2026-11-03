/**
 * The battle view (Phaser). Reads GameState every frame and choreographs core events:
 * the raccoon closes in, winds up and swings (slash trail, impact star, hit-stop on crits,
 * knockback), enemies lunge back, HP bars sit under every fighter, and coins arc up to the
 * gold counter. Combat results always come from core; this file only animates them.
 */
import Phaser from 'phaser';
import { BAL, SLOTS, type Rarity } from '../data';
import { computeStats, formatNumber, rarityAtLeast, worldDef, type CoreEvent, type GameState } from '../core';
import { bus } from '../app/eventBus';
import { gameStore } from '../app/store';
import { t } from '../ui/i18n';
import { rarityColorNum } from './art';
import {
  FRONT_ORDER, HERO, WEAPON_TILT, enemyTex, gearTex, generateTextures, heroBody, heroPaw, heroTail, releaseWorlds, texSize, weaponTex,
  worldTextures,
} from './textures';
import { P } from './pixel';
import { LAYER_Y, SCROLL0 } from './worldLook';

export const BATTLE_W = 1080;
export const BATTLE_H = 820;
const FEET_Y = 704;
const HERO_WALK_X = 290;
const HERO_FIGHT_X = 330;
/** Where the front enemy's leading edge stands while fighting. */
const ENGAGE_EDGE = 470;
const COIN_TARGET = { x: 694, y: 58 };
const BAG_TARGET = { x: 190, y: BATTLE_H + 220 };
const FONT = '"Pixelify Sans", "Courier New", monospace';
const INK = '#1A1326';
const INK_N = 0x1a1326;
/** Weapon angles in degrees (0 = pointing up, clockwise positive). */
const REST = WEAPON_TILT;
const WIND = -100;
const STRIKE = 128;
const HAND = { x: HERO.hand.x - HERO.feet.x, y: HERO.hand.y - HERO.feet.y };

type Kind = 'regular' | 'miniboss' | 'boss';

interface Foe {
  uid: number;
  id: string;
  kind: Kind;
  c: Phaser.GameObjects.Container;
  rig: Phaser.GameObjects.Container;
  img: Phaser.GameObjects.Image;
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
  burnT: number;
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

export class BattleScene extends Phaser.Scene {
  private sky!: Phaser.GameObjects.Image;
  private cover!: Phaser.GameObjects.Rectangle;
  private worldShown = 0;
  private far!: Phaser.GameObjects.TileSprite;
  private mid!: Phaser.GameObjects.TileSprite;
  private ground!: Phaser.GameObjects.TileSprite;
  private fg!: Phaser.GameObjects.TileSprite;
  private clouds: Array<{ img: Phaser.GameObjects.Image; speed: number }> = [];
  private hero!: Phaser.GameObjects.Container;
  private rig!: Phaser.GameObjects.Container;
  private heroImg!: Phaser.GameObjects.Image;
  private tailImg!: Phaser.GameObjects.Image;
  private pawImg!: Phaser.GameObjects.Image;
  private gearBack!: Phaser.GameObjects.Container;
  private gearFront!: Phaser.GameObjects.Container;
  private arm!: Phaser.GameObjects.Container;
  private weapon!: Phaser.GameObjects.Image;
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
    this.heroNum = this.label(0, 0, 22).setDepth(41);
    this.bossBar = this.add.graphics().setDepth(40);
    this.bossName = this.label(BATTLE_W / 2, 262, 32).setOrigin(0.5, 1).setDepth(41);
    this.cover = this.add.rectangle(0, 0, BATTLE_W, BATTLE_H, 0xffffff, 1).setOrigin(0, 0).setDepth(60).setAlpha(0);
    this.shownHeroHp = gameStore.getState().game.battle.playerHp;
    this.unsub = bus.on((events) => this.onEvents(events));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsub?.());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.unsub?.());
    document.fonts?.ready.then(() => {
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
    const k = worldTextures(this, world, BATTLE_W, BATTLE_H);
    this.worldShown = world;
    this.sky = this.add.image(0, 0, k.sky).setOrigin(0, 0).setDepth(0);
    const cloudY = [86, 132, 60, 170];
    for (let i = 0; i < 4; i++) {
      const img = this.add.image(120 + i * 330, cloudY[i], `bg_cloud${i % 3}`).setDepth(1);
      this.clouds.push({ img, speed: 6 + i * 3 });
    }
    this.far = this.add.tileSprite(0, LAYER_Y.far, BATTLE_W, texSize(k.far).h, k.far).setOrigin(0, 0).setDepth(2);
    this.far.tilePositionX = SCROLL0.far;
    this.mid = this.add.tileSprite(0, LAYER_Y.mid, BATTLE_W, texSize(k.mid).h, k.mid).setOrigin(0, 0).setDepth(3);
    this.mid.tilePositionX = SCROLL0.mid;
    this.ground = this.add.tileSprite(0, LAYER_Y.ground, BATTLE_W, texSize(k.ground).h, k.ground).setOrigin(0, 0).setDepth(4);
    this.ground.tilePositionX = SCROLL0.ground;
    this.fg = this.add.tileSprite(0, LAYER_Y.fg, BATTLE_W, texSize(k.fg).h, k.fg).setOrigin(0, 0).setDepth(30);
    this.fg.tilePositionX = SCROLL0.fg;
    this.tintClouds(world);
  }

  private tintClouds(world: number) {
    const night = worldDef(world).look.night;
    for (const c of this.clouds) c.img.setTint(night ? 0x7d84b8 : 0xffffff).setAlpha(night ? 0.55 : 1);
  }

  /** Swaps in another world's sky and scenery, revealed from under a sky-colored cover. */
  private showWorld(world: number) {
    if (world === this.worldShown) return;
    this.worldShown = world;
    const k = worldTextures(this, world, BATTLE_W, BATTLE_H);
    this.sky.setTexture(k.sky);
    this.far.setTexture(k.far);
    this.mid.setTexture(k.mid);
    this.ground.setTexture(k.ground);
    this.fg.setTexture(k.fg);
    this.tintClouds(world);
    releaseWorlds(this, world);
    this.tweens.killTweensOf(this.cover);
    if (this.reduceMotion || this.reduceFlashing) {
      this.cover.setAlpha(0);
      return;
    }
    this.cover.setFillStyle(Phaser.Display.Color.HexStringToColor(worldDef(world).look.skyBottom).color, 1).setAlpha(1);
    this.tweens.add({ targets: this.cover, alpha: 0, duration: 450, ease: 'Quad.easeOut' });
  }

  // ------------------------------------------------------------------ hero
  private buildHero() {
    const tail = heroTail(this);
    const body = heroBody(this);
    const paw = heroPaw(this, null);
    this.hero = this.add.container(HERO_WALK_X, FEET_Y).setDepth(20);
    const shadow = this.add.ellipse(0, 2, 160, 30, INK_N, 0.18);
    this.aura = this.add.graphics();
    this.rig = this.add.container(0, 0);
    this.gearBack = this.add.container(0, 0);
    this.tailImg = this.add.image(0, 0, tail.key).setOrigin(tail.ox, tail.oy);
    this.heroImg = this.add.image(0, 0, body.key).setOrigin(body.ox, body.oy);
    this.gearFront = this.add.container(0, 0);
    this.arm = this.add.container(HAND.x, HAND.y);
    const w = weaponTex(this, null);
    this.weapon = this.add.image(0, 0, w.key).setOrigin(w.ox, w.oy);
    this.aimWeapon(REST);
    this.pawImg = this.add.image(0, 0, paw.key).setOrigin(paw.ox, paw.oy);
    this.arm.add([this.weapon, this.pawImg]);
    this.rig.add([this.tailImg, this.gearBack, this.heroImg, this.gearFront, this.arm]);
    this.hero.add([shadow, this.aura, this.rig]);
  }

  private drawGear(g: GameState) {
    this.gearBack.removeAll(true);
    this.gearFront.removeAll(true);
    const pack = g.equipped.backpack;
    const packTex = pack ? gearTex(this, 'backpack', pack.baseId) : null;
    if (packTex) this.gearBack.add(this.add.image(0, 0, packTex.key).setOrigin(packTex.ox, packTex.oy));
    for (const slot of FRONT_ORDER) {
      const it = g.equipped[slot];
      const i = it ? gearTex(this, slot, it.baseId) : null;
      if (i) this.gearFront.add(this.add.image(0, 0, i.key).setOrigin(i.ox, i.oy));
    }
    const w = weaponTex(this, g.equipped.weapon?.baseId ?? null);
    this.weapon.setTexture(w.key).setOrigin(w.ox, w.oy);
    const paw = heroPaw(this, g.equipped.gloves?.baseId ?? null);
    this.pawImg.setTexture(paw.key).setOrigin(paw.ox, paw.oy);
    // A soft aura for Legendary-or-better gear.
    let best: Rarity | null = null;
    for (const s of SLOTS) {
      const it = g.equipped[s];
      if (it && rarityAtLeast(it.rarity, 'legendary') && (!best || rarityAtLeast(it.rarity, best))) best = it.rarity;
    }
    this.aura.clear();
    this.tweens.killTweensOf(this.aura);
    if (best) {
      for (let r = 190; r > 50; r -= 28) {
        this.aura.fillStyle(rarityColorNum(best), 0.06);
        this.aura.fillEllipse(0, -150, r * 1.4, r * 1.9);
      }
      this.aura.setAlpha(0.6);
      this.tweens.add({ targets: this.aura, alpha: 1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  /** Points the weapon `angle` degrees from straight up (the art itself is drawn tilted). */
  private aimWeapon(angle: number) {
    this.weapon.setAngle(angle - WEAPON_TILT);
  }

  /** The swing pose at progress k (0..1). Fast swings skip most of the wind-up. */
  private pose(k: number, fast: boolean) {
    const a = fast ? 0.14 : 0.32;
    const b = fast ? 0.34 : 0.5;
    if (k < a) {
      const u = easeOutQuad(k / a);
      return { angle: lerp(REST, WIND, u), dx: lerp(0, -18, u), lean: lerp(0, -7, u), sx: lerp(1, 1.06, u), sy: lerp(1, 0.94, u) };
    }
    if (k < b) {
      const u = easeInQuad((k - a) / (b - a));
      return { angle: lerp(WIND, STRIKE, u), dx: lerp(-18, 62, u), lean: lerp(-7, 9, u), sx: lerp(1.06, 0.94, u), sy: lerp(0.94, 1.08, u) };
    }
    const u = easeOutBack((k - b) / (1 - b));
    return { angle: lerp(STRIKE, REST, u), dx: lerp(62, 0, u), lean: lerp(9, 0, u), sx: lerp(0.94, 1, u), sy: lerp(1.08, 1, u) };
  }

  private swingMs(): number {
    const spd = Math.max(0.2, computeStats(gameStore.getState().game).ATK_SPD);
    return Phaser.Math.Clamp((1000 / spd) * 0.85, 170, 360);
  }

  private nextSwing() {
    const s = this.swingQueue.shift();
    if (!s) {
      this.swinging = false;
      return;
    }
    this.swinging = true;
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
        // Pixel art stays crisp: only a small lean, no squash.
        this.rig.setAngle(this.reduceMotion ? 0 : p.lean * 0.5);
        if (!landed && k >= impactAt) {
          landed = true;
          this.impact(s);
        }
      },
      onComplete: () => {
        if (!landed) this.impact(s);
        this.aimWeapon(REST);
        this.rig.setAngle(0).setScale(1);
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
      .particles(0, 0, 'fx_sparkle', {
        emitting: false, lifespan: { min: 220, max: 380 }, speed: { min: 240, max: 560 }, scale: { start: 0.9, end: 0 },
        rotate: { min: 0, max: 180 }, maxAliveParticles: 60,
      })
      .setDepth(34);
    this.bigSparks = this.add
      .particles(0, 0, 'fx_sparkle', {
        emitting: false, lifespan: { min: 400, max: 700 }, speed: { min: 380, max: 900 }, scale: { start: 1.6, end: 0 },
        rotate: { min: 0, max: 360 }, tint: [0xffe14a, 0xffffff, 0xffb300], maxAliveParticles: 60,
      })
      .setDepth(34);
    this.dust = this.add
      .particles(0, 0, 'fx_puff', {
        emitting: false, lifespan: { min: 380, max: 600 }, speed: { min: 40, max: 160 }, angle: { min: 180, max: 360 },
        scale: { start: 0.55, end: 1.1 }, alpha: { start: 0.9, end: 0 }, maxAliveParticles: 30,
      })
      .setDepth(33);
    this.flames = this.add
      .particles(0, 0, 'fx_sparkle', {
        emitting: false, lifespan: { min: 300, max: 520 }, speedY: { min: -220, max: -120 }, speedX: { min: -40, max: 40 },
        scale: { start: 0.8, end: 0 }, tint: [0xff7043, 0xffb300, 0xffe14a], maxAliveParticles: 50,
      })
      .setDepth(34);
    for (let k = 0; k < 4; k++) {
      this.confetti.push(
        this.add
          .particles(0, 0, `fx_conf${k}`, {
            emitting: false, lifespan: { min: 900, max: 1500 }, speed: { min: 320, max: 760 }, angle: { min: 200, max: 340 },
            gravityY: 900, rotate: { start: 0, end: 720 }, scale: { start: 1, end: 0.8 }, maxAliveParticles: 40,
          })
          .setDepth(35),
      );
    }
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
    setTimeout(() => {
      if (this.sys.isActive()) this.tweens.timeScale = 1;
    }, ms);
  }

  private flash(img: Phaser.GameObjects.Image, color: number, ms: number) {
    if (this.reduceFlashing) return;
    img.setTintFill(color);
    this.time.delayedCall(ms, () => img.clearTint());
  }

  private foeHitPoint(f: Foe): { x: number; y: number } {
    return { x: f.c.x - f.front * 0.45, y: FEET_Y - f.height * 0.48 };
  }

  /** The blow lands: slash trail, impact star, sparks, number, knockback, maybe a kill. */
  private impact(s: Swing) {
    const f = this.foes.get(s.targetUid);
    const handX = this.hero.x + HAND.x;
    const handY = FEET_Y + HAND.y;
    const slash = this.add
      .image(handX, handY, 'fx_slash')
      .setDepth(32)
      .setScale(s.crit ? 1.25 : 1)
      .setAlpha(1);
    if (s.echo) slash.setTint(0xc9a6ff);
    this.tweens.add({ targets: slash, alpha: 0, scale: slash.scale * 1.12, angle: 12, duration: 240, ease: 'Quad.easeOut', onComplete: () => slash.destroy() });
    if (!f) {
      for (const r of s.riders) r();
      return;
    }
    f.pending = Math.max(0, f.pending - 1);
    const p = this.foeHitPoint(f);
    const star = this.add.image(p.x, p.y, 'fx_impact').setDepth(33).setScale(0.5);
    this.tweens.add({ targets: star, scale: s.crit ? 2 : 1.5, duration: 70, ease: 'Stepped', easeParams: [2] });
    this.tweens.add({ targets: star, alpha: 0, scale: s.crit ? 2 : 1.5, delay: 70, duration: 150, onComplete: () => star.destroy() });
    this.flash(f.img, 0xffffff, 60);
    f.knockV += s.crit ? 900 : 560;
    if (!this.reduceMotion) {
      this.tweens.add({ targets: f.rig, scaleX: 1.14, scaleY: 0.86, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
    }
    f.shownHp = Math.max(0, f.shownHp - s.amount);
    if (s.crit) {
      this.bigSparks.explode(14, p.x, p.y);
      this.number(p.x, p.y - 70, formatNumber(s.amount), { size: 76, grad: ['#fff6a8', '#ff9a1a'], life: 950 });
      this.stamp(p.x + 10, p.y - 160, t('battle.crit'), '#FFD54F', 40);
      this.shake(110, 0.006);
      this.hitStop(70);
    } else {
      this.sparks.explode(7, p.x, p.y);
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
    this.dust.explode(info && info.kind !== 'regular' ? 10 : 5, p.x, p.y + 20);
    const coins = info ? (info.kind === 'boss' ? 16 : info.kind === 'miniboss' ? 9 : 3) : 2;
    this.coinBurst(p.x, p.y, coins);
    if (info && info.kind !== 'regular') {
      this.shake(320, 0.014);
      this.confetti.forEach((em) => em.explode(10, p.x, p.y));
    }
    this.flash(f.img, 0xffffff, 90);
    this.tweens.add({
      targets: f.c,
      x: f.c.x + 700,
      y: f.c.y - 380,
      angle: 540,
      scale: 0.55,
      duration: 650,
      ease: 'Quad.easeOut',
      onComplete: () => {
        f.c.destroy();
        f.num.destroy();
        this.foes.delete(f.uid);
      },
    });
  }

  /** Coins pop out, bounce once, then fly up to the gold counter. */
  private coinBurst(x: number, y: number, n: number) {
    for (let i = 0; i < n && this.coinsFlying < 50; i++) {
      this.coinsFlying++;
      const c = this.add.image(x, y, 'fx_coin').setDepth(36);
      const vx = Phaser.Math.Between(-260, 260);
      const landX = x + vx * 0.45;
      const peak = y - Phaser.Math.Between(90, 190);
      this.tweens.add({ targets: c, scaleX: { from: 0.9, to: 0.25 }, duration: 110, yoyo: true, repeat: 5 });
      this.tweens.chain({
        targets: c,
        tweens: [
          { x: landX, duration: 420, ease: 'Linear' },
          { x: COIN_TARGET.x, y: COIN_TARGET.y, scale: 0.55, duration: 420 + i * 35, ease: 'Cubic.easeIn' },
        ],
        onComplete: () => {
          c.destroy();
          this.coinsFlying--;
        },
      });
      this.tweens.add({ targets: c, y: peak, duration: 200, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: c, y: FEET_Y - 10, delay: 200, duration: 220, ease: 'Bounce.easeOut' });
    }
  }

  private bagBurst(count: number) {
    const from = { x: ENGAGE_EDGE + 80, y: FEET_Y - 120 };
    for (let i = 0; i < Math.min(count, 6); i++) {
      const bag = this.add.image(from.x + i * 30, from.y, 'fx_bag').setDepth(36).setScale(0.6);
      this.tweens.add({ targets: bag, scale: 1, y: from.y - 120, duration: 260, ease: 'Back.easeOut', delay: i * 70 });
      this.tweens.add({
        targets: bag, x: BAG_TARGET.x, y: BAG_TARGET.y, scale: 0.5, angle: -40, duration: 520, ease: 'Cubic.easeIn',
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
      const jitter = i === 0 || i === n ? 0 : Phaser.Math.Between(-26, 26);
      pts.push(new Phaser.Math.Vector2(lerp(a.x, b.x, k), lerp(a.y, b.y, k) + jitter));
    }
    g.lineStyle(16, INK_N, 1).strokePoints(pts);
    g.lineStyle(10, 0xffe14a, 1).strokePoints(pts);
    g.lineStyle(4, 0xffffff, 1).strokePoints(pts);
    this.tweens.add({ targets: g, alpha: 0, duration: 220, delay: 60, onComplete: () => g.destroy() });
  }

  private boom(x: number, y: number) {
    const ring = this.add.image(x, y, 'fx_puff').setDepth(34).setScale(1).setTint(0xff8a3d);
    this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    this.bigSparks.explode(10, x, y);
    this.flames.explode(10, x, y);
    this.shake(140, 0.008);
  }

  private heroHurt(amount: number, heavy: boolean) {
    this.flashHero(0xff8a8a, 110);
    if (amount >= this.maxHp(gameStore.getState().game)) {
      // Way out of its league: make it obvious.
      this.stamp(this.hero.x + 30, FEET_Y - 300, t('battle.oneShot'), '#FF5A5A', 72);
      this.shake(320, 0.02);
      const star = this.add.image(this.hero.x + 40, FEET_Y - 170, 'fx_impact').setDepth(33).setScale(1.2);
      this.tweens.add({ targets: star, scale: 2.2, alpha: 0, duration: 320, onComplete: () => star.destroy() });
    }
    this.heroKnock = this.reduceMotion ? 0 : heavy ? -40 : -18;
    const p = { x: this.hero.x + 10, y: FEET_Y - 170 };
    if (heavy) {
      const star = this.add.image(p.x + 40, p.y, 'fx_impact').setDepth(33).setScale(1).setTint(0xffb3a8);
      this.tweens.add({ targets: star, scale: 1.3, alpha: 0, duration: 220, onComplete: () => star.destroy() });
      this.shake(220, 0.012);
    }
    this.number(p.x - 30, p.y - 60, `-${formatNumber(amount)}`, { size: heavy ? 58 : 44, color: '#ff8a80' });
  }

  private lungeAt(f: Foe, contact: () => void, heavy: boolean) {
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
      this.tailImg, this.heroImg, this.weapon, this.pawImg,
      ...(this.gearBack.list as Phaser.GameObjects.Image[]), ...(this.gearFront.list as Phaser.GameObjects.Image[]),
    ];
    for (const i of imgs) i.setTint(color);
    this.time.delayedCall(ms, () => imgs.forEach((i) => i.active && i.clearTint()));
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
            this.flash(b.img, 0xfff3a0, 70);
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
          else this.number(this.hero.x - 40, FEET_Y - 250, `+${formatNumber(e.amount)}`, { size: 38, color: '#7ef08f' });
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
          break;
        case 'bossWin':
          if (!events.some((x) => x.type === 'worldFirstClear')) this.confetti.forEach((em) => em.explode(5, BATTLE_W / 2 + 120, 420));
          break;
        case 'levelUp': {
          const ring = this.add.image(this.hero.x, FEET_Y - 140, 'fx_puff').setDepth(33).setScale(0.8).setTint(0xffe14a);
          this.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
          this.bigSparks.explode(16, this.hero.x, FEET_Y - 160);
          this.number(this.hero.x, FEET_Y - 320, t('battle.levelUp'), { size: 54, grad: ['#fff6a8', '#ffa21a'], life: 1100 });
          break;
        }
        case 'equip': {
          const c = rarityColorNum(e.item.rarity);
          this.sparks.setParticleTint(c);
          this.sparks.explode(rarityAtLeast(e.item.rarity, 'epic') ? 16 : 6, this.hero.x, FEET_Y - 160);
          this.time.delayedCall(400, () => this.sparks.setParticleTint(0xffffff));
          break;
        }
        case 'luckBoost':
          this.flames.setParticleTint(0x46d36b);
          this.flames.explode(20, this.hero.x, FEET_Y - 120);
          this.time.delayedCall(600, () => this.flames.setParticleTint([0xff7043, 0xffb300, 0xffe14a]));
          this.number(this.hero.x, FEET_Y - 330, t('battle.luckUp', { mult: BAL.luck.potion.mult }), { size: 50, grad: ['#d8ffd0', '#2fb150'], life: 1200 });
          break;
        case 'playerDeath':
          this.dead = true;
          this.swingQueue = [];
          this.tweens.add({ targets: this.rig, angle: -88, duration: 380, ease: 'Bounce.easeOut' });
          this.tweens.add({ targets: this.hero, alpha: 0.55, duration: 380 });
          this.stamp(this.hero.x, FEET_Y - 240, t('battle.ko'), '#FF8A80', 64);
          break;
        case 'stageStart':
          this.clearFoes();
          if (this.dead) {
            this.dead = false;
            this.tweens.killTweensOf(this.rig);
            this.tweens.killTweensOf(this.hero);
            this.rig.setAngle(0).setScale(1);
            this.hero.setAlpha(0);
            this.tweens.add({ targets: this.hero, alpha: 1, duration: 300 });
          }
          break;
      }
    }
  }

  // ------------------------------------------------------------------ enemies
  private makeFoe(uid: number, enemyId: string, kind: Kind, hp: number, maxHp: number, startX: number, world: number): Foe {
    const tex = enemyTex(this, enemyId, world);
    const c = this.add.container(startX, FEET_Y).setDepth(18);
    const shadow = this.add.ellipse(0, 2, Math.max(90, tex.w * 0.6), 26, INK_N, 0.18);
    const rig = this.add.container(0, 0);
    const img = this.add.image(0, 0, tex.key).setOrigin(tex.ox, tex.oy);
    rig.add(img);
    const bar = this.add.graphics();
    c.add([shadow, rig, bar]);
    const num = this.label(0, 0, 21).setDepth(41);
    // Idle breathing so nothing sits perfectly still.
    this.tweens.add({ targets: img, y: -P, duration: 420 + (uid % 5) * 60, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [1] });
    return {
      uid, id: enemyId, kind, c, rig, img, bar, num, front: tex.front, back: tex.back, height: tex.oy * tex.h,
      x: startX, lunge: 0, knock: 0, knockV: 0, shownHp: hp, ghostHp: hp, maxHp, pending: 0, dead: false, dying: false, burnT: 0,
    };
  }

  private syncFoes(g: GameState, dt: number) {
    const alive = new Set<number>();
    let edge = ENGAGE_EDGE;
    g.battle.enemies.forEach((e, i) => {
      alive.add(e.uid);
      let f = this.foes.get(e.uid);
      if (!f) {
        f = this.makeFoe(e.uid, e.enemyId, e.kind, e.hp, e.maxHp, BATTLE_W + 160 + i * 120, g.battle.stage);
        this.foes.set(e.uid, f);
      }
      const target = edge + f.front;
      edge = target + f.back * 0.55 + 8;
      if (f.dying) return;
      f.maxHp = e.maxHp;
      // Heals and resets show at once; damage waits until its blow visibly lands.
      if (e.hp > f.shownHp) f.shownHp = e.hp;
      else if (f.pending === 0) f.shownHp = Math.max(0, e.hp);
      const k = 1 - Math.pow(0.002, dt);
      f.x += (target - f.x) * k;
      f.c.setDepth(18 - i * 0.01);
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
      f.c.x = f.x + f.lunge + (this.reduceMotion ? 0 : f.knock);
      f.ghostHp = f.ghostHp > f.shownHp ? Math.max(f.shownHp, f.ghostHp - f.maxHp * 0.9 * dt) : f.shownHp;
      const regular = f.kind === 'regular';
      const w = regular ? Phaser.Math.Clamp((f.front + f.back) * 0.55, 96, 170) : 0;
      f.bar.clear();
      if (regular) {
        this.drawBar(f.bar, 0, 22, w, 16, f.shownHp / f.maxHp, f.ghostHp / f.maxHp, 0xff4d5e);
        f.num.setText(formatNumber(Math.ceil(Math.max(0, f.shownHp)))).setPosition(f.c.x, FEET_Y + 30).setVisible(true);
      } else {
        f.num.setVisible(false);
      }
    }
  }

  private drawBar(g: Phaser.GameObjects.Graphics, cx: number, y: number, w: number, h: number, pct: number, ghost: number, color: number) {
    const x = cx - w / 2;
    const r = h / 2;
    void r;
    g.fillStyle(INK_N, 1).fillRect(x - 6, y - 6, w + 12, h + 12);
    g.fillStyle(0x4a3b38, 1).fillRect(x, y, w, h);
    const gw = w * Phaser.Math.Clamp(ghost, 0, 1);
    if (gw > 2) g.fillStyle(0xffffff, 0.95).fillRect(x, y, gw, h);
    const fw = w * Phaser.Math.Clamp(pct, 0, 1);
    if (fw > 2) {
      g.fillStyle(color, 1).fillRect(x, y, fw, h);
      g.fillStyle(0xffffff, 0.35).fillRect(x, y, fw, Math.max(P, Math.round(h * 0.3)));
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
    for (const c of this.clouds) {
      c.img.x -= (c.speed + speed * 0.05) * dt;
      if (c.img.x < -220) c.img.x = BATTLE_W + 220;
    }
    if (b.stage !== this.worldShown) this.showWorld(b.stage);

    const sig = SLOTS.map((s) => `${g.equipped[s]?.uid ?? 0}`).join(',');
    if (sig !== this.gearSig) {
      this.gearSig = sig;
      this.drawGear(g);
    }

    // Hero: walks in place, closes in to fight, bobs while idle.
    const targetX = b.phase === 'fighting' ? HERO_FIGHT_X : HERO_WALK_X;
    this.heroX += (targetX - this.heroX) * (1 - Math.pow(0.001, dt));
    this.heroKnock += (0 - this.heroKnock) * (1 - Math.pow(0.0005, dt));
    this.hero.x = this.heroX + this.heroDx + this.heroKnock;
    if (!this.dead && !this.swinging) {
      if (walking && !this.reduceMotion) {
        this.walkT += dt * 11;
        const s = Math.abs(Math.sin(this.walkT));
        this.rig.y = -Math.round((s * 16) / P) * P;
        this.rig.setAngle(0);
        this.rig.setScale(1);
        this.aimWeapon(REST);
        if (Math.floor(this.walkT / Math.PI) !== Math.floor((this.walkT - dt * 11) / Math.PI)) this.dust.explode(1, this.hero.x - 30, FEET_Y - 6);
      } else {
        this.rig.y = Math.floor(time / 420) % 2 === 0 ? 0 : -P;
        this.rig.setAngle(0);
        this.rig.setScale(1);
      }
    } else if (!this.dead) {
      this.rig.y = 0;
    }

    this.syncFoes(g, dt);

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
      this.drawBar(this.heroBar, this.hero.x - 4, FEET_Y + 22, 160, 16, b.playerHp / maxHp, this.shownHeroHp / maxHp, 0x5bd23a);
      this.heroNum.setText(formatNumber(Math.max(0, Math.ceil(b.playerHp)))).setPosition(this.hero.x - 4, FEET_Y + 30).setVisible(true);
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
      this.drawBar(this.bossBar, BATTLE_W / 2, 272, 640, 30, shown / boss.maxHp, ghost / boss.maxHp, boss.kind === 'boss' ? 0xffb300 : 0xff4d5e);
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
