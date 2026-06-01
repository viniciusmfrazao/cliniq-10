import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const svc = createServiceClient()
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const clinic_id = searchParams.get('clinic_id')
  const source = searchParams.get('source')
  const event = searchParams.get('event')
  const status = searchParams.get('status')
  const phone = searchParams.get('phone')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500)

  let q = svc
    .from('eva_logs')
    .select(`
      id, created_at, clinic_id, phone, source, event, status,
      details, duration_ms, error_message,
      clinics(name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (clinic_id) q = q.eq('clinic_id', clinic_id)
  if (source) q = q.eq('source', source)
  if (event) q = q.eq('event', event)
  if (status) q = q.eq('status', status)
  if (phone) q = q.ilike('phone', `%${phone.replace(/\D/g, '')}%`)
  if (dateFrom) q = q.gte('created_at', dateFrom)
  if (dateTo) q = q.lte('created_at', dateTo + 'T23:59:59')

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}
