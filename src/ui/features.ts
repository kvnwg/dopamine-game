/**
 * How each feature shows on screen (core/systems/features.ts decides when one opens and the order it
 * is introduced in): 'locked' (a tab faded under a lock, a button not there yet), 'intro' (just
 * opened: shown, and the tutorial points at it) or 'open'.
 */
import { featureView, introFeature, type Feature, type FeatureView } from '../core';
import { dispatch, getGame, useGame } from '../app/store';

export { featureView, introFeature, type FeatureView };

export function useFeatureView(f: Feature): FeatureView {
  return useGame((g) => featureView(g, f));
}

/** The player has met the feature being introduced (tapped it, or its moment passed). */
export function seeFeature(f: Feature): void {
  if (featureView(getGame(), f) === 'intro') dispatch({ type: 'featureSeen', feature: f });
}
