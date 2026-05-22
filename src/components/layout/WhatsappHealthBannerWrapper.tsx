'use client'

import { usePathname } from 'next/navigation'

// Banner só aparece em páginas relevantes — não em todas as telas
const ALLOWED_PATHS = [
  '/dashboard/config',
  '/dashboard/whatsapp',
  '/dashboard/crm',
]

export default function WhatsappHealthBannerWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const shouldShow = ALLOWED_PATHS.some(p => pathname.startsWith(p))
  if (!shouldShow) return null
  return <>{children}</>
}
