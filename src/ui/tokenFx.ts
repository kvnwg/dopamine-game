/**
 * Luck tokens wherever you are. When a reel lands on a luck token, its chime plays and the token
 * flies out of the reel into its place in the battle's luck row at the top (TokenFlight), on every
 * tab, not only the Roll tab's reels. The reels call tokenLanded as they show a token; a timer from
 * the spin's start calls it too, for when the reels aren't on screen. Each token plays once,
 * whichever comes first (they agree to a frame: both run on core's roll timer).
 */
import { gameStore } from '../app/store';
import { luckBridge, luckRowsOf, TOKEN_FLIGHT_MS } from '../render/luckRows';
import { haptics } from '../services';
import { audio } from '../services/audio';
import { tokenStops } from './reelTiming';
import { useUi } from './uiStore';

const fired = new Set<string>();
let flightId = 1;

/** A token's key: the result item of its reel, and its place among that reel's stops. */
export const tokenKey = (itemUid: number | string, step: number) => `${itemUid}:${step}`;

/**
 * A luck token lands on reel `reel`: its chime (a step higher for each in a chain), a buzz, and its
 * flight into its place in the battle's luck row (`row`, the `step`-th token there). `match`: the
 * last of a step's tokens to land when every reel landed the same one; they all count squared, and
 * a jingle plays as it slams in. Once per token.
 */
export function tokenLanded(key: string, step: number, x: number, reel: number, row: number, match = false): void {
  if (fired.has(key)) return;
  fired.add(key);
  if (fired.size > 64) fired.delete(fired.values().next().value as string);
  audio.token(step, x);
  haptics.impact('medium');
  const calm = gameStore.getState().game.settings.reduceMotion;
  // (Nothing flies under a full-screen moment: nobody would see it.)
  if (!calm && row >= 0 && !useUi.getState().blackout) {
    const id = flightId++;
    useUi.setState((u) => ({ tokenFlights: [...u.tokenFlights.slice(-5), { id, key, x, reel, row, step }] }));
  } else {
    // Nothing flies: it shows in its row right away.
    luckBridge.land?.(key);
  }
  if (match) {
    setTimeout(() => {
      audio.jingle(5);
      haptics.impact('heavy');
    }, calm ? 0 : TOKEN_FLIGHT_MS);
  }
}

/** Times each spin's tokens from its start, so they land on any tab. */
export function installTokenFx(): () => void {
  let spinKey = '';
  let timers: ReturnType<typeof setTimeout>[] = [];
  const check = () => {
    const game = gameStore.getState().game;
    const spin = game.roll.current;
    const key = spin ? spin.reels.map((r) => r.item.uid).join(',') : '';
    if (key === spinKey) return;
    spinKey = key;
    // (A new spin only starts once the last one has landed and rested: nothing of it is left to play.)
    timers.forEach(clearTimeout);
    timers = [];
    if (!spin) return;
    const elapsed = game.roll.timer * 1000;
    const rows = luckRowsOf(spin.reels);
    for (const tk of tokenStops(spin)) {
      const wait = tk.at - elapsed;
      // Already past (the game was away, or loaded mid-spin): not played late.
      if (wait < -150) continue;
      const uid = spin.reels[tk.reel].item.uid;
      timers.push(setTimeout(() => tokenLanded(tokenKey(uid, tk.step), tk.step, tk.x, tk.reel, rows[tk.reel], !!tk.match), Math.max(0, wait)));
    }
  };
  check();
  const unsub = gameStore.subscribe(check);
  return () => {
    unsub();
    timers.forEach(clearTimeout);
  };
}
