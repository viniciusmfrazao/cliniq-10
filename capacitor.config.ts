import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clinike.app',
  appName: 'Clinike',
  server: {
    url: 'https://app.clinike.com.br',
    cleartext: false,
    androidScheme: 'https',
  },
  webDir: 'out',
  ios: {
    contentInset: 'never',
    backgroundColor: '#7c3aed',
  },
  android: {
    backgroundColor: '#fafaf8',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#7c3aed',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#7c3aed',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
