import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/whatsapp/unstick-incident-batch?confirm=1
 *
 * Segunda leva do incidente 10/ago/2026 (sessões zumbi ~00:17-13:01).
 * Cruzando *_sent_at contra eva_conversations (só grava em envio com
 * sucesso real), confirmamos que TODAS as 55 mensagens de agendamento
 * marcadas como enviadas nessa janela na verdade falharam silenciosamente.
 *
 * Em vez de reenviar na mão (reimplementando template/botões), só
 * destranca a fila — os crons de produção (appointment-reminders,
 * appointment-reminder-2h, msg-agendamento) pegam sozinhos no próximo
 * ciclo, já com o fallback sem presence.
 *
 * Escopo (ver conversa 10/ago pra lista completa com nomes):
 *  - 35 confirmações (confirma 24h, pra amanha 11/08) — confirmation_sent_at = null
 *  - 4 lembretes de 2h AINDA no futuro — reminder_2h_sent_at = null
 *    (8 outros do mesmo lote já passaram do horário do atendimento,
 *    ficam de fora de propósito — reenviar "daqui a 2h" depois do horário
 *    não faz sentido)
 *  - 5 confirmações de agendamento novo — agendamento_sent_at = null,
 *    agendamento_scheduled_at = now() (Mariana Dantas já foi tratada à parte
 *    em resend-incident-10ago)
 *
 * Rota descartável — remover depois de confirmar que os crons pegaram tudo.
 */

const CONFIRMATION_IDS = [
  'fe92109b-7001-4192-a61e-053b902f77ee',
  '13232443-be3c-4fae-8bc2-8758e1840059',
  '22b42104-f77e-4bae-a4e0-3ce9cf3c4a24',
  '155aba63-d257-4441-a13f-de528816a6a8',
  '184ddd1e-bb3f-4f77-8bc7-4c9c57ddb5ac',
  'e3e44a08-23a9-4b12-b03a-4128d5f05f6c',
  'aa612d68-412a-4542-9d1b-ab4c7af9f273',
  '27ada617-984d-4388-98d6-e20fb3891d66',
  '9b1e2d22-4a7a-4020-aa98-b590d21d4b94',
  'ceae02c9-59d0-45b3-b0d8-e5cc8e69a366',
  'e942409f-9dd4-4e1b-a9ff-e3f6478eb2bd',
  'a123547a-4bd4-4449-9c86-08a99f7ceff5',
  '91387c7b-2161-444a-9ad4-95fda082e108',
  '5e0807e7-6e90-4b19-aa3a-f6de3339ae20',
  '23fa254b-f5a3-40e1-9947-a107329906fa',
  '65525837-2a96-41ec-ab4e-1510b559d7c4',
  '69acbb90-a7de-44ae-abe9-853e99ebbd5c',
  'd2fa0808-612c-461b-90dd-902b17540594',
  '282233a9-679a-431e-86a8-9459d9fb4c0b',
  'bcdfc800-6eac-4aba-a426-9785eafe981d',
  '26fe62f6-d12a-4fd6-b892-466133d179d2',
  '340a6054-7611-46e7-83d9-6927499823b0',
  '0d620cb4-c9f8-4ef7-8be0-01e1a8acc2ec',
  '7242e319-7ea2-4e0d-9dbd-ff90be90cbdb',
  '6089f3ad-3a22-4060-89fb-28638926eb72',
  'e7913cc0-c7a1-4153-b680-4e1ed067296b',
  '6f652073-96e4-476c-9146-8b5e4accc4f5',
  '16daa475-af3f-423a-b9ff-458a975670a8',
  '66398974-acff-4c02-b6b5-33a43bf2dcd9',
  'dec5529e-e3b6-48b5-9bc9-d6a64d2db3eb',
  '124c2ed1-595b-4f9f-a113-fbe415e9bce9',
  '5fcd0047-4d78-4585-b257-e14fb670b172',
  '0172d5b2-f0f7-4153-8cd7-8e4433e91932',
  '68d8e056-9c70-418f-9af7-859813509443',
  '11f322f7-216e-4f3c-a457-7de64554e627',
]

const REMINDER_2H_IDS = [
  '9873ebd1-daf0-4212-8fbe-c36cfe25a0cc',
  'af9fed40-1a22-48d5-acad-8ad7f41a1824',
  '563727d9-825c-4f46-807e-b1532635dcd9',
  'b0e44ef7-29d0-434c-be94-da7fe815647d',
]

const AGENDAMENTO_IDS = [
  'd2d20dfd-a1cf-477b-b5d9-400b3fcb894d',
  '614f980d-392a-4057-ba15-7e9125e1e654',
  'f220d6a4-5384-4f0a-90a9-76f66f768eda',
  'df33d5e7-471e-4ecd-a4c7-844012cf5d3d',
  '9c01ea1b-2ab7-4233-8665-d448fb5e6e38',
]

export async function GET(req: NextRequest) {
  const ok = await isSuperAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const confirm = req.nextUrl.searchParams.get('confirm')
  if (confirm !== '1') {
    return new NextResponse(
      `<!doctype html><html><body style="font-family:sans-serif;padding:24px">
        <h3>Destravar lote — incidente 10/ago</h3>
        <p>${CONFIRMATION_IDS.length} confirmações + ${REMINDER_2H_IDS.length} lembretes de 2h + ${AGENDAMENTO_IDS.length} confirmações de agendamento novo</p>
        <p>Volta pra fila dos crons de produção, sem reenvio manual.</p>
        <p><a href="?confirm=1" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;border-radius:8px;text-decoration:none">Confirmar e rodar</a></p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  const svc = createServiceClient()
  const log: string[] = []

  const { data: c1, error: e1 } = await svc
    .from('appointments')
    .update({ confirmation_sent_at: null })
    .in('id', CONFIRMATION_IDS)
    .select('id')

  log.push(
    e1
      ? `[confirmations] ERRO: ${e1.message}`
      : `[confirmations] ${c1?.length ?? 0}/${CONFIRMATION_IDS.length} destravadas`,
  )

  const { data: c2, error: e2 } = await svc
    .from('appointments')
    .update({ reminder_2h_sent_at: null })
    .in('id', REMINDER_2H_IDS)
    .select('id')

  log.push(
    e2
      ? `[reminder_2h] ERRO: ${e2.message}`
      : `[reminder_2h] ${c2?.length ?? 0}/${REMINDER_2H_IDS.length} destravadas`,
  )

  const { data: c3, error: e3 } = await svc
    .from('appointments')
    .update({ agendamento_sent_at: null, agendamento_scheduled_at: new Date().toISOString() })
    .in('id', AGENDAMENTO_IDS)
    .select('id')

  log.push(
    e3
      ? `[agendamento] ERRO: ${e3.message}`
      : `[agendamento] ${c3?.length ?? 0}/${AGENDAMENTO_IDS.length} destravadas`,
  )

  log.push('')
  log.push('Confirmações e lembretes de 2h: entram no próximo ciclo do cron (a cada 5min, respeitando o horário configurado de cada clínica).')
  log.push('Agendamento: cron /api/cron/msg-agendamento pega em até 5min.')

  return new NextResponse(
    `<!doctype html><html><body style="font-family:sans-serif;padding:24px;white-space:pre-wrap">
      <h3>Resultado</h3>
      ${log.map((l) => `<div>${l.replace(/</g, '&lt;')}</div>`).join('')}
    </body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
