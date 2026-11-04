import { describe, expect, it } from 'vitest';
import { performSpin, rarityIndex, Rng, type CoreEvent, type GameState } from '../src/core';
import type { Rarity } from '../src/data';
import { glowAt, teasePlan } from '../src/ui/reelDrama';
import { buildStrip, stripAt } from '../src/ui/reelStrip';
import { itemStopMs } from '../src/ui/reelTiming';
import { freshState, T0 } from './helpers';

type SpinStart = Extract<CoreEvent, { type: 'spinStart' }>;

/**
 * A spin whose first reel is forced to `rarity` (the rest roll normally), with `extraReels` more reels,
 * after half an hour of play with nothing rare found (so the core judges it rare lately: luck.ts
 * judgeFinds), or, with `busy`, just after a very rare find (so nothing in it is news).
 */
function spinOf(rarity: Rarity, extraReels = 0, seed = 5, busy = false): SpinStart {
  const st = structuredClone(freshState(seed)) as GameState;
  st.dumpster.firstDiveDone = true;
  st.playTimeMs = 30 * 60_000;
  st.roll.rare = { since: 0, hist: busy ? [[st.playTimeMs - 5_000, 1e12]] : [] };
  st.currencies.bags = 0;
  st.upgrades.extraReel = extraReels;
  st.dumpster.forcedRarity = rarity;
  // Item uids grow through a game; vary them like play does (the build-up's dice come from the uid).
  st.nextItemUid = 100 + seed * 7;
  const ev: CoreEvent[] = [];
  performSpin(st, new Rng(seed), T0, ev);
  return ev.find((e): e is SpinStart => e.type === 'spinStart')!;
}

describe('reel build-ups (Roll tab)', () => {
  it('a rare result builds up on its own reel and its glow climbs to its tier exactly as the reel stops', () => {
    for (const r of ['epic', 'legendary', 'mythic', 'grail'] as const) {
      for (const extra of [0, 2]) {
        const spin = spinOf(r, extra);
        const plan = teasePlan(spin, 1)!;
        expect(plan).not.toBeNull();
        expect(spin.reels[plan.reel].item.rarity).toBe(r);
        expect(plan.level).toBeGreaterThanOrEqual(1);
        expect(plan.land).toBeCloseTo(itemStopMs(spin, plan.reel));
        // Tiers climb one at a time from below the result (never showing its ceiling first) up to it.
        expect(plan.tiers[0]).toBeLessThan(rarityIndex(r));
        expect(plan.tiers[plan.tiers.length - 1]).toBe(rarityIndex(r));
        plan.tiers.forEach((tier, k) => k > 0 && expect(tier).toBe(plan.tiers[k - 1] + 1));
        expect(plan.times[0]).toBe(plan.from);
        expect(plan.times[plan.times.length - 1]).toBe(plan.land);
        plan.times.forEach((t, k) => k > 0 && expect(t).toBeGreaterThan(plan.times[k - 1]));
        // Never above the real tier, at any moment.
        for (let ms = plan.from; ms <= plan.land + 500; ms += 37) {
          const g = glowAt(plan, ms);
          expect(g.tier).not.toBeNull();
          expect(g.tier!).toBeLessThanOrEqual(rarityIndex(r));
        }
        expect(glowAt(plan, plan.from - 1).tier).toBeNull();
        expect(glowAt(plan, plan.land - 1).tier).toBeLessThan(rarityIndex(r));
        expect(glowAt(plan, plan.land).tier).toBe(rarityIndex(r));
      }
    }
  });

  it('junk never glows, and plain results only sometimes (in the middle of play: nothing rare lately)', () => {
    let glows = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const spin = spinOf('junk', 0, seed);
      expect(teasePlan(spin, 1)).toBeNull();
      const spinS = spinOf('shiny', 0, seed, true);
      const item = spinS.reels[0].item;
      const shiny = teasePlan(spinS, 1);
      if (shiny) {
        glows++;
        // An enchanted one is rarer than its tier (its "1 in X" counts the enchantments).
        if (item.enchants.length === 0) expect(shiny.level).toBe(0);
        expect(shiny.tiers[shiny.tiers.length - 1]).toBe(rarityIndex(item.rarity));
      }
    }
    expect(glows).toBeGreaterThan(30);
    expect(glows).toBeLessThan(120);
  });

  it("a tutorial spin's first reel always gets the full build-up", () => {
    const spin = { ...spinOf('limited', 0), scripted: 'beginner' as const };
    const plan = teasePlan(spin, 1)!;
    expect(plan.reel).toBe(0);
    expect(plan.level).toBe(3);
  });

  it('a slowed (built-up) strip still reaches every stop exactly on time and settles on it', () => {
    const spin = spinOf('legendary', 2);
    const plan = teasePlan(spin, 1)!;
    const strip = buildStrip(spin, plan.reel, undefined, 0, undefined, plan.slow);
    const last = strip.stops[strip.stops.length - 1];
    expect(last.slow).toBe(plan.slow);
    expect(stripAt(strip, last.at - 1).reached).toBe(strip.stops.length - 1);
    expect(stripAt(strip, last.at + 1).reached).toBe(strip.stops.length);
    expect(stripAt(strip, last.at + 1).p).toBe(last.idx);
    // Crawling in: the last half-second covers well under two cells, and it never runs far past the line.
    const before = stripAt(strip, last.at - 500).p;
    expect(last.idx - before).toBeLessThan(2);
    for (let ms = 0; ms < last.at; ms += 17) {
      const p = stripAt(strip, ms).p;
      expect(p).toBeGreaterThan(-0.5);
      expect(p).toBeLessThan(last.idx + 0.3);
    }
  });
});
