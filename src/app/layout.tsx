import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cliniq',
  description: 'Gestão para clínicas de estética',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  )
}
