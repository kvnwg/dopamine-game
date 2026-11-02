import { dispatch } from '../../app/store';
import { haptics } from '../../services';
import { t } from '../i18n';
import { Modal } from './Modal';
import s from './popups.module.css';

export function AutoDiveUnlockPopup() {
  const done = (enable: boolean) => {
    haptics.impact('medium');
    dispatch({ type: 'acknowledgeAutoDiveUnlock' });
    if (enable) dispatch({ type: 'setAutoDive', enabled: true });
  };
  return (
    <Modal title={t('autoDive.unlockTitle')}>
      <p className={s.body}>{t('autoDive.unlockBody1')}</p>
      <p className={s.body}>{t('autoDive.unlockBody2')}</p>
      <div className={s.actions}>
        <button className="btn alt" onClick={() => done(false)}>
          {t('common.later')}
        </button>
        <button className="btn" onClick={() => done(true)}>
          {t('autoDive.turnOn')}
        </button>
      </div>
    </Modal>
  );
}
