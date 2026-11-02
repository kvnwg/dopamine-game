/**
 * The Roll tab: the dumpster rolls on its own (free timed rolls + Trash Bag bonus rolls).
 * Shows the roll timer, luck, the lucky-roll meter, the latest roll, recent rolls, and gear.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BAL, DATA, SLOTS } from '../../data';
import {
  currentLuck, formatDuration, formatNumber, itemName, luckyEvery, playerPower, rarityAtLeast, rollInterval,
} from '../../core';
import { getGame, useGame } from '../../app/store';
import { dumpsterArt, itemIconUrl } from '../../render/icons';
import { rarityColor } from '../../render/art';
import { haptics } from '../../services';
import { useFrame, useNow } from '../hooks';
import { t } from '../i18n';
import { useUi, type RollView } from '../uiStore';
import { ArrowUpIcon, BagIcon, BookIcon, ChartIcon, CloverIcon, ClockIcon, StarIcon } from './Icons';
import { enchantColor, ItemIcon } from './ItemIcon';
import { fmtLuck } from './StatStrip';
import s from './alley.module.css';

export function fmtOdds(x: number): string {
  return x < 10000 ? x.toLocaleString('en-US') : formatNumber(x);
}

export function enchantLabel(id: string, tier: number): string {
  return `${DATA.enchantsById.get(id)?.name ?? id} ${t(`enchant.tier${tier}`)}`;
}

/** Smooth progress toward the next free roll (the core ticks at 10/s; this interpolates per frame). */
function RollBar() {
  useFrame(true);
  const seen = useRef({ timer: 0, at: performance.now(), count: -1 });
  const g = getGame();
  if (g.roll.timer !== seen.current.timer || g.roll.count !== seen.current.count) {
    seen.current = { timer: g.roll.timer, at: performance.now(), count: g.roll.count };
  }
  const interval = rollInterval(g);
  const paused = g.offline.pending !== null;
  const est = paused ? seen.current.timer : seen.current.timer + Math.min(0.12, (performance.now() - seen.current.at) / 1000);
  const k = Math.max(0, Math.min(1, est / interval));
  return (
    <div className={s.bar}>
      <div className={s.barFill} style={{ width: `${k * 100}%` }} />
      <span className={s.barText}>{t('roll.every', { s: interval.toFixed(1) })}</span>
    </div>
  );
}

function LuckyMeter() {
  const every = useGame(luckyEvery);
  const since = useGame((g) => g.roll.sinceLucky);
  const next = since >= every - 1;
  return (
    <div className={s.lucky}>
      <div className={s.luckySegs}>
        {Array.from({ length: every }, (_, i) => (
          <span key={i} className={[s.seg, i < since ? s.segOn : '', next ? s.segReady : ''].join(' ')} />
        ))}
      </div>
      <span className={`${s.luckyText} ${next ? s.luckyReady : ''}`}>
        {next ? t('roll.luckyNext') : t('roll.luckyIn', { n: every - since })}
      </span>
    </div>
  );
}

/** The dumpster: lid hops and the rolled item pops out on every roll; shakes before big rolls. */
function Machine() {
  const last = useUi((u) => u.lastRoll);
  const charging = useUi((u) => u.charging);
  const art = dumpsterArt();
  const [pops, setPops] = useState<RollView[]>([]);
  useEffect(() => {
    if (!last) return;
    setPops((p) => [...p.slice(-3), last]);
    const id = setTimeout(() => setPops((p) => p.filter((x) => x.id !== last.id)), 900);
    return () => clearTimeout(id);
  }, [last]);
  const glow = charging ? rarityColor(charging.item.rarity) : null;
  return (
    <div className={`${s.machine} ${charging ? s.charging : ''}`} style={glow ? ({ ['--glow' as string]: glow } as CSSProperties) : undefined}>
      <div className={s.binShadow} />
      <img className={s.binBody} src={art.body} alt="" draggable={false} />
      <img key={last?.id ?? 0} className={`${s.binLid} ${last ? s.lidHop : ''}`} src={art.lid} alt="" draggable={false} />
      {pops.map((p) => (
        <img
          key={p.id}
          className={`${s.pop} ${rarityAtLeast(p.item.rarity, 'epic') ? s.popBig : ''}`}
          src={itemIconUrl(p.item.slot, p.item.rarity)}
          style={{ ['--c' as string]: rarityColor(p.item.rarity) } as CSSProperties}
          alt=""
          draggable={false}
        />
      ))}
    </div>
  );
}

function LastRoll() {
  const last = useUi((u) => u.lastRoll);
  if (!last) {
    return (
      <div className={`${s.last} card`}>
        <span className={s.waiting}>{t('roll.firstRoll')}</span>
      </div>
    );
  }
  const it = last.item;
  const color = rarityColor(it.rarity);
  const rare = rarityAtLeast(it.rarity, 'epic');
  return (
    <div
      key={last.id}
      className={`${s.last} card ${s.lastIn} ${rare ? s.lastRare : ''}`}
      style={{ ['--c' as string]: color } as CSSProperties}
      onClick={() => useUi.getState().openPopup('itemDetail', it.uid)}
    >
      <ItemIcon item={it} size={150} />
      <div className={s.lastBody}>
        <span className={s.lastName} style={{ color }}>
          {itemName(it)}
        </span>
        <span className={s.lastMeta}>
          {t(`rarity.${it.rarity}`)} · {t(`slot.${it.slot}`)} · {t('item.worldTier', { n: it.tier })}
        </span>
        <div className={s.chips}>
          <span className={`${s.chip} ${s[`placed_${last.placed}`]}`}>{t(`roll.placed.${last.placed}`)}</span>
          {last.lucky && <span className={`${s.chip} ${s.chipLucky}`}>{t('roll.lucky')}</span>}
          {last.newRecord && <span className={`${s.chip} ${s.chipRecord}`}>{t('roll.newRecord')}</span>}
          {it.enchants.map((en) => (
            <span key={en.id} className={s.chip} style={{ background: enchantColor(en.id) }}>
              {enchantLabel(en.id, en.tier)}
            </span>
          ))}
        </div>
      </div>
      <div className={s.lastOdds} style={{ background: color }}>
        <span className={s.oddsSmall}>1 in</span>
        <span className={s.oddsBig}>{fmtOdds(last.odds)}</span>
      </div>
    </div>
  );
}

function Recent() {
  const recent = useUi((u) => u.recent);
  return (
    <div className={s.recent}>
      <span className={s.recentLabel}>{t('roll.recent')}</span>
      <div className={s.recentRow}>
        {recent.slice(0, 7).map((r, i) => (
          <ItemIcon
            key={r.id}
            item={r.item}
            size={108}
            className={`${i === 0 ? s.slideIn : ''} ${r.placed === 'scrapped' ? s.scrapped : ''}`}
            onClick={r.placed !== 'scrapped' ? () => useUi.getState().openPopup('itemDetail', r.item.uid) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export function GearRow({ size = 94 }: { size?: number }) {
  const equipped = useGame((g) => g.equipped);
  const pulse = useUi((u) => u.equipPulse);
  return (
    <div className={s.gear}>
      {SLOTS.map((slot) => (
        <ItemIcon
          key={pulse?.slot === slot ? `${slot}-${pulse.id}` : slot}
          item={equipped[slot]}
          slot={slot}
          size={size}
          className={pulse?.slot === slot ? s.equipPop : ''}
          onClick={() => useUi.getState().openPopup('itemDetail', equipped[slot]?.uid ?? -1)}
        />
      ))}
    </div>
  );
}

export function AlleyPanel() {
  const now = useNow(500);
  const level = useGame((g) => g.dumpster.level);
  const endsAt = useGame((g) => g.dumpster.upgradeEndsAt);
  const bags = useGame((g) => Math.floor(g.currencies.bags));
  const luck = useGame((g) => currentLuck(g, now));
  const boosted = useGame((g) => g.luckBoostEndsAt !== null && g.luckBoostEndsAt > now);
  const power = useGame(playerPower);
  const record = useGame((g) => g.records);
  const dry = useGame((g) => g.dumpster.dryStreak);
  const bl = BAL.dumpster.badLuck;
  const pityOn = level >= bl.minDumpsterLevel;
  const maxed = level >= BAL.dumpster.maxLevel;
  const open = (p: 'upgrade' | 'luck' | 'codex') => {
    haptics.impact('light');
    useUi.getState().openPopup(p);
  };
  return (
    <div className={s.panel}>
      <div className={`${s.top} card`}>
        <Machine />
        <button className={`${s.luckBadge} ${boosted ? s.luckBoosted : ''}`} onClick={() => open('luck')}>
          <CloverIcon size={64} />
          <span className={s.luckNum}>×{fmtLuck(luck)}</span>
          <span className={s.luckWord}>{t('roll.luckLabel')}</span>
        </button>
        <div className={s.info}>
          <div className={s.infoHead}>
            <span className={s.binTitle}>{t('roll.dumpster', { level })}</span>
            <button className={`btn small ${endsAt === null && !maxed ? '' : 'gray'}`} onClick={() => open('upgrade')}>
              {endsAt !== null ? (
                <>
                  <ClockIcon size={40} />
                  {t('roll.upgrading', { time: formatDuration((endsAt - now) / 1000) })}
                </>
              ) : maxed ? (
                t('roll.maxed')
              ) : (
                <>
                  <ArrowUpIcon size={40} />
                  {t('roll.upgrade')}
                </>
              )}
            </button>
          </div>
          <div className={s.autoRow}>
            <span className={s.autoTag}>{t('roll.auto')}</span>
            <RollBar />
          </div>
          <div className={s.bonusRow}>
            <BagIcon size={50} />
            <span className={bags > 0 ? s.bonusOn : s.bonusOff}>{bags > 0 ? t('roll.bonus', { n: formatNumber(bags) }) : t('roll.bonusNone')}</span>
            <span style={{ flex: 1 }} />
            {pityOn && <span className={s.pity}>{t('roll.pity', { n: Math.max(1, bl.drySpell - dry) })}</span>}
          </div>
          <LuckyMeter />
        </div>
        <div className={s.miniBtns}>
          <button className={s.mini} onClick={() => open('luck')} aria-label={t('roll.odds')}>
            <ChartIcon size={50} />
          </button>
          <button className={s.mini} onClick={() => open('codex')} aria-label={t('roll.codex')}>
            <BookIcon size={50} />
          </button>
        </div>
      </div>
      <LastRoll />
      <Recent />
      <div className={s.gearBox}>
        <div className={s.gearHead}>
          <span>{t('roll.gear')}</span>
          <span className={s.gearPower}>{t('gear.power', { power: formatNumber(power) })}</span>
          <span style={{ flex: 1 }} />
          <span className={s.record}>
            <StarIcon size={34} />
            {record.bestRarity
              ? t('roll.best', { name: `${record.bestItemName} (1 in ${fmtOdds(record.bestOdds)})` })
              : t('roll.bestNone')}
          </span>
        </div>
        <GearRow />
      </div>
    </div>
  );
}
