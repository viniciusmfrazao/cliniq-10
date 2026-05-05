import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ALL_PERMISSION_IDS, EDITABLE_ROLES } from '@/lib/permissions'

/**
 * GET /api/config/role-permissions
 *   Retorna defaults de todos os papeis da clinica do usuario logado.
 *
 * POST /api/config/role-permissions
 *   Body: { role: string, permissions: string[] }
 *   Salva os defaults pra um papel da clinica.
 *   Apenas admin/super_admin pode chamar.
 */

export async function GET() {
  const supa = await createClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const { data: me } = await supa
    .from('users')
    .select('id, role, clinic_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!me?.clinic_id) {
    return NextResponse.json({ ok: false, error: 'no_clinic' }, { status: 403 })
  }
  if (!['admin', 'super_admin'].includes(me.role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('clinic_role_defaults')
    .select('role, permissions, updated_at')
    .eq('clinic_id', me.clinic_id)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, defaults: data || [] })
}

export async function POST(req: NextRequest) {
  const supa = await createClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const { data: me } = await supa
    .from('users')
    .select('id, role, clinic_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!me?.clinic_id) {
    return NextResponse.json({ ok: false, error: 'no_clinic' }, { status: 403 })
  }
  if (!['admin', 'super_admin'].includes(me.role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  let body: { role?: string; permissions?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const role = String(body.role || '')
  const incoming = Array.isArray(body.permissions) ? body.permissions : []

  if (!EDITABLE_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, error: 'invalid_role' }, { status: 400 })
  }

  // Sanitiza: aceita 'all' OU subconjunto de ALL_PERMISSION_IDS
  const validSet = new Set<string>([...ALL_PERMISSION_IDS, 'all'])
  const cleaned = Array.from(
    new Set(incoming.filter((p): p is string => typeof p === 'string' && validSet.has(p))),
  )

  const svc = createServiceClient()
  const { error } = await svc
    .from('clinic_role_defaults')
    .upsert(
      {
        clinic_id: me.clinic_id,
        role,
        permissions: cleaned,
        updated_by: me.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'clinic_id,role' },
    )

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, role, permissions: cleaned })
}
