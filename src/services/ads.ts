/**
 * Rewarded ads behind an interface so AdMob can be dropped in later (Milestone 4).
 * No interstitials, no banners: rewarded placements only.
 */
export type AdPlacement =
  | 'offline_double' | 'heist_ticket' | 'free_crew_call' | 'sugar_rush' | 'heist_revive'
  | 'perk_reroll' | 'junkyard_key' | 'truck_attempt' | 'dumpster_speedup'
  /** The Boosts panel (core/systems/boosts.ts). */
  | 'quick_dive' | 'potion_brew' | 'duct_tape_reel' | 'bonus_crate';

export interface AdResult {
  rewarded: boolean;
}

export interface AdsService {
  init(): Promise<void>;
  /** False when no ad can play (ads off for the session, an ad blocker): the game hides its ad buttons then. */
  isReady(placement: AdPlacement): boolean;
  showRewarded(placement: AdPlacement): Promise<AdResult>;
  /** Called when isReady may have changed (for example ads turned out to be off). Returns an unsubscribe. */
  onAvailabilityChange?(fn: () => void): () => void;
}

type Listener = (placement: AdPlacement | null) => void;

/** Dev/web mock: pretends to play an ad for a moment, then rewards. UI shows an overlay while it "plays". */
export class MockAdsService implements AdsService {
  private listeners = new Set<Listener>();
  constructor(private readonly watchMs: number) {}
  async init() {}
  isReady() {
    return true;
  }
  /** Subscribe to know when a mock ad is "playing" (for the overlay). */
  onPlaying(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  async showRewarded(placement: AdPlacement): Promise<AdResult> {
    this.listeners.forEach((l) => l(placement));
    await new Promise((r) => setTimeout(r, this.watchMs));
    this.listeners.forEach((l) => l(null));
    return { rewarded: true };
  }
}
