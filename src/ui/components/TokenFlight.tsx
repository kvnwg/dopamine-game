/**
 * A luck token's flight into the battle's luck row (Kevin: "no more slamming the luck multipliers on
 * screen actually, just slam it into the top where it goes"). On every tab, a token that lands on a
 * reel pops out of it at the size it's drawn there (the Roll tab's reels, or the mini roller in the
 * corner on any other tab), rises a size bigger toward its place in its reel's row near the top of the
 * battle (luckRows.ts), and dives into it at the row's size. As it lands it tells BattleScene
 * (luckBridge), which shows it there from then on, with its flash, its bits, a kick and the row's new
 * total. tokenFx.ts says when it starts (and plays the chime). Nothing flies with Reduce motion, or while something covers the row (the upgrade map, a
 * popup): the row just shows the token.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { luckBridge, luckSlot, TOKEN_FLIGHT } from '../../render/luckRows';
import { luckTokenArt, UI_PX, type ArtScale } from '../../render/icons';
import { stagePoint } from '../drag';
import { useUi, type TokenFlightState } from '../uiStore';
import { PixelArt } from './PixelArt';
import s from './tokenFlight.module.css';

/** It rises toward a spot this far above its place (art px), then dives into it. */
const ABOVE = 9;
/** The rise's share of the flight; the dive takes the rest. */
const RISE = 0.62;
/** It stays a moment after it lands, under the row's own token, so nothing blinks (ms). */
const LINGER = 40;

const snap = (v: number) => Math.round(v / UI_PX) * UI_PX;

/**
 * The reel a token landed on, on screen now: the Roll tab's, else the mini roller's (stage px), and the
 * size its token is drawn at there (the flight starts at that size, so it comes out of the reel).
 */
function originOf(reel: number): { x: number; y: number; scale: ArtScale } | null {
  const big = document.querySelector(`[data-reel="${reel}"]`);
  const el = big ?? document.querySelector(`[data-mini-reel="${reel}"]`) ?? document.querySelector('[data-mini-roller]');
  const r = el?.getBoundingClientRect();
  if (!el || !r || r.width < 2) return null;
  const px = big ? Number(big.querySelector('img[data-px]')?.getAttribute('data-px') ?? 1) : 1;
  return { ...stagePoint(r.left + r.width / 2, r.top + r.height / 2), scale: px >= 3 ? 3 : px >= 2 ? 2 : 1 };
}

/** Whether the battle shows at a stage point (nothing covers it there: a popup, the upgrade map). */
function battleShows(x: number, y: number): boolean {
  const stage = document.querySelector<HTMLElement>('[data-stage]');
  if (!stage) return false;
  const r = stage.getBoundingClientRect();
  const k = r.width / (stage.offsetWidth || 1) || 1;
  return !!document.elementFromPoint(r.left + x * k, r.top + y * k)?.closest('[data-drop="equip"]');
}

export function TokenFlights() {
  const flights = useUi((u) => u.tokenFlights);
  return (
    <>
      {flights.map((f) => (
        <Flight key={f.id} f={f} />
      ))}
    </>
  );
}

const done = (id: number) => useUi.setState((u) => ({ tokenFlights: u.tokenFlights.filter((f) => f.id !== id) }));

function Flight({ f }: { f: TokenFlightState }) {
  const flyRef = useRef<HTMLDivElement>(null);
  // Its picture at each size, all in place from the start (decoded before they're needed), one shown.
  const sizes = useRef<(HTMLDivElement | null)[]>([]);
  const [plan] = useState(() => {
    const to = luckSlot(f.row, f.step, f.step + 1);
    const from = originOf(f.reel);
    return from && battleShows(to.x, to.y) ? { from, to } : null;
  });

  useLayoutEffect(() => {
    if (!plan) {
      // Nothing to fly: it shows in its row right away.
      luckBridge.land?.(f.key);
      done(f.id);
      return;
    }
    const { from, to } = plan;
    const top = { x: to.x, y: to.y - ABOVE * UI_PX };
    const t0 = performance.now();
    const fly = TOKEN_FLIGHT.fly;
    let raf = 0;
    let shown = 0;
    for (const box of sizes.current) void box?.querySelector('img')?.decode().catch(() => {});
    const place = () => {
      const ms = performance.now() - t0;
      let x = from.x;
      let y = from.y;
      let sc: ArtScale = from.scale;
      if (ms < TOKEN_FLIGHT.pop) {
        // Pops up out of the reel.
        y = from.y - (ms > TOKEN_FLIGHT.pop / 2 ? 2 * UI_PX : UI_PX);
      } else {
        const k = Math.min(1, (ms - TOKEN_FLIGHT.pop) / fly);
        if (k < RISE) {
          // Rises toward the spot over its place, a size up (it comes at you).
          const u = k / RISE;
          const e = 1 - (1 - u) * (1 - u);
          x = from.x + (top.x - from.x) * e;
          y = from.y - 2 * UI_PX + (top.y - from.y + 2 * UI_PX) * e;
          sc = u < 0.3 ? from.scale : 2;
        } else {
          // Dives into its place at the row's size: the slam.
          const u = (k - RISE) / (1 - RISE);
          x = top.x;
          y = top.y + (to.y - top.y) * u * u;
          sc = u < 0.5 ? 2 : 1;
        }
      }
      if (sc !== shown) {
        shown = sc;
        sizes.current.forEach((box, i) => box && (box.style.visibility = i + 1 === sc ? 'visible' : 'hidden'));
      }
      if (flyRef.current) flyRef.current.style.transform = `translate3d(${snap(x)}px, ${snap(y)}px, 0)`;
      return ms;
    };
    let landed = false;
    const frame = () => {
      const ms = place();
      // It slams in: the battle shows it in its row from now (it lingers a moment over it).
      if (!landed && ms >= TOKEN_FLIGHT.pop + fly) {
        landed = true;
        luckBridge.land?.(f.key);
      }
      if (ms < TOKEN_FLIGHT.pop + fly + LINGER) raf = requestAnimationFrame(frame);
      else done(f.id);
    };
    // In place before it's first drawn (it can mount partway through a frame).
    place();
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      if (!landed) luckBridge.land?.(f.key);
    };
  }, [plan, f.id, f.key]);

  if (!plan) return null;
  const half = (n: number) => -Math.round(n / 2) * UI_PX;
  return (
    <div ref={flyRef} className={s.fly} data-token-fly aria-hidden>
      {([1, 2, 3] as const).map((sc) => {
        const art = luckTokenArt(f.x, sc);
        return (
          <div
            key={sc}
            ref={(el) => {
              sizes.current[sc - 1] = el;
            }}
            style={{ visibility: 'hidden' }}
          >
            <PixelArt art={art} style={{ position: 'absolute', left: half(art.w), top: half(art.h) }} />
          </div>
        );
      })}
    </div>
  );
}
