import { useUi } from '../uiStore';
import s from './overlays.module.css';

export function Toasts() {
  const toasts = useUi((u) => u.toasts);
  return (
    <div className={s.toasts}>
      {toasts.map((x) => (
        <div key={x.id} className={`${s.toast} ${x.tone === 'good' ? s.toastGood : x.tone === 'warn' ? s.toastWarn : ''}`}>
          {x.text}
        </div>
      ))}
    </div>
  );
}
