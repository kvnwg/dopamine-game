/**
 * Seeded PRNG (mulberry32). All game randomness goes through this class so runs
 * are deterministic and reproducible from a saved `rngState`.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Current internal state; persist it to resume the exact same sequence. */
  get state(): number {
    return this.s;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  float(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick on empty array');
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Pick a key with probability proportional to its weight. Zero weights never win. */
  weighted<K extends string>(weights: Readonly<Record<K, number>> | ReadonlyArray<readonly [K, number]>): K {
    const entries = (Array.isArray(weights) ? weights : Object.entries(weights)) as ReadonlyArray<readonly [K, number]>;
    let total = 0;
    for (const [, w] of entries) total += Math.max(0, w);
    if (total <= 0) throw new Error('Rng.weighted with no positive weights');
    let r = this.next() * total;
    let last: K | undefined;
    for (const [k, w] of entries) {
      if (w <= 0) continue;
      last = k;
      r -= w;
      if (r < 0) return k;
    }
    return last as K;
  }

  /** Derive a fresh 32-bit seed from a number (for new games). */
  static hashSeed(n: number): number {
    let h = (n ^ 0x9e3779b9) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
  }
}
