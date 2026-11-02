import type { z } from 'zod';
import type { ItemSchema, SubstatSchema } from './state';
import type { Rarity, Slot, StatId } from '../data';

export type Item = z.infer<typeof ItemSchema>;
export type Substat = z.infer<typeof SubstatSchema>;

export type Stats = Record<StatId, number>;

/** Events emitted by core for rendering, UI juice, and analytics. Never saved. */
export type CoreEvent =
  | { type: 'waveStart'; stage: number; wave: number }
  | { type: 'playerHit'; enemyUid: number; amount: number; crit: boolean; targetUid: number; killed: boolean }
  | { type: 'enemyHit'; enemyUid: number; amount: number; heavy: boolean }
  | { type: 'playerDodge'; enemyUid: number }
  | { type: 'heal'; amount: number; source: 'lifesteal' | 'wave' }
  | { type: 'kill'; enemyUid: number; enemyId: string; coins: number; xp: number; kind: 'regular' | 'miniboss' | 'boss' }
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
  | { type: 'dive'; item: Item; auto: boolean; fullFlip: boolean; tease: boolean; outcome: DiveOutcome }
  | { type: 'equip'; item: Item; replaced: Item | null; auto: boolean }
  | { type: 'recycle'; item: Item; xp: number; coins: number; auto: boolean }
  | { type: 'codexEntry'; key: string; total: number }
  | { type: 'codexBonus'; index: number; gems: number }
  | { type: 'dumpsterUpgradeStarted'; level: number; endsAt: number }
  | { type: 'dumpsterUpgraded'; level: number }
  | { type: 'autoDiveUnlocked' }
  | { type: 'offlineReady'; awayMs: number }
  | { type: 'offlineCollected'; bags: number; coins: number; xp: number; doubled: boolean; minutes: number }
  | { type: 'clockWentBackward' }
  | { type: 'error'; message: string };

/** What happened to a dove item. 'pending' means it waits for the player on the compare card. */
export type DiveOutcome = 'pending' | 'autoEquipped' | 'autoRecycled';

export type GameAction =
  | { type: 'dive' }
  | { type: 'equipPending' }
  | { type: 'recyclePending' }
  | { type: 'fightBoss' }
  | { type: 'pushStage' }
  | { type: 'setAutoDive'; enabled: boolean }
  | { type: 'setAutoDiveFilters'; keepMinRarity: Rarity; keepSubstats: string[] }
  | { type: 'acknowledgeAutoDiveUnlock' }
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
  | { kind: 'unlockAll' }
  | { kind: 'setDumpsterLevel'; level: number }
  | { kind: 'skipToLastWave' };

export interface StepResult<S> {
  state: S;
  events: CoreEvent[];
}

export type SlotItemMap = Record<Slot, Item | null>;
