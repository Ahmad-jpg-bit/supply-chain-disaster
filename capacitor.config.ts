import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nextrack.scmdisaster',
  appName: 'SCMdisaster',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
