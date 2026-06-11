import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sosecure.app',
  appName: 'sosecure',
  webDir: 'out',
  server: {
    url: 'https://www.sosecure.site',
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;