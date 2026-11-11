/**
 * The title screen's picture (src/ui/components/TitleScreen.tsx): World 1's street scrolling in
 * parallax with the bare raccoon walking in place, the logo (logoArt.ts: its letters hop in a wave
 * now and then, the raccoon in the trash can blinks, glances about and ducks, flies buzz round the
 * can and the fish bone, a shine and twinkles run over LEGEND), the PLAY button (logoArt.ts: its
 * letters wave, its arrow nudges, a glint crosses it, crumbs drop from its bite), dust motes and a
 * passing flock of birds; and the PLAY sequence: the button sinks and flashes, throws sparks, stars
 * and a ring, the raccoon crouches, hops and cheers, an iris closes on him, the game starts under it,
 * and the iris opens on him in the battle. Reduce motion keeps the scene still (he idles) and fades in
 * four steps instead of the hop and the iris; reduce flashing leaves out the button's flash.
 *
 * One pixel grid: everything is drawn on a canvas of art pixels (TITLE.w x TITLE.h, one canvas pixel
 * per art pixel) that the page shows at exactly P stage px per canvas pixel (1080 x 1920), never
 * smoothed. Every position is a whole canvas pixel, so every move is a whole art pixel; nothing is
 * scaled or rotated while it runs (the logo's tilted letters are drawn tilted).
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
import { BUTTON_LIP, logoArt, playButtonArt, stickerOf, type LogoArt, type PlayButtonArt } from './logoArt';
import { toCanvas } from './pixel';
import { blank, blit, clone, flipX, rgb, type PixelBuf } from './pixel/buf';
import { frameBuf } from './pixel/indexed';
import { HERO_SHEET, HERO_WALK } from './pixel/hero';
import { TEXT_INK } from './pixel/font';
import { CHARACTER_OUTLINE } from './pixel/palette';
import { FEET_ROW, VIEW, type LayerName } from './pixel/sceneryTypes';
import { glowOverlay, paintClouds, paintSky, paintVignette } from './pixel/atmosphere';
import { CLOUD_SCROLL0, LAYER_NAMES, layerRow, viewAtmo, worldArt, worldSeed } from './worldLook';

/**
 * The title in art pixels, and how far down the battle view's rows sit: the whole stage at P, tall
 * (phones: 1080 x 1920, the street under a tall sky) or wide (PC: 2160 x 960, twice the battle view's
 * width at its height, the street right across). setTitleShape picks one before the title is built.
 */
export const TITLE: { w: number; h: number; drop: number; wide: boolean } = { w: VIEW.w, h: 320, drop: 320 - VIEW.h, wide: false };

/** The raccoon's feet column and the row he stands on (the battle's ground row, moved down). */
let HERO_COL = 74;
let HERO_FEET = FEET_ROW + TITLE.drop;
/** Where the battle shows him (BattleScene HERO_WALK_X, FEET_ROW): the iris opens on him there. */
const BATTLE_HERO = { x: 52, y: FEET_ROW - 8 } as const;

/** Parallax while he walks (BattleScene.update): far, mid, ground and foreground layers, and the clouds. */
const PARALLAX: Readonly<Record<LayerName, number>> = { far: 0.18, mid: 0.5, ground: 1, fg: 1.3 };
const CLOUD_PARALLAX = 0.05;
/** His walk: art px of ground a second (a planted foot moves back `stride` a frame at `fps`). */
const WALK_SPEED = HERO_WALK.stride * HERO_WALK.fps;
/** Sheet frames used directly: crouched, stretched up, the cheer pair. */
const FRAME = { up: 2, squash: 4, cheer: [13, 14] } as const;

/** Rows: the logo's top (tall), the higher cloud strips' top, and the gap between the logo and PLAY. */
let LOGO_TOP = 36;
let HIGH_CLOUDS = 104;
const BUTTON_GAP = { tall: 24, wide: 16 } as const;
/** Rows the dust motes drift in: over the yards and the sidewalk. */
let MOTES = { top: TITLE.drop + 62, bottom: TITLE.drop + 134 };

/**
 * Lays the title out for the tall stage (phones) or the wide one (PC): wide, the logo and the PLAY
 * button sit side by side in the sky over the middle, and the raccoon walks the sidewalk in the middle.
 */
export function setTitleShape(wide: boolean): void {
  TITLE.wide = wide;
  TITLE.w = wide ? VIEW.w * 2 : VIEW.w;
  TITLE.h = wide ? VIEW.h : 320;
  TITLE.drop = TITLE.h - VIEW.h;
  HERO_COL = wide ? VIEW.w - 8 : 74;
  HERO_FEET = FEET_ROW + TITLE.drop;
  LOGO_TOP = wide ? 4 : 36;
  HIGH_CLOUDS = wide ? 8 : 104;
  MOTES = { top: TITLE.drop + 62, bottom: TITLE.drop + 134 };
}

const INK = TEXT_INK;
/** A deeper blue over the world's sky, so the taller sky darkens toward the top (behind the logo). */
const ZENITH = '#2a62c4';

// ------------------------------------------------------------------ pure art

/** The logo and its sticker backing (they never change, so they are drawn once). The loading screen animates parts of it too. */
let logoMemo: { art: LogoArt; sticker: PixelBuf; pad: number } | null = null;
export function logoParts(): { art: LogoArt; sticker: PixelBuf; pad: number } {
  if (!logoMemo) {
    const art = logoArt();
    const st = stickerOf(art.buf, 2);
    logoMemo = { art, sticker: st.buf, pad: st.pad };
  }
  return logoMemo;
}

const buttonMemo = new Map<string, PlayButtonArt>();
function buttonArt(label: string): PlayButtonArt {
  let b = buttonMemo.get(label);
  if (!b) {
    b = playButtonArt(label);
    buttonMemo.set(label, b);
  }
  return b;
}

/**
 * The whole logo at rest on its sticker backing, as the title shows it before anything moves. The
 * loading screen and the app's splash images use it (src/boot/bootArt.ts). (The logo is the game's
 * mark, drawn letter by letter, so it reads DUMPSTER LEGEND whatever the language.)
 */
export function titleLogo(): PixelBuf {
  const { art, sticker, pad } = logoParts();
  const out = clone(sticker);
  blit(out, art.buf, pad, pad);
  return out;
}

export interface TitleLayout {
  /** The logo's box (its sticker backing) and the PLAY button's (art px). */
  logo: { x: number; y: number; w: number; h: number };
  button: { x: number; y: number; w: number; h: number };
}

/** Where the logo and the PLAY button go for a label, for the current shape (the page puts PLAY's hit area there). */
export function titleLayout(label: string): TitleLayout {
  const { sticker } = logoParts();
  const b = buttonArt(label);
  if (TITLE.wide) {
    // Side by side over the middle, the button level with the logo's middle.
    const total = sticker.w + BUTTON_GAP.wide + b.w;
    const x0 = Math.floor((TITLE.w - total) / 2);
    return {
      logo: { x: x0, y: LOGO_TOP, w: sticker.w, h: sticker.h },
      button: { x: x0 + sticker.w + BUTTON_GAP.wide, y: LOGO_TOP + Math.round((sticker.h - b.h) / 2), w: b.w, h: b.h },
    };
  }
  return {
    logo: { x: Math.floor((TITLE.w - sticker.w) / 2), y: LOGO_TOP, w: sticker.w, h: sticker.h },
    button: { x: Math.floor((TITLE.w - b.w) / 2), y: LOGO_TOP + sticker.h + BUTTON_GAP.tall, w: b.w, h: b.h },
  };
}

/** Where the title draws its logo (titleLogo's buffer): its top-left in title art px, for the current shape. */
export function titleLogoAt(): { x: number; y: number } {
  const { logo } = titleLayout(DATA.strings['title.play'] ?? 'PLAY');
  return { x: logo.x, y: logo.y };
}

/** The title's sky colors, top to bottom (world 1's banded sky under a deeper zenith). The loading screen paints the same bands. */
export function titleSky(): string[] {
  return [ZENITH, ...viewAtmo(DATA.worlds[0].look.atmo, worldArt(1).set).sky];
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
  /** The hero sheet's frames the title shows (others empty), mirrored to face right like the battle shows him; no gear. */
  hero: PixelBuf[];
  /** The logo's pieces and its sticker backing (its pieces sit `pad` px in from the backing's edge). */
  logo: LogoArt;
  sticker: PixelBuf;
  pad: number;
  /** The PLAY button's layers. */
  button: PlayButtonArt;
  /** Bird color (the battle's: the sky's top darkened). */
  bird: string;
}

/**
 * The title's art for its PLAY label. Not kept (but the logo's and the button's pieces, which are
 * small): the title shows once per start, and its buffers can go once it closes.
 */
export function titleArt(label: string): TitleArt {
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
  const [r, g, b] = rgb(atmo.sky[0]);
  const { art, sticker, pad } = logoParts();
  const shown = new Set<number>([...HERO_SHEET.anims.idle.frames, ...HERO_WALK.frames, FRAME.up, FRAME.squash, ...FRAME.cheer]);
  return {
    sky: paintSky(atmo, TITLE.w, TITLE.h, seed, world.scale),
    vignette: paintVignette(TITLE.w, TITLE.h, atmo.vignette, seed),
    glow: glowOverlay(atmo, seed),
    clouds,
    layers,
    hero: HERO_SHEET.frames.map((_, f) => (shown.has(f) ? flipX(frameBuf(HERO_SHEET, f)) : blank(HERO_SHEET.w, HERO_SHEET.h))),
    logo: art,
    sticker,
    pad,
    button: buttonArt(label),
    bird: `rgb(${Math.round(r * 0.55)}, ${Math.round(g * 0.55)}, ${Math.round(b * 0.55)})`,
  };
}

// ------------------------------------------------------------------ the renderer

export interface TitleOptions {
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
  hold: 120,
  open: 420,
} as const;
const FADE = { start: 120, step: 90, steps: 4 } as const;
/**
 * Glints across the button and shines across LEGEND: seconds before the first, between them, and to
 * cross. A shine always comes 1.2 s after a glint, so the two never run at once. The logo's own
 * moments run on its clock (from when the loading screen has gone); the button's on the title's.
 */
const GLINT = { delay: 1, period: 2.6, sweep: 0.45 } as const;
const LOGO_SHINE = { delay: 2.2, period: 5.2, sweep: 0.7 } as const;
/** The logo's letters hop in a wave (DUMPSTER, then LEGEND), each a beat after the one before. */
const LOGO_WAVE = { delay: 0.8, period: 4.2, stagger: 0.055 } as const;
/** PLAY's letters wave and its arrow nudges forward, half a period apart; now and then it boings. */
const PLAY_WAVE = { delay: 0.6, period: 2.4, stagger: 0.07 } as const;
const BOING = { delay: 1.7, period: 3.6 } as const;
/** A hop: up a pixel, two, one, down (50 ms each). */
const HOP_STEPS = [-1, -2, -1] as const;
/** The hop: height (art px) every 30 ms. */
const HOP = [2, 4, 6, 7, 8, 8, 7, 6, 4, 2] as const;
/** The iris holds around him at this radius (art px) before it shuts. */
const SPOT_R = 17;

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
    sticker: HTMLCanvasElement;
    /** One per logo piece (logoArt pieces), and the raccoon's frames. */
    pieces: HTMLCanvasElement[];
    coon: HTMLCanvasElement[];
    button: { sticker: HTMLCanvasElement; lip: HTMLCanvasElement; face: HTMLCanvasElement; flash: HTMLCanvasElement; arrow: HTMLCanvasElement; letters: HTMLCanvasElement[] };
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
  private twinkle: { piece: number; x: number; y: number; t: number; wait: number } = { piece: 0, x: 0, y: 0, t: -1, wait: 1.2 };
  private flock = { active: false, x: 0, y: 0, vx: 0, t: 0, wait: 3 };
  private seed = 0x2f6e2b1;
  /**
   * The logo's clock (s): it starts once the loading screen has gone, so the logo the loading
   * screen's glides onto holds still until then; -1 before.
   */
  private logoT = -1;
  /** Logo pixels a twinkle can land on: [piece, x, y], on the top edges of LEGEND's letters. */
  private sparkSpots: Array<[number, number, number]> = [];
  /** LEGEND's letter fill by diagonal (x + y, in the logo's own px), per piece, for the shine that sweeps across it. */
  private logoFill: Array<Map<number, Array<[number, number]>>> = [];
  private logoDiag = { min: 0, max: 0 };
  /** Each letter piece's place in reading order (DUMPSTER then LEGEND), -1 for the rest; the can's piece. */
  private letterOrder: number[] = [];
  private canPiece = -1;
  /** The raccoon in the can: his frame, how far he has ducked (art px), what he does next and when. */
  private coon = { frame: 0, duck: 0, act: 'none' as 'none' | 'blink' | 'look' | 'duck', at: 0, next: 1.6 };
  /** The PLAY face's extent on each row (for the glint), from the art. */
  private faceRows: Array<[number, number]> = [];

  constructor(canvas: HTMLCanvasElement, private opts: TitleOptions) {
    canvas.width = TITLE.w;
    canvas.height = TITLE.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D canvas');
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
    this.art = titleArt(opts.label);
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
    const bt = a.button;
    // The face's white silhouette, for its flash on PLAY.
    const flash = clone(bt.face);
    for (let i = 0; i < flash.px.length; i += 4) if (flash.px[i + 3]) flash.px.set([255, 255, 255, 255], i);
    this.img = {
      sky: c(a.sky),
      vignette: c(a.vignette),
      glow: a.glow ? c(a.glow.buf) : null,
      clouds: a.clouds.map((cl) => c(cl.buf)),
      layers: { far: c(a.layers.far.buf), mid: c(a.layers.mid.buf), ground: c(a.layers.ground.buf), fg: c(a.layers.fg.buf) },
      hero: c(heroSheet),
      sticker: c(a.sticker),
      pieces: a.logo.pieces.map((p) => c(p.buf)),
      coon: a.logo.coon.map((f) => c(f)),
      button: { sticker: c(bt.sticker), lip: c(bt.lip), face: c(bt.face), flash: c(flash), arrow: c(bt.arrow.buf), letters: bt.letters.map((l) => c(l.buf)) },
    };
    this.cloudScroll = a.clouds.map((cl) => cl.scroll0);
    // The logo's letters in reading order; LEGEND's fill for its shine and its top edges for twinkles.
    let order = 0;
    this.logoDiag = { min: Infinity, max: -Infinity };
    a.logo.pieces.forEach((piece, i) => {
      this.letterOrder.push(piece.kind === 'letter' ? order++ : -1);
      if (piece.kind === 'letter' && piece.line === 0 && piece.index === 1) this.canPiece = i;
      const diag = new Map<number, Array<[number, number]>>();
      this.logoFill.push(diag);
      if (piece.kind !== 'letter' || piece.line !== 1) return;
      const l = piece.buf;
      // Letter fill: the bright pixels (not the ink or the drop under the letters).
      const fill = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= l.w || y >= l.h) return false;
        const k = (y * l.w + x) * 4;
        return l.px[k + 3] > 0 && l.px[k] + l.px[k + 1] + l.px[k + 2] > 400;
      };
      for (let y = 0; y < l.h; y++) {
        for (let x = 0; x < l.w; x++) {
          if (!fill(x, y)) continue;
          const d = piece.x + x + piece.y + y;
          if (!diag.has(d)) diag.set(d, []);
          diag.get(d)!.push([x, y]);
          this.logoDiag.min = Math.min(this.logoDiag.min, d);
          this.logoDiag.max = Math.max(this.logoDiag.max, d);
          // A twinkle sits on a letter's top edge, its arms reaching out over the ink.
          if (!fill(x, y - 1) && fill(x - 1, y) && fill(x + 1, y)) this.sparkSpots.push([i, x, y]);
        }
      }
    });
    // PLAY's face, row by row (inside its ink outline), for the glint.
    const f = bt.face;
    for (let y = 0; y < f.h; y++) {
      let x0 = -1;
      let x1 = -1;
      for (let x = 0; x < f.w; x++) {
        const k = (y * f.w + x) * 4;
        if (!f.px[k + 3] || (f.px[k] === 0x1a && f.px[k + 1] === 0x13 && f.px[k + 2] === 0x26)) continue;
        if (x0 < 0) x0 = x;
        x1 = x + 1;
      }
      this.faceRows.push([x0, x1]);
    }
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
      this.updateLogo(dt);
      this.updateTwinkle(dt);
      this.updateFlock(dt);
      this.updateCrumbs();
    }
    if (this.seq) this.advance(now);
  }

  /**
   * The logo's clock starts once the loading screen has gone (until then the logo holds still, so the
   * loading screen's own glides onto it and leaves without a jump). The raccoon then blinks, glances
   * about and now and then ducks into his can.
   */
  private updateLogo(dt: number) {
    if (this.logoT < 0) {
      if (typeof document !== 'undefined' && document.getElementById('boot')) return;
      this.logoT = 0;
    }
    this.logoT += dt;
    const c = this.coon;
    const t = this.logoT;
    if (c.act === 'none') {
      if (t < c.next || this.seq) return;
      const r = this.rand();
      c.act = r < 0.55 ? 'blink' : r < 0.8 ? 'look' : 'duck';
      c.at = t;
      c.frame = c.act === 'blink' ? 1 : c.act === 'look' ? (this.rand() < 0.5 ? 2 : 3) : 0;
      return;
    }
    const k = t - c.at;
    if (c.act === 'blink' && k >= 0.13) this.endCoonAct(1.6 + this.rand() * 1.8);
    if (c.act === 'look' && k >= 0.9) this.endCoonAct(0.6 + this.rand() * 1.2);
    if (c.act === 'duck') {
      // Down into the can in three steps, a beat there, then up again with a pixel's overshoot.
      const steps = [1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 0, -1, 0];
      const i = Math.floor(k / 0.06);
      if (i >= steps.length) this.endCoonAct(2.2 + this.rand() * 2);
      else c.duck = steps[i];
    }
  }

  private endCoonAct(wait: number) {
    Object.assign(this.coon, { act: 'none', frame: 0, duck: 0, next: this.logoT + wait });
  }

  /** Now and then a crumb drops from PLAY's bite. */
  private updateCrumbs() {
    if (this.seq || Math.floor(this.t / 0.1) === Math.floor((this.t - 0.0001) / 0.1)) return;
    if (this.rand() > 0.025) return;
    const b = this.layout.button;
    const at = this.art.button.crumbs;
    this.bits.push({
      x: b.x + at.x + this.rand() * 3,
      y: b.y + at.y,
      vx: 2 + this.rand() * 6,
      vy: -4 - this.rand() * 6,
      age: 0,
      life: 700 + this.rand() * 300,
      size: 1,
      color: this.rand() < 0.5 ? '#ffe2cf' : '#ff8a5c',
      gravity: 60,
      drag: 0.5,
    });
  }

  private updateTwinkle(dt: number) {
    const tw = this.twinkle;
    if (tw.t >= 0) {
      tw.t += dt;
      if (tw.t >= TWINKLE.length * 0.07) tw.t = -1;
      return;
    }
    tw.wait -= dt;
    if (tw.wait > 0 || this.seq || this.logoT < 0 || this.sparkSpots.length === 0) return;
    const [piece, x, y] = this.sparkSpots[Math.floor(this.rand() * this.sparkSpots.length)];
    Object.assign(tw, { piece, x, y, t: 0, wait: 1.1 + this.rand() * 1.4 });
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

  /**
   * How far PLAY's face is pushed into its lip (art px, + is down): sunk while pressed and as PLAY
   * starts; idle, now and then it boings (up a pixel, squashed down one, back).
   */
  private buttonSink(ms: number): number {
    if (this.seq) return ms < SEQ.release ? BUTTON_LIP - 1 : 0;
    if (this.pressed) return BUTTON_LIP - 1;
    if (this.opts.reduceMotion || this.t < BOING.delay) return 0;
    const k = (this.t - BOING.delay) % BOING.period;
    return k < 0.09 ? -1 : k < 0.18 ? 1 : 0;
  }

  /** A hop (art px, - is up) for a letter `i` of a wave that started `k` s ago, `stagger` s apart. */
  private hop(k: number, i: number, stagger: number): number {
    const j = Math.floor((k - i * stagger) / 0.05);
    return j >= 0 && j < HOP_STEPS.length ? HOP_STEPS[j] : 0;
  }

  /** How far a logo piece is lifted now (art px): its letter's hop in the wave (the raccoon rides the can's). */
  private pieceHop(i: number): number {
    if (this.logoT < 0 || this.opts.reduceMotion || this.seq) return 0;
    const order = this.letterOrder[i] >= 0 ? this.letterOrder[i] : this.letterOrder[this.canPiece];
    if (order === undefined || order < 0 || this.logoT < LOGO_WAVE.delay) return 0;
    return this.hop((this.logoT - LOGO_WAVE.delay) % LOGO_WAVE.period, order, LOGO_WAVE.stagger);
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

  /** The whole logo's jolt as PLAY is pressed (art px): up two, then one, then back. */
  private logoJolt(ms: number): number {
    if (!this.seq) return 0;
    return ms < 70 ? -2 : ms < 140 ? -1 : 0;
  }

  private drawLogo(ms: number) {
    const ctx = this.ctx;
    const a = this.art;
    const L = this.layout.logo;
    const jolt = this.logoJolt(ms);
    ctx.drawImage(this.img.sticker, L.x, L.y + jolt);
    const ox = L.x + a.pad;
    const oy = L.y + a.pad + jolt;
    const c = this.coon;
    a.logo.pieces.forEach((p, i) => {
      const lift = this.pieceHop(i);
      if (p.kind === 'coon') {
        ctx.drawImage(this.img.coon[c.frame] ?? this.img.pieces[i], ox + p.x, oy + p.y + lift + c.duck);
        return;
      }
      // The crown rides on his head; the paws hold the rim.
      ctx.drawImage(this.img.pieces[i], ox + p.x, oy + p.y + lift + (p.rides ? c.duck : 0));
    });
    if (this.logoT >= 0 && !this.opts.reduceMotion) this.drawFlies(ox, oy);
    if (this.seq || this.opts.reduceMotion || this.logoT < 0) return;
    // Now and then a shine sweeps across LEGEND (between the button's glints).
    const t = this.logoT;
    const k = ((((t - LOGO_SHINE.delay) % LOGO_SHINE.period) + LOGO_SHINE.period) % LOGO_SHINE.period) / LOGO_SHINE.sweep;
    if (t >= LOGO_SHINE.delay && k < 1) {
      const head = Math.round(this.logoDiag.min - 4 + k * (this.logoDiag.max - this.logoDiag.min + 8));
      for (const [off, alpha] of [[0, 0.75], [1, 0.75], [2, 0.75], [4, 0.5]] as const) {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        this.logoFill.forEach((diag, i) => {
          const p = a.logo.pieces[i];
          const lift = this.pieceHop(i);
          for (const [x, y] of diag.get(head - off) ?? []) ctx.fillRect(ox + p.x + x, oy + p.y + y + lift, 1, 1);
        });
      }
    }
    const tw = this.twinkle;
    if (tw.t >= 0) {
      const f = Math.min(TWINKLE.length - 1, Math.floor(tw.t / 0.07));
      const p = a.logo.pieces[tw.piece];
      const x = ox + p.x + tw.x;
      const y = oy + p.y + tw.y + this.pieceHop(tw.piece);
      for (const [dx, dy] of TWINKLE[f]) {
        ctx.fillStyle = dx === 0 && dy === 0 ? '#ffffff' : '#fff6c8';
        ctx.fillRect(x + dx, y + dy, 1, 1);
      }
    }
  }

  /** Two flies: one buzzing round the can, one round the fish bone, wings flicking. */
  private drawFlies(ox: number, oy: number) {
    const ctx = this.ctx;
    const t = this.logoT;
    const lg = this.art.logo;
    const flies = [
      { c: lg.can, rx: 13, ry: 5, w: 2.3, ph: 0, up: 9 },
      { c: lg.bone, rx: 8, ry: 4, w: 2.9, ph: 1.7, up: 3 },
    ];
    for (const f of flies) {
      const a = t * f.w + f.ph;
      // A figure of eight, with a little jitter.
      const x = Math.round(ox + f.c.x + Math.sin(a) * f.rx + Math.sin(t * 13 + f.ph) * 0.6);
      const y = Math.round(oy + f.c.y - f.up + Math.sin(a * 2) * f.ry + Math.cos(t * 11 + f.ph) * 0.6);
      const up = Math.floor(t / 0.05 + f.ph * 3) % 2 === 0;
      ctx.fillStyle = '#eaf6ff';
      if (up) {
        ctx.fillRect(x - 1, y - 1, 1, 1);
        ctx.fillRect(x + 1, y - 1, 1, 1);
      } else {
        ctx.fillRect(x - 1, y, 1, 1);
        ctx.fillRect(x + 1, y, 1, 1);
      }
      ctx.fillStyle = INK;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  private drawButton(ms: number) {
    const ctx = this.ctx;
    const b = this.layout.button;
    const art = this.art.button;
    const im = this.img.button;
    const sink = this.buttonSink(ms);
    const flash = this.seq && !this.opts.reduceFlashing && ms < SEQ.flash;
    ctx.drawImage(im.sticker, b.x, b.y);
    ctx.drawImage(im.lip, b.x + art.faceX, b.y + art.faceY);
    const fx = b.x + art.faceX;
    const fy = b.y + art.faceY + sink;
    ctx.drawImage(flash ? im.flash : im.face, fx, fy);
    const idle = !this.seq && !this.opts.reduceMotion;
    // The arrow nudges forward half a wave after the letters.
    let nudge = 0;
    if (idle && this.t >= PLAY_WAVE.delay) {
      const k = (this.t - PLAY_WAVE.delay + PLAY_WAVE.period / 2) % PLAY_WAVE.period;
      nudge = [1, 2, 2, 1][Math.floor(k / 0.06)] ?? 0;
    }
    ctx.drawImage(im.arrow, b.x + art.arrow.x + nudge, b.y + art.arrow.y + sink);
    const k = idle && this.t >= PLAY_WAVE.delay ? (this.t - PLAY_WAVE.delay) % PLAY_WAVE.period : -1;
    art.letters.forEach((l, i) => ctx.drawImage(im.letters[i], b.x + l.x, b.y + l.y + sink + (k >= 0 ? this.hop(k, i, PLAY_WAVE.stagger) : 0)));
    // Now and then a glint sweeps across the face.
    if (idle && this.t >= GLINT.delay) {
      const g = ((this.t - GLINT.delay) % GLINT.period) / GLINT.sweep;
      if (g < 1) {
        const rows = this.faceRows;
        const fh = rows.length;
        const fw = art.face.w;
        const head = Math.round(-fh + g * (fw + fh + 6));
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        for (let r = 0; r < fh; r++) {
          const [r0, r1] = rows[r];
          if (r0 < 0) continue;
          const gx = head + (fh - 1 - r);
          for (const [o, wd] of [[0, 2], [3, 1]] as const) {
            const x0 = Math.max(r0, gx + o);
            const x1 = Math.min(r1, gx + o + wd);
            if (x1 > x0) ctx.fillRect(fx + x0, fy + r, x1 - x0, 1);
          }
        }
      }
    }
    // A pixel ring flies out from the border as it's pressed.
    if (this.seq && !this.opts.reduceMotion && ms < 280) {
      const k2 = Math.floor(ms / 70);
      const g = 2 + k2 * 3;
      const base = ctx.globalAlpha;
      ctx.globalAlpha = base * [0.9, 0.7, 0.45, 0.25][k2];
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - g + 1, b.y - g, b.w + 2 * g - 2, 1);
      ctx.fillRect(b.x - g + 1, b.y + b.h - 1 + g, b.w + 2 * g - 2, 1);
      ctx.fillRect(b.x - g, b.y - g + 1, 1, b.h + 2 * g - 2);
      ctx.fillRect(b.x + b.w - 1 + g, b.y - g + 1, 1, b.h + 2 * g - 2);
      ctx.globalAlpha = base;
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
