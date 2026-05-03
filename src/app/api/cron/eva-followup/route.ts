import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/app-settings'

/**
 * GET /api/cron/eva-followup
 *
 * Roda a cada 30min. Pra cada lead com eva_next_followup_at <= now() (e que
 * não foi convertido nem perdido), chama a Edge Function eva-process com
 * isFollowup=true pra Eva gerar uma mensagem proativa de retomada.
 *
 * Tempos (5 estágios):
 *   t0 (paciente parou de responder) → +2h cron envia #1 (count vira 1)
 *   +24h depois → cron envia #2 (count vira 2)
 *   +48h depois → cron envia #3 (count vira 3)
 *   +5d depois → cron envia #4 (count vira 4)
 *   +10d depois → cron envia #5 (count vira 5)
 *   após #5 sem resposta → marca status='lost', lost_reason='sem_resposta_18d'
 *
 * Lead com needs_human_review=true NÃO recebe follow-up (humano cuida).
 *
 * Janela de envio: 8h-21h, segunda a sábado (BRT). Domingo e madrugada
 * pulamos — a fila não anda, o lead aguarda no horário comercial seguinte.
 */

const TZ_BR = 'America/Sao_Paulo'
const DEFAULT_LIMIT = 50

type LeadRow = {
  id: string
  clinic_id: string
  name: string
  phone: string | null
  status: string | null
  eva_followup_count: number | null
  eva_next_followup_at: string | null
  whatsapp_opt_in: boolean | null
}

type ClinicWaRow = { clinic_id: string; instance_name: string; status: string }

function isWithinSendingWindow(now = new Date()): boolean {
  // Hora/dia em BRT
  const br = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_BR,
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const wd = br.find((p) => p.type === 'weekday')?.value ?? '' // Mon..Sun
  const hh = parseInt(br.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const blockedDay = wd === 'Sun'
  if (blockedDay) return false
  return hh >= 8 && hh < 21
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'cron_not_configured' }, { status: 503 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry') === '1'
  const force = url.searchParams.get('force') === '1' // ignora janela 8-21
  const limit = Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10))

  if (!force && !isWithinSendingWindow()) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      reason: 'fora_da_janela_8h_21h_seg_sab',
    })
  }

  const svc = createServiceClient()

  // 1) Lê motor da Eva — só faz follow-up se o motor estiver na Edge Function
  const settings = await getSettings(['eva_engine', 'eva_edge_url'])
  const engine = (settings.eva_engine || 'n8n').toLowerCase()
  if (engine !== 'edge') {
    return NextResponse.json({ ok: true, processed: 0, reason: 'eva_engine_off_or_legacy' })
  }
  const edgeUrl = settings.eva_edge_url
  if (!edgeUrl) {
    return NextResponse.json({ ok: false, error: 'eva_edge_url_missing' }, { status: 500 })
  }

  // 2) Busca leads prontos pra follow-up.
  // Exclui: convertidos, perdidos, e quem ja foi escalado pra humano.
  const { data: leads, error: errLeads } = await svc
    .from('leads')
    .select('id, clinic_id, name, phone, status, eva_followup_count, eva_next_followup_at, whatsapp_opt_in, needs_human_review')
    .lte('eva_next_followup_at', new Date().toISOString())
    .not('eva_next_followup_at', 'is', null)
    .not('status', 'in', '(converted,lost)')
    .or('needs_human_review.is.null,needs_human_review.eq.false')
    .or('whatsapp_opt_in.is.null,whatsapp_opt_in.eq.true')
    .limit(limit)

  if (errLeads) {
    return NextResponse.json(
      { ok: false, stage: 'load_leads', error: errLeads.message },
      { status: 500 },
    )
  }

  const queue = (leads as LeadRow[] | null) ?? []
  if (queue.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, reason: 'queue_empty' })
  }

  // 3) Pra cada clínica, valida que o WhatsApp está conectado
  const clinicIds = Array.from(new Set(queue.map((l) => l.clinic_id)))
  const { data: waList } = await svc
    .from('clinic_whatsapp')
    .select('clinic_id, instance_name, status')
    .in('clinic_id', clinicIds)
  const waByClinic = new Map<string, ClinicWaRow>()
  for (const w of (waList as ClinicWaRow[] | null) ?? []) waByClinic.set(w.clinic_id, w)

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!serviceRoleKey) {
    return NextResponse.json({ ok: false, error: 'service_role_missing' }, { status: 500 })
  }

  const results: Array<{
    lead_id: string
    clinic_id: string
    phone: string | null
    stage: number
    skipped?: string
    sent?: boolean
    httpStatus?: number
  }> = []

  for (const lead of queue) {
    const wa = waByClinic.get(lead.clinic_id)
    if (!wa || wa.status !== 'connected') {
      results.push({
        lead_id: lead.id,
        clinic_id: lead.clinic_id,
        phone: lead.phone,
        stage: (lead.eva_followup_count ?? 0) + 1,
        skipped: 'wa_not_connected',
      })
      continue
    }
    if (!lead.phone) {
      results.push({
        lead_id: lead.id,
        clinic_id: lead.clinic_id,
        phone: null,
        stage: (lead.eva_followup_count ?? 0) + 1,
        skipped: 'no_phone',
      })
      continue
    }

    const stage = (lead.eva_followup_count ?? 0) + 1
    if (stage > 5) {
      // Defesa: se por algum motivo passou de 5 estagios, marca lost
      if (!dryRun) {
        await svc
          .from('leads')
          .update({
            status: 'lost',
            lost_reason: 'sem_resposta_18d',
            eva_next_followup_at: null,
          })
          .eq('id', lead.id)
      }
      results.push({
        lead_id: lead.id,
        clinic_id: lead.clinic_id,
        phone: lead.phone,
        stage,
        skipped: 'marked_lost_overrun',
      })
      continue
    }

    if (dryRun) {
      results.push({
        lead_id: lead.id,
        clinic_id: lead.clinic_id,
        phone: lead.phone,
        stage,
        skipped: 'dry_run',
      })
      continue
    }

    // Chama a Edge Function eva-process com isFollowup
    try {
      const r = await fetch(edgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          clinicId: lead.clinic_id,
          instance: wa.instance_name,
          phone: lead.phone,
          customerName: lead.name,
          userText: '[FOLLOWUP_AUTOMATICO]',
          kind: 'text',
          isFollowup: true,
          followupStage: stage,
        }),
      })
      results.push({
        lead_id: lead.id,
        clinic_id: lead.clinic_id,
        phone: lead.phone,
        stage,
        sent: r.ok,
        httpStatus: r.status,
      })
    } catch (err) {
      results.push({
        lead_id: lead.id,
        clinic_id: lead.clinic_id,
        phone: lead.phone,
        stage,
        skipped: `exception:${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  const sent = results.filter((r) => r.sent).length
  const skipped = results.filter((r) => r.skipped).length

  return NextResponse.json({
    ok: true,
    dryRun,
    processed: queue.length,
    sent,
    skipped,
    results,
  })
}
