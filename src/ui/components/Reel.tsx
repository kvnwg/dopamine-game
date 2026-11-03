/**
 * The reels: a slot machine across the Roll tab. Core decides every reel's result when a spin starts
 * (state.roll.current); each reel kicks back, launches downward, cruises and brakes onto its result
 * under the payline, one after another, with the rarest result stopping last. Everything rolling past
 * is blacked out but shows its "1 in X" odds (and trails afterimages while it flies by), and the
 * result is revealed in color as its reel stops.
 *
 * The items rolling past are a tease, not a sample: they lean much rarer than the real odds, with
 * a near miss next to most results (BAL.feel.reels). Only the landed results come from the real
 * odds, which the Luck popup lists. Every spin is free; a paid spin must never get this tease.
 *
 * Drama (reelDrama.ts): a rare result's reel slows into a crawl while the machine glows, the glow
 * starting at a lower tier's color and flickering up tier by tier to the real one as the reel stops,
 * the bank shaking and the crawl's notches climbing in pitch. Every stop thuds (the bank drops an art
 * pixel, the payline and the bulbs flash); Shiny and up throw sparks and swooshes, Epic and up get
 * light rays behind the result, Legendary and up stamp their tier over the reel, Mythic and up rain
 * confetti. Marquee bulbs round the bank chase while it spins, blink in the glow while it builds, and
 * blink in the result's color after a rare one. Reduce motion drops the movement (no kicks, shakes,
 * sparks or confetti); Reduce flashing drops the white flashes and the glow's flicker.
 *
 * Sizes (stage px): the bank spans the card (BANK_W) with a frame of bulbs (FRAME) round a window WIN
 * tall. Up to three reels roll Scale2x art (32 x 32 at 6 px, 192); four and five roll the art as drawn
 * (96). One or two reels are wide drums with each item's "1 in X" beside it (and a landed result's
 * tier); three and more show it above the item. Everything sits on the 6 px grid: the strip snaps to
 * whole art pixels, shakes and drops are whole-pixel steps, glows are hard-edged rings.
 *
 * Structure: .rig (shakes) > .bank (drops; bulbs in its frame) > .reels > .reel (one per reel:
 * .under with the glow's light and the rays, .strip with a .cell per item rolling past, .curve for the
 * drum's frame and shading), plus .payline across every reel and .fx (sparks, swooshes, stamps,
 * confetti). A cell's look comes from data-rarity / data-revealed / data-token.
 *
 * Luck tokens: a reel can stop on a clover token first (core rolls them; see reelStrip.ts for the
 * strips and reelTiming.ts for when each reel stops). It chimes and bursts into clovers, its ×N chip
 * stacks up on the reel, and the reel spins on to its next stop. Fillers only show unlocked items.
 */
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { RARITIES, type Rarity } from '../../data';
import { currentLuck, formatNumber, rarityIndex, reelCount, type GameState } from '../../core';
import { gameStore, useGame } from '../../app/store';
import { itemArt, luckTokenArt, sparkleArt, uiBitArt, UI_PX, type Art, type ArtScale } from '../../render/icons';
import { haptics } from '../../services';
import { audio } from '../../services/audio';
import { t } from '../i18n';
import { RAINBOW, raysUrl } from '../rays';
import { flickerMs, glowAt, landFx, teasePlan, tierLight, type Tease } from '../reelDrama';
import { buildStrip, filler, stripAt, type Strip, type StripCell } from '../reelStrip';
import { tokenHoldMs } from '../reelTiming';
import { Chunky, type Grad } from './Chunky';
import { PixelArt } from './PixelArt';
import s from './reel.module.css';

/** The bank's size (stage px): the card's full width, a frame of bulbs round the reel window. */
export const BANK_W = 168 * UI_PX;
export const FRAME = 4 * UI_PX;
export const WIN = 48 * UI_PX;
export const BANK_H = WIN + 2 * FRAME;
const INNER = BANK_W - 2 * FRAME;

export interface ReelLayout {
  n: number;
  /** The art's resolution: Scale2x (192 px) for up to three reels, as drawn (96 px) for four and five. */
  scale: ArtScale;
  /** One or two wide reels: the odds sit beside the art instead of above it. */
  side: boolean;
  /** A cell's height (an item rolling past). */
  cell: number;
  reelW: number;
  gap: number;
  /** The art's left edge inside its cell (cells are inset one art pixel from the reel's ink border). */
  artX: number;
  /** The art's center inside its reel. */
  artCx: number;
  /** Where the reels start inside the window (they are centered). */
  left: number;
}

/** Sizes for `count` reels. Every size is whole art pixels and the art lands on the 6 px grid. */
export function reelLayout(count: number): ReelLayout {
  const n = Math.min(5, Math.max(1, count));
  const scale: ArtScale = n <= 3 ? 2 : 1;
  const art = 16 * scale * UI_PX;
  const reelW = [960, 468, 312, 228, 180][n - 1];
  const gap = [0, 24, 12, 12, 12][n - 1];
  const cellW = reelW - 2 * UI_PX;
  const artX = n === 2 ? 6 * UI_PX : Math.floor((cellW - art) / (2 * UI_PX)) * UI_PX;
  const total = n * reelW + (n - 1) * gap;
  return {
    n, scale, side: n <= 2, cell: (n <= 2 ? 36 : n === 3 ? 38 : 22) * UI_PX, reelW, gap, artX, artCx: UI_PX + artX + art / 2, left: (INNER - total) / 2,
  };
}

/** A cell's picture: its item, or a luck token's clover (the plain clover for a value without its own art). */
function cellArt(c: StripCell, scale: ArtScale): Art {
  return c.token === null ? itemArt(c.baseId, scale) : luckTokenArt(c.token, scale);
}

/** Whole art pixels (stage px). */
const snap = (v: number) => Math.round(v / UI_PX) * UI_PX;

interface Run {
  key: string;
  strips: Strip[];
  layout: ReelLayout;
  t0: number;
  /** Stops each reel has reached (its tokens, then its item); and how many it had when the run was built. */
  reached: number[];
  before: number[];
  plan: Tease | null;
  /** The reel that stops last. */
  lastReel: number;
  /** Per reel: the last tick notch, strip offset written, position (cells) and speed class. */
  notch: number[];
  y: number[];
  p: number[];
  speed: string[];
  /** Notches of the build-up's crawl so far (each one climbs). */
  creep: number;
  /** The glow step whose sound has played; what the glow, shake and bulbs last showed. */
  glowStep: number;
  glowKey: string;
  shake: number;
  bulbs: string;
  /** The rarest tier landed so far; the bulbs flash white until `flashUntil`. */
  best: number;
  flashUntil: number;
  flicker: number;
  last: number;
}

/** Each reel's strip for a spin (reelStrip.ts): from the last results, through any tokens, to the result. */
function buildRun(spin: NonNullable<GameState['roll']['current']>, prev: (StripCell | undefined)[], timerSec: number, rebirths: number, luck: number): Run {
  const plan = teasePlan(spin, luck);
  const strips = spin.reels.map((_, i) => buildStrip(spin, i, prev[i], rebirths, undefined, plan && plan.reel === i ? plan.slow : 0));
  const elapsed = timerSec * 1000;
  const reached = strips.map((st) => stripAt(st, elapsed).reached);
  const stopOf = (st: Strip) => (st.stops.length ? st.stops[st.stops.length - 1].at : 0);
  let lastReel = 0;
  strips.forEach((st, i) => {
    if (stopOf(st) >= stopOf(strips[lastReel])) lastReel = i;
  });
  let best = -1;
  strips.forEach((st, i) => {
    if (reached[i] >= st.stops.length) best = Math.max(best, rarityIndex(st.cells[resultIdx(st)].rarity));
  });
  const n = strips.length;
  return {
    key: spin.reels.map((r) => r.item.uid).join(','),
    strips,
    layout: reelLayout(n),
    t0: performance.now() - elapsed,
    reached,
    before: reached.slice(),
    plan,
    lastReel,
    notch: strips.map(() => 0),
    y: strips.map(() => NaN),
    p: strips.map(() => 0),
    speed: strips.map(() => ''),
    creep: 0,
    glowStep: -1,
    // Unlike anything a frame writes, so the first frame clears what the last spin left on the DOM.
    glowKey: 'new',
    shake: -1,
    bulbs: 'new',
    best,
    flashUntil: 0,
    flicker: plan ? flickerMs(plan) : 0,
    last: performance.now(),
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

/** The stamp's lettering for each tier (as the full-screen reveal's title). */
const GRAD: Partial<Record<Rarity, Grad>> = {
  legendary: 'gold', mythic: 'rainbow', vintage: 'gold', limited: 'red', prototype: 'blue', mint: 'white', gemMint: 'green', museum: 'purple', grail: 'rainbow',
};

interface Fx {
  id: number;
  kind: 'land' | 'token';
  reel: number;
  tier: number;
}
let fxId = 1;

/**
 * The cells of one reel's strip. Memoized: the bank re-renders on landings (its effects) and these
 * stay put; a landed stop's cell is revealed straight on the DOM (data-revealed).
 */
const Cells = memo(function Cells({
  strip, runKey, reel, layout, reached, before, idle, cellRefs,
}: {
  strip: Strip;
  runKey: string;
  reel: number;
  layout: ReelLayout;
  reached: number;
  /** Stops reached before this run was built (shown without the landing flash). */
  before: number;
  idle: boolean;
  cellRefs: Map<string, HTMLDivElement>;
}) {
  const res = resultIdx(strip);
  return (
    <>
      {strip.cells.map((c, j) => {
        const stopAt = strip.stops.findIndex((p) => p.idx === j);
        // Real cells show in color: the last result at the bottom always, stops once reached.
        const revealed = c.real && (stopAt < 0 || reached > stopAt || (idle && j === res));
        const settled = revealed && (stopAt < 0 || before > stopAt || idle);
        return (
          <div
            key={j}
            className={s.cell}
            data-rarity={c.rarity}
            data-token={c.token !== null || undefined}
            data-revealed={revealed ? '' : undefined}
            data-settled={settled ? '' : undefined}
            ref={
              stopAt >= 0
                ? (el) => {
                    const key = `${runKey}:${reel}:${j}`;
                    if (el) cellRefs.set(key, el);
                    else cellRefs.delete(key);
                  }
                : undefined
            }
            style={{ top: -j * layout.cell - layout.cell / 2 }}
          >
            {/* The odds belong to their own item (above it, or beside it on a wide reel), never the next one's. */}
            <span className={s.odds}>
              {c.token !== null ? (
                layout.side ? (
                  <>
                    <i>{t('roll.luckLabel')}</i>
                    <b>×{c.token}</b>
                  </>
                ) : (
                  t('reel.token', { x: c.token })
                )
              ) : (
                <>
                  <i>{t('reel.oneIn')}</i>
                  <b>{formatNumber(c.odds)}</b>
                </>
              )}
            </span>
            <PixelArt art={cellArt(c, layout.scale)} className={s.art} />
            {layout.side && c.real && c.token === null && <span className={s.tier}>{t(`rarity.${c.rarity}`)}</span>}
          </div>
        );
      })}
    </>
  );
});

/** Pixel sparks flying out from a landed result (whole art pixels per step). */
function Sparks({ n, color, big }: { n: number; color: string; big: boolean }) {
  const bits = useMemo(
    () =>
      Array.from({ length: n }, (_, k) => {
        const a = (k / n) * Math.PI * 2 + 0.3;
        const d = (big ? 168 : 108) * (0.7 + 0.3 * ((k * 7) % 4) / 3);
        // Six steps of whole art pixels.
        const step = 6 * UI_PX;
        return { dx: Math.round((Math.cos(a) * d) / step) * step, dy: Math.round((Math.sin(a) * d * 0.8) / step) * step, delay: (k % 3) * 40 };
      }),
    [n, big],
  );
  return (
    <div className={s.sparks} style={{ ['--c' as string]: color } as CSSProperties}>
      {bits.map((b, k) => (
        <i key={k} style={{ ['--dx' as string]: `${b.dx}px`, ['--dy' as string]: `${b.dy}px`, animationDelay: `${b.delay}ms` } as CSSProperties} />
      ))}
    </div>
  );
}

const CONFETTI = ['#ff5252', '#ffc233', '#5bc236', '#42a5f5', '#c48bff', '#ffffff'];

/** Confetti over the machine: pieces of 2 x 1 art pixels falling in whole-pixel steps. */
function Confetti({ n }: { n: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => ({
        x: snap(((i * 137.5) % 100) * (BANK_W / 100)),
        delay: (i * 53) % 600,
        dur: 1300 + ((i * 97) % 700),
        color: CONFETTI[i % CONFETTI.length],
        tall: i % 2 === 0,
      })),
    [n],
  );
  return (
    <div className={s.confetti}>
      {bits.map((b, i) => (
        <span
          key={i}
          data-tall={b.tall || undefined}
          style={{ left: b.x, background: b.color, animationDelay: `${b.delay}ms, ${b.delay}ms`, animationDuration: `${b.dur}ms, 240ms` }}
        />
      ))}
    </div>
  );
}

/** One landing's effects, centered on the result's art (`x`, `y` in the bank). */
function Landing({ f, x, y, layout, calm }: { f: Fx; x: number; y: number; layout: ReelLayout; calm: boolean }) {
  const look = landFx(f.tier);
  const rarity = RARITIES[f.tier];
  const color = tierLight(f.tier);
  const big = layout.scale === 2;
  const art = 16 * layout.scale * UI_PX;
  const stampX = Math.max(210, Math.min(BANK_W - 210, x));
  const sparkle = sparkleArt();
  return (
    <>
      {!calm && look.sparks > 0 && (
        <div className={s.at} style={{ left: x, top: y }}>
          <Sparks n={look.sparks} color={color} big={big} />
        </div>
      )}
      {!calm && f.tier >= 2 && (
        <div className={s.swoosh} data-big={f.tier >= 4 || undefined} style={{ left: x - layout.reelW / 2, width: layout.reelW, top: y }}>
          <i data-side="l" />
          <i data-side="l" data-row="2" />
          <i data-side="r" />
          <i data-side="r" data-row="2" />
        </div>
      )}
      {!calm && f.tier >= 4 &&
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([sx, sy], k) => (
          <PixelArt
            key={k}
            art={sparkle}
            className={s.twinkle}
            style={{ left: x + sx * (art / 2 + 2 * UI_PX) - 3 * UI_PX, top: y + sy * (art / 2 - 2 * UI_PX) - 3 * UI_PX, animationDelay: `${k * 170}ms` }}
          />
        ))}
      {look.stamp && (
        <div className={s.stamp} data-calm={calm || undefined} style={{ left: stampX - 300, top: FRAME + UI_PX }}>
          <Chunky
            text={rarity === 'mint' ? t('reveal.mintStamp') : `${t(`rarity.${rarity}`).toUpperCase()}!`}
            size={layout.n <= 2 ? 54 : layout.n === 3 ? 44 : 36}
            grad={GRAD[rarity] ?? 'gold'}
          />
        </div>
      )}
      {!calm && look.confetti && <Confetti n={30} />}
    </>
  );
}

/** A luck token bursts into little pixel clovers. */
function CloverBurst({ x, y }: { x: number; y: number }) {
  return (
    <div className={`${s.at} ${s.burst}`} style={{ left: x, top: y }}>
      {Array.from({ length: 8 }, (_, k) => (
        <i key={k} />
      ))}
    </div>
  );
}

/**
 * The reels, sized for the reels showing (this spin's, else as many as the raccoon has). The golden /
 * lucky / turbo badges ride on the bank's top edge.
 */
export function ReelBank() {
  const spin = useGame((g) => g.roll.current);
  const idleCount = useGame(reelCount);
  const rebirths = useGame((g) => g.rebirths);
  const calm = useGame((g) => g.settings.reduceMotion);
  const noFlash = useGame((g) => g.settings.reduceFlashing);
  const [run, setRun] = useState<Run | null>(null);
  const [chain, setChain] = useState<number[]>([]);
  const [fx, setFx] = useState<Fx[]>([]);
  /** Reels showing light rays behind an Epic-or-better result (reel → tier). */
  const [rays, setRays] = useState<Record<number, number>>({});
  const runRef = useRef<Run | null>(null);
  const prevRef = useRef<(StripCell | undefined)[]>([]);
  const rigRef = useRef<HTMLDivElement>(null);
  const bankRef = useRef<HTMLDivElement>(null);
  const payFlashRef = useRef<HTMLDivElement>(null);
  const stripRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addFx = (f: Omit<Fx, 'id'>, ms: number) => {
    const id = fxId++;
    setFx((cur) => [...cur.slice(-7), { ...f, id }]);
    timers.current.push(setTimeout(() => setFx((cur) => cur.filter((x) => x.id !== id)), ms));
  };

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  // A new spin: build fresh strips that start from the last results, and wind the machine up.
  const spinKey = spin ? spin.reels.map((r) => r.item.uid).join(',') : '';
  useEffect(() => {
    if (!spin || runRef.current?.key === spinKey) return;
    const game = gameStore.getState().game;
    const timer = game.roll.timer;
    const next = buildRun(spin, prevRef.current, timer, rebirths, currentLuck(game, Date.now()));
    prevRef.current = next.strips.map((st) => st.cells[resultIdx(st)]);
    runRef.current = next;
    setRun(next);
    setChain(next.strips.map((st, i) => chainOf(st, next.reached[i])));
    setFx([]);
    setRays({});
    if (timer < 0.15) {
      audio.reelStart();
      if (!calm) {
        bankRef.current?.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-UI_PX}px)` }, { transform: 'translateY(0)' }], {
          duration: 150,
          easing: 'steps(3, jump-none)',
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  // Idle (nothing spinning yet): the last results, or blacked-out fillers.
  const idle = useMemo<Run>(() => {
    const n = Math.max(1, prevRef.current.length || idleCount);
    const strips: Strip[] = Array.from({ length: n }, (_, i) => ({
      cells: [prevRef.current[i] ?? filler(i * 101 + 7, false, rebirths, false), filler(i * 101 + 8, false, rebirths, false), filler(i * 101 + 9, false, rebirths, false)],
      stops: [],
    }));
    const r = buildRunShell(strips);
    return r;
  }, [idleCount, rebirths]);

  const shown = run ?? idle;
  const L = shown.layout;

  // The animation runs straight on the DOM; React only renders when a spin starts, a token lands or a
  // result lands (its effects).
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const r = runRef.current;
      const bank = bankRef.current;
      if (!r || !bank) return;
      const now = performance.now();
      const el = now - r.t0;
      const dt = Math.max(4, now - r.last);
      r.last = now;
      const lay = r.layout;
      const plan = r.plan;
      r.strips.forEach((st, i) => {
        const at = stripAt(st, el, calm);
        // Whole art pixels only, so the art never lands between pixels.
        const y = snap(WIN / 2 + at.p * lay.cell);
        const node = stripRefs.current[i];
        if (node && y !== r.y[i]) {
          node.style.transform = `translate3d(0, ${y}px, 0)`;
          r.y[i] = y;
        }
        const moving = at.reached < st.stops.length;
        const v = (Math.abs(at.p - r.p[i]) * 1000) / dt;
        r.p[i] = at.p;
        // Afterimages while it flies (reel.module.css).
        const sp = calm || !moving ? '' : v > 12 ? 'fast' : v > 5 ? 'mid' : '';
        if (sp !== r.speed[i]) {
          r.speed[i] = sp;
          const rn = reelRefs.current[i];
          if (rn) {
            if (sp) rn.dataset.speed = sp;
            else delete rn.dataset.speed;
          }
        }
        // Ticks climb as the reel slows; a build-up's crawl clicks in finer notches, each a step higher.
        const crawl = !!plan && plan.reel === i && el >= plan.from && at.reached === st.stops.length - 1;
        const notch = Math.floor(at.p * (crawl ? 3 : 1) + 0.5);
        if (notch !== r.notch[i]) {
          r.notch[i] = notch;
          if (moving && !calm) {
            if (crawl) audio.reelCreep(r.creep++);
            else audio.reelTick(Math.max(0, 1 - v / 16), i === r.lastReel ? 1 : 0);
          }
        }
        while (r.reached[i] < at.reached) {
          const k = r.reached[i];
          const stop = st.stops[k];
          r.reached[i] += 1;
          cellRefs.current.get(`${r.key}:${i}:${stop.idx}`)?.setAttribute('data-revealed', '');
          if (stop.token !== null) {
            // A luck token: chime, burst, and the reel spins on with its luck multiplied.
            audio.token(k, stop.token);
            setTimeout(() => audio.respin(), tokenHoldMs());
            haptics.impact('medium');
            const x = chainOf(st, r.reached[i]);
            setChain((c) => c.map((cur, j) => (j === i ? x : cur)));
            addFx({ kind: 'token', reel: i, tier: 0 }, 900);
          } else {
            const tier = rarityIndex(st.cells[stop.idx].rarity);
            const last = r.reached.every((m, j) => m >= r.strips[j].stops.length);
            audio.reelLand(tier, last);
            haptics.impact('light');
            if (!calm) {
              bank.animate(
                tier >= 3
                  ? [{ transform: `translateY(${2 * UI_PX}px)` }, { transform: `translateY(${UI_PX}px)` }, { transform: 'translateY(0)' }]
                  : [{ transform: `translateY(${UI_PX}px)` }, { transform: 'translateY(0)' }],
                { duration: tier >= 3 ? 210 : 140, easing: tier >= 3 ? 'steps(3, jump-none)' : 'steps(2, jump-none)' },
              );
            }
            if (!noFlash) {
              payFlashRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: tier >= 2 ? 360 : 240, easing: 'steps(3, jump-none)' });
              r.flashUntil = now + (tier >= 2 ? 240 : 140);
            }
            if (tier > r.best) {
              r.best = tier;
              bank.style.setProperty('--prize', tierLight(tier));
            }
            addFx({ kind: 'land', reel: i, tier }, landFx(tier).confetti ? 2400 : landFx(tier).stamp ? 1900 : 900);
            if (landFx(tier).rays && !calm) setRays((m) => ({ ...m, [i]: tier }));
          }
        }
      });

      // The build-up's glow: it climbs tier by tier (flickering between the old and the new color on
      // each step) and lands on the real tier as the reel stops; the machine shakes harder near the end.
      let color: string | null = null;
      let strength = 0;
      let shake = 0;
      if (plan) {
        const g = glowAt(plan, el);
        if (g.tier !== null) {
          if (g.step > r.glowStep) {
            r.glowStep = g.step;
            // The last step is the pop, which has its own sounds.
            if (g.step < plan.tiers.length - 1 && el - plan.times[g.step] < 200) audio.glowUp(g.tier);
          }
          let tierShown = g.tier;
          const since = el - plan.times[g.step];
          if (g.step > 0 && !noFlash && since < r.flicker) tierShown = Math.floor(since / 45) % 2 === 0 ? g.tier : plan.tiers[g.step - 1];
          color = tierLight(tierShown);
          if (el < plan.land) {
            strength = g.strength;
            if (!calm && plan.level >= 1) {
              const k = (el - plan.from) / Math.max(1, plan.land - plan.from);
              shake = plan.level >= 2 && k > 0.7 ? 2 : k > 0.4 ? 1 : 0;
            }
          } else {
            // After the pop a rare result keeps glowing until the next spin; a small glow fades out.
            strength = plan.level >= 1 ? 2 : el - plan.land < 450 ? 1 : 0;
          }
        }
      }
      const glowKey = color && strength > 0 ? `${color}|${strength}` : '';
      if (glowKey !== r.glowKey) {
        r.glowKey = glowKey;
        if (color && strength > 0) {
          bank.style.setProperty('--glow', color);
          bank.dataset.glow = String(strength);
        } else delete bank.dataset.glow;
      }
      if (shake !== r.shake) {
        r.shake = shake;
        const rig = rigRef.current;
        if (rig) {
          if (shake) rig.dataset.shake = String(shake);
          else delete rig.dataset.shake;
        }
      }
      const allLanded = r.reached.every((m, j) => m >= r.strips[j].stops.length);
      const building = !!plan && strength > 0 && el < plan.land;
      const bulbs = now < r.flashUntil ? 'flash' : !allLanded ? (building ? 'glow' : 'spin') : r.best >= 3 ? 'win' : 'idle';
      if (bulbs !== r.bulbs) {
        r.bulbs = bulbs;
        bank.dataset.bulbs = bulbs;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calm, noFlash]);

  const n = shown.strips.length;
  const art = 16 * L.scale * UI_PX;
  const style = {
    ['--cell' as string]: `${L.cell}px`,
    ['--win' as string]: `${WIN}px`,
    ['--frame' as string]: `${FRAME}px`,
    ['--bank-w' as string]: `${BANK_W}px`,
    ['--bank-h' as string]: `${BANK_H}px`,
    ['--art' as string]: `${art}px`,
    ['--ax' as string]: `${L.artX}px`,
    ['--acx' as string]: `${L.artCx}px`,
    ['--lx' as string]: `${L.artX + art + (n === 1 ? 6 : 3) * UI_PX}px`,
    ['--tx' as string]: `${L.reelW - 2 * UI_PX - L.artX + 6 * UI_PX}px`,
    ['--label' as string]: `${n === 3 ? 30 : n === 4 ? 28 : 26}px`,
    ['--small' as string]: `${n === 1 ? 30 : 26}px`,
    ['--big' as string]: `${n === 1 ? 66 : 52}px`,
    ['--trail' as string]: `${3 * L.scale * UI_PX}px`,
  } as CSSProperties;
  const plan = run?.plan ?? null;
  const fxX = (reel: number) => FRAME + L.left + reel * (L.reelW + L.gap) + L.artCx;
  const fxY = FRAME + WIN / 2;
  return (
    <div className={s.rig} ref={rigRef}>
      <div
        ref={bankRef}
        className={s.bank}
        style={style}
        data-side={L.side || undefined}
        data-n={n}
        data-golden={spin?.golden || undefined}
        data-calm={calm || undefined}
        data-noflash={noFlash || undefined}
        data-bulbs="idle"
      >
        <div className={s.bulbs} aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className={s.reels} style={{ gap: L.gap }}>
          {shown.strips.map((st, i) => {
            const x = run ? chain[i] ?? 1 : 1;
            const rayTier = rays[i];
            return (
              <div
                key={`${shown.key}:${i}`}
                className={s.reel}
                style={{ width: L.reelW }}
                ref={(el) => {
                  reelRefs.current[i] = el;
                }}
                data-tease={plan?.reel === i || undefined}
                data-rays={rayTier !== undefined || undefined}
              >
                <div className={s.under}>
                  <div className={s.light} />
                  {rayTier !== undefined && (
                    <div
                      className={s.rays}
                      style={{ backgroundImage: `url(${rayTier >= rarityIndex('mythic') ? raysUrl(RAINBOW, 20, 0.5) : raysUrl([tierLight(rayTier)], 16, 0.55)})` }}
                    />
                  )}
                </div>
                <div
                  className={s.strip}
                  ref={(el) => {
                    stripRefs.current[i] = el;
                    if (el && !el.style.transform) el.style.transform = `translate3d(0, ${WIN / 2}px, 0)`;
                  }}
                >
                  <Cells strip={st} runKey={shown.key} reel={i} layout={L} reached={shown.reached[i]} before={shown.before[i]} idle={!run} cellRefs={cellRefs.current} />
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
          <div ref={payFlashRef} className={s.payFlash} />
          <PixelArt art={uiBitArt('paylineL')} className={s.arrowL} />
          <PixelArt art={uiBitArt('paylineL', true)} className={s.arrowR} />
        </div>
        <div className={s.fx}>
          {fx.map((f) =>
            f.kind === 'token' ? (
              <CloverBurst key={f.id} x={fxX(f.reel)} y={fxY} />
            ) : (
              <Landing key={f.id} f={f} x={fxX(f.reel)} y={fxY} layout={L} calm={calm} />
            ),
          )}
        </div>
        {spin && (spin.golden || spin.lucky || spin.turbo) && (
          <div className={s.badges}>
            {spin.golden && <span className={s.badge} data-kind="golden">{t('reel.golden')}</span>}
            {spin.lucky && <span className={s.badge} data-kind="lucky">{t('reel.lucky')}</span>}
            {spin.turbo && <span className={s.badge} data-kind="turbo">{t('reel.turbo')}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** A run with nothing moving (the idle bank before the first spin). */
function buildRunShell(strips: Strip[]): Run {
  return {
    key: 'idle',
    strips,
    layout: reelLayout(strips.length),
    t0: 0,
    reached: strips.map(() => 0),
    before: strips.map(() => 0),
    plan: null,
    lastReel: 0,
    notch: strips.map(() => 0),
    y: strips.map(() => NaN),
    p: strips.map(() => 0),
    speed: strips.map(() => ''),
    creep: 0,
    glowStep: -1,
    glowKey: '',
    shake: 0,
    bulbs: '',
    best: -1,
    flashUntil: 0,
    flicker: 0,
    last: 0,
  };
}
