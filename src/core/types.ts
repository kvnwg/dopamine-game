import type { z } from 'zod';
import type { ItemSchema, SubstatSchema, ItemEnchantSchema } from './state';
import type { Rarity, Slot, StatId } from '../data';

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
  | { type: 'heal'; amount: number; source: 'lifesteal' | 'wave' }
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
      reels: { item: Item; odds: number; mults: number[]; landAt: number }[];
      lucky: boolean;
      golden: boolean;
      luck: number;
      turbo: boolean;
      spinSeconds: number;
      baseSpinSeconds: number;
      stepSeconds: number;
      restSeconds: number;
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
      /** Product of the luck tokens this reel landed on first (1 without any). */
      mult: number;
      placed: RollPlacement;
      newRecord: boolean;
    }
  | { type: 'equip'; item: Item; replaced: Item | null; auto: boolean }
  | { type: 'scrap'; item: Item; xp: number; coins: number; auto: boolean }
  | { type: 'scrapAll'; count: number; xp: number; coins: number }
  | { type: 'luckBoost'; endsAt: number; seconds: number }
  | { type: 'upgradeBought'; id: string; level: number }
  /** `unlocked`: base items the dumpster can roll from now on. */
  | { type: 'rebirth'; count: number; unlocked: string[] }
  | { type: 'codexEntry'; key: string; total: number }
  | { type: 'codexBonus'; index: number; gems: number }
  | { type: 'dumpsterUpgradeStarted'; level: number; endsAt: number }
  | { type: 'dumpsterUpgraded'; level: number }
  | { type: 'offlineReady'; awayMs: number }
  | { type: 'offlineCollected'; bags: number; coins: number; xp: number; doubled: boolean; minutes: number }
  | { type: 'clockWentBackward' }
  | { type: 'error'; message: string };

export type GameAction =
  | { type: 'equipItem'; uid: number }
  /** Equips the biggest upgrade in every slot from the bag. */
  | { type: 'equipBest' }
  | { type: 'scrapItem'; uid: number }
  /** Scraps every unlocked item in the bag. */
  | { type: 'scrapAll' }
  | { type: 'toggleLock'; uid: number }
  | { type: 'buyUpgrade'; id: string }
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
  | { type: 'cheat'; cheat: Cheat };

export type SettingKey = 'haptics' | 'sound' | 'music' | 'reduceFlashing' | 'reduceMotion';

export type Cheat =
  | { kind: 'addCurrency'; coins?: number; gems?: number; bags?: number }
  | { kind: 'addXp'; amount: number }
  /** Jump to a world as if every world before it was beaten. */
  | { kind: 'setStage'; stage: number }
  | { kind: 'forceRarity'; rarity: Rarity | null }
  | { kind: 'luckBoost'; seconds: number }
  | { kind: 'setDumpsterLevel'; level: number }
  | { kind: 'skipToLastWave' };

export interface StepResult<S> {
  state: S;
  events: CoreEvent[];
}

export type SlotItemMap = Record<Slot, Item | null>;
