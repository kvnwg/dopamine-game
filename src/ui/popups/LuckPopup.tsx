import { BAL, RARITIES } from '../../data';
import {
  enchantChance, formatDuration, luckBreakdown, luckyEvery, RARITY_ODDS, rarityChances,
} from '../../core';
import { useGame } from '../../app/store';
import { rarityColor } from '../../render/art';
import { fmtOdds } from '../components/AlleyPanel';
import { CloverIcon } from '../components/Icons';
import { fmtLuck } from '../components/StatStrip';
import { useNow } from '../hooks';
import { t } from '../i18n';
import { Modal } from './Modal';
import s from './popups.module.css';

/** Luck breakdown and the exact chance of each rarity per roll (generated from the code that rolls). */
export function LuckPopup({ onClose }: { onClose: () => void }) {
  const now = useNow(500);
  const g = useGame((x) => x);
  const b = luckBreakdown(g, now);
  const chances = rarityChances(b.total);
  const lucky = rarityChances(b.total * BAL.roll.luckyRollMult);
  const bl = BAL.dumpster.badLuck;
  const rows: Array<[string, string]> = [
    [t('luck.base'), '1.00'],
    [t('luck.upgrades'), `+${b.upgrades.toFixed(2)}`],
    [t('luck.dumpster', { level: g.dumpster.level }), `+${b.dumpster.toFixed(2)}`],
    [t('luck.enchants'), `+${b.enchants.toFixed(2)}`],
    [t('luck.rebirth', { n: g.rebirths }), `×${b.rebirthMult.toFixed(2)}`],
  ];
  if (b.boostMult > 1 && b.boostEndsAt) {
    rows.push([`${t('luck.boost')} (${t('luck.boostLeft', { time: formatDuration((b.boostEndsAt - now) / 1000) })})`, `×${b.boostMult}`]);
  }
  return (
    <Modal title={t('luck.title')} tone="green" onClose={onClose}>
      <div className={s.luckHero}>
        <CloverIcon size={96} />
        <span className={s.luckTotal}>{t('luck.total', { luck: fmtLuck(b.total) })}</span>
      </div>
      <div className={s.inset}>
        {rows.map(([k, v]) => (
          <div key={k} className={s.statRow}>
            <span className={s.statSub}>{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>
      <p className={s.note}>{t('luck.how')}</p>
      <div className={s.section}>{t('luck.chances')}</div>
      <div className={s.inset}>
        <table className={s.table}>
          <thead>
            <tr>
              <th />
              <th>{t('luck.oneIn', { x: 'X' })}</th>
              <th>%</th>
              <th>{t('roll.lucky')}</th>
            </tr>
          </thead>
          <tbody>
            {[...RARITIES].reverse().map((r) => (
              <tr key={r}>
                <td style={{ color: rarityColor(r), textAlign: 'left' }} className={s.rarityCell}>
                  {t(`rarity.${r}`)}
                </td>
                <td>{r === 'junk' ? '—' : fmtOdds(RARITY_ODDS[r])}</td>
                <td>{pct(chances[r])}</td>
                <td>{pct(lucky[r])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={s.note}>{t('luck.lucky', { n: luckyEvery(g), mult: BAL.roll.luckyRollMult })}</p>
      <p className={s.note}>{t('luck.enchantChance', { pct: (enchantChance(g) * 100).toFixed(1) })}</p>
      <p className={s.note}>{t('luck.badLuck', { level: bl.minDumpsterLevel, n: bl.drySpell })}</p>
      <p className={s.note}>{t('luck.potionDrop', { mult: BAL.luck.potion.mult, s: BAL.luck.potion.seconds })}</p>
      <p className={s.note}>{t('luck.slots')}</p>
    </Modal>
  );
}

function pct(v: number): string {
  if (v <= 0) return '—';
  const p = v * 100;
  if (p >= 10) return `${p.toFixed(1)}%`;
  if (p >= 0.01) return `${p.toFixed(2)}%`;
  return `${p.toPrecision(2)}%`;
}
