/**
 * Local notifications. Permission is requested at the end of the first session
 * (Milestone 5), never at launch. Until permission exists, scheduling is a no-op.
 */
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './platform';

const OFFLINE_FULL_ID = 1001;

export const notifications = {
  async hasPermission(): Promise<boolean> {
    if (!isNative()) return false;
    try {
      return (await LocalNotifications.checkPermissions()).display === 'granted';
    } catch {
      return false;
    }
  },
  async requestPermission(): Promise<boolean> {
    if (!isNative()) return false;
    try {
      return (await LocalNotifications.requestPermissions()).display === 'granted';
    } catch {
      return false;
    }
  },
  /** "Your dumpster is overflowing!" when the offline cap fills. */
  async scheduleOfflineFull(at: number, title: string, body: string): Promise<void> {
    if (!(await this.hasPermission())) {
      if (import.meta.env.DEV) console.debug('[notifications] would schedule at', new Date(at).toISOString(), body);
      return;
    }
    await LocalNotifications.cancel({ notifications: [{ id: OFFLINE_FULL_ID }] }).catch(() => {});
    await LocalNotifications.schedule({
      notifications: [{ id: OFFLINE_FULL_ID, title, body, schedule: { at: new Date(at) } }],
    });
  },
  async cancelOfflineFull(): Promise<void> {
    if (!isNative()) return;
    await LocalNotifications.cancel({ notifications: [{ id: OFFLINE_FULL_ID }] }).catch(() => {});
  },
};
