/**
 * The upgrade tree (Roblox style): one root, four branches (Spins, Enchants, Money, Combat).
 * Buying a node's levels unlocks the nodes under it. Costs climb exponentially per level; a
 * rebirth wipes the tree but makes every node cheaper. Tap a node for details; hold Buy to buy fast.
 */
import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { BAL } from '../../data';
import {
  drySpell, enchantTierWeights, formatNumber, inventoryCapacity, luckyEvery, potionSeconds, spinCycle, upgradeDef, upgradeLevel,
  upgradePrice, upgradeUnlocked, type GameState, type UpgradeDef,
} from '../../core';
import { dispatch, getGame, useGame } from '../../app/store';
import { haptics } from '../../services';
import { useCountUp } from '../hooks';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import {
  BagIcon, BoltIcon, BookIcon, ClockIcon, CloverIcon, CoinIcon, DiceIcon, HeartIcon, LockIcon, PotionIcon,
  PowerIcon, ShieldIcon, SkullIcon, StarIcon, SwordIcon, TrashIcon, WheelIcon,
} from './Icons';
import s from './tree.module.css';

const ICONS: Record<string, (n: number) => ReactNode> = {
  luck: (n) => <CloverIcon size={n} />,
  rollSpeed: (n) => <WheelIcon size={n} />,
  bagFind: (n) => <BagIcon size={n} />,
  turboPower: (n) => <BoltIcon size={n} />,
  luckyRoll: (n) => <DiceIcon size={n} />,
  luckyMult: (n) => <CloverIcon size={n} />,
  goldenSpin: (n) => <WheelIcon size={n} gold />,
  enchant: (n) => <StarIcon size={n} />,
  enchantTier: (n) => <StarIcon size={n} />,
  pity: (n) => <ShieldIcon size={n} />,
  gold: (n) => <CoinIcon size={n} />,
  bagSpace: (n) => <BagIcon size={n} />,
  scrapPct: (n) => <TrashIcon size={n} />,
  xpPct: (n) => <BookIcon size={n} />,
  potionTime: (n) => <PotionIcon size={n} />,
  offlinePct: (n) => <ClockIcon size={n} />,
  strength: (n) => <SwordIcon size={n} />,
  toughness: (n) => <HeartIcon size={n} />,
  lifesteal: (n) => <HeartIcon size={n} />,
  critChance: (n) => <PowerIcon size={n} />,
  critDmg: (n) => <PowerIcon size={n} />,
  bossDmg: (n) => <SkullIcon size={n} />,
};

const BRANCH_COLOR: Record<string, string> = {
  luck: '#5bc236',
  rollSpeed: '#42a5f5',
  enchant: '#a463f2',
  gold: '#ffc233',
  strength: '#ef5350',
};

interface TreeNode {
  def: UpgradeDef;
  children: TreeNode[];
  depth: number;
  x: number;
  branch: string;
}

const COL_W = 113;
const ROW_H = 136;
const NODE = 88;
const PAD_TOP = 18;

function buildTree(): { nodes: TreeNode[]; cols: number; rows: number } {
  const byId = new Map<string, TreeNode>(BAL.upgrades.map((d) => [d.id, { def: d, children: [], depth: 0, x: 0, branch: d.id }]));
  const roots: TreeNode[] = [];
  for (const d of BAL.upgrades) {
    const n = byId.get(d.id)!;
    if (d.requires) byId.get(d.requires.id)!.children.push(n);
    else roots.push(n);
  }
  let col = 0;
  let rows = 0;
  const place = (n: TreeNode, depth: number, branch: string) => {
    n.depth = depth;
    n.branch = depth === 0 ? n.def.id : depth === 1 ? n.def.id : branch;
    rows = Math.max(rows, depth + 1);
    if (n.children.length === 0) {
      n.x = col++;
      return;
    }
    n.children.forEach((c) => place(c, depth + 1, n.branch));
    n.x = (n.children[0].x + n.children[n.children.length - 1].x) / 2;
  };
  roots.forEach((r) => place(r, 0, r.def.id));
  return { nodes: [...byId.values()], cols: col, rows };
}

function at(n: TreeNode, cols: number, width: number) {
  const colW = Math.min(COL_W, width / cols);
  const left = (width - colW * cols) / 2;
  return { x: left + colW * (n.x + 0.5), y: PAD_TOP + NODE / 2 + n.depth * ROW_H };
}

/** The effect of `def` at `level`, as shown in the details panel. */
export function effectAt(g: GameState, def: UpgradeDef, level: number): string {
  const st = { ...g, upgrades: { ...g.upgrades, [def.id]: level } } as GameState;
  const v = def.perLevel * level;
  const r = BAL.roll;
  switch (def.effect) {
    case 'luck':
      return t('upgradeFx.luck', { v: v.toFixed(2) });
    case 'rollSpeed':
      return t('upgradeFx.rollSpeed', { v: spinCycle(st).toFixed(2) });
    case 'capacity':
      return t('upgradeFx.capacity', { v: inventoryCapacity(st) });
    case 'luckyEvery':
      return t('upgradeFx.luckyEvery', { v: luckyEvery(st) });
    case 'enchantChance':
      return t('upgradeFx.enchantChance', { v: ((BAL.enchant.baseChance + v) * 100).toFixed(1) });
    case 'turboPower':
      return t('upgradeFx.turboPower', { v: (r.turboSpeedMult + v).toFixed(2) });
    case 'luckyMult':
      return t('upgradeFx.luckyMult', { v: (r.luckyRollMult + v).toFixed(2) });
    case 'goldenSpin':
      return t('upgradeFx.goldenSpin', { v: Math.round(v * 100) });
    case 'enchantTier': {
      const w = enchantTierWeights(level);
      return t('upgradeFx.enchantTier', { v: Math.round((w[2] / (w[0] + w[1] + w[2])) * 100) });
    }
    case 'pity':
      return t('upgradeFx.pity', { v: drySpell(st) });
    case 'potionTime':
      return t('upgradeFx.potionTime', { v: potionSeconds(st) });
    default:
      return t(`upgradeFx.${def.effect}`, { v: Number.isInteger(v) ? formatNumber(v) : v.toFixed(1) });
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

function Details({ def }: { def: UpgradeDef }) {
  const g = useGame((x) => x);
  const level = upgradeLevel(g, def.id);
  const maxed = level >= def.max;
  const unlocked = upgradeUnlocked(g, def);
  const cost = upgradePrice(g, def);
  const afford = g.currencies.coins >= cost;
  const parent = def.requires ? upgradeDef(def.requires.id) : undefined;
  const hold = useHoldRepeat(() => {
    const before = upgradeLevel(getGame(), def.id);
    dispatch({ type: 'buyUpgrade', id: def.id });
    const ok = upgradeLevel(getGame(), def.id) > before;
    if (ok) haptics.impact('light');
    return ok;
  });
  return (
    <div className={`${s.details} card`}>
      <span className={s.detIcon} style={{ ['--bc' as string]: BRANCH_COLOR[def.id] ?? '#7c82a8' } as CSSProperties}>
        {ICONS[def.id]?.(80)}
      </span>
      <div className={s.detBody}>
        <div className={s.detHead}>
          <span className={s.detName}>{t(`upgrade.${def.id}`)}</span>
          <span className={s.detLevel}>{maxed ? t('upgrades.max') : t('upgrades.levelOf', { level, max: def.max })}</span>
        </div>
        <span className={s.detDesc}>{t(`upgradeDesc.${def.id}`)}</span>
        <span className={s.detFx}>
          {maxed ? (
            effectAt(g, def, level)
          ) : (
            <>
              <span className={s.fxNow}>{effectAt(g, def, level)}</span> <b>▶</b> <span className={s.fxNext}>{effectAt(g, def, level + 1)}</span>
            </>
          )}
        </span>
      </div>
      {!unlocked ? (
        <span className={s.needs}>
          <LockIcon size={40} />
          {t('upgrades.needs', { name: parent ? t(`upgrade.${parent.id}`) : '', level: def.requires?.level ?? 1 })}
        </span>
      ) : (
        <button className={`btn ${maxed ? 'gold' : afford ? '' : 'gray'} ${s.buy}`} disabled={maxed} {...(maxed ? {} : hold)}>
          {maxed ? (
            t('upgrades.max')
          ) : (
            <>
              <CoinIcon size={44} />
              {formatNumber(cost)}
            </>
          )}
        </button>
      )}
    </div>
  );
}

export function UpgradesPanel() {
  const g = useGame((x) => x);
  const coins = useCountUp(g.currencies.coins);
  const sel = useUi((u) => u.upgradeSel);
  const { nodes, cols, rows } = useMemo(buildTree, []);
  const width = 1032;
  const height = PAD_TOP + rows * ROW_H + 10;
  const byId = new Map(nodes.map((n) => [n.def.id, n]));
  const selDef = upgradeDef(sel) ?? BAL.upgrades[0];
  return (
    <div className={s.panel}>
      <div className={s.head}>
        <span className={s.title}>{t('upgrades.title')}</span>
        <span className={s.sub}>{g.rebirths > 0 ? t('upgrades.subOff', { pct: Math.round((1 - Math.pow(1 - BAL.rebirth.upgradeDiscountPer, g.rebirths)) * 100) }) : t('upgrades.sub')}</span>
        <span style={{ flex: 1 }} />
        <span className={s.coinTag}>
          <CoinIcon size={44} /> {formatNumber(coins)}
        </span>
      </div>
      <div className={s.scroll}>
        <div className={s.tree} style={{ width, height }}>
          <svg className={s.lines} width={width} height={height}>
            {nodes
              .filter((n) => n.def.requires)
              .map((n) => {
                const p = byId.get(n.def.requires!.id)!;
                const a = at(p, cols, width);
                const b = at(n, cols, width);
                const open = upgradeUnlocked(g, n.def);
                const d = `M${a.x} ${a.y + NODE / 2} C ${a.x} ${(a.y + b.y) / 2}, ${b.x} ${(a.y + b.y) / 2}, ${b.x} ${b.y - NODE / 2}`;
                return (
                  <g key={n.def.id}>
                    <path d={d} stroke="#15172a" strokeWidth={14} fill="none" strokeLinecap="round" />
                    <path
                      d={d}
                      stroke={open ? BRANCH_COLOR[n.branch] ?? '#ffd23f' : '#4a4f72'}
                      strokeWidth={6}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={open ? undefined : '2 12'}
                    />
                  </g>
                );
              })}
          </svg>
          {nodes.map((n) => {
            const p = at(n, cols, width);
            const level = upgradeLevel(g, n.def.id);
            const unlocked = upgradeUnlocked(g, n.def);
            const maxed = level >= n.def.max;
            const afford = unlocked && !maxed && g.currencies.coins >= upgradePrice(g, n.def);
            const state = !unlocked ? 'locked' : maxed ? 'max' : afford ? 'afford' : 'open';
            const frac = level / n.def.max;
            const circ = 2 * Math.PI * 47;
            return (
              <button
                key={n.def.id}
                className={`${s.node} ${sel === n.def.id ? s.nodeSel : ''}`}
                data-state={state}
                style={{ left: p.x - NODE / 2, top: p.y - NODE / 2, ['--bc' as string]: BRANCH_COLOR[n.branch] ?? '#7c82a8' } as CSSProperties}
                onClick={() => {
                  haptics.impact('light');
                  useUi.setState({ upgradeSel: n.def.id });
                }}
              >
                <svg className={s.ring} viewBox="-52 -52 104 104">
                  <circle r={47} className={s.ringBg} />
                  <circle r={47} className={s.ringFg} strokeDasharray={`${circ * frac} ${circ}`} transform="rotate(-90)" />
                </svg>
                <span className={s.nodeIcon}>{unlocked ? ICONS[n.def.id]?.(56) : <LockIcon size={44} />}</span>
                <span className={s.nodeLevel}>{maxed ? t('upgrades.max') : `${level}/${n.def.max}`}</span>
                <span className={s.nodeName}>{t(`upgrade.${n.def.id}`)}</span>
                {afford && <span className={s.nodeDot}>!</span>}
              </button>
            );
          })}
        </div>
      </div>
      <Details def={selDef} />
    </div>
  );
}
