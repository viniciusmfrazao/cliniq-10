import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const ok = await isSuperAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clinic_id, billing_whatsapp, plan_price, billing_notes } = await req.json()
  if (!clinic_id) return NextResponse.json({ error: 'clinic_id obrigatorio' }, { status: 400 })

  const svc = createServiceClient()
  const update: Record<string, any> = {}
  if (billing_whatsapp !== undefined) update.billing_whatsapp = billing_whatsapp || null
  if (plan_price !== undefined) update.plan_price = plan_price || null
  if (billing_notes !== undefined) update.billing_notes = billing_notes || null

  const { error } = await svc.from('clinics').update(update).eq('id', clinic_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
