/**
 * The living parts of a world's backdrop, on the battle pixel grid (every sprite sits on whole art
 * pixels): twinkling stars and shooting stars at night, flocks of birds by day, drifting particles (fireflies, leaves,
 * petals, snow, rain, embers, spores, sparkles, wisps, dust motes), lightning in storms and the
 * flicker of torch flames and their glow. The still parts (sky, clouds, lit scenery) are painted by
 * pixel/atmosphere.ts; this only moves things.
 *
 * Purely visual: it uses its own seeded generator, not the game's Rng. Reduce motion hides drifting
 * particles and shooting stars; reduce flashing turns lightning off.
 *
 * Particle bands, sizes and speeds are written for the legacy 82-row scene frame (like a world's
 * atmosphere) and mapped into the shown set's frame: rows by its top and scale, distances and speeds
 * by its scale, so particles keep their place in the scenery and their speed on screen.
 */
import Phaser from 'phaser';
import type { Atmo, ParticleKind } from '../data';
import { P, toCanvas } from './pixel';
import { blank, fromRows, setPx, type PixelBuf } from './pixel/buf';
import { twinkleSpots } from './pixel/atmosphere';
import { VIEW, VIEW_MARGIN, type LayerName, type LightSpot } from './pixel/sceneryTypes';

/** Seeded 0..1 generator (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ textures

/** Tiny white sprites (tinted per use) and the torch flames, pre-scaled to the pixel grid. */
const SPRITES: Record<string, readonly string[]> = {
  amb_px: ['w'],
  /** A glowing dot: bright core, dimmer arms (drawn additively). */
  amb_glow: ['.4.', '4w4', '.4.'],
  amb_plus: ['.w.', 'www', '.w.'],
  /** A four-point glint for sparkles at their peak. */
  amb_star: ['..4..', '..w..', '4www4', '..w..', '..4..'],
  amb_drop: ['4', 'w'],
  /** Storm rain: longer streaks. */
  amb_drop3: ['4', 'w', 'w'],
  amb_leaf0: ['w.', '.w'],
  amb_leaf1: ['ww'],
  amb_leaf2: ['.w', 'w.'],
  amb_petal: ['ww'],
  // A far-off bird, wings up and down.
  amb_bird0: ['w...w', '.w.w.', '..w..'],
  amb_bird1: ['.....', 'ww.ww', '..w..'],
  amb_flake: ['w'],
  // The drifting kinds again, for a set drawn 1.5 times finer (frameScale): drawn bigger in art
  // pixels, so they keep their size on screen (FINE).
  amb_glow_f: ['.44.', '4ww4', '4ww4', '.44.'],
  amb_drop_f: ['4', 'w', 'w'],
  amb_drop3_f: ['4', '4', 'w', 'w', 'w'],
  amb_flake_f: ['4w', 'w4'],
  amb_leaf0_f: ['ww.', '.ww'],
  amb_leaf1_f: ['www', '.w.'],
  amb_leaf2_f: ['.ww', 'ww.'],
  amb_petal_f: ['.w', 'ww'],
  // Torch flames (5 x 5, over the 5 x 4 flame painted on the wall; each frame covers it).
  amb_flame0: ['.....', '..Y..', '.yYy.', '.OYO.', '.oOo.'],
  amb_flame1: ['..y..', '.yYy.', '.yYY.', '.OYO.', '.oOo.'],
  amb_flame2: ['.y...', '.yY..', '.YYy.', '.OyO.', '.oOo.'],
  amb_flame3: ['...y.', '..Yy.', '.yYY.', '.OYO.', '.oOo.'],
};

/** A soft glow in stepped rings (radius `r` art pixels), white, for additive flicker over torches. */
function haloBuf(r: number): PixelBuf {
  const b = blank(r * 2 + 1, r * 2 + 1);
  const px = b.px;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const d = Math.hypot(x - r, y - r) / r;
      const a = d < 0.35 ? 0.42 : d < 0.62 ? 0.27 : d < 0.88 ? 0.14 : 0;
      if (!a) continue;
      setPx(b, x, y, '#ffffff');
      px[(y * b.w + x) * 4 + 3] = Math.round(a * 255);
    }
  }
  return b;
}

function ensureTextures(scene: Phaser.Scene): void {
  for (const [key, rows] of Object.entries(SPRITES)) {
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, toCanvas(fromRows(rows)));
  }
  if (!scene.textures.exists('amb_halo')) scene.textures.addCanvas('amb_halo', toCanvas(haloBuf(12)));
  if (!scene.textures.exists('amb_flash')) scene.textures.addCanvas('amb_flash', toCanvas(fromRows(['w'])));
}

// ------------------------------------------------------------------ particle kinds

interface KindDef {
  count: number;
  /** Texture keys (several: cycled as tumble frames). */
  tex: readonly string[];
  colors: readonly string[];
  add?: boolean;
  /** Where particles appear: anywhere in the band, at the top edge (falling) or the bottom (rising). */
  spawn: 'band' | 'top' | 'bottom';
  /**
   * Rows of the legacy scene frame the particles live in (negative: above it), mapped into the set's
   * frame; 'top' is the top of the view (falling kinds start there).
   */
  rows: readonly [number | 'top', number];
  /** Speeds in legacy frame pixels per second (times the set's scale on the view's grid). */
  vx: readonly [number, number];
  vy: readonly [number, number];
  /** Side-to-side sway (legacy frame pixels) and its speed (radians per second). */
  sway?: readonly [number, number];
  /** Wandering: velocity drifts randomly (fireflies, wisps, spores). */
  wander?: number;
  /** Brightness pulses (fireflies, spores, wisps): seconds per cycle. */
  pulse?: readonly [number, number];
  /** Sparkles: blink in place (dot, glint, dot, gone), then move. */
  glint?: boolean;
  /** Seconds per tumble frame. */
  tumble?: number;
  alpha: readonly [number, number];
  /** Share drawn in front of the fighters. */
  front: number;
  /** How much walking slides them past (1 = with the ground). */
  parallax: number;
}

const KINDS: Record<ParticleKind, KindDef> = {
  fireflies: {
    count: 10, tex: ['amb_glow'], colors: ['#E8FF7A', '#FFE66A'], add: true, spawn: 'band', rows: [30, 62],
    vx: [-2, 2], vy: [-1.5, 1.5], wander: 3, pulse: [1.6, 3.2], alpha: [0.9, 1], front: 0.3, parallax: 0.6,
  },
  snow: {
    count: 52, tex: ['amb_flake'], colors: ['#FFFFFF', '#EAF4FF'], spawn: 'top', rows: ['top', 69],
    vx: [-3, -1], vy: [5, 10], sway: [1.2, 1.6], alpha: [0.75, 1], front: 0.35, parallax: 0.7,
  },
  rain: {
    count: 80, tex: ['amb_drop'], colors: ['#BFD4F0', '#9FB6D8'], spawn: 'top', rows: ['top', 69],
    vx: [-16, -12], vy: [80, 100], alpha: [0.45, 0.7], front: 0.4, parallax: 0.6,
  },
  leaves: {
    count: 10, tex: ['amb_leaf0', 'amb_leaf1', 'amb_leaf2', 'amb_leaf1'], colors: ['#E8742A', '#C8402A', '#F2B03A', '#B85A1E'],
    spawn: 'top', rows: ['top', 66], vx: [-9, -4], vy: [7, 12], sway: [2, 2.2], tumble: 0.22, alpha: [1, 1], front: 0.4, parallax: 0.8,
  },
  petals: {
    count: 12, tex: ['amb_petal', 'amb_flake'], colors: ['#FFD0E0', '#FFFFFF', '#FFB0C8'], spawn: 'top', rows: ['top', 66],
    vx: [-9, -5], vy: [4, 8], sway: [1.6, 2], tumble: 0.3, alpha: [0.9, 1], front: 0.4, parallax: 0.8,
  },
  embers: {
    count: 16, tex: ['amb_px'], colors: ['#FFB04A', '#FF6A2A', '#FFE08A'], add: true, spawn: 'bottom', rows: [20, 68],
    vx: [-2, 2], vy: [-14, -7], sway: [1, 2.6], pulse: [0.5, 1.2], alpha: [0.8, 1], front: 0.35, parallax: 0.7,
  },
  spores: {
    count: 14, tex: ['amb_glow', 'amb_px'], colors: ['#7AFFE0', '#FF9AE8'], add: true, spawn: 'bottom', rows: [24, 66],
    vx: [-1.5, 1.5], vy: [-4, -2], wander: 1.5, pulse: [2, 4], alpha: [0.8, 1], front: 0.3, parallax: 0.6,
  },
  sparkles: {
    count: 11, tex: ['amb_px', 'amb_star'], colors: ['#FFFFFF'], add: true, spawn: 'band', rows: [-11, 62],
    vx: [0, 0], vy: [0, 0], glint: true, alpha: [1, 1], front: 0.3, parallax: 0.5,
  },
  wisps: {
    count: 5, tex: ['amb_glow'], colors: ['#9AF0D0', '#B8C8FF'], add: true, spawn: 'band', rows: [32, 60],
    vx: [-3, 3], vy: [-1, 1], wander: 2, sway: [1.5, 0.8], pulse: [2.5, 4], alpha: [0.7, 0.9], front: 0.2, parallax: 0.5,
  },
  motes: {
    count: 12, tex: ['amb_px'], colors: ['#FFF8D8'], spawn: 'band', rows: [18, 60],
    vx: [0.5, 2.5], vy: [-1, 0.6], wander: 0.8, pulse: [3, 6], alpha: [0.35, 0.6], front: 0.3, parallax: 0.6,
  },
};

/** A particle kind on the view's grid for a set's frame (top row and scale): view rows, view-pixel speeds. */
interface Kind extends Omit<KindDef, 'rows'> {
  rows: readonly [number, number];
}

/** Sprites with a bigger version for sets drawn 1.5 times finer (the `_f` sprites). */
const FINE = new Set(['amb_glow', 'amb_drop', 'amb_drop3', 'amb_flake', 'amb_leaf0', 'amb_leaf1', 'amb_leaf2', 'amb_petal']);

function inFrame(def: KindDef, top: number, k: number): Kind {
  const row = (r: number | 'top') => (r === 'top' ? 0 : Math.round(top + r * k));
  const times = (a: readonly [number, number] | undefined) => a && ([a[0] * k, a[1] * k] as const);
  return {
    ...def,
    tex: k >= 1.5 ? def.tex.map((t) => (FINE.has(t) ? `${t}_f` : t)) : def.tex,
    rows: [row(def.rows[0]), row(def.rows[1])],
    vx: times(def.vx)!,
    vy: times(def.vy)!,
    sway: def.sway && [def.sway[0] * k, def.sway[1]],
    wander: def.wander && def.wander * k,
  };
}

interface Mote {
  img: Phaser.GameObjects.Image;
  def: Kind;
  /** Position in art pixels (fractional; drawn snapped). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  phase: number;
  period: number;
  alpha: number;
  /** Sparkles: time left in the current blink, and the wait before the next. */
  wait: number;
}

interface Flicker {
  flame: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  layer: LayerName;
  spot: LightSpot;
  t: number;
  next: number;
  seed: number;
}

export interface AmbienceWorld {
  /** The atmosphere in view rows (worldLook.ts viewAtmo). */
  atmo: Atmo;
  seed: number;
  /** The set's frame top in the view and its scale (sceneryTypes.ts frameTop, frameScale). */
  top: number;
  scale: number;
  /** Whether the world has a sky (no stars or lightning in the dungeon). */
  sky: boolean;
  /** Torches and other flickering lights, per layer. */
  flicker: ReadonlyArray<{ layer: LayerName; spot: LightSpot }>;
  /** Layer tops in screen pixels and tile widths in art pixels (to follow scrolling layers). */
  layerY: Readonly<Record<LayerName, number>>;
  tileW: number;
}

export interface AmbienceDepths {
  /** Behind the clouds (twinkling and shooting stars). */
  stars: number;
  /** Lightning bolts, behind the far scenery. */
  bolt: number;
  /** Torch flames and glow, just over their layer. */
  torch: number;
  /** Particles behind the fighters, and in front of them (over the foreground layer). */
  back: number;
  front: number;
  /** The lightning flash over the whole view. */
  flash: number;
}

export class Ambience {
  private motes: Mote[] = [];
  private twinkles: Array<{ img: Phaser.GameObjects.Image; x: number; y: number; t: number }> = [];
  private shooting: Array<{ img: Phaser.GameObjects.Image; k: number }> = [];
  private shoot = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, wait: 6 };
  /** The shown world's scale (sceneryTypes.ts frameScale): sky distances and speeds are times this. */
  private k = 1;
  private flickers: Flicker[] = [];
  /** A small flock crossing a day sky now and then. */
  private birds: Array<{ img: Phaser.GameObjects.Image; dx: number; dy: number; phase: number }> = [];
  private flock = { active: false, x: 0, y: 0, vx: 0, t: 0, wait: 8 };
  private flash: Phaser.GameObjects.Image;
  private bolt: Phaser.GameObjects.Graphics;
  private storm = { wait: 4, bolt: 0, flash: 0 };
  private world: AmbienceWorld | null = null;
  private rand = rng(1);

  constructor(private scene: Phaser.Scene, private depth: AmbienceDepths) {
    ensureTextures(scene);
    const m = VIEW_MARGIN;
    this.flash = scene.add.image(-m * P, -m * P, 'amb_flash').setOrigin(0, 0).setDisplaySize((VIEW.w + 2 * m) * P, (VIEW.h + 2 * m) * P)
      .setDepth(depth.flash).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setVisible(false);
    this.bolt = scene.add.graphics().setDepth(depth.bolt).setVisible(false);
    for (let k = 0; k < 6; k++) {
      this.shooting.push({ img: scene.add.image(0, 0, 'amb_px').setOrigin(0, 0).setDepth(depth.stars).setVisible(false), k });
    }
    for (let k = 0; k < 5; k++) {
      const img = scene.add.image(0, 0, 'amb_bird0').setOrigin(0, 0).setDepth(depth.stars + 0.6).setVisible(false);
      // A V: the leader, then pairs trailing behind it, one above and one below (legacy frame pixels).
      const side = k === 0 ? 0 : k % 2 ? -1 : 1;
      this.birds.push({ img, dx: Math.ceil(k / 2) * 6, dy: side * Math.ceil(k / 2) * 3, phase: k * 0.7 });
    }
  }

  /** Builds the particles and lights for a world (replacing the last world's). */
  setWorld(w: AmbienceWorld): void {
    this.world = w;
    this.k = w.scale;
    this.rand = rng(w.seed);
    for (const m of this.motes) m.img.destroy();
    for (const t of this.twinkles) t.img.destroy();
    for (const f of this.flickers) {
      f.flame.destroy();
      f.glow.destroy();
    }
    this.motes = [];
    this.twinkles = [];
    this.flickers = [];
    this.shoot.active = false;
    this.flock = { active: false, x: 0, y: 0, vx: 0, t: 0, wait: 3 + this.rand() * 6 };
    const ink = Phaser.Display.Color.HexStringToColor(w.atmo.sky[0]).darken(45).color;
    for (const b of this.birds) b.img.setVisible(false).setTint(ink);
    this.storm = { wait: 3 + this.rand() * 4, bolt: 0, flash: 0 };
    this.bolt.clear().setVisible(false);
    this.flash.setAlpha(0).setVisible(false);
    for (const s of this.shooting) s.img.setVisible(false);
    const { atmo } = w;

    if (w.sky && atmo.stars > 0) {
      for (const p of twinkleSpots(atmo, Math.round(4 + atmo.stars * 10), w.seed, w.scale)) {
        const img = this.scene.add.image(p.x * P, p.y * P, 'amb_px').setOrigin(0, 0).setDepth(this.depth.stars);
        this.twinkles.push({ img, x: p.x, y: p.y, t: this.rand() * 2 });
      }
    }

    const kinds: ParticleKind[] = [];
    if (atmo.particles) kinds.push(atmo.particles);
    if (atmo.weather === 'rain' || atmo.weather === 'storm') kinds.push('rain');
    if (atmo.weather === 'snow') kinds.push('snow');
    for (const kind of kinds) {
      const base = KINDS[kind];
      const def: KindDef = kind === atmo.particles && atmo.particleColors ? { ...base, colors: atmo.particleColors } : base;
      const storm = kind === 'rain' && atmo.weather === 'storm';
      const use = inFrame(storm ? { ...def, tex: ['amb_drop3'], vy: [105, 125] as const, vx: [-24, -18] as const } : def, w.top, w.scale);
      const count = storm ? Math.round(def.count * 1.4) : def.count;
      for (let i = 0; i < count; i++) this.motes.push(this.spawn(use, i, count, true));
    }

    for (const { layer, spot } of w.flicker) {
      const flame = this.scene.add.image(0, 0, 'amb_flame0').setOrigin(0, 0).setDepth(this.depth.torch);
      const glow = this.scene.add.image(0, 0, 'amb_halo').setOrigin(0.5, 0.5).setDepth(this.depth.torch)
        .setBlendMode(Phaser.BlendModes.ADD).setTint(Phaser.Display.Color.HexStringToColor(spot.color ?? atmo.light).color);
      this.flickers.push({ flame, glow, layer, spot, t: 0, next: 0, seed: this.rand() * 100 });
    }
  }

  private spawn(def: Kind, i: number, count: number, first: boolean): Mote {
    const r = this.rand;
    const between = (a: readonly [number, number]) => a[0] + (a[1] - a[0]) * r();
    const front = r() < def.front;
    const img = this.scene.add.image(0, 0, def.tex[0]).setOrigin(0, 0)
      .setDepth(front ? this.depth.front : this.depth.back)
      .setTint(Phaser.Display.Color.HexStringToColor(def.colors[i % def.colors.length]).color);
    if (def.add) img.setBlendMode(Phaser.BlendModes.ADD);
    const m: Mote = {
      img, def, x: 0, y: 0, vx: between(def.vx), vy: between(def.vy), t: r() * 10, phase: r() * Math.PI * 2,
      period: def.pulse ? between(def.pulse) : 1, alpha: between(def.alpha), wait: r() * 3,
    };
    this.place(m, first, i / count);
    return m;
  }

  /** Puts a particle at its start: anywhere in its band on the first build, else at its spawn edge. */
  private place(m: Mote, anywhere: boolean, slot: number): void {
    const r = this.rand;
    const k = this.k;
    const [top, bottom] = m.def.rows;
    m.x = (slot + r() * 0.9) * VIEW.w * 1.15 - 4;
    if (anywhere || m.def.spawn === 'band') m.y = top + r() * (bottom - top);
    else if (m.def.spawn === 'top') m.y = top - (2 + r() * 6) * k;
    else m.y = bottom + r() * 4 * k;
    if (!anywhere && m.def.spawn !== 'band') m.x = r() * (VIEW.w + 20) - 4 + (m.def.spawn === 'top' ? Math.max(0, -m.vx) * 3 : 0);
  }

  /**
   * Moves everything. `walk` is how far the ground slid this frame (screen pixels), `scroll` gives a
   * layer's current tile offset (screen pixels) so torches stay on their walls.
   */
  update(dt: number, walk: number, scroll: (layer: LayerName) => number, opts: { reduceMotion: boolean; reduceFlashing: boolean }): void {
    const w = this.world;
    if (!w) return;
    const still = opts.reduceMotion;
    const walkArt = walk / P;

    for (const m of this.motes) {
      m.img.setVisible(!still);
      if (still) continue;
      this.moveMote(m, dt, walkArt);
    }

    for (const tw of this.twinkles) {
      tw.t -= dt;
      if (tw.t > 0) continue;
      // Stepped brightness: dim, mid, bright, now and then a cross-shaped flare.
      const r = this.rand();
      const level = r < 0.3 ? 0 : r < 0.7 ? 1 : r < 0.95 ? 2 : 3;
      tw.t = 0.25 + this.rand() * (still ? 3 : 1.2);
      const flare = level === 3 && !still;
      tw.img.setTexture(flare ? 'amb_plus' : 'amb_px');
      tw.img.setPosition((flare ? tw.x - 1 : tw.x) * P, (flare ? tw.y - 1 : tw.y) * P);
      tw.img.setAlpha([0.35, 0.65, 1, 0.85][level]);
    }

    this.updateShootingStar(dt, w, still);
    this.updateBirds(dt, w, still);
    this.updateStorm(dt, w, opts);
    this.updateFlicker(dt, w, scroll);
  }

  private moveMote(m: Mote, dt: number, walkArt: number): void {
    const d = m.def;
    m.t += dt;
    if (d.wander) {
      m.vx += (this.rand() - 0.5) * d.wander * dt * 4;
      m.vy += (this.rand() - 0.5) * d.wander * dt * 4;
      const cap = d.wander * 1.4;
      m.vx = Math.max(-cap, Math.min(cap, m.vx));
      m.vy = Math.max(-cap * 0.7, Math.min(cap * 0.7, m.vy));
    }
    m.x += m.vx * dt - walkArt * d.parallax;
    m.y += m.vy * dt;
    const [top, bottom] = d.rows;
    if (d.spawn === 'band') {
      if (m.y < top) m.vy = Math.abs(m.vy);
      if (m.y > bottom) m.vy = -Math.abs(m.vy);
    }
    const out = m.x < -8 || m.x > VIEW.w + 8 || (d.spawn === 'top' && m.y > bottom + 2 * this.k) || (d.spawn === 'bottom' && m.y < top - 2 * this.k);
    if (out) {
      if (d.spawn === 'band') {
        m.x = m.x < -8 ? VIEW.w + 6 : m.x > VIEW.w + 8 ? -6 : m.x;
      } else {
        this.place(m, false, 0);
      }
    }
    let x = m.x;
    if (d.sway) x += Math.sin(m.t * d.sway[1] + m.phase) * d.sway[0];
    let alpha = m.alpha;
    if (d.pulse) {
      // Three brightness steps, like a pixel-art blink cycle.
      const s = 0.5 + 0.5 * Math.sin((m.t / m.period) * Math.PI * 2 + m.phase);
      alpha *= s > 0.66 ? 1 : s > 0.33 ? 0.55 : 0.18;
    }
    if (d.glint) {
      m.wait -= dt;
      if (m.wait <= 0) {
        // Blink: dot, glint, dot, then a pause somewhere else.
        const k = -m.wait;
        if (k > 0.75) {
          m.wait = 0.6 + this.rand() * 2.4;
          m.x = 2 + this.rand() * (VIEW.w - 4);
          m.y = d.rows[0] + this.rand() * (d.rows[1] - d.rows[0]);
          alpha = 0;
        } else {
          const peak = k > 0.25 && k < 0.5;
          m.img.setTexture(peak ? 'amb_star' : 'amb_px');
          alpha = k < 0.12 || k > 0.62 ? 0.5 : 1;
          x = peak ? m.x - 2 : m.x;
          m.img.setPosition(Math.round(x) * P, Math.round(peak ? m.y - 2 : m.y) * P).setAlpha(alpha);
          return;
        }
      } else {
        alpha = 0;
      }
    }
    if (d.tumble) m.img.setTexture(d.tex[Math.floor(m.t / d.tumble + m.phase) % d.tex.length]);
    m.img.setPosition(Math.round(x) * P, Math.round(m.y) * P).setAlpha(alpha);
  }

  private updateShootingStar(dt: number, w: AmbienceWorld, still: boolean): void {
    const s = this.shoot;
    const can = w.sky && w.atmo.stars >= 0.35 && !still;
    if (!s.active) {
      for (const p of this.shooting) p.img.setVisible(false);
      if (!can) return;
      s.wait -= dt;
      if (s.wait > 0) return;
      s.active = true;
      s.x = 20 + this.rand() * (VIEW.w - 10);
      s.y = 2 + this.rand() * w.atmo.horizon * 0.3;
      s.vx = -(38 + this.rand() * 20) * this.k;
      s.vy = (14 + this.rand() * 8) * this.k;
      s.life = 0.55 + this.rand() * 0.25;
    }
    s.life -= dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.life <= 0 || s.x < -4) {
      s.active = false;
      s.wait = 5 + this.rand() * 9;
      return;
    }
    // Head and a fading tail, one pixel per step back along the path.
    const len = Math.hypot(s.vx, s.vy);
    for (const p of this.shooting) {
      const back = p.k * 1.4 * this.k;
      const x = Math.round(s.x - (s.vx / len) * back);
      const y = Math.round(s.y - (s.vy / len) * back);
      p.img.setVisible(true).setPosition(x * P, y * P).setAlpha(Math.min(1, s.life * 3) * (1 - p.k / this.shooting.length));
    }
  }

  /** Day skies only: every so often a small V of birds flaps across, wings in two frames. */
  private updateBirds(dt: number, w: AmbienceWorld, still: boolean): void {
    const f = this.flock;
    const day = w.sky && w.atmo.body?.kind === 'sun' && w.atmo.stars < 0.3 && !w.atmo.weather;
    if (!f.active) {
      for (const b of this.birds) b.img.setVisible(false);
      if (!day || still) return;
      f.wait -= dt;
      if (f.wait > 0) return;
      const fromLeft = this.rand() < 0.5;
      f.active = true;
      f.vx = (fromLeft ? 1 : -1) * (9 + this.rand() * 5) * this.k;
      f.x = fromLeft ? -16 * this.k : VIEW.w + 16 * this.k;
      f.y = 12 * this.k + this.rand() * Math.max(4, w.atmo.horizon * 0.35);
      f.t = 0;
    }
    f.t += dt;
    f.x += f.vx * dt;
    const bob = Math.round(Math.sin(f.t * 2.2));
    for (const b of this.birds) {
      const back = f.vx > 0 ? -1 : 1;
      const frame = Math.floor((f.t + b.phase) / 0.18) % 2;
      b.img.setTexture(frame ? 'amb_bird1' : 'amb_bird0').setVisible(true)
        .setPosition(Math.round(f.x + back * Math.abs(b.dx) * this.k) * P, Math.round(f.y + b.dy * this.k + bob) * P);
    }
    if (f.x < -40 * this.k || f.x > VIEW.w + 40 * this.k) {
      f.active = false;
      f.wait = 14 + this.rand() * 20;
    }
  }

  private updateStorm(dt: number, w: AmbienceWorld, opts: { reduceFlashing: boolean }): void {
    const st = this.storm;
    if (w.atmo.weather !== 'storm' || opts.reduceFlashing) {
      this.bolt.setVisible(false);
      this.flash.setVisible(false);
      return;
    }
    st.wait -= dt;
    if (st.wait <= 0) {
      st.wait = 5 + this.rand() * 8;
      st.bolt = 0.18;
      st.flash = 0.3;
      this.drawBolt(w);
    }
    if (st.bolt > 0) {
      st.bolt -= dt;
      this.bolt.setVisible(st.bolt > 0);
    }
    if (st.flash > 0) {
      st.flash -= dt;
      // Two quick steps down rather than a smooth fade.
      this.flash.setVisible(st.flash > 0).setAlpha(st.flash > 0.18 ? 0.32 : st.flash > 0.08 ? 0.16 : 0.06);
    }
  }

  /** A jagged bolt from the clouds down to the far hills, one art pixel wide with a pale edge. */
  private drawBolt(w: AmbienceWorld): void {
    const g = this.bolt.clear();
    let x = 15 + Math.floor(this.rand() * (VIEW.w - 30));
    const end = w.atmo.horizon - 6 + Math.floor(this.rand() * 6);
    const pts: Array<[number, number]> = [];
    for (let y = 4; y <= end; y++) {
      if (this.rand() < 0.45) x += this.rand() < 0.5 ? -1 : 1;
      pts.push([x, y]);
      if (this.rand() < 0.06 && y < end - 6) {
        // A short fork.
        let fx = x;
        for (let k = 0; k < 5; k++) {
          fx += this.rand() < 0.6 ? 1 : 0;
          pts.push([fx + 1, y + k + 1]);
        }
      }
    }
    g.fillStyle(0xc8d8ff, 0.55);
    for (const [px, py] of pts) g.fillRect((px - 1) * P, py * P, P * 3, P);
    g.fillStyle(0xffffff, 1);
    for (const [px, py] of pts) g.fillRect(px * P, py * P, P, P);
  }

  private updateFlicker(dt: number, w: AmbienceWorld, scroll: (layer: LayerName) => number): void {
    const tile = w.tileW * P;
    for (const f of this.flickers) {
      f.t += dt;
      // Flame frames change at an uneven 7 to 12 per second.
      if (f.t >= f.next) {
        f.next = f.t + 0.08 + this.rand() * 0.06;
        f.flame.setTexture(`amb_flame${Math.floor(this.rand() * 4)}`);
      }
      let x = (f.spot.x * P - scroll(f.layer)) % tile;
      if (x < -6 * P) x += tile;
      if (x > VIEW.w * P + 6 * P) x -= tile;
      const y = w.layerY[f.layer] + (f.spot.y - 1) * P;
      f.flame.setPosition(x - P, y);
      const n = Math.sin(f.t * 9.1 + f.seed) * 0.5 + Math.sin(f.t * 14.7 + f.seed * 2) * 0.3 + Math.sin(f.t * 3.3) * 0.2;
      f.glow.setPosition(x + 1.5 * P, y + 2.5 * P).setAlpha(0.5 + n * 0.22);
    }
  }

  destroy(): void {
    for (const m of this.motes) m.img.destroy();
    for (const t of this.twinkles) t.img.destroy();
    for (const f of this.flickers) {
      f.flame.destroy();
      f.glow.destroy();
    }
    for (const s of this.shooting) s.img.destroy();
    for (const b of this.birds) b.img.destroy();
    this.flash.destroy();
    this.bolt.destroy();
  }
}
