import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Gera lembretes (sininho) para follow-ups MANUAIS cujo horário chegou.
 * Cria uma notificação para quem agendou o follow-up (created_by); se não
 * houver, notifica todos os usuários ativos da clínica. Usa lead_followups.reminded_at
 * para não reprocessar o mesmo follow-up. Roda a cada 15min.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()

  // Follow-ups cujo horário chegou, ainda não concluídos e ainda não lembrados.
  const { data: due, error } = await svc
    .from('lead_followups')
    .select('id, clinic_id, lead_id, created_by, note, lead:leads(name, phone)')
    .lte('scheduled_at', new Date().toISOString())
    .is('done_at', null)
    .is('reminded_at', null)
    .order('scheduled_at', { ascending: true })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!due?.length) {
    return NextResponse.json({ ok: true, reminded: 0, notifications: 0 })
  }

  // Para follow-ups sem created_by, busca os usuários ativos da clínica (fallback).
  const clinicsNeedingUsers = Array.from(
    new Set(due.filter(f => !f.created_by).map(f => f.clinic_id)),
  )
  const clinicUsers: Record<string, string[]> = {}
  if (clinicsNeedingUsers.length) {
    const { data: users } = await svc
      .from('users')
      .select('id, clinic_id')
      .in('clinic_id', clinicsNeedingUsers)
      .eq('active', true)
      .is('deleted_at', null)
    for (const u of users || []) {
      if (!clinicUsers[u.clinic_id]) clinicUsers[u.clinic_id] = []
      clinicUsers[u.clinic_id].push(u.id)
    }
  }

  const notifications: {
    user_id: string
    type: string
    title: string
    message: string
    link: string
  }[] = []

  for (const f of due) {
    const lead = Array.isArray(f.lead) ? f.lead[0] : f.lead
    const nome = lead?.name || lead?.phone || 'lead'
    const message = `Hora de entrar em contato com ${nome}${f.note ? ` — ${f.note}` : ''}`
    const link = `/dashboard/crm?lead=${f.lead_id}`
    const targets = f.created_by ? [f.created_by] : (clinicUsers[f.clinic_id] || [])
    for (const uid of targets) {
      notifications.push({
        user_id: uid,
        type: 'followup_reminder',
        title: 'Lembrete de follow-up',
        message,
        link,
      })
    }
  }

  if (notifications.length) {
    await svc.from('notifications').insert(notifications)
  }

  // Marca todos como lembrados (inclusive os sem usuário-alvo, pra não reprocessar).
  const ids = due.map(f => f.id)
  await svc
    .from('lead_followups')
    .update({ reminded_at: new Date().toISOString() })
    .in('id', ids)

  return NextResponse.json({ ok: true, reminded: ids.length, notifications: notifications.length })
}
