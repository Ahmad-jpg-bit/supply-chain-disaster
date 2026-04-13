import type { CapacitorConfig } from '@capacitor/cli';

// Set CAPACITOR_DEV_SERVER=http://192.168.x.x:5173 to load from live dev server.
// Leave unset (or clear it) for production builds that use dist/.
const devServer = process.env.CAPACITOR_DEV_SERVER;

const config: CapacitorConfig = {
  appId: 'com.nextrack.scmdisaster',
  appName: 'SCMdisaster',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    ...(devServer ? { url: devServer, cleartext: true } : {}),
  },
};

export default config;
