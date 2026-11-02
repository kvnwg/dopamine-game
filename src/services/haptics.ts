/** Haptics: @capacitor/haptics on native, navigator.vibrate on web where available. */
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { isNative } from './platform';

export type HapticStrength = 'light' | 'medium' | 'heavy';

let enabled = true;

export const haptics = {
  setEnabled(v: boolean) {
    enabled = v;
  },
  impact(strength: HapticStrength) {
    if (!enabled) return;
    if (isNative()) {
      const style = strength === 'heavy' ? ImpactStyle.Heavy : strength === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
      Haptics.impact({ style }).catch(() => {});
      return;
    }
    const ms = strength === 'heavy' ? 40 : strength === 'medium' ? 20 : 8;
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* not supported */
    }
  },
};
