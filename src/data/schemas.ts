import { z } from 'zod';

export const STAT_IDS = [
  'HP', 'ATK', 'DEF', 'ATK_SPD', 'CRIT', 'CRIT_DMG',
  'DODGE', 'LIFESTEAL', 'REGEN', 'BAG_FIND', 'COIN_FIND', 'BOSS_DMG',
] as const;
export const StatIdSchema = z.enum(STAT_IDS);
export type StatId = z.infer<typeof StatIdSchema>;

export const SLOTS = [
  'hat', 'mask', 'jacket', 'weapon', 'shield',
  'gloves', 'sneakers', 'backpack', 'bling', 'ring',
] as const;
export const SlotSchema = z.enum(SLOTS);
export type Slot = z.infer<typeof SlotSchema>;

/** Ordered from worst to best. Index order is used for comparisons. */
export const RARITIES = ['junk', 'decent', 'shiny', 'epic', 'legendary', 'mythic', 'mint'] as const;
export const RaritySchema = z.enum(RARITIES);
export type Rarity = z.infer<typeof RaritySchema>;

export const ModModeSchema = z.enum(['flat', 'pct']);
export type ModMode = z.infer<typeof ModModeSchema>;

export const ModSchema = z.object({
  stat: StatIdSchema,
  mode: ModModeSchema,
  value: z.number(),
});
export type Mod = z.infer<typeof ModSchema>;

const statRecord = <T extends z.ZodTypeAny>(v: T) => z.record(StatIdSchema, v);
const rarityRecord = <T extends z.ZodTypeAny>(v: T) => z.record(RaritySchema, v);
const slotRecord = <T extends z.ZodTypeAny>(v: T) => z.record(SlotSchema, v);
const positive = z.number().positive();
const nonNeg = z.number().nonnegative();
const range = z.object({ min: z.number(), max: z.number() }).refine((r) => r.min <= r.max, 'min > max');

// ---------------------------------------------------------------- balance.json
export const BalanceSchema = z.object({
  tickRate: positive,
  player: z.object({
    base: statRecord(z.number()),
    perLevel: statRecord(z.number()),
    caps: z.object({ CRIT: positive, DODGE: positive, ATK_SPD: positive }),
    levelCap: z.number().int().positive(),
    xpCurve: z.object({ base: positive, exponent: positive }),
  }),
  combat: z.object({
    damageVariance: range,
    defConstant: positive,
    engagedEnemies: z.number().int().positive(),
    walkSeconds: nonNeg,
    deathSeconds: nonNeg,
    waveHealPct: nonNeg,
    minDamage: nonNeg,
  }),
  stages: z.object({
    wavesPerStage: z.number().int().positive(),
    enemiesPerWave: range,
    miniBossLocalStages: z.array(z.number().int().positive()),
    bossLocalStage: z.number().int().positive(),
    scaling: z.object({ hp: positive, atk: positive, def: positive }),
    miniBoss: z.object({ hpMult: positive, atkMult: positive, bags: nonNeg, xpMult: positive }),
    boss: z.object({ hpMult: positive, atkMult: positive, bags: nonNeg, xpMult: positive, coinBurstKills: nonNeg }),
    neighborhoodClearBonus: z.object({ offlinePct: nonNeg, bagFind: nonNeg }),
  }),
  drops: z.object({
    killCoins: z.object({ base: positive, growth: positive }),
    killXp: z.object({ base: positive, growth: positive }),
    bagsPerWave: nonNeg,
  }),
  rarities: rarityRecord(
    z.object({ mult: positive, substats: z.number().int().nonnegative(), recycleXp: nonNeg, recycleCoins: nonNeg }),
  ),
  recycle: z.object({ perItemLevel: nonNeg }),
  items: z.object({
    levelScalePerLevel: nonNeg,
    substatLevelScale: nonNeg,
    levelOffset: range,
    levelCap: z.number().int().positive(),
    slots: slotRecord(z.object({ main: z.array(z.object({ stat: StatIdSchema, base: positive })).min(1) })),
  }),
  power: z.object({
    flat: statRecord(nonNeg),
    pct: statRecord(nonNeg),
    perPlayerLevel: nonNeg,
  }),
  dumpster: z.object({
    maxLevel: z.number().int().positive(),
    rarityTable: z
      .array(z.object({ level: z.number().int().positive(), weights: rarityRecord(nonNeg) }))
      .min(1),
    slotWeights: slotRecord(nonNeg),
    upgradeCost: z.object({ base: positive, growth: positive }),
    upgradeTime: z.object({ baseSeconds: positive, growth: positive, capSeconds: positive }),
    gemSpeedup: z.object({ minutesPerGem: positive, minGems: nonNeg }),
    adSpeedup: z.object({ minutes: positive, perDay: z.number().int().nonnegative() }),
    badLuck: z.object({ minDumpsterLevel: z.number().int().positive(), drySpell: z.number().int().positive(), minRarity: RaritySchema }),
    nearMissTeaseChance: z.number().min(0).max(1),
    uniqueLegendaryChance: z.number().min(0).max(1),
    tutorialItem: z.object({ baseId: z.string(), rarity: RaritySchema, level: z.number().int().positive() }),
    fullFlipMinRarity: RaritySchema,
    defaultTheme: z.string(),
  }),
  autoDive: z.object({
    unlockPlayMinutes: nonNeg,
    intervalSeconds: positive,
    defaultKeepMinRarity: RaritySchema,
  }),
  codex: z.object({
    entriesPerBonus: z.number().int().positive(),
    gemsPerBonus: nonNeg,
    bonusCycle: z.array(ModSchema).min(1),
  }),
  offline: z.object({
    capHours: positive,
    efficiency: z.number().min(0).max(1),
    rateWindowMinutes: positive,
    minRateMinutes: positive,
    fallbackStageSeconds: positive,
    fallbackEnemiesPerWave: positive,
    adDoubleMinAwayMinutes: nonNeg,
    minAwaySecondsForPopup: nonNeg,
    maxTickGapSeconds: positive,
  }),
  start: z.object({ coins: nonNeg, gems: nonNeg, bags: nonNeg }),
  save: z.object({ autosaveSeconds: positive, backups: z.number().int().nonnegative() }),
  feel: z.object({
    lidFlipSeconds: positive,
    lidRattleSeconds: positive,
    teaseFlashSeconds: positive,
    autoFlipSeconds: positive,
    legendarySlowMoSeconds: nonNeg,
    rattleBeatSeconds: positive,
    rattleBeatsByRarity: rarityRecord(z.number().int().positive()),
    revealSecondsByRarity: rarityRecord(positive),
    hotDumpsterStartPct: nonNeg,
    maxCatchUpTicksPerFrame: z.number().int().positive(),
  }),
  mockAds: z.object({ watchSeconds: nonNeg }),
});
export type Balance = z.infer<typeof BalanceSchema>;

// ---------------------------------------------------------------- content
export const MaterialSchema = z.enum(['plastic', 'metal', 'glass', 'ceramic', 'food', 'cloth', 'paper', 'wood', 'rubber']);

export const BaseItemSchema = z.object({
  id: z.string().min(1),
  slot: SlotSchema,
  theme: z.string().min(1),
  name: z.string().min(1),
  legendaryName: z.string().min(1),
  flavor: z.string().min(1),
  material: MaterialSchema,
  unique: z.boolean().optional(),
  bonus: z.array(ModSchema).optional(),
  art: z.object({ icon: z.string(), overlay: z.string() }),
});
export type BaseItem = z.infer<typeof BaseItemSchema>;
export const ItemsSchema = z.array(BaseItemSchema).min(1);

export const AffixSchema = z.object({
  id: z.string().min(1),
  stat: StatIdSchema,
  mode: ModModeSchema,
  min: z.number().positive(),
  max: z.number().positive(),
});
export type Affix = z.infer<typeof AffixSchema>;
export const MintPerkSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  text: z.string(),
  mods: z.array(ModSchema).min(1),
});
export type MintPerk = z.infer<typeof MintPerkSchema>;
export const AffixesFileSchema = z.object({
  affixes: z.array(AffixSchema).length(12),
  mintPerks: z.array(MintPerkSchema).min(1),
});

export const ThemeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  substatWeights: z.record(z.string(), nonNeg),
});
export type Theme = z.infer<typeof ThemeSchema>;
export const ThemesSchema = z.array(ThemeSchema).min(1);

export const EnemyKindSchema = z.enum(['regular', 'miniboss', 'boss']);
export type EnemyKind = z.infer<typeof EnemyKindSchema>;
export const BossSpecialSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heavyHit'), name: z.string(), everySeconds: positive, damageMult: positive }),
  z.object({ type: z.literal('enrage'), name: z.string(), belowHpPct: positive, atkMult: positive, atkSpdMult: positive }),
]);
export type BossSpecial = z.infer<typeof BossSpecialSchema>;
export const EnemySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: EnemyKindSchema,
  hp: positive,
  atk: nonNeg,
  def: nonNeg,
  atkSpd: positive,
  special: BossSpecialSchema.optional(),
});
export type EnemyDef = z.infer<typeof EnemySchema>;
export const EnemiesSchema = z.array(EnemySchema).min(1);

export const NeighborhoodSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  firstStage: z.number().int().positive(),
  lastStage: z.number().int().positive(),
  theme: z.string().min(1),
  enemies: z.array(z.string()).min(1),
  miniBosses: z.array(z.string()).min(1),
  boss: z.string(),
  background: z.string(),
});
export type Neighborhood = z.infer<typeof NeighborhoodSchema>;
export const NeighborhoodsSchema = z.array(NeighborhoodSchema).min(1);

export const StringsSchema = z.record(z.string(), z.string());

export const EnemyShapeSchema = z.enum(['rat', 'pigeon', 'raccoon', 'ratKing', 'raccoonBoss', 'officer']);
export type EnemyShape = z.infer<typeof EnemyShapeSchema>;

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'expected a #RRGGBB color');

export const AssetsSchema = z.object({
  files: z.record(z.string(), z.string()),
  placeholders: z.object({
    palette: z.record(z.string(), hex),
    rarities: rarityRecord(z.object({ color: hex, gradient: z.array(hex).optional() })),
    enemies: z.record(
      z.string(),
      z.object({ shape: EnemyShapeSchema, color: hex, accent: hex, size: positive, label: z.string() }),
    ),
    backgrounds: z.record(
      z.string(),
      z.object({
        sky: hex, skyLow: hex, skyline: hex, walls: hex, ground: hex, neon: hex, neon2: hex, window: hex,
        grade: hex, gradeAlpha: z.number().min(0).max(1), sign: z.string(), signSub: z.string(),
      }),
    ),
    raccoon: z.object({ body: hex, mask: hex, belly: hex, tail: hex, brow: hex }),
    slots: slotRecord(z.string()),
  }),
});
export type Assets = z.infer<typeof AssetsSchema>;
