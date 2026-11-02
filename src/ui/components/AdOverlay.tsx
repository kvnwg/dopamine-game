import { useEffect } from 'react';
import { mockAds } from '../../services';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import s from './overlays.module.css';

/** Shown while the mock rewarded ad "plays" (dev builds and until AdMob is wired in M4). */
export function AdOverlay() {
  const playing = useUi((u) => u.adPlaying);
  useEffect(() => mockAds.onPlaying((p) => useUi.setState({ adPlaying: p })), []);
  if (!playing) return null;
  return (
    <div className={s.ad}>
      📺 {t('ads.mockPlaying')}
      <span className={s.adSub}>{t('ads.mockPlacement', { placement: playing })}</span>
    </div>
  );
}
