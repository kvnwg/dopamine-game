/**
 * A luck token's multiplier, out of the wheel and onto the screen (Kevin: "when u hit a multiplier, the
 * number should come out of wheel, get big, and then slam down into the middle of ur screen. wherever
 * the wheel might be"). On every tab: the token pops out of the reel it landed on (the Roll tab's
 * reels, or the mini roller in the corner on any other tab) at the size it's drawn there, flies to the
 * middle of the screen growing a size at a time up to its Scale3x picture, hangs there a beat, then slams down
 * to its Scale2x picture: the battle gets a small kick, a ring and clover bits fly out, green rays
 * turn behind it and the reel's new luck ("×6 LUCK", and what a big chain guarantees) is stamped
 * under it; then it lifts away. tokenFx.ts says when (and plays the chime).
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useGame } from '../../app/store';
import { chainFloor, formatNumber } from '../../core';
import { rarityColor } from '../../render/art';
import { slamBridge } from '../../render/equipSlam';
import { luckTokenArt, UI_PX, type ArtScale } from '../../render/icons';
import { stagePoint } from '../drag';
import { t } from '../i18n';
import { raysUrl } from '../rays';
import { useUi } from '../uiStore';
import { PixelArt } from './PixelArt';
import s from './tokenSlam.module.css';

/** Where it lands (stage px): over the battle, on every tab. */
const CENTER = { x: 540, y: 560 };
/** The flight (ms): a pop out of the reel, the flight in, a beat hanging big over the spot, the slam. */
const POP = 90;
const FLY = 230;
const HANG = 90;
const SLAM_AT = POP + FLY + HANG;
/** How long the slam's own moment runs (tokenSlam.module.css runs on the same length). */
const HIT_MS = 1400;
const GREEN = '#7ef08f';

/** Clover bits thrown out on impact (art px; multiples of 3, so each third of the way is whole). */
const BITS = [
  [-30, -18],
  [30, -18],
  [-36, 6],
  [36, 6],
  [-18, -30],
  [18, -30],
  [-24, 24],
  [24, 24],
] as const;

const snap = (v: number) => Math.round(v / UI_PX) * UI_PX;

/**
 * The reel a token landed on, on screen now: the Roll tab's, else the mini roller's (stage px), and the
 * size its token is drawn at there (the flight starts at that size, so it comes out of the reel).
 */
function originOf(reel: number): { x: number; y: number; scale: ArtScale } {
  const big = document.querySelector(`[data-reel="${reel}"]`);
  const el = big ?? document.querySelector(`[data-mini-reel="${reel}"]`) ?? document.querySelector('[data-mini-roller]');
  const r = el?.getBoundingClientRect();
  if (!el || !r || r.width < 2) return { x: CENTER.x, y: 120, scale: 1 };
  const px = big ? Number(big.querySelector('img[data-px]')?.getAttribute('data-px') ?? 1) : 1;
  return { ...stagePoint(r.left + r.width / 2, r.top + r.height / 2), scale: px >= 3 ? 3 : px >= 2 ? 2 : 1 };
}

/** The size on its way in: from its size in the reel up to its Scale3x picture, a step at a time. */
function sizeAt(from: ArtScale, k: number): ArtScale {
  if (from === 1) return k < 0.4 ? 1 : k < 0.75 ? 2 : 3;
  return k < 0.5 ? from : 3;
}

export function TokenSlam() {
  const slam = useUi((u) => u.tokenSlam);
  if (!slam) return null;
  return <Slam key={slam.id} slam={slam} />;
}

function Slam({ slam }: { slam: NonNullable<ReturnType<typeof useUi.getState>['tokenSlam']> }) {
  const calm = useGame((g) => g.settings.reduceMotion);
  const [phase, setPhase] = useState<'fly' | 'hit'>(calm ? 'hit' : 'fly');
  const flyRef = useRef<HTMLDivElement>(null);
  // Its picture at each size, all in place from the start (decoded before they're needed), one shown.
  const sizes = useRef<(HTMLDivElement | null)[]>([]);

  // The flight, straight on the DOM in whole art pixels; the picture steps up a size as it comes.
  useLayoutEffect(() => {
    if (phase !== 'fly') return;
    const from = originOf(slam.reel);
    const hangY = CENTER.y - 10 * UI_PX;
    const t0 = performance.now();
    let raf = 0;
    let shown = 0;
    for (const box of sizes.current) void box?.querySelector('img')?.decode().catch(() => {});
    const place = () => {
      const ms = performance.now() - t0;
      let x = from.x;
      let y = from.y;
      let sc: ArtScale = from.scale;
      if (ms < POP) {
        // Pops up out of the reel.
        y = from.y - (ms > POP / 2 ? 2 * UI_PX : UI_PX);
      } else if (ms < POP + FLY) {
        const k = (ms - POP) / FLY;
        const e = 1 - Math.pow(1 - k, 2);
        x = from.x + (CENTER.x - from.x) * e;
        y = from.y - 2 * UI_PX + (hangY - from.y + 2 * UI_PX) * e;
        sc = sizeAt(from.scale, k);
      } else {
        x = CENTER.x;
        y = hangY;
        sc = 3;
      }
      if (sc !== shown) {
        shown = sc;
        sizes.current.forEach((box, i) => box && (box.style.visibility = i + 1 === sc ? 'visible' : 'hidden'));
      }
      if (flyRef.current) flyRef.current.style.transform = `translate3d(${snap(x)}px, ${snap(y)}px, 0)`;
      return ms;
    };
    const frame = () => {
      if (place() < SLAM_AT) raf = requestAnimationFrame(frame);
      else setPhase('hit');
    };
    // In place before it's first drawn (it can mount partway through a frame).
    place();
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, slam.reel]);

  // The hit: a small kick of the battle (its own shake, as a blow's), then it's gone.
  useEffect(() => {
    if (phase !== 'hit') return;
    if (!calm) slamBridge.shake?.(240, 1);
    const id = slam.id;
    const done = setTimeout(() => useUi.setState((u) => (u.tokenSlam?.id === id ? { tokenSlam: null } : {})), HIT_MS + 50);
    return () => clearTimeout(done);
  }, [phase, calm, slam.id]);

  if (phase === 'fly') {
    const half = (n: number) => -Math.round(n / 2) * UI_PX;
    return (
      <div ref={flyRef} className={s.fly} data-token-fly aria-hidden>
        {([1, 2, 3] as const).map((sc) => {
          const art = luckTokenArt(slam.x, sc);
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
  // A big chain guarantees a rarity (chainFloor): say so under its luck.
  const floor = chainFloor(slam.total);
  return (
    <div className={s.slam} data-calm={calm || undefined} data-token-slam aria-hidden>
      <div className={s.rays} style={{ backgroundImage: `url(${raysUrl([GREEN], 16, 0.5)})` }} />
      <div className={s.ring} />
      <PixelArt art={luckTokenArt(slam.x, 2)} className={s.small} />
      <div className={s.bits}>
        {BITS.map(([dx, dy], k) => (
          <i key={k} style={{ '--dx': `${dx * UI_PX}px`, '--dy': `${dy * UI_PX}px` } as CSSProperties} />
        ))}
      </div>
      <div className={s.text}>{t('reel.token', { x: formatNumber(slam.total) })}</div>
      {floor && (
        <div className={s.floor} style={{ color: rarityColor(floor) }}>
          {t('reel.tokenFloor', { rarity: t(`rarity.${floor}`).toUpperCase() })}
        </div>
      )}
    </div>
  );
}
