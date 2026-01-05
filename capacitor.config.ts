import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'nl.psalmmelodies.app',
  appName: 'Psalm Melodies',
  webDir: 'dist',
  server: {
    // For development, you can enable this to load from your dev server
    // url: 'http://localhost:5173',
    // cleartext: true
  },
  plugins: {
    StatusBar: {
      style: 'dark',
      backgroundColor: '#ffffff'
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    }
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined
    }
  },
  ios: {
    scheme: 'Psalm Melodies'
  }
};

export default config;
