import { describe, expect, it } from 'vitest';
import {
  applyAction, canLegend, computeStats, currentLuck, dumpWorld, goldMult, itemUnlockRank, legendFx, legendGain, legendOpen, legendPrice, performSpin,
  reelCount, Rng, starsForRebirths, tick, type GameState,
} from '../src/core';
import { BAL, DATA } from '../src/data';
import { freshState, T0 } from './helpers';

const L = BAL.legend;
const rng = () => new Rng(5);
const own = (st: GameState): GameState => structuredClone(st);

/** A run at `rebirths` rebirths, past the tutorial, with a few things worth keeping. */
function veteran(rebirths = L.unlockRebirths): GameState {
  const st = freshState(1);
  st.dumpster.beginner = { state: 'done', uid: null };
  st.dumpster.firstDiveDone = true;
  st.rebirths = rebirths;
  st.currencies.gems = 777;
  st.currencies.coins = 1e30;
  st.dumpster.level = 12;
  st.codex.entries = ['hat_traffic_cone:legendary'];
  st.dump.bestEver = 33;
  st.stage.highestCleared = dumpWorld(12);
  st.player.level = 80;
  st.legend.runDeepest = 12;
  st.legend.runFloorStars = 12;
  st.features.unlocked.push('heist', 'perks');
  return st;
}

describe('Become a Legend', () => {
  it('opens at Rebirth 5 (and stays open after a Legend); pays stars for rebirths (squared) and new floors', () => {
    expect(legendOpen(veteran(L.unlockRebirths - 1))).toBe(false);
    expect(legendOpen(veteran())).toBe(true);
    expect(canLegend(veteran(L.unlockRebirths - 1))).toBe(false);
    expect(starsForRebirths(8)).toBe(Math.floor(64 * L.starsPerRebirthSq));
    const g = legendGain(veteran(8));
    expect(g).toEqual({ rebirths: starsForRebirths(8), floors: 12, total: starsForRebirths(8) + 12 });
  });

  it('starts it all over, rebirths too, for the stars; keeps stars, gems, the Codex, the dumpster, the deepest floor, items, Heists and Perks', () => {
    const st = veteran(8);
    const gain = legendGain(st).total;
    const r = applyAction(st, { type: 'legend' }, rng(), T0);
    const s = r.state;
    expect(r.events.find((e) => e.type === 'legend')).toEqual({ type: 'legend', count: 1, stars: gain });
    expect(s.legend.count).toBe(1);
    expect(s.legend.stars).toBe(gain);
    expect(s.rebirths).toBe(0);
    expect(s.stage.highestCleared).toBe(0);
    expect(s.battle.stage).toBe(1);
    expect(s.currencies.coins).toBe(0);
    expect(s.player.level).toBe(1);
    expect(s.legend.runDeepest).toBe(0);
    expect(s.legend.runFloorStars).toBe(0);
    expect(s.currencies.gems).toBe(777);
    expect(s.codex.entries).toEqual(st.codex.entries);
    expect(s.dumpster.level).toBe(12);
    expect(s.dump.bestEver).toBe(33);
    // Every item stays unlocked; Heists and Perks stay open with no rebirths.
    expect(itemUnlockRank(s)).toBe(Infinity);
    expect(applyAction(s, { type: 'heistStart', location: 'pizza' }, rng(), T0).state.heist.run).not.toBeNull();
    expect(computeStats(s).ATK).toBeCloseTo(BAL.player.base.ATK);
    // Not on a heist, and not below Rebirth 5.
    expect(applyAction(veteran(2), { type: 'legend' }, rng(), T0).state.legend.count).toBe(0);
  });

  it('star upgrades: priced per level, maxed ones stop, the ones with no limit grow in price', () => {
    const st = veteran();
    st.legend.stars = 1000;
    const head = L.perks.find((p) => p.id === 'headStart')!;
    let s = st;
    for (let i = 0; i < head.max + 2; i++) s = applyAction(s, { type: 'buyLegendPerk', id: 'headStart' }, rng(), T0).state;
    expect(s.legend.perks.headStart).toBe(head.max);
    expect(s.legend.stars).toBe(1000 - head.costs!.reduce((a, b) => a + b, 0));
    expect(legendPrice(head, head.max)).toBeNull();
    const luck = L.perks.find((p) => p.id === 'starLuck')!;
    expect(legendPrice(luck, 5)!).toBeGreaterThan(legendPrice(luck, 0)!);
    // Too poor: nothing happens.
    const poor = veteran();
    expect(applyAction(poor, { type: 'buyLegendPerk', id: 'starLuck' }, rng(), T0).state.legend.perks.starLuck).toBeUndefined();
  });

  it('Star Luck, Star Power and Star Gold add up a level at a time', () => {
    const st = veteran();
    const luck = currentLuck(st, T0);
    const atk = computeStats(st).ATK;
    const gold = goldMult(st);
    st.legend.perks = { starLuck: 3, starPower: 2, starGold: 4 };
    const fx = legendFx(st);
    expect(fx.luckPct).toBe(3 * L.perks.find((p) => p.id === 'starLuck')!.effect.luckPct!);
    expect(currentLuck(st, T0)).toBeCloseTo(luck * (1 + fx.luckPct / 100));
    expect(computeStats(st).ATK).toBeGreaterThan(atk);
    expect(goldMult(st)).toBeCloseTo(gold * (1 + fx.goldPct / 100));
  });

  it('Head Start and Loaf Stash shape every new run; Reel Memory keeps the Extra Reels', () => {
    const st = veteran(8);
    st.legend.perks = { headStart: 2, loafStash: 1, keepReels: 1 };
    st.upgrades = { luck: 3, extraReel: 2 };
    const s = applyAction(st, { type: 'legend' }, rng(), T0).state;
    const fx = legendFx(s);
    expect(s.player.level).toBe(1 + fx.startLevels);
    expect(s.stage.highestCleared).toBe(fx.startWorlds);
    expect(s.perks.bread).toBe(fx.startLoaves);
    expect(s.upgrades).toEqual({ luck: 1, extraReel: 2 });
    expect(reelCount(s)).toBe(3);
  });

  it('Personal Stylist puts upgrades on by itself; Groundhog Day rebirths by itself (both can be switched off)', () => {
    let st = veteran(1);
    st.legend.perks = { autoEquip: 1 };
    st.stage.highestCleared = 1;
    const ev = [] as unknown[];
    for (let i = 0; i < 20 && Object.values(st.equipped).every((x) => !x); i++) {
      const d = own(st);
      performSpin(d, rng(), T0, ev as never);
      st = applyAction(d, { type: 'featureSeen', feature: 'bag' }, rng(), T0).state;
    }
    expect(Object.values(st.equipped).some((x) => x)).toBe(true);
    // Off: nothing goes on by itself.
    let off = veteran(1);
    off.legend.perks = { autoEquip: 1 };
    off = applyAction(off, { type: 'setLegendToggle', key: 'autoEquip', value: false }, rng(), T0).state;
    const d = own(off);
    performSpin(d, rng(), T0, ev as never);
    expect(Object.values(d.equipped).every((x) => !x)).toBe(true);

    const ready = veteran(0);
    ready.legend.perks = { autoRebirth: 1 };
    ready.stage.highestCleared = BAL.rebirth.baseWorld;
    expect(tick(ready, { ticks: 1 }, rng(), T0).state.rebirths).toBe(1);
    const no = own(ready);
    no.legend.autoRebirth = false;
    expect(tick(no, { ticks: 1 }, rng(), T0).state.rebirths).toBe(0);
  });

  it('the data: every star upgrade has a name and text, a price list as long as its max (or a growing price)', () => {
    for (const p of L.perks) {
      expect(DATA.strings[`legend.perk.${p.id}.name`]).toBeTruthy();
      expect(DATA.strings[`legend.perk.${p.id}.text`]).toBeTruthy();
      if (p.max > 0) expect(p.costs?.length).toBe(p.max);
      else expect(p.cost).toBeTruthy();
    }
  });
});
