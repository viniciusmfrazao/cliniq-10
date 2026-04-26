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

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ instance: string }> },
) {
  const { instance } = await context.params
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!instance) {
    return NextResponse.json({ error: 'instance ausente' }, { status: 400 })
  }
  if (!token) {
    return NextResponse.json({ error: 'token ausente' }, { status: 401 })
  }

  const svc = createServiceClient()

  const { data: row } = await svc
    .from('clinic_whatsapp')
    .select('clinic_id, webhook_token, instance_name')
    .eq('instance_name', instance)
    .maybeSingle()

  if (!row || row.webhook_token !== token) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  let body: WebhookBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const event = (body.event ?? '').toString().toUpperCase()
  const data = body.data ?? {}
  const clinicId = row.clinic_id

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
