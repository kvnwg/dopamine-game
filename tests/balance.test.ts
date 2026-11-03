import { describe, expect, it } from 'vitest';
import { simulate } from '../tools/simCore';

/**
 * Balance target: the first worlds fall in minutes, then each world takes longer. Rebirth wipes
 * the raccoon (items, level, gold, upgrades) but its multipliers make every climb go further, so
 * an active player rebirths every 20 minutes or so and reaches a new best world each cycle.
 * One seeded run keeps this from regressing; run `npm run sim -- --minutes 120 --seeds 4` for the
 * full picture.
 */
describe('balance (headless bot)', () => {
  it('clears early worlds fast, slows down, and climbs further after each rebirth', () => {
    const r = simulate({ minutes: 60, seed: 2 });
    const w3 = r.clearedAt[3];
    expect(w3).toBeDefined();
    expect(w3).toBeGreaterThan(2);
    expect(w3).toBeLessThan(12);
    // Later worlds take longer than early ones.
    expect(r.clearedAt[5] - r.clearedAt[4]).toBeGreaterThan(r.clearedAt[3] - r.clearedAt[2]);
    expect(r.rebirthAt.length).toBeGreaterThanOrEqual(1);
    expect(r.rebirthAt[0]).toBeGreaterThan(10);
    const best = Math.max(...Object.keys(r.clearedAt).map(Number));
    expect(best).toBeGreaterThanOrEqual(6);
    expect(best).toBeLessThanOrEqual(12);
    expect(r.deaths).toBeGreaterThan(3);
    // Within the first climb (before any rebirth wipes it), gear power only goes up.
    const firstCycle = r.samples.filter((s) => s.rebirths === 0 && s.minute % 5 === 0).map((s) => s.gearPower);
    for (let i = 1; i < firstCycle.length; i++) expect(firstCycle[i]).toBeGreaterThanOrEqual(firstCycle[i - 1]);
    // RNG feel: Mint in Box stays a once-in-a-long-while event.
    expect(r.rarityCounts.mint).toBeLessThanOrEqual(1);
  });
});
