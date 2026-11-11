/**
 * The two ways to take a boost (core/systems/boosts.ts), wherever it's offered: its rewarded ad, and its Gem
 * price beside it (CrazyGames asks every rewarded ad for an alternative). With no ad able to play only the
 * Gem price shows; a boost that can't be taken now shows nothing (its card says why). Taps don't reach what's
 * under the buttons (the big reveal closes on a tap).
 */
import type { MouseEvent } from 'react';
import { boostBlocked, boostGems, type BoostId, type BoostTarget } from '../../core';
import { dispatch, useGame } from '../../app/store';
import { ads, haptics, type AdPlacement } from '../../services';
import { useAdReady } from '../adReady';
import { useNow } from '../hooks';
import { t } from '../i18n';
import { GemIcon, TvIcon } from './Icons';

export const BOOST_PLACEMENT: Record<BoostId, AdPlacement> = {
  quickDive: 'quick_dive',
  potionBrew: 'potion_brew',
  ductTapeReel: 'duct_tape_reel',
  bonusCrate: 'bonus_crate',
  encore: 'encore_spin',
  bossRage: 'boss_rage',
  rebirthBlessing: 'rebirth_blessing',
  polish: 'polish',
  goldTopUp: 'gold_top_up',
};

export function BoostButtons({
  id, target = {}, className = '', watchLabel, column = false,
}: {
  id: BoostId;
  target?: BoostTarget;
  className?: string;
  /** The watch button's words (default "Watch"); name the reward where the card doesn't. */
  watchLabel?: string;
  column?: boolean;
}) {
  const now = useNow(1000);
  // (Nothing before Boosts open, a few minutes into the game: no ads in the first minutes.)
  const blocked = useGame((g) => (g.features.unlocked.includes('boosts') ? boostBlocked(g, id, now, target) : 'nothing'));
  const gems = useGame((g) => g.currencies.gems);
  const price = useGame((g) => boostGems(g, id, now));
  const adReady = useAdReady(BOOST_PLACEMENT[id]);
  if (blocked !== null) return null;
  const take = (via: 'ad' | 'gems') => dispatch({ type: 'boost', id, via, uid: target.uid, upgradeId: target.upgradeId });
  const watch = async (e: MouseEvent) => {
    e.stopPropagation();
    const r = await ads.showRewarded(BOOST_PLACEMENT[id]);
    if (!r.rewarded) return;
    haptics.impact('medium');
    take('ad');
  };
  const pay = (e: MouseEvent) => {
    e.stopPropagation();
    if (gems < price) return;
    haptics.impact('medium');
    take('gems');
  };
  return (
    <div className={className} style={{ display: 'flex', flexDirection: column ? 'column' : 'row', alignItems: 'stretch', gap: 12, flex: 'none' }}>
      {adReady && (
        <button className="btn blue small" onClick={watch}>
          <TvIcon />
          {watchLabel ?? t('boosts.watch')}
        </button>
      )}
      <button className="btn gold small" disabled={gems < price} onClick={pay}>
        <GemIcon /> {price}
      </button>
    </div>
  );
}
