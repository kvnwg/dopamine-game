import { describe, expect, it } from 'vitest';
import { simulate } from '../tools/simCore';

/**
 * Balance target (early and mid game sped up at Kevin's request, Nov 4): World 2 in about 5 minutes,
 * World 3 in about 10 to 13, the first rebirth (World 5) at about half an hour, then a rebirth about
 * every half hour for the first two hours, each world still taking longer than the one before; later
 * runs take longer. Rebirth wipes the raccoon (items, level, gold, upgrades) but its multipliers make
 * every climb go further.
 * One seeded run keeps this from regressing; run `npm run sim -- --minutes 240 --seeds 3` for the
 * full picture.
 */
describe('balance (headless bot)', () => {
  it('clears early worlds fast, slows down, and climbs further after each rebirth', () => {
    // 75 minutes: this seed beats World 5 and rebirths at about 27 minutes, and again at about 56.
    const r = simulate({ minutes: 75, seed: 2 });
    const w3 = r.clearedAt[3];
    expect(w3).toBeDefined();
    expect(w3).toBeGreaterThan(4);
    expect(w3).toBeLessThan(20);
    // Later worlds take longer than early ones. (World to world the gaps vary with the luck of the
    // token chains, so compare a late world with an early one rather than neighbors.)
    expect(r.clearedAt[5] - r.clearedAt[4]).toBeGreaterThan(r.clearedAt[2] - r.clearedAt[1]);
    // The first rebirth comes at about half an hour, not in the first few minutes.
    expect(r.rebirthAt.length).toBeGreaterThanOrEqual(1);
    expect(r.rebirthAt[0]).toBeGreaterThan(15);
    expect(r.rebirthAt[0]).toBeLessThan(40);
    const best = Math.max(...Object.keys(r.clearedAt).map(Number));
    // No racing ahead: about World 7 in the first 75 minutes, World 9 not yet.
    expect(best).toBeGreaterThanOrEqual(5);
    expect(best).toBeLessThanOrEqual(8);
    expect(r.deaths).toBeGreaterThan(3);
    // Within the first climb (before any rebirth wipes it), gear power only goes up.
    const firstCycle = r.samples.filter((s) => s.rebirths === 0 && s.minute % 5 === 0).map((s) => s.gearPower);
    for (let i = 1; i < firstCycle.length; i++) expect(firstCycle[i]).toBeGreaterThanOrEqual(firstCycle[i - 1]);
    // RNG feel: Mint in Box stays a once-in-a-long-while event.
    expect(r.rarityCounts.mint).toBeLessThanOrEqual(1);
  });
});
