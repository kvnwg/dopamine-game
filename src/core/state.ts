/**
 * GameState: the single source of truth, and exactly what gets saved.
 * The zod schema validates loaded saves; the TS type is inferred from it.
 */
import { z } from 'zod';
import {
  BAL, ModSchema, RaritySchema, SlotSchema, SLOTS, StatIdSchema, EnemyKindSchema, HeistNodeKindSchema, LocationIdSchema, LOCATION_IDS,
  type LocationId, type Slot,
} from '../data';
import type { Item } from './types';
import { dayKey } from './time';

export const SAVE_VERSION = 8;

export const SubstatSchema = z.object({
  affixId: z.string(),
  stat: StatIdSchema,
  mode: z.enum(['flat', 'pct']),
  value: z.number(),
});

export const ItemEnchantSchema = z.object({ id: z.string(), tier: z.number().int().min(1).max(3) });

export const ItemSchema = z.object({
  uid: z.number().int(),
  baseId: z.string(),
  slot: SlotSchema,
  rarity: RaritySchema,
  level: z.number().int().positive(),
  main: z.array(ModSchema),
  subs: z.array(SubstatSchema),
  bonus: z.array(ModSchema),
  mintPerkId: z.string().nullable(),
  enchants: z.array(ItemEnchantSchema),
  locked: z.boolean(),
  /** The world it was rolled in: its flat HP/ATK/DEF/REGEN scale with worlds.itemGrowth^(tier - 1). */
  tier: z.number().int().positive(),
  power: z.number(),
});

/**
 * What a new game opens one by one (src/core/systems/features.ts): the dumpster itself (the player's
 * tap knocks its padlock off), then the Bag, luck, Upgrades, Worlds, the Codex, the dumpster's own
 * upgrades, Rebirth, Heists and the Upgrades screen's Perks page.
 */
export const FEATURES = ['roll', 'bag', 'luck', 'upgrades', 'worlds', 'codex', 'dumpster', 'rebirth', 'heist', 'perks'] as const;
export const FeatureSchema = z.enum(FEATURES);
export type Feature = z.infer<typeof FeatureSchema>;

/** One spin of the reels. Each reel's item is rolled when the spin starts and lands when the spin ends. */
export const SpinSchema = z.object({
  /**
   * One result per reel, decided when the spin starts: the luck tokens it lands on first (each
   * multiplies its luck), then the item, which lands `landAt` seconds into the spin.
   */
  reels: z
    .array(
      z.object({
        item: ItemSchema,
        odds: z.number(),
        mults: z.array(z.number()).default(() => []),
        landAt: z.number().nonnegative().optional(),
        landed: z.boolean().default(false),
        /** The full-screen reveal it gets as it lands (luck.ts judgeFinds), decided when the spin starts. */
        drama: z.enum(['big', 'huge', 'insane', 'hyper']).nullable().default(null),
      }),
    )
    .min(1),
  /** The spin's smaller build-up (luck.ts judgeFinds): 0 none, 1 a riser and glow, 2 a longer one. */
  tease: z.number().int().min(0).max(2).default(0),
  /** Token steps every reel landed the same token on: those count squared (roller.ts matchedSteps). */
  matched: z.array(z.number().int().nonnegative()).default(() => []),
  lucky: z.boolean(),
  /** A Golden Spin (x5 luck). */
  golden: z.boolean(),
  luck: z.number(),
  /** Paid for with a Trash Bag: spins faster. */
  turbo: z.boolean(),
  /** A spin the tutorial scripts: the very first one, or beginner's luck (its first reel). */
  scripted: z.enum(['first', 'beginner']).nullable().default(null),
  /** Until the last reel lands (luck tokens add stepSeconds each). */
  spinSeconds: z.number().positive(),
  /** A spin without tokens; each token adds stepSeconds to its reel. */
  baseSpinSeconds: z.number().positive().optional(),
  stepSeconds: z.number().nonnegative().optional(),
  restSeconds: z.number().nonnegative(),
  landed: z.boolean(),
});

export const EnemyStateSchema = z.object({
  uid: z.number().int(),
  enemyId: z.string(),
  kind: EnemyKindSchema,
  hp: z.number(),
  maxHp: z.number(),
  atk: z.number(),
  def: z.number(),
  atkSpd: z.number(),
  atkProgress: z.number(),
  specialTimer: z.number(),
  enraged: z.boolean(),
  burnDps: z.number(),
  burnTime: z.number(),
  burnShown: z.number(),
  /** Heists: seconds left stunned (it neither attacks nor uses its specials). */
  stun: z.number().optional(),
});

export const BattleSchema = z.object({
  stage: z.number().int().positive(),
  wave: z.number().int().nonnegative(),
  /** `idle`: the hero stands, no enemies: a heist between stops, or a new game before its first world is picked. */
  phase: z.enum(['walking', 'fighting', 'dead', 'choice', 'idle']),
  phaseTime: z.number(),
  playerHp: z.number(),
  playerAtkProgress: z.number(),
  enemies: z.array(EnemyStateSchema),
  nextEnemyUid: z.number().int(),
});

export const RewardBucketSchema = z.object({
  minute: z.number().int(),
  bags: z.number(),
  coins: z.number(),
  xp: z.number(),
});

export const RateSchema = z.object({ bags: z.number(), coins: z.number(), xp: z.number() });

export const PendingOfflineSchema = z.object({
  awayMs: z.number(),
  bags: z.number(),
  coins: z.number(),
  xp: z.number(),
  canDouble: z.boolean(),
  /** Items the dumpster rolled while away (offline rolls). */
  rolls: z.number().int().nonnegative().default(0),
  /** The rare finds it put in the bag, best first (copies for the popup, at most offline.keepListMax). */
  found: z.array(ItemSchema).default([]),
  /** How many rare finds there were in all. */
  foundCount: z.number().int().nonnegative().default(0),
});

// ---------------------------------------------------------------- heists

export const HeistLogLineSchema = z.object({
  /** A strings.en.json key (heist.log.*). */
  key: z.string(),
  params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

export const ShopItemSchema = z.object({
  /** A perk id for `perk`; otherwise the kind again. */
  id: z.string(),
  kind: z.enum(['heal', 'perk', 'removeCurse', 'reroll']),
  price: z.number(),
  sold: z.boolean(),
});

/** A decision the run waits on: Go is blocked until it is answered (heistChoose, or heistLeaveShop). */
export const HeistPendingSchema = z.discriminatedUnion('kind', [
  /** Pick one perk. An evolution is flagged; `source` is why it is offered (a level-up or a shrine). */
  z.object({
    kind: z.literal('perk'),
    options: z.array(z.object({ id: z.string(), evolution: z.boolean().optional() })),
    source: z.enum(['level', 'shrine', 'wheel']).optional(),
  }),
  /** A choice event (heistEvents.json): `options` is how many options it has. */
  z.object({ kind: z.literal('choice'), eventId: z.string(), options: z.number().int().positive() }),
  z.object({ kind: z.literal('shop'), stock: z.array(ShopItemSchema) }),
  /** The Jackpot Wheel: heistChoose spins it. */
  z.object({ kind: z.literal('wheel') }),
  /** heistChoose 0 trades max HP for an Epic perk offer, 1 walks away. */
  z.object({ kind: z.literal('shrine') }),
]);

/** The fight in progress (its enemies are battle.enemies once it has walked in). */
export const HeistFightSchema = z.object({
  kind: z.enum(['fight', 'elite', 'boss']),
  /** Multiplies its run coins and XP (choices can raise it). */
  rewardMult: z.number(),
  /** Seconds since the enemies arrived. */
  time: z.number(),
  /** Lid Shield blocks left; Fortress of Junk's block charge and its timer. */
  blocks: z.number().int().nonnegative(),
  blockCharge: z.boolean(),
  blockTimer: z.number(),
  pigeonTimer: z.number(),
  roccoTimer: z.number(),
  /** Hits landed (Bullseye). */
  hits: z.number().int().nonnegative(),
  /** ATK multiplier from Double or Nothing's coin flip. */
  atkMult: z.number(),
  /** Earned in this fight (for its log line). */
  coins: z.number(),
  xp: z.number(),
});

export const HeistRewardsSchema = z.object({
  bags: z.number(),
  coins: z.number(),
  gems: z.number(),
  potion: z.boolean(),
  /** The heist-exclusive ring's item id, when the win dropped it. */
  ring: z.string().nullable(),
});

export const HeistRunSchema = z.object({
  location: LocationIdSchema,
  act: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** The stop in the act, 0 to 5 (6 is the boss in act 3): the one being played, or the next one when `ready`. */
  index: z.number().int().nonnegative(),
  /** Stop kinds per act, an act at a time as it is reached (act 3 ends with 'boss'). */
  nodes: z.array(z.array(HeistNodeKindSchema)),
  hp: z.number(),
  maxHp: z.number(),
  level: z.number().int().positive(),
  xp: z.number().nonnegative(),
  coins: z.number(),
  perks: z.array(z.string()),
  curses: z.array(z.string()),
  pending: HeistPendingSchema.nullable(),
  status: z.enum(['ready', 'fighting', 'won', 'lost', 'secondChance']),
  log: z.array(HeistLogLineSchema),
  /** Collected so far (a win adds the location's payout). A loss keeps lossKeepPct of it. */
  rewards: HeistRewardsSchema,
  rerollsUsed: z.number().int().nonnegative(),
  revived: z.boolean(),
  // ---- beyond the UI contract: run bookkeeping
  /** Perks merged into an evolution: they still work but take no slot. */
  absorbed: z.array(z.string()),
  /** Level-up perk offers still to show (one fight can give several levels). */
  offersOwed: z.number().int().nonnegative(),
  /** The (fractional) world the run's enemies and gold scale from, set by the raccoon's power at the start (heistTier; below 1 for a green raccoon). */
  tier: z.number(),
  /** Enemy HP and ATK multiplier for this run (location difficulty; the gentle first Pizza Place run). */
  difficulty: z.number().positive(),
  /** Max HP % from shrines and choices (negative: lost). */
  maxHpPct: z.number(),
  fight: HeistFightSchema.nullable(),
  /** Effects choices left for later stops. */
  flags: z.object({
    skipNext: z.boolean(),
    /** The next N fights are skipped. */
    skipFights: z.number().int().nonnegative(),
    /** No fights for the next N stops. */
    truce: z.number().int().nonnegative(),
    /** The act with no traps (0: none). */
    noTrapsAct: z.number().int().nonnegative(),
    /** A saved snack: heals `pct` once HP drops under `below` %. */
    savedHeal: z.object({ pct: z.number(), below: z.number() }).nullable(),
    nineLivesUsed: z.boolean(),
  }),
  /** Choice events already seen this run (no repeats). */
  seen: z.array(z.string()),
  /** The main battle exactly as it was when the run started; it comes back when the run ends. */
  main: BattleSchema,
  /** The offline earning rate when the run started (a run earns nothing toward offline time). */
  mainRate: RateSchema,
  startedAt: z.number(),
});

export const HeistStateSchema = z.object({
  tickets: z.number().int().nonnegative(),
  /** The local day the daily tickets last came in ('' right after the save migration: no grant on that day). */
  ticketDay: z.string(),
  /** The local day the ad ticket was last used. */
  adTicketDay: z.string().nullable(),
  wins: z.record(LocationIdSchema, z.number().int().nonnegative()),
  run: HeistRunSchema.nullable(),
  /** The best world ever beaten, across rebirths (locations open from it). */
  bestWorld: z.number().int().nonnegative(),
});

// ---------------------------------------------------------------- Alley perks

const count = z.number().int().nonnegative();
const seconds = z.number().nonnegative().default(0);

/**
 * The run's Alley perks (src/core/systems/perks.ts): its Half-Eaten Bread Loaves (one, or more, for each
 * world whose boss falls for the first time this run) and the perks they bought. A rebirth wipes it all.
 */
export const PerkStateSchema = z.object({
  /** Loaves in the raccoon's pocket, to spend on perks. */
  bread: count.default(0),
  /** Loaves earned this run (bonus loaves included), and eaten (spent on perks). */
  earned: count.default(0),
  eaten: count.default(0),
  /** The worlds whose boss fell this run: each paid its loaves once. */
  worlds: z.array(z.number().int().positive()).default(() => []),
  /** Perks bought this run, in order. */
  owned: z.array(z.string()).default(() => []),
  /** Spins since Rigged Jackpot last rigged one. */
  jackpotSpins: count.default(0),
  /** This world attempt: Playing Possum's second wind is spent; Raccoon Mafia's recruits. */
  windUsed: z.boolean().default(false),
  recruits: count.default(0),
  /** Seconds toward each crew member's next move in the Alley battle. */
  timers: z
    .object({ pigeon: seconds, rats: seconds, heal: seconds, gull: seconds, mafia: seconds, golem: seconds })
    .default(() => ({ pigeon: 0, rats: 0, heal: 0, gull: 0, mafia: 0, golem: 0 })),
});
export type PerkState = z.infer<typeof PerkStateSchema>;

/** A run with no loaves and no perks (a new game, and every rebirth). */
export function freshPerks(): PerkState {
  return {
    bread: 0, earned: 0, eaten: 0, worlds: [], owned: [], jackpotSpins: 0, windUsed: false, recruits: 0,
    timers: { pigeon: 0, rats: 0, heal: 0, gull: 0, mafia: 0, golem: 0 },
  };
}

export const GameStateSchema = z.object({
  saveVersion: z.number().int(),
  createdAt: z.number(),
  lastActiveAt: z.number(),
  playTimeMs: z.number(),
  rngState: z.number().int(),
  player: z.object({ level: z.number().int().positive(), xp: z.number().nonnegative() }),
  currencies: z.object({ coins: z.number(), gems: z.number(), bags: z.number() }),
  equipped: z.record(SlotSchema, ItemSchema.nullable()),
  /** Items in the bag (not equipped). Capacity is limited; the best items are kept. */
  inventory: z.array(ItemSchema),
  nextItemUid: z.number().int(),
  /** Worlds: `current` is the world being fought in; `highestCleared` the best world whose boss is beaten. */
  stage: z.object({
    current: z.number().int().positive(),
    highestCleared: z.number().int().nonnegative(),
    mode: z.enum(['push', 'farm']),
    /** Where to fall back to if the current push fails. */
    returnTo: z.number().int().positive(),
    powerAtDeath: z.number().nullable(),
    showToughHint: z.boolean(),
    /** Losses in a row in this world: it is retried until worlds.lossesBeforeBack, then it falls back. */
    losses: z.number().int().nonnegative().default(0),
    /**
     * A world has been picked. A new game's raccoon waits in his street (the battle idle) until the
     * player picks his first world on the Worlds tab (Kevin: "raccoon doesn't start attacking until u
     * show and select a world"). Saves from before this are already fighting.
     */
    chosen: z.boolean().default(true),
  }),
  battle: BattleSchema,
  dumpster: z.object({
    level: z.number().int().positive(),
    theme: z.string(),
    upgradeEndsAt: z.number().nullable(),
    dryStreak: z.number().int().nonnegative(),
    totalDives: z.number().int().nonnegative(),
    firstDiveDone: z.boolean(),
    forcedRarity: RaritySchema.nullable(),
    /** Dev: the luck tokens the next spin's first reel (or, with forcedTokensAll, every reel) lands on before its item. */
    forcedTokens: z.array(z.number()).nullable().default(null),
    forcedTokensAll: z.boolean().default(false),
    /**
     * Beginner's luck (BAL.tutorial), new games only: 'pending' until its spin, 'rolled' (with the
     * item's uid) until that item is put on, then 'done'. Saves from before it count as done.
     */
    beginner: z
      .object({ state: z.enum(['pending', 'rolled', 'done']), uid: z.number().int().nullable() })
      .default({ state: 'done', uid: null }),
    /** The play clock (playTimeMs) when the padlock came off, for beginner's luck's timing; null before (and in older saves). */
    openedAtMs: z.number().nullable().default(null),
    adSpeedupDay: z.string(),
    adSpeedupsUsed: z.number().int().nonnegative(),
  }),
  /** The reels: the spin in progress (its results are decided when it starts) and seconds into it. */
  roll: z.object({
    timer: z.number(),
    current: SpinSchema.nullable(),
    count: z.number().int().nonnegative(),
    sinceLucky: z.number().int().nonnegative(),
    /** Spins still owed by a heist's Golden Dumpster: each is a golden spin at heist.golden.luckMult luck. */
    goldenLeft: z.number().int().nonnegative().default(0),
    /**
     * The finds the reveal is judged against (luck.ts judgeFinds): since when (play clock) finds are
     * watched, and the rarest ones as [play clock ms, findScore], rarest first, each rarer than every
     * find after it.
     */
    rare: z
      .object({
        since: z.number().nullable(),
        hist: z.array(z.tuple([z.number(), z.number()])),
        /** The rarest find of the whole game (findScore), for HYPER RARE. */
        best: z.number().default(0),
      })
      .default(() => ({ since: null, hist: [], best: 0 })),
  }),
  upgrades: z.record(z.string(), z.number().int().nonnegative()),
  rebirths: z.number().int().nonnegative(),
  luckBoostEndsAt: z.number().nullable(),
  records: z.object({ bestOdds: z.number(), bestItemName: z.string(), bestRarity: RaritySchema.nullable() }),
  codex: z.object({ entries: z.array(z.string()) }),
  offline: z.object({
    buckets: z.array(RewardBucketSchema),
    trackingSince: z.number().nullable(),
    pausedRate: RateSchema.nullable(),
    paused: z.boolean(),
    pending: PendingOfflineSchema.nullable(),
  }),
  /**
   * The run's Scrap All hauls as a trend (haul.ts judgeHaul): for rebirth `run`, `n` hauls so far, the
   * smoothed log of a haul (`level`) and its growth per minute of play (`slope`) as of the play clock `atMs`.
   */
  haulTrend: z
    .object({ run: z.number().int().nonnegative(), n: z.number().int().nonnegative(), level: z.number(), slope: z.number(), atMs: z.number() })
    .default(() => ({ run: 0, n: 0, level: 0, slope: 0, atMs: 0 })),
  lifetime: z.object({
    kills: z.number().int().nonnegative(),
    wavesCleared: z.number().int().nonnegative(),
    bossesBeaten: z.number().int().nonnegative(),
    itemsRecycled: z.number().int().nonnegative(),
    itemsEquipped: z.number().int().nonnegative(),
  }),
  settings: z.object({
    haptics: z.boolean(),
    sound: z.boolean(),
    music: z.boolean(),
    /** How loud the sounds and the music are when on (0 to 1). Saves from before have them full. */
    soundVolume: z.number().min(0).max(1).default(1),
    musicVolume: z.number().min(0).max(1).default(1),
    reduceFlashing: z.boolean(),
    reduceMotion: z.boolean(),
  }),
  heist: HeistStateSchema,
  /**
   * Features opened (`unlocked`: they work and show) and introduced (`seen`: the tutorial has pointed
   * them out). Saves from before this have everything.
   */
  features: z
    .object({ unlocked: z.array(FeatureSchema), seen: z.array(FeatureSchema) })
    .default(() => ({ unlocked: [...FEATURES], seen: [...FEATURES] })),
  /** This run's loaves and perks. Saves from before perks start with none (save.ts counts the worlds already beaten). */
  perks: PerkStateSchema.default(freshPerks),
});

export type GameState = z.infer<typeof GameStateSchema>;
export type HeistState = z.infer<typeof HeistStateSchema>;
export type HeistRun = z.infer<typeof HeistRunSchema>;
export type HeistPending = z.infer<typeof HeistPendingSchema>;
export type HeistFight = z.infer<typeof HeistFightSchema>;
export type HeistRewards = z.infer<typeof HeistRewardsSchema>;
export type HeistLogLine = z.infer<typeof HeistLogLineSchema>;
export type ShopItem = z.infer<typeof ShopItemSchema>;
export type HeistStatus = HeistRun['status'];
export type BattleState = z.infer<typeof BattleSchema>;
export type EnemyState = z.infer<typeof EnemyStateSchema>;
export type Rate = z.infer<typeof RateSchema>;
export type PendingOffline = z.infer<typeof PendingOfflineSchema>;

/** A fresh heist state: `tickets` tickets, counted as today's grant (`ticketDay` '' waits for the next refresh). */
export function initialHeist(tickets: number, ticketDay: string, bestWorld = 0): HeistState {
  return {
    tickets,
    ticketDay,
    adTicketDay: null,
    wins: Object.fromEntries(LOCATION_IDS.map((id) => [id, 0])) as Record<LocationId, number>,
    run: null,
    bestWorld,
  };
}

export function emptyEquipment(): Record<Slot, Item | null> {
  return Object.fromEntries(SLOTS.map((s) => [s, null])) as Record<Slot, Item | null>;
}

export function createInitialState(now: number, seed: number): GameState {
  const start = BAL.start;
  return {
    saveVersion: SAVE_VERSION,
    createdAt: now,
    lastActiveAt: now,
    playTimeMs: 0,
    rngState: seed >>> 0,
    player: { level: 1, xp: 0 },
    currencies: { coins: start.coins, gems: start.gems, bags: start.bags },
    equipped: emptyEquipment(),
    inventory: [],
    nextItemUid: 1,
    stage: { current: 1, highestCleared: 0, mode: 'push', returnTo: 1, powerAtDeath: null, showToughHint: false, losses: 0, chosen: false },
    battle: {
      stage: 1,
      wave: 0,
      // Waiting for the player to pick a world (stage.chosen).
      phase: 'idle',
      phaseTime: 0,
      playerHp: BAL.player.base.HP,
      playerAtkProgress: 0,
      enemies: [],
      nextEnemyUid: 1,
    },
    dumpster: {
      level: 1,
      theme: BAL.dumpster.defaultTheme,
      upgradeEndsAt: null,
      dryStreak: 0,
      totalDives: 0,
      firstDiveDone: false,
      forcedRarity: null,
      forcedTokens: null,
      forcedTokensAll: false,
      beginner: { state: 'pending', uid: null },
      openedAtMs: null,
      adSpeedupDay: '',
      adSpeedupsUsed: 0,
    },
    roll: { timer: 0, current: null, count: 0, sinceLucky: 0, goldenLeft: 0, rare: { since: null, hist: [], best: 0 } },
    upgrades: {},
    rebirths: 0,
    luckBoostEndsAt: null,
    records: { bestOdds: 0, bestItemName: '', bestRarity: null },
    codex: { entries: [] },
    offline: { buckets: [], trackingSince: null, pausedRate: null, paused: false, pending: null },
    haulTrend: { run: 0, n: 0, level: 0, slope: 0, atMs: 0 },
    lifetime: { kills: 0, wavesCleared: 0, bossesBeaten: 0, itemsRecycled: 0, itemsEquipped: 0 },
    settings: { haptics: true, sound: true, music: true, soundVolume: 1, musicVolume: 1, reduceFlashing: false, reduceMotion: false },
    heist: initialHeist(BAL.heist.tickets.start, dayKey(now)),
    // Worlds is open from the start (features.ts); the rest opens one at a time.
    features: { unlocked: ['worlds'], seen: ['worlds'] },
    perks: freshPerks(),
  };
}
