/** Haptics: @capacitor/haptics on native, navigator.vibrate on web where available. */
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { isNative } from './platform';

export type HapticStrength = 'light' | 'medium' | 'heavy';

let enabled = true;
const RANK: Record<HapticStrength, number> = { light: 0, medium: 1, heavy: 2 };
/** The last buzz: a tap and its button's own buzz, a moment apart, make one buzz, not two. */
let last = { at: -1e9, rank: -1 };

export const haptics = {
  setEnabled(v: boolean) {
    enabled = v;
  },
  impact(strength: HapticStrength) {
    if (!enabled) return;
    const now = performance.now();
    if (now - last.at < 45 && RANK[strength] <= last.rank) return;
    last = { at: now, rank: RANK[strength] };
    if (isNative()) {
      const style = strength === 'heavy' ? ImpactStyle.Heavy : strength === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
      Haptics.impact({ style }).catch(() => {});
      return;
    }
    const ms = strength === 'heavy' ? 40 : strength === 'medium' ? 20 : 8;
    // Browsers reject vibration before the first tap (and log an error), so wait for one.
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (ua && !ua.hasBeenActive) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* not supported */
    }
  },
};
