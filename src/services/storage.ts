/** Key-value storage: @capacitor/preferences on native, localStorage on web. */
import { Preferences } from '@capacitor/preferences';
import type { KeyValueStorage } from '../core/save';
import { CrazyGamesStorage } from './crazygames';
import { isCrazyGames, isNative } from './platform';

export class LocalStorageService implements KeyValueStorage {
  async get(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  async set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* storage blocked or full: the game keeps running, it just cannot save */
    }
  }
  async remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* storage blocked */
    }
  }
}

export class PreferencesStorageService implements KeyValueStorage {
  async get(key: string) {
    return (await Preferences.get({ key })).value;
  }
  async set(key: string, value: string) {
    await Preferences.set({ key, value });
  }
  async remove(key: string) {
    await Preferences.remove({ key });
  }
}

export function createStorage(): KeyValueStorage {
  if (isCrazyGames) return new CrazyGamesStorage();
  return isNative() ? new PreferencesStorageService() : new LocalStorageService();
}
