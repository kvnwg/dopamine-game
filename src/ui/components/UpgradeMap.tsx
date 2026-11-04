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
 * The map is drawn on one screen-sized canvas (hexMapDraw.ts): a page element per hex, hundreds late
 * in the game, ran phones out of graphics memory. Zooming scales the hex shapes, lines and words but
 * never the pixel art: the icons stay 6 px per art pixel at every zoom (and hide zoomed far out).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { drawMap, hexAt, HH, nodeX, nodeY, R, DRAW, wrapName, type DrawHex, type DrawState, type HexView, type View } from './hexMapDraw';
import s from './hexmap.module.css';

/* ---------------------------------------------------------------- geometry */

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
const BY_KEY = new Map(DATA.upgradeMap.map((n) => [n.key, n]));
/** The canvas's pixels at most (about 16 MB): a screen's worth on any phone, a little softer on a 4K monitor. */
const MAX_CANVAS_PX = 4_200_000;
/** Each line's name in lines that fit its hex (measured once). */
const NAME_LINES = new Map<string, string[]>();
const nameLines = (ctx: CanvasRenderingContext2D, id: string): string[] => {
  let lines = NAME_LINES.get(id);
  if (!lines) {
    lines = wrapName(ctx, t(`upgrade.${id}`));
    // (Measured in the fallback font until the pixel font is in: measure again then.)
    if (document.fonts?.status === 'loaded') NAME_LINES.set(id, lines);
  }
  return lines;
};

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

export function nodeName(n: HexNode): string {
  const name = t(`upgrade.${n.id}`);
  return upgradeDef(n.id)!.max > 1 ? t('upgrades.nodeName', { name, tier: roman(n.tier) }) : name;
}

/* ---------------------------------------------------------------- state */

export type { HexView } from './hexMapDraw';

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

  /* ----- the canvas (hexMapDraw.ts): the view lives in a ref, and drawing reads refs, never React */
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<View>(useUi.getState().mapView ?? { x: focusPoint().x, y: focusPoint().y, k: homeZoom() });
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const animRef = useRef(0);
  const openedAt = useRef(performance.now());
  const drawRef = useRef<DrawState>({ hexes: [], links: [], sel, calm, openedAt: openedAt.current, fresh: new Map() });
  const views = useRef<Map<string, HexView> | null>(null);
  const frame = useRef(0);
  const lastDraw = useRef(0);
  const urgent = useRef(true);
  const loop = (now: number) => {
    frame.current = 0;
    // A glow breathing alone draws about 30 times a second; a pan, zoom or change draws at once.
    if (!urgent.current && now - lastDraw.current < 30) {
      frame.current = requestAnimationFrame(loop);
      return;
    }
    urgent.current = false;
    lastDraw.current = now;
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !c.offsetWidth) return;
    const moving = drawMap(ctx, c.width, c.height, c.width / c.offsetWidth, c.offsetWidth, c.offsetHeight, viewRef.current, drawRef.current, now, requestDraw);
    if (moving) frame.current = requestAnimationFrame(loop);
  };
  function requestDraw() {
    urgent.current = true;
    if (!frame.current) frame.current = requestAnimationFrame(loop);
  }
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // The canvas has one pixel per screen pixel (capped), whatever the stage's scale.
  useLayoutEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const fit = () => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      let w = Math.max(1, Math.round(r.width * dpr));
      let h = Math.max(1, Math.round(r.height * dpr));
      const cap = Math.sqrt(MAX_CANVAS_PX / (w * h));
      if (cap < 1) {
        w = Math.round(w * cap);
        h = Math.round(h * cap);
      }
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      requestDraw();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    window.addEventListener('resize', fit);
    void document.fonts?.ready.then(requestDraw);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // What the canvas shows, kept current after every render: hexes with their words, links, the
  // selection; hexes bought or revealed after the map opened flash or blink in.
  useLayoutEffect(() => {
    const now = performance.now();
    const st = drawRef.current;
    const prev = views.current;
    if (prev && now - openedAt.current > 700) {
      for (const h of hexes) if (prev.get(h.node.key) !== h.view) st.fresh.set(h.node.key, now);
    }
    for (const [key, at] of st.fresh) if (now - at > 1000) st.fresh.delete(key);
    views.current = new Map(hexes.map((h) => [h.node.key, h.view]));
    const ctx = canvasRef.current?.getContext('2d');
    drawRef.current = {
      ...st,
      sel,
      calm,
      hexes: hexes.map((h): DrawHex => {
        const def = upgradeDef(h.node.id)!;
        return {
          node: h.node,
          view: h.view,
          afford: h.view === 'open' && coins >= h.price,
          tier: def.max > 1 ? roman(h.node.tier) : null,
          name: h.view === 'owned' && ctx ? nameLines(ctx, h.node.id) : [],
          price: h.view === 'open' ? formatNumber(h.price) : '',
          icon: uiIcon(iconOf(h.node.id), 'md'),
        };
      }),
      links: hexes.filter((h) => h.node.prev && shown.has(h.node.prev)).map((h) => [BY_KEY.get(h.node.prev!)!, h.node, h.view]),
    };
    requestDraw();
  });

  const clamp = (v: View) => {
    const b = boundsRef.current;
    v.k = Math.min(K_MAX, Math.max(K_MIN, v.k));
    v.x = Math.min(focusPoint().x - b.minX * v.k, Math.max(focusPoint().x - b.maxX * v.k, v.x));
    v.y = Math.min(focusPoint().y - b.minY * v.k, Math.max(focusPoint().y - b.maxY * v.k, v.y));
  };
  const gridRef = useRef<HTMLDivElement>(null);
  const apply = () => {
    const v = viewRef.current;
    clamp(v);
    // The honeycomb behind: the map's tile, scaled with it, its origin on the map's (0, 0).
    const grid = gridRef.current;
    if (grid) {
      grid.style.backgroundSize = `${3 * R * v.k}px ${2 * HH * v.k}px`;
      grid.style.backgroundPosition = `${v.x}px ${v.y}px`;
    }
    requestDraw();
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
        const v = viewRef.current;
        downKey = hexAt(drawRef.current.hexes, (p.x - v.x) / v.k, (p.y - v.y) / v.k)?.node.key ?? null;
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
    // The open part of the map: under the header, above the buy card (phone), or left of the side panel (PC).
    const [x0, x1, y0, y1] = useUi.getState().wide ? [110, 1450, 230, 880] : [110, 970, 300, 1320];
    if (sx < x0 || sx > x1 || sy < y0 || sy > y1) glideTo(nodeX(n), nodeY(n));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const center = () => {
    audio.tap();
    const n = BY_KEY.get(sel) ?? BY_KEY.get(nodeKey(BAL.upgrades[0].id, 1))!;
    glideTo(nodeX(n), nodeY(n), homeZoom());
  };

  const selNode = BY_KEY.get(sel) && shown.has(sel) ? BY_KEY.get(sel)! : undefined;
  const discount = Math.round((1 - Math.pow(1 - BAL.rebirth.upgradeDiscountPer, rebirths)) * 100);

  return (
    <div className={s.overlay} data-calm={calm || undefined}>
      <div className={s.viewport} ref={viewportRef}>
        <div className={s.grid} ref={gridRef} style={{ backgroundImage: GRID_URL }} aria-hidden />
        <canvas ref={canvasRef} className={s.canvas} aria-hidden />
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
