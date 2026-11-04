import type { ReactNode } from 'react';
import { uiBitArt } from '../../render/icons';
import { PixelArt } from '../components/PixelArt';
import { t } from '../i18n';
import s from './popups.module.css';

/** Popup card: colored title ribbon, cream body, red close button. */
export function Modal({
  title, subtitle, onClose, children, tone = 'blue', wide,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  tone?: 'blue' | 'gold' | 'green' | 'purple' | 'red';
  wide?: boolean;
}) {
  return (
    <div className={s.overlay} onClick={onClose} data-keep-lit>
      <div className={`${s.card} ${wide ? s.wide : ''}`} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className={`${s.ribbon} ${s[tone]}`}>
            <span className={s.title}>{title}</span>
          </div>
        )}
        {onClose && (
          <button className={s.close} onClick={onClose} aria-label={t('common.close')}>
            <PixelArt art={uiBitArt('closeX')} />
          </button>
        )}
        <div className={s.body}>
          {subtitle && <p className={s.subtitle}>{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
