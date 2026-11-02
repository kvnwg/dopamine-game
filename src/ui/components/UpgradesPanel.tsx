/** The upgrade grid: gold buys luck, gold gain, roll speed, bag space and more. Hold to buy fast. */
import { useEffect, useRef, type ReactNode } from 'react';
import { BAL } from '../../data';
import {
  formatNumber, inventoryCapacity, luckyEvery, rollInterval, upgradeCostAt, upgradeLevel, type GameState, type UpgradeDef,
} from '../../core';
import { dispatch, getGame, useGame } from '../../app/store';
import { haptics } from '../../services';
import { useCountUp } from '../hooks';
import { t } from '../i18n';
import {
  ArrowUpIcon, BagIcon, BoltIcon, CloverIcon, CoinIcon, DiceIcon, HeartIcon, StarIcon, SwordIcon,
} from './Icons';
import s from './panels.module.css';

const ICONS: Record<string, ReactNode> = {
  luck: <CloverIcon size={78} />,
  gold: <CoinIcon size={74} />,
  rollSpeed: <BoltIcon size={78} />,
  bagSpace: <BagIcon size={76} />,
  luckyRoll: <DiceIcon size={70} />,
  enchant: <StarIcon size={76} />,
  strength: <SwordIcon size={72} />,
  toughness: <HeartIcon size={72} />,
  bagFind: <ArrowUpIcon size={70} />,
};

const COLORS: Record<string, string> = {
  luck: '#46d36b', gold: '#ffc233', rollSpeed: '#ffd23f', bagSpace: '#7c82a8', luckyRoll: '#ffffff',
  enchant: '#c48bff', strength: '#ff8a6b', toughness: '#ff6b81', bagFind: '#5bc236',
};

/** Shows the effect at a level by applying it to a copy of the state. */
function effectAt(g: GameState, def: UpgradeDef, level: number): string {
  const st = { ...g, upgrades: { ...g.upgrades, [def.id]: level } } as GameState;
  const v = def.perLevel * level;
  switch (def.effect) {
    case 'luck':
      return t('upgradeFx.luck', { v: v.toFixed(2) });
    case 'rollSpeed':
      return t('upgradeFx.rollSpeed', { v: rollInterval(st).toFixed(2) });
    case 'capacity':
      return t('upgradeFx.capacity', { v: inventoryCapacity(st) });
    case 'luckyEvery':
      return t('upgradeFx.luckyEvery', { v: luckyEvery(st) });
    case 'enchantChance':
      return t('upgradeFx.enchantChance', { v: ((BAL.enchant.baseChance + v) * 100).toFixed(1) });
    default:
      return t(`upgradeFx.${def.effect}`, { v: formatNumber(v) });
  }
}

function useHoldRepeat(fn: () => boolean) {
  const timer = useRef<number | null>(null);
  const stop = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  const start = () => {
    stop();
    if (!fn()) return;
    let delay = 380;
    const loop = () => {
      if (!fn()) return stop();
      delay = Math.max(60, delay * 0.8);
      timer.current = window.setTimeout(loop, delay);
    };
    timer.current = window.setTimeout(loop, delay);
  };
  return { onPointerDown: start, onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop };
}

function UpgradeTile({ def }: { def: UpgradeDef }) {
  const g = useGame((x) => x);
  const level = upgradeLevel(g, def.id);
  const maxed = level >= def.max;
  const cost = upgradeCostAt(def, level);
  const afford = g.currencies.coins >= cost;
  const hold = useHoldRepeat(() => {
    const before = upgradeLevel(getGame(), def.id);
    dispatch({ type: 'buyUpgrade', id: def.id });
    const ok = upgradeLevel(getGame(), def.id) > before;
    if (ok) haptics.impact('light');
    return ok;
  });
  return (
    <div className={`${s.upTile} ${afford && !maxed ? s.upReady : ''}`} style={{ ['--uc' as string]: COLORS[def.id] ?? '#fff' }}>
      <div className={s.upHead}>
        <span className={s.upIcon}>{ICONS[def.id]}</span>
        <div className={s.upTitles}>
          <span className={s.upName}>{t(`upgrade.${def.id}`)}</span>
          <span className={s.upLevel}>{maxed ? t('upgrades.max') : t('upgrades.level', { level })}</span>
        </div>
      </div>
      <div className={s.upPips}>
        <div className={s.upPipFill} style={{ width: `${(level / def.max) * 100}%` }} />
      </div>
      <div className={s.upFx}>
        {maxed ? (
          <span>{effectAt(g, def, level)}</span>
        ) : (
          <>
            <span className={s.upNow}>{effectAt(g, def, level)}</span>
            <span className={s.upArrow}>▶</span>
            <span className={s.upNext}>{effectAt(g, def, level + 1)}</span>
          </>
        )}
      </div>
      <button className={`btn small ${maxed ? 'gold' : afford ? '' : 'gray'} ${s.upBuy}`} disabled={maxed} {...(maxed ? {} : hold)}>
        {maxed ? (
          t('upgrades.max')
        ) : (
          <>
            <CoinIcon size={40} />
            {formatNumber(cost)}
          </>
        )}
      </button>
    </div>
  );
}

export function UpgradesPanel() {
  const coins = useCountUp(useGame((g) => g.currencies.coins));
  return (
    <div className={s.panel}>
      <div className={s.headRow}>
        <span className={s.headTitle}>{t('upgrades.title')}</span>
        <span className={s.headSub}>{t('upgrades.sub')}</span>
        <span style={{ flex: 1 }} />
        <span className={s.coinTag}>
          <CoinIcon size={46} /> {formatNumber(coins)}
        </span>
      </div>
      <div className={s.upGrid}>
        {BAL.upgrades.map((def) => (
          <UpgradeTile key={def.id} def={def} />
        ))}
      </div>
      <span className={s.footNote}>{t('upgrades.hold')}</span>
    </div>
  );
}
