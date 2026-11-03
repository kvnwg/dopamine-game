/**
 * The Heist tab: the roguelite runs (DUMPSTER_LEGEND_SPEC.md section 9). With no run going it shows the
 * tickets and the places to rob (heistLobby.tsx); during a run, where it is, the log, the Go button
 * and any decision it waits on (heistRun.tsx, heistPick.tsx; the battle above plays the fights); at
 * the end, the win or the bust (heistEnd.tsx).
 */
import { useGame } from '../../app/store';
import { HeistEnd } from './heistEnd';
import { HeistLobby } from './heistLobby';
import { HeistRunView } from './heistRun';
import { runOf } from './heistShared';

export function HeistPanel() {
  const status = useGame((g) => runOf(g)?.status ?? null);
  const run = useGame(runOf);
  if (!run || !status) return <HeistLobby />;
  if (status === 'won' || status === 'lost' || status === 'secondChance') return <HeistEnd run={run} />;
  return <HeistRunView />;
}
