import { haptics } from '../../services';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import s from './panels.module.css';

const TABS = [
  { id: 'alley', icon: '🗑️', unlocked: true },
  { id: 'heists', icon: '🍕', unlocked: false },
  { id: 'city', icon: '🏙️', unlocked: false },
  { id: 'crew', icon: '🐦', unlocked: false },
  { id: 'shop', icon: '🛒', unlocked: false },
] as const;

/** Five bottle-cap buttons; locked tabs wear a crooked "soon" sticker. */
export function BottomNav() {
  return (
    <nav className={s.nav}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={[s.tab, tab.id === 'alley' ? s.tabActive : '', !tab.unlocked ? s.tabLocked : ''].join(' ')}
          onClick={() => {
            haptics.impact('light');
            if (!tab.unlocked) useUi.getState().toast(t('nav.locked', { name: t(`nav.${tab.id}`) }), 'info');
          }}
        >
          <span className={`${s.cap} ${s.tabCap}`}>{tab.icon}</span>
          {t(`nav.${tab.id}`)}
          {!tab.unlocked && <span className={`sticker ${s.soon}`}>{t('nav.soon')}</span>}
        </button>
      ))}
    </nav>
  );
}
