import type { SettingKey } from '../../core';
import { dispatch, useGame } from '../../app/store';
import { haptics } from '../../services';
import { t } from '../i18n';
import { Modal } from './Modal';
import s from './popups.module.css';

const KEYS: SettingKey[] = ['sound', 'music', 'haptics', 'reduceFlashing', 'reduceMotion'];

export function SettingsPopup({ onClose }: { onClose: () => void }) {
  const settings = useGame((g) => g.settings);
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
      <p className={s.note} style={{ marginTop: 24 }}>{t('settings.version', { version: __APP_VERSION__ })}</p>
      <p className={s.note} style={{ marginTop: 8 }}>{t('settings.credits')}</p>
    </Modal>
  );
}
