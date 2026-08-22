import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { ensureWebhookHealthy, getConnectionState, fetchInstanceOwnerPhone } from '@/lib/evolution'

/**
 * GET /api/cron/whatsapp-health
 *
 * Roda 4x por hora (a cada 15min). Pra cada clinic_whatsapp:
 *  1. Confere o webhook salvo na Evolution vs URL esperada (NEXT_PUBLIC_APP_URL).
 *     Se diferente, AUTO-CORRIGE chamando setInstanceWebhook (essa eh a causa
 *     classica de "WhatsApp parou de receber mensagens" apos mudanca de dominio).
 *  2. Chama getConnectionState pra detectar phantom session / instance sumida.
 *
 * Resultados sao gravados em clinic_whatsapp.* (health_warning, health_reason,
 * webhook_actual_url, webhook_expected_url, webhook_last_fixed_at) pro banner
 * exibir alerta E pra debug em historico.
 *
 * Auth: Header Authorization: Bearer ${CRON_SECRET}.
 */

type Row = {
  id: string
  clinic_id: string
  instance_name: string | null
  webhook_token: string | null
  status: string
  phone_number: string | null
  last_event_at: string | null
  health_warning: boolean | null
  health_reason: string | null
  role_inbound: boolean | null
  role_outbound_automation: boolean | null
  disconnect_whatsapp_sent_at: string | null
}

type PendingWhatsappAlert = {
  clinicId: string
}

const STALE_HOURS = 24
const STALE_MS = STALE_HOURS * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/whatsapp-health] CRON_SECRET ausente em runtime')
    return NextResponse.json({ ok: false, error: 'cron_not_configured' }, { status: 503 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()

  // So checa quem ja foi configurado (status diferente de pending e tem instance_name)
  const { data: rows, error } = await svc
    .from('clinic_whatsapp')
    .select('id, clinic_id, instance_name, webhook_token, status, phone_number, last_event_at, health_warning, health_reason, role_inbound, role_outbound_automation, disconnect_whatsapp_sent_at')
    .not('instance_name', 'is', null)
    .in('status', ['connected', 'qr_pending', 'disconnected', 'error'])

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const list = (rows as Row[] | null) ?? []

  const summary = {
    total: list.length,
    healthy: 0,
    phantom_session: 0,
    stale_no_events: 0,
    auto_disconnected: 0,
    webhook_drift_fixed: 0,
    webhook_drift_failed: 0,
    skipped: 0,
    whatsapp_alerts_sent: 0,
    whatsapp_alerts_failed: 0,
    errors: [] as Array<{ clinic_id: string; error: string }>,
  }

  const pendingWhatsappAlerts: PendingWhatsappAlert[] = []

  const nowMs = Date.now()

  for (const r of list) {
    if (!r.instance_name) {
      summary.skipped++
      continue
    }

    // ---------------------------------------------------------------
    // Etapa 1: drift check da URL do webhook
    // (so faz sentido se a instance ainda existe — abaixo pulamos
    //  caso o connectionState retorne 404)
    // ---------------------------------------------------------------
    let webhookActual: string | null = null
    let webhookExpected: string | null = null
    let webhookFixed = false
    let webhookFixError: string | null = null

    if (r.webhook_token) {
      try {
        const w = await ensureWebhookHealthy({
          instanceName: r.instance_name,
          webhookToken: r.webhook_token,
        })
        webhookActual = w.actualUrl
        webhookExpected = w.expectedUrl
        if (w.drift) {
          if (w.fixed) {
            summary.webhook_drift_fixed++
            webhookFixed = true
          } else {
            summary.webhook_drift_failed++
            webhookFixError = w.error
          }
        }
      } catch (e) {
        webhookFixError = e instanceof Error ? e.message : 'unknown'
      }
    }

    // ---------------------------------------------------------------
    // Etapa 2: connection state probe
    // ---------------------------------------------------------------
    const probe = await getConnectionState(r.instance_name)

    let nextStatus = r.status
    let nextWarning = false
    let nextReason: string | null = null
    let nextPhoneNumber: string | null = null

    if (!probe.ok) {
      if (probe.status === 404) {
        nextStatus = 'disconnected'
        nextWarning = true
        nextReason = 'instance_not_found'
        summary.auto_disconnected++
      } else {
        nextWarning = true
        nextReason = `evolution_error:${probe.error?.slice(0, 80) ?? 'unknown'}`
        summary.errors.push({ clinic_id: r.clinic_id, error: probe.error || 'unknown' })
      }
    } else {
      const evoState = probe.data.instance?.state ?? 'unknown'

      if (evoState === 'close' || evoState === 'unknown') {
        // Sinal de vida mais confiavel que o connectionState da Evolution:
        // se chegou mensagem/evento recente (ultimos 10min), a sessao esta
        // viva de verdade, independente do que essa leitura de API disse.
        // Visto em producao: connectionState retornando close/unknown
        // persistentemente pra uma instance que o proprio painel da Evolution
        // mostra "Connected" e que segue recebendo mensagens normalmente.
        const lastMsRecent = r.last_event_at ? new Date(r.last_event_at).getTime() : 0
        const recentActivity = lastMsRecent > 0 && nowMs - lastMsRecent < 10 * 60 * 1000

        if (recentActivity) {
          if (r.status !== 'connected') {
            nextStatus = 'connected'
          }
          nextWarning = false
          nextReason = null
          summary.healthy++
        } else {
          // Debounce: so trata como queda real (muda status + acende banner) se
          // JA estavamos com esse mesmo motivo no ciclo anterior (2 leituras ruins
          // seguidas, ~15min de intervalo). Uma leitura isolada costuma ser
          // instabilidade momentanea da Evolution/Railway, nao queda de fato —
          // isso causava status flapping (conectado/desconectado a cada ciclo).
          const wasAlreadyFlagged = r.health_reason === 'evolution_state_close'
          if (wasAlreadyFlagged) {
            if (r.status === 'connected') {
              nextStatus = 'disconnected'
              summary.auto_disconnected++
            }
            nextWarning = true
            summary.phantom_session++
          } else {
            summary.skipped++
          }
          nextReason = 'evolution_state_close'
        }
      } else if (evoState === 'open') {
        if (r.status !== 'connected') {
          nextStatus = 'connected'
        }

        // Sem phone_number, o trigger trg_prevent_connected_without_phone
        // reverte status pra 'disconnected' silenciosamente (sem erro) —
        // busca o numero agora se ainda nao tiver (ex: logo apos conectar
        // via QR, antes de qualquer evento de webhook chegar).
        if (!r.phone_number) {
          try {
            const owner = await fetchInstanceOwnerPhone(r.instance_name)
            if (owner.ok && owner.data.phoneNumber) {
              nextPhoneNumber = owner.data.phoneNumber
            }
          } catch {
            // best-effort — se falhar, tenta de novo no proximo ciclo
          }
        }

        // Instancia outbound-only: nao recebe msgs, nao verificar stale
        if (r.role_inbound === false || (r.role_outbound_automation === true && !r.role_inbound)) {
          summary.healthy++
        } else {
          const lastMs = r.last_event_at ? new Date(r.last_event_at).getTime() : 0
          const ageMs = nowMs - lastMs

          if (lastMs > 0 && ageMs > STALE_MS) {
            nextWarning = true
            nextReason = `no_events_${Math.floor(ageMs / (60 * 60 * 1000))}h`
            summary.stale_no_events++
          } else {
            summary.healthy++
          }
        }
      } else if (evoState === 'connecting') {
        nextStatus = 'qr_pending'
        nextWarning = false
        nextReason = null
      }
    }

    // ---------------------------------------------------------------
    // Etapa 3: drift do webhook tem prioridade no banner se aconteceu
    // (o admin precisa saber, mesmo que ja tenhamos auto-corrigido)
    // ---------------------------------------------------------------
    if (webhookFixed) {
      nextWarning = true
      nextReason = 'webhook_url_drift_fixed'
    } else if (webhookFixError) {
      nextWarning = true
      nextReason = `webhook_drift_error:${webhookFixError.slice(0, 60)}`
      summary.errors.push({
        clinic_id: r.clinic_id,
        error: `webhook drift: ${webhookFixError}`,
      })
    }

    // ---------------------------------------------------------------
    // Etapa 3.5: aviso de desconexao via WhatsApp pra propria clinica.
    // Dispara 1x por episodio de queda (trava: disconnect_whatsapp_sent_at,
    // zerada na reconexao). Sem delay extra aqui — nextStatus so vira
    // 'disconnected' depois do debounce anti-flapping ja feito na Etapa 2.
    // ---------------------------------------------------------------
    let nextWhatsappSentAt: string | null | undefined

    if (nextStatus === 'disconnected') {
      if (!r.disconnect_whatsapp_sent_at) {
        pendingWhatsappAlerts.push({ clinicId: r.clinic_id })
        nextWhatsappSentAt = new Date(nowMs).toISOString()
      }
    } else if (nextStatus === 'connected' && r.disconnect_whatsapp_sent_at) {
      nextWhatsappSentAt = null
    }

    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      health_warning: nextWarning,
      health_reason: nextReason,
      health_checked_at: new Date().toISOString(),
    }
    if (webhookActual !== null) updatePayload.webhook_actual_url = webhookActual
    if (webhookExpected !== null) updatePayload.webhook_expected_url = webhookExpected
    if (webhookFixed) updatePayload.webhook_last_fixed_at = new Date().toISOString()
    if (nextPhoneNumber) updatePayload.phone_number = nextPhoneNumber
    if (nextWhatsappSentAt !== undefined) updatePayload.disconnect_whatsapp_sent_at = nextWhatsappSentAt

    const { error: errUpd } = await svc
      .from('clinic_whatsapp')
      .update(updatePayload)
      .eq('id', r.id)

    if (errUpd) {
      summary.errors.push({ clinic_id: r.clinic_id, error: `update: ${errUpd.message}` })
    }
  }

  // -------------------------------------------------------------------
  // Etapa 4: envio dos avisos de desconexao via WhatsApp — manda pro
  // telefone da propria clinica, pela instancia admin (clinike_billing_instance),
  // ja que a instancia da clinica esta caida. So dispara na queda, nunca na
  // reconexao (o banner do painel ja mostra o status atual).
  // -------------------------------------------------------------------
  if (pendingWhatsappAlerts.length > 0) {
    try {
      const clinicIds = Array.from(new Set(pendingWhatsappAlerts.map((a) => a.clinicId)))

      const [{ data: clinicRows }, { data: settingsRows }] = await Promise.all([
        svc
          .from('clinics')
          .select('id, name, clinic_phone')
          .in('id', clinicIds)
          .is('deleted_at', null),
        svc
          .from('app_settings')
          .select('key, value')
          .in('key', ['evolution_url', 'evolution_master_key', 'clinike_billing_instance']),
      ])

      const cfg: Record<string, string> = {}
      for (const s of (settingsRows as Array<{ key: string; value: string }> | null) ?? []) {
        cfg[s.key] = s.value
      }
      const evUrl = cfg['evolution_url'] || 'https://evolution-api-production-7853.up.railway.app'
      const evKey = cfg['evolution_master_key'] || ''
      const instance = cfg['clinike_billing_instance'] || ''

      if (!instance) {
        summary.whatsapp_alerts_failed += clinicIds.length
        console.error('[cron/whatsapp-health] clinike_billing_instance nao configurada, pulando avisos WhatsApp')
      } else {
        const clinics = (clinicRows as Array<{ id: string; name: string; clinic_phone: string | null }> | null) ?? []

        const jobs = clinics.map(async (c) => {
          if (!c.clinic_phone) return
          const phone = String(c.clinic_phone).replace(/\D/g, '')
          const phoneFmt = phone.startsWith('55') ? phone : `55${phone}`
          const texto =
            `⚠️ Seu WhatsApp da Clinike foi desconectado. ` +
            `Reconecte para que os lembretes e automações voltem a funcionar.`

          const resp = await fetch(`${evUrl}/message/sendText/${instance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: evKey },
            body: JSON.stringify({ number: phoneFmt, text: texto }),
          })
          if (!resp.ok) {
            const err = await resp.text()
            throw new Error(`Evolution API: ${err.slice(0, 200)}`)
          }
        })

        const results = await Promise.allSettled(jobs)
        for (const res of results) {
          if (res.status === 'fulfilled') {
            summary.whatsapp_alerts_sent++
          } else {
            summary.whatsapp_alerts_failed++
            console.error('[cron/whatsapp-health] falha ao enviar aviso WhatsApp:', res.reason)
          }
        }
      }
    } catch (e) {
      console.error('[cron/whatsapp-health] bloco de avisos WhatsApp falhou:', e)
      summary.whatsapp_alerts_failed += pendingWhatsappAlerts.length
    }
  }

  return NextResponse.json({ ok: true, ...summary })
}
