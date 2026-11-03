/**
 * GameState: the single source of truth, and exactly what gets saved.
 * The zod schema validates loaded saves; the TS type is inferred from it.
 */
import { z } from 'zod';
import { BAL, ModSchema, RaritySchema, SlotSchema, SLOTS, StatIdSchema, EnemyKindSchema, type Slot } from '../data';
import type { Item } from './types';

export const SAVE_VERSION = 6;

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

/** One spin of the reels. Each reel's item is rolled when the spin starts and lands when the spin ends. */
export const SpinSchema = z.object({
  /** One result per reel, decided when the spin starts. */
  reels: z.array(z.object({ item: ItemSchema, odds: z.number() })).min(1),
  lucky: z.boolean(),
  /** A Golden Spin (x5 luck). */
  golden: z.boolean(),
  luck: z.number(),
  /** Paid for with a Trash Bag: spins faster. */
  turbo: z.boolean(),
  spinSeconds: z.number().positive(),
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
});

export const BattleSchema = z.object({
  stage: z.number().int().positive(),
  wave: z.number().int().nonnegative(),
  phase: z.enum(['walking', 'fighting', 'dead']),
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
});

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
    adSpeedupDay: z.string(),
    adSpeedupsUsed: z.number().int().nonnegative(),
  }),
  /** The reels: the spin in progress (its results are decided when it starts) and seconds into it. */
  roll: z.object({
    timer: z.number(),
    current: SpinSchema.nullable(),
    count: z.number().int().nonnegative(),
    sinceLucky: z.number().int().nonnegative(),
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
    reduceFlashing: z.boolean(),
    reduceMotion: z.boolean(),
  }),
});

export type GameState = z.infer<typeof GameStateSchema>;
export type BattleState = z.infer<typeof BattleSchema>;
export type EnemyState = z.infer<typeof EnemyStateSchema>;
export type Rate = z.infer<typeof RateSchema>;
export type PendingOffline = z.infer<typeof PendingOfflineSchema>;

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
    stage: { current: 1, highestCleared: 0, mode: 'push', returnTo: 1, powerAtDeath: null, showToughHint: false },
    battle: {
      stage: 1,
      wave: 0,
      phase: 'walking',
      phaseTime: BAL.combat.walkSeconds,
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
      adSpeedupDay: '',
      adSpeedupsUsed: 0,
    },
    roll: { timer: 0, current: null, count: 0, sinceLucky: 0 },
    upgrades: {},
    rebirths: 0,
    luckBoostEndsAt: null,
    records: { bestOdds: 0, bestItemName: '', bestRarity: null },
    codex: { entries: [] },
    offline: { buckets: [], trackingSince: null, pausedRate: null, paused: false, pending: null },
    lifetime: { kills: 0, wavesCleared: 0, bossesBeaten: 0, itemsRecycled: 0, itemsEquipped: 0 },
    settings: { haptics: true, sound: true, music: true, reduceFlashing: false, reduceMotion: false },
  };
}
