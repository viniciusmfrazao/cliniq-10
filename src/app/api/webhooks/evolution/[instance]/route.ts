import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { mapEvolutionStateToStatus } from '@/lib/evolution'
import { getSettings } from '@/lib/app-settings'

/**
 * Webhook multi-tenant da Evolution.
 *
 * URL no formato: /api/webhooks/evolution/<instance_name>?token=<webhook_token>
 *
 * O <token> é único por clínica (clinic_whatsapp.webhook_token) e fica embutido
 * na URL configurada na Evolution. Se alguém tentar bater no webhook sem token
 * válido, devolvemos 401.
 */

type EvolutionEvent =
  | 'QRCODE_UPDATED'
  | 'CONNECTION_UPDATE'
  | 'MESSAGES_UPSERT'
  | string

type WebhookBody = {
  event?: EvolutionEvent
  instance?: string
  data?: Record<string, unknown>
  date_time?: string
  sender?: string
  destination?: string
}

function pickMessageText(message: unknown): string | null {
  if (!message || typeof message !== 'object') return null
  const m = message as Record<string, unknown>
  if (typeof m.conversation === 'string') return m.conversation
  const ext = m.extendedTextMessage as Record<string, unknown> | undefined
  if (ext && typeof ext.text === 'string') return ext.text
  const img = m.imageMessage as Record<string, unknown> | undefined
  if (img && typeof img.caption === 'string') return img.caption
  const vid = m.videoMessage as Record<string, unknown> | undefined
  if (vid && typeof vid.caption === 'string') return vid.caption
  if (typeof m.text === 'string') return m.text
  return null
}

function jidToPhone(jid: string | undefined | null): string | null {
  if (!jid) return null
  const cleaned = jid.split('@')[0]
  // Evolution às vezes manda formato "55349xxxxxxx:1" pra device — limpamos
  return cleaned.replace(/[^0-9]/g, '') || null
}

async function logWebhook(args: {
  svc: ReturnType<typeof createServiceClient>
  instance: string
  event?: string | null
  statusCode: number
  error?: string | null
  body?: unknown
  headers?: Record<string, string>
  query?: Record<string, string>
}) {
  try {
    await args.svc.from('evolution_webhook_logs').insert({
      instance: args.instance,
      event: args.event ?? null,
      status_code: args.statusCode,
      error: args.error ?? null,
      body: args.body ?? null,
      headers: args.headers ?? null,
      query: args.query ?? null,
    })
  } catch (e) {
    console.error('[evolution-webhook] falha ao gravar log:', e)
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ instance: string }> },
) {
  const { instance } = await context.params
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const svc = createServiceClient()

  // Captura headers e query crus pra log (limita a chaves seguras)
  const headerSnapshot: Record<string, string> = {}
  for (const [k, v] of req.headers.entries()) {
    if (/^(content-type|user-agent|x-forwarded-for|x-real-ip|host|accept|content-length)$/i.test(k)) {
      headerSnapshot[k] = v
    }
  }
  const querySnapshot: Record<string, string> = {}
  for (const [k, v] of url.searchParams.entries()) {
    querySnapshot[k] = k === 'token' ? `${v.slice(0, 4)}…(${v.length})` : v
  }

  if (!instance) {
    await logWebhook({
      svc,
      instance: 'unknown',
      statusCode: 400,
      error: 'instance ausente',
      headers: headerSnapshot,
      query: querySnapshot,
    })
    return NextResponse.json({ error: 'instance ausente' }, { status: 400 })
  }

  // Lê o body cedo (uma única vez); guarda raw mesmo se falhar
  const rawText = await req.text()
  let body: WebhookBody = {}
  let parseError: string | null = null
  try {
    body = rawText ? (JSON.parse(rawText) as WebhookBody) : {}
  } catch (e) {
    parseError = e instanceof Error ? e.message : 'JSON inválido'
  }

  if (!token) {
    await logWebhook({
      svc,
      instance,
      event: body.event,
      statusCode: 401,
      error: 'token ausente',
      body: parseError ? { __raw: rawText.slice(0, 4000), __parseError: parseError } : body,
      headers: headerSnapshot,
      query: querySnapshot,
    })
    return NextResponse.json({ error: 'token ausente' }, { status: 401 })
  }

  const { data: row } = await svc
    .from('clinic_whatsapp')
    .select('clinic_id, webhook_token, instance_name')
    .eq('instance_name', instance)
    .maybeSingle()

  if (!row || row.webhook_token !== token) {
    await logWebhook({
      svc,
      instance,
      event: body.event,
      statusCode: 401,
      error: 'token invalido ou instance nao encontrada',
      body: parseError ? { __raw: rawText.slice(0, 4000), __parseError: parseError } : body,
      headers: headerSnapshot,
      query: querySnapshot,
    })
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  if (parseError) {
    await logWebhook({
      svc,
      instance,
      statusCode: 400,
      error: `JSON inválido: ${parseError}`,
      body: { __raw: rawText.slice(0, 4000) },
      headers: headerSnapshot,
      query: querySnapshot,
    })
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const event = (body.event ?? '').toString().toUpperCase()
  const data = body.data ?? {}
  const clinicId = row.clinic_id

  // Loga TODO webhook autorizado pra debug (mantem 7 dias)
  await logWebhook({
    svc,
    instance,
    event,
    statusCode: 200,
    body,
    headers: headerSnapshot,
    query: querySnapshot,
  })

  try {
    switch (event) {
      case 'QRCODE_UPDATED': {
        const qrcode = (data as { qrcode?: { base64?: string } }).qrcode
        const base64 = qrcode?.base64 ?? null
        await svc
          .from('clinic_whatsapp')
          .update({
            status: 'qr_pending',
            qr_code: base64,
            qr_expires_at: new Date(Date.now() + 50_000).toISOString(),
            last_event_at: new Date().toISOString(),
          })
          .eq('clinic_id', clinicId)
        break
      }

      case 'CONNECTION_UPDATE': {
        const state = (data as { state?: string }).state ?? 'unknown'
        const mapped = mapEvolutionStateToStatus(state)
        const updates: Record<string, unknown> = {
          status: mapped,
          last_event_at: new Date().toISOString(),
        }
        if (mapped === 'connected') {
          updates.connected_at = new Date().toISOString()
          updates.qr_code = null
          updates.qr_expires_at = null
          // Quando conecta, o JID vem em data.wuid ou data.profilePictureUrl etc
          const phoneFromJid =
            jidToPhone((data as { wuid?: string }).wuid) ??
            jidToPhone((data as { ownerJid?: string }).ownerJid)
          if (phoneFromJid) updates.phone_number = phoneFromJid
        }
        await svc
          .from('clinic_whatsapp')
          .update(updates)
          .eq('clinic_id', clinicId)
        break
      }

      case 'MESSAGES_UPSERT': {
        const key = (data as { key?: { remoteJid?: string; fromMe?: boolean; id?: string } }).key
        const fromMe = key?.fromMe === true
        const phone = jidToPhone(key?.remoteJid)
        const text = pickMessageText((data as { message?: unknown }).message)
        const pushName = (data as { pushName?: string }).pushName
        const messageId = key?.id

        if (!phone || !text) break

        // Salva conversa multi-tenant
        await svc.from('eva_conversations').insert({
          clinic_id: clinicId,
          phone,
          role: fromMe ? 'assistant' : 'user',
          content: text,
          metadata: { evolution_message_id: messageId, push_name: pushName },
        })

        await svc
          .from('clinic_whatsapp')
          .update({ last_event_at: new Date().toISOString() })
          .eq('clinic_id', clinicId)

        // Mensagem entrante (não enviada pela clínica): atualiza CRM/Donna
        if (!fromMe) {
          // Tenta achar paciente; se não tem, garante lead
          const { data: patient } = await svc
            .from('patients')
            .select('id')
            .eq('clinic_id', clinicId)
            .eq('phone', phone)
            .maybeSingle()

          if (!patient) {
            const { data: existingLead } = await svc
              .from('leads')
              .select('id')
              .eq('clinic_id', clinicId)
              .eq('phone', phone)
              .maybeSingle()

            if (!existingLead) {
              await svc.from('leads').insert({
                clinic_id: clinicId,
                name: pushName || 'Lead WhatsApp',
                phone,
                source: 'whatsapp',
                status: 'new',
                notes: `Primeira mensagem: ${text}`,
              })
            }
          }

          // Encaminha pra Donna (N8N) se configurado
          await forwardToDonna({
            clinicId,
            phone,
            message: text,
            pushName,
          }).catch(err =>
            console.error('[evolution-webhook] forward Donna falhou:', err),
          )
        }
        break
      }

      default:
        // log silencioso
        break
    }
  } catch (err) {
    console.error('[evolution-webhook] erro processando evento', event, err)
    await logWebhook({
      svc,
      instance,
      event,
      statusCode: 500,
      error: err instanceof Error ? err.message : String(err),
      body,
      headers: headerSnapshot,
      query: querySnapshot,
    })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

async function forwardToDonna(payload: {
  clinicId: string
  phone: string
  message: string
  pushName?: string
}) {
  const { n8n_donna_url, n8n_donna_secret } = await getSettings([
    'n8n_donna_url',
    'n8n_donna_secret',
  ])
  if (!n8n_donna_url) return

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (n8n_donna_secret) headers['x-cliniq-secret'] = n8n_donna_secret

  await fetch(n8n_donna_url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      event: 'whatsapp_message_received',
      clinic_id: payload.clinicId,
      data: {
        phone: payload.phone,
        message: payload.message,
        name: payload.pushName,
      },
    }),
  })
}

// Útil pra Evolution validar a URL ao configurar
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ instance: string }> },
) {
  const { instance } = await context.params
  return NextResponse.json({ ok: true, instance })
}
