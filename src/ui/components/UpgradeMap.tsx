/**
 * The Upgrades screen. Its first page is the upgrade map (Roblox style): a full-screen honeycomb that
 * grows out of Luck I. Every tier of every upgrade line is one hex. Owned hexes are bright, the next
 * buyable ones are dark with their price, the ones just past those show "?", and everything further
 * out stays hidden until you get close. Gold hexes are one-off specials. Drag to pan, pinch or scroll
 * to zoom, tap a hex for its details, and hold Buy to keep buying up a line.
 *
 * From the second rebirth a switch at the top leads to its second page, the Perks page (PerksPage.tsx:
 * Alley perks bought with Half-Eaten Bread Loaves). After the first rebirth the switch shows it locked,
 * as a taste of what's coming; before that the screen is just the map.
 *
 * Zooming scales the map (hex shapes, lines and words) but never the pixel art: the hexes' icons live
 * in their own layer on top that only moves, by whole stage px, so they stay 6 px per art pixel at
 * every zoom (and hide when the map is zoomed far out).
 */
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BAL, DATA, nodeKey, type HexNode } from '../../data';
import { affordablePerks, computeStats, drySpell, enchantTierWeights, formatNumber, inventoryCapacity, luckyEvery, perksOpen, potionSeconds, reelCount, spinCycle, upgradeDef, upgradeEffects, upgradeLevel, upgradeNodeState, upgradePrice, type GameState, type UpgradeDef, formatPct } from '../../core';
import { dispatch, getGame, useGame } from '../../app/store';
import { uiIcon } from '../../render/icons';
import type { UiIcon } from '../../render/pixel/ui';
import { haptics } from '../../services';
import { audio } from '../../services/audio';
import { featureView, seeFeature } from '../features';
import { useCountUp } from '../hooks';
import { t } from '../i18n';
import { stagePoint } from '../drag';
import { useUi } from '../uiStore';
import { Chunky } from './Chunky';
import { BreadIcon, CheckIcon, CoinIcon, LockIcon, ShieldIcon, SwordIcon, TargetIcon } from './Icons';
import { PerksPage } from './PerksPage';
import { PixelArt } from './PixelArt';
import s from './hexmap.module.css';

/* ---------------------------------------------------------------- geometry */

/** Hex circumradius in stage pixels (flat-top hexes). */
const R = 100;
const HW = R;
const HH = (Math.sqrt(3) / 2) * R;
const X_STEP = 1.5 * R;
const Y_STEP = HH;
/** Drawn hexes are a bit smaller than their cell, leaving a gap the connectors show through. */
const DRAW = 0.93;
const K_MIN = 0.25;
const K_MAX = 1.7;
/** Where the map centers things: the middle of the area between the header and the buy card. */
/** Where the map's focus sits on screen (stage px): tall stage, or wide (PC: the middle, above the card). */
const FOCUS_TALL = { x: 540, y: 800 };
/** The wide stage: the middle of the map's room, left of the 600 px panel and under the page's words. */
const FOCUS_WIDE = { x: 780, y: 520 };
const focusPoint = () => (useUi.getState().wide ? FOCUS_WIDE : FOCUS_TALL);
/** The zoom it opens at (and the target button returns to): a little further out on a PC, with room to show more. */
const homeZoom = () => (useUi.getState().wide ? 0.85 : 1);

function hexPoints(r: number): string {
  return [0, 60, 120, 180, 240, 300]
    .map((a) => {
      const rad = (a * Math.PI) / 180;
      return `${(r * Math.cos(rad)).toFixed(1)},${(r * Math.sin(rad)).toFixed(1)}`;
    })
    .join(' ');
}
const OUTER = hexPoints(R * DRAW);
/**
 * The faint honeycomb behind the map, one tile of it (3R x 2HH, like the old SVG pattern) as a picture
 * the map's window repeats under the hexes. It used to be a giant SVG inside the zoomed layer, padded
 * 2400 px all round so it reached the screen's edges zoomed out: one huge layer the browser had to
 * hold whole, which crashed phones (Kevin's tester, in landscape).
 */
const GRID_URL = (() => {
  const w = 3 * R;
  const h = 2 * HH;
  const hexes = [[0, 0], [w, 0], [0, h], [w, h], [1.5 * R, HH]]
    .map(([x, y]) => `<polygon points="${OUTER}" transform="translate(${x} ${y})"/>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h.toFixed(2)}" viewBox="0 0 ${w} ${h.toFixed(2)}"><g fill="none" stroke="rgba(255,255,255,0.045)" stroke-width="3">${hexes}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();
const INNER = hexPoints(R * DRAW - 12);
const SHINE = `M${(-R * DRAW + 40).toFixed(1)} ${(-HH * DRAW + 22).toFixed(1)} L${(R * DRAW - 58).toFixed(1)} ${(-HH * DRAW + 22).toFixed(1)}`;

const nodeX = (n: HexNode) => n.col * X_STEP;
const nodeY = (n: HexNode) => n.row * Y_STEP;
const BY_KEY = new Map(DATA.upgradeMap.map((n) => [n.key, n]));
/** Hex distance from the center, for the opening ripple. */
const ring = (n: HexNode) => Math.max(Math.abs(n.col), (Math.abs(n.col) + Math.abs(n.row)) / 2);

const ROMAN: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function roman(n: number): string {
  let out = '';
  for (const [v, sym] of ROMAN) while (n >= v) (out += sym), (n -= v);
  return out;
}

/** Each upgrade line's icon. */
const ICONS: Record<string, UiIcon> = {
  luck: 'clover',
  clover: 'clover',
  extraReel: 'reelGold',
  rollSpeed: 'reel',
  bagFind: 'bag',
  luckyRoll: 'dice',
  luckyMult: 'star',
  goldenWheel: 'reelGold',
  goldenSpin: 'reelGold',
  turboPower: 'bolt',
  enchant: 'star',
  enchantTier: 'gem',
  pity: 'shield',
  arcaneAltar: 'gem',
  gold: 'coin',
  scrapPct: 'trash',
  xpPct: 'book',
  potionTime: 'potion',
  offlinePct: 'clock',
  coinVault: 'coin',
  bagSpace: 'backpack',
  megaBackpack: 'backpack',
  strength: 'sword',
  critChance: 'target',
  critDmg: 'power',
  bossDmg: 'skull',
  champion: 'sword',
  toughness: 'heart',
  lifesteal: 'drop',
  titan: 'heart',
};
const iconOf = (id: string): UiIcon => ICONS[id] ?? 'star';

/**
 * What the hexes show at a zoom: 'near' everything (tier, icon, name or price), 'mid' only their icons
 * (the words would be too small to read), 'far' only their colors (too small for the icons, which
 * never shrink).
 */
type Zoom = 'near' | 'mid' | 'far';
const zoomOf = (k: number): Zoom => (k >= 0.85 ? 'near' : k >= 0.45 ? 'mid' : 'far');
/** Up close, a hex's icon sits this far above its center (map px), between the tier and the name or price. */
const iconLift = (view: HexView) => (view === 'open' ? 9 : 13);

/** Where a hex's icon goes in the icon layer at zoom `k` (whole stage px). */
function iconSpot(n: HexNode, view: HexView, k: number): string {
  const lift = zoomOf(k) === 'near' ? iconLift(view) : 0;
  return `translate3d(${Math.round(nodeX(n) * k)}px, ${Math.round((nodeY(n) - lift) * k)}px, 0)`;
}

export function nodeName(n: HexNode): string {
  const name = t(`upgrade.${n.id}`);
  return upgradeDef(n.id)!.max > 1 ? t('upgrades.nodeName', { name, tier: roman(n.tier) }) : name;
}

/* ---------------------------------------------------------------- state */

export type HexView = 'owned' | 'open' | 'mystery';

/** What a hex shows: owned, open (buyable next), mystery ("?" one step past an open hex), or hidden (null). */
export function hexView(g: Pick<GameState, 'upgrades'>, n: HexNode): HexView | null {
  const st = upgradeNodeState(g, n.id, n.tier);
  if (st !== 'locked') return st;
  const prev = n.prev ? BY_KEY.get(n.prev) : undefined;
  return prev && upgradeNodeState(g, prev.id, prev.tier) === 'open' ? 'mystery' : null;
}

/** The total effect of `def`'s kind with `def` at `level` tiers, as shown on the buy card. */
export function effectAt(g: GameState, def: UpgradeDef, level: number): string {
  const st = { ...g, upgrades: { ...g.upgrades, [def.id]: level } } as GameState;
  const v = upgradeEffects(st)[def.effect];
  const r = BAL.roll;
  switch (def.effect) {
    case 'luck':
      return t('upgradeFx.luck', { v: formatPct(v) });
    case 'rollSpeed': {
      // How much faster a spin is than with no Spin Speed tiers.
      const base = spinCycle({ ...st, upgrades: { ...st.upgrades, [def.id]: 0 } } as GameState);
      return t('upgradeFx.rollSpeed', { v: formatPct(base / spinCycle(st) - 1) });
    }
    case 'capacity':
      return t('upgradeFx.capacity', { v: inventoryCapacity(st) });
    case 'luckyEvery':
      return t('upgradeFx.luckyEvery', { v: luckyEvery(st) });
    case 'enchantChance':
      return t('upgradeFx.enchantChance', { v: ((BAL.enchant.baseChance + v) * 100).toFixed(1) });
    case 'turboPower':
      return t('upgradeFx.turboPower', { v: formatPct(r.turboSpeedMult + v - 1) });
    case 'luckyMult':
      return t('upgradeFx.luckyMult', { v: formatPct(r.luckyRollMult + v - 1) });
    case 'goldenSpin':
      return t('upgradeFx.goldenSpin', { v: Math.round(v * 100) });
    case 'enchantTier': {
      const w = enchantTierWeights(v);
      return t('upgradeFx.enchantTier', { v: Math.round((w[2] / (w[0] + w[1] + w[2])) * 100) });
    }
    case 'pity':
      return t('upgradeFx.pity', { v: drySpell(st) });
    case 'potionTime':
      return t('upgradeFx.potionTime', { v: potionSeconds(st) });
    case 'reels':
      return t('upgradeFx.reels', { v: reelCount(st) });
    default:
      return t(`upgradeFx.${def.effect}`, { v: Number.isInteger(v) ? formatNumber(v) : (Math.round(v * 10) / 10).toString() });
  }
}

/* ---------------------------------------------------------------- hex */

interface HexProps {
  node: HexNode;
  view: HexView;
  afford: boolean;
  selected: boolean;
  price: number;
  /** Mounted after the map opened: play the buy/reveal animation instead of the opening ripple. */
  fresh: boolean;
  calm: boolean;
}

const Hex = memo(function Hex({ node, view, afford, selected, price, fresh, calm }: HexProps) {
  // Decided once, when this hex mounts (a hex remounts whenever its view changes).
  const mode = useRef(calm ? 'calm' : fresh ? 'fresh' : 'intro').current;
  const def = upgradeDef(node.id)!;
  return (
    <div
      className={s.hex}
      data-node={node.key}
      data-view={view}
      data-mode={mode}
      data-special={node.special || undefined}
      data-afford={afford || undefined}
      data-sel={selected || undefined}
      role="button"
      aria-label={view === 'mystery' ? t('upgrades.mystery') : nodeName(node)}
      style={{ left: nodeX(node) - HW, top: nodeY(node) - HH, animationDelay: mode === 'intro' ? `${Math.min(420, ring(node) * 22)}ms` : undefined }}
    >
      <div className={s.body}>
        <svg className={s.shape} width={2 * HW} height={2 * HH} viewBox={`${-HW} ${-HH} ${2 * HW} ${2 * HH}`} aria-hidden>
          <polygon points={OUTER} className={s.rim} />
          <polygon points={INNER} className={s.face} />
          <path d={SHINE} className={s.shine} />
          <polygon points={OUTER} className={s.ring} />
        </svg>
        {view === 'mystery' ? (
          <span className={s.q}>?</span>
        ) : (
          <>
            {def.max > 1 && <span className={s.tier}>{roman(node.tier)}</span>}
            {/* The icon is drawn in the map's icon layer (HexIcon), so zooming never scales it. */}
            <span className={s.name}>{t(`upgrade.${node.id}`)}</span>
            {view === 'open' && <span className={s.price}>{formatNumber(price)}</span>}
            {view === 'open' && afford && <span className={s.bang}>!</span>}
          </>
        )}
      </div>
    </div>
  );
});

/** A hex's icon in the icon layer: about 10 x 10 art pixels at 6 px each, placed (and re-placed on zoom) by the map. */
const HexIcon = memo(function HexIcon({ node, view, k, fresh, calm }: { node: HexNode; view: HexView; k: number; fresh: boolean; calm: boolean }) {
  // Decided once, when it mounts (like its hex): the opening fade, or the buy/reveal flash.
  const mode = useRef(calm ? 'calm' : fresh ? 'fresh' : 'intro').current;
  const delay = mode === 'intro' ? `${Math.min(420, ring(node) * 22)}ms` : undefined;
  return (
    <div
      className={s.hexIcon}
      data-node={node.key}
      data-view={view}
      data-mode={mode}
      style={{ transform: iconSpot(node, view, k), animationDelay: delay } as CSSProperties}
    >
      <PixelArt art={uiIcon(iconOf(node.id), 'md')} />
    </div>
  );
});

/* ---------------------------------------------------------------- buy card */

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
      delay = Math.max(70, delay * 0.8);
      timer.current = window.setTimeout(loop, delay);
    };
    timer.current = window.setTimeout(loop, delay);
  };
  return { onPointerDown: start, onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop };
}

/** Buys the selected hex; on success the selection moves up the line so holding keeps buying. */
function buySelected(): boolean {
  const n = BY_KEY.get(useUi.getState().upgradeSel);
  if (!n || upgradeNodeState(getGame(), n.id, n.tier) !== 'open') return false;
  dispatch({ type: 'buyUpgrade', id: n.id });
  if (upgradeLevel(getGame(), n.id) < n.tier) {
    haptics.impact('light');
    return false;
  }
  haptics.impact('medium');
  if (n.tier < upgradeDef(n.id)!.max) useUi.setState({ upgradeSel: nodeKey(n.id, n.tier + 1) });
  return true;
}

function BuyCard({ node }: { node: HexNode }) {
  const g = useGame((x) => x);
  const view = hexView(g, node) ?? 'mystery';
  const def = upgradeDef(node.id)!;
  const level = upgradeLevel(g, def.id);
  const cost = upgradePrice(g, def);
  const afford = g.currencies.coins >= cost;
  const hold = useHoldRepeat(buySelected);
  const prev = node.prev ? BY_KEY.get(node.prev) : undefined;
  if (view === 'mystery') {
    return (
      <div className={`${s.card} card`} data-view="mystery">
        <span className={s.cardTile} data-view="mystery">
          <span className={s.cardQ}>?</span>
        </span>
        <div className={s.cardBody}>
          <span className={s.cardName}>{t('upgrades.mystery')}</span>
          <span className={s.cardDesc}>{t('upgrades.reveal', { name: prev ? nodeName(prev) : '' })}</span>
        </div>
        <button className={`btn gray ${s.buy}`} disabled>
          <LockIcon />
          {t('upgrades.locked')}
        </button>
      </div>
    );
  }
  return (
    <div className={`${s.card} card`} data-view={view}>
      <span className={s.cardTile} data-view={view} data-special={node.special || undefined}>
        <PixelArt art={uiIcon(iconOf(node.id), 'nav')} />
      </span>
      <div className={s.cardBody}>
        <span className={s.cardName}>
          {nodeName(node)}
          {node.special && <em className={s.cardTag}>{t('upgrades.stateSpecial')}</em>}
        </span>
        <span className={s.cardDesc}>{t(`upgradeDesc.${def.id}`)}</span>
        <span className={s.cardFx}>
          {view === 'owned' ? (
            effectAt(g, def, level)
          ) : (
            <>
              <span className={s.fxNow}>{effectAt(g, def, node.tier - 1)}</span> <b>▶</b>{' '}
              <span className={s.fxNext}>{effectAt(g, def, node.tier)}</span>
            </>
          )}
        </span>
      </div>
      {view === 'owned' ? (
        <button className={`btn gold ${s.buy}`} disabled>
          <CheckIcon />
          {t('upgrades.owned')}
        </button>
      ) : (
        <button className={`btn ${afford ? '' : 'gray'} ${s.buy}`} {...hold}>
          <CoinIcon />
          {formatNumber(cost)}
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- map */

interface View {
  x: number;
  y: number;
  k: number;
}

/* ---------------------------------------------------------------- the switch between the two pages */

/**
 * How the Perks tab shows: 'hidden' in a run before the first rebirth (nothing new yet), 'locked' (a
 * taste of what's coming after the first rebirth, or waiting for its turn to be introduced), 'intro'
 * (just opened: it blinks until tapped) or 'open'.
 */
type PerksTab = 'hidden' | 'locked' | 'intro' | 'open';

function perksTab(g: GameState): PerksTab {
  if (!perksOpen(g)) return g.rebirths >= 1 ? 'locked' : 'hidden';
  return featureView(g, 'perks');
}

function PageTabs({ page, perks }: { page: 'upgrades' | 'perks'; perks: PerksTab }) {
  const bread = useGame((g) => g.perks.bread);
  const canBuy = useGame((g) => affordablePerks(g).length > 0);
  const [nope, setNope] = useState(false);
  const open = (p: 'upgrades' | 'perks') => {
    if (p === 'perks' && perks === 'locked') {
      haptics.impact('light');
      setNope(true);
      setTimeout(() => setNope(false), 400);
      useUi.getState().toast(perksOpen(getGame()) ? t('nav.locked') : t('perks.lockedToast', { n: BAL.perks.unlockRebirths }), 'info');
      return;
    }
    haptics.impact('light');
    if (p === 'perks') seeFeature('perks');
    useUi.setState({ upgradePage: p });
  };
  return (
    <div className={s.tabs} data-ui>
      <button className={s.tab} data-on={page === 'upgrades' || undefined} onClick={() => open('upgrades')}>
        {t('upgrades.tab')}
      </button>
      <button
        className={s.tab}
        data-on={page === 'perks' || undefined}
        data-perks
        data-locked={perks === 'locked' || undefined}
        data-new={perks === 'intro' || undefined}
        data-nope={nope || undefined}
        onClick={() => open('perks')}
      >
        {perks === 'locked' ? <LockIcon size="sm" /> : <BreadIcon size="sm" />}
        {t('perks.tab')}
        {perks !== 'locked' && page !== 'perks' && bread > 0 && (
          <span className={s.tabBread} data-buy={canBuy || undefined}>
            {bread}
          </span>
        )}
      </button>
      {perks === 'locked' && !perksOpen(getGame()) && <span className={s.tabNote}>{t('perks.lockedTab', { n: BAL.perks.unlockRebirths })}</span>}
    </div>
  );
}

/** The Upgrades screen: the upgrade map, or (from the second rebirth) the Perks page. */
export function UpgradeMap() {
  const page = useUi((u) => u.upgradePage);
  const perks = useGame(perksTab);
  const tabs = perks === 'hidden' ? null : <PageTabs page={page === 'perks' && perks !== 'locked' ? 'perks' : 'upgrades'} perks={perks} />;
  const close = () => {
    audio.tap();
    const ui = useUi.getState();
    ui.setTab(ui.prevTab === 'upgrades' ? 'alley' : ui.prevTab);
  };
  if (page === 'perks' && (perks === 'open' || perks === 'intro')) return <PerksPage tabs={tabs} onClose={close} />;
  return <HexMapPage tabs={tabs} onClose={close} />;
}

/* ---------------------------------------------------------------- the map page */

function HexMapPage({ tabs, onClose }: { tabs: ReactNode; onClose: () => void }) {
  const upgrades = useGame((g) => g.upgrades);
  const coins = useGame((g) => g.currencies.coins);
  const rebirths = useGame((g) => g.rebirths);
  const calm = useGame((g) => g.settings.reduceMotion);
  const shownCoins = useCountUp(coins);
  const atk = useGame((g) => computeStats(g).ATK);
  const def = useGame((g) => computeStats(g).DEF);
  const sel = useUi((u) => u.upgradeSel);

  // What every hex shows right now.
  const hexes = useMemo(() => {
    const st = { upgrades, rebirths };
    const out: { node: HexNode; view: HexView; price: number }[] = [];
    for (const n of DATA.upgradeMap) {
      const view = hexView(st, n);
      if (view) out.push({ node: n, view, price: view === 'open' ? upgradePrice(st, upgradeDef(n.id)!) : 0 });
    }
    return out;
  }, [upgrades, rebirths]);
  const shown = useMemo(() => new Map(hexes.map((h) => [h.node.key, h.view])), [hexes]);

  // If the selection is hidden (a fresh map after a rebirth), pick the cheapest open hex.
  useEffect(() => {
    if (shown.has(sel)) return;
    const open = hexes.filter((h) => h.view === 'open').sort((a, b) => a.price - b.price)[0];
    if (open) useUi.setState({ upgradeSel: open.node.key });
  }, [shown, sel, hexes]);

  const bounds = useMemo(() => {
    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;
    for (const h of hexes) {
      minX = Math.min(minX, nodeX(h.node));
      maxX = Math.max(maxX, nodeX(h.node));
      minY = Math.min(minY, nodeY(h.node));
      maxY = Math.max(maxY, nodeY(h.node));
    }
    return { minX: minX - R, maxX: maxX + R, minY: minY - R, maxY: maxY + R };
  }, [hexes]);

  /* ----- pan and zoom (applied straight to the DOM; React re-renders only when the game changes) */
  const contentRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>(useUi.getState().mapView ?? { x: focusPoint().x, y: focusPoint().y, k: homeZoom() });
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const animRef = useRef(0);
  const openedAt = useRef(performance.now());
  const introDone = performance.now() - openedAt.current > 700;

  const clamp = (v: View) => {
    const b = boundsRef.current;
    v.k = Math.min(K_MAX, Math.max(K_MIN, v.k));
    v.x = Math.min(focusPoint().x - b.minX * v.k, Math.max(focusPoint().x - b.maxX * v.k, v.x));
    v.y = Math.min(focusPoint().y - b.minY * v.k, Math.max(focusPoint().y - b.maxY * v.k, v.y));
  };
  const iconsRef = useRef<HTMLDivElement>(null);
  const iconsK = useRef(-1);
  const gridRef = useRef<HTMLDivElement>(null);
  const apply = () => {
    const v = viewRef.current;
    clamp(v);
    if (contentRef.current) contentRef.current.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.k})`;
    // The honeycomb behind: the map's tile, scaled with it, its origin on the map's (0, 0).
    const grid = gridRef.current;
    if (grid) {
      grid.style.backgroundSize = `${3 * R * v.k}px ${2 * HH * v.k}px`;
      grid.style.backgroundPosition = `${v.x}px ${v.y}px`;
    }
    // The icons only move, by whole px; on a zoom each one moves to its hex's new spot.
    const layer = iconsRef.current;
    if (!layer) return;
    layer.style.transform = `translate3d(${Math.round(v.x)}px, ${Math.round(v.y)}px, 0)`;
    if (v.k === iconsK.current) return;
    iconsK.current = v.k;
    const zoom = zoomOf(v.k);
    layer.dataset.zoom = zoom;
    if (contentRef.current) contentRef.current.dataset.zoom = zoom;
    for (const el of Array.from(layer.children) as HTMLElement[]) {
      const n = BY_KEY.get(el.dataset.node ?? '');
      if (n) el.style.transform = iconSpot(n, el.dataset.view as HexView, v.k);
    }
  };
  const save = () => useUi.setState({ mapView: { ...viewRef.current } });
  const stopAnim = () => {
    cancelAnimationFrame(animRef.current);
    animRef.current = 0;
  };
  /** Glides the view so map point (mx, my) sits at the focus point. */
  const glideTo = (mx: number, my: number, k = viewRef.current.k) => {
    stopAnim();
    const from = { ...viewRef.current };
    const to = { x: focusPoint().x - mx * k, y: focusPoint().y - my * k, k };
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 420);
      const e = 1 - Math.pow(1 - p, 3);
      viewRef.current = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, k: from.k + (to.k - from.k) * e };
      apply();
      if (p < 1) animRef.current = requestAnimationFrame(step);
      else save();
    };
    animRef.current = requestAnimationFrame(step);
  };

  useLayoutEffect(apply, [bounds]);
  // New or changed hexes: place their icons for the current zoom.
  useLayoutEffect(() => {
    iconsK.current = -1;
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hexes]);
  useEffect(() => () => stopAnim(), []);

  // Pointer gestures: one finger pans (with a little glide on release), two fingers pinch, a still tap selects.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const pts = new Map<number, { x: number; y: number }>();
    let downKey: string | null = null;
    let start = { x: 0, y: 0 };
    let last = { x: 0, y: 0, t: 0 };
    let vel = { x: 0, y: 0 };
    let moved = false;
    let pinch: { d: number; mid: { x: number; y: number }; v: View } | null = null;

    const glide = () => {
      let prev = performance.now();
      const step = (now: number) => {
        const dt = Math.min(32, now - prev);
        prev = now;
        viewRef.current.x += vel.x * dt;
        viewRef.current.y += vel.y * dt;
        apply();
        const decay = Math.pow(0.9, dt / 16);
        vel = { x: vel.x * decay, y: vel.y * decay };
        if (Math.hypot(vel.x, vel.y) > 0.03) animRef.current = requestAnimationFrame(step);
        else save();
      };
      animRef.current = requestAnimationFrame(step);
    };
    const startPinch = () => {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, v: { ...viewRef.current } };
    };
    const down = (e: PointerEvent) => {
      if ((e.target as Element).closest('[data-ui]')) return;
      stopAnim();
      el.setPointerCapture(e.pointerId);
      const p = stagePoint(e.clientX, e.clientY);
      pts.set(e.pointerId, p);
      if (pts.size === 1) {
        downKey = (e.target as Element).closest('[data-node]')?.getAttribute('data-node') ?? null;
        start = p;
        last = { ...p, t: performance.now() };
        vel = { x: 0, y: 0 };
        moved = false;
        pinch = null;
      } else if (pts.size === 2) {
        moved = true;
        startPinch();
      }
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      const p = stagePoint(e.clientX, e.clientY);
      pts.set(e.pointerId, p);
      if (pts.size >= 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const k = Math.min(K_MAX, Math.max(K_MIN, (pinch.v.k * d) / pinch.d));
        const mx = (pinch.mid.x - pinch.v.x) / pinch.v.k;
        const my = (pinch.mid.y - pinch.v.y) / pinch.v.k;
        viewRef.current = { x: mid.x - mx * k, y: mid.y - my * k, k };
        apply();
        return;
      }
      if (!moved && Math.hypot(p.x - start.x, p.y - start.y) > 10) moved = true;
      if (!moved) return;
      const now = performance.now();
      const dt = Math.max(1, now - last.t);
      viewRef.current.x += p.x - last.x;
      viewRef.current.y += p.y - last.y;
      vel = { x: vel.x * 0.6 + ((p.x - last.x) / dt) * 0.4, y: vel.y * 0.6 + ((p.y - last.y) / dt) * 0.4 };
      last = { ...p, t: now };
      apply();
    };
    const up = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size === 1) {
        // Pinch ended with one finger still down: keep panning from here.
        const p = [...pts.values()][0];
        last = { ...p, t: performance.now() };
        vel = { x: 0, y: 0 };
        pinch = null;
        return;
      }
      if (pts.size > 0) return;
      if (!moved) {
        if (downKey && e.type === 'pointerup') select(downKey);
        return;
      }
      if (e.type === 'pointerup' && performance.now() - last.t < 80 && Math.hypot(vel.x, vel.y) > 0.25) glide();
      else save();
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      stopAnim();
      const p = stagePoint(e.clientX, e.clientY);
      const v = viewRef.current;
      const k = Math.min(K_MAX, Math.max(K_MIN, v.k * Math.exp(-e.deltaY * 0.0015)));
      const mx = (p.x - v.x) / v.k;
      const my = (p.y - v.y) / v.k;
      viewRef.current = { x: p.x - mx * k, y: p.y - my * k, k };
      apply();
      save();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (key: string) => {
    if (!BY_KEY.has(key)) return;
    haptics.impact('light');
    audio.tap();
    useUi.setState({ upgradeSel: key });
  };
  // Whenever the selection moves (a tap, or buying up a line), glide it out from under the header or buy card.
  useEffect(() => {
    const n = BY_KEY.get(sel);
    if (!n) return;
    const v = viewRef.current;
    const sx = v.x + nodeX(n) * v.k;
    const sy = v.y + nodeY(n) * v.k;
    if (sx < 110 || sx > 970 || sy < 300 || sy > 1320) glideTo(nodeX(n), nodeY(n));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const center = () => {
    audio.tap();
    const n = BY_KEY.get(sel) ?? BY_KEY.get(nodeKey(BAL.upgrades[0].id, 1))!;
    glideTo(nodeX(n), nodeY(n), homeZoom());
  };

  const selNode = BY_KEY.get(sel) && shown.has(sel) ? BY_KEY.get(sel)! : undefined;
  const discount = Math.round((1 - Math.pow(1 - BAL.rebirth.upgradeDiscountPer, rebirths)) * 100);
  const links = hexes.filter((h) => h.node.prev && shown.has(h.node.prev));
  /** Room round the hexes for the links' strokes (they run between hex centers, inside the bounds). */
  const pad = 40;

  return (
    <div className={s.overlay} data-calm={calm || undefined}>
      <svg className={s.defs} aria-hidden>
        <defs>
          <linearGradient id="hxOwned" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8be0ff" />
            <stop offset="1" stopColor="#2b86e3" />
          </linearGradient>
          <linearGradient id="hxGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff09a" />
            <stop offset="1" stopColor="#f39c12" />
          </linearGradient>
          <linearGradient id="hxOpen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3d4772" />
            <stop offset="1" stopColor="#1c2140" />
          </linearGradient>
          <linearGradient id="hxMystery" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2c3152" />
            <stop offset="1" stopColor="#181b30" />
          </linearGradient>
        </defs>
      </svg>
      <div className={s.viewport} ref={viewportRef}>
        <div className={s.grid} ref={gridRef} style={{ backgroundImage: GRID_URL }} aria-hidden />
        <div className={s.content} ref={contentRef}>
          <svg
            className={s.links}
            style={{ left: bounds.minX - pad, top: bounds.minY - pad }}
            width={bounds.maxX - bounds.minX + 2 * pad}
            height={bounds.maxY - bounds.minY + 2 * pad}
            viewBox={`${bounds.minX - pad} ${bounds.minY - pad} ${bounds.maxX - bounds.minX + 2 * pad} ${bounds.maxY - bounds.minY + 2 * pad}`}
            aria-hidden
          >
            {links.map(({ node, view }) => {
              const p = BY_KEY.get(node.prev!)!;
              return (
                <g key={node.key} className={s.link} data-view={view}>
                  <line x1={nodeX(p)} y1={nodeY(p)} x2={nodeX(node)} y2={nodeY(node)} className={s.linkEdge} />
                  <line x1={nodeX(p)} y1={nodeY(p)} x2={nodeX(node)} y2={nodeY(node)} className={s.linkFill} />
                </g>
              );
            })}
          </svg>
          {hexes.map(({ node, view, price }) => (
            <Hex
              key={`${node.key}:${view}`}
              node={node}
              view={view}
              price={price}
              afford={view === 'open' && coins >= price}
              selected={node.key === sel}
              fresh={introDone}
              calm={calm}
            />
          ))}
        </div>
        <div className={s.icons} ref={iconsRef}>
          {hexes.map(({ node, view }) =>
            view === 'mystery' ? null : (
              <HexIcon key={`${node.key}:${view}`} node={node} view={view} k={viewRef.current.k} fresh={introDone} calm={calm} />
            ),
          )}
        </div>
      </div>

      <div className={s.head}>
        <div className={s.titles}>
          {tabs ?? <Chunky text={t('upgrades.title')} size={64} grad="blue" />}
          <span className={s.sub}>
            {rebirths > 0 ? t('upgrades.subOff', { pct: discount }) : t('upgrades.sub')}
          </span>
          <span className={s.hint}>{t('upgrades.hint')}</span>
        </div>
        <button className={`btn small blue ${s.centerBtn}`} data-ui onClick={center} aria-label={t('upgrades.center')}>
          <TargetIcon size="md" />
        </button>
      </div>

      <div className={s.foot}>
        {selNode && (
          <div data-ui>
            <BuyCard node={selNode} />
          </div>
        )}
        <div className={s.bar}>
          <span className={s.coins} data-ui>
            <CoinIcon size="md" />
            {formatNumber(shownCoins)}
          </span>
          <button className={`btn red ${s.close}`} data-ui onClick={onClose}>
            {t('upgrades.close')}
          </button>
          <span className={s.barRight} data-ui>
            <span className={s.stat} title={t('strip.atk')}>
              <SwordIcon />
              {formatNumber(atk)}
            </span>
            <span className={s.stat} title={t('strip.def')}>
              <ShieldIcon />
              {formatNumber(def)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
