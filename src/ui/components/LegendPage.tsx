/**
 * Become a Legend (the Rebirth tab's second page, from Rebirth 5): what becoming one now pays, the
 * button, and the star upgrades (never wiped) with the automation switches.
 */
import { useState, type CSSProperties } from 'react';
import { BAL, type LegendPerkDef } from '../../data';
import { canBuyLegend, canLegend, legendFx, legendGain, legendLevel, legendPrice, starsForRebirths } from '../../core';
import { dispatch, useGameWhen } from '../../app/store';
import { haptics } from '../../services';
import { uiIcon } from '../../render/icons';
import type { UiIcon } from '../../render/pixel/ui';
import { t } from '../i18n';
import { Chunky } from './Chunky';
import { StarIcon } from './Icons';
import { PixelArt } from './PixelArt';
import p from './panels.module.css';
import s from './endless.module.css';

/**
 * A star upgrade's line of text, with its numbers: what the next level makes it (all of it once maxed),
 * and for the ones with no limit, a level's worth and the total so far.
 */
function perkText(def: LegendPerkDef, level: number): string {
  const n = def.max === 0 ? 1 : Math.max(1, Math.min(def.max, level + 1));
  const e = def.effect;
  const pct = (e.goldenSpin ?? 0) * 100 + (e.luckPct ?? 0) + (e.powerPct ?? 0) + (e.goldPct ?? 0);
  return t(`legend.perk.${def.id}.text`, {
    levels: (e.startLevels ?? 0) * n,
    worlds: (e.startWorlds ?? 0) * n,
    loaves: (e.startLoaves ?? 0) * n,
    pct: Math.round(pct * n),
    now: Math.round(pct * level),
  });
}

function Perk({ def }: { def: LegendPerkDef }) {
  const g = useGameWhen((x) => [x.legend]);
  const level = legendLevel(g, def.id);
  const price = legendPrice(def, level);
  const can = canBuyLegend(g, def.id);
  const toggle = def.effect.autoEquip ? 'autoEquip' : def.effect.autoRebirth ? 'autoRebirth' : null;
  const fx = legendFx(g);
  const owned = toggle ? (toggle === 'autoEquip' ? fx.autoEquip : fx.autoRebirth) : false;
  return (
    <div className={s.perk}>
      <span className={s.perkIcon}>
        <PixelArt art={uiIcon(def.icon as UiIcon, 'md')} />
      </span>
      <div className={s.perkBody}>
        <span className={s.perkName}>
          {t(`legend.perk.${def.id}.name`)}
          {level > 0 && (def.max === 0 || def.max > 1) && ` · ${t('legend.level', { n: level })}`}
        </span>
        <span className={s.perkText}>{perkText(def, level)}</span>
      </div>
      {toggle && owned && (
        <button
          className={`${s.toggle} ${g.legend[toggle] ? s.toggleOn : ''}`}
          onClick={() => {
            haptics.impact('light');
            dispatch({ type: 'setLegendToggle', key: toggle, value: !g.legend[toggle] });
          }}
        >
          {g.legend[toggle] ? t('legend.on') : t('legend.offLabel')}
        </button>
      )}
      {price === null ? (
        <span className={s.perkBuy} style={{ display: 'grid', placeItems: 'center', background: '#c9f2b8' }}>
          {def.max === 1 ? t('legend.owned') : t('legend.maxed')}
        </span>
      ) : (
        <button
          className={s.perkBuy}
          disabled={!can}
          onClick={() => {
            haptics.impact('medium');
            dispatch({ type: 'buyLegendPerk', id: def.id });
          }}
        >
          {t('legend.buy', { n: price })}
        </button>
      )}
    </div>
  );
}

export function LegendPage() {
  const g = useGameWhen((x) => [x.rebirths, x.legend, x.heist.run]);
  const gain = legendGain(g);
  const ready = canLegend(g);
  const [armed, setArmed] = useState(false);
  const unlock = BAL.legend.unlockRebirths;
  const go = () => {
    if (!ready) return;
    if (!armed) {
      setArmed(true);
      haptics.impact('medium');
      setTimeout(() => setArmed(false), 3000);
      return;
    }
    setArmed(false);
    haptics.impact('heavy');
    dispatch({ type: 'legend' });
  };
  return (
    <>
      <div className={`${s.legendHero} card`}>
        <StarIcon size="nav" />
        <div className={p.rbTitles}>
          <Chunky text={t('legend.title')} size={50} grad="gold" />
          <span className={p.rbCount}>
            {t('legend.count', { n: g.legend.count })} · <span className={s.legendStars}>{t('legend.stars', { n: g.legend.stars })}</span>
          </span>
          <span className={p.rbSub}>{t('legend.sub')}</span>
        </div>
      </div>
      <div className={`${p.rbCard} card`}>
        {g.rebirths < unlock ? (
          <span className={p.reqLabel}>{t('legend.locked', { n: unlock })}</span>
        ) : (
          <>
            <span className={s.gainBig}>{t('legend.gain', { n: gain.total })}</span>
            <span className={p.reqLabel}>{t('legend.fromRebirths', { n: g.rebirths, stars: gain.rebirths })}</span>
            <span className={p.reqLabel}>{t('legend.fromFloors', { stars: gain.floors })}</span>
            <span className={p.rbNote}>
              {t('legend.more', { n: g.rebirths + 1, stars: starsForRebirths(g.rebirths + 1) + gain.floors })}
            </span>
          </>
        )}
        <span className={p.rbNote}>{t('legend.wipes')}</span>
        <span className={p.rbNote}>{t('legend.keeps')}</span>
      </div>
      <button className={`btn ${ready ? 'gold breathe' : 'gray'} ${p.rbGo}`} disabled={!ready} onClick={go}>
        <StarIcon size="md" />
        {ready ? (armed ? t('legend.confirm') : t('legend.go')) : t('legend.notYet')}
      </button>
      <div className={`${p.rbCard} card`} style={{ ['--gap' as string]: '0' } as CSSProperties}>
        <span className={p.cardLabel}>{t('legend.shop')}</span>
        <div className={s.shop}>
          {BAL.legend.perks.map((def) => (
            <Perk key={def.id} def={def} />
          ))}
        </div>
      </div>
    </>
  );
}
