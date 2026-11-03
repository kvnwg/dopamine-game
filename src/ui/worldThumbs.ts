/**
 * World previews for the Worlds tab and the world popup, at the UI's one pixel size: a band of the
 * world's backdrop as the battle draws it (composeWorld, one image pixel per art pixel), shown at 9
 * stage px per art pixel like everything else. Each preview frames the busiest stretch of its band
 * (the house, the barn, the trees). They are made in the background, one world per task, since
 * composing a backdrop takes a few tens of milliseconds.
 */
import { useEffect, useState } from 'react';
import { crop, type PixelBuf } from '../render/pixel/buf';
import { pixelUrl } from '../render/pixel';
import { SCENE_Y } from '../render/pixel/sceneryTypes';
import { composeWorld } from '../render/worldLook';
import type { Art } from '../render/icons';

export type ThumbKind = 'card' | 'popup';

/** Preview size in art pixels, and the band's top in scene rows (roofs down to the yards). */
const SIZE: Record<ThumbKind, { w: number; h: number; y: number }> = {
  card: { w: 54, h: 26, y: 26 },
  popup: { w: 90, h: 30, y: 24 },
};

const composed = new Map<number, PixelBuf>();
const made = new Map<string, Art>();

/** The left edge of the `w`-wide window with the most detail (color changes) in rows y0..y0+h. */
function busiestX(b: PixelBuf, y0: number, w: number, h: number): number {
  const edges = new Array<number>(b.w).fill(0);
  for (let y = y0; y < y0 + h; y++) {
    for (let x = 1; x < b.w; x++) {
      const i = (y * b.w + x) * 4;
      const j = i - 4;
      if (b.px[i] !== b.px[j] || b.px[i + 1] !== b.px[j + 1] || b.px[i + 2] !== b.px[j + 2]) edges[x]++;
    }
  }
  let best = Math.floor((b.w - w) / 2);
  let bestScore = -1;
  let score = 0;
  for (let x = 0; x < w; x++) score += edges[x];
  for (let x0 = 0; x0 + w <= b.w; x0++) {
    if (x0 > 0) score += edges[x0 + w - 1] - edges[x0 - 1];
    // Ties go to the window nearest the middle.
    if (score > bestScore || (score === bestScore && Math.abs(x0 - (b.w - w) / 2) < Math.abs(best - (b.w - w) / 2))) {
      best = x0;
      bestScore = score;
    }
  }
  return best;
}

/** A world's preview (made now if it isn't yet). */
export function worldThumb(world: number, kind: ThumbKind): Art {
  const key = `${kind}:${world}`;
  let a = made.get(key);
  if (a) return a;
  let full = composed.get(world);
  if (!full) {
    full = composeWorld(world, { vignette: false, fg: false });
    composed.set(world, full);
  }
  const { w, h, y } = SIZE[kind];
  const top = Math.max(0, Math.min(full.h - h, SCENE_Y + y));
  const x = busiestX(full, top, w, h);
  const src = full;
  a = { url: pixelUrl(`worldThumb:${key}`, () => crop(src, x, top, w, h), 1), w, h };
  made.set(key, a);
  return a;
}

const waiting = new Map<string, Array<(a: Art) => void>>();
let pumping = false;

function pump(): void {
  const next = waiting.keys().next();
  if (next.done) {
    pumping = false;
    return;
  }
  const key = next.value;
  const [kind, world] = key.split(':') as [ThumbKind, string];
  const a = worldThumb(Number(world), kind);
  for (const done of waiting.get(key) ?? []) done(a);
  waiting.delete(key);
  setTimeout(pump, 16);
}

/** A world's preview, made in the background (null until it is ready). */
export function useWorldThumb(world: number, kind: ThumbKind): Art | null {
  const key = `${kind}:${world}`;
  const [art, setArt] = useState<Art | null>(() => made.get(key) ?? null);
  useEffect(() => {
    const hit = made.get(key);
    if (hit) {
      setArt(hit);
      return;
    }
    let alive = true;
    const list = waiting.get(key) ?? [];
    list.push((a) => alive && setArt(a));
    waiting.set(key, list);
    if (!pumping) {
      pumping = true;
      setTimeout(pump, 0);
    }
    return () => {
      alive = false;
    };
  }, [key]);
  return art;
}
