import type { z } from 'zod';
import type { Feature, ItemSchema, SubstatSchema, ItemEnchantSchema, HeistRewards } from './state';
import type { HeistNodeKind, LocationId, Rarity, Slot, StatId } from '../data';
import type { RollDrama } from './systems/luck';
import type { HaulSize } from './systems/haul';

export type Item = z.infer<typeof ItemSchema>;
export type Substat = z.infer<typeof SubstatSchema>;
export type ItemEnchant = z.infer<typeof ItemEnchantSchema>;

export type Stats = Record<StatId, number>;

/** Where a rolled item ended up (equipping is always the player's call). */
export type RollPlacement = 'bag' | 'scrapped';

/** Events emitted by core for rendering, UI juice, and analytics. Never saved. */
export type CoreEvent =
  | { type: 'waveStart'; stage: number; wave: number }
  | { type: 'playerHit'; enemyUid: number; amount: number; crit: boolean; targetUid: number; killed: boolean; echo: boolean }
  /** `spikes`: a Spiky floor's prick (his own blow hurt him). */
  | { type: 'enemyHit'; enemyUid: number; amount: number; heavy: boolean; spikes?: boolean }
  /** An enemy dodged his swing (a Slippery floor), or it clanged off a gate boss's lid (`lid`). */
  | { type: 'enemyDodge'; enemyUid: number; lid?: boolean }
  /** A boss winds up its heavy hit: a Dodge tap in the next `seconds` makes it miss. */
  | { type: 'bossWindup'; enemyUid: number; name: string; seconds: number }
  /** A Dodge tap is in for the hit being wound up. */
  | { type: 'dodgeArmed' }
  /** The heavy hit missed: he dodged it, and answers with a big blow. */
  | { type: 'perfectDodge'; enemyUid: number }
  /** A gate boss took his hat (its stats are gone until he gets it back), and gave it back. */
  | { type: 'hatStolen'; enemyUid: number }
  | { type: 'hatBack'; enemyUid: number }
  /** A gate boss hides under its lid: direct hits do nothing for `seconds`. */
  | { type: 'lidUp'; enemyUid: number; seconds: number }
  | { type: 'playerDodge'; enemyUid: number }
  /** `perk`: Dr. Squeaks patching the raccoon up, or Playing Possum's second wind. */
  | { type: 'heal'; amount: number; source: 'lifesteal' | 'wave' | 'heist' | 'perk' }
  | { type: 'kill'; enemyUid: number; enemyId: string; coins: number; xp: number; kind: 'regular' | 'miniboss' | 'boss' }
  | { type: 'burn'; enemyUid: number; amount: number }
  | { type: 'chain'; fromUid: number; toUid: number; amount: number }
  | { type: 'explode'; fromUid: number; toUid: number; amount: number }
  | { type: 'thorns'; enemyUid: number; amount: number }
  | { type: 'bossSpecial'; enemyUid: number; name: string }
  | { type: 'bagDrop'; count: number }
  | { type: 'waveClear'; stage: number; wave: number }
  | { type: 'stageClear'; stage: number; firstTime: boolean }
  | { type: 'bossWin'; stage: number }
  /** A boss is down: the battle waits `seconds` for Again or Next (`next` is null in the last world). */
  | { type: 'bossChoice'; world: number; next: number | null; seconds: number; firstTime: boolean }
  | { type: 'worldFirstClear'; world: number; gems: number }
  | { type: 'playerDeath'; stage: number }
  | { type: 'stageStart'; stage: number; push: boolean }
  | { type: 'bossAttempt'; stage: number }
  | { type: 'levelUp'; level: number }
  /**
   * The reels start rolling. Each reel first lands on its luck tokens (`mults`, each multiplying its
   * luck, one every `stepSeconds` after `baseSpinSeconds`), then on `item` at `landAt`; the last reel
   * lands after `spinSeconds`.
   */
  | {
      type: 'spinStart';
      /** `drama`: the full-screen reveal the find gets as it lands (luck.ts judgeFinds). */
      reels: { item: Item; odds: number; mults: number[]; landAt: number; drama: RollDrama | null }[];
      /** The spin's smaller build-up: 0 none, 1 a riser and glow, 2 a longer one (luck.ts judgeFinds). */
      tease: 0 | 1 | 2;
      /**
       * Token steps (rounds) at which two or more reels landed a token together, a combo: each of
       * those reels counts the product of all that step's tokens (x2 and x5 make x10 on both).
       */
      matched: number[];
      lucky: boolean;
      golden: boolean;
      luck: number;
      turbo: boolean;
      spinSeconds: number;
      baseSpinSeconds: number;
      stepSeconds: number;
      restSeconds: number;
      /** A spin the tutorial scripts (its first reel): the very first one, or beginner's luck. */
      scripted?: 'first' | 'beginner';
      /** Rigged Jackpot (an Alley perk) rigged this spin: every reel lands this rarity or better. */
      rigged?: Rarity;
    }
  /** One reel lands (a spin with several reels sends one of these per reel). */
  | {
      type: 'roll';
      item: Item;
      /** Which reel, from 0 (left). */
      reel: number;
      lucky: boolean;
      golden: boolean;
      source: 'free' | 'turbo';
      /** Base odds of the item's rarity, "1 in X" (1 for Junk). */
      odds: number;
      /** The luck it was rolled at (the spin's luck times `mult`). */
      luck: number;
      /** Product of the luck tokens this reel landed on first, a matched one squared (1 without any). */
      mult: number;
      placed: RollPlacement;
      newRecord: boolean;
      /** The full-screen reveal it gets (luck.ts judgeFinds), or null. */
      drama: RollDrama | null;
      /** The tutorial scripted this result: the very first roll, or beginner's luck. */
      scripted?: 'first' | 'beginner';
    }
  | { type: 'equip'; item: Item; replaced: Item | null; auto: boolean }
  /** The beginner's luck item was put on: the tutorial is over (`gems` given for finishing it). */
  | { type: 'tutorialDone'; gems: number }
  /** A feature opened (src/core/systems/features.ts): the dumpster on the player's tap, the rest as they become useful. */
  | { type: 'featureUnlocked'; feature: Feature }
  | { type: 'scrap'; item: Item; xp: number; coins: number; auto: boolean }
  /**
   * `size`: the cutscene it gets against the run's usual hauls (haul.ts judgeHaul), null for none;
   * `usual`: what a usual haul is worth now (null before the run has a trend).
   */
  | { type: 'scrapAll'; count: number; xp: number; coins: number; size: HaulSize | null; usual: number | null }
  | { type: 'luckBoost'; endsAt: number; seconds: number }
  | { type: 'upgradeBought'; id: string; level: number }
  /** `unlocked`: base items the dumpster can roll from now on. */
  | { type: 'rebirth'; count: number; unlocked: string[] }
  | { type: 'codexEntry'; key: string; total: number }
  | { type: 'codexBonus'; index: number; gems: number }
  | { type: 'dumpsterUpgradeStarted'; level: number; endsAt: number }
  | { type: 'dumpsterUpgraded'; level: number }
  /** Back from time away: the reward is waiting. `rolls` items were rolled offline, `kept` of them rare finds (the best one is `best`). */
  | { type: 'offlineReady'; awayMs: number; rolls?: number; kept?: number; best?: Item | null }
  | { type: 'offlineCollected'; bags: number; coins: number; xp: number; doubled: boolean; minutes: number }
  | { type: 'clockWentBackward' }
  // ---- heists (src/core/systems/heist.ts)
  /** The ticket count changed (daily refill, the ad ticket, or a run started). */
  | { type: 'heistTickets'; tickets: number }
  /** Go: a stop starts (a fight's enemies walk in a moment later). */
  | { type: 'heistNode'; kind: HeistNodeKind; act: number; index: number }
  | { type: 'heistFightEnd'; won: boolean }
  | { type: 'heistLevelUp'; level: number }
  | { type: 'heistPerk'; id: string; evolution: boolean }
  | { type: 'heistCurse'; id: string; removed: boolean }
  /** The Jackpot Wheel landed on segment `index` of balance.heist.wheel. */
  | { type: 'heistWheel'; index: number; kind: string; value: number }
  /** A crew perk's helper hit an enemy (pigeon pecks, Rocco's bottle, the alley cat's finisher). */
  | { type: 'heistHelper'; helper: 'pigeon' | 'rocco' | 'cat'; enemyUid: number; amount: number; killed: boolean }
  /** A hit blocked by Lid Shield or Fortress of Junk. */
  | { type: 'heistBlock'; enemyUid: number }
  | { type: 'heistStun'; enemyUid: number; seconds: number }
  /** The run is over and banked: what was paid (and the ring, when it dropped). The main battle is back. */
  | { type: 'heistEnd'; won: boolean; rewards: HeistRewards; item: Item | null }
  // ---- Alley perks (src/core/systems/perks.ts)
  /** A world's boss fell for the first time this run: `loaves` Half-Eaten Bread Loaves, `bread` now in the pocket. */
  | { type: 'breadEarned'; world: number; loaves: number; bread: number }
  | { type: 'perkBought'; id: string; cost: number }
  /** A crew perk's helper hit an enemy in the Alley battle. */
  | { type: 'crewHit'; helper: CrewHelper; enemyUid: number; amount: number; killed: boolean }
  /** Playing Possum: a knockout blow left the raccoon standing at `hp`. */
  | { type: 'secondWind'; hp: number }
  // ---- the Endless Dump (src/core/systems/endless.ts)
  /** World 20 fell this run: the Dump is open (`first`: the very first time in the game). */
  | { type: 'dumpUnlocked'; first: boolean }
  | { type: 'dumpEnter'; mode: 'endless' | 'weekly'; floor: number }
  /** A floor is clear (`firstTime`: new this run, or this week on the Weekly Dive). */
  | { type: 'floorClear'; floor: number; gate: boolean; firstTime: boolean; mode: 'endless' | 'weekly' }
  /** A floor deeper than ever before is clear: `gems` paid. */
  | { type: 'dumpDeepest'; floor: number; gems: number }
  | { type: 'dumpRecord'; kind: 'fastestGate' | 'milestone'; value: number }
  /** A rarity tier past Grail opened (the dumpster can roll it now). */
  | { type: 'tierUnlocked'; rarity: Rarity; floor: number }
  | { type: 'weeklyReward'; floor: number; gems: number; stars: number }
  | { type: 'stenchChanged'; level: number }
  // ---- Become a Legend (src/core/systems/legend.ts)
  | { type: 'legend'; count: number; stars: number }
  | { type: 'legendPerkBought'; id: string; level: number; cost: number }
  // ---- daily tasks (src/core/systems/daily.ts)
  | { type: 'dailyNew'; day: string }
  | { type: 'dailyClaimed'; id: string; gems: number }
  | { type: 'dailyChest'; gems: number }
  | { type: 'error'; message: string };

/** The Alley crew: the pigeon, the sewer rats, the seagull, Raccoon Mafia's recruits and the Gluten Golem. */
export type CrewHelper = 'pigeon' | 'rats' | 'gull' | 'mafia' | 'golem';

export type GameAction =
  /** A new game's first tap: the padlock comes off the dumpster and it starts rolling. */
  | { type: 'openDumpster' }
  /** The tutorial has introduced a feature that opened (its tab or button was tapped, or its moment passed). */
  | { type: 'featureSeen'; feature: Feature }
  | { type: 'equipItem'; uid: number }
  /** Equips the biggest upgrade in every slot from the bag. */
  | { type: 'equipBest' }
  | { type: 'scrapItem'; uid: number }
  /** Scraps every unlocked item in the bag. */
  /** Scraps every unlocked item in the bag; `keepUpgrades` keeps the ones that would make him stronger (isUpgrade). */
  | { type: 'scrapAll'; keepUpgrades?: boolean }
  | { type: 'toggleLock'; uid: number }
  | { type: 'buyUpgrade'; id: string }
  /** Spends Half-Eaten Bread Loaves on an Alley perk (the Upgrades screen's Perks page). */
  | { type: 'buyPerk'; id: string }
  | { type: 'rebirth' }
  | { type: 'travel'; world: number }
  /** After a boss: on to the next world, or this one again. */
  | { type: 'afterBoss'; next: boolean }
  | { type: 'startDumpsterUpgrade' }
  | { type: 'speedupDumpsterGems' }
  | { type: 'speedupDumpsterAd' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'snapshot' }
  | { type: 'boot' }
  | { type: 'collectOffline'; doubled: boolean }
  | { type: 'setSetting'; key: SettingKey; value: boolean }
  | { type: 'setVolume'; key: VolumeKey; value: number }
  // ---- heists: start a run with a ticket, then Go stop by stop
  | { type: 'heistStart'; location: LocationId }
  /** Resolves the next stop (blocked while a decision is pending or a fight is on). */
  | { type: 'heistGo' }
  /** Answers the pending decision: a perk pick, a choice option, a shop item, the wheel spin, the shrine (0 accept, 1 decline). */
  | { type: 'heistChoose'; index: number }
  | { type: 'heistLeaveShop' }
  /** New perk options (the first reroll of a run is free, then balance.heist.rerolls.gems Gems). */
  | { type: 'heistReroll' }
  /** Second Chance after a knockout: back at 50% HP (the ad is free once per run). */
  | { type: 'heistRevive'; via: 'ad' | 'gems' }
  /** No Second Chance: the run is lost (keeps part of its rewards); heistClaim banks them. */
  | { type: 'heistDecline' }
  /** Banks the rewards of a won or lost run and ends it. */
  | { type: 'heistClaim' }
  /** Walks away now: a loss, banked at once. */
  | { type: 'heistAbandon' }
  /** +1 ticket from a rewarded ad (once a day). */
  | { type: 'heistAdTicket' }
  /** A Dodge tap: makes a boss's heavy hit that is winding up miss. */
  | { type: 'dodge' }
  /** Into the Endless Dump: its endless floors, or this week's Weekly Dive. */
  | { type: 'enterDump'; mode: 'endless' | 'weekly' }
  /** Stench 0 to max (in the Dump, the floor starts over under it). */
  | { type: 'setStench'; level: number }
  /** Become a Legend: Legend Stars, then everything starts over, rebirths included. */
  | { type: 'legend' }
  | { type: 'buyLegendPerk'; id: string }
  /** Switches the automation star upgrades on and off. */
  | { type: 'setLegendToggle'; key: 'autoEquip' | 'autoRebirth'; value: boolean }
  | { type: 'claimDaily'; id: string }
  | { type: 'openDailyChest' }
  | { type: 'cheat'; cheat: Cheat };

export type SettingKey = 'haptics' | 'sound' | 'music' | 'reduceFlashing' | 'reduceMotion';
/** Volume levels (0 to 1) under the Sound and Music switches. */
export type VolumeKey = 'soundVolume' | 'musicVolume';

export type Cheat =
  /** `bread`: Half-Eaten Bread Loaves (they only buy perks once perks are open). */
  | { kind: 'addCurrency'; coins?: number; gems?: number; bags?: number; bread?: number }
  | { kind: 'addXp'; amount: number }
  /** Jump to a world as if every world before it was beaten. */
  | { kind: 'setStage'; stage: number }
  | { kind: 'forceRarity'; rarity: Rarity | null }
  /**
   * The next spin's first reel lands these tokens before its item (`everyReel`: every reel does, a
   * combo each round); or `perReel`, each reel its own (a combo where two or more get one together).
   */
  | { kind: 'forceTokens'; mults: number[] | null; everyReel?: boolean; perReel?: number[][] }
  | { kind: 'luckBoost'; seconds: number }
  | { kind: 'setDumpsterLevel'; level: number }
  | { kind: 'skipToLastWave' }
  /** Set the heist ticket count. */
  | { kind: 'heistTickets'; tickets: number }
  /** The admin portal: `levels` more levels for the raccoon. */
  | { kind: 'addLevels'; levels: number }
  /** The admin portal: every feature open and introduced, the tutorial over. */
  | { kind: 'unlockAll' }
  /** The admin portal: `n` more rebirths counted (what they unlock follows), nothing wiped. */
  | { kind: 'addRebirths'; n: number }
  /** The admin portal: into the Endless Dump at `floor`, as if every floor before it was beaten (World 20 too). */
  | { kind: 'setFloor'; floor: number }
  /** The admin portal: Legend Stars. */
  | { kind: 'addStars'; n: number };

export interface StepResult<S> {
  state: S;
  events: CoreEvent[];
}

export type SlotItemMap = Record<Slot, Item | null>;
