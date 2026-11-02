/**
 * Alley battle view. Reads GameState every frame and plays effects from core events.
 * Placeholder art is generated in code (textures.ts) and follows docs/ART_DIRECTION.md.
 */
import Phaser from 'phaser';
import { DATA, SLOTS, type Rarity, type Slot } from '../data';
import { computeStats, neighborhoodFor, rarityAtLeast, type CoreEvent, type GameState } from '../core';
import { bus } from '../app/eventBus';
import { gameStore } from '../app/store';
import { t } from '../ui/i18n';
import { enemyPlaceholder, hexToNum, rarityColorNum } from './art';
import {
  BG_TILE_W, enemyTexBox, enemyTexKey, ensureGearTexture, generateBackground, generateTextures, OUTLINE, RACCOON_FEET,
  RACCOON_TEX, SIGN_BOARD,
} from './textures';
import { BACK_SLOTS } from './paint/gear';

export const BATTLE_W = 1080;
export const BATTLE_H = 768;
const GROUND_Y = 640;
const RACCOON_X = 270;
const ENEMY_FRONT_LEFT = 400;
const COIN_TARGET = { x: 660, y: -60 };
const DUMPSTER_TARGET = { x: 170, y: BATTLE_H + 120 };
const FONT = '"Lilita One", "Trebuchet MS", sans-serif';
const PAL = DATA.assets.placeholders.palette;

interface EnemySprite {
  uid: number;
  container: Phaser.GameObjects.Container;
  image: Phaser.GameObjects.Image;
  hpBar: Phaser.GameObjects.Graphics;
  size: number;
  dying: boolean;
}

export class BattleScene extends Phaser.Scene {
  private far!: Phaser.GameObjects.TileSprite;
  private mid!: Phaser.GameObjects.TileSprite;
  private props!: Phaser.GameObjects.TileSprite;
  private ground!: Phaser.GameObjects.TileSprite;
  private fg!: Phaser.GameObjects.TileSprite;
  private sign!: Phaser.GameObjects.Container;
  private signLetters: Phaser.GameObjects.Text[] = [];
  private raccoon!: Phaser.GameObjects.Container;
  private raccoonBody!: Phaser.GameObjects.Container;
  private raccoonImg!: Phaser.GameObjects.Image;
  private gearBack!: Phaser.GameObjects.Container;
  private gearFront!: Phaser.GameObjects.Container;
  private aura!: Phaser.GameObjects.Graphics;
  private playerHpBar!: Phaser.GameObjects.Graphics;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossName!: Phaser.GameObjects.Text;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private critShards!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private smoke!: Phaser.GameObjects.Particles.ParticleEmitter;
  private motes!: Phaser.GameObjects.Particles.ParticleEmitter;
  private enemies = new Map<number, EnemySprite>();
  private gearSig = '';
  private bgId = '';
  private dead = false;
  private attacking = false;
  private flying = 0;
  private unsub?: () => void;
  private hpCache: { key: unknown; hp: number } = { key: null, hp: 1 };

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
    this.buildBackground();
    this.buildRaccoon();
    this.buildEffects();
    this.playerHpBar = this.add.graphics().setDepth(40);
    this.bossBar = this.add.graphics().setDepth(40);
    this.bossName = this.add
      .text(BATTLE_W / 2 + 40, 84, '', { fontFamily: FONT, fontSize: '30px', color: '#ffffff' })
      .setOrigin(0.5, 0)
      .setDepth(41)
      .setStroke(PAL.outline, 8);
    this.unsub = bus.on((events) => this.onEvents(events));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsub?.());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.unsub?.());
    // Text drawn before the display font loaded gets redrawn once it is ready.
    document.fonts?.ready.then(() => {
      if (!this.sys.isActive()) return;
      this.signLetters.forEach((l) => l.setFontFamily(FONT));
      this.bossName.setFontFamily(FONT);
      this.layoutSign();
    });
  }

  // ------------------------------------------------------------------ background
  private buildBackground() {
    const g = gameStore.getState().game;
    const bgKey = neighborhoodFor(g.battle.stage).background;
    this.bgId = bgKey;
    const c = DATA.assets.placeholders.backgrounds[bgKey];
    generateBackground(this, bgKey, BATTLE_W, BATTLE_H);

    this.add.image(0, 0, `${bgKey}_sky`).setOrigin(0, 0).setDepth(0);
    this.far = this.add.tileSprite(0, 80, BATTLE_W, 520, `${bgKey}_far`).setOrigin(0, 0).setDepth(1);
    this.mid = this.add.tileSprite(0, 260, BATTLE_W, 380, `${bgKey}_mid`).setOrigin(0, 0).setDepth(2);
    this.buildSign(c.neon, c.neon2, t(c.sign), t(c.signSub), bgKey);
    this.props = this.add.tileSprite(0, 420, BATTLE_W, 200, `${bgKey}_props`).setOrigin(0, 0).setDepth(4);
    this.ground = this.add.tileSprite(0, 600, BATTLE_W, 220, `${bgKey}_ground`).setOrigin(0, 0).setDepth(5);
    this.fg = this.add.tileSprite(0, 0, BATTLE_W, BATTLE_H, `${bgKey}_fg`).setOrigin(0, 0).setDepth(26).setAlpha(0.85);
    // Neighborhood grading ties every layer together; paper grain sits over the whole picture.
    this.add.rectangle(0, 0, BATTLE_W, BATTLE_H, hexToNum(c.grade), c.gradeAlpha).setOrigin(0, 0).setDepth(25);
    this.add.tileSprite(0, 0, BATTLE_W, BATTLE_H, 'paper_grain').setOrigin(0, 0).setDepth(48).setAlpha(0.6).setTileScale(2.2, 2.2);
  }

  /** Neon sign that scrolls with the mid layer. One letter is always broken and flickers. */
  private buildSign(neon: string, neon2: string, text: string, sub: string, bgKey: string) {
    this.sign = this.add.container(0, 0).setDepth(3);
    const board = this.add.image(0, -8, `${bgKey}_sign`).setOrigin(0.5, 0.5);
    this.sign.add(board);
    this.signLetters = [...text].map((ch) =>
      this.add
        .text(0, -30, ch, { fontFamily: FONT, fontSize: '50px', color: neon })
        .setOrigin(0, 0.5)
        .setShadow(0, 0, neon, 18, true, true),
    );
    this.sign.add(this.signLetters);
    const subText = this.add
      .text(0, 26, sub, { fontFamily: FONT, fontSize: '26px', color: neon2 })
      .setOrigin(0.5, 0.5)
      .setShadow(0, 0, neon2, 12, true, true);
    this.sign.add(subText);
    void SIGN_BOARD;
    this.layoutSign();
    const broken = this.signLetters.length > 6 ? this.signLetters[6] : this.signLetters[0];
    const flicker = () => {
      if (!this.sys.isActive()) return;
      broken.setAlpha(broken.alpha > 0.5 ? 0.15 : 1);
      this.time.delayedCall(Phaser.Math.Between(80, broken.alpha > 0.5 ? 2600 : 260), flicker);
    };
    flicker();
  }

  private layoutSign() {
    const total = this.signLetters.reduce((w, l) => w + l.width, 0);
    let x = -total / 2;
    for (const l of this.signLetters) {
      l.setX(x);
      x += l.width;
    }
  }

  // ------------------------------------------------------------------ raccoon
  private buildRaccoon() {
    this.raccoon = this.add.container(RACCOON_X, GROUND_Y).setDepth(12);
    this.aura = this.add.graphics();
    this.raccoonBody = this.add.container(0, 0);
    this.gearBack = this.add.container(0, 0);
    this.gearFront = this.add.container(0, 0);
    this.raccoonImg = this.add
      .image(0, 0, 'raccoon_base')
      .setOrigin(RACCOON_FEET.x / RACCOON_TEX.w, RACCOON_FEET.y / RACCOON_TEX.h);
    const shadow = this.add.ellipse(0, 4, 150, 26, 0x000000, 0.35);
    this.raccoonBody.add([this.gearBack, this.raccoonImg, this.gearFront]);
    this.raccoon.add([shadow, this.aura, this.raccoonBody]);
    this.tweens.add({ targets: this.raccoonBody, scaleY: 1.03, y: -3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Painted gear overlays at ~1.3x real scale, breaking the silhouette on purpose. */
  private drawGear(g: GameState) {
    this.gearBack.removeAll(true);
    this.gearFront.removeAll(true);
    const ox = RACCOON_FEET.x / RACCOON_TEX.w;
    const oy = RACCOON_FEET.y / RACCOON_TEX.h;
    const order: Slot[] = ['backpack', 'jacket', 'sneakers', 'bling', 'shield', 'weapon', 'gloves', 'ring', 'mask', 'hat'];
    for (const slot of order) {
      const it = g.equipped[slot];
      if (!it) continue;
      const img = this.add.image(0, 0, ensureGearTexture(this, slot, it.rarity)).setOrigin(ox, oy);
      (BACK_SLOTS.includes(slot) ? this.gearBack : this.gearFront).add(img);
    }
    // Aura for Legendary-or-better gear.
    let best: Rarity | null = null;
    for (const s of SLOTS) {
      const it = g.equipped[s];
      if (it && rarityAtLeast(it.rarity, 'legendary') && (!best || rarityAtLeast(it.rarity, best))) best = it.rarity;
    }
    this.aura.clear();
    this.tweens.killTweensOf(this.aura);
    if (best) {
      for (let r = 170; r > 40; r -= 26) {
        this.aura.fillStyle(rarityColorNum(best), 0.07);
        this.aura.fillEllipse(10, -150, r * 1.5, r * 2);
      }
      this.aura.setAlpha(0.6);
      this.tweens.add({ targets: this.aura, alpha: 1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  // ------------------------------------------------------------------ effects
  private buildEffects() {
    const base = { emitting: false, lifespan: 150 } as const;
    this.sparks = this.add
      .particles(0, 0, 'p_star', { ...base, speed: { min: 260, max: 520 }, scale: { start: 0.9, end: 0 }, blendMode: 'ADD', maxAliveParticles: 40 })
      .setDepth(32);
    this.critShards = this.add
      .particles(0, 0, 'p_star', {
        ...base, lifespan: 300, speed: { min: 320, max: 700 }, scale: { start: 1.3, end: 0 }, tint: 0xffd54f,
        rotate: { min: 0, max: 360 }, blendMode: 'ADD', maxAliveParticles: 40,
      })
      .setDepth(32);
    for (const key of ['c_peel', 'c_cap', 'c_paper', 'c_crust']) {
      this.confetti.push(
        this.add
          .particles(0, 0, key, {
            emitting: false, lifespan: { min: 450, max: 700 }, speed: { min: 260, max: 620 }, angle: { min: -165, max: -15 },
            gravityY: 1300, rotate: { start: 0, end: 540 }, scale: { start: 1.3, end: 0.9 }, alpha: { start: 1, end: 0 },
            maxAliveParticles: 25,
          })
          .setDepth(31),
      );
    }
    this.smoke = this.add
      .particles(0, 0, 'p_smoke', {
        emitting: false, lifespan: 500, speed: { min: 20, max: 90 }, scale: { start: 0.8, end: 2.2 }, alpha: { start: 0.8, end: 0 },
        maxAliveParticles: 20,
      })
      .setDepth(30);
    this.motes = this.add
      .particles(0, 0, 'p_dot', {
        emitting: false, lifespan: 1000, speedY: { min: -260, max: -120 }, speedX: { min: -80, max: 80 },
        scale: { start: 0.9, end: 0 }, tint: hexToNum(PAL.gold), blendMode: 'ADD', maxAliveParticles: 40,
      })
      .setDepth(33);
  }

  private floatText(x: number, y: number, text: string, color: string, size: number, linger = 800) {
    const tx = this.add
      .text(x + Phaser.Math.Between(-24, 24), y, text, { fontFamily: FONT, fontSize: `${size}px`, color })
      .setOrigin(0.5)
      .setDepth(45)
      .setStroke(PAL.outline, Math.max(6, size / 6))
      .setScale(0.4);
    this.tweens.add({ targets: tx, scale: 1, duration: 120, ease: 'Back.easeOut' });
    this.tweens.add({ targets: tx, y: y - 120, alpha: 0, delay: 120, duration: linger, ease: 'Cubic.easeOut', onComplete: () => tx.destroy() });
  }

  private stamp(x: number, y: number, text: string, color: string) {
    const tx = this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: '46px', color })
      .setOrigin(0.5)
      .setDepth(46)
      .setStroke(PAL.outline, 9)
      .setAngle(-12)
      .setScale(2);
    this.tweens.add({ targets: tx, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({ targets: tx, alpha: 0, delay: 260, duration: 200, onComplete: () => tx.destroy() });
  }

  private ring(x: number, y: number, color: number, toScale: number, duration: number) {
    const r = this.add.image(x, y, 'p_ring').setDepth(33).setTint(color).setScale(0.2).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: r, scale: toScale, alpha: 0, duration, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
  }

  private coinsToCounter(x: number, y: number, n: number) {
    for (let i = 0; i < n && this.flying < 40; i++) {
      this.flying++;
      const c = this.add.image(x, y, 'p_coin').setDepth(34);
      const midX = x + Phaser.Math.Between(-60, 60);
      const midY = y - Phaser.Math.Between(80, 160);
      this.tweens.add({ targets: c, scaleX: { from: 1, to: 0.2 }, duration: 120, yoyo: true, repeat: 3 });
      this.tweens.addCounter({
        from: 0, to: 1, duration: 500 + i * 40, ease: 'Quad.easeIn',
        onUpdate: (tw) => {
          const k = tw.getValue() ?? 0;
          const u = 1 - k;
          c.setPosition(u * u * x + 2 * u * k * midX + k * k * COIN_TARGET.x, u * u * y + 2 * u * k * midY + k * k * COIN_TARGET.y);
        },
        onComplete: () => {
          c.destroy();
          this.flying--;
        },
      });
    }
  }

  private bagDrop(count: number) {
    for (let i = 0; i < Math.min(count, 5); i++) {
      const bag = this.add.image(RACCOON_X + 110 + i * 34, GROUND_Y - 260, 'p_bag').setDepth(34).setScale(0.9);
      this.tweens.add({ targets: bag, y: GROUND_Y - 30, duration: 420, ease: 'Bounce.easeOut', delay: i * 60 });
      this.time.delayedCall(80 + i * 60 + 380, () => this.sparks.explode(2, bag.x + 4, bag.y - 26));
      this.tweens.add({
        targets: bag, x: DUMPSTER_TARGET.x, y: DUMPSTER_TARGET.y, scale: 0.6, duration: 360, ease: 'Quad.easeIn', delay: 520 + i * 60,
        onComplete: () => bag.destroy(),
      });
    }
  }

  private shake(duration: number, intensity: number) {
    if (!this.reduceMotion) this.cameras.main.shake(duration, intensity);
  }

  private punch() {
    if (this.reduceMotion) return;
    const cam = this.cameras.main;
    this.tweens.killTweensOf(cam);
    cam.setZoom(1);
    this.tweens.add({ targets: cam, zoom: 1.03, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** ~100 ms wind-up, 33 ms strike, 150 ms bouncy follow-through. */
  private attackAnim() {
    if (this.attacking) return;
    this.attacking = true;
    this.tweens.chain({
      targets: this.raccoon,
      tweens: [
        { x: RACCOON_X - 14, duration: 100, ease: 'Quad.easeOut' },
        { x: RACCOON_X + 46, duration: 33, ease: 'Linear' },
        { x: RACCOON_X, duration: 150, ease: 'Back.easeOut' },
      ],
      onComplete: () => {
        this.attacking = false;
      },
    });
  }

  private hitReact(s: EnemySprite, crit: boolean) {
    if (!this.reduceFlashing) {
      s.image.setTintFill(0xffffff);
      this.time.delayedCall(40, () => s.image.clearTint());
    }
    if (!this.reduceMotion) {
      this.tweens.add({ targets: s.image, scaleX: 1.12, scaleY: 0.88, duration: 50, yoyo: true, ease: 'Quad.easeOut' });
      s.container.x += crit ? 34 : 20;
    }
  }

  private onEvents(events: CoreEvent[]) {
    if (!this.sys.isActive()) return;
    for (const e of events) {
      switch (e.type) {
        case 'playerHit': {
          this.attackAnim();
          const s = this.enemies.get(e.enemyUid);
          if (!s) break;
          const hx = s.container.x - s.size * 0.25;
          const hy = s.container.y - s.size * 0.5;
          this.hitReact(s, e.crit);
          if (e.crit) {
            this.critShards.explode(12, hx, hy);
            this.ring(hx, hy, 0xffd54f, 1.6, 300);
            this.stamp(hx, hy - s.size * 0.5 - 30, t('battle.crit'), '#FFD54F');
            this.floatText(hx, hy - s.size * 0.3, Math.round(e.amount).toString(), '#FFD54F', 64, 1000);
            this.shake(90, 0.004);
            this.punch();
          } else {
            this.sparks.explode(5, hx, hy);
            this.floatText(hx, hy - s.size * 0.3, Math.round(e.amount).toString(), '#FFFFFF', 42);
          }
          break;
        }
        case 'enemyHit': {
          const s = this.enemies.get(e.enemyUid);
          if (s && !this.reduceMotion) this.tweens.add({ targets: s.container, x: s.container.x - 36, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
          if (!this.reduceFlashing) {
            this.raccoonImg.setTintFill(0xff6b6b);
            this.time.delayedCall(70, () => this.raccoonImg.clearTint());
          }
          this.floatText(RACCOON_X, GROUND_Y - 270, `-${Math.round(e.amount)}`, '#FF8A80', e.heavy ? 54 : 34);
          if (e.heavy) {
            this.shake(200, 0.012);
            this.punch();
          }
          break;
        }
        case 'playerDodge':
          this.floatText(RACCOON_X, GROUND_Y - 270, t('battle.dodge'), PAL.neonCyan, 34);
          break;
        case 'heal':
          if (e.amount >= 1) this.floatText(RACCOON_X - 60, GROUND_Y - 230, `+${Math.round(e.amount)}`, PAL.heal, 30);
          break;
        case 'bossSpecial': {
          const s = this.enemies.get(e.enemyUid);
          if (s) this.stamp(s.container.x, s.container.y - s.size - 30, `${e.name}!`, '#FF9800');
          break;
        }
        case 'kill': {
          const s = this.enemies.get(e.enemyUid);
          if (s) {
            const x = s.container.x;
            const y = s.container.y - s.size * 0.45;
            const n = e.kind === 'regular' ? 4 : 10;
            this.confetti.forEach((em) => em.explode(n, x, y));
            this.smoke.explode(e.kind === 'regular' ? 3 : 8, x, y);
            this.coinsToCounter(x, y, e.kind === 'boss' ? 14 : e.kind === 'miniboss' ? 7 : 2);
            if (!s.dying) this.knockOff(s);
          }
          if (e.kind !== 'regular') this.shake(300, 0.014);
          break;
        }
        case 'bagDrop':
          this.bagDrop(e.count);
          break;
        case 'levelUp':
          this.ring(RACCOON_X, GROUND_Y - 120, hexToNum(PAL.gold), 4, 1000);
          this.motes.explode(30, RACCOON_X, GROUND_Y - 80);
          this.floatText(RACCOON_X, GROUND_Y - 330, t('battle.levelUp'), PAL.gold, 48, 1000);
          break;
        case 'playerDeath':
          this.dead = true;
          this.tweens.killTweensOf(this.raccoon);
          this.attacking = false;
          this.tweens.add({ targets: this.raccoon, angle: -90, y: GROUND_Y - 30, alpha: 0.6, duration: 400 });
          break;
        case 'stageStart':
          this.clearEnemies();
          if (this.dead) {
            this.dead = false;
            this.tweens.killTweensOf(this.raccoon);
            this.raccoon.setAngle(0).setAlpha(1).setPosition(RACCOON_X, GROUND_Y);
          }
          break;
      }
    }
  }

  // ------------------------------------------------------------------ enemies
  private makeEnemy(enemyId: string, kind: string, index: number): EnemySprite {
    const ph = enemyPlaceholder(enemyId);
    const size = ph.size;
    const box = enemyTexBox(size);
    const container = this.add.container(BATTLE_W + size + index * 80, GROUND_Y).setDepth(11 - index * 0.01);
    const shadow = this.add.ellipse(0, 4, size * 0.9, size * 0.14, 0x000000, 0.35);
    const image = this.add.image(0, 0, enemyTexKey(enemyId)).setOrigin(0.5, (box.h - box.pad) / box.h);
    const hpBar = this.add.graphics();
    container.add([shadow, image, hpBar]);
    if (kind === 'regular') {
      const label = this.add
        .text(0, -size - 14, ph.label, { fontFamily: FONT, fontSize: '22px', color: '#FFFFFF' })
        .setOrigin(0.5, 1)
        .setStroke(PAL.outline, 6);
      container.add(label);
    }
    // Idle breathing so nothing sits perfectly still.
    this.tweens.add({ targets: image, scaleY: 1.04, duration: 500 + index * 70, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return { uid: 0, container, image, hpBar, size, dying: false };
  }

  private syncEnemies(g: GameState, dtMs: number) {
    const alive = new Set<number>();
    let slotX = ENEMY_FRONT_LEFT;
    g.battle.enemies.forEach((e, i) => {
      alive.add(e.uid);
      let s = this.enemies.get(e.uid);
      if (!s) {
        s = this.makeEnemy(e.enemyId, e.kind, i);
        s.uid = e.uid;
        this.enemies.set(e.uid, s);
      }
      const targetX = slotX + s.size * 0.45;
      slotX += s.size * 0.85 + 12;
      if (s.dying) return;
      const k = 1 - Math.pow(0.004, dtMs / 1000);
      s.container.x += (targetX - s.container.x) * k;
      s.hpBar.clear();
      if (e.kind === 'regular') {
        const w = Math.max(70, s.size * 0.7);
        s.hpBar.fillStyle(OUTLINE, 0.85).fillRoundedRect(-w / 2, 10, w, 14, 6);
        s.hpBar.fillStyle(hexToNum(PAL.danger), 1).fillRoundedRect(-w / 2 + 3, 13, (w - 6) * Math.max(0, e.hp / e.maxHp), 8, 4);
      }
    });
    for (const [uid, s] of this.enemies) {
      if (!alive.has(uid) && !s.dying) this.knockOff(s);
    }
    const boss = g.battle.enemies.find((e) => e.kind !== 'regular');
    this.bossBar.clear();
    if (boss) {
      const w = 520;
      const x = (BATTLE_W - w) / 2 + 40;
      this.bossBar.fillStyle(OUTLINE, 0.9).fillRoundedRect(x - 6, 36, w + 12, 40, 12);
      this.bossBar
        .fillStyle(boss.kind === 'boss' ? hexToNum(PAL.gold) : hexToNum(PAL.danger), 1)
        .fillRoundedRect(x, 42, w * Math.max(0, boss.hp / boss.maxHp), 28, 9);
      this.bossBar.fillStyle(0xffffff, 0.3).fillRoundedRect(x + 8, 46, Math.max(0, w * (boss.hp / boss.maxHp) - 16), 7, 4);
      this.bossName.setText(DATA.enemiesById.get(boss.enemyId)?.name ?? '');
    } else {
      this.bossName.setText('');
    }
  }

  /** Deaths spin off screen; never a lingering body. */
  private knockOff(s: EnemySprite) {
    s.dying = true;
    s.hpBar.clear();
    this.tweens.add({
      targets: s.container,
      x: s.container.x + 760,
      y: s.container.y - 420,
      angle: 560,
      scale: 0.6,
      duration: 650,
      ease: 'Quad.easeOut',
      onComplete: () => {
        s.container.destroy();
        this.enemies.delete(s.uid);
      },
    });
  }

  private clearEnemies() {
    for (const s of this.enemies.values()) s.container.destroy();
    this.enemies.clear();
  }

  private maxHp(g: GameState): number {
    if (this.hpCache.key !== g.equipped || this.hpCache.hp <= 0) this.hpCache = { key: g.equipped, hp: computeStats(g).HP };
    return this.hpCache.hp;
  }

  update(_time: number, delta: number) {
    const g = gameStore.getState().game;
    const b = g.battle;
    if (neighborhoodFor(b.stage).background !== this.bgId) {
      this.scene.restart();
      return;
    }
    if (b.phase === 'walking') {
      const speed = delta * 0.4;
      this.far.tilePositionX += speed * 0.2;
      this.mid.tilePositionX += speed * 0.5;
      this.props.tilePositionX += speed * 0.5;
      this.ground.tilePositionX += speed;
      this.fg.tilePositionX += speed * 1.3;
      if (!this.reduceMotion && !this.dead) this.raccoonBody.setAngle(Math.sin(this.time.now / 90) * 3);
    } else {
      this.raccoonBody.setAngle(0);
    }
    // The neon sign rides the mid layer and wraps around.
    let sx = 820 - (this.mid.tilePositionX % BG_TILE_W);
    if (sx < -300) sx += BG_TILE_W;
    this.sign.setPosition(sx, 360);

    const sig = SLOTS.map((s) => `${g.equipped[s]?.uid ?? 0}`).join(',');
    if (sig !== this.gearSig) {
      this.gearSig = sig;
      this.drawGear(g);
    }
    this.syncEnemies(g, delta);

    const maxHp = Math.max(1, b.playerHp, this.maxHp(g));
    this.playerHpBar.clear();
    if (b.phase !== 'dead') {
      const w = 170;
      const x = RACCOON_X - w / 2;
      const y = GROUND_Y + 24;
      this.playerHpBar.fillStyle(OUTLINE, 0.85).fillRoundedRect(x - 4, y - 4, w + 8, 22, 8);
      this.playerHpBar.fillStyle(hexToNum(PAL.heal), 1).fillRoundedRect(x, y, w * Math.max(0, b.playerHp / maxHp), 14, 6);
    }
  }
}

export function createBattleGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: BATTLE_W,
    height: BATTLE_H,
    backgroundColor: DATA.assets.placeholders.palette.nightSky,
    scale: { mode: Phaser.Scale.NONE },
    render: { antialias: true, pixelArt: false },
    input: { mouse: false, touch: false, keyboard: false, gamepad: false },
    audio: { noAudio: true },
    banner: false,
    scene: [BattleScene],
  });
}
