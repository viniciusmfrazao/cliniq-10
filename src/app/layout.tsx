import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'

export const metadata: Metadata = {
  title: 'Clinike',
  description: 'Gestão inteligente para clínicas de estética',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
