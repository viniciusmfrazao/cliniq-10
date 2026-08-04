import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Soma um ciclo à data de vencimento pra estimar o fim do período pago. */
function addCycle(dueDate: string | null, cycle: string | null) {
  const base = dueDate ? new Date(`${dueDate}T12:00:00-03:00`) : new Date()
  base.setDate(base.getDate() + (cycle === 'YEARLY' ? 365 : 30))
  return base.toISOString()
}

export async function POST(req: Request) {
  // Validar token da Asaas
  const asaasToken = req.headers.get('asaas-access-token') || req.headers.get('access_token')
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN
  if (expectedToken && asaasToken !== expectedToken) {
    console.warn('[asaas-webhook] Token inválido:', asaasToken)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { event, payment, checkout } = body

    console.log(`[asaas-webhook] evento: ${event}`, payment?.id || checkout?.id)

    const svc = createServiceClient()
    const now = new Date().toISOString()

    // ─────────────────────────────────────────────────────────────
    // Eventos de CHECKOUT — não trazem objeto `payment`.
    // É aqui que descobrimos que a clínica cadastrou o cartão.
    // ─────────────────────────────────────────────────────────────
    if (event?.startsWith('CHECKOUT_')) {
      const checkoutId = checkout?.id || body.id
      if (!checkoutId) return NextResponse.json({ ok: true, ignored: 'sem checkout id' })

      const { data: subRow } = await svc
        .from('clinic_subscriptions')
        .select('clinic_id')
        .eq('asaas_checkout_id', checkoutId)
        .maybeSingle()

      if (!subRow?.clinic_id) {
        console.warn('[asaas-webhook] checkout sem clínica:', checkoutId)
        return NextResponse.json({ ok: true, ignored: true })
      }

      const patch: any = {
        checkout_status: checkout?.status || event.replace('CHECKOUT_', ''),
        updated_at: now,
      }

      if (event === 'CHECKOUT_PAID') {
        patch.card_registered_at = now
        if (checkout?.subscription) patch.asaas_subscription_id = checkout.subscription
      }

      const { error: upErr } = await svc
        .from('clinic_subscriptions')
        .update(patch)
        .eq('clinic_id', subRow.clinic_id)
      if (upErr) console.error('[asaas-webhook] update checkout falhou:', upErr.message)

      const { error: evErr } = await svc.from('clinic_payment_events').insert({
        clinic_id: subRow.clinic_id,
        event,
        asaas_subscription_id: checkout?.subscription || null,
        source: 'webhook',
        raw: body,
      })
      if (evErr) console.error('[asaas-webhook] log checkout falhou:', evErr.message)

      console.log(`[asaas-webhook] 💳 checkout ${event} — clínica ${subRow.clinic_id}`)
      return NextResponse.json({ ok: true, event, clinicId: subRow.clinic_id })
    }

    if (!payment && !body.subscription) return NextResponse.json({ ok: true, ignored: true })

    // Para eventos de assinatura, o ID vem em body.subscription
    const subscriptionId = payment?.subscription || body.subscription?.id

    // Encontrar clínica pelo subscription ou customer
    let clinicId: string | null = null

    if (subscriptionId) {
      const { data } = await svc
        .from('clinic_subscriptions')
        .select('clinic_id')
        .eq('asaas_subscription_id', subscriptionId)
        .maybeSingle()
      clinicId = data?.clinic_id || null
    }

    if (!clinicId && payment?.customer) {
      const { data } = await svc
        .from('clinic_subscriptions')
        .select('clinic_id')
        .eq('asaas_customer_id', payment.customer)
        .maybeSingle()
      clinicId = data?.clinic_id || null
    }

    if (!clinicId) {
      console.warn('[asaas-webhook] clínica não encontrada para', subscriptionId, payment?.customer)
      return NextResponse.json({ ok: true, ignored: true })
    }

    // Log histórico — o insert do supabase-js NÃO lança erro, devolve `error`.
    // Precisa checar explicitamente, senão a falha some (foi o que aconteceu
    // com o cache de schema do PostgREST em ago/2026).
    const { error: logErr } = await svc.from('clinic_payment_events').insert({
      clinic_id: clinicId,
      event,
      asaas_payment_id: payment?.id || null,
      asaas_subscription_id: subscriptionId || null,
      billing_type: payment?.billingType || null,
      value: payment?.value ?? null,
      due_date: payment?.dueDate || null,
      payment_status: payment?.status || null,
      source: 'webhook',
      raw: body,
    })
    if (logErr) console.error('[asaas-webhook] ⚠️ falha ao gravar histórico:', logErr.message)

    switch (event) {
      // 📅 Cobrança gerada → é a data real da próxima cobrança
      case 'PAYMENT_CREATED': {
        await svc
          .from('clinic_subscriptions')
          .update({
            asaas_subscription_id: subscriptionId || undefined,
            next_charge_at: payment.dueDate || null,
            next_charge_value: payment.value ?? null,
            next_charge_status: payment.status || 'PENDING',
            updated_at: now,
          })
          .eq('clinic_id', clinicId)
        if (payment.dueDate) {
          await svc
            .from('clinics')
            .update({ plan_expires_at: new Date(`${payment.dueDate}T23:59:59-03:00`).toISOString() })
            .eq('id', clinicId)
        }
        console.log(`[asaas-webhook] 📅 próxima cobrança ${payment.dueDate} — clínica ${clinicId}`)
        break
      }

      // ✅ Pagamento confirmado/recebido → acesso ativo
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_ANTICIPATED':
      case 'PAYMENT_DUNNING_RECEIVED': {
        const { data: cur } = await svc
          .from('clinic_subscriptions')
          .select('billing_cycle')
          .eq('clinic_id', clinicId)
          .maybeSingle()
        const periodEnd = addCycle(payment.dueDate || null, cur?.billing_cycle || 'MONTHLY')
        await svc
          .from('clinic_subscriptions')
          .update({
            status: 'active',
            asaas_subscription_id: payment.subscription || undefined,
            payment_method: payment.billingType || undefined,
            card_registered_at:
              payment.billingType === 'CREDIT_CARD' ? now : undefined,
            last_payment_at: now,
            last_payment_value: payment.value,
            current_period_start: now,
            current_period_end: periodEnd,
            next_charge_status: 'PAID',
            updated_at: now,
          })
          .eq('clinic_id', clinicId)
        await svc.from('clinics').update({ plan_expires_at: periodEnd }).eq('id', clinicId)
        console.log(`[asaas-webhook] ✅ Ativo — clínica ${clinicId}`)
        break
      }

      // ⚠️ Uma tentativa de captura falhou (não é a vencida final — a Asaas
      // ainda vai tentar de novo, até 2 dias após o vencimento). Só regista
      // pra dar visibilidade de qual tentativa falhou; não muda status.
      case 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED': {
        console.log(`[asaas-webhook] 💳❌ tentativa de captura recusada — clínica ${clinicId}`)
        break
      }

      // ⚠️ Vencido → inadimplente (ainda acessa, só aviso)
      case 'PAYMENT_OVERDUE': {
        await svc
          .from('clinic_subscriptions')
          .update({ status: 'overdue', next_charge_status: 'OVERDUE', updated_at: now })
          .eq('clinic_id', clinicId)
        console.log(`[asaas-webhook] ⚠️ Inadimplente — clínica ${clinicId}`)
        break
      }

      // ❌ Cancelado → bloquear acesso
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_REPROVED_BY_RISK_ANALYSIS': {
        await svc
          .from('clinic_subscriptions')
          .update({ status: 'cancelled', updated_at: now })
          .eq('clinic_id', clinicId)
        await svc.from('clinics').update({ plan_expires_at: now }).eq('id', clinicId)
        console.log(`[asaas-webhook] ❌ Cancelado — clínica ${clinicId}`)
        break
      }

      // 🔄 Chargeback → bloquear e investigar
      case 'PAYMENT_CHARGEBACK_REQUESTED': {
        await svc
          .from('clinic_subscriptions')
          .update({ status: 'blocked', updated_at: now })
          .eq('clinic_id', clinicId)
        await svc.from('clinics').update({ plan_expires_at: now }).eq('id', clinicId)
        console.log(`[asaas-webhook] 🔄 Chargeback — clínica ${clinicId}`)
        break
      }

      // Disputa de chargeback resolvida → reativar
      case 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL': {
        const periodEnd = addCycle(payment?.dueDate || null, 'MONTHLY')
        await svc
          .from('clinic_subscriptions')
          .update({ status: 'active', current_period_end: periodEnd, updated_at: now })
          .eq('clinic_id', clinicId)
        await svc.from('clinics').update({ plan_expires_at: periodEnd }).eq('id', clinicId)
        break
      }

      // Estorno parcial → só registrar, não bloquear
      case 'PAYMENT_PARTIALLY_REFUNDED': {
        console.log(`[asaas-webhook] Estorno parcial — clínica ${clinicId}`)
        break
      }

      // Assinatura inativada ou removida → cancelar
      case 'SUBSCRIPTION_INACTIVATED':
      case 'SUBSCRIPTION_DELETED': {
        const subId = body.subscription?.id || payment?.subscription
        if (subId) {
          await svc
            .from('clinic_subscriptions')
            .update({ status: 'cancelled', next_charge_at: null, updated_at: now })
            .eq('asaas_subscription_id', subId)
          if (clinicId) {
            await svc.from('clinics').update({ plan_expires_at: now }).eq('id', clinicId)
          }
        }
        console.log(`[asaas-webhook] Assinatura cancelada/inativada`)
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
