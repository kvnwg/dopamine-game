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
  | { type: 'enemyHit'; enemyUid: number; amount: number; heavy: boolean }
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
       * Token steps at which every reel (two or more) landed the same token: those tokens count
       * squared on every reel (x5 on all three reels gives each x25).
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
  /** The next spin's first reel lands these tokens before its item (`everyReel`: every reel does, a match). */
  | { kind: 'forceTokens'; mults: number[] | null; everyReel?: boolean }
  | { kind: 'luckBoost'; seconds: number }
  | { kind: 'setDumpsterLevel'; level: number }
  | { kind: 'skipToLastWave' }
  /** Set the heist ticket count. */
  | { kind: 'heistTickets'; tickets: number };

export interface StepResult<S> {
  state: S;
  events: CoreEvent[];
}

export type SlotItemMap = Record<Slot, Item | null>;
