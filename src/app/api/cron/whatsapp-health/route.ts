import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { ensureWebhookHealthy, getConnectionState, fetchInstanceOwnerPhone } from '@/lib/evolution'
import {
  sendWhatsappDownEmail,
  sendWhatsappRecoveredEmail,
  FOUNDER_ALERT_EMAIL,
} from '@/lib/email'
import { cronsEnabled } from '@/lib/cron-guard'

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
  disconnect_detected_at: string | null
  disconnect_email_sent_at: string | null
  disconnect_clinic_email_sent_at: string | null
}

type PendingAlert = {
  kind: 'down' | 'recovered'
  audience: 'founder' | 'clinic' | 'both'
  clinicId: string
  instanceName: string
  phoneNumber: string | null
  reason: string | null
  downSince: string
}

const STALE_HOURS = 24
const STALE_MS = STALE_HOURS * 60 * 60 * 1000

// A clinica so e avisada depois desse tempo de queda confirmada. Colchao contra
// falso positivo: o connectionState da Evolution ja retornou 'close' pra instance
// que estava funcionando normal, e email errado pra dona da clinica custa mais
// caro que 45min de atraso no aviso. Voce (founder) recebe assim que confirma.
const CLINIC_ALERT_DELAY_MS = 45 * 60 * 1000
// Regra de envio: 1 email por episodio de queda, pra cada destinatario.
// Os timestamps abaixo funcionam como trava — sao zerados na reconexao, entao
// a proxima queda volta a alertar normalmente. Sem repeticao periodica: quem
// quer saber o estado atual olha o banner no painel.

export async function GET(req: NextRequest) {
  if (!(await cronsEnabled())) {
    return NextResponse.json({ disabled: true, reason: 'crons_enabled=false in app_settings' }, { status: 200 })
  }

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
    .select('id, clinic_id, instance_name, webhook_token, status, phone_number, last_event_at, health_warning, health_reason, role_inbound, role_outbound_automation, disconnect_detected_at, disconnect_email_sent_at, disconnect_clinic_email_sent_at')
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
    alerts_sent: 0,
    alerts_failed: 0,
    errors: [] as Array<{ clinic_id: string; error: string }>,
  }

  const pendingAlerts: PendingAlert[] = []

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
    // Etapa 3.5: alertas de queda por email
    // Tudo dentro de try/catch proprio — se der ruim aqui, o resto do
    // health check (inclusive o auto-fix de webhook drift) segue rodando.
    // ---------------------------------------------------------------
    let nextDetectedAt: string | null | undefined
    let nextFounderSentAt: string | null | undefined
    let nextClinicSentAt: string | null | undefined

    try {
      const nowIso = new Date(nowMs).toISOString()
      const notifiedFounder = !!r.disconnect_email_sent_at
      const notifiedClinic = !!r.disconnect_clinic_email_sent_at

      if (nextStatus === 'disconnected') {
        // Transicao fresca (estava conectado) vs backlog (ja estava caido
        // antes desse deploy / de ciclos anteriores sem detected_at gravado).
        const freshTransition = r.status === 'connected'
        const detectedAtIso = r.disconnect_detected_at ?? nowIso
        const detectedAtMs = new Date(detectedAtIso).getTime()
        if (!r.disconnect_detected_at) nextDetectedAt = nowIso

        if (!r.disconnect_email_sent_at) {
          pendingAlerts.push({
            kind: 'down',
            audience: 'founder',
            clinicId: r.clinic_id,
            instanceName: r.instance_name,
            phoneNumber: r.phone_number,
            reason: nextReason,
            downSince: detectedAtIso,
          })
          nextFounderSentAt = nowIso
        }

        // instance_not_found nao da falso positivo (a sessao sumiu mesmo do
        // servidor), entao a clinica pode ser avisada na hora — mas so se for
        // queda nova, pra nao disparar email sobre instance caida ha semanas.
        const hardFailure = nextReason === 'instance_not_found' && freshTransition
        const clinicDue =
          !r.disconnect_clinic_email_sent_at &&
          (hardFailure || nowMs - detectedAtMs >= CLINIC_ALERT_DELAY_MS)

        if (clinicDue) {
          pendingAlerts.push({
            kind: 'down',
            audience: 'clinic',
            clinicId: r.clinic_id,
            instanceName: r.instance_name,
            phoneNumber: r.phone_number,
            reason: nextReason,
            downSince: detectedAtIso,
          })
          nextClinicSentAt = nowIso
        }
      } else if (nextStatus === 'connected' && r.disconnect_detected_at) {
        // Voltou. So avisa quem chegou a receber o alerta de queda.
        if (notifiedFounder || notifiedClinic) {
          pendingAlerts.push({
            kind: 'recovered',
            audience: notifiedClinic ? (notifiedFounder ? 'both' : 'clinic') : 'founder',
            clinicId: r.clinic_id,
            instanceName: r.instance_name,
            phoneNumber: nextPhoneNumber ?? r.phone_number,
            reason: null,
            downSince: r.disconnect_detected_at,
          })
        }
        nextDetectedAt = null
        nextFounderSentAt = null
        nextClinicSentAt = null
      }
    } catch (e) {
      summary.errors.push({
        clinic_id: r.clinic_id,
        error: `alert: ${e instanceof Error ? e.message : 'unknown'}`,
      })
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
    if (nextDetectedAt !== undefined) updatePayload.disconnect_detected_at = nextDetectedAt
    if (nextFounderSentAt !== undefined) updatePayload.disconnect_email_sent_at = nextFounderSentAt
    if (nextClinicSentAt !== undefined) updatePayload.disconnect_clinic_email_sent_at = nextClinicSentAt

    const { error: errUpd } = await svc
      .from('clinic_whatsapp')
      .update(updatePayload)
      .eq('id', r.id)

    if (errUpd) {
      summary.errors.push({ clinic_id: r.clinic_id, error: `update: ${errUpd.message}` })
    }
  }

  // -------------------------------------------------------------------
  // Etapa 4: envio dos emails, fora do loop e em paralelo, pra nao somar
  // ~500ms de Resend por instancia no tempo de execucao da funcao.
  // -------------------------------------------------------------------
  if (pendingAlerts.length > 0) {
    try {
      const clinicIds = Array.from(new Set(pendingAlerts.map((a) => a.clinicId)))

      const { data: clinicRows } = await svc
        .from('clinics')
        .select('id, name')
        .in('id', clinicIds)
        .is('deleted_at', null)

      const { data: adminRows } = await svc
        .from('users')
        .select('clinic_id, email')
        .in('clinic_id', clinicIds)
        .eq('role', 'admin')
        .eq('active', true)
        .is('deleted_at', null)

      const clinicName = new Map<string, string>()
      for (const c of (clinicRows as Array<{ id: string; name: string }> | null) ?? []) {
        clinicName.set(c.id, c.name)
      }

      const clinicAdmins = new Map<string, string[]>()
      for (const u of (adminRows as Array<{ clinic_id: string; email: string | null }> | null) ?? []) {
        if (!u.email) continue
        const list = clinicAdmins.get(u.clinic_id) ?? []
        if (!list.includes(u.email)) list.push(u.email)
        clinicAdmins.set(u.clinic_id, list)
      }

      const jobs = pendingAlerts.map(async (a) => {
        // Clinica deletada: nao alerta ninguem (evita ruido de tenant morto).
        const name = clinicName.get(a.clinicId)
        if (!name) return

        const admins = clinicAdmins.get(a.clinicId) ?? []

        if (a.kind === 'down') {
          const to = a.audience === 'founder' ? [FOUNDER_ALERT_EMAIL] : admins
          if (!to.length) return
          await sendWhatsappDownEmail({
            to,
            clinicName: name,
            audience: a.audience === 'clinic' ? 'clinic' : 'founder',
            instanceName: a.instanceName,
            phoneNumber: a.phoneNumber,
            reason: a.reason,
            downSince: a.downSince,
          })
          return
        }

        const to: string[] = []
        if (a.audience === 'founder' || a.audience === 'both') to.push(FOUNDER_ALERT_EMAIL)
        if (a.audience === 'clinic' || a.audience === 'both') to.push(...admins)
        if (!to.length) return
        await sendWhatsappRecoveredEmail({
          to: Array.from(new Set(to)),
          clinicName: name,
          phoneNumber: a.phoneNumber,
          downSince: a.downSince,
        })
      })

      const results = await Promise.allSettled(jobs)
      for (const res of results) {
        if (res.status === 'fulfilled') {
          summary.alerts_sent++
        } else {
          summary.alerts_failed++
          console.error('[cron/whatsapp-health] falha ao enviar alerta:', res.reason)
        }
      }
    } catch (e) {
      console.error('[cron/whatsapp-health] bloco de alertas falhou:', e)
      summary.alerts_failed += pendingAlerts.length
    }
  }

  return NextResponse.json({ ok: true, ...summary })
}
