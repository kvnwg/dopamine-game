/**
 * Scrap All with upgrades in the bag asks first (Kevin: "when u try to scrap all and u have an item
 * that's an upgrade, make sure to ask the player first"): keep the upgrades and scrap the rest (the
 * easy, green choice), or scrap everything unlocked anyway.
 */
import { formatNumber, isUpgrade, scrapValue } from '../../core';
import { dispatch, useGame } from '../../app/store';
import { haptics } from '../../services';
import { t } from '../i18n';
import { CoinIcon } from '../components/Icons';
import { Modal } from './Modal';
import s from './popups.module.css';

export function ScrapAllPopup({ onClose }: { onClose: () => void }) {
  const g = useGame((x) => x);
  const unlocked = g.inventory.filter((it) => !it.locked);
  const ups = unlocked.filter((it) => isUpgrade(g, it));
  const rest = unlocked.filter((it) => !isUpgrade(g, it));
  const gold = (list: typeof unlocked) => list.reduce((n, it) => n + scrapValue(g, it).coins, 0);
  const scrap = (keepUpgrades: boolean) => {
    haptics.impact('heavy');
    if (!keepUpgrades || rest.length > 0) dispatch({ type: 'scrapAll', keepUpgrades });
    onClose();
  };
  return (
    <Modal title={t('scrapAsk.title')} tone="red" onClose={onClose}>
      <p className={s.rewardLine}>{t('scrapAsk.text', { n: ups.length })}</p>
      <div className={s.actions} style={{ flexDirection: 'column', gap: 24 }}>
        <button className="btn" onClick={() => scrap(true)}>
          {rest.length > 0 ? t('scrapAsk.keep', { n: rest.length }) : t('scrapAsk.keepOnly')}
          {rest.length > 0 && (
            <>
              <CoinIcon />
              {formatNumber(gold(rest))}
            </>
          )}
        </button>
        <button className="btn red" onClick={() => scrap(false)}>
          {t('scrapAsk.all', { n: unlocked.length })}
          <CoinIcon />
          {formatNumber(gold(unlocked))}
        </button>
      </div>
    </Modal>
  );
}
