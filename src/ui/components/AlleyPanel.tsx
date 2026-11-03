/**
 * The Roll tab: the reels roll on their own (Trash Bags make turbo spins). Shows luck, spin speed,
 * the lucky-spin meter, the latest result with its "1 in X", and equipped gear.
 * Items are equipped by dragging them onto the raccoon.
 */
import type { CSSProperties } from 'react';
import { BAL, DATA, SLOTS } from '../../data';
import {
  currentLuck, drySpell, formatDuration, formatNumber, isUpgrade, itemName, luckyEvery, playerPower, rarityAtLeast, spinCycle,
} from '../../core';
import { useGame } from '../../app/store';
import { rarityColor } from '../../render/art';
import { haptics } from '../../services';
import { useNow } from '../hooks';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { ArrowUpIcon, BagIcon, BookIcon, BoltIcon, CloverIcon, ClockIcon, StarIcon } from './Icons';
import { EquipBestButton } from './EquipBest';
import { enchantColor, ItemIcon } from './ItemIcon';
import { fmtLuck } from './StatStrip';
import { ReelBank } from './Reel';
import s from './alley.module.css';

export function fmtOdds(x: number): string {
  return x < 100000 ? x.toLocaleString('en-US') : formatNumber(x);
}

export function enchantLabel(id: string, tier: number): string {
  return `${DATA.enchantsById.get(id)?.name ?? id} ${t(`enchant.tier${tier}`)}`;
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
      <ItemIcon item={it} size={128} showOdds={false} draggable={!!inBag} upgrade={upgrade} onTap={open} />
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

/** The equipped gear, also a drop target: drop an item here (or on the raccoon) to put it on. */
export function GearRow({ size = 86 }: { size?: number }) {
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
          size={size}
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
  const boosted = useGame((g) => g.luckBoostEndsAt !== null && g.luckBoostEndsAt > now);
  const cycle = useGame((g) => spinCycle(g));
  const power = useGame(playerPower);
  const record = useGame((g) => g.records);
  const dry = useGame((g) => g.dumpster.dryStreak);
  const spell = useGame(drySpell);
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
        <ReelBank />
        <div className={s.info}>
          <div className={s.infoHead}>
            <span className={s.binTitle}>{t('roll.dumpster', { level })}</span>
            <button className={`btn small ${endsAt === null && !maxed ? '' : 'gray'}`} onClick={() => open('upgrade')}>
              {endsAt !== null ? (
                <>
                  <ClockIcon size={38} />
                  {t('roll.upgrading', { time: formatDuration((endsAt - now) / 1000) })}
                </>
              ) : maxed ? (
                t('roll.maxed')
              ) : (
                <>
                  <ArrowUpIcon size={38} />
                  {t('roll.upgrade')}
                </>
              )}
            </button>
          </div>
          <div className={s.statLine}>
            <span className={s.autoTag}>{t('roll.auto')}</span>
            <span>{t('roll.every', { s: cycle.toFixed(1) })}</span>
          </div>
          <div className={s.statLine}>
            {bags > 0 ? <BoltIcon size={42} /> : <BagIcon size={42} />}
            <span className={bags > 0 ? s.bonusOn : s.bonusOff}>{bags > 0 ? t('roll.turbo', { n: formatNumber(bags) }) : t('roll.turboNone')}</span>
          </div>
          <LuckyMeter />
          <div className={s.luckRow}>
            <button className={`${s.luckBadge} ${boosted ? s.luckBoosted : ''}`} onClick={() => open('luck')}>
              <CloverIcon size={54} />
              <span className={s.luckNum}>×{fmtLuck(luck)}</span>
              <span className={s.luckWord}>{t('roll.luckLabel')}</span>
            </button>
            {pityOn && <span className={s.pity}>{t('roll.pity', { n: Math.max(1, spell - dry) })}</span>}
            <span style={{ flex: 1 }} />
            <button className={s.mini} onClick={() => open('codex')} aria-label={t('roll.codex')}>
              <BookIcon size={44} />
            </button>
          </div>
        </div>
      </div>
      <LastRoll />
      <div className={s.gearBox}>
        <div className={s.gearHead}>
          <span>{t('roll.gear')}</span>
          <span className={s.gearPower}>{t('gear.power', { power: formatNumber(power) })}</span>
          <EquipBestButton className={s.equipBest} />
          <span style={{ flex: 1 }} />
          <span className={s.record}>
            <StarIcon size={30} />
            {record.bestRarity ? t('roll.best', { name: `${record.bestItemName} (1 in ${fmtOdds(record.bestOdds)})` }) : t('roll.bestNone')}
          </span>
        </div>
        <GearRow />
      </div>
    </div>
  );
}
