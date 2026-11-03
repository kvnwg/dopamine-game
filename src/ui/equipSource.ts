/**
 * Where an equipped item was on screen when it was put on, so its flight (EquipFlight) starts there:
 * the tile in the bag, the item popup, the last-roll card, or under your finger at the end of a drag.
 * Item tiles carry `data-uid`; a drag notes the dragged copy's spot just before it equips.
 */
import type { ArtScale } from '../render/icons';
import { stagePoint } from './drag';

export interface EquipSource {
  /** The art's middle, in stage px. */
  x: number;
  y: number;
  /** The art's resolution there (1: 96 px, 2: Scale2x, 3: Scale3x). */
  scale: ArtScale;
}

const noted = new Map<number, EquipSource & { at: number }>();

function fromImg(img: HTMLElement): EquipSource | null {
  const r = img.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  const p = stagePoint(r.left + r.width / 2, r.top + r.height / 2);
  const px = Number(img.dataset.px ?? 1);
  return { x: p.x, y: p.y, scale: (px >= 3 ? 3 : px >= 2 ? 2 : 1) as ArtScale };
}

/** Remembers where item `uid` is right now (call just before equipping it, e.g. at the end of a drag). */
export function noteEquipSource(uid: number, el: Element | null): void {
  const img = (el?.matches('img') ? el : el?.querySelector('img')) as HTMLElement | null;
  const src = img ? fromImg(img) : null;
  if (src) noted.set(uid, { ...src, at: performance.now() });
}

/**
 * Where item `uid` is on screen: a spot noted in the last moment, else the biggest of its tiles that
 * can be seen (not scrolled away, not under a popup), else null.
 */
export function equipSourceOf(uid: number): EquipSource | null {
  const n = noted.get(uid);
  noted.delete(uid);
  if (n && performance.now() - n.at < 1500) return n;
  let best: EquipSource | null = null;
  let bestArea = 0;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(`[data-uid="${uid}"]`))) {
    const img = el.querySelector('img');
    if (!img) continue;
    const r = img.getBoundingClientRect();
    if (r.width < 2) continue;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    // Seen: the topmost thing at its middle is (inside) the tile itself.
    const top = document.elementFromPoint(cx, cy);
    if (!top || !el.contains(top)) continue;
    const area = r.width * r.height;
    if (area <= bestArea) continue;
    const src = fromImg(img);
    if (src) {
      best = src;
      bestArea = area;
    }
  }
  return best;
}
