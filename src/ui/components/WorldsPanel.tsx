/** The Worlds tab: all 20 worlds, open from the start, with a threat read-out and their payout. */
import { useMemo, type CSSProperties } from 'react';
import { DATA } from '../../data';
import { formatNumber, tutorialOver, worldRewards, worldThreat, type ThreatLevel } from '../../core';
import { useGameWhen } from '../../app/store';
import { haptics } from '../../services';
import { t } from '../i18n';
import { useWorldThumb } from '../worldThumbs';
import { useUi } from '../uiStore';
import { CheckIcon, CoinIcon, SkullIcon } from './Icons';
import { PixelArt } from './PixelArt';
import { DumpCard, GoalsCard } from './Endless';
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
      {level === 'oneShot' && <SkullIcon size={big ? 'sm' : 'xs'} />}
      {t(`worlds.threat.${level}`)}
    </span>
  );
}

/** A world's preview picture (6 px per art pixel, like the battle), faded in when it's ready. */
function Thumb({ world }: { world: number }) {
  const art = useWorldThumb(world, 'card');
  return art ? <PixelArt art={art} className={s.thumbImg} /> : <span className={s.thumbWait} />;
}

export function WorldsPanel() {
  // Redrawn when what it shows changes, not with every battle tick.
  const g = useGameWhen((x) => [x.battle.stage, x.stage, tutorialOver(x), x.equipped, x.player.level, x.upgrades, x.codex.entries.length, x.dump.bestEver, x.rebirths]);
  const here = g.battle.stage;
  const best = g.stage.highestCleared;
  // Before the first pick (a new game's raccoon waits for it), no threat ratings: at level 1 every world
  // reads as deadly (he levels up through the waves), and World 1 says where to start.
  const first = !g.stage.chosen;
  // During the tutorial he can't fall in World 1 (combat.ts): no scary rating on it.
  const safeStart = !tutorialOver(g);
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
        {/* What's next, and (past World 20) the Endless Dump above the worlds. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(3 * var(--px))', marginBottom: 'calc(4 * var(--px))' }}>
          {!first && <GoalsCard />}
          {(g.stage.highestCleared >= DATA.worlds.length - 2 || g.dump.bestEver > 0 || g.rebirths > 0) && <DumpCard />}
        </div>
        <div className={s.grid}>
          {DATA.worlds.map((w, i) => {
            const n = i + 1;
            const level = threats[i];
            const isHere = n === here;
            return (
              <button
                key={w.id}
                className={`${s.card} ${isHere ? s.cardHere : ''}`}
                data-intro={n === 1 ? 'world1' : undefined}
                style={{ ['--tc' as string]: THREAT_COLOR[level] } as CSSProperties}
                onClick={() => {
                  haptics.impact('light');
                  useUi.getState().openPopup('world', n);
                }}
              >
                <div className={s.thumb}>
                  <Thumb world={n} />
                  <span className={s.num}>{n}</span>
                  {isHere ? (
                    <span className={s.here}>{first ? t('worlds.startHere') : t('worlds.here')}</span>
                  ) : n <= best ? (
                    <CheckIcon size="md" className={s.done} />
                  ) : null}
                </div>
                <div className={s.info}>
                  <span className={s.name}>{w.name}</span>
                  <div className={s.row}>
                    {!first && !(n === 1 && safeStart) && <ThreatChip level={level} />}
                    <span className={s.gold}>
                      <CoinIcon />×{formatNumber(worldRewards(n).gold)}
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
