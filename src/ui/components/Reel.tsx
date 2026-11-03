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
 * result row across every reel. A cell's look comes from data-rarity / data-revealed.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { BAL, DATA, RARITIES, type Rarity } from '../../data';
import { formatNumber, rarityAtLeast, rarityChances, rarityIndex, reelCount, type GameState, type Item } from '../../core';
import { gameStore, useGame } from '../../app/store';
import { itemArt, uiBitArt, type Art } from '../../render/icons';
import { haptics } from '../../services';
import { audio } from '../../services/audio';
import { t } from '../i18n';
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

interface Cell {
  art: Art;
  rarity: Rarity;
  odds: number;
  /** A real roll result (shown in color once landed), not a filler. */
  real: boolean;
}

interface Strip {
  cells: Cell[];
  /** Index of the result cell. */
  k: number;
  stopMs: number;
}

interface Run {
  key: string;
  strips: Strip[];
  t0: number;
  landed: boolean[];
  lastIdx: number[];
}

function hash(n: number): number {
  let h = Math.imul(n + 0x9e37, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return ((h >>> 0) % 100000) / 100000;
}

const BASE_ODDS = (() => {
  const c = rarityChances(1);
  return Object.fromEntries(RARITIES.map((r) => [r, Math.max(1, Math.round(1 / c[r]))])) as Record<Rarity, number>;
})();

/** Odds of an enchanted roll at base chances (count I, tier I/II/III): used to dress up some fillers. */
function enchantFlair(u: number): number {
  const e = BAL.enchant;
  const countShare = e.countWeights[0] / e.countWeights.reduce((a, b) => a + b, 0);
  const tw = e.tierWeights.reduce((a, b) => a + b, 0);
  const tier = u < 0.6 ? 0 : u < 0.9 ? 1 : 2;
  return 1 / (e.baseChance * countShare * (e.tierWeights[tier] / tw));
}

function pickRarity(u: number, weights: Record<Rarity, number>): Rarity {
  const total = RARITIES.reduce((a, r) => a + weights[r], 0);
  let acc = 0;
  for (const r of RARITIES) {
    acc += weights[r] / total;
    if (u < acc) return r;
  }
  return 'junk';
}

const NEAR_MISS: Record<Rarity, number> = {
  junk: 0, decent: 0, shiny: 0, epic: 0, legendary: 50, mythic: 33, vintage: 30, limited: 26, prototype: 22, mint: 17, gemMint: 12, museum: 8, grail: 5,
};

/** A made-up item rolling past: rarer than real odds (see the file comment). */
function filler(seed: number, nearMiss: boolean): Cell {
  const f = BAL.feel.reels;
  const rarity = pickRarity(hash(seed * 7 + 1), nearMiss ? NEAR_MISS : f.fillerWeights);
  const base = DATA.items[Math.floor(hash(seed * 13 + 5) * DATA.items.length)];
  let odds = BASE_ODDS[rarity];
  if (rarityAtLeast(rarity, 'epic') && hash(seed * 17 + 9) < f.flairChance) odds = Math.round(odds * enchantFlair(hash(seed * 19 + 3)));
  return { art: itemArt(base.id), rarity, odds, real: false };
}

function resultCell(item: Item, odds: number): Cell {
  return { art: itemArt(item.baseId), rarity: item.rarity, odds, real: true };
}

/** Builds each reel's strip for a spin: the previous result at the bottom, fillers, the result, two more on top. */
function buildRun(spin: NonNullable<GameState['roll']['current']>, prev: (Cell | undefined)[], timerSec: number): Run {
  const f = BAL.feel.reels;
  const n = spin.reels.length;
  const spinMs = spin.spinSeconds * 1000;
  // Left to right, but an Epic-or-better result stops last.
  const order = spin.reels.map((_, i) => i);
  const rarest = order.reduce((a, b) => (rarityIndex(spin.reels[b].item.rarity) > rarityIndex(spin.reels[a].item.rarity) ? b : a), 0);
  if (n > 1 && rarityAtLeast(spin.reels[rarest].item.rarity, 'epic')) {
    order.splice(order.indexOf(rarest), 1);
    order.push(rarest);
  }
  const strips = spin.reels.map((r, i) => {
    const pos = order.indexOf(i);
    const share = n === 1 ? 1 : f.firstStopShare + (1 - f.firstStopShare) * (pos / (n - 1));
    const stopMs = spinMs * share;
    const k = Math.max(f.minCells, Math.round((stopMs / 1000) * f.cellsPerSecond));
    const seed = r.item.uid * 97 + i * 13;
    const tease = !rarityAtLeast(r.item.rarity, 'legendary') && hash(seed + 77) < f.nearMissChance;
    const above = hash(seed + 91) < 0.5;
    const cells: Cell[] = [prev[i] ?? filler(seed, false)];
    for (let c = 1; c < k; c++) cells.push(filler(seed + c * 31, tease && !above && c === k - 1));
    cells.push(resultCell(r.item, r.odds));
    cells.push(filler(seed + 7001, tease && above));
    cells.push(filler(seed + 7002, false));
    return { cells, k, stopMs };
  });
  const elapsed = timerSec * 1000;
  return {
    key: spin.reels.map((r) => r.item.uid).join(','),
    strips,
    t0: performance.now() - elapsed,
    landed: strips.map((st) => elapsed >= st.stopMs),
    lastIdx: strips.map(() => 0),
  };
}

/** Cells travelled at `x` (0..1 of the reel's run): fast, then easing in, with a small clunk past the line at the end. */
function travel(k: number, x: number): number {
  if (x >= 1) return k;
  return k * (1 - Math.pow(1 - x, 4)) + 0.2 * Math.sin(Math.PI * Math.pow(x, 8));
}

/**
 * The reels. `win` is the window's height in stage px (even, so the result row sits on whole pixels):
 * the result row in the middle with part of the cells above and below. `wide` (info rows above and
 * below the bank) moves the golden / lucky / turbo badges to the bank's bottom edge.
 */
export function ReelBank({ win, wide }: { win: number; wide?: boolean }) {
  const spin = useGame((g) => g.roll.current);
  const idleCount = useGame(reelCount);
  const calm = useGame((g) => g.settings.reduceMotion);
  const charging = useUi((u) => u.charging);
  const [run, setRun] = useState<Run | null>(null);
  const runRef = useRef<Run | null>(null);
  const prevRef = useRef<(Cell | undefined)[]>([]);
  const stripRefs = useRef<(HTMLDivElement | null)[]>([]);
  const resultRefs = useRef<(HTMLDivElement | null)[]>([]);
  const winH = win;

  // A new spin: build fresh strips that start from the last results.
  const spinKey = spin ? spin.reels.map((r) => r.item.uid).join(',') : '';
  useEffect(() => {
    if (!spin || runRef.current?.key === spinKey) return;
    const next = buildRun(spin, prevRef.current, gameStore.getState().game.roll.timer);
    prevRef.current = next.strips.map((st) => st.cells[st.k]);
    runRef.current = next;
    setRun(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  // Idle (nothing spinning yet): the last results, or blacked-out fillers.
  const idle = useMemo<Run>(() => {
    const n = Math.max(1, prevRef.current.length || idleCount);
    const strips = Array.from({ length: n }, (_, i) => ({
      cells: [prevRef.current[i] ?? filler(i * 101 + 7, false), filler(i * 101 + 8, false), filler(i * 101 + 9, false)],
      k: 0,
      stopMs: 0,
    }));
    return { key: 'idle', strips, t0: 0, landed: strips.map(() => true), lastIdx: strips.map(() => 0) };
  }, [idleCount]);

  const shown = run ?? idle;

  // The animation runs straight on the DOM; React only renders when a spin starts.
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
        const x = st.stopMs > 0 ? Math.min(1, el / st.stopMs) : 1;
        const p = calm ? (x >= 1 ? st.k : 0) : travel(st.k, x);
        // Whole stage px only, so the art never lands between pixels.
        node.style.transform = `translate3d(0, ${Math.round(winH / 2 + p * CELL)}px, 0)`;
        const idx = Math.round(p);
        if (idx !== r.lastIdx[i]) {
          r.lastIdx[i] = idx;
          if (x < 0.97) audio.wheelTick(1 - x);
        }
        if (!r.landed[i] && x >= 1) {
          r.landed[i] = true;
          resultRefs.current[i]?.setAttribute('data-revealed', '');
          audio.wheelStop();
          haptics.impact('light');
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
        {shown.strips.map((st, i) => (
          <div key={`${shown.key}:${i}`} className={s.reel} style={{ width: reelW }}>
            <div
              className={s.strip}
              ref={(el) => {
                stripRefs.current[i] = el;
                if (el && !el.style.transform) el.style.transform = `translate3d(0, ${winH / 2}px, 0)`;
              }}
            >
              {st.cells.map((c, j) => (
                <div
                  key={j}
                  className={s.cell}
                  data-rarity={c.rarity}
                  data-revealed={c.real && (j !== st.k || shown.landed[i] || st.k === 0) ? '' : undefined}
                  ref={j === st.k ? (el) => void (resultRefs.current[i] = el) : undefined}
                  style={{ top: -j * CELL - CELL / 2 }}
                >
                  {/* The odds sit on top of their own item (like the Bag's badges), so they never read as the next item's. */}
                  <span className={s.odds}>
                    <i>{t('reel.oneIn')}</i>
                    {formatNumber(c.odds)}
                  </span>
                  <PixelArt art={c.art} className={s.art} />
                </div>
              ))}
            </div>
            <div className={s.curve} />
          </div>
        ))}
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
