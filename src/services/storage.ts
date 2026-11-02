/** Key-value storage: @capacitor/preferences on native, localStorage on web. */
import { Preferences } from '@capacitor/preferences';
import type { KeyValueStorage } from '../core/save';
import { isNative } from './platform';

export class LocalStorageService implements KeyValueStorage {
  async get(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  async set(key: string, value: string) {
    window.localStorage.setItem(key, value);
  }
  async remove(key: string) {
    window.localStorage.removeItem(key);
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
  return isNative() ? new PreferencesStorageService() : new LocalStorageService();
}
