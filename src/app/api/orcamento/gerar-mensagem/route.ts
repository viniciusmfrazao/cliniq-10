import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/orcamento/gerar-mensagem
 * Gera uma mensagem de WhatsApp personalizada para o orçamento usando IA.
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

  // Buscar orçamento + itens + paciente
  const { data: orc } = await svc
    .from('orcamentos')
    .select('*, orcamento_itens(*), patients(id, name, phone, gender, birth_date, notes, tags)')
    .eq('id', orcamentoId)
    .eq('clinic_id', clinicId)
    .maybeSingle()

  if (!orc) return NextResponse.json({ ok: false, error: 'orcamento_nao_encontrado' }, { status: 404 })

  const patient = orc.patients as any
  const itens = (orc.orcamento_itens || []) as any[]

  // Buscar nome da clínica
  const { data: clinic } = await svc.from('clinics').select('name').eq('id', clinicId).maybeSingle()
  const clinicName = clinic?.name || 'nossa clínica'

  // Buscar memória emocional (pacientes da Eva)
  let memoriaEmocional: any = null
  if (patient?.phone) {
    const { data: mem } = await svc
      .from('lead_emotional_memory')
      .select('interesse_principal, objecao, gatilho_potencial, resumo')
      .eq('clinic_id', clinicId)
      .eq('phone', patient.phone.replace(/\D/g, ''))
      .maybeSingle()
    memoriaEmocional = mem
  }

  // Buscar descrições dos procedimentos cadastrados que batem com os itens
  const { data: procedimentos } = await svc
    .from('procedures')
    .select('name, description, notes, is_promotion, original_price, includes_return, return_days')
    .eq('clinic_id', clinicId)
    .eq('active', true)

  // Calcular total
  const totalValor = itens.reduce((acc: number, i: any) => acc + (i.quantidade * i.valor_unitario), 0)

  // Montar contexto dos itens com descrição do procedimento se encontrada
  const itensComDescricao = itens.map((item: any) => {
    const proc = procedimentos?.find(p =>
      p.name.toLowerCase().trim() === item.descricao.toLowerCase().trim()
    )
    return {
      descricao: item.descricao,
      quantidade: item.quantidade,
      valor: fmt(item.quantidade * item.valor_unitario),
      descricao_procedimento: proc?.description || proc?.notes || null,
      inclui_retorno: proc?.includes_return ? `inclui retorno em ${proc.return_days} dias` : null,
    }
  })

  // Calcular idade se tiver birth_date
  let idade: number | null = null
  if (patient?.birth_date) {
    const nascimento = new Date(patient.birth_date + 'T12:00:00')
    const hoje = new Date()
    idade = hoje.getFullYear() - nascimento.getFullYear()
  }

  // Montar prompt
  const genero = patient?.gender === 'female' ? 'feminino' : patient?.gender === 'male' ? 'masculino' : null
  const primeiroNome = (patient?.name || 'paciente').split(' ')[0]

  const promptContexto = [
    `Clínica: ${clinicName}`,
    `Paciente: ${patient?.name || 'paciente'}${idade ? `, ${idade} anos` : ''}${genero ? `, gênero ${genero}` : ''}`,
    patient?.notes ? `Observações sobre a paciente: ${patient.notes}` : null,
    patient?.tags?.length ? `Tags: ${patient.tags.join(', ')}` : null,
    `\nOrçamento: ${orc.titulo}`,
    `Itens:\n${itensComDescricao.map((i: any) => {
      let linha = `- ${i.descricao} (${i.quantidade}x): ${i.valor}`
      if (i.descricao_procedimento) linha += `\n  Sobre o procedimento: ${i.descricao_procedimento}`
      if (i.inclui_retorno) linha += `\n  ${i.inclui_retorno}`
      return linha
    }).join('\n')}`,
    `Total: ${fmt(totalValor)}`,
    orc.valido_ate ? `Válido até: ${new Date(orc.valido_ate + 'T12:00:00').toLocaleDateString('pt-BR')}` : null,
    orc.observacoes ? `Condições/observações do orçamento: ${orc.observacoes}` : null,
    memoriaEmocional?.interesse_principal ? `\nInteresse principal da paciente: ${memoriaEmocional.interesse_principal}` : null,
    memoriaEmocional?.objecao ? `Objeção conhecida: ${memoriaEmocional.objecao}` : null,
    memoriaEmocional?.gatilho_potencial ? `Gatilho potencial: ${memoriaEmocional.gatilho_potencial}` : null,
    memoriaEmocional?.resumo ? `Resumo da conversa anterior: ${memoriaEmocional.resumo}` : null,
  ].filter(Boolean).join('\n')

  const systemPrompt = `Você é especialista em comunicação para clínicas estéticas brasileiras. 
Sua tarefa é escrever uma mensagem de WhatsApp que envie um orçamento de forma calorosa, personalizada e persuasiva.

Regras obrigatórias:
- Escreva em português brasileiro informal mas elegante
- Use o primeiro nome da paciente
- Mencione os procedimentos de forma valorizada, não apenas como lista de preços
- Se houver objeção conhecida, enderece-a sutilmente SEM revelar que você sabe da objeção
- Se houver gatilho potencial, use-o naturalmente na mensagem
- Inclua os valores de forma clara mas não como foco principal
- Máximo 5 parágrafos curtos — mensagem de WhatsApp, não e-mail
- Use emojis com moderação (máximo 3)
- Termine convidando para tirar dúvidas ou confirmar
- NÃO use asteriscos para negrito no texto corrido — só nos valores monetários e título do orçamento
- NÃO mencione que é uma "mensagem gerada por IA"`

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, error: 'api_key_ausente' }, { status: 500 })

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Com base nas informações abaixo, escreva a mensagem de WhatsApp:\n\n${promptContexto}` }],
      }),
    })

    const aiData = await aiRes.json()
    const mensagem = aiData?.content?.[0]?.text?.trim()

    if (!mensagem) return NextResponse.json({ ok: false, error: 'ia_sem_resposta' }, { status: 500 })

    return NextResponse.json({ ok: true, mensagem })
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'erro_ia' }, { status: 500 })
  }
}
