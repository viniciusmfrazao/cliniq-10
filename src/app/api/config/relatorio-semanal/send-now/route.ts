import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function fmt(v: number) { return v.toLocaleString('pt-BR') }
function fmtMoney(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'nao_autenticado' }, { status: 401 })

  const svc = createServiceClient()

  // Buscar clínica do usuário
  const { data: userRow } = await svc.from('users').select('clinic_id').eq('id', user.id).maybeSingle()
  if (!userRow?.clinic_id) return NextResponse.json({ ok: false, error: 'sem_clinica' }, { status: 403 })

  const clinicId = userRow.clinic_id

  // Buscar configuração do relatório desta clínica
  const { data: automation } = await svc
    .from('clinic_automations')
    .select('relatorio_semanal, relatorio_telefones')
    .eq('clinic_id', clinicId)
    .maybeSingle()

  if (!automation?.relatorio_semanal) {
    return NextResponse.json({ ok: false, error: 'relatorio_desativado' }, { status: 400 })
  }

  const phones = (automation.relatorio_telefones || '')
    .split(/[,\n]/).map((p: string) => p.trim()).filter(Boolean)

  if (phones.length === 0) {
    return NextResponse.json({ ok: false, error: 'sem_telefones' }, { status: 400 })
  }

  // Buscar dados da semana atual
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  const [
    { data: appointments },
    { data: newPatients },
    { data: revenues },
    { data: clinicData },
  ] = await Promise.all([
    svc.from('appointments')
      .select('id, status')
      .eq('clinic_id', clinicId)
      .gte('start_time', startOfWeek.toISOString()),
    svc.from('patients')
      .select('id')
      .eq('clinic_id', clinicId)
      .gte('created_at', startOfWeek.toISOString()),
    svc.from('financial_transactions')
      .select('amount, type')
      .eq('clinic_id', clinicId)
      .gte('created_at', startOfWeek.toISOString()),
    svc.from('clinics').select('name').eq('id', clinicId).maybeSingle(),
  ])

  const clinicName = clinicData?.name || 'Clínica'
  const total = appointments?.length || 0
  const completed = appointments?.filter((a: any) => a.status === 'completed').length || 0
  const cancelled = appointments?.filter((a: any) => a.status === 'cancelled').length || 0
  const novos = newPatients?.length || 0
  const receita = revenues?.filter((r: any) => r.type === 'income').reduce((s: number, r: any) => s + (r.amount || 0), 0) || 0
  const despesas = revenues?.filter((r: any) => r.type === 'expense').reduce((s: number, r: any) => s + (r.amount || 0), 0) || 0

  const dateLabel = startOfWeek.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const todayLabel = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

  const message =
    `📊 *Relatório ${clinicName}*\n` +
    `📅 ${dateLabel} a ${todayLabel}\n\n` +
    `🗓️ *Agendamentos:* ${fmt(total)}\n` +
    `✅ Realizados: ${fmt(completed)}\n` +
    `❌ Cancelados: ${fmt(cancelled)}\n\n` +
    `👤 *Novos pacientes:* ${fmt(novos)}\n\n` +
    `💰 *Financeiro:*\n` +
    `Receita: ${fmtMoney(receita)}\n` +
    `Despesas: ${fmtMoney(despesas)}\n` +
    `Resultado: ${fmtMoney(receita - despesas)}`

  let sent = 0
  for (const phone of phones) {
    const r = await sendWhatsappMessage({ clinicId, phone, message, purpose: 'automation' })
    if (r.ok) sent++
  }

  return NextResponse.json({ ok: true, sent, total: phones.length })
}
