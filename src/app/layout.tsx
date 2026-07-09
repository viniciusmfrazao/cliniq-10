import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'
import BrazilCopa from '@/components/BrazilCopa'
import PWAProvider from '@/components/PWAProvider'

export const metadata: Metadata = {
  title: {
    default: 'Clinike',
    template: '%s · Clinike',
  },
  description: 'Gestão inteligente para clínicas de estética e saúde',
  applicationName: 'Clinike',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Clinike',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/logo.svg', type: 'image/svg+xml', sizes: 'any' },
    ],
    shortcut: '/logo.svg',
    apple: [
      { url: '/logo.svg', sizes: '180x180' },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'Clinike',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#7C3AED' },
    { media: '(prefers-color-scheme: dark)', color: '#0F172A' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

const sessionMigrationScript = "(function(){try{localStorage.removeItem('clinike-auth-token');}catch(e){}})()"

const themeScript = `
  (function() {
    try {
      var mode = localStorage.getItem('theme-mode');
      var color = localStorage.getItem('theme-color') || localStorage.getItem('clinike-theme');
      if (mode === 'dark') {
        document.documentElement.classList.add('dark');
      }
      if (color && color !== 'default') {
        document.documentElement.setAttribute('data-theme', color);
      }
    } catch (e) {}
  })();
`

const authHashRedirectScript = `
  (function() {
    try {
      var hash = window.location.hash || '';
      if (!hash || hash.indexOf('access_token=') === -1) return;
      var params = new URLSearchParams(hash.substring(1));
      var type = params.get('type');
      var hasToken = !!params.get('access_token');
      if (!hasToken || type !== 'recovery') return;
      if (window.location.pathname !== '/redefinir-senha') {
        window.location.replace('/redefinir-senha' + hash);
      }
    } catch (e) {}
  })();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: sessionMigrationScript }} />
        <script dangerouslySetInnerHTML={{ __html: authHashRedirectScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        <BrazilCopa />
        <PWAProvider />
      </body>
    </html>
  )
}
