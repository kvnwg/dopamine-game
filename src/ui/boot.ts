/**
 * The loading screen (src/boot/boot.html, in the page before the game's script) gives way to the
 * game. As soon as the title is on screen under it, its bar fills to the end; its logo glides and
 * shrinks (or grows) onto the title's own logo while the bar folds away; then, with the logo still,
 * the rest fades and the title shows, its logo exactly where the other one stopped. Moving things only
 * by transform until then keeps the glide smooth even when the fade costs the browser a frame or two.
 * Without a title (?notitle, or it failed) it all just fades; with reduced motion it goes at once.
 *
 * It doesn't wait for the battle: that starts once the loading screen is gone (bootGone, BattlePanel),
 * so nothing heavy runs under the glide, and a tap goes through to the title (PLAY) from the moment
 * the title is there. (It used to wait for the battle engine to finish starting under the title: on a
 * mid-range phone PLAY came 2.3 s after the title was drawn.)
 */
import { TITLE, titleLogoAt } from '../render/titleScene';

let leaving = false;
let gone: () => void = () => undefined;
const goneP = new Promise<void>((r) => (gone = r));

/** Resolves once the loading screen has left (at once if there is none). */
export function bootGone(): Promise<void> {
  if (!leaving && typeof document !== 'undefined' && !document.getElementById('boot')) gone();
  return goneP;
}

function remove(boot: HTMLElement): void {
  boot.remove();
  gone();
}

/** Calls `go` once a few frames have come steadily (the title's first frames), at most `maxMs`. */
function whenSettled(go: () => void, maxMs = 300): void {
  const t0 = performance.now();
  let last = t0;
  let calm = 0;
  const tick = (now: number) => {
    calm = now - last < 34 ? calm + 1 : 0;
    last = now;
    if (calm >= 3 || now - t0 > maxMs) go();
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Glides the loading screen's logo onto the title's; false when there is no title to glide to. */
function glideLogo(boot: HTMLElement): boolean {
  const logo = boot.querySelector<HTMLElement>('.bt-logo');
  const canvas = document.querySelector<HTMLCanvasElement>('[data-title] canvas');
  if (!logo || !canvas || !canvas.isConnected) return false;
  const c = canvas.getBoundingClientRect();
  const w = Number(logo.dataset.w);
  const h = Number(logo.dataset.h);
  if (!c.width || !w || !h) return false;
  // Screen px per title art px, and the title's logo box on screen.
  const a = c.width / TITLE.w;
  const at = titleLogoAt();
  const to = { x: c.left + at.x * a, y: c.top + at.y * a, w: w * a, h: h * a };
  // Stop its bob first, so it flies from where it rests.
  logo.style.animation = 'none';
  const from = logo.getBoundingClientRect();
  logo.style.transformOrigin = '0 0';
  logo.style.transform = `translate(${to.x - from.left}px, ${to.y - from.top}px) scale(${to.w / from.width}, ${to.h / from.height})`;
  return true;
}

export function dismissBoot(): void {
  const boot = document.getElementById('boot');
  if (!boot) return void gone();
  if (leaving) return;
  leaving = true;
  const t0 = performance.now();
  const ready = () => {
    // The title (or the game, with ?notitle) rendered, or 8 s without it: go anyway.
    if (!document.querySelector('#root > *') && performance.now() - t0 < 8000) return void requestAnimationFrame(ready);
    // From here a tap reaches the title under it: a quick player's PLAY needn't wait for the exit.
    boot.style.pointerEvents = 'none';
    whenSettled(() => {
      const fill = boot.querySelector<HTMLElement>('.bt-fill');
      if (fill) {
        // From wherever its make-believe progress got to, on to the end.
        fill.style.transform = getComputedStyle(fill).transform;
        fill.style.animation = 'none';
        void fill.offsetWidth;
        fill.style.transition = 'transform 0.14s ease-out';
        fill.style.transform = 'scaleX(1)';
      }
      window.setTimeout(() => {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return remove(boot);
        if (!glideLogo(boot)) {
          boot.dataset.fade = '';
          window.setTimeout(() => remove(boot), 320);
          return;
        }
        // (The glide and the fade take 0.34 s and 0.24 s: src/boot/bootArt.ts.)
        boot.dataset.glide = '';
        window.setTimeout(() => {
          boot.dataset.done = '';
          window.setTimeout(() => remove(boot), 260);
        }, 360);
      }, 150);
    });
  };
  ready();
}
