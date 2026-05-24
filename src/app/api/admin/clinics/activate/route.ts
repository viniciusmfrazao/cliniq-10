import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const ok = await isSuperAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clinic_id, plan_expires_at } = await req.json()
  if (!clinic_id) return NextResponse.json({ error: 'clinic_id obrigatorio' }, { status: 400 })

  const svc = createServiceClient()
  const { error } = await svc
    .from('clinics')
    .update({ plan_expires_at: plan_expires_at || null, active: true })
    .eq('id', clinic_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
