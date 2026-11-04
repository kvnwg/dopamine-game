/**
 * Luck tokens wherever you are. When a reel lands on a luck token, its chime plays and the token slams
 * onto the screen (TokenSlam), on every tab, not only the Roll tab's reels. The reels call tokenLanded
 * as they show a token; a timer from the spin's start calls it too, for when the reels aren't on
 * screen. Each token plays once, whichever comes first (they agree to a frame: both run on core's roll
 * timer).
 */
import { gameStore } from '../app/store';
import { haptics } from '../services';
import { audio } from '../services/audio';
import { tokenStops } from './reelTiming';
import { useUi } from './uiStore';

const fired = new Set<string>();
let slamId = 1;

/** A token's key: the result item of its reel, and its place among that reel's stops. */
export const tokenKey = (itemUid: number | string, step: number) => `${itemUid}:${step}`;

/**
 * A luck token lands on reel `reel`: its chime (a step higher for each in a chain), a buzz, and its
 * slam out of that reel. Once per token.
 */
export function tokenLanded(key: string, step: number, x: number, total: number, reel: number): void {
  if (fired.has(key)) return;
  fired.add(key);
  if (fired.size > 64) fired.delete(fired.values().next().value as string);
  audio.token(step, x);
  haptics.impact('medium');
  useUi.setState({ tokenSlam: { id: slamId++, x, total, reel } });
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
    for (const tk of tokenStops(spin)) {
      const wait = tk.at - elapsed;
      // Already past (the game was away, or loaded mid-spin): not played late.
      if (wait < -150) continue;
      const uid = spin.reels[tk.reel].item.uid;
      timers.push(setTimeout(() => tokenLanded(tokenKey(uid, tk.step), tk.step, tk.x, tk.total, tk.reel), Math.max(0, wait)));
    }
  };
  check();
  const unsub = gameStore.subscribe(check);
  return () => {
    unsub();
    timers.forEach(clearTimeout);
  };
}
