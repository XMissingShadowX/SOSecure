import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sosecure.app',
  appName: 'sosecure',
  webDir: 'out',
  server: {
    url: 'https://safe-walk-ten.vercel.app/',
    cleartext: true,
    androidScheme: 'https',
  },
};

export default config;