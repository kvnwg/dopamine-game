/**
 * The Roll tab: the reels roll on their own (Trash Bags make turbo spins). Shows luck (the only place
 * it shows, with a Luck Potion's time left), spin speed, the lucky-spin meter, the latest result with
 * its power against what is worn and its "1 in X", and the best roll ever. Equipped gear lives in the
 * Bag tab; items are equipped by dragging them up onto the raccoon.
 *
 * Layout (800 stage px below the battle, no scrolling): the machine card (a row of info, the reel bank
 * across the whole card, another row of info; Reel.tsx), the last roll and the rarest-roll line. The
 * machine is the same size for one to five reels: the reels share its width.
 */
import { useMemo, type CSSProperties } from 'react';
import { BAL, DATA, SLOTS } from '../../data';
import {
  currentLuck, drySpell, dumpsterUpgradeReady, formatDuration, formatNumber, isUpgrade, itemName, luckyEvery, rarityAtLeast, wornPower,
} from '../../core';
import { useGame } from '../../app/store';
import { rarityColor } from '../../render/art';
import { sparkleArt, UI_PX } from '../../render/icons';
import { haptics } from '../../services';
import { useNow } from '../hooks';
import { t } from '../i18n';
import { seeFeature, useFeatureView } from '../features';
import { useUi } from '../uiStore';
import { ArrowDownIcon, ArrowUpIcon, BookIcon, BoltIcon, CheckIcon, CloverIcon, ClockIcon } from './Icons';
import { enchantColor, ItemIcon } from './ItemIcon';
import { PixelArt } from './PixelArt';
import { DumpsterLock } from './DumpsterLock';
import { ReelBank } from './Reel';
import s from './alley.module.css';

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

/** Sparkles twinkling round a rare result's "1 in X" plate (positions in art pixels from its top left). */
const PLATE_SPARKLES = [
  [-4, -3],
  [24, -4],
  [27, 14],
  [-3, 16],
] as const;

/**
 * The latest result (the spin's best): it drops in as its reel lands, its power against what is worn
 * in its slot (green up, red down: the number that matters most) and its "1 in X" pop in after it.
 * Its tile is where a drag to equip starts (and the equip flight launches from).
 */
function LastRoll() {
  const last = useUi((u) => u.lastRoll);
  const inBag = useGame((g) => (last ? g.inventory.find((x) => x.uid === last.item.uid) ?? null : null));
  const upgrade = useGame((g) => (inBag ? isUpgrade(g, inBag) : false));
  const calm = useGame((g) => g.settings.reduceMotion);
  const noFlash = useGame((g) => g.settings.reduceFlashing);
  // Its power as worn by this raccoon, against what it wears in that slot (nothing worn: all of it).
  const wearing = useGame((g) => (last ? g.equipped[last.item.slot]?.uid === last.item.uid : false));
  const delta = useGame((g) => {
    if (!last) return 0;
    const it = inBag ?? last.item;
    const worn = g.equipped[it.slot];
    return wornPower(g, it) - (worn ? wornPower(g, worn) : 0);
  });
  const sparkle = useMemo(() => sparkleArt(), []);
  // A new game's first step is a world; the padlock waits for it.
  const onWorld = useGame((g) => g.stage.chosen);
  if (!last) {
    return (
      <div className={`${s.last} card`}>
        <span className={s.waiting}>{t(onWorld ? 'roll.firstRoll' : 'roll.firstWorld')}</span>
      </div>
    );
  }
  const it = inBag ?? last.item;
  const color = rarityColor(it.rarity);
  const rare = rarityAtLeast(it.rarity, 'epic');
  const open = () => useUi.getState().openPopup('itemDetail', it.uid);
  const dir = wearing ? 'worn' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'even';
  return (
    <div
      key={last.id}
      className={`${s.last} card ${s.lastIn} ${rare ? s.lastRare : ''}`}
      data-calm={calm || undefined}
      data-noflash={noFlash || undefined}
      style={{ ['--c' as string]: color } as CSSProperties}
    >
      <ItemIcon item={it} showOdds={false} draggable={!!inBag} upgrade={upgrade} downgrade={dir === 'down'} onTap={open} />
      <div className={s.lastBody} onClick={open}>
        <span className={s.lastName} style={{ color }}>
          {itemName(it)}
        </span>
        <div className={s.chips}>
          {last.placed !== 'bag' && <span className={`${s.chip} ${s[`placed_${last.placed}`]}`}>{t(`roll.placed.${last.placed}`)}</span>}
          {last.scripted === 'beginner' && <span className={`${s.chip} ${s.chipBeginner}`}>{t('reveal.beginner')}</span>}
          {last.mult > 1 && <span className={`${s.chip} ${s.chipLucky}`}>{t('reel.token', { x: formatNumber(last.mult) })}</span>}
          {last.golden && <span className={`${s.chip} ${s.chipGold}`}>{t('reel.golden')}</span>}
          {last.lucky && <span className={`${s.chip} ${s.chipLucky}`}>{t('roll.lucky')}</span>}
          {it.enchants.map((en) => (
            <span key={en.id} className={s.chip} style={{ background: enchantColor(en.id) }}>
              {enchantLabel(en.id, en.tier)}
            </span>
          ))}
        </div>
      </div>
      <div className={s.delta} data-dir={dir} onClick={open}>
        {dir === 'worn' ? (
          <span className={s.deltaWorn}>
            <CheckIcon size="sm" />
            {t('bag.equipped')}
          </span>
        ) : (
          <>
            <span className={s.deltaNum}>
              {dir === 'up' && <ArrowUpIcon size="xs" />}
              {dir === 'down' && <ArrowDownIcon size="xs" />}
              {dir === 'up' ? '+' : dir === 'down' ? '−' : '±'}
              {formatNumber(Math.abs(delta))}
            </span>
            <span className={s.deltaWord}>{t('equip.power')}</span>
          </>
        )}
      </div>
      <div className={`${s.lastOdds} ${rare ? s.lastOddsRare : ''}`} data-rarity={it.rarity}>
        <span className={s.oddsTier}>{t(`rarity.${it.rarity}`)}</span>
        <span className={s.oddsSmall}>1 in</span>
        <span className={s.oddsBig}>{fmtOdds(last.odds)}</span>
        {rare &&
          !calm &&
          PLATE_SPARKLES.map(([x, y], k) => (
            <PixelArt key={k} art={sparkle} className={s.plateSparkle} style={{ left: x * UI_PX, top: y * UI_PX, animationDelay: `${300 + k * 260}ms` }} />
          ))}
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
  const dry = useGame((g) => g.dumpster.dryStreak);
  const spell = useGame(drySpell);
  const bl = BAL.dumpster.badLuck;
  const pityOn = level >= bl.minDumpsterLevel;
  const maxed = level >= BAL.dumpster.maxLevel;
  // Green (go) only when it can be bought now; grey while it can't, so it never asks for gold he doesn't have.
  const canUpgrade = useGame(dumpsterUpgradeReady);
  // A new game shows these one at a time, as the tutorial introduces them (features.ts).
  const dumpsterView = useFeatureView('dumpster');
  const luckView = useFeatureView('luck');
  const codexView = useFeatureView('codex');
  const open = (p: 'upgrade' | 'luck' | 'codex') => {
    haptics.impact('light');
    seeFeature(p === 'upgrade' ? 'dumpster' : p);
    useUi.getState().openPopup(p);
  };

  const title = <span className={s.binTitle}>{dumpsterView === 'locked' ? t('roll.dumpsterPlain') : t('roll.dumpster', { level })}</span>;
  const upgradeBtn = dumpsterView !== 'locked' && (
    <button
      className={`btn small ${canUpgrade ? '' : 'gray'}`}
      onClick={() => open('upgrade')}
      data-intro="dumpster"
      data-new={dumpsterView === 'intro' || undefined}
    >
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
  const luckBadge = (
    <button
      className={`${s.luckBadge} ${boosted ? s.luckBoosted : ''}`}
      onClick={() => open('luck')}
      data-intro="luck"
      data-new={luckView === 'intro' || undefined}
    >
      <CloverIcon size="md" />
      <span className={s.luckNum}>×{fmtLuck(luck)}</span>
      <span className={s.luckWord}>{boosted ? formatDuration(boostLeft) : t('roll.luckLabel')}</span>
    </button>
  );
  const pity = pityOn && <span className={s.pity}>{t('roll.pity', { n: Math.max(1, spell - dry) })}</span>;
  const codex = (
    <button className={s.mini} onClick={() => open('codex')} aria-label={t('roll.codex')} data-intro="codex" data-new={codexView === 'intro' || undefined}>
      <BookIcon size="md" />
    </button>
  );

  return (
    <div className={s.panel}>
      <div className={`${s.top} card`}>
        <div className={s.wideRow}>
          {title}
          {upgradeBtn}
          <span className={s.grow} />
          {bags > 0 && dumpsterView !== 'locked' && (
            <div className={s.statLine}>
              <BoltIcon />
              <span className={s.bonusOn}>{t('roll.turbo', { n: formatNumber(bags) })}</span>
            </div>
          )}
        </div>
        <div className={s.machine}>
          <ReelBank />
          <DumpsterLock />
        </div>
        {(luckView !== 'locked' || codexView !== 'locked') && (
          <div className={s.wideRow}>
            {luckView !== 'locked' && luckBadge}
            {luckView !== 'locked' && pity}
            <span className={s.grow} />
            {luckView !== 'locked' && <LuckyMeter compact={!!pity} />}
            {codexView !== 'locked' && codex}
          </div>
        )}
      </div>
      <LastRoll />
    </div>
  );
}
