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
  }),
  /** Worlds: everything scales by growth^(world - 1). */
  worlds: z.object({
    enemyGrowth: z.object({ hp: positive, atk: positive, def: positive }),
    /** The DEF constant in the damage formula scales too, so DEF stays meaningful in every world. */
    defConstantGrowth: positive,
    /** Items rolled in world W have their flat HP/ATK/DEF/REGEN multiplied by itemGrowth^(W-1). */
    itemGrowth: positive,
    goldGrowth: positive,
    xpGrowth: positive,
    boss: z.object({
      hpMult: positive, atkMult: positive, xpMult: positive, coinMult: positive, bags: nonNeg,
      potionChance: z.number().min(0).max(1),
    }),
    firstClearGems: nonNeg,
    firstClearGemsPerWorld: nonNeg,
    /** Threat: margin = (your HP x your DPS) / (their HP x their DPS); under 1 you lose, at easyMargin+ it's easy. */
    threat: z.object({ waveSize: positive, easyMargin: positive }),
  }),
  drops: z.object({
    killCoins: z.object({ base: positive }),
    killXp: z.object({ base: positive }),
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
    slotWeights: slotRecord(nonNeg),
    upgradeCost: z.object({ base: positive, growth: positive }),
    upgradeTime: z.object({ baseSeconds: positive, growth: positive, capSeconds: positive }),
    gemSpeedup: z.object({ minutesPerGem: positive, minGems: nonNeg }),
    adSpeedup: z.object({ minutes: positive, perDay: z.number().int().nonnegative() }),
    badLuck: z.object({ minDumpsterLevel: z.number().int().positive(), drySpell: z.number().int().positive(), minRarity: RaritySchema }),
    uniqueLegendaryChance: z.number().min(0).max(1),
    tutorialItem: z.object({ baseId: z.string(), rarity: RaritySchema, level: z.number().int().positive() }),
    defaultTheme: z.string(),
    luckPerLevel: nonNeg,
    bigRevealMinRarity: RaritySchema,
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
  /**
   * The wheel: each roll is one spin (spinSeconds) then a short rest (restSeconds). Spin Speed
   * upgrades shrink the whole cycle; a Trash Bag makes one spin turboSpeedMult times faster.
   */
  roll: z.object({
    spinSeconds: positive,
    restSeconds: nonNeg,
    minCycleSeconds: positive,
    speedPerLevel: z.number().min(0).max(1),
    turboSpeedMult: positive,
    minTurboCycleSeconds: positive,
    maxRollsPerTick: z.number().int().positive(),
    luckyRollEvery: z.number().int().positive(),
    luckyRollMinEvery: z.number().int().positive(),
    luckyRollMult: positive,
    /** Luck multiplier of a Golden Spin (chance bought in the upgrade tree). */
    goldenLuckMult: positive,
  }),
  /** Base odds as "1 in X" for every rarity above Junk. */
  rarityOdds: z.object({ decent: positive, shiny: positive, epic: positive, legendary: positive, mythic: positive, mint: positive }),
  luck: z.object({
    potion: z.object({ mult: positive, seconds: positive, waveDropChance: z.number().min(0).max(1) }),
  }),
  inventory: z.object({ baseCapacity: z.number().int().positive() }),
  economy: z.object({ scrapGoldMult: nonNeg, scrapXpMult: nonNeg }),
  rebirth: z.object({
    baseWorld: z.number().int().positive(),
    worldPer: z.number().int().nonnegative(),
    /** Gold needed = goldBase x worlds.goldGrowth^(required world - 1) x goldPerRebirth^rebirths. */
    goldBase: nonNeg,
    goldPerRebirth: positive,
    luckPer: nonNeg,
    goldMultPer: nonNeg,
    /** +% ATK and HP per rebirth. */
    statPctPer: nonNeg,
    /** Upgrades cost (1 - this)^rebirths as much. */
    upgradeDiscountPer: z.number().min(0).max(0.9),
  }),
  upgrades: z
    .array(
      z.object({
        id: z.string().min(1),
        effect: z.enum([
          'luck', 'goldPct', 'rollSpeed', 'capacity', 'luckyEvery', 'enchantChance', 'atkPct', 'hpPct', 'bagFind',
          'turboPower', 'luckyMult', 'goldenSpin', 'enchantTier', 'pity', 'scrapPct', 'xpPct', 'potionTime', 'offlinePct',
          'lifesteal', 'critChance', 'critDmg', 'bossDmg',
        ]),
        perLevel: positive,
        max: z.number().int().positive(),
        cost: z.object({ base: positive, growth: positive }),
        /** The upgrade tree: this node unlocks once its parent reaches `level`. */
        requires: z.object({ id: z.string().min(1), level: z.number().int().positive() }).optional(),
      }),
    )
    .min(1),
  enchant: z.object({
    baseChance: z.number().min(0).max(1),
    countWeights: z.array(nonNeg).length(3),
    tierWeights: z.array(nonNeg).length(3),
    /** Enchant Mastery: per level, added to the tier I/II/III weights. */
    tierShiftPerLevel: z.array(z.number()).length(3),
    powerPerTier: z.array(nonNeg).length(3),
    burnSeconds: positive,
    chainDamage: nonNeg,
    burnEventSeconds: positive,
  }),
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

export const EnchantEffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('luck'), values: z.array(nonNeg).length(3) }),
  z.object({ type: z.literal('goldPct'), values: z.array(nonNeg).length(3) }),
  z.object({ type: z.literal('mod'), stat: StatIdSchema, mode: ModModeSchema, values: z.array(nonNeg).length(3) }),
  z.object({ type: z.literal('burn'), values: z.array(nonNeg).length(3) }),
  z.object({ type: z.literal('chain'), values: z.array(z.number().min(0).max(1)).length(3) }),
  z.object({ type: z.literal('echo'), values: z.array(z.number().min(0).max(1)).length(3) }),
  z.object({ type: z.literal('explode'), values: z.array(nonNeg).length(3) }),
  z.object({ type: z.literal('thorns'), values: z.array(nonNeg).length(3) }),
  z.object({ type: z.literal('rarityUp'), values: z.array(z.number().int().nonnegative()).length(3) }),
]);
export type EnchantEffect = z.infer<typeof EnchantEffectSchema>;
export const EnchantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  weight: positive,
  effect: EnchantEffectSchema,
});
export type EnchantDef = z.infer<typeof EnchantSchema>;
export const EnchantsSchema = z.array(EnchantSchema).min(1);

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

export const StringsSchema = z.record(z.string(), z.string());

export const EnemyShapeSchema = z.enum(['rat', 'pigeon', 'raccoon', 'ratKing', 'raccoonBoss', 'officer']);
export type EnemyShape = z.infer<typeof EnemyShapeSchema>;

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'expected a #RRGGBB color');

/** An enemy as it appears in one world: base enemy id plus that world's name and colors. */
const WorldFoeSchema = z.object({ id: z.string().min(1), name: z.string().min(1), color: hex, accent: hex });
export type WorldFoe = z.infer<typeof WorldFoeSchema>;

export const WorldSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  theme: z.string().min(1),
  enemies: z.array(WorldFoeSchema).min(1),
  boss: WorldFoeSchema,
  /** Sky gradient plus a hue/saturation/brightness grade applied to the scenery art. */
  look: z.object({
    skyTop: hex,
    skyBottom: hex,
    hue: z.number().min(-360).max(360),
    sat: z.number().nonnegative(),
    bright: z.number().positive(),
    night: z.boolean(),
  }),
});
export type WorldDef = z.infer<typeof WorldSchema>;
export const WorldsSchema = z.array(WorldSchema).min(1);

export const AssetsSchema = z.object({
  files: z.record(z.string(), z.string()),
  placeholders: z.object({
    palette: z.record(z.string(), hex),
    rarities: rarityRecord(z.object({ color: hex, gradient: z.array(hex).optional() })),
    enemies: z.record(
      z.string(),
      z.object({ shape: EnemyShapeSchema, color: hex, accent: hex, size: positive, label: z.string() }),
    ),
    raccoon: z.object({ body: hex, mask: hex, belly: hex, tail: hex, brow: hex }),
    slots: slotRecord(z.string()),
  }),
});
export type Assets = z.infer<typeof AssetsSchema>;
