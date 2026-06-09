import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { event, payment } = body

    if (!payment?.subscription) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    const svc = createServiceClient()

    // Buscar assinatura pelo ID da subscription Asaas
    const { data: sub } = await svc
      .from('clinic_subscriptions')
      .select('clinic_id, plan_price')
      .eq('asaas_subscription_id', payment.subscription)
      .maybeSingle()

    // Se não achar pela subscription, tentar pelo customer
    let clinicId = sub?.clinic_id
    if (!clinicId && payment.customer) {
      const { data: subByCustomer } = await svc
        .from('clinic_subscriptions')
        .select('clinic_id')
        .eq('asaas_customer_id', payment.customer)
        .maybeSingle()
      clinicId = subByCustomer?.clinic_id
    }

    if (!clinicId) {
      console.warn('[webhook] Assinatura não encontrada para', payment.subscription || payment.customer)
      return NextResponse.json({ ok: true, ignored: true })
    }

    const now = new Date().toISOString()

    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      // Calcular próximo período (30 dias ou 365 dias)
      const periodEnd = new Date()
      periodEnd.setDate(periodEnd.getDate() + 30)

      await svc.from('clinic_subscriptions').update({
        status: 'active',
        asaas_subscription_id: payment.subscription || null,
        last_payment_at: now,
        last_payment_value: payment.value,
        current_period_start: now,
        current_period_end: periodEnd.toISOString(),
        updated_at: now,
      }).eq('clinic_id', clinicId)

      // Atualizar plan_expires_at na clínica
      await svc.from('clinics').update({
        plan_expires_at: periodEnd.toISOString(),
      }).eq('id', clinicId)

      console.log(`[webhook] Pagamento confirmado — clínica ${clinicId}`)
    }

    else if (event === 'PAYMENT_OVERDUE') {
      await svc.from('clinic_subscriptions').update({
        status: 'overdue',
        updated_at: now,
      }).eq('clinic_id', clinicId)

      console.log(`[webhook] Pagamento vencido — clínica ${clinicId}`)
    }

    else if (event === 'PAYMENT_DELETED' || event === 'SUBSCRIPTION_DELETED') {
      await svc.from('clinic_subscriptions').update({
        status: 'cancelled',
        updated_at: now,
      }).eq('clinic_id', clinicId)

      console.log(`[webhook] Assinatura cancelada — clínica ${clinicId}`)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[webhook] erro:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
