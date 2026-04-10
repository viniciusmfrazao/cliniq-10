import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cliniq',
  description: 'Gestão para clínicas de estética',
}

const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('cliniq-theme');
      if (theme && theme !== 'default') {
        document.documentElement.setAttribute('data-theme', theme);
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
      <body className="antialiased">{children}</body>
    </html>
  )
}
