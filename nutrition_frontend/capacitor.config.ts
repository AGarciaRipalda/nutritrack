import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nutritrack.app',
  appName: 'NutriTrack',
  webDir: 'out',
  server: {
    // En desarrollo, apunta a tu backend local:
    // url: 'http://10.0.2.2:3000',
    // cleartext: true,
  },
};

export default config;
