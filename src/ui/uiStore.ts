/** UI-only state (tabs, animations, popups, toasts). Never saved; GameState stays the single source of truth. */
import { create } from 'zustand';
import type { HaulSize, Item, RollDrama, RollPlacement } from '../core';
import type { AdPlacement } from '../services';

/**
 * The stage in stage px: tall on phones (the battle over the menus), wide on PC screens (the battle on
 * the left, the menus and tabs on the right). App.tsx picks one from the screen's shape.
 */
export const STAGE_TALL = { w: 1080, h: 1920 } as const;
export const STAGE_WIDE = { w: 2160, h: 960 } as const;

/** A luck token flying from its reel into the battle's luck row (TokenFlight.tsx). */
export interface TokenFlightState {
  id: number;
  /** The token's key (tokenFx.ts tokenKey): the battle shows it in its row when the flight lands. */
  key: string;
  /** The token's multiplier (its picture). */
  x: number;
  reel: number;
  row: number;
  step: number;
}

export type PopupKind = 'settings' | 'codex' | 'odds' | 'upgrade' | 'itemDetail' | 'luck' | 'world' | 'scrapAll' | 'save' | 'admin';
export type Tab = 'alley' | 'heist' | 'bag' | 'upgrades' | 'rebirth' | 'worlds';

export interface RollView {
  id: number;
  item: Item;
  odds: number;
  lucky: boolean;
  golden: boolean;
  placed: RollPlacement;
  newRecord: boolean;
  at: number;
  /** "1 in X" for this tier or better at the raccoon's luck when it was rolled (luckOddsOneIn). */
  luckOdds: number;
  /** How big a deal it is for that luck: null for an everyday roll. */
  drama: RollDrama | null;
  /** Luck tokens its reel landed on first, multiplied (1 without any). */
  mult: number;
  /** The tutorial scripted it: the very first roll, or beginner's luck (shown as such). */
  scripted?: 'first' | 'beginner';
}

/** An item being dragged toward the raccoon (stage coordinates). */
export interface DragState {
  item: Item;
  x: number;
  y: number;
  /** Over a drop target (the raccoon or a gear panel). */
  over: boolean;
}


export interface Toast {
  id: number;
  text: string;
  tone: 'good' | 'info' | 'warn';
}

export interface UiState {
  tab: Tab;
  popup: PopupKind | null;
  /** Item uid (bag or equipped) for the detail popup, or the world number for the world popup. */
  detailUid: number | null;
  lastRoll: RollView | null;
  /** Big reveal overlay for rare rolls. */
  celebrate: RollView | null;
  /** His power is counting up in the middle of the screen after an equip (EquipFlight). */
  powerShow: boolean;
  /** Building up to a big reveal (dumpster shakes and glows). */
  charging: RollView | null;
  rebirthFx: number | null;
  toasts: Toast[];
  adPlaying: AdPlacement | null;
  equipPulse: { slot: string; id: number } | null;
  newCodexKeys: string[];
  drag: DragState | null;
  /** Selected hex on the upgrade map (`${line id}:${tier}`). */
  upgradeSel: string;
  /** The wide stage (PC screens, App.tsx): the battle on the left, the menus on the right. */
  wide: boolean;
  /** Which page of the Upgrades screen shows: the upgrade map, or the Perks page (Alley perks, from the second rebirth). */
  upgradePage: 'upgrades' | 'perks';
  /** The perk selected on the Perks page (its id), or '' for the first one open. */
  perkSel: string;
  /** The tab to go back to when the full-screen upgrade map closes. */
  prevTab: Tab;
  /** Where the upgrade map was panned and zoomed to (kept while the app runs). */
  mapView: { x: number; y: number; k: number } | null;
  /** The dev cheat panel is open (playtest builds; opened from Settings). */
  devOpen: boolean;
  /** A full-screen moment covers the whole stage (App.tsx): the battle stops drawing (BattlePanel.tsx). */
  blackout: boolean;
  /** A big Scrap All haul being celebrated. */
  /** `usual`: what a usual haul of the run is worth now (null for the game's first haul). */
  haul: { id: number; coins: number; usual: number | null; count: number; size: HaulSize } | null;
  /** Bumped when coins land on the gold counter (it pulses). */
  goldPulse: number;
  /**
   * The last boss win, for the "again or next?" card (first clears list their rewards, and a world
   * beaten for the first time this run with perks open its Half-Eaten Bread Loaves).
   */
  afterBoss: { world: number; firstTime: boolean; gems: number; loaves?: number } | null;
  /** Items the last rebirth unlocked (shown after the rebirth burst). */
  unlocked: { count: number; ids: string[] } | null;
  /**
   * Luck tokens on their way from the reel they landed on (`reel`) into their place in the battle's
   * luck row at the top (`row`, the `step`-th token in it), on any tab (TokenFlight, tokenFx.ts).
   */
  tokenFlights: TokenFlightState[];
  setTab: (t: Tab) => void;
  openPopup: (p: PopupKind | null, detailUid?: number) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
}

let toastId = 1;

export const useUi = create<UiState>((set) => ({
  tab: 'alley',
  popup: null,
  detailUid: null,
  lastRoll: null,
  celebrate: null,
  powerShow: false,
  charging: null,
  rebirthFx: null,
  toasts: [],
  adPlaying: null,
  equipPulse: null,
  newCodexKeys: [],
  drag: null,
  upgradeSel: 'luck:1',
  wide: false,
  upgradePage: 'upgrades',
  perkSel: '',
  prevTab: 'alley',
  mapView: null,
  blackout: false,
  haul: null,
  goldPulse: 0,
  afterBoss: null,
  unlocked: null,
  tokenFlights: [],
  devOpen: false,
  setTab: (tab) => set((s) => (tab === 'upgrades' && s.tab !== 'upgrades' ? { tab, prevTab: s.tab } : { tab })),
  openPopup: (p, detailUid) => set({ popup: p, detailUid: detailUid ?? null }),
  toast: (text, tone = 'info') => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }));
    // Up long enough to read (Kevin: things "moved too fast"): 3.5 s, more for a long one.
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), Math.max(3500, 1400 + text.length * 55));
  },
}));

/** The stage's size right now (stage px). */
export function stageSize(): { w: number; h: number } {
  return useUi.getState().wide ? STAGE_WIDE : STAGE_TALL;
}
