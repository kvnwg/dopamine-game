import { describe, expect, it } from 'vitest';
import { applyAction, backupKey, deserialize, MemoryStorage, migrate, Rng, SAVE_KEY, SaveManager, serialize, tick, type GameState, computeItemPower } from '../src/core';
import { SAVE_VERSION } from '../src/core/state';
import { freshState, T0 } from './helpers';

function played(): GameState {
  const rng = new Rng(1);
  let st = freshState();
  st = tick(st, { ticks: 300 }, rng, T0 + 30_000).state;
  // Drag the first find (the Legendary cone) onto the raccoon.
  const cone = st.inventory.find((x) => x.slot === 'hat');
  if (cone) st = applyAction(st, { type: 'equipItem', uid: cone.uid }, rng, T0 + 30_000).state;
  st = applyAction(st, { type: 'cheat', cheat: { kind: 'addCurrency', coins: 500 } }, rng, T0 + 30_000).state;
  st = applyAction(st, { type: 'buyUpgrade', id: 'luck' }, rng, T0 + 30_000).state;
  return st;
}

describe('save / load', () => {
  it('round-trips the full GameState', () => {
    const st = played();
    expect(deserialize(serialize(st))).toEqual(st);
  });

  it('keeps 2 backups and falls back to them when the main save is corrupt', async () => {
    const storage = new MemoryStorage();
    const mgr = new SaveManager(storage, 2);
    const a = freshState(1);
    const b = { ...freshState(2), playTimeMs: 1 };
    const c = { ...freshState(3), playTimeMs: 2 };
    await mgr.save(a);
    await mgr.save(b);
    await mgr.save(c);
    expect(deserialize(await storage.get(SAVE_KEY))?.playTimeMs).toBe(2);
    expect(deserialize(await storage.get(backupKey(0)))?.playTimeMs).toBe(1);
    expect(deserialize(await storage.get(backupKey(1)))?.rngState).toBe(a.rngState);
    await storage.set(SAVE_KEY, '{not json');
    const loaded = await mgr.load();
    expect(loaded?.source).toBe('backup');
    expect(loaded?.state.playTimeMs).toBe(1);
  });

  it('returns null for missing or invalid saves', async () => {
    expect(deserialize(null)).toBeNull();
    expect(deserialize('{"saveVersion":1}')).toBeNull();
    const mgr = new SaveManager(new MemoryStorage());
    expect(await mgr.load()).toBeNull();
  });

  it('runs migrations in order up to the current version', () => {
    const migrations = {
      0: (s: Record<string, unknown>) => ({ ...s, a: 1, saveVersion: 1 }),
      1: (s: Record<string, unknown>) => ({ ...s, b: (s.a as number) + 1, saveVersion: 2 }),
    };
    expect(migrate({ saveVersion: 0 }, migrations, 2)).toEqual({ saveVersion: 2, a: 1, b: 2 });
    expect(() => migrate({ saveVersion: 0 }, {}, 1)).toThrow(/No migration/);
    expect(() => migrate({ saveVersion: 5 }, {}, 1)).toThrow(/newer/);
  });

  it('is deterministic: same seed and inputs produce the same state', () => {
    expect(played()).toEqual(played());
  });

  it('migrates a version 1 save all the way to the current version', () => {
    const v1 = JSON.parse(serialize(played())) as Record<string, unknown>;
    // Turn it back into the old shape.
    v1.saveVersion = 1;
    v1.pendingItem = null;
    v1.autoDive = { unlocked: true, unlockSeen: true, enabled: true, keepMinRarity: 'legendary', keepSubstats: [], timer: 0 };
    for (const k of ['inventory', 'autoEquip', 'roll', 'upgrades', 'rebirths', 'luckBoostEndsAt', 'records']) delete v1[k];
    const eq = v1.equipped as Record<string, Record<string, unknown> | null>;
    for (const it of Object.values(eq)) if (it) { delete it.enchants; delete it.locked; }
    const battle = v1.battle as { enemies: Array<Record<string, unknown>> };
    for (const e of battle.enemies) { delete e.burnDps; delete e.burnTime; delete e.burnShown; }
    const loaded = deserialize(JSON.stringify(v1));
    expect(loaded).not.toBeNull();
    expect(loaded!.saveVersion).toBe(SAVE_VERSION);
    expect(loaded!.inventory).toEqual([]);
    expect(loaded!.rebirths).toBe(0);
    expect(loaded!.equipped.hat?.enchants).toEqual([]);
    expect(loaded!.equipped.hat?.tier).toBe(1);
  });

  it('migrates a version 2 save to worlds: 5 old stages per world, items become World 1 items', () => {
    const v2 = JSON.parse(serialize(played())) as Record<string, unknown>;
    v2.saveVersion = 2;
    v2.neighborhoodsCleared = ['suburbs'];
    v2.stage = { current: 13, highestCleared: 12, mode: 'push', powerAtDeath: null, showToughHint: false };
    const eq = v2.equipped as Record<string, Record<string, unknown> | null>;
    for (const it of Object.values(eq)) if (it) delete it.tier;
    for (const it of v2.inventory as Array<Record<string, unknown>>) delete it.tier;
    const loaded = deserialize(JSON.stringify(v2));
    expect(loaded).not.toBeNull();
    expect(loaded!.saveVersion).toBe(SAVE_VERSION);
    expect(loaded!.stage.highestCleared).toBe(2);
    expect(loaded!.battle.stage).toBe(2);
    expect(loaded!.stage.mode).toBe('farm');
    expect(loaded!.equipped.hat?.tier).toBe(1);
    expect('neighborhoodsCleared' in loaded!).toBe(false);
  });

  it('migrates a version 6 save to power-is-rarity: every item\'s power comes from its odds, the bag sorted by it', () => {
    const v6 = JSON.parse(serialize(played())) as Record<string, unknown>;
    v6.saveVersion = 6;
    const bag = v6.inventory as Array<Record<string, unknown>>;
    for (const it of bag) it.power = 1;
    const loaded = deserialize(JSON.stringify(v6));
    expect(loaded).not.toBeNull();
    expect(loaded!.saveVersion).toBe(SAVE_VERSION);
    for (const it of [...loaded!.inventory, ...Object.values(loaded!.equipped)]) {
      if (it) expect(it.power).toBe(computeItemPower(it));
    }
    const powers = loaded!.inventory.map((x) => x.power);
    expect(powers).toEqual([...powers].sort((a, b) => b - a));
  });

  it('migrates a version 4 save to the hex upgrade map, keeping about the same total effect per line', () => {
    const v4 = JSON.parse(serialize(played())) as Record<string, unknown>;
    v4.saveVersion = 4;
    // Old levels: Luck 6 x 0.05, Gold 5 x 10%, Golden Spin 5 x 1%, Spin Speed 30 (past the new max), Bag Space 3 x 2.
    v4.upgrades = { luck: 6, gold: 5, goldenSpin: 5, rollSpeed: 30, bagSpace: 3, retired: 2 };
    const loaded = deserialize(JSON.stringify(v4));
    expect(loaded).not.toBeNull();
    expect(loaded!.saveVersion).toBe(SAVE_VERSION);
    // 0.3 luck = 2 tiers of 0.15; 50% gold = 2 tiers of 25%; 3 x 2 slots = 6, rounds to 1 tier of 5;
    // Spin Speed is capped at its max. Golden Spin's 5% becomes the Golden Wheel and 2 tiers, but its
    // chain (Spin Speed III > Lucky Spins > Lucky Streak II) is not owned, so the cleanup drops it.
    expect(loaded!.upgrades).toEqual({ luck: 2, gold: 2, rollSpeed: 8, bagSpace: 1 });
  });
});
