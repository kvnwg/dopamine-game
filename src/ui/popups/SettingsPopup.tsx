import { useEffect, useRef, useState } from 'react';
import type { SettingKey, VolumeKey } from '../../core';
import { resetSave, stopLoop } from '../../app/session';
import { dispatch, useGame } from '../../app/store';
import { haptics } from '../../services';
import { audio } from '../../services/audio';
import { SHOW_DEV } from '../../dev/flags';
import { isArtifactOwner } from '../../services/cloudSave';
import { useUi } from '../uiStore';
import { t } from '../i18n';
import { Modal } from './Modal';
import s from './popups.module.css';

const KEYS: SettingKey[] = ['sound', 'music', 'haptics', 'reduceFlashing', 'reduceMotion'];
/** The volume slider under a switch. */
const VOLUME: Partial<Record<SettingKey, VolumeKey>> = { sound: 'soundVolume', music: 'musicVolume' };

/** The admin portal is open to this visit (five taps on the version line, or the artifact's owner). */
let adminUnlocked = false;

export function SettingsPopup({ onClose }: { onClose: () => void }) {
  const settings = useGame((g) => g.settings);
  // The admin portal: shown to the artifact's owner, or after five quick taps on the version line.
  const [admin, setAdmin] = useState(adminUnlocked || SHOW_DEV);
  const taps = useRef<number[]>([]);
  useEffect(() => {
    let live = true;
    void isArtifactOwner().then((owner) => {
      if (owner && live) {
        adminUnlocked = true;
        setAdmin(true);
      }
    });
    return () => {
      live = false;
    };
  }, []);
  const tapVersion = () => {
    const now = performance.now();
    taps.current = [...taps.current.filter((t0) => now - t0 < 2500), now];
    if (taps.current.length >= 5 && !admin) {
      adminUnlocked = true;
      setAdmin(true);
      haptics.impact('heavy');
    }
  };
  // Starting over takes a second tap (it erases the save), then the page starts fresh at the title.
  const [armed, setArmed] = useState(false);
  const newGame = async () => {
    if (!armed) {
      setArmed(true);
      haptics.impact('medium');
      setTimeout(() => setArmed(false), 4000);
      return;
    }
    stopLoop();
    await resetSave();
    location.reload();
  };
  return (
    <Modal title={t('settings.title')} onClose={onClose}>
      {KEYS.map((k) => {
        const vol = VOLUME[k];
        return (
          <div key={k}>
            <div className={s.settingRow}>
              <span>{t(`settings.${k}`)}</span>
              <button
                className={`${s.switch} ${settings[k] ? s.switchOn : ''}`}
                aria-pressed={settings[k]}
                onClick={() => {
                  dispatch({ type: 'setSetting', key: k, value: !settings[k] });
                  haptics.impact('light');
                }}
              />
            </div>
            {vol && (
              <label className={s.volumeRow} data-off={!settings[k] || undefined}>
                <span>{t('settings.volume', { name: t(`settings.${k}`) })}</span>
                <input
                  className={s.volume}
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(settings[vol] * 100)}
                  disabled={!settings[k]}
                  aria-label={t('settings.volume', { name: t(`settings.${k}`) })}
                  onChange={(e) => dispatch({ type: 'setVolume', key: vol, value: Number(e.target.value) / 100 })}
                  // A tap at the new level, so the sound slider can be heard as it's set.
                  onPointerUp={() => k === 'sound' && audio.tap()}
                />
                <b>{Math.round(settings[vol] * 100)}%</b>
              </label>
            )}
          </div>
        );
      })}
      {SHOW_DEV && (
        <button
          className="btn small red"
          style={{ marginTop: 20 }}
          onClick={() => {
            onClose();
            useUi.setState({ devOpen: true });
          }}
        >
          {t('settings.devTools')}
        </button>
      )}
      <div className={s.settingsBtns}>
        <button className="btn small blue" onClick={() => useUi.getState().openPopup('save')}>
          {t('settings.save')}
        </button>
        {admin && (
          <button className="btn small red" onClick={() => useUi.getState().openPopup('admin')}>
            {t('settings.admin')}
          </button>
        )}
      </div>
      <button className={`btn small ${armed ? 'red' : 'gray'}`} style={{ marginTop: 24 }} onClick={() => void newGame()}>
        {armed ? t('settings.newGameConfirm') : t('settings.newGame')}
      </button>
      <p className={s.note} style={{ marginTop: 24 }} onClick={tapVersion}>
        {t('settings.version', { version: __APP_VERSION__ })}
      </p>
      <p className={s.note} style={{ marginTop: 8 }}>{t('settings.credits')}</p>
    </Modal>
  );
}
