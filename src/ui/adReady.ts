/**
 * Whether a rewarded ad can play, for the ad buttons. CrazyGames allows no ad button without effect: with
 * ads off for the session (Basic Launch, kids mode) or an ad blocker, every ad button hides and its Gem price
 * stays. (The SDK can tell about an ad blocker up front; ads being off only show up on the first request.)
 */
import { useSyncExternalStore } from 'react';
import { ads, type AdPlacement } from '../services';
import { isCrazyGames } from '../services/platform';

const noop = () => undefined;

export function useAdReady(placement: AdPlacement): boolean {
  return useSyncExternalStore(
    (onChange) => ads.onAvailabilityChange?.(onChange) ?? noop,
    () => ads.isReady(placement),
  );
}

/**
 * The class for the way out of a rewarded offer (Collect without the x2, Give up): on CrazyGames it must
 * look exactly like the watch button ("the same size, font, color"), so it gets the watch button's class
 * whenever that button shows. Elsewhere it keeps its own.
 */
export function skipClass(own: string, watchClass: string, watchShown: boolean): string {
  return isCrazyGames && watchShown ? watchClass : own;
}
