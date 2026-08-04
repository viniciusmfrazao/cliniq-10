import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ASAAS_API_KEY = process.env.ASAAS_API_KEY!
const ASAAS_BASE = 'https://api.asaas.com/v3'

async function asaas(path: string) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', access_token: ASAAS_API_KEY },
    cache: 'no-store',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.errors?.[0]?.description || JSON.stringify(data))
  return data
}

const PAID = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH']
const OPEN = ['PENDING', 'AWAITING_RISK_ANALYSIS']

/**
 * Puxa da Asaas o estado real de cobrança de cada clínica.
 * A Asaas é a fonte da verdade — nada de data calculada localmente.
 * Roda sob demanda (botão no admin) e pelo cron diário.
 */
async function syncAll() {
  const svc = createServiceClient()
  const now = new Date().toISOString()

  const { data: subs, error } = await svc
    .from('clinic_subscriptions')
    .select('clinic_id, asaas_customer_id, asaas_checkout_id, asaas_subscription_id, payment_method, plan_price, clinics(name)')
    .not('asaas_customer_id', 'is', null)

  if (error) throw new Error(`Erro ao ler clinic_subscriptions: ${error.message}`)

  const report: any[] = []

  for (const row of subs || []) {
    const clinicName = (row as any).clinics?.name || row.clinic_id
    const item: any = { clinic: clinicName, clinic_id: row.clinic_id, problemas: [] as string[] }

    try {
      // 1. Status do checkout — responde "a clínica chegou a cadastrar o cartão?"
      let checkoutStatus: string | null = null
      if (row.asaas_checkout_id) {
        try {
          const ck = await asaas(`/checkouts/${row.asaas_checkout_id}`)
          checkoutStatus = ck?.status || null
        } catch {
          // checkout expirado/removido na Asaas — não é fatal
        }
      }
      item.checkout = checkoutStatus

      // 2. Assinaturas do customer
      const subsResp = await asaas(`/subscriptions?customer=${row.asaas_customer_id}&limit=20`)
      const all: any[] = subsResp?.data || []
      const ativas = all.filter((s) => s.status === 'ACTIVE')

      // Um customer pode ter mais de uma assinatura (checkout gerado 2x, teste
      // antigo etc). Prioridade: a que já está gravada no banco > ativa com o
      // valor do plano > ativa mais recente > qualquer uma mais recente.
      const porData = (arr: any[]) =>
        [...arr].sort((a, b) => (b.dateCreated || '').localeCompare(a.dateCreated || ''))
      const sub =
        all.find((s) => s.id === row.asaas_subscription_id) ||
        ativas.find((s) => Number(s.value) === Number(row.plan_price)) ||
        porData(ativas)[0] ||
        porData(all)[0] ||
        null

      if (ativas.length > 1) {
        item.problemas.push(
          `🚨 ${ativas.length} ASSINATURAS ATIVAS no mesmo customer (${ativas
            .map((s) => `${s.id}=R$${s.value}`)
            .join(', ')}) — risco de cobrança duplicada`
        )
      }
      item.assinaturas_ativas = ativas.length

      // 3. Cobranças do customer
      const payResp = await asaas(`/payments?customer=${row.asaas_customer_id}&limit=100`)
      const payments: any[] = (payResp?.data || []).sort((a: any, b: any) =>
        (b.dueDate || '').localeCompare(a.dueDate || '')
      )

      const paid = payments.filter((p) => PAID.includes(p.status))
      const pending = payments
        .filter((p) => OPEN.includes(p.status))
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
      const overdue = payments.filter((p) => p.status === 'OVERDUE')

      const lastPaid = paid.sort((a, b) =>
        (b.confirmedDate || b.paymentDate || b.dueDate || '').localeCompare(
          a.confirmedDate || a.paymentDate || a.dueDate || ''
        )
      )[0]
      const nextOpen = pending[0] || null

      // Cartão salvo. Duas evidências, porque o checkout continua com status
      // ACTIVE mesmo depois do cliente cadastrar o cartão (confirmado em prod
      // ago/2026) — não dá pra depender de CHECKOUT_PAID:
      //  a) a Asaas devolve o objeto creditCard tokenizado, ou
      //  b) existe assinatura ACTIVE de CREDIT_CARD, que na prática só nasce
      //     quando o cliente conclui o checkout hospedado.
      const card = sub?.creditCard || null
      const cardRegistered =
        !!card ||
        checkoutStatus === 'PAID' ||
        (sub?.status === 'ACTIVE' && sub?.billingType === 'CREDIT_CARD')

      // Próxima cobrança: prioridade pra cobrança PENDING real; se não houver,
      // o nextDueDate da assinatura.
      const nextChargeAt = nextOpen?.dueDate || sub?.nextDueDate || null
      const nextChargeValue = nextOpen?.value ?? sub?.value ?? null

      // Status derivado — conservador, só muda quando o sinal é claro
      let status: string | null = null
      if (sub && ['INACTIVE', 'EXPIRED'].includes(sub.status)) status = 'cancelled'
      else if (overdue.length > 0) status = 'overdue'
      else if (paid.length > 0) status = 'active'
      else if (cardRegistered) status = 'trial'

      const patch: any = {
        checkout_status: checkoutStatus,
        next_charge_at: nextChargeAt,
        next_charge_value: nextChargeValue,
        next_charge_status: nextOpen?.status || sub?.status || null,
        card_brand: card?.creditCardBrand || null,
        card_last4: card?.creditCardNumber || null,
        last_sync_at: now,
        updated_at: now,
      }
      if (sub?.id) patch.asaas_subscription_id = sub.id
      if (cardRegistered) {
        patch.card_registered_at = sub?.dateCreated
          ? new Date(sub.dateCreated).toISOString()
          : now
      }
      if (status) patch.status = status
      if (lastPaid) {
        patch.last_payment_at = new Date(
          lastPaid.confirmedDate || lastPaid.paymentDate || lastPaid.dueDate
        ).toISOString()
        patch.last_payment_value = lastPaid.value
      }

      const { error: upErr } = await svc
        .from('clinic_subscriptions')
        .update(patch)
        .eq('clinic_id', row.clinic_id)
      if (upErr) item.problemas.push(`update falhou: ${upErr.message}`)

      // Espelha o acesso no app com a próxima cobrança real, com 5 dias de
      // carência — a cobrança no cartão é processada no dia do vencimento e
      // o webhook de confirmação pode demorar; travar a clínica exatamente na
      // data seria bloquear quem está em dia.
      if (nextChargeAt) {
        const limite = new Date(`${nextChargeAt}T23:59:59-03:00`)
        limite.setDate(limite.getDate() + 5)
        await svc
          .from('clinics')
          .update({ plan_expires_at: limite.toISOString() })
          .eq('id', row.clinic_id)
      }

      // 4. Histórico — reconstrói o que o webhook perdeu
      for (const p of payments) {
        const event = PAID.includes(p.status)
          ? 'PAYMENT_CONFIRMED'
          : p.status === 'OVERDUE'
            ? 'PAYMENT_OVERDUE'
            : p.status === 'REFUNDED'
              ? 'PAYMENT_REFUNDED'
              : 'PAYMENT_CREATED'
        const { error: evErr } = await svc.from('clinic_payment_events').upsert(
          {
            clinic_id: row.clinic_id,
            event,
            asaas_payment_id: p.id,
            asaas_subscription_id: p.subscription || sub?.id || null,
            billing_type: p.billingType || null,
            value: p.value ?? null,
            due_date: p.dueDate || null,
            payment_status: p.status || null,
            source: 'sync',
            occurred_at: new Date(
              p.confirmedDate || p.paymentDate || p.dateCreated || p.dueDate
            ).toISOString(),
            raw: p,
          },
          { onConflict: 'clinic_id,asaas_payment_id,event', ignoreDuplicates: true }
        )
        if (evErr) item.problemas.push(`evento ${p.id}: ${evErr.message}`)
      }

      item.assinatura_asaas = sub?.id || null
      item.status_assinatura = sub?.status || null
      item.cartao_cadastrado = cardRegistered
      item.cartao = card ? `${card.creditCardBrand} ****${card.creditCardNumber}` : null
      item.proxima_cobranca = nextChargeAt
      item.valor = nextChargeValue
      item.cobrancas_pagas = paid.length
      item.cobrancas_pendentes = pending.length
      item.cobrancas_vencidas = overdue.length
      item.status_novo = status

      if (!sub) item.problemas.push('SEM ASSINATURA NA ASAAS — cartão nunca foi cadastrado')
      if (sub && !cardRegistered && row.payment_method === 'CREDIT_CARD')
        item.problemas.push('assinatura existe mas sem cartão tokenizado')
      if (!nextChargeAt) item.problemas.push('SEM DATA DE PRÓXIMA COBRANÇA')
    } catch (e: any) {
      item.problemas.push(`erro: ${e.message}`)
    }

    report.push(item)
    await new Promise((r) => setTimeout(r, 250))
  }

  return report
}

export async function POST() {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 403 })
  }
  try {
    const report = await syncAll()
    return NextResponse.json({ ok: true, sincronizadas: report.length, report })
  } catch (e: any) {
    console.error('[asaas/sync]', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function GET() {
  return POST()
}
