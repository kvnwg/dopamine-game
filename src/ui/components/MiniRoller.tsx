/**
 * The mini roller (Kevin: "when ur not on the rolling page, there should still be a mini roller on the
 * top left of ur screen under the settings, that plays the sound and still shows u rolls"). Off the
 * Roll tab, a small bank of the dumpster's reels sits under the settings gear: each reel a window of
 * one item at its own size, flicking through black silhouettes while it spins (slowing as it nears its
 * stop), holding on a luck token's clover, and landing on its find in color with a rim in its rarity's
 * light. It is silent (Kevin: "when ur off the roll tab, no more rolling sounds appear, except for luck
 * multipliers"): only a luck token's chime and slam sound, from tokenFx.ts. It runs on core's roll timer, like the Roll tab's reels, so it shows the same spin
 * at the same moment. Tap it to go to the Roll tab. Leaving the Roll tab, the big machine shrinks into
 * it (Reel.tsx).
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { gameStore, useGame } from '../../app/store';
import { rarityIndex, reelCount } from '../../core';
import { itemArt, luckTokenArt, UI_PX } from '../../render/icons';
import { t } from '../i18n';
import { tierLight } from '../reelDrama';
import { filler } from '../reelStrip';
import { reelStops, tokenHoldMs, type ReelStop } from '../reelTiming';
import { useUi } from '../uiStore';
import s from './miniRoller.module.css';

/**
 * Where it sits and how big it is (stage px): under the settings gear, one 16 x 16 window per reel, two
 * to a row (an odd last one centred), so it keeps to the corner and clear of the luck chains shown
 * across the top of the battle (up to four tokens long).
 */
export const MINI = { left: 3 * UI_PX, top: 20 * UI_PX, win: 16 * UI_PX, gap: 2 * UI_PX, pad: 2 * UI_PX };
const miniCols = (n: number) => Math.min(n, 2);
const span = (k: number) => 2 * MINI.pad + k * MINI.win + (k - 1) * MINI.gap;
export const miniWidth = (n: number) => span(miniCols(n));
export const miniHeight = (n: number) => span(Math.ceil(n / miniCols(n)));

/** What the windows last showed, kept while the mini roller is away (so it comes back as it was). */
const shown: Array<{ url: string; rim: string | null }> = [];

/** The mini roller, whenever the Roll tab's reels aren't on screen (and the dumpster is open). */
export function MiniRoller() {
  const tab = useUi((u) => u.tab);
  const prevTab = useUi((u) => u.prevTab);
  const lower = tab === 'upgrades' ? prevTab : tab;
  const open = useGame((g) => g.features.unlocked.includes('roll'));
  // (Not under the full-screen Upgrades screen either: nobody sees it there.)
  if (!open || lower === 'alley' || tab === 'upgrades') return null;
  return <MiniBank hidden={false} />;
}

interface Plan {
  stops: ReelStop[];
  /** The landed find's picture and rim. */
  url: string;
  rim: string;
  /** Stops passed; when a token's hold ends; the next silhouette flick (ms, page clock); flicks so far. */
  reached: number;
  holdUntil: number;
  nextFlick: number;
  flick: number;
  fillers: string[];
}

function MiniBank({ hidden }: { hidden: boolean }) {
  const idle = useGame(reelCount);
  const spinN = useGame((g) => g.roll.current?.reels.length ?? 0);
  const rebirths = useGame((g) => g.rebirths);
  const calm = useGame((g) => g.settings.reduceMotion);
  const n = Math.max(1, spinN || idle);
  const wins = useRef<(HTMLDivElement | null)[]>([]);
  const imgs = useRef<(HTMLImageElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    let key = '';
    let t0 = 0;
    let plan: Plan[] = [];
    const setWin = (i: number, url: string, state: 'spin' | 'token' | 'landed', rim: string | null) => {
      const img = imgs.current[i];
      const win = wins.current[i];
      if (!img || !win) return;
      if (img.getAttribute('src') !== url) img.setAttribute('src', url);
      win.dataset.state = state;
      if (rim) win.style.setProperty('--rim', rim);
      else win.style.removeProperty('--rim');
      shown[i] = { url, rim };
    };
    const bump = (i: number, px: number, ms: number) => {
      if (calm) return;
      wins.current[i]?.animate([{ transform: `translateY(${px}px)` }, { transform: 'translateY(0)' }], { duration: ms, easing: 'steps(2, jump-none)' });
    };
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const g = gameStore.getState().game;
      const spin = g.roll.current;
      const k = spin ? spin.reels.map((r) => r.item.uid).join(',') : '';
      const now = performance.now();
      if (k !== key) {
        key = k;
        plan = [];
        if (!spin) return;
        const timer = g.roll.timer * 1000;
        t0 = now - timer;
        plan = spin.reels.map((r, i) => {
          const stops = reelStops(spin, i);
          return {
            stops,
            url: itemArt(r.item.baseId, 1).url,
            rim: tierLight(rarityIndex(r.item.rarity)),
            reached: stops.filter((st) => st.at <= timer).length,
            holdUntil: 0,
            nextFlick: 0,
            flick: 0,
            fillers: Array.from({ length: 12 }, (_, f) => itemArt(filler(r.item.uid * 31 + i * 101 + f, false, rebirths, false).baseId, 1).url),
          };
        });
        // Joined mid-spin: whatever has already landed shows as landed.
        plan.forEach((p, i) => {
          if (p.reached >= p.stops.length) setWin(i, p.url, 'landed', p.rim);
          else if (p.reached > 0 && p.stops[p.reached - 1].token !== null) {
            p.holdUntil = p.stops[p.reached - 1].at + tokenHoldMs();
            setWin(i, luckTokenArt(p.stops[p.reached - 1].token!, 1).url, 'token', '#7ef08f');
          }
        });
      }
      if (!spin) return;
      const el = now - t0;
      plan.forEach((p, i) => {
        while (p.reached < p.stops.length && el >= p.stops[p.reached].at) {
          const stop = p.stops[p.reached];
          p.reached += 1;
          if (stop.token !== null) {
            // A luck token: its clover holds a moment (tokenFx.ts plays its chime and its slam).
            p.holdUntil = stop.at + tokenHoldMs();
            setWin(i, luckTokenArt(stop.token, 1).url, 'token', '#7ef08f');
            bump(i, -UI_PX, 140);
          } else {
            setWin(i, p.url, 'landed', p.rim);
            bump(i, UI_PX, 140);
          }
        }
        if (p.reached >= p.stops.length) return;
        if (p.holdUntil) {
          if (el < p.holdUntil) return;
          p.holdUntil = 0;
          p.nextFlick = 0;
        }
        // Spinning: silhouettes flick past, slower as the stop comes (one still one, with reduced motion).
        if (now < p.nextFlick) return;
        if (calm) {
          p.nextFlick = Infinity;
          setWin(i, p.fillers[0], 'spin', null);
          return;
        }
        const left = p.stops[p.reached].at - el;
        const close = 1 - Math.max(0, Math.min(1, left / 700));
        p.nextFlick = now + 55 + 115 * close;
        p.flick += 1;
        setWin(i, p.fillers[p.flick % p.fillers.length], 'spin', null);
      });
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [n, rebirths, calm]);

  return (
    <button
      type="button"
      className={s.mini}
      style={{ width: miniWidth(n), height: miniHeight(n) }}
      data-mini-roller
      data-hidden={hidden || undefined}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      aria-label={t('mini.aria')}
      onClick={() => useUi.getState().setTab('alley')}
    >
      {Array.from({ length: n }, (_, i) => {
        const was = shown[i];
        return (
          <div
            key={i}
            ref={(el) => {
              wins.current[i] = el;
            }}
            className={s.win}
            data-mini-reel={i}
            data-state={was ? 'landed' : 'spin'}
            style={was?.rim ? ({ ['--rim' as string]: was.rim } as CSSProperties) : undefined}
          >
            <img
              ref={(el) => {
                imgs.current[i] = el;
              }}
              src={was?.url}
              alt=""
              draggable={false}
              style={{ width: MINI.win, height: MINI.win }}
            />
          </div>
        );
      })}
    </button>
  );
}
