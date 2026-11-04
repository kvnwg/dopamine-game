/**
 * The loading screen (src/boot/boot.html, in the page before the game's script) and the phone apps'
 * splash images, drawn from the game's own art: the title's logo and banded sky, the raccoon's walk
 * and his street. Node only: tools/bootArt.ts writes the files and tests/boot.test.ts checks that
 * boot.html matches this (run `npm run boot-art` after changing the logo, the hero or the street).
 *
 * The page is a big script that keeps the browser busy for a second or more (several on a slow
 * phone) before anything of the game can draw. The loading screen is plain HTML and CSS, painted
 * before that script runs, and everything on it moves by transform and opacity, which the browser
 * animates off the busy main thread: the raccoon walks, his street scrolls by, the bar fills and a
 * joke line changes while the script loads. Once the title screen is up under it, src/ui/boot.ts
 * fills the bar and fades it all away but the logo, which glides onto the title's own logo.
 */
import { DATA } from '../data';
import { blank, blit, flipX, rgb, scaleUp, type PixelBuf } from '../render/pixel/buf';
import { renderText, TEXT_INK } from '../render/pixel/font';
import { CHARACTER_OUTLINE } from '../render/pixel/palette';
import { HERO_SHEET, HERO_WALK } from '../render/pixel/hero';
import { frameBuf } from '../render/pixel/indexed';
import { FEET_ROW } from '../render/pixel/sceneryTypes';
import { titleArt, titleLogo, titleSky } from '../render/titleScene';
import { layerRow, worldArt } from '../render/worldLook';
import { pngDataUrl } from './png';

/** The game's navy (the page behind the stage, src/ui/App.module.css), for the apps' splash. */
export const SPLASH_NAVY = '#0d0f19';

const str = (key: string): string => DATA.strings[key] ?? key;

/** The loading screen's art, at one buffer pixel per art pixel. */
export interface BootArt {
  logo: PixelBuf;
  /** The walk's frames side by side (facing right, as on the title), in playing order. */
  walk: PixelBuf;
  /** One frame's size and where his feet are in it (the bottom row they stand on, the column between them). */
  frame: { w: number; h: number; feetX: number; feetY: number };
  /** World 1's sidewalk strip (the curb's grass, the sidewalk, the grass in front; no lampposts), tiling left to right. */
  street: PixelBuf;
  /** The row of the street strip his feet stand on. */
  streetFeet: number;
  /** The joke lines under the bar, in the pixel font. */
  lines: PixelBuf[];
  /** The title's sky bands, top to bottom. */
  sky: string[];
  /** The title's cloud strips (tiling): a high pair and a low pair, each with its row offset in the pair and drift (art px/s). */
  clouds: { high: Array<{ buf: PixelBuf; dy: number; speed: number }>; low: Array<{ buf: PixelBuf; dy: number; speed: number }> };
}

/**
 * The street from the curb's grass down, without what stands on it (lampposts): those columns take
 * the curb from a little way along, where nothing stands. Everything above the grass tips is cut.
 */
function sidewalk(full: PixelBuf): PixelBuf {
  const opaque = (x: number, y: number) => full.px[(y * full.w + x) * 4 + 3] > 0;
  const rowShare = (y: number) => {
    let n = 0;
    for (let x = 0; x < full.w; x++) if (opaque(x, y)) n++;
    return n / full.w;
  };
  // The curb's grass: the first row that is (nearly) all filled in; its tips stick up a few rows more.
  let grass = 0;
  while (grass < full.h && rowShare(grass) < 0.6) grass++;
  const top = Math.max(0, grass - 3);
  // Lampposts: columns with anything above the grass tips.
  const post = new Set<number>();
  for (let x = 0; x < full.w; x++) {
    for (let y = 0; y < top - 1; y++) {
      if (!opaque(x, y)) continue;
      for (let d = -2; d <= 2; d++) post.add((x + d + full.w) % full.w);
      break;
    }
  }
  // A shift that moves every lamppost column onto a clear one.
  let shift = 9;
  while ([...post].some((x) => post.has((x + shift) % full.w)) && shift < full.w) shift++;
  const out = blank(full.w, full.h - top);
  for (let y = top; y < full.h; y++) {
    for (let x = 0; x < full.w; x++) {
      // Below the curb, the lampposts are behind nothing: only their base on the curb is patched.
      const from = post.has(x) && y < grass + 6 ? (x + shift) % full.w : x;
      const i = (y * full.w + from) * 4;
      out.px.set(full.px.subarray(i, i + 4), ((y - top) * full.w + x) * 4);
    }
  }
  return out;
}

export function bootArt(): BootArt {
  const frames = HERO_WALK.frames.map((f) => flipX(frameBuf(HERO_SHEET, f)));
  const fw = HERO_SHEET.w;
  const fh = HERO_SHEET.h;
  const walk = blank(fw * frames.length, fh);
  frames.forEach((b, i) => blit(walk, b, i * fw, 0));
  const world = worldArt(1);
  const groundTop = layerRow(world.set, 'ground');
  const full = blank(world.layers.ground.w, world.layers.ground.h);
  blit(full, world.layers.ground, 0, 0);
  blit(full, world.layers.fg, 0, layerRow(world.set, 'fg') - groundTop);
  const street = sidewalk(full);
  const cut = full.h - street.h;
  const lines = [1, 2, 3, 4].map((n) =>
    renderText(str(`boot.line${n}`), { face: 'big', fill: ['#ffffff', '#ffffff', '#ffffff', '#fff3d6', '#fff3d6', '#ffe6b8', '#ffe6b8'], ink: TEXT_INK, shadow: true }),
  );
  // The title's clouds: its high pair and its low pair, each pair's rows relative to its first.
  const tc = titleArt(str('title.name'), str('title.play')).clouds;
  const pair = (cs: typeof tc) => cs.map((c) => ({ buf: c.buf, dy: c.y - cs[0].y, speed: c.speed }));
  return {
    logo: titleLogo(str('title.name')),
    walk,
    // Mirrored, his feet's column moves to the other side of the frame.
    frame: { w: fw, h: fh, feetX: fw - 1 - HERO_SHEET.anchor.x, feetY: HERO_SHEET.anchor.y },
    street,
    streetFeet: FEET_ROW - groundTop - cut,
    lines,
    sky: titleSky(),
    clouds: { high: pair(tc.slice(0, 2)), low: pair(tc.slice(2, 4)) },
  };
}

/** Banded sky: each color a flat band, top to bottom (the title's sky is banded the same way). */
function skyBands(colors: readonly string[]): string {
  const n = colors.length;
  const stops = colors.map((c, i) => `${c} ${((i / n) * 100).toFixed(2)}% ${(((i + 1) / n) * 100).toFixed(2)}%`);
  return `linear-gradient(180deg, ${stops.join(', ')})`;
}

/** Each joke line shows for its share of the cycle, with a quick fade either side. */
function lineKeyframes(n: number, cycle: number): string {
  const share = 100 / n;
  const fade = (0.25 / cycle) * 100;
  return Array.from({ length: n }, (_, i) => {
    const a = i * share;
    const b = (i + 1) * share;
    const k = (v: number) => `${Math.max(0, Math.min(100, v)).toFixed(2)}%`;
    const frames = i === 0
      ? `0%, ${k(b - fade)} { opacity: 1; } ${k(b)}, 100% { opacity: 0; }`
      : `0%, ${k(a - fade)} { opacity: 0; } ${k(a)}, ${k(b - fade)} { opacity: 1; } ${k(b)}, 100% { opacity: 0; }`;
    return `@keyframes bt-line${i} { ${frames} }`;
  }).join('\n');
}

/**
 * The loading screen: an HTML fragment (a style and a div with id "boot") for the top of the page.
 * Sizes are in two units that track the screen: --u for the logo, the bar and the text (one art
 * pixel), --s for the sky, the street and the raccoon (bigger, as if closer). On a 1x screen they
 * are whole CSS pixels, so art pixels stay even; on a phone's 2-3x screen they follow its size.
 */
export function bootHtml(): string {
  const a = bootArt();
  const L = a.lines.length;
  const CYCLE = 10;
  const walkSecs = HERO_WALK.frames.length / HERO_WALK.fps;
  // His walk moves a planted foot `stride` art px a frame: the street must slide by that much.
  const streetSecs = a.street.w / (HERO_WALK.stride * HERO_WALK.fps);
  const lineW = Math.max(...a.lines.map((l) => l.w));
  const lineH = Math.max(...a.lines.map((l) => l.h));
  const BAR = { w: 120, h: 8 };
  // The clouds drift a few times faster than on the title, so they move during a short load.
  const DRIFT = 4;
  const cloudCss = (cls: string, cs: BootArt['clouds']['high']) =>
    cs
      .map((c, i) => `#boot .${cls}${i} {
  position: absolute;
  left: 0;
  top: calc(${c.dy} * var(--s));
  height: calc(${c.buf.h} * var(--s));
  width: calc(100% + ${c.buf.w} * var(--s));
  background: url(${pngDataUrl(c.buf)}) 0 0 / calc(${c.buf.w} * var(--s)) 100% repeat-x;
  animation: bt-cloud${c.buf.w} ${(c.buf.w / (c.speed * DRIFT)).toFixed(2)}s linear infinite;
}`)
      .join('\n');
  const cloudWidths = [...new Set([...a.clouds.high, ...a.clouds.low].map((c) => c.buf.w))];
  const pairH = (cs: BootArt['clouds']['high']) => Math.max(...cs.map((c) => c.dy + c.buf.h));
  // His shadow on the sidewalk, as the title draws it (two flat rows of the outline color at 22%).
  const [sr, sg, sb] = rgb(CHARACTER_OUTLINE);
  const shadow = `rgba(${sr}, ${sg}, ${sb}, 0.22)`;
  const css = `
#boot {
  --u: 2px;
  --s: 3px;
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  -webkit-user-select: none;
  user-select: none;
}
#boot .bt-bg { position: absolute; inset: 0; background: ${skyBands(a.sky)}; }
#boot {
  --u: clamp(2px, min(100vw / 172, 100vh / 250), 5px);
  --s: clamp(3px, min(100vw / 72, 100vh / 165), 8px);
}
@supports (width: round(down, 10px, 1px)) {
  @media (max-resolution: 1.5dppx) {
    #boot {
      --u: clamp(2px, round(down, min(100vw / 172, 100vh / 250), 1px), 5px);
      --s: clamp(3px, round(down, min(100vw / 72, 100vh / 165), 1px), 8px);
    }
  }
}
#boot .bt-sky { position: absolute; left: 0; right: 0; overflow: hidden; pointer-events: none; }
#boot .bt-high { top: calc(4 * var(--s)); height: calc(${pairH(a.clouds.high)} * var(--s)); }
#boot .bt-low { bottom: calc(${a.street.h + 10} * var(--s)); height: calc(${pairH(a.clouds.low)} * var(--s)); }
${cloudCss('bt-ch', a.clouds.high)}
${cloudCss('bt-cl', a.clouds.low)}
${cloudWidths.map((w) => `@keyframes bt-cloud${w} { to { transform: translateX(calc(-${w} * var(--s))); } }`).join('\n')}
/*
 * Leaving (src/ui/boot.ts): the logo glides onto the title's own logo while the bar folds away
 * (transforms only), then, with the logo still, the rest fades and shows the title under it.
 */
#boot .bt-logo { transition: transform 0.48s cubic-bezier(0.22, 0.8, 0.24, 1); will-change: transform; }
#boot[data-glide] { pointer-events: none; }
#boot[data-glide] .bt-load { transform: scaleY(0); transform-origin: 50% 0; transition: transform 0.2s ease-in; }
#boot[data-done] .bt-bg, #boot[data-done] .bt-sky, #boot[data-done] .bt-street { opacity: 0; transition: opacity 0.35s ease-out; }
#boot[data-fade] { opacity: 0; pointer-events: none; transition: opacity 0.4s ease-out; }
#boot img, #boot .bt-px { image-rendering: pixelated; image-rendering: crisp-edges; }
#boot .bt-top {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(16 * var(--u));
  padding-top: calc(8 * var(--u));
}
#boot .bt-logo {
  display: block;
  width: calc(${a.logo.w} * var(--u));
  height: calc(${a.logo.h} * var(--u));
  animation: bt-bob 1.6s steps(1) infinite;
}
@keyframes bt-bob { 50% { transform: translateY(calc(-1 * var(--u))); } }
#boot .bt-load { display: flex; flex-direction: column; align-items: center; gap: calc(6 * var(--u)); }
#boot .bt-bar {
  position: relative;
  width: calc(${BAR.w} * var(--u));
  height: calc(${BAR.h} * var(--u));
  overflow: hidden;
  background: #2b2546;
  box-shadow: 0 0 0 var(--u) ${TEXT_INK}, 0 calc(2 * var(--u)) 0 var(--u) rgba(26, 19, 38, 0.45);
}
#boot .bt-fill {
  position: absolute;
  inset: 0;
  transform-origin: 0 50%;
  background: linear-gradient(180deg, #fff28c 0 calc(2 * var(--u)), #ffc233 calc(2 * var(--u)) calc(100% - 2 * var(--u)), #d48a12 calc(100% - 2 * var(--u)) 100%);
  transform: scaleX(0.04);
  animation: bt-fill 14s linear forwards;
}
@keyframes bt-fill {
  0% { transform: scaleX(0.04); }
  8% { transform: scaleX(0.3); }
  20% { transform: scaleX(0.55); }
  40% { transform: scaleX(0.75); }
  70% { transform: scaleX(0.88); }
  100% { transform: scaleX(0.95); }
}
#boot .bt-shine {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: calc(4 * var(--u));
  background: rgba(255, 255, 255, 0.5);
  animation: bt-shine 1.5s linear infinite;
}
@keyframes bt-shine {
  from { transform: translateX(calc(-6 * var(--u))); }
  to { transform: translateX(calc(${BAR.w + 6} * var(--u))); }
}
#boot .bt-lines { position: relative; width: calc(${lineW} * var(--u)); height: calc(${lineH} * var(--u)); }
#boot .bt-line {
  position: absolute;
  left: 50%;
  top: 0;
  height: calc(${lineH} * var(--u));
  transform: translateX(-50%);
  opacity: 0;
}
${a.lines.map((l, i) => `#boot .bt-line${i} { width: calc(${l.w} * var(--u)); animation: bt-line${i} ${CYCLE}s linear infinite; }`).join('\n')}
${lineKeyframes(L, CYCLE)}
#boot .bt-street {
  position: relative;
  flex: none;
  align-self: stretch;
  height: calc(${a.street.h} * var(--s));
  overflow: hidden;
}
#boot .bt-ground {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: calc(100% + ${a.street.w} * var(--s));
  background: url(${pngDataUrl(a.street)}) 0 0 / calc(${a.street.w} * var(--s)) 100% repeat-x;
  animation: bt-street ${streetSecs.toFixed(3)}s linear infinite;
}
@keyframes bt-street { to { transform: translateX(calc(-${a.street.w} * var(--s))); } }
#boot .bt-shadow {
  position: absolute;
  left: calc(50% - 5 * var(--s));
  top: calc(${a.streetFeet} * var(--s));
  width: calc(11 * var(--s));
  height: var(--s);
  background: ${shadow};
  box-shadow: 0 var(--s) 0 calc(-1 * var(--s)) ${shadow};
}
#boot .bt-hero {
  position: absolute;
  left: calc(50% - ${a.frame.feetX} * var(--s));
  top: calc(${a.streetFeet - a.frame.feetY} * var(--s));
  width: calc(${a.frame.w} * var(--s));
  height: calc(${a.frame.h} * var(--s));
  overflow: hidden;
}
#boot .bt-walk {
  width: ${HERO_WALK.frames.length * 100}%;
  height: 100%;
  background: url(${pngDataUrl(a.walk)}) 0 0 / 100% 100% no-repeat;
  animation: bt-walk ${walkSecs.toFixed(4)}s steps(${HERO_WALK.frames.length}) infinite;
}
@keyframes bt-walk { to { transform: translateX(-100%); } }
@media (prefers-reduced-motion: reduce) {
  #boot .bt-logo, #boot .bt-shine, #boot .bt-ground, #boot .bt-walk, #boot .bt-line, #boot .bt-sky > div { animation: none; }
  #boot .bt-line0 { opacity: 1; }
}`;
  const lines = a.lines
    .map((l, i) => `<img class="bt-line bt-line${i}" src="${pngDataUrl(l)}" alt="">`)
    .join('');
  return [
    '<!-- The loading screen, generated by tools/bootArt.ts from the game\'s art (npm run boot-art); src/main.ts removes it. -->',
    `<style>${css.replace(/\n\s*/g, ' ').trim()}</style>`,
    `<div id="boot" role="status" aria-label="${str('boot.aria')}">` +
      '<div class="bt-bg"></div>' +
      `<div class="bt-sky bt-high">${a.clouds.high.map((_, i) => `<div class="bt-ch${i} bt-px"></div>`).join('')}</div>` +
      `<div class="bt-sky bt-low">${a.clouds.low.map((_, i) => `<div class="bt-cl${i} bt-px"></div>`).join('')}</div>` +
      '<div class="bt-top">' +
      `<img class="bt-logo" src="${pngDataUrl(a.logo)}" alt="" data-w="${a.logo.w}" data-h="${a.logo.h}">` +
      `<div class="bt-load"><div class="bt-bar"><i class="bt-fill"></i><i class="bt-shine"></i></div><div class="bt-lines">${lines}</div></div>` +
      '</div>' +
      '<div class="bt-street"><div class="bt-ground bt-px"></div><div class="bt-shadow"></div><div class="bt-hero"><div class="bt-walk bt-px"></div></div></div>' +
      '</div>',
    '',
  ].join('\n');
}

/**
 * A splash image for the phone apps on the game's navy (or clear, `bg: null`): the raccoon alone
 * (Android's splash icon), or the logo with the raccoon under it (iOS), in the middle at a whole
 * number of image pixels per art pixel.
 */
export function splashImage(w: number, h: number, opts: { art: 'hero' | 'logo+hero'; scale: number; bg?: string | null }): PixelBuf {
  const out = blank(w, h);
  if (opts.bg !== null) {
    const [r, g, b] = rgb(opts.bg ?? SPLASH_NAVY);
    for (let i = 0; i < w * h; i++) {
      out.px[i * 4] = r;
      out.px[i * 4 + 1] = g;
      out.px[i * 4 + 2] = b;
      out.px[i * 4 + 3] = 255;
    }
  }
  const hero = flipX(frameBuf(HERO_SHEET, HERO_SHEET.anims.idle.frames[0]));
  let art = hero;
  if (opts.art === 'logo+hero') {
    const logo = titleLogo(str('title.name'));
    const gap = 10;
    art = blank(Math.max(logo.w, hero.w), logo.h + gap + hero.h);
    blit(art, logo, Math.floor((art.w - logo.w) / 2), 0);
    blit(art, hero, Math.floor((art.w - hero.w) / 2), logo.h + gap);
  }
  const big = scaleUp(art, opts.scale);
  blit(out, big, Math.floor((w - big.w) / 2), Math.floor((h - big.h) / 2));
  return out;
}
