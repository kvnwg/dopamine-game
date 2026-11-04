/**
 * Save/load with versioned migrations and rotating backups.
 * Storage is injected (localStorage on web, @capacitor/preferences on native, memory in tests).
 */
import { BAL, DATA } from '../data';
import { createInitialState, GameStateSchema, initialHeist, SAVE_VERSION, type GameState } from './state';
import { sanitizeUpgrades } from './systems/upgrades';
import { fitToPower } from './systems/loot';
import { backfillBread } from './systems/perks';
import type { Item } from './types';

export interface KeyValueStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const SAVE_KEY = 'dumpster_legend_save';
export const backupKey = (i: number) => `${SAVE_KEY}_backup_${i}`;
/** Where a save that couldn't be loaded is kept, untouched, before anything can overwrite it. */
export const RESCUE_KEY = `${SAVE_KEY}_rescue`;
/** When the player last started over (ms): a copy of an older game found elsewhere isn't brought back. */
export const RESET_KEY = `${SAVE_KEY}_reset_at`;

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
  /** v5 -> v6: several reels per spin. The spin state now holds one result per reel; none is in flight after loading. */
  5: (s) => {
    const roll = (s.roll ?? {}) as Record<string, unknown>;
    return { ...s, saveVersion: 6, roll: { ...roll, timer: 0, current: null } };
  },
  /**
   * v6 -> v7: power is rarity. Every item's power is set from its odds (enchantments included) and its
   * stats are scaled to match; the raccoon's level and best world now grow worn gear instead.
   */
  6: (s) => {
    const fix = (it: Item | null) => (it ? fitToPower(it) : null);
    const equipped = Object.fromEntries(Object.entries((s.equipped ?? {}) as Record<string, Item | null>).map(([k, v]) => [k, fix(v)]));
    const inventory = ((s.inventory ?? []) as Item[]).map((it) => fitToPower(it)).sort((a, b) => b.power - a.power);
    // A spin in flight would land an item made the old way: start the next spin fresh.
    const roll = (s.roll ?? {}) as Record<string, unknown>;
    return { ...s, saveVersion: 7, equipped, inventory, roll: { ...roll, timer: 0, current: null } };
  },
  /**
   * v7 -> v8: Heists. A fresh heist state with the starting tickets, counted as today's grant (the next
   * tickets come at the next local midnight); the best world beaten so far opens the locations.
   */
  7: (s) => {
    const stage = (s.stage ?? {}) as Record<string, unknown>;
    const roll = (s.roll ?? {}) as Record<string, unknown>;
    const best = Math.max(0, Math.floor(Number(stage.highestCleared ?? 0)) || 0);
    return { ...s, saveVersion: 8, heist: initialHeist(BAL.heist.tickets.start, '', best), roll: { ...roll, goldenLeft: 0 } };
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

/**
 * The save as JSON. A number gone wrong (NaN, or past the largest a number can be) would come out as
 * null, which the next load rejects; it is written as the nearest real number instead (0 for NaN).
 */
export function serialize(state: GameState): string {
  return JSON.stringify(state, (_key, v: unknown) => (typeof v === 'number' && !Number.isFinite(v) ? (Number.isNaN(v) ? 0 : v > 0 ? Number.MAX_VALUE : -Number.MAX_VALUE) : v));
}

type Path = PropertyKey[];
const isObj = (v: unknown): v is Record<PropertyKey, unknown> => typeof v === 'object' && v !== null;
function getAt(root: unknown, path: Path): unknown {
  let cur = root;
  for (const k of path) {
    if (!isObj(cur)) return undefined;
    cur = (cur as Record<PropertyKey, unknown>)[k];
  }
  return cur;
}
function setAt(root: unknown, path: Path, value: unknown): void {
  const parent = getAt(root, path.slice(0, -1));
  if (!isObj(parent)) return;
  const k = path[path.length - 1];
  if (value === undefined) delete (parent as Record<PropertyKey, unknown>)[k];
  else (parent as Record<PropertyKey, unknown>)[k] = value;
}
const copy = <T,>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

/**
 * A save the schema rejects is mended rather than thrown away (players lost whole games to one bad
 * value): each bad value is set back to a new game's, a bad entry in a list (the bag, the history)
 * is dropped, and after a few rounds a section still failing is reset whole. Everything else is
 * kept. `fixed` lists what was changed. Null only if even that fails.
 */
export function repairSave(migrated: Record<string, unknown>, now = Date.now()): { state: GameState; fixed: string[] } | null {
  // Nothing worth keeping without its currencies and its worlds: not a game, just a broken file.
  if (!isObj(migrated.currencies) || !isObj(migrated.stage)) return null;
  const fresh = createInitialState(now, 1) as unknown as Record<string, unknown>;
  const cur = copy(migrated);
  const fixed: string[] = [];
  for (let round = 0; round < 8; round++) {
    const r = GameStateSchema.safeParse(cur);
    if (r.success) return { state: r.data, fixed };
    const drops = new Map<unknown[], Set<number>>();
    for (const iss of r.error.issues) {
      const path = iss.path as Path;
      if (path.length === 0) return null;
      // Last rounds: the whole section goes back to a new game's.
      if (round >= 4) {
        setAt(cur, [path[0]], copy(fresh[path[0] as string]));
        fixed.push(String(path[0]));
        continue;
      }
      // An entry of a list a new game doesn't have: drop the entry.
      let dropped = false;
      for (let j = 0; j < path.length; j++) {
        const list = getAt(cur, path.slice(0, j));
        if (!Array.isArray(list) || typeof path[j] !== 'number') continue;
        const freshList = getAt(fresh, path.slice(0, j));
        if (!Array.isArray(freshList) || freshList.length <= (path[j] as number)) {
          if (!drops.has(list)) drops.set(list, new Set());
          drops.get(list)!.add(path[j] as number);
          fixed.push(path.slice(0, j + 1).join('.'));
          dropped = true;
        }
        break;
      }
      if (dropped) continue;
      if (iss.code === 'unrecognized_keys') {
        for (const k of (iss as { keys?: string[] }).keys ?? []) setAt(cur, [...path, k], undefined);
      } else {
        setAt(cur, path, copy(getAt(fresh, path)));
      }
      fixed.push(path.join('.'));
    }
    for (const [list, idx] of drops) {
      for (const i of [...idx].sort((a, b) => b - a)) list.splice(i, 1);
    }
  }
  return null;
}

/** Parses, migrates, validates and (if need be) mends a save. Null if it is unusable. */
export function readSave(text: string | null, migrations: Record<number, Migration> = MIGRATIONS): { state: GameState; fixed: string[] } | null {
  if (!text) return null;
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    if (!isObj(raw)) return null;
    const migrated = migrate(raw, migrations);
    const hadPerks = migrated.perks !== undefined;
    const parsed = GameStateSchema.safeParse(migrated);
    const out = parsed.success ? { state: parsed.data, fixed: [] as string[] } : repairSave(migrated);
    if (!out) return null;
    // A dumpster theme the data doesn't know (renamed, removed) would make every roll throw.
    if (!DATA.themes.some((th) => th.id === out.state.dumpster.theme)) {
      out.state.dumpster.theme = BAL.dumpster.defaultTheme;
      out.fixed.push('dumpster.theme');
    }
    sanitizeUpgrades(out.state);
    // A save from before Alley perks: the worlds already beaten this run pay their loaves.
    if (!hadPerks) backfillBread(out.state);
    return out;
  } catch {
    return null;
  }
}

/** Parses, migrates, validates and mends a save. Returns null if it is unusable. */
export function deserialize(text: string | null, migrations: Record<number, Migration> = MIGRATIONS): GameState | null {
  return readSave(text, migrations)?.state ?? null;
}

export class SaveManager {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly backups = 2,
  ) {}

  /**
   * Writes the save, shifting the previous saves into the backup slots. A save that wouldn't load
   * cleanly is still written (the load mends it) but doesn't push the good ones out of the backups.
   */
  async save(state: GameState): Promise<void> {
    const text = serialize(state);
    if (!GameStateSchema.safeParse(JSON.parse(text)).success) {
      console.warn('Saving a game that needs mending: the backups are kept as they are.');
      await this.storage.set(SAVE_KEY, text);
      return;
    }
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

  /**
   * Loads the newest valid save (mended if need be), falling back to backups if the main save is
   * unusable. A main save that can't be loaded is first copied to the rescue slot, which nothing
   * overwrites but the next such failure: the saves that follow would push it out of the backups.
   */
  async load(): Promise<{ state: GameState; source: 'main' | 'backup'; fixed: string[] } | null> {
    const text = await this.storage.get(SAVE_KEY);
    const main = readSave(text);
    if (main) return { state: main.state, source: 'main', fixed: main.fixed };
    if (text) await this.storage.set(RESCUE_KEY, text);
    for (let i = 0; i < this.backups; i++) {
      const b = readSave(await this.storage.get(backupKey(i)));
      if (b) return { state: b.state, source: 'backup', fixed: b.fixed };
    }
    return null;
  }

  /** The save kept in the rescue slot, if any (raw text). */
  async rescued(): Promise<string | null> {
    return this.storage.get(RESCUE_KEY);
  }

  /** Erases the save and its backups, and notes when (resetAt). */
  async reset(now = Date.now()): Promise<void> {
    await this.storage.remove(SAVE_KEY);
    for (let i = 0; i < this.backups; i++) await this.storage.remove(backupKey(i));
    await this.storage.set(RESET_KEY, String(now));
  }

  /** When the player last started over (0: never, as far as this storage knows). */
  async resetAt(): Promise<number> {
    const v = Number(await this.storage.get(RESET_KEY));
    return Number.isFinite(v) ? v : 0;
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
