import { useState } from 'react';
import type { SettingKey } from '../../core';
import { resetSave, stopLoop } from '../../app/session';
import { dispatch, useGame } from '../../app/store';
import { haptics } from '../../services';
import { SHOW_DEV } from '../../dev/flags';
import { useUi } from '../uiStore';
import { t } from '../i18n';
import { Modal } from './Modal';
import s from './popups.module.css';

const KEYS: SettingKey[] = ['sound', 'music', 'haptics', 'reduceFlashing', 'reduceMotion'];

export function SettingsPopup({ onClose }: { onClose: () => void }) {
  const settings = useGame((g) => g.settings);
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
      {KEYS.map((k) => (
        <div key={k} className={s.settingRow}>
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
      ))}
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
      <button className={`btn small ${armed ? 'red' : 'gray'}`} style={{ marginTop: 24 }} onClick={() => void newGame()}>
        {armed ? t('settings.newGameConfirm') : t('settings.newGame')}
      </button>
      <p className={s.note} style={{ marginTop: 24 }}>{t('settings.version', { version: __APP_VERSION__ })}</p>
      <p className={s.note} style={{ marginTop: 8 }}>{t('settings.credits')}</p>
    </Modal>
  );
}
