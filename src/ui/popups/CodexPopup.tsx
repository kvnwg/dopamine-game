import { BAL, DATA, RARITIES, SLOTS } from '../../data';
import { codexBonusMods, codexKey, formatStatValue } from '../../core';
import { useGame } from '../../app/store';
import { rarityColor } from '../../render/art';
import { t } from '../i18n';
import { Modal } from './Modal';
import s from './popups.module.css';

export function CodexPopup({ onClose }: { onClose: () => void }) {
  const entries = useGame((g) => g.codex.entries);
  const theme = useGame((g) => g.dumpster.theme);
  const found = new Set(entries);
  const items = DATA.items.filter((i) => i.theme === theme);
  const total = items.reduce((n, i) => n + (i.unique ? RARITIES.length - 4 : RARITIES.length), 0);
  const per = BAL.codex.entriesPerBonus;
  const nextAt = (Math.floor(entries.length / per) + 1) * per;
  const bonuses = codexBonusMods(entries.length);
  const nextBonus = BAL.codex.bonusCycle[bonuses.length % BAL.codex.bonusCycle.length];
  const sum = new Map<string, number>();
  for (const b of bonuses) sum.set(`${b.stat}:${b.mode}`, (sum.get(`${b.stat}:${b.mode}`) ?? 0) + b.value);

  return (
    <Modal title={t('codex.title')} subtitle={t('codex.progress', { n: entries.length, total })} onClose={onClose}>
      <p className={s.note}>
        {t('codex.next', { n: nextAt - entries.length, bonus: `${formatStatValue(nextBonus.stat, nextBonus.mode, nextBonus.value)} ${t(`stat.${nextBonus.stat}`)}`, gems: BAL.codex.gemsPerBonus })}
      </p>
      {sum.size > 0 && (
        <p className={s.note}>
          {t('codex.earned')}{' '}
          {[...sum.entries()].map(([k, v]) => {
            const [stat, mode] = k.split(':');
            return `${formatStatValue(stat, mode as 'flat' | 'pct', v)} ${t(`stat.${stat}`)}`;
          }).join(' · ')}
        </p>
      )}
      {SLOTS.map((slot) => (
        <div key={slot} className={s.codexSlot}>
          <div className={s.section} style={{ margin: 0 }}>{t(`slot.${slot}`)}</div>
          {items.filter((i) => i.slot === slot).map((i) => {
            const rarities = i.unique ? RARITIES.slice(4) : RARITIES;
            const any = rarities.some((r) => found.has(codexKey(i.id, r)));
            return (
              <div key={i.id} className={s.codexRow}>
                <span className={s.codexName} style={{ color: any ? 'var(--text)' : '#4a5280' }}>
                  {any ? (i.unique ? `★ ${i.name}` : i.name) : '???'}
                </span>
                {rarities.map((r) => (
                  <span
                    key={r}
                    className={s.pip}
                    title={t(`rarity.${r}`)}
                    style={found.has(codexKey(i.id, r)) ? { background: rarityColor(r) } : undefined}
                  />
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </Modal>
  );
}
