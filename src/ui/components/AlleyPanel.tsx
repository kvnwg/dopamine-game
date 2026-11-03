/**
 * The Roll tab: the reels roll on their own (Trash Bags make turbo spins). Shows luck (the only place
 * it shows, with a Luck Potion's time left), spin speed, the lucky-spin meter, the latest result with
 * its "1 in X", and the best roll ever. Equipped gear lives in the Bag tab; items are equipped by
 * dragging them up onto the raccoon.
 *
 * Layout (797 stage px below the battle): the machine card (reels and their info), the last roll
 * and the rarest-roll line, no scrolling. Up to 3 reels the info sits beside the reels; with 4 or 5
 * the reels take the full width and the info moves to a row above and a row below them.
 */
import type { CSSProperties } from 'react';
import { BAL, DATA, SLOTS } from '../../data';
import {
  currentLuck, drySpell, formatDuration, formatNumber, isUpgrade, itemName, luckyEvery, rarityAtLeast, reelCount, spinCycle,
} from '../../core';
import { useGame } from '../../app/store';
import { rarityColor } from '../../render/art';
import { haptics } from '../../services';
import { useNow } from '../hooks';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { ArrowUpIcon, BagIcon, BookIcon, BoltIcon, CloverIcon, ClockIcon, StarIcon } from './Icons';
import { enchantColor, ItemIcon } from './ItemIcon';
import { ReelBank } from './Reel';
import s from './alley.module.css';

/** Reel window heights (stage px): beside the info (up to 3 reels), and full width (4 or 5). */
const WIN_SIDE = 396;
const WIN_WIDE = 252;

export function fmtLuck(v: number): string {
  return v >= 100 ? formatNumber(v) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
}

export function fmtOdds(x: number): string {
  return x < 100000 ? x.toLocaleString('en-US') : formatNumber(x);
}

export function enchantLabel(id: string, tier: number): string {
  return `${DATA.enchantsById.get(id)?.name ?? id} ${t(`enchant.tier${tier}`)}`;
}

/** Spins until the next lucky spin, as a segmented bar; `compact` drops the words (they show only when it is next). */
function LuckyMeter({ compact }: { compact?: boolean }) {
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
      {(!compact || next) && (
        <span className={`${s.luckyText} ${next ? s.luckyReady : ''}`}>
          {next ? t('roll.luckyNext') : t('roll.luckyIn', { n: every - since })}
        </span>
      )}
    </div>
  );
}

function LastRoll() {
  const last = useUi((u) => u.lastRoll);
  const inBag = useGame((g) => (last ? g.inventory.find((x) => x.uid === last.item.uid) ?? null : null));
  const upgrade = useGame((g) => (inBag ? isUpgrade(g, inBag) : false));
  if (!last) {
    return (
      <div className={`${s.last} card`}>
        <span className={s.waiting}>{t('roll.firstRoll')}</span>
      </div>
    );
  }
  const it = inBag ?? last.item;
  const color = rarityColor(it.rarity);
  const rare = rarityAtLeast(it.rarity, 'epic');
  const open = () => useUi.getState().openPopup('itemDetail', it.uid);
  return (
    <div key={last.id} className={`${s.last} card ${s.lastIn} ${rare ? s.lastRare : ''}`} style={{ ['--c' as string]: color } as CSSProperties}>
      <ItemIcon item={it} showOdds={false} draggable={!!inBag} upgrade={upgrade} onTap={open} />
      <div className={s.lastBody} onClick={open}>
        <span className={s.lastName} style={{ color }}>
          {itemName(it)}
        </span>
        <span className={s.lastMeta}>
          {t(`rarity.${it.rarity}`)} · {t(`slot.${it.slot}`)}
        </span>
        <div className={s.chips}>
          {upgrade ? (
            <span className={`${s.chip} ${s.chipUpgrade}`}>{t('roll.dragHint')}</span>
          ) : (
            <span className={`${s.chip} ${s[`placed_${last.placed}`]}`}>{t(`roll.placed.${last.placed}`)}</span>
          )}
          {last.golden && <span className={`${s.chip} ${s.chipGold}`}>{t('reel.golden')}</span>}
          {last.lucky && <span className={`${s.chip} ${s.chipLucky}`}>{t('roll.lucky')}</span>}
          {last.newRecord && <span className={`${s.chip} ${s.chipRecord}`}>{t('roll.newRecord')}</span>}
          {it.enchants.map((en) => (
            <span key={en.id} className={s.chip} style={{ background: enchantColor(en.id) }}>
              {enchantLabel(en.id, en.tier)}
            </span>
          ))}
        </div>
      </div>
      <div className={`${s.lastOdds} ${rare ? s.lastOddsRare : ''}`} data-rarity={it.rarity}>
        <span className={s.oddsSmall}>1 in</span>
        <span className={s.oddsBig}>{fmtOdds(last.odds)}</span>
      </div>
    </div>
  );
}

/** The equipped gear, also a drop target: drop an item here (or on the raccoon) to put it on. Two rows of five. */
export function GearRow() {
  const equipped = useGame((g) => g.equipped);
  const pulse = useUi((u) => u.equipPulse);
  const drag = useUi((u) => u.drag);
  return (
    <div className={`${s.gear} ${drag ? s.gearDrop : ''}`} data-drop="equip">
      {SLOTS.map((slot) => (
        <ItemIcon
          key={pulse?.slot === slot ? `${slot}-${pulse.id}` : slot}
          item={equipped[slot]}
          slot={slot}
          className={[pulse?.slot === slot ? s.equipPop : '', drag?.item.slot === slot ? s.slotTarget : ''].join(' ')}
          onTap={() => useUi.getState().openPopup('itemDetail', equipped[slot]?.uid ?? -1)}
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
  const boostEnds = useGame((g) => g.luckBoostEndsAt);
  const boostLeft = boostEnds !== null ? Math.max(0, (boostEnds - now) / 1000) : 0;
  const boosted = boostLeft > 0;
  const cycle = useGame((g) => spinCycle(g));
  const record = useGame((g) => g.records);
  const dry = useGame((g) => g.dumpster.dryStreak);
  const spell = useGame(drySpell);
  // The reels showing: this spin's, else as many as the raccoon has.
  const reels = useGame((g) => g.roll.current?.reels.length ?? reelCount(g));
  const wide = reels >= 4;
  const bl = BAL.dumpster.badLuck;
  const pityOn = level >= bl.minDumpsterLevel;
  const maxed = level >= BAL.dumpster.maxLevel;
  const open = (p: 'upgrade' | 'luck' | 'codex') => {
    haptics.impact('light');
    useUi.getState().openPopup(p);
  };

  const title = <span className={s.binTitle}>{t('roll.dumpster', { level })}</span>;
  const upgradeBtn = (
    <button className={`btn small ${endsAt === null && !maxed ? '' : 'gray'}`} onClick={() => open('upgrade')}>
      {endsAt !== null ? (
        <>
          <ClockIcon />
          {t('roll.upgrading', { time: formatDuration((endsAt - now) / 1000) })}
        </>
      ) : maxed ? (
        t('roll.maxed')
      ) : (
        <>
          <ArrowUpIcon />
          {t('roll.upgrade')}
        </>
      )}
    </button>
  );
  const autoLine = (
    <div className={s.statLine}>
      <span className={s.autoTag}>{t('roll.auto')}</span>
      <span>{t('roll.every', { s: cycle.toFixed(1) })}</span>
    </div>
  );
  const turboLine = (
    <div className={s.statLine}>
      {bags > 0 ? <BoltIcon /> : <BagIcon />}
      <span className={bags > 0 ? s.bonusOn : s.bonusOff}>{bags > 0 ? t('roll.turbo', { n: formatNumber(bags) }) : t('roll.turboNone')}</span>
    </div>
  );
  const luckBadge = (
    <button className={`${s.luckBadge} ${boosted ? s.luckBoosted : ''}`} onClick={() => open('luck')}>
      <CloverIcon size="md" />
      <span className={s.luckNum}>×{fmtLuck(luck)}</span>
      <span className={s.luckWord}>{boosted ? formatDuration(boostLeft) : t('roll.luckLabel')}</span>
    </button>
  );
  const pity = pityOn && <span className={s.pity}>{t('roll.pity', { n: Math.max(1, spell - dry) })}</span>;
  const codex = (
    <button className={s.mini} onClick={() => open('codex')} aria-label={t('roll.codex')}>
      <BookIcon size="md" />
    </button>
  );

  return (
    <div className={s.panel}>
      {wide ? (
        <div className={`${s.top} ${s.topWide} card`}>
          <div className={s.wideRow}>
            {title}
            {upgradeBtn}
            <span className={s.grow} />
            <div className={s.statLine}>
              <span className={s.autoTag}>{t('roll.auto')}</span>
              <span>{t('roll.everyShort', { s: cycle.toFixed(1) })}</span>
            </div>
            {bags > 0 && (
              <div className={s.statLine}>
                <BoltIcon />
                <span className={s.bonusOn}>{formatNumber(bags)}</span>
              </div>
            )}
          </div>
          <ReelBank win={WIN_WIDE} wide />
          <div className={s.wideRow}>
            {luckBadge}
            {pity}
            <span className={s.grow} />
            <LuckyMeter compact />
            {codex}
          </div>
        </div>
      ) : (
        <div className={`${s.top} card`}>
          <ReelBank win={WIN_SIDE} />
          <div className={s.info}>
            <div className={s.infoHead}>
              {title}
              {upgradeBtn}
            </div>
            {autoLine}
            {turboLine}
            <LuckyMeter />
            <div className={s.luckRow}>
              {luckBadge}
              {pity}
              <span className={s.grow} />
              {codex}
            </div>
          </div>
        </div>
      )}
      <LastRoll />
      <div className={s.recordLine}>
        <StarIcon size="md" />
        <span className={s.record}>
          {record.bestRarity ? t('roll.best', { name: `${record.bestItemName} (1 in ${fmtOdds(record.bestOdds)})` }) : t('roll.bestNone')}
        </span>
      </div>
    </div>
  );
}
