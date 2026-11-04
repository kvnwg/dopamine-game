import { describe, expect, it } from 'vitest';
import { deserialize, findScore, judgeFinds, judgeHaul, performSpin, revealBar, rollEnchants, rollRarity, Rng, serialize, tick, type CoreEvent, type GameState } from '../src/core';
import { BAL, type Rarity } from '../src/data';
import { HYPER_LOCK_MS, revealPhases } from '../src/ui/revealTiming';
import { freshState, T0 } from './helpers';

const MIN = 60_000;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const item = (rarity: Rarity, tiers: number[] = []) => ({ rarity, enchants: tiers.map((tier) => ({ tier })) });

/** A game whose finds have been watched for `minutes` of play (none recorded), at play clock `minutes`. */
function watched(minutes: number): GameState {
  const st = clone(freshState(3));
  st.playTimeMs = minutes * MIN;
  st.roll.rare = { since: 0, hist: [], best: 0 };
  return st;
}

describe('the full-screen reveal: the rarest find in a while (Kevin: "make it proportionate")', () => {
  it('a find rarer than everything in the last few minutes gets it; bigger ones beat longer stretches', () => {
    const st = watched(600);
    const [w1, w2] = BAL.feel.bigRoll.windowMinutes;
    // Nothing yet: a Legendary is the rarest of every stretch, so the biggest reveal.
    expect(judgeFinds(st, [item('legendary')], 1).drama).toEqual(['insane']);
    // Right after it, another Legendary isn't rarer than it: nothing.
    expect(judgeFinds(st, [item('legendary')], 1).drama).toEqual([null]);
    // Past the first window (but within the second), a Legendary beats what's left of it: big.
    st.playTimeMs += (w1 + 1) * MIN;
    expect(judgeFinds(st, [item('legendary')], 1).drama).toEqual(['big']);
    // A Mythic beats both Legendaries: the rarest of every stretch again.
    st.playTimeMs += 1 * MIN;
    expect(judgeFinds(st, [item('mythic')], 1).drama).toEqual(['insane']);
    // An Epic right after it is no news...
    st.playTimeMs += 1 * MIN;
    expect(judgeFinds(st, [item('epic')], 1).drama).toEqual([null]);
    // ...but once the Mythic is past the first stretch, a Legendary is big again (the Mythic is still
    // in the longer ones).
    st.playTimeMs += w1 * MIN;
    expect(judgeFinds(st, [item('legendary')], 1).drama).toEqual(['big']);
    expect(w2).toBeGreaterThan(w1 + 2);
  });

  it('common finds never get it, however long it has been, and nothing is judged in a new game\'s first minutes', () => {
    const st = watched(600);
    // Junk, Decent and Shiny aren't 1 in feel.bigRoll.tierOneIn at luck 1, enchanted or not.
    for (const r of ['junk', 'decent', 'shiny'] as const) expect(judgeFinds(st, [item(r, [3, 3, 3])], 1).drama).toEqual([null]);
    // A brand-new game: the tutorial scripts its reveals, the watch starts now.
    const fresh = clone(freshState(4));
    expect(judgeFinds(fresh, [item('mythic')], 1).drama).toEqual([null]);
    fresh.playTimeMs += BAL.feel.bigRoll.minHistoryMinutes * MIN;
    expect(judgeFinds(fresh, [item('mythic', [1])], 1).drama[0]).not.toBeNull();
  });

  it('only finds that matter are kept, rarest first, within the longest stretch', () => {
    const st = watched(600);
    for (let i = 0; i < 200; i++) {
      st.playTimeMs += 2_000;
      judgeFinds(st, [item((['epic', 'legendary', 'shiny', 'decent'] as const)[i % 4])], 1);
    }
    const h = st.roll.rare.hist;
    expect(h.length).toBeLessThanOrEqual(BAL.feel.bigRoll.historyMax);
    for (let i = 1; i < h.length; i++) {
      expect(h[i][0]).toBeGreaterThanOrEqual(h[i - 1][0]);
      expect(h[i][1]).toBeLessThan(h[i - 1][1]);
    }
  });

  it('enchantments the raccoon rolls all the time count for less', () => {
    const st = watched(10);
    const ench = item('epic', [2, 1]);
    const before = findScore(st, ench, 1);
    st.upgrades = { enchant: 8, enchantTier: 5 };
    expect(findScore(st, ench, 1)).toBeLessThan(before);
    expect(findScore(st, item('epic'), 1)).toBe(findScore(watched(10), item('epic'), 1));
  });

  it('comes about as often early (slow, unlucky rolls) as late (fast, lucky, enchanted ones)', () => {
    /** Reveals per hour over `hours` of play at `luck`, `perMinute` rolls a minute, `enchant` chance. */
    const rate = (luck: number, perMinute: number, enchant: number, seed: number, hours = 6) => {
      const st = watched(0);
      st.roll.rare.since = 0;
      const rng = new Rng(seed);
      let n = 0;
      const rolls = hours * 60 * perMinute;
      for (let i = 0; i < rolls; i++) {
        st.playTimeMs = (i / perMinute) * MIN;
        const f = { rarity: rollRarity(luck, rng), enchants: rollEnchants(rng, enchant) };
        if (judgeFinds(st, [f], luck).drama[0]) n++;
      }
      return n / hours;
    };
    // (The old rule, a fixed "1 in X" bar, gave about 8 an hour early in the game and 290 late.)
    const early = rate(2, 25, BAL.enchant.baseChance, 1);
    const late = rate(25, 150, 0.4, 2);
    const wild = rate(100, 300, 0.8, 3, 3);
    for (const r of [early, late, wild]) {
      expect(r).toBeGreaterThan(1);
      expect(r).toBeLessThan(16);
    }
    expect(Math.max(early, late, wild) / Math.min(early, late, wild)).toBeLessThan(6);
  });

  it('the luck popup says what it takes: the rarest in a few minutes, from a tier that is uncommon at your luck', () => {
    const m = BAL.feel.bigRoll.windowMinutes[0];
    expect(revealBar(1)).toEqual({ rarity: 'epic', minutes: m });
    expect(revealBar(50).rarity).not.toBe('epic');
  });
});

describe('HYPER RARE: the rarest find of the whole game (Kevin: "even more rare than the regular animation")', () => {
  const b = BAL.feel.bigRoll;

  it('goes to a find rarer than any he has ever found, once it is at least 1 in feel.bigRoll.hyperOneIn for him', () => {
    const st = watched(600);
    // Nothing before it: a Grail is the rarest ever, and way past the floor.
    expect(judgeFinds(st, [item('grail')], 1).drama).toEqual(['hyper']);
    // Another Grail isn't rarer than the first: no HYPER RARE (it's still the rarest in a while).
    expect(judgeFinds(st, [item('grail')], 1).drama[0]).not.toBe('hyper');
    // An enchanted Grail is rarer still.
    expect(judgeFinds(st, [item('grail', [3])], 1).drama).toEqual(['hyper']);
    expect(st.roll.rare.best).toBe(findScore(st, item('grail', [3]), 1));
  });

  it('never below the floor, however rare the find is for the game so far', () => {
    const st = watched(600);
    // A Legendary is the rarest ever here, but 1 in 1,000 is no HYPER RARE: the biggest usual reveal.
    expect(findScore(st, item('legendary'), 1)).toBeLessThan(b.hyperOneIn);
    expect(judgeFinds(st, [item('legendary')], 1).drama).toEqual(['insane']);
    // The floor is at his luck: a Prototype (1 in 400,000 at luck 1) at luck 40 is about 1 in 10,000.
    const lucky = watched(600);
    expect(findScore(lucky, item('prototype'), 40)).toBeLessThan(b.hyperOneIn);
    expect(judgeFinds(lucky, [item('prototype')], 40).drama[0]).not.toBe('hyper');
  });

  it('not in a new game\'s first feel.bigRoll.hyperWatchMinutes, though finds then still count toward the record', () => {
    const st = clone(freshState(7));
    st.playTimeMs = 0;
    judgeFinds(st, [item('junk')], 1);
    st.playTimeMs = (b.hyperWatchMinutes - 1) * MIN;
    expect(judgeFinds(st, [item('grail')], 1).drama[0]).not.toBe('hyper');
    st.playTimeMs = (b.hyperWatchMinutes + 1) * MIN;
    expect(judgeFinds(st, [item('grail')], 1).drama[0]).not.toBe('hyper');
    expect(judgeFinds(st, [item('grail', [1])], 1).drama).toEqual(['hyper']);
  });

  it('only the rarest of a spin\'s finds gets it', () => {
    const st = watched(600);
    expect(judgeFinds(st, [item('museum'), item('grail'), item('mint')], 1).drama[1]).toBe('hyper');
    expect(judgeFinds(watched(600), [item('museum'), item('grail'), item('mint')], 1).drama.filter((d) => d === 'hyper')).toHaveLength(1);
  });

  it('comes a few times in a long game, not every session', () => {
    // A long bot-like game: luck and roll speed climbing, as in the reveal-rate test above.
    const st = watched(0);
    st.roll.rare.since = 0;
    const rng = new Rng(11);
    let n = 0;
    const hours = 10;
    for (let i = 0; i < hours * 60 * 60; i++) {
      const minute = i / 60;
      const luck = 2 * Math.pow(30, minute / (hours * 60));
      st.playTimeMs = minute * MIN;
      const f = { rarity: rollRarity(luck, rng), enchants: rollEnchants(rng, 0.2) };
      if (judgeFinds(st, [f], luck).drama[0] === 'hyper') n++;
    }
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThan(12);
  });

  it('its summoning (which can\'t be skipped) runs to the burst, Reduce motion or not', () => {
    for (const calm of [false, true]) {
      const p = revealPhases('hyper', calm);
      expect(p.black + p.dark).toBe(HYPER_LOCK_MS);
      expect(HYPER_LOCK_MS).toBeGreaterThanOrEqual(2000);
    }
    expect(revealPhases('hyper', false).count).toBeGreaterThan(revealPhases('insane', false).count);
  });
});

describe('spins carry the core\'s judgement', () => {
  it('each reel\'s reveal and the spin\'s build-up go out with the spin, and the landing rolls carry their reveal', () => {
    const st = clone(freshState(9));
    st.dumpster.firstDiveDone = true;
    st.dumpster.beginner = { state: 'done', uid: null };
    st.playTimeMs = 30 * MIN;
    st.roll.rare = { since: 0, hist: [], best: 0 };
    st.dumpster.forcedRarity = 'mythic';
    const ev: CoreEvent[] = [];
    performSpin(st, new Rng(2), T0, ev);
    const start = ev.find((e) => e.type === 'spinStart');
    const roll = ev.find((e) => e.type === 'roll' && e.reel === 0);
    if (start?.type !== 'spinStart' || roll?.type !== 'roll') throw new Error('no spin');
    expect(start.reels[0].drama).not.toBeNull();
    expect(start.tease).toBeGreaterThan(0);
    expect(roll.drama).toBe(start.reels[0].drama);
    // A plain Junk spin right after: no reveal, no build-up.
    st.dumpster.forcedRarity = 'junk';
    const ev2: CoreEvent[] = [];
    performSpin(st, new Rng(3), T0, ev2);
    const s2 = ev2.find((e) => e.type === 'spinStart');
    if (s2?.type !== 'spinStart') throw new Error('no spin');
    expect(s2.reels[0].drama).toBeNull();
  });

  it('the tutorial\'s scripted finds always get the reveal', () => {
    let st = clone(freshState(5));
    st.roll.count = BAL.tutorial.warmupRarities.length;
    const rng = new Rng(4);
    for (let i = 0; i < 400; i++) {
      const r = tick(st, { ticks: 1 }, rng, T0 + i * 100);
      st = r.state;
      const s = r.events.find((e) => e.type === 'spinStart');
      if (s?.type === 'spinStart') {
        expect(s.scripted).toBe('first');
        expect(s.reels[0].drama).toBe('big');
        return;
      }
    }
    throw new Error('no spin started');
  });
});

describe('big hauls: well above the run\'s usual ones', () => {
  it('the game\'s first haul is a big one; a new run\'s first hauls only set the trend', () => {
    const st = clone(freshState(6));
    expect(judgeHaul(st, 500).size).toBe('big');
    st.rebirths = 1;
    for (let i = 0; i < BAL.feel.haul.warmup; i++) {
      st.playTimeMs += 2 * MIN;
      expect(judgeHaul(st, 1e9 * (i + 1))).toEqual({ size: null, usual: null });
    }
  });

  it('steady growth is usual; a haul several times the trend is big, huge or mega', () => {
    const st = clone(freshState(6));
    st.rebirths = 2;
    let coins = 1000;
    for (let i = 0; i < 12; i++) {
      st.playTimeMs += 2 * MIN;
      coins *= 1.6;
      const j = judgeHaul(st, coins);
      if (i >= BAL.feel.haul.warmup) {
        expect(j.size).toBeNull();
        expect(j.usual! / coins).toBeGreaterThan(0.5);
        expect(j.usual! / coins).toBeLessThan(2);
      }
    }
    const h = BAL.feel.haul;
    const at = (k: number) => {
      const s = clone(st);
      s.playTimeMs += 2 * MIN;
      return judgeHaul(s, coins * 1.6 * k).size;
    };
    expect(at(1)).toBeNull();
    expect(at(h.big * 1.3)).toBe('big');
    expect(at(h.huge * 1.3)).toBe('huge');
    expect(at(h.mega * 1.3)).toBe('mega');
  });

  it('a new run starts a new trend (hauls drop back down after a rebirth)', () => {
    const st = clone(freshState(6));
    st.rebirths = 3;
    for (let i = 0; i < 6; i++) {
      st.playTimeMs += 2 * MIN;
      judgeHaul(st, 1e12 * 2 ** i);
    }
    st.rebirths = 4;
    st.playTimeMs += 2 * MIN;
    judgeHaul(st, 1000);
    expect(st.haulTrend.run).toBe(4);
    expect(st.haulTrend.n).toBe(1);
  });

  it('a Scrap All right after another never sends the trend off (it overflowed into the save and reset it)', () => {
    const st = clone(freshState(6));
    st.rebirths = 1;
    const rng = new Rng(21);
    let big = 0;
    const n = 3000;
    for (let i = 0; i < n; i++) {
      // A full bag sold, then a few new finds sold a second or two later, then a couple of minutes' play.
      st.playTimeMs += i % 2 ? 2_000 : 120_000;
      if (judgeHaul(st, (i % 2 ? 3 : 60) * 1000 * (0.5 + rng.next())).size) big++;
      expect(Number.isFinite(st.haulTrend.level) && Number.isFinite(st.haulTrend.slope)).toBe(true);
    }
    expect(Math.abs(st.haulTrend.slope)).toBeLessThanOrEqual(1);
    // And the save still loads.
    const back = deserialize(serialize(st));
    expect(back?.haulTrend.slope).toBe(st.haulTrend.slope);
    // A few-item sale right after a big one is never a big haul; the big ones aren't every other sale.
    expect(big / n).toBeLessThan(0.1);
  });

  it('a save whose trend had already gone wrong starts the trend over', () => {
    const st = clone(freshState(6));
    st.rebirths = 2;
    st.haulTrend = { ...st.haulTrend, run: 2, n: 50, level: 1e300, slope: -1e200 };
    judgeHaul(st, 5000);
    expect(st.haulTrend.n).toBe(1);
    expect(st.haulTrend.level).toBeCloseTo(Math.log(5000), 6);
  });

  it('over a noisy, fast-growing run, only some hauls get the cutscene', () => {
    const st = clone(freshState(6));
    st.rebirths = 1;
    const rng = new Rng(8);
    let base = 1e4;
    let big = 0;
    const n = 200;
    for (let i = 0; i < n; i++) {
      const gap = 1 + rng.next() * 5;
      st.playTimeMs += gap * MIN;
      base *= Math.pow(1.4, gap);
      // Most bags are ordinary; now and then one holds something rare.
      const luckyBag = rng.next() < 0.1 ? 4 + rng.next() * 10 : 0.6 + rng.next() * 0.8;
      if (judgeHaul(st, base * luckyBag).size) big++;
    }
    expect(big / n).toBeGreaterThan(0.04);
    expect(big / n).toBeLessThan(0.35);
  });
});
