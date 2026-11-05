/**
 * Balance simulator CLI. Usage:
 *   npm run sim -- --minutes 60 --seeds 5
 *   npm run sim -- --minutes 240 --seeds 3 --perks focus    (or none; default: cheapest)
 * Prints a timeline, the minute each stage was first cleared, rebirths, and the perks bought each run.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { deserialize, formatNumber, serialize } from '../src/core';
import { simulate, type PerkStrategy } from './simCore';

function sarg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
}
/** --from game.json: start there; --save-w20 game.json: save the game as World 20 first falls. */
const fromPath = sarg('from');
const savePath = sarg('save-w20');
const from = fromPath ? deserialize(readFileSync(fromPath, 'utf8')) ?? undefined : undefined;

const fmt = (n: number) => formatNumber(n);

function arg(name: string, def: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
}

const minutes = arg('minutes', 60);
const seeds = arg('seeds', 3);
const legendAfterMinutes = arg('legend', 45);
const stench = arg('stench', 0);
const dodge = process.argv.includes('--dodge');
const noRebirth = process.argv.includes('--no-rebirth');
const every = arg('every', 5);
const verbose = process.argv.includes('--verbose');
const perksAt = process.argv.indexOf('--perks');
const perks = (perksAt >= 0 ? process.argv[perksAt + 1] : 'cheapest') as PerkStrategy;
if (!['cheapest', 'focus', 'none'].includes(perks)) throw new Error(`--perks must be cheapest, focus or none (got ${perks})`);

const reach20: number[] = [];
for (let seed = 1; seed <= seeds; seed++) {
  const t0 = Date.now();
  let saved = false;
  const r = simulate({
    minutes, seed, perks, legendAfterMinutes, stench, dodge, from, rebirth: !noRebirth,
    onWorld20: (st) => {
      if (!savePath || saved) return;
      saved = true;
      writeFileSync(savePath.replace('{seed}', String(seed)), serialize(st));
    },
  });
  const ms = Date.now() - t0;
  console.log(`\n=== seed ${seed} (${minutes} min simulated in ${ms} ms) ===`);
  if (verbose || seed === 1) {
    console.log(' min  world floor best ever leg reb  lvl  DL  luck  gearPow      HP     ATK     gold  rolls');
    for (const s of r.samples) {
      if (s.minute % every !== 0) continue;
      console.log(
        `${String(s.minute).padStart(4)}  ${String(s.stage).padStart(5)} ${String(s.floor).padStart(5)} ${String(s.highestCleared).padStart(4)} ${String(s.bestEver).padStart(4)} ${String(s.legends).padStart(3)} ${String(s.rebirths).padStart(3)}  ${String(s.level).padStart(3)}  ${String(s.dumpsterLevel).padStart(2)} ${s.luck.toFixed(2).padStart(5)} ${fmt(s.gearPower).padStart(8)} ${fmt(s.hp).padStart(7)} ${fmt(s.atk).padStart(7)} ${fmt(s.coins).padStart(8)} ${String(s.rolls).padStart(6)}`,
      );
    }
  }
  const cleared = Object.entries(r.clearedAt).map(([st, m]) => `${st}@${m.toFixed(1)}`).join(' ');
  console.log(`first clears: ${cleared}`);
  console.log(`rebirths at: ${r.rebirthAt.map((m) => m.toFixed(1)).join(', ') || 'none'}`);
  const floors = Object.entries(r.floorAt).map(([f, m]) => [Number(f), m] as const).filter(([f]) => f % 5 === 0);
  if (floors.length) console.log(`dump floors first cleared: ${floors.map(([f, m]) => `${f}@${m.toFixed(0)}`).join(' ')}`);
  for (const l of r.legendAt) console.log(`legend at ${l.minute.toFixed(1)} min: rebirths ${l.rebirths}, floor ${l.floor}, +${l.stars} stars`);
  if (r.starsBought.length) console.log(`star upgrades: ${r.starsBought.map((b) => `${b.id}@${b.minute.toFixed(0)}`).join(' ')}`);
  if (dodge) console.log(`perfect dodges: ${r.dodges}`);
  const runs = [...new Set([...Object.keys(r.breadByRun).map(Number), ...r.perksBought.map((p) => p.run)])].sort((a, b) => a - b);
  for (const run of runs) {
    const bought = r.perksBought.filter((p) => p.run === run).map((p) => `${p.id}@${p.minute.toFixed(0)}`);
    console.log(`run ${run + 1} (rebirths ${run}): ${r.breadByRun[run] ?? 0} loaves; perks: ${bought.join(' ') || 'none'}`);
  }
  console.log(`deaths ${r.deaths}, jumps ahead ${r.jumps}, boss wins ${r.bossWins}`);
  console.log('rarities:', JSON.stringify(r.rarityCounts));
  reach20.push(Math.max(0, ...Object.keys(r.clearedAt).map(Number)));
}
console.log(`\nBest world beaten per seed: ${reach20.join(', ')}`);
