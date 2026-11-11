import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core';
import { histogram } from './helpers';

describe('Rng', () => {
  it('is deterministic for a seed and resumable from its state', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
    const c = new Rng(a.state);
    expect(c.next()).toBe(a.next());
  });

  it('next() stays in [0, 1) with a uniform mean over 10,000 rolls', () => {
    const r = new Rng(7);
    let sum = 0;
    for (let i = 0; i < 10_000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 10_000).toBeCloseTo(0.5, 1);
  });

  it('int() is inclusive and uniform over 10,000 rolls', () => {
    const r = new Rng(3);
    const h = histogram(10_000, () => r.int(-2, 1));
    expect([...h.keys()].sort()).toEqual([-1, -2, 0, 1].sort());
    for (const v of h.values()) expect(Math.abs(v / 10_000 - 0.25)).toBeLessThan(0.02);
  });

  it('weighted() respects weights and never picks zero weights (10,000 rolls)', () => {
    const r = new Rng(11);
    const h = histogram(10_000, () => r.weighted({ a: 70, b: 30, c: 0 }));
    expect(h.get('c')).toBeUndefined();
    expect(Math.abs((h.get('a') ?? 0) / 10_000 - 0.7)).toBeLessThan(0.02);
  });

  it('chance() matches its probability over 10,000 rolls', () => {
    const r = new Rng(5);
    const h = histogram(10_000, () => r.chance(0.15));
    expect(Math.abs((h.get(true) ?? 0) / 10_000 - 0.15)).toBeLessThan(0.015);
  });
});
