import { describe, expect, it } from 'vitest';
import {
  applyAction, canRebirth, dayKey, deserialize, gainCurse, gainPerk, generateAct, GameStateSchema, heistAbandon, heistBoot, heistsOpen,
  heistChoose, heistClaim, heistDecline, heistGo, heistLeaveShop, heistOptionAvailable, heistRevive, heistTick, heistTrapAt, itemTierFor,
  makeOffer, optionPreview, performSpin, refreshTickets, rollActNodes, runEffects, runStats, Rng, serialize, shopMinCoins, startHeist, tick,
  TICK_SECONDS, travelTo, type CoreEvent, type GameState, type HeistRun,
} from '../src/core';
import { BAL, DATA, HEIST_ROLLED_KINDS, LOCATION_IDS, type HeistEventDef, type HeistNodeKind, type LocationId } from '../src/data';
import { simulateHeists } from '../tools/heistSimCore';
import { simulate } from '../tools/simCore';
import { freshState, T0 } from './helpers';

const H = BAL.heist;
const DAY = 86_400_000;
const clone = (s: GameState) => structuredClone(s) as GameState;

/** A mutable raccoon with a few levels on it (core functions are called on it directly). */
function raccoon(level = 8, seed = 1): GameState {
  const st = clone(freshState(seed));
  st.player.level = level;
  return st;
}

/** Starts a Pizza Place run on a copy of `st`; returns the state, its run and the events. */
function started(st: GameState = raccoon(), location: 'pizza' | 'mall' | 'hotel' = 'pizza', seed = 3) {
  const d = clone(st);
  d.heist.bestWorld = 20;
  const rng = new Rng(seed);
  const ev: CoreEvent[] = [];
  expect(startHeist(d, location, rng, T0, ev)).toBe(true);
  return { d, rng, ev, run: d.heist.run! };
}

/** Ticks the heist battle until `done` (or throws after `max` ticks). */
function tickUntil(d: GameState, rng: Rng, ev: CoreEvent[], done: (run: HeistRun) => boolean, max = 20_000): void {
  for (let i = 0; i < max; i++) {
    if (done(d.heist.run!)) return;
    heistTick(d, rng, T0, ev, TICK_SECONDS);
  }
  throw new Error('condition never met');
}

/** The stock of the shop the run is in. */
function shopStock(run: HeistRun) {
  return (run.pending as Extract<HeistRun['pending'], { kind: 'shop' }>).stock;
}

/** Makes the next stop a fight (or `kind`) and walks into it. */
function goTo(d: GameState, rng: Rng, ev: CoreEvent[], kind: HeistNodeKind = 'fight'): void {
  const run = d.heist.run!;
  run.nodes[run.act - 1][run.index] = kind;
  expect(heistGo(d, rng, ev)).toBe(true);
}

describe('heist tickets', () => {
  it('start at 3, refill 3 at each local midnight up to 6, and a run spends one', () => {
    const st = clone(freshState());
    expect(st.heist.tickets).toBe(3);
    expect(st.heist.ticketDay).toBe(dayKey(T0));
    const ev: CoreEvent[] = [];
    refreshTickets(st, T0 + 3_600_000, ev);
    expect(st.heist.tickets).toBe(3);
    expect(ev).toHaveLength(0);
    // The next local day: +3, capped at 6.
    const midnight = new Date(2026, 0, 6, 0, 0, 30).getTime();
    refreshTickets(st, midnight, ev);
    expect(st.heist.tickets).toBe(6);
    expect(ev).toContainEqual({ type: 'heistTickets', tickets: 6 });
    // Spend two, skip three days: back to the cap, never past it.
    st.heist.tickets = 1;
    refreshTickets(st, midnight + 3 * DAY, ev);
    expect(st.heist.tickets).toBe(6);
    // A clock that went backward gives nothing (and doesn't reset the day).
    st.heist.tickets = 0;
    refreshTickets(st, midnight - 2 * DAY, ev);
    expect(st.heist.tickets).toBe(0);
    expect(st.heist.ticketDay).toBe(dayKey(midnight + 3 * DAY));
  });

  it('a run costs a ticket; no ticket, no run; one ad ticket a day, never past the cap', () => {
    const rng = new Rng(1);
    let st = clone(freshState());
    st.rebirths = H.unlockRebirths;
    let r = applyAction(st, { type: 'heistStart', location: 'pizza' }, rng, T0);
    expect(r.state.heist.tickets).toBe(2);
    expect(r.events).toContainEqual({ type: 'heistTickets', tickets: 2 });
    expect(r.state.heist.run?.location).toBe('pizza');
    st = clone(r.state);
    st.heist.run = null;
    st.heist.tickets = 0;
    r = applyAction(st, { type: 'heistStart', location: 'pizza' }, rng, T0);
    expect(r.state.heist.run).toBeNull();
    r = applyAction(st, { type: 'heistAdTicket' }, rng, T0);
    expect(r.state.heist.tickets).toBe(1);
    expect(r.state.heist.adTicketDay).toBe(dayKey(T0));
    expect(applyAction(r.state, { type: 'heistAdTicket' }, rng, T0).state.heist.tickets).toBe(1);
    const full = clone(r.state);
    full.heist.tickets = H.tickets.max;
    full.heist.adTicketDay = null;
    expect(applyAction(full, { type: 'heistAdTicket' }, rng, T0).state.heist.tickets).toBe(H.tickets.max);
  });

  it('open with the first rebirth: before it a run or an ad ticket does nothing (tickets still come in), after it both work', () => {
    const rng = new Rng(5);
    const st = clone(freshState());
    expect(heistsOpen(st)).toBe(false);
    let r = applyAction(st, { type: 'heistStart', location: 'pizza' }, rng, T0);
    expect(r.state.heist.run).toBeNull();
    expect(r.state.heist.tickets).toBe(H.tickets.start);
    r = applyAction(st, { type: 'heistAdTicket' }, rng, T0);
    expect(r.state.heist.tickets).toBe(H.tickets.start);
    // The daily tickets keep coming meanwhile.
    const tomorrow = new Date(2026, 0, 6, 9, 0, 0).getTime();
    const waited = tick(st, { ticks: 1 }, rng, tomorrow).state;
    expect(waited.heist.tickets).toBe(Math.min(H.tickets.max, H.tickets.start + H.tickets.perDay));
    const reborn = clone(waited);
    reborn.rebirths = H.unlockRebirths;
    expect(heistsOpen(reborn)).toBe(true);
    expect(applyAction(reborn, { type: 'heistStart', location: 'pizza' }, rng, tomorrow).state.heist.run?.location).toBe('pizza');
  });

  it('locations open with the best world beaten: the Mall after World 5 (or any rebirth), the Hotel after World 10', () => {
    const st = clone(freshState());
    const rng = new Rng(2);
    const ev: CoreEvent[] = [];
    expect(startHeist(clone(st), 'mall', rng, T0, ev)).toBe(false);
    st.rebirths = 1;
    expect(startHeist(clone(st), 'mall', rng, T0, ev)).toBe(true);
    expect(startHeist(clone(st), 'hotel', rng, T0, ev)).toBe(false);
    st.heist.bestWorld = 10;
    expect(startHeist(clone(st), 'hotel', rng, T0, ev)).toBe(true);
  });
});

describe('heist stops', () => {
  it('roll with the weights of their act', () => {
    const rng = new Rng(4);
    for (const act of [1, 2, 3]) {
      const w = H.nodeWeights[act - 1];
      const total = HEIST_ROLLED_KINDS.reduce((s, k) => s + w[k], 0);
      const counts = new Map<string, number>();
      const n = 3000;
      for (let i = 0; i < n; i++) for (const k of rollActNodes(act, rng)) counts.set(k, (counts.get(k) ?? 0) + 1);
      for (const k of HEIST_ROLLED_KINDS) {
        expect(Math.abs((counts.get(k) ?? 0) / (n * H.nodesPerAct) - w[k] / total), `act ${act} ${k}`).toBeLessThan(0.015);
      }
    }
  });

  it('open with a fight, have a shop in act 2 when the run can pay, enough fights, no elites in act 1, and end with the boss', () => {
    const rng = new Rng(5);
    const rich = { perks: [], absorbed: [], curses: [], coins: shopMinCoins(), nodes: [] as HeistNodeKind[][] };
    let golden = 0;
    let treasures = 0;
    for (let i = 0; i < 3000; i++) {
      const a1 = generateAct(rich, 1, rng);
      const a2 = generateAct(rich, 2, rng);
      const a3 = generateAct({ ...rich, nodes: [a1, a2] }, 3, rng);
      expect(a1).toHaveLength(H.nodesPerAct);
      expect(a1[0]).toBe('fight');
      expect(a1).not.toContain('elite');
      expect(a2).toContain('shop');
      expect(a3).toHaveLength(H.nodesPerAct + 1);
      expect(a3[H.nodesPerAct]).toBe('boss');
      for (const [act, a] of [[1, a1], [2, a2], [3, a3]] as const) {
        expect(a.filter((k) => k === 'fight' || k === 'elite').length).toBeGreaterThanOrEqual(H.minFights[act - 1]);
        golden += a.filter((k) => k === 'golden').length;
        treasures += a.filter((k) => k === 'treasure' || k === 'golden').length;
      }
    }
    // A Golden Dumpster replaces about 1% of treasures.
    expect(golden).toBeGreaterThan(0);
    expect(golden / treasures).toBeLessThan(0.025);
  });

  it('wait for money: no shop in an act laid out before the run can pay for a perk, and the sure shop moves on to act 3', () => {
    const rng = new Rng(12);
    const min = shopMinCoins();
    expect(min).toBe(Math.min(H.shop.prices.common, H.shop.prices.rare, H.shop.prices.epic));
    // A run starts short of it, so act 1 never has a shop.
    expect(H.coins.start).toBeLessThan(min);
    const broke = { perks: [], absorbed: [], curses: [], coins: min - 1, nodes: [] as HeistNodeKind[][] };
    const rich = { ...broke, coins: min };
    let richShops = 0;
    for (let i = 0; i < 2000; i++) {
      for (const act of [1, 2, 3]) expect(generateAct(broke, act, rng)).not.toContain('shop');
      // Broke in act 2, saved up by act 3: act 3 gets the run's sure shop.
      const a2 = generateAct(broke, 2, rng);
      expect(generateAct({ ...rich, nodes: [[], a2] }, 3, rng)).toContain('shop');
      // A shop in act 2 already: act 3's shops are only the rolled ones.
      richShops += generateAct({ ...rich, nodes: [[], ['shop']] }, 3, rng).filter((k) => k === 'shop').length;
    }
    const w = H.nodeWeights[2];
    const share = w.shop / HEIST_ROLLED_KINDS.reduce((s, k) => s + w[k], 0);
    expect(richShops / 2000).toBeGreaterThan(share * H.nodesPerAct * 0.7);
    expect(richShops / 2000).toBeLessThan(share * H.nodesPerAct * 1.3);
  });

  it('a whole run lays acts out with its coins: act 1 never has a shop, act 2 has one exactly when the run could pay', () => {
    const seen = { rich: 0, broke: 0 };
    for (let seed = 0; seed < 40; seed++) {
      const { d, rng, ev, run } = started(raccoon(10), 'pizza', 200 + seed);
      expect(run.nodes[0]).not.toContain('shop');
      run.difficulty = 0.05;
      // Play act 1 out; the step that ends it lays act 2 out with the coins the run has right then.
      for (let guard = 0; guard < 20_000 && run.act === 1; guard++) {
        if (run.pending) {
          if (run.pending.kind === 'shop') heistLeaveShop(d, rng);
          else if (!heistChoose(d, run.pending.kind === 'shrine' ? 1 : 0, rng, ev)) heistChoose(d, 1, rng, ev);
        } else if (run.status === 'ready' && d.battle.phase !== 'walking') heistGo(d, rng, ev);
        else heistTick(d, rng, T0, ev, TICK_SECONDS);
      }
      expect(run.act).toBe(2);
      const rich = run.coins >= shopMinCoins();
      seen[rich ? 'rich' : 'broke'] += 1;
      expect(run.nodes[1].includes('shop'), `seed ${seed}: ${run.coins} coins`).toBe(rich);
    }
    // (Both cases came up.)
    expect(seen.rich).toBeGreaterThan(0);
    expect(seen.broke).toBeGreaterThan(0);
  });

  it('Bin Diver adds a treasure to every act, Smelly a fight', () => {
    const count = (perks: string[], curses: string[], kind: string) => {
      const rng = new Rng(6);
      let n = 0;
      for (let i = 0; i < 2000; i++) n += generateAct({ perks, absorbed: [], curses, coins: 100, nodes: [] }, 2, rng).filter((k) => k === kind).length;
      return n / 2000;
    };
    expect(count(['bin_diver'], [], 'treasure') - count([], [], 'treasure')).toBeGreaterThan(0.8);
    expect(count([], ['smelly'], 'fight') - count([], [], 'fight')).toBeGreaterThan(0.6);
  });
});

describe('heist fights', () => {
  it('play in the battle with the location\'s enemies, pay run XP and coins, and the Alley comes back exactly as it was', () => {
    // An Alley battle in the middle of a wave.
    const rng0 = new Rng(7);
    let st = freshState(7);
    for (let i = 0; i < 40; i++) st = tick(st, { ticks: 1 }, rng0, T0 + i * 100).state;
    st = clone(st);
    expect(st.battle.enemies.length).toBeGreaterThan(0);
    const alley = structuredClone(st.battle);
    const stage = structuredClone(st.stage);
    const { d, rng, ev, run } = started(st);
    // (Mechanics, not balance: an easy fight.)
    run.difficulty = 0.2;
    expect(d.battle.stage).toBe(DATA.heistLocationsById.get('pizza')!.world);
    expect(d.battle.phase).toBe('idle');
    expect(d.battle.enemies).toEqual([]);
    expect(ev.some((e) => e.type === 'stageStart')).toBe(true);
    // The first stop is a fight.
    expect(run.nodes[0][0]).toBe('fight');
    expect(heistGo(d, rng, ev)).toBe(true);
    expect(run.status).toBe('fighting');
    expect(d.battle.phase).toBe('walking');
    tickUntil(d, rng, ev, () => d.battle.phase === 'fighting');
    const roster = new Set(DATA.heistLocationsById.get('pizza')!.enemies);
    expect(d.battle.enemies.length).toBeGreaterThanOrEqual(H.enemies.fightSize[0].min);
    for (const e of d.battle.enemies) expect(roster.has(e.enemyId), e.enemyId).toBe(true);
    const coins = run.coins;
    tickUntil(d, rng, ev, (r) => r.status !== 'fighting');
    expect(run.status).toBe('ready');
    expect(ev).toContainEqual({ type: 'heistFightEnd', won: true });
    expect(run.xp).toBeGreaterThan(0);
    expect(run.coins).toBeGreaterThan(coins);
    expect(run.index).toBe(1);
    expect(d.battle.phase).toBe('idle');
    // Kills paid run rewards, not world rewards.
    expect(d.currencies.coins).toBe(st.currencies.coins);
    expect(d.lifetime.kills).toBe(st.lifetime.kills);
    // The Alley never moved.
    expect(d.stage).toEqual(stage);
    const end: CoreEvent[] = [];
    heistAbandon(d, rng, T0, end);
    expect(d.heist.run).toBeNull();
    expect({ ...d.battle, nextEnemyUid: 0 }).toEqual({ ...alley, nextEnemyUid: 0 });
    expect(d.battle.nextEnemyUid).toBeGreaterThanOrEqual(alley.nextEnemyUid);
    expect(end.some((e) => e.type === 'heistEnd' && !e.won)).toBe(true);
  });

  it('run at twice the speed, through the public tick', () => {
    const rng = new Rng(8);
    const open = clone(freshState(8));
    open.rebirths = H.unlockRebirths;
    let st = applyAction(open, { type: 'heistStart', location: 'pizza' }, rng, T0).state;
    st = applyAction(st, { type: 'heistGo' }, rng, T0).state;
    const walk = BAL.combat.walkSeconds;
    // The walk-in takes half as long as it says.
    const ticks = Math.ceil(walk / TICK_SECONDS / H.fightSpeed);
    st = tick(st, { ticks: ticks - 1 }, rng, T0).state;
    expect(st.battle.phase).toBe('walking');
    st = tick(st, { ticks: 1 }, rng, T0).state;
    expect(st.battle.phase).toBe('fighting');
  });

  it('keep the reels rolling in the Alley\'s world; travel and rebirth wait for the run', () => {
    const st = raccoon();
    st.dumpster.firstDiveDone = true;
    st.dumpster.beginner = { state: 'done', uid: null };
    st.stage.highestCleared = 6;
    st.battle.stage = 6;
    st.stage.current = 6;
    const { d, rng } = started(st);
    expect(d.battle.stage).not.toBe(6);
    expect(itemTierFor(d)).toBe(6);
    const items = performSpin(d, rng, T0, []);
    for (const it of items) expect(it.tier).toBe(6);
    expect(travelTo(d, 3, [])).toBe(false);
    d.currencies.coins = 1e30;
    expect(canRebirth(d)).toBe(false);
  });

  it('survive a save and a reload mid-run (the waiting Alley battle restarts its world cleanly)', () => {
    const { d, rng, ev } = started();
    heistGo(d, rng, ev);
    tickUntil(d, rng, ev, () => d.battle.phase === 'fighting');
    const loaded = deserialize(serialize(d));
    expect(loaded).not.toBeNull();
    expect(loaded).toEqual(GameStateSchema.parse(JSON.parse(serialize(d))));
    const l = loaded!;
    heistBoot(l);
    expect(l.heist.run!.main.wave).toBe(0);
    expect(l.heist.run!.main.enemies).toEqual([]);
    expect(l.battle.enemies.length).toBeGreaterThan(0);
  });
});

describe('heist perks change combat', () => {
  /** Hits, blocks, helpers and stuns in `ticks` ticks of the first fight, with `perks`. */
  function fight(perks: string[], ticks = 120) {
    const { d, rng, ev, run } = started(raccoon(10), 'pizza', 11);
    for (const p of perks) gainPerk(d, run, p, rng, ev);
    ev.length = 0;
    heistGo(d, rng, ev);
    tickUntil(d, rng, ev, () => d.battle.phase === 'fighting');
    // Plenty of tough enemies so the fight lasts.
    for (const e of d.battle.enemies) {
      e.hp *= 50;
      e.maxHp *= 50;
    }
    for (let i = 0; i < ticks && run.status === 'fighting'; i++) heistTick(d, rng, T0, ev, TICK_SECONDS);
    const n = (t: CoreEvent['type']) => ev.filter((e) => e.type === t).length;
    return { d, run, ev, hits: n('playerHit'), blocks: n('heistBlock'), helpers: n('heistHelper'), stuns: n('heistStun'), burns: n('burn') };
  }

  it('Sugar High swings faster, Thick Fur adds max HP, Zoomies and Lucky Penny add their stats', () => {
    expect(fight(['sugar_high']).hits).toBeGreaterThan(fight([]).hits * 1.15);
    const { d, run } = started();
    const before = run.maxHp;
    const hp = run.hp;
    gainPerk(d, run, 'thick_fur', new Rng(1), []);
    expect(run.maxHp).toBeCloseTo(before * 1.25);
    expect(run.hp).toBeCloseTo(hp + before * 0.25);
    gainPerk(d, run, 'zoomies', new Rng(1), []);
    gainPerk(d, run, 'lucky_penny', new Rng(1), []);
    const s = runStats(d, run);
    expect(s.DODGE).toBeCloseTo(15);
    expect(s.CRIT).toBeCloseTo(BAL.player.base.CRIT + 10);
  });

  it('Lid Shield blocks the first hit, Pigeon Pal pecks, Pocket Sand stuns, Hot Sauce burns', () => {
    const plain = fight([]);
    expect(plain.blocks + plain.helpers + plain.stuns + plain.burns).toBe(0);
    const lid = fight(['lid_shield']);
    expect(lid.blocks).toBe(1);
    const firstBlock = lid.ev.findIndex((e) => e.type === 'heistBlock');
    expect(lid.ev.findIndex((e) => e.type === 'enemyHit')).toBeGreaterThan(firstBlock);
    expect(fight(['pigeon_pal']).helpers).toBeGreaterThanOrEqual(4);
    expect(fight(['pocket_sand']).stuns).toBeGreaterThan(0);
    expect(fight(['hot_sauce']).burns).toBeGreaterThan(0);
  });

  it('Snack Break heals after a fight; Nine Lives gets back up once', () => {
    const { d, rng, ev, run } = started(raccoon(10));
    gainPerk(d, run, 'snack_break', rng, ev);
    heistGo(d, rng, ev);
    tickUntil(d, rng, ev, () => d.battle.phase === 'fighting');
    run.hp = d.battle.playerHp = run.maxHp * 0.3;
    tickUntil(d, rng, ev, (r) => r.status !== 'fighting');
    expect(run.log.some((l) => l.key === 'heist.log.snack')).toBe(true);

    const k = started(raccoon(3));
    gainPerk(k.d, k.run, 'nine_lives', k.rng, k.ev);
    k.run.difficulty = 200;
    heistGo(k.d, k.rng, k.ev);
    tickUntil(k.d, k.rng, k.ev, (r) => r.status !== 'fighting');
    expect(k.run.flags.nineLivesUsed).toBe(true);
    expect(k.run.log.some((l) => l.key === 'heist.log.nineLives')).toBe(true);
  });
});

describe('heist perk offers and evolutions', () => {
  it('a level-up offers 3 perks; rerolls are free once, then cost Gems', () => {
    const { d, rng, ev, run } = started(raccoon(10));
    run.xp = H.levels[0] - 0.5;
    heistGo(d, rng, ev);
    tickUntil(d, rng, ev, (r) => r.status !== 'fighting');
    expect(run.level).toBeGreaterThanOrEqual(2);
    expect(ev.some((e) => e.type === 'heistLevelUp')).toBe(true);
    expect(run.pending?.kind).toBe('perk');
    expect(heistGo(d, rng, ev)).toBe(false);
    const p = run.pending as Extract<HeistRun['pending'], { kind: 'perk' }>;
    expect(p.options).toHaveLength(H.offerSize);
    expect(new Set(p.options.map((o) => o.id)).size).toBe(H.offerSize);
    d.currencies.gems = H.rerolls.gems;
    expect(applyAction(d, { type: 'heistReroll' }, rng, T0).state.currencies.gems).toBe(H.rerolls.gems);
    const once = applyAction(d, { type: 'heistReroll' }, rng, T0).state;
    const twice = applyAction(once, { type: 'heistReroll' }, rng, T0).state;
    expect(twice.currencies.gems).toBe(0);
    expect(twice.heist.run!.rerollsUsed).toBe(2);
    const picked = applyAction(twice, { type: 'heistChoose', index: 0 }, rng, T0).state;
    expect(picked.heist.run!.perks).toHaveLength(1);
    expect(picked.heist.run!.pending).toBeNull();
  });

  it('holding a recipe puts its evolution in the next offer, flagged; taking it merges the recipe', () => {
    const { d, rng, ev, run } = started();
    gainPerk(d, run, 'hot_sauce', rng, ev);
    gainPerk(d, run, 'dumpster_fire', rng, ev);
    const offer = makeOffer(run, rng);
    expect(offer[0]).toEqual({ id: 'five_alarm_raccoon', evolution: true });
    expect(gainPerk(d, run, 'five_alarm_raccoon', rng, ev)).toBe(true);
    expect(run.perks).toEqual(['five_alarm_raccoon']);
    expect(run.absorbed.sort()).toEqual(['dumpster_fire', 'hot_sauce']);
    const fx = runEffects(run);
    expect(fx.burnChance).toBeGreaterThan(0);
    expect(fx.burningBonusPct).toBeGreaterThan(0);
    expect(fx.burnSpread).toBeGreaterThan(0);
    expect(ev).toContainEqual({ type: 'heistPerk', id: 'five_alarm_raccoon', evolution: true });
    expect(makeOffer(run, rng).some((o) => o.evolution)).toBe(false);
  });

  it('Pigeon Air Force takes Pigeon Pal and any other crew perk; there are 6 evolutions, 27 perks (3 sold only in shops) and 3 curses', () => {
    const { d, rng, ev, run } = started();
    gainPerk(d, run, 'pigeon_pal', rng, ev);
    expect(makeOffer(run, rng).some((o) => o.evolution)).toBe(false);
    gainPerk(d, run, 'alley_cat', rng, ev);
    expect(makeOffer(run, rng)[0]).toEqual({ id: 'pigeon_air_force', evolution: true });
    gainPerk(d, run, 'pigeon_air_force', rng, ev);
    expect(runEffects(run).pigeons).toBe(3);
    expect(DATA.heistPerks.filter((p) => p.recipe)).toHaveLength(6);
    expect(DATA.heistPerks.filter((p) => !p.recipe)).toHaveLength(27);
    expect(DATA.heistPerks.filter((p) => p.shopOnly)).toHaveLength(3);
    expect(DATA.heistCurses).toHaveLength(3);
  });

  it('at most 8 perks (curses don\'t count); a full run is only offered evolutions', () => {
    const { d, rng, ev, run } = started();
    const plain = DATA.heistPerks.filter((p) => !p.recipe && !['hot_sauce', 'dumpster_fire'].includes(p.id)).map((p) => p.id);
    for (const id of plain.slice(0, 8)) expect(gainPerk(d, run, id, rng, ev)).toBe(true);
    expect(gainPerk(d, run, plain[8], rng, ev)).toBe(false);
    expect(gainCurse(d, run, 'paper_cuts', rng, ev)).toBe('paper_cuts');
    expect(run.perks).toHaveLength(8);
    expect(makeOffer(run, rng).every((o) => o.evolution)).toBe(true);
  });
});

describe('heist choices', () => {
  function atChoice(eventId: string) {
    const s = started();
    const { d, rng, ev, run } = s;
    run.nodes[0][0] = 'choice';
    run.pending = { kind: 'choice', eventId, options: DATA.heistEventsById.get(eventId)!.options.length };
    return { d, rng, ev, run };
  }

  it('there are 40 events in the data, each with 2 or 3 options and readable outcomes', () => {
    expect(DATA.heistEvents).toHaveLength(40);
    for (const e of DATA.heistEvents) {
      e.options.forEach((_, i) => {
        for (const line of optionPreview(e.id, i)) expect(DATA.strings[line.key], line.key).toBeTruthy();
      });
    }
  });

  it('apply their outcomes: coins and heals, an elite fight with double rewards, a chance of a perk', () => {
    const fish = atChoice('evt_cat_staring_contest');
    fish.run.coins = 50;
    fish.run.hp = fish.d.battle.playerHp = fish.run.maxHp / 2;
    expect(heistChoose(fish.d, 2, fish.rng, fish.ev)).toBe(true);
    expect(fish.run.coins).toBe(30);
    expect(fish.run.hp).toBeCloseTo(fish.run.maxHp * 0.8);
    expect(fish.run.pending).toBeNull();
    expect(fish.run.index).toBe(1);

    const hiss = atChoice('evt_cat_staring_contest');
    expect(heistChoose(hiss.d, 1, hiss.rng, hiss.ev)).toBe(true);
    expect(hiss.run.status).toBe('fighting');
    expect(hiss.run.fight).toMatchObject({ kind: 'elite', rewardMult: 2 });

    let penny = 0;
    const n = 400;
    for (let i = 0; i < n; i++) {
      const s = atChoice('evt_cat_staring_contest');
      s.rng = new Rng(100 + i);
      heistChoose(s.d, 0, s.rng, s.ev);
      if (s.run.perks.includes('lucky_penny')) penny++;
      else expect(s.run.hp).toBeLessThan(s.run.maxHp);
    }
    expect(Math.abs(penny / n - 0.6)).toBeLessThan(0.08);
  });

  it('an option the run can\'t pay for can\'t be picked', () => {
    const s = atChoice('evt_cat_staring_contest');
    s.run.coins = 5;
    expect(heistOptionAvailable(s.run, 2)).toBe(false);
    expect(heistChoose(s.d, 2, s.rng, s.ev)).toBe(false);
    expect(s.run.pending?.kind).toBe('choice');
  });

  it('a truce skips the fights of the next stops; a saved snack heals under its threshold', () => {
    const t = atChoice('evt_rat_truce');
    heistChoose(t.d, 0, t.rng, t.ev);
    t.run.nodes[0][1] = 'fight';
    t.run.nodes[0][2] = 'fight';
    heistGo(t.d, t.rng, t.ev);
    expect(t.run.status).toBe('ready');
    heistGo(t.d, t.rng, t.ev);
    expect(t.run.status).toBe('ready');
    expect(t.run.index).toBe(3);

    const b = atChoice('evt_half_burrito');
    heistChoose(b.d, 1, b.rng, b.ev);
    expect(b.run.flags.savedHeal).not.toBeNull();
    // Hurt, but not so badly that one hit knocks the raccoon out.
    b.run.hp = b.d.battle.playerHp = b.run.maxHp * 0.25;
    goTo(b.d, b.rng, b.ev);
    tickUntil(b.d, b.rng, b.ev, (r) => r.flags.savedHeal === null || r.status !== 'fighting');
    expect(b.run.log.some((l) => l.key === 'heist.log.savedHeal')).toBe(true);
  });

  it('shops sell perks for run coins and stay open until left; shrines trade max HP for an Epic perk', () => {
    const { d, rng, ev, run } = started();
    run.coins = 200;
    goTo(d, rng, ev, 'shop');
    const shop = run.pending as Extract<HeistRun['pending'], { kind: 'shop' }>;
    expect(shop.stock.map((s) => s.kind).slice(1)).toEqual(['perk', 'perk', 'reroll']);
    const perk = shop.stock[1];
    expect(heistChoose(d, 1, rng, ev)).toBe(true);
    expect(run.perks).toContain(perk.id);
    expect(run.coins).toBe(200 - perk.price);
    expect(heistChoose(d, 1, rng, ev)).toBe(false);
    expect(run.pending?.kind).toBe('shop');
    expect(applyAction(d, { type: 'heistLeaveShop' }, rng, T0).state.heist.run!.pending).toBeNull();

    const s = started();
    const max = s.run.maxHp;
    goTo(s.d, s.rng, s.ev, 'shrine');
    expect(heistChoose(s.d, 0, s.rng, s.ev)).toBe(true);
    expect(s.run.maxHp).toBeCloseTo(max * (1 - H.shrine.maxHpPct / 100));
    const offer = s.run.pending as Extract<HeistRun['pending'], { kind: 'perk' }>;
    for (const o of offer.options) expect(DATA.heistPerksById.get(o.id)!.rarity).toBe('epic');
  });

  it('a shop\'s first card is mostly a +max HP perk and only sometimes a Snack; its other perks are never +max HP ones', () => {
    const maxHp = (id: string) => (DATA.heistPerksById.get(id)?.effect.hpPct ?? 0) > 0;
    const n = 600;
    let heals = 0;
    let maxHps = 0;
    const sold = new Set<string>();
    const { d, rng, ev, run } = started();
    for (let i = 0; i < n; i++) {
      run.pending = null;
      goTo(d, rng, ev, 'shop');
      const stock = shopStock(run);
      const first = stock[0];
      if (first.kind === 'heal') heals += 1;
      else {
        expect(first.kind).toBe('perk');
        expect(maxHp(first.id), first.id).toBe(true);
        maxHps += 1;
        sold.add(first.id);
      }
      for (const s of stock.slice(1)) if (s.kind === 'perk') expect(maxHp(s.id), s.id).toBe(false);
    }
    // It was a Snack every time before; now it's one shop in four.
    expect(Math.abs(heals / n - (1 - H.shop.maxHpChance))).toBeLessThan(0.05);
    expect(maxHps / n).toBeGreaterThan(0.65);
    // Thick Fur and the shop-only ones all come up.
    for (const p of DATA.heistPerks.filter((x) => !x.recipe && maxHp(x.id))) expect(sold.has(p.id), p.id).toBe(true);
  });

  it('a shop sells a Snack when it has no +max HP perk to sell, and Fresh Stock keeps its +max HP card one', () => {
    // Every perk slot full: a +max HP perk couldn't be bought, so the counter has the Snack.
    const full = started();
    full.run.perks = DATA.heistPerks.filter((p) => !p.recipe && !p.shopOnly).slice(0, H.maxPerks).map((p) => p.id);
    for (let i = 0; i < 30; i++) {
      full.run.pending = null;
      goTo(full.d, full.rng, full.ev, 'shop');
      expect(shopStock(full.run)[0].kind).toBe('heal');
    }
    // Every +max HP perk held: the Snack again.
    const fat = started();
    fat.run.perks = DATA.heistPerks.filter((p) => (p.effect.hpPct ?? 0) > 0 && !p.recipe).map((p) => p.id);
    goTo(fat.d, fat.rng, fat.ev, 'shop');
    expect(shopStock(fat.run)[0].kind).toBe('heal');
    // Fresh Stock: the +max HP card becomes another +max HP perk, the others other perks.
    for (let seed = 0; seed < 40; seed++) {
      const { d, rng, ev, run } = started(raccoon(), 'pizza', 3000 + seed);
      run.coins = 500;
      goTo(d, rng, ev, 'shop');
      const stock = shopStock(run);
      if (stock[0].kind !== 'perk') continue;
      const before = stock.map((s) => s.id);
      expect(heistChoose(d, stock.length - 1, rng, ev)).toBe(true);
      expect(stock[0].id).not.toBe(before[0]);
      expect(DATA.heistPerksById.get(stock[0].id)!.effect.hpPct).toBeGreaterThan(0);
      for (const s of stock.slice(1, 3)) expect(DATA.heistPerksById.get(s.id)!.effect.hpPct ?? 0).toBe(0);
    }
  });

  it('shop-only perks are never offered at a level-up, a shrine, the wheel or a choice', () => {
    const rng = new Rng(77);
    const none = { perks: [] as string[], absorbed: [] as string[] };
    for (let i = 0; i < 3000; i++) {
      for (const o of makeOffer(none, rng)) expect(DATA.heistPerksById.get(o.id)!.shopOnly, o.id).toBeFalsy();
      for (const o of makeOffer(none, rng, 'common')) expect(DATA.heistPerksById.get(o.id)!.shopOnly, o.id).toBeFalsy();
    }
    // A choice's random tank perk (Wear a box) isn't one either.
    for (let i = 0; i < 200; i++) {
      const s = started(raccoon(), 'pizza', 500 + i);
      s.run.pending = { kind: 'choice', eventId: 'evt_cardboard_fort', options: 2 };
      heistChoose(s.d, 1, s.rng, s.ev);
      for (const id of s.run.perks) expect(DATA.heistPerksById.get(id)!.shopOnly, id).toBeFalsy();
    }
  });
});

describe('heist traps', () => {
  const at = (id: LocationId) => DATA.heistTraps.filter((tr) => !tr.locations || tr.locations.includes(id));

  it('come in at least 15 named kinds, each with its line, and plenty fit each location', () => {
    expect(DATA.heistTraps.length).toBeGreaterThanOrEqual(15);
    for (const tr of DATA.heistTraps) {
      expect(tr.name).toBe(DATA.strings[`heist.trap.${tr.id}.name`]);
      expect(tr.text).toBe(DATA.strings[`heist.trap.${tr.id}.text`]);
    }
    for (const id of LOCATION_IDS) expect(at(id).length, id).toBeGreaterThanOrEqual(10);
  });

  it('a trap stop names its trap in the log, sprung or seen coming, one that fits the place, the same after a reload', () => {
    const { d, rng, ev, run } = started(raccoon(), 'mall');
    goTo(d, rng, ev, 'trap');
    const trap = heistTrapAt(run, 1, 0);
    expect(at('mall')).toContainEqual(trap);
    expect(run.log).toContainEqual({ key: 'heist.log.trapSprung', params: { trap: trap.name, text: trap.text } });
    // Saved and loaded, the stop it passed still names the same trap.
    const loaded = deserialize(serialize(d))!;
    expect(heistTrapAt(loaded.heist.run!, 1, 0)).toEqual(trap);
    // One seen coming (a choice took the act's traps away) is named too, and it's the next one in line.
    run.flags.noTrapsAct = run.act;
    goTo(d, rng, ev, 'trap');
    const next = heistTrapAt(run, 1, 1);
    expect(next.id).not.toBe(trap.id);
    expect(run.log.at(-1)).toEqual({ key: 'heist.log.trapSpotted', params: { trap: next.name } });
  });

  it('come in a new order each run, none twice in a run until the place runs out, and only reached stops count', () => {
    const trapsOnly = (): HeistNodeKind[][] => [Array(6).fill('trap'), Array(6).fill('trap'), [...Array(6).fill('trap'), 'boss']];
    for (const location of LOCATION_IDS) {
      const run = { location, startedAt: T0, nodes: trapsOnly() };
      const ids = [1, 2, 3].flatMap((act) => [0, 1, 2, 3, 4, 5].map((i) => heistTrapAt(run, act, i).id));
      const n = at(location).length;
      expect(new Set(ids.slice(0, n)).size).toBe(n);
      // What comes after a stop doesn't change it.
      const changed = { ...run, nodes: trapsOnly() };
      changed.nodes[0][4] = 'fight';
      expect(heistTrapAt(changed, 1, 3)).toEqual(heistTrapAt(run, 1, 3));
    }
    const firsts = new Set(Array.from({ length: 40 }, (_, i) => heistTrapAt({ location: 'pizza', startedAt: T0 + i * 7919, nodes: [] }, 1, 0).id));
    expect(firsts.size).toBeGreaterThan(5);
  });

  it('still curse half the time and otherwise hurt by heist.trap.damagePct, whichever trap it is', () => {
    let curses = 0;
    const n = 300;
    for (let i = 0; i < n; i++) {
      const s = started(raccoon(), 'pizza', 4000 + i);
      const max = s.run.maxHp;
      goTo(s.d, s.rng, s.ev, 'trap');
      if (s.run.curses.length > 0) curses += 1;
      else expect(s.run.hp).toBeCloseTo(max * (1 - H.trap.damagePct / 100));
    }
    expect(Math.abs(curses / n - H.trap.curseChance)).toBeLessThan(0.08);
  });
});

describe('heist fight events', () => {
  const NAMED: Array<[string, RegExp]> = [['rat', /\brats?\b/i], ['pigeon', /\bpigeons?\b/i], ['raccoon', /\braccoons?\b/i]];
  const fightOptions = (e: HeistEventDef) =>
    e.options.map((o, i) => ({ o, i })).filter(({ o }) => o.outcomes.some((x) => x.type === 'fight' || x.type === 'eliteFight'));
  const shape = (id: string) => DATA.assets.placeholders.enemies[id]?.shape;

  it('an event that names a rat, pigeon or raccoon and can start a fight promises that foe (and only such events do)', () => {
    let named = 0;
    for (const e of DATA.heistEvents) {
      const fights = fightOptions(e);
      if (fights.length === 0) continue;
      const words = [e.text, ...fights.map(({ o }) => o.label)].join(' ');
      const kinds = NAMED.filter(([, re]) => re.test(words)).map(([k]) => k);
      expect(kinds.length, e.id).toBeLessThanOrEqual(1);
      expect(e.foe, e.id).toBe(kinds[0]);
      if (kinds.length > 0) named += 1;
    }
    expect(named).toBeGreaterThanOrEqual(4);
  });

  it('a fight such an event starts brings only that foe, at every location (the pigeon gang brings pigeons)', () => {
    for (const e of DATA.heistEvents.filter((x) => x.foe)) {
      const opt = fightOptions(e)[0].i;
      for (const location of e.locations ?? LOCATION_IDS) {
        let fights = 0;
        for (let seed = 0; seed < 40 && fights < 3; seed++) {
          const s = started(raccoon(), location, 700 + seed);
          s.run.coins = 100;
          s.run.nodes[0][0] = 'choice';
          s.run.seen.push(e.id);
          s.run.pending = { kind: 'choice', eventId: e.id, options: e.options.length };
          expect(heistChoose(s.d, opt, s.rng, s.ev)).toBe(true);
          // (An option that only might come to a fight.)
          if (s.run.status !== 'fighting') continue;
          tickUntil(s.d, s.rng, s.ev, () => s.d.battle.phase === 'fighting');
          const regulars = s.d.battle.enemies.filter((x) => x.kind === 'regular');
          expect(regulars.length).toBeGreaterThan(0);
          for (const x of regulars) expect(shape(x.enemyId), `${e.id} at ${location}: ${x.enemyId}`).toBe(e.foe);
          fights += 1;
        }
        expect(fights, `${e.id} at ${location}`).toBeGreaterThan(0);
      }
    }
  });

  it('a plain fight stop still brings any of the place\'s enemies', () => {
    const kinds = new Set<string | undefined>();
    for (let seed = 0; seed < 20; seed++) {
      const s = started(raccoon(), 'pizza', 800 + seed);
      goTo(s.d, s.rng, s.ev);
      tickUntil(s.d, s.rng, s.ev, () => s.d.battle.phase === 'fighting');
      for (const x of s.d.battle.enemies) kinds.add(shape(x.enemyId));
    }
    expect([...kinds].sort()).toEqual(['pigeon', 'raccoon', 'rat']);
  });
});

describe('heist endings', () => {
  /** A run at its boss, with the raccoon far too strong (or too weak) for it. */
  function atBoss(difficulty: number) {
    const s = started(raccoon(12));
    s.run.act = 3;
    s.run.nodes.push(generateAct(s.run, 2, s.rng), generateAct(s.run, 3, s.rng));
    s.run.index = H.nodesPerAct;
    s.run.difficulty = difficulty;
    expect(heistGo(s.d, s.rng, s.ev)).toBe(true);
    expect(s.run.fight?.kind).toBe('boss');
    return s;
  }

  it('a win pays the location\'s Trash Bags, gold, Gems and a Luck Potion (Garbage Day adds half the bags)', () => {
    const { d, rng, ev, run } = atBoss(0.01);
    gainPerk(d, run, 'garbage_day', rng, ev);
    tickUntil(d, rng, ev, (r) => r.status !== 'fighting');
    expect(run.status).toBe('won');
    expect(d.heist.wins.pizza).toBe(1);
    const L = H.locations.pizza;
    expect(run.rewards).toMatchObject({ bags: L.bags, gems: L.gems, potion: true });
    expect(run.rewards.coins).toBeGreaterThan(0);
    const before = { ...d.currencies };
    const end: CoreEvent[] = [];
    expect(heistClaim(d, rng, T0, end)).toBe(true);
    expect(d.currencies.bags - before.bags).toBe(Math.floor(L.bags * 1.5));
    expect(d.currencies.gems - before.gems).toBe(L.gems);
    expect(d.currencies.coins - before.coins).toBe(run.rewards.coins);
    expect(d.luckBoostEndsAt).not.toBeNull();
    expect(end.find((e) => e.type === 'heistEnd')).toMatchObject({ won: true, rewards: { bags: Math.floor(L.bags * 1.5) } });
    expect(d.heist.run).toBeNull();
  });

  it('a win can drop the location\'s ring, rolled Legendary or better, into the bag', () => {
    const chance = H.ring.chance;
    H.ring.chance = 1;
    try {
      const { d, rng, ev } = atBoss(0.01);
      tickUntil(d, rng, ev, (r) => r.status !== 'fighting');
      expect(d.heist.run!.rewards.ring).toBe('ring_pizza_cutter');
      const end: CoreEvent[] = [];
      heistClaim(d, rng, T0, end);
      const ring = d.inventory.find((it) => it.baseId === 'ring_pizza_cutter');
      expect(ring).toBeDefined();
      expect(['legendary', 'mythic', 'vintage', 'limited', 'prototype', 'mint', 'gemMint', 'museum', 'grail']).toContain(ring!.rarity);
      expect(end.find((e) => e.type === 'heistEnd')).toMatchObject({ item: { baseId: 'ring_pizza_cutter' } });
    } finally {
      H.ring.chance = chance;
    }
    // The dumpster itself never rolls a heist ring.
    const st = clone(freshState(3));
    st.dumpster.firstDiveDone = true;
    const rng = new Rng(9);
    for (let i = 0; i < 1500; i++) for (const it of performSpin(st, rng, T0, [])) expect(DATA.itemsById.get(it.baseId)!.heist).toBeUndefined();
  });

  it('a knockout offers one Second Chance (free ad or 50 Gems) at half HP; the next knockout loses the run', () => {
    const { d, rng, ev, run } = atBoss(60);
    run.rewards = { bags: 10, coins: 100, gems: 4, potion: false, ring: null };
    tickUntil(d, rng, ev, (r) => r.status !== 'fighting');
    expect(run.status).toBe('secondChance');
    expect(d.battle.phase).toBe('dead');
    expect(ev.some((e) => e.type === 'playerDeath')).toBe(true);
    d.currencies.gems = H.revive.gems - 1;
    expect(heistRevive(d, 'gems', ev)).toBe(false);
    d.currencies.gems = H.revive.gems;
    expect(heistRevive(d, 'gems', ev)).toBe(true);
    expect(d.currencies.gems).toBe(0);
    expect(run.status).toBe('fighting');
    expect(run.hp).toBeCloseTo((run.maxHp * H.revive.hpPct) / 100);
    expect(d.battle.phase).toBe('fighting');
    tickUntil(d, rng, ev, (r) => r.status !== 'fighting');
    expect(run.status).toBe('lost');
    expect(heistRevive(d, 'ad', ev)).toBe(false);
    // A loss keeps half of what was collected, never the potion or the ring.
    expect(run.rewards).toEqual({ bags: 5, coins: 50, gems: 2, potion: false, ring: null });
    const before = d.currencies.bags;
    heistClaim(d, rng, T0, ev);
    expect(d.currencies.bags - before).toBe(5);
    expect(d.heist.wins.pizza).toBe(0);
  });

  it('declining the Second Chance loses the run at once', () => {
    const { d, rng, ev, run } = atBoss(60);
    tickUntil(d, rng, ev, (r) => r.status !== 'fighting');
    expect(heistRevive(d, 'ad', ev) || heistDecline(d)).toBe(true);
    if (run.status === 'fighting') {
      // (The ad revive went through: lose again.)
      tickUntil(d, rng, ev, (r) => r.status !== 'fighting');
    }
    expect(run.status).toBe('lost');
    const s = atBoss(60);
    tickUntil(s.d, s.rng, s.ev, (r) => r.status !== 'fighting');
    expect(heistDecline(s.d)).toBe(true);
    expect(s.run.status).toBe('lost');
    expect(s.run.revived).toBe(false);
  });
});

describe('heist log and saves', () => {
  it('every log line of a whole run has its English text, with no placeholder left', () => {
    const res = simulateHeistLog();
    for (const line of res) {
      const raw = DATA.strings[line.key];
      expect(raw, line.key).toBeTruthy();
      const text = raw.replace(/\{(\w+)\}/g, (_, k: string) => (line.params?.[k] !== undefined ? String(line.params[k]) : `{${k}}`));
      expect(text, line.key).not.toMatch(/\{\w+\}/);
    }
  });

  it('a version 7 save migrates with 3 tickets and no run', () => {
    const v7 = JSON.parse(serialize(freshState())) as Record<string, unknown>;
    v7.saveVersion = 7;
    delete v7.heist;
    const loaded = deserialize(JSON.stringify(v7))!;
    expect(loaded.heist).toMatchObject({ tickets: 3, ticketDay: '', run: null, wins: { pizza: 0, mall: 0, hotel: 0 } });
    const ev: CoreEvent[] = [];
    refreshTickets(loaded, T0 + 2 * DAY, ev);
    expect(loaded.heist.tickets).toBe(3);
  });
});

/** The log of a few whole runs played by the balance bot, plus every choice and wheel line. */
function simulateHeistLog() {
  const st = raccoon(10);
  const lines: HeistRun['log'] = [];
  for (let seed = 0; seed < 6; seed++) {
    const { d, rng, ev } = started(st, 'pizza', 50 + seed);
    for (let guard = 0; guard < 50_000; guard++) {
      const run = d.heist.run!;
      if (run.status === 'won' || run.status === 'lost') break;
      if (run.status === 'secondChance') {
        heistRevive(d, 'ad', ev) || heistDecline(d);
        continue;
      }
      if (run.pending) {
        if (run.pending.kind === 'shop') {
          heistChoose(d, 0, rng, ev);
          heistLeaveShop(d, rng);
        } else if (!heistChoose(d, run.pending.kind === 'shrine' ? 0 : guard % 3, rng, ev)) {
          heistChoose(d, run.pending.kind === 'shrine' ? 1 : 0, rng, ev);
        }
        continue;
      }
      if (run.status === 'ready' && d.battle.phase !== 'walking') heistGo(d, rng, ev);
      else heistTick(d, rng, T0, ev, TICK_SECONDS);
    }
    lines.push(...d.heist.run!.log);
  }
  return lines;
}

describe('heist balance', () => {
  // tools/heistSim.ts runs the full picture (every location, raccoons from 5 minutes to 3 hours).
  it('the first Pizza Place run is won about 85% of the time by a 10-minute raccoon', () => {
    let wins = 0;
    let runs = 0;
    for (const seed of [1, 2, 3]) {
      const state = simulate({ minutes: 10, seed }).final;
      const r = simulateHeists({ state, location: 'pizza', runs: 30, seed, first: true });
      wins += r.wins;
      runs += r.runs;
    }
    const rate = wins / runs;
    expect(rate).toBeGreaterThan(0.7);
    expect(rate).toBeLessThan(0.96);
  }, 120_000);
});
