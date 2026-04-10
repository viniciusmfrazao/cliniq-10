@"
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cliniq',
  description: 'Gestão para clínicas de estética',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1, themeColor: '#4F46E5',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
"@ | Out-File -FilePath "src\app\layout.tsx" -Encoding utf8 -NoNewline