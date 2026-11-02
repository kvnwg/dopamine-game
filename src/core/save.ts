/**
 * Save/load with versioned migrations and rotating backups.
 * Storage is injected (localStorage on web, @capacitor/preferences on native, memory in tests).
 */
import { GameStateSchema, SAVE_VERSION, type GameState } from './state';

export interface KeyValueStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const SAVE_KEY = 'dumpster_legend_save';
export const backupKey = (i: number) => `${SAVE_KEY}_backup_${i}`;

/** Migration from version N to N+1, keyed by N. Add one for every saveVersion bump. */
export type Migration = (save: Record<string, unknown>) => Record<string, unknown>;
export const MIGRATIONS: Record<number, Migration> = {
  /** v1 -> v2: the RNG-roller redesign (inventory, luck, upgrades, rebirth, enchantments). */
  1: (s) => {
    type AnyItem = Record<string, unknown>;
    const fixItem = (it: AnyItem | null) => (it ? { enchants: [], locked: false, ...it } : null);
    const equipped = Object.fromEntries(
      Object.entries((s.equipped ?? {}) as Record<string, AnyItem | null>).map(([k, v]) => [k, fixItem(v)]),
    );
    const pending = s.pendingItem as AnyItem | null | undefined;
    const battle = { ...(s.battle as Record<string, unknown>) };
    battle.enemies = ((battle.enemies ?? []) as AnyItem[]).map((e) => ({ burnDps: 0, burnTime: 0, burnShown: 0, ...e }));
    const rest = { ...s };
    delete rest.pendingItem;
    delete rest.autoDive;
    return {
      ...rest,
      saveVersion: 2,
      equipped,
      battle,
      inventory: pending ? [fixItem(pending)] : [],
      autoEquip: true,
      roll: { timer: 0, bagTimer: 0, count: 0, sinceLucky: 0 },
      upgrades: {},
      rebirths: 0,
      luckBoostEndsAt: null,
      records: { bestOdds: 0, bestItemName: '', bestRarity: null },
    };
  },
  /**
   * v2 -> v3: the 20 worlds. The old 20 Suburbs stages map to the first worlds (5 stages per world),
   * every existing item becomes a World 1 item, and the neighborhood bonuses are gone.
   */
  2: (s) => {
    type AnyItem = Record<string, unknown>;
    const fixItem = (it: AnyItem | null) => (it ? { ...it, tier: 1 } : null);
    const equipped = Object.fromEntries(
      Object.entries((s.equipped ?? {}) as Record<string, AnyItem | null>).map(([k, v]) => [k, fixItem(v)]),
    );
    const inventory = ((s.inventory ?? []) as AnyItem[]).map((it) => fixItem(it));
    const oldStage = (s.stage ?? {}) as Record<string, unknown>;
    const highest = Math.floor(Number(oldStage.highestCleared ?? 0) / 5);
    const world = Math.max(1, highest);
    const battle = { ...(s.battle as Record<string, unknown>), stage: world, wave: 0, phase: 'walking', phaseTime: 1, enemies: [] };
    const rest = { ...s };
    delete rest.neighborhoodsCleared;
    return {
      ...rest,
      saveVersion: 3,
      equipped,
      inventory,
      stage: {
        current: world, highestCleared: highest, mode: highest > 0 ? 'farm' : 'push', returnTo: world, powerAtDeath: null, showToughHint: false,
      },
      battle,
    };
  },
};

export function migrate(
  raw: Record<string, unknown>,
  migrations: Record<number, Migration> = MIGRATIONS,
  targetVersion: number = SAVE_VERSION,
): Record<string, unknown> {
  let save = raw;
  let v = typeof save.saveVersion === 'number' ? save.saveVersion : 0;
  if (v > targetVersion) throw new Error(`Save version ${v} is newer than this build (${targetVersion})`);
  while (v < targetVersion) {
    const m = migrations[v];
    if (!m) throw new Error(`No migration from save version ${v}`);
    save = m(save);
    const nv = typeof save.saveVersion === 'number' ? save.saveVersion : v;
    if (nv !== v + 1) throw new Error(`Migration ${v} must set saveVersion to ${v + 1}`);
    v = nv;
  }
  return save;
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/** Parses, migrates, and validates a save. Returns null if it is unusable. */
export function deserialize(text: string | null, migrations: Record<number, Migration> = MIGRATIONS): GameState | null {
  if (!text) return null;
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    const migrated = migrate(raw, migrations);
    const parsed = GameStateSchema.safeParse(migrated);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export class SaveManager {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly backups = 2,
  ) {}

  /** Writes the save, shifting the previous saves into the backup slots. */
  async save(state: GameState): Promise<void> {
    const text = serialize(state);
    for (let i = this.backups - 1; i >= 1; i--) {
      const prev = await this.storage.get(backupKey(i - 1));
      if (prev !== null) await this.storage.set(backupKey(i), prev);
    }
    if (this.backups > 0) {
      const cur = await this.storage.get(SAVE_KEY);
      if (cur !== null) await this.storage.set(backupKey(0), cur);
    }
    await this.storage.set(SAVE_KEY, text);
  }

  /** Loads the newest valid save, falling back to backups if the main save is corrupt. */
  async load(): Promise<{ state: GameState; source: 'main' | 'backup' } | null> {
    const main = deserialize(await this.storage.get(SAVE_KEY));
    if (main) return { state: main, source: 'main' };
    for (let i = 0; i < this.backups; i++) {
      const b = deserialize(await this.storage.get(backupKey(i)));
      if (b) return { state: b, source: 'backup' };
    }
    return null;
  }

  async reset(): Promise<void> {
    await this.storage.remove(SAVE_KEY);
    for (let i = 0; i < this.backups; i++) await this.storage.remove(backupKey(i));
  }
}

export class MemoryStorage implements KeyValueStorage {
  readonly map = new Map<string, string>();
  async get(key: string) {
    return this.map.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.map.set(key, value);
  }
  async remove(key: string) {
    this.map.delete(key);
  }
}
