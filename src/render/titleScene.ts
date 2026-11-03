/**
 * The title screen's picture (src/ui/components/TitleScreen.tsx): World 1's street scrolling in
 * parallax with the bare raccoon walking in place, the logo and the PLAY button, and the PLAY
 * sequence (button flash and sparks, the raccoon's hop, then an iris onto the game).
 *
 * One pixel grid: everything is drawn on a canvas of art pixels (TITLE.w x TITLE.h, one canvas pixel
 * per art pixel) that the page shows at exactly P stage px per canvas pixel (1080 x 1920), never
 * smoothed. Every position is a whole canvas pixel, so every move is a whole art pixel; nothing is
 * scaled or rotated. Big lettering is the battle's bitmap font made finer with Scale2x (twice the art
 * pixels, the same pixel size), like the UI's big icons.
 *
 * The backdrop is the battle's own (worldLook.ts worldArt(1)): its graded and lit layers at their rows
 * in the battle view, moved down TITLE.drop rows so the street fills the bottom of the screen, under a
 * taller sky painted from the world's atmosphere (paintSky, with a deeper blue overhead), the world's
 * clouds and sun, and a higher pair of cloud strips. The layers scroll at the battle's parallax rates at
 * the speed of his walk (HERO_WALK: stride x fps), so a planted foot keeps its place on the sidewalk.
 *
 * The art (titleArt, titleLayout) is pure buffers, so it builds in Node too; TitleRenderer is the
 * browser side. It owns one requestAnimationFrame loop and a few small canvases, all let go in destroy().
 */
import { DATA } from '../data';
import { toCanvas } from './pixel';
import { blank, flipX, rgb, scale2x, type PixelBuf } from './pixel/buf';
import { frameBuf } from './pixel/indexed';
import { HERO_SHEET, HERO_WALK } from './pixel/hero';
import { renderText, TEXT_INK } from './pixel/font';
import { CHARACTER_OUTLINE } from './pixel/palette';
import { FEET_ROW, VIEW, type LayerName } from './pixel/sceneryTypes';
import { glowOverlay, paintClouds, paintSky, paintVignette } from './pixel/atmosphere';
import { CLOUD_SCROLL0, LAYER_NAMES, layerRow, viewAtmo, worldArt, worldSeed } from './worldLook';

/** The title in art pixels (the whole 1080 x 1920 stage at P), and how far down the battle view's rows sit. */
export const TITLE = { w: VIEW.w, h: 320, drop: 320 - VIEW.h } as const;

/** The raccoon's feet column and the row he stands on (the battle's ground row, moved down). */
const HERO_COL = 74;
const HERO_FEET = FEET_ROW + TITLE.drop;
/** Where the battle shows him (BattleScene HERO_WALK_X, FEET_ROW): the iris opens on him there. */
const BATTLE_HERO = { x: 52, y: FEET_ROW - 8 } as const;

/** Parallax while he walks (BattleScene.update): far, mid, ground and foreground layers, and the clouds. */
const PARALLAX: Readonly<Record<LayerName, number>> = { far: 0.18, mid: 0.5, ground: 1, fg: 1.3 };
const CLOUD_PARALLAX = 0.05;
/** His walk: art px of ground a second (a planted foot moves back `stride` a frame at `fps`). */
const WALK_SPEED = HERO_WALK.stride * HERO_WALK.fps;
/** Sheet frames used directly: crouched, stretched up, the cheer pair. */
const FRAME = { up: 2, squash: 4, cheer: [13, 14] } as const;

/** Rows: the logo's top, the higher cloud strips' top and the PLAY button's top. */
const LOGO_TOP = 40;
const HIGH_CLOUDS = 104;
const BUTTON_TOP = 152;
/** Rows the dust motes drift in: over the yards and the sidewalk. */
const MOTES = { top: TITLE.drop + 62, bottom: TITLE.drop + 134 } as const;
/** The button's face around its label (art px). */
const PAD = { x: 12, y: 5 } as const;

const INK = TEXT_INK;
/** The game's green button (global.css .btn): light top band, face, dark bottom bands. */
const GREEN = { light: '#b0ec6c', face: '#5dc14c', dark: '#2f8a45' } as const;
const SHADOW = 'rgba(10, 6, 20, 0.55)';
/** A deeper blue over the world's sky, so the taller sky darkens toward the top (behind the logo). */
const ZENITH = '#2a62c4';

/** Logo fills, one color per row of the Scale2x lettering (18 rows), top to bottom. */
const LOGO_GOLD = rowsOf([['#fffbe0', 2], ['#ffe680', 4], ['#ffc233', 6], ['#ff9a1a', 6]]);
const LOGO_ICE = rowsOf([['#ffffff', 2], ['#f2fbff', 5], ['#c8eeff', 6], ['#8fd8ff', 5]]);
/** The shade under each logo line's letters (a two-row extrusion over the ink drop). */
const LOGO_DEPTH = { gold: '#b4501a', ice: '#3c78c8' } as const;

function rowsOf(bands: ReadonlyArray<readonly [string, number]>): string[] {
  return bands.flatMap(([c, n]) => Array.from({ length: n }, () => c));
}

// ------------------------------------------------------------------ pure art

/** `b` with every opaque pixel in row y recolored to `rows[y]` (the last color below the list). */
function paintRows(b: PixelBuf, rows: readonly string[]): PixelBuf {
  const out = blank(b.w, b.h);
  for (let y = 0; y < b.h; y++) {
    const [r, g, bl] = rgb(rows[Math.min(y, rows.length - 1)]);
    for (let x = 0; x < b.w; x++) {
      const i = (y * b.w + x) * 4;
      if (!b.px[i + 3]) continue;
      out.px[i] = r;
      out.px[i + 1] = g;
      out.px[i + 2] = bl;
      out.px[i + 3] = 255;
    }
  }
  return out;
}

/**
 * `b` inside an `r`-pixel border of `color` (square corners, like the font's outline), with `drop`
 * more rows of it underneath (a drop shadow): the border grows downward.
 */
function bordered(b: PixelBuf, color: string, r: number, drop: number): PixelBuf {
  const out = blank(b.w + 2 * r, b.h + 2 * r + drop);
  const [cr, cg, cb] = rgb(color);
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < b.w && y < b.h && b.px[(y * b.w + x) * 4 + 3] > 0;
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const sx = x - r;
      const sy = y - r;
      const o = (y * out.w + x) * 4;
      if (solid(sx, sy)) {
        out.px.set(b.px.subarray((sy * b.w + sx) * 4, (sy * b.w + sx) * 4 + 4), o);
        continue;
      }
      let near = false;
      for (let dy = -r - drop; dy <= r && !near; dy++) for (let dx = -r; dx <= r && !near; dx++) near = solid(sx + dx, sy + dy);
      if (!near) continue;
      out.px[o] = cr;
      out.px[o + 1] = cg;
      out.px[o + 2] = cb;
      out.px[o + 3] = 255;
    }
  }
  return out;
}

/** One logo line: the bold face made finer (Scale2x), banded fill, a shaded extrusion, a chunky ink outline and drop. */
function logoLine(text: string, fill: readonly string[], depth: string): PixelBuf {
  const letters = scale2x(renderText(text, { face: 'huge', fill: '#ffffff', ink: null }));
  return bordered(bordered(paintRows(letters, fill), depth, 0, 2), INK, 2, 2);
}

/** The PLAY label: the logo's bold face made finer, white with a one-pixel ink outline and drop (like .btn text). */
function playLabel(text: string): PixelBuf {
  const plain = renderText(text, { face: 'huge', fill: '#ffffff', ink: null });
  // A long translation stays as drawn rather than outgrowing the screen.
  const fine = plain.w * 2 <= TITLE.w - 60 ? scale2x(plain) : plain;
  return bordered(fine, INK, 1, 1);
}

export interface TitleLayout {
  /** The PLAY button's border box (art px); its drop shadow takes two more rows. */
  button: { x: number; y: number; w: number; h: number };
}

/** Where the PLAY button goes for a label (the page puts its hit area there). */
export function titleLayout(label: string): TitleLayout {
  const l = playLabel(label);
  const w = l.w + 2 * PAD.x + 2;
  const h = l.h + 2 * PAD.y + 2;
  return { button: { x: Math.floor((TITLE.w - w) / 2), y: BUTTON_TOP, w, h } };
}

export interface TitleArt {
  /** The sky, TITLE.w x TITLE.h. */
  sky: PixelBuf;
  vignette: PixelBuf;
  /** The sun and its halo, its top-left at (x, y). */
  glow: { buf: PixelBuf; x: number; y: number } | null;
  /** Cloud strips, back to front: top row, drift (art px/s), opening scroll and walking parallax. */
  clouds: Array<{ buf: PixelBuf; y: number; speed: number; scroll0: number; parallax: number }>;
  /** Scenery layers (tiling), their top rows and opening scroll. */
  layers: Record<LayerName, { buf: PixelBuf; y: number; scroll0: number }>;
  /** Every hero sheet frame, mirrored to face right like the battle shows him; no gear. */
  hero: PixelBuf[];
  /** The logo, one buffer per line. */
  logo: PixelBuf[];
  play: PixelBuf;
  /** Bird color (the battle's: the sky's top darkened). */
  bird: string;
}

let cached: { key: string; art: TitleArt } | null = null;

/** The title's art for a game name ("Dumpster Legend": a line per word) and PLAY label. Built once. */
export function titleArt(name: string, label: string): TitleArt {
  const key = `${name}|${label}`;
  if (cached?.key === key) return cached.art;
  const world = worldArt(1);
  const { set } = world;
  const seed = worldSeed(1);
  const base = viewAtmo(DATA.worlds[0].look.atmo, set);
  const d = TITLE.drop;
  // The world's sky, sun and clouds moved down with the street; the extra sky above deepens to ZENITH.
  const atmo = {
    ...base,
    sky: [ZENITH, ...base.sky],
    horizon: base.horizon + d,
    body: base.body && { ...base.body, y: base.body.y + d },
    clouds: base.clouds && { ...base.clouds, y: base.clouds.y + d },
  };
  const low = paintClouds(atmo, seed, world.scale);
  // Higher, thinner heaps, lit from the top left like the scenery (no sun under them to light them).
  const high = base.clouds ? paintClouds({ ...atmo, body: undefined, clouds: { ...base.clouds, y: HIGH_CLOUDS, cover: 0.3 } }, seed + 11, world.scale) : [];
  const clouds = [
    ...high.map((c, i) => ({ buf: c.buf, y: c.y, speed: c.speed * 0.6, scroll0: 30 + i * 120, parallax: CLOUD_PARALLAX * 0.5 })),
    ...low.map((c, i) => ({ buf: c.buf, y: c.y, speed: c.speed, scroll0: CLOUD_SCROLL0[i] ?? 0, parallax: CLOUD_PARALLAX })),
  ];
  const layers = {} as TitleArt['layers'];
  for (const name of LAYER_NAMES) layers[name] = { buf: world.layers[name], y: layerRow(set, name) + d, scroll0: set.scroll0[name] };
  const words = name.trim().split(/\s+/);
  const lines = words.length > 1 ? [words[0], words.slice(1).join(' ')] : words;
  const [r, g, b] = rgb(atmo.sky[0]);
  const art: TitleArt = {
    sky: paintSky(atmo, TITLE.w, TITLE.h, seed, world.scale),
    vignette: paintVignette(TITLE.w, TITLE.h, atmo.vignette, seed),
    glow: glowOverlay(atmo, seed),
    clouds,
    layers,
    hero: HERO_SHEET.frames.map((_, f) => flipX(frameBuf(HERO_SHEET, f))),
    logo: lines.map((l, i) => logoLine(l, i === 0 ? LOGO_GOLD : LOGO_ICE, i === 0 ? LOGO_DEPTH.gold : LOGO_DEPTH.ice)),
    play: playLabel(label),
    bird: `rgb(${Math.round(r * 0.55)}, ${Math.round(g * 0.55)}, ${Math.round(b * 0.55)})`,
  };
  cached = { key, art };
  return art;
}

// ------------------------------------------------------------------ the renderer

export interface TitleOptions {
  name: string;
  label: string;
  reduceMotion: boolean;
  reduceFlashing: boolean;
}

/** Moments of the PLAY sequence, for sound and haptics; `covered` starts the game under the closed iris. */
export interface PlayCues {
  hop?: () => void;
  land?: () => void;
  close?: () => void;
  covered: () => void;
  open?: () => void;
  done: () => void;
}

/** The PLAY sequence (ms after the press). With reduce motion it is a short stepped fade instead (FADE). */
const SEQ = {
  flash: 70,
  release: 150,
  crouch: 110,
  hop: 190,
  land: 490,
  close: 380,
  spot: 820,
  shut: 1040,
  covered: 1150,
  /** The cover holds at least this long after the game starts, so the battle has drawn under it. */
  hold: 150,
  open: 420,
} as const;
const FADE = { start: 120, step: 90, steps: 4 } as const;
/** The shine across the logo: seconds before the first, between them, and to cross it. */
const LOGO_SHINE = { delay: 1.3, period: 5.2, sweep: 0.7 } as const;
/** The hop: height (art px) every 30 ms. */
const HOP = [2, 4, 6, 7, 8, 8, 7, 6, 4, 2] as const;
/** The iris holds around him at this radius (art px) before it shuts. */
const SPOT_R = 15;

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
  gravity: number;
  drag: number;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  period: number;
}

/** A twinkle: dot, plus, star, plus, dot (70 ms each). */
const TWINKLE = [
  [[0, 0]],
  [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]],
  [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2]],
  [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]],
  [[0, 0]],
] as const;
const BIRD = [
  ['#...#', '.#.#.', '..#..'],
  ['.....', '##.##', '..#..'],
] as const;

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeIn = (k: number) => k * k;
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));

export class TitleRenderer {
  readonly layout: TitleLayout;
  private ctx: CanvasRenderingContext2D;
  private art: TitleArt;
  private canvases: HTMLCanvasElement[] = [];
  private img: {
    sky: HTMLCanvasElement;
    vignette: HTMLCanvasElement;
    glow: HTMLCanvasElement | null;
    clouds: HTMLCanvasElement[];
    layers: Record<LayerName, HTMLCanvasElement>;
    hero: HTMLCanvasElement;
    logo: HTMLCanvasElement[];
    play: HTMLCanvasElement;
  };
  private raf = 0;
  private last = 0;
  /** Seconds since the title opened (idle cycles). */
  private t = 0;
  /** How far he has walked (art px): the ground's scroll, which also picks his walk frame. */
  private walked = 0;
  private cloudScroll: number[];
  private pressed = false;
  private seq: { at: number; cues: PlayCues; covered: number; opening: number; done: boolean; hop: boolean; land: boolean; close: boolean } | null = null;
  private bits: Bit[] = [];
  private dust: Bit[] = [];
  /** Stars that twinkle around the button as it's pressed: where, and when (ms after the press). */
  private stars: Array<{ x: number; y: number; at: number }> = [];
  private motes: Mote[] = [];
  private twinkle: { line: number; x: number; y: number; t: number; wait: number } = { line: 0, x: 0, y: 0, t: -1, wait: 1.2 };
  private flock = { active: false, x: 0, y: 0, vx: 0, t: 0, wait: 3 };
  private seed = 0x2f6e2b1;
  /** Logo pixels a twinkle can land on: [line, x, y], on the top edges of the letters. */
  private sparkSpots: Array<[number, number, number]> = [];
  /** Each logo line's letter fill by screen diagonal (x + y), for the shine that sweeps across it. */
  private logoFill: Array<Map<number, Array<[number, number]>>> = [];
  private logoDiag = { min: 0, max: 0 };
  private logoAt: Array<{ x: number; y: number }> = [];

  constructor(canvas: HTMLCanvasElement, private opts: TitleOptions) {
    canvas.width = TITLE.w;
    canvas.height = TITLE.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D canvas');
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
    this.art = titleArt(opts.name, opts.label);
    this.layout = titleLayout(opts.label);
    const c = (b: PixelBuf) => {
      const cv = toCanvas(b, 1);
      this.canvases.push(cv);
      return cv;
    };
    const a = this.art;
    const heroSheet = blank(HERO_SHEET.w * a.hero.length, HERO_SHEET.h);
    a.hero.forEach((f, i) => {
      for (let y = 0; y < f.h; y++) heroSheet.px.set(f.px.subarray(y * f.w * 4, (y + 1) * f.w * 4), (y * heroSheet.w + i * HERO_SHEET.w) * 4);
    });
    this.img = {
      sky: c(a.sky),
      vignette: c(a.vignette),
      glow: a.glow ? c(a.glow.buf) : null,
      clouds: a.clouds.map((cl) => c(cl.buf)),
      layers: { far: c(a.layers.far.buf), mid: c(a.layers.mid.buf), ground: c(a.layers.ground.buf), fg: c(a.layers.fg.buf) },
      hero: c(heroSheet),
      logo: a.logo.map((l) => c(l)),
      play: c(a.play),
    };
    this.cloudScroll = a.clouds.map((cl) => cl.scroll0);
    // Logo lines centered, each overlapping the one above by its outline and drop.
    let y = LOGO_TOP;
    this.logoAt = a.logo.map((l) => {
      const at = { x: Math.floor((TITLE.w - l.w) / 2), y };
      // The next line's top outline lies on this one's outline and drop (ink on ink).
      y += l.h - 4;
      return at;
    });
    this.logoDiag = { min: Infinity, max: -Infinity };
    a.logo.forEach((l, i) => {
      // Letter fill: the bright pixels (not the ink or the shade under the letters).
      const fill = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= l.w || y >= l.h) return false;
        const k = (y * l.w + x) * 4;
        return l.px[k + 3] > 0 && l.px[k] + l.px[k + 1] + l.px[k + 2] > 400;
      };
      const diag = new Map<number, Array<[number, number]>>();
      for (let y = 0; y < l.h; y++) {
        for (let x = 0; x < l.w; x++) {
          if (!fill(x, y)) continue;
          const d = this.logoAt[i].x + x + this.logoAt[i].y + y;
          if (!diag.has(d)) diag.set(d, []);
          diag.get(d)!.push([x, y]);
          this.logoDiag.min = Math.min(this.logoDiag.min, d);
          this.logoDiag.max = Math.max(this.logoDiag.max, d);
          // A twinkle sits on a letter's top edge, its arms reaching out over the ink.
          if (!fill(x, y - 1) && fill(x - 1, y) && fill(x + 1, y)) this.sparkSpots.push([i, x, y]);
        }
      }
      this.logoFill.push(diag);
    });
    // Dust motes in the sunlight over the street (the battle's World 1 particles).
    for (let i = 0; i < 12; i++) {
      this.motes.push({
        x: this.rand() * TITLE.w,
        y: MOTES.top + this.rand() * (MOTES.bottom - MOTES.top),
        vx: 0.75 + this.rand() * 3,
        vy: -1.5 + this.rand() * 2.4,
        phase: this.rand() * Math.PI * 2,
        period: 3 + this.rand() * 3,
      });
    }
    this.flock.wait = 2.5 + this.rand() * 3;
    this.draw();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  /** The pointer is down on the title (the button sinks a pixel until it's let go). */
  setPressed(down: boolean): void {
    this.pressed = down;
  }

  get started(): boolean {
    return this.seq !== null;
  }

  /** PLAY: runs the sequence once; `cues` hear its moments. */
  play(cues: PlayCues): void {
    if (this.seq) return;
    this.seq = { at: performance.now(), cues, covered: -1, opening: -1, done: false, hop: false, land: false, close: false };
    if (!this.opts.reduceMotion) this.burst();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    // Let the canvases' memory go now rather than at the next collection (phones).
    for (const cv of this.canvases) {
      cv.width = 0;
      cv.height = 0;
    }
    this.canvases = [];
  }

  // ---------------------------------------------------------------- loop

  private rand(): number {
    this.seed = (this.seed + 0x6d2b79f5) >>> 0;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  private frame = () => {
    if (!this.raf) return;
    this.raf = requestAnimationFrame(this.frame);
    // One clock for everything (the press time comes from it too), not the frame's own timestamp.
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.update(dt, now);
    if (this.raf) this.draw(now);
  };

  /** How fast the ground goes by (art px/s): his walk, slowing to a stop as he gets ready to hop. */
  private walkSpeed(ms: number): number {
    if (this.opts.reduceMotion) return 0;
    if (!this.seq) return WALK_SPEED;
    return WALK_SPEED * (1 - clamp01(ms / SEQ.crouch));
  }

  private update(dt: number, now: number) {
    this.t += dt;
    const ms = this.seq ? Math.max(0, now - this.seq.at) : 0;
    const speed = this.walkSpeed(ms);
    const before = Math.floor(this.walked / HERO_WALK.stride);
    this.walked += speed * dt;
    this.art.clouds.forEach((cl, i) => {
      this.cloudScroll[i] += (cl.speed + speed * cl.parallax) * dt;
    });
    // A puff of dust where a foot comes down, drifting off with the ground.
    if (speed > 0 && Math.floor(this.walked / HERO_WALK.stride) !== before) {
      const f = this.heroFrame(ms);
      const foot = HERO_WALK.footfalls[f];
      if (foot !== undefined) this.puff(HERO_COL + (HERO_SHEET.w - 1 - foot) - HERO_SHEET.anchor.x, 2, speed);
    }
    for (const list of [this.bits, this.dust]) {
      for (const b of list) {
        b.age += dt * 1000;
        b.vx -= b.vx * b.drag * dt;
        b.vy += b.gravity * dt - b.vy * b.drag * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
    }
    this.bits = this.bits.filter((b) => b.age < b.life);
    this.dust = this.dust.filter((b) => b.age < b.life);
    if (!this.opts.reduceMotion) {
      for (const m of this.motes) {
        m.vx += (this.rand() - 0.5) * 1.2 * dt;
        m.vy += (this.rand() - 0.5) * 1.2 * dt;
        m.vx = Math.max(0.5, Math.min(4, m.vx));
        m.vy = Math.max(-1.5, Math.min(1, m.vy));
        m.x += (m.vx - speed * 0.6) * dt;
        m.y += m.vy * dt;
        if (m.x < -2) m.x += TITLE.w + 4;
        if (m.x > TITLE.w + 2) m.x -= TITLE.w + 4;
        if (m.y < MOTES.top) m.vy = Math.abs(m.vy);
        if (m.y > MOTES.bottom) m.vy = -Math.abs(m.vy);
      }
      this.updateTwinkle(dt);
      this.updateFlock(dt);
    }
    if (this.seq) this.advance(now);
  }

  private updateTwinkle(dt: number) {
    const tw = this.twinkle;
    if (tw.t >= 0) {
      tw.t += dt;
      if (tw.t >= TWINKLE.length * 0.07) tw.t = -1;
      return;
    }
    tw.wait -= dt;
    if (tw.wait > 0 || this.seq || this.sparkSpots.length === 0) return;
    const [line, x, y] = this.sparkSpots[Math.floor(this.rand() * this.sparkSpots.length)];
    Object.assign(tw, { line, x, y, t: 0, wait: 1.1 + this.rand() * 1.4 });
  }

  /** Now and then a small V of birds flaps across the sky (the battle's flocks, by day). */
  private updateFlock(dt: number) {
    const f = this.flock;
    if (!f.active) {
      f.wait -= dt;
      if (f.wait > 0) return;
      const fromLeft = this.rand() < 0.5;
      Object.assign(f, {
        active: true,
        vx: (fromLeft ? 1 : -1) * (14 + this.rand() * 7),
        x: fromLeft ? -24 : TITLE.w + 24,
        y: 100 + this.rand() * 40,
        t: 0,
      });
    }
    f.t += dt;
    f.x += f.vx * dt;
    if (f.x < -60 || f.x > TITLE.w + 60) {
      f.active = false;
      f.wait = 9 + this.rand() * 12;
    }
  }

  /** The PLAY sequence's moments. */
  private advance(now: number) {
    const s = this.seq!;
    const ms = Math.max(0, now - s.at);
    if (this.opts.reduceMotion) {
      if (s.covered < 0 && ms >= FADE.start) {
        // The game starts under the still-opaque title, then the title fades off it.
        s.covered = now;
        s.cues.covered();
        s.cues.open?.();
      }
      if (!s.done && ms >= FADE.start + FADE.step * FADE.steps) {
        s.done = true;
        s.cues.done();
      }
      return;
    }
    if (!s.hop && ms >= SEQ.hop) {
      s.hop = true;
      s.cues.hop?.();
    }
    if (!s.close && ms >= SEQ.close) {
      s.close = true;
      s.cues.close?.();
    }
    if (!s.land && ms >= SEQ.land) {
      s.land = true;
      this.puff(HERO_COL - 4, 3, 0);
      this.puff(HERO_COL + 5, 3, 0);
      s.cues.land?.();
    }
    if (s.covered < 0 && ms >= SEQ.covered) {
      // The game starts under the closed iris; it gets a moment to draw before the iris opens.
      s.cues.covered();
      s.covered = performance.now();
    }
    if (s.covered >= 0 && s.opening < 0 && performance.now() - s.covered >= SEQ.hold) {
      s.opening = performance.now();
      s.cues.open?.();
    }
    if (s.opening >= 0 && !s.done && performance.now() - s.opening >= SEQ.open) {
      s.done = true;
      s.cues.done();
    }
  }

  /** Dust bits at the feet: `n` each side, drifting back with the ground at `speed`. */
  private puff(x: number, n: number, speed: number) {
    for (let i = 0; i < n * 2; i++) {
      const side = i % 2 ? 1 : -1;
      this.dust.push({
        x: x + side * this.rand() * 2,
        y: HERO_FEET - this.rand(),
        vx: -speed + side * (3 + this.rand() * 9),
        vy: -3 - this.rand() * 6,
        age: 0,
        life: 360 + this.rand() * 200,
        size: this.rand() < 0.5 ? 2 : 1,
        color: '#e8e0d0',
        gravity: 0,
        drag: 2,
      });
    }
  }

  /** Sparks out of the button as it's pressed. */
  private burst() {
    const b = this.layout.button;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const colors = ['#ffffff', '#fff28c', '#ffd54f', '#b0ec6c', '#ffffff'];
    for (let i = 0; i < 30; i++) {
      // From a point on the border, out and mostly up.
      const k = this.rand();
      const onTop = i % 3 !== 0;
      const x = onTop ? b.x + k * b.w : i % 2 ? b.x : b.x + b.w;
      const y = onTop ? b.y + (i % 2 ? 0 : b.h) : b.y + k * b.h;
      const ang = Math.atan2(y - cy, (x - cx) * 0.5) + (this.rand() - 0.5) * 0.7;
      const sp = 45 + this.rand() * 80;
      this.bits.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 25,
        age: 0,
        life: 420 + this.rand() * 420,
        size: this.rand() < 0.4 ? 2 : 1,
        color: colors[i % colors.length],
        gravity: 140,
        drag: 1.6,
      });
    }
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? 1 : -1;
      this.stars.push({
        x: Math.round(cx + side * (b.w / 2 + 3 + this.rand() * 16)),
        y: Math.round(b.y - 6 + this.rand() * (b.h + 12)),
        at: 30 + i * 45,
      });
    }
  }

  // ---------------------------------------------------------------- what shows when

  /** His sheet frame: walking in step with the ground, then crouch, hop, land and cheer. */
  private heroFrame(ms: number): number {
    const s = this.seq;
    if (this.opts.reduceMotion) {
      const idle = HERO_SHEET.anims.idle;
      return idle.frames[Math.floor(this.t * idle.fps) % idle.frames.length];
    }
    if (!s || ms < SEQ.crouch) {
      const frames = HERO_WALK.frames;
      return frames[Math.floor(this.walked / HERO_WALK.stride) % frames.length];
    }
    if (ms < SEQ.hop) return FRAME.squash;
    if (ms < SEQ.land) return FRAME.up;
    if (ms < SEQ.land + 70) return FRAME.squash;
    return FRAME.cheer[Math.floor((ms - SEQ.land - 70) / 160) % 2];
  }

  /** How high he is off the ground (art px). */
  private heroLift(ms: number): number {
    if (!this.seq || this.opts.reduceMotion || ms < SEQ.hop || ms >= SEQ.land) return 0;
    return HOP[Math.min(HOP.length - 1, Math.floor((ms - SEQ.hop) / 30))];
  }

  /** The button's offset (art px, + is down): breathing a pixel while idle, sunk while pressed. */
  private buttonDrop(ms: number): number {
    if (this.seq) return ms < SEQ.release ? 1 : 0;
    if (this.pressed) return 1;
    if (this.opts.reduceMotion) return 0;
    // Like the game's .breathe: up a pixel half the time, in two steps.
    return Math.floor(this.t / 0.55) % 2 ? -1 : 0;
  }

  /** The iris's center and radius (art px), or null while it's open. */
  private iris(now: number): { x: number; y: number; r: number } | null {
    const s = this.seq;
    if (!s || this.opts.reduceMotion) return null;
    const ms = Math.max(0, now - s.at);
    const far = (x: number, y: number) => Math.ceil(Math.max(Math.hypot(x, y), Math.hypot(TITLE.w - x, y), Math.hypot(x, TITLE.h - y), Math.hypot(TITLE.w - x, TITLE.h - y))) + 2;
    // Chunky: the radius moves 30 times a second.
    const step = (v: number) => Math.floor(v / (1000 / 30)) * (1000 / 30);
    if (s.opening >= 0) {
      const k = clamp01(step(now - s.opening) / SEQ.open);
      return { x: BATTLE_HERO.x, y: BATTLE_HERO.y, r: Math.round(easeOut(k) * far(BATTLE_HERO.x, BATTLE_HERO.y)) };
    }
    if (ms < SEQ.close) return null;
    const cx = HERO_COL + 1;
    const cy = HERO_FEET - 8;
    const r0 = far(cx, cy);
    const t = step(ms);
    if (t < SEQ.spot) return { x: cx, y: cy, r: Math.round(SPOT_R + (r0 - SPOT_R) * (1 - easeInOut(clamp01((t - SEQ.close) / (SEQ.spot - SEQ.close))))) };
    if (t < SEQ.shut) return { x: cx, y: cy, r: SPOT_R };
    return { x: cx, y: cy, r: Math.round(SPOT_R * (1 - easeIn(clamp01((t - SEQ.shut) / (SEQ.covered - SEQ.shut))))) };
  }

  // ---------------------------------------------------------------- drawing

  private draw(now = performance.now()) {
    const ctx = this.ctx;
    const s = this.seq;
    const ms = s ? Math.max(0, now - s.at) : 0;
    ctx.clearRect(0, 0, TITLE.w, TITLE.h);
    const iris = this.iris(now);
    // Once the iris opens on the game, only the cover is left (the game shows through its hole); while
    // it's shut there is nothing to draw under it.
    if (!(s && s.opening >= 0) && !(iris && iris.r <= 0)) {
      let alpha = 1;
      if (s && this.opts.reduceMotion) alpha = 1 - Math.min(FADE.steps, Math.max(0, Math.floor((ms - FADE.start) / FADE.step) + 1)) / FADE.steps;
      ctx.globalAlpha = alpha;
      if (alpha > 0) this.drawScene(ms);
      ctx.globalAlpha = 1;
    }
    if (iris) this.drawIris(iris.x, iris.y, iris.r);
  }

  private drawScene(ms: number) {
    const ctx = this.ctx;
    const a = this.art;
    const im = this.img;
    ctx.drawImage(im.sky, 0, 0);
    // Clouds back to front; the sun and its halo over the low ones like the battle's.
    a.clouds.forEach((cl, i) => {
      this.tile(im.clouds[i], this.cloudScroll[i], cl.y);
      if (i === a.clouds.length - 1 && im.glow && a.glow) ctx.drawImage(im.glow, a.glow.x, a.glow.y);
    });
    if (this.flock.active) this.drawFlock();
    for (const name of ['far', 'mid', 'ground'] as const) this.tile(im.layers[name], a.layers[name].scroll0 + this.walked * PARALLAX[name], a.layers[name].y);
    this.drawHero(ms);
    this.drawBits(this.dust, 0.85);
    this.tile(im.layers.fg, a.layers.fg.scroll0 + this.walked * PARALLAX.fg, a.layers.fg.y);
    if (!this.opts.reduceMotion) this.drawMotes();
    ctx.drawImage(im.vignette, 0, 0);
    this.drawLogo(ms);
    this.drawButton(ms);
    this.drawBits(this.bits, 1);
    this.drawStars(ms);
  }

  private drawStars(ms: number) {
    const ctx = this.ctx;
    for (const st of this.stars) {
      const f = Math.floor((ms - st.at) / 60);
      if (f < 0 || f >= TWINKLE.length) continue;
      ctx.fillStyle = f === 2 ? '#ffffff' : '#fff28c';
      for (const [dx, dy] of TWINKLE[f]) ctx.fillRect(st.x + dx, st.y + dy, 1, 1);
    }
  }

  /** A tiling strip with texture column `scroll` at the left edge, at a whole art pixel. */
  private tile(img: HTMLCanvasElement, scroll: number, y: number) {
    const w = img.width;
    if (!w) return;
    let x = -((((Math.round(scroll) % w) + w) % w));
    for (; x < TITLE.w; x += w) this.ctx.drawImage(img, x, y);
  }

  private drawHero(ms: number) {
    const ctx = this.ctx;
    const f = this.heroFrame(ms);
    // A flat shadow on the feet row and the one under it (textures.ts shadowTex), centered on his feet.
    const base = ctx.globalAlpha;
    ctx.globalAlpha = base * 0.22;
    ctx.fillStyle = CHARACTER_OUTLINE;
    ctx.fillRect(HERO_COL - 5, HERO_FEET, 11, 1);
    ctx.fillRect(HERO_COL - 4, HERO_FEET + 1, 9, 1);
    ctx.globalAlpha = base;
    const x = HERO_COL - HERO_SHEET.anchor.x;
    const y = HERO_FEET - HERO_SHEET.anchor.y - this.heroLift(ms);
    ctx.drawImage(this.img.hero, f * HERO_SHEET.w, 0, HERO_SHEET.w, HERO_SHEET.h, x, y, HERO_SHEET.w, HERO_SHEET.h);
  }

  /** Particles, fading out in three flat steps over the last part of their life. */
  private drawBits(list: readonly Bit[], alpha: number) {
    const ctx = this.ctx;
    const base = ctx.globalAlpha;
    for (const b of list) {
      const k = b.age / b.life;
      ctx.globalAlpha = base * alpha * (k < 0.55 ? 1 : k < 0.8 ? 0.6 : 0.3);
      ctx.fillStyle = b.color;
      ctx.fillRect(Math.round(b.x), Math.round(b.y), b.size, b.size);
    }
    ctx.globalAlpha = base;
  }

  private drawMotes() {
    const ctx = this.ctx;
    const base = ctx.globalAlpha;
    ctx.fillStyle = '#fff8d8';
    for (const m of this.motes) {
      ctx.globalAlpha = base * (0.35 + 0.25 * (0.5 + 0.5 * Math.sin(this.t * ((Math.PI * 2) / m.period) + m.phase)));
      ctx.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
    }
    ctx.globalAlpha = base;
  }

  private drawFlock() {
    const f = this.flock;
    const ctx = this.ctx;
    ctx.fillStyle = this.art.bird;
    const bob = Math.round(Math.sin(f.t * 2.2));
    for (let k = 0; k < 5; k++) {
      const side = k === 0 ? 0 : k % 2 ? -1 : 1;
      const back = f.vx > 0 ? -1 : 1;
      const x = Math.round(f.x + back * Math.ceil(k / 2) * 9);
      const y = Math.round(f.y + side * Math.ceil(k / 2) * 4 + bob);
      const rows = BIRD[Math.floor((f.t + k * 0.7) / 0.18) % 2];
      rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') ctx.fillRect(x + rx, y + ry, 1, 1);
      });
    }
  }

  /** A logo line's offset (art px): bobbing a pixel, the second line a beat behind; a jolt on PLAY. */
  private logoDy(i: number, ms: number): number {
    // Up two, then one, then back as PLAY is pressed.
    if (this.seq) return ms < 70 ? -2 : ms < 140 ? -1 : 0;
    if (this.opts.reduceMotion) return 0;
    return Math.floor((this.t - i * 0.25) / 0.8) % 2 ? -1 : 0;
  }

  private drawLogo(ms: number) {
    const ctx = this.ctx;
    this.img.logo.forEach((img, i) => ctx.drawImage(img, this.logoAt[i].x, this.logoAt[i].y + this.logoDy(i, ms)));
    if (this.seq || this.opts.reduceMotion) return;
    // Now and then a shine sweeps across the lettering (between the button's glints).
    const k = (((this.t - LOGO_SHINE.delay) % LOGO_SHINE.period) + LOGO_SHINE.period) % LOGO_SHINE.period / LOGO_SHINE.sweep;
    if (this.t >= LOGO_SHINE.delay && k < 1) {
      const head = Math.round(this.logoDiag.min - 4 + k * (this.logoDiag.max - this.logoDiag.min + 8));
      for (const [off, alpha] of [[0, 0.75], [1, 0.75], [2, 0.75], [4, 0.5]] as const) {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        this.logoFill.forEach((diag, i) => {
          const dy = this.logoDy(i, ms);
          for (const [x, y] of diag.get(head - off) ?? []) ctx.fillRect(this.logoAt[i].x + x, this.logoAt[i].y + y + dy, 1, 1);
        });
      }
    }
    const tw = this.twinkle;
    if (tw.t >= 0) {
      const f = Math.min(TWINKLE.length - 1, Math.floor(tw.t / 0.07));
      const x = this.logoAt[tw.line].x + tw.x;
      const y = this.logoAt[tw.line].y + tw.y + this.logoDy(tw.line, ms);
      for (const [dx, dy] of TWINKLE[f]) {
        ctx.fillStyle = dx === 0 && dy === 0 ? '#ffffff' : '#fff6c8';
        ctx.fillRect(x + dx, y + dy, 1, 1);
      }
    }
  }

  private drawButton(ms: number) {
    const ctx = this.ctx;
    const b = this.layout.button;
    const drop = this.buttonDrop(ms);
    const x = b.x;
    const y = b.y + drop;
    const flash = this.seq && !this.opts.reduceFlashing && ms < SEQ.flash;
    // Its drop shadow stays on the ground: deeper while it floats up, shallower while it's pressed.
    ctx.fillStyle = SHADOW;
    ctx.fillRect(x + 1, y + b.h, b.w - 2, b.y + b.h + 2 - (y + b.h));
    // Ink border with its corners cut, then the face in flat bands.
    ctx.fillStyle = INK;
    ctx.fillRect(x + 1, y, b.w - 2, b.h);
    ctx.fillRect(x, y + 1, b.w, b.h - 2);
    const fx = x + 1;
    const fw = b.w - 2;
    const fy = y + 1;
    const fh = b.h - 2;
    ctx.fillStyle = flash ? '#ffffff' : GREEN.light;
    ctx.fillRect(fx, fy, fw, 1);
    ctx.fillStyle = flash ? '#ffffff' : GREEN.face;
    ctx.fillRect(fx, fy + 1, fw, fh - 3);
    ctx.fillStyle = flash ? '#fff28c' : GREEN.dark;
    ctx.fillRect(fx, fy + fh - 2, fw, 2);
    ctx.drawImage(this.img.play, fx + PAD.x, fy + PAD.y);
    // Now and then a glint sweeps across the face.
    if (!this.seq && !this.opts.reduceMotion) {
      const period = 2.6;
      const k = (this.t % period) / 0.45;
      if (k < 1) {
        const head = Math.round(-fh + k * (fw + fh + 6));
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        for (let r = 0; r < fh; r++) {
          const gx = head + (fh - 1 - r);
          for (const [o, wd] of [[0, 2], [3, 1]] as const) {
            const x0 = Math.max(0, gx + o);
            const x1 = Math.min(fw, gx + o + wd);
            if (x1 > x0) ctx.fillRect(fx + x0, fy + r, x1 - x0, 1);
          }
        }
      }
    }
    // A pixel ring flies out from the border as it's pressed.
    if (this.seq && !this.opts.reduceMotion && ms < 280) {
      const k = Math.floor(ms / 70);
      const g = 2 + k * 3;
      ctx.globalAlpha = [0.9, 0.7, 0.45, 0.25][k];
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - g + 1, y - g, b.w + 2 * g - 2, 1);
      ctx.fillRect(x - g + 1, y + b.h - 1 + g, b.w + 2 * g - 2, 1);
      ctx.fillRect(x - g, y - g + 1, 1, b.h + 2 * g - 2);
      ctx.fillRect(x + b.w - 1 + g, y - g + 1, 1, b.h + 2 * g - 2);
      ctx.globalAlpha = 1;
    }
  }

  /** Covers everything but a pixel circle of radius `r` around (cx, cy), in the ink. */
  private drawIris(cx: number, cy: number, r: number) {
    const ctx = this.ctx;
    ctx.fillStyle = INK;
    // Rows wholly above and below the hole in one go each, then the rows beside it.
    const top = Math.max(0, Math.min(TITLE.h, r > 0 ? Math.ceil(cy - r - 0.5) : TITLE.h));
    const bottom = Math.max(top, Math.min(TITLE.h, r > 0 ? Math.floor(cy + r - 0.5) + 1 : TITLE.h));
    if (top > 0) ctx.fillRect(0, 0, TITLE.w, top);
    if (bottom < TITLE.h) ctx.fillRect(0, bottom, TITLE.w, TITLE.h - bottom);
    for (let y = top; y < bottom; y++) {
      const dy = y + 0.5 - cy;
      if (Math.abs(dy) >= r) {
        ctx.fillRect(0, y, TITLE.w, 1);
        continue;
      }
      const hw = Math.sqrt(r * r - dy * dy);
      const x0 = Math.max(0, Math.round(cx - hw));
      const x1 = Math.min(TITLE.w, Math.round(cx + hw));
      if (x0 > 0) ctx.fillRect(0, y, x0, 1);
      if (x1 < TITLE.w) ctx.fillRect(x1, y, TITLE.w - x1, 1);
    }
  }
}
