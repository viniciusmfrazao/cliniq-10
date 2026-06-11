import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'

type PatchBody = {
  name?: string
  slug?: string
  cnpj?: string | null
  plan_id?: string | null
  trial_ends_at?: string | null
  max_whatsapp_numbers_override?: number | null
  clinic_phone?: string | null
  billing_whatsapp?: string | null
  plan_price?: number | null
  plan_expires_at?: string | null
  billing_notes?: string | null
  primary_admin?: {
    id: string
    name?: string
    email?: string
  }
}

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const allowed = await isSuperAdmin()
    if (!allowed) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const clinicId = params.id
    const body = (await request.json()) as PatchBody
    const svc = createServiceClient()

    // Usa * para não falhar se plan_id ainda não existir no banco (SELECT explícito com coluna inexistente = erro 42703).
    const { data: clinic, error: clinicFetchError } = await svc
      .from('clinics')
      .select('*')
      .eq('id', clinicId)
      .maybeSingle()

    if (clinicFetchError) {
      console.error('[admin/clinics PATCH] fetch clinic:', clinicFetchError.message)
      return NextResponse.json(
        { error: `Erro ao carregar clínica: ${clinicFetchError.message}` },
        { status: 500 },
      )
    }
    if (!clinic) {
      return NextResponse.json({ error: 'Clínica não encontrada' }, { status: 404 })
    }

    if (typeof body.slug === 'string' && body.slug.trim() && body.slug.trim() !== clinic.slug) {
      const { data: slugConflict } = await svc
        .from('clinics')
        .select('id')
        .eq('slug', body.slug.trim())
        .neq('id', clinicId)
        .maybeSingle()
      if (slugConflict) {
        return NextResponse.json({ error: 'Slug já está em uso por outra clínica' }, { status: 400 })
      }
    }

    const currentSettings =
      clinic.settings && typeof clinic.settings === 'object'
        ? (clinic.settings as Record<string, unknown>)
        : {}

    let nextSettings = currentSettings
    if (Object.prototype.hasOwnProperty.call(body, 'max_whatsapp_numbers_override')) {
      const override = body.max_whatsapp_numbers_override
      if (override && override > 0) {
        nextSettings = { ...currentSettings, max_whatsapp_numbers_override: Math.floor(override) }
      } else {
        const { max_whatsapp_numbers_override: _removed, ...rest } = currentSettings
        nextSettings = rest
      }
    }

    const clinicUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      settings: nextSettings,
    }
    if (typeof body.name === 'string') clinicUpdate.name = body.name.trim()
    if (typeof body.slug === 'string') clinicUpdate.slug = body.slug.trim()
    if (Object.prototype.hasOwnProperty.call(body, 'cnpj')) clinicUpdate.cnpj = body.cnpj?.trim() || null
    if (Object.prototype.hasOwnProperty.call(body, 'plan_id')) {
      if ('plan_id' in (clinic as Record<string, unknown>)) {
        clinicUpdate.plan_id = body.plan_id || null
      } else {
        console.warn(
          '[admin/clinics PATCH] ignorando plan_id: coluna ausente em clinics (rode scripts/clinics-plan-id-migration.sql)',
        )
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, 'trial_ends_at')) {
      clinicUpdate.trial_ends_at = body.trial_ends_at || null
    }
    if (Object.prototype.hasOwnProperty.call(body, 'clinic_phone')) {
      clinicUpdate.clinic_phone = body.clinic_phone?.trim() || null
    }
    if (Object.prototype.hasOwnProperty.call(body, 'billing_whatsapp')) {
      clinicUpdate.billing_whatsapp = body.billing_whatsapp?.trim() || null
    }
    if (Object.prototype.hasOwnProperty.call(body, 'plan_price')) {
      clinicUpdate.plan_price = body.plan_price || null
    }
    if (Object.prototype.hasOwnProperty.call(body, 'plan_expires_at')) {
      clinicUpdate.plan_expires_at = body.plan_expires_at || null
    }
    if (Object.prototype.hasOwnProperty.call(body, 'billing_notes')) {
      clinicUpdate.billing_notes = body.billing_notes?.trim() || null
    }

    const { error: clinicUpdateError } = await svc.from('clinics').update(clinicUpdate).eq('id', clinicId)
    if (clinicUpdateError) {
      return NextResponse.json(
        { error: `Erro ao atualizar clínica: ${clinicUpdateError.message}` },
        { status: 500 },
      )
    }

    if (body.primary_admin?.id) {
      const adminId = body.primary_admin.id
      const nextName = body.primary_admin.name?.trim()
      const nextEmail = body.primary_admin.email?.trim().toLowerCase()

      const { data: adminUser, error: adminFetchError } = await svc
        .from('users')
        .select('id, clinic_id, email, name')
        .eq('id', adminId)
        .eq('clinic_id', clinicId)
        .maybeSingle()

      if (adminFetchError || !adminUser) {
        return NextResponse.json({ error: 'Admin da clínica não encontrado' }, { status: 404 })
      }

      const userUpdate: Record<string, unknown> = {}
      if (nextName && nextName !== adminUser.name) userUpdate.name = nextName

      if (nextEmail && nextEmail !== adminUser.email) {
        const { data: emailConflict } = await svc
          .from('users')
          .select('id')
          .eq('email', nextEmail)
          .neq('id', adminId)
          .maybeSingle()
        if (emailConflict) {
          return NextResponse.json({ error: 'Este email já está em uso por outro usuário' }, { status: 400 })
        }
        userUpdate.email = nextEmail

        const { error: authEmailError } = await svc.auth.admin.updateUserById(adminId, {
          email: nextEmail,
          email_confirm: true,
        })
        if (authEmailError) {
          return NextResponse.json(
            { error: `Erro ao atualizar email de acesso: ${authEmailError.message}` },
            { status: 500 },
          )
        }
      }

      if (Object.keys(userUpdate).length > 0) {
        const { error: userUpdateError } = await svc.from('users').update(userUpdate).eq('id', adminId)
        if (userUpdateError) {
          return NextResponse.json(
            { error: `Erro ao atualizar dados do admin: ${userUpdateError.message}` },
            { status: 500 },
          )
        }
      }
    }

    const { data: updatedClinic } = await svc
      .from('clinics')
      .select('*')
      .eq('id', clinicId)
      .maybeSingle()

    return NextResponse.json({ ok: true, clinic: updatedClinic })
  } catch (error) {
    console.error('PATCH /api/admin/clinics/[id] error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

