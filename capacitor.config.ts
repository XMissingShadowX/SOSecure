import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sosecure.app',
  appName: 'sosecure',
  webDir: 'out',
  server: {
    url: 'https://sosecure-ten.vercel.app/',
    cleartext: true,
    androidScheme: 'https',
  },
};

export default config;