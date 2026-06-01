import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWhatsappMessage } from '@/lib/whatsapp'

/**
 * POST /api/orcamento/send
 * Envia orçamento pelo WhatsApp da clínica.
 * Body: { orcamentoId: string }
 */
function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'nao_autenticado' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users').select('id, clinic_id').eq('id', user.id).maybeSingle()
  if (!userRow?.clinic_id) return NextResponse.json({ ok: false, error: 'sem_clinica' }, { status: 403 })

  const clinicId = userRow.clinic_id as string

  let body: { orcamentoId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'json_invalido' }, { status: 400 }) }

  const { orcamentoId } = body
  if (!orcamentoId) return NextResponse.json({ ok: false, error: 'orcamentoId_obrigatorio' }, { status: 400 })

  const svc = createServiceClient()

  // Buscar orçamento com itens e paciente
  const { data: orc, error: errOrc } = await svc
    .from('orcamentos')
    .select('*, orcamento_itens(*), patients(id, name, phone)')
    .eq('id', orcamentoId)
    .eq('clinic_id', clinicId)
    .maybeSingle()

  if (errOrc || !orc) return NextResponse.json({ ok: false, error: 'orcamento_nao_encontrado' }, { status: 404 })

  const patient = orc.patients as any
  const phone = (patient?.phone || '').trim()
  if (!phone) return NextResponse.json({ ok: false, error: 'paciente_sem_telefone' }, { status: 400 })

  // Buscar nome da clínica
  const { data: clinic } = await svc.from('clinics').select('name').eq('id', clinicId).maybeSingle()
  const clinicName = clinic?.name || 'nossa clínica'
  const firstName = (patient.name || '').split(' ')[0]

  // Calcular total
  const itens = (orc.orcamento_itens || []) as any[]
  const total = itens.reduce((acc: number, i: any) => acc + (i.quantidade * i.valor_unitario), 0)
  const itensText = itens.map((i: any) =>
    `• ${i.descricao} (${i.quantidade}x) — ${fmt(i.quantidade * i.valor_unitario)}`
  ).join('\n')

  const validoAte = orc.valido_ate
    ? `\nVálido até: ${new Date(orc.valido_ate + 'T12:00:00').toLocaleDateString('pt-BR')}`
    : ''

  const message =
    `Olá ${firstName}! 😊\n\n` +
    `Segue o orçamento da ${clinicName}:\n\n` +
    `*${orc.titulo}*\n\n` +
    `${itensText}\n\n` +
    `*Total: ${fmt(total)}*${validoAte}\n\n` +
    `Qualquer dúvida, estamos à disposição! 🤍`

  const result = await sendWhatsappMessage({ clinicId, phone, message, purpose: 'manual' })

  // Registrar envio no orçamento
  await svc.from('orcamentos').update({
    whatsapp_sent_at: new Date().toISOString(),
    whatsapp_sent_by: userRow.id,
  }).eq('id', orcamentoId).then(() => {})

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, sent: 'link_only' })
  }

  return NextResponse.json({ ok: true, sent: 'whatsapp' })
}
