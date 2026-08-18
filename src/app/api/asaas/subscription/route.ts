import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/super-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ASAAS_API_KEY = process.env.ASAAS_API_KEY!
const ASAAS_BASE = 'https://api.asaas.com/v3'

/** Data usada pra manter a clínica liberada enquanto a cobrança está suspensa.
 * O bloqueio no app é medido por clinics.plan_expires_at (dashboard/layout). */
const ACESSO_SUSPENSO_ATE = '2099-12-31T23:59:59-03:00'

const PAID = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH']
const ABERTAS = ['PENDING', 'AWAITING_RISK_ANALYSIS', 'OVERDUE']

async function asaas(
  path: string,
  body?: object,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = body ? 'POST' : 'GET'
) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', access_token: ASAAS_API_KEY },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err: any = new Error(data?.errors?.[0]?.description || JSON.stringify(data))
    err.status = res.status
    throw err
  }
  return data
}

/** Procura o token do cartão já tokenizado na Asaas pra esse customer.
 * Ordem: assinatura existente > última cobrança paga no cartão. É isso que
 * permite recriar a recorrência sem pedir o cartão de novo pra clínica. */
async function findCardToken(customerId: string): Promise<{ token: string; origem: string } | null> {
  try {
    const subs = await asaas(`/subscriptions?customer=${customerId}&limit=20`)
    for (const s of subs?.data || []) {
      if (s?.creditCard?.creditCardToken) {
        return { token: s.creditCard.creditCardToken, origem: `assinatura ${s.id}` }
      }
    }
  } catch {
    // segue pro fallback das cobranças
  }

  const pays = await asaas(`/payments?customer=${customerId}&billingType=CREDIT_CARD&limit=100`)
  const lista: any[] = (pays?.data || []).sort((a: any, b: any) =>
    (b.confirmedDate || b.paymentDate || b.dueDate || '').localeCompare(
      a.confirmedDate || a.paymentDate || a.dueDate || ''
    )
  )
  // Pagas primeiro — cartão que já capturou com sucesso é o mais confiável
  const ordenadas = [...lista.filter((p) => PAID.includes(p.status)), ...lista]
  for (const p of ordenadas) {
    if (p?.creditCard?.creditCardToken) {
      return { token: p.creditCard.creditCardToken, origem: `cobrança ${p.id}` }
    }
    try {
      const full = await asaas(`/payments/${p.id}`)
      if (full?.creditCard?.creditCardToken) {
        return { token: full.creditCard.creditCardToken, origem: `cobrança ${p.id}` }
      }
    } catch {
      // ignora e tenta a próxima
    }
  }
  return null
}

/** Cobranças ainda em aberto de uma assinatura (pendentes ou vencidas). */
async function cobrancasEmAberto(subscriptionId: string) {
  const resp = await asaas(`/payments?subscription=${subscriptionId}&limit=100`)
  return (resp?.data || []).filter((p: any) => ABERTAS.includes(p.status))
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T23:59:59-03:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export async function POST(req: Request) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 403 })
  }

  const svc = createServiceClient()
  const now = new Date().toISOString()
  const remoteIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '177.0.0.1'

  try {
    const {
      clinicId,
      action,
      nextDueDate,
      value,
      cycle,
      manterAcesso = true,
      cancelarCobrancasAbertas = true,
    } = await req.json()

    if (!clinicId || !['suspend', 'resume', 'create'].includes(action)) {
      return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const { data: sub } = await svc
      .from('clinic_subscriptions')
      .select(
        'clinic_id, asaas_customer_id, asaas_subscription_id, plan_name, plan_price, billing_cycle, status'
      )
      .eq('clinic_id', clinicId)
      .maybeSingle()

    if (!sub?.asaas_customer_id) {
      return NextResponse.json(
        { ok: false, error: 'Clínica sem customer na Asaas. Envie o link de pagamento primeiro.' },
        { status: 400 }
      )
    }

    const valor = Number(value ?? sub.plan_price) || 0
    const ciclo = cycle || sub.billing_cycle || 'MONTHLY'
    const descricao = `Assinatura ${sub.plan_name || 'Clinike'} do Clinike`

    // ─────────────────────────────────────────── SUSPENDER
    if (action === 'suspend') {
      const detalhes: string[] = []

      // Pega todas as assinaturas do customer, não só a gravada no banco —
      // já aconteceu de existir assinatura duplicada cobrando em paralelo.
      const resp = await asaas(`/subscriptions?customer=${sub.asaas_customer_id}&limit=20`)
      const ativas: any[] = (resp?.data || []).filter((s: any) => s.status === 'ACTIVE')

      if (ativas.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Nenhuma assinatura ativa na Asaas para suspender.' },
          { status: 400 }
        )
      }

      for (const s of ativas) {
        try {
          await asaas(`/subscriptions/${s.id}`, { status: 'INACTIVE' }, 'PUT')
          detalhes.push(`assinatura ${s.id} inativada`)
        } catch (e: any) {
          // Plano B: a Asaas não aceitou inativar por PUT — remove a assinatura.
          // A reativação recria com o token do cartão, sem incomodar a clínica.
          await asaas(`/subscriptions/${s.id}`, undefined, 'DELETE')
          detalhes.push(`assinatura ${s.id} removida (PUT recusado: ${e.message})`)
        }

        if (cancelarCobrancasAbertas) {
          const abertas = await cobrancasEmAberto(s.id)
          for (const p of abertas) {
            try {
              await asaas(`/payments/${p.id}`, undefined, 'DELETE')
              detalhes.push(`cobrança ${p.id} (venc. ${p.dueDate}) cancelada`)
            } catch (e: any) {
              detalhes.push(`falha ao cancelar cobrança ${p.id}: ${e.message}`)
            }
          }
        }
      }

      await svc
        .from('clinic_subscriptions')
        .update({
          status: 'suspended',
          suspended_at: now,
          next_charge_at: cancelarCobrancasAbertas ? null : undefined,
          next_charge_value: cancelarCobrancasAbertas ? null : undefined,
          next_charge_status: cancelarCobrancasAbertas ? null : undefined,
          updated_at: now,
        })
        .eq('clinic_id', clinicId)

      if (manterAcesso) {
        await svc
          .from('clinics')
          .update({ plan_expires_at: ACESSO_SUSPENSO_ATE })
          .eq('id', clinicId)
      }

      await svc.from('clinic_payment_events').insert({
        clinic_id: clinicId,
        event: 'SUBSCRIPTION_INACTIVATED',
        asaas_subscription_id: ativas[0]?.id || sub.asaas_subscription_id,
        source: 'admin',
        occurred_at: now,
        raw: { detalhes, manterAcesso, cancelarCobrancasAbertas },
      })

      return NextResponse.json({ ok: true, action, detalhes })
    }

    // ─────────────────────────────────────────── REATIVAR / CRIAR RECORRÊNCIA
    if (!nextDueDate) {
      return NextResponse.json(
        { ok: false, error: 'Informe a data da próxima cobrança.' },
        { status: 400 }
      )
    }
    if (valor <= 0) {
      return NextResponse.json({ ok: false, error: 'Valor inválido.' }, { status: 400 })
    }

    const resp = await asaas(`/subscriptions?customer=${sub.asaas_customer_id}&limit=20`)
    const todas: any[] = resp?.data || []
    const ativas = todas.filter((s: any) => s.status === 'ACTIVE')

    // Trava anti cobrança duplicada — já houve caso de 2 assinaturas ativas no
    // mesmo customer cobrando R$189,90 cada.
    if (action === 'create' && ativas.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Já existe assinatura ATIVA na Asaas (${ativas
            .map((s) => s.id)
            .join(', ')}). Use Suspender/Reativar em vez de criar outra.`,
        },
        { status: 409 }
      )
    }

    let subscriptionId: string | null = null
    const detalhes: string[] = []

    // 1. Tenta reativar a assinatura existente (caminho do "resume")
    const alvo =
      todas.find((s: any) => s.id === sub.asaas_subscription_id) ||
      todas.find((s: any) => s.status === 'INACTIVE') ||
      null

    if (action === 'resume' && alvo) {
      try {
        const upd = await asaas(
          `/subscriptions/${alvo.id}`,
          { status: 'ACTIVE', nextDueDate, value: valor, cycle: ciclo },
          'PUT'
        )
        subscriptionId = upd.id
        detalhes.push(`assinatura ${upd.id} reativada`)
      } catch (e: any) {
        detalhes.push(`reativação por PUT falhou (${e.message}) — recriando com o cartão salvo`)
      }
    }

    // 2. Recria com o cartão já tokenizado
    if (!subscriptionId) {
      const card = await findCardToken(sub.asaas_customer_id)
      if (!card) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Nenhum cartão tokenizado encontrado na Asaas para esta clínica. Gere um novo link de checkout para ela cadastrar o cartão.',
          },
          { status: 400 }
        )
      }
      const nova = await asaas('/subscriptions', {
        customer: sub.asaas_customer_id,
        billingType: 'CREDIT_CARD',
        value: valor,
        nextDueDate,
        cycle: ciclo,
        description: descricao,
        creditCardToken: card.token,
        remoteIp,
      })
      subscriptionId = nova.id
      detalhes.push(`assinatura ${nova.id} criada com o cartão de ${card.origem}`)
    }

    await svc
      .from('clinic_subscriptions')
      .update({
        asaas_subscription_id: subscriptionId,
        status: 'active',
        suspended_at: null,
        payment_method: 'CREDIT_CARD',
        plan_price: valor,
        billing_cycle: ciclo,
        next_charge_at: nextDueDate,
        next_charge_value: valor,
        next_charge_status: 'PENDING',
        card_registered_at: now,
        updated_at: now,
      })
      .eq('clinic_id', clinicId)

    // Mesma carência de 5 dias que o sync aplica
    await svc
      .from('clinics')
      .update({ plan_expires_at: addDays(nextDueDate, 5) })
      .eq('id', clinicId)

    await svc.from('clinic_payment_events').insert({
      clinic_id: clinicId,
      event: 'PAYMENT_CREATED',
      asaas_subscription_id: subscriptionId,
      billing_type: 'CREDIT_CARD',
      value: valor,
      due_date: nextDueDate,
      payment_status: 'PENDING',
      source: 'admin',
      occurred_at: now,
      raw: { action, detalhes },
    })

    return NextResponse.json({ ok: true, action, subscriptionId, detalhes })
  } catch (e: any) {
    console.error('[asaas/subscription]', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
