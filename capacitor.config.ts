import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // ID único do app nas lojas — formato: com.empresa.produto
  // IMPORTANTE: este ID é permanente após publicar nas lojas
  appId: 'br.com.clinike.app',
  appName: 'Clinike',

  // O app carrega o site hospedado no Vercel em vez de arquivos locais.
  // Isso é necessário porque o Clinike tem 52 API routes server-side que
  // não podem ser empacotadas estaticamente dentro do app.
  server: {
    url: 'https://app.clinike.com.br',
    cleartext: false, // HTTPS apenas — nunca HTTP
  },

  ios: {
    // Caminho onde o projeto Xcode será gerado (não commitar o conteúdo gerado)
    path: 'ios',
    // Ícone de 1024×1024 sem cantos arredondados (iOS aplica a máscara)
    // O Xcode vai buscar em Resources/AppIcon.appiconset/
    contentInset: 'automatic',
    // Permite que a WebView leia cookies do mesmo domínio
    limitsNavigationsToAppBoundDomains: true,
    preferredContentMode: 'mobile',
  },

  android: {
    path: 'android',
  },

  plugins: {
    // SplashScreen: exibe o ícone enquanto o app carrega
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1E1B4B', // roxo escuro do Clinike
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    // StatusBar: deixa a status bar com o tema do app
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1E1B4B',
    },
  },
};

export default config;
