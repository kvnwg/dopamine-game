import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The recorded sounds (src/assets/sounds, tools/sounds.mjs) and their levels (levels.json). */
const DIR = join(__dirname, '../src/assets/sounds');
const files = readdirSync(DIR).filter((f) => f.endsWith('.mp3'));
const names = files.map((f) => f.slice(0, -4));
const levels = JSON.parse(readFileSync(join(DIR, 'levels.json'), 'utf8')) as Record<string, number>;
const engine = readFileSync(join(__dirname, '../src/services/audio.ts'), 'utf8');

describe('recorded sounds', () => {
  it('are each played by the sound engine under their own name (a misnamed file would never play)', () => {
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(engine, n).toContain(`'${n}'`);
  });

  it('each have a level, and every level a recording', () => {
    expect(Object.keys(levels).sort()).toEqual([...names].sort());
    for (const n of names) expect(levels[n], n).toBeGreaterThan(0);
    for (const n of names) expect(levels[n], n).toBeLessThanOrEqual(1);
  });

  it('stay small enough for the one-page artifact build', () => {
    const sizes = files.map((f) => statSync(join(DIR, f)).size);
    for (const [i, s] of sizes.entries()) expect(s, files[i]).toBeLessThan(400 * 1024);
    expect(sizes.reduce((a, b) => a + b, 0)).toBeLessThan(6 * 1024 * 1024);
  });
});
