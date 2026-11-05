import { BAL } from '../data';
import { MockAdsService, type AdsService } from './ads';
import { MockIapService, type IapService } from './iap';
import { CrazyGamesAdsService } from './crazygames';
import { isCrazyGames } from './platform';

export { analytics } from './analytics';
export { haptics } from './haptics';
export { notifications } from './notifications';
export { createStorage } from './storage';
export type { AdsService, AdPlacement } from './ads';
export type { IapService } from './iap';

/** Swap these for AdMob / RevenueCat implementations in Milestone 4. */
export const mockAds = new MockAdsService(BAL.mockAds.watchSeconds * 1000);
/** The CrazyGames build plays real rewarded ads through their SDK. */
export const ads: AdsService = isCrazyGames ? new CrazyGamesAdsService() : mockAds;
export const iap: IapService = new MockIapService();
