import { computeStats, currentLuck, formatNumber, playerPower } from '../../core';
import { useGame } from '../../app/store';
import { useCountUp, useNow } from '../hooks';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { CloverIcon, HeartIcon, PowerIcon, ShieldIcon, SwordIcon } from './Icons';
import s from './hud.module.css';

export function fmtLuck(v: number): string {
  return v >= 100 ? formatNumber(v) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
}

/** The dark band between battle and menus: power, HP, ATK, DEF, luck (like a fighter's stat bar). */
export function StatStrip() {
  const maxHp = useGame((g) => computeStats(g).HP);
  const atk = useGame((g) => computeStats(g).ATK);
  const def = useGame((g) => computeStats(g).DEF);
  const hp = useGame((g) => g.battle.playerHp);
  const power = useCountUp(useGame(playerPower));
  const now = useNow(1000);
  const luck = useGame((g) => currentLuck(g, now));
  const boosted = useGame((g) => g.luckBoostEndsAt !== null && g.luckBoostEndsAt > now);
  const pct = Math.max(0, Math.min(1, hp / maxHp));
  return (
    <div className={s.strip}>
      <div className={s.cell} style={{ width: 210 }}>
        <PowerIcon size={66} className={s.cellIcon} />
        <div className={s.cellBody}>
          <span className={s.cellLabel}>{t('strip.power')}</span>
          <span className={s.cellValue}>{formatNumber(power)}</span>
        </div>
      </div>
      <div className={s.cell} style={{ width: 330 }}>
        <HeartIcon size={64} className={s.cellIcon} />
        <div className={s.hpTrack}>
          <div className={s.hpFill} style={{ width: `${pct * 100}%` }} />
          <span className={s.hpText}>
            {formatNumber(Math.max(0, hp))}/{formatNumber(maxHp)}
          </span>
        </div>
      </div>
      <div className={s.cell} style={{ width: 150 }}>
        <SwordIcon size={58} className={s.cellIcon} />
        <div className={s.cellBody}>
          <span className={s.cellLabel}>{t('strip.atk')}</span>
          <span className={s.cellValue}>{formatNumber(atk)}</span>
        </div>
      </div>
      <div className={s.cell} style={{ width: 140 }}>
        <ShieldIcon size={56} className={s.cellIcon} />
        <div className={s.cellBody}>
          <span className={s.cellLabel}>{t('strip.def')}</span>
          <span className={s.cellValue}>{formatNumber(def)}</span>
        </div>
      </div>
      <button className={`${s.cell} ${s.luckCell} ${boosted ? s.boosted : ''}`} style={{ width: 170 }} onClick={() => useUi.getState().openPopup('luck')}>
        <CloverIcon size={62} className={s.cellIcon} />
        <div className={s.cellBody}>
          <span className={s.cellLabel}>{t('strip.luck')}</span>
          <span className={`${s.cellValue} ${s.luckValue}`}>×{fmtLuck(luck)}</span>
        </div>
      </button>
    </div>
  );
}
