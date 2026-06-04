import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clinike.app',
  appName: 'Clinike',
  // Aponta para o app em produção — sem reescrever código
  server: {
    url: 'https://app.clinike.com.br',
    cleartext: false,
    androidScheme: 'https',
  },
  // Fallback para build local se necessário
  webDir: 'out',
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#fafaf8',
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
      style: 'DEFAULT',
      backgroundColor: '#7c3aed',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
