/**
 * The big dumpster button and its lid-flip sequence. Build-up and reveal scale with rarity
 * (Dopamine Playbook): more rattle beats, a longer color ladder, more light leaks.
 */
import { BAL, RARITIES } from '../../data';
import { formatNumber, rarityIndex } from '../../core';
import { dispatch, getGame, useGame } from '../../app/store';
import { rarityColor } from '../../render/art';
import { haptics } from '../../services';
import { ladderSteps, skipFlip } from '../flipController';
import { useFrame } from '../hooks';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { BagIcon } from './Icons';
import { Burst } from './Burst';
import { ItemIcon } from './ItemIcon';
import s from './panels.module.css';

function flipVisual(now: number) {
  const flip = useUi.getState().flip;
  if (!flip) return null;
  const elapsed = now - flip.startedAt;
  const item = flip.item;
  const color = rarityColor(item.rarity);
  if (!flip.full) {
    const k = Math.min(1, elapsed / flip.popAt);
    return {
      lidAngle: -Math.sin(k * Math.PI) * 18,
      shakeX: 0,
      glowColor: color,
      glowOpacity: Math.sin(k * Math.PI) * 0.9,
      beams: 0,
      popped: elapsed >= flip.popAt,
      item,
      elapsed,
      popAt: flip.popAt,
    };
  }
  const beatMs = BAL.feel.rattleBeatSeconds * 1000;
  const beats = BAL.feel.rattleBeatsByRarity[item.rarity];
  const rattleMs = beats * beatMs;
  if (elapsed < flip.popAt) {
    // Rising rattle: each beat shakes harder than the last.
    const beat = Math.min(beats - 1, Math.floor(elapsed / beatMs));
    const within = (elapsed % beatMs) / beatMs;
    const amp = ((beat + 1) / beats) * 14;
    const lidAngle = -Math.abs(Math.sin(within * Math.PI)) * amp - (elapsed > rattleMs ? 6 : 0);
    const shakeX = Math.sin(within * Math.PI * 4) * amp * 0.6;
    let glowColor = rarityColor('junk');
    let step = 0;
    if (elapsed >= rattleMs) {
      // Color ladder: climb the rarity colors, holding a little longer on each.
      let tt = elapsed - rattleMs;
      const steps = ladderSteps(item, flip.tease);
      for (let i = 0; i < steps.length; i++) {
        glowColor = rarityColor(steps[i].rarity as (typeof RARITIES)[number]);
        step = i;
        if (tt < steps[i].holdMs) break;
        tt -= steps[i].holdMs;
      }
    }
    return {
      lidAngle,
      shakeX,
      glowColor,
      glowOpacity: 0.35 + 0.65 * Math.min(1, elapsed / flip.popAt),
      beams: elapsed >= rattleMs ? Math.min(step + 1, rarityIndex(item.rarity) + 1) : 0,
      popped: false,
      item,
      elapsed,
      popAt: flip.popAt,
    };
  }
  return {
    lidAngle: -70,
    shakeX: 0,
    glowColor: color,
    glowOpacity: Math.max(0, 1 - (elapsed - flip.popAt) / 600),
    beams: rarityIndex(item.rarity) + 1,
    popped: true,
    item,
    elapsed,
    popAt: flip.popAt,
  };
}

const BEAM_ANGLES = [-28, 22, -12, 34, 6, -40, 16];

export function Dumpster() {
  const bags = useGame((g) => g.currencies.bags);
  const firstDiveDone = useGame((g) => g.dumpster.firstDiveDone);
  const dryStreak = useGame((g) => g.dumpster.dryStreak);
  const level = useGame((g) => g.dumpster.level);
  const reduceMotion = useGame((g) => g.settings.reduceMotion);
  const flip = useUi((u) => u.flip);
  const now = useFrame(flip !== null);
  const v = flip ? flipVisual(now) : null;

  const bl = BAL.dumpster.badLuck;
  const heat = level >= bl.minDumpsterLevel ? Math.min(1, dryStreak / bl.drySpell) : 0;
  const hot = heat * 100 >= BAL.feel.hotDumpsterStartPct;

  const onTap = () => {
    if (skipFlip()) return;
    const g = getGame();
    if (g.pendingItem || useUi.getState().flip) return;
    if (g.currencies.bags < 1) {
      haptics.impact('light');
      useUi.getState().toast(t('dumpster.noBags'), 'warn');
      return;
    }
    haptics.impact('light');
    dispatch({ type: 'dive' });
  };

  return (
    <div className={s.bin}>
      <button className={s.binButton} onClick={onTap} aria-label={t('dumpster.dive')}
        style={{ transform: v && !reduceMotion ? `translateX(${v.shakeX}px)` : undefined }}>
        {hot && <div className={s.heat} style={{ opacity: heat }} />}
        {hot && !reduceMotion &&
          [0, 1, 2].map((i) => (
            <span key={i} className={s.smoke} style={{ left: 70 + i * 70, animationDelay: `${i * 0.55}s` }} />
          ))}
        {v &&
          Array.from({ length: v.beams }, (_, i) => (
            <span
              key={i}
              className={s.beam}
              style={{ left: 60 + ((i * 47) % 180), background: v.glowColor, transform: `rotate(${BEAM_ANGLES[i % BEAM_ANGLES.length]}deg)` }}
            />
          ))}
        <div className={s.binGlow} style={{ background: v?.glowColor ?? 'transparent', opacity: v?.glowOpacity ?? 0 }} />
        <div className={s.binLid} style={{ transform: `rotate(${v?.lidAngle ?? 0}deg)` }} />
        <div className={s.binBody} />
        <div className={s.binLabel}>{t('dumpster.dive')}</div>
        {v?.popped && (
          <>
            <Burst key={`burst-${v.item.uid}`} rarity={v.item.rarity} compact={!flip?.full} reduced={reduceMotion} />
            <div className={`${s.popItem} ${s.popItemAnim}`} key={`pop-${v.item.uid}`}>
              <ItemIcon item={v.item} size={130} />
            </div>
          </>
        )}
        <div className={s.bagCount}>
          <BagIcon />
          {formatNumber(bags)}
        </div>
        {!firstDiveDone && <span className={s.hand}>👆</span>}
      </button>
    </div>
  );
}
