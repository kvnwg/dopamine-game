import { SLOTS } from '../../data';
import { formatNumber, totalGearPower } from '../../core';
import { useGame } from '../../app/store';
import { useCountUp } from '../hooks';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { ItemIcon } from './ItemIcon';
import s from './panels.module.css';

export function GearGrid() {
  const equipped = useGame((g) => g.equipped);
  const power = useCountUp(totalGearPower({ equipped }), 600);
  const codexCount = useGame((g) => g.codex.entries.length);
  const pulse = useUi((u) => u.equipPulse);
  const openPopup = useUi((u) => u.openPopup);
  return (
    <div className={`${s.gearPanel} cardboard-dark`}>
      <div className={s.gearMain}>
        <div className={s.gearHeader}>
          <span className={s.tapeLabel}>{t('gear.title')}</span>
          <span className={s.power}>⚡ {t('gear.power', { power: formatNumber(power) })}</span>
        </div>
        <div className={s.gearGrid}>
          {SLOTS.map((slot) => {
            const item = equipped[slot];
            const landed = pulse && pulse.slot === slot && item?.uid === pulse.id;
            return (
              <button
                key={slot}
                className={`${s.slotBtn} ${landed ? s.landed : ''}`}
                onClick={() => openPopup('itemDetail', slot)}
                aria-label={t(`slot.${slot}`)}
              >
                <ItemIcon item={item} slot={slot} size={150} key={item?.uid ?? slot} />
              </button>
            );
          })}
        </div>
      </div>
      <div className={s.sideButtons}>
        <button className={s.sideBtn} onClick={() => openPopup('codex')}>
          <span className={s.sideBtnIcon}>📖</span>
          {t('codex.short')}
          <span style={{ color: 'var(--tape)', fontSize: 24 }}>{codexCount}</span>
        </button>
      </div>
    </div>
  );
}
