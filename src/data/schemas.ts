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
export const RARITIES = [
  'junk', 'decent', 'shiny', 'epic', 'legendary', 'mythic', 'vintage', 'limited', 'prototype', 'mint', 'gemMint', 'museum', 'grail',
] as const;
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
const unitInterval = z.number().min(0).max(1);

// ---------------------------------------------------------------- heists (section 9 of the spec)
export const LOCATION_IDS = ['pizza', 'mall', 'hotel'] as const;
export const LocationIdSchema = z.enum(LOCATION_IDS);
export type LocationId = z.infer<typeof LocationIdSchema>;

/** The stops of a run. A Golden Dumpster replaces a Treasure; the boss ends act 3. */
export const HEIST_NODE_KINDS = ['fight', 'elite', 'choice', 'treasure', 'golden', 'shop', 'shrine', 'trap', 'wheel', 'boss'] as const;
export const HeistNodeKindSchema = z.enum(HEIST_NODE_KINDS);
export type HeistNodeKind = z.infer<typeof HeistNodeKindSchema>;
/** The kinds a random stop can roll (weights per act in balance.json). */
export const HEIST_ROLLED_KINDS = ['fight', 'elite', 'choice', 'treasure', 'shop', 'shrine', 'trap', 'wheel'] as const;
export type HeistRolledKind = (typeof HEIST_ROLLED_KINDS)[number];

export const PERK_TAGS = ['fire', 'speed', 'loot', 'crit', 'tank', 'crew', 'chaos'] as const;
export const PerkTagSchema = z.enum(PERK_TAGS);
export type PerkTag = z.infer<typeof PerkTagSchema>;
/** Offers roll common, rare and epic perks; evolutions are never rolled, they appear when their recipe is held. */
export const PERK_RARITIES = ['common', 'rare', 'epic', 'evolution'] as const;
export const PerkRaritySchema = z.enum(PERK_RARITIES);
export type PerkRarity = z.infer<typeof PerkRaritySchema>;

/**
 * What a perk or curse does in a run, as numbers the combat and run code read (heist.ts sums them
 * over every perk held). Each key's meaning:
 * - atkSpdPct, hpPct, armorPct (less damage taken), coinPct (run coins), bagPct (Trash Bags): percent;
 * - dodge, crit, critDmg: added to the stat;
 * - burnChance/burnSeconds/burnAtk: a chance on hit to burn for N seconds at a share of ATK per second;
 *   burningBonusPct: more damage to burning enemies; burnSpread: burns hit every enemy; burnBonusPct: burn damage;
 * - stunChance/stunSeconds: a chance on hit to stun; stunBelowHpPct: every hit stuns below this HP %;
 * - rabidChance/rabidMult: a chance for a hit to deal N times its damage; critEvery: every Nth hit crits;
 * - blockFirst: hits blocked at the start of each fight; blockEvery: one block every N seconds;
 * - dodgeAttack: a dodge strikes back; critCoins: run coins per crit; feral: attack speed % per missing HP %;
 * - rushPct/rushSeconds: attack speed for the first seconds of each fight;
 * - pigeons/pigeonAtk/pigeonEvery and roccoAtk/roccoEvery: helpers hitting for a share of ATK every N seconds;
 * - executePct: enemies under this HP % are finished off; nineLivesPct: once per run, survive a killing blow at this HP %;
 * - healAfterFightPct: heal after each fight won; flipUpPct/flipDownPct: each fight's ATK coin flip;
 * - greaseFireSeconds: a kill burns the next enemy; paperCutsPct: max HP % lost at every stop;
 * - extraFights / extraTreasures: stops per act turned into fights / treasures.
 */
export const PERK_EFFECT_KEYS = [
  'atkSpdPct', 'dodge', 'crit', 'critDmg', 'hpPct', 'armorPct',
  'burnChance', 'burnSeconds', 'burnAtk', 'burningBonusPct', 'burnSpread', 'burnBonusPct',
  'stunChance', 'stunSeconds', 'stunBelowHpPct', 'rabidChance', 'rabidMult', 'critEvery',
  'blockFirst', 'blockEvery', 'dodgeAttack', 'critCoins', 'feral', 'rushPct', 'rushSeconds',
  'pigeons', 'pigeonAtk', 'pigeonEvery', 'roccoAtk', 'roccoEvery', 'executePct', 'nineLivesPct',
  'healAfterFightPct', 'coinPct', 'bagPct', 'flipUpPct', 'flipDownPct', 'greaseFireSeconds',
  'paperCutsPct', 'extraFights', 'extraTreasures',
] as const;
export type PerkEffectKey = (typeof PERK_EFFECT_KEYS)[number];
export const PerkEffectSchema = z.partialRecord(z.enum(PERK_EFFECT_KEYS), z.number());
export type PerkEffect = z.infer<typeof PerkEffectSchema>;

const nodeWeights = z.object({
  fight: nonNeg, elite: nonNeg, choice: nonNeg, treasure: nonNeg, shop: nonNeg, shrine: nonNeg, trap: nonNeg, wheel: nonNeg,
});

export const WHEEL_KINDS = ['coins', 'heal', 'bags', 'perk', 'gems'] as const;

/** Heist tuning (balance.json `heist`). Content (locations, perks, events) lives in heist.json and heistEvents.json. */
export const HeistBalanceSchema = z.object({
  /** Heists open with this many rebirths (until then the Heist tab shows what is coming). */
  unlockRebirths: z.number().int().nonnegative(),
  /** Free tickets: `perDay` at each local midnight, never more than `max`; one more a day from an ad. */
  tickets: z.object({ perDay: z.number().int().positive(), max: z.number().int().positive(), adPerDay: z.number().int().nonnegative(), start: z.number().int().nonnegative() }),
  /** Run fights tick this many times per game tick (the spec's 2x speed). */
  fightSpeed: z.number().int().positive(),
  nodesPerAct: z.number().int().positive(),
  /** Enemy HP and ATK multipliers per act; the boss uses act 3's on top of its own stats. */
  actMult: z.array(positive).length(3),
  nodeWeights: z.array(nodeWeights).length(3),
  /** At least this many fights (or elites) in each act; the first stop of a run is always a fight. */
  minFights: z.array(z.number().int().nonnegative()).length(3),
  /** A Treasure stop is a Golden Dumpster this often: `spins` spins at `luckMult` times the raccoon's luck. */
  golden: z.object({ chance: unitInterval, spins: z.number().int().positive(), luckMult: positive }),
  /** Run stats = the raccoon's stats x these, then perks. */
  scaling: statRecord(nonNeg),
  enemies: z.object({
    /**
     * A run's enemies come from its "heist world": the (fractional) world where the raccoon's threat
     * margin (worldThreat) would be `refMargin`, so a run fits how strong the raccoon is right now.
     */
    refMargin: positive,
    /** Over the stats of the heist world's enemies (regulars; elites and the boss have their own on top). */
    hpMult: positive,
    atkMult: positive,
    elite: z.object({ hpMult: positive, atkMult: positive }),
    boss: z.object({ hpMult: positive, atkMult: positive }),
    /** Enemy HP and ATK while the Pizza Place has never been beaten (the first run is a gentle one). */
    firstRunMult: positive,
    fightSize: z.array(range).length(3),
    /** Regular enemies fighting next to an elite, per act. */
    eliteAdds: z.array(z.number().int().nonnegative()).length(3),
  }),
  /** Cumulative run XP for run levels 2, 3, ... */
  levels: z.array(positive).min(1),
  xp: z.object({ regular: nonNeg, elite: nonNeg }),
  coins: z.object({ regular: nonNeg, elite: nonNeg, start: nonNeg }),
  maxPerks: z.number().int().positive(),
  rarityWeights: z.object({ common: nonNeg, rare: nonNeg, epic: nonNeg }),
  offerSize: z.number().int().positive(),
  maxEvolutionsPerOffer: z.number().int().nonnegative(),
  /** A level-up with every perk slot full heals this % instead. */
  fullHealPct: nonNeg,
  rerolls: z.object({ free: z.number().int().nonnegative(), gems: nonNeg }),
  revive: z.object({ hpPct: positive, gems: nonNeg }),
  /** A lost run keeps this % of the rewards collected so far. */
  lossKeepPct: z.number().min(0).max(100),
  treasure: z.object({ coins: range, bags: range, bagsChance: unitInterval }),
  trap: z.object({ damagePct: nonNeg, curseChance: unitInterval }),
  shrine: z.object({ maxHpPct: nonNeg }),
  /**
   * A shop's first card is its health counter: a +max HP perk `maxHpChance` of the time, otherwise
   * (or when it has no +max HP perk to sell) a Snack that heals `healPct`. Then `perks` random perks.
   * An act laid out while the run's coins can't cover the cheapest perk price gets no shop stops.
   */
  shop: z.object({
    healPct: positive,
    maxHpChance: unitInterval,
    perks: z.number().int().nonnegative(),
    prices: z.object({ heal: nonNeg, common: nonNeg, rare: nonNeg, epic: nonNeg, removeCurse: nonNeg, reroll: nonNeg }),
  }),
  /** The Jackpot Wheel's segments (shown with their odds). `perk` gives a random perk. */
  wheel: z.array(z.object({ kind: z.enum(WHEEL_KINDS), value: nonNeg, weight: positive })).min(2),
  /** Per location: enemy difficulty and what a win pays (coins x the gold growth of the raccoon's best world). */
  locations: z.record(LocationIdSchema, z.object({ difficulty: positive, bags: nonNeg, gems: nonNeg, coins: nonNeg })),
  /** A win's chance at the location's ring, rolled at the raccoon's luck x `luckMult`, at least `minRarity`. */
  ring: z.object({ chance: unitInterval, luckMult: positive, minRarity: RaritySchema }),
  logMax: z.number().int().positive(),
});
export type HeistBalance = z.infer<typeof HeistBalanceSchema>;

// ---------------------------------------------------------------- Alley perks (bought with Half-Eaten Bread Loaves)
/** The perk trees on the Upgrades screen's Perks page (names and lines in strings.en.json perkTree.*). */
export const PERK_TREE_IDS = ['crew', 'chaos', 'reels', 'bread'] as const;
export const PerkTreeIdSchema = z.enum(PERK_TREE_IDS);
export type PerkTreeId = z.infer<typeof PerkTreeIdSchema>;

/**
 * What an Alley perk does, as numbers core reads (src/core/systems/perks.ts adds them up over the perks
 * owned: a `...Mult` multiplies, an `...Every` interval takes the shortest, the rest add). Each key:
 * - the crew (the Alley battle only), helpers hitting through DEF, no crits:
 *   pigeonAtkPct / pigeonEvery: a pigeon pecks the front enemy for a % of ATK every N s;
 *   ratAtkPct / ratEvery: every enemy on screen loses a % of ATK every N s;
 *   healPct / healEvery: heals % of max HP every N s in a fight;
 *   gullAtkPct / gullEvery: every N s, every enemy takes a % of ATK;
 *   recruitAtkPct / recruitEvery / recruitMax: each regular enemy beaten joins until the world ends (at most
 *   recruitMax), each hitting the front enemy for a % of ATK every N s;
 *   golemAtkPct / golemEvery: every N s the front enemy takes a % of ATK per loaf earned this run;
 * - bad decisions: atkSpdPct (+% attack speed), hpCutPct (-% max HP), atkMult and hpMult (ATK and max HP x),
 *   secondWindPct (once per world the first knockout leaves the raccoon at this % HP), rageBelowPct /
 *   rageMult (below this HP % the raccoon's hits deal x damage), bossDmgMult (bosses take x damage),
 *   regularAtkPct (+% regular enemies' ATK);
 * - the reels: spinSpeedMult (reels x as fast), bossAtkPct (+% bosses' ATK), tokenChanceMult (luck tokens
 *   x as often), bagCutPct (-% bag space), scrapGoldMult (scrap gold x), extraReels (+reels),
 *   spinTimePct (+% spin time), jackpotEvery (every Nth spin every reel lands at least the perk's `rarity`);
 * - the bread: bonusLoafEvery (every Nth world beaten this run pays a bonus loaf), heldLoafLuckPct (+% luck
 *   per uneaten loaf), extraLoaves (more loaves per world), bossHpPct (+% bosses' HP), eatenLoafPct (+% ATK
 *   and max HP per loaf eaten this run).
 */
export const ALLEY_PERK_KEYS = [
  'pigeonAtkPct', 'pigeonEvery', 'ratAtkPct', 'ratEvery', 'healPct', 'healEvery', 'gullAtkPct', 'gullEvery',
  'recruitAtkPct', 'recruitEvery', 'recruitMax', 'golemAtkPct', 'golemEvery',
  'atkSpdPct', 'hpCutPct', 'atkMult', 'hpMult', 'secondWindPct', 'rageBelowPct', 'rageMult', 'bossDmgMult', 'regularAtkPct',
  'spinSpeedMult', 'bossAtkPct', 'tokenChanceMult', 'bagCutPct', 'scrapGoldMult', 'extraReels', 'spinTimePct', 'jackpotEvery',
  'bonusLoafEvery', 'heldLoafLuckPct', 'extraLoaves', 'bossHpPct', 'eatenLoafPct',
] as const;
export type AlleyPerkKey = (typeof ALLEY_PERK_KEYS)[number];

export const AlleyPerkSchema = z.object({
  id: z.string().min(1),
  tree: PerkTreeIdSchema,
  /** Half-Eaten Bread Loaves: 1 for a tree's root, more the deeper it sits. */
  cost: z.number().int().min(1).max(4),
  /** Owning any one of these opens it (none: a tree's root). */
  requires: z.array(z.string().min(1)),
  /** Its icon: a UI icon name (src/render/pixel/ui.ts). */
  icon: z.string().min(1),
  effect: z.partialRecord(z.enum(ALLEY_PERK_KEYS), positive),
  /** jackpotEvery: the rarity its rigged spins land at least. */
  rarity: RaritySchema.optional(),
});
export type AlleyPerkDef = z.infer<typeof AlleyPerkSchema>;

export const PerksBalanceSchema = z.object({
  /** The Perks page opens with this many rebirths (the first runs are plain). */
  unlockRebirths: z.number().int().nonnegative(),
  /** Loaves for each world whose boss falls for the first time in a run. */
  loavesPerWorld: z.number().int().positive(),
  /** The trees, in the order the Perks page shows them, each with its icon. */
  trees: z.array(z.object({ id: PerkTreeIdSchema, icon: z.string().min(1) })).length(PERK_TREE_IDS.length),
  list: z.array(AlleyPerkSchema).min(1),
});
export type PerksBalance = z.infer<typeof PerksBalanceSchema>;

// ---------------------------------------------------------------- balance.json
export const BalanceSchema = z.object({
  tickRate: positive,
  player: z.object({
    base: statRecord(z.number()),
    perLevel: statRecord(z.number()),
    caps: z.object({ CRIT: positive, DODGE: positive, ATK_SPD: positive }),
    levelCap: z.number().int().positive(),
    /** XP for the next level: base x level^exponent, times early[level - 1] for the first levels (front-loaded). */
    xpCurve: z.object({ base: positive, exponent: positive, early: z.array(positive).default([]) }),
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
    /** After a boss falls the battle waits this long for Again or Next, then moves on to the next world. */
    choiceSeconds: positive,
    /** A world is retried after a loss; this many losses in a row there fall back a world (idle play keeps winning). */
    lossesBeforeBack: z.number().int().min(1),
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
    /** Every worn item's own stats grow this much per raccoon level (see gearScale in stats.ts). */
    levelScalePerLevel: nonNeg,
    /** Item power from rarity: base x (1 in X odds, enchantments included) ^ oddsExponent. */
    power: z.object({ base: positive, oddsExponent: positive }),
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
    /**
     * Offline rolls: the dumpster spins once per (spin cycle x rollSlowdown) away (times efficiency
     * and the offline bonus), at most maxRolls items. Finds as rare as a plain `keepRarity` item go to
     * the bag; the rest add `scrapShare` of their scrap value to the offline reward (0: dropped). The
     * popup lists up to keepListMax finds.
     */
    rollSlowdown: positive,
    maxRolls: z.number().int().nonnegative(),
    keepRarity: RaritySchema,
    scrapShare: z.number().min(0).max(1),
    keepListMax: z.number().int().positive(),
  }),
  start: z.object({ coins: nonNeg, gems: nonNeg, bags: nonNeg }),
  /**
   * The reels: each roll is one spin (spinSeconds) then a short rest (restSeconds). Spin Speed
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
    /** Most reels a spin can roll at once (1 + Extra Reel tiers). */
    maxReels: z.number().int().positive(),
    luckyRollEvery: z.number().int().positive(),
    luckyRollMinEvery: z.number().int().positive(),
    luckyRollMult: positive,
    /** Luck multiplier of a Golden Spin (chance bought in the upgrade tree). */
    goldenLuckMult: positive,
    /**
     * Luck tokens: a reel can land on a clover token instead of an item (`chance`). The token
     * multiplies that reel's luck, the reel holds on it for holdSeconds, then rolls again as long as a
     * normal roll (never faster); each re-roll lands another token with `chainChance`, up to maxSteps
     * tokens, until it lands an item rolled at the multiplied luck.
     */
    multiplier: z.object({
      chance: z.number().min(0).max(0.5),
      chainChance: z.number().min(0).max(0.9),
      maxSteps: z.number().int().min(0),
      holdSeconds: nonNeg,
      values: z.array(z.object({ x: z.number().min(1.5), weight: positive })).min(1),
      /** A chain this big (x, the tokens multiplied) guarantees at least this rarity. */
      floors: z.array(z.object({ x: positive, rarity: RaritySchema })).default([]),
    }),
  }),
  /** Base odds as "1 in X" for every rarity above Junk. */
  rarityOdds: z.object({
    decent: positive, shiny: positive, epic: positive, legendary: positive, mythic: positive, vintage: positive, limited: positive,
    prototype: positive, mint: positive, gemMint: positive, museum: positive, grail: positive,
  }),
  luck: z.object({
    potion: z.object({ mult: positive, seconds: positive, waveDropChance: z.number().min(0).max(1) }),
  }),
  inventory: z.object({ baseCapacity: z.number().int().positive() }),
  economy: z.object({ scrapGoldMult: nonNeg, scrapXpMult: nonNeg, tierGrowth: z.array(positive).min(1).optional() }),
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
          'lifesteal', 'critChance', 'critDmg', 'bossDmg', 'reels',
        ]),
        perLevel: positive,
        max: z.number().int().positive(),
        cost: z.object({ base: positive, growth: positive }),
        /** The upgrade map: this line's first tier hangs off tier `level` of line `id`. */
        requires: z.object({ id: z.string().min(1), level: z.number().int().positive() }).optional(),
        /** Drawn as gold hexes: one-off big bonuses, and the expensive Extra Reel line. */
        special: z.boolean().optional(),
        /**
         * Hex-map layout: space-separated steps (n, ne, se, s, sw, nw, optionally `dir*count`) from the
         * parent tier to tier I, then on to each next tier. The root line starts at the center, so its
         * path has one step fewer. Checked at boot: no two tiers may share a hex.
         */
        path: z.string().regex(/^((n|ne|se|s|sw|nw)(\*\d+)?( (n|ne|se|s|sw|nw)(\*\d+)?)*)?$/),
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
    /**
     * A roll this rare at the raccoon's current luck ("1 in X" for its tier or better, see luckOddsOneIn)
     * gets the full-screen reveal; huge and insane ones get a longer, louder one.
     */
    /**
     * The Roll tab's smaller build-ups (reelDrama.ts): a find this rare at the raccoon's luck ("1 in X",
     * enchantments included) gets a riser and a climbing glow (`rare`), a longer one (`veryRare`). A
     * turbo spin carrying one runs at normal speed so it can play out (luck.ts spinBuildsUp).
     */
    buildUp: z.object({ rare: positive, veryRare: positive }),
    /** The big reveal: a roll's tier-or-better odds at the raccoon's luck must reach `big` (`huge`, `insane` make it bigger). */
    bigRoll: z.object({ big: positive, huge: positive, insane: positive, tierOneIn: positive }),
    /** A Scrap All worth this many minutes of fighting (see haulMinutes) gets a big, huge or mega haul moment. */
    haul: z.object({ big: positive, huge: positive, mega: positive }),
    rattleBeatsByRarity: rarityRecord(z.number().int().positive()),
    revealSecondsByRarity: rarityRecord(positive),
    hotDumpsterStartPct: nonNeg,
    maxCatchUpTicksPerFrame: z.number().int().positive(),
    /**
     * The reels' look. The items rolling past are a tease, not a sample: their rarities follow
     * `fillerWeights` (much rarer than the real odds), and right next to a non-Legendary result
     * there is a Legendary-or-better near miss `nearMissChance` of the time. Only the landed
     * results come from the real odds. `flairChance`: share of fillers shown with enchantment odds.
     */
    reels: z.object({
      fillerWeights: rarityRecord(nonNeg),
      nearMissChance: z.number().min(0).max(1),
      flairChance: z.number().min(0).max(1),
      cellsPerSecond: positive,
      minCells: z.number().int().positive(),
      /** When the first of several reels stops, as a share of the spin (the last stops at the end). */
      firstStopShare: z.number().min(0.1).max(1),
    }),
  }),
  mockAds: z.object({ watchSeconds: nonNeg }),
  heist: HeistBalanceSchema,
  /** Alley perks: a run's Half-Eaten Bread Loaves buy them on the Upgrades screen's Perks page (core/systems/perks.ts). */
  perks: PerksBalanceSchema,
  /**
   * The first-run tutorial (new games only). Beginner's luck: one scripted spin early on, its first
   * reel chaining `beginnerTokens` into a `beginnerRarity` item. It comes once the raccoon has put
   * on `beginnerAfterEquips` items (the tutorial's Equip best), `beginnerAfterRolls` items have rolled
   * and the dumpster has been open `beginnerAfterSeconds` (its two tokens take the find to about 45 s
   * in), or at `beginnerAtRolls` regardless. Putting that item on ends the tutorial with
   * `rewardGems`. The reels rest on each of the tutorial's scripted finds (the first roll, beginner's
   * luck) while it waits in the bag to be put on, `holdSeconds` at most, so it stays where the
   * tutorial's hand points.
   */
  tutorial: z.object({
    /**
     * A new game's first spins warm the player up before the tutorial's own find (Kevin: "get them
     * accustomed a bit first to rolling"): one everyday find per spin, at these rarities in turn.
     */
    warmupRarities: z.array(RaritySchema),
    beginnerAfterRolls: z.number().int().positive(),
    beginnerAfterEquips: z.number().int().positive(),
    beginnerAfterSeconds: nonNeg,
    beginnerAtRolls: z.number().int().positive(),
    beginnerRarity: RaritySchema,
    beginnerTokens: z.array(z.number().positive()),
    rewardGems: nonNeg,
    holdSeconds: positive,
    /**
     * Features open one by one in a new game (src/core/systems/features.ts). Those waiting for the
     * tutorial to end also open after `overAtRolls` rolls, so a tutorial left unfinished never holds
     * them back; the Rebirth tab opens `rebirthTabWorldsEarly` worlds before the first rebirth's world.
     */
    overAtRolls: z.number().int().positive(),
    rebirthTabWorldsEarly: z.number().int().nonnegative(),
  }),
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
  /** Rebirths needed before the dumpster can roll it (0: from the start). */
  unlock: z.number().int().min(0).default(0),
  unique: z.boolean().optional(),
  bonus: z.array(ModSchema).optional(),
  /** A heist-exclusive item: only a win at this location can drop it (the dumpster never rolls it). */
  heist: LocationIdSchema.optional(),
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
  /** A heavy hit that can't be dodged or blocked. */
  z.object({ type: z.literal('charge'), name: z.string(), everySeconds: positive, damageMult: positive }),
  /** Calls in `enemyId` (a regular enemy) in front of itself every N seconds, at most `max` alive at once. */
  z.object({ type: z.literal('summon'), name: z.string(), everySeconds: positive, enemyId: z.string().min(1), max: z.number().int().positive() }),
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
  /** More specials, on top of `special` (a heist boss can have two). */
  specials: z.array(BossSpecialSchema).optional(),
});
export type EnemyDef = z.infer<typeof EnemySchema>;
export const EnemiesSchema = z.array(EnemySchema).min(1);

export const StringsSchema = z.record(z.string(), z.string());

// ---------------------------------------------------------------- heist content (heist.json, heistEvents.json)
export const HeistLocationSchema = z.object({
  id: LocationIdSchema,
  name: z.string().min(1),
  /** One line for the location card. */
  blurb: z.string().min(1),
  /** The world whose backdrop and colors the run's battle borrows. */
  world: z.number().int().positive(),
  /** Opens once this world is beaten (in any rebirth; 0: open from the start). */
  unlockWorld: z.number().int().nonnegative(),
  /** Regular enemies (enemies.json ids), elites (kind miniboss) and the boss. */
  enemies: z.array(z.string().min(1)).min(1),
  elites: z.array(z.string().min(1)).min(1),
  boss: z.string().min(1),
  /** The heist-exclusive ring a win can drop (items.json id). */
  ring: z.string().min(1),
});
export type HeistLocationDef = z.infer<typeof HeistLocationSchema>;

export const PerkSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tag: PerkTagSchema,
  rarity: PerkRaritySchema,
  text: z.string().min(1),
  effect: PerkEffectSchema,
  /** Evolutions only: the perks to hold (plus, with `anyTag`, any other perk with that tag). They merge into the evolution. */
  recipe: z.object({ perks: z.array(z.string().min(1)).min(1), anyTag: PerkTagSchema.optional() }).optional(),
  /** Sold only at a shop's health counter (+max HP perks): never offered at a level-up, a shrine, the wheel or a choice. */
  shopOnly: z.boolean().optional(),
});
export type PerkDef = z.infer<typeof PerkSchema>;

export const CurseSchema = z.object({ id: z.string().min(1), name: z.string().min(1), text: z.string().min(1), effect: PerkEffectSchema });
export type CurseDef = z.infer<typeof CurseSchema>;

/**
 * A kind of trap a Trap stop can be (what it does stays the trap's: heist.trap). Its name and line are
 * strings.en.json `heist.trap.<id>.name` and `.text`; it springs only at `locations` (default: everywhere).
 */
export const HeistTrapSchema = z.object({ id: z.string().min(1), locations: z.array(LocationIdSchema).min(1).optional() });

export const HeistFileSchema = z.object({
  locations: z.array(HeistLocationSchema).length(LOCATION_IDS.length),
  perks: z.array(PerkSchema).min(1),
  curses: z.array(CurseSchema).min(1),
  traps: z.array(HeistTrapSchema).min(1),
});
/** A trap with its name and line (from strings.en.json). */
export type HeistTrapDef = z.infer<typeof HeistTrapSchema> & { name: string; text: string };

/** Kinds of foe a choice event can promise to fight, as they're drawn (assets.json enemy shapes). */
export const HEIST_FOES = ['rat', 'pigeon', 'raccoon'] as const;

/** What a choice option does. Outcomes with a `chance` are one roll between them; the others always happen. */
export const OUTCOME_TYPES = [
  'healPct', 'damagePct', 'maxHpPct', 'gainPerk', 'gainCurse', 'runCoins', 'trashBags', 'fight', 'eliteFight',
  'skipNext', 'skipFight', 'truce', 'openShop', 'treasure', 'jackpotWheel', 'noTraps', 'savedHeal', 'nothing',
] as const;
export type OutcomeType = (typeof OUTCOME_TYPES)[number];
export const OutcomeSchema = z.object({
  type: z.enum(OUTCOME_TYPES),
  chance: z.number().gt(0).max(1).optional(),
  /** Percent for healPct / damagePct / maxHpPct / savedHeal, coins or bags, or stops for truce. */
  value: z.number().optional(),
  /** gainPerk: a given perk, or a random one with this tag or rarity. */
  perkId: z.string().optional(),
  tag: PerkTagSchema.optional(),
  rarity: z.enum(['common', 'rare', 'epic']).optional(),
  /** gainCurse: a given curse (default: a random one). */
  curseId: z.string().optional(),
  /** fight / eliteFight: multiplies the fight's run coins and XP. */
  rewardMult: positive.optional(),
  /** savedHeal: it triggers below this HP %. */
  below: positive.optional(),
});
export type OutcomeDef = z.infer<typeof OutcomeSchema>;

export const HeistEventSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  acts: z.array(z.number().int().min(1).max(3)).min(1),
  weight: positive,
  /** Only at these locations (default: everywhere). */
  locations: z.array(LocationIdSchema).optional(),
  /**
   * The foe its text names: a fight it starts brings only the location's regular enemies drawn as this
   * (an elite fight, only such adds). Any event whose text names a rat, pigeon or raccoon and starts a fight has one.
   */
  foe: z.enum(HEIST_FOES).optional(),
  options: z
    .array(
      z.object({
        label: z.string().min(1),
        outcomes: z.array(OutcomeSchema).min(1),
      }),
    )
    .min(2)
    .max(3),
});
export type HeistEventDef = z.infer<typeof HeistEventSchema>;
export const HeistEventsSchema = z.array(HeistEventSchema).min(1);

/** Enemy art: hand-drawn animated sheets (enemies.ts), the punk raccoon (the hero's sheet) and the farm animals (packs/farm.ts). */
export const EnemyShapeSchema = z.enum([
  'rat', 'pigeon', 'raccoon', 'ratKing', 'raccoonBoss', 'officer', 'soldier', 'orc', 'pumpkin', 'doc', 'bigDemon',
  'hen', 'duck', 'bunny', 'ram', 'pig', 'cow',
]);
export type EnemyShape = z.infer<typeof EnemyShapeSchema>;

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'expected a #RRGGBB color');

/** An enemy as it appears in one world: base enemy id plus that world's name and colors. */
const WorldFoeSchema = z.object({ id: z.string().min(1), name: z.string().min(1), color: hex, accent: hex });
export type WorldFoe = z.infer<typeof WorldFoeSchema>;

const unit = z.number().min(0).max(1);

/** Drifting ambient particles in a world's battle view (see src/render/ambience.ts). */
export const ParticleKindSchema = z.enum(['fireflies', 'snow', 'rain', 'leaves', 'petals', 'embers', 'spores', 'sparkles', 'wisps', 'motes']);
export type ParticleKind = z.infer<typeof ParticleKindSchema>;

/**
 * A world's atmosphere (src/render/pixel/atmosphere.ts): the sky, its sun or moon, clouds, haze and
 * the lights in the scenery. Positions are art pixels of the 90 x 68 battle view.
 */
export const AtmoSchema = z.object({
  /** Sky colors from the top of the view down to the horizon, painted in bands. */
  sky: z.array(hex).min(2).max(6),
  /** View row where the sky reaches its last color. */
  horizon: z.number().int().min(12).max(60),
  /** A sun, moon or planet with a glow around it (its halo, painted in stepped rings). */
  body: z
    .object({
      kind: z.enum(['sun', 'moon', 'planet']),
      x: z.number(),
      y: z.number(),
      r: z.number().min(2).max(10),
      color: hex,
      /** Craters on a moon, land on a planet. */
      accent: hex.optional(),
      halo: hex,
      haloR: z.number().min(0).max(48),
      /** A ring around a planet. */
      ring: z.boolean().optional(),
    })
    .optional(),
  /** Star density, 0 (none) to 1. */
  stars: unit,
  clouds: z
    .object({
      /** Puffy heaps (cumulus) or long thin streaks lit from below (sunset stratus). */
      style: z.enum(['puffy', 'streaky']),
      /** How much of the cloud band they fill, 0 to 1. */
      cover: unit,
      /** View row of the top of the cloud band. */
      y: z.number().int().min(0).max(40),
      light: hex,
      shade: hex,
      rim: hex,
    })
    .optional(),
  /** Aerial perspective: how far the far and mid scenery fade toward `color` (default: the horizon color). */
  haze: z.object({ color: hex.optional(), far: unit, mid: unit }),
  /** Light from the sun or moon catching the skyline's top and sun-side edges. */
  rim: z.object({ color: hex, amount: unit }).optional(),
  /** Scenery colors are multiplied by this (dusk and night darken and cool the street). */
  ambient: hex.optional(),
  /** Share of windows lit, 0 to 1. */
  windows: unit,
  /** Street lamps lit. */
  lamps: z.boolean(),
  /** Window and lamp light color. */
  light: hex,
  particles: ParticleKindSchema.optional(),
  /** Particle colors (default: the kind's own). */
  particleColors: z.array(hex).min(1).optional(),
  weather: z.enum(['rain', 'storm', 'snow']).optional(),
  /** Darkened corners, 0 (none) to 1. */
  vignette: unit,
});
export type Atmo = z.infer<typeof AtmoSchema>;

export const WorldSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  theme: z.string().min(1),
  enemies: z.array(WorldFoeSchema).min(1),
  boss: WorldFoeSchema,
  /** A hue / saturation / brightness grade for the street art, and the world's atmosphere (sky, light, weather). */
  look: z.object({
    hue: z.number().min(-360).max(360),
    sat: z.number().nonnegative(),
    bright: z.number().positive(),
    /** Which backdrop the battle uses (default: the suburban street). */
    scenery: z.enum(['suburbs', 'dungeon', 'farm']).optional(),
    /** Themed props set into the yards behind the fight (ids in src/render/pixel/packs/props.ts). */
    props: z.array(z.string().min(1)).optional(),
    atmo: AtmoSchema,
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
