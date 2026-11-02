import { formatNumber, xpToNext } from '../../core';
import { useGame } from '../../app/store';
import { useCountUp } from '../hooks';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { CoinIcon, GemIcon } from './Icons';
import s from './panels.module.css';

export function TopBar() {
  const level = useGame((g) => g.player.level);
  const xp = useGame((g) => g.player.xp);
  const coins = useCountUp(useGame((g) => g.currencies.coins));
  const gems = useCountUp(useGame((g) => g.currencies.gems));
  const need = xpToNext(level);
  return (
    <div className={`${s.topBar} cardboard-dark`}>
      <span className="tape tl" />
      <span className="tape tr" />
      <div className={`${s.cap} ${s.levelBadge}`}>{level}</div>
      <div className={s.xpWrap}>
        <div className={s.xpLabel}>{t('top.xp', { xp: formatNumber(xp), need: formatNumber(need) })}</div>
        <div className={s.bar}>
          <div className={s.barFill} style={{ width: `${Math.min(100, (xp / need) * 100)}%` }} />
        </div>
      </div>
      <div className={s.currency}>
        <CoinIcon />
        {formatNumber(coins)}
      </div>
      <div className={s.currency} style={{ minWidth: 150 }}>
        <GemIcon />
        {formatNumber(gems)}
      </div>
      <button className={s.iconBtn} aria-label={t('settings.title')} onClick={() => useUi.getState().openPopup('settings')}>
        ⚙️
      </button>
    </div>
  );
}
