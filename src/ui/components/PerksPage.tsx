/**
 * The Upgrades screen's Perks page (Alley perks, from the second rebirth). Four trees of perks, each
 * growing up from its root: a perk's cost in Half-Eaten Bread Loaves is its row (1 at the bottom, 4 at
 * the top), and a line joins it to the perks that open it. Every perk shows, so a run can be planned;
 * owned ones glow in their tree's color, the ones open now are dark with their price (green when
 * affordable), and the rest are dim. Tap a perk for its card: its one-line pitch, its exact numbers,
 * and the button that eats the loaves. The pocket's loaves show at the top.
 *
 * Icons are pixel art at 6 stage px per art pixel (PixelArt), never scaled; the page doesn't zoom.
 */
import { memo, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BAL, type AlleyPerkDef, type PerkTreeId } from '../../data';
import { alleyPerk, computeStats, formatNumber, perkNodeState, perkTrees, type PerkNodeState } from '../../core';
import { dispatch, getGame, useGame } from '../../app/store';
import { uiIcon } from '../../render/icons';
import type { UiIcon } from '../../render/pixel/ui';
import { haptics } from '../../services';
import { t } from '../i18n';
import { perkFxText, perkLine, perkName, perkNeeds, treeLine, treeName } from '../perkText';
import { useUi } from '../uiStore';
import { BreadIcon, CheckIcon, HeartIcon, LockIcon, SwordIcon } from './Icons';
import { PixelArt } from './PixelArt';
import s from './perks.module.css';

/** Each tree's colors: owned hexes, links and the card's tile (light band over dark band). */
const TREE_COLORS: Record<PerkTreeId, { light: string; dark: string; rim: string }> = {
  crew: { light: '#8be0ff', dark: '#2b86e3', rim: '#c4efff' },
  chaos: { light: '#ff9e86', dark: '#d8323d', rim: '#ffd0c4' },
  reels: { light: '#e0b3ff', dark: '#8a3ff0', rim: '#f1ddff' },
  bread: { light: '#ffe08a', dark: '#d4862a', rim: '#fff3c4' },
};

/* ---------------------------------------------------------------- layout */

/** A tree panel's node area, in stage px. */
const AREA_W = 492;
const AREA_H = 492;
/** Node hexes (flat-top): circumradius, so 2R wide and sqrt(3) R tall. */
const R = 54;
const HH = Math.round((Math.sqrt(3) / 2) * R);

interface Placed {
  def: AlleyPerkDef;
  x: number;
  y: number;
}

/** Rows by cost (the root at the bottom), each row's perks spread evenly across, at whole px. */
function layoutTree(perks: AlleyPerkDef[]): Placed[] {
  const levels = [...new Set(perks.map((p) => p.cost))].sort((a, b) => a - b);
  const rowH = AREA_H / levels.length;
  return perks.map((def) => {
    const row = perks.filter((p) => p.cost === def.cost);
    const i = row.indexOf(def);
    return {
      def,
      x: Math.round((AREA_W * (i + 1)) / (row.length + 1)),
      y: Math.round(AREA_H - rowH * (levels.indexOf(def.cost) + 0.5)),
    };
  });
}

const TREES = perkTrees().map((tree) => ({ ...tree, placed: layoutTree(tree.perks) }));

function hexPoints(r: number): string {
  return [0, 60, 120, 180, 240, 300]
    .map((a) => {
      const rad = (a * Math.PI) / 180;
      return `${(r * Math.cos(rad)).toFixed(1)},${(r * Math.sin(rad)).toFixed(1)}`;
    })
    .join(' ');
}
const OUTER = hexPoints(R);
const INNER = hexPoints(R - 8);

/* ---------------------------------------------------------------- one perk */

interface NodeProps {
  def: AlleyPerkDef;
  x: number;
  y: number;
  view: PerkNodeState;
  afford: boolean;
  selected: boolean;
  /** Just bought: it flashes. */
  fresh: boolean;
}

const PerkNode = memo(function PerkNode({ def, x, y, view, afford, selected, fresh }: NodeProps) {
  const c = TREE_COLORS[def.tree];
  return (
    <button
      className={s.node}
      data-perk={def.id}
      data-view={view}
      data-afford={afford || undefined}
      data-sel={selected || undefined}
      data-fresh={fresh || undefined}
      aria-label={perkName(def.id)}
      style={{ left: x - R, top: y - HH, ['--light' as string]: c.light, ['--dark' as string]: c.dark, ['--rim' as string]: c.rim } as CSSProperties}
      onClick={() => {
        haptics.impact('light');
        useUi.setState({ perkSel: def.id });
      }}
    >
      <svg className={s.shape} width={2 * R} height={2 * HH} viewBox={`${-R} ${-HH} ${2 * R} ${2 * HH}`} aria-hidden>
        <polygon points={OUTER} className={s.rim} />
        <polygon points={INNER} className={s.face} style={view === 'owned' ? { fill: `url(#perkFace-${def.tree})` } : undefined} />
        <polygon points={OUTER} className={s.ring} />
      </svg>
      <span className={s.icon}>
        <PixelArt art={uiIcon(def.icon as UiIcon, 'md')} />
      </span>
      {view === 'owned' ? (
        <span className={s.owned}>
          <CheckIcon size="xs" />
        </span>
      ) : (
        <span className={s.cost}>
          {view === 'locked' ? <LockIcon size="xs" /> : <BreadIcon size="xs" />}
          {def.cost}
        </span>
      )}
    </button>
  );
});

/* ---------------------------------------------------------------- a tree */

function Tree({ id, icon, placed, owned, bread, sel, fresh }: {
  id: PerkTreeId; icon: string; placed: Placed[]; owned: readonly string[]; bread: number; sel: string; fresh: string | null;
}) {
  const c = TREE_COLORS[id];
  const st = { perks: { owned: owned as string[] } };
  const at = new Map(placed.map((p) => [p.def.id, p]));
  return (
    <div className={s.tree} style={{ ['--light' as string]: c.light, ['--dark' as string]: c.dark } as CSSProperties}>
      <div className={s.treeHead}>
        <PixelArt art={uiIcon(icon as UiIcon, 'sm')} />
        <div className={s.treeTitles}>
          <span className={s.treeName}>{treeName(id)}</span>
          <span className={s.treeLine}>{treeLine(id)}</span>
        </div>
      </div>
      <div className={s.area}>
        <svg className={s.links} width={AREA_W} height={AREA_H} aria-hidden>
          {placed.flatMap((p) =>
            p.def.requires.map((req) => {
              const from = at.get(req);
              if (!from) return null;
              const a = owned.includes(req);
              const b = owned.includes(p.def.id);
              const kind = a && b ? 'owned' : a ? 'open' : 'locked';
              return (
                <g key={`${req}>${p.def.id}`} className={s.link} data-view={kind}>
                  <line x1={from.x} y1={from.y} x2={p.x} y2={p.y} className={s.linkEdge} />
                  <line x1={from.x} y1={from.y} x2={p.x} y2={p.y} className={s.linkFill} />
                </g>
              );
            }),
          )}
        </svg>
        {placed.map((p) => {
          const view = perkNodeState(st, p.def.id);
          return (
            <PerkNode
              key={p.def.id}
              def={p.def}
              x={p.x}
              y={p.y}
              view={view}
              afford={view === 'open' && bread >= p.def.cost}
              selected={sel === p.def.id}
              fresh={fresh === p.def.id}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- the card */

function PerkCard({ def }: { def: AlleyPerkDef }) {
  const owned = useGame((g) => g.perks.owned);
  const bread = useGame((g) => g.perks.bread);
  const view = perkNodeState({ perks: { owned } }, def.id);
  const afford = view === 'open' && bread >= def.cost;
  const c = TREE_COLORS[def.tree];
  const buy = () => {
    if (!afford) {
      haptics.impact('light');
      return;
    }
    dispatch({ type: 'buyPerk', id: def.id });
    haptics.impact('heavy');
  };
  return (
    <div className={`${s.card} card`} data-view={view}>
      <span className={s.cardTile} style={{ ['--light' as string]: c.light, ['--dark' as string]: c.dark } as CSSProperties} data-view={view}>
        <PixelArt art={uiIcon(def.icon as UiIcon, 'nav')} />
      </span>
      <div className={s.cardBody}>
        <span className={s.cardName}>
          {perkName(def.id)}
          <em className={s.cardTag} style={{ background: c.light }}>{treeName(def.tree)}</em>
        </span>
        <span className={s.cardLine}>{perkLine(def.id)}</span>
        <span className={s.cardFx}>{perkFxText(def)}</span>
        {view === 'locked' && <span className={s.cardNeeds}>{perkNeeds(def)}</span>}
        {view === 'open' && !afford && <span className={s.cardNeeds}>{t('perks.needBread')}</span>}
      </div>
      {view === 'owned' ? (
        <button className={`btn gold ${s.buy}`} disabled>
          <CheckIcon />
          {t('perks.owned')}
        </button>
      ) : view === 'locked' ? (
        <button className={`btn gray ${s.buy}`} disabled>
          <LockIcon />
          {def.cost}
        </button>
      ) : (
        <button className={`btn ${afford ? 'breathe' : 'gray'} ${s.buy}`} onClick={buy}>
          <BreadIcon />
          {def.cost}
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- the page */

export function PerksPage({ tabs, onClose }: { tabs: ReactNode; onClose: () => void }) {
  const owned = useGame((g) => g.perks.owned);
  const bread = useGame((g) => g.perks.bread);
  const atk = useGame((g) => computeStats(g).ATK);
  const hp = useGame((g) => computeStats(g).HP);
  const calm = useGame((g) => g.settings.reduceMotion);
  const sel = useUi((u) => u.perkSel);
  // A perk just bought flashes once (its chime: soundController).
  const [fresh, setFresh] = useState<string | null>(null);
  const seen = useRef(owned);
  useEffect(() => {
    const before = seen.current;
    seen.current = owned;
    const added = owned.find((id) => !before.includes(id));
    if (!added) return;
    setFresh(added);
    const id = setTimeout(() => setFresh(null), 700);
    return () => clearTimeout(id);
  }, [owned]);
  // Nothing selected (or a stale id): the cheapest perk open now, else the first.
  useEffect(() => {
    if (alleyPerk(sel)) return;
    const g = getGame();
    const open = TREES.flatMap((tr) => tr.perks).filter((p) => perkNodeState(g, p.id) === 'open').sort((a, b) => a.cost - b.cost)[0];
    useUi.setState({ perkSel: (open ?? TREES[0].perks[0]).id });
  }, [sel]);
  const def = alleyPerk(sel);
  return (
    <div className={s.page} data-calm={calm || undefined} data-keep-lit>
      <svg className={s.defs} aria-hidden>
        <defs>
          {TREES.map((tr) => (
            <linearGradient key={tr.id} id={`perkFace-${tr.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={TREE_COLORS[tr.id].light} />
              <stop offset="1" stopColor={TREE_COLORS[tr.id].dark} />
            </linearGradient>
          ))}
        </defs>
      </svg>
      <div className={s.head}>
        <div className={s.titles}>
          {tabs}
          <span className={s.sub}>{t('perks.sub', { n: BAL.perks.loavesPerWorld })}</span>
          <span className={s.hint}>{t('perks.hint')}</span>
        </div>
        <div className={s.pocket} title={t('perks.bread')} aria-label={`${bread} ${t('perks.bread')}`}>
          <BreadIcon size="nav" />
          <span className={s.pocketN}>{formatNumber(bread)}</span>
        </div>
      </div>
      <div className={s.grid}>
        {TREES.map((tr) => (
          <Tree key={tr.id} id={tr.id} icon={tr.icon} placed={tr.placed} owned={owned} bread={bread} sel={sel} fresh={fresh} />
        ))}
      </div>
      <div className={s.foot}>
        {def && <PerkCard def={def} />}
        <div className={s.bar}>
          <span className={s.stat} title={t('strip.hp')}>
            <HeartIcon />
            {formatNumber(hp)}
          </span>
          <button className={`btn red ${s.close}`} onClick={onClose}>
            {t('upgrades.close')}
          </button>
          <span className={`${s.stat} ${s.statRight}`} title={t('strip.atk')}>
            <SwordIcon />
            {formatNumber(atk)}
          </span>
        </div>
        <span className={s.wipes}>{t('perks.wipes')}</span>
      </div>
    </div>
  );
}
