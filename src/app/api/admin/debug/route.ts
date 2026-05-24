import { NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ok = await isSuperAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  const { data, error } = await svc
    .from('clinics')
    .select('id, name')
    .is('deleted_at', null)

  return NextResponse.json({
    has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    has_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    service_key_prefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20),
    data,
    error,
    count: data?.length ?? 0,
  })
}
