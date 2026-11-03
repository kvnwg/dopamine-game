/**
 * Effect particles on the art grid (sparks, crit bursts, dust, flames, confetti, aura glints). Each
 * bit is a square of whole art pixels (1 x 1 or 2 x 2; confetti 2 x 1 and 1 x 2, turning between the
 * two to tumble) drawn at whole art pixels. Over its life it steps through sizes, colors and
 * opacities: no smooth scaling, no rotation, so every bit stays on the battle's pixel grid.
 * Speeds are in art pixels, so a burst keeps its size next to the characters whatever P is.
 */
import Phaser from 'phaser';
import { P, toCanvas } from './pixel';
import { blank, setPx } from './pixel/buf';

export type Range = readonly [number, number];

export interface BitStyle {
  /** Launch speed (art px per second) and direction in degrees (0 = right, 90 = down). */
  speed?: Range;
  angle?: Range;
  /** Or launch velocity per axis (art px per second). */
  speedX?: Range;
  speedY?: Range;
  /** Life in milliseconds. */
  life: Range;
  /** Downward pull (art px per second squared) and air drag (share of speed lost per second). */
  gravity?: number;
  drag?: number;
  /** One color is picked per bit from `colors`; `fade` colors, if given, take over in steps as it ages. */
  colors: readonly number[];
  fade?: readonly number[];
  /** Size in art pixels over its life, in steps (default 1). */
  sizes?: readonly (1 | 2)[];
  /** Opacity over its life, in steps (default 1). */
  alpha?: readonly number[];
  /** Confetti: a 2 x 1 strip that turns to 1 x 2 and back every this many ms. */
  tumble?: number;
}

interface Bit {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  color: number;
  style: BitStyle;
  /** Tumble phase offset. */
  phase: number;
}

const between = (r: Range) => r[0] + Math.random() * (r[1] - r[0]);
/** The step of `list` an age fraction `k` (0..1) falls in. */
const step = <T>(list: readonly T[], k: number): T => list[Math.min(list.length - 1, Math.floor(k * list.length))];

/** White squares of whole art pixels, pre-scaled to the grid: 1 x 1, 2 x 2, 2 x 1 and 1 x 2. */
function ensureTextures(scene: Phaser.Scene): void {
  const make = (key: string, w: number, h: number) => {
    if (scene.textures.exists(key)) return;
    const b = blank(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) setPx(b, x, y, '#ffffff');
    scene.textures.addCanvas(key, toCanvas(b));
  };
  make('bit1', 1, 1);
  make('bit2', 2, 2);
  make('bit21', 2, 1);
  make('bit12', 1, 2);
}

export class PixelBits {
  private live: Bit[] = [];
  private pool: Phaser.GameObjects.Image[] = [];

  constructor(private scene: Phaser.Scene, private depth: number, private max = 160) {
    ensureTextures(scene);
  }

  /** Sends `n` bits flying from (x, y) (screen px). */
  burst(n: number, x: number, y: number, style: BitStyle): void {
    for (let i = 0; i < n && this.live.length < this.max; i++) {
      let vx: number;
      let vy: number;
      if (style.speedX || style.speedY) {
        vx = (style.speedX ? between(style.speedX) : 0) * P;
        vy = (style.speedY ? between(style.speedY) : 0) * P;
      } else {
        const sp = between(style.speed ?? [11, 22]) * P;
        const a = Phaser.Math.DegToRad(between(style.angle ?? [0, 360]));
        vx = Math.cos(a) * sp;
        vy = Math.sin(a) * sp;
      }
      const img = (this.pool.pop() ?? this.scene.add.image(0, 0, 'bit1').setOrigin(0, 0)).setVisible(true).setDepth(this.depth);
      const color = style.colors[Math.floor(Math.random() * style.colors.length)];
      const bit: Bit = { img, x, y, vx, vy, age: 0, life: between(style.life) / 1000, color, style, phase: Math.random() * 1000 };
      this.live.push(bit);
      this.draw(bit);
    }
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const b = this.live[i];
      b.age += dt;
      if (b.age >= b.life) {
        b.img.setVisible(false);
        this.pool.push(b.img);
        this.live.splice(i, 1);
        continue;
      }
      const s = b.style;
      if (s.drag) {
        const k = Math.max(0, 1 - s.drag * dt);
        b.vx *= k;
        b.vy *= k;
      }
      b.vy += (s.gravity ?? 0) * P * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      this.draw(b);
    }
  }

  private draw(b: Bit): void {
    const s = b.style;
    const k = b.age / b.life;
    let key = 'bit1';
    let w = 1;
    let h = 1;
    if (s.tumble) {
      const flat = Math.floor((b.age * 1000 + b.phase) / s.tumble) % 2 === 0;
      key = flat ? 'bit21' : 'bit12';
      w = flat ? 2 : 1;
      h = flat ? 1 : 2;
    } else if (step(s.sizes ?? [1], k) === 2) {
      key = 'bit2';
      w = h = 2;
    }
    if (b.img.texture.key !== key) b.img.setTexture(key);
    const color = s.fade ? step([b.color, ...s.fade], k) : b.color;
    b.img.setTint(color).setAlpha(step(s.alpha ?? [1], k));
    // Centered on its spot, on whole art pixels.
    b.img.setPosition(Math.round(b.x / P - w / 2) * P, Math.round(b.y / P - h / 2) * P);
  }

  /** How many bits are flying. */
  get count(): number {
    return this.live.length;
  }

  destroy(): void {
    for (const b of this.live) b.img.destroy();
    for (const img of this.pool) img.destroy();
    this.live = [];
    this.pool = [];
  }
}
