import { BAL } from '../../data';
import { formatDuration, formatNumber, xpToNext } from '../../core';
import { useGame } from '../../app/store';
import { useCountUp, useNow } from '../hooks';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { CoinIcon, GearIcon, GemIcon, PotionIcon } from './Icons';
import s from './hud.module.css';

/** Overlaid on the top of the battle scene: settings, level/XP, gold, gems, luck potion timer. */
export function TopHud() {
  const level = useGame((g) => g.player.level);
  const xp = useGame((g) => g.player.xp);
  const coins = useCountUp(useGame((g) => g.currencies.coins));
  const gems = useCountUp(useGame((g) => g.currencies.gems));
  const boostEnds = useGame((g) => g.luckBoostEndsAt);
  const now = useNow(500);
  const need = xpToNext(level);
  const boostLeft = boostEnds !== null ? (boostEnds - now) / 1000 : 0;
  return (
    <div className={s.hud}>
      <button className={s.gearBtn} aria-label={t('hud.settings')} onClick={() => useUi.getState().openPopup('settings')}>
        <GearIcon size={56} />
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
          <div className={s.money}>
            <CoinIcon size={62} className={s.moneyIcon} />
            <span>{formatNumber(coins)}</span>
          </div>
          <div className={s.money}>
            <GemIcon size={58} className={s.moneyIcon} />
            <span>{formatNumber(gems)}</span>
          </div>
        </div>
        {boostLeft > 0 && (
          <button className={s.boost} onClick={() => useUi.getState().openPopup('luck')}>
            <PotionIcon size={52} />
            {t('hud.luckBoost', { mult: BAL.luck.potion.mult, time: formatDuration(boostLeft) })}
          </button>
        )}
      </div>
    </div>
  );
}
