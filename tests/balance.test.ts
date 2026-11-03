import { describe, expect, it } from 'vitest';
import { simulate } from '../tools/simCore';

/**
 * Balance target (slowed down at Kevin's request): World 2 falls in minutes, then each world takes
 * clearly longer, so a first climb reaches about World 5 in the first hour and World 7 takes well
 * over an hour. Rebirth wipes the raccoon (items, level, gold, upgrades) but its multipliers make
 * every climb go further.
 * One seeded run keeps this from regressing; run `npm run sim -- --minutes 120 --seeds 4` for the
 * full picture.
 */
describe('balance (headless bot)', () => {
  it('clears early worlds fast, slows down, and climbs further after each rebirth', () => {
    const r = simulate({ minutes: 60, seed: 2 });
    const w3 = r.clearedAt[3];
    expect(w3).toBeDefined();
    expect(w3).toBeGreaterThan(4);
    expect(w3).toBeLessThan(25);
    // Later worlds take longer than early ones.
    expect(r.clearedAt[5] - r.clearedAt[4]).toBeGreaterThan(r.clearedAt[3] - r.clearedAt[2]);
    expect(r.rebirthAt.length).toBeGreaterThanOrEqual(1);
    expect(r.rebirthAt[0]).toBeGreaterThan(30);
    const best = Math.max(...Object.keys(r.clearedAt).map(Number));
    // No racing ahead: about World 5 in the first hour, World 7 not yet.
    expect(best).toBeGreaterThanOrEqual(4);
    expect(best).toBeLessThanOrEqual(6);
    expect(r.deaths).toBeGreaterThan(3);
    // Within the first climb (before any rebirth wipes it), gear power only goes up.
    const firstCycle = r.samples.filter((s) => s.rebirths === 0 && s.minute % 5 === 0).map((s) => s.gearPower);
    for (let i = 1; i < firstCycle.length; i++) expect(firstCycle[i]).toBeGreaterThanOrEqual(firstCycle[i - 1]);
    // RNG feel: Mint in Box stays a once-in-a-long-while event.
    expect(r.rarityCounts.mint).toBeLessThanOrEqual(1);
  });
});
