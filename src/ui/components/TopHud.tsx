import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { formatNumber, xpToNext } from '../../core';
import { useGame } from '../../app/store';
import { useCountUp } from '../hooks';
import { useHudFlight } from '../hudFlight';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { CoinIcon, GearIcon, GemIcon } from './Icons';
import s from './hud.module.css';

/** Level-up sparkles around the badge and the XP bar: where (art px from the plate's top-left corner) and when (ms). */
const SPARKS = [
  { x: -3, y: -3, at: 0 },
  { x: 8, y: -4, at: 90 },
  { x: -4, y: 8, at: 170 },
  { x: 11, y: 9, at: 240 },
  { x: 24, y: -4, at: 130 },
  { x: 37, y: 9, at: 280 },
  { x: 49, y: -3, at: 350 },
] as const;

/** Counts the level going up (not the first render, nor a level going down on a reset): each one replays the fanfare. */
function useLevelUps(level: number): number {
  const last = useRef(level);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (level > last.current) setN((x) => x + 1);
    last.current = level;
  }, [level]);
  return n;
}

/**
 * Overlaid on the top of the battle scene: settings, level/XP, gold and gems. Gold and XP won in the
 * battle reach their counters with its coins and sparks (hudFlight.ts): the numbers tick up as they
 * land, and each landing hops the gold counter a pixel and flashes it (a big haul's coins too) or
 * flashes the XP bar. A level-up gets a fanfare: the badge hops and flashes, the bar fills and
 * flashes, sparkles blink around them. Whole art pixels and stepped timing only; Reduce Motion keeps
 * everything still, Reduce Flashing drops the flashes and sparkles.
 */
export function TopHud() {
  const level = useGame((g) => g.player.level);
  const xpNow = Math.max(0, useGame((g) => g.player.xp) - useHudFlight((f) => f.held.xp));
  const xp = useCountUp(xpNow, 400, level);
  const coins = useCountUp(Math.max(0, useGame((g) => g.currencies.coins) - useHudFlight((f) => f.held.gold)));
  const gems = useCountUp(useGame((g) => g.currencies.gems));
  const need = xpToNext(level);
  const goldHops = useHudFlight((f) => f.hits.gold) + useUi((u) => u.goldPulse);
  const xpHits = useHudFlight((f) => f.hits.xp);
  const calm = useGame((g) => g.settings.reduceMotion);
  const noFlash = useGame((g) => g.settings.reduceFlashing);
  const ups = useLevelUps(level);
  const vars = { ...(calm ? { '--hop': '0px', '--hop2': '0px' } : {}), ...(noFlash ? { '--flash': 'none', '--flash2': 'none' } : {}) } as CSSProperties;
  // Two classes take turns, so every landing restarts the hop.
  const turn = (n: number, a: string, b: string) => (n ? (n % 2 ? a : b) : '');
  return (
    <div className={s.hud} data-hud="" style={vars}>
      <button className={s.gearBtn} aria-label={t('hud.settings')} onClick={() => useUi.getState().openPopup('settings')}>
        <GearIcon size="md" />
      </button>
      <div className={s.levelPill}>
        <span key={`lv${ups}`} className={`${s.lvBadge} ${ups ? s.lvUp : ''}`}>{t('hud.level', { level })}</span>
        <div className={s.xpBar}>
          <div className={s.xpTrack} data-xp-target>
            {/* (A new level gets a new fill, so it doesn't shrink back from full.) */}
            <div key={`fill${level}`} className={`${s.xpFill} ${turn(xpHits, s.flashA, s.flashB)}`} style={{ width: `${Math.min(100, (xpNow / need) * 100)}%` }} />
            {ups > 0 && <span key={`full${ups}`} className={s.xpFull} />}
          </div>
          {/* Over the bar, not in it: the bar clips its fill, and must never clip the numbers. */}
          <span className={s.xpText}>{formatNumber(xp)}/{formatNumber(need)}</span>
        </div>
        {ups > 0 && !noFlash && (
          <span key={`sp${ups}`} className={s.sparks} aria-hidden>
            {SPARKS.map((p, i) => (
              <span key={i} className={s.spark} style={{ left: `calc(${p.x} * var(--px))`, top: `calc(${p.y} * var(--px))`, animationDelay: `${p.at}ms` }} />
            ))}
          </span>
        )}
      </div>
      <div className={s.spacer} />
      <div className={s.rightCol}>
        <div className={s.row}>
          <div className={`${s.money} ${turn(goldHops, s.hopA, s.hopB)}`} data-gold-target>
            <CoinIcon size="md" className={s.moneyIcon} />
            <span>{formatNumber(coins)}</span>
          </div>
          <div className={s.money}>
            <GemIcon size="md" className={s.moneyIcon} />
            <span>{formatNumber(gems)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
