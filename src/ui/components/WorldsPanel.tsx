/** The Worlds tab: all 20 worlds, open from the start, with a threat read-out and their payout. */
import { useMemo, type CSSProperties } from 'react';
import { DATA } from '../../data';
import { formatNumber, worldRewards, worldThreat, type ThreatLevel } from '../../core';
import { useGame } from '../../app/store';
import { worldThumbUrl } from '../../render/worldLook';
import { haptics } from '../../services';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { CheckIcon, CoinIcon, SkullIcon } from './Icons';
import s from './worlds.module.css';

export const THREAT_COLOR: Record<ThreatLevel, string> = {
  easy: '#5bc236',
  tough: '#ffc233',
  deadly: '#ff7043',
  oneShot: '#d32f2f',
};

export function ThreatChip({ level, big }: { level: ThreatLevel; big?: boolean }) {
  return (
    <span className={`${s.threat} ${big ? s.threatBig : ''} ${level === 'oneShot' ? s.threatOneShot : ''}`} style={{ background: THREAT_COLOR[level] }}>
      {level === 'oneShot' && <SkullIcon size={big ? 44 : 30} />}
      {t(`worlds.threat.${level}`)}
    </span>
  );
}

export function WorldsPanel() {
  const g = useGame((x) => x);
  const here = g.battle.stage;
  const best = g.stage.highestCleared;
  const threats = useMemo(
    () => DATA.worlds.map((_, i) => worldThreat(g, i + 1).level),
    // Threat only depends on the raccoon's stats.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [g.equipped, g.player.level, g.upgrades, g.codex.entries.length],
  );
  return (
    <div className={s.panel}>
      <div className={s.head}>
        <span className={s.title}>{t('worlds.title')}</span>
        <span className={s.best}>{best > 0 ? t('worlds.best', { n: best }) : t('worlds.bestNone')}</span>
      </div>
      <p className={s.sub}>{t('worlds.sub')}</p>
      <div className={s.scroll}>
        <div className={s.grid}>
          {DATA.worlds.map((w, i) => {
            const n = i + 1;
            const level = threats[i];
            const isHere = n === here;
            return (
              <button
                key={w.id}
                className={`${s.card} ${isHere ? s.cardHere : ''}`}
                style={{ ['--tc' as string]: THREAT_COLOR[level] } as CSSProperties}
                onClick={() => {
                  haptics.impact('light');
                  useUi.getState().openPopup('world', n);
                }}
              >
                <div className={s.thumb}>
                  <img src={worldThumbUrl(n)} alt="" draggable={false} loading="lazy" />
                  <span className={s.num}>{n}</span>
                  {isHere ? (
                    <span className={s.here}>{t('worlds.here')}</span>
                  ) : n <= best ? (
                    <CheckIcon size={52} className={s.done} />
                  ) : null}
                </div>
                <div className={s.info}>
                  <span className={s.name}>{w.name}</span>
                  <div className={s.row}>
                    <ThreatChip level={level} />
                    <span className={s.gold}>
                      <CoinIcon size={32} />×{formatNumber(worldRewards(n).gold)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
