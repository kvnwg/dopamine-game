/**
 * The reels. Core decides every reel's result when a spin starts (state.roll.current); each reel
 * rolls downward and eases onto its result, one after another, with the rarest result stopping
 * last. Everything rolling past is blacked out but shows its "1 in X" odds, and the result is
 * revealed in color as its reel stops.
 *
 * The items rolling past are a tease, not a sample: they lean much rarer than the real odds, with
 * a near miss next to most results (BAL.feel.reels). Only the landed results come from the real
 * odds, which the Luck popup lists. Every spin is free; a paid spin must never get this tease.
 *
 * Pixel sizes: every cell shows its art at 16 x 16 x 9 px (144) under a one-line "1 in X" label; the
 * strip only ever moves by whole stage px, and the reels' widths keep the art on whole pixels.
 *
 * Structure: .bank > .reels > .reel (one per reel) > .strip (moves) > .cell (one per item rolling past:
 * .odds label + art), plus .curve (the drum's frame and shading) over each strip; .payline marks the
 * result row across every reel. A cell's look comes from data-rarity / data-revealed / data-token.
 *
 * Luck tokens: a reel can stop on a clover token first (core rolls them; see reelStrip.ts for the
 * strips and reelTiming.ts for when each reel stops). It chimes, its ×N chip stacks up on the reel,
 * and the reel spins on to its next stop. Fillers only show unlocked items.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { formatNumber, reelCount, type GameState } from '../../core';
import { gameStore, useGame } from '../../app/store';
import { itemArt, luckTokenArt, uiBitArt, uiIcon, type Art } from '../../render/icons';
import { LUCK_TOKENS } from '../../render/pixel/ui';
import { haptics } from '../../services';
import { audio } from '../../services/audio';
import { t } from '../i18n';
import { buildStrip, filler, stripAt, type Strip, type StripCell } from '../reelStrip';
import { useUi } from '../uiStore';
import { PixelArt } from './PixelArt';
import s from './reel.module.css';

/** Cell height in stage px (20 art px): a 27 px "1 in X" line over the 144 px art. */
export const CELL = 180;

/**
 * Width of each reel (stage px) by reel count: wider while there are few, and always the art (144)
 * plus whole art pixels on each side. Three reels share the card with the info column, so they are
 * the narrowest: one pixel of drum each side.
 */
export function reelWidth(n: number): number {
  return [216, 198, 162, 180, 180][Math.min(5, Math.max(1, n)) - 1];
}

/** Space between reels. */
export function reelGap(n: number): number {
  return n >= 4 ? 9 : 18;
}

/** The bank's frame around the reels (each side). */
export const BANK_PAD = 18;

/** The whole bank's width for `n` reels. */
export function bankWidth(n: number): number {
  return n * reelWidth(n) + (n - 1) * reelGap(n) + 2 * BANK_PAD;
}

/** A cell's picture: its item, or a luck token's clover (the plain clover for a value without its own art). */
function cellArt(c: StripCell): Art {
  if (c.token === null) return itemArt(c.baseId);
  return c.token in LUCK_TOKENS ? luckTokenArt(c.token as keyof typeof LUCK_TOKENS) : uiIcon('clover', 'lg');
}

interface Run {
  key: string;
  strips: Strip[];
  t0: number;
  /** Stops each reel has reached (its tokens, then its item). */
  reached: number[];
  lastIdx: number[];
}

/** Each reel's strip for a spin (reelStrip.ts): from the last results, through any tokens, to the result. */
function buildRun(spin: NonNullable<GameState['roll']['current']>, prev: (StripCell | undefined)[], timerSec: number, rebirths: number): Run {
  const strips = spin.reels.map((_, i) => buildStrip(spin, i, prev[i], rebirths));
  const elapsed = timerSec * 1000;
  return {
    key: spin.reels.map((r) => r.item.uid).join(','),
    strips,
    t0: performance.now() - elapsed,
    reached: strips.map((st) => stripAt(st, elapsed).reached),
    lastIdx: strips.map(() => 0),
  };
}

/** Index of the result cell (the last stop). */
const resultIdx = (st: Strip) => (st.stops.length ? st.stops[st.stops.length - 1].idx : 0);

/** The multiplier a reel has stacked up after `reached` stops. */
function chainOf(st: Strip, reached: number): number {
  let x = 1;
  for (let k = 0; k < Math.min(reached, st.stops.length); k++) x *= st.stops[k].token ?? 1;
  return x;
}

/**
 * The reels. `win` is the window's height in stage px (even, so the result row sits on whole pixels):
 * the result row in the middle with part of the cells above and below. `wide` (info rows above and
 * below the bank) moves the golden / lucky / turbo badges to the bank's bottom edge.
 */
export function ReelBank({ win, wide }: { win: number; wide?: boolean }) {
  const spin = useGame((g) => g.roll.current);
  const idleCount = useGame(reelCount);
  const rebirths = useGame((g) => g.rebirths);
  const calm = useGame((g) => g.settings.reduceMotion);
  const charging = useUi((u) => u.charging);
  const [run, setRun] = useState<Run | null>(null);
  const [chain, setChain] = useState<number[]>([]);
  const runRef = useRef<Run | null>(null);
  const prevRef = useRef<(StripCell | undefined)[]>([]);
  const stripRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const winH = win;

  // A new spin: build fresh strips that start from the last results.
  const spinKey = spin ? spin.reels.map((r) => r.item.uid).join(',') : '';
  useEffect(() => {
    if (!spin || runRef.current?.key === spinKey) return;
    const next = buildRun(spin, prevRef.current, gameStore.getState().game.roll.timer, rebirths);
    prevRef.current = next.strips.map((st) => st.cells[resultIdx(st)]);
    runRef.current = next;
    setRun(next);
    setChain(next.strips.map((st, i) => chainOf(st, next.reached[i])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  // Idle (nothing spinning yet): the last results, or blacked-out fillers.
  const idle = useMemo<Run>(() => {
    const n = Math.max(1, prevRef.current.length || idleCount);
    const strips: Strip[] = Array.from({ length: n }, (_, i) => ({
      cells: [prevRef.current[i] ?? filler(i * 101 + 7, false, rebirths, false), filler(i * 101 + 8, false, rebirths, false), filler(i * 101 + 9, false, rebirths, false)],
      stops: [],
    }));
    return { key: 'idle', strips, t0: 0, reached: strips.map(() => 0), lastIdx: strips.map(() => 0) };
  }, [idleCount, rebirths]);

  const shown = run ?? idle;

  // The animation runs straight on the DOM; React only renders when a spin starts or a token lands.
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const r = runRef.current;
      if (!r) return;
      const el = performance.now() - r.t0;
      r.strips.forEach((st, i) => {
        const node = stripRefs.current[i];
        if (!node) return;
        const at = stripAt(st, el, calm);
        // Whole stage px only, so the art never lands between pixels.
        node.style.transform = `translate3d(0, ${Math.round(winH / 2 + at.p * CELL)}px, 0)`;
        const idx = Math.round(at.p);
        if (idx !== r.lastIdx[i]) {
          r.lastIdx[i] = idx;
          if (at.reached < st.stops.length) audio.wheelTick(0.6);
        }
        while (r.reached[i] < at.reached) {
          const k = r.reached[i];
          const stop = st.stops[k];
          r.reached[i] += 1;
          cellRefs.current.get(`${r.key}:${i}:${stop.idx}`)?.setAttribute('data-revealed', '');
          if (stop.token !== null) {
            // A luck token: chime, burst, and the reel spins on with its luck multiplied.
            audio.token(k, stop.token);
            setTimeout(() => audio.respin(), 260);
            haptics.impact('medium');
            const x = chainOf(st, r.reached[i]);
            setChain((c) => c.map((v, j) => (j === i ? x : v)));
          } else {
            audio.wheelStop();
            haptics.impact('light');
          }
        }
      });
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [calm, winH]);

  const n = shown.strips.length;
  const reelW = reelWidth(n);
  const label = n === 1 ? 30 : n === 2 ? 28 : 26;
  const style = { width: bankWidth(n), ['--cell' as string]: `${CELL}px`, ['--label' as string]: `${label}px` } as CSSProperties;
  return (
    <div
      className={s.bank}
      style={style}
      data-charging={charging ? charging.item.rarity : undefined}
      data-golden={spin?.golden || undefined}
      data-wide={wide || undefined}
    >
      <div className={s.reels} style={{ height: winH, gap: reelGap(n) }}>
        {shown.strips.map((st, i) => {
          const res = resultIdx(st);
          const x = run ? chain[i] ?? 1 : 1;
          return (
            <div key={`${shown.key}:${i}`} className={s.reel} style={{ width: reelW }}>
              <div
                className={s.strip}
                ref={(el) => {
                  stripRefs.current[i] = el;
                  if (el && !el.style.transform) el.style.transform = `translate3d(0, ${winH / 2}px, 0)`;
                }}
              >
                {st.cells.map((c, j) => {
                  const stopAt = st.stops.findIndex((p) => p.idx === j);
                  // Real cells show in color: the last result at the bottom always, stops once reached.
                  const revealed = c.real && (stopAt < 0 || shown.reached[i] > stopAt || (!run && j === res));
                  return (
                    <div
                      key={j}
                      className={s.cell}
                      data-rarity={c.rarity}
                      data-token={c.token !== null || undefined}
                      data-revealed={revealed ? '' : undefined}
                      ref={
                        stopAt >= 0
                          ? (el) => {
                              const key = `${shown.key}:${i}:${j}`;
                              if (el) cellRefs.current.set(key, el);
                              else cellRefs.current.delete(key);
                            }
                          : undefined
                      }
                      style={{ top: -j * CELL - CELL / 2 }}
                    >
                      {/* The odds sit on top of their own item (like the Bag's badges), so they never read as the next item's. */}
                      <span className={s.odds}>
                        {c.token !== null ? (
                          t('reel.token', { x: c.token })
                        ) : (
                          <>
                            <i>{t('reel.oneIn')}</i>
                            {formatNumber(c.odds)}
                          </>
                        )}
                      </span>
                      <PixelArt art={cellArt(c)} className={s.art} />
                    </div>
                  );
                })}
              </div>
              <div className={s.curve} />
              {x > 1 && (
                <span key={x} className={s.chain}>
                  ×{formatNumber(x)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className={s.payline}>
        <PixelArt art={uiBitArt('paylineL')} className={s.arrowL} />
        <PixelArt art={uiBitArt('paylineL', true)} className={s.arrowR} />
      </div>
      {spin && (spin.golden || spin.lucky || spin.turbo) && (
        <div className={s.badges}>
          {spin.golden && <span className={s.badge} data-kind="golden">{t('reel.golden')}</span>}
          {spin.lucky && <span className={s.badge} data-kind="lucky">{t('reel.lucky')}</span>}
          {spin.turbo && <span className={s.badge} data-kind="turbo">{t('reel.turbo')}</span>}
        </div>
      )}
    </div>
  );
}
