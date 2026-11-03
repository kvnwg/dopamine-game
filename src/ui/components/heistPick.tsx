/**
 * A heist decision, as a card in place of the run's log: a perk pick (three cards framed by rarity, an
 * evolution glowing gold; reroll free once with an ad, then for gems), a choice event (its text and two
 * or three options), a shop (stock with prices, and Leave), the Jackpot Wheel (a reel that spins and
 * lands on what core gave) and a shrine (accept or walk away).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { create } from 'zustand';
import { BAL } from '../../data';
import { formatNumber, heistOptionAvailable, optionPreview, rerollCost, wheelOdds } from '../../core';
import { getGame, useGame } from '../../app/store';
import { ads, haptics } from '../../services';
import { audio } from '../../services/audio';
import { uiBitArt, uiIcon, UI_PX } from '../../render/icons';
import { t } from '../i18n';
import { Chunky } from './Chunky';
import { CoinIcon, GemIcon, TvIcon } from './Icons';
import { PixelArt } from './PixelArt';
import {
  Ico, NodeIcon, RARITY_COLOR, SHRINE_HP_PCT, TAG_COLOR, TAG_ICON, WHEEL, eventInfo, heistDispatch, perkInfo, stockInfo,
  wheelIcon, wheelLabel, type HeistPending, type HeistRun,
} from './heistShared';
import s from './heist.module.css';

type Pending<K extends HeistPending['kind']> = Extract<HeistPending, { kind: K }>;

// ------------------------------------------------------------------ perks

function PerkCard({ id, evolution, index }: { id: string; evolution: boolean; index: number }) {
  const p = perkInfo(id);
  const evo = evolution || p.evolution;
  const rarity = evo ? 'evolution' : p.rarity;
  return (
    <button
      className={s.perkCard}
      data-rarity={rarity}
      style={{ ['--rc' as string]: RARITY_COLOR[rarity], ['--tc' as string]: TAG_COLOR[p.tag], animationDelay: `${index * 70}ms` } as CSSProperties}
      onClick={() => {
        haptics.impact(evo ? 'heavy' : 'medium');
        heistDispatch({ type: 'heistChoose', index });
      }}
    >
      {evo && <span className={s.evoBadge}>{t('heistUi.evolution')}</span>}
      <span className={s.perkArt}>
        <Ico name={TAG_ICON[p.tag]} size="nav" />
      </span>
      <span className={s.perkName}>{p.name}</span>
      <span className={s.perkTags}>
        <i className={s.tagChip} style={{ ['--tc' as string]: TAG_COLOR[p.tag] } as CSSProperties}>{t(`heist.tag.${p.tag}`)}</i>
        <i className={s.tagChip} style={{ ['--tc' as string]: RARITY_COLOR[rarity] } as CSSProperties}>{t(`heist.rarity.${rarity}`)}</i>
      </span>
      <span className={s.perkText}>{p.text}</span>
    </button>
  );
}

function PerkPick({ run, pending }: { run: HeistRun; pending: Pending<'perk'> }) {
  const gems = useGame((g) => g.currencies.gems);
  const cost = rerollCost(run);
  const free = cost === 0;
  const reroll = async () => {
    if (free) {
      const r = await ads.showRewarded('perk_reroll');
      if (!r.rewarded) return;
    } else if (gems < cost) return;
    haptics.impact('light');
    heistDispatch({ type: 'heistReroll' });
  };
  // A new set of options deals in again.
  const key = pending.options.map((o) => o.id).join(',');
  return (
    <div className={s.decide}>
      <div className={s.decideHead}>
        <Chunky
          text={pending.source === 'shrine' ? t('heistUi.perkShrine') : pending.source === 'wheel' ? t('heistUi.perkWheel') : t('heistUi.levelUp', { n: run.level })}
          size={50}
          grad={pending.source === 'shrine' ? 'purple' : 'gold'}
        />
        <span className={s.decideSub}>{t('heistUi.pickPerk', { n: run.perks.length, max: BAL.heist.maxPerks })}</span>
        <span className={s.grow} />
        <button className={`btn small ${free ? 'blue' : 'gold'} ${s.rerollBtn}`} disabled={!free && gems < cost} onClick={reroll}>
          {free ? <TvIcon /> : null}
          {free ? t('heistUi.rerollFree') : t('heistUi.reroll')}
          {!free && (
            <span className={s.price}>
              <GemIcon size="sm" />
              {cost}
            </span>
          )}
        </button>
      </div>
      <div className={s.perkCards} key={key}>
        {pending.options.map((o, i) => (
          <PerkCard key={`${o.id}:${i}`} id={o.id} evolution={!!o.evolution} index={i} />
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ choice events

/** What an option can lead to, as short lines ("60%: Lucky Penny"). */
function preview(eventId: string, index: number): string {
  return optionPreview(eventId, index)
    .map((o) => (o.chance !== undefined && o.chance < 1 ? `${Math.round(o.chance * 100)}%: ${t(o.key, o.params)}` : t(o.key, o.params)))
    .join(' · ');
}

function ChoicePick({ run, pending }: { run: HeistRun; pending: Pending<'choice'> }) {
  const ev = eventInfo(pending.eventId, pending.options);
  return (
    <div className={s.decide}>
      <div className={s.choiceText}>
        <NodeIcon kind="choice" size="nav" className={s.choiceArt} />
        <p>{ev.text}</p>
      </div>
      <div className={s.choiceOptions}>
        {ev.options.map((label, i) => (
          <button
            key={i}
            className={`btn ${i === 0 ? 'blue' : i === 1 ? '' : 'gold'} ${s.optionBtn}`}
            style={{ animationDelay: `${i * 70}ms` }}
            disabled={!heistOptionAvailable(run, i)}
            onClick={() => {
              haptics.impact('medium');
              heistDispatch({ type: 'heistChoose', index: i });
            }}
          >
            <span className={s.optionLabel}>{label}</span>
            <span className={s.optionHint}>{preview(pending.eventId, i)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ shop

function Shop({ run, pending }: { run: HeistRun; pending: Pending<'shop'> }) {
  return (
    <div className={s.decide}>
      <div className={s.decideHead}>
        <NodeIcon kind="shop" size="md" />
        <span className={s.decideTitle}>{t('heistUi.shopTitle')}</span>
        <span className={s.grow} />
        <span className={s.runCoins}>
          <CoinIcon size="md" />
          {formatNumber(run.coins)}
        </span>
        <button
          className={`btn gray small ${s.leaveBtn}`}
          onClick={() => {
            haptics.impact('light');
            heistDispatch({ type: 'heistLeaveShop' });
          }}
        >
          {t('heistUi.leave')}
        </button>
      </div>
      <div className={s.stock}>
        {pending.stock.map((item, i) => {
          const info = stockInfo(item);
          const broke = !item.sold && run.coins < item.price;
          return (
            <button
              key={`${item.id}:${i}`}
              className={s.stockItem}
              data-sold={item.sold || undefined}
              data-broke={broke || undefined}
              disabled={item.sold || broke}
              style={info.tag ? ({ ['--tc' as string]: TAG_COLOR[info.tag] } as CSSProperties) : undefined}
              onClick={() => {
                haptics.impact('medium');
                audio.coin();
                heistDispatch({ type: 'heistChoose', index: i });
              }}
            >
              <span className={s.stockArt}>
                <Ico name={info.icon} size="md" />
              </span>
              <span className={s.stockName}>{info.name}</span>
              <span className={s.stockText}>{info.text}</span>
              <span className={s.stockPrice}>
                <CoinIcon size="sm" />
                {formatNumber(item.price)}
              </span>
              {item.sold && <span className={s.soldStamp}>{t('heistUi.sold')}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the Jackpot Wheel

/** A spin in progress (it outlives the pending wheel: core has already paid out when it starts). */
interface Spin {
  id: number;
  /** The segment it lands on (balance.heist.wheel). */
  index: number;
  t0: number;
}
export const useWheelSpin = create<{ spin: Spin | null }>(() => ({ spin: null }));
let spinId = 1;

/** Reel cells are 22 art pixels: a 16 x 16 prize and its amount. */
const CELL = 22 * UI_PX;
const SPIN_MS = 2400;
/** Whole turns of the segments the reel passes before it lands. */
const SPIN_LOOPS = 4;
const SEG_PCT = wheelOdds().map((w) => Math.round(w.chance * 100));

export function Wheel({ spin }: { spin: Spin | null }) {
  const strip = useRef<HTMLDivElement>(null);
  const [landed, setLanded] = useState(false);
  const n = WHEEL.length;
  const target = spin ? SPIN_LOOPS * n + spin.index : 0;
  // Up to the cell it lands on, and one more under the window.
  const cells = Math.max(target, n) + 2;

  useEffect(() => {
    if (!spin) {
      // Back to the first segment for the next wheel.
      setLanded(false);
      if (strip.current) strip.current.style.transform = '';
      return;
    }
    let raf = 0;
    let last = -1;
    const calm = getGame().settings.reduceMotion;
    const ms = calm ? 300 : SPIN_MS;
    const frame = () => {
      const k = Math.min(1, (performance.now() - spin.t0) / ms);
      // Fast, then easing out onto the prize: a tick as each cell passes, the strip on whole art pixels.
      const pos = target * (1 - Math.pow(1 - k, 3));
      const cell = Math.floor(pos);
      if (cell !== last) {
        last = cell;
        if (k < 1) audio.wheelTick(1 - k);
      }
      if (strip.current) strip.current.style.transform = `translate3d(0, ${-Math.round((pos * CELL) / UI_PX) * UI_PX}px, 0)`;
      if (k < 1) raf = requestAnimationFrame(frame);
      else {
        audio.wheelStop();
        haptics.impact('heavy');
        setLanded(true);
      }
    };
    raf = requestAnimationFrame(frame);
    // The prize stays up a moment before the run moves on.
    const done = setTimeout(() => useWheelSpin.setState({ spin: null }), ms + 2000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [spin, target]);

  const go = () => {
    haptics.impact('medium');
    const events = heistDispatch({ type: 'heistChoose', index: 0 });
    const hit = events.find((e) => e.type === 'heistWheel');
    if (!hit || hit.type !== 'heistWheel') return;
    setLanded(false);
    useWheelSpin.setState({ spin: { id: spinId++, index: hit.index, t0: performance.now() } });
  };

  return (
    <div className={s.decide}>
      <div className={s.decideHead}>
        <NodeIcon kind="wheel" size="md" />
        <span className={s.decideTitle}>{t('heistUi.wheelTitle')}</span>
        <span className={s.grow} />
        <span className={s.decideSub}>{spin ? (landed ? t('heistUi.wheelWon') : t('heistUi.spinning')) : t('heistUi.wheelHint')}</span>
      </div>
      <div className={s.wheelBody}>
        <div className={s.reelWindow} data-landed={landed || undefined}>
          <div className={s.reelStrip} ref={strip}>
            {Array.from({ length: cells }, (_, i) => {
              const seg = WHEEL[i % n];
              return (
                <span key={i} className={s.reelCell} style={{ top: i * CELL }}>
                  <PixelArt art={uiIcon(wheelIcon(seg.kind), 'nav')} />
                  <b>{t(`heistUi.wheelShort.${seg.kind}`, { n: seg.value })}</b>
                </span>
              );
            })}
          </div>
          <PixelArt art={uiBitArt('paylineL')} className={s.reelArrowL} />
          <PixelArt art={uiBitArt('paylineL', true)} className={s.reelArrowR} />
        </div>
        <div className={s.wheelSide}>
          <div className={s.odds}>
            {WHEEL.map((seg, i) => (
              <span key={i} className={s.oddsRow} data-hit={(landed && spin?.index === i) || undefined}>
                <Ico name={wheelIcon(seg.kind)} size="sm" />
                <span className={s.oddsLabel}>{wheelLabel(seg)}</span>
                <i>{SEG_PCT[i]}%</i>
              </span>
            ))}
          </div>
          <button className={`btn gold ${spin ? '' : 'breathe'} ${s.spinBtn}`} disabled={!!spin} onClick={go}>
            {t('heistUi.spin')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ shrine

function Shrine({ run }: { run: HeistRun }) {
  const cost = Math.round((run.maxHp * SHRINE_HP_PCT) / 100);
  return (
    <div className={s.decide}>
      <div className={s.shrineBody}>
        <NodeIcon kind="shrine" size="nav" className={s.shrineArt} />
        <div className={s.shrineText}>
          <span className={s.decideTitle}>{t('heistUi.shrineTitle')}</span>
          <p>{t('heistUi.shrineText', { pct: SHRINE_HP_PCT, hp: formatNumber(cost) })}</p>
        </div>
      </div>
      <div className={s.shrineBtns}>
        <button
          className={`btn ${s.shrineYes}`}
          onClick={() => {
            haptics.impact('heavy');
            heistDispatch({ type: 'heistChoose', index: 0 });
          }}
        >
          {t('heistUi.shrineAccept', { hp: formatNumber(cost) })}
        </button>
        <button
          className="btn gray"
          onClick={() => {
            haptics.impact('light');
            heistDispatch({ type: 'heistChoose', index: 1 });
          }}
        >
          {t('heistUi.shrineDecline')}
        </button>
      </div>
    </div>
  );
}

/** The decision a run waits on (or the wheel still spinning after it was made). */
export function HeistDecision({ run }: { run: HeistRun }) {
  const spin = useWheelSpin((w) => w.spin);
  if (spin) return <Wheel spin={spin} />;
  const p = run.pending;
  if (!p) return null;
  switch (p.kind) {
    case 'perk':
      return <PerkPick run={run} pending={p} />;
    case 'choice':
      return <ChoicePick run={run} pending={p} />;
    case 'shop':
      return <Shop run={run} pending={p} />;
    case 'wheel':
      return <Wheel spin={null} />;
    case 'shrine':
      return <Shrine run={run} />;
  }
}
