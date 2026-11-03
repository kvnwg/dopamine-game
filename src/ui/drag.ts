/**
 * Drag-to-equip. An item is equipped when it is dragged up toward the top of the screen: dropped
 * anywhere above the menus (the battle view or just under it), onto a gear panel
 * (`data-drop="equip"`), or after a clear upward drag from wherever it started. Mouse: press and
 * move. Touch: press and hold briefly to pick the item up, so ordinary swipes still scroll the bag.
 * A press without a drag is a tap.
 */
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { Item } from '../core';
import { dispatch } from '../app/store';
import { haptics } from '../services';
import { audio } from '../services/audio';
import { useUi } from './uiStore';
import { P } from '../render/pixel';
import { FEET_ROW, VIEW } from '../render/pixel/sceneryTypes';

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

/** Whether letting go here equips: above the menus, over a gear panel, or well up from the start. */
function wouldEquip(startX: number, startY: number, clientX: number, clientY: number): boolean {
  if (overDropTarget(clientX, clientY)) return true;
  const p = stagePoint(clientX, clientY);
  return p.y < UPPER_Y || stagePoint(startX, startY).y - p.y > LIFT_PX;
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
      useUi.setState({ drag: { item, x: p.x, y: p.y, over: wouldEquip(press.sx, press.sy, cx, cy) } });
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
