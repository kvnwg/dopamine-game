/**
 * Balance simulator CLI. Usage:
 *   npm run sim -- --minutes 60 --seeds 5
 * Prints a timeline and the minute each stage was first cleared.
 */
import { formatNumber } from '../src/core';
import { simulate } from './simCore';

const fmt = (n: number) => formatNumber(n);

function arg(name: string, def: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
}

const minutes = arg('minutes', 60);
const seeds = arg('seeds', 3);
const verbose = process.argv.includes('--verbose');

const reach20: number[] = [];
for (let seed = 1; seed <= seeds; seed++) {
  const t0 = Date.now();
  const r = simulate({ minutes, seed });
  const ms = Date.now() - t0;
  console.log(`\n=== seed ${seed} (${minutes} min simulated in ${ms} ms) ===`);
  if (verbose || seed === 1) {
    console.log('min  world best ever reb  lvl  DL  luck  gearPow   HP   ATK    gold  rolls');
    for (const s of r.samples) {
      if (s.minute % 5 !== 0) continue;
      console.log(
        `${String(s.minute).padStart(3)}  ${String(s.stage).padStart(5)} ${String(s.highestCleared).padStart(4)} ${String(s.bestEver).padStart(4)} ${String(s.rebirths).padStart(3)}  ${String(s.level).padStart(3)}  ${String(s.dumpsterLevel).padStart(2)} ${s.luck.toFixed(2).padStart(5)} ${fmt(s.gearPower).padStart(8)} ${fmt(s.hp).padStart(7)} ${fmt(s.atk).padStart(7)} ${fmt(s.coins).padStart(8)} ${String(s.rolls).padStart(6)}`,
      );
    }
  }
  const cleared = Object.entries(r.clearedAt).map(([st, m]) => `${st}@${m.toFixed(1)}`).join(' ');
  console.log(`first clears: ${cleared}`);
  console.log(`rebirths at: ${r.rebirthAt.map((m) => m.toFixed(1)).join(', ') || 'none'}`);
  console.log(`deaths ${r.deaths}, jumps ahead ${r.jumps}, boss wins ${r.bossWins}`);
  console.log('rarities:', JSON.stringify(r.rarityCounts));
  reach20.push(Math.max(0, ...Object.keys(r.clearedAt).map(Number)));
}
console.log(`\nBest world beaten per seed: ${reach20.join(', ')}`);
