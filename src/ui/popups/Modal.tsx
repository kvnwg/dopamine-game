import type { ReactNode } from 'react';
import s from './popups.module.css';

/** Popup on a kraft cardboard panel held on with tape. */
export function Modal({ title, subtitle, onClose, children }: { title?: ReactNode; subtitle?: ReactNode; onClose?: () => void; children: ReactNode }) {
  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={`${s.card} cardboard`} onClick={(e) => e.stopPropagation()}>
        <span className="tape tl" />
        <span className="tape br" />
        {onClose && (
          <button className={s.close} onClick={onClose} aria-label="close">
            ✕
          </button>
        )}
        {title && <h2 className={s.title}>{title}</h2>}
        {subtitle && <p className={s.subtitle}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
