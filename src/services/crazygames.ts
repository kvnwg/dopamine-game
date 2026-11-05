/**
 * CrazyGames HTML5 SDK v3 (https://docs.crazygames.com/sdk/intro/), used only in the CrazyGames build
 * (`npm run build:crazygames`, which also adds the SDK's <script> tag to index.html).
 *
 * Environments: 'crazygames' (on their site, everything works), 'local' (localhost: SDK calls log to the
 * console and ads show a text overlay), 'disabled' (any other domain: every call would throw, so none are
 * made). If the script never loads (offline, blocked) we run as 'none'. In every case but the first two
 * the game falls back to localStorage and simply has no ads.
 */
import type { KeyValueStorage } from '../core/save';
import type { AdPlacement, AdResult, AdsService } from './ads';
import { isCrazyGames } from './platform';

type Env = 'crazygames' | 'local' | 'disabled' | 'none';

interface CgSettings {
  muteAudio?: boolean;
  disableChat?: boolean;
}

interface CgAdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (err: { code?: string; message?: string }) => void;
}

interface CgSdk {
  init(): Promise<void>;
  environment: Env;
  game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
    happytime(): void;
    settings: CgSettings;
    addSettingsChangeListener(fn: (s: CgSettings) => void): void;
  };
  ad: {
    requestAd(type: 'midgame' | 'rewarded', callbacks: CgAdCallbacks): void;
  };
  data: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  };
}

type AdEvent = 'adStart' | 'adEnd' | 'adFailed';

let sdk: CgSdk | null = null;
let env: Env = 'none';
let inGameplay = false;
let loading = false;
let adsDisabled = false;
const listeners: Record<AdEvent, Set<() => void>> = { adStart: new Set(), adEnd: new Set(), adFailed: new Set() };

async function init(): Promise<boolean> {
  const found = (window as unknown as { CrazyGames?: { SDK?: CgSdk } }).CrazyGames?.SDK;
  if (!found) {
    console.info('[crazygames] SDK not loaded; running without it');
    return false;
  }
  try {
    await Promise.race([
      found.init(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('SDK init timed out')), 8000)),
    ]);
    sdk = found;
    env = found.environment ?? 'disabled';
  } catch (err) {
    console.warn('[crazygames] SDK init failed', err);
    env = 'none';
  }
  return usable();
}

/** Resolves once the SDK is ready (or known to be missing). Save loading waits on this. */
export const cgReady: Promise<boolean> = isCrazyGames ? init() : Promise.resolve(false);

function usable(): boolean {
  return !!sdk && (env === 'crazygames' || env === 'local');
}

function call(fn: (s: CgSdk) => void): void {
  if (!usable()) return;
  try {
    fn(sdk!);
  } catch (err) {
    console.warn('[crazygames]', err);
  }
}

export const crazyGames = {
  environment: (): Env => env,
  /** False off CrazyGames, and in Basic Launch / kids mode (the SDK answers 'adsDisabled'). */
  adsAvailable: (): boolean => usable() && !adsDisabled,

  loadingStart(): void {
    if (loading) return;
    loading = true;
    call((s) => s.game.loadingStart());
  },
  loadingStop(): void {
    if (!loading) return;
    loading = false;
    call((s) => s.game.loadingStop());
  },
  /** The player is playing (or back from a break). Deduplicated. */
  gameplayStart(): void {
    if (inGameplay) return;
    inGameplay = true;
    call((s) => s.game.gameplayStart());
  },
  /** A real game break (a menu, an ad). Not for focus loss: CrazyGames handles that itself. */
  gameplayStop(): void {
    if (!inGameplay) return;
    inGameplay = false;
    call((s) => s.game.gameplayStop());
  },
  happytime(): void {
    call((s) => s.game.happytime());
  },
  muteAudio(): boolean {
    if (!usable()) return false;
    try {
      return !!sdk!.game.settings?.muteAudio;
    } catch {
      return false;
    }
  },
  onSettingsChange(fn: (s: CgSettings) => void): void {
    call((s) => s.game.addSettingsChangeListener(fn));
  },
  on(evt: AdEvent, fn: () => void): () => void {
    listeners[evt].add(fn);
    return () => listeners[evt].delete(fn);
  },
};

function emit(evt: AdEvent): void {
  for (const fn of listeners[evt]) {
    try {
      fn();
    } catch (err) {
      console.error(err);
    }
  }
}

/** Plays an SDK ad. Resolves true only when it finished: a reward is never given on an error. */
function requestAd(type: 'midgame' | 'rewarded'): Promise<boolean> {
  return new Promise((resolve) => {
    if (!crazyGames.adsAvailable()) {
      resolve(false);
      return;
    }
    let settled = false;
    let started = false;
    let playing = false;
    const end = (ok: boolean) => {
      if (playing) {
        playing = false;
        emit('adEnd');
      }
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    // Never leave the player stuck if the SDK stays silent (a late adStarted still pauses and mutes).
    const timer = setTimeout(() => {
      if (!started) end(false);
    }, 15000);
    try {
      sdk!.ad.requestAd(type, {
        adStarted: () => {
          started = true;
          playing = true;
          emit('adStart');
        },
        adFinished: () => {
          clearTimeout(timer);
          end(true);
        },
        adError: (err) => {
          clearTimeout(timer);
          const code = err?.code ?? 'other';
          if (code === 'adsDisabled' || code === 'adsDisabledBasicLaunch') adsDisabled = true;
          end(false);
        },
      });
    } catch {
      clearTimeout(timer);
      end(false);
    }
  });
}

/** Rewarded ads through the SDK, behind the game's AdsService interface. */
export class CrazyGamesAdsService implements AdsService {
  async init() {
    await cgReady;
  }
  isReady(_placement: AdPlacement): boolean {
    return crazyGames.adsAvailable();
  }
  async showRewarded(_placement: AdPlacement): Promise<AdResult> {
    const ok = await requestAd('rewarded');
    if (!ok) emit('adFailed');
    return { rewarded: ok };
  }
}

/**
 * Saves through the SDK's Data module (cloud-synced for logged-in players, 1 MB limit; a save with its
 * two backups is well under 200 KB). Needs "Progress Save: Yes, using the Data Module" in the submission
 * form. Falls back to localStorage when the SDK isn't usable or the module is off.
 */
export class CrazyGamesStorage implements KeyValueStorage {
  private local(): Storage | null {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }
  async get(key: string) {
    if (await cgReady) {
      try {
        return sdk!.data.getItem(key);
      } catch (err) {
        console.warn('[crazygames] data.getItem failed; using localStorage', err);
      }
    }
    return this.local()?.getItem(key) ?? null;
  }
  async set(key: string, value: string) {
    if (await cgReady) {
      try {
        sdk!.data.setItem(key, value);
        return;
      } catch (err) {
        console.warn('[crazygames] data.setItem failed; using localStorage', err);
      }
    }
    try {
      this.local()?.setItem(key, value);
    } catch {
      /* storage blocked or full: the game keeps running, it just cannot save */
    }
  }
  async remove(key: string) {
    if (await cgReady) {
      try {
        sdk!.data.removeItem(key);
        return;
      } catch {
        /* fall through */
      }
    }
    try {
      this.local()?.removeItem(key);
    } catch {
      /* storage blocked */
    }
  }
}
