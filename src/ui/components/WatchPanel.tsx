/**
 * The Watch tab: nothing but the rolls. Under the battle, every spin plays big on a stage: the reels
 * roll (one or two reels get double-resolution art), a reel that lands on a luck token bursts into
 * clovers and spins again with its luck multiplied, and each result lands with white swooshes, its
 * rarity's glow, its name and its "1 in X". A button hides the rest of the UI for a clean view.
 *
 * Timing comes from reelTiming/reelStrip (the same as the Roll tab's reels), so tokens and results
 * land here exactly when the Roll tab would show them, and never before core has the item.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { currentLuck, formatNumber, itemName, rarityAtLeast, rarityIndex } from '../../core';
import { gameStore, useGame } from '../../app/store';
import { haptics } from '../../services';
import { audio } from '../../services/audio';
import { useNow } from '../hooks';
import { t } from '../i18n';
import { buildStrip, filler, stripAt, type Strip, type StripCell } from '../reelStrip';
import { multOf } from '../reelTiming';
import { itemArt, itemArtHd, luckTokenArt, luckTokenArtHd, uiIcon, UI_PX, type Art } from '../../render/icons';
import { LUCK_TOKENS } from '../../render/pixel/ui';
import { PixelArt } from './PixelArt';
import { useUi } from '../uiStore';
import { fmtLuck, fmtOdds } from './AlleyPanel';
import s from './watch.module.css';

interface Run {
  key: string;
  strips: Strip[];
  /** Each reel's result as core rolled it (name, tokens). */
  reels: { name: string; mult: number }[];
  t0: number;
  /** Stops each reel has reached (tokens, then the item). */
  reached: number[];
}

/** A landed result for the plate under the reels. */
interface Shown {
  id: number;
  /** The spin it landed in. */
  spin: string;
  reel: number;
  cell: StripCell;
  name: string;
  mult: number;
}

const UNIT = UI_PX;

/** Sizes by reel count: art scale (1 or Scale2x), cell height, window size (stage px, whole units). */
function layout(n: number) {
  const hd = n <= 2;
  const art = (hd ? 32 : 16) * UNIT;
  const cell = art + 4 * UNIT;
  const winW = n === 1 ? art + 8 * UNIT : n === 2 ? art + 6 * UNIT : n === 3 ? art + 7 * UNIT : art + 4 * UNIT;
  // A sliver of the cells above and below shows motion; more for the small cells of 3+ reels.
  const winH = Math.round((cell * (hd ? 1.25 : 1.75)) / UNIT) * UNIT;
  return { hd, art, cell, winW, winH };
}

/** A cell's art: its item (Scale2x when big) or its luck token. */
function cellArt(c: StripCell, hd: boolean): Art {
  if (c.token !== null) {
    if (c.token in LUCK_TOKENS) return hd ? luckTokenArtHd(c.token) : luckTokenArt(c.token as keyof typeof LUCK_TOKENS);
    return uiIcon('clover', 'lg');
  }
  return hd ? itemArtHd(c.baseId) : itemArt(c.baseId);
}

let swooshId = 1;

export function WatchPanel() {
  const spin = useGame((g) => g.roll.current);
  const rebirths = useGame((g) => g.rebirths);
  const calm = useGame((g) => g.settings.reduceMotion);
  const now = useNow(500);
  const luck = useGame((g) => currentLuck(g, now));
  const hideUi = useUi((u) => u.watchHideUi);
  const [run, setRun] = useState<Run | null>(null);
  const runRef = useRef<Run | null>(null);
  const prevRef = useRef<StripCell[]>([]);
  const stripRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [chain, setChain] = useState<number[]>([]);
  const [landed, setLanded] = useState<boolean[]>([]);
  const [shown, setShown] = useState<Shown | null>(null);
  const [swooshes, setSwooshes] = useState<{ id: number; reel: number; big: boolean }[]>([]);
  const [bursts, setBursts] = useState<{ id: number; reel: number }[]>([]);
  const best = useRef<{ name: string; odds: number } | null>(null);

  const n = spin?.reels.length ?? Math.max(1, prevRef.current.length);
  const L = layout(n);

  const spinKey = spin ? spin.reels.map((r) => r.item.uid).join(',') : '';
  useEffect(() => {
    if (!spin || runRef.current?.key === spinKey) return;
    const timer = gameStore.getState().game.roll.timer;
    const strips = spin.reels.map((_, i) => buildStrip(spin, i, prevRef.current[i], rebirths, 11));
    prevRef.current = strips.map((st) => st.cells[st.stops[st.stops.length - 1].idx]);
    const t0 = performance.now() - timer * 1000;
    const elapsed = timer * 1000;
    const reached = strips.map((st) => stripAt(st, elapsed).reached);
    const reels = spin.reels.map((r) => ({ name: itemName(r.item), mult: multOf(r.mults) }));
    const next: Run = { key: spinKey, strips, reels, t0, reached };
    runRef.current = next;
    setRun(next);
    setChain(spin.reels.map((_, i) => chainSoFar(strips[i], reached[i])));
    setLanded(strips.map((st, i) => reached[i] >= st.stops.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  // The animation runs straight on the DOM; React renders on stops.
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const r = runRef.current;
      if (!r) return;
      const el = performance.now() - r.t0;
      const { cell, winH } = layout(r.strips.length);
      r.strips.forEach((st, i) => {
        const node = stripRefs.current[i];
        if (!node) return;
        const at = stripAt(st, el, calm);
        node.style.transform = `translate3d(0, ${Math.round(winH / 2 + at.p * cell)}px, 0)`;
        while (r.reached[i] < at.reached) {
          const stop = st.stops[r.reached[i]];
          r.reached[i] += 1;
          onStop(r, i, stop.token, r.reached[i] - 1);
        }
      });
    };
    const onStop = (r: Run, i: number, token: number | null, step: number) => {
      if (token !== null) {
        audio.token(step, token);
        setTimeout(() => audio.respin(), 260);
        haptics.impact('medium');
        setChain((c) => c.map((x, k) => (k === i ? chainSoFar(r.strips[i], r.reached[i]) : x)));
        setBursts((b) => [...b.slice(-6), { id: swooshId++, reel: i }]);
        return;
      }
      const st = r.strips[i];
      const cellAt = st.cells[st.stops[st.stops.length - 1].idx];
      audio.wheelStop();
      haptics.impact(rarityAtLeast(cellAt.rarity, 'epic') ? 'heavy' : 'light');
      setLanded((l) => l.map((x, k) => (k === i ? true : x)));
      const big = rarityAtLeast(cellAt.rarity, 'legendary');
      setSwooshes((w) => [...w.slice(-6), { id: swooshId++, reel: i, big }]);
      const { name, mult } = r.reels[i];
      setShown((cur) => {
        // The plate shows the rarest result of this spin so far (a new spin starts it over).
        if (cur && cur.spin === r.key && rarityIndex(cur.cell.rarity) > rarityIndex(cellAt.rarity)) return cur;
        return { id: swooshId++, spin: r.key, reel: i, cell: cellAt, name, mult };
      });
      if (!best.current || cellAt.odds > best.current.odds) best.current = { name, odds: cellAt.odds };
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [calm]);

  // Swooshes and bursts clear themselves.
  useEffect(() => {
    if (!swooshes.length && !bursts.length) return;
    const id = setTimeout(() => {
      setSwooshes((w) => w.slice(1));
      setBursts((b) => b.slice(1));
    }, 900);
    return () => clearTimeout(id);
  }, [swooshes, bursts]);

  const idle = useMemo<Strip[]>(
    () => Array.from({ length: n }, (_, i) => ({ cells: [prevRef.current[i] ?? filler(i * 101 + 7, false, rebirths, false)], stops: [] })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n, rebirths],
  );
  const strips = run?.strips ?? idle;

  const style = {
    ['--cell' as string]: `${L.cell}px`,
    ['--art' as string]: `${L.art}px`,
    ['--winW' as string]: `${L.winW}px`,
    ['--winH' as string]: `${L.winH}px`,
  } as CSSProperties;

  return (
    <div
      className={s.stage}
      style={style}
      data-n={n}
      data-hide={hideUi || undefined}
      onClick={() => hideUi && useUi.setState({ watchHideUi: false })}
    >
      <div className={s.top}>
        <span className={s.luck}>
          <PixelArt art={uiIcon('clover', 'sm')} />
          {t('watch.luck', { luck: fmtLuck(luck) })}
        </span>
        {!hideUi && (
          <button
            className={s.hide}
            onClick={(e) => {
              e.stopPropagation();
              useUi.setState({ watchHideUi: true });
            }}
          >
            {t('watch.hide')}
          </button>
        )}
      </div>

      <div className={s.theater}>
        {strips.map((st, i) => {
          const done = landed[i] ?? true;
          const res = run ? st.cells[st.stops[st.stops.length - 1]?.idx ?? 0] : st.cells[0];
          const x = chain[i] ?? 1;
          return (
            <div key={`${run?.key ?? 'idle'}:${i}`} className={s.lane} data-rarity={done && res ? res.rarity : undefined}>
              <div className={s.chain} data-on={x > 1 || undefined}>
                {x > 1 && <b key={x}>{t('watch.chain', { x })}</b>}
              </div>
              <div className={s.window}>
                <div
                  className={s.strip}
                  ref={(el) => {
                    stripRefs.current[i] = el;
                    if (el && !el.style.transform) el.style.transform = `translate3d(0, ${Math.round(L.winH / 2)}px, 0)`;
                  }}
                >
                  {st.cells.map((c, j) => {
                    const isResult = run ? j === st.stops[st.stops.length - 1]?.idx : j === 0;
                    return (
                      <div
                        key={j}
                        className={s.cell}
                        data-rarity={c.rarity}
                        data-token={c.token !== null || undefined}
                        data-revealed={(c.real && (!isResult || done)) || (!run && c.real) || undefined}
                        style={{ top: -j * L.cell - L.cell / 2 }}
                      >
                        {c.token === null && (
                          <span className={s.odds}>
                            <i>{t('reel.oneIn')}</i>
                            {formatNumber(c.odds)}
                          </span>
                        )}
                        <PixelArt art={cellArt(c, L.hd)} className={s.art} />
                      </div>
                    );
                  })}
                </div>
                <div className={s.payline} />
              </div>
              {bursts.filter((b) => b.reel === i).map((b) => (
                <div key={b.id} className={s.burst}>
                  {Array.from({ length: 8 }, (_, k) => (
                    <i key={k} style={{ ['--k' as string]: k } as CSSProperties} />
                  ))}
                </div>
              ))}
            </div>
          );
        })}
        {swooshes.map((w) => (
          <div key={w.id} className={s.swooshes} data-big={w.big || undefined}>
            <i data-side="l" />
            <i data-side="l" data-row="2" />
            <i data-side="r" />
            <i data-side="r" data-row="2" />
          </div>
        ))}
      </div>

      <div className={s.plate} data-rarity={shown?.cell.rarity}>
        {shown ? (
          <div key={shown.id} className={s.plateIn}>
            <span className={s.tier}>{t(`rarity.${shown.cell.rarity}`)}</span>
            <span className={s.name}>{shown.name}</span>
            <span className={s.oneIn}>
              {t('reel.oneIn')} <b>{fmtOdds(shown.cell.odds)}</b>
            </span>
            {shown.mult > 1 && <span className={s.rolledAt}>{t('watch.rolledAt', { x: formatNumber(shown.mult) })}</span>}
          </div>
        ) : (
          <span className={s.rolling}>{t('watch.rolling')}</span>
        )}
      </div>
      {best.current && !hideUi && <div className={s.best}>{t('watch.best', { name: best.current.name, odds: fmtOdds(best.current.odds) })}</div>}
      {hideUi && <div className={s.tapHint}>{t('watch.show')}</div>}
    </div>
  );
}

/** The multiplier a strip has stacked up after reaching `reached` stops. */
function chainSoFar(st: Strip, reached: number): number {
  let x = 1;
  for (let k = 0; k < Math.min(reached, st.stops.length); k++) {
    const tk = st.stops[k].token;
    if (tk !== null) x *= tk;
  }
  return x;
}
