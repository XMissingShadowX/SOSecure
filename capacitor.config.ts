import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sosecure.app',
  appName: 'sosecure',
  webDir: 'out',
  server: {
    url: 'https://www.sosecure.site',
    androidScheme: 'https',
  },
};

export default config;