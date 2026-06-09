import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { event, payment } = body

    console.log(`[asaas-webhook] evento: ${event}`, payment?.id)

    if (!payment) return NextResponse.json({ ok: true, ignored: true })

    const svc = createServiceClient()
    const now = new Date().toISOString()

    // Encontrar clínica pelo subscription ou customer
    let clinicId: string | null = null

    if (payment.subscription) {
      const { data } = await svc
        .from('clinic_subscriptions')
        .select('clinic_id')
        .eq('asaas_subscription_id', payment.subscription)
        .maybeSingle()
      clinicId = data?.clinic_id || null
    }

    if (!clinicId && payment.customer) {
      const { data } = await svc
        .from('clinic_subscriptions')
        .select('clinic_id')
        .eq('asaas_customer_id', payment.customer)
        .maybeSingle()
      clinicId = data?.clinic_id || null
    }

    if (!clinicId) {
      console.warn('[asaas-webhook] clínica não encontrada para', payment.subscription, payment.customer)
      return NextResponse.json({ ok: true, ignored: true })
    }

    switch (event) {

      // ✅ Pagamento confirmado/recebido → acesso ativo
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_ANTICIPATED':
      case 'PAYMENT_DUNNING_RECEIVED': {
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
        await svc.from('clinics').update({ plan_expires_at: periodEnd.toISOString() }).eq('id', clinicId)
        console.log(`[asaas-webhook] ✅ Ativo — clínica ${clinicId}`)
        break
      }

      // ⚠️ Vencido → inadimplente (ainda acessa, só aviso)
      case 'PAYMENT_OVERDUE': {
        await svc.from('clinic_subscriptions').update({
          status: 'overdue',
          updated_at: now,
        }).eq('clinic_id', clinicId)
        console.log(`[asaas-webhook] ⚠️ Inadimplente — clínica ${clinicId}`)
        break
      }

      // ❌ Cancelado → bloquear acesso
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_REPROVED_BY_RISK_ANALYSIS': {
        await svc.from('clinic_subscriptions').update({
          status: 'cancelled',
          updated_at: now,
        }).eq('clinic_id', clinicId)
        // Expirar acesso imediatamente
        await svc.from('clinics').update({ plan_expires_at: now }).eq('id', clinicId)
        console.log(`[asaas-webhook] ❌ Cancelado — clínica ${clinicId}`)
        break
      }

      // 🔄 Chargeback → bloquear e investigar
      case 'PAYMENT_CHARGEBACK_REQUESTED': {
        await svc.from('clinic_subscriptions').update({
          status: 'blocked',
          updated_at: now,
        }).eq('clinic_id', clinicId)
        await svc.from('clinics').update({ plan_expires_at: now }).eq('id', clinicId)
        console.log(`[asaas-webhook] 🔄 Chargeback — clínica ${clinicId}`)
        break
      }

      // Disputa de chargeback resolvida → reativar
      case 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL': {
        const periodEnd = new Date()
        periodEnd.setDate(periodEnd.getDate() + 30)
        await svc.from('clinic_subscriptions').update({
          status: 'active',
          current_period_end: periodEnd.toISOString(),
          updated_at: now,
        }).eq('clinic_id', clinicId)
        await svc.from('clinics').update({ plan_expires_at: periodEnd.toISOString() }).eq('id', clinicId)
        break
      }

      // Estorno parcial → só registrar, não bloquear
      case 'PAYMENT_PARTIALLY_REFUNDED': {
        console.log(`[asaas-webhook] Estorno parcial — clínica ${clinicId}`)
        break
      }

      default:
        console.log(`[asaas-webhook] Evento ignorado: ${event}`)
    }

    return NextResponse.json({ ok: true, event, clinicId })
  } catch (e: any) {
    console.error('[asaas-webhook] erro:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
