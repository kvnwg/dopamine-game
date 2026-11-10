/**
 * A new game's first upgrades, on the Roll tab: one card with the cheapest upgrade open to buy, a bar
 * filling toward its price, and one Buy button. It shows once the raccoon is dressed (the tutorial's
 * Equip best step done, so it never competes with that ask) until the tutorial ends (then the Upgrades
 * screen opens with what was bought here: core/systems/features.ts), so the first gold has somewhere to
 * go within the first minute without the whole honeycomb map in the way. The tutorial points at its
 * button when the price is in (TutorialLayer.tsx). (Only during the tutorial: after it the Roll tab's
 * luck row takes this card's room.)
 */
import type { CSSProperties } from 'react';
import { BAL } from '../../data';
import { cheapestUpgrade, formatNumber, tutorialOver, upgradeDef, upgradeLevel } from '../../core';
import { dispatch, getGame, useGame } from '../../app/store';
import { uiIcon } from '../../render/icons';
import { haptics } from '../../services';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { CoinIcon } from './Icons';
import { PixelArt } from './PixelArt';
import { effectAt, roman, upgradeIcon } from './UpgradeMap';
import s from './alley.module.css';

/** Whether the card shows: the tutorial still running, the raccoon dressed, the Upgrades screen not open yet. */
export function firstBuyOpen(g: ReturnType<typeof getGame>): boolean {
  const dressed = g.lifetime.itemsEquipped >= BAL.tutorial.beginnerAfterEquips;
  return !tutorialOver(g) && dressed && !g.features.unlocked.includes('upgrades') && cheapestUpgrade(g) !== null;
}

/** The upgrade on offer as `id:price` (null when the card is away), and whether the gold is in. */
export function firstBuyOffer(g: ReturnType<typeof getGame>): { id: string; price: number; afford: boolean } | null {
  if (!firstBuyOpen(g)) return null;
  const c = cheapestUpgrade(g)!;
  return { id: c.def.id, price: c.price, afford: g.currencies.coins >= c.price };
}

/** "Luck I": the next tier of line `id`. */
export function firstBuyName(id: string): string {
  const def = upgradeDef(id);
  const name = t(`upgrade.${id}`);
  if (!def || def.max <= 1) return name;
  return t('upgrades.nodeName', { name, tier: roman(upgradeLevel(getGame(), id) + 1) });
}

export function FirstBuy() {
  // (As strings and whole numbers, so it redraws when what it shows changes, not ten times a second.)
  const key = useGame((g) => {
    const o = firstBuyOffer(g);
    return o ? `${o.id}:${o.price}` : '';
  });
  const first = useGame((g) => Object.keys(g.upgrades).length === 0);
  const [id, priceText] = key.split(':');
  const price = Number(priceText);
  const have = useGame((g) => (key ? Math.min(price, Math.floor(g.currencies.coins)) : 0));
  if (!key) return null;
  const def = upgradeDef(id)!;
  const afford = have >= price;
  const g = getGame();
  const name = firstBuyName(id);
  const fx = effectAt(g, def, upgradeLevel(g, id) + 1);
  // The bar fills in whole art pixels (60 across).
  const fill = Math.round((have / price) * 60);
  const buy = () => {
    if (!afford) {
      haptics.impact('light');
      return;
    }
    haptics.impact('medium');
    dispatch({ type: 'buyUpgrade', id });
    useUi.getState().toast(t('toast.firstBuy', { name, fx }), 'good');
  };
  return (
    <div className={`${s.firstBuy} card ${afford ? s.firstBuyReady : ''}`}>
      <span className={s.firstBuyTile}>
        <PixelArt art={uiIcon(upgradeIcon(id), 'nav')} />
      </span>
      <div className={s.firstBuyBody}>
        <span className={s.firstBuyLabel}>{t(first ? 'firstBuy.first' : 'firstBuy.next')}</span>
        <span className={s.firstBuyName}>
          {name} <em>{fx}</em>
        </span>
        <span className={s.firstBuyBar} aria-hidden>
          <span className={s.firstBuyFill} style={{ ['--fill' as string]: fill } as CSSProperties} />
          <span className={s.firstBuyCount}>
            {formatNumber(have)} / {formatNumber(price)}
          </span>
        </span>
      </div>
      <button className={`btn ${afford ? 'breathe' : 'gray'} ${s.firstBuyBtn}`} onClick={buy} aria-disabled={!afford || undefined} data-intro="firstBuy">
        <span className={s.firstBuyWord}>{t('firstBuy.buy')}</span>
        <span className={s.firstBuyPrice}>
          <CoinIcon />
          {formatNumber(price)}
        </span>
      </button>
    </div>
  );
}
