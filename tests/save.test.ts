import { describe, expect, it } from 'vitest';
import {
  applyAction, backupKey, deserialize, MemoryStorage, migrate, Rng, SAVE_KEY, SaveManager, serialize, tick,
  type GameState,
} from '../src/core';
import { freshState, T0 } from './helpers';

function played(): GameState {
  const rng = new Rng(1);
  let st = freshState();
  st = applyAction(st, { type: 'dive' }, rng, T0).state;
  st = applyAction(st, { type: 'equipPending' }, rng, T0).state;
  st = tick(st, { ticks: 300 }, rng, T0 + 30_000).state;
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
});
