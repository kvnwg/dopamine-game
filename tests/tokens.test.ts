import { describe, expect, it } from 'vitest';
import {
  applyAction, finalUnlock, isItemUnlocked, performSpin, rebirthRequirement, Rng, rollTokens, tick, tokenMult, tokenStepSeconds, unlockedCount,
  unlocksAt, type CoreEvent, type GameState,
} from '../src/core';
import { BAL, DATA, SLOTS } from '../src/data';
import { freshState, T0 } from './helpers';

const clone = (s: GameState) => structuredClone(s) as GameState;

function rollingState(): GameState {
  const st = clone(freshState());
  st.dumpster.firstDiveDone = true;
  st.currencies.bags = 0;
  return st;
}

type SpinStart = Extract<CoreEvent, { type: 'spinStart' }>;
type Roll = Extract<CoreEvent, { type: 'roll' }>;

/** Ticks 0.1 s at a time, collecting events. */
function runTicks(st: GameState, ticks: number, rng: Rng) {
  const events: CoreEvent[] = [];
  let s = st;
  for (let i = 0; i < ticks; i++) {
    const r = tick(s, { ticks: 1 }, rng, T0 + i * 100);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

describe('luck tokens', () => {
  const m = BAL.roll.multiplier;

  it('a reel lands on a token about `chance` of the time, chains rarely, and never past maxSteps (20,000 reels)', () => {
    const rng = new Rng(5);
    const n = 20_000;
    let withTokens = 0;
    let chains = 0;
    const seen = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      const t = rollTokens(rng);
      expect(t.length).toBeLessThanOrEqual(m.maxSteps);
      if (t.length > 0) withTokens++;
      if (t.length > 1) chains++;
      for (const x of t) seen.set(x, (seen.get(x) ?? 0) + 1);
    }
    const p = withTokens / n;
    const se = Math.sqrt((m.chance * (1 - m.chance)) / n);
    expect(Math.abs(p - m.chance)).toBeLessThan(4 * se);
    // A second token needs a second success: about chance^2 of reels.
    expect(chains / n).toBeLessThan(m.chance * m.chance * 2);
    // Every configured value shows up, and the commonest is the most frequent.
    for (const v of m.values) expect(seen.get(v.x) ?? 0).toBeGreaterThan(0);
    const commonest = [...m.values].sort((a, b) => b.weight - a.weight)[0].x;
    const most = [...seen.entries()].sort((a, b) => b[1] - a[1])[0][0];
    expect(most).toBe(commonest);
  });

  it('a token chain multiplies the reel\'s luck and lands the item one step later per token', () => {
    // Find a spin whose first reel lands on tokens.
    let found: { st: GameState; start: SpinStart; rolls: Roll[] } | null = null;
    for (let seed = 1; seed < 400 && !found; seed++) {
      const st = rollingState();
      const ev: CoreEvent[] = [];
      performSpin(st, new Rng(seed), T0, ev);
      const start = ev.find((e): e is SpinStart => e.type === 'spinStart')!;
      if (start.reels[0].mults.length > 0) found = { st, start, rolls: ev.filter((e): e is Roll => e.type === 'roll') };
    }
    expect(found).not.toBeNull();
    const { start, rolls } = found!;
    const r0 = start.reels[0];
    expect(r0.landAt).toBeCloseTo(start.baseSpinSeconds + r0.mults.length * start.stepSeconds);
    expect(start.spinSeconds).toBeCloseTo(Math.max(...start.reels.map((r) => r.landAt)));
    expect(start.stepSeconds).toBeCloseTo(tokenStepSeconds(start.baseSpinSeconds));
    const roll = rolls.find((r) => r.reel === 0)!;
    expect(roll.mult).toBe(tokenMult(r0.mults));
    expect(roll.luck).toBeCloseTo(start.luck * roll.mult);
    expect(roll.item.uid).toBe(r0.item.uid);
  });

  it('reels land one by one: a reel without tokens lands on time while a chained reel keeps going', () => {
    // Two reels, the second on a token chain and the first not.
    let picked: { seed: number; start: SpinStart } | null = null;
    for (let seed = 1; seed < 3000 && !picked; seed++) {
      const st = rollingState();
      st.upgrades.extraReel = 1;
      const ev: CoreEvent[] = [];
      performSpin(st, new Rng(seed), T0, ev);
      const start = ev.find((e): e is SpinStart => e.type === 'spinStart')!;
      if (start.reels.length === 2 && start.reels[0].mults.length === 0 && start.reels[1].mults.length > 0) picked = { seed, start };
    }
    expect(picked).not.toBeNull();
    const st = rollingState();
    st.upgrades.extraReel = 1;
    const { start } = picked!;
    // Ticks until just after the plain reel's landing: only reel 0 has landed.
    const early = runTicks(clone(st), Math.ceil(start.baseSpinSeconds * 10) + 1, new Rng(picked!.seed));
    const s0 = early.events.find((e): e is SpinStart => e.type === 'spinStart')!;
    expect(s0.reels[1].mults).toEqual(start.reels[1].mults);
    const early0 = early.events.filter((e): e is Roll => e.type === 'roll');
    expect(early0.map((r) => r.reel)).toEqual([0]);
    // Until the chained reel's landing: now both.
    const late = runTicks(clone(st), Math.ceil(start.reels[1].landAt * 10) + 1, new Rng(picked!.seed));
    const rolls = late.events.filter((e): e is Roll => e.type === 'roll');
    expect(rolls.slice(0, 2).map((r) => r.reel)).toEqual([0, 1]);
    expect(rolls[1].mult).toBe(tokenMult(start.reels[1].mults));
  });

  it('the tutorial spin never lands on a token', () => {
    for (let seed = 1; seed < 200; seed++) {
      const st = clone(freshState(seed));
      const ev: CoreEvent[] = [];
      performSpin(st, new Rng(seed), T0, ev);
      const start = ev.find((e): e is SpinStart => e.type === 'spinStart')!;
      expect(start.reels[0].mults).toEqual([]);
    }
  });

  it('tokens make rare items likelier on average', () => {
    const avg = m.values.reduce((s, v) => s + v.x * v.weight, 0) / m.values.reduce((s, v) => s + v.weight, 0);
    expect(avg).toBeGreaterThan(1);
    // Expected multiplier of a reel: sum over chain lengths (finite, a modest boost).
    let e = 0;
    for (let k = 0; k <= m.maxSteps; k++) {
      const pk = Math.pow(m.chance, k) * (k < m.maxSteps ? 1 - m.chance : 1);
      e += pk * Math.pow(avg, k);
    }
    expect(e).toBeGreaterThan(1.05);
    expect(e).toBeLessThan(2);
  });
});

describe('item unlocks through rebirths', () => {
  it('every slot has something to roll from the start, and the first item is unlocked', () => {
    for (const slot of SLOTS) expect(DATA.items.some((i) => i.slot === slot && i.unlock === 0)).toBe(true);
    expect(DATA.itemsById.get(BAL.dumpster.tutorialItem.baseId)!.unlock).toBe(0);
    expect(unlockedCount(0)).toBeLessThan(DATA.items.length / 2);
    expect(unlockedCount(finalUnlock())).toBe(DATA.items.length);
    // Every rebirth up to the last adds something.
    for (let r = 1; r <= finalUnlock(); r++) expect(unlocksAt(r).length).toBeGreaterThan(0);
  });

  it('the dumpster only rolls unlocked items (3,000 rolls before and after two rebirths)', () => {
    for (const rebirths of [0, 2]) {
      const st = rollingState();
      st.rebirths = rebirths;
      const rng = new Rng(17 + rebirths);
      const seen = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        for (const it of performSpin(st, rng, T0, [])) {
          seen.add(it.baseId);
          expect(isItemUnlocked(DATA.itemsById.get(it.baseId)!, rebirths)).toBe(true);
        }
        st.inventory = [];
      }
      // Most of the unlocked pool shows up.
      expect(seen.size).toBeGreaterThan(unlockedCount(rebirths) * 0.6);
    }
  });

  it('a rebirth announces the items it unlocks', () => {
    const st = rollingState();
    const req = rebirthRequirement(0);
    st.stage.highestCleared = req.world;
    st.currencies.coins = req.gold;
    const r = applyAction(st, { type: 'rebirth' }, new Rng(3), T0);
    const ev = r.events.find((e) => e.type === 'rebirth');
    expect(ev?.type === 'rebirth' && ev.unlocked).toEqual(unlocksAt(1).map((i) => i.id));
  });
});
