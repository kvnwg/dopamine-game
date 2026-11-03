import { useEffect, useRef, useState } from 'react';
import { clock } from '../app/store';

/** Re-renders every `ms` and returns the game clock's now. */
export function useNow(ms = 250): number {
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    const id = setInterval(() => setNow(clock.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Re-renders every animation frame while `active` is true; returns performance.now(). */
export function useFrame(active: boolean): number {
  const [t, setT] = useState(() => performance.now());
  useEffect(() => {
    if (!active) return;
    let id = 0;
    const loop = () => {
      setT(performance.now());
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active]);
  return t;
}

/**
 * Number that rolls toward its target instead of jumping (playbook: count-ups everywhere). When
 * `jumpKey` changes (say, the level an XP count belongs to) it jumps instead of rolling back.
 */
export function useCountUp(target: number, durationMs = 400, jumpKey?: unknown): number {
  const [shown, setShown] = useState(target);
  const key = useRef(jumpKey);
  useEffect(() => {
    if (key.current !== jumpKey) {
      key.current = jumpKey;
      setShown(target);
      return;
    }
    const from = shown;
    if (from === target) return;
    const start = performance.now();
    let id = 0;
    const step = () => {
      const k = Math.min(1, (performance.now() - start) / durationMs);
      const eased = 1 - Math.pow(1 - k, 3);
      // (Ends on the target exactly: a rounding crumb under it would show one less.)
      setShown(k < 1 ? from + (target - from) * eased : target);
      if (k < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, jumpKey]);
  return shown;
}
