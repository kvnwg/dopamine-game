/**
 * Heist balance CLI: sends raccoons from the main balance simulator on heists, played by a bot.
 *
 *   npx tsx tools/heistSim.ts --location pizza --first --minutes 10 --seeds 4 --runs 200
 *   npx tsx tools/heistSim.ts --location mall --minutes 30,60,120 --seeds 3 --runs 150 --revive
 *
 * Prints the win rate per raccoon (minute and seed of the main simulation) and overall. `--first`
 * plays the location's first run (the Pizza Place's gentle one); `--revive` takes the free Second Chance.
 */
import { computeStats, formatNumber } from '../src/core';
import type { LocationId } from '../src/data';
import { simulateHeists } from './heistSimCore';
import { simulate } from './simCore';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

const location = arg('location', 'pizza') as LocationId;
const minutes = arg('minutes', '10').split(',').map(Number);
const seeds = Number(arg('seeds', '3'));
const runs = Number(arg('runs', '200'));
const first = process.argv.includes('--first');
const revive = process.argv.includes('--revive');

let wins = 0;
let total = 0;
console.log(`${location}${first ? ' (first run)' : ''}${revive ? ', with the free Second Chance' : ''}: ${runs} runs per raccoon`);
console.log('min seed world lvl     HP    ATK  win%  lost at act1/2/3/boss  perks  lvl  secs  bags   gold');
for (const minute of minutes) {
  for (let seed = 1; seed <= seeds; seed++) {
    const state = simulate({ minutes: minute, seed }).final;
    const st = computeStats(state);
    const r = simulateHeists({ state, location, runs, seed: seed * 1000 + minute, revive, first });
    wins += r.wins;
    total += r.runs;
    console.log(
      `${String(minute).padStart(3)} ${String(seed).padStart(4)} ${String(Math.max(1, state.stage.highestCleared)).padStart(5)} ${String(state.player.level).padStart(3)} ${formatNumber(st.HP).padStart(6)} ${formatNumber(st.ATK).padStart(6)} ${(r.winRate * 100).toFixed(0).padStart(4)}%  ${r.lostAt.join('/').padStart(20)}  ${r.avgPerks.toFixed(1).padStart(5)} ${r.avgLevel.toFixed(1).padStart(4)} ${r.avgSeconds.toFixed(0).padStart(5)} ${formatNumber(r.bags / r.runs).padStart(5)} ${formatNumber(r.coins / r.runs).padStart(6)}`,
    );
  }
}
console.log(`overall win rate: ${((wins / total) * 100).toFixed(1)}% of ${total} runs`);
