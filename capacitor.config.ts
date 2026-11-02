import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dumpsterlegend.app',
  appName: 'Dumpster Legend',
  webDir: 'dist',
  backgroundColor: '#0d0f1a',
  android: {
    backgroundColor: '#0d0f1a',
  },
  ios: {
    backgroundColor: '#0d0f1a',
    contentInset: 'never',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#FFB300',
    },
  },
};

export default config;
