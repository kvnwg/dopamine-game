/**
 * Drag-to-equip. An item is equipped when it is dragged up toward the top of the screen: dropped
 * anywhere above the menus (the battle view or just under it), onto a gear panel
 * (`data-drop="equip"`), or after a clear upward drag from wherever it started. Mouse: press and
 * move. Touch: the same where nothing scrolls (the Roll tab's last roll, a bag that fits on screen);
 * in a bag long enough to scroll, press and hold briefly to pick the item up, so ordinary swipes
 * still scroll it. A press without a drag is a tap.
 */
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { Item } from '../core';
import { dispatch } from '../app/store';
import { haptics } from '../services';
import { audio } from '../services/audio';
import { useUi } from './uiStore';
import { P } from '../render/pixel';
import { FEET_ROW, VIEW } from '../render/pixel/sceneryTypes';
import { noteEquipSource } from './equipSource';

const STAGE_W = 1080;
const HOLD_MS = 170;
const MOVE_PX = 8;
/**
 * Dropping above this stage row equips: the battle view (960 px, src/render/BattleScene.ts BATTLE_H)
 * and a strip of the panel under it, so a drop just short of the raccoon still counts. The strip ends
 * 37 art pixels (222 px) under the ground line the raccoon stands on (y 828): 1050.
 */
const UPPER_Y = Math.max(VIEW.h * P, (FEET_ROW + 1 + 37) * P);
/** An upward drag this long (stage px) equips wherever it ends. */
const LIFT_PX = 180;

/**
 * The touch press under way, if any. While it drags (or presses where nothing scrolls) its finger's
 * moves must not scroll the page: the blocking touchmove listener must exist before the finger goes
 * down (browsers decide at touchstart whether a gesture can be cancelled), so it is registered once
 * here instead of per press.
 */
let touchPress: Press | null = null;
function blockTouch(ev: Event): void {
  if (touchPress && (touchPress.dragging || touchPress.free) && ev.cancelable) ev.preventDefault();
}
if (typeof window !== 'undefined') window.addEventListener('touchmove', blockTouch, { passive: false });

/** The nearest ancestor that can scroll up and down right now (a bag with more than fits), or null. */
function scrollerOf(el: Element): Element | null {
  for (let e = el.parentElement; e; e = e.parentElement) {
    const oy = getComputedStyle(e).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && e.scrollHeight > e.clientHeight + 1) return e;
  }
  return null;
}

/** Client (screen) coordinates to the 1080-wide stage's own coordinates. */
export function stagePoint(clientX: number, clientY: number): { x: number; y: number } {
  const stage = document.querySelector('[data-stage]') as HTMLElement | null;
  if (!stage) return { x: clientX, y: clientY };
  const r = stage.getBoundingClientRect();
  const k = r.width / (stage.offsetWidth || STAGE_W) || 1;
  return { x: (clientX - r.left) / k, y: (clientY - r.top) / k };
}

function overDropTarget(clientX: number, clientY: number): boolean {
  const el = document.elementFromPoint(clientX, clientY);
  return !!el?.closest('[data-drop="equip"]');
}

/** Whether letting go here equips: above the menus, over a gear panel, or well up from the start. */
function wouldEquip(startX: number, startY: number, clientX: number, clientY: number): boolean {
  if (overDropTarget(clientX, clientY)) return true;
  const p = stagePoint(clientX, clientY);
  // The wide stage (PC): the raccoon is to the left of the menus, so over the battle (left half) equips.
  if (document.querySelector('[data-stage][data-layout="wide"]')) return p.x < STAGE_W || stagePoint(startX, startY).x - p.x > LIFT_PX;
  return p.y < UPPER_Y || stagePoint(startX, startY).y - p.y > LIFT_PX;
}

interface Press {
  pid: number;
  sx: number;
  sy: number;
  touch: boolean;
  /** Nothing to scroll here: a touch drag starts on the first move, as with a mouse. */
  free: boolean;
  dragging: boolean;
  moved: boolean;
  timer: number | null;
}

/** Pointer handlers that make an item tile draggable onto the raccoon; `onTap` runs on a plain tap. */
export function useItemDrag(item: Item | null, onTap?: () => void) {
  const ref = useRef<Press | null>(null);
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button > 0) return;
    if (!item) {
      onTap?.();
      return;
    }
    const touch = e.pointerType !== 'mouse';
    const press: Press = {
      pid: e.pointerId, sx: e.clientX, sy: e.clientY, touch, free: touch && !scrollerOf(e.currentTarget), dragging: false, moved: false, timer: null,
    };
    ref.current = press;
    // A touch's moves keep going to the element it started on even once that is gone from the page (the
    // Roll tab's card is redrawn when the next roll lands), out of the window listener's reach: block
    // them there too, or the browser takes the gesture for a scroll and cancels the drag.
    const target = e.target as Element;
    if (touch) {
      touchPress = press;
      target.addEventListener('touchmove', blockTouch, { passive: false });
    }
    const startDrag = (cx: number, cy: number) => {
      press.dragging = true;
      const p = stagePoint(cx, cy);
      useUi.setState({ drag: { item, x: p.x, y: p.y, over: wouldEquip(press.sx, press.sy, cx, cy) } });
      haptics.impact('light');
      audio.tap();
    };
    const cleanup = () => {
      if (press.timer !== null) clearTimeout(press.timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      target.removeEventListener('touchmove', blockTouch);
      if (touchPress === press) touchPress = null;
      if (ref.current === press) ref.current = null;
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== press.pid) return;
      if (!press.dragging) {
        if (Math.hypot(ev.clientX - press.sx, ev.clientY - press.sy) > MOVE_PX) {
          press.moved = true;
          if (press.touch && !press.free) {
            cleanup(); // a swipe: let it scroll
            return;
          }
          startDrag(ev.clientX, ev.clientY);
        }
        return;
      }
      const p = stagePoint(ev.clientX, ev.clientY);
      useUi.setState({ drag: { item, x: p.x, y: p.y, over: wouldEquip(press.sx, press.sy, ev.clientX, ev.clientY) } });
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== press.pid) return;
      const dragged = press.dragging;
      const moved = press.moved;
      cleanup();
      if (dragged) {
        const over = wouldEquip(press.sx, press.sy, ev.clientX, ev.clientY);
        useUi.setState({ drag: null });
        if (over) {
          haptics.impact('medium');
          // The item leaps from under the finger (EquipFlight): note where the dragged copy is.
          noteEquipSource(item.uid, document.querySelector('[data-drag-ghost]'));
          dispatch({ type: 'equipItem', uid: item.uid });
        }
      } else if (!moved) {
        onTap?.();
      }
    };
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId !== press.pid) return;
      cleanup();
      useUi.setState({ drag: null });
    };
    if (press.touch) {
      press.timer = window.setTimeout(() => {
        if (ref.current === press && !press.moved) startDrag(press.sx, press.sy);
      }, HOLD_MS);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };
  return { onPointerDown, onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault() };
}
