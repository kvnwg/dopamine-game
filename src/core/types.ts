import type { z } from 'zod';
import type { ItemSchema, SubstatSchema, ItemEnchantSchema } from './state';
import type { Rarity, Slot, StatId } from '../data';

export type Item = z.infer<typeof ItemSchema>;
export type Substat = z.infer<typeof SubstatSchema>;
export type ItemEnchant = z.infer<typeof ItemEnchantSchema>;

export type Stats = Record<StatId, number>;

/** Where a rolled item ended up. */
export type RollPlacement = 'equipped' | 'bag' | 'scrapped';

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
  | { type: 'neighborhoodCleared'; neighborhoodId: string }
  | { type: 'playerDeath'; stage: number }
  | { type: 'stageStart'; stage: number; push: boolean }
  | { type: 'bossAttempt'; stage: number }
  | { type: 'levelUp'; level: number }
  | {
      type: 'roll';
      item: Item;
      lucky: boolean;
      source: 'timer' | 'bag';
      /** Base odds of the item's rarity, "1 in X" (1 for Junk). */
      odds: number;
      luck: number;
      placed: RollPlacement;
      newRecord: boolean;
    }
  | { type: 'equip'; item: Item; replaced: Item | null; auto: boolean }
  | { type: 'scrap'; item: Item; xp: number; coins: number; auto: boolean }
  | { type: 'luckBoost'; endsAt: number; seconds: number }
  | { type: 'upgradeBought'; id: string; level: number }
  | { type: 'rebirth'; count: number }
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
  | { type: 'scrapItem'; uid: number }
  | { type: 'toggleLock'; uid: number }
  | { type: 'setAutoEquip'; enabled: boolean }
  | { type: 'buyUpgrade'; id: string }
  | { type: 'rebirth' }
  | { type: 'fightBoss' }
  | { type: 'pushStage' }
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
