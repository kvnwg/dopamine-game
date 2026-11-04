/** UI-only state (tabs, animations, popups, toasts). Never saved; GameState stays the single source of truth. */
import { create } from 'zustand';
import type { HaulSize, Item, RollDrama, RollPlacement } from '../core';
import type { AdPlacement } from '../services';

export type PopupKind = 'settings' | 'codex' | 'odds' | 'upgrade' | 'itemDetail' | 'luck' | 'world';
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

interface UiState {
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
  /** A big Scrap All haul being celebrated. */
  haul: { id: number; coins: number; minutes: number; count: number; size: HaulSize } | null;
  /** Bumped when coins land on the gold counter (it pulses). */
  goldPulse: number;
  /**
   * The last boss win, for the "again or next?" card (first clears list their rewards, and a world
   * beaten for the first time this run with perks open its Half-Eaten Bread Loaves).
   */
  afterBoss: { world: number; firstTime: boolean; gems: number; loaves?: number } | null;
  /** Items the last rebirth unlocked (shown after the rebirth burst). */
  unlocked: { count: number; ids: string[] } | null;
  /** A luck token just landed on a reel: it slams onto the screen, on any tab (TokenSlam, tokenFx.ts). */
  tokenSlam: { id: number; x: number; total: number } | null;
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
  upgradePage: 'upgrades',
  perkSel: '',
  prevTab: 'alley',
  mapView: null,
  haul: null,
  goldPulse: 0,
  afterBoss: null,
  unlocked: null,
  tokenSlam: null,
  devOpen: false,
  setTab: (tab) => set((s) => (tab === 'upgrades' && s.tab !== 'upgrades' ? { tab, prevTab: s.tab } : { tab })),
  openPopup: (p, detailUid) => set({ popup: p, detailUid: detailUid ?? null }),
  toast: (text, tone = 'info') => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 2400);
  },
}));
