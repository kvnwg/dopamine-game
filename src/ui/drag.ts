/**
 * Drag-to-equip. Items are equipped only by dragging them onto the raccoon (the battle area) or
 * onto a gear panel (`data-drop="equip"`). Mouse: press and move. Touch: press and hold briefly to
 * pick the item up, so ordinary swipes still scroll the bag. A press without a drag is a tap.
 */
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { Item } from '../core';
import { dispatch } from '../app/store';
import { haptics } from '../services';
import { audio } from '../services/audio';
import { useUi } from './uiStore';

const STAGE_W = 1080;
const HOLD_MS = 170;
const MOVE_PX = 8;

/**
 * True while a touch drag is in progress. The blocking touchmove listener must exist before the
 * finger goes down (browsers decide at touchstart whether a gesture can be cancelled), so it is
 * registered once here instead of per press.
 */
let touchDragging = false;
if (typeof window !== 'undefined') {
  window.addEventListener(
    'touchmove',
    (ev) => {
      if (touchDragging && ev.cancelable) ev.preventDefault();
    },
    { passive: false },
  );
}

/** Client (screen) coordinates to the 1080-wide stage's own coordinates. */
export function stagePoint(clientX: number, clientY: number): { x: number; y: number } {
  const stage = document.querySelector('[data-stage]') as HTMLElement | null;
  if (!stage) return { x: clientX, y: clientY };
  const r = stage.getBoundingClientRect();
  const k = r.width / STAGE_W || 1;
  return { x: (clientX - r.left) / k, y: (clientY - r.top) / k };
}

function overDropTarget(clientX: number, clientY: number): boolean {
  const el = document.elementFromPoint(clientX, clientY);
  return !!el?.closest('[data-drop="equip"]');
}

interface Press {
  pid: number;
  sx: number;
  sy: number;
  touch: boolean;
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
    const press: Press = { pid: e.pointerId, sx: e.clientX, sy: e.clientY, touch: e.pointerType !== 'mouse', dragging: false, moved: false, timer: null };
    ref.current = press;
    const startDrag = (cx: number, cy: number) => {
      press.dragging = true;
      if (press.touch) touchDragging = true;
      const p = stagePoint(cx, cy);
      useUi.setState({ drag: { item, x: p.x, y: p.y, over: overDropTarget(cx, cy) } });
      haptics.impact('light');
      audio.tap();
    };
    const cleanup = () => {
      if (press.timer !== null) clearTimeout(press.timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      if (press.dragging) touchDragging = false;
      if (ref.current === press) ref.current = null;
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== press.pid) return;
      if (!press.dragging) {
        if (Math.hypot(ev.clientX - press.sx, ev.clientY - press.sy) > MOVE_PX) {
          press.moved = true;
          if (press.touch) {
            cleanup(); // a swipe: let it scroll
            return;
          }
          startDrag(ev.clientX, ev.clientY);
        }
        return;
      }
      const p = stagePoint(ev.clientX, ev.clientY);
      useUi.setState({ drag: { item, x: p.x, y: p.y, over: overDropTarget(ev.clientX, ev.clientY) } });
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== press.pid) return;
      const dragged = press.dragging;
      const moved = press.moved;
      cleanup();
      if (dragged) {
        const over = overDropTarget(ev.clientX, ev.clientY);
        useUi.setState({ drag: null });
        if (over) {
          haptics.impact('medium');
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
