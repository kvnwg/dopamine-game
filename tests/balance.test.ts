import { describe, expect, it } from 'vitest';
import { simulate } from '../tools/simCore';

/**
 * Balance target: a fresh, active player clears the Suburbs (stage 20) in about an hour, with
 * walls at the bosses and gear power that only goes up. One seeded run of the headless bot keeps
 * this from regressing; run `npm run sim -- --seeds 6` for the full picture.
 */
describe('balance (headless bot)', () => {
  it('reaches stage 20 inside the first hour, with steadily growing power and some walls', () => {
    const r = simulate({ minutes: 60, seed: 2 });
    const reached20 = r.clearedAt[19];
    expect(reached20).toBeDefined();
    expect(reached20).toBeGreaterThan(15);
    expect(reached20).toBeLessThan(60);
    expect(r.deaths).toBeGreaterThan(3);
    const powers = r.samples.filter((s) => s.minute % 10 === 0).map((s) => s.gearPower);
    for (let i = 1; i < powers.length; i++) expect(powers[i]).toBeGreaterThanOrEqual(powers[i - 1]);
    // RNG feel: Mint in Box stays a once-in-a-long-while event.
    expect(r.rarityCounts.mint).toBeLessThanOrEqual(1);
  });
});
