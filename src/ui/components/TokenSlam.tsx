/**
 * A luck token slamming onto the screen (Kevin: "if i landed a luck booster it should play the sound,
 * also it should slam onto the screen like the items do"). Over the battle, on every tab: the clover
 * drops in big (its Scale3x picture), slams down to its Scale2x picture with a small kick of the
 * battle, a ring and clover bits, green rays behind it and the reel's new luck ("×6 LUCK") stamped
 * under it; then it lifts away. tokenFx.ts says when (and plays the chime).
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { useGame } from '../../app/store';
import { chainFloor, formatNumber } from '../../core';
import { rarityColor } from '../../render/art';
import { luckTokenArt, UI_PX } from '../../render/icons';
import { t } from '../i18n';
import { slamBridge } from '../../render/equipSlam';
import { raysUrl } from '../rays';
import { useUi } from '../uiStore';
import { PixelArt } from './PixelArt';
import s from './tokenSlam.module.css';

/** How long a slam shows (ms; tokenSlam.module.css runs on the same length), and when it hits. */
const SHOW_MS = 1400;
const IMPACT_MS = 100;
const GREEN = '#7ef08f';

/** Clover bits thrown out on impact (art px; multiples of 3, so each third of the way is whole). */
const BITS = [
  [-30, -18],
  [30, -18],
  [-36, 6],
  [36, 6],
  [-18, -30],
  [18, -30],
  [-24, 24],
  [24, 24],
] as const;

export function TokenSlam() {
  const slam = useUi((u) => u.tokenSlam);
  const calm = useGame((g) => g.settings.reduceMotion);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!slam) return;
    const id = slam.id;
    const list = timers.current;
    // The hit gives the battle a small kick that dies away (its own shake, as a blow's), not the whole
    // screen a jolt (Kevin: "the screen shake on the luck multipliers is too violent and unsmooth").
    if (!calm) list.push(setTimeout(() => slamBridge.shake?.(240, 1), IMPACT_MS));
    list.push(setTimeout(() => useUi.setState((u) => (u.tokenSlam?.id === id ? { tokenSlam: null } : {})), SHOW_MS + 50));
    return () => {
      list.forEach(clearTimeout);
      list.length = 0;
    };
  }, [slam, calm]);

  if (!slam) return null;
  // A big chain guarantees a rarity (chainFloor): say so under its luck.
  const floor = chainFloor(slam.total);
  return (
    <div key={slam.id} className={s.slam} data-calm={calm || undefined} aria-hidden>
      <div className={s.rays} style={{ backgroundImage: `url(${raysUrl([GREEN], 16, 0.5)})` }} />
      <div className={s.ring} />
      <PixelArt art={luckTokenArt(slam.x, 3)} className={s.big} />
      <PixelArt art={luckTokenArt(slam.x, 2)} className={s.small} />
      <div className={s.bits}>
        {BITS.map(([dx, dy], k) => (
          <i key={k} style={{ '--dx': `${dx * UI_PX}px`, '--dy': `${dy * UI_PX}px` } as CSSProperties} />
        ))}
      </div>
      <div className={s.text}>{t('reel.token', { x: formatNumber(slam.total) })}</div>
      {floor && (
        <div className={s.floor} style={{ color: rarityColor(floor) }}>
          {t('reel.tokenFloor', { rarity: t(`rarity.${floor}`).toUpperCase() })}
        </div>
      )}
    </div>
  );
}
