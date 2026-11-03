import { t } from '../i18n';
import { useUi } from '../uiStore';
import { ItemIcon } from './ItemIcon';
import s from './overlays.module.css';

/** The item following your finger while you drag it toward the raccoon. */
export function DragLayer() {
  const drag = useUi((u) => u.drag);
  if (!drag) return null;
  return (
    <div className={s.dragLayer}>
      <div className={s.ghost} style={{ left: drag.x, top: drag.y }}>
        <ItemIcon item={drag.item} size={150} />
        <span className={`${s.dragHint} ${drag.over ? s.dragHintOn : ''}`}>{drag.over ? t('drag.release') : t('drag.dropOn')}</span>
      </div>
    </div>
  );
}
