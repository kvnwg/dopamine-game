import { describe, expect, it } from 'vitest';
import {
  alleyPerk, applyAction, canBuyPerk, computeStats, currentLuck, deserialize, FEATURES, featureView, freshPerks, GameStateSchema,
  inventoryCapacity, NO_PERKS, performSpin, perkFx, perkNodeState, perksOpen, perkTrees, rarityAtLeast, rebirthRequirement, reelCount,
  rollTokens, Rng, scaledEnemyStats, scrapValue, serialize, spinCycle, tick, worldThreat, type CoreEvent, type EnemyState, type GameState,
  type Item,
} from '../src/core';
import { buildGameData, BAL, DATA, PERK_TREE_IDS } from '../src/data';
import balance from '../src/data/balance.json';
import items from '../src/data/items.json';
import affixes from '../src/data/affixes.json';
import themes from '../src/data/themes.json';
import enemies from '../src/data/enemies.json';
import worlds from '../src/data/worlds.json';
import strings from '../src/data/strings.en.json';
import assets from '../src/data/assets.json';
import enchants from '../src/data/enchants.json';
import { checkRows } from '../src/render/pixel/buf';
import { UI_MD, UI_SM, UI_SPRITES, UI_XS } from '../src/render/pixel/ui';
import { perkFxText } from '../src/ui/perkText';
import { freshState, T0 } from './helpers';

const clone = (s: GameState) => structuredClone(s) as GameState;
const OPEN = BAL.perks.unlockRebirths;
const BOSS_WAVE = BAL.stages.wavesPerStage - 1;

/** A perk's numbers, from balance.json. */
function fx(id: string): Record<string, number> {
  return alleyPerk(id)!.effect as Record<string, number>;
}

/** A raccoon in a run with perks open (two rebirths), past the tutorial, owning `perks` and holding `bread`. */
function perked(perks: string[] = [], bread = 0, seed = 1): GameState {
  const st = freshState(seed);
  st.rebirths = OPEN;
  st.dumpster.beginner = { state: 'done', uid: null };
  st.dumpster.firstDiveDone = true;
  st.perks.owned = [...perks];
  st.perks.bread = bread;
  return st;
}

let nextUid = 5000;
/** A plain foe (an Alley rat: no specials) with no DEF. */
function foe(kind: 'regular' | 'boss', hp: number, atk = 0, atkSpd = 1): EnemyState {
  nextUid += 1;
  return {
    uid: nextUid, enemyId: 'alley_rat', kind, hp, maxHp: hp, atk, def: 0, atkSpd, atkProgress: 0, specialTimer: 0, enraged: false,
    burnDps: 0, burnTime: 0, burnShown: 0, moves: [], tele: 0, moveTimer: 0, shieldLeft: 0, shields: 0, moveEnraged: false, giant: false,
  };
}

/** Plays `seconds` of the game from `st` as it is. */
function play(st: GameState, seconds: number, rng = new Rng(7)) {
  let s = st;
  const events: CoreEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 10); i++) {
    const r = tick(s, { ticks: 1 }, rng, T0 + i * 100);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

/** Puts `enemies` in front of the raccoon in World 1 (wave `wave`, full HP unless `hp`) and plays `seconds`. */
function fight(st: GameState, enemies: EnemyState[], seconds: number, opts: { wave?: number; hp?: number; rng?: Rng } = {}) {
  const s = clone(st);
  s.battle.phase = 'fighting';
  s.battle.wave = opts.wave ?? 0;
  s.battle.enemies = enemies.map((e) => ({ ...e }));
  s.battle.playerAtkProgress = 0;
  s.battle.playerHp = opts.hp ?? computeStats(s).HP;
  return play(s, seconds, opts.rng ?? new Rng(7));
}

/** `world`'s boss falls on the raccoon's first swing (a 1 HP boss on the boss wave). */
function bossFalls(st: GameState, world: number) {
  const s = clone(st);
  s.battle.stage = world;
  s.stage.current = world;
  return fight(s, [foe('boss', 1)], 1.2, { wave: BOSS_WAVE });
}

function crewHits(events: CoreEvent[], helper: string) {
  return events.filter((e): e is Extract<CoreEvent, { type: 'crewHit' }> => e.type === 'crewHit' && e.helper === helper);
}

function firstHit(events: CoreEvent[]): number {
  const hit = events.find((e): e is Extract<CoreEvent, { type: 'playerHit' }> => e.type === 'playerHit');
  return hit!.amount;
}

/** The next wave arriving in World 1 (`wave`): its enemies, with the perks' changes. */
function arrivingWave(st: GameState, wave: number): EnemyState[] {
  const s = clone(st);
  s.battle.phase = 'walking';
  s.battle.phaseTime = 0.05;
  s.battle.wave = wave;
  return tick(s, { ticks: 1 }, new Rng(3), T0).state.battle.enemies;
}

function makeItem(over: Partial<Item>): Item {
  return {
    uid: 1, baseId: 'hat_lawn_gnome', slot: 'hat', rarity: 'epic', level: 10, main: [], subs: [], bonus: [],
    mintPerkId: null, enchants: [], locked: false, tier: 3, power: 10, ...over,
  };
}

// ---------------------------------------------------------------------------------------------- loaves

describe('Half-Eaten Bread Loaves', () => {
  it('a world pays a loaf the first time its boss falls this run, and never again for farming it', () => {
    const st = perked();
    const first = bossFalls(st, 1);
    expect(first.events).toContainEqual({ type: 'breadEarned', world: 1, loaves: BAL.perks.loavesPerWorld, bread: BAL.perks.loavesPerWorld });
    expect(first.state.perks.worlds).toEqual([1]);
    // Beating World 1 again pays nothing.
    const again = bossFalls(first.state, 1);
    expect(again.events.some((e) => e.type === 'bossWin')).toBe(true);
    expect(again.events.some((e) => e.type === 'breadEarned')).toBe(false);
    expect(again.state.perks.bread).toBe(BAL.perks.loavesPerWorld);
    // The next world pays its own.
    const two = bossFalls(again.state, 2);
    expect(two.state.perks.bread).toBe(2 * BAL.perks.loavesPerWorld);
    expect(two.state.perks.earned).toBe(2 * BAL.perks.loavesPerWorld);
    // A world jumped past on the way up pays when its boss first falls this run.
    const jumped = clone(two.state);
    jumped.stage.highestCleared = 6;
    const four = bossFalls(jumped, 4);
    expect(four.events.some((e) => e.type === 'worldFirstClear')).toBe(false);
    expect(four.state.perks.bread).toBe(3 * BAL.perks.loavesPerWorld);
  });

  it('perks open with the second rebirth: before it no loaves are earned and nothing can be eaten', () => {
    expect(OPEN).toBe(2);
    for (const rebirths of [0, 1]) {
      const st = perked();
      st.rebirths = rebirths;
      expect(perksOpen(st)).toBe(false);
      const r = bossFalls(st, 1);
      expect(r.events.some((e) => e.type === 'bossWin')).toBe(true);
      expect(r.events.some((e) => e.type === 'breadEarned')).toBe(false);
      expect(r.state.perks.bread).toBe(0);
      st.perks.bread = 10;
      expect(applyAction(st, { type: 'buyPerk', id: 'pigeonWingman' }, new Rng(1), T0).state.perks.owned).toEqual([]);
    }
    expect(perksOpen(perked())).toBe(true);
  });

  it('the Perks page is a feature: it opens with the second rebirth and is introduced like the others', () => {
    const st = freshState();
    st.features.unlocked = FEATURES.filter((f) => f !== 'perks');
    st.features.seen = [...st.features.unlocked];
    st.rebirths = OPEN - 1;
    const one = tick(st, { ticks: 1 }, new Rng(1), T0);
    expect(one.events.some((e) => e.type === 'featureUnlocked' && e.feature === 'perks')).toBe(false);
    expect(featureView(one.state, 'perks')).toBe('locked');
    const two = clone(one.state);
    two.rebirths = OPEN;
    const r = tick(two, { ticks: 1 }, new Rng(1), T0);
    expect(r.events).toContainEqual({ type: 'featureUnlocked', feature: 'perks' });
    expect(featureView(r.state, 'perks')).toBe('intro');
    const seen = applyAction(r.state, { type: 'featureSeen', feature: 'perks' }, new Rng(1), T0).state;
    expect(featureView(seen, 'perks')).toBe('open');
  });

  it('a rebirth eats every loaf and perk: the next run starts with none, and their effects go with them', () => {
    const st = perked(['energyDrink', 'glassCannon'], 4);
    st.perks.worlds = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    st.perks.earned = 9;
    st.perks.eaten = 3;
    const req = rebirthRequirement(st.rebirths);
    st.stage.highestCleared = req.world;
    st.currencies.coins = req.gold;
    const r = applyAction(st, { type: 'rebirth' }, new Rng(1), T0);
    expect(r.state.rebirths).toBe(OPEN + 1);
    expect(r.state.perks).toEqual(freshPerks());
    expect(perkFx(r.state)).toBe(NO_PERKS);
    const bare = clone(r.state);
    expect(computeStats(r.state).HP).toBeCloseTo(computeStats(bare).HP);
    // ...and World 1 pays its loaf again in the new run.
    expect(bossFalls(r.state, 1).state.perks.bread).toBe(BAL.perks.loavesPerWorld);
  });

  it('saves from before perks load with none; a run already past the second rebirth is paid for the worlds it has beaten', () => {
    const st = perked();
    st.stage.highestCleared = 6;
    const raw = JSON.parse(serialize(st)) as Record<string, unknown>;
    delete raw.perks;
    const loaded = deserialize(JSON.stringify(raw))!;
    expect(loaded).not.toBeNull();
    expect(loaded.perks.owned).toEqual([]);
    expect(loaded.perks.worlds).toEqual([1, 2, 3, 4, 5, 6]);
    expect(loaded.perks.bread).toBe(6 * BAL.perks.loavesPerWorld);
    // (The schema alone gives an old save an empty pocket.)
    expect(GameStateSchema.parse(raw).perks).toEqual(freshPerks());
    // Before the second rebirth there is nothing to pay.
    const early = freshState();
    early.rebirths = OPEN - 1;
    early.stage.highestCleared = 4;
    const rawEarly = JSON.parse(serialize(early)) as Record<string, unknown>;
    delete rawEarly.perks;
    expect(deserialize(JSON.stringify(rawEarly))!.perks).toEqual(freshPerks());
    // A save with perks loads them as they were (no second payout).
    const mid = perked(['pigeonWingman'], 2);
    mid.stage.highestCleared = 5;
    mid.perks.worlds = [1, 2, 3];
    mid.perks.earned = 3;
    mid.perks.eaten = 1;
    expect(deserialize(serialize(mid))).toEqual(mid);
    // A save from before the locked start has every feature open and introduced, Perks included.
    delete raw.features;
    const parsed = GameStateSchema.parse(raw);
    expect(parsed.features.unlocked).toContain('perks');
    expect(parsed.features.seen).toContain('perks');
  });
});

// ---------------------------------------------------------------------------------------------- buying

describe('eating perks', () => {
  it('a tree\'s root first, then deeper perks once one they hang off is owned; each costs its loaves; never without the bread', () => {
    const rng = new Rng(1);
    const buy = (s: GameState, id: string) => applyAction(s, { type: 'buyPerk', id }, rng, T0).state;
    let st = perked([], 3);
    expect(perkNodeState(st, 'pigeonWingman')).toBe('open');
    expect(perkNodeState(st, 'sewerCousins')).toBe('locked');
    expect(buy(st, 'sewerCousins').perks.owned).toEqual([]);
    const r = applyAction(st, { type: 'buyPerk', id: 'pigeonWingman' }, rng, T0);
    expect(r.events).toContainEqual({ type: 'perkBought', id: 'pigeonWingman', cost: alleyPerk('pigeonWingman')!.cost });
    st = r.state;
    expect(st.perks).toMatchObject({ bread: 2, eaten: 1, owned: ['pigeonWingman'] });
    expect(perkNodeState(st, 'pigeonWingman')).toBe('owned');
    // Not twice.
    expect(buy(st, 'pigeonWingman').perks.bread).toBe(2);
    // Its children are open now.
    expect(perkNodeState(st, 'sewerCousins')).toBe('open');
    st = buy(st, 'sewerCousins');
    expect(st.perks).toMatchObject({ bread: 0, eaten: 3, owned: ['pigeonWingman', 'sewerCousins'] });
    // Out of bread: the other one waits.
    expect(canBuyPerk(st, 'drSqueaks')).toBe(false);
    expect(buy(st, 'drSqueaks').perks.owned).toEqual(['pigeonWingman', 'sewerCousins']);
    // Seagull Air Strike hangs off Sewer Cousins or Dr. Squeaks: either one opens it.
    expect(perkNodeState(st, 'seagullStrike')).toBe('open');
    expect(perkNodeState(perked(['pigeonWingman', 'drSqueaks']), 'seagullStrike')).toBe('open');
    expect(perkNodeState(perked(['pigeonWingman']), 'seagullStrike')).toBe('locked');
    const rich = clone(st);
    rich.perks.bread = 2;
    expect(canBuyPerk(rich, 'seagullStrike')).toBe(false);
    rich.perks.bread = alleyPerk('seagullStrike')!.cost;
    expect(buy(rich, 'seagullStrike').perks.owned).toContain('seagullStrike');
    // An unknown perk: nothing.
    expect(buy(rich, 'nope').perks).toEqual(rich.perks);
  });

  it('max HP a perk adds comes with HP; a smaller bag scraps its weakest unlocked items down to size', () => {
    const st = perked(['energyDrink', 'glassCannon', 'playingPossum', 'sourdoughStarter', 'carbLoading'], 3);
    st.perks.eaten = 10;
    st.battle.playerHp = 50;
    const hp = computeStats(st).HP;
    const after = applyAction(st, { type: 'buyPerk', id: 'holyCrust' }, new Rng(1), T0).state;
    const gained = computeStats(after).HP - hp;
    expect(gained).toBeGreaterThan(0);
    expect(after.battle.playerHp).toBeCloseTo(50 + gained);
    // Four-Leaf Litter halves the bag: buying it with a full one scraps the weakest (locked items stay).
    const bag = perked([], 1);
    bag.inventory = Array.from({ length: 20 }, (_, i) => makeItem({ uid: 100 + i, power: 100 - i, locked: i === 19 }));
    const r = applyAction(bag, { type: 'buyPerk', id: 'fourLeafLitter' }, new Rng(1), T0);
    const cap = inventoryCapacity(r.state);
    expect(cap).toBe(Math.floor(BAL.inventory.baseCapacity * (1 - fx('fourLeafLitter').bagCutPct / 100)));
    expect(r.state.inventory).toHaveLength(cap);
    expect(r.state.inventory.some((x) => x.uid === 119)).toBe(true);
    expect(r.state.inventory.map((x) => x.power).slice(0, cap - 1)).toEqual(Array.from({ length: cap - 1 }, (_, i) => 100 - i));
    expect(r.events.filter((e) => e.type === 'scrap')).toHaveLength(20 - cap);
    expect(r.state.currencies.coins).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------- the crew

describe('THE ALLEY CREW', () => {
  it('Pigeon Wingman: a pigeon pecks the front enemy for its share of ATK every second', () => {
    const st = perked(['pigeonWingman']);
    const atk = computeStats(st).ATK;
    const pecks = crewHits(fight(st, [foe('regular', 1e9), foe('regular', 1e9)], 5.55).events, 'pigeon');
    expect(pecks).toHaveLength(Math.floor(5.5 / fx('pigeonWingman').pigeonEvery));
    for (const p of pecks) expect(p.amount).toBeCloseTo((atk * fx('pigeonWingman').pigeonAtkPct) / 100);
    expect(new Set(pecks.map((p) => p.enemyUid)).size).toBe(1);
    expect(fight(perked(), [foe('regular', 1e9)], 5.55).events.some((e) => e.type === 'crewHit')).toBe(false);
  });

  it('Sewer Cousins: every enemy on screen loses its share of ATK every second', () => {
    const st = perked(['pigeonWingman', 'sewerCousins']);
    const atk = computeStats(st).ATK;
    const gnaws = crewHits(fight(st, [foe('regular', 1e9), foe('regular', 1e9), foe('regular', 1e9)], 2.55).events, 'rats');
    expect(gnaws).toHaveLength(3 * Math.floor(2.5 / fx('sewerCousins').ratEvery));
    expect(new Set(gnaws.map((g) => g.enemyUid)).size).toBe(3);
    for (const g of gnaws) expect(g.amount).toBeCloseTo((atk * fx('sewerCousins').ratAtkPct) / 100);
  });

  it('Dr. Squeaks: heals a share of max HP every second in a fight', () => {
    const st = perked(['pigeonWingman', 'drSqueaks']);
    const max = computeStats(st).HP;
    const r = fight(st, [foe('regular', 1e9)], 3.05, { hp: max / 2 });
    const heals = r.events.filter((e) => e.type === 'heal' && e.source === 'perk');
    expect(heals.length).toBeGreaterThanOrEqual(2);
    for (const h of heals) expect(h.type === 'heal' && h.amount).toBeCloseTo((max * fx('drSqueaks').healPct) / 100);
    const without = fight(perked(['pigeonWingman']), [foe('regular', 1e9)], 3.05, { hp: max / 2 });
    expect(without.events.some((e) => e.type === 'heal' && e.source === 'perk')).toBe(false);
    expect(r.state.battle.playerHp).toBeGreaterThan(without.state.battle.playerHp + max * 0.03);
  });

  it('Seagull Air Strike: every few seconds every enemy on screen takes a big share of ATK', () => {
    const st = perked(['pigeonWingman', 'sewerCousins', 'seagullStrike']);
    const atk = computeStats(st).ATK;
    const every = fx('seagullStrike').gullEvery;
    const strikes = crewHits(fight(st, [foe('regular', 1e9), foe('regular', 1e9)], every + 0.55).events, 'gull');
    expect(strikes).toHaveLength(2);
    for (const s of strikes) expect(s.amount).toBeCloseTo((atk * fx('seagullStrike').gullAtkPct) / 100);
    expect(crewHits(fight(st, [foe('regular', 1e9)], every - 0.55).events, 'gull')).toHaveLength(0);
  });

  it('Raccoon Mafia: every regular beaten joins the crew until the world ends (a few at most), each swinging every second', () => {
    const st = perked(['pigeonWingman', 'drSqueaks', 'seagullStrike', 'raccoonMafia']);
    // (High enough that a few kills' XP can't level him up mid-fight and change his ATK.)
    st.player.level = 20;
    const atk = computeStats(st).ATK;
    const max = fx('raccoonMafia').recruitMax;
    const weak = Array.from({ length: max + 2 }, () => foe('regular', 1));
    const r = fight(st, [...weak, foe('regular', 1e9)], 12.05);
    expect(r.state.perks.recruits).toBe(max);
    const swings = crewHits(r.events, 'mafia');
    expect(swings.length).toBeGreaterThanOrEqual(max);
    for (const s of swings) expect(s.amount).toBeCloseTo((atk * fx('raccoonMafia').recruitAtkPct) / 100);
    // A new world attempt sends them home.
    expect(applyAction(r.state, { type: 'travel', world: 2 }, new Rng(1), T0).state.perks.recruits).toBe(0);
    // Without the perk, nobody joins.
    expect(fight(perked(['pigeonWingman']), weak, 4.05).state.perks.recruits).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------- bad decisions

describe('BAD DECISIONS', () => {
  it('Expired Energy Drink: more attack speed, less max HP', () => {
    const base = computeStats(perked());
    const s = computeStats(perked(['energyDrink']));
    expect(s.ATK_SPD).toBeCloseTo(base.ATK_SPD * (1 + fx('energyDrink').atkSpdPct / 100));
    expect(s.HP).toBeCloseTo(base.HP * (1 - fx('energyDrink').hpCutPct / 100));
    expect(s.ATK).toBeCloseTo(base.ATK);
    // The raccoon swings that much more often.
    const swings = (st: GameState) => fight(st, [foe('regular', 1e9)], 10.05).events.filter((e) => e.type === 'playerHit').length;
    expect(swings(perked(['energyDrink']))).toBeGreaterThanOrEqual(Math.floor(swings(perked()) * 1.4));
  });

  it('Glass Cannon: ATK and max HP multiplied, and the hits land that much harder', () => {
    const base = computeStats(perked(['energyDrink']));
    const st = perked(['energyDrink', 'glassCannon']);
    const s = computeStats(st);
    expect(s.ATK).toBeCloseTo(base.ATK * fx('glassCannon').atkMult);
    expect(s.HP).toBeCloseTo(base.HP * fx('glassCannon').hpMult);
    const hit = (x: GameState) => firstHit(fight(x, [foe('regular', 1e9)], 1.15, { rng: new Rng(5) }).events);
    expect(hit(st) / hit(perked(['energyDrink']))).toBeCloseTo(fx('glassCannon').atkMult);
  });

  it('Playing Possum: once per world attempt, a knockout blow leaves the raccoon standing', () => {
    const st = perked(['energyDrink', 'playingPossum']);
    const max = computeStats(st).HP;
    const killer = () => foe('regular', 1e9, 1e9);
    const r = fight(st, [killer()], 1.15);
    const wind = r.events.find((e): e is Extract<CoreEvent, { type: 'secondWind' }> => e.type === 'secondWind');
    expect(wind?.hp).toBeCloseTo((max * fx('playingPossum').secondWindPct) / 100);
    expect(r.events.some((e) => e.type === 'playerDeath')).toBe(false);
    expect(r.state.perks.windUsed).toBe(true);
    // Only once: the next knockout is a knockout.
    const next = play(r.state, 1.2);
    expect(next.events.some((e) => e.type === 'playerDeath')).toBe(true);
    // The retry is a new world attempt: the second wind is back.
    expect(play(next.state, 2).state.perks.windUsed).toBe(false);
    // Without the perk the first blow knocks him out.
    expect(fight(perked(['energyDrink']), [killer()], 1.15).events.some((e) => e.type === 'playerDeath')).toBe(true);
  });

  it('Hold My Soda: low on HP, the raccoon\'s hits deal several times the damage', () => {
    const st = perked(['energyDrink', 'glassCannon', 'holdMySoda']);
    const max = computeStats(st).HP;
    const below = (fx('holdMySoda').rageBelowPct / 100) * max;
    const hitAt = (hp: number) => firstHit(fight(st, [foe('regular', 1e9)], 1.15, { hp, rng: new Rng(5) }).events);
    expect(hitAt(below * 0.8) / hitAt(max)).toBeCloseTo(fx('holdMySoda').rageMult);
    expect(hitAt(below * 1.2) / hitAt(max)).toBeCloseTo(1);
  });

  it('YOLO: bosses take more from everything, but regular enemies hit harder', () => {
    const path = ['energyDrink', 'glassCannon', 'holdMySoda'];
    const dealt = (st: GameState) => 1e9 - fight(st, [foe('boss', 1e9)], 1.15, { wave: BOSS_WAVE, rng: new Rng(5) }).state.battle.enemies[0].hp;
    expect(dealt(perked([...path, 'yolo'])) / dealt(perked(path))).toBeCloseTo(fx('yolo').bossDmgMult);
    for (const e of arrivingWave(perked([...path, 'yolo']), 0)) {
      expect(e.atk).toBeCloseTo(scaledEnemyStats(DATA.enemiesById.get(e.enemyId)!, 1, false).atk * (1 + fx('yolo').regularAtkPct / 100));
    }
    // The Worlds tab's read of a world follows.
    expect(worldThreat(perked([...path, 'yolo']), 3).enemyHit).toBeGreaterThan(worldThreat(perked(path), 3).enemyHit);
  });
});

// ---------------------------------------------------------------------------------------------- rigged reels

describe('RIGGED REELS', () => {
  it('Four-Leaf Litter: luck tokens land several times as often, but the bag holds less', () => {
    const rng = new Rng(11);
    const n = 20_000;
    let base = 0;
    let litter = 0;
    for (let i = 0; i < n; i++) {
      if (rollTokens(rng).length > 0) base++;
      if (rollTokens(rng, fx('fourLeafLitter').tokenChanceMult).length > 0) litter++;
    }
    expect(base / n).toBeCloseTo(BAL.roll.multiplier.chance, 2);
    expect(litter / n).toBeCloseTo(BAL.roll.multiplier.chance * fx('fourLeafLitter').tokenChanceMult, 2);
    // On the reels themselves.
    const spinsWithTokens = (st: GameState) => {
      const r = new Rng(4);
      let k = 0;
      for (let i = 0; i < 1500; i++) {
        const ev: CoreEvent[] = [];
        performSpin(st, r, T0, ev);
        const start = ev.find((e): e is Extract<CoreEvent, { type: 'spinStart' }> => e.type === 'spinStart')!;
        if (start.reels[0].mults.length > 0) k++;
      }
      return k / 1500;
    };
    expect(spinsWithTokens(perked(['fourLeafLitter']))).toBeGreaterThan(spinsWithTokens(perked()) * 2);
    expect(inventoryCapacity(perked(['fourLeafLitter']))).toBeLessThan(inventoryCapacity(perked()));
  });

  it('Pawn Shop Hustle: scrapped items sell for more gold', () => {
    const item = makeItem({ uid: 9, rarity: 'shiny' });
    const before = scrapValue(perked(['fourLeafLitter']), item);
    const after = scrapValue(perked(['fourLeafLitter', 'pawnShopHustle']), item);
    expect(after.coins / before.coins).toBeCloseTo(fx('pawnShopHustle').scrapGoldMult, 1);
    expect(after.xp).toBe(before.xp);
  });

  it('Bootleg Reel: one more reel on every spin, but every spin takes longer', () => {
    const before = perked(['fourLeafLitter']);
    const st = perked(['fourLeafLitter', 'bootlegReel']);
    expect(reelCount(st)).toBe(reelCount(before) + fx('bootlegReel').extraReels);
    expect(spinCycle(st)).toBeCloseTo(spinCycle(before) * (1 + fx('bootlegReel').spinTimePct / 100));
    expect(performSpin(clone(st), new Rng(2), T0, [])).toHaveLength(reelCount(st));
  });

  it('Greased Gears: the reels spin twice as fast (more items for the same time), but bosses hit harder', () => {
    const before = perked(['fourLeafLitter', 'pawnShopHustle']);
    const st = perked(['fourLeafLitter', 'pawnShopHustle', 'greasedGears']);
    expect(spinCycle(st)).toBeCloseTo(spinCycle(before) / fx('greasedGears').spinSpeedMult);
    expect(spinCycle(st, true)).toBeCloseTo(spinCycle(before, true) / fx('greasedGears').spinSpeedMult);
    const rolls = (x: GameState) => play(x, 120).events.filter((e) => e.type === 'roll').length;
    expect(rolls(st)).toBeGreaterThan(rolls(before) * 1.5);
    const [boss] = arrivingWave(st, BOSS_WAVE);
    expect(boss.kind).toBe('boss');
    expect(boss.atk).toBeCloseTo(scaledEnemyStats(DATA.enemiesById.get(boss.enemyId)!, 1, true).atk * (1 + fx('greasedGears').bossAtkPct / 100));
    expect(arrivingWave(before, BOSS_WAVE)[0].atk).toBeCloseTo(scaledEnemyStats(DATA.enemiesById.get(boss.enemyId)!, 1, true).atk);
  });

  it('Rigged Jackpot: one spin in every so many is rigged, and every one of its reels lands the rarity or better', () => {
    const st = perked(['fourLeafLitter', 'bootlegReel', 'greasedGears', 'riggedJackpot']);
    const every = fx('riggedJackpot').jackpotEvery;
    const rarity = alleyPerk('riggedJackpot')!.rarity!;
    const rng = new Rng(3);
    let rigged = 0;
    for (let i = 1; i <= every * 3; i++) {
      const ev: CoreEvent[] = [];
      const got = performSpin(st, rng, T0, ev);
      const start = ev.find((e): e is Extract<CoreEvent, { type: 'spinStart' }> => e.type === 'spinStart')!;
      if (i % every === 0) {
        rigged++;
        expect(start.rigged).toBe(rarity);
        expect(got.length).toBe(2);
        for (const it of got) expect(rarityAtLeast(it.rarity, rarity)).toBe(true);
      } else {
        expect(start.rigged).toBeUndefined();
      }
    }
    expect(rigged).toBe(3);
  });
});

// ---------------------------------------------------------------------------------------------- the bread cult

describe('THE BREAD CULT', () => {
  it('Sourdough Starter: every few worlds beaten this run bake a bonus loaf', () => {
    let st = perked(['sourdoughStarter']);
    const every = fx('sourdoughStarter').bonusLoafEvery;
    const paid: number[] = [];
    for (let w = 1; w <= every * 2; w++) {
      const r = bossFalls(st, w);
      const e = r.events.find((x): x is Extract<CoreEvent, { type: 'breadEarned' }> => x.type === 'breadEarned');
      paid.push(e!.loaves);
      st = r.state;
    }
    const base = BAL.perks.loavesPerWorld;
    expect(paid).toEqual(Array.from({ length: every * 2 }, (_, i) => base + ((i + 1) % every === 0 ? 1 : 0)));
  });

  it('Carb Loading: more luck for every uneaten loaf in the pocket', () => {
    const st = perked(['sourdoughStarter', 'carbLoading'], 5);
    const without = perked(['sourdoughStarter'], 5);
    expect(currentLuck(st, T0)).toBeCloseTo(currentLuck(without, T0) * (1 + (5 * fx('carbLoading').heldLoafLuckPct) / 100));
    st.perks.bread = 0;
    expect(currentLuck(st, T0)).toBeCloseTo(currentLuck(without, T0));
  });

  it('Bread Bait: every world pays extra loaves, but bosses arrive with more HP', () => {
    const st = perked(['sourdoughStarter', 'breadBait']);
    const r = bossFalls(st, 1);
    expect(r.state.perks.bread).toBe(BAL.perks.loavesPerWorld + fx('breadBait').extraLoaves);
    const [boss] = arrivingWave(st, BOSS_WAVE);
    const plain = scaledEnemyStats(DATA.enemiesById.get(boss.enemyId)!, 1, true);
    expect(boss.hp).toBeCloseTo(plain.hp * (1 + fx('breadBait').bossHpPct / 100));
    expect(boss.maxHp).toBe(boss.hp);
  });

  it('Holy Crust: more ATK and max HP for every loaf eaten this run', () => {
    const st = perked(['sourdoughStarter', 'carbLoading', 'holyCrust']);
    const without = perked(['sourdoughStarter', 'carbLoading']);
    st.perks.eaten = 10;
    without.perks.eaten = 10;
    const k = 1 + (10 * fx('holyCrust').eatenLoafPct) / 100;
    expect(computeStats(st).ATK).toBeCloseTo(computeStats(without).ATK * k);
    expect(computeStats(st).HP).toBeCloseTo(computeStats(without).HP * k);
  });

  it('Gluten Golem: every couple of seconds the golem slams the front enemy, harder for every loaf earned this run', () => {
    const st = perked(['sourdoughStarter', 'carbLoading', 'holyCrust', 'glutenGolem']);
    st.perks.earned = 10;
    const atk = computeStats(st).ATK;
    const every = fx('glutenGolem').golemEvery;
    const slams = crewHits(fight(st, [foe('regular', 1e9)], every * 2 + 0.55).events, 'golem');
    expect(slams).toHaveLength(2);
    for (const s of slams) expect(s.amount).toBeCloseTo((atk * fx('glutenGolem').golemAtkPct * 10) / 100);
    st.perks.earned = 0;
    expect(crewHits(fight(st, [foe('regular', 1e9)], every + 0.55).events, 'golem')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------- the data

describe('perk data', () => {
  it('3 or 4 trees of 4 to 6 perks: one root at 1 loaf, each perk opened by cheaper perks of its own tree, 1 to 4 loaves', () => {
    expect([3, 4]).toContain(PERK_TREE_IDS.length);
    for (const tree of perkTrees()) {
      expect(tree.perks.length, tree.id).toBeGreaterThanOrEqual(4);
      expect(tree.perks.length, tree.id).toBeLessThanOrEqual(6);
      const roots = tree.perks.filter((p) => p.requires.length === 0);
      expect(roots.length, tree.id).toBeGreaterThanOrEqual(1);
      for (const r of roots) expect(r.cost).toBe(1);
      for (const p of tree.perks) {
        expect(p.cost).toBeGreaterThanOrEqual(1);
        expect(p.cost).toBeLessThanOrEqual(4);
        for (const req of p.requires) {
          expect(alleyPerk(req)?.tree, p.id).toBe(tree.id);
          expect(alleyPerk(req)!.cost, p.id).toBeLessThan(p.cost);
        }
      }
      // Its top perk costs the most.
      expect(Math.max(...tree.perks.map((p) => p.cost))).toBe(4);
    }
  });

  it('every perk and tree has a name and a line, and every perk\'s numbers line carries each of its numbers from balance.json', () => {
    for (const id of PERK_TREE_IDS) {
      expect(DATA.strings[`perkTree.${id}`], id).toBeTruthy();
      expect(DATA.strings[`perkTreeLine.${id}`], id).toBeTruthy();
    }
    for (const def of DATA.alleyPerks) {
      expect(DATA.strings[`perk.${def.id}`], def.id).toBeTruthy();
      expect(DATA.strings[`perkLine.${def.id}`], def.id).toBeTruthy();
      const template = DATA.strings[`perkFx.${def.id}`];
      expect(template, def.id).toBeTruthy();
      for (const k of Object.keys(def.effect)) expect(template, `${def.id} says ${k}`).toContain(`{${k}}`);
      expect(perkFxText(def), def.id).not.toMatch(/[{}]/);
    }
  });

  it('every perk and tree icon is drawn: the 16 x 16 for the card, about 10 x 10 for the Perks page; the loaf at every size', () => {
    for (const def of DATA.alleyPerks) {
      expect(UI_SPRITES[def.icon as keyof typeof UI_SPRITES], def.id).toBeDefined();
      expect(UI_MD[def.icon as keyof typeof UI_MD], def.id).toBeDefined();
    }
    for (const tree of BAL.perks.trees) expect(UI_SM[tree.icon as keyof typeof UI_SM], tree.id).toBeDefined();
    for (const [set, rows] of [['xs', UI_XS.bread], ['sm', UI_SM.bread], ['md', UI_MD.bread], ['nav', UI_SPRITES.bread]] as const) {
      expect(rows, set).toBeDefined();
      checkRows(`bread ${set}`, rows!);
    }
  });

  it('the data check refuses a broken tree', () => {
    const raw = { balance, items, affixes, themes, enemies, worlds, strings, assets, enchants };
    const withList = (list: unknown[]) => ({ ...raw, balance: { ...balance, perks: { ...balance.perks, list } } });
    const list = balance.perks.list;
    // A perk that opens a cheaper one.
    const backwards = list.map((p) => (p.id === 'sewerCousins' ? { ...p, cost: 1 } : p));
    expect(() => buildGameData(withList(backwards))).toThrow(/must cost more/);
    // A prerequisite from another tree, or one that doesn't exist.
    const crossed = list.map((p) => (p.id === 'sewerCousins' ? { ...p, requires: ['energyDrink'] } : p));
    expect(() => buildGameData(withList(crossed))).toThrow(/another tree/);
    const unknown = list.map((p) => (p.id === 'sewerCousins' ? { ...p, requires: ['nobody'] } : p));
    expect(() => buildGameData(withList(unknown))).toThrow(/unknown perk nobody/);
    // An effect nobody reads.
    const typo = list.map((p) => (p.id === 'yolo' ? { ...p, effect: { ...p.effect, bossDmgMul: 2 } } : p));
    expect(() => buildGameData(withList(typo))).toThrow(/balance.json/);
  });
});
