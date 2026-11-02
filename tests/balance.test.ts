import { describe, expect, it } from 'vitest';
import { simulate } from '../tools/simCore';

/**
 * Milestone 1 balance target: a fresh, active player reaches stage 20 in about
 * 45-60 minutes. One seeded run of the headless bot keeps this from regressing;
 * run `npm run sim -- --seeds 6` for the full picture.
 */
describe('balance (headless bot)', () => {
  it('reaches stage 20 within the first hour with steadily growing power', () => {
    const r = simulate({ minutes: 60, seed: 2 });
    const reached20 = r.clearedAt[19];
    expect(reached20).toBeDefined();
    expect(reached20).toBeGreaterThan(30);
    expect(reached20).toBeLessThan(60);
    const powers = r.samples.filter((s) => s.minute % 10 === 0).map((s) => s.gearPower);
    for (let i = 1; i < powers.length; i++) expect(powers[i]).toBeGreaterThanOrEqual(powers[i - 1]);
  });
});
