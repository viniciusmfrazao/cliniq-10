import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ASAAS_API_KEY = process.env.ASAAS_API_KEY!
const ASAAS_BASE = 'https://api.asaas.com/v3'

async function asaas(path: string, body?: object) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.errors?.[0]?.description || JSON.stringify(data))
  return data
}

export async function POST(req: Request) {
  try {
    const { clinicId, planName, planPrice, billingCycle = 'MONTHLY', trialDays = 0 } = await req.json()

    const svc = createServiceClient()

    // Buscar dados da clínica
    const { data: clinic } = await svc.from('clinics').select('id, name, cnpj, settings, billing_whatsapp, clinic_phone').eq('id', clinicId).single()
    if (!clinic) return NextResponse.json({ ok: false, error: 'Clínica não encontrada' }, { status: 404 })

    const settings = clinic.settings as any

    // Email: settings > fallback
    const email = settings?.email || `clinica-${clinicId.replace(/-/g,'')}@clinike.com.br`

    // CNPJ: coluna direta > settings > erro
    const rawCnpj = (clinic.cnpj || settings?.cnpj || '').replace(/\D/g, '')
    if (!rawCnpj || rawCnpj.length < 11) {
      return NextResponse.json({ ok: false, error: 'CNPJ ou CPF da clínica não cadastrado. Preencha o CNPJ no admin antes de gerar o link.' }, { status: 400 })
    }

    // Telefone: billing_whatsapp > clinic_phone > settings
    const phone = (clinic.billing_whatsapp || clinic.clinic_phone || settings?.phone || '').replace(/\D/g, '')

    // 1. Criar customer na Asaas
    let customerId: string
    const { data: existing } = await svc
      .from('clinic_subscriptions')
      .select('asaas_customer_id')
      .eq('clinic_id', clinicId)
      .maybeSingle()

    if (existing?.asaas_customer_id) {
      customerId = existing.asaas_customer_id
    } else {
      const customer = await asaas('/customers', {
        name: clinic.name,
        email,
        cpfCnpj: rawCnpj,
        mobilePhone: phone.replace(/\D/g, ''),
        notificationDisabled: false,
      })
      customerId = customer.id
    }

    // 2. Calcular data do primeiro vencimento
    const nextDueDate = new Date()
    if (trialDays > 0) nextDueDate.setDate(nextDueDate.getDate() + trialDays)
    const nextDueDateStr = nextDueDate.toISOString().split('T')[0]

    // 3. Criar payment link de assinatura
    const link = await asaas('/paymentLinks', {
      name: `Clinike — ${planName}`,
      description: `Assinatura ${planName} do Clinike`,
      billingType: 'UNDEFINED',
      chargeType: 'RECURRENT',
      cycle: billingCycle,
      value: planPrice,
      dueDateLimitDays: 5,
      isAddressRequired: false,
    })

    const checkoutUrl = link.url || link.paymentLink

    // 4. Salvar no banco
    const trialEndsAt = trialDays > 0
      ? new Date(Date.now() + trialDays * 86400000).toISOString()
      : null

    await svc.from('clinic_subscriptions').upsert({
      clinic_id: clinicId,
      asaas_customer_id: customerId,
      asaas_checkout_url: checkoutUrl,
      plan_name: planName,
      plan_price: planPrice,
      billing_cycle: billingCycle,
      status: trialDays > 0 ? 'trial' : 'pending',
      trial_ends_at: trialEndsAt,
      checkout_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'clinic_id' })

    // 5. Atualizar plan_expires_at na clínica se trial
    if (trialDays > 0) {
      await svc.from('clinics').update({
        trial_ends_at: trialEndsAt,
      }).eq('id', clinicId)
    }

    return NextResponse.json({ ok: true, checkoutUrl, customerId })
  } catch (e: any) {
    console.error('[asaas/send-link]', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

