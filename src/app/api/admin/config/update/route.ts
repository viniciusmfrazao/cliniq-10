import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const ok = await isSuperAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const svc = createServiceClient()

  const allowed = ['clinike_billing_instance', 'clinike_billing_from_number']
  for (const key of allowed) {
    if (body[key] !== undefined) {
      await svc.from('app_settings')
        .upsert({ key, value: body[key] }, { onConflict: 'key' })
    }
  }

  return NextResponse.json({ ok: true })
}
