/**
 * The Endless Dump's floors, as the rest of the core sees them. Past the last world the battle keeps
 * counting worlds: World 21 is Floor 1, World 22 Floor 2, and so on forever. So everything that
 * already goes by the world number (rebirth requirements, the best world beaten, gold, travel, the
 * offline rate) carries on into the Dump unchanged. Growth curves don't take a floor as a whole world:
 * a floor is `endless.floorStep` of one (effWorld), so a new floor falls every few minutes.
 * Pure helpers only (no state), so stages.ts can use them without a cycle.
 */
import { BAL, DATA } from '../../data';

const E = () => BAL.endless;

/** The last regular world (20). */
export function lastWorld(): number {
  return DATA.worlds.length;
}

/** A world number past the last world is a floor of the Endless Dump. */
export function isDump(world: number): boolean {
  return world > lastWorld();
}

/** The Dump floor a world number stands for (0 for a regular world). */
export function floorOf(world: number): number {
  return Math.max(0, Math.round(world) - lastWorld());
}

/** The world number of Dump floor `floor`. */
export function dumpWorld(floor: number): number {
  return lastWorld() + Math.max(1, Math.round(floor));
}

/**
 * The world growth curves use: a regular world as it is (fractions too: heists scale between worlds),
 * a Dump floor as the last world plus floorStep a floor.
 */
export function effWorld(world: number): number {
  const last = lastWorld();
  return world <= last ? world : last + (world - last) * E().floorStep;
}

/** Every gateEvery-th floor is a gate, with a gate boss. */
export function isGate(floor: number): boolean {
  return floor > 0 && floor % E().gateEvery === 0;
}

/** Which gate a gate floor is (Floor 10 is gate 1). */
export function gateNumber(floor: number): number {
  return Math.floor(floor / E().gateEvery);
}

/** The next gate floor at or after `floor`. */
export function nextGate(floor: number): number {
  const n = E().gateEvery;
  return Math.max(n, Math.ceil(Math.max(1, floor) / n) * n);
}

/** A floor's place in its set (1 right after a gate, gateEvery on the gate). */
export function floorPlace(floor: number): number {
  return ((Math.max(1, floor) - 1) % E().gateEvery) + 1;
}

/** Enemy HP and ATK multiplier by a floor's place in its set: easy after a gate, a squeeze before the next. */
export function sawtooth(floor: number): number {
  const saw = E().sawtooth;
  return saw[Math.min(saw.length - 1, floorPlace(floor) - 1)] ?? 1;
}

/** Waves in a world (a Dump floor has fewer, plus its boss on a gate). */
export function wavesIn(world: number): number {
  if (!isDump(world)) return BAL.stages.wavesPerStage;
  return E().wavesPerFloor + (isGate(floorOf(world)) ? 1 : 0);
}

/** The wave that ends a world or floor. */
export function isLastWave(wave: number, world: number): boolean {
  return wave >= wavesIn(world) - 1;
}

/** A small deterministic hash (the same floor always gets the same twist, name and boss). */
export function hash32(...parts: number[]): number {
  let h = 0x9e3779b9;
  for (const p of parts) {
    h ^= Math.imul((p | 0) ^ 0x85ebca6b, 0xc2b2ae35);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 16), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}

/** hash32 as a fraction in [0, 1). */
export function hashUnit(...parts: number[]): number {
  return hash32(...parts) / 4294967296;
}
