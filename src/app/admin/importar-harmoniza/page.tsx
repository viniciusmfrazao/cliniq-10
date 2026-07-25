import { isSuperAdmin } from '@/lib/super-admin'
import { redirect } from 'next/navigation'
import ImportarHarmonizaClient from './importar-harmoniza-client'

export const dynamic = 'force-dynamic'

export default async function ImportarHarmonizaPage() {
  const ok = await isSuperAdmin()
  if (!ok) redirect('/dashboard')

  return <ImportarHarmonizaClient />
}
