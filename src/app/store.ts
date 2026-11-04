/**
 * Zustand store holding the one GameState. All changes go through core's pure
 * functions; the store only swaps in the new state and broadcasts events.
 */
import { useRef, useSyncExternalStore } from 'react';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import {
  applyAction, createInitialState, GameClock, Rng, tick, type CoreEvent, type GameAction, type GameState,
} from '../core';
import { analytics, haptics } from '../services';
import { bus } from './eventBus';

export const clock = new GameClock();

interface GameStoreState {
  game: GameState;
}

export const gameStore = createStore<GameStoreState>(() => ({
  game: createInitialState(clock.now(), 1),
}));

export function getGame(): GameState {
  return gameStore.getState().game;
}

export function useGame<T>(selector: (g: GameState) => T): T {
  return useStore(gameStore, (s) => selector(s.game));
}

/**
 * The whole game, for a screen that reads a lot of it but only needs to redraw when one of `deps(g)`
 * changes (compared one by one: unchanged parts of the state keep their identity). A screen that took
 * the whole game redrew ten times a second with every battle tick (the Bag, Worlds, an item's card).
 */
export function useGameWhen(deps: (g: GameState) => readonly unknown[]): GameState {
  const last = useRef<{ g: GameState; d: readonly unknown[] } | null>(null);
  const snapshot = () => {
    const g = gameStore.getState().game;
    const prev = last.current;
    if (prev && prev.g === g) return g;
    const d = deps(g);
    if (prev && d.length === prev.d.length && d.every((v, i) => Object.is(v, prev.d[i]))) return prev.g;
    last.current = { g, d };
    return g;
  };
  return useSyncExternalStore(gameStore.subscribe, snapshot, snapshot);
}

export function replaceGame(state: GameState): void {
  gameStore.setState({ game: state });
  haptics.setEnabled(state.settings.haptics);
}

function commit(state: GameState, events: CoreEvent[]): CoreEvent[] {
  gameStore.setState({ game: state });
  trackEvents(events, state);
  bus.emit(events);
  return events;
}

export function dispatch(action: GameAction, nowOverride?: number): CoreEvent[] {
  const game = getGame();
  const rng = new Rng(game.rngState);
  const r = applyAction(game, action, rng, nowOverride ?? clock.now());
  if (action.type === 'setSetting' && action.key === 'haptics') haptics.setEnabled(action.value);
  return commit(r.state, r.events);
}

export function runTicks(ticks: number): CoreEvent[] {
  const game = getGame();
  const rng = new Rng(game.rngState);
  const r = tick(game, { ticks }, rng, clock.now());
  return commit(r.state, r.events);
}

/** Maps core events to analytics events from spec section 19. */
function trackEvents(events: CoreEvent[], state: GameState) {
  for (const e of events) {
    switch (e.type) {
      case 'roll':
        analytics.track('roll', { rarity: e.item.rarity, dumpsterLevel: state.dumpster.level, source: e.source, lucky: e.lucky, luck: e.luck });
        break;
      case 'upgradeBought':
        analytics.track('upgrade_bought', { id: e.id, level: e.level });
        break;
      case 'rebirth':
        analytics.track('rebirth', { count: e.count });
        break;
      case 'stageClear':
        if (e.firstTime) analytics.track('stage_reached', { stage: e.stage + 1 });
        break;
      case 'bossAttempt':
        analytics.track('boss_attempt', { stage: e.stage });
        break;
      case 'bossWin':
        analytics.track('boss_win', { stage: e.stage });
        break;
      case 'dumpsterUpgraded':
        analytics.track('dumpster_upgrade', { level: e.level });
        break;
      case 'offlineCollected':
        analytics.track('offline_collect', { minutes: e.minutes, doubled: e.doubled });
        break;
    }
  }
}
