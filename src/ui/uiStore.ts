/** UI-only state (tabs, animations, popups, toasts). Never saved; GameState stays the single source of truth. */
import { create } from 'zustand';
import type { Item, RollPlacement } from '../core';
import type { AdPlacement } from '../services';

export type PopupKind = 'settings' | 'codex' | 'odds' | 'upgrade' | 'itemDetail' | 'luck' | 'world';
export type Tab = 'alley' | 'bag' | 'upgrades' | 'rebirth' | 'worlds';

export interface RollView {
  id: number;
  item: Item;
  odds: number;
  lucky: boolean;
  placed: RollPlacement;
  newRecord: boolean;
  at: number;
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
  recent: RollView[];
  /** Big reveal overlay for rare rolls. */
  celebrate: RollView | null;
  /** Building up to a big reveal (dumpster shakes and glows). */
  charging: RollView | null;
  rebirthFx: number | null;
  toasts: Toast[];
  adPlaying: AdPlacement | null;
  equipPulse: { slot: string; id: number } | null;
  newCodexKeys: string[];
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
  recent: [],
  celebrate: null,
  charging: null,
  rebirthFx: null,
  toasts: [],
  adPlaying: null,
  equipPulse: null,
  newCodexKeys: [],
  setTab: (tab) => set({ tab }),
  openPopup: (p, detailUid) => set({ popup: p, detailUid: detailUid ?? null }),
  toast: (text, tone = 'info') => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 2400);
  },
}));
