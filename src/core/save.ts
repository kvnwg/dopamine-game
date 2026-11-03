/**
 * Save/load with versioned migrations and rotating backups.
 * Storage is injected (localStorage on web, @capacitor/preferences on native, memory in tests).
 */
import { GameStateSchema, SAVE_VERSION, type GameState } from './state';
import { sanitizeUpgrades } from './systems/upgrades';

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
  /** v3 -> v4: the wheel. Rolls become spins; nothing is mid-spin after loading. Equipping is manual now. */
  3: (s) => {
    const roll = (s.roll ?? {}) as Record<string, unknown>;
    const rest = { ...s };
    delete rest.autoEquip;
    return {
      ...rest,
      saveVersion: 4,
      roll: { timer: 0, current: null, count: Number(roll.count ?? 0), sinceLucky: Number(roll.sinceLucky ?? 0) },
    };
  },
  /**
   * v4 -> v5: the hex upgrade map. Lines now have a few big tiers instead of many small levels, so
   * each line keeps (rounded) the same total effect. Tiers whose parent is no longer owned are
   * dropped when the save loads (sanitizeUpgrades).
   */
  4: (s) => {
    // [old per-level effect, then (new line, per-tier effect, tiers) to fill in order]
    const table: Record<string, [number, ...[string, number, number][]]> = {
      luck: [0.05, ['luck', 0.15, 8]],
      rollSpeed: [1, ['rollSpeed', 2.5, 8]],
      bagFind: [5, ['bagFind', 15, 6]],
      turboPower: [0.25, ['turboPower', 0.5, 4]],
      luckyRoll: [1, ['luckyRoll', 1, 5]],
      luckyMult: [0.25, ['luckyMult', 0.5, 4]],
      goldenSpin: [0.01, ['goldenWheel', 0.02, 1], ['goldenSpin', 0.02, 4]],
      enchant: [0.015, ['enchant', 0.03, 8]],
      enchantTier: [1, ['enchantTier', 1, 5]],
      pity: [4, ['pity', 4, 5]],
      gold: [10, ['gold', 25, 8]],
      bagSpace: [2, ['bagSpace', 5, 8]],
      scrapPct: [15, ['scrapPct', 50, 6]],
      xpPct: [10, ['xpPct', 30, 6]],
      potionTime: [10, ['potionTime', 20, 6]],
      offlinePct: [10, ['offlinePct', 40, 5]],
      strength: [5, ['strength', 15, 8]],
      toughness: [5, ['toughness', 15, 8]],
      lifesteal: [0.5, ['lifesteal', 2, 5]],
      critChance: [1, ['critChance', 3, 8]],
      critDmg: [10, ['critDmg', 30, 8]],
      bossDmg: [5, ['bossDmg', 15, 6]],
    };
    const old = (s.upgrades ?? {}) as Record<string, number>;
    const upgrades: Record<string, number> = {};
    for (const [id, level] of Object.entries(old)) {
      const row = table[id];
      if (!row || !(level > 0)) continue;
      const [per, ...targets] = row;
      let total = level * per;
      for (const [line, tierFx, max] of targets) {
        const tiers = Math.min(max, Math.round(total / tierFx));
        if (tiers > 0) upgrades[line] = tiers;
        total = Math.max(0, total - tiers * tierFx);
      }
    }
    return { ...s, saveVersion: 5, upgrades };
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
    if (!parsed.success) return null;
    sanitizeUpgrades(parsed.data);
    return parsed.data;
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
