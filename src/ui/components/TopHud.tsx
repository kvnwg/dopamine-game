import { formatNumber, xpToNext } from '../../core';
import { useGame } from '../../app/store';
import { useCountUp } from '../hooks';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { CoinIcon, GearIcon, GemIcon } from './Icons';
import s from './hud.module.css';

/** Overlaid on the top of the battle scene: settings, level/XP, gold and gems (the gold pulses when a haul's coins land). */
export function TopHud() {
  const level = useGame((g) => g.player.level);
  const xp = useGame((g) => g.player.xp);
  const coins = useCountUp(useGame((g) => g.currencies.coins));
  const gems = useCountUp(useGame((g) => g.currencies.gems));
  const need = xpToNext(level);
  const pulse = useUi((u) => u.goldPulse);
  return (
    <div className={s.hud}>
      <button className={s.gearBtn} aria-label={t('hud.settings')} onClick={() => useUi.getState().openPopup('settings')}>
        <GearIcon size="md" />
      </button>
      <div className={s.levelPill}>
        <span className={s.lvBadge}>{t('hud.level', { level })}</span>
        <div className={s.xpTrack}>
          <div className={s.xpFill} style={{ width: `${Math.min(100, (xp / need) * 100)}%` }} />
          <span className={s.xpText}>{formatNumber(xp)}/{formatNumber(need)}</span>
        </div>
      </div>
      <div className={s.spacer} />
      <div className={s.rightCol}>
        <div className={s.row}>
          <div key={pulse} className={`${s.money} ${pulse ? s.moneyPulse : ''}`} data-gold-target>
            <CoinIcon size="md" className={s.moneyIcon} />
            <span>{formatNumber(coins)}</span>
          </div>
          <div className={s.money}>
            <GemIcon size="md" className={s.moneyIcon} />
            <span>{formatNumber(gems)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
