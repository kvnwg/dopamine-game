import { describe, expect, it } from 'vitest';
import { simulate } from '../tools/simCore';

/**
 * Balance target for the 20 worlds: the first worlds fall in minutes, then each world takes longer
 * (enemies outgrow world-tier gear, so progress needs luckier rolls, levels and upgrades). A fresh,
 * active player reaches World 5 to 9 and rebirths at least once in the first hour; gear power only
 * goes up. One seeded run keeps this from regressing; run `npm run sim -- --minutes 120 --seeds 4`
 * for the full picture.
 */
describe('balance (headless bot)', () => {
  it('clears early worlds fast, slows down later, rebirths, and keeps gear power growing', () => {
    const r = simulate({ minutes: 60, seed: 2 });
    const w3 = r.clearedAt[3];
    expect(w3).toBeDefined();
    expect(w3).toBeGreaterThan(2);
    expect(w3).toBeLessThan(12);
    const best = Math.max(...Object.keys(r.clearedAt).map(Number));
    expect(best).toBeGreaterThanOrEqual(5);
    expect(best).toBeLessThanOrEqual(9);
    // Later worlds take longer than early ones.
    expect(r.clearedAt[5] - r.clearedAt[4]).toBeGreaterThan(r.clearedAt[3] - r.clearedAt[2]);
    expect(r.rebirthAt.length).toBeGreaterThanOrEqual(1);
    expect(r.deaths).toBeGreaterThan(3);
    const powers = r.samples.filter((s) => s.minute % 10 === 0).map((s) => s.gearPower);
    for (let i = 1; i < powers.length; i++) expect(powers[i]).toBeGreaterThanOrEqual(powers[i - 1]);
    // RNG feel: Mint in Box stays a once-in-a-long-while event.
    expect(r.rarityCounts.mint).toBeLessThanOrEqual(1);
  });
});
