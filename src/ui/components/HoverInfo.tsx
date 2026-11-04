/**
 * Hover info (PC): with a mouse, resting the pointer on a piece of gear (a bag tile, a worn slot, a
 * find) shows a small card over it, what it is, its power and what wearing it would do, without
 * opening anything. Touch screens never see it (a tap opens the item's card instead).
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { SLOTS } from '../../data';
import { formatNumber, gearPowerMult, itemName, itemOddsOneIn, type GameState, type Item } from '../../core';
import { getGame } from '../../app/store';
import { rarityColor } from '../../render/art';
import { stagePoint } from '../drag';
import { t } from '../i18n';
import { MOUSE } from '../pointer';
import { stageSize, useUi } from '../uiStore';
import { fmtOdds } from './AlleyPanel';
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, PowerIcon } from './Icons';
import s from './hoverInfo.module.css';

/** How long the pointer rests on a tile before its card shows (ms). */
const DELAY_MS = 260;
/** Room kept between the card and the tile, and the stage's edges (stage px). */
const GAP = 12;

function findItem(g: GameState, uid: number): { item: Item; worn: boolean } | null {
  for (const slot of SLOTS) if (g.equipped[slot]?.uid === uid) return { item: g.equipped[slot]!, worn: true };
  const item = g.inventory.find((x) => x.uid === uid);
  return item ? { item, worn: false } : null;
}

interface Shown {
  el: HTMLElement;
  uid: number;
}

export function HoverInfo() {
  const [shown, setShown] = useState<Shown | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!MOUSE) return;
    let timer = 0;
    let over: HTMLElement | null = null;
    const hide = () => {
      window.clearTimeout(timer);
      over = null;
      setShown(null);
    };
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const el = (e.target as Element | null)?.closest?.('[data-uid]') as HTMLElement | null;
      if (el === over) return;
      window.clearTimeout(timer);
      over = el;
      setShown(null);
      if (!el) return;
      timer = window.setTimeout(() => {
        if (over !== el || !el.isConnected || useUi.getState().drag) return;
        setShown({ el, uid: Number(el.dataset.uid) });
      }, DELAY_MS);
    };
    // A press (a click or the start of a drag), the wheel or a key: the card gets out of the way.
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('wheel', hide, { capture: true, passive: true });
    document.addEventListener('keydown', hide, true);
    // A tile can vanish under a still pointer (a tab switch, an equip): no pointer event says so.
    const check = window.setInterval(() => {
      if (over && !over.isConnected) hide();
    }, 250);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(check);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('wheel', hide, true);
      document.removeEventListener('keydown', hide, true);
    };
  }, []);

  const found = shown ? findItem(getGame(), shown.uid) : null;

  // Over the tile (or under it, near the top), centred on it, inside the stage.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !shown) return;
    const r = shown.el.getBoundingClientRect();
    const a = stagePoint(r.left, r.top);
    const b = stagePoint(r.right, r.bottom);
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const stage = stageSize();
    const x = Math.min(stage.w - w - GAP, Math.max(GAP, (a.x + b.x) / 2 - w / 2));
    const y = a.y - h - GAP >= GAP ? a.y - h - GAP : Math.min(stage.h - h - GAP, b.y + GAP);
    card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }, [shown, found]);

  if (!shown || !found) return null;
  const g = getGame();
  const { item, worn } = found;
  const mult = gearPowerMult(g);
  const power = (it: Item) => Math.round(it.power * mult);
  const cur = g.equipped[item.slot];
  const diff = worn ? 0 : power(item) - (cur ? power(cur) : 0);
  return (
    <div ref={cardRef} className={s.card} style={{ ['--c' as string]: rarityColor(item.rarity) } as CSSProperties} role="tooltip">
      <span className={s.name}>{itemName(item)}</span>
      <span className={s.meta}>
        {t(`rarity.${item.rarity}`)} · 1 in {fmtOdds(itemOddsOneIn(item))} · {t(`slot.${item.slot}`)}
      </span>
      <span className={s.power}>
        <PowerIcon size="sm" />
        {formatNumber(power(item))}
      </span>
      {worn ? (
        <span className={s.line}>
          <CheckIcon size="xs" />
          {t('hover.wearing')}
        </span>
      ) : diff > 0 ? (
        <span className={`${s.line} ${s.up}`}>
          <ArrowUpIcon size="xs" />
          {t('hover.better', { n: formatNumber(diff) })}
        </span>
      ) : diff < 0 ? (
        <span className={`${s.line} ${s.down}`}>
          <ArrowDownIcon size="xs" />
          {t('hover.worse', { n: `-${formatNumber(-diff)}` })}
        </span>
      ) : (
        <span className={s.line}>{t('hover.same')}</span>
      )}
      {!worn && <span className={s.hint}>{t('hover.hint')}</span>}
    </div>
  );
}
