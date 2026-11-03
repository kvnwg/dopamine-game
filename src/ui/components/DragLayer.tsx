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
      {/* Whole stage px, upright and at its real size: the art stays on the pixel grid while it follows the finger. */}
      <div className={s.ghost} style={{ left: Math.round(drag.x) - 243, top: Math.round(drag.y) - 117 }}>
        <ItemIcon item={drag.item} />
        <span className={`${s.dragHint} ${drag.over ? s.dragHintOn : ''}`}>{drag.over ? t('drag.release') : t('drag.dropOn')}</span>
      </div>
    </div>
  );
}
