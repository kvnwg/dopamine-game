/**
 * Registers the battle art (src/render/pixel) as Phaser textures and animations, once per game.
 * Every texture is drawn at P screen pixels per art pixel, so the whole battle reads as one pixel
 * grid: Kevin's raccoon, pack characters, redrawn street and effects all share it.
 *
 * Animated art (AnimSheet) becomes one texture with a frame per sheet frame, laid out in a grid
 * that stays under 4096 px, plus one Phaser animation per sheet animation, keyed `${key}:${anim}`.
 */
import Phaser from 'phaser';
import { DATA } from '../data';
import { blank, bounds, downsample2, fromRows, setPx, type PixelBuf } from './pixel/buf';
import { P, toCanvas } from './pixel';
import { frameBuf, type AnimSheet } from './pixel/indexed';
import { HERO_POINTS, HERO_SHEET, frameOffsets, gearSprite, heroFrame, weaponBuf, type BodyGear, type SpriteSlot } from './pixel/hero';
import { ENEMY_ART, recolorEnemy, type EnemyShape } from './pixel/enemies';
import { FOE_SHEETS, sheetFrames } from './pixel/foes';
import { FX_SHEETS, type FxName } from './pixel/packs/fx';
import { CHARACTER_OUTLINE } from './pixel/palette';
import { FX } from './pixel/ui';
import { worldArt, type SceneryKeys } from './worldLook';

const S = HERO_SHEET;
/**
 * The raccoon is drawn facing left, but the enemies come from the right, so the battle shows him
 * mirrored: every body frame (clothes included) and every worn hat, mask, shield and backpack flips
 * about the frame's center line. His head and feet are symmetric about it, so they keep their
 * columns (the feet origin doesn't move) while his face, paws and tail swap sides. The weapon is the
 * exception: its art and swing already point right, so it is never mirrored; it sits in his front paw
 * (HERO_POINTS.hand, mirrored).
 */
const flipCol = (x: number) => S.w - 1 - x;
const IDLE = S.anims.idle?.frames ?? [0];
/** How far his head rises above the reference pose during the idle loop (art px). */
const idleLift = () => Math.max(0, ...IDLE.map((f) => -(frameOffsets()[f]?.dy ?? 0)));
/** The hero frame in battle pixels: feet (ground contact), the weapon paw, the top of the head. */
export const HERO = {
  w: S.w * P,
  h: S.h * P,
  feet: { x: (S.anchor.x + 0.5) * P, y: (S.anchor.y + 1) * P },
  hand: { x: (flipCol(HERO_POINTS.hand.x) + 0.5) * P, y: (HERO_POINTS.hand.y + 0.5) * P },
  head: { x: (flipCol(HERO_POINTS.head.x) + 0.5) * P, y: HERO_POINTS.head.y * P },
  /** How high the bare raccoon reaches above the ground in his idle loop (screen px). */
  top: (S.anchor.y + 1 - Math.min(...IDLE.map((f) => bounds(frameBuf(S, f)).y))) * P,
  /** His body's center line relative to the feet origin (screen px): the frame's middle. */
  midX: (S.w / 2 - S.anchor.x - 0.5) * P,
};
/** Most weapon art points up and to the right; the scene turns it this much to point straight up. */
export const WEAPON_TILT = 45;

export interface SpriteInfo {
  key: string;
  /** Origin in 0..1 texture (frame) space. */
  ox: number;
  oy: number;
  /** Frame size in screen pixels. */
  w: number;
  h: number;
}

export interface AnimInfo extends SpriteInfo {
  /** Animation names this texture has (play `${key}:${name}`). Stored at 1x: draw with setScale(P). */
  anims: ReadonlySet<string>;
}

const info = new Map<string, SpriteInfo | AnimInfo>();

function put(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement, origin?: { x: number; y: number }): SpriteInfo {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, canvas);
  const known = info.get(key);
  if (known) return known;
  const i: SpriteInfo = {
    key,
    ox: origin ? origin.x / canvas.width : 0.5,
    oy: origin ? origin.y / canvas.height : 0.5,
    w: canvas.width,
    h: canvas.height,
  };
  info.set(key, i);
  return i;
}

function lazy(scene: Phaser.Scene, key: string, make: () => { canvas: HTMLCanvasElement; origin?: { x: number; y: number } }): SpriteInfo {
  const known = info.get(key);
  if (known && scene.textures.exists(key)) return known;
  const m = make();
  return put(scene, key, m.canvas, m.origin);
}

// ------------------------------------------------------------------ animated sheets
//
// Sheets are stored at 1 texel per art pixel and drawn with setScale(P) (nearest-neighbor, so
// pixels stay square and crisp). Pre-scaling them like the small stills would cost P x P = 144
// times the memory: about 15 to 25 MB per character on the GPU.

const MAX_TEX = 2048;

/** Grid layout of n frames fw texels wide. */
function layout(n: number, fw: number): { cols: number; rows: number } {
  const cols = Math.max(1, Math.min(n, Math.floor(MAX_TEX / fw)));
  return { cols, rows: Math.ceil(n / cols) };
}

/** Draws frame buffers (each fw x fh) into a grid canvas at 1x (or redraws an existing one). */
function drawFrames(canvas: HTMLCanvasElement, bufs: PixelBuf[], fw: number, fh: number): void {
  const { cols } = layout(bufs.length, fw);
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  bufs.forEach((b, f) => {
    if (b.w > 0 && b.h > 0) ctx.putImageData(new ImageData(new Uint8ClampedArray(b.px), b.w, b.h), (f % cols) * fw, Math.floor(f / cols) * fh);
  });
}

/**
 * Registers `bufs` (one per sheet frame, each sheet.w x sheet.h) as texture `key` with the sheet's
 * animations. `flip` mirrors the anchor (the buffers must already be mirrored). Sprites using it
 * must be scaled by P; `w` and `h` in the result are the on-screen frame size.
 */
function registerSheet(scene: Phaser.Scene, key: string, sheet: Pick<AnimSheet, 'w' | 'h' | 'anchor' | 'anims'>, bufs: PixelBuf[], flip: boolean): AnimInfo {
  const known = info.get(key) as AnimInfo | undefined;
  if (known && scene.textures.exists(key)) return known;
  const fw = sheet.w;
  const fh = sheet.h;
  const { cols, rows } = layout(bufs.length, fw);
  const canvas = document.createElement('canvas');
  canvas.width = cols * fw;
  canvas.height = rows * fh;
  drawFrames(canvas, bufs, fw, fh);
  const tex = scene.textures.addCanvas(key, canvas)!;
  bufs.forEach((_, f) => tex.add(String(f), 0, (f % cols) * fw, Math.floor(f / cols) * fh, fw, fh));
  const ax = flip ? sheet.w - 1 - sheet.anchor.x : sheet.anchor.x;
  const anims = new Set<string>();
  for (const [name, a] of Object.entries(sheet.anims)) {
    const animKey = `${key}:${name}`;
    if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
    scene.anims.create({
      key: animKey,
      frames: a.frames.map((f) => ({ key, frame: String(f) })),
      frameRate: a.fps,
      repeat: a.loop ? -1 : 0,
    });
    anims.add(name);
  }
  const i: AnimInfo = { key, ox: (ax + 0.5) / sheet.w, oy: (sheet.anchor.y + 1) / sheet.h, w: fw * P, h: fh * P, anims };
  info.set(key, i);
  return i;
}

function mirror(b: PixelBuf): PixelBuf {
  const out = blank(b.w, b.h);
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const si = (y * b.w + x) * 4;
      out.px.set(b.px.subarray(si, si + 4), (y * b.w + (b.w - 1 - x)) * 4);
    }
  }
  return out;
}

// ------------------------------------------------------------------ hero

let heroGearSig = '';

/**
 * The hero's body texture ('hero', with animations 'hero:idle' etc.), mirrored to face the enemies and
 * repainted when clothes change.
 */
export function heroTex(scene: Phaser.Scene, gear: BodyGear = {}): AnimInfo {
  const sig = `${gear.jacket ?? ''}|${gear.gloves ?? ''}|${gear.sneakers ?? ''}|${gear.bling ?? ''}`;
  const bufs = () => S.frames.map((_, f) => mirror(heroFrame(f, gear)));
  const existing = info.get('hero') as AnimInfo | undefined;
  if (!existing || !scene.textures.exists('hero')) {
    heroGearSig = sig;
    // Not `flip`: the origin keeps its place, so the frames turn about their center line (see HERO).
    return registerSheet(scene, 'hero', S, bufs(), false);
  }
  if (sig !== heroGearSig) {
    heroGearSig = sig;
    const tex = scene.textures.get('hero') as Phaser.Textures.CanvasTexture;
    drawFrames(tex.getSourceImage() as HTMLCanvasElement, bufs(), S.w, S.h);
    tex.refresh();
  }
  return existing;
}

/** Each (mirrored) hero frame's gear offset in screen pixels, and whether gear shows on it. */
export function heroFrameOffset(frame: number): { x: number; y: number; head: boolean } {
  const o = frameOffsets()[frame] ?? { dx: 0, dy: 0, head: true };
  // The offsets are measured on the art as drawn; mirrored, a shift to the left is a shift to the right.
  return { x: -o.dx * P, y: o.dy * P, head: o.head };
}

/**
 * A worn hat / mask / shield / backpack, mirrored with the body and positioned relative to the hero's
 * feet, or null. `top` is how high its art reaches above the ground during his idle loop (screen px).
 */
export function gearTex(scene: Phaser.Scene, slot: SpriteSlot, baseId: string): (SpriteInfo & { behind: boolean; top: number }) | null {
  const g = gearSprite(slot, baseId);
  if (!g) return null;
  // Mirrored about the frame's center line like the body: the icon flips and its left edge moves.
  const x = S.w - g.x - g.buf.w;
  // Origin at the hero's feet point so the image can sit at (0, 0) of the hero rig.
  const origin = { x: (S.anchor.x + 0.5 - x) * P, y: (S.anchor.y + 1 - g.y) * P };
  const key = `gear_${slot}_${baseId}`;
  const i = lazy(scene, key, () => ({ canvas: toCanvas(mirror(g.buf)), origin }));
  return { ...i, behind: g.behind, top: (S.anchor.y + 1 - g.y - bounds(g.buf).y + idleLift()) * P };
}

/** A weapon with its grip as origin (empty paw: an invisible 1px texture) and how far its art leans. */
export function weaponTex(scene: Phaser.Scene, baseId: string | null): SpriteInfo & { tilt: number } {
  const w = baseId ? weaponBuf(baseId) : null;
  const i = lazy(scene, `weapon_${baseId ?? 'none'}`, () => {
    if (!w) return { canvas: toCanvas(blank(1, 1)) };
    return { canvas: toCanvas(w.buf), origin: { x: (w.grip.x + 0.5) * P, y: (w.grip.y + 0.5) * P } };
  });
  return { ...i, tilt: w?.tilt ?? WEAPON_TILT };
}

// ------------------------------------------------------------------ enemies

export type FoeTex = AnimInfo & {
  front: number;
  back: number;
  height: number;
  animated: boolean;
  /** Where its standing art starts and ends, relative to its feet (screen px, `artL` negative). */
  artL: number;
  artR: number;
  /** How high it reaches above the ground while it stands or walks (screen px): HP bars go over this. */
  reach: number;
};

const foeExtents = new Map<string, { artL: number; artR: number; reach: number }>();

/**
 * An enemy in a world's colors, facing left toward the hero, with its feet as origin. `front` is
 * how far the sprite reaches left of its feet, `back` how far right, `height` how tall its art is.
 */
export function enemyTex(scene: Phaser.Scene, enemyId: string, world: number): FoeTex {
  const ph = DATA.assets.placeholders.enemies[enemyId] ?? { shape: 'rat', color: '#888888', accent: '#bbbbbb', size: 110 };
  const w = DATA.worlds[Math.max(1, Math.min(world, DATA.worlds.length)) - 1];
  const foe = w.boss.id === enemyId ? w.boss : w.enemies.find((f) => f.id === enemyId);
  const color = foe?.color ?? ph.color;
  const accent = foe?.accent ?? ph.accent;
  const key = `foe_${world}_${enemyId}`;
  const look = FOE_SHEETS[ph.shape];
  let i: AnimInfo;
  let artTop: number;
  /** The frames it stands and walks in (for its extents). */
  let poses: PixelBuf[];
  if (look) {
    const s = look.sheet;
    const flip = s.faces === 'right';
    const frames = sheetFrames(look, color, accent).map((b) => (flip ? mirror(b) : b));
    i = registerSheet(scene, key, s, frames, flip);
    artTop = bounds(frames[s.anims.idle?.frames[0] ?? 0]).y;
    const standing = [...(s.anims.idle?.frames ?? [0]), ...(s.anims.walk?.frames ?? [])];
    poses = standing.map((f) => frames[f]).filter((b) => !!b);
  } else {
    const shape = ph.shape as EnemyShape;
    const art = ENEMY_ART[shape] ?? ENEMY_ART.rat;
    const b = recolorEnemy(shape in ENEMY_ART ? shape : 'rat', color, accent);
    i = registerSheet(scene, key, { w: b.w, h: b.h, anchor: art.feet, anims: { idle: { fps: 1, loop: true, frames: [0] } } }, [b], false);
    artTop = bounds(b).y;
    poses = [b];
  }
  const front = i.ox * i.w;
  const height = i.oy * i.h - artTop * P;
  let ext = foeExtents.get(key);
  if (!ext) {
    // Sheet columns relative to the feet origin (the middle of the anchor column), in art pixels.
    const ox = (i.ox * i.w) / P;
    let x0 = Infinity;
    let x1 = -Infinity;
    let top = Infinity;
    for (const b of poses) {
      const bb = bounds(b);
      if (!bb.w) continue;
      x0 = Math.min(x0, bb.x);
      x1 = Math.max(x1, bb.x + bb.w);
      top = Math.min(top, bb.y);
    }
    ext = Number.isFinite(top)
      ? { artL: (x0 - ox) * P, artR: (x1 - ox) * P, reach: i.oy * i.h - top * P }
      : { artL: -front, artR: (1 - i.ox) * i.w, reach: height };
    foeExtents.set(key, ext);
  }
  return { ...i, front, back: (1 - i.ox) * i.w, height, animated: !!look && !look.still, ...ext };
}

// ------------------------------------------------------------------ worlds

export interface WorldKeys extends SceneryKeys {
  /** The sky (1 texel per art pixel: draw with setScale(P)). */
  sky: string;
  /** Cloud strips (tiling, pre-scaled), back to front, with their view row and drift (art px/s). */
  clouds: Array<{ key: string; y: number; speed: number }>;
  /** The sun, moon or planet with its halo (1x), and where its top-left goes (art px). */
  glow: { key: string; x: number; y: number } | null;
  /** Darkened corners (1x). */
  vignette: string;
}

/** Sky, clouds, glow, vignette and lit scenery tiles for a world (built on first visit). */
export function worldTextures(scene: Phaser.Scene, world: number): WorldKeys {
  const art = worldArt(world);
  const w = `w${world}_`;
  const keys: WorldKeys = {
    sky: `${w}sky`, far: `${w}far`, mid: `${w}mid`, ground: `${w}ground`, fg: `${w}fg`,
    clouds: art.clouds.map((c, i) => ({ key: `${w}cloud${i}`, y: c.y, speed: c.speed })),
    glow: art.glow ? { key: `${w}glow`, x: art.glow.x, y: art.glow.y } : null,
    vignette: `${w}vignette`,
  };
  const top = { x: 0, y: 0 };
  if (!scene.textures.exists(keys.sky)) put(scene, keys.sky, toCanvas(art.sky, 1), top);
  if (!scene.textures.exists(keys.vignette)) put(scene, keys.vignette, toCanvas(art.vignette, 1), top);
  if (keys.glow && art.glow && !scene.textures.exists(keys.glow.key)) put(scene, keys.glow.key, toCanvas(art.glow.buf, 1), top);
  art.clouds.forEach((c, i) => {
    if (!scene.textures.exists(keys.clouds[i].key)) put(scene, keys.clouds[i].key, toCanvas(c.buf), top);
  });
  for (const layer of ['far', 'mid', 'ground', 'fg'] as const) {
    if (!scene.textures.exists(keys[layer])) put(scene, keys[layer], toCanvas(art.layers[layer]), top);
  }
  return keys;
}

/**
 * Frees every world's scenery and enemy textures (and their animations) except `keep`'s and any
 * still `inUse` (a foe from the last world finishing its death animation). Returns how many it kept
 * for being in use, so the caller can try again once they're gone.
 */
export function releaseWorlds(scene: Phaser.Scene, keep: number, inUse: ReadonlySet<string> = new Set()): number {
  let held = 0;
  for (const key of scene.textures.getTextureKeys()) {
    const m = /^w(\d+)_|^foe_(\d+)_/.exec(key);
    if (!m) continue;
    const world = Number(m[1] ?? m[2]);
    if (world === keep) continue;
    if (inUse.has(key)) {
      held++;
      continue;
    }
    const i = info.get(key) as AnimInfo | undefined;
    if (i?.anims) for (const a of i.anims) scene.anims.remove(`${key}:${a}`);
    scene.textures.remove(key);
    info.delete(key);
    foeExtents.delete(key);
  }
  return held;
}

// ------------------------------------------------------------------ pack effects

/** An animated effect from the effects pack (texture `fx:${name}`), centered on its anchor. */
export function fxTex(scene: Phaser.Scene, name: FxName): (AnimInfo & { anim: string }) | null {
  const s = FX_SHEETS[name];
  if (!s) return null;
  const i = registerSheet(scene, `fx:${name}`, s, s.frames.map((_, f) => frameBuf(s, f)), false);
  const first = Object.keys(s.anims)[0];
  // An effect's anchor is its center, not a ground line: put the origin on the anchor pixel's middle.
  return { ...i, oy: (s.anchor.y + 0.5) / s.h, anim: `fx:${name}:${first}` };
}

// ------------------------------------------------------------------ small effects

/** Tiny pixel particles: a plus-shaped spark, a dust square and confetti bits, in white (tinted at runtime). */
const SPARK = ['.W.', 'WWW', '.W.'];
const DUST = ['WW', 'WW'];

/**
 * HP bar badges, outlined in the characters' brown ('o'): a heart at the end of the hero's bar and a
 * skull at the end of the boss bar. Drawn at P like everything else (`bar_heart`, `bar_skull`).
 */
const BAR_HEART = [
  '.oo.oo.',
  'oweoeRo',
  'oeRRRro',
  '.oRRro.',
  '..oro..',
  '...o...',
];
const BAR_SKULL = [
  '..ooooo..',
  '.owWWWWo.',
  'owWWWWW5o',
  'oWooWoo5o',
  'oWooWoo5o',
  'oWWWoW55o',
  '.oo5W5oo.',
  '..oWoWo..',
  '...ooo...',
];

/** A sprite's buffer with its origin at its tight bounds' center (FX art can be any size). */
function centered(b: PixelBuf): { canvas: HTMLCanvasElement; origin: { x: number; y: number } } {
  const bb = bounds(b);
  return { canvas: toCanvas(b), origin: { x: (bb.x + bb.w / 2) * P, y: (bb.y + bb.h / 2) * P } };
}

export function generateTextures(scene: Phaser.Scene, w: number, h: number): void {
  heroTex(scene);
  put(scene, 'px_spark', toCanvas(fromRows(SPARK)));
  put(scene, 'px_dust', toCanvas(fromRows(DUST)));
  const confetti = ['#FF5A7A', '#FFD54F', '#5BD23A', '#4FC3F7'];
  confetti.forEach((c, k) => {
    const b = blank(2, 1);
    setPx(b, 0, 0, c);
    setPx(b, 1, 0, c);
    put(scene, `fx_conf${k}`, toCanvas(b));
  });
  // Still effects drawn for the old, finer grid: used at half resolution.
  for (const [key, rows] of [['fx_impact', FX.impact], ['fx_puff', FX.puff], ['fx_coin', FX.coin], ['fx_bag', FX.bag]] as const) {
    const c = centered(downsample2(fromRows(rows)));
    put(scene, key, c.canvas, c.origin);
  }
  const top = { x: 0, y: 0 };
  put(scene, 'bar_heart', toCanvas(fromRows(BAR_HEART, { o: CHARACTER_OUTLINE })), top);
  put(scene, 'bar_skull', toCanvas(fromRows(BAR_SKULL, { o: CHARACTER_OUTLINE })), top);
  void w;
  void h;
}

export function texSize(key: string): { w: number; h: number } {
  const i = info.get(key);
  return i ? { w: i.w, h: i.h } : { w: 0, h: 0 };
}
