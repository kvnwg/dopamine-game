import { BAL } from '../data';
import { MockAdsService, type AdsService } from './ads';
import { MockIapService, type IapService } from './iap';

export { analytics } from './analytics';
export { haptics } from './haptics';
export { notifications } from './notifications';
export { createStorage } from './storage';
export type { AdsService, AdPlacement } from './ads';
export type { IapService } from './iap';

/** Swap these for AdMob / RevenueCat implementations in Milestone 4. */
export const mockAds = new MockAdsService(BAL.mockAds.watchSeconds * 1000);
export const ads: AdsService = mockAds;
export const iap: IapService = new MockIapService();
