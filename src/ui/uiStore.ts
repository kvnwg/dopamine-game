/** UI-only state (animations, popups, toasts). Never saved; GameState stays the single source of truth. */
import { create } from 'zustand';
import type { Item } from '../core';
import type { AdPlacement } from '../services';

export type PopupKind = 'settings' | 'codex' | 'odds' | 'upgrade' | 'filters' | 'itemDetail';

export interface Flip {
  id: number;
  item: Item;
  full: boolean;
  tease: boolean;
  startedAt: number;
  /** Time (ms after start) at which the lid pops and the item is revealed. */
  popAt: number;
  /** Total length including the reveal celebration. */
  endAt: number;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'good' | 'info' | 'warn';
}

interface UiState {
  popup: PopupKind | null;
  detailSlot: string | null;
  flip: Flip | null;
  /** Uid of the pending item whose compare card may be shown (after its reveal finished). */
  revealedUid: number | null;
  /** Big celebration overlay (Epic+) for the most recent reveal. */
  celebrate: { id: number; item: Item } | null;
  lastItem: Item | null;
  toasts: Toast[];
  adPlaying: AdPlacement | null;
  equipPulse: { slot: string; id: number } | null;
  /** Codex keys found for the first time this session (for the NEW! stamp). */
  newCodexKeys: string[];
  openPopup: (p: PopupKind | null, detailSlot?: string) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
}

let toastId = 1;

export const useUi = create<UiState>((set) => ({
  popup: null,
  detailSlot: null,
  flip: null,
  revealedUid: null,
  celebrate: null,
  lastItem: null,
  toasts: [],
  adPlaying: null,
  equipPulse: null,
  newCodexKeys: [],
  openPopup: (p, detailSlot) => set({ popup: p, detailSlot: detailSlot ?? null }),
  toast: (text, tone = 'info') => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 2600);
  },
}));
