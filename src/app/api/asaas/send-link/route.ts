import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ASAAS_API_KEY = process.env.ASAAS_API_KEY!
const ASAAS_BASE = 'https://api.asaas.com/v3'
const CHECKOUT_BASE_URL = 'https://asaas.com/checkoutSession/show'

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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(req: Request) {
  try {
    const {
      clinicId,
      planName,
      planPrice,
      billingCycle = 'MONTHLY',
      trialDays = 0,
      paymentMethod = 'CREDIT_CARD', // 'CREDIT_CARD' | 'PIX'
    } = await req.json()

    if (!['CREDIT_CARD', 'PIX'].includes(paymentMethod)) {
      return NextResponse.json({ ok: false, error: 'Forma de pagamento inválida' }, { status: 400 })
    }

    const svc = createServiceClient()

    // Buscar dados da clínica
    const { data: clinic } = await svc.from('clinics').select('id, name, cnpj, settings, billing_whatsapp, clinic_phone').eq('id', clinicId).single()
    if (!clinic) return NextResponse.json({ ok: false, error: 'Clínica não encontrada' }, { status: 404 })

    const settings = clinic.settings as any

    // Email: settings > fallback
    const email = settings?.email || `clinica-${clinicId.replace(/-/g, '')}@clinike.com.br`

    // CNPJ: coluna direta > settings > erro
    const rawCnpj = (clinic.cnpj || settings?.cnpj || '').replace(/\D/g, '')
    if (!rawCnpj || rawCnpj.length < 11) {
      return NextResponse.json({ ok: false, error: 'CNPJ ou CPF da clínica não cadastrado. Preencha o CNPJ no admin antes de gerar o link.' }, { status: 400 })
    }

    // Telefone: billing_whatsapp > clinic_phone > settings
    const phone = (clinic.billing_whatsapp || clinic.clinic_phone || settings?.phone || '').replace(/\D/g, '')

    // 1. Criar (ou reaproveitar) customer na Asaas
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

    // 2. Calcular data da primeira cobrança (respeitando o trial)
    const nextDueDate = new Date()
    if (trialDays > 0) nextDueDate.setDate(nextDueDate.getDate() + trialDays)
    const nextDueDateStr = nextDueDate.toISOString().split('T')[0]

    let checkoutUrl: string
    let checkoutId: string | null = null
    let asaasSubscriptionId: string | null = null

    if (paymentMethod === 'CREDIT_CARD') {
      // Checkout hospedado — cliente cadastra o cartão agora, cobrança
      // automática só em nextDueDate. A Asaas só permite CREDIT_CARD pra
      // chargeType RECURRENT no checkout hospedado (Pix não tem "cartão
      // salvo", ver branch abaixo).
      const checkout = await asaas('/checkouts', {
        billingTypes: ['CREDIT_CARD'],
        chargeTypes: ['RECURRENT'],
        minutesToExpire: 1440, // máximo permitido pela Asaas (24h) pra clínica completar o cadastro
        callback: {
          successUrl: 'https://app.clinike.com.br/dashboard?assinatura=ativada',
          cancelUrl: 'https://app.clinike.com.br/planos',
          expiredUrl: 'https://app.clinike.com.br/planos',
        },
        customer: customerId,
        items: [
          {
            name: planName.slice(0, 30),
            description: `Assinatura ${planName} do Clinike`,
            quantity: 1,
            value: planPrice,
          },
        ],
        subscription: {
          cycle: billingCycle,
          nextDueDate: nextDueDateStr,
        },
      })
      checkoutId = checkout.id
      checkoutUrl = `${CHECKOUT_BASE_URL}?id=${checkout.id}`
    } else {
      // PIX: não existe checkout hospedado recorrente pra Pix na Asaas —
      // a cobrança recorrente é criada direto via /subscriptions, e a
      // Asaas mesma gera e envia a cobrança (QR code) a cada ciclo, com
      // vencimento em nextDueDate. Buscamos o link da 1ª cobrança gerada
      // pra poder enviar pra clínica.
      const subscription = await asaas('/subscriptions', {
        customer: customerId,
        billingType: 'PIX',
        nextDueDate: nextDueDateStr,
        value: planPrice,
        cycle: billingCycle,
        description: `Assinatura ${planName} do Clinike`,
      })
      asaasSubscriptionId = subscription.id

      // A cobrança é gerada de forma assíncrona — tenta algumas vezes
      let firstPayment: any = null
      for (let attempt = 0; attempt < 4 && !firstPayment; attempt++) {
        if (attempt > 0) await sleep(1500)
        const payments = await asaas(`/payments?subscription=${subscription.id}`)
        firstPayment = payments?.data?.[0] || null
      }

      if (!firstPayment?.invoiceUrl) {
        return NextResponse.json({ ok: false, error: 'Assinatura Pix criada, mas a cobrança ainda não foi gerada pela Asaas. Confira em alguns segundos na tela de assinaturas.' }, { status: 202 })
      }
      checkoutUrl = firstPayment.invoiceUrl
    }

    // 3. Salvar no banco
    const trialEndsAt = trialDays > 0
      ? new Date(Date.now() + trialDays * 86400000).toISOString()
      : null

    await svc.from('clinic_subscriptions').upsert({
      clinic_id: clinicId,
      asaas_customer_id: customerId,
      asaas_checkout_id: checkoutId,
      asaas_subscription_id: asaasSubscriptionId,
      asaas_checkout_url: checkoutUrl,
      payment_method: paymentMethod,
      plan_name: planName,
      plan_price: planPrice,
      billing_cycle: billingCycle,
      status: trialDays > 0 ? 'trial' : 'pending',
      trial_ends_at: trialEndsAt,
      checkout_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'clinic_id' })

    // 4. plan_expires_at = data real da primeira cobrança — é o prazo que
    // passa a valer pro aviso/bloqueio no app (ver dashboard/layout.tsx)
    await svc.from('clinics').update({
      plan_expires_at: nextDueDate.toISOString(),
    }).eq('id', clinicId)

    return NextResponse.json({ ok: true, checkoutUrl, customerId })
  } catch (e: any) {
    console.error('[asaas/send-link]', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
