/**
 * Headless balance simulator: plays the real core logic with a bot.
 * The wheel spins on its own and the battle pushes through worlds by itself. Like an attentive
 * player, the bot drags every upgrade it finds onto the raccoon, buys the cheapest unlocked node of
 * the upgrade tree it can afford, eats its Half-Eaten Bread Loaves on the cheapest perk it can
 * afford, upgrades the dumpster, rebirths as soon as it is allowed, and jumps ahead to the hardest
 * world that reads Easy. After a boss it taps Next within a second and a half (when a push fails, the
 * raccoon falls back on its own).
 */
import {
  affordablePerks, affordableUpgrades, applyAction, canBuyLegend, canLegend, canRebirth, computeStats, createInitialState, currentLuck, floorOf,
  isDump, isUpgrade, legendGain, legendLevel, legendPrice, perkNodeState, perkTrees, Rng, tick, upgradeCost, upgradePrice, worldCount, worldThreat,
  TICK_MS, type CoreEvent, type GameAction, type GameState,
} from '../src/core';
import { BAL, RARITIES, type AlleyPerkDef } from '../src/data';

/**
 * How the bot spends its loaves: 'cheapest' (the cheapest perk it can afford, whenever it can),
 * 'focus' (each run picks one tree, the next in turn, and saves up to climb it to its top perk before
 * buying anything else) or 'none' (perks never bought).
 */
export type PerkStrategy = 'cheapest' | 'focus' | 'none';

export interface SimOptions {
  minutes: number;
  seed: number;
  /** Rebirth whenever allowed (default true). */
  rebirth?: boolean;
  /** Jump ahead to the hardest world that looks easy (default true). */
  jump?: boolean;
  /** Default 'cheapest'. */
  perks?: PerkStrategy;
  startTime?: number;
  sampleEverySeconds?: number;
  /**
   * Become a Legend once allowed and no rebirth has come for this many minutes (default 45; 0 never).
   * Legend Stars go on the cheapest star upgrade the bot can afford.
   */
  legendAfterMinutes?: number;
  /** Tap Dodge on every boss slam (default false: an idle player). */
  dodge?: boolean;
  /** Stench level in the Dump (default 0). */
  stench?: number;
  /** Start from this game instead of a new one (a saved late game, to try the Dump without the hours before it). */
  from?: GameState;
  /** Called once with the game as World 20 first falls (to save it for `from`). */
  onWorld20?: (state: GameState) => void;
}

/** The perk the bot buys next, or null to wait. */
function pickPerk(state: GameState, strategy: PerkStrategy): AlleyPerkDef | null {
  if (strategy === 'none') return null;
  const options = affordablePerks(state);
  if (options.length === 0) return null;
  // (A stable sort: equal prices go in catalog order.)
  const cheapest = [...options].sort((a, b) => a.cost - b.cost)[0];
  if (strategy === 'cheapest') return cheapest;
  const trees = perkTrees();
  const tree = trees[(state.rebirths - BAL.perks.unlockRebirths) % trees.length];
  const left = tree.perks.filter((p) => perkNodeState(state, p.id) !== 'owned');
  if (left.length === 0) return cheapest;
  // Straight up the focused tree: the dearest perk open in it (the next step toward its top), saving up
  // for it when it isn't affordable yet.
  const next = left.filter((p) => perkNodeState(state, p.id) === 'open').sort((a, b) => b.cost - a.cost)[0];
  return next && options.includes(next) ? next : null;
}

export interface SimSample {
  minute: number;
  stage: number;
  /** The Dump floor fought (0 in a regular world). */
  floor: number;
  legends: number;
  highestCleared: number;
  bestEver: number;
  rebirths: number;
  level: number;
  dumpsterLevel: number;
  gearPower: number;
  luck: number;
  hp: number;
  atk: number;
  coins: number;
  rolls: number;
}

export interface SimResult {
  samples: SimSample[];
  /** Minute at which each world was first cleared (any rebirth). */
  clearedAt: Record<number, number>;
  rebirthAt: number[];
  /** Perks bought, per run (index: rebirths when bought), with the minute. */
  perksBought: { run: number; id: string; minute: number }[];
  /** Loaves earned per run (index: rebirths). */
  breadByRun: Record<number, number>;
  deaths: number;
  jumps: number;
  bossWins: number;
  final: GameState;
  rarityCounts: Record<string, number>;
  /** Minute each Dump floor was first cleared (any run). */
  floorAt: Record<number, number>;
  /** Legends: the minute and the stars each paid. */
  legendAt: { minute: number; stars: number; rebirths: number; floor: number }[];
  /** Star upgrades bought, with the minute. */
  starsBought: { id: string; minute: number }[];
  dodges: number;
}

/** The star upgrade the bot buys next: the cheapest affordable one. */
function pickStarPerk(state: GameState): string | null {
  let best: { id: string; price: number } | null = null;
  for (const def of BAL.legend.perks) {
    if (!canBuyLegend(state, def.id)) continue;
    const price = legendPrice(def, legendLevel(state, def.id))!;
    if (!best || price < best.price) best = { id: def.id, price };
  }
  return best?.id ?? null;
}

export function simulate(opts: SimOptions): SimResult {
  const sampleEvery = (opts.sampleEverySeconds ?? 60) * 1000;
  let now = opts.startTime ?? Date.UTC(2026, 0, 5, 12, 0, 0);
  let state = opts.from ? structuredClone(opts.from) : createInitialState(now, Rng.hashSeed(opts.seed));
  if (opts.from) now = Math.max(now, opts.from.lastActiveAt);
  const rng = new Rng(opts.from ? Rng.hashSeed(opts.seed) : state.rngState);
  // The player's first tap knocks the padlock off the dumpster.
  if (!opts.from) state = applyAction(state, { type: 'openDumpster' }, rng, now).state;
  const clearedAt: Record<number, number> = {};
  const rebirthAt: number[] = [];
  const perksBought: SimResult['perksBought'] = [];
  const breadByRun: Record<number, number> = {};
  const strategy = opts.perks ?? 'cheapest';
  const samples: SimSample[] = [];
  const rarityCounts: Record<string, number> = Object.fromEntries(RARITIES.map((r) => [r, 0]));
  let deaths = 0;
  let jumps = 0;
  let bossWins = 0;
  let dodges = 0;
  const floorAt: Record<number, number> = {};
  const legendAt: SimResult['legendAt'] = [];
  const starsBought: SimResult['starsBought'] = [];
  let lastReset = 0;
  const legendAfter = (opts.legendAfterMinutes ?? 45) * 60000;
  let elapsed = 0;
  let nextSample = 0;
  let nextShop = 0;
  let nextJump = 0;

  let choiceAt: number | null = null;
  let pendingDodge = false;
  let w20 = false;
  const onEvents = (events: CoreEvent[]) => {
    for (const e of events) {
      if (e.type === 'bossChoice') choiceAt = elapsed;
      if (e.type === 'stageClear' && clearedAt[e.stage] === undefined) {
        clearedAt[e.stage] = elapsed / 60000;
        if (e.stage === worldCount()) w20 = true;
      }
      if (e.type === 'playerDeath') deaths++;
      if (e.type === 'bossWin') bossWins++;
      if (e.type === 'roll') rarityCounts[e.item.rarity]++;
      if (e.type === 'rebirth') {
        rebirthAt.push(elapsed / 60000);
        lastReset = elapsed;
      }
      if (e.type === 'floorClear' && e.mode === 'endless' && floorAt[e.floor] === undefined) floorAt[e.floor] = elapsed / 60000;
      if (e.type === 'legend') {
        legendAt.push({ minute: elapsed / 60000, stars: e.stars, rebirths: 0, floor: 0 });
        lastReset = elapsed;
      }
      if (e.type === 'legendPerkBought') starsBought.push({ id: e.id, minute: elapsed / 60000 });
      if (e.type === 'perfectDodge') dodges++;
      if (e.type === 'bossWindup' && opts.dodge) pendingDodge = true;
      if (e.type === 'breadEarned') breadByRun[state.rebirths] = (breadByRun[state.rebirths] ?? 0) + e.loaves;
      if (e.type === 'perkBought') perksBought.push({ run: state.rebirths, id: e.id, minute: elapsed / 60000 });
    }
  };
  const act = (a: GameAction) => {
    const r = applyAction(state, a, rng, now);
    state = r.state;
    onEvents(r.events);
  };

  const totalMs = opts.minutes * 60000;
  while (elapsed < totalMs) {
    const r = tick(state, { ticks: 1 }, rng, now);
    state = r.state;
    onEvents(r.events);
    now += TICK_MS;
    elapsed += TICK_MS;

    if (w20) {
      w20 = false;
      opts.onWorld20?.(state);
    }
    if (pendingDodge) {
      pendingDodge = false;
      act({ type: 'dodge' });
    }

    if (elapsed >= nextShop) {
      nextShop = elapsed + 1000;
      if (opts.rebirth !== false && canRebirth(state)) act({ type: 'rebirth' });
      // Become a Legend once a run has stalled (no rebirth for a while).
      if (legendAfter > 0 && canLegend(state) && elapsed - lastReset >= legendAfter) {
        const info = { rebirths: state.rebirths, floor: floorOf(state.stage.highestCleared), stars: legendGain(state).total };
        act({ type: 'legend' });
        const last = legendAt[legendAt.length - 1];
        if (last) Object.assign(last, info);
      }
      for (let guard = 0; guard < 50; guard++) {
        const id = pickStarPerk(state);
        if (!id) break;
        act({ type: 'buyLegendPerk', id });
      }
      if ((opts.stench ?? 0) !== state.dump.stench) act({ type: 'setStench', level: opts.stench ?? 0 });
      if (state.dumpster.upgradeEndsAt === null && state.dumpster.level < BAL.dumpster.maxLevel
        && state.currencies.coins >= upgradeCost(state.dumpster.level)) {
        act({ type: 'startDumpsterUpgrade' });
      }
      // Equip anything better than what is worn (the player drags it on).
      for (let guard = 0; guard < 10; guard++) {
        const up = state.inventory.find((it) => isUpgrade(state, it));
        if (!up) break;
        act({ type: 'equipItem', uid: up.uid });
      }
      // Buy the cheapest unlocked, affordable node of the tree, repeatedly.
      for (let guard = 0; guard < 30; guard++) {
        const options = affordableUpgrades(state);
        if (options.length === 0) break;
        options.sort((a, b) => upgradePrice(state, a) - upgradePrice(state, b));
        act({ type: 'buyUpgrade', id: options[0].id });
      }
      // Eat the loaves on perks (they open with the second rebirth).
      for (let guard = 0; guard < 30; guard++) {
        const perk = pickPerk(state, strategy);
        if (!perk) break;
        act({ type: 'buyPerk', id: perk.id });
      }
    }

    // After a boss: a player taps Next within a second and a half (a death sends the raccoon back anyway).
    if (choiceAt !== null && state.battle.phase === 'choice' && elapsed - choiceAt >= 1500) {
      choiceAt = null;
      act({ type: 'afterBoss', next: true });
    }

    // A new game's raccoon waits for his first world: the player picks World 1 when the Worlds tab opens.
    if (!state.stage.chosen) {
      if (state.features.unlocked.includes('worlds')) act({ type: 'travel', world: 1 });
      continue;
    }

    // (In the Endless Dump the floors come one after another by themselves.)
    if (opts.jump !== false && elapsed >= nextJump && state.battle.phase !== 'dead' && !isDump(state.battle.stage)) {
      nextJump = elapsed + 10_000;
      let target = 0;
      for (let w = worldCount(); w > state.battle.stage; w--) {
        if (worldThreat(state, w).level === 'easy') {
          target = w;
          break;
        }
      }
      if (target > state.battle.stage) {
        jumps++;
        act({ type: 'travel', world: target });
      }
    }

    if (elapsed >= nextSample) {
      nextSample += sampleEvery;
      const st = computeStats(state);
      let gear = 0;
      for (const it of Object.values(state.equipped)) gear += it?.power ?? 0;
      samples.push({
        minute: Math.round(elapsed / 60000),
        stage: Math.min(state.battle.stage, worldCount()),
        floor: floorOf(state.battle.stage),
        legends: state.legend.count,
        highestCleared: state.stage.highestCleared,
        bestEver: Math.max(0, ...Object.keys(clearedAt).map(Number)),
        rebirths: state.rebirths,
        level: state.player.level,
        dumpsterLevel: state.dumpster.level,
        gearPower: gear,
        luck: currentLuck(state, now),
        hp: Math.round(st.HP),
        atk: Math.round(st.ATK),
        coins: Math.floor(state.currencies.coins),
        rolls: state.roll.count,
      });
    }
  }
  return {
    samples, clearedAt, rebirthAt, perksBought, breadByRun, deaths, jumps, bossWins, final: state, rarityCounts, floorAt, legendAt, starsBought, dodges,
  };
}
