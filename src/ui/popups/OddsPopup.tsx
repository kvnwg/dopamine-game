import { BAL, RARITIES } from '../../data';
import { rarityOddsAt } from '../../core';
import { useGame } from '../../app/store';
import { rarityColor } from '../../render/art';
import { t } from '../i18n';
import { Modal } from './Modal';
import s from './popups.module.css';

/** Odds disclosure. Generated from the same table the dive code rolls from. */
export function OddsPopup({ onClose }: { onClose: () => void }) {
  const level = useGame((g) => g.dumpster.level);
  const levels = Array.from(new Set([1, 5, 10, 15, 20, 25, 30, level])).sort((a, b) => a - b);
  const bl = BAL.dumpster.badLuck;
  return (
    <Modal title={t('odds.title')} subtitle={t('odds.subtitle')} onClose={onClose}>
      <div className={s.inset}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>{t('odds.level')}</th>
            {RARITIES.map((r) => (
              <th key={r} style={{ color: rarityColor(r) }}>{t(`rarityShort.${r}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {levels.map((lv) => {
            const odds = rarityOddsAt(lv);
            return (
              <tr key={lv} className={lv === level ? s.current : undefined}>
                <td>{lv === level ? `▶ ${lv}` : lv}</td>
                {RARITIES.map((r) => (
                  <td key={r}>{odds[r] === 0 ? '—' : `${(odds[r] * 100).toFixed(odds[r] < 0.01 ? 2 : 1)}%`}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <p className={s.note} style={{ marginTop: 24 }}>{t('odds.slots')}</p>
      <p className={s.note}>{t('odds.badLuck', { level: bl.minDumpsterLevel, n: bl.drySpell })}</p>
      <p className={s.note}>{t('odds.firstDive')}</p>
    </Modal>
  );
}
