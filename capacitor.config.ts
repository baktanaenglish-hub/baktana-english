import type { CapacitorConfig } from '@capacitor/cli';

// Android app shell around the web build (see docs/android.md).
const config: CapacitorConfig = {
  appId: 'com.baktana.english',
  appName: 'Baktana English',
  webDir: 'dist',
  android: {
    // The app runs offline from bundled files; no mixed http content.
    allowMixedContent: false,
  },
};

export default config;
