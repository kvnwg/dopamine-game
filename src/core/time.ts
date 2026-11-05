/** Clock, day boundaries, offline time, and the clock-cheat guard. */

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;

/** Local calendar day key, e.g. "2026-11-02". Resets happen at local midnight. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export interface ElapsedResult {
  /** Clamped elapsed time in ms (0 if the clock went backward). */
  elapsedMs: number;
  /** True if the device clock is earlier than the last recorded active time. */
  clockWentBackward: boolean;
  /** True if the raw elapsed time exceeded the cap. */
  capped: boolean;
}

/** elapsed = clamp(now - lastActiveAt, 0, cap); a backward clock grants nothing. */
export function computeElapsed(lastActiveAt: number, now: number, capMs: number): ElapsedResult {
  const raw = now - lastActiveAt;
  if (raw < 0) return { elapsedMs: 0, clockWentBackward: true, capped: false };
  return { elapsedMs: Math.min(raw, capMs), clockWentBackward: false, capped: raw > capMs };
}

/**
 * App clock. In dev builds it supports an offset so the cheat panel can "skip time".
 * Game logic never reads Date.now() directly; it receives `now` from this clock.
 */
export class GameClock {
  private offsetMs = 0;
  constructor(private readonly source: () => number = () => Date.now()) {}
  now(): number {
    return this.source() + this.offsetMs;
  }
  skip(ms: number): void {
    this.offsetMs += ms;
  }
  get offset(): number {
    return this.offsetMs;
  }
}
