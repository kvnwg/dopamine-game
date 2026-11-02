/** Full-screen celebration for Epic and better. Intensity jumps at every rarity tier. */
import { useMemo } from 'react';
import { BAL } from '../../data';
import { itemFlavor, itemName, rarityAtLeast } from '../../core';
import { useGame } from '../../app/store';
import { rarityColor } from '../../render/art';
import { skipFlip } from '../flipController';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { ItemIcon } from './ItemIcon';
import s from './overlays.module.css';

export function RevealLayer() {
  const celebrate = useUi((u) => u.celebrate);
  const reduceFlashing = useGame((g) => g.settings.reduceFlashing);
  const reduceMotion = useGame((g) => g.settings.reduceMotion);
  const coins = useMemo(
    () => Array.from({ length: 26 }, (_, i) => ({ left: (i * 397) % 1040, delay: (i * 83) % 900, dur: 1100 + ((i * 131) % 700) })),
    [],
  );
  if (!celebrate) return null;
  const { item } = celebrate;
  const color = rarityColor(item.rarity);
  const legendary = rarityAtLeast(item.rarity, 'legendary');
  const mythic = rarityAtLeast(item.rarity, 'mythic');
  const mint = item.rarity === 'mint';
  const seconds = BAL.feel.revealSecondsByRarity[item.rarity];

  return (
    <div className={`${s.reveal} ${!reduceMotion ? s.shake : ''}`} key={celebrate.id} onClick={() => skipFlip()}>
      <div className={s.tint} style={{ background: `radial-gradient(circle, ${color}55, rgba(5,6,12,${legendary ? 0.85 : 0.5}) 70%)` }} />
      <div className={s.edge} style={{ boxShadow: `inset 0 0 160px 30px ${color}`, animationDuration: `${Math.min(1, seconds)}s` }} />
      {legendary && !reduceMotion && (
        <div className={s.rays} style={{ background: `repeating-conic-gradient(${color} 0deg 10deg, transparent 10deg 24deg)` }} />
      )}
      {legendary &&
        !reduceMotion &&
        coins.map((c, i) => (
          <span key={i} className={s.coin} style={{ left: c.left, animationDelay: `${c.delay}ms`, animationDuration: `${c.dur}ms` }} />
        ))}
      {mythic && <div className={s.rainbowFrame} />}
      {mint && <div className={s.stamp}>{t('reveal.mintStamp')}</div>}
      <div className={s.center}>
        <ItemIcon item={item} size={legendary ? 300 : 220} />
        {legendary && (
          <div className={s.banner} style={{ borderColor: color }}>
            <div className={s.bannerRarity} style={{ color }}>{t(`rarity.${item.rarity}`)}!</div>
            <div className={`${s.bannerName} ${mythic ? s.rainbowText : ''}`} style={{ color: mythic ? undefined : '#fff' }}>
              {itemName(item)}
            </div>
            <div className={s.bannerFlavor}>“{itemFlavor(item)}”</div>
          </div>
        )}
        {!legendary && (
          <div className={s.bannerRarity} style={{ color, textShadow: '0 4px 0 #000' }}>{t(`rarity.${item.rarity}`)}!</div>
        )}
      </div>
      {legendary && !reduceFlashing && <div className={s.flash} />}
      <span className={s.tapHint}>{t('reveal.tapToSkip')}</span>
    </div>
  );
}
