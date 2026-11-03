/**
 * A new game's dumpster, padlocked under steel (Kevin: "when they first start playing, they have to
 * click the spinner for the lock and metal to fall off and then it starts spinning"). Two riveted
 * plates and a strap cross the reels with a padlock on them; it wiggles now and then and a glint runs
 * along the steel. A tap clanks it, the shackle pops, and everything drops off the machine (whole
 * pixels, its own little gravity); then the dumpster opens (core openDumpster) and the first spin
 * starts. Shown until the pieces are gone, then never again.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { dispatch, useGame } from '../../app/store';
import { haptics } from '../../services';
import { audio } from '../../services/audio';
import { uiBitArt, UI_PX } from '../../render/icons';
import { t } from '../i18n';
import { PixelArt } from './PixelArt';
import s from './dumpsterLock.module.css';

type Phase = 'idle' | 'hit' | 'open' | 'fall';
const PIECES = ['strap', 'plateA', 'plateB', 'lock'] as const;
type Piece = (typeof PIECES)[number];

/** Launch velocities (stage px per second) and start delays (ms) of the fall. */
const LAUNCH: Record<Piece, { vx: number; vy: number; delay: number }> = {
  lock: { vx: 150, vy: -640, delay: 0 },
  strap: { vx: -36, vy: -240, delay: 50 },
  plateA: { vx: -100, vy: -170, delay: 100 },
  plateB: { vx: 120, vy: -110, delay: 160 },
};
const GRAVITY = 3300;
const FALL_MS = 1150;
/** When the shackle pops, the metal starts to fall, and the dumpster opens (ms after the tap). */
const T_OPEN = 170;
const T_FALL = 320;
const T_ROLL = 720;

const snap = (v: number) => Math.round(v / UI_PX) * UI_PX;
const u = (n: number) => n * UI_PX;

/** Sparks out of the keyhole when it breaks (art pixels; multiples of 3, so each third of the way is whole). */
const SPARKS = [
  [-9, -6],
  [9, -6],
  [-12, 3],
  [12, 3],
  [-6, -9],
  [6, -12],
] as const;

export function DumpsterLock() {
  const locked = useGame((g) => !g.features.unlocked.includes('roll'));
  const [phase, setPhase] = useState<Phase | null>(locked ? 'idle' : null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const pieces = useRef<Partial<Record<Piece, HTMLElement | null>>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const raf = useRef(0);

  useLayoutEffect(() => {
    const el = root.current;
    if (el) setBox({ w: el.offsetWidth, h: el.offsetHeight });
  }, [phase === null]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      cancelAnimationFrame(raf.current);
    },
    [],
  );
  // Opened some other way (not by this tap): nothing to show.
  useEffect(() => {
    if (!locked && phase === 'idle') setPhase(null);
  }, [locked, phase]);

  if (!phase) return null;

  const fall = () => {
    const t0 = performance.now();
    const frame = () => {
      const ms = performance.now() - t0;
      for (const p of PIECES) {
        const el = pieces.current[p];
        if (!el) continue;
        const L = LAUNCH[p];
        const sec = Math.max(0, ms - L.delay) / 1000;
        const x = L.vx * sec;
        const y = L.vy * sec + 0.5 * GRAVITY * sec * sec;
        el.style.transform = `translate3d(${snap(x)}px, ${snap(y)}px, 0)`;
        // Fades out in quarter steps near the end.
        el.style.opacity = String(sec < 0.6 ? 1 : Math.max(0, 1 - Math.ceil((sec - 0.6) / 0.08) * 0.25));
      }
      if (ms < FALL_MS) raf.current = requestAnimationFrame(frame);
      else setPhase(null);
    };
    raf.current = requestAnimationFrame(frame);
  };

  const open = () => {
    if (phase !== 'idle') return;
    setPhase('hit');
    audio.lockHit();
    haptics.impact('medium');
    timers.current.push(
      setTimeout(() => {
        setPhase('open');
        audio.lockBreak();
      }, T_OPEN),
      setTimeout(() => {
        setPhase('fall');
        haptics.impact('heavy');
        fall();
      }, T_FALL),
      // The reels start while the metal is still falling.
      setTimeout(() => dispatch({ type: 'openDumpster' }), T_ROLL),
    );
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  };

  // Everything on whole art pixels from the machine's middle.
  const w = box?.w ?? 0;
  const h = box?.h ?? 0;
  const midX = snap(w / 2);
  const midY = snap(h / 2);
  const lockArt = uiBitArt(phase === 'idle' || phase === 'hit' ? 'padlock' : 'padlockOpen');
  return (
    <div
      ref={root}
      className={s.lock}
      data-phase={phase}
      data-dumpster-lock
      role="button"
      tabIndex={0}
      aria-label={t('roll.unlockAria')}
      onClick={open}
      onKeyDown={onKey}
    >
      <div className={s.tint} />
      {box && (
        <>
          <div ref={(el) => {
              pieces.current.strap = el;
            }} className={s.strap} style={{ left: midX - u(8) }}>
            <span className={s.rivet} style={{ left: u(6), top: u(3) }} />
            <span className={s.rivet} style={{ left: u(6), bottom: u(3) }} />
          </div>
          {(['plateA', 'plateB'] as const).map((p, i) => (
            <div key={p} ref={(el) => {
                pieces.current[p] = el;
              }} className={s.plate} style={{ top: midY + (i === 0 ? u(-20) : u(9)) }}>
              <span className={s.rivet} style={{ left: u(4), top: u(4) }} />
              <span className={s.rivet} style={{ right: u(4), top: u(4) }} />
              <span className={s.rivet} style={{ left: midX - u(14), top: u(4) }} />
              <span className={s.rivet} style={{ left: midX + u(12), top: u(4) }} />
            </div>
          ))}
          <div ref={(el) => {
              pieces.current.lock = el;
            }} className={s.padlock} style={{ left: midX - u(12), top: midY - u(18) }} data-lock-target>
            <PixelArt art={lockArt} />
            {(phase === 'open' || phase === 'fall') &&
              SPARKS.map(([dx, dy], k) => (
                <span key={k} className={s.spark} style={{ '--dx': `${u(dx)}px`, '--dy': `${u(dy)}px` } as CSSProperties} />
              ))}
          </div>
        </>
      )}
    </div>
  );
}
